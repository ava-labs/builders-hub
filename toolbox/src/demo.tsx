import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import ToolboxApp from './toolbox/ToolboxApp'
import L1Launcher from './l1-launcher/L1Launcher'

export function DummyRouter() {
  if (window.location.pathname.startsWith('/l1-toolbox')) {
    return <ToolboxApp />
  } else if (window.location.pathname === "/") {
    return <MainPage />
  } else if (window.location.pathname === "/l1-launcher") {
    return <L1Launcher />
  }
  return <div className="container mx-auto p-4">
    <div>Not found. <a href="/" className="text-blue-500 hover:text-blue-600 hover:underline">Back to /</a></div>
  </div>
}

export function MainPage() {
  return <div className="container mx-auto p-4">
    <h1 className="text-2xl font-bold mb-4">Tools preview:</h1>
    <ul className="list-decimal pl-5">
      <li className="mb-2"><a href="/l1-toolbox" className="text-blue-500 hover:text-blue-600 hover:underline">L1 Toolbox</a></li>
      <li className="mb-2"><a href="/l1-launcher" className="text-blue-500 hover:text-blue-600 hover:underline">L1 Launcher</a></li>
    </ul>
  </div>
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DummyRouter />
  </StrictMode>,
)
