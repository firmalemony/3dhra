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

// --- Nové bludiště (větší, nižší zdi) ---
const mazeMap = [
  [1,1,1,1,1,1,1,1,1,1,1,1],
  [1,2,0,0,0,1,0,0,0,0,3,1],
  [1,0,1,1,0,1,0,1,1,0,0,1],
  [1,0,1,0,0,0,0,1,0,0,1,1],
  [1,0,1,0,1,1,0,1,0,1,0,1],
  [1,0,0,0,1,0,0,0,0,1,0,1],
  [1,1,1,0,1,0,1,1,0,1,0,1],
  [1,0,0,0,0,0,1,0,0,0,0,1],
  [1,1,1,1,1,1,1,1,1,1,1,1],
];
const tileSize = 3;
const mazeHeight = 1.2;
let endPosition = null;

// Přidám zvuk střely
let shootAudio;
if (typeof Audio !== 'undefined') {
  shootAudio = new Audio('https://cdn.pixabay.com/audio/2022/07/26/audio_124bfa4c7e.mp3'); // jednoduchý zvuk výstřelu
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
      // Cíl - zelená kostka
      const endGeo = new THREE.BoxGeometry(tileSize * 0.8, 1, tileSize * 0.8);
      const endMat = new THREE.MeshLambertMaterial({ color: 0x00ff00 });
      const endCube = new THREE.Mesh(endGeo, endMat);
      endCube.position.set(x * tileSize, 0.5, z * tileSize);
      scene.add(endCube);
    }
  }
}

// Zombie start na druhém konci bludiště
zombieModel.position.set(10 * tileSize, 0, 1 * tileSize);

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
    // Střela vychází z hráče
    const bulletGeo = new THREE.SphereGeometry(0.2, 6, 6);
    const bulletMat = new THREE.MeshLambertMaterial({ color: 0xffff00 });
    const bullet = new THREE.Mesh(bulletGeo, bulletMat);
    bullet.position.copy(playerModel.position);
    bullet.position.y += 1.2;
    // Směr střely podle směru pohybu (dopředu)
    const dir = new THREE.Vector3(Math.sin(playerAngle), 0, Math.cos(playerAngle));
    bullets.push({ mesh: bullet, dir, distance: 0 });
    scene.add(bullet);
    if (shootAudio) { shootAudio.currentTime = 0; shootAudio.play(); }
  }
});
window.addEventListener('keyup', (e) => { keys[e.code] = false; });

function showOverlay(msg) {
  const overlay = document.getElementById('overlay');
  overlay.innerHTML = msg + '<br><button onclick="location.reload()">Hrát znovu</button>';
  overlay.style.display = 'flex';
  overlay.style.justifyContent = 'center';
  overlay.style.alignItems = 'center';
}

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

  // Panáček je vždy natočený dopředu (neotáčí se při pohybu)
  playerModel.rotation.y = 0;

  // Kamera za hráčem
  const camOffset = forward.clone().multiplyScalar(-4).add(new THREE.Vector3(0, 2.5, 0));
  camera.position.copy(playerModel.position.clone().add(camOffset));
  camera.lookAt(playerModel.position.clone().add(new THREE.Vector3(0, 1, 0)));

  // --- Zombie AI ---
  const zDir = playerModel.position.clone().sub(zombieModel.position);
  zDir.y = 0;
  if (zDir.length() > 0.1) {
    zDir.normalize();
    const zNext = zombieModel.position.clone().add(zDir.multiplyScalar(0.07));
    if (!checkCollision3rd(zNext)) {
      zombieModel.position.copy(zNext);
    }
    zombieModel.lookAt(playerModel.position.x, zombieModel.position.y, playerModel.position.z);
  }

  // --- Střely ---
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.mesh.position.add(b.dir.clone().multiplyScalar(0.7));
    b.distance += 0.7;
    // Když střela narazí do zombie
    if (b.mesh.position.distanceTo(zombieModel.position) < 1.2) {
      scene.remove(zombieModel);
      scene.remove(b.mesh);
      bullets.splice(i, 1);
      win = true;
      showOverlay('Vyhrál jsi! Zombii jsi zničil!');
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
    showOverlay('Prohrál jsi! Zombie tě dostal!');
    return;
  }

  // --- Výhra (dveře na konec) ---
  if (playerModel.position.distanceTo(endPosition) < 1.2) {
    win = true;
    showOverlay('Vyhrál jsi! Našel jsi východ!');
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