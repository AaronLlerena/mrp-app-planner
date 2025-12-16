import React, { useState, useEffect } from 'react';
import { db } from './firebase'; 
import { collection, getDocs } from 'firebase/firestore'; 

// Estilos básicos para que se vea ordenado
const styles = {
    container: { padding: '20px', fontFamily: 'Arial, sans-serif' },
    cardContainer: { 
        display: 'flex', 
        flexWrap: 'wrap', 
        gap: '20px', 
        marginTop: '20px' 
    },
    card: { 
        border: '1px solid #0056b3', 
        padding: '15px', 
        borderRadius: '8px', 
        width: '300px',
        boxShadow: '2px 2px 5px rgba(0,0,0,0.1)'
    },
    status: (status) => ({
        fontWeight: 'bold', 
        color: status === 'OC_ENVIADA' ? 'orange' : status === 'PENDIENTE' ? 'red' : 'green' 
    })
};


function App() {
  const [inventario, setInventario] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchInventario = async () => {
      try {
        // Obtiene la referencia a la colección 'Inventario'
        const inventarioCollectionRef = collection(db, 'Inventario');
        
        // Hace la consulta a Firebase
        const snapshot = await getDocs(inventarioCollectionRef);
        
        // Mapea los documentos
        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        setInventario(data);
        setLoading(false);
        setError(null); // Limpiar errores si tuvo éxito

      } catch (err) {
        console.error("Error al cargar el inventario: ", err);
        setError("Error de conexión o permisos. Revisa tus Reglas de Firebase y la consola.");
        setLoading(false);
      }
    };

    fetchInventario();
  }, []);

  if (loading) {
    return <div style={styles.container}>Cargando inventario...</div>;
  }
  
  return (
    <div style={styles.container}>
      <h1>Consolidador de Requerimientos MRP</h1>
      <h2>Inventario Actual (Stock y Estatus de Compra)</h2>
      
      {error && <div style={{ color: 'red', border: '1px solid red', padding: '10px' }}>{error}</div>}

      {inventario.length === 0 && !error ? (
          <p>No se encontraron insumos. ¡Asegúrate de que la colección 'Inventario' tenga datos!</p>
      ) : (
          <div style={styles.cardContainer}>
            {inventario.map(item => (
              <div key={item.id} style={styles.card}>
                <p><strong>Insumo (Cód.):</strong> {item.id}</p>
                <p><strong>Stock Actual:</strong> {item.stockActual}</p>
                <p><strong>Proveedor:</strong> {item.proveedor || 'Sin asignar'}</p>
                <p><strong>Estatus:</strong> 
                  <span style={styles.status(item.statusCompra)}>
                    {item.statusCompra || 'PENDIENTE'}
                  </span>
                </p>
              </div>
            ))}
          </div>
      )}
    </div>
  );
}

export default App;