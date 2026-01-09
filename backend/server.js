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

// ============ SECURITY: Input Validation & Sanitization ============

// Escape HTML to prevent XSS when data is rendered
function escapeHtml(str) {
  if (typeof str !== 'string') return str
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

// Sanitize a string input (trim, limit length, escape HTML)
function sanitizeString(str, maxLength = 500) {
  if (typeof str !== 'string') return ''
  return escapeHtml(str.trim().slice(0, maxLength))
}

// Validate UUID format
function isValidUUID(str) {
  if (typeof str !== 'string') return false
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str)
}

// Validate API key format (32 hex chars)
function isValidApiKey(str) {
  if (typeof str !== 'string') return false
  return /^[0-9a-f]{32}$/i.test(str)
}

// Validate and sanitize a number within bounds
function sanitizeNumber(value, min = null, max = null, defaultVal = null) {
  const num = parseFloat(value)
  if (isNaN(num)) return defaultVal
  if (min !== null && num < min) return min
  if (max !== null && num > max) return max
  return num
}

// Validate integer within bounds
function sanitizeInteger(value, min = null, max = null, defaultVal = null) {
  const num = parseInt(value, 10)
  if (isNaN(num)) return defaultVal
  if (min !== null && num < min) return min
  if (max !== null && num > max) return max
  return num
}

// Allowed values for enums
const ALLOWED_COLORS = ['orange', 'cyan', 'purple', 'pink', 'green', 'yellow', 'blue']
const ALLOWED_ICONS = ['sensors', 'thermostat', 'water_drop', 'opacity', 'science', 'air', 'waves', 'filter_alt', 'cleaning_services', 'build', 'vaccines', 'grass', 'lightbulb', 'electric_bolt', 'speed', 'swap_vert', 'bolt']
const ALLOWED_SENSOR_TYPES = ['value', 'float']
const ALLOWED_HEALTH_STATUS = ['excellent', 'fair', 'critical']

// Validate enum value
function validateEnum(value, allowed, defaultVal) {
  if (allowed.includes(value)) return value
  return defaultVal
}

// Validate URL (must be https in production, allow http for local dev)
function isValidUrl(str) {
  if (typeof str !== 'string' || !str.trim()) return false
  try {
    const url = new URL(str)
    // Only allow http/https protocols
    if (!['http:', 'https:'].includes(url.protocol)) return false
    // Block internal/private IPs to prevent SSRF
    const hostname = url.hostname.toLowerCase()
    if (hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname.startsWith('192.168.') ||
        hostname.startsWith('10.') ||
        hostname.startsWith('172.') ||
        hostname === '0.0.0.0' ||
        hostname.endsWith('.local')) {
      return false
    }
    return true
  } catch {
    return false
  }
}

// Validate base64 image data (basic check)
function isValidBase64Image(str) {
  if (typeof str !== 'string') return false
  // Check for data URL format with image mime type
  if (!str.startsWith('data:image/')) return false
  // Limit size (5MB base64 ≈ 3.75MB actual)
  if (str.length > 5 * 1024 * 1024) return false
  return true
}

// Validate date string format (YYYY-MM-DD)
function isValidDateString(str) {
  if (typeof str !== 'string') return false
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return false
  const date = new Date(str)
  return !isNaN(date.getTime())
}

// ============ SECURITY: Rate Limiting ============

const rateLimitStore = new Map()

function rateLimit(windowMs, maxRequests) {
  return (req, res, next) => {
    const key = req.ip || req.connection.remoteAddress || 'unknown'
    const now = Date.now()

    if (!rateLimitStore.has(key)) {
      rateLimitStore.set(key, { count: 1, resetAt: now + windowMs })
      return next()
    }

    const record = rateLimitStore.get(key)

    if (now > record.resetAt) {
      record.count = 1
      record.resetAt = now + windowMs
      return next()
    }

    record.count++

    if (record.count > maxRequests) {
      return res.status(429).json({ error: 'Too many requests, please try again later' })
    }

    next()
  }
}

// Clean up old rate limit entries periodically
setInterval(() => {
  const now = Date.now()
  for (const [key, record] of rateLimitStore.entries()) {
    if (now > record.resetAt) {
      rateLimitStore.delete(key)
    }
  }
}, 60000) // Clean every minute

// Rate limiters for different endpoint types
const apiRateLimit = rateLimit(60000, 100)  // 100 requests per minute for general API
const dataIngestionLimit = rateLimit(60000, 120)  // 120 requests per minute for sensor data
const settingsRateLimit = rateLimit(60000, 20)  // 20 requests per minute for settings

// ============ SECURITY: HTTP Headers ============

function securityHeaders(req, res, next) {
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY')
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff')
  // XSS protection (legacy browsers)
  res.setHeader('X-XSS-Protection', '1; mode=block')
  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  // Content Security Policy
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self'")
  // Permissions Policy
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()')
  next()
}

// Generate UUID using built-in crypto
function generateId() {
  return crypto.randomUUID()
}

function generateApiKey() {
  return crypto.randomUUID().replace(/-/g, '')
}

// Get user's configured timezone from settings
function getUserTimezone() {
  const setting = db.prepare("SELECT value FROM app_settings WHERE key = 'timezone'").get()
  return setting?.value || 'UTC'
}

// Parse a timestamp string as UTC (SQLite stores without timezone indicator)
function parseAsUTC(dateStr) {
  if (!dateStr) return null
  // If it's a date-only string (YYYY-MM-DD), parse as midnight UTC
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return new Date(dateStr + 'T00:00:00Z')
  }
  // If it already has timezone info, parse as-is
  if (/Z$/.test(dateStr) || /[+\-]\d{2}:\d{2}$/.test(dateStr) || /[+\-]\d{4}$/.test(dateStr)) {
    return new Date(dateStr)
  }
  // Replace space with T and add Z to indicate UTC
  const normalized = dateStr.replace(' ', 'T')
  return new Date(normalized + 'Z')
}

// Convert a UTC date string to a YYYY-MM-DD string in the user's timezone
function getDateInTimezone(dateStr, timezone) {
  const date = parseAsUTC(dateStr)
  return date.toLocaleDateString('en-CA', { timeZone: timezone }) // en-CA gives YYYY-MM-DD format
}

// Apply security headers to all responses
app.use(securityHeaders)

// CORS configuration - restrict in production
const corsOptions = {
  origin: process.env.NODE_ENV === 'production'
    ? (process.env.ALLOWED_ORIGIN || true)  // In production, restrict to same origin or env var
    : true,  // In development, allow all origins
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type'],
  maxAge: 86400  // Cache preflight for 24 hours
}
app.use(cors(corsOptions))

// Parse JSON with size limit
app.use(express.json({ limit: '5mb' }))  // Reduced from 10mb

// Apply general rate limiting to all API routes
app.use('/api', apiRateLimit)

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
  // Validate ID format
  if (!isValidUUID(req.params.id)) {
    return res.status(400).json({ error: 'Invalid sensor ID format' })
  }

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

  // Validate required fields
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Name is required' })
  }
  if (!type || typeof type !== 'string' || !type.trim()) {
    return res.status(400).json({ error: 'Type is required' })
  }

  const id = generateId()
  const api_key = generateApiKey()

  // Sanitize and validate all inputs
  const sanitizedName = sanitizeString(name, 100)
  const sanitizedType = sanitizeString(type, 50)
  const sanitizedUnit = sanitizeString(unit || '', 20)
  const validatedColor = validateEnum(color, ALLOWED_COLORS, 'orange')
  const validatedIcon = validateEnum(icon, ALLOWED_ICONS, 'sensors')
  const validatedSensorType = validateEnum(sensor_type, ALLOWED_SENSOR_TYPES, 'value')
  const sanitizedMinValue = sanitizeNumber(min_value, -10000, 10000, null)
  const sanitizedMaxValue = sanitizeNumber(max_value, -10000, 10000, null)
  const sanitizedFloatOkValue = sanitizeInteger(float_ok_value, 0, 1, 1)

  db.prepare(`
    INSERT INTO sensors (id, name, type, unit, color, icon, api_key, min_value, max_value, sensor_type, float_ok_value)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    sanitizedName,
    sanitizedType,
    validatedSensorType === 'float' ? '' : sanitizedUnit,
    validatedColor,
    validatedIcon,
    api_key,
    sanitizedMinValue,
    sanitizedMaxValue,
    validatedSensorType,
    sanitizedFloatOkValue
  )

  const sensor = db.prepare('SELECT * FROM sensors WHERE id = ?').get(id)
  res.status(201).json(sensor)
})

// Update sensor
app.put('/api/sensors/:id', (req, res) => {
  // Validate ID format
  if (!isValidUUID(req.params.id)) {
    return res.status(400).json({ error: 'Invalid sensor ID format' })
  }

  const existing = db.prepare('SELECT * FROM sensors WHERE id = ?').get(req.params.id)
  if (!existing) {
    return res.status(404).json({ error: 'Sensor not found' })
  }

  const { name, type, unit, color, icon, min_value, max_value, sensor_type, float_ok_value, alerts_enabled } = req.body

  // Sanitize inputs, keeping existing values if not provided
  const sanitizedName = name ? sanitizeString(name, 100) : existing.name
  const sanitizedType = type ? sanitizeString(type, 50) : existing.type
  const sanitizedUnit = unit !== undefined ? sanitizeString(unit, 20) : existing.unit
  const validatedColor = color ? validateEnum(color, ALLOWED_COLORS, existing.color) : existing.color
  const validatedIcon = icon ? validateEnum(icon, ALLOWED_ICONS, existing.icon) : existing.icon
  const validatedSensorType = sensor_type ? validateEnum(sensor_type, ALLOWED_SENSOR_TYPES, existing.sensor_type) : existing.sensor_type
  const sanitizedMinValue = min_value !== undefined ? sanitizeNumber(min_value, -10000, 10000, null) : existing.min_value
  const sanitizedMaxValue = max_value !== undefined ? sanitizeNumber(max_value, -10000, 10000, null) : existing.max_value
  const sanitizedFloatOkValue = float_ok_value !== undefined ? sanitizeInteger(float_ok_value, 0, 1, existing.float_ok_value) : existing.float_ok_value
  const sanitizedAlertsEnabled = alerts_enabled !== undefined ? (alerts_enabled ? 1 : 0) : existing.alerts_enabled

  db.prepare(`
    UPDATE sensors
    SET name = ?, type = ?, unit = ?, color = ?, icon = ?, min_value = ?, max_value = ?, sensor_type = ?, float_ok_value = ?, alerts_enabled = ?
    WHERE id = ?
  `).run(
    sanitizedName,
    sanitizedType,
    sanitizedUnit,
    validatedColor,
    validatedIcon,
    sanitizedMinValue,
    sanitizedMaxValue,
    validatedSensorType,
    sanitizedFloatOkValue,
    sanitizedAlertsEnabled,
    req.params.id
  )

  const sensor = db.prepare('SELECT * FROM sensors WHERE id = ?').get(req.params.id)
  res.json(sensor)
})

// Delete sensor
app.delete('/api/sensors/:id', (req, res) => {
  // Validate ID format
  if (!isValidUUID(req.params.id)) {
    return res.status(400).json({ error: 'Invalid sensor ID format' })
  }

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
  // Validate ID format
  if (!isValidUUID(req.params.id)) {
    return res.status(400).json({ error: 'Invalid sensor ID format' })
  }

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
  // Validate ID format
  if (!isValidUUID(req.params.id)) {
    return res.status(400).json({ error: 'Invalid specimen ID format' })
  }

  const specimen = db.prepare('SELECT * FROM specimens WHERE id = ?').get(req.params.id)
  if (!specimen) {
    return res.status(404).json({ error: 'Specimen not found' })
  }
  res.json(specimen)
})

// Create new specimen
app.post('/api/specimens', (req, res) => {
  const { name, species, health, acquired_at, notes, image } = req.body

  // Validate required fields
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Name is required' })
  }

  // Validate image if provided
  if (image && !isValidBase64Image(image)) {
    return res.status(400).json({ error: 'Invalid image format or size (max 5MB)' })
  }

  // Validate date if provided
  if (acquired_at && !isValidDateString(acquired_at)) {
    return res.status(400).json({ error: 'Invalid date format (use YYYY-MM-DD)' })
  }

  const id = generateId()

  // Sanitize all inputs
  const sanitizedName = sanitizeString(name, 100)
  const sanitizedSpecies = sanitizeString(species || '', 100)
  const validatedHealth = validateEnum(health, ALLOWED_HEALTH_STATUS, 'excellent')
  const sanitizedNotes = sanitizeString(notes || '', 2000)

  db.prepare(`
    INSERT INTO specimens (id, name, species, health, acquired_at, notes, image)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    sanitizedName,
    sanitizedSpecies,
    validatedHealth,
    acquired_at || getDateInTimezone(new Date().toISOString(), getUserTimezone()),
    sanitizedNotes,
    image || null
  )

  const specimen = db.prepare('SELECT * FROM specimens WHERE id = ?').get(id)
  res.status(201).json(specimen)
})

// Update specimen
app.put('/api/specimens/:id', (req, res) => {
  // Validate ID format
  if (!isValidUUID(req.params.id)) {
    return res.status(400).json({ error: 'Invalid specimen ID format' })
  }

  const existing = db.prepare('SELECT * FROM specimens WHERE id = ?').get(req.params.id)
  if (!existing) {
    return res.status(404).json({ error: 'Specimen not found' })
  }

  const { name, species, health, acquired_at, notes, image } = req.body

  // Validate image if provided
  if (image && !isValidBase64Image(image)) {
    return res.status(400).json({ error: 'Invalid image format or size (max 5MB)' })
  }

  // Validate date if provided
  if (acquired_at && !isValidDateString(acquired_at)) {
    return res.status(400).json({ error: 'Invalid date format (use YYYY-MM-DD)' })
  }

  // Sanitize inputs, keeping existing values if not provided
  const sanitizedName = name ? sanitizeString(name, 100) : existing.name
  const sanitizedSpecies = species !== undefined ? sanitizeString(species, 100) : existing.species
  const validatedHealth = health ? validateEnum(health, ALLOWED_HEALTH_STATUS, existing.health) : existing.health
  const sanitizedNotes = notes !== undefined ? sanitizeString(notes, 2000) : existing.notes

  db.prepare(`
    UPDATE specimens
    SET name = ?, species = ?, health = ?, acquired_at = ?, notes = ?, image = ?
    WHERE id = ?
  `).run(
    sanitizedName,
    sanitizedSpecies,
    validatedHealth,
    acquired_at ?? existing.acquired_at,
    sanitizedNotes,
    image !== undefined ? image : existing.image,
    req.params.id
  )

  const specimen = db.prepare('SELECT * FROM specimens WHERE id = ?').get(req.params.id)
  res.json(specimen)
})

// Delete specimen
app.delete('/api/specimens/:id', (req, res) => {
  // Validate ID format
  if (!isValidUUID(req.params.id)) {
    return res.status(400).json({ error: 'Invalid specimen ID format' })
  }

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
  // Validate ID format
  if (!isValidUUID(req.params.id)) {
    return res.status(400).json({ error: 'Invalid specimen ID format' })
  }

  const notes = db.prepare(`
    SELECT * FROM specimen_notes
    WHERE specimen_id = ?
    ORDER BY created_at DESC
  `).all(req.params.id)
  res.json(notes)
})

// Add note to specimen
app.post('/api/specimens/:id/notes', (req, res) => {
  // Validate ID format
  if (!isValidUUID(req.params.id)) {
    return res.status(400).json({ error: 'Invalid specimen ID format' })
  }

  const { content } = req.body

  if (!content || typeof content !== 'string' || !content.trim()) {
    return res.status(400).json({ error: 'Note content is required' })
  }

  const existing = db.prepare('SELECT * FROM specimens WHERE id = ?').get(req.params.id)
  if (!existing) {
    return res.status(404).json({ error: 'Specimen not found' })
  }

  const id = generateId()
  const sanitizedContent = sanitizeString(content, 5000)

  db.prepare(`
    INSERT INTO specimen_notes (id, specimen_id, content)
    VALUES (?, ?, ?)
  `).run(id, req.params.id, sanitizedContent)

  const note = db.prepare('SELECT * FROM specimen_notes WHERE id = ?').get(id)
  res.status(201).json(note)
})

// Delete a note
app.delete('/api/specimens/:specimenId/notes/:noteId', (req, res) => {
  // Validate ID formats
  if (!isValidUUID(req.params.specimenId) || !isValidUUID(req.params.noteId)) {
    return res.status(400).json({ error: 'Invalid ID format' })
  }

  const existing = db.prepare('SELECT * FROM specimen_notes WHERE id = ?').get(req.params.noteId)
  if (!existing) {
    return res.status(404).json({ error: 'Note not found' })
  }

  db.prepare('DELETE FROM specimen_notes WHERE id = ?').run(req.params.noteId)
  res.json({ success: true })
})

// Clear all notes for a specimen
app.delete('/api/specimens/:id/notes', (req, res) => {
  // Validate ID format
  if (!isValidUUID(req.params.id)) {
    return res.status(400).json({ error: 'Invalid specimen ID format' })
  }

  const existing = db.prepare('SELECT * FROM specimens WHERE id = ?').get(req.params.id)
  if (!existing) {
    return res.status(404).json({ error: 'Specimen not found' })
  }

  db.prepare('DELETE FROM specimen_notes WHERE specimen_id = ?').run(req.params.id)
  res.json({ success: true })
})

// ============ MAINTENANCE TASKS ============

// Track maintenance notifications sent to prevent spam (reset daily)
const maintenanceNotificationsSent = {}
let lastMaintenanceNotificationDate = null

// Check and send maintenance reminder notifications
async function checkMaintenanceReminders() {
  const pushoverSettings = getPushoverSettings()
  if (!pushoverSettings.maintenanceEnabled || !pushoverSettings.token || !pushoverSettings.user) {
    return
  }

  const timezone = getUserTimezone()
  const todayStr = getDateInTimezone(new Date().toISOString(), timezone)

  // Reset tracking if it's a new day
  if (lastMaintenanceNotificationDate !== todayStr) {
    Object.keys(maintenanceNotificationsSent).forEach(key => delete maintenanceNotificationsSent[key])
    lastMaintenanceNotificationDate = todayStr
  }

  const tasks = db.prepare('SELECT * FROM maintenance_tasks').all()

  for (const task of tasks) {
    // Skip if already notified today
    if (maintenanceNotificationsSent[task.id]) continue

    const lastCompletion = db.prepare(`
      SELECT * FROM maintenance_completions
      WHERE task_id = ?
      ORDER BY completed_at DESC LIMIT 1
    `).get(task.id)

    let isDue = true

    if (lastCompletion) {
      const lastDateStr = getDateInTimezone(lastCompletion.completed_at, timezone)
      const lastDate = new Date(lastDateStr + 'T00:00:00')
      const nowDate = new Date(todayStr + 'T00:00:00')
      const diffMs = nowDate - lastDate
      const daysSinceLast = Math.floor(diffMs / (1000 * 60 * 60 * 24))
      isDue = daysSinceLast >= task.interval_days
    }

    if (isDue) {
      maintenanceNotificationsSent[task.id] = true
      await sendPushoverNotification(
        '🔧 Maintenance Due',
        `${task.name} is due for maintenance`,
        0
      )
    }
  }
}

// Get all maintenance tasks with their status
app.get('/api/maintenance/tasks', (req, res) => {
  // Check for maintenance reminders on each request
  checkMaintenanceReminders()

  const tasks = db.prepare(`
    SELECT * FROM maintenance_tasks ORDER BY created_at ASC
  `).all()

  // Add status info to each task
  const timezone = getUserTimezone()

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
      // Calculate days difference using the user's timezone
      const lastDateStr = getDateInTimezone(lastCompletion.completed_at, timezone)
      const nowDateStr = getDateInTimezone(new Date().toISOString(), timezone)

      // Parse the YYYY-MM-DD strings to calculate day difference
      const lastDate = new Date(lastDateStr + 'T00:00:00')
      const nowDate = new Date(nowDateStr + 'T00:00:00')
      const diffMs = nowDate - lastDate
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
  const { name, icon, interval_days, show_percentage } = req.body

  // Validate required fields
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Name is required' })
  }

  const id = generateId()

  // Sanitize inputs
  const sanitizedName = sanitizeString(name, 100)
  const validatedIcon = validateEnum(icon, ALLOWED_ICONS, 'build')
  const sanitizedInterval = sanitizeInteger(interval_days, 1, 365, 7)

  db.prepare(`
    INSERT INTO maintenance_tasks (id, name, icon, interval_days, show_percentage)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, sanitizedName, validatedIcon, sanitizedInterval, show_percentage ? 1 : 0)

  const task = db.prepare('SELECT * FROM maintenance_tasks WHERE id = ?').get(id)
  res.status(201).json(task)
})

// Update a maintenance task
app.put('/api/maintenance/tasks/:id', (req, res) => {
  // Validate ID format
  if (!isValidUUID(req.params.id)) {
    return res.status(400).json({ error: 'Invalid task ID format' })
  }

  const existing = db.prepare('SELECT * FROM maintenance_tasks WHERE id = ?').get(req.params.id)
  if (!existing) {
    return res.status(404).json({ error: 'Task not found' })
  }

  const { name, icon, interval_days, show_percentage } = req.body

  // Sanitize inputs
  const sanitizedName = name ? sanitizeString(name, 100) : existing.name
  const validatedIcon = icon ? validateEnum(icon, ALLOWED_ICONS, existing.icon) : existing.icon
  const sanitizedInterval = interval_days !== undefined ? sanitizeInteger(interval_days, 1, 365, existing.interval_days) : existing.interval_days

  db.prepare(`
    UPDATE maintenance_tasks SET
      name = ?,
      icon = ?,
      interval_days = ?,
      show_percentage = ?
    WHERE id = ?
  `).run(
    sanitizedName,
    validatedIcon,
    sanitizedInterval,
    show_percentage !== undefined ? (show_percentage ? 1 : 0) : existing.show_percentage,
    req.params.id
  )

  const task = db.prepare('SELECT * FROM maintenance_tasks WHERE id = ?').get(req.params.id)
  res.json(task)
})

// Delete a maintenance task
app.delete('/api/maintenance/tasks/:id', (req, res) => {
  // Validate ID format
  if (!isValidUUID(req.params.id)) {
    return res.status(400).json({ error: 'Invalid task ID format' })
  }

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
  // Validate ID format
  if (!isValidUUID(req.params.id)) {
    return res.status(400).json({ error: 'Invalid task ID format' })
  }

  const completions = db.prepare(`
    SELECT * FROM maintenance_completions
    WHERE task_id = ?
    ORDER BY completed_at DESC
  `).all(req.params.id)

  res.json(completions)
})

// Log a completion for a task
app.post('/api/maintenance/tasks/:id/completions', (req, res) => {
  // Validate ID format
  if (!isValidUUID(req.params.id)) {
    return res.status(400).json({ error: 'Invalid task ID format' })
  }

  const task = db.prepare('SELECT * FROM maintenance_tasks WHERE id = ?').get(req.params.id)
  if (!task) {
    return res.status(404).json({ error: 'Task not found' })
  }

  const { percentage, notes } = req.body

  // Sanitize inputs
  const sanitizedPercentage = sanitizeInteger(percentage, 0, 100, null)
  const sanitizedNotes = notes ? sanitizeString(notes, 500) : null

  const id = generateId()

  db.prepare(`
    INSERT INTO maintenance_completions (id, task_id, percentage, notes)
    VALUES (?, ?, ?, ?)
  `).run(id, req.params.id, sanitizedPercentage, sanitizedNotes)

  const completion = db.prepare('SELECT * FROM maintenance_completions WHERE id = ?').get(id)
  res.status(201).json(completion)
})

// Delete a completion
app.delete('/api/maintenance/tasks/:id/completions/:completionId', (req, res) => {
  // Validate ID formats
  if (!isValidUUID(req.params.id) || !isValidUUID(req.params.completionId)) {
    return res.status(400).json({ error: 'Invalid ID format' })
  }

  const existing = db.prepare('SELECT * FROM maintenance_completions WHERE id = ?').get(req.params.completionId)
  if (!existing) {
    return res.status(404).json({ error: 'Completion not found' })
  }

  db.prepare('DELETE FROM maintenance_completions WHERE id = ?').run(req.params.completionId)
  res.json({ success: true })
})

// ============ WATER PARAMETERS (manual testing) ============

// Track water parameter notifications sent to prevent spam (reset daily)
const waterParamNotificationsSent = {}
let lastWaterParamNotificationDate = null

// Check and send water parameter testing reminders
async function checkWaterParamReminders() {
  const pushoverSettings = getPushoverSettings()
  if (!pushoverSettings.maintenanceEnabled || !pushoverSettings.token || !pushoverSettings.user) {
    return
  }

  const timezone = getUserTimezone()
  const todayStr = getDateInTimezone(new Date().toISOString(), timezone)

  // Reset tracking if it's a new day
  if (lastWaterParamNotificationDate !== todayStr) {
    Object.keys(waterParamNotificationsSent).forEach(key => delete waterParamNotificationsSent[key])
    lastWaterParamNotificationDate = todayStr
  }

  const params = db.prepare('SELECT * FROM water_parameters WHERE interval_days > 0').all()

  for (const param of params) {
    // Skip if already notified today
    if (waterParamNotificationsSent[param.id]) continue

    // Get the latest reading
    const lastReading = db.prepare(`
      SELECT * FROM water_parameter_readings
      WHERE parameter_id = ?
      ORDER BY reading_date DESC LIMIT 1
    `).get(param.id)

    let isDue = true

    if (lastReading) {
      const lastDate = new Date(lastReading.reading_date + 'T00:00:00')
      const nowDate = new Date(todayStr + 'T00:00:00')
      const diffMs = nowDate - lastDate
      const daysSinceLast = Math.floor(diffMs / (1000 * 60 * 60 * 24))
      isDue = daysSinceLast >= param.interval_days
    }

    if (isDue) {
      waterParamNotificationsSent[param.id] = true
      await sendPushoverNotification(
        '🧪 Testing Reminder',
        `${param.name} is due for testing`,
        0
      )
    }
  }
}

// Get all water parameters with latest reading
app.get('/api/water-parameters', (req, res) => {
  // Check for water parameter reminders on each request
  checkWaterParamReminders()

  const timezone = getUserTimezone()
  const todayStr = getDateInTimezone(new Date().toISOString(), timezone)

  const params = db.prepare(`
    SELECT * FROM water_parameters ORDER BY sort_order ASC
  `).all()

  const paramsWithData = params.map(param => {
    // Get today's reading
    const todayReading = db.prepare(`
      SELECT * FROM water_parameter_readings
      WHERE parameter_id = ? AND reading_date = ?
    `).get(param.id, todayStr)

    // Get readings for the past month
    const oneMonthAgo = new Date()
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1)
    const oneMonthAgoStr = getDateInTimezone(oneMonthAgo.toISOString(), timezone)

    const readings = db.prepare(`
      SELECT * FROM water_parameter_readings
      WHERE parameter_id = ? AND reading_date >= ?
      ORDER BY reading_date DESC
    `).all(param.id, oneMonthAgoStr)

    // Calculate if testing is due
    let isDue = false
    let daysSinceLast = null
    let daysUntilDue = null

    if (param.interval_days > 0) {
      const lastReading = readings[0]
      if (lastReading) {
        const lastDate = new Date(lastReading.reading_date + 'T00:00:00')
        const nowDate = new Date(todayStr + 'T00:00:00')
        const diffMs = nowDate - lastDate
        daysSinceLast = Math.floor(diffMs / (1000 * 60 * 60 * 24))
        daysUntilDue = param.interval_days - daysSinceLast
        isDue = daysSinceLast >= param.interval_days
      } else {
        isDue = true
      }
    }

    return {
      ...param,
      todayValue: todayReading?.value ?? null,
      todayReadingId: todayReading?.id ?? null,
      readings,
      isDue,
      daysSinceLast,
      daysUntilDue
    }
  })

  res.json(paramsWithData)
})

// Create a new water parameter
app.post('/api/water-parameters', (req, res) => {
  const { name, unit, color, interval_days, target_value } = req.body

  // Validate required fields
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Name is required' })
  }
  if (!unit || typeof unit !== 'string' || !unit.trim()) {
    return res.status(400).json({ error: 'Unit is required' })
  }

  const id = generateId()
  const maxOrder = db.prepare('SELECT MAX(sort_order) as max FROM water_parameters').get()
  const sortOrder = (maxOrder?.max || 0) + 1

  // Sanitize inputs
  const sanitizedName = sanitizeString(name, 50)
  const sanitizedUnit = sanitizeString(unit, 20)
  const validatedColor = validateEnum(color, ALLOWED_COLORS, 'cyan')
  const sanitizedInterval = sanitizeInteger(interval_days, 0, 365, 0)
  const sanitizedTarget = target_value ? sanitizeString(target_value, 50) : null

  db.prepare(`
    INSERT INTO water_parameters (id, name, unit, color, sort_order, interval_days, target_value)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, sanitizedName, sanitizedUnit, validatedColor, sortOrder, sanitizedInterval, sanitizedTarget)

  const param = db.prepare('SELECT * FROM water_parameters WHERE id = ?').get(id)
  res.status(201).json(param)
})

// Helper to validate water parameter IDs (UUIDs or short alphanumeric for defaults)
function isValidParamId(id) {
  return id && typeof id === 'string' && id.length <= 50 && /^[a-zA-Z0-9-]+$/.test(id)
}

// Update a water parameter
app.put('/api/water-parameters/:id', (req, res) => {
  // Validate ID format
  if (!isValidParamId(req.params.id)) {
    return res.status(400).json({ error: 'Invalid parameter ID format' })
  }

  const existing = db.prepare('SELECT * FROM water_parameters WHERE id = ?').get(req.params.id)
  if (!existing) {
    return res.status(404).json({ error: 'Parameter not found' })
  }

  const { name, unit, color, interval_days, target_value } = req.body

  // Sanitize inputs
  const sanitizedName = name ? sanitizeString(name, 50) : existing.name
  const sanitizedUnit = unit ? sanitizeString(unit, 20) : existing.unit
  const validatedColor = color ? validateEnum(color, ALLOWED_COLORS, existing.color) : existing.color
  const sanitizedInterval = interval_days !== undefined ? sanitizeInteger(interval_days, 0, 365, existing.interval_days) : existing.interval_days
  const sanitizedTarget = target_value !== undefined ? (target_value ? sanitizeString(target_value, 50) : null) : existing.target_value

  db.prepare(`
    UPDATE water_parameters SET name = ?, unit = ?, color = ?, interval_days = ?, target_value = ? WHERE id = ?
  `).run(sanitizedName, sanitizedUnit, validatedColor, sanitizedInterval, sanitizedTarget, req.params.id)

  const param = db.prepare('SELECT * FROM water_parameters WHERE id = ?').get(req.params.id)
  res.json(param)
})

// Delete a water parameter
app.delete('/api/water-parameters/:id', (req, res) => {
  // Validate ID format
  if (!isValidParamId(req.params.id)) {
    return res.status(400).json({ error: 'Invalid parameter ID format' })
  }

  const existing = db.prepare('SELECT * FROM water_parameters WHERE id = ?').get(req.params.id)
  if (!existing) {
    return res.status(404).json({ error: 'Parameter not found' })
  }

  db.prepare('DELETE FROM water_parameter_readings WHERE parameter_id = ?').run(req.params.id)
  db.prepare('DELETE FROM water_parameters WHERE id = ?').run(req.params.id)

  res.json({ success: true })
})

// Add or update a reading for today
app.post('/api/water-parameters/:id/readings', (req, res) => {
  // Validate ID format
  if (!isValidParamId(req.params.id)) {
    return res.status(400).json({ error: 'Invalid parameter ID format' })
  }

  const { value } = req.body

  // Validate value
  const sanitizedValue = sanitizeNumber(value, -10000, 100000, null)
  if (sanitizedValue === null) {
    return res.status(400).json({ error: 'Valid numeric value is required' })
  }

  const param = db.prepare('SELECT * FROM water_parameters WHERE id = ?').get(req.params.id)
  if (!param) {
    return res.status(404).json({ error: 'Parameter not found' })
  }

  const timezone = getUserTimezone()
  const todayStr = getDateInTimezone(new Date().toISOString(), timezone)

  // Check if there's already a reading for today
  const existing = db.prepare(`
    SELECT * FROM water_parameter_readings
    WHERE parameter_id = ? AND reading_date = ?
  `).get(req.params.id, todayStr)

  if (existing) {
    // Update existing reading
    db.prepare(`
      UPDATE water_parameter_readings SET value = ? WHERE id = ?
    `).run(sanitizedValue, existing.id)
  } else {
    // Insert new reading
    const id = generateId()
    db.prepare(`
      INSERT INTO water_parameter_readings (id, parameter_id, value, reading_date)
      VALUES (?, ?, ?, ?)
    `).run(id, req.params.id, sanitizedValue, todayStr)
  }

  res.json({ success: true, date: todayStr, value: sanitizedValue })
})

// Get all readings for a parameter
app.get('/api/water-parameters/:id/readings', (req, res) => {
  // Validate ID format
  if (!isValidParamId(req.params.id)) {
    return res.status(400).json({ error: 'Invalid parameter ID format' })
  }

  const param = db.prepare('SELECT * FROM water_parameters WHERE id = ?').get(req.params.id)
  if (!param) {
    return res.status(404).json({ error: 'Parameter not found' })
  }

  const readings = db.prepare(`
    SELECT * FROM water_parameter_readings
    WHERE parameter_id = ?
    ORDER BY reading_date DESC
  `).all(req.params.id)

  res.json(readings)
})

// Delete a specific reading
app.delete('/api/water-parameters/:id/readings/:readingId', (req, res) => {
  // Validate ID formats
  if (!isValidParamId(req.params.id) || !isValidUUID(req.params.readingId)) {
    return res.status(400).json({ error: 'Invalid ID format' })
  }

  const existing = db.prepare('SELECT * FROM water_parameter_readings WHERE id = ?').get(req.params.readingId)
  if (!existing) {
    return res.status(404).json({ error: 'Reading not found' })
  }

  db.prepare('DELETE FROM water_parameter_readings WHERE id = ?').run(req.params.readingId)
  res.json({ success: true })
})

// Update a specific reading
app.put('/api/water-parameters/:id/readings/:readingId', (req, res) => {
  // Validate ID formats
  if (!isValidParamId(req.params.id) || !isValidUUID(req.params.readingId)) {
    return res.status(400).json({ error: 'Invalid ID format' })
  }

  const { value } = req.body

  // Validate value
  const sanitizedValue = sanitizeNumber(value, -10000, 100000, null)
  if (sanitizedValue === null) {
    return res.status(400).json({ error: 'Valid numeric value is required' })
  }

  const existing = db.prepare('SELECT * FROM water_parameter_readings WHERE id = ?').get(req.params.readingId)
  if (!existing) {
    return res.status(404).json({ error: 'Reading not found' })
  }

  db.prepare('UPDATE water_parameter_readings SET value = ? WHERE id = ?').run(sanitizedValue, req.params.readingId)
  res.json({ success: true })
})

// ============ DATA INGESTION (for microcontrollers) ============

// Track last alert state per sensor to prevent spam
const lastAlertState = {}
// Track when the last alert was sent for each sensor (for repeat notifications)
const lastAlertSentTime = {}

// Check if a reading is out of range and send notification
async function checkAndNotifyAlert(sensor, value) {
  // Skip if sensor has alerts disabled
  if (sensor.alerts_enabled === 0) {
    return
  }

  const pushoverSettings = getPushoverSettings()
  if (!pushoverSettings.alertsEnabled || !pushoverSettings.token || !pushoverSettings.user) {
    return
  }

  let isAlert = false
  let alertMessage = ''

  if (sensor.sensor_type === 'float') {
    const okValue = sensor.float_ok_value ?? 1
    isAlert = value !== okValue
    alertMessage = isAlert
      ? `${sensor.name} is in ALERT state (reading: ${value})`
      : `${sensor.name} is back to normal`
  } else {
    // Value sensor
    if (sensor.min_value !== null && value < sensor.min_value) {
      isAlert = true
      alertMessage = `${sensor.name} is TOO LOW: ${value}${sensor.unit} (min: ${sensor.min_value}${sensor.unit})`
    } else if (sensor.max_value !== null && value > sensor.max_value) {
      isAlert = true
      alertMessage = `${sensor.name} is TOO HIGH: ${value}${sensor.unit} (max: ${sensor.max_value}${sensor.unit})`
    }
  }

  const prevState = lastAlertState[sensor.id]
  const now = Date.now()

  if (isAlert) {
    // Check if we should send a notification
    let shouldNotify = false

    if (prevState !== true) {
      // State just changed to alert - always notify
      shouldNotify = true
      lastAlertState[sensor.id] = true
    } else {
      // Already in alert state - check repeat interval
      const repeatMinutes = pushoverSettings.alertRepeat || 0
      if (repeatMinutes > 0) {
        const lastSent = lastAlertSentTime[sensor.id] || 0
        const repeatMs = repeatMinutes * 60 * 1000
        if (now - lastSent >= repeatMs) {
          shouldNotify = true
        }
      }
    }

    if (shouldNotify) {
      lastAlertSentTime[sensor.id] = now
      await sendPushoverNotification(
        `⚠️ ${sensor.type} Alert`,
        alertMessage,
        1 // High priority
      )
    }
  } else {
    // Not in alert
    if (prevState === true) {
      // Was in alert, now normal - send recovery notification
      lastAlertState[sensor.id] = false
      delete lastAlertSentTime[sensor.id]
      await sendPushoverNotification(
        `✓ ${sensor.type} Normal`,
        `${sensor.name} is back within normal range: ${value}${sensor.unit || ''}`,
        0
      )
    }
  }
}

// Post reading via API key (with stricter rate limiting)
app.post('/api/data/:api_key', dataIngestionLimit, async (req, res) => {
  // Validate API key format
  if (!isValidApiKey(req.params.api_key)) {
    return res.status(400).json({ error: 'Invalid API key format' })
  }

  const { value } = req.body

  // Validate value
  const numValue = sanitizeNumber(value, -100000, 100000, null)
  if (numValue === null) {
    return res.status(400).json({ error: 'Valid numeric value is required' })
  }

  const sensor = db.prepare('SELECT * FROM sensors WHERE api_key = ?').get(req.params.api_key)
  if (!sensor) {
    return res.status(404).json({ error: 'Invalid API key' })
  }

  // For float switches, normalize to 0 or 1
  let finalValue = numValue
  if (sensor.sensor_type === 'float') {
    finalValue = numValue ? 1 : 0
  }

  db.prepare('INSERT INTO readings (sensor_id, value) VALUES (?, ?)').run(sensor.id, finalValue)

  // Check for alerts and send notification
  checkAndNotifyAlert(sensor, finalValue)

  res.json({ success: true, sensor_name: sensor.name })
})

// GET endpoint for simple microcontrollers that can't POST (with stricter rate limiting)
app.get('/api/data/:api_key/:value', dataIngestionLimit, async (req, res) => {
  const { api_key, value } = req.params

  // Validate API key format
  if (!isValidApiKey(api_key)) {
    return res.status(400).json({ error: 'Invalid API key format' })
  }

  // Validate value
  const numValue = sanitizeNumber(value, -100000, 100000, null)
  if (numValue === null) {
    return res.status(400).json({ error: 'Invalid value' })
  }

  const sensor = db.prepare('SELECT * FROM sensors WHERE api_key = ?').get(api_key)
  if (!sensor) {
    return res.status(404).json({ error: 'Invalid API key' })
  }

  // For float switches, normalize to 0 or 1
  let finalValue = numValue
  if (sensor.sensor_type === 'float') {
    finalValue = numValue ? 1 : 0
  }

  db.prepare('INSERT INTO readings (sensor_id, value) VALUES (?, ?)').run(sensor.id, finalValue)

  // Check for alerts and send notification
  checkAndNotifyAlert(sensor, finalValue)

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
  // Sanitize the type parameter
  const sanitizedType = sanitizeString(req.params.type, 50)
  if (!sanitizedType) {
    return res.json({ readings: [], dailySummary: [], sensor: null })
  }

  const sensor = db.prepare(`
    SELECT * FROM sensors WHERE LOWER(type) = LOWER(?) LIMIT 1
  `).get(sanitizedType)

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
  const timezone = getUserTimezone()

  readings.forEach(r => {
    // Convert to user's timezone before extracting date
    const date = getDateInTimezone(r.recorded_at, timezone)

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

// Allowed settings keys (whitelist to prevent arbitrary key injection)
const ALLOWED_SETTINGS_KEYS = [
  'timezone',
  'pushover_token',
  'pushover_user',
  'pushover_alerts',
  'pushover_maintenance',
  'pushover_alert_repeat'
]

// Redact sensitive values for display (show last 4 chars)
function redactValue(value) {
  if (!value || value.length <= 4) return '••••••••'
  return '••••••••' + value.slice(-4)
}

// Get all settings
app.get('/api/settings', (req, res) => {
  const settings = db.prepare('SELECT key, value FROM app_settings').all()
  const settingsObj = {}
  settings.forEach(s => {
    // Only include allowed settings
    if (!ALLOWED_SETTINGS_KEYS.includes(s.key)) return

    // Redact sensitive Pushover keys
    if ((s.key === 'pushover_token' || s.key === 'pushover_user') && s.value) {
      settingsObj[s.key] = redactValue(s.value)
    } else {
      settingsObj[s.key] = s.value
    }
  })
  res.json(settingsObj)
})

// Update a setting (with rate limiting)
app.put('/api/settings/:key', settingsRateLimit, (req, res) => {
  const { key } = req.params
  const { value } = req.body

  // Validate key is allowed
  if (!ALLOWED_SETTINGS_KEYS.includes(key)) {
    return res.status(400).json({ error: 'Invalid setting key' })
  }

  // Don't update if value is redacted (starts with •) - user didn't change it
  if (value && typeof value === 'string' && value.startsWith('••••')) {
    return res.json({ success: true, key, value, skipped: true })
  }

  // Sanitize value based on key type
  let sanitizedValue = value
  if (key === 'timezone') {
    // Validate timezone (basic check - should be a valid IANA timezone)
    if (typeof value !== 'string' || value.length > 50) {
      return res.status(400).json({ error: 'Invalid timezone' })
    }
    sanitizedValue = sanitizeString(value, 50)
  } else if (key === 'pushover_token' || key === 'pushover_user') {
    // API keys should be alphanumeric, max 50 chars
    if (typeof value !== 'string' || value.length > 50) {
      return res.status(400).json({ error: 'Invalid API key format' })
    }
    sanitizedValue = value.trim().slice(0, 50)
  } else if (key === 'pushover_alerts' || key === 'pushover_maintenance') {
    // Boolean-like values, should be '0' or '1'
    sanitizedValue = value === '1' || value === 1 || value === true ? '1' : '0'
  } else if (key === 'pushover_alert_repeat') {
    // Numeric value for minutes (0, 5, 30, 60, 1440)
    const numVal = parseInt(value, 10)
    const allowedIntervals = [0, 5, 30, 60, 1440]
    sanitizedValue = allowedIntervals.includes(numVal) ? String(numVal) : '0'
  }

  db.prepare(`
    INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)
  `).run(key, sanitizedValue)

  res.json({ success: true, key, value: sanitizedValue })
})

// ============ PUSHOVER NOTIFICATIONS ============

// Helper function to get Pushover settings
function getPushoverSettings() {
  const token = db.prepare("SELECT value FROM app_settings WHERE key = 'pushover_token'").get()
  const user = db.prepare("SELECT value FROM app_settings WHERE key = 'pushover_user'").get()
  const alerts = db.prepare("SELECT value FROM app_settings WHERE key = 'pushover_alerts'").get()
  const maintenance = db.prepare("SELECT value FROM app_settings WHERE key = 'pushover_maintenance'").get()
  const alertRepeat = db.prepare("SELECT value FROM app_settings WHERE key = 'pushover_alert_repeat'").get()

  return {
    token: token?.value || '',
    user: user?.value || '',
    alertsEnabled: alerts?.value !== '0',
    maintenanceEnabled: maintenance?.value !== '0',
    alertRepeat: parseInt(alertRepeat?.value || '0', 10)
  }
}

// Send a Pushover notification
async function sendPushoverNotification(title, message, priority = 0) {
  const settings = getPushoverSettings()

  if (!settings.token || !settings.user) {
    return { success: false, error: 'Pushover not configured' }
  }

  try {
    const params = new URLSearchParams({
      token: settings.token,
      user: settings.user,
      title: title,
      message: message,
      priority: priority.toString()
    })

    const response = await fetch('https://api.pushover.net/1/messages.json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    })

    const data = await response.json()

    if (data.status === 1) {
      return { success: true }
    } else {
      return { success: false, error: data.errors?.join(', ') || 'Unknown error' }
    }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

// Test Pushover notification
app.post('/api/pushover/test', async (req, res) => {
  const result = await sendPushoverNotification(
    'Deep Sea Observatory',
    'Test notification - Pushover is configured correctly!'
  )

  if (result.success) {
    res.json({ success: true })
  } else {
    res.status(400).json({ error: result.error })
  }
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
