import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Sidebar from './components/layout/Sidebar'
import Topbar from './components/layout/Topbar'
import Home from './pages/Home'
import MapView from './pages/MapView'
import Overview from './pages/Overview'
import ZoneDetail from './pages/ZoneDetail'
import Alerts from './pages/Alerts'
import Analytics from './pages/Analytics'
import About from './pages/About'
import Login from './pages/Login'

function App() {
  return (
    <BrowserRouter>
      <div className="flex h-screen bg-paper overflow-hidden">
        <Sidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <Topbar />
          <main className="flex-1 overflow-y-auto bg-paper">
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
      </div>
    </BrowserRouter>
  )
}

export default App