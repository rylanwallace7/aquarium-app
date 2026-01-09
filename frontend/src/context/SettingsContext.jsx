import { createContext, useContext, useState, useEffect } from 'react'

const SettingsContext = createContext({
  timezone: 'UTC',
  formatDate: () => '--',
  formatDateTime: () => '--',
  formatTime: () => '--',
  formatRelativeDate: () => '--'
})

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState({ timezone: 'UTC' })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
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

    fetchSettings()
  }, [])

  const formatDate = (dateStr) => {
    if (!dateStr) return '--'
    try {
      const date = new Date(dateStr)
      return date.toLocaleDateString('en-US', {
        timeZone: settings.timezone || 'UTC',
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      })
    } catch {
      return '--'
    }
  }

  const formatDateTime = (dateStr) => {
    if (!dateStr) return '--'
    try {
      const date = new Date(dateStr)
      return date.toLocaleString('en-US', {
        timeZone: settings.timezone || 'UTC',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      })
    } catch {
      return '--'
    }
  }

  const formatTime = (dateStr) => {
    if (!dateStr) return '--'
    try {
      const date = new Date(dateStr)
      return date.toLocaleTimeString('en-US', {
        timeZone: settings.timezone || 'UTC',
        hour: 'numeric',
        minute: '2-digit'
      })
    } catch {
      return '--'
    }
  }

  const formatRelativeDate = (dateStr) => {
    if (!dateStr) return 'Never'
    try {
      const date = new Date(dateStr)
      const now = new Date()

      // Convert both to the configured timezone for comparison
      const tzOptions = { timeZone: settings.timezone || 'UTC' }
      const dateInTz = new Date(date.toLocaleString('en-US', tzOptions))
      const nowInTz = new Date(now.toLocaleString('en-US', tzOptions))

      const diffMs = nowInTz - dateInTz
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

      if (diffDays === 0) return 'Today'
      if (diffDays === 1) return 'Yesterday'
      if (diffDays < 7) return `${diffDays} days ago`

      return date.toLocaleDateString('en-US', {
        timeZone: settings.timezone || 'UTC',
        month: 'short',
        day: 'numeric'
      })
    } catch {
      return '--'
    }
  }

  const value = {
    timezone: settings.timezone || 'UTC',
    loading,
    formatDate,
    formatDateTime,
    formatTime,
    formatRelativeDate,
    refreshSettings: async () => {
      const res = await fetch('/api/settings')
      if (res.ok) {
        const data = await res.json()
        setSettings(data)
      }
    }
  }

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings() {
  return useContext(SettingsContext)
}
