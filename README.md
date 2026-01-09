# Deep Sea Observatory

A self-hosted aquarium monitoring and maintenance tracking application designed to run on your local network.

## Overview

Deep Sea Observatory is a full-stack web application for monitoring aquarium sensors, tracking specimens, managing maintenance schedules, and logging water parameters. It provides a mobile-friendly dashboard with real-time sensor data and push notifications via Pushover.

### Features

- **Sensor Monitoring** - Connect microcontrollers (Arduino, ESP32, etc.) to push data via simple HTTP endpoints. Supports value sensors (temperature, pH, salinity) and float switches (water level detection).
- **Specimen Registry** - Track your aquarium inhabitants with photos, health status, acquisition dates, and notes.
- **Maintenance Scheduling** - Create recurring maintenance tasks with customizable intervals and completion tracking.
- **Water Parameters** - Log manual water tests (Alkalinity, Calcium, Magnesium, etc.) with calendar visualization and testing reminders.
- **Push Notifications** - Get alerts via Pushover when sensors go out of range or maintenance is due.
- **Mobile-First Design** - Responsive UI optimized for phones and tablets.

## Tech Stack

- **Frontend**: React 18, Vite, Tailwind CSS
- **Backend**: Node.js, Express
- **Database**: SQLite (via sql.js, stored locally)
- **Notifications**: Pushover API

## Requirements

- Node.js 18+
- npm or yarn
- [Pushover](https://pushover.net/) account (optional, for notifications)

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/aquarium-app.git
   cd aquarium-app
   ```

2. Install dependencies:
   ```bash
   # Install backend dependencies
   cd backend
   npm install

   # Install frontend dependencies
   cd ../frontend
   npm install
   ```

3. Start the application:
   ```bash
   # From the backend directory
   npm start

   # In another terminal, from the frontend directory
   npm run dev
   ```

4. Open your browser to `http://localhost:5173`

## Configuration

### Pushover Notifications

To enable push notifications:

1. Create a [Pushover](https://pushover.net/) account
2. Create an application to get an API token
3. In the app, go to Settings and enter your API token and user key
4. Enable the notification types you want (Sensor Alerts, Maintenance Reminders)

### Sensor Setup

Sensors push data to the app via HTTP GET requests. Each sensor gets a unique API endpoint:

```
GET /api/data/{API_KEY}/{VALUE}
```

Example Arduino/ESP code:
```cpp
#include <HTTPClient.h>

HTTPClient http;
float temperature = 25.5;

// Push reading to Deep Sea Observatory
http.begin("http://192.168.1.100:3001/api/data/your-api-key/" + String(temperature));
http.GET();
http.end();
```

For float switches (water level sensors):
```cpp
int floatState = digitalRead(FLOAT_PIN);  // 0 or 1
http.begin("http://192.168.1.100:3001/api/data/your-api-key/" + String(floatState));
http.GET();
```

Each sensor can be configured with:
- Min/Max normal range (for value sensors)
- OK value (for float switches - which reading means "normal")
- Alert notifications (can be enabled/disabled per sensor)

## Security Notice

This application is designed for **local network use only**. It does not include authentication and should not be exposed to the internet. Run it on your home network behind a firewall.

If you need remote access, consider:
- Using a VPN to access your home network
- Placing it behind a reverse proxy with authentication
- Using a service like Tailscale for secure remote access

## Project Structure

```
aquarium-app/
├── backend/
│   ├── server.js      # Express API server
│   ├── db.js          # SQLite database setup
│   └── data/          # Database files (created automatically)
├── frontend/
│   ├── src/
│   │   ├── components/   # Reusable UI components
│   │   ├── pages/        # Page components
│   │   └── context/      # React context providers
│   └── index.html
└── README.md
```

## API Endpoints

### Sensors
- `GET /api/sensors` - List all sensors
- `POST /api/sensors` - Create a sensor
- `PUT /api/sensors/:id` - Update a sensor
- `DELETE /api/sensors/:id` - Delete a sensor
- `GET /api/data/:api_key/:value` - Push sensor reading (for microcontrollers)

### Specimens
- `GET /api/specimens` - List all specimens
- `POST /api/specimens` - Create a specimen
- `PUT /api/specimens/:id` - Update a specimen
- `DELETE /api/specimens/:id` - Delete a specimen
- `POST /api/specimens/:id/notes` - Add a note

### Maintenance
- `GET /api/maintenance/tasks` - List all tasks with status
- `POST /api/maintenance/tasks` - Create a task
- `PUT /api/maintenance/tasks/:id` - Update a task
- `POST /api/maintenance/tasks/:id/complete` - Mark task complete

### Water Parameters
- `GET /api/water-parameters` - List parameters with readings
- `POST /api/water-parameters` - Create a parameter
- `PUT /api/water-parameters/:id` - Update a parameter
- `POST /api/water-parameters/:id/readings` - Add a reading

### Settings
- `GET /api/settings` - Get app settings
- `PUT /api/settings/:key` - Update a setting

## License

MIT
