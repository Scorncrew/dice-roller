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
    cons
