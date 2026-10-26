import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').then((registration) => {
      const announceUpdate = () => {
        if (registration.waiting && navigator.serviceWorker.controller) {
          window.dispatchEvent(
            new CustomEvent('qt-app-update-available', {
              detail: registration,
            }),
          )
        }
      }

      announceUpdate()
      registration.addEventListener('updatefound', () => {
        const installingWorker = registration.installing
        if (!installingWorker) return
        installingWorker.addEventListener('statechange', announceUpdate)
      })

      const checkForUpdate = () => {
        if (navigator.onLine) {
          void registration.update().catch((error: unknown) => {
            console.error('Could not check for app updates.', error)
          })
        }
      }
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') checkForUpdate()
      })
      window.setInterval(checkForUpdate, 60 * 60 * 1000)
    }).catch((error: unknown) => {
      console.error('Could not register offline app support.', error)
    })
  })
}
