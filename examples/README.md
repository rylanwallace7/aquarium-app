# Sensor Examples

Example Arduino/ESP32 sketches for connecting sensors to Deep Sea Observatory.

## Available Examples

### [esp32-float-sensor](./esp32-float-sensor/)

Monitor a float switch (water level sensor) with an ESP32. Reports OK/ALERT status to Deep Sea Observatory.

## General Usage

1. Create a sensor in Deep Sea Observatory (Hardware page)
2. Copy the API endpoint from the sensor details
3. Configure the example sketch with your WiFi credentials and API endpoint
4. Upload to your microcontroller

## API Format

All sensors push data via HTTP GET:

```
GET http://YOUR_SERVER:4000/api/data/YOUR_SENSOR_ID/VALUE
```

- **Value sensors**: Send the numeric reading (e.g., `25.5` for temperature)
- **Float switches**: Send `0` or `1`

Deep Sea Observatory will automatically detect if a sensor goes offline after 10 minutes of no data.
