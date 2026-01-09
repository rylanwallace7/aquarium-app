/*
 * ESP32 Float Sensor for Deep Sea Observatory
 *
 * Monitors a float switch and reports status to Deep Sea Observatory.
 * Sends 1 when float is HIGH (closed/OK), 0 when LOW (open/alert).
 *
 * Features:
 * - WiFi auto-reconnect with event handlers
 * - Watchdog timer to prevent hangs
 * - Debounced float switch reading
 * - Automatic recovery from WiFi failures
 *
 * Hardware: ESP32-WROOM-32 or similar
 *
 * Configuration:
 * 1. Set your WiFi credentials (SSID, PASSWORD)
 * 2. Set your API endpoint from Deep Sea Observatory sensor setup
 * 3. Set the GPIO pin your float switch is connected to
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <esp_task_wdt.h>

// ============ CONFIGURATION ============
// WiFi credentials
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// Deep Sea Observatory API endpoint (get this from the sensor setup page)
// Format: http://YOUR_SERVER_IP:4000/api/data/YOUR_API_KEY/
const char* serverUrl = "http://YOUR_SERVER_IP:4000/api/data/your-api-key-here/";

// Float sensor pin (connect float switch between this pin and GND)
const int FLOAT_PIN = 13;
// =======================================

// Timing constants
const unsigned long REPORT_INTERVAL = 10000;      // 10 seconds regular report
const unsigned long WIFI_RECONNECT_DELAY = 5000;  // 5 seconds between reconnect attempts
const unsigned long DEBOUNCE_TIME = 50;           // 50ms debounce
const unsigned long HTTP_TIMEOUT = 5000;          // 5 second HTTP timeout
const int MAX_RETRIES = 1;                        // No retries - next cycle will try again
const unsigned long WDT_TIMEOUT = 30;             // Watchdog timeout in seconds
const int MAX_CONSECUTIVE_FAILURES = 5;           // Failures before WiFi reset
const unsigned long WIFI_RESET_COOLDOWN = 30000;  // 30s between full WiFi resets

// State variables
unsigned long lastReportTime = 0;
unsigned long lastWiFiAttempt = 0;
unsigned long lastDebounceTime = 0;
unsigned long lastWiFiReset = 0;
int lastState = -1;
int lastRawState = -1;
int debouncedState = -1;
bool wifiConnected = false;
int pendingState = -1;           // State waiting to be sent
int consecutiveFailures = 0;     // Track send failures

// WiFi event handler
void WiFiEvent(WiFiEvent_t event) {
  switch (event) {
    case ARDUINO_EVENT_WIFI_STA_GOT_IP:
      Serial.print("WiFi connected. IP: ");
      Serial.println(WiFi.localIP());
      wifiConnected = true;
      break;
    case ARDUINO_EVENT_WIFI_STA_DISCONNECTED:
      Serial.println("WiFi disconnected");
      wifiConnected = false;
      break;
    case ARDUINO_EVENT_WIFI_STA_CONNECTED:
      Serial.println("WiFi station connected to AP");
      break;
    default:
      break;
  }
}

void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println();
  Serial.println("ESP32 Float Sensor");
  Serial.println("==================");

  // Configure watchdog timer (ESP32 Arduino Core 3.x API)
  esp_task_wdt_config_t wdt_config = {
    .timeout_ms = WDT_TIMEOUT * 1000,
    .idle_core_mask = 0,
    .trigger_panic = true
  };
  esp_task_wdt_reconfigure(&wdt_config);
  esp_task_wdt_add(NULL);

  // Configure float sensor pin with internal pull-up
  pinMode(FLOAT_PIN, INPUT_PULLUP);

  // Read initial state
  debouncedState = digitalRead(FLOAT_PIN);
  lastRawState = debouncedState;

  // Register WiFi event handler
  WiFi.onEvent(WiFiEvent);

  // Configure WiFi
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.persistent(true);

  // Initial connection
  connectWiFi();
}

void loop() {
  // Reset watchdog
  esp_task_wdt_reset();

  // Read and debounce float sensor
  int rawState = digitalRead(FLOAT_PIN);

  if (rawState != lastRawState) {
    lastDebounceTime = millis();
    lastRawState = rawState;
  }

  if ((millis() - lastDebounceTime) > DEBOUNCE_TIME) {
    if (rawState != debouncedState) {
      debouncedState = rawState;
      Serial.print("State changed: ");
      Serial.println(debouncedState == HIGH ? "OK (1)" : "ALERT (0)");
      pendingState = debouncedState;  // Mark for immediate send
    }
  }

  unsigned long now = millis();

  // Handle WiFi reconnection (non-blocking)
  if (!wifiConnected && (now - lastWiFiAttempt >= WIFI_RECONNECT_DELAY)) {
    connectWiFi();
    lastWiFiAttempt = now;
  }

  // Determine if we need to send
  bool shouldSend = false;
  int stateToSend = debouncedState;

  // Send on state change (prioritize)
  if (pendingState != -1) {
    shouldSend = true;
    stateToSend = pendingState;
  }
  // Or send on regular interval
  else if (now - lastReportTime >= REPORT_INTERVAL) {
    shouldSend = true;
  }

  if (shouldSend && wifiConnected) {
    if (sendReading(stateToSend)) {
      lastReportTime = now;
      pendingState = -1;  // Clear pending
      lastState = stateToSend;
      consecutiveFailures = 0;  // Reset failure counter on success
    } else {
      consecutiveFailures++;
      Serial.print("Send failed (");
      Serial.print(consecutiveFailures);
      Serial.println(" consecutive failures)");

      // If too many failures, do a full WiFi reset
      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES &&
          (now - lastWiFiReset >= WIFI_RESET_COOLDOWN)) {
        Serial.println("Too many failures - performing full WiFi reset");
        resetWiFi();
        lastWiFiReset = now;
        consecutiveFailures = 0;
      }
    }
  }

  // If WiFi appears connected but we keep failing, force a check
  if (consecutiveFailures >= 3 && wifiConnected) {
    if (WiFi.status() != WL_CONNECTED) {
      Serial.println("WiFi status mismatch - updating state");
      wifiConnected = false;
    }
  }

  delay(10);  // Short delay for stability
}

void resetWiFi() {
  Serial.println("Resetting WiFi...");

  esp_task_wdt_reset();

  WiFi.disconnect(true);
  delay(100);
  WiFi.mode(WIFI_OFF);
  delay(100);
  WiFi.mode(WIFI_STA);
  delay(100);

  wifiConnected = false;
  lastWiFiAttempt = 0;  // Allow immediate reconnect

  Serial.println("WiFi reset complete, will reconnect...");
}

void connectWiFi() {
  Serial.print("Connecting to WiFi: ");
  Serial.println(ssid);

  // Only disconnect if we're in a bad state
  if (WiFi.status() != WL_CONNECTED && WiFi.status() != WL_IDLE_STATUS) {
    WiFi.disconnect(false);
    delay(100);
  }

  WiFi.begin(ssid, password);

  // Non-blocking - we'll check status in loop via event handler
  // Give it a moment to start
  unsigned long startAttempt = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - startAttempt < 10000) {
    esp_task_wdt_reset();
    delay(250);
    Serial.print(".");
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println(" Connected!");
  } else {
    Serial.println(" Connection attempt timed out");
  }
}

bool sendReading(int state) {
  HTTPClient http;
  bool success = false;

  // Verify WiFi is actually connected before attempting
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi not ready, skipping send");
    wifiConnected = false;
    return false;
  }

  String url = String(serverUrl) + String(state);

  for (int attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    esp_task_wdt_reset();

    Serial.print("Sending ");
    Serial.print(state);
    Serial.print(" (attempt ");
    Serial.print(attempt);
    Serial.println(")");

    http.begin(url);
    http.setTimeout(HTTP_TIMEOUT);
    http.setConnectTimeout(HTTP_TIMEOUT);

    int httpCode = http.GET();

    if (httpCode == HTTP_CODE_OK || httpCode == HTTP_CODE_CREATED || httpCode == HTTP_CODE_NO_CONTENT) {
      Serial.println("OK");
      success = true;
      http.end();
      break;
    } else if (httpCode > 0) {
      // Server responded but with an error - don't retry
      Serial.print("Server error: ");
      Serial.println(httpCode);
      http.end();
      // Still count as "sent" since server got it
      success = true;
      break;
    } else {
      // Connection error - worth retrying
      Serial.print("Error: ");
      Serial.println(http.errorToString(httpCode));

      // Check if WiFi dropped during request
      if (WiFi.status() != WL_CONNECTED) {
        Serial.println("WiFi lost during request");
        wifiConnected = false;
        http.end();
        return false;
      }
    }

    http.end();
  }

  return success;
}
