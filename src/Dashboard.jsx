import React, { useState, useEffect } from 'react';
import { db } from './firebase'; 
import { collection, getDocs } from 'firebase/firestore'; 

const API_URL = "https://us-central1-mrp-planner-alimentos.cloudfunctions.net/procesar_op";

function Dashboard() {
  const [inventario, setInventario] = useState([]);
  const [loading, setLoading] = useState(true);
  const [imagen, setImagen] = useState(null);
  const [procesando, setProcesando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [datosExtraidos, setDatosExtraidos] = useState(null);

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

  useEffect(() => {
    const handlePaste = (e) => {
      const items = e.clipboardData.items;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image") !== -1) {
          const blob = items[i].getAsFile();
          const reader = new FileReader();
          reader.onloadend = () => {
            setImagen(reader.result);
            setMensaje("¡Imagen pegada! Lista para enviar. 📋");
            setDatosExtraidos(null);
          };
          reader.readAsDataURL(blob);
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagen(reader.result);
        setMensaje("Imagen cargada. Dale al botón azul.");
        setDatosExtraidos(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const procesarImagen = async () => {
    if (!imagen) return alert("Primero pega una imagen o sube un archivo.");
    setProcesando(true);
    setMensaje("🧠 Conectando con Gemini... (Esto puede tardar unos segundos)");
    setDatosExtraidos(null);

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: imagen })
      });
      
      // LEER LA RESPUESTA TAL CUAL VENGA (TEXTO O JSON)
      const textoRespuesta = await response.text();
      let data;

      try {
        data = JSON.parse(textoRespuesta); // Intentamos convertir a JSON
      } catch (e) {
        // Si falla la conversion, es porque vino un error de texto plano
        throw new Error("Respuesta del servidor no válida: " + textoRespuesta);
      }

      if (!response.ok) {
        throw new Error(data.error || "Error desconocido del servidor");
      }

      setMensaje(data.mensaje);
      if (data.datos) {
        setDatosExtraidos(data.datos);
      }
      
    } catch (error) {
      console.error("Error real:", error);
      // AQUI MOSTRAMOS EL ERROR REAL EN PANTALLA
      setMensaje("❌ Ocurrió un error: " + error.message);
    }
    setProcesando(false);
  };

  if (loading) return <div style={{padding: 20}}>Cargando sistema...</div>;

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif', maxWidth: '900px', margin: '0 auto' }}>
      <h1 style={{ color: '#333' }}>MRP Planner - Alimentos</h1>
      
      <div style={{ border: '2px dashed #0070f3', padding: '25px', borderRadius: '15px', marginBottom: '40px', backgroundColor: '#fdfdfd' }}>
        <h2 style={{ color: '#0070f3', marginTop: 0 }}>🤖 Procesar Orden de Producción</h2>
        <p><strong>Pega tu imagen (Ctrl + V)</strong> o súbela:</p>
        
        <input type="file" accept="image/*" onChange={handleImageChange} />
        
        {imagen && (
          <div style={{ marginTop: '20px' }}>
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
                fontWeight: 'bold'
              }}
            >
              {procesando ? "⏳ Analizando..." : "✨ Extraer Datos con IA"}
            </button>
          </div>
        )}

        {/* ZONA DE MENSAJES (Ahora en rojo si es error) */}
        {mensaje && (
          <p style={{ 
            fontWeight: 'bold', 
            color: mensaje.includes("❌") ? 'red' : '#333', 
            marginTop: '15px', 
            padding: '15px', 
            backgroundColor: mensaje.includes("❌") ? '#ffe6e6' : '#eee', 
            borderRadius: '5px',
            whiteSpace: 'pre-wrap' // Para que no se corte el texto largo
          }}>
            {mensaje}
          </p>
        )}
        
        {datosExtraidos && (
          <div style={{ marginTop: '25px', backgroundColor: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #e1e1e1' }}>
            <h3 style={{ borderBottom: '2px solid #0070f3' }}>📋 Resultados Detectados</h3>
            <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
              <div style={{ flex: 1, padding: '10px', backgroundColor: '#f8f9fa' }}>
                <span style={{ display: 'block', fontSize: '12px' }}>PRODUCTO</span>
                <strong style={{ fontSize: '18px' }}>{datosExtraidos.producto}</strong>
              </div>
              <div style={{ flex: 1, padding: '10px', backgroundColor: '#f8f9fa' }}>
                <span style={{ display: 'block', fontSize: '12px' }}>CANTIDAD META</span>
                <strong style={{ fontSize: '18px' }}>{datosExtraidos.cantidad_a_producir}</strong>
              </div>
            </div>
            <h4>Insumos:</h4>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f1f1f1' }}>
                  <th style={{ padding: '10px' }}>Insumo</th>
                  <th style={{ padding: '10px' }}>Cantidad</th>
                  <th style={{ padding: '10px' }}>Unidad</th>
                </tr>
              </thead>
              <tbody>
                {datosExtraidos.insumos && datosExtraidos.insumos.map((insumo, index) => (
                  <tr key={index} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '10px' }}>{insumo.nombre}</td>
                    <td style={{ padding: '10px', color: '#0070f3' }}>{insumo.cantidad}</td>
                    <td style={{ padding: '10px' }}>{insumo.unidad}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <h2>📦 Inventario en Almacén</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '15px' }}>
        {inventario.map(item => (
          <div key={item.id} style={{ border: '1px solid #e0e0e0', padding: '15px', borderRadius: '10px' }}>
            <h3 style={{margin: '0 0 5px 0', fontSize: '16px'}}>{item.id}</h3>
            <p>Stock: <strong>{item.stockActual}</strong></p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Dashboard;