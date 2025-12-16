import React, { useState, useEffect } from 'react';
import { db } from './firebase'; 
import { collection, getDocs, addDoc, serverTimestamp, query, orderBy } from 'firebase/firestore'; 

const API_URL = "https://procesar-op-ja33qfekia-uc.a.run.app";

function Dashboard() {
  const [planProduccion, setPlanProduccion] = useState([]);
  const [imagenesSubidas, setImagenesSubidas] = useState([]);
  const [historialGuardado, setHistorialGuardado] = useState([]);
  
  const [loading, setLoading] = useState(false); 
  const [procesando, setProcesando] = useState(false); 
  const [mensaje, setMensaje] = useState("");
  const [filtroOP, setFiltroOP] = useState("TODAS"); 
  const [filtroOC, setFiltroOC] = useState("TODAS");
  const [imagenModal, setImagenModal] = useState(null);

  const opsCargadas = ["TODAS", ...new Set(planProduccion.flatMap(row => row.opsAsociadas))];
  const ocsCargadas = ["TODAS", ...new Set(planProduccion.map(row => row.numeroOC).filter(Boolean))];

  useEffect(() => {
    const cargarHistorial = async () => {
      try {
        const q = query(collection(db, 'ProduccionesCombinadas'), orderBy('fecha', 'desc'));
        const snapshot = await getDocs(q);
        setHistorialGuardado(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (e) { console.error(e); }
    };
    cargarHistorial();
  }, []);

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

  const agregarAlPlan = (datosNuevos, imagenBase64) => {
    const opId = datosNuevos.numero_op || "S/N";
    setImagenesSubidas(prev => [...prev, { op: opId, url: imagenBase64 }]);
    
    // items viene del nuevo formato del backend
    const itemsNuevos = datosNuevos.items || datosNuevos.insumos || [];

    let planActualizado = [...planProduccion];

    itemsNuevos.forEach(itemNuevo => {
        const nombreNorm = itemNuevo.nombre.trim().toUpperCase();
        const categoria = itemNuevo.categoria || "INSUMO"; // Por defecto

        const indiceExistente = planActualizado.findIndex(p => p.nombre === nombreNorm);

        if (indiceExistente >= 0) {
            const item = planActualizado[indiceExistente];
            item.cantidadTotal += itemNuevo.cantidad;
            item.desglose[opId] = (item.desglose[opId] || 0) + itemNuevo.cantidad;
            if (!item.opsAsociadas.includes(opId)) item.opsAsociadas.push(opId);
        } else {
            planActualizado.push({
                nombre: nombreNorm,
                categoria: categoria, // Guardamos la categoría
                cantidadTotal: itemNuevo.cantidad,
                desglose: { [opId]: itemNuevo.cantidad },
                unidad: itemNuevo.unidad,
                stockPlanta: 0, 
                estado: "Pendiente", 
                fechaEntrega: "",
                numeroOC: "",
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
      if (!response.ok) throw new Error(data.error || "Error");
      agregarAlPlan(data.datos, imagenBase64);
      setMensaje(`✅ ¡OP ${data.datos.numero_op} agregada!`);
    } catch (error) {
      setMensaje("❌ Error: " + error.message);
    }
    setProcesando(false);
  };

  const guardarProduccion = async () => {
    if (planProduccion.length === 0) return alert("Nada que guardar.");
    setLoading(true);
    try {
        const nombreAuto = `Prod: ${opsCargadas.filter(o=>o!=='TODAS').join('+')}`;
        await addDoc(collection(db, 'ProduccionesCombinadas'), {
            nombre: nombreAuto,
            items: planProduccion,
            imagenes: imagenesSubidas,
            fecha: serverTimestamp()
        });
        alert("¡Guardado exitoso!");
        window.location.reload();
    } catch (e) { alert(e.message); }
    setLoading(false);
  };

  const cargarProduccion = (prod) => {
      if(window.confirm("¿Cargar producción anterior?")) {
          setPlanProduccion(prod.items);
          setImagenesSubidas(prod.imagenes || []);
      }
  };

  const actualizarCampo = (nombreUnico, campo, valor) => {
      const indice = planProduccion.findIndex(i => i.nombre === nombreUnico);
      if (indice >= 0) {
          const nuevosDatos = [...planProduccion];
          nuevosDatos[indice][campo] = valor;
          setPlanProduccion(nuevosDatos);
      }
  };

  const actualizarNombre = (nombreAntiguo, nuevoNombre) => {
      const indice = planProduccion.findIndex(i => i.nombre === nombreAntiguo);
      if (indice >= 0) {
          const nuevosDatos = [...planProduccion];
          nuevosDatos[indice].nombre = nuevoNombre.toUpperCase();
          setPlanProduccion(nuevosDatos);
      }
  };

  // Filtrado general
  const datosFiltrados = planProduccion.filter(row => {
      const pasaOP = filtroOP === "TODAS" || row.opsAsociadas.includes(filtroOP);
      const pasaOC = filtroOC === "TODAS" || row.numeroOC === filtroOC;
      return pasaOP && pasaOC;
  });

  // Separación por grupos
  const grupoInsumos = datosFiltrados.filter(i => i.categoria === "INSUMO");
  const grupoEmpaques = datosFiltrados.filter(i => i.categoria === "EMPAQUE");

  // Componente de Tabla Reutilizable
  const TablaGrupo = ({ titulo, datos, colorHeader }) => (
    <div style={{marginBottom:'30px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', borderRadius:'8px', overflow:'hidden'}}>
        <div style={{backgroundColor: colorHeader, color:'white', padding:'10px', fontWeight:'bold'}}>
            {titulo} ({datos.length})
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor:'white', fontSize:'13px' }}>
          <thead>
            <tr style={{ backgroundColor: '#ecf0f1', color: '#555', textAlign: 'left', borderBottom:'2px solid #bdc3c7' }}>
              <th style={{ padding: '8px' }}>NOMBRE (Editable)</th>
              <th style={{ padding: '8px' }}>REQ. {filtroOP==="TODAS"?"TOTAL":filtroOP}</th>
              <th style={{ padding: '8px', width:'80px', backgroundColor:'#f9e79f' }}>STOCK</th>
              <th style={{ padding: '8px' }}>A COMPRAR</th>
              <th style={{ padding: '8px', width:'70px' }}># OC</th>
              <th style={{ padding: '8px' }}>F. ENTREGA</th>
              <th style={{ padding: '8px' }}>ESTATUS</th>
              <th style={{ padding: '8px' }}>ORIGEN</th>
            </tr>
          </thead>
          <tbody>
            {datos.length === 0 ? <tr><td colSpan="8" style={{padding:'15px', textAlign:'center', color:'#aaa'}}>--- Vacío ---</td></tr> : 
             datos.map((row, index) => {
                const cantidadMostrar = filtroOP === "TODAS" ? row.cantidadTotal : (row.desglose[filtroOP] || 0);
                const stock = parseFloat(row.stockPlanta) || 0;
                const aComprar = Math.max(0, cantidadMostrar - stock);
                const cubierto = aComprar <= 0;

                return (
                    <tr key={index} style={{ borderBottom: '1px solid #f0f0f0', backgroundColor: cubierto ? '#f0fff4' : 'white' }}>
                        {/* NOMBRE EDITABLE */}
                        <td style={{ padding: '5px' }}>
                            <input 
                                type="text" 
                                value={row.nombre} 
                                onChange={(e) => actualizarNombre(row.nombre, e.target.value)}
                                style={{width:'100%', border:'none', background:'transparent', fontWeight:'bold', color:'#2c3e50'}}
                            />
                        </td>
                        <td style={{ padding: '8px' }}>{cantidadMostrar.toFixed(2)} {row.unidad}</td>
                        <td style={{ padding: '5px', backgroundColor:'#fcf3cf' }}>
                            <input type="number" value={row.stockPlanta} onChange={(e) => actualizarCampo(row.nombre, 'stockPlanta', e.target.value)}
                                style={{width:'60px', border:'1px solid #ddd', textAlign:'center'}} />
                        </td>
                        <td style={{ padding: '8px', color: cubierto ? '#27ae60' : '#c0392b', fontWeight:'bold' }}>
                            {cubierto ? "✓" : aComprar.toFixed(2)}
                        </td>
                        <td style={{ padding: '5px' }}>
                            <input type="text" value={row.numeroOC} onChange={(e) => actualizarCampo(row.nombre, 'numeroOC', e.target.value)}
                                style={{width:'60px', border:'1px solid #ddd'}} />
                        </td>
                        <td style={{ padding: '5px' }}>
                            <input type="date" value={row.fechaEntrega} onChange={(e) => actualizarCampo(row.nombre, 'fechaEntrega', e.target.value)}
                                style={{border:'1px solid #ddd'}} />
                        </td>
                        <td style={{ padding: '5px' }}>
                            <select value={row.estado} onChange={(e) => actualizarCampo(row.nombre, 'estado', e.target.value)}
                                style={{border:'none', background: row.estado==='Completo'?'#2ecc71':(row.estado==='Pendiente'?'#95a5a6':'#3498db'), color:'white', borderRadius:'4px', padding:'3px'}}>
                                <option value="Pendiente">Pendiente</option>
                                <option value="OC enviada">OC enviada</option>
                                <option value="Por entregar">Por entregar</option>
                                <option value="Completo">Completo</option>
                            </select>
                        </td>
                        <td style={{ padding: '8px', fontSize:'0.8em', color:'#aaa' }}>{row.opsAsociadas.join(", ")}</td>
                    </tr>
                );
             })}
          </tbody>
        </table>
    </div>
  );

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif', maxWidth: '1400px', margin: '0 auto' }}>
      {/* HEADER */}
      <div style={{display:'flex', justifyContent:'space-between', marginBottom:'20px', borderBottom:'1px solid #ddd', paddingBottom:'10px'}}>
        <div><h1 style={{margin:0, color:'#2c3e50'}}>🏭 MRP Planner</h1><p style={{margin:0, fontSize:'12px', color:'#7f8c8d'}}>Planificador de Producción</p></div>
        <div style={{display:'flex', gap:'10px'}}>
            <select onChange={(e)=>e.target.value && cargarProduccion(JSON.parse(e.target.value))}>
                <option value="">📂 Historial...</option>
                {historialGuardado.map(h=><option key={h.id} value={JSON.stringify(h)}>{h.nombre}</option>)}
            </select>
            <button onClick={guardarProduccion} style={{background:'#27ae60', color:'white', border:'none', padding:'8px', borderRadius:'4px', cursor:'pointer'}}>💾 Guardar</button>
            <button onClick={()=>window.confirm("¿Borrar?") && setPlanProduccion([])} style={{background:'#e74c3c', color:'white', border:'none', padding:'8px', borderRadius:'4px', cursor:'pointer'}}>🗑️</button>
        </div>
      </div>

      {/* PANEL FOTOS */}
      <div style={{background:'#f9f9f9', padding:'10px', borderRadius:'8px', marginBottom:'20px', display:'flex', gap:'20px', alignItems:'center', border:'1px dashed #ccc'}}>
         <div><strong>📷 OPs: {imagenesSubidas.length}</strong> (Ctrl+V para agregar)</div>
         <div style={{display:'flex', gap:'5px'}}>
             {imagenesSubidas.map((img, i) => <img key={i} src={img.url} style={{height:'40px', cursor:'pointer', border:'1px solid #ddd'}} onClick={()=>setImagenModal(img.url)}/>)}
         </div>
         <div style={{marginLeft:'auto', fontWeight:'bold', color:mensaje.includes('❌')?'red':'green'}}>{mensaje} {procesando && "⚡"}</div>
      </div>

      {/* FILTROS */}
      <div style={{background:'#34495e', padding:'10px', color:'white', borderRadius:'5px', marginBottom:'20px', display:'flex', gap:'20px'}}>
         <label>Filtro OP: <select value={filtroOP} onChange={(e)=>setFiltroOP(e.target.value)} style={{color:'black'}}>{opsCargadas.map(op=><option key={op} value={op}>{op}</option>)}</select></label>
         <label>Filtro OC: <select value={filtroOC} onChange={(e)=>setFiltroOC(e.target.value)} style={{color:'black'}}>{ocsCargadas.map(oc=><option key={oc} value={oc}>{oc || "S/N"}</option>)}</select></label>
      </div>

      {/* TABLAS SEPARADAS */}
      <TablaGrupo titulo="📦 MATERIA PRIMA E INSUMOS" datos={grupoInsumos} colorHeader="#2980b9" />
      <TablaGrupo titulo="🏷️ MATERIALES DE EMPAQUE" datos={grupoEmpaques} colorHeader="#e67e22" />

      {/* MODAL FOTO */}
      {imagenModal && <div style={{position:'fixed', top:0, left:0, width:'100%', height:'100%', background:'rgba(0,0,0,0.8)', zIndex:999, display:'flex', justifyContent:'center', alignItems:'center'}} onClick={()=>setImagenModal(null)}>
          <img src={imagenModal} style={{maxHeight:'90%'}} />
      </div>}
    </div>
  );
}

export default Dashboard;