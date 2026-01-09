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
  const [testResults, setTestResults] = useState({})
  const { formatDateTime, formatRelativeDate } = useSettings()

  const [newTask, setNewTask] = useState({
    name: '',
    icon: 'build',
    interval_days: 7,
    notification_url: '',
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

  useEffect(() => {
    fetchTasks()
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
        body: JSON.stringify({
          ...newTask,
          notification_url: newTask.notification_url || null
        })
      })
      if (res.ok) {
        setNewTask({ name: '', icon: 'build', interval_days: 7, notification_url: '', show_percentage: false })
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
        body: JSON.stringify({
          ...editForm,
          notification_url: editForm.notification_url || null
        })
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

  const handleTestNotification = async (taskId) => {
    setTestResults(prev => ({ ...prev, [taskId]: null }))
    try {
      const res = await fetch(`/api/maintenance/tasks/${taskId}/test-notification`, {
        method: 'POST'
      })
      const data = await res.json()
      if (res.ok) {
        setTestResults(prev => ({ ...prev, [taskId]: { success: true, message: `Success! Status: ${data.status}` } }))
      } else {
        setTestResults(prev => ({ ...prev, [taskId]: { success: false, message: data.error || 'Failed' } }))
      }
    } catch (err) {
      setTestResults(prev => ({ ...prev, [taskId]: { success: false, message: 'Failed to test' } }))
    }
    setTimeout(() => setTestResults(prev => ({ ...prev, [taskId]: null })), 3000)
  }

  const startEditing = (task) => {
    setEditingTask(task.id)
    setEditForm({
      name: task.name,
      icon: task.icon,
      interval_days: task.interval_days,
      notification_url: task.notification_url || '',
      show_percentage: task.show_percentage === 1
    })
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

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Notification URL (Optional)
              </label>
              <input
                type="url"
                value={newTask.notification_url}
                onChange={(e) => setNewTask({ ...newTask, notification_url: e.target.value })}
                placeholder="https://..."
                className="w-full p-2 kurz-border text-sm"
              />
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
            const testResult = testResults[task.id]

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

                        <div>
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                            Notification URL
                          </label>
                          <input
                            type="url"
                            value={editForm.notification_url}
                            onChange={(e) => setEditForm({ ...editForm, notification_url: e.target.value })}
                            placeholder="https://..."
                            className="w-full p-2 kurz-border text-sm"
                          />
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

                        {/* Notification Test */}
                        {task.notification_url && (
                          <div className="mb-4 flex items-center gap-3">
                            <button
                              onClick={() => handleTestNotification(task.id)}
                              className="bg-kurz-purple kurz-border px-4 py-2 font-bold uppercase text-[10px] text-white"
                            >
                              Test Notification
                            </button>
                            {testResult && (
                              <span className={`text-[10px] font-bold ${testResult.success ? 'text-kurz-green' : 'text-kurz-pink'}`}>
                                {testResult.message}
                              </span>
                            )}
                          </div>
                        )}

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
                                      <span className="text-[8px] bg-kurz-green text-kurz-dark px-2 py-1 font-bold uppercase">
                                        Latest
                                      </span>
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
    </div>
  )
}

export default Maintenance
