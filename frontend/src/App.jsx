import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Specimens from './pages/Specimens'
import LabLogs from './pages/LabLogs'
import Hardware from './pages/Hardware'
import Settings from './pages/Settings'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="specimens" element={<Specimens />} />
        <Route path="logs" element={<LabLogs />} />
        <Route path="hardware" element={<Hardware />} />
        <Route path="settings" element={<Settings />} />
      </Route>
    </Routes>
  )
}

export default App
