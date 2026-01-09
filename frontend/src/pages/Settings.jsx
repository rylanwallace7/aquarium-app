import { useState, useEffect } from 'react'
import { useSettings } from '../context/SettingsContext'

const timezones = [
  { value: 'Pacific/Honolulu', label: 'Hawaii (HST)', offset: -10 },
  { value: 'America/Anchorage', label: 'Alaska (AKST)', offset: -9 },
  { value: 'America/Los_Angeles', label: 'Pacific (PST)', offset: -8 },
  { value: 'America/Denver', label: 'Mountain (MST)', offset: -7 },
  { value: 'America/Chicago', label: 'Central (CST)', offset: -6 },
  { value: 'America/New_York', label: 'Eastern (EST)', offset: -5 },
  { value: 'America/Sao_Paulo', label: 'Brasilia (BRT)', offset: -3 },
  { value: 'UTC', label: 'UTC', offset: 0 },
  { value: 'Europe/London', label: 'London (GMT)', offset: 0 },
  { value: 'Europe/Paris', label: 'Paris (CET)', offset: 1 },
  { value: 'Europe/Berlin', label: 'Berlin (CET)', offset: 1 },
  { value: 'Africa/Cairo', label: 'Cairo (EET)', offset: 2 },
  { value: 'Europe/Moscow', label: 'Moscow (MSK)', offset: 3 },
  { value: 'Asia/Dubai', label: 'Dubai (GST)', offset: 4 },
  { value: 'Asia/Kolkata', label: 'India (IST)', offset: 5.5 },
  { value: 'Asia/Bangkok', label: 'Bangkok (ICT)', offset: 7 },
  { value: 'Asia/Shanghai', label: 'China (CST)', offset: 8 },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)', offset: 9 },
  { value: 'Australia/Sydney', label: 'Sydney (AEST)', offset: 10 },
  { value: 'Pacific/Auckland', label: 'Auckland (NZST)', offset: 12 }
]

function Settings() {
  const [settings, setSettings] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const { refreshSettings: refreshGlobalSettings } = useSettings()

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings')
      if (res.ok) {
        const data = await res.json()
        setSettings(data)
      }
    } catch (err) {
      // Silently ignore fetch errors
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSettings()
  }, [])

  const updateSetting = async (key, value) => {
    setSaving(true)
    try {
      const res = await fetch(`/api/settings/${key}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value })
      })
      if (res.ok) {
        setSettings(prev => ({ ...prev, [key]: value }))
        // Refresh global settings context so all components update
        refreshGlobalSettings()
      }
    } catch (err) {
      // Silently ignore update errors
    } finally {
      setSaving(false)
    }
  }

  const getCurrentTime = () => {
    if (!settings.timezone) return '--'
    try {
      return new Date().toLocaleString('en-US', {
        timeZone: settings.timezone,
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      })
    } catch {
      return '--'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <span className="material-symbols-outlined text-4xl text-kurz-blue animate-spin">sync</span>
          <p className="text-sm text-slate-400 mt-2">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-4">
        <h2 className="font-display font-black text-xl uppercase italic tracking-tighter text-kurz-dark">
          Settings
        </h2>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
          App Configuration
        </p>
      </div>

      {/* Timezone Setting */}
      <div className="bg-white kurz-border kurz-card-shadow p-4 mb-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-kurz-purple kurz-border flex items-center justify-center flex-shrink-0">
            <span className="material-symbols-outlined text-white text-xl">schedule</span>
          </div>
          <div className="flex-1">
            <h3 className="font-display font-bold text-sm uppercase text-kurz-dark">
              Timezone
            </h3>
            <p className="text-[10px] text-slate-400 mt-1">
              All dates and times will be displayed in this timezone
            </p>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t-2 border-slate-100">
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
            Select Timezone
          </label>
          <select
            value={settings.timezone || 'UTC'}
            onChange={(e) => updateSetting('timezone', e.target.value)}
            disabled={saving}
            className="w-full p-3 kurz-border bg-white text-kurz-dark font-bold text-sm appearance-none cursor-pointer"
            style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'%231a1a2e\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'M19 9l-7 7-7-7\'/%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', backgroundSize: '20px' }}
          >
            {timezones.map(tz => (
              <option key={tz.value} value={tz.value}>
                {tz.label} (UTC{tz.offset >= 0 ? '+' : ''}{tz.offset})
              </option>
            ))}
          </select>

          <div className="mt-3 flex items-center gap-2">
            <span className="w-2 h-2 bg-kurz-green rounded-full"></span>
            <span className="text-[10px] font-bold text-slate-500">
              Current time: {getCurrentTime()}
            </span>
          </div>
        </div>
      </div>

      {/* App Info */}
      <div className="bg-white kurz-border kurz-card-shadow p-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-kurz-cyan kurz-border flex items-center justify-center flex-shrink-0">
            <span className="material-symbols-outlined text-kurz-dark text-xl">info</span>
          </div>
          <div className="flex-1">
            <h3 className="font-display font-bold text-sm uppercase text-kurz-dark">
              Deep Sea Observatory
            </h3>
            <p className="text-[10px] text-slate-400 mt-1">
              Aquarium Monitoring System
            </p>
            <p className="text-[9px] text-slate-300 mt-2">
              Version 1.0.0
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Settings
