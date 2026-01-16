import React, { useState, useEffect } from 'react';
import { db } from './firebase'; 
import { collection, getDocs, addDoc, updateDoc, doc, serverTimestamp, query, orderBy } from 'firebase/firestore'; 

const API_URL = "https://procesar-op-ja33qfekia-uc.a.run.app";

const SOCIAL_LINKS = {
    linkedin: "https://www.linkedin.com/in/aaron-llerena", 
    github: "https://github.com/AaronLlerena",
    researchgate: "https://www.researchgate.net/profile/Aaron-Llerena-Arroyo"
};

// --- NAVEGACIÓN TECLADO ---
const handleKeyDown = (e, rowIndex, colName, inputsRef) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const direction = e.key === 'ArrowDown' ? 1 : -1;
        const nextId = `input-${rowIndex + direction}-${colName}`;
        const nextElement = document.getElementById(nextId);
        if (nextElement) {
            nextElement.focus();
            nextElement.select(); 
        }
    }
};

// --- COMPONENTE TABLA ---
const TablaGrupo = ({ titulo, datos, colorHeader, filtroOP, actualizarCampo, actualizarNombre, startIndex }) => (
    <div style={{marginBottom:'20px', borderRadius:'6px', overflow:'hidden', boxShadow:'0 2px 10px rgba(0,0,0,0.2)'}}>
        <div style={{backgroundColor: colorHeader, color:'white', padding:'8px 15px', fontWeight:'bold', display:'flex', justifyContent:'space-between', fontSize:'14px'}}>
            <span>{titulo}</span>
            <span style={{opacity:0.8, fontSize:'12px'}}>{datos.length} items</span>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor:'#fdfdfd', fontSize:'12px', color:'#333' }}>
          <thead>
            <tr style={{ backgroundColor: '#ecf0f1', color: '#555', textAlign: 'left', borderBottom:'2px solid #bdc3c7' }}>
              <th style={{ padding: '8px' }}>NOMBRE (Editable)</th>
              <th style={{ padding: '8px' }}>REQ. {filtroOP==="TODAS"?"TOTAL":filtroOP}</th>
              <th style={{ padding: '8px', width:'70px', backgroundColor:'#fff9c4' }}>STOCK</th>
              <th style={{ padding: '8px', width:'80px', backgroundColor:'#e8f8f5' }}>A COMPRAR</th>
              <th style={{ padding: '8px', width:'80px' }}># OC</th>
              <th style={{ padding: '8px' }}>F. ENTREGA</th>
              <th style={{ padding: '8px' }}>ESTATUS</th>
              <th style={{ padding: '8px' }}>DETALLE</th>
              <th style={{ padding: '8px' }}>ORIGEN</th>
            </tr>
          </thead>
          <tbody>
            {datos.length === 0 ? <tr><td colSpan="9" style={{padding:'15px', textAlign:'center', color:'#aaa', fontStyle:'italic'}}>--- Sin datos ---</td></tr> : 
             datos.map((row, index) => {
                const globalIndex = startIndex + index; 
                const cantidadMostrar = filtroOP === "TODAS" ? row.cantidadTotal : (row.desglose[filtroOP] || 0);
                
                const stock = parseFloat(row.stockPlanta) || 0;
                const calculoAutomatico = Math.max(0, cantidadMostrar - stock);
                
                // Priorizamos el valor manual si existe, de lo contrario usamos el cálculo automático
                // Si el cálculo automático es 0 (stock suficiente), el valor por defecto es 0
                const valorAComprar = row.aComprarManual !== undefined ? row.aComprarManual : (calculoAutomatico === 0 ? 0 : calculoAutomatico);
                
                // Es "verde" si el valor final a comprar es 0 o menor
                const cubierto = parseFloat(valorAComprar) <= 0;
                
                // Si es verde y el estado era "Pendiente", lo ponemos como "Completo" automáticamente
                const estadoFinal = (cubierto && row.estado === "Pendiente") ? "Completo" : row.estado;

                return (
                    <tr key={index} style={{ borderBottom: '1px solid #eee', backgroundColor: cubierto ? '#c8e6c9' : 'white' }}>
                        <td style={{ padding: '5px' }}>
                            <input type="text" value={row.nombre} onChange={(e) => actualizarNombre(row.nombre, e.target.value)}
                                id={`input-${globalIndex}-nombre`}
                                onKeyDown={(e) => handleKeyDown(e, globalIndex, 'nombre')}
                                style={{width:'100%', border:'none', background:'transparent', fontWeight:'bold', color:'#2c3e50', fontFamily:'monospace', fontSize:'12px'}} />
                        </td>
                        <td style={{ padding: '6px' }}>{cantidadMostrar.toFixed(2)} {row.unidad}</td>
                        
                        {/* STOCK */}
                        <td style={{ padding: '4px', backgroundColor:'#fff9c4' }}>
                            <input type="number" value={row.stockPlanta} 
                                onChange={(e) => actualizarCampo(row.nombre, 'stockPlanta', e.target.value)}
                                id={`input-${globalIndex}-stock`}
                                onKeyDown={(e) => handleKeyDown(e, globalIndex, 'stock')}
                                style={{width:'100%', border:'1px solid #ddd', textAlign:'center', borderRadius:'3px', padding:'2px', fontSize:'12px'}} />
                        </td>
                        
                        {/* A COMPRAR */}
                        <td style={{ padding: '4px', backgroundColor: cubierto ? '#c8e6c9' : '#e8f8f5' }}>
                            <input type="number" 
                                value={valorAComprar} 
                                onChange={(e) => actualizarCampo(row.nombre, 'aComprarManual', e.target.value)}
                                id={`input-${globalIndex}-acomprar`}
                                onKeyDown={(e) => handleKeyDown(e, globalIndex, 'acomprar')}
                                style={{
                                    width:'100%', border:'1px solid #ddd', textAlign:'center', borderRadius:'3px', padding:'2px', fontSize:'12px',
                                    color: cubierto ? '#27ae60' : '#c0392b', fontWeight:'bold',
                                    background: 'white'
                                }} 
                            />
                        </td>
                        
                        {/* # OC */}
                        <td style={{ padding: '4px' }}>
                            <input type="text" value={row.numeroOC} 
                                onChange={(e) => actualizarCampo(row.nombre, 'numeroOC', e.target.value)}
                                id={`input-${globalIndex}-oc`}
                                onKeyDown={(e) => handleKeyDown(e, globalIndex, 'oc')}
                                style={{width:'100%', border:'1px solid #ddd', padding:'2px', borderRadius:'3px', fontSize:'12px', color: row.numeroOC === 'No comprar' ? '#aaa' : '#000'}} />
                        </td>
                        
                        {/* FECHA */}
                        <td style={{ padding: '4px' }}>
                            <input type="date" value={row.fechaEntrega} 
                                onChange={(e) => actualizarCampo(row.nombre, 'fechaEntrega', e.target.value)}
                                id={`input-${globalIndex}-fecha`}
                                onKeyDown={(e) => handleKeyDown(e, globalIndex, 'fecha')}
                                style={{border:'1px solid #ddd', padding:'2px', borderRadius:'3px', fontSize:'11px'}} />
                        </td>
                        
                        {/* ESTATUS */}
                        <td style={{ padding: '4px' }}>
                            <select value={estadoFinal} onChange={(e) => actualizarCampo(row.nombre, 'estado', e.target.value)}
                                style={{border:'none', background: estadoFinal==='Completo'?'#2ecc71':(estadoFinal==='Pendiente'?'#95a5a6':'#3498db'), color:'white', borderRadius:'3px', padding:'2px 5px', fontSize:'10px', fontWeight:'bold'}}>
                                <option value="Pendiente">Pendiente</option>
                                <option value="OC enviada">OC enviada</option>
                                <option value="Por entregar">Por entregar</option>
                                <option value="Completo">Completo</option>
                            </select>
                        </td>

                        {/* DETALLE */}
                        <td style={{ padding: '4px' }}>
                            {!cubierto && (
                                <input type="text" value={row.detalle || ''} 
                                    onChange={(e) => actualizarCampo(row.nombre, 'detalle', e.target.value)}
                                    placeholder="Nota..."
                                    style={{width:'100%', border:'1px solid #ddd', padding:'2px', borderRadius:'3px', fontSize:'11px'}} />
                            )}
                        </td>

                        <td style={{ padding: '6px', fontSize:'0.75em', color:'#aaa' }}>{row.opsAsociadas.join(", ")}</td>
                    </tr>
                );
             })}
          </tbody>
        </table>
    </div>
);

function Dashboard() {
  const [planProduccion, setPlanProduccion] = useState([]);
  const [imagenesSubidas, setImagenesSubidas] = useState([]);
  const [historialGuardado, setHistorialGuardado] = useState([]);
  const [opNames, setOpNames] = useState({}); // Nuevo: nombres de OPs
  
  const [loading, setLoading] = useState(false); 
  const [procesando, setProcesando] = useState(false); 
  const [mensaje, setMensaje] = useState("");
  const [filtroOP, setFiltroOP] = useState("TODAS"); 
  const [filtroOC, setFiltroOC] = useState("TODAS");
  const [opSeleccionadaMini, setOpSeleccionadaMini] = useState(null); // Nuevo: OP seleccionada para el Mini Dashboard
  const [imagenModal, setImagenModal] = useState(null);
  
  const [activityLog, setActivityLog] = useState([`> [SISTEMA] Iniciando Smart Planner AI v3.2 (Stock Column Mode)... OK`]);
  const [latency, setLatency] = useState(0);
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString());
  const [currentProductionId, setCurrentProductionId] = useState(null); // Nuevo estado para el ID de la producción actual

  const [showPinPrompt, setShowPinPrompt] = useState(false);
  const [currentPin, setCurrentPin] = useState("");
  const [actionToPerform, setActionToPerform] = useState(null);
  const CORRECT_PIN = "1234"; // PIN hardcodeado

  const opsCargadas = ["TODAS", ...new Set(planProduccion.flatMap(row => row.opsAsociadas))];
  const ocsCargadas = ["TODAS", ...new Set(planProduccion.map(row => row.numeroOC).filter(Boolean))];

  const statsOP = React.useMemo(() => {
    // Ahora usamos opSeleccionadaMini en lugar de filtroOP
    if (!opSeleccionadaMini || opSeleccionadaMini === "TODAS") return null;
    const targetOP = opSeleccionadaMini;
    const itemsOP = planProduccion.filter(row => row.opsAsociadas.includes(targetOP));
    if (itemsOP.length === 0) return null;
    
    const completados = itemsOP.filter(row => {
        const stock = parseFloat(row.stockPlanta) || 0;
        const cantidadOP = row.desglose[targetOP] || 0;
        const calculoAuto = Math.max(0, cantidadOP - stock);
        const valorAComprar = row.aComprarManual !== undefined ? row.aComprarManual : (calculoAuto === 0 ? 0 : calculoAuto);
        const cubierto = parseFloat(valorAComprar) <= 0;
        return cubierto || row.estado === "Completo";
    }).length;
    
    return {
        total: itemsOP.length,
        completados,
        porcentaje: Math.round((completados / itemsOP.length) * 100),
        nombre: opNames[targetOP] || "Sin nombre",
        id: targetOP
    };
  }, [planProduccion, opSeleccionadaMini, opNames]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date().toLocaleTimeString()), 1000);
    return () => clearInterval(timer);
  }, []);

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

  const addToLog = (text) => {
      const timestamp = new Date().toLocaleTimeString('es-ES', {hour12:false});
      setActivityLog(prev => [`> [${timestamp}] ${text}`, ...prev.slice(0, 49)]); 
  };

  const eliminarImagenIndividual = (indexToDelete) => {
    setImagenesSubidas(prevImagenes => prevImagenes.filter((_, index) => index !== indexToDelete));
    addToLog("Imagen eliminada de la lista visual.");
  };
  
  const limpiarTodoReal = () => {
      if(window.confirm("¿Estás seguro de borrar todo? Se perderán los datos no guardados.")) {
          setPlanProduccion([]);
          setImagenesSubidas([]); 
          setOpNames({});
          setMensaje("");
          addToLog("Sistema limpiado. Memoria vacía.");
      }
  };

  const limpiarTodo = () => {
    requestPin("limpiar");
  };

  const exportarXLS = () => {
      if(planProduccion.length === 0) return alert("No hay datos para exportar.");
      addToLog("Generando archivo XLS...");
      
      const headers = ["Categoria\tNombre\tCantidad Total\tUnidad\tStock Planta\tA Comprar\tNumero OC\tEstado\tDetalle\tOPs Origen"];
      const rows = planProduccion.map(row => {
          const stock = parseFloat(row.stockPlanta) || 0;
          const calculoAutomatico = Math.max(0, row.cantidadTotal - stock);
          const valorAComprar = row.aComprarManual !== undefined ? row.aComprarManual : (calculoAutomatico === 0 ? 0 : calculoAutomatico);
          const cubierto = parseFloat(valorAComprar) <= 0;
          const estadoFinal = (cubierto && row.estado === "Pendiente") ? "Completo" : row.estado;
          const detalleFinal = cubierto ? "" : (row.detalle || "");
          
          return `${row.categoria}\t${row.nombre}\t${row.cantidadTotal}\t${row.unidad}\t${row.stockPlanta}\t${valorAComprar}\t${row.numeroOC}\t${estadoFinal}\t${detalleFinal}\t${row.opsAsociadas.join('+')}`;
      });
      
      const xlsContent = [headers, ...rows].join("\n");
      const blob = new Blob([xlsContent], { type: 'application/vnd.ms-excel' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement("a");
      link.href = url;
      link.download = `smart_planner_report_${new Date().toISOString().slice(0,10)}.xls`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      addToLog("Archivo XLS generado y descargado.");
  };

  const agregarAlPlan = (datosNuevos, imagenBase64) => {
    const opId = datosNuevos.numero_op || "S/N";
    setImagenesSubidas(prev => [...prev, { op: opId, url: imagenBase64 }]);
    
    const itemsNuevos = datosNuevos.items || datosNuevos.insumos || [];
    let planActualizado = [...planProduccion];

    itemsNuevos.forEach(itemNuevo => {
        const nombreNorm = itemNuevo.nombre.trim().toUpperCase();
        const categoria = itemNuevo.categoria || "INSUMO";
        
        // Usamos el stock detectado por la IA, o 0 si no vino nada
        const stockInicial = parseFloat(itemNuevo.stock_detectado) || 0;

        const indiceExistente = planActualizado.findIndex(p => p.nombre === nombreNorm);

        if (indiceExistente >= 0) {
            const item = planActualizado[indiceExistente];
            item.cantidadTotal += itemNuevo.cantidad;
            item.desglose[opId] = (item.desglose[opId] || 0) + itemNuevo.cantidad;
            // Si ya existe, SUMAMOS el stock detectado en esta nueva OP al stock que ya tenía
            item.stockPlanta = (parseFloat(item.stockPlanta) || 0) + stockInicial;

            if (!item.opsAsociadas.includes(opId)) item.opsAsociadas.push(opId);
        } else {
            planActualizado.push({
                nombre: nombreNorm,
                categoria: categoria,
                cantidadTotal: itemNuevo.cantidad,
                desglose: { [opId]: itemNuevo.cantidad },
                unidad: itemNuevo.unidad,
                // AQUÍ ESTÁ EL CAMBIO CLAVE: Usamos el stock detectado como valor inicial
                stockPlanta: stockInicial, 
                numeroOC: "",
                estado: "Pendiente", 
                fechaEntrega: "",
                opsAsociadas: [opId]
            });
        }
    });
    setPlanProduccion(planActualizado);
  };

  const procesarImagen = async (imagenBase64) => {
    setProcesando(true);
    setMensaje("Analizando Orden de Producción...  ⚡");
    addToLog("Subiendo imagen...");
    const startTime = performance.now();

    try {
      addToLog("Solicitando análisis a Gemini AI...");
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
      
      const opId = data.datos.numero_op || "S/N";
      const opName = window.prompt(`OP ${opId} detectada. ¿Qué nombre (detalle) deseas asignarle?`, "Sin nombre");
      if (opName) {
        setOpNames(prev => ({ ...prev, [opId]: opName }));
      }
      
      agregarAlPlan(data.datos, imagenBase64);
      setMensaje(`✅ OP ${opId} OK!`); 
      addToLog(`Éxito: Se fusionaron ${data.datos.items?.length || 0} items.`);
      
    } catch (error) {
      setMensaje("❌ Error: " + error.message);
      addToLog(`ERROR: ${error.message}`);
    }
    setProcesando(false);
  };

  const guardarProduccion = () => {
    requestPin("guardar");
  };

  const guardarProduccionReal = async () => {
    if (planProduccion.length === 0) return alert("El plan está vacío.");
    setLoading(true);
    addToLog("Guardando en la Nube...");
    try {
        const nombreAuto = `Prod: ${opsCargadas.filter(o=>o!=='TODAS').join('+')}`;
        const datosAGuardar = {
            nombre: nombreAuto,
            items: planProduccion,
            imagenes: imagenesSubidas,
            opNames: opNames,
            fecha: serverTimestamp()
        };

        if (currentProductionId) {
            // Actualizar documento existente
            const docRef = doc(db, 'ProduccionesCombinadas', currentProductionId);
            await updateDoc(docRef, datosAGuardar);
            alert("¡Producción actualizada! ✅");
            addToLog(`Producción ${currentProductionId} actualizada.`);
            setCurrentProductionId(null); // Limpiar el ID después de actualizar
        } else {
            // Crear nuevo documento
            await addDoc(collection(db, 'ProduccionesCombinadas'), datosAGuardar);
            alert("¡Guardado! ☁️");
            addToLog("Nueva producción guardada.");
        }
        window.location.reload();
    } catch (e) { alert(e.message); addToLog("Fallo al guardar."); }
    setLoading(false);
  };

  const cargarProduccion = (prod) => {
      if(window.confirm("¿Cargar producción anterior?")) {
          setPlanProduccion(prod.items);
          setImagenesSubidas(prod.imagenes || []);
          setOpNames(prod.opNames || {});
          setCurrentProductionId(prod.id); // Guardar el ID de la producción cargada
          
          // Si hay OPs, seleccionamos la primera por defecto para el mini dashboard
          const firstOP = prod.items.flatMap(row => row.opsAsociadas)[0];
          if (firstOP) setOpSeleccionadaMini(firstOP);
          
          addToLog(`Cargado: ${prod.nombre} (ID: ${prod.id})`);
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

  const verifyPin = () => {
    if (currentPin === CORRECT_PIN) {
        setShowPinPrompt(false);
        setCurrentPin("");
        if (actionToPerform === "guardar") {
            guardarProduccionReal();
        } else if (actionToPerform === "limpiar") {
            limpiarTodoReal();
        }
    } else {
        alert("PIN incorrecto. Inténtalo de nuevo.");
        setCurrentPin("");
    }
  };

  const requestPin = (action) => {
    setActionToPerform(action);
    setShowPinPrompt(true);
  };

  const datosFiltrados = planProduccion.filter(row => {
      const pasaOP = filtroOP === "TODAS" || row.opsAsociadas.includes(filtroOP);
      const pasaOC = filtroOC === "TODAS" || row.numeroOC === filtroOC;
      return pasaOP && pasaOC;
  });
  const grupoInsumos = datosFiltrados.filter(i => i.categoria === "INSUMO");
  const grupoEmpaques = datosFiltrados.filter(i => i.categoria === "EMPAQUE");

  return (
    <div style={{ paddingBottom: '40px' }}> 
      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '15px 20px', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
        <div>
            <h1 style={{margin:0, color:'white', fontSize:'24px', letterSpacing:'-1px'}}>
                Smart Planner AI <span style={{fontSize:'14px', color:'#00d4ff', fontWeight:'300'}}>- by Aaron Llerena</span>
            </h1>
            <p style={{margin:'2px 0 0 0', fontSize:'11px', color:'#aab7c4', fontWeight:'600', textTransform:'uppercase', letterSpacing:'1px'}}>
                Advanced Supply Chain Console
            </p>
        </div>
        
        <div style={{display:'flex', gap:'8px', alignItems:'center'}}>
            <select 
                value={opSeleccionadaMini || ""} 
                onChange={(e) => {
                    const val = e.target.value;
                    if (val.startsWith('{')) {
                        cargarProduccion(JSON.parse(val));
                    } else {
                        setOpSeleccionadaMini(val);
                    }
                }} 
                style={{padding:'6px', borderRadius:'4px', border:'none', background:'#34495e', color:'white', cursor:'pointer', fontSize:'12px'}}
            >
                <option value="">📂 Historial / OPs...</option>
                <optgroup label="📦 Producciones Guardadas" style={{background:'#2c3e50'}}>
                    {historialGuardado.map(h => <option key={h.id} value={JSON.stringify(h)}>{h.nombre}</option>)}
                </optgroup>
                {opsCargadas.length > 1 && (
                    <optgroup label="📋 OPs en Memoria" style={{background:'#2c3e50'}}>
                        {opsCargadas.filter(op => op !== "TODAS").map(op => (
                            <option key={`mem-${op}`} value={op}>
                                OP {op} {opNames[op] ? `- ${opNames[op]}` : ""}
                            </option>
                        ))}
                    </optgroup>
                )}
            </select>
            <button onClick={exportarXLS} style={{background:'#f39c12', color:'white', border:'none', padding:'6px 12px', borderRadius:'4px', cursor:'pointer', fontWeight:'bold', fontSize:'12px'}}>
                📥 Exportar XLS
            </button>
            <button onClick={() => requestPin("guardar")} style={{background:'#27ae60', color:'white', border:'none', padding:'6px 12px', borderRadius:'4px', cursor:'pointer', fontWeight:'bold', fontSize:'12px'}}>
                💾 Nube
            </button>
            <button onClick={() => requestPin("limpiar")} style={{background:'#c0392b', color:'white', border:'none', padding:'6px 10px', borderRadius:'4px', cursor:'pointer', fontSize:'12px'}} title="Borrar Todo">
                🗑️
            </button>
        </div>
      </div>

      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '0 20px' }}>
        <div style={{display:'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap:'15px', marginBottom:'15px'}}>
            <div style={{background:'white', padding:'10px', borderRadius:'8px', boxShadow:'0 2px 10px rgba(0,0,0,0.2)', display:'flex', flexDirection:'column', justifyContent:'center'}}>
                <div style={{display:'flex', justifyContent:'space-between', marginBottom:'5px', alignItems:'center'}}>
                    <strong style={{color:'#2c3e50', fontSize:'13px'}}>📷 OPs Activas: {imagenesSubidas.length}</strong>
                    <span style={{fontSize:'12px', color: (typeof mensaje === 'string' && mensaje.includes('❌')) ? '#e74c3c' : (procesando ? '#e67e22' : '#27ae60'), fontWeight:'bold', display:'flex', alignItems:'center', gap:'5px'}}>
                        {procesando && <div className="spinner" style={{width:'12px', height:'12px', borderWidth:'2px', borderColor:'#e67e22', borderLeftColor:'transparent'}}></div>}
                        {mensaje}
                    </span>
                </div>
                <div style={{display:'flex', gap:'8px', overflowX:'auto', paddingBottom:'2px', minHeight:'60px', background:'#f8f9fa', borderRadius:'5px', padding:'5px', border:'1px dashed #cbd5e0', alignItems:'center', justifyContent: imagenesSubidas.length===0 ? 'center' : 'flex-start'}}>
                    {imagenesSubidas.length === 0 && <span style={{color:'#aaa', fontSize:'12px', fontWeight:'500'}}>👉 Presiona <strong>Ctrl + V</strong> aquí</span>}
                    {imagenesSubidas.map((img, i) => (
                        <div key={i} style={{position:'relative', flexShrink:0}}>
                            <img src={img.url} alt="OP" onClick={()=>setImagenModal(img.url)} style={{height:'50px', borderRadius:'4px', border:'1px solid #ddd', cursor:'pointer'}} />
                            <button onClick={(e) => { e.stopPropagation(); eliminarImagenIndividual(i); }} style={{position:'absolute', top:'-6px', right:'-6px', background:'#e74c3c', color:'white', border:'none', borderRadius:'50%', width:'16px', height:'16px', fontSize:'10px', cursor:'pointer', display:'flex', justifyContent:'center', alignItems:'center', fontWeight:'bold', boxShadow:'0 1px 3px rgba(0,0,0,0.2)'}}>×</button>
                        </div>
                    ))}
                </div>
            </div>

            {/* MINI DASHBOARD COMPACTO */}
            <div style={{background:'linear-gradient(135deg, #2c3e50, #34495e)', padding:'10px', borderRadius:'8px', color:'white', display:'flex', flexDirection:'column', justifyContent:'center', boxShadow:'0 2px 10px rgba(0,0,0,0.2)', border:'1px solid rgba(255,255,255,0.1)'}}>
                {!statsOP ? (
                    <div style={{textAlign:'center', opacity:0.6, fontSize:'12px', fontStyle:'italic'}}>
                        Selecciona una OP en el menú superior para ver su avance...
                    </div>
                ) : (
                    <>
                        <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'8px'}}>
                            <div style={{maxWidth:'70%'}}>
                                <div style={{fontSize:'10px', color:'#00d4ff', fontWeight:'bold', textTransform:'uppercase'}}>PROGRESO DE ORDEN</div>
                                <div style={{fontSize:'14px', fontWeight:'bold', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
                                    OP {statsOP.id} - {statsOP.nombre}
                                </div>
                            </div>
                            <div style={{fontSize:'22px', fontWeight:'800', color: statsOP.porcentaje === 100 ? '#2ecc71' : '#f1c40f'}}>
                                {statsOP.porcentaje}%
                            </div>
                        </div>
                        <div style={{height:'8px', background:'rgba(255,255,255,0.1)', borderRadius:'10px', overflow:'hidden', marginBottom:'8px'}}>
                            <div style={{width: `${statsOP.porcentaje}%`, height:'100%', background: statsOP.porcentaje === 100 ? '#2ecc71' : '#3498db', transition:'width 0.5s ease'}}></div>
                        </div>
                        <div style={{display:'flex', justifyContent:'space-between', fontSize:'11px', opacity:0.8}}>
                            <span>Items: <strong>{statsOP.completados} / {statsOP.total}</strong></span>
                            <span>{statsOP.porcentaje === 100 ? '✅ COMPLETADO' : '⏳ EN PROCESO'}</span>
                        </div>
                    </>
                )}
            </div>

            <div style={{background:'#1e1e1e', padding:'8px', borderRadius:'8px', color:'#00ff00', fontFamily:'monospace', fontSize:'10px', height:'105px', overflowY:'auto', border:'1px solid #333', boxShadow:'inset 0 0 10px rgba(0,0,0,0.5)'}}>
                <div style={{borderBottom:'1px solid #333', paddingBottom:'2px', marginBottom:'2px', color:'#fff', fontWeight:'bold', fontSize:'9px'}}>TERMINAL_LOG</div>
                {activityLog.map((line, i) => <div key={i} style={{opacity: i===0?1:0.7, whiteSpace: 'nowrap', lineHeight:'1.3'}}>{line}</div>)}
            </div>
        </div>

        <div style={{background:'#34495e', padding:'8px 15px', borderRadius:'6px', marginBottom:'15px', display:'flex', gap:'20px', alignItems:'center', color:'white', fontSize:'13px'}}>
             <span style={{fontWeight:'bold'}}>⚡ FILTROS:</span>
             <label style={{color:'#bdc3c7'}}>Orden Producción (OP): 
                <select value={filtroOP} onChange={(e)=>setFiltroOP(e.target.value)} style={{marginLeft:'5px', padding:'3px', borderRadius:'3px', color:'#333', fontSize:'12px'}}>
                    {opsCargadas.map(op=>(
                        <option key={op} value={op}>
                            {op === "TODAS" ? op : `OP ${op} ${opNames[op] ? `- ${opNames[op]}` : ""}`}
                        </option>
                    ))}
                </select>
             </label>
             <label style={{color:'#bdc3c7'}}>Orden Compra (OC): 
                <select value={filtroOC} onChange={(e)=>setFiltroOC(e.target.value)} style={{marginLeft:'5px', padding:'3px', borderRadius:'3px', color:'#333', fontSize:'12px'}}>{ocsCargadas.map(oc=><option key={oc} value={oc}>{oc || "N/A"}</option>)}</select>
             </label>
        </div>

        <TablaGrupo titulo="📦 MATERIA PRIMA / INSUMOS" datos={grupoInsumos} colorHeader="#2980b9" filtroOP={filtroOP} actualizarCampo={actualizarCampo} actualizarNombre={actualizarNombre} startIndex={0} />
        <TablaGrupo titulo="🏷️ MATERIAL DE EMPAQUE" datos={grupoEmpaques} colorHeader="#e67e22" filtroOP={filtroOP} actualizarCampo={actualizarCampo} actualizarNombre={actualizarNombre} startIndex={grupoInsumos.length} />

        <div style={{marginTop:'30px', borderTop:'1px solid rgba(255,255,255,0.1)', paddingTop:'20px', textAlign:'center', color:'#bdc3c7', fontSize:'11px', marginBottom:'40px'}}>
            <div style={{display:'flex', gap:'10px', justifyContent:'center', marginBottom:'15px'}}>
                <a href={SOCIAL_LINKS.linkedin} target="_blank" rel="noreferrer" style={{color:'#fff', textDecoration:'none', fontSize:'12px', display:'flex', alignItems:'center', gap:'5px', background:'rgba(255,255,255,0.05)', padding:'5px 10px', borderRadius:'15px', border:'1px solid rgba(255,255,255,0.1)'}}><span>🔗</span> LinkedIn</a>
                <a href={SOCIAL_LINKS.github} target="_blank" rel="noreferrer" style={{color:'#fff', textDecoration:'none', fontSize:'12px', display:'flex', alignItems:'center', gap:'5px', background:'rgba(255,255,255,0.05)', padding:'5px 10px', borderRadius:'15px', border:'1px solid rgba(255,255,255,0.1)'}}><span>💻</span> GitHub</a>
                <a href={SOCIAL_LINKS.researchgate} target="_blank" rel="noreferrer" style={{color:'#fff', textDecoration:'none', fontSize:'12px', display:'flex', alignItems:'center', gap:'5px', background:'rgba(255,255,255,0.05)', padding:'5px 10px', borderRadius:'15px', border:'1px solid rgba(255,255,255,0.1)'}}><span>📄</span> ResearchGate</a>
            </div>
            <p style={{marginBottom:'10px', fontFamily:'monospace'}}>Architected by <strong style={{color:'white'}}>Aaron Llerena</strong> • Tech Stack: <span style={{color:'#f39c12'}}>Firebase</span>, <span style={{color:'#2ecc71'}}>Python</span> & <span style={{color:'#3498db'}}>Gemini AI 1.5 Flash</span></p>
            <div style={{display:'flex', gap:'8px', justifyContent:'center', fontFamily:'monospace'}}>
                <span style={{background:'#2c3e50', padding:'1px 6px', borderRadius:'8px', fontSize:'9px', border:'1px solid #34495e'}}>React</span>
                <span style={{background:'#2c3e50', padding:'1px 6px', borderRadius:'8px', fontSize:'9px', border:'1px solid #34495e'}}>Firestore</span>
                <span style={{background:'#2c3e50', padding:'1px 6px', borderRadius:'8px', fontSize:'9px', border:'1px solid #34495e'}}>GenAI</span>
            </div>
            <div style={{marginTop:'15px', color:'#7f8c8d', fontSize:'10px', fontFamily:'monospace', opacity:0.8}}>
                Contacto: aaron.llerena@unmsm.edu.pe | +51 962596073
            </div>
        </div>
      </div>

      <div style={{position:'fixed', bottom:0, left:0, width:'100%', height:'22px', background:'#007acc', color:'white', fontSize:'10px', display:'flex', alignItems:'center', padding:'0 15px', justifyContent:'space-between', fontFamily:'Segoe UI, sans-serif', zIndex:1000}}>
          <div style={{display:'flex', gap:'15px'}}><span>🚀 ONLINE</span><span>📡 {latency}ms</span><span>💾 Firestore</span></div>
          <div style={{display:'flex', gap:'15px'}}><span>🕒 {currentTime}</span></div>
      </div>

      {imagenModal && <div style={{position:'fixed', top:0, left:0, width:'100%', height:'100%', background:'rgba(0,0,0,0.9)', zIndex:2000, display:'flex', justifyContent:'center', alignItems:'center'}} onClick={()=>setImagenModal(null)}><img src={imagenModal} style={{maxHeight:'90%', maxWidth:'90%', borderRadius:'5px'}} /></div>}
      
      {showPinPrompt && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: '#333',
            padding: '25px',
            borderRadius: '10px',
            boxShadow: '0 5px 15px rgba(0,0,0,0.3)',
            textAlign: 'center',
            color: 'white',
            width: '300px'
          }}>
            <h3 style={{ marginTop: '0', color: '#00d4ff' }}>Ingresa tu PIN</h3>
            <input
              type="password"
              maxLength="4"
              value={currentPin}
              onChange={(e) => setCurrentPin(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  verifyPin();
                }
              }}
              style={{
                width: 'calc(100% - 20px)',
                padding: '10px',
                margin: '15px 0',
                borderRadius: '5px',
                border: '1px solid #555',
                background: '#444',
                color: 'white',
                fontSize: '16px',
                textAlign: 'center'
              }}
              placeholder="****"
            />
            <div style={{ display: 'flex', justifyContent: 'space-around', gap: '10px' }}>
              <button
                onClick={verifyPin}
                style={{
                  background: '#27ae60',
                  color: 'white',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  fontSize: '14px',
                  flexGrow: 1
                }}
              >
                Verificar
              </button>
              <button
                onClick={() => { setShowPinPrompt(false); setCurrentPin(""); setActionToPerform(null); }}
                style={{
                  background: '#c0392b',
                  color: 'white',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  fontSize: '14px',
                  flexGrow: 1
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;