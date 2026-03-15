import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import Topbar from './components/layout/Topbar'
import Sidebar from './components/layout/Sidebar'
import MapView from './pages/MapView'
import Overview from './pages/Overview'
import ZoneDetail from './pages/ZoneDetail'
import Alerts from './pages/Alerts'
import Analytics from './pages/Analytics'
import About from './pages/About'

export default function App() {
  return (
    <BrowserRouter>
      <div className="h-full w-full bg-bg text-text">
        <Topbar />
        <div className="flex h-[calc(100%-48px)]">
          <Sidebar />
          <main className="min-w-0 flex-1">
            <Routes>
              <Route path="/" element={<MapView />} />
              <Route path="/overview" element={<Overview />} />
              <Route path="/zones/:zoneId" element={<ZoneDetail />} />
              <Route path="/alerts" element={<Alerts />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/about" element={<About />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </div>
    </BrowserRouter>
  )
}
