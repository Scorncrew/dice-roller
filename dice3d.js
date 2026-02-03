import * as THREE from 'https://esm.sh/three@0.161.0';
import { RoundedBoxGeometry } from 'https://esm.sh/three@0.161.0/examples/jsm/geometries/RoundedBoxGeometryGeometry.js'.catch?.(() => null);
// ↑ на всякий: если импорт сломается, ниже дублирую правильный:
import { RoundedBoxGeometry as _RoundedBoxGeometry } from 'https://esm.sh/three@0.161.0/examples/jsm/geometries/RoundedBoxGeometry.js';
import * as CANNON from 'https://esm.sh/cannon-es@0.20.0';

const RoundedBox = _RoundedBoxGeometry;

export function initDice3D(mountSelector = '#dice3d') {
  const mount = document.querySelector(mountSelector);
  if (!mount) throw new Error(`Mount not found: ${mountSelector}`);

  const MAX_DICE = 100;

  // table / arena
  const TABLE_SIZE = 30;
  const ARENA_HALF = 13.5;

  // camera
  const CAM_POS  = new THREE.Vector3(0, 20.0, 12.0);
  const CAM_LOOK = new THREE.Vector3(0, 0.5, 0);

  // sizes
  const D6_SIZE = 1.10;
  const D20_SCALE = 0.62 * (2 / 3);

  // throw
  const THROW_MIN = 0.6;
  const THROW_MAX = 6.0;

  // =========================
  // THREE
  // =========================
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x07080b);

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 300);
  camera.position.copy(CAM_POS);
  camera.lookAt(CAM_LOOK);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  mount.innerHTML = '';
  mount.appendChild(renderer.domElement);

  scene.add(new THREE.AmbientLight(0xffffff, 0.55));

  const key = new THREE.DirectionalLight(0xffffff, 1.15);
  key.position.set(10, 18, 8);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 80;
  key.shadow.camera.left = -20;
  key.shadow.camera.right = 20;
  key.shadow.camera.top = 20;
  key.shadow.camera.bottom = -20;
  scene.add(key);

  const rim = new THREE.DirectionalLight(0xffffff, 0.35);
  rim.position.set(-12, 14, -10);
  scene.add(rim);

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

  // ground plane
  world.addBody(new CANNON.Body({
    mass: 0,
    shape: new CANNON.Plane(),
    material: groundMat,
    quaternion: new CANNON.Quaternion().setFromEuler(-Math.PI / 2, 0, 0),
  }));

  // ✅ реальные стенки-коробки (невидимые) — держат кубы со всех 4 сторон
  const WALL_THICK = 0.9;
  const WALL_HEIGHT = 6.0;

  function addWallBox({ x, z, hx, hz }) {
    const body = new CANNON.Body({ mass: 0, material: groundMat });
    body.addShape(new CANNON.Box(new CANNON.Vec3(hx, WALL_HEIGHT / 2, hz)));
    body.position.set(x, WALL_HEIGHT / 2, z);
    world.addBody(body);
    return body;
  }

  // North/South (по Z)
  addWallBox({
    x: 0,
    z: -(ARENA_HALF + WALL_THICK / 2),
    hx: (ARENA_HALF + WALL_THICK) ,
    hz: WALL_THICK / 2
  });
  addWallBox({
    x: 0,
    z: (ARENA_HALF + WALL_THICK / 2),
    hx: (ARENA_HALF + WALL_THICK),
    hz: WALL_THICK / 2
  });

  // West/East (по X)
  addWallBox({
    x: -(ARENA_HALF + WALL_THICK / 2),
    z: 0,
    hx: WALL_THICK / 2,
    hz: (ARENA_HALF + WALL_THICK)
  });
  addWallBox({
    x: (ARENA_HALF + WALL_THICK / 2),
    z: 0,
    hx: WALL_THICK / 2,
    hz: (ARENA_HALF + WALL_THICK)
  });

  // "скачут"
  world.addContactMaterial(new CANNON.ContactMaterial(groundMat, diceMat, {
    friction: 0.22,
    restitution: 0.58,
  }));

  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

  // drag -> dir (camera space projected to XZ)
  function screenDragToWorldDir(dx, dy) {
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);

    right.y = 0; forward.y = 0;
    right.normalize(); forward.normalize();

    const v = right.multiplyScalar(dx).add(forward.multiplyScalar(-dy));
    v.y = 0;

    const len = v.length();
    if (len < 1e-6) return new CANNON.Vec3(0, 0, -1);
    v.normalize();
    return new CANNON.Vec3(v.x, 0, v.z);
  }

  // =========================
  // D6
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

  const d6Face = {
    px: makePipFaceTexture(3),
    nx: makePipFaceTexture(4),
    py: makePipFaceTexture(1),
    ny: makePipFaceTexture(6),
    pz: makePipFaceTexture(2),
    nz: makePipFaceTexture(5),
  };

  function createD6Mesh() {
    const geo = new RoundedBox(d6Size, d6Size, d6Size, 6, 0.22);
    const mats = [
      new THREE.MeshStandardMaterial({ map: d6Face.px, roughness: 0.33, metalness: 0.02 }),
      new THREE.MeshStandardMaterial({ map: d6Face.nx, roughness: 0.33, metalness: 0.02 }),
      new THREE.MeshStandardMaterial({ map: d6Face.py, roughness: 0.33, metalness: 0.02 }),
      new THREE.MeshStandardMaterial({ map: d6Face.ny, roughness: 0.33, metalness: 0.02 }),
      new THREE.MeshStandardMaterial({ map: d6Face.pz, roughness: 0.33, metalness: 0.02 }),
      new THREE.MeshStandardMaterial({ map: d6Face.nz, roughness: 0.33, metalness: 0.02 }),
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
      linearDamping: 0.08,
      angularDamping: 0.10,
      allowSleep: true,
      sleepSpeedLimit: 0.24,
      sleepTimeLimit: 0.45,
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
  // D20
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

  function makeMarbleTexture() {
    const s = 512;
    const c = document.createElement('canvas');
    c.width = s; c.height = s;
    const ctx = c.getContext('2d');

    ctx.fillStyle = '#05060a';
    ctx.fillRect(0, 0, s, s);

    const img = ctx.getImageData(0, 0, s, s);
    for (let i = 0; i < img.data.length; i += 4) {
      const n = (Math.random() * 34 - 17);
      img.data[i] = Math.max(0, Math.min(255, img.data[i] + n));
      img.data[i+1] = Math.max(0, Math.min(255, img.data[i+1] + n));
      img.data[i+2] = Math.max(0, Math.min(255, img.data[i+2] + n));
      img.data[i+3] = 255;
    }
    ctx.putImageData(img, 0, 0);

    ctx.globalAlpha = 0.12;
    ctx.strokeStyle = '#e8e8f0';
    ctx.lineWidth = 2.2;
    for (let k = 0; k < 14; k++) {
      ctx.beginPath();
      let x = Math.random() * s;
      let y = Math.random() * s;
      ctx.moveTo(x, y);
      for (let i = 0; i < 7; i++) {
        x += (Math.random() * 120 - 60);
        y += (Math.random() * 120 - 60);
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    const tex = new THREE.CanvasTexture(c);
    tex.anisotropy = 8;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1.2, 1.2);
    return tex;
  }

  const d20BodyMat = new THREE.MeshStandardMaterial({
    map: makeMarbleTexture(),
    color: 0xffffff,
    roughness: 0.62,
    metalness: 0.10,
  });

  function faceUVs() {
    return new Float32Array([ 0.08,0.10, 0.92,0.10, 0.50,0.92 ]);
  }

  function makeInsetNumberTexture(n) {
    const s = 512;
    const c = document.createElement('canvas');
    c.width = s; c.height = s;
    const ctx = c.getContext('2d');

    const g = ctx.createLinearGradient(0, 0, s, s);
    g.addColorStop(0, '#16171b');
    g.addColorStop(1, '#0a0b10');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);

    ctx.strokeStyle = 'rgba(255,255,255,0.10)';
    ctx.lineWidth = 14;
    ctx.strokeRect(22, 22, s - 44, s - 44);

    const A = { x: 0.08 * s, y: 0.10 * s };
    const B = { x: 0.92 * s, y: 0.10 * s };
    const Cc = { x: 0.50 * s, y: 0.92 * s };

    const cx = (A.x + B.x + Cc.x) / 3;
    const cy = (A.y + B.y + Cc.y) / 3;

    const baseW = Math.hypot(B.x - A.x, B.y - A.y);
    const area2 = Math.abs((B.x - A.x) * (Cc.y - A.y) - (B.y - A.y) * (Cc.x - A.x));
    const triH = area2 / baseW;

    const targetW = baseW / 3;
    const targetH = triH / 2;

    const text = String(n);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    let fontSize = Math.max(20, targetH);
    for (let k = 0; k < 3; k++) {
      ctx.font = `900 ${fontSize}px system-ui, -apple-system, Segoe UI, Roboto, Arial`;
      const m = ctx.measureText(text);
      const measuredW = m.width || 1;
      const measuredH = (m.actualBoundingBoxAscent && m.actualBoundingBoxDescent)
        ? (m.actualBoundingBoxAscent + m.actualBoundingBoxDescent)
        : fontSize;
      const scale = Math.min(targetW / measuredW, targetH / measuredH);
      fontSize = Math.max(14, fontSize * scale);
    }

    ctx.font = `900 ${fontSize}px system-ui, -apple-system, Segoe UI, Roboto, Arial`;

    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillText(text, cx + 2.0, cy + 3.6);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillText(text, cx - 1.4, cy - 2.2);
    ctx.fillStyle = '#f1f2f6';
    ctx.fillText(text, cx, cy);

    const tex = new THREE.CanvasTexture(c);
    tex.anisotropy = 8;
    return tex;
  }

  function createD20Mesh() {
    const group = new THREE.Group();

    const bodyGeo = new THREE.IcosahedronGeometry(d20Scale, 0);

    // sphere-like normals
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

    const insetDepth = d20Scale * 0.085;
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
        roughness: 0.90,
        metalness: 0.02,
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
      linearDamping: 0.06,
      angularDamping: 0.10,
      allowSleep: true,
      sleepSpeedLimit: 0.24,
      sleepTimeLimit: 0.45,
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

      if (d > bestDot) { bestDot = d; bestFace = i; }
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

    const n = Math.max(1, Math.min(MAX_DICE, count));
    const type = (sides === 6) ? 'd6' : 'd20';

    const size = (type === 'd6') ? d6Size : d20Scale;
    const R = Math.min(ARENA_HALF * 0.30, size * 0.65 * Math.sqrt(n));

    const golden = Math.PI * (3 - Math.sqrt(5));

    for (let i = 0; i < n; i++) {
      let mesh, body;
      if (type === 'd6') { mesh = createD6Mesh(); body = createD6Body(); }
      else { mesh = createD20Mesh(); body = createD20Body(); }

      const t = (n === 1) ? 0 : (i / (n - 1));
      const radius = Math.sqrt(t) * R;
      const angle = i * golden;

      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const y = 5.2 + Math.random() * 0.8;

      mesh.position.set(x, y, z);
      body.position.set(x, y, z);

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

  function kickDice(throwCfg) {
    let dir = null;
    let strength = null;

    if (throwCfg && typeof throwCfg.dx === 'number' && typeof throwCfg.dy === 'number') {
      const len = Math.hypot(throwCfg.dx, throwCfg.dy);
      dir = screenDragToWorldDir(throwCfg.dx, throwCfg.dy);
      strength = clamp(len / 65, THROW_MIN, THROW_MAX);
    } else {
      const a = Math.random() * Math.PI * 2;
      dir = new CANNON.Vec3(Math.cos(a), 0, Math.sin(a));
      strength = 2.4;
    }

    for (const d of dice) {
      const isD6 = d.type === 'd6';
      const mag = strength * (isD6 ? 1.0 : 0.95);
      const spin = (isD6 ? 10.0 : 9.0);

      const jitter = 0.22;
      const jx = (Math.random() * 2 - 1) * jitter;
      const jz = (Math.random() * 2 - 1) * jitter;

      const cx = -d.body.position.x;
      const cz = -d.body.position.z;
      const clen = Math.hypot(cx, cz) || 1;
      const pull = 0.12;

      const ix = (dir.x + jx) * mag + (cx / clen) * pull;
      const iz = (dir.z + jz) * mag + (cz / clen) * pull;

      const impulse = new CANNON.Vec3(ix, 0.0, iz);

      const point = new CANNON.Vec3(
        (Math.random() * 2 - 1) * 0.08,
        (Math.random() * 2 - 1) * 0.08,
        (Math.random() * 2 - 1) * 0.08
      );

      d.body.applyImpulse(impulse, d.body.position.vadd(point));
      d.body.angularVelocity.set(
        (Math.random() * 2 - 1) * spin,
        (Math.random() * 2 - 1) * spin,
        (Math.random() * 2 - 1) * spin
      );
      d.body.wakeUp();
    }
  }

  async function waitStop(timeoutMs = 5200) {
    const start = performance.now();
    await new Promise((resolve) => {
      const t = setInterval(() => {
        const allSleeping = dice.every(d => d.body.sleepState === CANNON.Body.SLEEPING);
        const time = performance.now() - start;
        if (allSleeping || time > timeoutMs) {
          clearInterval(t);
          resolve();
        }
      }, 80);
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
  window.rollDice3D = async ({ sides = 6, count = 1, throwCfg = null } = {}) => {
    const safeCount = Math.max(1, Math.min(MAX_DICE, count));
    const s = (sides === 20) ? 20 : 6;

    spawnDice({ sides: s, count: safeCount });
    kickDice(throwCfg);
    await waitStop();

    return dice.map(d => (d.type === 'd6') ? getD6UpValue(d.mesh) : getD20UpValue(d.mesh));
  };
}
