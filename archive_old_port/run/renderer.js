import { readFile } from 'fs/promises';
import { join, normalize } from 'path';

const root = process.cwd();

(async () => {
  const http = await import('http');
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url);
    let pathname = decodeURIComponent(url.pathname);
    if (pathname === '/') pathname = '/tokio.html';
    const filePath = normalize(join(root, pathname));
    const ext = filePath.split('.').pop().toLowerCase();
    const types = {
      html: 'text/html',
      js: 'application/javascript',
      css: 'text/css',
      png: 'image/png',
      jpg: 'image/jpeg',
      svg: 'image/svg+xml'
    };
    if (types[ext]) res.writeHead(200, {
      'Content-Type': types[ext],
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    });
    try {
      return new Response(await readFile(filePath), { headers });
    } catch (err) {
      return new Response('Not found', { status: 404 });
    }
  });
  server.listen(6666, () => {
    console.log('Renderer UI on http://localhost:6666');
  });
})();

const player = new Player({
  room: 17,
  x: 80,
  y: 32,
  speed: 1.5,
  acceleration: 0.4,
  friction: 0.9,
  lives: 3,
  score: 0,
  carrying: null,
  gold: 0,
  goldTotal: 0,
  collectedItems: new Set([3]),
  invincible: false,
  deathCount: 0,
  moves: 0,
  isGameOver: false,
  hasChalice: false,
  keyStates: { yellow: true, white: true, black: true },
  time: 0,
  dTime: 60,
  frames: 0,
  level: 0,
  roomsVisited: new Set([17]),
  defeatedEnemies: new Set(),
  attackCooldown: 0,
  attackTimer: 0,
  hasSword: true,
  hasChalice: false,
  dragonStates: {
    1: { room: 14, x: 80, y: 32, state: 0, id: 1 },
    2: { room: 1, x: 80, y: 32, state: 0, id: 2 },
    3: { room: 29, x: 80, y: 32, state: 0, id: 3 },
  },
  batStates: {
    1: { room: 26, x: 32, y: 32, state: 0, id: 1 },
  },
  magnetStates: {
    1: { room: 27, x: 128, y: 32, state: 0, id: 1 },
  },
  bridgeStates: {
    1: { room: 4, x: 41, y: 55, state: 0, id: 1 },
  },
  chaliceStates: {
    1: { room: 28, x: 48, y: 32, state: 0, id: 1 },
  },
  portcullisStates: {
    1: { room: 15, x: 67, y: 49, state: 0, id: 1 },
    2: { room: 16, x: 67, y: 49, state: 0, id: 2 },
    3: { room: 17, x: 67, y: 49, state: 0, id: 3 },
  },
  playerWorldState: {
    room15: { portcullisUnlocked: false },
    room16: { portcullisUnlocked: false },
    room17: { portcullisUnlocked: true },
  },
});

const render = new Renderer({
  canvasId: 'canvas',
  renderer: 'webgl2',
  resizeTo: [160, 192],
  scale: 4,
  palette: {
    0: [255, 238, 229],
    1: [255, 165, 0],
    2: [255, 140, 0],
    3: [255, 69, 0],
    4: [192, 192, 203],
    5: [139, 69, 19],
    6: [64, 64, 64],
    7: [0, 0, 0],
    8: [238, 238, 238],
    9: [140, 124, 160],
    10: [240, 240, 240],
    11: [255, 215, 0],
    12: [219, 234, 224],
    13: [34, 139, 34],
    14: [189, 183, 18],
    15: [72, 61, 139],
    16: [210, 105, 30],
    17: [255, 165, 0],
    18: [255, 248, 230],
    19: [0, 128, 128],
    20: [255, 245, 238],
    21: [244, 164, 238],
    22: [138, 43, 226],
    23: [176, 170, 120],
    24: [255, 228, 193],
    25: [248, 189, 140],
    26: [72, 61, 139],
    27: [139, 69, 19],
    28: [107, 142, 35],
    29: [34, 139, 34],
    30: [153, 102, 255],
    31: [255, 160, 122],
    32: [255, 215, 0],
    33: [0, 128, 128],
    34: [0, 0, 0],
    35: [176, 170, 120],
    36: [0, 128, 128],
    37: [255, 238, 229],
    38: [72,61,139],
    39: [34,139,34],
    40: [255,248,230],
    41: [139,69,19],
    42: [255,165,0],
    43: [176,170,120],
    44: [153,102,255],
    45: [139,69,19],
    46: [255,248,230],
    47: [72,61,139],
    48: [210,105,30],
    49: [169,169,169],
    50: [139,69,19],
    51: [240,240,240],
    52: [210,105,30],
    53: [176,170,120],
    54: [255,215,0],
    55: [139,69,19],
    56: [0,128,128],
    57: [34,139,34],
    58: [176,170,120],
    59: [240,240,240],
    60: [255,248,230],
    61: [210,105,30],
    62: [139,69,19],
    63: [176,170,120],
    64: [72,61,139],
    65: [34,139,34],
  },
  width: 160,
  height: 192,
  renderFunction: (t, scene) => {
    scene.player.update(t);
    scene.player.draw(renderer.ctx, renderer.canvas, t);
    scene.objects.forEach((o) => o.update(t));
    scene.objects.forEach((o) => o.draw(renderer.ctx, renderer.canvas, t));
    scene.room.draw(renderer.ctx, renderer.canvas, t);
    scene.portcullis.draw(renderer.ctx, renderer.canvas, t);
    scene.drawUI(renderer.ctx, renderer.canvas, t);
  },
  playerState: player,
  roomState: scene.room,
  objectsState: scene.objects,
  portcullisState: scene.portcullis,
  canvasId: 'canvas',
  renderer: renderer,
});

const scene = renderer.buildScene('castle');

renderer.loop((t) => {
  renderer.draw(t);
  if (renderer.dpr !== window.devicePixelRatio) renderer.setDPR(window.devicePixelRatio);
});

renderer.start();

setTimeout(() => {
  renderer.resize();
  renderer.onresize = () => render.resize();
  renderer.onresize();
}, 16);

window.addEventListener('resize', renderer.onresize);
