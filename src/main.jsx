import React from 'react'
import ReactDOM from 'react-dom/client'
// Importa el nuevo nombre
import MRP from './MRP.jsx' 

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* Usa el nuevo nombre */}
    <MRP />
  </React.StrictMode>,
)