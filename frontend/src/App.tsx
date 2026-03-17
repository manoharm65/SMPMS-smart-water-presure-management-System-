import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import Topbar from './components/layout/Topbar'
import Home from './pages/Home'
import MapView from './pages/MapView'
import Overview from './pages/Overview'
import ZoneDetail from './pages/ZoneDetail'
import Alerts from './pages/Alerts'
import Analytics from './pages/Analytics'
import About from './pages/About'
import Login from './pages/Login'

export default function App() {
  return (
    <BrowserRouter>
      <div className="h-full w-full bg-bg text-text">
        <Topbar />
        <main className="h-[calc(100%-48px)] min-w-0">
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
        </main>
      </div>
    </BrowserRouter>
  )
}
