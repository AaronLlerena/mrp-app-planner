import React, { useState, useEffect } from 'react';
import { db } from './firebase'; 
import { collection, getDocs } from 'firebase/firestore'; 

// --- NUEVA URL DE TU SERVIDOR (Actualizada) ---
const API_URL = "https://procesar-op-ja33qfekia-uc.a.run.app";
// ----------------------------------------------

function Dashboard() {
  // Estado Principal: La "Hoja de Cálculo" de compras
  const [planProduccion, setPlanProduccion] = useState([]);
  
  const [loading, setLoading] = useState(false); 
  const [procesando, setProcesando] = useState(false); 
  const [mensaje, setMensaje] = useState("");
  const [filtroOP, setFiltroOP] = useState("TODAS"); 

  // Lista única de OPs cargadas para el filtro
  const opsCargadas = ["TODAS", ...new Set(planProduccion.flatMap(row => row.opsAsociadas))];

  // 1. Manejador de "Pegar Imagen" (Ctrl + V)
  useEffect(() => {
    const handlePaste = (e) => {
      const items = e.clipboardData.items;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image") !== -1) {
          const blob = items[i].getAsFile();
          const reader = new FileReader();
          reader.onloadend = () => procesarImagen(reader.result);
          reader.readAsDataURL(blob);
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [planProduccion]); // Dependencia clave para no perder datos al pegar varias veces

  // 2. Lógica Núcleo: FUSIONAR datos nuevos con la tabla existente
  const agregarAlPlan = (datosNuevos) => {
    const opId = datosNuevos.numero_op || "S/N";
    const nuevosInsumos = datosNuevos.insumos || [];
    
    // Copia del plan actual
    let planActualizado = [...planProduccion];

    nuevosInsumos.forEach(insumo => {
        const nombreNorm = insumo.nombre.trim().toUpperCase();
        
        // ¿Ya existe este insumo en la tabla?
        const indiceExistente = planActualizado.findIndex(item => item.nombre === nombreNorm);

        if (indiceExistente >= 0) {
            // SI EXISTE: Sumamos cantidades y agregamos la OP a la lista
            planActualizado[indiceExistente].cantidadRequerida += insumo.cantidad;
            if (!planActualizado[indiceExistente].opsAsociadas.includes(opId)) {
                planActualizado[indiceExistente].opsAsociadas.push(opId);
            }
        } else {
            // NO EXISTE: Nueva fila
            planActualizado.push({
                nombre: nombreNorm,
                cantidadRequerida: insumo.cantidad,
                unidad: insumo.unidad,
                stockPlanta: 0, // Inicia en 0 para que tú lo llenes
                estado: "Pendiente", 
                opsAsociadas: [opId]
            });
        }
    });

    setPlanProduccion(planActualizado);
  };

  const procesarImagen = async (imagenBase64) => {
    setProcesando(true);
    setMensaje("⏳ Leyendo OP y sumando al plan...");

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: imagenBase64 })
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Error desconocido");

      // Si todo sale bien, agregamos los datos a la tabla
      agregarAlPlan(data.datos);
      setMensaje(`✅ ¡OP ${data.datos.numero_op || 'detectada'} agregada con éxito!`);
      
    } catch (error) {
      setMensaje("❌ Error: " + error.message);
    }
    setProcesando(false);
  };

  // Funciones para editar manualmente (Stock y Estado)
  const actualizarStock = (index, valor) => {
    const nuevosDatos = [...planProduccion];
    // Buscamos el índice real en el array original (por si hay filtros activos)
    const itemReal = nuevosDatos.find(i => i.nombre === datosVisibles[index].nombre);
    if(itemReal) itemReal.stockPlanta = parseFloat(valor) || 0;
    setPlanProduccion(nuevosDatos);
  };

  const actualizarEstado = (index, valor) => {
    const nuevosDatos = [...planProduccion];
    const itemReal = nuevosDatos.find(i => i.nombre === datosVisibles[index].nombre);
    if(itemReal) itemReal.estado = valor;
    setPlanProduccion(nuevosDatos);
  };

  // Filtrado de visualización
  const datosVisibles = filtroOP === "TODAS" 
    ? planProduccion 
    : planProduccion.filter(row => row.opsAsociadas.includes(filtroOP));

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif', maxWidth: '1200px', margin: '0 auto' }}>
      
      {/* HEADER */}
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px'}}>
        <h1 style={{ color: '#2c3e50', margin: 0 }}>🏭 Planificador de Producción (MRP)</h1>
        <div style={{textAlign:'right'}}>
            <p style={{margin:0, fontSize:'14px', color:'#7f8c8d'}}>
                Presiona <strong>Ctrl + V</strong> para pegar tus OPs
            </p>
            <p style={{margin:0, fontWeight:'bold', color: mensaje.includes('❌') ? 'red' : 'green'}}>{mensaje}</p>
        </div>
      </div>

      {/* BARRA DE FILTROS */}
      <div style={{backgroundColor:'#ecf0f1', padding:'15px', borderRadius:'8px', marginBottom:'20px', display:'flex', gap:'20px', alignItems:'center'}}>
        <label style={{fontWeight:'bold'}}>Filtrar por OP:</label>
        <select 
            value={filtroOP} 
            onChange={(e) => setFiltroOP(e.target.value)}
            style={{padding:'8px', borderRadius:'4px', border:'1px solid #bdc3c7', cursor:'pointer'}}
        >
            {opsCargadas.map(op => <option key={op} value={op}>{op}</option>)}
        </select>
        
        <div style={{marginLeft:'auto'}}>
             {procesando && <span style={{color:'#e67e22', fontWeight:'bold', animation:'blink 1s infinite'}}>⚡ Procesando IA...</span>}
        </div>
      </div>

      {/* TABLA TIPO EXCEL */}
      <div style={{overflowX: 'auto', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', borderRadius:'8px', border:'1px solid #bdc3c7'}}>
        <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor:'white' }}>
          <thead>
            <tr style={{ backgroundColor: '#34495e', color: 'white', textAlign: 'left' }}>
              <th style={{ padding: '12px' }}>INSUMO / ARTÍCULO</th>
              <th style={{ padding: '12px' }}>REQ. TOTAL</th>
              <th style={{ padding: '12px', backgroundColor:'#f1c40f', color:'#333' }}>STOCK PLANTA</th>
              <th style={{ padding: '12px' }}>A COMPRAR</th>
              <th style={{ padding: '12px' }}>ESTATUS</th>
              <th style={{ padding: '12px' }}>OPs ORIGEN</th>
            </tr>
          </thead>
          <tbody>
            {datosVisibles.length === 0 ? (
                <tr><td colSpan="6" style={{padding:'40px', textAlign:'center', color:'#999'}}>
                    No hay datos. <br/>Haz una captura de tu OP y presiona <strong>Ctrl + V</strong> aquí.
                </td></tr>
            ) : (
                datosVisibles.map((row, index) => {
                    const aComprar = Math.max(0, row.cantidadRequerida - row.stockPlanta);
                    const cubierto = aComprar <= 0;

                    return (
                        <tr key={index} style={{ borderBottom: '1px solid #ecf0f1', backgroundColor: cubierto ? '#f0fff4' : 'white' }}>
                            <td style={{ padding: '10px', fontWeight:'bold', color:'#2c3e50' }}>{row.nombre}</td>
                            
                            <td style={{ padding: '10px' }}>
                                {row.cantidadRequerida.toFixed(2)} <span style={{fontSize:'0.8em', color:'#7f8c8d'}}>{row.unidad}</span>
                            </td>
                            
                            {/* COLUMNA EDITABLE: STOCK */}
                            <td style={{ padding: '10px', backgroundColor:'#fffae6' }}>
                                <input 
                                    type="number" 
                                    value={row.stockPlanta} 
                                    onChange={(e) => actualizarStock(index, e.target.value)}
                                    style={{
                                        padding:'6px', width:'80px', border:'1px solid #ccc', borderRadius:'4px', 
                                        textAlign:'center', fontWeight:'bold'
                                    }}
                                />
                            </td>
                            
                            <td style={{ padding: '10px', color: cubierto ? '#27ae60' : '#c0392b', fontWeight:'bold' }}>
                                {cubierto ? "✓ Cubierto" : `${aComprar.toFixed(2)}`}
                            </td>
                            
                            {/* COLUMNA EDITABLE: ESTADO */}
                            <td style={{ padding: '10px' }}>
                                <select 
                                    value={row.estado} 
                                    onChange={(e) => actualizarEstado(index, e.target.value)}
                                    style={{
                                        padding:'5px', borderRadius:'4px', border:'none', 
                                        backgroundColor: row.estado === 'Completo' ? '#2ecc71' : (row.estado === 'OC enviada' ? '#3498db' : '#95a5a6'),
                                        color: 'white', fontWeight:'bold', cursor:'pointer'
                                    }}
                                >
                                    <option value="Pendiente">Pendiente</option>
                                    <option value="OC enviada">OC enviada</option>
                                    <option value="Por entregar">Por entregar</option>
                                    <option value="Completo">Completo</option>
                                </select>
                            </td>
                            
                            <td style={{ padding: '10px', fontSize:'0.85em', color:'#7f8c8d' }}>
                                {row.opsAsociadas.join(", ")}
                            </td>
                        </tr>
                    );
                })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Dashboard;