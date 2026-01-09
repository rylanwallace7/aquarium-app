import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import ParameterCard from '../components/ParameterCard'
import TelemetryChart from '../components/TelemetryChart'
import { useSettings } from '../context/SettingsContext'

function Dashboard() {
  const [parameters, setParameters] = useState([])
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState(null)
  const { formatTime } = useSettings()

  const fetchData = async () => {
    try {
      const res = await fetch('/api/parameters')
      if (res.ok) {
        const data = await res.json()
        setParameters(data)
        setLastUpdate(new Date())
      }
    } catch (err) {
      // Silently ignore fetch errors
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    // Live refresh every 5 seconds
    const interval = setInterval(fetchData, 5000)
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <span className="material-symbols-outlined text-4xl text-kurz-blue animate-spin">sync</span>
          <p className="text-sm text-slate-400 mt-2">Loading sensors...</p>
        </div>
      </div>
    )
  }

  if (parameters.length === 0) {
    return (
      <div className="bg-white kurz-border kurz-card-shadow p-8 text-center">
        <span className="material-symbols-outlined text-5xl text-slate-300 mb-3">sensors_off</span>
        <h3 className="font-display font-bold text-lg text-kurz-dark mb-2">No Sensors Configured</h3>
        <p className="text-sm text-slate-400 mb-4">Add sensors to start monitoring your aquarium</p>
        <Link
          to="/hardware"
          className="inline-flex items-center gap-2 bg-kurz-cyan kurz-border kurz-shadow-sm px-4 py-2 font-bold uppercase text-sm text-kurz-dark"
        >
          <span className="material-symbols-outlined text-sm">add</span>
          Add Sensors
        </Link>
      </div>
    )
  }

  return (
    <div>
      {/* Live indicator */}
      <div className="flex items-center justify-end gap-2 mb-3">
        <span className="w-2 h-2 bg-kurz-green rounded-full animate-pulse"></span>
        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
          Live • Updated {lastUpdate ? formatTime(lastUpdate.toISOString()) : '--'}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {parameters.map((param, i) => (
          <ParameterCard key={i} {...param} />
        ))}
      </div>

      <TelemetryChart parameters={parameters} />
    </div>
  )
}

export default Dashboard
