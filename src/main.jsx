import React from 'react'
import ReactDOM from 'react-dom/client'
// -> IMPORTACIÓN CRÍTICA: La ruta debe coincidir EXACTAMENTE
import App from './app.jsx' 

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)