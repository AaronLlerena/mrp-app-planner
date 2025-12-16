import React, { useState, useEffect, useRef } from 'react';
import { db } from './firebase'; 
import { collection, getDocs, addDoc, serverTimestamp, query, orderBy } from 'firebase/firestore'; 

const API_URL = "https://procesar-op-ja33qfekia-uc.a.run.app";

// --- TUS ENLACES SOCIALES (Personalízalos aquí si quieres) ---
const SOCIAL_LINKS = {
    linkedin: "https://www.linkedin.com/in/aaron-llerena", 
    github: "https://github.com/",
    researchgate: "https://www.researchgate.net/"
};

function Dashboard() {
  // --- ESTADOS DE DATOS (Lógica original intacta) ---
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
  
  // --- HERRAMIENTAS PRO (Nuevas) ---
  const [activityLog, setActivityLog] = useState([`> [SYSTEM] Initializing Smart Planner AI v2.0... OK`]);
  const [latency, setLatency] = useState(0);
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString());

  // Listas calculadas
  const opsCargadas = ["TODAS", ...new Set(planProduccion.flatMap(row => row.opsAsociadas))];
  const ocsCargadas = ["TODAS", ...new Set(planProduccion.map(row => row.numeroOC).filter(Boolean))];

  // RELOJ DEL SISTEMA
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date().toLocaleTimeString()), 1000);
    return () => clearInterval(timer);
  }, []);

  // CARGAR HISTORIAL
  useEffect(() => {
    const cargarHistorial = async () => {
      addToLog("Connecting to Firebase Firestore...");
      try {
        const q = query(collection(db, 'ProduccionesCombinadas'), orderBy('fecha', 'desc'));
        const snapshot = await getDocs(q);
        setHistorialGuardado(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        addToLog(`Firestore Connected. Loaded ${snapshot.docs.length} records.`);
      } catch (e) { addToLog(`Error loading history: ${e.message}`); }
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

  // --- FUNCIONES AUXILIARES ---
  const addToLog = (text) => {
      const timestamp = new Date().toLocaleTimeString('en-US', {hour12:false});
      setActivityLog(prev => [`> [${timestamp}] ${text}`, ...prev.slice(0, 49)]); 
  };

  const exportarCSV = () => {
      if(planProduccion.length === 0) return alert("No data to export");
      addToLog("Exporting data to CSV...");
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
      addToLog("CSV Export complete.");
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
    setMensaje("⏳ Sending data to Gemini AI Engine...");
    addToLog("Uploading Image...");
    const startTime = performance.now();

    try {
      addToLog("Requesting analysis from Gemini 1.5 Flash...");
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: imagenBase64 })
      });
      
      const endTime = performance.now();
      setLatency(Math.round(endTime - startTime)); 
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Server Error");

      addToLog(`Data Received. Latency: ${Math.round(endTime - startTime)}ms`);
      addToLog(`Parsing JSON for OP: ${data.datos.numero_op || 'Unknown'}`);
      
      agregarAlPlan(data.datos, imagenBase64);
      setMensaje(`✅ OP ${data.datos.numero_op} Processed Successfully!`);
      addToLog(`Success: Merged ${data.datos.items?.length || 0} items into MRP.`);
      
    } catch (error) {
      setMensaje("❌ Error: " + error.message);
      addToLog(`CRITICAL ERROR: ${error.message}`);
    }
    setProcesando(false);
  };

  const guardarProduccion = async () => {
    if (planProduccion.length === 0) return alert("Empty plan.");
    setLoading(true);
    addToLog("Saving production state to Cloud...");
    try {
        const nombreAuto = `Prod: ${opsCargadas.filter(o=>o!=='TODAS').join('+')}`;
        await addDoc(collection(db, 'ProduccionesCombinadas'), {
            nombre: nombreAuto,
            items: planProduccion,
            imagenes: imagenesSubidas,
            fecha: serverTimestamp()
        });
        alert("Saved to Cloud! ☁️");
        window.location.reload();
    } catch (e) { alert(e.message); addToLog("Save Failed."); }
    setLoading(false);
  };

  const cargarProduccion = (prod) => {
      if(window.confirm("Load previous production? Current data will be replaced.")) {
          setPlanProduccion(prod.items);
          setImagenesSubidas(prod.imagenes || []);
          addToLog(`Loaded history: ${prod.nombre}`);
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
            {datos.length === 0 ? <tr><td colSpan="8" style={{padding:'20px', textAlign:'center', color:'#aaa', fontStyle:'italic'}}>--- No data available ---</td></tr> : 
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
            <h1 style={{margin:0, color:'white', fontSize:'32px', letterSpacing:'-1px'}}>
                Smart Planner AI <span style={{fontSize:'18px', color:'#00d4ff', fontWeight:'300'}}>- by Aaron Llerena</span>
            </h1>
            <p style={{margin:'5px 0 0 0', fontSize:'13px', color:'#aab7c4', fontWeight:'600', textTransform:'uppercase', letterSpacing:'2px'}}>
                Advanced Supply Chain Console
            </p>
            {/* LINKS SOCIALES */}
            <div style={{marginTop:'15px', display:'flex', gap:'15px'}}>
                <a href={SOCIAL_LINKS.linkedin} target="_blank" rel="noreferrer" style={{color:'#fff', textDecoration:'none', fontSize:'12px', display:'flex', alignItems:'center', gap:'5px', background:'rgba(255,255,255,0.1)', padding:'5px 10px', borderRadius:'20px'}}>
                    <span>🔗</span> LinkedIn
                </a>
                <a href={SOCIAL_LINKS.github} target="_blank" rel="noreferrer" style={{color:'#fff', textDecoration:'none', fontSize:'12px', display:'flex', alignItems:'center', gap:'5px', background:'rgba(255,255,255,0.1)', padding:'5px 10px', borderRadius:'20px'}}>
                    <span>💻</span> GitHub
                </a>
                <a href={SOCIAL_LINKS.researchgate} target="_blank" rel="noreferrer" style={{color:'#fff', textDecoration:'none', fontSize:'12px', display:'flex', alignItems:'center', gap:'5px', background:'rgba(255,255,255,0.1)', padding:'5px 10px', borderRadius:'20px'}}>
                    <span>📄</span> ResearchGate
                </a>
            </div>
        </div>
        
        {/* BOTONES ACCIÓN */}
        <div style={{display:'flex', gap:'10px', alignItems:'center'}}>
            <select onChange={(e)=>e.target.value && cargarProduccion(JSON.parse(e.target.value))} style={{padding:'10px', borderRadius:'5px', border:'none', background:'#34495e', color:'white'}}>
                <option value="">📂 Load History...</option>
                {historialGuardado.map(h=><option key={h.id} value={JSON.stringify(h)}>{h.nombre}</option>)}
            </select>
            <button onClick={exportarCSV} style={{background:'#f39c12', color:'white', border:'none', padding:'10px 20px', borderRadius:'5px', cursor:'pointer', fontWeight:'bold'}}>
                📥 Export CSV
            </button>
            <button onClick={guardarProduccion} style={{background:'#27ae60', color:'white', border:'none', padding:'10px 20px', borderRadius:'5px', cursor:'pointer', fontWeight:'bold'}}>
                💾 Save Cloud
            </button>
            <button onClick={()=>window.confirm("Clear all?") && setPlanProduccion([])} style={{background:'#c0392b', color:'white', border:'none', padding:'10px', borderRadius:'5px', cursor:'pointer'}}>
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
                    <strong style={{color:'#2c3e50'}}>📷 Active OPs: {imagenesSubidas.length}</strong>
                    <span style={{color:'#7f8c8d', fontSize:'12px'}}>Press <strong>Ctrl + V</strong> to add more</span>
                </div>
                <div style={{display:'flex', gap:'10px', overflowX:'auto', paddingBottom:'5px', minHeight:'50px', background:'#f8f9fa', borderRadius:'5px', padding:'10px', border:'1px dashed #cbd5e0'}}>
                    {imagenesSubidas.length===0 && <span style={{color:'#aaa', fontSize:'12px', margin:'auto'}}>No images uploaded yet. Paste one here.</span>}
                    {imagenesSubidas.map((img, i) => (
                        <div key={i} style={{position:'relative', cursor:'pointer'}} onClick={()=>setImagenModal(img.url)}>
                            <img src={img.url} alt="OP" style={{height:'50px', borderRadius:'4px', border:'1px solid #ddd'}} />
                            <div style={{position:'absolute', bottom:0, right:0, background:'black', color:'white', fontSize:'9px', padding:'2px'}}>OP {img.op}</div>
                        </div>
                    ))}
                </div>
                <h3 style={{color: mensaje.includes('❌')?'#e74c3c':'#27ae60', margin:'10px 0 0 0', fontSize:'16px'}}>
                    {mensaje} {procesando && <span style={{animation:'blink 1s infinite'}}>⚡</span>}
                </h3>
            </div>

            {/* CONSOLA DE ACTIVIDAD (LOG) */}
            <div style={{background:'#1e1e1e', padding:'15px', borderRadius:'10px', color:'#00ff00', fontFamily:'monospace', fontSize:'11px', height:'140px', overflowY:'auto', border:'1px solid #333', boxShadow:'inset 0 0 10px rgba(0,0,0,0.5)'}}>
                <div style={{borderBottom:'1px solid #333', paddingBottom:'5px', marginBottom:'5px', color:'#fff', fontWeight:'bold'}}>TERMINAL_LOG_OUTPUT</div>
                {activityLog.map((line, i) => <div key={i} style={{opacity: i===0?1:0.7}}>{line}</div>)}
            </div>
        </div>

        {/* FILTROS */}
        <div style={{background:'#34495e', padding:'15px', borderRadius:'8px', marginBottom:'20px', display:'flex', gap:'30px', alignItems:'center'}}>
             <span style={{color:'white', fontWeight:'bold'}}>⚡ FILTERS:</span>
             <label style={{color:'#bdc3c7'}}>Production Order: 
                <select value={filtroOP} onChange={(e)=>setFiltroOP(e.target.value)} style={{marginLeft:'10px', padding:'5px', borderRadius:'3px'}}>
                    {opsCargadas.map(op=><option key={op} value={op}>{op}</option>)}
                </select>
             </label>
             <label style={{color:'#bdc3c7'}}>Purch. Order (OC): 
                <select value={filtroOC} onChange={(e)=>setFiltroOC(e.target.value)} style={{marginLeft:'10px', padding:'5px', borderRadius:'3px'}}>
                    {ocsCargadas.map(oc=><option key={oc} value={oc}>{oc || "N/A"}</option>)}
                </select>
             </label>
        </div>

        {/* TABLAS */}
        <TablaGrupo titulo="📦 RAW MATERIALS / INSUMOS" datos={grupoInsumos} colorHeader="#2980b9" />
        <TablaGrupo titulo="🏷️ PACKAGING / MATERIAL DE EMPAQUE" datos={grupoEmpaques} colorHeader="#e67e22" />

        {/* FOOTER TECH */}
        <div style={{marginTop:'50px', borderTop:'1px solid rgba(255,255,255,0.1)', paddingTop:'20px', textAlign:'center', color:'#bdc3c7', fontSize:'13px', fontFamily:'monospace', marginBottom:'40px'}}>
            <p style={{marginBottom:'10px'}}>
                Architected by <strong style={{color:'white'}}>Aaron Llerena</strong> • Tech Stack: <span style={{color:'#f39c12'}}>Firebase</span>, <span style={{color:'#2ecc71'}}>Python</span> & <span style={{color:'#3498db'}}>Gemini AI 1.5 Flash</span>
            </p>
            <div style={{display:'flex', gap:'10px', justifyContent:'center'}}>
                <span style={{background:'#2c3e50', padding:'2px 8px', borderRadius:'10px', fontSize:'10px'}}>⚛️ React</span>
                <span style={{background:'#2c3e50', padding:'2px 8px', borderRadius:'10px', fontSize:'10px'}}>🔥 Firestore</span>
                <span style={{background:'#2c3e50', padding:'2px 8px', borderRadius:'10px', fontSize:'10px'}}>🤖 GenAI</span>
                <span style={{background:'#2c3e50', padding:'2px 8px', borderRadius:'10px', fontSize:'10px'}}>☁️ Cloud Functions</span>
            </div>
        </div>

      </div>

      {/* BARRA ESTADO FIXED (VS Code Style) */}
      <div style={{
          position:'fixed', bottom:0, left:0, width:'100%', height:'25px', 
          background:'#007acc', color:'white', fontSize:'11px', 
          display:'flex', alignItems:'center', padding:'0 15px', justifyContent:'space-between',
          fontFamily:'Segoe UI, sans-serif', zIndex:1000
      }}>
          <div style={{display:'flex', gap:'20px'}}>
              <span>🚀 SYSTEM ONLINE</span>
              <span>📡 Latency: {latency}ms</span>
              <span>💾 DB: Firestore (Connected)</span>
          </div>
          <div style={{display:'flex', gap:'20px'}}>
              <span>Aaron Llerena Dev</span>
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