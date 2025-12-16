import React, { useState, useEffect } from 'react';
import { db } from './firebase'; 
import { collection, getDocs } from 'firebase/firestore'; 

const styles = {
    container: { padding: '20px', fontFamily: 'Arial, sans-serif' },
    card: { border: '1px solid #ddd', padding: '15px', margin: '10px', borderRadius: '8px' }
};

function Dashboard() {
  const [inventario, setInventario] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchInventario = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, 'Inventario'));
        const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setInventario(data);
        setLoading(false);
      } catch (error) {
        console.error("Error:", error);
        setLoading(false);
      }
    };
    fetchInventario();
  }, []);

  if (loading) return <div>Cargando...</div>;

  return (
    <div style={styles.container}>
      <h1>MRP Planner - Dashboard</h1>
      {inventario.map(item => (
        <div key={item.id} style={styles.card}>
          <p><strong>{item.id}</strong>: Stock {item.stockActual}</p>
        </div>
      ))}
    </div>
  );
}
export default Dashboard;
