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

  const ARENA_HALF = 12.5;
  const TABLE_SIZE = 28;

  // Camera: almost top-down, slightly side
  const CAM_POS  = new THREE.Vector3(0, 18.0, 10.8);
  const CAM_LOOK = new THREE.Vector3(0, 0.5, 0);

  // Dice sizes (smaller)
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

  // Lights
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

  // Felt table texture
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
      metalness: 0.0,
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
  const diceMat   = new CANNON.Material('dice');

  world.addBody(new CANNON.Body({
    mass: 0,
    shape: new CANNON.Plane(),
    material: groundMat,
    quaternion: new CANNON.Quaternion().setFromEuler(-Math.PI / 2, 0, 0),
  }));

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
  // D6 (casino: white + red pips)
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
      6
