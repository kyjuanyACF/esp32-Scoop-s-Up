# Scoop's Up - Ice Cream Stacker

**Module 2: Interactive Devices** · Creative Embedded Systems (COMS BC3930), Fall 2026

An ice cream shop game controlled with a homemade controller. Scoops fall from from the sky. Move the cone to catch the right flavors and build each customer's order from the bottom up, before they run out of patience.

 **Play it:** https://kyjuanyacf.github.io/esp32-Scoop-s-Up/

---

## How to play

- An **order ticket** on the right lists the flavors the customer wants, from top to bottom as they'll stack on the cone.
- **Random scoops fall** from the top of the screen. Catch the ones you need and dodge the rest.
- Caught the wrong flavor? **Toss it** off the top of your cone.
- Every scoop that falls uses up some of the customer's **patience**. Finish the order before the bar runs out!
- Orders start at **5 scoops** and get **one scoop longer** each time you complete a order.
- If a customer's patience runs out, they leave and the **game is over**. Press the button to play again.

Ticket symbols & Meaning: | ♡ | Correct scoop on the cone | X | Wrong scoop, toss it! | <- | The flavor you need next

## Controls

Control & What it does: | **Joystick** (left/right) Move the cone | **Potentiometer** (knob) How fast the scoops fall |  **Button** Toss the top scoop off the cone / restart after game over |

**No controller?** Use the keyboard: **← →** to move, **SPACE** to toss, **− / =** to change the speed.

---

## Hardware

- ESP32 TTGO T-Display
- Joystick
- Potentiometer
- Button
- Breadboard
- Jumper wires
- USB-C cable (power + data)

### Wiring

| Part | Part pin | ESP32 pin |
|---|---|---|
| Joystick | GND | GND |
| | +5V | **3V** (not 5V!) |
| | VRx | G32 |
| | VRy | G33 |
| Potentiometer | outer legs | 3V and GND |
| | middle leg | G37 |
| Button | one leg | G25 |
| | other leg | GND |

---

## How it works

1. **ESP32** (`ice_cream_esp32/ice_cream_esp32.ino`) reads the joystick, knob, and button about 50 times a second and sends them to the laptop as one line of text:
   ```
   joyX,joyY,pot,button
   1890,1920,2300,0
   ```
   The joystick and knob values range from 0 to 4095, and the button is `1` when pressed. The T-Display screen shows the game instructions.
2. **The game** (`sketch.js`) reads those lines in the browser using the **Web Serial API**, then uses the numbers to move the cone, set the speed, and toss scoops.

---

## Running it

### 1. Upload the ESP32 code
1. Open `ice_cream_esp32/ice_cream_esp32.ino` in the Arduino IDE.
2. Install the **TFT_eSPI** library and set it up for the T-Display (in `User_Setup_Select.h`, use `Setup25_TTGO_T_Display.h`).
3. Select the **ESP32 Dev Module** board and your port, then upload.

### 2. Play
1. Open the game in **Chrome or Edge**
2. Click **Connect ESP32** and choose your board's port.
3. Hold the joystick still for a second. The game uses the first reading as the joystick's center.
---

## Files

```
esp32-Scoop-s-Up/
├── index.html               ← web page + styling
├── sketch.js                ← the game
├── ice_cream_esp32/
│   └── ice_cream_esp32.ino  ← ESP32 code
├── shop.png                 ← shop background
├── cone.png                 ← cone
├── scoop1.png … scoop11.png ← 11 ice cream flavors
└── rainyhearts.ttf          ← pixel font
```

