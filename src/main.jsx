import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'

const isNative = window.Capacitor?.isNativePlatform?.() === true
const basename = isNative ? '/' : (import.meta.env.VITE_BASE_URL ?? '/Ciclo-de-Carretas-Cobeb')

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter basename={basename}>
      <App />
    </BrowserRouter>
  </React.StrictMode>
)
