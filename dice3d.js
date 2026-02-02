import * as THREE from 'https://esm.sh/three@0.161.0';
import { RoundedBoxGeometry } from 'https://esm.sh/three@0.161.0/examples/jsm/geometries/RoundedBoxGeometry.js';
import * as CANNON from 'https://esm.sh/cannon-es@0.20.0';

export function initDice3D(mountSelector = '#dice3d') {
  const mount = document.querySelector(mountSelector);
  if (!mount) throw new Error(`Mount not found: ${mountSelector}`);

  // =========================
  // TUNING
  // =========================
  const MAX_DICE = 100;

  // arena + table
  const ARENA_HALF = 12.5;
  const TABLE_SIZE = 28;

  // camera: почти сверху, чуть сбоку
  const CAM_POS  = new THREE.Vector3(0, 18.0, 10.8);
  const CAM_LOOK = new THREE.Vector3(0, 0.5, 0);

  // dice size
  const D6_SIZE   = 0.55;
  const D20_SCALE = 0.62;

  // =========================
  // THREE
  // =========================
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x07080b);

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 250);
  camera.position.copy(CAM_POS);
  camera.lookAt(CAM_LOOK);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  mount.appendChild(renderer.domElement);

  // lights
  scene.add(new THREE.AmbientLight(0xffffff, 0.55));

  const key = new THREE.DirectionalLight(0xffffff, 1.15);
  key.position.set(9, 16, 6);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 60;
  key.shadow.camera.left = -18;
  key.shadow.camera.right = 18;
  key.shadow.camera.top = 18;
  key.shadow.camera.bottom = -18;
  scene.add(key);

  const rim = new THREE.DirectionalLight(0xffffff, 0.35);
  rim.position.set(-10, 12, -8);
  scene.add(rim);

  // felt texture
  function makeFeltTexture() {
    const s = 512;
    const c = document.createElement('canvas');
    c.width = s; c.height = s;
    const ctx = c.getContext('2d');

    const grad = ctx.createLinearGradient(0, 0, s, s);
    grad.addColorStop(0, '#0b3a23');
    grad.addColorStop(1, '#062417');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, s, s);

    const img = ctx.getImageData(0, 0, s, s);
    for (let i = 0; i < img.data.length; i += 4) {
      const n = (Math.random() * 30 - 15);
      img.data[i]   = Math.min(255, Math.max(0, img.data[i] + n));
      img.data[i+1] = Math.min(255, Math.max(0, img.data[i+1] + n));
      img.data[i+2] = Math.min(255, Math.max(0, img.data[i+2] + n));
    }
    ctx.putImageData(img, 0, 0);

    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath();
    ctx.arc(s / 2, s / 2, s * 0.55, 0, Math.PI * 2);
    ctx.fill();

    const tex = new THREE.CanvasTexture(c);
    tex.anisotropy = 8;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(2, 2);
    return tex;
  }

  const table = new THREE.Mesh(
    new THREE.PlaneGeometry(TABLE_SIZE, TABLE_SIZE),
    new THREE.MeshStandardMaterial({
      map: makeFeltTexture(),
      roughness: 1.0,
      metalness: 0.0
    })
  );
  table.rotation.x = -Math.PI / 2;
  table.receiveShadow = true;
  scene.add(table);

  // resize
  function resize() {
    const w = mount.clientWidth || 600;
    const h = mount.clientHeight || 520;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }
  new ResizeObserver(resize).observe(mount);
  resize();

  // =========================
  // CANNON
  // =========================
  const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) });
  world.allowSleep = true;

  const groundMat = new CANNON.Material('ground');
  const diceMat = new CANNON.Material('dice');

  // ground
  world.addBody(new CANNON.Body({
    mass: 0,
    shape: new CANNON.Plane(),
    material: groundMat,
    quaternion: new CANNON.Quaternion().setFromEuler(-Math.PI / 2, 0, 0),
  }));

  // walls
  const wallShape = new CANNON.Plane();
  const walls = [
    { pos: [0, 0, -ARENA_HALF], rot: [0, 0, 0] },
    { pos: [0, 0,  ARENA_HALF], rot: [0, Math.PI, 0] },
    { pos: [-ARENA_HALF, 0, 0], rot: [0, Math.PI / 2, 0] },
    { pos: [ ARENA_HALF, 0, 0], rot: [0, -Math.PI / 2, 0] },
  ];
  for (const w of walls) {
    const b = new CANNON.Body({ mass: 0, shape: wallShape, material: groundMat });
    b.position.set(...w.pos);
    b.quaternion.setFromEuler(...w.rot);
    world.addBody(b);
  }

  world.addContactMaterial(new CANNON.ContactMaterial(groundMat, diceMat, {
    friction: 0.30,
    restitution: 0.32,
  }));

  // =========================
  // D6 (casino white + red pips)
  // =========================
  const d6Size = D6_SIZE;
  const half = d6Size / 2;

  function makePipFaceTexture(pips) {
    const s = 256;
    const c = document.createElement('canvas');
    c.width = s; c.height = s;
    const ctx = c.getContext('2d');

    const g = ctx.createLinearGradient(0, 0, s, s);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(1, '#e9edf3');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);

    ctx.strokeStyle = 'rgba(0,0,0,0.10)';
    ctx.lineWidth = 10;
    ctx.strokeRect(10, 10, s - 20, s - 20);

    const r = 18;
    const off = 62;
    const cx = s / 2;
    const cy = s / 2;

    const P = {
      TL: [cx - off, cy - off],
      TR: [cx + off, cy - off],
      ML: [cx - off, cy],
      MR: [cx + off, cy],
      BL: [cx - off, cy + off],
      BR: [cx + off, cy + off],
      C:  [cx, cy],
    };

    const layouts = {
      1: [P.C],
      2: [P.TL, P.BR],
      3: [P.TL, P.C, P.BR],
      4: [P.TL, P.TR, P.BL, P.BR],
      5: [P.TL, P.TR, P.C, P.BL, P.BR],
      6: [P.TL, P.ML, P.BL, P.TR, P.MR, P.BR],
    };

    for (const [x, y] of layouts[pips]) {
      ctx.beginPath();
      ctx.arc(x + 2, y + 2, r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = '#d10f14';
      ctx.fill();
    }

    const tex = new THREE.CanvasTexture(c);
    tex.anisotropy = 8;
    return tex;
  }

  // +Y:1, -Y:6, +X:3, -X:4, +Z:2, -Z:5
  const d6Face = {
    px: makePipFaceTexture(3),
    nx: makePipFaceTexture(4),
    py: makePipFaceTexture(1),
    ny: makePipFaceTexture(6),
    pz: makePipFaceTexture(2),
    nz: makePipFaceTexture(5),
  };

  function createD6Mesh() {
    const geo = new RoundedBoxGeometry(d6Size, d6Size, d6Size, 6, 0.18);
    const mats = [
      new THREE.MeshStandardMaterial({ map: d6Face.px, roughness: 0.35, metalness: 0.02 }),
      new THREE.MeshStandardMaterial({ map: d6Face.nx, roughness: 0.35, metalness: 0.02 }),
      new THREE.MeshStandardMaterial({ map: d6Face.py, roughness: 0.35, metalness: 0.02 }),
      new THREE.MeshStandardMaterial({ map: d6Face.ny, roughness: 0.35, metalness: 0.02 }),
      new THREE.MeshStandardMaterial({ map: d6Face.pz, roughness: 0.35, metalness: 0.02 }),
      new THREE.MeshStandardMaterial({ map: d6Face.nz, roughness: 0.35, metalness: 0.02 }),
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
      linearDamping: 0.16,
      angularDamping: 0.20,
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

  // =========================
  // D20 (gate-style: recessed triangles + centered numbers)
  // =========================
  const PHI = (1 + Math.sqrt(5)) / 2;
  const d20Scale = D20_SCALE;

  const V = [
    [-1,  PHI, 0], [ 1,  PHI, 0], [-1, -PHI, 0], [ 1, -PHI, 0],
    [0, -1,  PHI], [0,  1,  PHI], [0, -1, -PHI], [0,  1, -PHI],
    [ PHI, 0, -1], [ PHI, 0,  1], [-PHI, 0, -1], [-PHI, 0,  1],
  ].map(p => p.map(x => x * d20Scale));

  const F = [
    [0,11,5],[0,5,1],[0,1,7],[0,7,10],[0,10,11],
    [1,5,9],[5,11,4],[11,10,2],[10,7,6],[7,1,8],
    [3,9,4],[3,4,2],[3,2,6],[3,6,8],[3,8,9],
    [4,9,5],[2,4,11],[6,2,10],[8,6,7],[9,8,1],
  ];

  const faceValue = Array.from({ length: 20 }, (_, i) => i + 1);

  // body material (dark stone/metal vibe)
  const d20BodyMat = new THREE.MeshStandardMaterial({
    color: 0x2b2e33,
    roughness: 0.55,
    metalness: 0.35,
  });

  function faceUVs() {
    return new Float32Array([
      0.08, 0.10,
      0.92, 0.10,
      0.50, 0.92,
    ]);
  }

  // Centered number:
  // width ≈ 1/3 of face base, height ≈ 1/2 of face triangle height
  function makeInsetNumberTexture(n) {
    const s = 512;
    const c = document.createElement('canvas');
    c.width = s; c.height = s;
    const ctx = c.getContext('2d');

    // inset base
    const g = ctx.createLinearGradient(0, 0, s, s);
    g.addColorStop(0, '#111216');
    g.addColorStop(1, '#07080b');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);

    // subtle noise
    const img = ctx.getImageData(0, 0, s, s);
    for (let i = 0; i < img.data.length; i += 4) {
      const nn = (Math.random() * 18 - 9);
      img.data[i]   = Math.min(255, Math.max(0, img.data[i] + nn));
      img.data[i+1] = Math.min(255, Math.max(0, img.data[i+1] + nn));
      img.data[i+2] = Math.min(255, Math.max(0, img.data[i+2] + nn));
    }
    ctx.putImageData(img, 0, 0);

    // rim highlight
    ctx.strokeStyle = 'rgba(255,255,255,0.10)';
    ctx.lineWidth = 14;
    ctx.strokeRect(22, 22, s - 44, s - 44);

    // UV triangle points in pixels
    const A = { x: 0.08 * s, y: 0.10 * s };
    const B = { x: 0.92 * s, y: 0.10 * s };
    const Cc = { x: 0.50 * s, y: 0.92 * s };

    // centroid
    const cx = (A.x + B.x + Cc.x) / 3;
    const cy = (A.y + B.y + Cc.y) / 3;

    // base width
    const baseW = Math.hypot(B.x - A.x, B.y - A.y);

    // triangle height from area: h = (2*Area)/base => area2/base
    const area2 = Math.abs((B.x - A.x) * (Cc.y - A.y) - (B.y - A.y) * (Cc.x - A.x));
    const triH = area2 / baseW;

    const targetW = baseW / 3;
    const targetH = triH / 2;

    const text = String(n);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    let fontSize = Math.max(22, targetH);
    for (let k = 0; k < 3; k++) {
      ctx.font = `900 ${fontSize}px system-ui, -apple-system, Segoe UI, Roboto, Arial`;
      const m = ctx.measureText(text);
      const measuredW = m.width || 1;
      const measuredH = (m.actualBoundingBoxAscent && m.actualBoundingBoxDescent)
        ? (m.actualBoundingBoxAscent + m.actualBoundingBoxDescent)
        : fontSize;

      const scale = Math.min(targetW / measuredW, targetH / measuredH);
      fontSize = Math.max(16, fontSize * scale);
    }

    ctx.font = `900 ${fontSize}px system-ui, -apple-system, Segoe UI, Roboto, Arial`;

    // engraved-ish white numbers
    ctx.fillStyle = 'rgba(0,0,0,0.60)';
    ctx.fillText(text, cx + 2.2, cy + 4.0);
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.fillText(text, cx - 1.6, cy - 2.6);
    ctx.fillStyle = '#e6e7ea';
    ctx.fillText(text, cx, cy);

    const tex = new THREE.CanvasTexture(c);
    tex.anisotropy = 8;
    return tex;
  }

  function createD20Mesh() {
    const group = new THREE.Group();

    // body
    const bodyGeo = new THREE.IcosahedronGeometry(d20Scale, 0);

    // smoother lighting (fake rounding)
    {
      const pos = bodyGeo.attributes.position.array;
      const normals = new Float32Array(pos.length);
      for (let i = 0; i < pos.length; i += 3) {
        const x = pos[i], y = pos[i + 1], z = pos[i + 2];
        const len = Math.sqrt(x * x + y * y + z * z) || 1;
        normals[i] = x / len; normals[i + 1] = y / len; normals[i + 2] = z / len;
      }
      bodyGeo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    }

    const body = new THREE.Mesh(bodyGeo, d20BodyMat);
    body.castShadow = true;
    group.add(body);

    // recessed inserts
    const insetDepth = d20Scale * 0.075;
    const insetShrink = 0.86;

    for (let i = 0; i < F.length; i++) {
      const [ia, ib, ic] = F[i];
      const A = new THREE.Vector3(...V[ia]);
      const B = new THREE.Vector3(...V[ib]);
      const Cc = new THREE.Vector3(...V[ic]);

      const n = new THREE.Vector3()
        .subVectors(B, A)
        .cross(new THREE.Vector3().subVectors(Cc, A))
        .normalize();

      const center = new THREE.Vector3().addVectors(A, B).add(Cc).multiplyScalar(1 / 3);

      const a2 = A.clone().sub(center).multiplyScalar(insetShrink).add(center);
      const b2 = B.clone().sub(center).multiplyScalar(insetShrink).add(center);
      const c2 = Cc.clone().sub(center).multiplyScalar(insetShrink).add(center);

      a2.addScaledVector(n, -insetDepth);
      b2.addScaledVector(n, -insetDepth);
      c2.addScaledVector(n, -insetDepth);

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
        a2.x, a2.y, a2.z,
        b2.x, b2.y, b2.z,
        c2.x, c2.y, c2.z,
      ]), 3));
      geo.setAttribute('uv', new THREE.BufferAttribute(faceUVs(), 2));
      geo.setIndex([0, 1, 2]);
      geo.computeVertexNormals();

      const mat = new THREE.MeshStandardMaterial({
        map: makeInsetNumberTexture(faceValue[i]),
        roughness: 0.85,
        metalness: 0.06,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      });

      const face = new THREE.Mesh(geo, mat);
      face.castShadow = true;
      group.add(face);
    }

    return group;
  }

  function createD20Body() {
    const verts = V.map(p => new CANNON.Vec3(p[0], p[1], p[2]));
    const poly = new CANNON.ConvexPolyhedron({ vertices: verts, faces: F });
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

  function getD20UpValue(group) {
    const q = group.quaternion;
    const up = new THREE.Vector3(0, 1, 0);

    let bestFace = 0;
    let bestDot = -Infinity;

    for (let i = 0; i < F.length; i++) {
      const [a, b, c] = F[i];
      const A = new THREE.Vector3(...V[a]);
      const B = new THREE.Vector3(...V[b]);
      const Cc = new THREE.Vector3(...V[c]);

      const n = new THREE.Vector3()
        .subVectors(B, A)
        .cross(new THREE.Vector3().subVectors(Cc, A))
        .normalize();

      const worldN = n.applyQuaternion(q);
      const d = worldN.dot(up);

      if (d > bestDot) {
        bestDot = d;
        bestFace = i;
      }
    }
    return faceValue[bestFace];
  }

  // =========================
  // Dice instances
  // =========================
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

    const safeCount = Math.max(1, Math.min(MAX_DICE, count));
    const cols = Math.ceil(Math.sqrt(safeCount));
    const rows = Math.ceil(safeCount / cols);

    const spacing = (sides === 6)
      ? (d6Size * 1.25)
      : (d20Scale * 1.35);

    const startX = -((cols - 1) * spacing) / 2;
    const startZ = -((rows - 1) * spacing) / 2;

    for (let i = 0; i < safeCount; i++) {
      const type = (sides === 6) ? 'd6' : (sides === 20) ? 'd20' : 'other';
      let mesh, body;

      if (type === 'd6') { mesh = createD6Mesh(); body = createD6Body(); }
      else if (type === 'd20') { mesh = createD20Mesh(); body = createD20Body(); }
      else { continue; }

      const r = Math.floor(i / cols);
      const c = i % cols;

      const x = startX + c * spacing;
      const z = startZ + r * spacing;

      const jx = (Math.random() - 0.5) * spacing * 0.10;
      const jz = (Math.random() - 0.5) * spacing * 0.10;

      const y = 4.8 + Math.random() * 0.7;

      mesh.position.set(x + jx, y, z + jz);
      body.position.set(x + jx, y, z + jz);

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
        (Math.random() * 2 - 1) * 0.9,
        0,
        -2.0 - Math.random() * 0.8
      );

      const point = new CANNON.Vec3(
        (Math.random() * 2 - 1) * 0.08,
        (Math.random() * 2 - 1) * 0.08,
        (Math.random() * 2 - 1) * 0.08
      );

      d.body.applyImpulse(impulse, d.body.position.vadd(point));
      d.body.angularVelocity.set(
        (Math.random() * 2 - 1) * 6,
        (Math.random() * 2 - 1) * 6,
        (Math.random() * 2 - 1) * 6
      );
      d.body.wakeUp();
    }
  }

  async function waitStop(timeoutMs = 3800) {
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

  // =========================
  // Loop
  // =========================
  let last = performance.now();
  function tick(now) {
    const dt = Math.min((now - last) / 1000, 1 / 30);
    last = now;

    world.step(1 / 60, dt, 3);

    for (const d of dice) {
      d.mesh.position.copy(d.body.position);
      d.mesh.quaternion.set(
        d.body.quaternion.x,
        d.body.quaternion.y,
        d.body.quaternion.z,
        d.body.quaternion.w
      );
    }

    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  // =========================
  // Public API
  // =========================
  window.rollDice3D = async ({ sides = 6, count = 1 } = {}) => {
    const safeCount = Math.max(1, Math.min(MAX_DICE, count));

    if (![6, 20].includes(sides)) {
      return Array.from({ length: safeCount }, () => 1 + Math.floor(Math.random() * sides));
    }

    spawnDice({ sides, count: safeCount });
    kickDice();
    await waitStop();

    return dice.map(d => {
      if (d.type === 'd6') return getD6UpValue(d.mesh);
      if (d.type === 'd20') return getD20UpValue(d.mesh);
      return 0;
    });
  };
}
