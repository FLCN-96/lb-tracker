import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/tokens.css'
import './index.css'

// Register service worker in production (handled by vite-plugin-pwa)
import { registerSW } from 'virtual:pwa-register'
registerSW({ immediate: true })

// Detect iOS standalone (Add to Home Screen) mode and tag the root element.
// Used to fix the bottom whitespace gap that appears in iOS PWA mode.
if (
  typeof navigator !== 'undefined' &&
  'standalone' in navigator &&
  (navigator as Navigator & { standalone: boolean }).standalone === true
) {
  document.documentElement.classList.add('ios-standalone')
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
