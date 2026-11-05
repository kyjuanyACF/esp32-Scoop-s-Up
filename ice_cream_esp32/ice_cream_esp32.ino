// Ice Cream Stacker — ESP32 TTGO T-Display
// Reads the joystick, potentiometer, and button,
// then sends them to the laptop as one line:  joyX,joyY,pot,button

// ----- Pins -----
const int JOY_X = 32;   // joystick VRx
const int JOY_Y = 33;   // joystick VRy
const int POT   = 37;   // potentiometer middle leg
const int BTN   = 25;   // button (other leg goes to GND)

void setup() {
  Serial.begin(115200);
  pinMode(BTN, INPUT_PULLUP);   // reads LOW when pressed
}

void loop() {
  int x = analogRead(JOY_X);    // 0 - 4095
  int y = analogRead(JOY_Y);    // 0 - 4095
  int p = analogRead(POT);      // 0 - 4095
  int b = (digitalRead(BTN) == LOW) ? 1 : 0;   // 1 = pressed

  Serial.print(x);
  Serial.print(",");
  Serial.print(y);
  Serial.print(",");
  Serial.print(p);
  Serial.print(",");
  Serial.println(b);

  delay(20);   // about 50 readings per second
}
