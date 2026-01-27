import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js';
import { RoundedBoxGeometry } from 'https://cdn.jsdelivr.net/npm/three@0.161.0/examples/jsm/geometries/RoundedBoxGeometry.js';
import * as CANNON from 'https://cdn.jsdelivr.net/npm/cannon-es@0.20.0/dist/cannon-es.js';

export function initDice3D(mountSelector = '#dice3d') {
  const mount = document.querySelector(mountSelector);
  if (!mount) throw new Error(`Mount not found: ${mountSelector}`);

  // ---------- THREE ----------
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b0c10);

  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  camera.position.set(0, 5.2, 8.5);
  camera.lookAt(0, 0.7, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  mount.appendChild(renderer.domElement);

  scene.add(new THREE.AmbientLight(0xffffff, 0.55));

  const key = new THREE.DirectionalLight(0xffffff, 1.15);
  key.position.set(6, 10, 6);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 40;
  key.shadow.camera.left = -10;
  key.shadow.camera.right = 10;
  key.shadow.camera.top = 10;
  key.shadow.camera.bottom = -10;
  scene.add(key);

  // Table
  const table = new THREE.Mesh(
    new THREE.PlaneGeometry(20, 20),
    new THREE.MeshStandardMaterial({ color: 0x121520, roughness: 0.95, metalness: 0.02 })
  );
  table.rotation.x = -Math.PI / 2;
  table.receiveShadow = true;
  scene.add(table);

  // ---------- CANNON ----------
  const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) });
  world.allowSleep = true;

  const groundMat = new CANNON.Material('ground');
  const diceMat = new CANNON.Material('dice');

  world.addBody(new CANNON.Body({
    mass: 0,
    shape: new CANNON.Plane(),
    material: groundMat,
    quaternion: new CANNON.Quaternion().setFromEuler(-Math.PI / 2, 0, 0),
  }));

  // walls
  const wallShape = new CANNON.Plane();
  const walls = [
    { pos: [0, 0, -6], rot: [0, 0, 0] },
    { pos: [0, 0,  6], rot: [0, Math.PI, 0] },
    { pos: [-6, 0, 0], rot: [0, Math.PI/2, 0] },
    { pos: [ 6, 0, 0], rot: [0, -Math.PI/2, 0] },
  ];
  for (const w of walls) {
    const b = new CANNON.Body({ mass: 0, shape: wallShape, material: groundMat });
    b.position.set(...w.pos);
    b.quaternion.setFromEuler(...w.rot);
    world.addBody(b);
  }

  world.addContactMaterial(new CANNON.ContactMaterial(groundMat, diceMat, {
    friction: 0.25,
    restitution: 0.35,
  }));

  // ---------- Helpers ----------
  function resize() {
    const w = mount.clientWidth || 600;
    const h = mount.clientHeight || 520;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }
  new ResizeObserver(resize).observe(mount);
  resize();

  // ---------- D6 (cube) ----------
  const d6Size = 1;
  const half = d6Size / 2;

  function makeFaceTexture(n) {
    const s = 256;
    const c = document.createElement('canvas');
    c.width = s; c.height = s;
    const ctx = c.getContext('2d');

    ctx.fillStyle = '#f3f5f8';
    ctx.fillRect(0, 0, s, s);

    ctx.strokeStyle = 'rgba(0,0,0,0.08)';
    ctx.lineWidth = 10;
    ctx.strokeRect(10, 10, s - 20, s - 20);

    ctx.fillStyle = '#121316';
    ctx.font = 'bold 150px system-ui, -apple-system, Segoe UI, Roboto, Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(n), s / 2, s / 2 + 8);

    const tex = new THREE.CanvasTexture(c);
    tex.anisotropy = 8;
    return tex;
  }

  // +Y:1, -Y:6, +X:3, -X:4, +Z:2, -Z:5
  const d6Face = {
    px: makeFaceTexture(3),
    nx: makeFaceTexture(4),
    py: makeFaceTexture(1),
    ny: makeFaceTexture(6),
    pz: makeFaceTexture(2),
    nz: makeFaceTexture(5),
  };

  function createD6Mesh() {
    const geo = new RoundedBoxGeometry(d6Size, d6Size, d6Size, 6, 0.18);
    const mats = [
      new THREE.MeshStandardMaterial({ map: d6Face.px, roughness: 0.55, metalness: 0.02 }),
      new THREE.MeshStandardMaterial({ map: d6Face.nx, roughness: 0.55, metalness: 0.02 }),
      new THREE.MeshStandardMaterial({ map: d6Face.py, roughness: 0.55, metalness: 0.02 }),
      new THREE.MeshStandardMaterial({ map: d6Face.ny, roughness: 0.55, metalness: 0.02 }),
      new THREE.MeshStandardMaterial({ map: d6Face.pz, roughness: 0.55, metalness: 0.02 }),
      new THREE.MeshStandardMaterial({ map: d6Face.nz, roughness: 0.55, metalness: 0.02 }),
    ];
    const mesh = new THREE.Mesh(geo, mats);
    mesh.castShadow = true;
    return mesh;
  }

  function createD6Body() {
    return new CANNON.Body({
      mass: 1,
      shape: new CANNON.Box(new CANNON.Vec3(half, half, half)),
      material: diceMat,
      linearDamping: 0.15,
      angularDamping: 0.18,
      allowSleep: true,
      sleepSpeedLimit: 0.2,
      sleepTimeLimit: 0.35,
    });
  }

  function getD6UpValue(mesh) {
    const up = new THREE.Vector3(0, 1, 0);
    const axes = [
      { dir: new THREE.Vector3( 1, 0, 0), val: 3 },
      { dir: new THREE.Vector3(-1, 0, 0), val: 4 },
      { dir: new THREE.Vector3( 0, 1, 0), val: 1 },
      { dir: new THREE.Vector3( 0,-1, 0), val: 6 },
      { dir: new THREE.Vector3( 0, 0, 1), val: 2 },
      { dir: new THREE.Vector3( 0, 0,-1), val: 5 },
    ];
    let best = { dot: -Infinity, val: 1 };
    for (const a of axes) {
      const worldDir = a.dir.clone().applyQuaternion(mesh.quaternion);
      const d = worldDir.dot(up);
      if (d > best.dot) best = { dot: d, val: a.val };
    }
    return best.val;
  }

  // ---------- D20 (icosahedron) ----------
  // стандартные вершины икосаэдра
  const PHI = (1 + Math.sqrt(5)) / 2;
  const d20Scale = 0.95;

  // vertices
  const v = [
    [-1,  PHI, 0], [ 1,  PHI, 0], [-1, -PHI, 0], [ 1, -PHI, 0],
    [0, -1,  PHI], [0,  1,  PHI], [0, -1, -PHI], [0,  1, -PHI],
    [ PHI, 0, -1], [ PHI, 0,  1], [-PHI, 0, -1], [-PHI, 0,  1],
  ].map(p => p.map(x => x * d20Scale));

  // faces (triangles) — 20 штук
  const f = [
    [0,11,5],[0,5,1],[0,1,7],[0,7,10],[0,10,11],
    [1,5,9],[5,11,4],[11,10,2],[10,7,6],[7,1,8],
    [3,9,4],[3,4,2],[3,2,6],[3,6,8],[3,8,9],
    [4,9,5],[2,4,11],[6,2,10],[8,6,7],[9,8,1],
  ];

  // face index -> value (1..20). Это не “казино-нумерация”, но честно и стабильно.
  const d20FaceValue = Array.from({ length: 20 }, (_, i) => i + 1);

  function createD20Mesh() {
    const geo = new THREE.IcosahedronGeometry(d20Scale, 0);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x9bdcff,
      roughness: 0.35,
      metalness: 0.15,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    return mesh;
  }

  function createD20Body() {
    const verts = v.map(p => new CANNON.Vec3(p[0], p[1], p[2]));
    const poly = new CANNON.ConvexPolyhedron({ vertices: verts, faces: f });
    return new CANNON.Body({
      mass: 1,
      shape: poly,
      material: diceMat,
      linearDamping: 0.12,
      angularDamping: 0.16,
      allowSleep: true,
      sleepSpeedLimit: 0.2,
      sleepTimeLimit: 0.35,
    });
  }

  function getD20UpValue(mesh) {
    const up = new THREE.Vector3(0, 1, 0);

    // ищем грань, чья нормаль максимально смотрит вверх
    let bestFace = 0;
    let bestDot = -Infinity;

    for (let i = 0; i < f.length; i++) {
      const [a, b, c] = f[i];
      const A = new THREE.Vector3(...v[a]);
      const B = new THREE.Vector3(...v[b]);
      const C = new THREE.Vector3(...v[c]);

      const n = new THREE.Vector3()
        .subVectors(B, A)
        .cross(new THREE.Vector3().subVectors(C, A))
        .normalize();

      const worldN = n.applyQuaternion(mesh.quaternion);
      const d = worldN.dot(up);

      if (d > bestDot) {
        bestDot = d;
        bestFace = i;
      }
    }
    return d20FaceValue[bestFace];
  }

  // ---------- Dice instances ----------
  const dice = []; // { type, mesh, body }

  function clearDice() {
    for (const d of dice) {
      scene.remove(d.mesh);
      world.removeBody(d.body);
    }
    dice.length = 0;
  }

  function spawnDice({ sides, count }) {
    clearDice();

    for (let i = 0; i < count; i++) {
      const type = (sides === 6) ? 'd6' : (sides === 20) ? 'd20' : 'other';

      let mesh, body;
      if (type === 'd6') { mesh = createD6Mesh(); body = createD6Body(); }
      else if (type === 'd20') { mesh = createD20Mesh(); body = createD20Body(); }
      else { continue; }

      const x = (i - (count - 1) / 2) * 1.35;
      mesh.position.set(x, 3 + i * 0.25, 0);
      body.position.set(x, 3 + i * 0.25, 0);

      const q = new THREE.Quaternion().setFromEuler(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI
      );
      mesh.quaternion.copy(q);
      body.quaternion.set(q.x, q.y, q.z, q.w);

      scene.add(mesh);
      world.addBody(body);

      dice.push({ type, mesh, body });
    }
  }

  function kickDice() {
    for (const d of dice) {
      const impulse = new CANNON.Vec3(
        (Math.random() * 2 - 1) * 2.2,
        0,
        -5.5 - Math.random() * 1.5
      );
      const point = new CANNON.Vec3(
        (Math.random() * 2 - 1) * 0.2,
        (Math.random() * 2 - 1) * 0.2,
        (Math.random() * 2 - 1) * 0.2
      );
      d.body.applyImpulse(impulse, d.body.position.vadd(point));
      d.body.angularVelocity.set(
        (Math.random() * 2 - 1) * 12,
        (Math.random() * 2 - 1) * 12,
        (Math.random() * 2 - 1) * 12
      );
      d.body.wakeUp();
    }
  }

  async function waitStop(timeoutMs = 3500) {
    const start = performance.now();
    await new Promise((resolve) => {
      const t = setInterval(() => {
        const allSleeping = dice.every(d => d.body.sleepState === CANNON.Body.SLEEPING);
        const time = performance.now() - start;
        if (allSleeping || time > timeoutMs) {
          clearInterval(t);
          resolve();
        }
      }, 60);
    });
  }

  // ---------- Loop ----------
  let last = performance.now();
  function tick(now) {
    const dt = Math.min((now - last) / 1000, 1 / 30);
    last = now;

    world.step(1 / 60, dt, 3);

    for (const d of dice) {
      d.mesh.position.copy(d.body.position);
      d.mesh.quaternion.set(d.body.quaternion.x, d.body.quaternion.y, d.body.quaternion.z, d.body.quaternion.w);
    }

    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  // ---------- Public API ----------
  window.rollDice3D = async ({ sides = 20, count = 1 } = {}) => {
    // Пока поддержим красиво d6 и d20.
    // Остальные — можно добавить, но чтобы сайт не ломался: fallback рандомом.
    if (![6, 20].includes(sides)) {
      return Array.from({ length: count }, () => 1 + Math.floor(Math.random() * sides));
    }

    spawnDice({ sides, count });
    kickDice();
    await waitStop();

    return dice.map(d => {
      if (d.type === 'd6') return getD6UpValue(d.mesh);
      if (d.type === 'd20') return getD20UpValue(d.mesh);
      return 0;
    });
  };

  // demo по клику в поле
  mount.addEventListener('pointerdown', () => window.rollDice3D({ sides: 20, count: 2 }));
}
