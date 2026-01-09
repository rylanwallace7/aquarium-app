# ESP32 Float Sensor

Example Arduino sketch for monitoring a float switch with an ESP32 and reporting to Deep Sea Observatory.

## Hardware

- ESP32-WROOM-32 (or similar ESP32 board)
- Float switch (normally open or normally closed)

## Wiring

Connect your float switch between the GPIO pin (default: GPIO 13) and GND. The internal pull-up resistor is enabled, so no external resistor is needed.

```
Float Switch ──── GPIO 13
     │
     └──────────── GND
```

## Configuration

Edit the following values in `float_sensor.ino`:

```cpp
// WiFi credentials
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// Deep Sea Observatory API endpoint
const char* serverUrl = "http://YOUR_SERVER_IP:4000/api/data/your-sensor-id/";

// Float sensor pin
const int FLOAT_PIN = 13;
```

Get your API endpoint from the Deep Sea Observatory sensor setup page (Hardware > expand sensor > API Endpoint).

## Sensor Configuration in Deep Sea Observatory

1. Create a new sensor with type "Float Switch"
2. Set "OK When Reading Is" based on your float switch:
   - **1 (High/Closed)** - Float switch closes circuit when water level is OK
   - **0 (Low/Open)** - Float switch opens circuit when water level is OK
3. Copy the API endpoint to your sketch

## Features

- **Auto-reconnect**: Automatically reconnects to WiFi if connection is lost
- **Watchdog timer**: Resets the ESP32 if it hangs for more than 30 seconds
- **Debouncing**: 50ms debounce to prevent false triggers from switch bounce
- **Immediate alerts**: State changes are sent immediately, regular updates every 10 seconds
- **Self-healing**: After 5 consecutive failures, performs a full WiFi reset

## Arduino IDE Setup

1. Install ESP32 board support in Arduino IDE
2. Select your ESP32 board (e.g., "ESP32 Dev Module")
3. Upload the sketch

## Serial Monitor

Open Serial Monitor at 115200 baud to see status messages:

```
ESP32 Float Sensor
==================
Connecting to WiFi: YourNetwork
.... Connected!
WiFi connected. IP: xxx.xxx.xxx.xxx
Sending 1 (attempt 1)
OK
State changed: ALERT (0)
Sending 0 (attempt 1)
OK
```
