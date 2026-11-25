import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { ArchiveKind } from '@/components/archive-card-carousel/archive-carousel-model';

const palettes = {
  luna: { metal: 0xd29c82, light: 0xffd9b6, tilt: -.26 },
  grand: { metal: 0xe1ab99, light: 0xffc4ad, tilt: .22 },
  faction: { metal: 0xb88b86, light: 0xf6cabc, tilt: -.15 },
};

export function mountCollectorInstrument(host: HTMLDivElement, kind: ArchiveKind) {
  const dialog = host.closest('dialog');
  if (!dialog) return;
  const skin = palettes[kind];
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
  renderer.setClearColor(0x04060b, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, matchMedia('(pointer: coarse)').matches ? 1 : 1.5));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.13;
  const canvas = renderer.domElement;
  canvas.setAttribute('aria-hidden', 'true');
  host.append(canvas);

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-4, 4, 2.8, -2.8, .1, 35);
  camera.position.set(0, 0, 9);
  const frame = new THREE.Group();
  const dial = new THREE.Group();
  const meridian = new THREE.Group();
  scene.add(frame);
  frame.add(dial, meridian);
  const metal = new THREE.MeshStandardMaterial({ color: skin.metal, metalness: .76, roughness: .28, envMapIntensity: .76 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x415061, metalness: .65, roughness: .42 });
  const enamel = new THREE.MeshStandardMaterial({ color: skin.light, emissive: skin.light, emissiveIntensity: .26, roughness: .25, metalness: .38 });
  const etching = new THREE.MeshBasicMaterial({ color: skin.light, transparent: true, opacity: .59 });
  const resources: THREE.BufferGeometry[] = [];
  const fromGeometry = (group: THREE.Group, geom: THREE.BufferGeometry, material: THREE.Material) => {
    resources.push(geom);
    const mesh = new THREE.Mesh(geom, material);
    group.add(mesh);
    return mesh;
  };
  const ring = (group: THREE.Group, radius: number, gauge: number, start: number, arc: number, material: THREE.Material) => {
    const shape = fromGeometry(group, new THREE.TorusGeometry(radius, gauge, 6, Math.max(20, Math.round(arc * 27)), arc), material);
    shape.rotation.z = start;
    return shape;
  };
  // Leave gaps between the three pieces of the outer band, like a physical dial.
  for (let i = 0; i < 3; i++) {
    const angle = i * Math.PI * 2 / 3;
    ring(dial, 2.79, .019, angle + .035, 1.92, metal);
    ring(dial, 2.73, .006, angle + .065, 1.86, etching);
  }
  ring(dial, 2.55, .009, .12, Math.PI * 1.80, dark);
  ring(meridian, 2.65, .018, .16, Math.PI * 1.88, metal);
  ring(meridian, 2.61, .004, .36, Math.PI * 1.60, etching);

  const tickGeometry = new RoundedBoxGeometry(.014, .11, .024, 1, .005);
  resources.push(tickGeometry);
  const ticks = new THREE.InstancedMesh(tickGeometry, metal, 96);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < ticks.count; i++) {
    const angle = i * Math.PI / 48;
    dummy.position.set(Math.sin(angle) * 2.66, Math.cos(angle) * 2.66, .025);
    dummy.rotation.z = -angle;
    dummy.scale.set(i % 8 === 0 ? 2.2 : 1, i % 8 === 0 ? 1.6 : .53, 1);
    dummy.updateMatrix();
    ticks.setMatrixAt(i, dummy.matrix);
  }
  ticks.instanceMatrix.needsUpdate = true;
  dial.add(ticks);
  const bead = fromGeometry(meridian, new THREE.OctahedronGeometry(.064), enamel);
  bead.position.set(2.65, 0, .015);
  const counterweight = fromGeometry(dial, new THREE.OctahedronGeometry(.077), metal);
  counterweight.position.set(-2.79, 0, .013);
  const fill = new THREE.HemisphereLight(0xe4efff, 0x414058, 1.6);
  const key = new THREE.DirectionalLight(0xffedce, 2.7);
  const bounce = new THREE.DirectionalLight(skin.light, 1.9);
  key.position.set(-2, 3, 4);
  bounce.position.set(3, -.4, 3);
  scene.add(fill, key, bounce);
  // The local Three.js add-on supplies studio reflections without an HDR file.
  let environment: THREE.WebGLRenderTarget | undefined;
  if (!matchMedia('(pointer: coarse)').matches) {
    const room = new RoomEnvironment();
    const pmrem = new THREE.PMREMGenerator(renderer);
    try {
      environment = pmrem.fromScene(room, .065);
      scene.environment = environment.texture;
    } catch {
      metal.metalness = .4;
    } finally {
      room.dispose();
      pmrem.dispose();
    }
  }

  const events = new AbortController();
  const passive = { passive: true, signal: events.signal };
  const started = performance.now();
  let targetX = 0, targetY = 0, x = 0, y = 0, pulse = 0, request = 0, lastTime = started;
  let disposed = false;
  function schedule() {
    if (!disposed && !document.hidden && !request) request = window.requestAnimationFrame(draw);
  }
  function draw(now: number) {
    request = 0;
    if (disposed || document.hidden) return;
    const dt = Math.min(.08, Math.max(.001, (now - lastTime) / 1000));
    lastTime = now;
    const ease = 1 - Math.exp(-dt * 11);
    x += (targetX - x) * ease;
    y += (targetY - y) * ease;
    const entrance = Math.min(1, (now - started) / 950);
    const reveal = 1 - (1 - entrance) ** 3;
    frame.rotation.set(-.04 + y * .09, x * .12, skin.tilt);
    dial.rotation.set(.38 + y * .19, -.14 + x * .12, (1 - reveal) * -.42 + x * .075);
    meridian.rotation.set(1.12 - y * .20, .23 - x * .18, .57 + .50 * (1 - reveal) - x * .09);
    key.position.set(-2 + x * 2.0, 3 - y, 4);
    pulse *= Math.exp(-dt * 5);
    enamel.emissiveIntensity = .26 + pulse * .7;
    bead.scale.setScalar(1 + pulse * .45);
    host.style.opacity = String(.85 * reveal);
    renderer.render(scene, camera);
    if (entrance < 1 || Math.abs(targetX - x) + Math.abs(targetY - y) > .0015 || pulse > .015) schedule();
  }
  function size() {
    const { width, height } = host.getBoundingClientRect();
    if (!width || !height) return;
    const aspect = width / height;
    camera.left = -2.8 * aspect;
    camera.right = 2.8 * aspect;
    camera.updateProjectionMatrix();
    frame.scale.setScalar(Math.min(1.05, Math.max(.49, aspect / 1.12)));
    frame.position.set(kind === 'grand' && width >= 820 ? width * .065 / height * 5.6 : 0, .09, 0);
    renderer.setSize(width, height, false);
    schedule();
  }
  function point(event: PointerEvent) {
    if (!event.isPrimary) return;
    const box = dialog!.getBoundingClientRect();
    targetX = THREE.MathUtils.clamp((event.clientX - box.left) / Math.max(1, box.width) * 2 - 1, -1, 1);
    targetY = THREE.MathUtils.clamp((event.clientY - box.top) / Math.max(1, box.height) * 2 - 1, -1, 1);
    schedule();
  }
  function rest() { targetX = 0; targetY = 0; schedule(); }
  dialog.addEventListener('pointermove', point, passive);
  dialog.addEventListener('pointerdown', event => { point(event); pulse = 1; schedule(); }, passive);
  dialog.addEventListener('pointerleave', rest, passive);
  dialog.addEventListener('pointercancel', rest, passive);
  dialog.addEventListener('pointerup', event => { if (event.pointerType !== 'mouse') rest(); }, passive);
  document.addEventListener('visibilitychange', () => { if (document.hidden) { cancelAnimationFrame(request); request = 0; } else schedule(); }, passive);
  const resize = new ResizeObserver(size);
  resize.observe(host);
  host.dataset.instrument = 'webgl';
  size();
  function dispose() {
    if (disposed) return;
    disposed = true;
    events.abort();
    cancelAnimationFrame(request);
    resize.disconnect();
    for (const geometry of resources) geometry.dispose();
    for (const material of [metal, dark, enamel, etching]) material.dispose();
    ticks.dispose();
    environment?.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    canvas.remove();
    host.style.removeProperty('opacity');
    host.dataset.instrument = 'still';
  }
  canvas.addEventListener('webglcontextlost', dispose, { signal: events.signal });
  return dispose;
}