import { useState, useEffect } from 'react'

function Header() {
  const [systemStatus, setSystemStatus] = useState({ ok: true, loading: true })

  // Check system status
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const res = await fetch('/api/parameters')
        if (res.ok) {
          const data = await res.json()
          if (data.length === 0) {
            setSystemStatus({ ok: true, loading: false, noSensors: true })
          } else {
            const goodStatuses = ['Normal', 'OK', 'Active', 'Water OK']
            const allGood = data.every(p => goodStatuses.includes(p.status))
            setSystemStatus({ ok: allGood, loading: false })
          }
        }
      } catch (err) {
        setSystemStatus({ ok: false, loading: false })
      }
    }

    checkStatus()
    const interval = setInterval(checkStatus, 5000)
    return () => clearInterval(interval)
  }, [])

  return (
    <header className="bg-kurz-dark h-20 px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-kurz-yellow kurz-border rounded-lg flex items-center justify-center">
          <span className="material-symbols-outlined text-kurz-dark font-black text-xl">water_drop</span>
        </div>
        <h1 className="font-display font-black text-sm tracking-tight uppercase italic text-white">
          Deep Sea Observatory
        </h1>
      </div>

      <div className="flex items-center gap-2">
        {systemStatus.loading ? (
          <>
            <span className="w-2.5 h-2.5 bg-slate-400 rounded-full animate-pulse"></span>
            <span className="text-slate-400 font-bold uppercase tracking-wider text-[9px]">
              Checking...
            </span>
          </>
        ) : systemStatus.noSensors ? (
          <>
            <span className="w-2.5 h-2.5 bg-kurz-yellow rounded-full"></span>
            <span className="text-kurz-yellow font-bold uppercase tracking-wider text-[9px]">
              No Sensors
            </span>
          </>
        ) : systemStatus.ok ? (
          <>
            <span className="w-2.5 h-2.5 bg-kurz-green rounded-full glow-green"></span>
            <span className="text-kurz-green font-bold uppercase tracking-wider text-[9px]">
              Optimal
            </span>
          </>
        ) : (
          <>
            <span className="w-2.5 h-2.5 bg-kurz-pink rounded-full animate-pulse"></span>
            <span className="text-kurz-pink font-bold uppercase tracking-wider text-[9px]">
              Attention
            </span>
          </>
        )}
      </div>
    </header>
  )
}

export default Header
