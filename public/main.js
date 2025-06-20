// Základní nastavení Three.js
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x222233);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(1, 2, 1);

const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Světlo
const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(5, 10, 7.5);
scene.add(light);

// Podlaha
const floorGeometry = new THREE.PlaneGeometry(40, 40);
const floorMaterial = new THREE.MeshLambertMaterial({ color: 0x444488 });
const floor = new THREE.Mesh(floorGeometry, floorMaterial);
floor.rotation.x = -Math.PI / 2;
scene.add(floor);

// --- Nové proměnné pro 3rd person ---
let playerAngle = 0; // úhel natočení hráče
const playerModel = new THREE.Group();

// Tělo panáčka
const bodyGeo = new THREE.BoxGeometry(0.8, 1.2, 0.5);
const bodyMat = new THREE.MeshLambertMaterial({ color: 0x00aaff });
const body = new THREE.Mesh(bodyGeo, bodyMat);
body.position.y = 0.6;
playerModel.add(body);
// Hlava
const headGeo = new THREE.BoxGeometry(0.6, 0.6, 0.6);
const headMat = new THREE.MeshLambertMaterial({ color: 0xffeecc });
const head = new THREE.Mesh(headGeo, headMat);
head.position.y = 1.4;
playerModel.add(head);
scene.add(playerModel);

// --- Nový model zombie ---
const zombieModel = new THREE.Group();
const zBodyGeo = new THREE.BoxGeometry(0.8, 1.2, 0.5);
const zBodyMat = new THREE.MeshLambertMaterial({ color: 0x44ff44 });
const zBody = new THREE.Mesh(zBodyGeo, zBodyMat);
zBody.position.y = 0.6;
zombieModel.add(zBody);
const zHeadGeo = new THREE.BoxGeometry(0.6, 0.6, 0.6);
const zHeadMat = new THREE.MeshLambertMaterial({ color: 0x99ff99 });
const zHead = new THREE.Mesh(zHeadGeo, zHeadMat);
zHead.position.y = 1.4;
zombieModel.add(zHead);
scene.add(zombieModel);

// --- Generátor náhodného bludiště (DFS) ---
function generateMaze(width, height) {
  // liché rozměry kvůli zdem
  if (width % 2 === 0) width++;
  if (height % 2 === 0) height++;
  const maze = Array.from({length: height}, () => Array(width).fill(1));
  function shuffle(arr) { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } }
  function carve(x, y) {
    maze[y][x] = 0;
    const dirs = [[2,0],[-2,0],[0,2],[0,-2]];
    shuffle(dirs);
    for (const [dx,dy] of dirs) {
      const nx = x+dx, ny = y+dy;
      if (ny>0 && ny<height && nx>0 && nx<width && maze[ny][nx] === 1) {
        maze[y+dy/2][x+dx/2] = 0;
        carve(nx,ny);
      }
    }
  }
  carve(1,1);
  // start a cíl
  maze[1][1] = 2;
  maze[height-2][width-2] = 3;
  return maze;
}

// --- Vytvoření nové mapy při každém spuštění ---
const mazeWidth = 13, mazeHeightCells = 11;
const mazeMap = generateMaze(mazeWidth, mazeHeightCells);
const tileSize = 3;
const mazeHeight = 1.2;
let endPosition = null;
let endMarker = null;

// Přidám zvuk střely
let shootAudio;
if (typeof Audio !== 'undefined') {
  shootAudio = new Audio('https://cdn.jsdelivr.net/gh/naptha/tiny-soundfonts@master/soundfonts/shotgun.mp3'); // ověřený výstřel
}

// Ovládací klávesy
const keys = {};
let jumpVelocity = 0;
let isJumping = false;
let groundY = 0;

// Smazat staré zdi, pokud existují
for (let i = scene.children.length - 1; i >= 0; i--) {
  const obj = scene.children[i];
  if (obj.isMesh && obj.geometry.type === 'BoxGeometry' && obj !== body && obj !== head && obj !== zBody && obj !== zHead) {
    scene.remove(obj);
  }
}

// Vykreslení bludiště
for (let z = 0; z < mazeMap.length; z++) {
  for (let x = 0; x < mazeMap[z].length; x++) {
    if (mazeMap[z][x] === 1) {
      const wallGeo = new THREE.BoxGeometry(tileSize, mazeHeight, tileSize);
      const wallMat = new THREE.MeshLambertMaterial({ color: 0x2222aa });
      const wall = new THREE.Mesh(wallGeo, wallMat);
      wall.position.set(x * tileSize, mazeHeight / 2, z * tileSize);
      scene.add(wall);
    }
    if (mazeMap[z][x] === 2) {
      playerModel.position.set(x * tileSize, 0, z * tileSize);
      playerAngle = 0;
    }
    if (mazeMap[z][x] === 3) {
      endPosition = new THREE.Vector3(x * tileSize, 0, z * tileSize);
      // Cíl - křížek na zemi
      const crossGeo = new THREE.PlaneGeometry(tileSize * 0.8, tileSize * 0.8);
      const crossMat = new THREE.MeshBasicMaterial({ color: 0xff3333, side: THREE.DoubleSide });
      endMarker = new THREE.Mesh(crossGeo, crossMat);
      endMarker.position.set(x * tileSize, 0.01, z * tileSize);
      endMarker.rotation.x = -Math.PI / 2;
      scene.add(endMarker);
    }
  }
}

// Najdi start a cíl pro zombie
let startX = 1, startZ = 1, endX = mazeWidth-2, endZ = mazeHeightCells-2;
for (let z = 0; z < mazeMap.length; z++) {
  for (let x = 0; x < mazeMap[z].length; x++) {
    if (mazeMap[z][x] === 2) { startX = x; startZ = z; }
    if (mazeMap[z][x] === 3) { endX = x; endZ = z; }
  }
}
zombieModel.position.set(endX * tileSize, 0, endZ * tileSize);

// --- Zombie náhodný pohyb ---
let zombieTarget = null;
function getRandomFreeCell() {
  let x, z;
  do {
    x = Math.floor(Math.random() * mazeWidth);
    z = Math.floor(Math.random() * mazeHeightCells);
  } while (mazeMap[z][x] !== 0);
  return {x, z};
}
function updateZombieTarget() {
  // Pokud je hráč blízko, sleduj hráče
  const dist = playerModel.position.distanceTo(zombieModel.position);
  if (dist < 7) {
    zombieTarget = {x: playerModel.position.x / tileSize, z: playerModel.position.z / tileSize};
  } else {
    // Jinak náhodně bloudí
    zombieTarget = getRandomFreeCell();
  }
}
setInterval(updateZombieTarget, 2000);

// --- Nové kolize ---
function checkCollision3rd(pos) {
  const px = Math.floor((pos.x + tileSize/2) / tileSize);
  const pz = Math.floor((pos.z + tileSize/2) / tileSize);
  if (mazeMap[pz] && mazeMap[pz][px] === 1) return true;
  return false;
}

// --- Střely ---
const bullets = [];

// --- Herní stav ---
let gameOver = false;
let win = false;

// --- Ovládání ---
window.addEventListener('keydown', (e) => {
  keys[e.code] = true;
  if (e.code === 'Space' && !isJumping && !gameOver && !win) {
    jumpVelocity = 0.22;
    isJumping = true;
  }
  if (e.code === 'KeyC' && !gameOver && !win) {
    const bulletGeo = new THREE.SphereGeometry(0.2, 6, 6);
    const bulletMat = new THREE.MeshLambertMaterial({ color: 0xffff00 });
    const bullet = new THREE.Mesh(bulletGeo, bulletMat);
    bullet.position.copy(playerModel.position);
    bullet.position.y += 1.2;
    const dir = new THREE.Vector3(Math.sin(playerAngle), 0, Math.cos(playerAngle));
    bullets.push({ mesh: bullet, dir, distance: 0 });
    scene.add(bullet);
    playSound(shootAudio, 'výstřel');
  }
});
window.addEventListener('keyup', (e) => { keys[e.code] = false; });

const JSONBIN_KEY = '$2a$10$WrMBljUhANFS39i2XwHfH.9.V8AkViUkOp81Bn51ouKwvbmzG2M7m';
const JSONBIN_ID = '68550a218561e97a5027dd3f';

function showOverlay(msg) {
  const overlay = document.getElementById('overlay');
  overlay.innerHTML = msg +
    '<br><br><b>Ovládání:</b> Šipky = pohyb, Mezerník = skok, C = střelba' +
    '<br><br><input id="nickInput" maxlength="16" placeholder="Zadej svůj nick" style="font-size:1em;padding:5px;">' +
    '<button id="saveScoreBtn" style="font-size:1em;margin-left:10px;padding:5px 20px;">Uložit skóre</button>' +
    '<br><br><button onclick="location.reload()" style="font-size:1em;padding:5px 20px;">Hrát znovu</button>';
  overlay.style.display = 'flex';
  overlay.style.justifyContent = 'center';
  overlay.style.alignItems = 'center';
  document.getElementById('saveScoreBtn').onclick = function() {
    const nick = document.getElementById('nickInput').value.trim() || 'Anonym';
    this.disabled = true;
    this.textContent = 'Ukládám...';
    saveScoreToJsonBin(score, nick, () => {
      this.textContent = 'Uloženo!';
    });
  };
}

function saveScoreToJsonBin(score, nick, cb) {
  fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_ID}/latest`, {
    headers: { 'X-Master-Key': JSONBIN_KEY }
  })
  .then(res => res.json())
  .then(data => {
    let scores = data.record && Array.isArray(data.record.scores) ? data.record.scores : [];
    scores.push({ nick, score, time: new Date().toISOString() });
    scores = scores.sort((a, b) => b.score - a.score).slice(0, 10);
    return fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_ID}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Master-Key': JSONBIN_KEY
      },
      body: JSON.stringify({ scores })
    });
  })
  .then(() => { loadLeaderboard(); if(cb) cb(); })
  .catch(err => {
    if (document.getElementById('saveScoreBtn')) document.getElementById('saveScoreBtn').textContent = 'Chyba!';
    console.error('Chyba při ukládání skóre:', err);
  });
}

function loadLeaderboard() {
  fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_ID}/latest`, {
    headers: { 'X-Master-Key': JSONBIN_KEY }
  })
  .then(res => res.json())
  .then(data => {
    const scores = data.record && Array.isArray(data.record.scores) ? data.record.scores : [];
    let html = '<h3 style="margin:0 0 10px 0;">Žebříček</h3><ol style="text-align:left;margin:0;padding-left:20px;">';
    for (const s of scores) {
      html += `<li><b>${s.nick}</b> — ${s.score}</li>`;
    }
    html += '</ol>';
    document.getElementById('leaderboard-panel').innerHTML = html;
  })
  .catch(() => {
    document.getElementById('leaderboard-panel').innerHTML = '<b style="color:red">Nelze načíst žebříček!</b>';
  });
}

// --- Kytky (sbíratelné objekty) ---
const flowers = [];
const flowerPositions = [];
// Rozmístím 8 kytek na volná místa v bludišti (kromě startu/cíle)
for (let z = 1; z < mazeMap.length - 1; z++) {
  for (let x = 1; x < mazeMap[z].length - 1; x++) {
    if (mazeMap[z][x] === 0 && Math.random() < 0.13 && flowerPositions.length < 8) {
      flowerPositions.push({x, z});
    }
  }
}
flowerPositions.forEach(pos => {
  const geo = new THREE.ConeGeometry(0.3, 0.7, 8);
  const mat = new THREE.MeshLambertMaterial({ color: 0xff44cc });
  const flower = new THREE.Mesh(geo, mat);
  flower.position.set(pos.x * tileSize, 0.35, pos.z * tileSize);
  flower.rotation.x = Math.PI;
  scene.add(flower);
  flowers.push(flower);
});

// --- Časovač ---
let timeLeft = 60;
let timerInterval = setInterval(() => {
  if (gameOver || win) return;
  timeLeft--;
  document.getElementById('timer').textContent = 'Čas: ' + timeLeft;
  if (timeLeft <= 0) {
    gameOver = true;
    showOverlay('Čas vypršel!<br>Skóre: ' + score);
    localStorage.setItem('3dhra-score', score);
    saveScoreToJsonBin(score);
  }
}, 1000);

// --- Hlavní smyčka ---
function animate() {
  requestAnimationFrame(animate);
  if (gameOver || win) return;

  // Pohyb hráče (šipky vpřed/vzad, otáčení)
  let move = 0;
  if (keys['ArrowUp']) move = 1;
  if (keys['ArrowDown']) move = -1;
  if (keys['ArrowLeft']) playerAngle += 0.05;
  if (keys['ArrowRight']) playerAngle -= 0.05;

  // Výpočet nové pozice
  const forward = new THREE.Vector3(Math.sin(playerAngle), 0, Math.cos(playerAngle));
  const nextPos = playerModel.position.clone().add(forward.clone().multiplyScalar(move * 0.15));
  nextPos.y = playerModel.position.y; // zachováme výšku při pohybu
  if (!checkCollision3rd(nextPos)) {
    playerModel.position.x = nextPos.x;
    playerModel.position.z = nextPos.z;
  }
  // Skok a gravitace
  if (isJumping) {
    playerModel.position.y += jumpVelocity;
    jumpVelocity -= 0.012;
    if (playerModel.position.y <= groundY) {
      playerModel.position.y = groundY;
      isJumping = false;
      jumpVelocity = 0;
    }
  }

  // Panáček je nyní natočený podle směru pohybu/kamery
  playerModel.rotation.y = -playerAngle;

  // Kamera za hráčem
  const camOffset = forward.clone().multiplyScalar(-4).add(new THREE.Vector3(0, 2.5, 0));
  camera.position.copy(playerModel.position.clone().add(camOffset));
  camera.lookAt(playerModel.position.clone().add(new THREE.Vector3(0, 1, 0)));

  // --- Zombie AI ---
  let zTargetPos = new THREE.Vector3(zombieTarget.x * tileSize, 0, zombieTarget.z * tileSize);
  let zDir = zTargetPos.clone().sub(zombieModel.position);
  zDir.y = 0;
  if (zDir.length() > 0.1) {
    zDir.normalize();
    const zNext = zombieModel.position.clone().add(zDir.multiplyScalar(0.035)); // pomalejší pohyb
    if (!checkCollision3rd(zNext)) {
      zombieModel.position.copy(zNext);
    }
    zombieModel.lookAt(zTargetPos.x, zombieModel.position.y, zTargetPos.z);
  }

  // --- Sběr kytek ---
  for (let i = flowers.length - 1; i >= 0; i--) {
    if (playerModel.position.distanceTo(flowers[i].position) < 1.1) {
      scene.remove(flowers[i]);
      flowers.splice(i, 1);
      score++;
      updateScore();
      playSound(flowerAudio, 'kytka');
    }
  }

  // --- Střely ---
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.mesh.position.add(b.dir.clone().multiplyScalar(0.7));
    b.distance += 0.7;
    // Když střela narazí do zombie
    if (b.mesh.position.distanceTo(zombieModel.position) < 1.2) {
      spawnBloodEffect(zombieModel.position.clone().add(new THREE.Vector3(0,1,0)));
      scene.remove(zombieModel);
      scene.remove(b.mesh);
      bullets.splice(i, 1);
      score += 5;
      updateScore();
      playSound(hitAudio, 'zásah');
      // Respawn zombie na náhodném místě
      setTimeout(() => {
        let zx, zz;
        do {
          zx = Math.floor(Math.random() * mazeWidth);
          zz = Math.floor(Math.random() * mazeHeightCells);
        } while (mazeMap[zz][zx] !== 0 || (Math.abs(zx*tileSize-playerModel.position.x)<3 && Math.abs(zz*tileSize-playerModel.position.z)<3));
        zombieModel.position.set(zx * tileSize, 0, zz * tileSize);
        scene.add(zombieModel);
      }, 700);
      return;
    }
    // Když střela narazí do zdi nebo je moc daleko
    if (checkCollision3rd(b.mesh.position) || b.distance > 80) {
      scene.remove(b.mesh);
      bullets.splice(i, 1);
    }
  }

  // --- Prohra (zombie tě chytí) ---
  if (playerModel.position.distanceTo(zombieModel.position) < 1.2) {
    gameOver = true;
    if (loseAudio) playSound(loseAudio, 'prohra');
    showOverlay('Prohrál jsi! Zombie tě dostal!<br>Skóre: ' + score);
    localStorage.setItem('3dhra-score', score);
    saveScoreToJsonBin(score);
    clearInterval(timerInterval);
    return;
  }

  // --- Výhra (dveře na konec) ---
  if (playerModel.position.distanceTo(endPosition) < 1.2) {
    win = true;
    playSound(winAudio, 'výhra');
    score += timeLeft;
    updateScore();
    showOverlay('Vyhrál jsi! Našel jsi východ!<br>Skóre: ' + score);
    localStorage.setItem('3dhra-score', score);
    saveScoreToJsonBin(score);
    clearInterval(timerInterval);
    return;
  }

  renderer.render(scene, camera);
}

animate();

// Přizpůsobení okna
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

let score = 0;
function updateScore() {
  document.getElementById('score').textContent = 'Skóre: ' + score;
}

// Zvuky
let hitAudio, winAudio, loseAudio, flowerAudio;
function playSound(audio, label) {
  if (!audio) return;
  audio.currentTime = 0;
  audio.volume = 0.7;
  audio.play().then(()=>console.log('Zvuk přehrán:', label)).catch(e=>console.warn('Zvuk blokován:', label, e));
}
if (typeof Audio !== 'undefined') {
  hitAudio = new Audio('https://cdn.pixabay.com/audio/2022/03/15/audio_115b9b6b7e.mp3');
  winAudio = new Audio('https://cdn.pixabay.com/audio/2022/03/15/audio_115b9b6b7e.mp3');
  loseAudio = new Audio('https://cdn.pixabay.com/audio/2022/03/15/audio_115b9b6b7e.mp3');
  flowerAudio = new Audio('https://cdn.pixabay.com/audio/2022/03/15/audio_115b9b6b7e.mp3');
}

updateScore();

// Načti žebříček při startu hry a každých 20 sekund aktualizuj
loadLeaderboard();
setInterval(loadLeaderboard, 20000);

// --- Efekt rozprsknutí zombie ---
function spawnBloodEffect(pos) {
  for (let i = 0; i < 18; i++) {
    const geo = new THREE.SphereGeometry(0.12, 4, 4);
    const mat = new THREE.MeshBasicMaterial({ color: 0xff2222 });
    const drop = new THREE.Mesh(geo, mat);
    drop.position.copy(pos);
    scene.add(drop);
    const dir = new THREE.Vector3(Math.random()-0.5, Math.random(), Math.random()-0.5).normalize();
    let t = 0;
    function animateDrop() {
      if (t > 20) { scene.remove(drop); return; }
      drop.position.add(dir.clone().multiplyScalar(0.18));
      drop.position.y -= 0.03 * t;
      t++;
      requestAnimationFrame(animateDrop);
    }
    animateDrop();
  }
} 