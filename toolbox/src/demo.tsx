import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import ToolboxApp from './toolbox/ToolboxApp'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ToolboxApp />
  </StrictMode>,
)
