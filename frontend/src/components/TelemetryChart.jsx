import { useState, useEffect } from 'react'
import { useSettings } from '../context/SettingsContext'

function TelemetryChart({ parameters }) {
  const { timezone, getCurrentDateParts } = useSettings()
  const [activeTab, setActiveTab] = useState(null)
  const [readings, setReadings] = useState([])
  const [dailySummary, setDailySummary] = useState([])
  const [sensor, setSensor] = useState(null)

  // Set first parameter as default tab
  useEffect(() => {
    if (parameters?.length > 0 && !activeTab) {
      setActiveTab(parameters[0].label)
    }
  }, [parameters, activeTab])

  // Fetch telemetry data when tab changes
  useEffect(() => {
    if (!activeTab) return

    const fetchTelemetry = async () => {
      try {
        const res = await fetch(`/api/telemetry/${activeTab}`)
        if (res.ok) {
          const data = await res.json()
          setReadings(data.readings || [])
          setDailySummary(data.dailySummary || [])
          setSensor(data.sensor)
        }
      } catch (err) {
        // Silently ignore fetch errors
      }
    }

    fetchTelemetry()
  }, [activeTab])

  if (!parameters || parameters.length === 0) return null

  const tabs = parameters.map(p => p.label)
  const currentParam = parameters.find(p => p.label === activeTab)
  const isFloatSensor = sensor?.sensor_type === 'float'

  // Generate path from readings
  const generatePath = () => {
    if (readings.length < 2) return ''

    const values = readings.map(r => r.value)
    const min = Math.min(...values)
    const max = Math.max(...values)
    const range = max - min || 1

    const points = readings.map((r, i) => {
      const x = (i / (readings.length - 1)) * 300
      const y = 100 - ((r.value - min) / range) * 80 + 10
      return `${x},${y}`
    })

    return `M ${points.join(' L ')}`
  }

  const getMaxReading = () => {
    if (readings.length === 0) return null
    return readings.reduce((max, r) => r.value > max.value ? r : max, readings[0])
  }

  // Generate calendar data for the current month
  const generateCalendar = () => {
    // Use timezone-aware current date
    const { year, month, day: todayDay } = getCurrentDateParts()

    // First day of month and total days
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startDayOfWeek = firstDay.getDay() // 0 = Sunday

    // Create lookup for daily summary - normalize date format
    const summaryLookup = {}
    dailySummary.forEach(day => {
      // Normalize the date to YYYY-MM-DD format
      const normalizedDate = day.date.split('T')[0].split(' ')[0]
      summaryLookup[normalizedDate] = day
    })

    // Build calendar grid
    const calendar = []
    let week = []

    // Empty slots for days before month starts
    for (let i = 0; i < startDayOfWeek; i++) {
      week.push({ empty: true })
    }

    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      const summary = summaryLookup[dateStr]
      const isToday = day === todayDay
      const isFuture = day > todayDay

      week.push({
        day,
        dateStr,
        hasData: summary?.hasData || false,
        hasAlert: summary?.hasAlert || false,
        isToday,
        isFuture,
        count: summary?.count || 0
      })

      if (week.length === 7) {
        calendar.push(week)
        week = []
      }
    }

    // Fill remaining slots
    if (week.length > 0) {
      while (week.length < 7) {
        week.push({ empty: true })
      }
      calendar.push(week)
    }

    return calendar
  }

  const calendar = generateCalendar()
  const maxReading = getMaxReading()
  const { year, month } = getCurrentDateParts()
  const monthName = new Date(year, month, 1).toLocaleString('default', { month: 'long', year: 'numeric', timeZone: timezone })
  const currentMonthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`

  // Count alert days for current month only
  const currentMonthData = dailySummary.filter(d => d.date.startsWith(currentMonthPrefix))
  const alertDays = currentMonthData.filter(d => d.hasAlert).length
  const totalDays = currentMonthData.length

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-display font-black text-xl uppercase italic tracking-tighter text-kurz-dark">
            Telemetry History
          </h3>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
            Past Month • {totalDays} Days Recorded
          </p>
        </div>
      </div>

      <div className="flex gap-2 mb-4 overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-[10px] font-black uppercase tracking-wider transition-colors flex-shrink-0 ${
              activeTab === tab
                ? 'bg-kurz-dark text-white kurz-border'
                : 'bg-transparent text-kurz-dark border-2 border-slate-200'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Chart - only for value sensors (hide until sensor data is loaded) */}
      {sensor && !isFloatSensor && (
        <div className="bg-white kurz-border kurz-card-shadow p-4 mb-4">
          <div className="h-32 w-full relative">
            {readings.length < 2 ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-sm text-slate-400">Not enough data yet</p>
              </div>
            ) : (
              <>
                <svg className="w-full h-full" viewBox="0 0 300 120" preserveAspectRatio="none">
                  {/* Grid lines */}
                  <line x1="0" y1="30" x2="300" y2="30" stroke="#f0f2f5" strokeWidth="2" />
                  <line x1="0" y1="60" x2="300" y2="60" stroke="#f0f2f5" strokeWidth="2" />
                  <line x1="0" y1="90" x2="300" y2="90" stroke="#f0f2f5" strokeWidth="2" />

                  {/* Data line */}
                  <path
                    d={generatePath()}
                    fill="none"
                    stroke="#2d34a4"
                    strokeWidth="4"
                    strokeLinejoin="round"
                  />
                </svg>

                {/* Peak info box */}
                {maxReading && (
                  <div className="absolute top-2 right-2 bg-kurz-dark text-white p-2 kurz-border">
                    <p className="text-[8px] font-black uppercase tracking-widest text-kurz-cyan mb-1">Peak</p>
                    <p className="text-lg font-black">
                      {maxReading.value.toFixed(1)}{currentParam?.unit}
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Calendar */}
      <div className="bg-white kurz-border kurz-card-shadow p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-black text-sm uppercase tracking-tight text-kurz-dark">
            {monthName}
          </h4>
          {alertDays > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 bg-kurz-pink rounded-full"></span>
              <span className="text-[9px] font-bold text-kurz-pink uppercase">
                {alertDays} Alert Day{alertDays !== 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
            <div key={i} className="text-center text-[8px] font-bold text-slate-400 uppercase">
              {d}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid gap-1">
          {calendar.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7 gap-1">
              {week.map((day, di) => {
                if (day.empty) {
                  return <div key={di} className="aspect-square"></div>
                }

                let bgColor = 'bg-slate-200' // No data - grey
                let textColor = 'text-slate-400'

                // Check data status first (if we have data, show it regardless of "future" status)
                if (day.hasData) {
                  if (day.hasAlert) {
                    bgColor = 'bg-kurz-pink'
                    textColor = 'text-white'
                  } else {
                    bgColor = 'bg-kurz-green'
                    textColor = 'text-white'
                  }
                } else if (day.isFuture) {
                  bgColor = 'bg-slate-100'
                  textColor = 'text-slate-300'
                }

                return (
                  <div
                    key={di}
                    className={`aspect-square flex items-center justify-center text-[10px] font-bold ${bgColor} ${textColor} ${
                      day.isToday ? 'ring-2 ring-kurz-dark ring-offset-1' : ''
                    }`}
                    title={day.hasData ? `${day.count} readings` : 'No data'}
                  >
                    {day.day}
                  </div>
                )
              })}
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="flex gap-4 mt-3 pt-3 border-t border-slate-200">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 bg-kurz-green"></div>
            <span className="text-[8px] font-bold text-slate-500 uppercase">Normal</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 bg-kurz-pink"></div>
            <span className="text-[8px] font-bold text-slate-500 uppercase">Alert</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 bg-slate-200"></div>
            <span className="text-[8px] font-bold text-slate-500 uppercase">No Data</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default TelemetryChart
