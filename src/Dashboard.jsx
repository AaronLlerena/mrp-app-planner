import React, { useState, useEffect, useRef } from 'react';
import { db } from './firebase'; 
import { collection, getDocs, addDoc, serverTimestamp, query, orderBy } from 'firebase/firestore'; 

const API_URL = "https://procesar-op-ja33qfekia-uc.a.run.app";

// --- TUS ENLACES SOCIALES ---
const SOCIAL_LINKS = {
    linkedin: "https://www.linkedin.com/in/aaron-llerena", 
    github: "https://github.com/",
    researchgate: "https://www.researchgate.net/"
};

function Dashboard() {
  // --- ESTADOS ---
  const [planProduccion, setPlanProduccion] = useState([]);
  const [imagenesSubidas, setImagenesSubidas] = useState([]);
  const [historialGuardado, setHistorialGuardado] = useState([]);
  
  // --- ESTADOS VISUALES ---
  const [loading, setLoading] = useState(false); 
  const [procesando, setProcesando] = useState(false); 
  const [mensaje, setMensaje] = useState("");
  const [filtroOP, setFiltroOP] = useState("TODAS"); 
  const [filtroOC, setFiltroOC] = useState("TODAS");
  const [imagenModal, setImagenModal] = useState(null);
  
  // --- LOGS Y RELOJ ---
  // Iniciamos el log en español
  const [activityLog, setActivityLog] = useState([`> [SISTEMA] Iniciando Smart Planner AI v2.0... OK`]);
  const [latency, setLatency] = useState(0);
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString());

  const opsCargadas = ["TODAS", ...new Set(planProduccion.flatMap(row => row.opsAsociadas))];
  const ocsCargadas = ["TODAS", ...new Set(planProduccion.map(row => row.numeroOC).filter(Boolean))];

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date().toLocaleTimeString()), 1000);
    return () => clearInterval(timer);
  }, []);

  // CARGAR HISTORIAL
  useEffect(() => {
    const cargarHistorial = async () => {
      addToLog("Conectando a Firebase Firestore...");
      try {
        const q = query(collection(db, 'ProduccionesCombinadas'), orderBy('fecha', 'desc'));
        const snapshot = await getDocs(q);
        setHistorialGuardado(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        addToLog(`Firestore Conectado. ${snapshot.docs.length} registros cargados.`);
      } catch (e) { addToLog(`Error cargando historial: ${e.message}`); }
    };
    cargarHistorial();
  }, []);

  // DETECTOR DE PEGAR (Ctrl + V)
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

  // --- FUNCIONES AUXILIARES (Log en español) ---
  const addToLog = (text) => {
      const timestamp = new Date().toLocaleTimeString('es-ES', {hour12:false});
      setActivityLog(prev => [`> [${timestamp}] ${text}`, ...prev.slice(0, 49)]); 
  };

  const eliminarImagenIndividual = (indexToDelete) => {
    // Esta función borra visualmente la miniatura.
    // NOTA: No resta los datos de la tabla principal (eso requeriría una lógica más compleja de "deshacer").
    setImagenesSubidas(prevImagenes => prevImagenes.filter((_, index) => index !== indexToDelete));
    addToLog("Imagen eliminada de la lista visual.");
  };
  
  const limpiarTodo = () => {
      if(window.confirm("¿Estás seguro de borrar todo? Se perderán los datos no guardados.")) {
          setPlanProduccion([]);
          setImagenesSubidas([]); // CORRECCIÓN 4: Ahora borra las imágenes
          setMensaje("");
          addToLog("Sistema limpiado. Memoria vacía.");
      }
  };

  const exportarCSV = () => {
      if(planProduccion.length === 0) return alert("No hay datos para exportar.");
      addToLog("Exportando datos a CSV...");
      const headers = ["Categoria,Nombre,Cantidad Total,Unidad,Stock Planta,A Comprar,Numero OC,Estado,OPs Origen"];
      const rows = planProduccion.map(row => {
          const aComprar = Math.max(0, row.cantidadTotal - row.stockPlanta);
          return `${row.categoria},"${row.nombre}",${row.cantidadTotal},${row.unidad},${row.stockPlanta},${aComprar},"${row.numeroOC}",${row.estado},"${row.opsAsociadas.join('+')}"`;
      });
      const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].join("\n");
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `smart_planner_export_${new Date().toISOString().slice(0,10)}.csv`);
      document.body.appendChild(link);
      link.click();
      addToLog("Exportación CSV completada.");
  };

  // --- LÓGICA DE NEGOCIO ---
  const agregarAlPlan = (datosNuevos, imagenBase64) => {
    const opId = datosNuevos.numero_op || "S/N";
    setImagenesSubidas(prev => [...prev, { op: opId, url: imagenBase64 }]);
    
    const itemsNuevos = datosNuevos.items || datosNuevos.insumos || [];
    let planActualizado = [...planProduccion];

    itemsNuevos.forEach(itemNuevo => {
        const nombreNorm = itemNuevo.nombre.trim().toUpperCase();
        const categoria = itemNuevo.categoria || "INSUMO";
        const indiceExistente = planActualizado.findIndex(p => p.nombre === nombreNorm);

        if (indiceExistente >= 0) {
            const item = planActualizado[indiceExistente];
            item.cantidadTotal += itemNuevo.cantidad;
            item.desglose[opId] = (item.desglose[opId] || 0) + itemNuevo.cantidad;
            if (!item.opsAsociadas.includes(opId)) item.opsAsociadas.push(opId);
        } else {
            planActualizado.push({
                nombre: nombreNorm,
                categoria: categoria,
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
    // CORRECCIÓN 5: Mensaje con spinner CSS y rayo IA
    setMensaje(<span style={{display:'flex', alignItems:'center', color:'#e67e22'}}>
        <div className="spinner"></div> Enviando datos al motor Gemini AI... ⚡
    </span>);
    addToLog("Subiendo imagen...");
    const startTime = performance.now();

    try {
      addToLog("Solicitando análisis a Gemini 1.5 Flash...");
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: imagenBase64 })
      });
      
      const endTime = performance.now();
      setLatency(Math.round(endTime - startTime)); 
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Error del Servidor");

      addToLog(`Datos recibidos. Latencia: ${Math.round(endTime - startTime)}ms`);
      addToLog(`Procesando JSON para OP: ${data.datos.numero_op || 'Desconocida'}`);
      
      agregarAlPlan(data.datos, imagenBase64);
      setMensaje(`✅ ¡OP ${data.datos.numero_op} Procesada con Éxito!`);
      addToLog(`Éxito: Se fusionaron ${data.datos.items?.length || 0} items al MRP.`);
      
    } catch (error) {
      setMensaje("❌ Error: " + error.message);
      addToLog(`ERROR CRÍTICO: ${error.message}`);
    }
    setProcesando(false);
  };

  const guardarProduccion = async () => {
    if (planProduccion.length === 0) return alert("El plan está vacío.");
    setLoading(true);
    addToLog("Guardando estado de producción en la Nube...");
    try {
        const nombreAuto = `Prod: ${opsCargadas.filter(o=>o!=='TODAS').join('+')}`;
        await addDoc(collection(db, 'ProduccionesCombinadas'), {
            nombre: nombreAuto,
            items: planProduccion,
            imagenes: imagenesSubidas,
            fecha: serverTimestamp()
        });
        alert("¡Guardado en la Nube! ☁️");
        window.location.reload();
    } catch (e) { alert(e.message); addToLog("Fallo al guardar."); }
    setLoading(false);
  };

  const cargarProduccion = (prod) => {
      if(window.confirm("¿Cargar producción anterior? Se reemplazarán los datos actuales.")) {
          setPlanProduccion(prod.items);
          setImagenesSubidas(prod.imagenes || []);
          addToLog(`Historial cargado: ${prod.nombre}`);
      }
  };

  // Editores
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

  const datosFiltrados = planProduccion.filter(row => {
      const pasaOP = filtroOP === "TODAS" || row.opsAsociadas.includes(filtroOP);
      const pasaOC = filtroOC === "TODAS" || row.numeroOC === filtroOC;
      return pasaOP && pasaOC;
  });
  const grupoInsumos = datosFiltrados.filter(i => i.categoria === "INSUMO");
  const grupoEmpaques = datosFiltrados.filter(i => i.categoria === "EMPAQUE");

  // --- COMPONENTES VISUALES ---
  const TablaGrupo = ({ titulo, datos, colorHeader }) => (
    <div style={{marginBottom:'30px', borderRadius:'8px', overflow:'hidden', boxShadow:'0 4px 15px rgba(0,0,0,0.3)'}}>
        <div style={{backgroundColor: colorHeader, color:'white', padding:'12px', fontWeight:'bold', display:'flex', justifyContent:'space-between'}}>
            <span>{titulo}</span>
            <span style={{opacity:0.8, fontSize:'12px'}}>{datos.length} items</span>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor:'#fdfdfd', fontSize:'13px', color:'#333' }}>
          <thead>
            <tr style={{ backgroundColor: '#ecf0f1', color: '#555', textAlign: 'left', borderBottom:'2px solid #bdc3c7' }}>
              <th style={{ padding: '10px' }}>NOMBRE (Editable)</th>
              <th style={{ padding: '10px' }}>REQ. {filtroOP==="TODAS"?"TOTAL":filtroOP}</th>
              <th style={{ padding: '10px', width:'80px', backgroundColor:'#fff9c4' }}>STOCK</th>
              <th style={{ padding: '10px' }}>A COMPRAR</th>
              <th style={{ padding: '10px', width:'70px' }}># OC</th>
              <th style={{ padding: '10px' }}>F. ENTREGA</th>
              <th style={{ padding: '10px' }}>ESTATUS</th>
              <th style={{ padding: '10px' }}>ORIGEN</th>
            </tr>
          </thead>
          <tbody>
            {datos.length === 0 ? <tr><td colSpan="8" style={{padding:'20px', textAlign:'center', color:'#aaa', fontStyle:'italic'}}>--- Sin datos disponibles ---</td></tr> : 
             datos.map((row, index) => {
                const cantidadMostrar = filtroOP === "TODAS" ? row.cantidadTotal : (row.desglose[filtroOP] || 0);
                const stock = parseFloat(row.stockPlanta) || 0;
                const aComprar = Math.max(0, cantidadMostrar - stock);
                const cubierto = aComprar <= 0;

                return (
                    <tr key={index} style={{ borderBottom: '1px solid #eee', backgroundColor: cubierto ? '#f0fff4' : 'white' }}>
                        <td style={{ padding: '5px' }}>
                            <input type="text" value={row.nombre} onChange={(e) => actualizarNombre(row.nombre, e.target.value)}
                                style={{width:'100%', border:'none', background:'transparent', fontWeight:'bold', color:'#2c3e50', fontFamily:'monospace'}} />
                        </td>
                        <td style={{ padding: '8px' }}>{cantidadMostrar.toFixed(2)} {row.unidad}</td>
                        <td style={{ padding: '5px', backgroundColor:'#fff9c4' }}>
                            <input type="number" value={row.stockPlanta} onChange={(e) => actualizarCampo(row.nombre, 'stockPlanta', e.target.value)}
                                style={{width:'60px', border:'1px solid #ddd', textAlign:'center', borderRadius:'4px', padding:'4px'}} />
                        </td>
                        <td style={{ padding: '8px', color: cubierto ? '#27ae60' : '#c0392b', fontWeight:'bold' }}>
                            {cubierto ? "✓ OK" : aComprar.toFixed(2)}
                        </td>
                        <td style={{ padding: '5px' }}>
                            <input type="text" value={row.numeroOC} onChange={(e) => actualizarCampo(row.nombre, 'numeroOC', e.target.value)}
                                style={{width:'60px', border:'1px solid #ddd', padding:'4px', borderRadius:'4px'}} />
                        </td>
                        <td style={{ padding: '5px' }}>
                            <input type="date" value={row.fechaEntrega} onChange={(e) => actualizarCampo(row.nombre, 'fechaEntrega', e.target.value)}
                                style={{border:'1px solid #ddd', padding:'4px', borderRadius:'4px'}} />
                        </td>
                        <td style={{ padding: '5px' }}>
                            <select value={row.estado} onChange={(e) => actualizarCampo(row.nombre, 'estado', e.target.value)}
                                style={{border:'none', background: row.estado==='Completo'?'#2ecc71':(row.estado==='Pendiente'?'#95a5a6':'#3498db'), color:'white', borderRadius:'4px', padding:'4px 8px', fontSize:'11px', fontWeight:'bold'}}>
                                <option value="Pendiente">Pendiente</option>
                                <option value="OC enviada">OC enviada</option>
                                <option value="Por entregar">Por entregar</option>
                                <option value="Completo">Completo</option>
                            </select>
                        </td>
                        <td style={{ padding: '8px', fontSize:'0.75em', color:'#aaa' }}>{row.opsAsociadas.join(", ")}</td>
                    </tr>
                );
             })}
          </tbody>
        </table>
    </div>
  );

  return (
    <div style={{ paddingBottom: '60px' }}> 
      
      {/* HEADER */}
      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '30px 20px', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
        <div>
            {/* CORRECCIÓN 2: Título en Inglés */}
            <h1 style={{margin:0, color:'white', fontSize:'32px', letterSpacing:'-1px'}}>
                Smart Planner AI <span style={{fontSize:'18px', color:'#00d4ff', fontWeight:'300'}}>- by Aaron Llerena</span>
            </h1>
            <p style={{margin:'5px 0 0 0', fontSize:'13px', color:'#aab7c4', fontWeight:'600', textTransform:'uppercase', letterSpacing:'2px'}}>
                Advanced Supply Chain Console
            </p>
        </div>
        
        {/* BOTONES ACCIÓN (Español) */}
        <div style={{display:'flex', gap:'10px', alignItems:'center'}}>
            <select onChange={(e)=>e.target.value && cargarProduccion(JSON.parse(e.target.value))} style={{padding:'10px', borderRadius:'5px', border:'none', background:'#34495e', color:'white', cursor:'pointer'}}>
                <option value="">📂 Cargar Historial...</option>
                {historialGuardado.map(h=><option key={h.id} value={JSON.stringify(h)}>{h.nombre}</option>)}
            </select>
            <button onClick={exportarCSV} style={{background:'#f39c12', color:'white', border:'none', padding:'10px 20px', borderRadius:'5px', cursor:'pointer', fontWeight:'bold'}}>
                📥 Exportar CSV
            </button>
            <button onClick={guardarProduccion} style={{background:'#27ae60', color:'white', border:'none', padding:'10px 20px', borderRadius:'5px', cursor:'pointer', fontWeight:'bold'}}>
                💾 Guardar Nube
            </button>
            {/* CORRECCIÓN 4: El botón limpiar ahora llama a la función correcta */}
            <button onClick={limpiarTodo} style={{background:'#c0392b', color:'white', border:'none', padding:'10px', borderRadius:'5px', cursor:'pointer'}} title="Borrar Todo">
                🗑️
            </button>
        </div>
      </div>

      {/* DASHBOARD CONTENT */}
      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '0 20px' }}>
        
        {/* PANEL STATUS & FOTOS */}
        <div style={{display:'grid', gridTemplateColumns: '2fr 1fr', gap:'20px', marginBottom:'30px'}}>
            
            {/* AREA FOTOS */}
            <div style={{background:'white', padding:'20px', borderRadius:'10px', boxShadow:'0 5px 15px rgba(0,0,0,0.2)'}}>
                <div style={{display:'flex', justifyContent:'space-between', marginBottom:'10px'}}>
                    <strong style={{color:'#2c3e50'}}>📷 OPs Activas: {imagenesSubidas.length}</strong>
                </div>
                
                {/* CORRECCIÓN 3: Texto en español y dentro del contenedor */}
                <div style={{display:'flex', gap:'10px', overflowX:'auto', paddingBottom:'5px', minHeight:'80px', background:'#f8f9fa', borderRadius:'5px', padding:'10px', border:'2px dashed #cbd5e0', alignItems:'center', justifyContent: imagenesSubidas.length===0 ? 'center' : 'flex-start'}}>
                    
                    {imagenesSubidas.length === 0 && 
                        <span style={{color:'#aaa', fontSize:'14px', fontWeight:'500'}}>
                            👉 Presiona <strong>Ctrl + V</strong> para pegar aquí tus OPs
                        </span>
                    }

                    {imagenesSubidas.map((img, i) => (
                        <div key={i} style={{position:'relative', flexShrink:0}}>
                            {/* Imagen clickeable */}
                            <img src={img.url} alt="OP" onClick={()=>setImagenModal(img.url)}
                                 style={{height:'70px', borderRadius:'4px', border:'1px solid #ddd', cursor:'pointer'}} />
                            
                            {/* Etiqueta OP */}
                            <div style={{position:'absolute', bottom:0, left:0, right:0, background:'rgba(0,0,0,0.7)', color:'white', fontSize:'9px', padding:'2px', textAlign:'center', borderBottomLeftRadius:'4px', borderBottomRightRadius:'4px'}}>
                                OP {img.op}
                            </div>
                            
                            {/* CORRECCIÓN 4: Botón X para eliminar individualmente */}
                            <button 
                                onClick={(e) => { e.stopPropagation(); eliminarImagenIndividual(i); }}
                                style={{
                                    position:'absolute', top:'-8px', right:'-8px', 
                                    background:'#e74c3c', color:'white', border:'none', 
                                    borderRadius:'50%', width:'20px', height:'20px', fontSize:'12px', 
                                    cursor:'pointer', display:'flex', justifyContent:'center', alignItems:'center', fontWeight:'bold', boxShadow:'0 2px 5px rgba(0,0,0,0.2)'
                                }}>
                                ×
                            </button>
                        </div>
                    ))}
                </div>
                {/* CORRECCIÓN 5: Mensaje con spinner y rayo */}
                <h3 style={{color: mensaje.includes('❌')?'#e74c3c':'#27ae60', margin:'15px 0 0 0', fontSize:'16px', minHeight:'24px'}}>
                    {mensaje}
                </h3>
            </div>

            {/* CONSOLA DE ACTIVIDAD (LOG) - Español */}
            <div style={{background:'#1e1e1e', padding:'15px', borderRadius:'10px', color:'#00ff00', fontFamily:'monospace', fontSize:'11px', height:'180px', overflowY:'auto', border:'1px solid #333', boxShadow:'inset 0 0 10px rgba(0,0,0,0.5)'}}>
                <div style={{borderBottom:'1px solid #333', paddingBottom:'5px', marginBottom:'5px', color:'#fff', fontWeight:'bold'}}>TERMINAL_LOG_OUTPUT</div>
                {activityLog.map((line, i) => <div key={i} style={{opacity: i===0?1:0.7, whiteSpace: 'nowrap'}}>{line}</div>)}
            </div>
        </div>

        {/* FILTROS (Español) */}
        <div style={{background:'#34495e', padding:'15px', borderRadius:'8px', marginBottom:'20px', display:'flex', gap:'30px', alignItems:'center', color:'white'}}>
             <span style={{fontWeight:'bold'}}>⚡ FILTROS:</span>
             <label style={{color:'#bdc3c7'}}>Orden Producción (OP): 
                <select value={filtroOP} onChange={(e)=>setFiltroOP(e.target.value)} style={{marginLeft:'10px', padding:'5px', borderRadius:'3px', color:'#333'}}>
                    {opsCargadas.map(op=><option key={op} value={op}>{op}</option>)}
                </select>
             </label>
             <label style={{color:'#bdc3c7'}}>Orden Compra (OC): 
                <select value={filtroOC} onChange={(e)=>setFiltroOC(e.target.value)} style={{marginLeft:'10px', padding:'5px', borderRadius:'3px', color:'#333'}}>
                    {ocsCargadas.map(oc=><option key={oc} value={oc}>{oc || "N/A"}</option>)}
                </select>
             </label>
        </div>

        {/* TABLAS */}
        <TablaGrupo titulo="📦 MATERIA PRIMA / INSUMOS" datos={grupoInsumos} colorHeader="#2980b9" />
        <TablaGrupo titulo="🏷️ MATERIAL DE EMPAQUE" datos={grupoEmpaques} colorHeader="#e67e22" />

        {/* FOOTER TECH + SOCIAL LINKS (Corrección 1) */}
        <div style={{marginTop:'50px', borderTop:'1px solid rgba(255,255,255,0.1)', paddingTop:'30px', textAlign:'center', color:'#bdc3c7', fontSize:'13px', marginBottom:'40px'}}>
            
            {/* LINKS SOCIALES EN EL FOOTER */}
            <div style={{display:'flex', gap:'15px', justifyContent:'center', marginBottom:'20px'}}>
                <a href={SOCIAL_LINKS.linkedin} target="_blank" rel="noreferrer" style={{color:'#fff', textDecoration:'none', fontSize:'14px', display:'flex', alignItems:'center', gap:'8px', background:'rgba(255,255,255,0.05)', padding:'8px 15px', borderRadius:'20px', border:'1px solid rgba(255,255,255,0.1)'}}>
                    <span>🔗</span> LinkedIn
                </a>
                <a href={SOCIAL_LINKS.github} target="_blank" rel="noreferrer" style={{color:'#fff', textDecoration:'none', fontSize:'14px', display:'flex', alignItems:'center', gap:'8px', background:'rgba(255,255,255,0.05)', padding:'8px 15px', borderRadius:'20px', border:'1px solid rgba(255,255,255,0.1)'}}>
                    <span>💻</span> GitHub
                </a>
                <a href={SOCIAL_LINKS.researchgate} target="_blank" rel="noreferrer" style={{color:'#fff', textDecoration:'none', fontSize:'14px', display:'flex', alignItems:'center', gap:'8px', background:'rgba(255,255,255,0.05)', padding:'8px 15px', borderRadius:'20px', border:'1px solid rgba(255,255,255,0.1)'}}>
                    <span>📄</span> ResearchGate
                </a>
            </div>

            <p style={{marginBottom:'15px', fontFamily:'monospace'}}>
                Architected by <strong style={{color:'white'}}>Aaron Llerena</strong> • Tech Stack: <span style={{color:'#f39c12'}}>Firebase</span>, <span style={{color:'#2ecc71'}}>Python</span> & <span style={{color:'#3498db'}}>Gemini AI 1.5 Flash</span>
            </p>
            <div style={{display:'flex', gap:'10px', justifyContent:'center', fontFamily:'monospace'}}>
                <span style={{background:'#2c3e50', padding:'2px 8px', borderRadius:'10px', fontSize:'10px', border:'1px solid #34495e'}}>React</span>
                <span style={{background:'#2c3e50', padding:'2px 8px', borderRadius:'10px', fontSize:'10px', border:'1px solid #34495e'}}>Firestore</span>
                <span style={{background:'#2c3e50', padding:'2px 8px', borderRadius:'10px', fontSize:'10px', border:'1px solid #34495e'}}>GenAI</span>
                <span style={{background:'#2c3e50', padding:'2px 8px', borderRadius:'10px', fontSize:'10px', border:'1px solid #34495e'}}>Cloud Functions</span>
            </div>
        </div>

      </div>

      {/* BARRA ESTADO FIXED (Corrección 3: Limpia) */}
      <div style={{
          position:'fixed', bottom:0, left:0, width:'100%', height:'25px', 
          background:'#007acc', color:'white', fontSize:'11px', 
          display:'flex', alignItems:'center', padding:'0 15px', justifyContent:'space-between',
          fontFamily:'Segoe UI, sans-serif', zIndex:1000
      }}>
          <div style={{display:'flex', gap:'20px'}}>
              <span>🚀 SISTEMA ONLINE</span>
              <span>📡 Latencia: {latency}ms</span>
              <span>💾 DB: Firestore</span>
          </div>
          <div style={{display:'flex', gap:'20px'}}>
              <span>🕒 {currentTime}</span>
              <span>UTF-8</span>
          </div>
      </div>

      {/* MODAL FOTO */}
      {imagenModal && <div style={{position:'fixed', top:0, left:0, width:'100%', height:'100%', background:'rgba(0,0,0,0.9)', zIndex:2000, display:'flex', justifyContent:'center', alignItems:'center'}} onClick={()=>setImagenModal(null)}>
          <img src={imagenModal} style={{maxHeight:'90%', maxWidth:'90%', borderRadius:'5px', boxShadow:'0 0 20px rgba(0,0,0,0.5)'}} />
      </div>}
    </div>
  );
}

export default Dashboard;