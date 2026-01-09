import { useState, useEffect } from 'react'
import { useSettings } from '../context/SettingsContext'

const colorOptions = [
  { value: 'orange', label: 'Orange', bg: 'bg-kurz-orange' },
  { value: 'pink', label: 'Pink', bg: 'bg-kurz-pink' },
  { value: 'purple', label: 'Purple', bg: 'bg-kurz-purple' },
  { value: 'cyan', label: 'Cyan', bg: 'bg-kurz-cyan' },
  { value: 'yellow', label: 'Yellow', bg: 'bg-kurz-yellow' },
  { value: 'green', label: 'Green', bg: 'bg-kurz-green' }
]

const iconOptions = [
  { value: 'thermostat', label: 'Temperature' },
  { value: 'opacity', label: 'pH/Water' },
  { value: 'waves', label: 'Waves' },
  { value: 'bolt', label: 'Electric' },
  { value: 'science', label: 'Science' },
  { value: 'sensors', label: 'Sensor' },
  { value: 'water_drop', label: 'Water Drop' },
  { value: 'swap_vert', label: 'Level' }
]

function Hardware() {
  const { formatTime } = useSettings()
  const [sensors, setSensors] = useState([])
  const [showAddForm, setShowAddForm] = useState(false)
  const [expandedSensor, setExpandedSensor] = useState(null)
  const [editingSensor, setEditingSensor] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [lastUpdate, setLastUpdate] = useState(null)
  const [copiedId, setCopiedId] = useState(null)
  const [newSensor, setNewSensor] = useState({
    name: '',
    type: '',
    unit: '',
    color: 'orange',
    icon: 'sensors',
    min_value: '',
    max_value: '',
    sensor_type: 'value',
    float_ok_value: 1
  })

  const fetchSensors = async () => {
    try {
      const res = await fetch('/api/sensors')
      if (res.ok) {
        const data = await res.json()
        setSensors(data)
        setLastUpdate(new Date())
      }
    } catch (err) {
      // Silently ignore fetch errors
    }
  }

  useEffect(() => {
    fetchSensors()
    // Live refresh every 5 seconds
    const interval = setInterval(fetchSensors, 5000)
    return () => clearInterval(interval)
  }, [])

  const handleAddSensor = async (e) => {
    e.preventDefault()
    try {
      const payload = {
        ...newSensor,
        min_value: newSensor.min_value !== '' ? parseFloat(newSensor.min_value) : null,
        max_value: newSensor.max_value !== '' ? parseFloat(newSensor.max_value) : null
      }
      const res = await fetch('/api/sensors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (res.ok) {
        setNewSensor({ name: '', type: '', unit: '', color: 'orange', icon: 'sensors', min_value: '', max_value: '', sensor_type: 'value', float_ok_value: 1 })
        setShowAddForm(false)
        fetchSensors()
      }
    } catch (err) {
      // Silently ignore add errors
    }
  }

  const handleDeleteSensor = async (id) => {
    if (!confirm('Delete this sensor and all its readings?')) return
    try {
      const res = await fetch(`/api/sensors/${id}`, { method: 'DELETE' })
      if (res.ok) {
        fetchSensors()
        setExpandedSensor(null)
      }
    } catch (err) {
      // Silently ignore delete errors
    }
  }

  const startEditing = (sensor) => {
    setEditingSensor(sensor.id)
    setEditForm({
      name: sensor.name,
      type: sensor.type,
      unit: sensor.unit || '',
      color: sensor.color,
      icon: sensor.icon,
      min_value: sensor.min_value !== null ? sensor.min_value : '',
      max_value: sensor.max_value !== null ? sensor.max_value : '',
      float_ok_value: sensor.float_ok_value ?? 1,
      alerts_enabled: sensor.alerts_enabled !== 0
    })
  }

  const handleUpdateSensor = async (id) => {
    try {
      const payload = {
        ...editForm,
        min_value: editForm.min_value !== '' ? parseFloat(editForm.min_value) : null,
        max_value: editForm.max_value !== '' ? parseFloat(editForm.max_value) : null
      }
      const res = await fetch(`/api/sensors/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (res.ok) {
        setEditingSensor(null)
        fetchSensors()
      }
    } catch (err) {
      // Silently ignore update errors
    }
  }

  const getApiUrl = (apiKey) => {
    const base = window.location.origin
    return `${base}/api/data/${apiKey}`
  }

  const copyToClipboard = async (text, sensorId) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text)
      } else {
        // Fallback for mobile devices
        const textArea = document.createElement('textarea')
        textArea.value = text
        textArea.style.position = 'fixed'
        textArea.style.left = '-9999px'
        textArea.style.top = '0'
        document.body.appendChild(textArea)
        textArea.focus()
        textArea.select()
        document.execCommand('copy')
        document.body.removeChild(textArea)
      }
      setCopiedId(sensorId)
      setTimeout(() => setCopiedId(null), 2000)
    } catch (err) {
      // Fallback for any errors
      const textArea = document.createElement('textarea')
      textArea.value = text
      textArea.style.position = 'fixed'
      textArea.style.left = '-9999px'
      textArea.style.top = '0'
      document.body.appendChild(textArea)
      textArea.focus()
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      setCopiedId(sensorId)
      setTimeout(() => setCopiedId(null), 2000)
    }
  }

  const getStatusColor = (sensor) => {
    const value = sensor.latest_value
    if (value === null || value === undefined) return 'text-slate-400'

    if (sensor.sensor_type === 'float') {
      const okValue = sensor.float_ok_value ?? 1
      return value === okValue ? 'text-kurz-green' : 'text-kurz-pink'
    }

    const { min_value, max_value } = sensor
    if (min_value === null && max_value === null) return 'text-kurz-cyan'
    if (min_value !== null && value < min_value) return 'text-kurz-pink'
    if (max_value !== null && value > max_value) return 'text-kurz-pink'
    return 'text-kurz-green'
  }

  const getStatusText = (sensor) => {
    const value = sensor.latest_value
    if (value === null || value === undefined) return 'No Data'

    if (sensor.sensor_type === 'float') {
      const okValue = sensor.float_ok_value ?? 1
      return value === okValue ? 'OK' : 'Alert'
    }

    const { min_value, max_value } = sensor
    if (min_value === null && max_value === null) return 'Active'
    if (min_value !== null && value < min_value) return 'Too Low'
    if (max_value !== null && value > max_value) return 'Too High'
    return 'Normal'
  }

  const getDisplayValue = (sensor) => {
    if (sensor.latest_value === null || sensor.latest_value === undefined) return '--'
    if (sensor.sensor_type === 'float') {
      const okValue = sensor.float_ok_value ?? 1
      return sensor.latest_value === okValue ? 'OK' : 'ALERT'
    }
    return sensor.latest_value.toFixed(1)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div>
          <h2 className="font-display font-black text-xl uppercase italic tracking-tighter text-kurz-dark">
            Sensor Setup
          </h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
            {sensors.length} Sensors Configured
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className={`w-10 h-10 kurz-border kurz-shadow-sm flex items-center justify-center ${
            showAddForm ? 'bg-kurz-pink' : 'bg-kurz-cyan'
          }`}
        >
          <span className="material-symbols-outlined text-kurz-dark">
            {showAddForm ? 'close' : 'add'}
          </span>
        </button>
      </div>

      {/* Live indicator */}
      <div className="flex items-center gap-2 mb-4">
        <span className="w-2 h-2 bg-kurz-green rounded-full animate-pulse"></span>
        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
          Live • {lastUpdate ? formatTime(lastUpdate.toISOString()) : '--'}
        </span>
      </div>

      {/* Add Sensor Form */}
      {showAddForm && (
        <form onSubmit={handleAddSensor} className="bg-white kurz-border kurz-card-shadow p-4 mb-4">
          <h3 className="font-display font-bold text-sm uppercase mb-4 text-kurz-dark">
            Add New Sensor
          </h3>

          <div className="space-y-3">
            {/* Sensor Type Toggle */}
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
                Sensor Type
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setNewSensor({ ...newSensor, sensor_type: 'value', icon: 'thermostat' })}
                  className={`flex-1 p-3 kurz-border font-bold uppercase text-[10px] ${
                    newSensor.sensor_type === 'value'
                      ? 'bg-kurz-blue text-white'
                      : 'bg-white text-kurz-dark'
                  }`}
                >
                  <span className="material-symbols-outlined block mx-auto mb-1">speed</span>
                  Value Sensor
                </button>
                <button
                  type="button"
                  onClick={() => setNewSensor({ ...newSensor, sensor_type: 'float', icon: 'swap_vert', unit: '' })}
                  className={`flex-1 p-3 kurz-border font-bold uppercase text-[10px] ${
                    newSensor.sensor_type === 'float'
                      ? 'bg-kurz-blue text-white'
                      : 'bg-white text-kurz-dark'
                  }`}
                >
                  <span className="material-symbols-outlined block mx-auto mb-1">swap_vert</span>
                  Float Switch
                </button>
              </div>
              <p className="text-[9px] text-slate-400 mt-1">
                {newSensor.sensor_type === 'value'
                  ? 'For temperature, pH, ORP, salinity, etc.'
                  : 'For water level detection (OK/Alert)'}
              </p>
            </div>

            {/* OK Value toggle - only for float sensors */}
            {newSensor.sensor_type === 'float' && (
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
                  OK When Reading Is
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setNewSensor({ ...newSensor, float_ok_value: 1 })}
                    className={`flex-1 p-3 kurz-border font-bold uppercase text-[10px] ${
                      newSensor.float_ok_value === 1
                        ? 'bg-kurz-green text-kurz-dark'
                        : 'bg-white text-kurz-dark'
                    }`}
                  >
                    1 (High/Closed)
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewSensor({ ...newSensor, float_ok_value: 0 })}
                    className={`flex-1 p-3 kurz-border font-bold uppercase text-[10px] ${
                      newSensor.float_ok_value === 0
                        ? 'bg-kurz-green text-kurz-dark'
                        : 'bg-white text-kurz-dark'
                    }`}
                  >
                    0 (Low/Open)
                  </button>
                </div>
                <p className="text-[9px] text-slate-400 mt-1">
                  Select which reading means the float switch is in OK state
                </p>
              </div>
            )}

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Sensor Name
              </label>
              <input
                type="text"
                value={newSensor.name}
                onChange={(e) => setNewSensor({ ...newSensor, name: e.target.value })}
                placeholder={newSensor.sensor_type === 'float' ? 'e.g., Sump Water Level' : 'e.g., Main Tank Temp'}
                className="w-full p-2 kurz-border text-sm"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Label
                </label>
                <input
                  type="text"
                  value={newSensor.type}
                  onChange={(e) => setNewSensor({ ...newSensor, type: e.target.value })}
                  placeholder={newSensor.sensor_type === 'float' ? 'e.g., Level' : 'e.g., Temp'}
                  className="w-full p-2 kurz-border text-sm"
                  required
                />
              </div>
              {newSensor.sensor_type === 'value' && (
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    Unit
                  </label>
                  <input
                    type="text"
                    value={newSensor.unit}
                    onChange={(e) => setNewSensor({ ...newSensor, unit: e.target.value })}
                    placeholder="e.g., °C"
                    className="w-full p-2 kurz-border text-sm"
                  />
                </div>
              )}
            </div>

            {/* Range inputs - only for value sensors */}
            {newSensor.sensor_type === 'value' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                      Min Value (Normal)
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={newSensor.min_value}
                      onChange={(e) => setNewSensor({ ...newSensor, min_value: e.target.value })}
                      placeholder="e.g., 24"
                      className="w-full p-2 kurz-border text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                      Max Value (Normal)
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={newSensor.max_value}
                      onChange={(e) => setNewSensor({ ...newSensor, max_value: e.target.value })}
                      placeholder="e.g., 27"
                      className="w-full p-2 kurz-border text-sm"
                    />
                  </div>
                </div>
                <p className="text-[9px] text-slate-400">
                  Values outside this range will show as "Too Low" or "Too High"
                </p>
              </>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Color
                </label>
                <div className="flex gap-2 flex-wrap">
                  {colorOptions.map(c => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setNewSensor({ ...newSensor, color: c.value })}
                      className={`w-8 h-8 ${c.bg} kurz-border ${
                        newSensor.color === c.value ? 'ring-2 ring-kurz-dark ring-offset-2' : ''
                      }`}
                    />
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Icon
                </label>
                <div className="flex gap-2 flex-wrap">
                  {iconOptions.map(i => (
                    <button
                      key={i.value}
                      type="button"
                      onClick={() => setNewSensor({ ...newSensor, icon: i.value })}
                      className={`w-8 h-8 bg-kurz-dark kurz-border flex items-center justify-center ${
                        newSensor.icon === i.value ? 'ring-2 ring-kurz-cyan ring-offset-2' : ''
                      }`}
                    >
                      <span className="material-symbols-outlined text-white text-sm">{i.value}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-kurz-green kurz-border kurz-shadow-sm p-3 font-bold uppercase text-sm text-kurz-dark"
            >
              Create Sensor
            </button>
          </div>
        </form>
      )}

      {/* Sensor List */}
      <div className="space-y-3">
        {sensors.length === 0 ? (
          <div className="bg-white kurz-border kurz-card-shadow p-8 text-center">
            <span className="material-symbols-outlined text-4xl text-slate-300 mb-2">sensors_off</span>
            <p className="text-sm text-slate-400">No sensors configured yet</p>
            <p className="text-[10px] text-slate-300 mt-1">Add a sensor to get started</p>
          </div>
        ) : (
          sensors.map(sensor => (
            <div key={sensor.id} className="bg-white kurz-border kurz-card-shadow relative">
              {/* Badges - fixed position */}
              <div className="absolute top-2 right-2 flex gap-1">
                {sensor.alerts_enabled === 0 && (
                  <span className="text-[8px] bg-slate-400 text-white px-1.5 py-0.5 uppercase font-bold flex items-center gap-0.5">
                    <span className="material-symbols-outlined text-[10px]">notifications_off</span>
                    Muted
                  </span>
                )}
                <span className="text-[8px] bg-kurz-dark text-white px-1.5 py-0.5 uppercase font-bold">
                  {sensor.sensor_type === 'float' ? 'Float' : 'Value'}
                </span>
              </div>
              <div
                className="p-4 cursor-pointer"
                onClick={() => setExpandedSensor(expandedSensor === sensor.id ? null : sensor.id)}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 bg-kurz-${sensor.color} kurz-border flex items-center justify-center`}>
                    <span className="material-symbols-outlined text-white text-lg">{sensor.icon}</span>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-display font-bold text-sm text-kurz-dark">
                      {sensor.name}
                    </h3>
                    <p className="text-[10px] text-slate-400">
                      {sensor.type}
                      {sensor.unit && ` (${sensor.unit})`}
                      {sensor.sensor_type === 'value' && (sensor.min_value !== null || sensor.max_value !== null) && (
                        <span className="ml-2 text-kurz-blue">
                          Range: {sensor.min_value ?? '−∞'} - {sensor.max_value ?? '+∞'}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="font-display font-black text-xl text-kurz-dark">
                      {getDisplayValue(sensor)}
                    </div>
                    <p className={`text-[8px] font-bold uppercase tracking-widest ${getStatusColor(sensor)}`}>
                      {getStatusText(sensor)}
                    </p>
                  </div>
                  <span className="material-symbols-outlined text-slate-400">
                    {expandedSensor === sensor.id ? 'expand_less' : 'expand_more'}
                  </span>
                </div>
              </div>

              {/* Expanded Details */}
              {expandedSensor === sensor.id && (
                <div className="border-t-2 border-slate-100 p-4">
                  {/* Edit Mode */}
                  {editingSensor === sensor.id ? (
                    <div className="space-y-3">
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                          Sensor Name
                        </label>
                        <input
                          type="text"
                          value={editForm.name}
                          onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                          className="w-full p-2 kurz-border text-sm"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                            Label
                          </label>
                          <input
                            type="text"
                            value={editForm.type}
                            onChange={(e) => setEditForm({ ...editForm, type: e.target.value })}
                            className="w-full p-2 kurz-border text-sm"
                          />
                        </div>
                        {sensor.sensor_type === 'value' && (
                          <div>
                            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                              Unit
                            </label>
                            <input
                              type="text"
                              value={editForm.unit}
                              onChange={(e) => setEditForm({ ...editForm, unit: e.target.value })}
                              className="w-full p-2 kurz-border text-sm"
                            />
                          </div>
                        )}
                      </div>

                      {/* Range inputs - only for value sensors */}
                      {sensor.sensor_type === 'value' && (
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                              Min Value (Normal)
                            </label>
                            <input
                              type="number"
                              step="any"
                              value={editForm.min_value}
                              onChange={(e) => setEditForm({ ...editForm, min_value: e.target.value })}
                              className="w-full p-2 kurz-border text-sm"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                              Max Value (Normal)
                            </label>
                            <input
                              type="number"
                              step="any"
                              value={editForm.max_value}
                              onChange={(e) => setEditForm({ ...editForm, max_value: e.target.value })}
                              className="w-full p-2 kurz-border text-sm"
                            />
                          </div>
                        </div>
                      )}

                      {/* Float OK value - only for float sensors */}
                      {sensor.sensor_type === 'float' && (
                        <div>
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
                            OK When Reading Is
                          </label>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => setEditForm({ ...editForm, float_ok_value: 1 })}
                              className={`flex-1 p-2 kurz-border font-bold uppercase text-[10px] ${
                                editForm.float_ok_value === 1
                                  ? 'bg-kurz-green text-kurz-dark'
                                  : 'bg-white text-kurz-dark'
                              }`}
                            >
                              1 (High/Closed)
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditForm({ ...editForm, float_ok_value: 0 })}
                              className={`flex-1 p-2 kurz-border font-bold uppercase text-[10px] ${
                                editForm.float_ok_value === 0
                                  ? 'bg-kurz-green text-kurz-dark'
                                  : 'bg-white text-kurz-dark'
                              }`}
                            >
                              0 (Low/Open)
                            </button>
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                            Color
                          </label>
                          <div className="flex gap-2 flex-wrap">
                            {colorOptions.map(c => (
                              <button
                                key={c.value}
                                type="button"
                                onClick={() => setEditForm({ ...editForm, color: c.value })}
                                className={`w-8 h-8 ${c.bg} kurz-border ${
                                  editForm.color === c.value ? 'ring-2 ring-kurz-dark ring-offset-2' : ''
                                }`}
                              />
                            ))}
                          </div>
                        </div>
                        <div>
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                            Icon
                          </label>
                          <div className="flex gap-2 flex-wrap">
                            {iconOptions.map(i => (
                              <button
                                key={i.value}
                                type="button"
                                onClick={() => setEditForm({ ...editForm, icon: i.value })}
                                className={`w-8 h-8 bg-kurz-dark kurz-border flex items-center justify-center ${
                                  editForm.icon === i.value ? 'ring-2 ring-kurz-cyan ring-offset-2' : ''
                                }`}
                              >
                                <span className="material-symbols-outlined text-white text-sm">{i.value}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Alerts Toggle */}
                      <label className="flex items-center gap-3 cursor-pointer pt-2">
                        <input
                          type="checkbox"
                          checked={editForm.alerts_enabled}
                          onChange={(e) => setEditForm({ ...editForm, alerts_enabled: e.target.checked })}
                          className="w-5 h-5 kurz-border rounded-none accent-kurz-blue"
                        />
                        <div>
                          <span className="text-sm font-bold text-kurz-dark">Enable Alerts</span>
                          <p className="text-[9px] text-slate-400">Send notifications when out of range</p>
                        </div>
                      </label>

                      <div className="flex gap-2 pt-2">
                        <button
                          onClick={() => handleUpdateSensor(sensor.id)}
                          className="flex-1 bg-kurz-green kurz-border kurz-shadow-sm p-2 font-bold uppercase text-[10px] text-kurz-dark flex items-center justify-center gap-2"
                        >
                          <span className="material-symbols-outlined text-sm">save</span>
                          Save Changes
                        </button>
                        <button
                          onClick={() => setEditingSensor(null)}
                          className="flex-1 bg-slate-200 kurz-border p-2 font-bold uppercase text-[10px] text-kurz-dark flex items-center justify-center gap-2"
                        >
                          <span className="material-symbols-outlined text-sm">close</span>
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* View Mode */}
                      {/* Range display - only for value sensors */}
                      {sensor.sensor_type === 'value' && (
                        <div className="mb-4 p-3 bg-slate-50 kurz-border">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
                            Normal Range
                          </label>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-kurz-dark">
                              {sensor.min_value !== null ? sensor.min_value : '−∞'}
                            </span>
                            <span className="text-slate-400">to</span>
                            <span className="text-sm font-bold text-kurz-dark">
                              {sensor.max_value !== null ? sensor.max_value : '+∞'}
                            </span>
                            <span className="text-sm text-slate-400">{sensor.unit}</span>
                          </div>
                        </div>
                      )}

                      {/* Float switch info */}
                      {sensor.sensor_type === 'float' && (
                        <div className="mb-4 p-3 bg-slate-50 kurz-border">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
                            Float Switch Configuration
                          </label>
                          <p className="text-[11px] text-kurz-dark">
                            OK when reading is <code className="bg-kurz-green text-kurz-dark px-1 py-0.5 font-bold text-[10px]">{sensor.float_ok_value ?? 1}</code>
                            <span className="text-slate-400 mx-1">•</span>
                            Alert when reading is <code className="bg-kurz-pink text-white px-1 py-0.5 font-bold text-[10px]">{sensor.float_ok_value === 0 ? 1 : 0}</code>
                          </p>
                        </div>
                      )}

                      <div className="mb-4">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
                          API Endpoint
                        </label>
                        <div className="flex gap-2">
                          <code className="flex-1 bg-kurz-dark text-kurz-cyan p-2 text-[10px] overflow-x-auto whitespace-nowrap">
                            {getApiUrl(sensor.api_key)}/{sensor.sensor_type === 'float' ? '0 or 1' : 'VALUE'}
                          </code>
                          <button
                            onClick={() => copyToClipboard(`${getApiUrl(sensor.api_key)}/`, sensor.id)}
                            className={`${copiedId === sensor.id ? 'bg-kurz-green' : 'bg-kurz-blue'} kurz-border px-3 flex items-center justify-center gap-1 transition-colors`}
                          >
                            <span className="material-symbols-outlined text-white text-sm">
                              {copiedId === sensor.id ? 'check' : 'content_copy'}
                            </span>
                            {copiedId === sensor.id && (
                              <span className="text-white text-[10px] font-bold">Copied!</span>
                            )}
                          </button>
                        </div>
                      </div>

                      <div className="mb-4">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
                          Example (Arduino/ESP)
                        </label>
                        <code className="block bg-slate-100 text-kurz-dark p-2 text-[9px] overflow-x-auto whitespace-pre">
{sensor.sensor_type === 'float'
  ? `// Float switch on pin 2
// OK=${sensor.float_ok_value ?? 1}, Alert=${sensor.float_ok_value === 0 ? 1 : 0}
int floatState = digitalRead(2);
http.begin("${getApiUrl(sensor.api_key)}/" + String(floatState));
http.GET();`
  : `http.begin("${getApiUrl(sensor.api_key)}/" + String(sensorValue));
http.GET();`}
                        </code>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => startEditing(sensor)}
                          className="flex-1 bg-kurz-blue kurz-border kurz-shadow-sm p-2 font-bold uppercase text-[10px] text-white flex items-center justify-center gap-2"
                        >
                          <span className="material-symbols-outlined text-sm">edit</span>
                          Edit Sensor
                        </button>
                        <button
                          onClick={() => handleDeleteSensor(sensor.id)}
                          className="flex-1 bg-kurz-pink kurz-border kurz-shadow-sm p-2 font-bold uppercase text-[10px] text-white flex items-center justify-center gap-2"
                        >
                          <span className="material-symbols-outlined text-sm">delete</span>
                          Delete
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default Hardware
