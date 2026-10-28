import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { FrameRateMeter } from './device/FrameRateMeter.tsx'
import { registerServiceWorker } from './device/offline.ts'

// Add ?fps to the address to see the frame rate, e.g. http://192.168.1.20:5173/?fps
const showFrameRate = new URLSearchParams(location.search).has('fps')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    {showFrameRate && <FrameRateMeter />}
  </StrictMode>,
)

registerServiceWorker()
