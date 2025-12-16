import React, { useState, useEffect } from 'react';
import { db } from './firebase'; 
import { collection, getDocs, addDoc, serverTimestamp, query, orderBy } from 'firebase/firestore'; 

const API_URL = "https://procesar-op-ja33qfekia-uc.a.run.app";

function Dashboard() {
  // --- ESTADOS DE DATOS ---
  const [planProduccion, setPlanProduccion] = useState([]);
  const [imagenesSubidas, setImagenesSubidas] = useState([]); // Array de {op: "51", url: "..."}
  const [historialGuardado, setHistorialGuardado] = useState([]);
  
  // --- ESTADOS DE INTERFAZ ---
  const [loading, setLoading] = useState(false); 
  const [procesando, setProcesando] = useState(false); 
  const [mensaje, setMensaje] = useState("");
  const [filtroOP, setFiltroOP] = useState("TODAS"); 
  const [filtroOC, setFiltroOC] = useState("TODAS");
  const [imagenModal, setImagenModal] = useState(null); // Para ver foto en grande

  // Listas para dropdowns
  const opsCargadas = ["TODAS", ...new Set(planProduccion.flatMap(row => row.opsAsociadas))];
  const ocsCargadas = ["TODAS", ...new Set(planProduccion.map(row => row.numeroOC).filter(Boolean))];

  // 1. CARGAR HISTORIAL AL INICIO
  useEffect(() => {
    const cargarHistorial = async () => {
      try {
        const q = query(collection(db, 'ProduccionesCombinadas'), orderBy('fecha', 'desc'));
        const snapshot = await getDocs(q);
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setHistorialGuardado(data);
      } catch (e) { console.error("Error cargando historial:", e); }
    };
    cargarHistorial();
  }, []);

  // 2. DETECTOR DE PEGAR (Ctrl + V)
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
  }, [planProduccion, imagenesSubidas]);

  // 3. LÓGICA DE FUSIÓN DE DATOS
  const agregarAlPlan = (datosNuevos, imagenBase64) => {
    const opId = datosNuevos.numero_op || "S/N";
    
    // Guardar imagen en galería
    setImagenesSubidas(prev => [...prev, { op: opId, url: imagenBase64 }]);

    let planActualizado = [...planProduccion];

    datosNuevos.insumos.forEach(insumo => {
        const nombreNorm = insumo.nombre.trim().toUpperCase();
        const indiceExistente = planActualizado.findIndex(item => item.nombre === nombreNorm);

        if (indiceExistente >= 0) {
            // SI EXISTE: Actualizamos totales y desglose
            const item = planActualizado[indiceExistente];
            item.cantidadTotal += insumo.cantidad;
            
            // Agregar al desglose por OP
            item.desglose[opId] = (item.desglose[opId] || 0) + insumo.cantidad;

            if (!item.opsAsociadas.includes(opId)) {
                item.opsAsociadas.push(opId);
            }
        } else {
            // NO EXISTE: Nueva fila
            planActualizado.push({
                nombre: nombreNorm,
                cantidadTotal: insumo.cantidad, // Total acumulado
                desglose: { [opId]: insumo.cantidad }, // Cuánto pide cada OP individualmente
                unidad: insumo.unidad,
                stockPlanta: 0, 
                estado: "Pendiente", 
                fechaEntrega: "",  // Nueva Columna
                numeroOC: "",      // Nueva Columna
                opsAsociadas: [opId]
            });
        }
    });
    setPlanProduccion(planActualizado);
  };

  const procesarImagen = async (imagenBase64) => {
    setProcesando(true);
    setMensaje("⏳ Analizando OP...");

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: imagenBase64 })
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Error desconocido");

      agregarAlPlan(data.datos, imagenBase64);
      setMensaje(`✅ ¡OP ${data.datos.numero_op} agregada!`);
      
    } catch (error) {
      setMensaje("❌ Error: " + error.message);
    }
    setProcesando(false);
  };

  // --- FUNCIONES DE GUARDADO Y LIMPIEZA ---
  const guardarProduccion = async () => {
    if (planProduccion.length === 0) return alert("No hay datos para guardar.");
    setLoading(true);
    try {
        const nombreAuto = `Prod: ${opsCargadas.filter(o=>o!=='TODAS').join('+')}`;
        await addDoc(collection(db, 'ProduccionesCombinadas'), {
            nombre: nombreAuto,
            items: planProduccion,
            imagenes: imagenesSubidas,
            fecha: serverTimestamp()
        });
        alert("¡Producción guardada en la nube! ☁️");
        window.location.reload(); // Recarga simple para actualizar menú
    } catch (e) {
        alert("Error al guardar: " + e.message);
    }
    setLoading(false);
  };

  const cargarProduccion = (prod) => {
      if(window.confirm("¿Cargar esta producción anterior? Se reemplazarán los datos actuales.")) {
          setPlanProduccion(prod.items);
          setImagenesSubidas(prod.imagenes || []);
          setMensaje(`📂 Cargada: ${prod.nombre}`);
      }
  };

  const limpiarTodo = () => {
      if(window.confirm("¿Estás seguro de borrar todo? Si no guardaste, se perderá.")) {
          setPlanProduccion([]);
          setImagenesSubidas([]);
          setMensaje("Tabla limpia ✨");
      }
  };

  // --- EDITORES DE CELDA ---
  const actualizarCampo = (index, campo, valor) => {
      // Necesitamos encontrar el item real en el array completo (por si está filtrado)
      const nombreItem = datosFiltrados[index].nombre;
      const indiceReal = planProduccion.findIndex(i => i.nombre === nombreItem);
      
      if (indiceReal >= 0) {
          const nuevosDatos = [...planProduccion];
          nuevosDatos[indiceReal][campo] = valor;
          setPlanProduccion(nuevosDatos);
      }
  };

  // --- FILTRADO INTELIGENTE ---
  const datosFiltrados = planProduccion.filter(row => {
      const pasaOP = filtroOP === "TODAS" || row.opsAsociadas.includes(filtroOP);
      const pasaOC = filtroOC === "TODAS" || row.numeroOC === filtroOC;
      return pasaOP && pasaOC;
  });

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif', maxWidth: '1400px', margin: '0 auto' }}>
      
      {/* HEADER SUPERIOR */}
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px', borderBottom:'2px solid #ecf0f1', paddingBottom:'10px'}}>
        <div>
            <h1 style={{ color: '#2c3e50', margin: 0 }}>🏭 MRP Planner - Alimentos</h1>
            <p style={{margin:0, fontSize:'12px', color:'#7f8c8d'}}>Gestión de OPs Múltiples</p>
        </div>
        
        <div style={{display:'flex', gap:'10px'}}>
            {/* MENÚ DE CARGAR */}
            <select onChange={(e) => {
                if(e.target.value) cargarProduccion(JSON.parse(e.target.value));
            }} style={{padding:'8px', borderColor:'#3498db'}}>
                <option value="">📂 Cargar Anterior...</option>
                {historialGuardado.map(h => (
                    <option key={h.id} value={JSON.stringify(h)}>
                        {h.nombre} ({new Date(h.fecha?.seconds * 1000).toLocaleDateString()})
                    </option>
                ))}
            </select>

            <button onClick={guardarProduccion} disabled={loading} style={{backgroundColor:'#27ae60', color:'white', border:'none', padding:'8px 15px', borderRadius:'4px', cursor:'pointer'}}>
                💾 Guardar Producción
            </button>
            <button onClick={limpiarTodo} style={{backgroundColor:'#e74c3c', color:'white', border:'none', padding:'8px 15px', borderRadius:'4px', cursor:'pointer'}}>
                🗑️ Limpiar
            </button>
        </div>
      </div>

      {/* PANEL DE CONTROL DE IMÁGENES */}
      <div style={{backgroundColor:'#fdfdfd', border:'2px dashed #bdc3c7', padding:'15px', borderRadius:'8px', marginBottom:'20px', display:'flex', alignItems:'center', gap:'20px'}}>
        <div style={{flex:1}}>
             <h3 style={{margin:'0 0 5px 0'}}>📷 OPs Subidas: {imagenesSubidas.length}</h3>
             <p style={{fontSize:'12px', color:'#7f8c8d'}}>Presiona <strong>Ctrl + V</strong> para pegar más OPs.</p>
             <div style={{display:'flex', gap:'10px', overflowX:'auto', paddingBottom:'5px'}}>
                 {imagenesSubidas.map((img, idx) => (
                     <div key={idx} style={{position:'relative', cursor:'pointer'}} onClick={() => setImagenModal(img.url)}>
                         <img src={img.url} alt="OP" style={{height:'60px', borderRadius:'4px', border:'1px solid #ddd'}} />
                         <span style={{position:'absolute', bottom:0, right:0, background:'rgba(0,0,0,0.7)', color:'white', fontSize:'10px', padding:'2px'}}>OP {img.op}</span>
                     </div>
                 ))}
             </div>
        </div>
        <div style={{textAlign:'right'}}>
             <h2 style={{color: mensaje.includes('❌')?'red':'#2ecc71', margin:0}}>{mensaje}</h2>
             {procesando && <span style={{color:'#e67e22', fontWeight:'bold'}}>⚡ Procesando IA...</span>}
        </div>
      </div>

      {/* BARRA DE FILTROS */}
      <div style={{backgroundColor:'#34495e', padding:'15px', borderRadius:'8px 8px 0 0', display:'flex', gap:'30px', color:'white'}}>
        <label>
            Filtrar por OP: 
            <select 
                value={filtroOP} 
                onChange={(e) => setFiltroOP(e.target.value)}
                style={{marginLeft:'10px', padding:'5px', color:'black'}}
            >
                {opsCargadas.map(op => <option key={op} value={op}>{op}</option>)}
            </select>
        </label>
        
        <label>
            Filtrar por OC: 
            <select 
                value={filtroOC} 
                onChange={(e) => setFiltroOC(e.target.value)}
                style={{marginLeft:'10px', padding:'5px', color:'black'}}
            >
                {ocsCargadas.map(oc => <option key={oc} value={oc}>{oc || "(Sin OC)"}</option>)}
            </select>
        </label>
      </div>

      {/* TABLA MAESTRA */}
      <div style={{overflowX: 'auto', border:'1px solid #bdc3c7', borderTop:'none'}}>
        <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor:'white', fontSize:'14px' }}>
          <thead>
            <tr style={{ backgroundColor: '#ecf0f1', color: '#2c3e50', textAlign: 'left', borderBottom:'2px solid #bdc3c7' }}>
              <th style={{ padding: '10px' }}>INSUMO / ARTÍCULO</th>
              <th style={{ padding: '10px' }}>
                  {filtroOP === "TODAS" ? "REQ. TOTAL" : `REQ. OP ${filtroOP}`}
              </th>
              <th style={{ padding: '10px', backgroundColor:'#f9e79f' }}>STOCK PLANTA</th>
              <th style={{ padding: '10px' }}>A COMPRAR</th>
              <th style={{ padding: '10px' }}># OC</th>
              <th style={{ padding: '10px' }}>F. ENTREGA</th>
              <th style={{ padding: '10px' }}>ESTATUS</th>
              <th style={{ padding: '10px' }}>ORIGEN</th>
            </tr>
          </thead>
          <tbody>
            {datosFiltrados.length === 0 ? (
                <tr><td colSpan="8" style={{padding:'40px', textAlign:'center', color:'#999'}}>No hay datos visibles.</td></tr>
            ) : (
                datosFiltrados.map((row, index) => {
                    // LÓGICA CLAVE: Si filtro TODAS, uso el total. Si filtro OP, uso solo el desglose de esa OP.
                    const cantidadMostrar = filtroOP === "TODAS" 
                        ? row.cantidadTotal 
                        : (row.desglose[filtroOP] || 0);
                    
                    const stock = parseFloat(row.stockPlanta) || 0;
                    // El "A Comprar" se calcula contra lo que estoy mostrando. 
                    // Si filtro por OP, muestro cuánto le falta a ESA OP (asumiendo stock 0 para simplificar visualización parcial)
                    const aComprar = Math.max(0, cantidadMostrar - stock);
                    const cubierto = aComprar <= 0;

                    return (
                        <tr key={index} style={{ borderBottom: '1px solid #ecf0f1', backgroundColor: cubierto ? '#f0fff4' : 'white' }}>
                            <td style={{ padding: '8px', fontWeight:'bold', color:'#2c3e50' }}>{row.nombre}</td>
                            
                            <td style={{ padding: '8px', fontWeight:'bold' }}>
                                {cantidadMostrar.toFixed(2)} <span style={{fontSize:'0.8em', color:'#7f8c8d'}}>{row.unidad}</span>
                            </td>
                            
                            {/* EDITABLE: STOCK */}
                            <td style={{ padding: '8px', backgroundColor:'#fcf3cf' }}>
                                <input type="number" value={row.stockPlanta} onChange={(e) => actualizarCampo(index, 'stockPlanta', e.target.value)}
                                    style={{width:'70px', padding:'5px', border:'1px solid #ccc', textAlign:'center'}} />
                            </td>
                            
                            <td style={{ padding: '8px', color: cubierto ? '#27ae60' : '#c0392b', fontWeight:'bold' }}>
                                {cubierto ? "✓" : `${aComprar.toFixed(2)}`}
                            </td>

                            {/* EDITABLE: NUMERO OC */}
                            <td style={{ padding: '8px' }}>
                                <input type="text" value={row.numeroOC} placeholder="OC..." onChange={(e) => actualizarCampo(index, 'numeroOC', e.target.value)}
                                    style={{width:'60px', padding:'5px', border:'1px solid #ccc'}} />
                            </td>

                            {/* EDITABLE: FECHA ENTREGA */}
                            <td style={{ padding: '8px' }}>
                                <input type="date" value={row.fechaEntrega} onChange={(e) => actualizarCampo(index, 'fechaEntrega', e.target.value)}
                                    style={{padding:'4px', border:'1px solid #ccc', fontSize:'11px'}} />
                            </td>
                            
                            {/* EDITABLE: ESTATUS */}
                            <td style={{ padding: '8px' }}>
                                <select value={row.estado} onChange={(e) => actualizarCampo(index, 'estado', e.target.value)}
                                    style={{
                                        padding:'4px', borderRadius:'4px', border:'none', 
                                        backgroundColor: row.estado === 'Completo' ? '#2ecc71' : (row.estado === 'OC enviada' ? '#3498db' : '#95a5a6'),
                                        color: 'white', fontWeight:'bold', fontSize:'11px', cursor:'pointer'
                                    }}
                                >
                                    <option value="Pendiente">Pendiente</option>
                                    <option value="OC enviada">OC enviada</option>
                                    <option value="Por entregar">Por entregar</option>
                                    <option value="Completo">Completo</option>
                                </select>
                            </td>
                            
                            <td style={{ padding: '8px', fontSize:'0.8em', color:'#7f8c8d' }}>
                                {row.opsAsociadas.join(", ")}
                            </td>
                        </tr>
                    );
                })
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL PARA VER FOTO GRANDE */}
      {imagenModal && (
          <div style={{position:'fixed', top:0, left:0, width:'100%', height:'100%', background:'rgba(0,0,0,0.8)', display:'flex', justifyContent:'center', alignItems:'center', zIndex:1000}} onClick={()=>setImagenModal(null)}>
              <img src={imagenModal} style={{maxHeight:'90%', maxWidth:'90%', borderRadius:'8px'}} />
          </div>
      )}

    </div>
  );
}

export default Dashboard;