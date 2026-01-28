import * as THREE from 'https://esm.sh/three@0.161.0';
import { RoundedBoxGeometry } from 'https://esm.sh/three@0.161.0/examples/jsm/geometries/RoundedBoxGeometry.js';
import * as CANNON from 'https://esm.sh/cannon-es@0.20.0';

export function initDice3D(mountSelector = '#dice3d') {
  const mount = document.querySelector(mountSelector);
  if (!mount) throw new Error(`Mount not found: ${mountSelector}`);

  // ---------------- THREE ----------------
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x07080b);

  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  camera.position.set(0, 5.2, 8.6);
  camera.lookAt(0, 0.7, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
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

  const rim = new THREE.DirectionalLight(0xffffff, 0.35);
  rim.position.set(-8, 7, -6);
  scene.add(rim);

  // Felt table texture (казино)
  function makeFeltTexture() {
    const s = 512;
    const c = document.createElement('canvas');
    c.width = s; c.height = s;
    const ctx = c.getContext('2d');

    // base felt green
    const grad = ctx.createLinearGradient(0, 0, s, s);
    grad.addColorStop(0, '#0b3a23');
    grad.addColorStop(1, '#062417');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, s, s);

    // noise fibers
    const img = ctx.getImageData(0, 0, s, s);
    for (let i = 0; i < img.data.length; i += 4) {
      const n = (Math.random() * 30 - 15);
      img.data[i] = Math.min(255, Math.max(0, img.data[i] + n));       // R
      img.data[i+1] = Math.min(255, Math.max(0, img.data[i+1] + n));   // G
      img.data[i+2] = Math.min(255, Math.max(0, img.data[i+2] + n));   // B
    }
    ctx.putImageData(img, 0, 0);

    // subtle vignette
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath();
    ctx.arc(s/2, s/2, s*0.55, 0, Math.PI*2);
    ctx.fill();

    const tex = new THREE.CanvasTexture(c);
    tex.anisotropy = 8;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(2, 2);
    return tex;
  }

  const table = new THREE.Mesh(
    new THREE.PlaneGeometry(20, 20),
    new THREE.MeshStandardMaterial({
      map: makeFeltTexture(),
      roughness: 1.0,
      metalness: 0.0
    })
  );
  table.rotation.x = -Math.PI / 2;
  table.receiveShadow = true;
  scene.add(table);

  // ---------------- CANNON ----------------
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

  // invisible walls
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
    friction: 0.30,
    restitution: 0.32,
  }));

  function resize() {
    const w = mount.clientWidth || 600;
    const h = mount.clientHeight || 520;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }
  new ResizeObserver(resize).observe(mount);
  resize();

  // ---------------- D6 (casino) ----------------
  const d6Size = 0.55;
  const half = d6Size / 2;

  // pip textures: white plastic + red pips
  function makePipFaceTexture(pips) {
    const s = 256;
    const c = document.createElement('canvas');
    c.width = s; c.height = s;
    const ctx = c.getContext('2d');

    // plastic-ish base (slight gradient)
    const g = ctx.createLinearGradient(0, 0, s, s);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(1, '#e9edf3');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);

    // border
    ctx.strokeStyle = 'rgba(0,0,0,0.10)';
    ctx.lineWidth = 10;
    ctx.strokeRect(10, 10, s - 20, s - 20);

    // pips grid
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

    // draw pips (casino red)
    ctx.fillStyle = '#d10f14';
    for (const [x, y] of layouts[pips]) {
      // little bevel shadow
      ctx.beginPath();
      ctx.arc(x + 2, y + 2, r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.20)';
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

  // +Y top: 1, -Y bottom: 6, +X:3, -X:4, +Z:2, -Z:5
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

  // ---------------- D20 (black marble + white numbers) ----------------
  // We'll build a custom icosahedron with 20 separate triangle groups so each face can have its own texture/material.

  const PHI = (1 + Math.sqrt(5)) / 2;
  const d20Scale = 0.55;

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

  // stable mapping faceIndex -> value (1..20)
  const faceValue = Array.from({ length: 20 }, (_, i) => i + 1);

  function makeMarbleNumberTexture(n) {
    const s = 512;
    const c = document.createElement('canvas');
    c.width = s; c.height = s;
    const ctx = c.getContext('2d');

    // base dark marble
    const g = ctx.createRadialGradient(s*0.35, s*0.30, s*0.10, s*0.5, s*0.5, s*0.75);
    g.addColorStop(0, '#1a1b1f');
    g.addColorStop(1, '#07070a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);

    // subtle noise
    const img = ctx.getImageData(0, 0, s, s);
    for (let i = 0; i < img.data.length; i += 4) {
      const nn = (Math.random() * 28 - 14);
      img.data[i]   = Math.min(255, Math.max(0, img.data[i] + nn));
      img.data[i+1] = Math.min(255, Math.max(0, img.data[i+1] + nn));
      img.data[i+2] = Math.min(255, Math.max(0, img.data[i+2] + nn));
    }
    ctx.putImageData(img, 0, 0);

    // marble veins
    ctx.globalAlpha = 0.22;
    for (let k = 0; k < 26; k++) {
      const x0 = Math.random() * s;
      const y0 = Math.random() * s;
      const x1 = x0 + (Math.random() * 240 - 120);
      const y1 = y0 + (Math.random() * 240 - 120);
      ctx.strokeStyle = 'rgba(255,255,255,0.65)';
      ctx.lineWidth = 1 + Math.random() * 2.0;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      // curvy vein
      const cx = (x0 + x1) / 2 + (Math.random() * 140 - 70);
      const cy = (y0 + y1) / 2 + (Math.random() * 140 - 70);
      ctx.quadraticCurveTo(cx, cy, x1, y1);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // border highlight
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 14;
    ctx.strokeRect(20, 20, s - 40, s - 40);

    // number in white
    ctx.fillStyle = '#f6f7fb';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '900 220px system-ui, -apple-system, Segoe UI, Roboto, Arial';
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = 14;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 10;
    ctx.fillText(String(n), s/2, s/2 + 10);
    ctx.shadowColor = 'transparent';

    const tex = new THREE.CanvasTexture(c);
    tex.anisotropy = 8;
    return tex;
  }

  function createD20GeometryWithGroups() {
    const positions = [];
    const uvs = [];
    const indices = [];
    const geo = new THREE.BufferGeometry();

    // standard triangle UVs
    const UV = [
      [0.08, 0.10],
      [0.92, 0.10],
      [0.50, 0.92],
    ];

    let vertBase = 0;

    for (let i = 0; i < F.length; i++) {
      const [a, b, c] = F[i];

      // duplicate vertices per face (so each face can have clean UV)
      const A = V[a], B = V[b], C = V[c];

      positions.push(A[0], A[1], A[2]);
      positions.push(B[0], B[1], B[2]);
      positions.push(C[0], C[1], C[2]);

      uvs.push(UV[0][0], UV[0][1]);
      uvs.push(UV[1][0], UV[1][1]);
      uvs.push(UV[2][0], UV[2][1]);

      indices.push(vertBase, vertBase + 1, vertBase + 2);

      // group: 1 triangle (3 indices)
      geo.addGroup(i * 3, 3, i);

      vertBase += 3;
    }

    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }

  const d20Geometry = createD20GeometryWithGroups();
  const d20Materials = faceValue.map((n) => {
    const map = makeMarbleNumberTexture(n);
    return new THREE.MeshStandardMaterial({
      map,
      roughness: 0.55,
      metalness: 0.10,
    });
  });

  function createD20Mesh() {
    const mesh = new THREE.Mesh(d20Geometry, d20Materials);
    mesh.castShadow = true;
    return mesh;
  }

  // physics: convex polyhedron based on original icosahedron vertices/faces
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

  function getD20UpValue(mesh) {
    const up = new THREE.Vector3(0, 1, 0);
    let bestFace = 0;
    let bestDot = -Infinity;

    // compute face normals from base V/F, rotate by mesh quaternion, pick most-upwards
    for (let i = 0; i < F.length; i++) {
      const [a, b, c] = F[i];
      const A = new THREE.Vector3(...V[a]);
      const B = new THREE.Vector3(...V[b]);
      const C = new THREE.Vector3(...V[c]);

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
    return faceValue[bestFace];
  }

  // ---------------- Instances ----------------
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

      const x = (i - (count - 1) / 2) * 1.55;
      const y = 3 + i * 0.30;

      mesh.position.set(x, y, 0);
      body.position.set(x, y, 0);

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
        (Math.random() * 2 - 1) * 2.3,
        0,
        -5.7 - Math.random() * 1.3
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

  // ---------------- Loop ----------------
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

  // ---------------- Public API ----------------
  window.rollDice3D = async ({ sides = 6, count = 1 } = {}) => {
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
}

