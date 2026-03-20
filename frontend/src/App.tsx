import { Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Sidebar from './components/layout/Sidebar'
import Topbar from './components/layout/Topbar'

const Home = lazy(() => import('./pages/Home'))
const MapView = lazy(() => import('./pages/MapView'))
const Overview = lazy(() => import('./pages/Overview'))
const ZoneDetail = lazy(() => import('./pages/ZoneDetail'))
const Alerts = lazy(() => import('./pages/Alerts'))
const Analytics = lazy(() => import('./pages/Analytics'))
const About = lazy(() => import('./pages/About'))
const Login = lazy(() => import('./pages/Login'))

function App() {
  return (
    <BrowserRouter>
      <div className="flex h-screen bg-paper overflow-hidden">
        <Sidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <Topbar />
          <main className="flex-1 overflow-y-auto bg-paper">
            <Suspense fallback={<div className="p-4 text-sm text-text-muted">Loading…</div>}>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/" element={<Home />} />
                <Route path="/map" element={<MapView />} />
                <Route path="/overview" element={<Overview />} />
                <Route path="/zones/:zoneId" element={<ZoneDetail />} />
                <Route path="/alerts" element={<Alerts />} />
                <Route path="/analytics" element={<Analytics />} />
                <Route path="/about" element={<About />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </main>
        </div>
      </div>
    </BrowserRouter>
  )
}

export default App