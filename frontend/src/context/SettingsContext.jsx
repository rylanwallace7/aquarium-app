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

  // Normalize timestamp strings to ensure they're treated as UTC
  // SQLite stores timestamps without timezone info, so we need to add 'Z' suffix
  const parseAsUTC = (dateStr) => {
    if (!dateStr) return null
    // If it's a date-only string (YYYY-MM-DD), parse as midnight UTC
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return new Date(dateStr + 'T00:00:00Z')
    }
    // If it already has timezone info (ends with Z or +/-HH:MM), parse as-is
    if (/Z$/.test(dateStr) || /[+\-]\d{2}:\d{2}$/.test(dateStr) || /[+\-]\d{4}$/.test(dateStr)) {
      return new Date(dateStr)
    }
    // Replace space with T and add Z to indicate UTC
    const normalized = dateStr.replace(' ', 'T')
    return new Date(normalized + 'Z')
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return '--'
    try {
      const date = parseAsUTC(dateStr)
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
      const date = parseAsUTC(dateStr)
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
      const date = parseAsUTC(dateStr)
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
      const date = parseAsUTC(dateStr)
      const now = new Date()
      const tz = settings.timezone || 'UTC'

      // Get YYYY-MM-DD string in the configured timezone for both dates
      // Using en-CA locale gives us YYYY-MM-DD format
      const dateInTzStr = date.toLocaleDateString('en-CA', { timeZone: tz })
      const nowInTzStr = now.toLocaleDateString('en-CA', { timeZone: tz })

      // Parse as plain dates at midnight UTC for consistent comparison
      const datePart = new Date(dateInTzStr + 'T00:00:00Z')
      const nowPart = new Date(nowInTzStr + 'T00:00:00Z')

      const diffMs = nowPart - datePart
      const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))

      if (diffDays === 0) return 'Today'
      if (diffDays === 1) return 'Yesterday'
      if (diffDays < 0) return 'Today' // Just created, might show as future due to timing
      if (diffDays < 7) return `${diffDays} days ago`

      return date.toLocaleDateString('en-US', {
        timeZone: tz,
        month: 'short',
        day: 'numeric'
      })
    } catch {
      return '--'
    }
  }

  // Get current date parts in the configured timezone
  const getCurrentDateParts = () => {
    const now = new Date()
    const tz = settings.timezone || 'UTC'
    const year = parseInt(now.toLocaleDateString('en-CA', { timeZone: tz, year: 'numeric' }))
    const month = parseInt(now.toLocaleDateString('en-CA', { timeZone: tz, month: 'numeric' })) - 1 // 0-indexed
    const day = parseInt(now.toLocaleDateString('en-CA', { timeZone: tz, day: 'numeric' }))
    return { year, month, day }
  }

  // Get a date string (YYYY-MM-DD) in the configured timezone
  const getDateString = (date = new Date()) => {
    return date.toLocaleDateString('en-CA', { timeZone: settings.timezone || 'UTC' })
  }

  // Format a date-only string (YYYY-MM-DD) without timezone conversion
  // Used for dates like acquired_at where the user selected a specific date
  const formatDateOnly = (dateStr) => {
    if (!dateStr) return '--'
    try {
      // For date-only strings, parse them directly without timezone conversion
      // This ensures "2026-01-04" displays as "Jan 4" regardless of timezone
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        const [year, month, day] = dateStr.split('-').map(Number)
        const date = new Date(year, month - 1, day)
        return date.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        })
      }
      // Fall back to regular formatDate for datetime strings
      return formatDate(dateStr)
    } catch {
      return '--'
    }
  }

  // Calculate and format age from a date-only string (YYYY-MM-DD)
  const formatAge = (dateStr) => {
    if (!dateStr) return '--'
    try {
      const tz = settings.timezone || 'UTC'

      // Get today's date in the configured timezone
      const todayStr = getDateString()
      const [todayYear, todayMonth, todayDay] = todayStr.split('-').map(Number)

      // Parse the acquired date (date-only string)
      const [acqYear, acqMonth, acqDay] = dateStr.split('-').map(Number)

      // Calculate difference in days
      const today = new Date(todayYear, todayMonth - 1, todayDay)
      const acquired = new Date(acqYear, acqMonth - 1, acqDay)
      const diffMs = today - acquired
      const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))

      if (diffDays < 0) return 'Not yet acquired'
      if (diffDays === 0) return 'Added today'
      if (diffDays === 1) return '1 day old'
      if (diffDays < 14) return `${diffDays} days old`

      const diffWeeks = Math.floor(diffDays / 7)
      if (diffWeeks < 8) return `${diffWeeks} week${diffWeeks === 1 ? '' : 's'} old`

      const diffMonths = Math.floor(diffDays / 30.44) // Average days per month
      if (diffMonths < 12) return `${diffMonths} month${diffMonths === 1 ? '' : 's'} old`

      const diffYears = Math.floor(diffDays / 365.25)
      const remainingMonths = Math.floor((diffDays % 365.25) / 30.44)

      if (remainingMonths === 0) {
        return `${diffYears} year${diffYears === 1 ? '' : 's'} old`
      }
      return `${diffYears}y ${remainingMonths}m old`
    } catch {
      return '--'
    }
  }

  const value = {
    timezone: settings.timezone || 'UTC',
    loading,
    formatDate,
    formatDateOnly,
    formatDateTime,
    formatTime,
    formatRelativeDate,
    formatAge,
    getCurrentDateParts,
    getDateString,
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
