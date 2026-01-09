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
  const [testingPushover, setTestingPushover] = useState(false)
  const [pushoverStatus, setPushoverStatus] = useState(null)
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

  const testPushover = async () => {
    setTestingPushover(true)
    setPushoverStatus(null)
    try {
      const res = await fetch('/api/pushover/test', { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        setPushoverStatus({ success: true, message: 'Test notification sent!' })
      } else {
        setPushoverStatus({ success: false, message: data.error || 'Failed to send' })
      }
    } catch (err) {
      setPushoverStatus({ success: false, message: 'Connection error' })
    } finally {
      setTestingPushover(false)
      setTimeout(() => setPushoverStatus(null), 5000)
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
    <div className="pb-8">
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

      {/* Pushover Notifications */}
      <div className="bg-white kurz-border kurz-card-shadow p-4 mb-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-kurz-orange kurz-border flex items-center justify-center flex-shrink-0">
            <span className="material-symbols-outlined text-white text-xl">notifications</span>
          </div>
          <div className="flex-1">
            <h3 className="font-display font-bold text-sm uppercase text-kurz-dark">
              Pushover Notifications
            </h3>
            <p className="text-[10px] text-slate-400 mt-1">
              Get push notifications for alerts and maintenance reminders
            </p>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t-2 border-slate-100 space-y-4">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
              API Token (Application Key)
            </label>
            <input
              type="text"
              value={settings.pushover_token || ''}
              onChange={(e) => updateSetting('pushover_token', e.target.value)}
              onFocus={(e) => {
                if (e.target.value.startsWith('••••')) {
                  setSettings(prev => ({ ...prev, pushover_token: '' }))
                }
              }}
              placeholder="Your Pushover API Token"
              disabled={saving}
              className="w-full p-3 kurz-border bg-white text-kurz-dark font-mono text-sm placeholder:text-slate-300"
            />
            <p className="text-[9px] text-slate-400 mt-1">
              {settings.pushover_token?.startsWith('••••')
                ? 'Token saved • Click to enter a new one'
                : 'Create an application at pushover.net to get this token'}
            </p>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
              User Key
            </label>
            <input
              type="text"
              value={settings.pushover_user || ''}
              onChange={(e) => updateSetting('pushover_user', e.target.value)}
              onFocus={(e) => {
                if (e.target.value.startsWith('••••')) {
                  setSettings(prev => ({ ...prev, pushover_user: '' }))
                }
              }}
              placeholder="Your Pushover User Key"
              disabled={saving}
              className="w-full p-3 kurz-border bg-white text-kurz-dark font-mono text-sm placeholder:text-slate-300"
            />
            <p className="text-[9px] text-slate-400 mt-1">
              {settings.pushover_user?.startsWith('••••')
                ? 'User key saved • Click to enter a new one'
                : 'Found on your Pushover dashboard'}
            </p>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={testPushover}
              disabled={testingPushover || !settings.pushover_token || !settings.pushover_user}
              className={`px-4 py-2 kurz-border text-[10px] font-bold uppercase tracking-wider transition-colors ${
                testingPushover || !settings.pushover_token || !settings.pushover_user
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  : 'bg-kurz-cyan text-kurz-dark hover:bg-kurz-green'
              }`}
            >
              {testingPushover ? 'Sending...' : 'Send Test'}
            </button>
            {pushoverStatus && (
              <span className={`text-[10px] font-bold ${pushoverStatus.success ? 'text-kurz-green' : 'text-kurz-pink'}`}>
                {pushoverStatus.message}
              </span>
            )}
          </div>

          {/* Notification Options */}
          <div className="pt-4 border-t-2 border-slate-100">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-3">
              Notification Types
            </label>

            <div className="space-y-3">
              <div className="space-y-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.pushover_alerts !== '0'}
                    onChange={(e) => updateSetting('pushover_alerts', e.target.checked ? '1' : '0')}
                    disabled={saving}
                    className="w-5 h-5 kurz-border rounded-none accent-kurz-blue"
                  />
                  <div>
                    <span className="text-sm font-bold text-kurz-dark">Sensor Alerts</span>
                    <p className="text-[9px] text-slate-400">When readings go out of range</p>
                  </div>
                </label>

                {settings.pushover_alerts !== '0' && (
                  <div className="ml-8 mt-2">
                    <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                      Repeat Alert Every
                    </label>
                    <div className="flex gap-2 flex-wrap">
                      {[
                        { value: '0', label: 'Never' },
                        { value: '5', label: '5 Min' },
                        { value: '30', label: '30 Min' },
                        { value: '60', label: '1 Hour' },
                        { value: '1440', label: '1 Day' }
                      ].map(opt => (
                        <button
                          key={opt.value}
                          onClick={() => updateSetting('pushover_alert_repeat', opt.value)}
                          disabled={saving}
                          className={`px-3 py-1.5 kurz-border text-[9px] font-bold uppercase ${
                            (settings.pushover_alert_repeat || '0') === opt.value
                              ? 'bg-kurz-blue text-white'
                              : 'bg-white text-slate-500'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    <p className="text-[8px] text-slate-400 mt-1">
                      Re-notify while sensor remains out of range
                    </p>
                  </div>
                )}
              </div>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.pushover_maintenance !== '0'}
                  onChange={(e) => updateSetting('pushover_maintenance', e.target.checked ? '1' : '0')}
                  disabled={saving}
                  className="w-5 h-5 kurz-border rounded-none accent-kurz-blue"
                />
                <div>
                  <span className="text-sm font-bold text-kurz-dark">Maintenance Reminders</span>
                  <p className="text-[9px] text-slate-400">When tasks are due</p>
                </div>
              </label>
            </div>
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
