import express from 'express'
import cors from 'cors'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import crypto from 'crypto'
import db from './db.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = process.env.PORT || 4000

// Generate UUID using built-in crypto
function generateId() {
  return crypto.randomUUID()
}

function generateApiKey() {
  return crypto.randomUUID().replace(/-/g, '')
}

app.use(cors())
app.use(express.json({ limit: '10mb' }))

// ============ SENSOR CRUD ============

// Get all sensors with latest reading
app.get('/api/sensors', (req, res) => {
  const sensors = db.prepare(`
    SELECT s.*,
      (SELECT value FROM readings WHERE sensor_id = s.id ORDER BY recorded_at DESC LIMIT 1) as latest_value,
      (SELECT recorded_at FROM readings WHERE sensor_id = s.id ORDER BY recorded_at DESC LIMIT 1) as latest_reading_at
    FROM sensors s
    ORDER BY s.created_at ASC
  `).all()

  res.json(sensors)
})

// Get single sensor with recent readings
app.get('/api/sensors/:id', (req, res) => {
  const sensor = db.prepare('SELECT * FROM sensors WHERE id = ?').get(req.params.id)

  if (!sensor) {
    return res.status(404).json({ error: 'Sensor not found' })
  }

  const readings = db.prepare(`
    SELECT value, recorded_at
    FROM readings
    WHERE sensor_id = ?
    ORDER BY recorded_at DESC
    LIMIT 100
  `).all(req.params.id)

  res.json({ ...sensor, readings })
})

// Create new sensor
app.post('/api/sensors', (req, res) => {
  const { name, type, unit, color, icon, min_value, max_value, sensor_type, float_ok_value } = req.body

  if (!name || !type) {
    return res.status(400).json({ error: 'Name and type are required' })
  }

  const id = generateId()
  const api_key = generateApiKey()
  const sType = sensor_type || 'value'

  db.prepare(`
    INSERT INTO sensors (id, name, type, unit, color, icon, api_key, min_value, max_value, sensor_type, float_ok_value)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    name,
    type,
    sType === 'float' ? '' : (unit || ''),
    color || 'orange',
    icon || 'sensors',
    api_key,
    min_value ?? null,
    max_value ?? null,
    sType,
    float_ok_value ?? 1
  )

  const sensor = db.prepare('SELECT * FROM sensors WHERE id = ?').get(id)
  res.status(201).json(sensor)
})

// Update sensor
app.put('/api/sensors/:id', (req, res) => {
  const { name, type, unit, color, icon, min_value, max_value, sensor_type, float_ok_value } = req.body

  const existing = db.prepare('SELECT * FROM sensors WHERE id = ?').get(req.params.id)
  if (!existing) {
    return res.status(404).json({ error: 'Sensor not found' })
  }

  db.prepare(`
    UPDATE sensors
    SET name = ?, type = ?, unit = ?, color = ?, icon = ?, min_value = ?, max_value = ?, sensor_type = ?, float_ok_value = ?
    WHERE id = ?
  `).run(
    name ?? existing.name,
    type ?? existing.type,
    unit ?? existing.unit,
    color ?? existing.color,
    icon ?? existing.icon,
    min_value !== undefined ? min_value : existing.min_value,
    max_value !== undefined ? max_value : existing.max_value,
    sensor_type ?? existing.sensor_type,
    float_ok_value !== undefined ? float_ok_value : existing.float_ok_value,
    req.params.id
  )

  const sensor = db.prepare('SELECT * FROM sensors WHERE id = ?').get(req.params.id)
  res.json(sensor)
})

// Update sensor
app.put('/api/sensors/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM sensors WHERE id = ?').get(req.params.id)
  if (!existing) {
    return res.status(404).json({ error: 'Sensor not found' })
  }

  const { name, type, unit, color, icon, min_value, max_value, float_ok_value } = req.body

  db.prepare(`
    UPDATE sensors SET
      name = COALESCE(?, name),
      type = COALESCE(?, type),
      unit = COALESCE(?, unit),
      color = COALESCE(?, color),
      icon = COALESCE(?, icon),
      min_value = ?,
      max_value = ?,
      float_ok_value = COALESCE(?, float_ok_value)
    WHERE id = ?
  `).run(
    name, type, unit, color, icon,
    min_value !== undefined ? min_value : existing.min_value,
    max_value !== undefined ? max_value : existing.max_value,
    float_ok_value,
    req.params.id
  )

  const updated = db.prepare('SELECT * FROM sensors WHERE id = ?').get(req.params.id)
  res.json(updated)
})

// Delete sensor
app.delete('/api/sensors/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM sensors WHERE id = ?').get(req.params.id)
  if (!existing) {
    return res.status(404).json({ error: 'Sensor not found' })
  }

  db.prepare('DELETE FROM readings WHERE sensor_id = ?').run(req.params.id)
  db.prepare('DELETE FROM sensors WHERE id = ?').run(req.params.id)

  res.json({ success: true })
})

// Regenerate API key
app.post('/api/sensors/:id/regenerate-key', (req, res) => {
  const existing = db.prepare('SELECT * FROM sensors WHERE id = ?').get(req.params.id)
  if (!existing) {
    return res.status(404).json({ error: 'Sensor not found' })
  }

  const new_api_key = generateApiKey()
  db.prepare('UPDATE sensors SET api_key = ? WHERE id = ?').run(new_api_key, req.params.id)

  const sensor = db.prepare('SELECT * FROM sensors WHERE id = ?').get(req.params.id)
  res.json(sensor)
})

// ============ SPECIMENS CRUD ============

// Get all specimens
app.get('/api/specimens', (req, res) => {
  const specimens = db.prepare(`
    SELECT * FROM specimens ORDER BY created_at DESC
  `).all()
  res.json(specimens)
})

// Get single specimen
app.get('/api/specimens/:id', (req, res) => {
  const specimen = db.prepare('SELECT * FROM specimens WHERE id = ?').get(req.params.id)
  if (!specimen) {
    return res.status(404).json({ error: 'Specimen not found' })
  }
  res.json(specimen)
})

// Create new specimen
app.post('/api/specimens', (req, res) => {
  const { name, species, health, acquired_at, notes, image } = req.body

  if (!name) {
    return res.status(400).json({ error: 'Name is required' })
  }

  const id = generateId()

  db.prepare(`
    INSERT INTO specimens (id, name, species, health, acquired_at, notes, image)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    name,
    species || '',
    health || 'good',
    acquired_at || new Date().toISOString().split('T')[0],
    notes || '',
    image || null
  )

  const specimen = db.prepare('SELECT * FROM specimens WHERE id = ?').get(id)
  res.status(201).json(specimen)
})

// Update specimen
app.put('/api/specimens/:id', (req, res) => {
  const { name, species, health, acquired_at, notes, image } = req.body

  const existing = db.prepare('SELECT * FROM specimens WHERE id = ?').get(req.params.id)
  if (!existing) {
    return res.status(404).json({ error: 'Specimen not found' })
  }

  db.prepare(`
    UPDATE specimens
    SET name = ?, species = ?, health = ?, acquired_at = ?, notes = ?, image = ?
    WHERE id = ?
  `).run(
    name ?? existing.name,
    species ?? existing.species,
    health ?? existing.health,
    acquired_at ?? existing.acquired_at,
    notes ?? existing.notes,
    image !== undefined ? image : existing.image,
    req.params.id
  )

  const specimen = db.prepare('SELECT * FROM specimens WHERE id = ?').get(req.params.id)
  res.json(specimen)
})

// Delete specimen
app.delete('/api/specimens/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM specimens WHERE id = ?').get(req.params.id)
  if (!existing) {
    return res.status(404).json({ error: 'Specimen not found' })
  }

  db.prepare('DELETE FROM specimen_notes WHERE specimen_id = ?').run(req.params.id)
  db.prepare('DELETE FROM specimens WHERE id = ?').run(req.params.id)
  res.json({ success: true })
})

// ============ SPECIMEN NOTES ============

// Get notes for a specimen
app.get('/api/specimens/:id/notes', (req, res) => {
  const notes = db.prepare(`
    SELECT * FROM specimen_notes
    WHERE specimen_id = ?
    ORDER BY created_at DESC
  `).all(req.params.id)
  res.json(notes)
})

// Add note to specimen
app.post('/api/specimens/:id/notes', (req, res) => {
  const { content } = req.body

  if (!content || !content.trim()) {
    return res.status(400).json({ error: 'Note content is required' })
  }

  const existing = db.prepare('SELECT * FROM specimens WHERE id = ?').get(req.params.id)
  if (!existing) {
    return res.status(404).json({ error: 'Specimen not found' })
  }

  const id = generateId()

  db.prepare(`
    INSERT INTO specimen_notes (id, specimen_id, content)
    VALUES (?, ?, ?)
  `).run(id, req.params.id, content.trim())

  const note = db.prepare('SELECT * FROM specimen_notes WHERE id = ?').get(id)
  res.status(201).json(note)
})

// Delete a note
app.delete('/api/specimens/:specimenId/notes/:noteId', (req, res) => {
  const existing = db.prepare('SELECT * FROM specimen_notes WHERE id = ?').get(req.params.noteId)
  if (!existing) {
    return res.status(404).json({ error: 'Note not found' })
  }

  db.prepare('DELETE FROM specimen_notes WHERE id = ?').run(req.params.noteId)
  res.json({ success: true })
})

// Clear all notes for a specimen
app.delete('/api/specimens/:id/notes', (req, res) => {
  const existing = db.prepare('SELECT * FROM specimens WHERE id = ?').get(req.params.id)
  if (!existing) {
    return res.status(404).json({ error: 'Specimen not found' })
  }

  db.prepare('DELETE FROM specimen_notes WHERE specimen_id = ?').run(req.params.id)
  res.json({ success: true })
})

// ============ MAINTENANCE TASKS ============

// Get all maintenance tasks with their status
app.get('/api/maintenance/tasks', (req, res) => {
  const tasks = db.prepare(`
    SELECT * FROM maintenance_tasks ORDER BY created_at ASC
  `).all()

  // Add status info to each task
  const tasksWithStatus = tasks.map(task => {
    const lastCompletion = db.prepare(`
      SELECT * FROM maintenance_completions
      WHERE task_id = ?
      ORDER BY completed_at DESC LIMIT 1
    `).get(task.id)

    let isDue = true
    let daysSinceLast = null
    let daysUntilDue = null

    if (lastCompletion) {
      const lastDate = new Date(lastCompletion.completed_at)
      const now = new Date()
      const diffMs = now - lastDate
      daysSinceLast = Math.floor(diffMs / (1000 * 60 * 60 * 24))
      daysUntilDue = task.interval_days - daysSinceLast
      isDue = daysSinceLast >= task.interval_days
    }

    return {
      ...task,
      lastCompletion,
      isDue,
      daysSinceLast,
      daysUntilDue
    }
  })

  res.json(tasksWithStatus)
})

// Create a new maintenance task
app.post('/api/maintenance/tasks', (req, res) => {
  const { name, icon, interval_days, notification_url, show_percentage } = req.body

  if (!name) {
    return res.status(400).json({ error: 'Name is required' })
  }

  const id = generateId()

  db.prepare(`
    INSERT INTO maintenance_tasks (id, name, icon, interval_days, notification_url, show_percentage)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, name, icon || 'build', interval_days || 7, notification_url || null, show_percentage ? 1 : 0)

  const task = db.prepare('SELECT * FROM maintenance_tasks WHERE id = ?').get(id)
  res.status(201).json(task)
})

// Update a maintenance task
app.put('/api/maintenance/tasks/:id', (req, res) => {
  const { name, icon, interval_days, notification_url, show_percentage } = req.body

  const existing = db.prepare('SELECT * FROM maintenance_tasks WHERE id = ?').get(req.params.id)
  if (!existing) {
    return res.status(404).json({ error: 'Task not found' })
  }

  db.prepare(`
    UPDATE maintenance_tasks SET
      name = COALESCE(?, name),
      icon = COALESCE(?, icon),
      interval_days = COALESCE(?, interval_days),
      notification_url = ?,
      show_percentage = COALESCE(?, show_percentage)
    WHERE id = ?
  `).run(
    name, icon, interval_days,
    notification_url !== undefined ? notification_url : existing.notification_url,
    show_percentage !== undefined ? (show_percentage ? 1 : 0) : existing.show_percentage,
    req.params.id
  )

  const task = db.prepare('SELECT * FROM maintenance_tasks WHERE id = ?').get(req.params.id)
  res.json(task)
})

// Delete a maintenance task
app.delete('/api/maintenance/tasks/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM maintenance_tasks WHERE id = ?').get(req.params.id)
  if (!existing) {
    return res.status(404).json({ error: 'Task not found' })
  }

  db.prepare('DELETE FROM maintenance_completions WHERE task_id = ?').run(req.params.id)
  db.prepare('DELETE FROM maintenance_tasks WHERE id = ?').run(req.params.id)

  res.json({ success: true })
})

// Get completions for a task
app.get('/api/maintenance/tasks/:id/completions', (req, res) => {
  const completions = db.prepare(`
    SELECT * FROM maintenance_completions
    WHERE task_id = ?
    ORDER BY completed_at DESC
  `).all(req.params.id)

  res.json(completions)
})

// Log a completion for a task
app.post('/api/maintenance/tasks/:id/completions', (req, res) => {
  const { percentage, notes } = req.body

  const task = db.prepare('SELECT * FROM maintenance_tasks WHERE id = ?').get(req.params.id)
  if (!task) {
    return res.status(404).json({ error: 'Task not found' })
  }

  const id = generateId()

  db.prepare(`
    INSERT INTO maintenance_completions (id, task_id, percentage, notes)
    VALUES (?, ?, ?, ?)
  `).run(id, req.params.id, percentage || null, notes || null)

  const completion = db.prepare('SELECT * FROM maintenance_completions WHERE id = ?').get(id)
  res.status(201).json(completion)
})

// Test notification URL for a task
app.post('/api/maintenance/tasks/:id/test-notification', async (req, res) => {
  const task = db.prepare('SELECT * FROM maintenance_tasks WHERE id = ?').get(req.params.id)

  if (!task) {
    return res.status(404).json({ error: 'Task not found' })
  }

  if (!task.notification_url) {
    return res.status(400).json({ error: 'No notification URL configured for this task' })
  }

  try {
    const response = await fetch(task.notification_url, {
      method: 'GET'
    })
    res.json({ success: true, status: response.status })
  } catch (err) {
    res.status(500).json({ error: 'Failed to reach notification URL', message: err.message })
  }
})

// ============ DATA INGESTION (for microcontrollers) ============

// Post reading via API key
app.post('/api/data/:api_key', (req, res) => {
  const { value } = req.body

  if (value === undefined || value === null) {
    return res.status(400).json({ error: 'Value is required' })
  }

  const sensor = db.prepare('SELECT * FROM sensors WHERE api_key = ?').get(req.params.api_key)
  if (!sensor) {
    return res.status(404).json({ error: 'Invalid API key' })
  }

  // For float switches, normalize to 0 or 1
  let finalValue = parseFloat(value)
  if (sensor.sensor_type === 'float') {
    finalValue = finalValue ? 1 : 0
  }

  db.prepare('INSERT INTO readings (sensor_id, value) VALUES (?, ?)').run(sensor.id, finalValue)

  res.json({ success: true, sensor_name: sensor.name })
})

// GET endpoint for simple microcontrollers that can't POST
app.get('/api/data/:api_key/:value', (req, res) => {
  const { api_key, value } = req.params

  const sensor = db.prepare('SELECT * FROM sensors WHERE api_key = ?').get(api_key)
  if (!sensor) {
    return res.status(404).json({ error: 'Invalid API key' })
  }

  // For float switches, normalize to 0 or 1
  let finalValue = parseFloat(value)
  if (sensor.sensor_type === 'float') {
    finalValue = finalValue ? 1 : 0
  }

  db.prepare('INSERT INTO readings (sensor_id, value) VALUES (?, ?)').run(sensor.id, finalValue)

  res.json({ success: true, sensor_name: sensor.name })
})

// ============ DASHBOARD DATA ============

// Get parameters for dashboard (latest readings from all sensors)
app.get('/api/parameters', (req, res) => {
  const sensors = db.prepare(`
    SELECT s.*,
      (SELECT value FROM readings WHERE sensor_id = s.id ORDER BY recorded_at DESC LIMIT 1) as latest_value
    FROM sensors s
    ORDER BY s.created_at ASC
  `).all()

  const parameters = sensors.map(sensor => {
    if (sensor.sensor_type === 'float') {
      // Float switch sensor
      const isOk = sensor.latest_value === sensor.float_ok_value
      return {
        icon: sensor.icon,
        label: sensor.type,
        value: sensor.latest_value !== null ? (isOk ? 'OK' : 'ALERT') : '--',
        unit: '',
        status: getFloatStatus(sensor.latest_value, sensor.float_ok_value),
        color: sensor.color,
        sensor_type: 'float'
      }
    } else {
      // Value-based sensor
      return {
        icon: sensor.icon,
        label: sensor.type,
        value: sensor.latest_value?.toFixed(1) || '--',
        unit: sensor.unit,
        status: getValueStatus(sensor.latest_value, sensor.min_value, sensor.max_value),
        color: sensor.color,
        sensor_type: 'value'
      }
    }
  })

  res.json(parameters)
})

// Get telemetry history for a sensor type (past month)
app.get('/api/telemetry/:type', (req, res) => {
  const sensor = db.prepare(`
    SELECT * FROM sensors WHERE LOWER(type) = LOWER(?) LIMIT 1
  `).get(req.params.type)

  if (!sensor) {
    return res.json({ readings: [], dailySummary: [], sensor: null })
  }

  // Get readings from the past month
  const oneMonthAgo = new Date()
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1)
  const oneMonthAgoStr = oneMonthAgo.toISOString()

  const readings = db.prepare(`
    SELECT value, recorded_at
    FROM readings
    WHERE sensor_id = ? AND recorded_at >= ?
    ORDER BY recorded_at ASC
  `).all(sensor.id, oneMonthAgoStr)

  // Create daily summary with out-of-range detection
  const dailySummary = {}

  readings.forEach(r => {
    // Handle both ISO format (T separator) and SQLite format (space separator)
    const date = r.recorded_at.split(/[T ]/)[0]

    if (!dailySummary[date]) {
      dailySummary[date] = {
        date,
        hasData: true,
        hasAlert: false,
        readings: [],
        min: r.value,
        max: r.value,
        avg: 0
      }
    }

    dailySummary[date].readings.push(r.value)
    dailySummary[date].min = Math.min(dailySummary[date].min, r.value)
    dailySummary[date].max = Math.max(dailySummary[date].max, r.value)

    // Check if this reading is out of range
    let isOutOfRange = false
    if (sensor.sensor_type === 'float') {
      const okValue = sensor.float_ok_value ?? 1
      isOutOfRange = r.value !== okValue
    } else {
      // Value sensor
      if (sensor.min_value !== null && r.value < sensor.min_value) isOutOfRange = true
      if (sensor.max_value !== null && r.value > sensor.max_value) isOutOfRange = true
    }

    if (isOutOfRange) {
      dailySummary[date].hasAlert = true
    }
  })

  // Calculate averages
  Object.values(dailySummary).forEach(day => {
    day.avg = day.readings.reduce((a, b) => a + b, 0) / day.readings.length
    day.count = day.readings.length
    delete day.readings // Don't send all readings, just the summary
  })

  res.json({
    sensor,
    readings: readings.slice(-50), // Last 50 readings for the chart
    dailySummary: Object.values(dailySummary).sort((a, b) => a.date.localeCompare(b.date))
  })
})

// Helper to determine status for value-based sensors
function getValueStatus(value, minValue, maxValue) {
  if (value === null || value === undefined) return 'No Data'

  // If no ranges configured, just show "Active"
  if (minValue === null && maxValue === null) return 'Active'

  // Check against configured ranges
  if (minValue !== null && value < minValue) return 'Too Low'
  if (maxValue !== null && value > maxValue) return 'Too High'

  return 'Normal'
}

// Helper to determine status for float switch sensors
function getFloatStatus(value, okValue = 1) {
  if (value === null || value === undefined) return 'No Data'
  const isOk = value === okValue
  return isOk ? 'OK' : 'Alert'
}

// ============ APP SETTINGS ============

// Get all settings
app.get('/api/settings', (req, res) => {
  const settings = db.prepare('SELECT key, value FROM app_settings').all()
  const settingsObj = {}
  settings.forEach(s => {
    settingsObj[s.key] = s.value
  })
  res.json(settingsObj)
})

// Update a setting
app.put('/api/settings/:key', (req, res) => {
  const { key } = req.params
  const { value } = req.body

  db.prepare(`
    INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)
  `).run(key, value)

  res.json({ success: true, key, value })
})

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  // In Docker, frontend is at ./frontend/dist relative to backend
  // In local production, it's at ../frontend/dist
  const frontendPath = path.join(__dirname, 'frontend/dist')
  const altFrontendPath = path.join(__dirname, '../frontend/dist')

  const staticPath = fs.existsSync(frontendPath) ? frontendPath : altFrontendPath

  app.use(express.static(staticPath))

  app.get('*', (req, res) => {
    res.sendFile(path.join(staticPath, 'index.html'))
  })
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`)
})
