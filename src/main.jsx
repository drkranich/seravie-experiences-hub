import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { TenantProvider } from './hooks/useTenant'
import App from './App'
import './index.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <TenantProvider>
      <App />
    </TenantProvider>
  </StrictMode>
)
