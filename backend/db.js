import initSqlJs from 'sql.js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const dbPath = path.join(__dirname, 'data', 'aquarium.db')

// Ensure data directory exists
const dataDir = path.join(__dirname, 'data')
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true })
}

// Initialize SQL.js
const SQL = await initSqlJs()

// Load existing database or create new one
let db
if (fs.existsSync(dbPath)) {
  const buffer = fs.readFileSync(dbPath)
  db = new SQL.Database(buffer)
} else {
  db = new SQL.Database()
}

// Create tables
db.run(`
  CREATE TABLE IF NOT EXISTS sensors (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    unit TEXT NOT NULL,
    color TEXT NOT NULL,
    icon TEXT NOT NULL,
    api_key TEXT UNIQUE NOT NULL,
    min_value REAL,
    max_value REAL,
    sensor_type TEXT DEFAULT 'value',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )
`)

db.run(`
  CREATE TABLE IF NOT EXISTS readings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sensor_id TEXT NOT NULL,
    value REAL NOT NULL,
    recorded_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sensor_id) REFERENCES sensors(id) ON DELETE CASCADE
  )
`)

db.run(`
  CREATE INDEX IF NOT EXISTS idx_readings_sensor_time
  ON readings(sensor_id, recorded_at DESC)
`)

db.run(`
  CREATE TABLE IF NOT EXISTS specimens (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    species TEXT,
    health TEXT DEFAULT 'good',
    acquired_at TEXT,
    notes TEXT,
    image TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )
`)

db.run(`
  CREATE TABLE IF NOT EXISTS specimen_notes (
    id TEXT PRIMARY KEY,
    specimen_id TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (specimen_id) REFERENCES specimens(id) ON DELETE CASCADE
  )
`)

db.run(`
  CREATE TABLE IF NOT EXISTS maintenance_tasks (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    icon TEXT DEFAULT 'build',
    interval_days INTEGER DEFAULT 7,
    notification_url TEXT,
    show_percentage INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )
`)

db.run(`
  CREATE TABLE IF NOT EXISTS maintenance_completions (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,
    percentage INTEGER,
    notes TEXT,
    completed_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES maintenance_tasks(id) ON DELETE CASCADE
  )
`)

// Legacy tables (kept for migration)
db.run(`
  CREATE TABLE IF NOT EXISTS water_changes (
    id TEXT PRIMARY KEY,
    percentage INTEGER NOT NULL DEFAULT 10,
    notes TEXT,
    completed_at TEXT DEFAULT CURRENT_TIMESTAMP
  )
`)

db.run(`
  CREATE TABLE IF NOT EXISTS maintenance_settings (
    id TEXT PRIMARY KEY DEFAULT 'main',
    water_change_interval_days INTEGER DEFAULT 7,
    notification_url TEXT,
    last_notification_sent TEXT
  )
`)

db.run(`
  CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )
`)

// Insert default timezone if not exists
try {
  db.run(`INSERT OR IGNORE INTO app_settings (key, value) VALUES ('timezone', 'UTC')`)
} catch (e) { /* ignore */ }

// Migrations
try {
  db.run(`ALTER TABLE sensors ADD COLUMN min_value REAL`)
} catch (e) { /* column already exists */ }

try {
  db.run(`ALTER TABLE sensors ADD COLUMN max_value REAL`)
} catch (e) { /* column already exists */ }

try {
  db.run(`ALTER TABLE sensors ADD COLUMN sensor_type TEXT DEFAULT 'value'`)
} catch (e) { /* column already exists */ }

try {
  db.run(`ALTER TABLE sensors ADD COLUMN float_ok_value INTEGER DEFAULT 1`)
} catch (e) { /* column already exists */ }

// Save database to file
function saveDb() {
  const data = db.export()
  const buffer = Buffer.from(data)
  fs.writeFileSync(dbPath, buffer)
}

// Save periodically and on changes
setInterval(saveDb, 30000) // Save every 30 seconds

// Wrapper to match better-sqlite3 API
const dbWrapper = {
  prepare(sql) {
    return {
      run(...params) {
        db.run(sql, params)
        saveDb()
      },
      get(...params) {
        const stmt = db.prepare(sql)
        stmt.bind(params)
        if (stmt.step()) {
          const row = stmt.getAsObject()
          stmt.free()
          return row
        }
        stmt.free()
        return undefined
      },
      all(...params) {
        const results = []
        const stmt = db.prepare(sql)
        stmt.bind(params)
        while (stmt.step()) {
          results.push(stmt.getAsObject())
        }
        stmt.free()
        return results
      }
    }
  },
  exec(sql) {
    db.run(sql)
    saveDb()
  }
}

export default dbWrapper
