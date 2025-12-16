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

  // 1. Cargar Inventario
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

  // 2. Manejar la selección de imagen
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagen(reader.result); // Esto convierte la imagen a base64
      };
      reader.readAsDataURL(file);
    }
  };

  // 3. Enviar a Python (Tu Backend)
  const procesarImagen = async () => {
    if (!imagen) return alert("Selecciona una imagen primero");
    setProcesando(true);
    setMensaje("Enviando a la IA...");

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: imagen, opId: "OP-Demo" })
      });
      
      const data = await response.json();
      setMensaje("Respuesta del servidor: " + data.mensaje);
      console.log("Datos recibidos:", data);
      
    } catch (error) {
      console.error(error);
      setMensaje("Error al conectar con el servidor.");
    }
    setProcesando(false);
  };

  if (loading) return <div style={{padding: 20}}>Cargando sistema...</div>;

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif', maxWidth: '800px', margin: '0 auto' }}>
      <h1>MRP Planner - Alimentos</h1>
      
      {/* SECCIÓN DE IA */}
      <div style={{ border: '2px dashed #0070f3', padding: '20px', borderRadius: '10px', marginBottom: '30px', backgroundColor: '#f0f9ff' }}>
        <h2>🤖 Procesar Orden de Producción</h2>
        <p>Sube una foto de tu OP para extraer los datos:</p>
        <input type="file" accept="image/*" onChange={handleImageChange} />
        
        {imagen && (
          <div style={{ marginTop: '10px' }}>
            <img src={imagen} alt="Preview" style={{ maxWidth: '200px', borderRadius: '5px' }} />
            <br />
            <button 
              onClick={procesarImagen} 
              disabled={procesando}
              style={{
                marginTop: '10px', padding: '10px 20px', backgroundColor: '#0070f3', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '16px'
              }}
            >
              {procesando ? "Analizando..." : "✨ Procesar con IA"}
            </button>
          </div>
        )}
        {mensaje && <p style={{ fontWeight: 'bold', color: '#333', marginTop: '10px' }}>{mensaje}</p>}
      </div>

      {/* SECCIÓN DE INVENTARIO */}
      <h2>📦 Inventario Actual</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
        {inventario.map(item => (
          <div key={item.id} style={{ border: '1px solid #ddd', padding: '15px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
            <h3 style={{margin: '0 0 10px 0', fontSize: '18px'}}>{item.id}</h3>
            <p style={{margin: 0, color: '#666'}}>Stock: <strong>{item.stockActual}</strong></p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Dashboard;
