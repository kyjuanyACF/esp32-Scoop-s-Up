// Ice Cream Stacker — Catch the Order
// Random scoops fall from the top. Move the cone to catch the right ones
// and build the customer's order from the bottom up.
//
// Joystick left/right = move the cone
// Knob                = how fast the scoops fall
// Button              = toss the top scoop off the cone (fix a mistake)
//
// How you lose: every falling scoop uses up some of the customer's patience.
// If patience runs out, the customer leaves (a strike). 3 strikes = game over.

let myFont;
const TEXT_COLOR = '#4e005c';

// ----- Values from the ESP32 (0 - 4095) -----
let joyX = 2048;
let joyY = 2048;
let pot = 1200;
let btn = 0;
let lastBtn = 0;
let joyCenter = 2048;     // set from the first reading
let gotFirstReading = false;
let connected = false;

// ----- Flavors -----
const FLAVOR_NAMES = [
  'Blue Moon',       // scoop1.png
  'Caramel',         // scoop2.png
  'Cookie Dough',    // scoop3.png
  'Chocolate Chip',  // scoop4.png
  'Chocolate',       // scoop5.png
  'Mango',           // scoop6.png
  'Mint Chip',       // scoop7.png
  'Neapolitan',      // scoop8.png
  'Strawberry',      // scoop9.png
  'Ube',             // scoop10.png
  'Vanilla',         // scoop11.png
];
const NUM_FLAVORS = FLAVOR_NAMES.length;
let flavors;              // backup colors, set in setup()

// ----- Your drawings -----
let coneImg = null;
let shopImg = null;
let scoopImgs = [];

// ----- Game settings -----
const GAME_W = 480;       // width of the play area (the order panel sits to the right)
const PANEL_W = 170;
const SKY = [204, 234, 255];   // light blue behind the shop
const SHOP_TOP = 130;         // where the awning ends (panel starts below it)
const SHOP_BOTTOM = 585;      // where the counter starts
const R = 28;             // scoop radius
const SCOOP_GAP = R * 1.3;
const MAX_STRIKES = 3;
const FIRST_ORDER_SIZE = 5;
const HELPFUL_CHANCE = 0.4;   // 40% of scoops are the flavor you need next
const SPAWN_GAP = 230;        // a new scoop starts once the last one has fallen this far

// ----- Game state -----
let coneX;
let coneTopY;
let stack = [];           // scoops on the cone: { off, f }
let scoops = [];          // scoops falling right now
let order = [];           // flavors the customer wants, bottom to top
let patience = 0;         // how many more scoops the customer will wait for
let maxPatience = 0;
let ordersServed = 0;
let strikes = 0;
let gameOver = false;
let message = '';
let messageTimer = 0;
let connectButton;

function preload() {
  myFont = loadFont('rainyhearts.ttf');
  loadImage('cone.png', img => coneImg = img, () => {});
  loadImage('shop.png', img => shopImg = img, () => {});
  for (let i = 0; i < NUM_FLAVORS; i++) {
    loadImage('scoop' + (i + 1) + '.png', img => scoopImgs[i] = img, () => {});
  }
}

function setup() {
  createCanvas(GAME_W + PANEL_W, 640);
  textFont(myFont);
  noSmooth();             // keeps the pixel art crisp when it's scaled up
  coneX = GAME_W / 2;
  coneTopY = height - 130;

  flavors = [
    color(100, 160, 255), color(200, 120, 40), color(245, 230, 205),
    color(100, 60, 35), color(116, 72, 35), color(250, 185, 90),
    color(150, 230, 190), color(240, 200, 200), color(255, 170, 210),
    color(200, 120, 240), color(248, 232, 210),
  ];

  connectButton = createButton('Connect ESP32');
  connectButton.mousePressed(connectSerial);

  newOrder();
  scoops = [newScoop()];
}

function draw() {
  background(SKY);

  if (!connected) keyboardControls();

  // Button: only act at the moment it is pressed down
  let pressed = (btn === 1 && lastBtn === 0);
  lastBtn = btn;

  if (gameOver) {
    drawGameOver();
    if (pressed) restart();
    return;
  }

  moveCone();
  if (pressed) tossTopScoop();
  updateScoops();

  // Scroll up when the tower gets tall
  let camY = cameraY();
  push();
  translate(0, camY);
  drawCone();
  drawStack();
  for (let s of scoops) drawScoop(s.x, s.y, s.f, R);
  pop();

  drawShop();     // awning + counter go in front, so scoops drop out from under the awning
  drawPanel();
  drawMessage();
}

// ---------- Game logic ----------

function speed() {
  // Knob = how fast scoops fall
  return map(pot, 0, 4095, 2, 9);
}

function cameraY() {
  return max(0, stack.length * SCOOP_GAP - 280);
}

function newOrder() {
  let size = FIRST_ORDER_SIZE + ordersServed;   // 5, then 6, 7, 8...
  order = [];
  for (let i = 0; i < size; i++) {
    order.push(floor(random(NUM_FLAVORS)));
  }
  stack = [];
  maxPatience = size * 3 + 3;   // bigger orders get more patience
  patience = maxPatience;
}

// Checks if the stack matches the order so far
function stackIsCorrect() {
  for (let i = 0; i < stack.length; i++) {
    if (stack[i].f !== order[i]) return false;
  }
  return true;
}

function neededFlavor() {
  if (!stackIsCorrect() || stack.length >= order.length) return -1;
  return order[stack.length];
}

function newScoop() {
  // Sometimes give the flavor you need, otherwise a random one
  let f = floor(random(NUM_FLAVORS));
  let need = neededFlavor();
  if (need !== -1 && random() < HELPFUL_CHANCE) f = need;

  return {
    x: random(R, GAME_W - R),
    y: -R - cameraY(),        // just above the screen, even after scrolling
    f: f,
    missed: false,
    done: false,
  };
}

function moveCone() {
  let tilt = (joyX - joyCenter) / 2048;   // about -1 to 1
  if (abs(tilt) < 0.15) tilt = 0;         // ignore tiny wiggles
  coneX += tilt * 10;
  coneX = constrain(coneX, 40, GAME_W - 40);
}

function updateScoops() {
  for (let s of scoops) updateScoop(s);
  scoops = scoops.filter(s => !s.done);
  if (gameOver) return;

  // Start a new scoop once the newest one has fallen far enough
  let newest = scoops[scoops.length - 1];
  if (!newest || newest.y + cameraY() > SPAWN_GAP) scoops.push(newScoop());
}

function updateScoop(s) {
  s.y += speed();

  // Where a scoop would land on top of the stack
  let landY = coneTopY - R * 0.6 - stack.length * SCOOP_GAP;
  let topOff = stack.length > 0 ? stack[stack.length - 1].off : 0;
  let off = s.x - coneX;

  // Only check when the scoop is crossing the top of the stack
  if (!s.missed && s.y >= landY) {
    let lined = abs(off - topOff) < R * 1.1;
    let room = stack.length < order.length;
    let closeEnough = s.y - landY < speed() + 2;
    if (lined && room && closeEnough) {
      stack.push({ off: off, f: s.f });   // caught it!
      if (s.f !== order[stack.length - 1]) {
        showMessage('Wrong flavor! Toss it');
      }
      s.done = true;
      checkOrderDone();
      scoopFinished();
      return;
    }
    s.missed = true;                      // keeps falling past the cone
  }

  if (s.y > coneTopY + 200) {
    s.done = true;
    scoopFinished();
  }
}

// Called after every scoop, caught or not
function scoopFinished() {
  if (gameOver) return;
  patience--;
  if (patience <= 0) {
    strikes++;
    if (strikes >= MAX_STRIKES) {
      gameOver = true;
      return;
    }
    showMessage('Customer left! :');
    newOrder();
  }
}

function checkOrderDone() {
  if (stack.length === order.length && stackIsCorrect()) {
    ordersServed++;
    showMessage('Order Up :]');
    newOrder();
  }
}

function tossTopScoop() {
  if (stack.length === 0) return;
  stack.pop();
  showMessage('Tossed!');
}

function showMessage(text) {
  message = text;
  messageTimer = 70;   // a little over 1 second
}

function restart() {
  ordersServed = 0;
  strikes = 0;
  gameOver = false;
  coneX = GAME_W / 2;
  newOrder();
  scoops = [newScoop()];
}

// ---------- Drawing ----------

function drawShop() {
  if (!shopImg) return;
  imageMode(CORNER);
  image(shopImg, 0, 0, width, height);   // stretched over the whole screen
}

function drawCone() {
  if (coneImg) {
    imageMode(CORNER);
    let w = 70;
    let h = w * coneImg.height / coneImg.width;   // keep the drawing's shape
    image(coneImg, coneX - w / 2, coneTopY - 8, w, h);
    return;
  }
  noStroke();
  fill(222, 164, 92);
  triangle(coneX - 32, coneTopY, coneX + 32, coneTopY, coneX, coneTopY + 100);
}

function drawStack() {
  for (let i = 0; i < stack.length; i++) {
    let y = coneTopY - R * 0.6 - i * SCOOP_GAP;
    drawScoop(coneX + stack[i].off, y, stack[i].f, R);
  }
}

function drawScoop(x, y, f, r) {
  if (scoopImgs[f]) {
    imageMode(CENTER);
    let w = r * 2.4;
    let h = w * scoopImgs[f].height / scoopImgs[f].width;   // keep the drawing's shape
    image(scoopImgs[f], x, y, w, h);
    return;
  }
  noStroke();
  fill(flavors[f]);
  circle(x, y, r * 2);
}

function drawPanel() {
  let x = GAME_W + 12;
  let w = PANEL_W - 32;
  let pt = SHOP_TOP;

  // Card that holds everything on the right
  noStroke();
  fill(255, 255, 255, 170);
  rect(GAME_W + 4, pt - 8, PANEL_W - 16, SHOP_BOTTOM - pt, 10);

  // Patience bar
  fill(TEXT_COLOR);
  textSize(13);
  textAlign(LEFT, TOP);
  text('Patience', x, pt);
  fill(255);
  rect(x, pt + 18, w, 12, 6);
  let p = patience / maxPatience;
  if (p > 0.5) fill(90, 190, 110);
  else if (p > 0.25) fill(240, 180, 60);
  else fill(220, 80, 60);
  rect(x, pt + 18, w * p, 12, 6);

  // Order ticket (shrinks the rows if the order gets long)
  let top = pt + 42;
  let rowH = min(34, (SHOP_BOTTOM - top - 115) / order.length);
  let h = 30 + order.length * rowH;
  stroke(200, 180, 160);
  strokeWeight(1);
  fill(255);
  rect(x, top, w, h, 6);

  noStroke();
  fill(TEXT_COLOR);
  textSize(13);
  textAlign(CENTER, TOP);
  text('ORDER', x + w / 2, top + 7);

  let need = neededFlavor() !== -1 ? stack.length : -1;
  // Listed top to bottom on the ticket = top to bottom on the cone
  for (let i = order.length - 1; i >= 0; i--) {
    let row = order.length - 1 - i;
    let cy = top + 30 + rowH / 2 + row * rowH;
    drawScoop(x + 20, cy, order[i], min(13, rowH * 0.4));

    noStroke();
    fill(TEXT_COLOR);
    textSize(11);
    textAlign(LEFT, CENTER);
    text(FLAVOR_NAMES[order[i]], x + 38, cy);

    textSize(15);
    if (i < stack.length && stack[i].f === order[i]) {
      fill(60, 160, 80);
      text('·', x + w - 16, cy);
    } else if (i < stack.length) {
      fill(220, 80, 60);
      text('x', x + w - 16, cy);
    } else if (i === need) {
      fill(220, 90, 60);
      text('<-', x + w - 18, cy);
    }
  }

  // Score
  fill(TEXT_COLOR);
  textSize(17);
  textAlign(LEFT, TOP);
  let sy = top + h + 16;
  text('Orders: ' + ordersServed, x + 4, sy);
  text('Strikes: ' + strikes + ' / ' + MAX_STRIKES, x + 4, sy + 24);
  textSize(13);
  text('Speed: ' + nf(speed(), 1, 1), x + 4, sy + 50);
}

function drawMessage() {
  if (messageTimer <= 0) return;
  messageTimer--;
  noStroke();
  fill(90, 50, 30, map(messageTimer, 0, 70, 0, 255));
  textSize(28);
  textAlign(CENTER, CENTER);
  text(message, GAME_W / 2, height / 2 - 60);
}

function drawGameOver() {
  background(SKY);
  drawShop();
  fill(TEXT_COLOR);
  noStroke();
  textAlign(CENTER, CENTER);
  textSize(40);
  text('Shop closed! :[', width / 2, height / 2 - 40);
  textSize(24);
  text('You served ' + ordersServed + ' orders', width / 2, height / 2 + 10);
  textSize(16);
  text('Press the button to open again', width / 2, height / 2 + 50);
}

// ---------- Keyboard backup (for testing without the ESP32) ----------

function keyboardControls() {
  if (keyIsDown(LEFT_ARROW)) joyX = 0;
  else if (keyIsDown(RIGHT_ARROW)) joyX = 4095;
  else joyX = joyCenter;

  if (keyIsDown(187)) pot = min(4095, pot + 30);   // = key: faster
  if (keyIsDown(189)) pot = max(0, pot - 30);      // - key: slower

  btn = keyIsDown(32) ? 1 : 0;   // 32 = space bar
}

function keyPressed() {
  if (key === ' ') return false;   // stop the page from scrolling
}

// ---------- Serial (Chrome / Edge only) ----------

async function connectSerial() {
  if (!('serial' in navigator)) {
    connectButton.html('Use Chrome or Edge for serial');
    return;
  }
  try {
    const port = await navigator.serial.requestPort();
    await port.open({ baudRate: 115200 });
    const decoder = new TextDecoderStream();
    port.readable.pipeTo(decoder.writable);
    const reader = decoder.readable.getReader();
    connected = true;
    connectButton.html('Connected ✓');
    readLoop(reader);
  } catch (err) {
    connectButton.html('Connect failed — try again');
    console.log(err);
  }
}

async function readLoop(reader) {
  let buffer = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    let lines = buffer.split('\n');
    buffer = lines.pop();            // keep any half-finished line
    for (let line of lines) parseLine(line.trim());
  }
}

function parseLine(line) {
  let parts = line.split(',');
  if (parts.length !== 4) return;
  joyX = int(parts[0]);
  joyY = int(parts[1]);
  pot = int(parts[2]);
  btn = int(parts[3]);

  // Joysticks rarely rest at exactly 2048, so use the first reading as center
  if (!gotFirstReading) {
    joyCenter = joyX;
    gotFirstReading = true;
  }
}
