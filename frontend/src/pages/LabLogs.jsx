import { useState, useEffect } from 'react'
import { useSettings } from '../context/SettingsContext'

const intervalOptions = [
  { value: 3, label: '3 Days' },
  { value: 5, label: '5 Days' },
  { value: 7, label: '7 Days' },
  { value: 10, label: '10 Days' },
  { value: 14, label: '14 Days' },
  { value: 21, label: '21 Days' },
  { value: 30, label: '30 Days' },
  { value: 60, label: '60 Days' },
  { value: 90, label: '90 Days' }
]

const testingIntervalOptions = [
  { value: 0, label: 'No Reminder' },
  { value: 1, label: 'Daily' },
  { value: 3, label: '3 Days' },
  { value: 7, label: 'Weekly' },
  { value: 14, label: '2 Weeks' },
  { value: 30, label: 'Monthly' }
]

const percentageOptions = [5, 10, 15, 20, 25, 30, 40, 50]

const iconOptions = [
  { value: 'water_drop', label: 'Water' },
  { value: 'filter_alt', label: 'Filter' },
  { value: 'cleaning_services', label: 'Clean' },
  { value: 'build', label: 'Build' },
  { value: 'science', label: 'Science' },
  { value: 'vaccines', label: 'Medicine' },
  { value: 'grass', label: 'Plants' },
  { value: 'lightbulb', label: 'Light' }
]

function Maintenance() {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [expandedTask, setExpandedTask] = useState(null)
  const [editingTask, setEditingTask] = useState(null)
  const [completions, setCompletions] = useState({})
  const [showHistory, setShowHistory] = useState({})
  const [selectedPercentage, setSelectedPercentage] = useState({})
  const { formatDateTime, formatRelativeDate, formatDate, getCurrentDateParts, timezone } = useSettings()

  // Water Parameters state
  const [waterParams, setWaterParams] = useState([])
  const [showAddParam, setShowAddParam] = useState(false)
  const [expandedParam, setExpandedParam] = useState(null)
  const [showParamHistory, setShowParamHistory] = useState({})
  const [newParam, setNewParam] = useState({ name: '', unit: '', color: 'cyan', interval_days: 0, target_value: '' })
  const [paramInputs, setParamInputs] = useState({})
  const [editingReading, setEditingReading] = useState(null) // { paramId, readingId, value }
  const [editingParam, setEditingParam] = useState(null)
  const [paramEditForm, setParamEditForm] = useState({})

  const colorOptions = [
    { value: 'cyan', label: 'Cyan', bg: 'bg-kurz-cyan' },
    { value: 'purple', label: 'Purple', bg: 'bg-kurz-purple' },
    { value: 'orange', label: 'Orange', bg: 'bg-kurz-orange' },
    { value: 'pink', label: 'Pink', bg: 'bg-kurz-pink' },
    { value: 'green', label: 'Green', bg: 'bg-kurz-green' },
    { value: 'yellow', label: 'Yellow', bg: 'bg-kurz-yellow' }
  ]

  const [newTask, setNewTask] = useState({
    name: '',
    icon: 'build',
    interval_days: 7,
    show_percentage: false
  })

  const [editForm, setEditForm] = useState({})

  const fetchTasks = async () => {
    try {
      const res = await fetch('/api/maintenance/tasks')
      if (res.ok) {
        const data = await res.json()
        setTasks(data)
      }
    } catch (err) {
      // Silently ignore fetch errors
    } finally {
      setLoading(false)
    }
  }

  const fetchCompletions = async (taskId) => {
    try {
      const res = await fetch(`/api/maintenance/tasks/${taskId}/completions`)
      if (res.ok) {
        const data = await res.json()
        setCompletions(prev => ({ ...prev, [taskId]: data }))
      }
    } catch (err) {
      // Silently ignore fetch errors
    }
  }

  const fetchWaterParams = async () => {
    try {
      const res = await fetch('/api/water-parameters')
      if (res.ok) {
        const data = await res.json()
        setWaterParams(data)
        // Initialize input values with today's readings
        const inputs = {}
        data.forEach(p => {
          inputs[p.id] = p.todayValue !== null ? p.todayValue.toString() : ''
        })
        setParamInputs(inputs)
      }
    } catch (err) {
      // Silently ignore fetch errors
    }
  }

  useEffect(() => {
    fetchTasks()
    fetchWaterParams()
  }, [])

  useEffect(() => {
    if (expandedTask) {
      fetchCompletions(expandedTask)
    }
  }, [expandedTask])

  const handleAddTask = async (e) => {
    e.preventDefault()
    try {
      const res = await fetch('/api/maintenance/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTask)
      })
      if (res.ok) {
        setNewTask({ name: '', icon: 'build', interval_days: 7, show_percentage: false })
        setShowAddForm(false)
        fetchTasks()
      }
    } catch (err) {
      // Silently ignore add errors
    }
  }

  const handleUpdateTask = async (taskId) => {
    try {
      const res = await fetch(`/api/maintenance/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm)
      })
      if (res.ok) {
        setEditingTask(null)
        fetchTasks()
      }
    } catch (err) {
      // Silently ignore update errors
    }
  }

  const handleDeleteTask = async (taskId) => {
    if (!confirm('Delete this task and all its history?')) return
    try {
      const res = await fetch(`/api/maintenance/tasks/${taskId}`, { method: 'DELETE' })
      if (res.ok) {
        setExpandedTask(null)
        fetchTasks()
      }
    } catch (err) {
      // Silently ignore delete errors
    }
  }

  const handleLogCompletion = async (taskId, showPercentage) => {
    try {
      const res = await fetch(`/api/maintenance/tasks/${taskId}/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          percentage: showPercentage ? (selectedPercentage[taskId] || 10) : null
        })
      })
      if (res.ok) {
        fetchTasks()
        fetchCompletions(taskId)
        setSelectedPercentage(prev => ({ ...prev, [taskId]: 10 }))
      }
    } catch (err) {
      // Silently ignore completion errors
    }
  }

  const handleDeleteCompletion = async (taskId, completionId) => {
    if (!confirm('Delete this completion record?')) return
    try {
      const res = await fetch(`/api/maintenance/tasks/${taskId}/completions/${completionId}`, {
        method: 'DELETE'
      })
      if (res.ok) {
        fetchTasks()
        fetchCompletions(taskId)
      }
    } catch (err) {
      // Silently ignore
    }
  }

  const startEditing = (task) => {
    setEditingTask(task.id)
    setEditForm({
      name: task.name,
      icon: task.icon,
      interval_days: task.interval_days,
      show_percentage: task.show_percentage === 1
    })
  }

  // Water Parameter Handlers
  const handleAddParam = async (e) => {
    e.preventDefault()
    try {
      const res = await fetch('/api/water-parameters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newParam)
      })
      if (res.ok) {
        setNewParam({ name: '', unit: '', color: 'cyan', interval_days: 0, target_value: '' })
        setShowAddParam(false)
        fetchWaterParams()
      }
    } catch (err) {
      // Silently ignore
    }
  }

  const handleDeleteParam = async (paramId) => {
    if (!confirm('Delete this parameter and all its readings?')) return
    try {
      const res = await fetch(`/api/water-parameters/${paramId}`, { method: 'DELETE' })
      if (res.ok) {
        setExpandedParam(null)
        fetchWaterParams()
      }
    } catch (err) {
      // Silently ignore
    }
  }

  const handleSaveReading = async (paramId) => {
    const value = paramInputs[paramId]
    if (!value || isNaN(parseFloat(value))) return

    try {
      const res = await fetch(`/api/water-parameters/${paramId}/readings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: parseFloat(value) })
      })
      if (res.ok) {
        fetchWaterParams()
      }
    } catch (err) {
      // Silently ignore
    }
  }

  const handleUpdateReading = async () => {
    if (!editingReading || isNaN(parseFloat(editingReading.value))) return

    try {
      const res = await fetch(`/api/water-parameters/${editingReading.paramId}/readings/${editingReading.readingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: parseFloat(editingReading.value) })
      })
      if (res.ok) {
        setEditingReading(null)
        fetchWaterParams()
      }
    } catch (err) {
      // Silently ignore
    }
  }

  const startEditingParam = (param) => {
    setEditingParam(param.id)
    setParamEditForm({
      name: param.name,
      unit: param.unit,
      color: param.color,
      interval_days: param.interval_days || 0,
      target_value: param.target_value || ''
    })
  }

  const handleUpdateParam = async (paramId) => {
    try {
      const res = await fetch(`/api/water-parameters/${paramId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(paramEditForm)
      })
      if (res.ok) {
        setEditingParam(null)
        fetchWaterParams()
      }
    } catch (err) {
      // Silently ignore
    }
  }

  // Generate calendar data for water parameters
  const generateParamCalendar = (readings) => {
    const { year, month } = getCurrentDateParts()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const startPadding = firstDay.getDay()
    const daysInMonth = lastDay.getDate()

    // Create a map of date -> value
    const readingMap = {}
    readings.forEach(r => {
      readingMap[r.reading_date] = r.value
    })

    const weeks = []
    let currentWeek = []

    // Add padding for days before the first of the month
    for (let i = 0; i < startPadding; i++) {
      currentWeek.push(null)
    }

    // Add each day of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      currentWeek.push({
        day,
        dateStr,
        value: readingMap[dateStr] || null
      })

      if (currentWeek.length === 7) {
        weeks.push(currentWeek)
        currentWeek = []
      }
    }

    // Add remaining days to last week
    if (currentWeek.length > 0) {
      while (currentWeek.length < 7) {
        currentWeek.push(null)
      }
      weeks.push(currentWeek)
    }

    return { weeks, year, month }
  }

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December']

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
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-display font-black text-xl uppercase italic tracking-tighter text-kurz-dark">
            Maintenance
          </h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
            {tasks.length} Task{tasks.length !== 1 ? 's' : ''} Configured
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

      {/* Add Task Form */}
      {showAddForm && (
        <form onSubmit={handleAddTask} className="bg-white kurz-border kurz-card-shadow p-4 mb-4">
          <h3 className="font-display font-bold text-sm uppercase mb-4 text-kurz-dark">
            Add Maintenance Task
          </h3>

          <div className="space-y-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Task Name
              </label>
              <input
                type="text"
                value={newTask.name}
                onChange={(e) => setNewTask({ ...newTask, name: e.target.value })}
                placeholder="e.g., Water Change, Filter Media, etc."
                className="w-full p-2 kurz-border text-sm"
                required
              />
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
                Icon
              </label>
              <div className="flex gap-2 flex-wrap">
                {iconOptions.map(i => (
                  <button
                    key={i.value}
                    type="button"
                    onClick={() => setNewTask({ ...newTask, icon: i.value })}
                    className={`w-10 h-10 bg-kurz-dark kurz-border flex items-center justify-center ${
                      newTask.icon === i.value ? 'ring-2 ring-kurz-cyan ring-offset-2' : ''
                    }`}
                  >
                    <span className="material-symbols-outlined text-white">{i.value}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
                Interval
              </label>
              <div className="flex gap-2 flex-wrap">
                {intervalOptions.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setNewTask({ ...newTask, interval_days: opt.value })}
                    className={`px-3 py-2 kurz-border text-[10px] font-bold uppercase ${
                      newTask.interval_days === opt.value
                        ? 'bg-kurz-blue text-white'
                        : 'bg-white text-slate-500'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="show_percentage"
                checked={newTask.show_percentage}
                onChange={(e) => setNewTask({ ...newTask, show_percentage: e.target.checked })}
                className="w-4 h-4"
              />
              <label htmlFor="show_percentage" className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Track Percentage (e.g., for water changes)
              </label>
            </div>

            <button
              type="submit"
              className="w-full bg-kurz-green kurz-border kurz-shadow-sm p-3 font-bold uppercase text-sm text-kurz-dark"
            >
              Create Task
            </button>
          </div>
        </form>
      )}

      {/* Task List */}
      {tasks.length === 0 ? (
        <div className="bg-white kurz-border kurz-card-shadow p-8 text-center">
          <span className="material-symbols-outlined text-4xl text-slate-300 mb-2">checklist</span>
          <p className="text-sm text-slate-400">No maintenance tasks yet</p>
          <p className="text-[10px] text-slate-300 mt-1">Add a task like "Water Change" to get started</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map(task => {
            const taskCompletions = completions[task.id] || []
            const isShowingHistory = showHistory[task.id]

            return (
              <div key={task.id} className="bg-white kurz-border kurz-card-shadow">
                <div
                  className="p-4 cursor-pointer"
                  onClick={() => setExpandedTask(expandedTask === task.id ? null : task.id)}
                >
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 kurz-border flex items-center justify-center flex-shrink-0 ${
                      task.isDue ? 'bg-kurz-pink' : 'bg-kurz-cyan'
                    }`}>
                      <span className="material-symbols-outlined text-white text-xl">{task.icon}</span>
                    </div>

                    <div className="flex-1">
                      <h3 className="font-display font-bold text-sm text-kurz-dark">
                        {task.name}
                      </h3>

                      {task.isDue ? (
                        <div className="flex items-center gap-2 mt-1">
                          <span className="w-2 h-2 bg-kurz-pink rounded-full animate-pulse"></span>
                          <span className="text-[10px] font-bold uppercase text-kurz-pink">Due Now</span>
                        </div>
                      ) : (
                        <p className="text-[10px] text-slate-400 mt-1">
                          Next in <span className="font-bold text-kurz-dark">{task.daysUntilDue} days</span>
                        </p>
                      )}

                      <p className="text-[9px] text-slate-400 mt-1">
                        Last: {formatRelativeDate(task.lastCompletion?.completed_at)}
                        {task.lastCompletion?.percentage && ` (${task.lastCompletion.percentage}%)`}
                      </p>
                    </div>

                    <span className="material-symbols-outlined text-slate-400">
                      {expandedTask === task.id ? 'expand_less' : 'expand_more'}
                    </span>
                  </div>
                </div>

                {/* Expanded Task Details */}
                {expandedTask === task.id && (
                  <div className="border-t-2 border-slate-100 p-4">
                    {editingTask === task.id ? (
                      /* Edit Mode */
                      <div className="space-y-3">
                        <div>
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                            Task Name
                          </label>
                          <input
                            type="text"
                            value={editForm.name}
                            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                            className="w-full p-2 kurz-border text-sm"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
                            Icon
                          </label>
                          <div className="flex gap-2 flex-wrap">
                            {iconOptions.map(i => (
                              <button
                                key={i.value}
                                type="button"
                                onClick={() => setEditForm({ ...editForm, icon: i.value })}
                                className={`w-10 h-10 bg-kurz-dark kurz-border flex items-center justify-center ${
                                  editForm.icon === i.value ? 'ring-2 ring-kurz-cyan ring-offset-2' : ''
                                }`}
                              >
                                <span className="material-symbols-outlined text-white">{i.value}</span>
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
                            Interval
                          </label>
                          <div className="flex gap-2 flex-wrap">
                            {intervalOptions.map(opt => (
                              <button
                                key={opt.value}
                                type="button"
                                onClick={() => setEditForm({ ...editForm, interval_days: opt.value })}
                                className={`px-3 py-2 kurz-border text-[10px] font-bold uppercase ${
                                  editForm.interval_days === opt.value
                                    ? 'bg-kurz-blue text-white'
                                    : 'bg-white text-slate-500'
                                }`}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            id={`edit_percentage_${task.id}`}
                            checked={editForm.show_percentage}
                            onChange={(e) => setEditForm({ ...editForm, show_percentage: e.target.checked })}
                            className="w-4 h-4"
                          />
                          <label htmlFor={`edit_percentage_${task.id}`} className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                            Track Percentage
                          </label>
                        </div>

                        <div className="flex gap-2 pt-2">
                          <button
                            onClick={() => handleUpdateTask(task.id)}
                            className="flex-1 bg-kurz-green kurz-border kurz-shadow-sm p-2 font-bold uppercase text-[10px] text-kurz-dark flex items-center justify-center gap-2"
                          >
                            <span className="material-symbols-outlined text-sm">save</span>
                            Save
                          </button>
                          <button
                            onClick={() => setEditingTask(null)}
                            className="flex-1 bg-slate-200 kurz-border p-2 font-bold uppercase text-[10px] text-kurz-dark flex items-center justify-center gap-2"
                          >
                            <span className="material-symbols-outlined text-sm">close</span>
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* View Mode */
                      <>
                        {/* Log Completion */}
                        <div className="mb-4">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
                            Mark Complete
                          </label>

                          {task.show_percentage === 1 && (
                            <div className="flex gap-2 flex-wrap mb-3">
                              {percentageOptions.map(pct => (
                                <button
                                  key={pct}
                                  onClick={() => setSelectedPercentage(prev => ({ ...prev, [task.id]: pct }))}
                                  className={`px-3 py-2 kurz-border text-[10px] font-bold ${
                                    (selectedPercentage[task.id] || 10) === pct
                                      ? 'bg-kurz-blue text-white'
                                      : 'bg-white text-slate-500'
                                  }`}
                                >
                                  {pct}%
                                </button>
                              ))}
                            </div>
                          )}

                          <button
                            onClick={() => handleLogCompletion(task.id, task.show_percentage === 1)}
                            className="w-full bg-kurz-green kurz-border kurz-shadow-sm p-3 font-bold uppercase text-sm text-kurz-dark flex items-center justify-center gap-2"
                          >
                            <span className="material-symbols-outlined">check_circle</span>
                            {task.show_percentage === 1
                              ? `Mark ${selectedPercentage[task.id] || 10}% Complete`
                              : 'Mark Complete'}
                          </button>
                        </div>

                        {/* History */}
                        <div className="mb-4">
                          <button
                            onClick={() => setShowHistory(prev => ({ ...prev, [task.id]: !isShowingHistory }))}
                            className="flex items-center gap-2 text-[10px] font-bold uppercase text-slate-500"
                          >
                            <span className="material-symbols-outlined text-sm">history</span>
                            History ({taskCompletions.length})
                            <span className="material-symbols-outlined text-sm">
                              {isShowingHistory ? 'expand_less' : 'expand_more'}
                            </span>
                          </button>

                          {isShowingHistory && (
                            <div className="mt-2 space-y-2 max-h-48 overflow-y-auto">
                              {taskCompletions.length === 0 ? (
                                <p className="text-[10px] text-slate-400 italic">No completions logged yet</p>
                              ) : (
                                taskCompletions.map((comp, i) => (
                                  <div key={comp.id} className="flex items-center gap-3 p-2 bg-slate-50 kurz-border">
                                    {task.show_percentage === 1 && comp.percentage && (
                                      <div className="w-10 h-10 bg-kurz-cyan kurz-border flex items-center justify-center flex-shrink-0">
                                        <span className="font-bold text-kurz-dark text-sm">{comp.percentage}%</span>
                                      </div>
                                    )}
                                    <div className="flex-1">
                                      <p className="text-[9px] text-slate-400">
                                        {formatDateTime(comp.completed_at)}
                                      </p>
                                    </div>
                                    {i === 0 && (
                                      <>
                                        <button
                                          onClick={() => handleDeleteCompletion(task.id, comp.id)}
                                          className="px-2 py-1 bg-kurz-pink kurz-border text-[8px] font-bold uppercase text-white"
                                        >
                                          Delete
                                        </button>
                                        <span className="text-[8px] bg-kurz-green text-kurz-dark px-2 py-1 font-bold uppercase">
                                          Latest
                                        </span>
                                      </>
                                    )}
                                  </div>
                                ))
                              )}
                            </div>
                          )}
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-2">
                          <button
                            onClick={() => startEditing(task)}
                            className="flex-1 bg-kurz-blue kurz-border kurz-shadow-sm p-2 font-bold uppercase text-[10px] text-white flex items-center justify-center gap-2"
                          >
                            <span className="material-symbols-outlined text-sm">edit</span>
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteTask(task.id)}
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
            )
          })}
        </div>
      )}

      {/* Water Parameters Section */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-display font-black text-xl uppercase italic tracking-tighter text-kurz-dark">
              Water Parameters
            </h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
              {waterParams.length} Parameter{waterParams.length !== 1 ? 's' : ''} Tracked
            </p>
          </div>
          <button
            onClick={() => setShowAddParam(!showAddParam)}
            className={`w-10 h-10 kurz-border kurz-shadow-sm flex items-center justify-center ${
              showAddParam ? 'bg-kurz-pink' : 'bg-kurz-cyan'
            }`}
          >
            <span className="material-symbols-outlined text-kurz-dark">
              {showAddParam ? 'close' : 'add'}
            </span>
          </button>
        </div>

        {/* Add Parameter Form */}
        {showAddParam && (
          <form onSubmit={handleAddParam} className="bg-white kurz-border kurz-card-shadow p-4 mb-4">
            <h3 className="font-display font-bold text-sm uppercase mb-4 text-kurz-dark">
              Add Water Parameter
            </h3>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Parameter Name
                </label>
                <input
                  type="text"
                  value={newParam.name}
                  onChange={(e) => setNewParam({ ...newParam, name: e.target.value })}
                  placeholder="e.g., Nitrate, Phosphate, etc."
                  className="w-full p-2 kurz-border text-sm"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Unit
                </label>
                <input
                  type="text"
                  value={newParam.unit}
                  onChange={(e) => setNewParam({ ...newParam, unit: e.target.value })}
                  placeholder="e.g., ppm, dKH, etc."
                  className="w-full p-2 kurz-border text-sm"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
                  Color
                </label>
                <div className="flex gap-2 flex-wrap">
                  {colorOptions.map(c => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setNewParam({ ...newParam, color: c.value })}
                      className={`w-10 h-10 ${c.bg} kurz-border ${
                        newParam.color === c.value ? 'ring-2 ring-kurz-dark ring-offset-2' : ''
                      }`}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
                  Testing Reminder
                </label>
                <div className="flex gap-2 flex-wrap">
                  {testingIntervalOptions.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setNewParam({ ...newParam, interval_days: opt.value })}
                      className={`px-3 py-2 kurz-border text-[10px] font-bold uppercase ${
                        newParam.interval_days === opt.value
                          ? 'bg-kurz-purple text-white'
                          : 'bg-white text-slate-500'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-kurz-green kurz-border kurz-shadow-sm p-3 font-bold uppercase text-sm text-kurz-dark"
              >
                Add Parameter
              </button>
            </div>
          </form>
        )}

        {/* Parameter List */}
        {waterParams.length === 0 ? (
          <div className="bg-white kurz-border kurz-card-shadow p-8 text-center">
            <span className="material-symbols-outlined text-4xl text-slate-300 mb-2">science</span>
            <p className="text-sm text-slate-400">No water parameters yet</p>
            <p className="text-[10px] text-slate-300 mt-1">Add parameters like Alkalinity, Calcium, etc.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {waterParams.map(param => {
              const calendarData = generateParamCalendar(param.readings || [])
              const isExpanded = expandedParam === param.id
              const isHistoryShown = showParamHistory[param.id]
              const colorClass = `bg-kurz-${param.color}`

              return (
                <div key={param.id} className="bg-white kurz-border kurz-card-shadow">
                  <div
                    className="p-4 cursor-pointer"
                    onClick={() => setExpandedParam(isExpanded ? null : param.id)}
                  >
                    <div className="flex items-start gap-4">
                      <div className={`w-12 h-12 kurz-border flex items-center justify-center flex-shrink-0 ${param.isDue ? 'bg-kurz-pink' : colorClass}`}>
                        <span className="material-symbols-outlined text-white text-xl">science</span>
                      </div>

                      <div className="flex-1">
                        <h3 className="font-display font-bold text-sm text-kurz-dark">
                          {param.name}
                          {param.target_value && (
                            <span className="text-[10px] font-normal text-slate-400 ml-2">
                              Target: {param.target_value} {param.unit}
                            </span>
                          )}
                        </h3>
                        {param.isDue ? (
                          <div className="flex items-center gap-2 mt-1">
                            <span className="w-2 h-2 bg-kurz-pink rounded-full animate-pulse"></span>
                            <span className="text-[10px] font-bold uppercase text-kurz-pink">Due for Testing</span>
                          </div>
                        ) : param.interval_days > 0 ? (
                          <p className="text-[10px] text-slate-400 mt-1">
                            Test in <span className="font-bold text-kurz-dark">{param.daysUntilDue} days</span>
                          </p>
                        ) : null}
                        {param.todayValue !== null && (
                          <p className="text-[10px] text-slate-400 mt-1">
                            Today: <span className="font-bold text-kurz-dark">{param.todayValue} {param.unit}</span>
                          </p>
                        )}
                      </div>

                      <span className="material-symbols-outlined text-slate-400">
                        {isExpanded ? 'expand_less' : 'expand_more'}
                      </span>
                    </div>
                  </div>

                  {/* Expanded Parameter Details */}
                  {isExpanded && (
                    <div className="border-t-2 border-slate-100 p-4">
                      {editingParam === param.id ? (
                        /* Edit Mode */
                        <div className="space-y-3">
                          <div>
                            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                              Parameter Name
                            </label>
                            <input
                              type="text"
                              value={paramEditForm.name}
                              onChange={(e) => setParamEditForm({ ...paramEditForm, name: e.target.value })}
                              className="w-full p-2 kurz-border text-sm"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                              Unit
                            </label>
                            <input
                              type="text"
                              value={paramEditForm.unit}
                              onChange={(e) => setParamEditForm({ ...paramEditForm, unit: e.target.value })}
                              className="w-full p-2 kurz-border text-sm"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                              Target Value
                            </label>
                            <input
                              type="text"
                              value={paramEditForm.target_value}
                              onChange={(e) => setParamEditForm({ ...paramEditForm, target_value: e.target.value })}
                              placeholder="e.g., 8-9 or 420"
                              className="w-full p-2 kurz-border text-sm"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
                              Color
                            </label>
                            <div className="flex gap-2 flex-wrap">
                              {colorOptions.map(c => (
                                <button
                                  key={c.value}
                                  type="button"
                                  onClick={() => setParamEditForm({ ...paramEditForm, color: c.value })}
                                  className={`w-10 h-10 ${c.bg} kurz-border ${
                                    paramEditForm.color === c.value ? 'ring-2 ring-kurz-dark ring-offset-2' : ''
                                  }`}
                                />
                              ))}
                            </div>
                          </div>

                          <div>
                            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
                              Testing Reminder
                            </label>
                            <div className="flex gap-2 flex-wrap">
                              {testingIntervalOptions.map(opt => (
                                <button
                                  key={opt.value}
                                  type="button"
                                  onClick={() => setParamEditForm({ ...paramEditForm, interval_days: opt.value })}
                                  className={`px-3 py-2 kurz-border text-[10px] font-bold uppercase ${
                                    paramEditForm.interval_days === opt.value
                                      ? 'bg-kurz-purple text-white'
                                      : 'bg-white text-slate-500'
                                  }`}
                                >
                                  {opt.label}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="flex gap-2 pt-2">
                            <button
                              onClick={() => handleUpdateParam(param.id)}
                              className="flex-1 bg-kurz-green kurz-border kurz-shadow-sm p-2 font-bold uppercase text-[10px] text-kurz-dark flex items-center justify-center gap-2"
                            >
                              <span className="material-symbols-outlined text-sm">save</span>
                              Save
                            </button>
                            <button
                              onClick={() => setEditingParam(null)}
                              className="flex-1 bg-slate-200 kurz-border p-2 font-bold uppercase text-[10px] text-kurz-dark flex items-center justify-center gap-2"
                            >
                              <span className="material-symbols-outlined text-sm">close</span>
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* View Mode */
                        <>
                          {/* Today's Reading Input */}
                          <div className="mb-4">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
                              Today's Reading
                            </label>
                            <div className="flex gap-2">
                              <input
                                type="number"
                                step="any"
                                value={paramInputs[param.id] || ''}
                                onChange={(e) => setParamInputs(prev => ({ ...prev, [param.id]: e.target.value }))}
                                placeholder={`Enter ${param.name}`}
                                className="flex-1 p-2 kurz-border text-sm"
                              />
                              <span className="px-3 py-2 bg-slate-100 kurz-border text-sm font-bold text-slate-500">
                                {param.unit}
                              </span>
                              <button
                                onClick={() => handleSaveReading(param.id)}
                                className="px-4 py-2 bg-kurz-green kurz-border font-bold uppercase text-[10px] text-kurz-dark"
                              >
                                Save
                              </button>
                            </div>
                          </div>

                          {/* Calendar */}
                          <div className="mb-4">
                            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                              {monthNames[calendarData.month]} {calendarData.year}
                            </div>
                            <div className="grid grid-cols-7 gap-1">
                              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                                <div key={i} className="text-center text-[8px] font-bold text-slate-400 py-1">
                                  {d}
                                </div>
                              ))}
                              {calendarData.weeks.flat().map((day, i) => (
                                <div
                                  key={i}
                                  className={`aspect-square flex flex-col items-center justify-center text-[9px] kurz-border ${
                                    day === null
                                      ? 'bg-transparent border-transparent'
                                      : day.value !== null
                                        ? `${colorClass} text-white`
                                        : 'bg-slate-50 text-slate-400'
                                  }`}
                                >
                                  {day && (
                                    <>
                                      <span className="font-bold">{day.day}</span>
                                      {day.value !== null && (
                                        <span className="text-[7px] opacity-90">{day.value}</span>
                                      )}
                                    </>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* History Toggle */}
                          <div className="mb-4">
                            <button
                              onClick={() => setShowParamHistory(prev => ({ ...prev, [param.id]: !isHistoryShown }))}
                              className="flex items-center gap-2 text-[10px] font-bold uppercase text-slate-500"
                            >
                              <span className="material-symbols-outlined text-sm">history</span>
                              All Readings ({param.readings?.length || 0})
                              <span className="material-symbols-outlined text-sm">
                                {isHistoryShown ? 'expand_less' : 'expand_more'}
                              </span>
                            </button>

                            {isHistoryShown && (
                              <div className="mt-2 space-y-2 max-h-48 overflow-y-auto">
                                {(!param.readings || param.readings.length === 0) ? (
                                  <p className="text-[10px] text-slate-400 italic">No readings yet</p>
                                ) : (
                                  param.readings.map((reading, i) => {
                                    const isEditingThis = editingReading?.readingId === reading.id

                                    return (
                                      <div key={reading.id} className="flex items-center gap-3 p-2 bg-slate-50 kurz-border">
                                        {isEditingThis ? (
                                          <>
                                            <input
                                              type="number"
                                              step="any"
                                              value={editingReading.value}
                                              onChange={(e) => setEditingReading({ ...editingReading, value: e.target.value })}
                                              className="w-20 p-2 kurz-border text-sm font-bold text-center"
                                              autoFocus
                                            />
                                            <div className="flex-1">
                                              <p className="text-[9px] text-slate-400">
                                                {formatDate(reading.reading_date)}
                                              </p>
                                            </div>
                                            <button
                                              onClick={handleUpdateReading}
                                              className="px-2 py-1 bg-kurz-green kurz-border text-[8px] font-bold uppercase text-kurz-dark"
                                            >
                                              Save
                                            </button>
                                            <button
                                              onClick={() => setEditingReading(null)}
                                              className="px-2 py-1 bg-slate-200 kurz-border text-[8px] font-bold uppercase text-slate-600"
                                            >
                                              Cancel
                                            </button>
                                          </>
                                        ) : (
                                          <>
                                            <div className={`w-10 h-10 ${colorClass} kurz-border flex items-center justify-center flex-shrink-0`}>
                                              <span className="font-bold text-white text-sm">{reading.value}</span>
                                            </div>
                                            <div className="flex-1">
                                              <p className="text-[9px] text-slate-400">
                                                {formatDate(reading.reading_date)}
                                              </p>
                                            </div>
                                            {i === 0 && (
                                              <>
                                                <button
                                                  onClick={() => setEditingReading({ paramId: param.id, readingId: reading.id, value: reading.value.toString() })}
                                                  className="px-2 py-1 bg-kurz-blue kurz-border text-[8px] font-bold uppercase text-white"
                                                >
                                                  Edit
                                                </button>
                                                <span className="text-[8px] bg-kurz-green text-kurz-dark px-2 py-1 font-bold uppercase">
                                                  Latest
                                                </span>
                                              </>
                                            )}
                                          </>
                                        )}
                                      </div>
                                    )
                                  })
                                )}
                              </div>
                            )}
                          </div>

                          {/* Action Buttons */}
                          <div className="flex gap-2">
                            <button
                              onClick={() => startEditingParam(param)}
                              className="flex-1 bg-kurz-blue kurz-border kurz-shadow-sm p-2 font-bold uppercase text-[10px] text-white flex items-center justify-center gap-2"
                            >
                              <span className="material-symbols-outlined text-sm">edit</span>
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteParam(param.id)}
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
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default Maintenance
