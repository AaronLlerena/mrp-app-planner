import React, { useState, useEffect } from 'react';
import { db } from './firebase'; 
import { collection, getDocs } from 'firebase/firestore'; 

// URL de tu servidor de Inteligencia Artificial
const API_URL = "https://us-central1-mrp-planner-alimentos.cloudfunctions.net/procesar_op";

function Dashboard() {
  const [inventario, setInventario] = useState([]);
  const [loading, setLoading] = useState(true);
  const [imagen, setImagen] = useState(null);
  const [procesando, setProcesando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [datosExtraidos, setDatosExtraidos] = useState(null);

  // 1. Cargar Inventario al iniciar
  useEffect(() => {
    const fetchInventario = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, 'Inventario'));
        const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setInventario(data);
      } catch (error) { console.error(error); }
      setLoading(false);
    };
    fetchInventario();
  }, []);

  // 2. DETECTOR DE "CTRL + V" (Pegar imagen)
  useEffect(() => {
    const handlePaste = (e) => {
      const items = e.clipboardData.items;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image") !== -1) {
          const blob = items[i].getAsFile();
          const reader = new FileReader();
          reader.onloadend = () => {
            setImagen(reader.result);
            setMensaje("¡Imagen pegada desde el portapapeles! 📋");
            setDatosExtraidos(null); // Limpiar datos anteriores
          };
          reader.readAsDataURL(blob);
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  // 3. Subir archivo manual (Botón clásico)
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagen(reader.result);
        setDatosExtraidos(null);
        setMensaje("Imagen cargada manualmente.");
      };
      reader.readAsDataURL(file);
    }
  };

  // 4. Enviar a tu Inteligencia Artificial
  const procesarImagen = async () => {
    if (!imagen) return alert("Primero pega una imagen (Ctrl+V) o sube un archivo.");
    setProcesando(true);
    setMensaje("🧠 Analizando tu cuadro con Gemini...");
    setDatosExtraidos(null);

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: imagen })
      });
      
      const data = await response.json();
      setMensaje(data.mensaje);
      
      if (data.datos) {
        setDatosExtraidos(data.datos);
      }
      
    } catch (error) {
      console.error(error);
      setMensaje("❌ Error al conectar con el servidor.");
    }
    setProcesando(false);
  };

  if (loading) return <div style={{padding: 20}}>Cargando sistema...</div>;

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif', maxWidth: '900px', margin: '0 auto' }}>
      <h1 style={{ color: '#333' }}>MRP Planner - Alimentos</h1>
      
      {/* SECCIÓN DE INTELIGENCIA ARTIFICIAL */}
      <div style={{ border: '2px dashed #0070f3', padding: '25px', borderRadius: '15px', marginBottom: '40px', backgroundColor: '#fdfdfd' }}>
        <h2 style={{ color: '#0070f3', marginTop: 0 }}>🤖 Procesar Orden de Producción</h2>
        <p style={{ fontSize: '16px' }}>
          <strong>Opción A:</strong> Haz una captura de pantalla y presiona <code>Ctrl + V</code> aquí.<br/>
          <strong>Opción B:</strong> Sube el archivo manualmente:
        </p>
        
        <input type="file" accept="image/*" onChange={handleImageChange} />
        
        {imagen && (
          <div style={{ marginTop: '20px' }}>
            <p><strong>Vista Previa:</strong></p>
            <img src={imagen} alt="Preview" style={{ maxWidth: '100%', maxHeight: '300px', borderRadius: '8px', border: '1px solid #ccc' }} />
            <br />
            <button 
              onClick={procesarImagen} 
              disabled={procesando}
              style={{
                marginTop: '15px', 
                padding: '12px 24px', 
                backgroundColor: procesando ? '#ccc' : '#0070f3', 
                color: 'white', 
                border: 'none', 
                borderRadius: '8px', 
                cursor: procesando ? 'not-allowed' : 'pointer', 
                fontSize: '16px', 
                fontWeight: 'bold',
                boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
              }}
            >
              {procesando ? "⏳ Analizando..." : "✨ Extraer Datos con IA"}
            </button>
          </div>
        )}

        {/* MENSAJES DE ESTADO */}
        {mensaje && <p style={{ fontWeight: 'bold', color: '#555', marginTop: '15px', backgroundColor: '#eee', padding: '10px', borderRadius: '5px' }}>{mensaje}</p>}
        
        {/* RESULTADOS DE LA IA (TABLA) */}
        {datosExtraidos && (
          <div style={{ marginTop: '25px', backgroundColor: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #e1e1e1', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}>
            <h3 style={{ borderBottom: '2px solid #0070f3', paddingBottom: '10px', color: '#333' }}>📋 Resultados Detectados</h3>
            
            <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
              <div style={{ flex: 1, padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
                <span style={{ display: 'block', fontSize: '12px', color: '#666' }}>PRODUCTO</span>
                <strong style={{ fontSize: '18px' }}>{datosExtraidos.producto || "Desconocido"}</strong>
              </div>
              <div style={{ flex: 1, padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
                <span style={{ display: 'block', fontSize: '12px', color: '#666' }}>CANTIDAD META</span>
                <strong style={{ fontSize: '18px' }}>{datosExtraidos.cantidad_a_producir || 0}</strong>
              </div>
            </div>

            <h4>Insumos Requeridos:</h4>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
              <thead>
                <tr style={{ backgroundColor: '#f1f1f1', textAlign: 'left' }}>
                  <th style={{ padding: '10px', borderBottom: '1px solid #ccc' }}>Insumo</th>
                  <th style={{ padding: '10px', borderBottom: '1px solid #ccc' }}>Cantidad</th>
                  <th style={{ padding: '10px', borderBottom: '1px solid #ccc' }}>Unidad</th>
                </tr>
              </thead>
              <tbody>
                {datosExtraidos.insumos && datosExtraidos.insumos.map((insumo, index) => (
                  <tr key={index} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '10px' }}>{insumo.nombre}</td>
                    <td style={{ padding: '10px', fontWeight: 'bold', color: '#0070f3' }}>{insumo.cantidad}</td>
                    <td style={{ padding: '10px' }}>{insumo.unidad}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* SECCIÓN DE INVENTARIO */}
      <h2>📦 Inventario en Almacén</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '15px' }}>
        {inventario.map(item => (
          <div key={item.id} style={{ border: '1px solid #e0e0e0', padding: '15px', borderRadius: '10px', backgroundColor: 'white' }}>
            <h3 style={{margin: '0 0 5px 0', fontSize: '16px', color: '#333'}}>{item.id}</h3>
            <p style={{margin: 0, color: '#666', fontSize: '14px'}}>Stock: <strong style={{color: item.stockActual < 10 ? 'red' : 'green'}}>{item.stockActual}</strong></p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Dashboard;