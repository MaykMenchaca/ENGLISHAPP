import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './theme.js'
import './styles.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)

// Sin esto Chrome no ofrece "Agregar a inicio": exige un service worker
// registrado, aunque no cachee nada (ver public/service-worker.js).
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/service-worker.js')
}
