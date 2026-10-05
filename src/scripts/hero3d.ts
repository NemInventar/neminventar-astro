// MIDLERTIDIG 3D i forsidens top (forside v3, 05-10-2026): lockers og højskab, så toppen lever, indtil designer-
// sessionens indlejr.v1.js findes (spec §6, D3b). Samme API som kontrakten — start() → { saet, on, ryd } — så siden
// ikke skal røres, når den skiftes ud. Bevidst UDEN pris og UDEN IFC/DXF: geometrien her er kun til at se på.
// Porteret fra mockups/forside-v3.html (three r128). Indlæses med import() efter 'load' (computer) eller ved tryk (telefon).
import * as THREE from 'three';

export type Produkt = 'locker' | 'hoejskab';
export type Tilstand = { produkt: Produkt; c: number; r: number; h: number; kuloer: string };
type Lytter = (t: Tilstand) => void;

const RW = 0.30, RH = 0.80, T = 0.018;

export function start(el: HTMLElement, init: Tilstand) {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const st: Tilstand = { ...init };
  const lyttere: Lytter[] = [];
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-label', '3D-model — træk for at dreje, tryk på en låge');
  el.appendChild(canvas);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.92;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 60);
  scene.add(new THREE.HemisphereLight(0xfff4e4, 0xcfc2aa, 0.55));
  const sun = new THREE.DirectionalLight(0xffebd2, 1.0);
  sun.position.set(-2.6, 4.2, 3.6); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera as THREE.OrthographicCamera;
  sc.left = -4.5; sc.right = 4.5; sc.top = 4; sc.bottom = -1; sc.near = 0.5; sc.far = 14;
  sun.shadow.bias = -0.0006; scene.add(sun);
  const fill = new THREE.DirectionalLight(0xe6edf4, 0.32); fill.position.set(3.5, 2, 4); scene.add(fill);

  const lin = (hex: string) => new THREE.Color(hex).convertSRGBToLinear();
  const dark = (hex: string, k: number) => new THREE.Color(hex).multiplyScalar(k).convertSRGBToLinear();
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(18, 7), new THREE.MeshStandardMaterial({ color: lin('#EEE7D9'), roughness: 1 }));
  wall.position.set(0, 3.5, 0); wall.receiveShadow = true; scene.add(wall);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(18, 8), new THREE.MeshStandardMaterial({ color: lin('#D8CFBF'), roughness: 1 }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, 4); floor.receiveShadow = true; scene.add(floor);

  const tex = (w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void) => {
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const g = cv.getContext('2d')!; g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); draw(g, w, h);
    const t = new THREE.CanvasTexture(cv); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; return t;
  };
  const dots = tex(232, 616, (g, w, h) => { g.fillStyle = 'rgba(18,10,6,.78)'; for (let y = 34; y < h - 26; y += 21) for (let x = 22; x < w - 14; x += 21) { g.beginPath(); g.arc(x, y, 3.4, 0, Math.PI * 2); g.fill(); } });
  const grain = tex(256, 1024, (g, w, h) => {
    let seed = 7; const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    for (let i = 0; i < 150; i++) {
      const x = rnd() * w, a = 0.015 + rnd() * 0.035, wd = 0.6 + rnd() * 1.6, amp = 1.5 + rnd() * 2.5, per = 260 + rnd() * 220;
      g.strokeStyle = `rgba(80,50,20,${a})`; g.lineWidth = wd; g.beginPath(); g.moveTo(x, 0);
      for (let y = 0; y <= h; y += 16) g.lineTo(x + Math.sin(y / per + i) * amp, y);
      g.stroke();
    }
  });
  const M = {
    korpus: new THREE.MeshStandardMaterial({ roughness: 0.72 }),
    inner: new THREE.MeshStandardMaterial({ roughness: 0.9 }),
    front: new THREE.MeshStandardMaterial({ roughness: 0.66 }),
    natur: new THREE.MeshStandardMaterial({ color: lin('#E2C79C'), roughness: 0.62, map: grain }),
    bench: new THREE.MeshStandardMaterial({ color: lin('#D7B37E'), roughness: 0.55 }),
    lock: new THREE.MeshStandardMaterial({ color: lin('#1d1b19'), roughness: 0.4, metalness: 0.3 }),
    hole: new THREE.MeshStandardMaterial({ color: lin('#2a1f17'), roughness: 1 }),
    sokkel: new THREE.MeshStandardMaterial({ color: lin('#2b2420'), roughness: 0.9 }),
  };
  function farv() {
    const hex = st.kuloer;
    if (st.produkt === 'locker') { M.korpus.color = lin(hex); M.korpus.map = null; M.inner.color = dark(hex, 0.38); M.front.map = dots; }
    else { M.korpus.color = lin('#E2C79C'); M.korpus.map = grain; M.inner.color = lin('#CDB089'); M.front.map = grain; }
    M.korpus.needsUpdate = true; M.front.color = lin(hex); M.front.needsUpdate = true;
  }

  type Laage = { pivot: THREE.Group; a: number; t: number; open: number; start: number };
  let unit: THREE.Group | null = null, laager: Laage[] = [], fronter: THREE.Mesh[] = [], dims = { w: 2, h: 2 };
  const box = (w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; unit!.add(m); return m;
  };
  const laage = (px: number, py: number, pz: number, dw: number, dh: number, hoejre: boolean, ajar: boolean, delay: number, ekstra: THREE.Object3D[]) => {
    const pivot = new THREE.Group(); pivot.position.set(px, py, pz);
    const geo = new THREE.BoxGeometry(dw, dh, 0.018); geo.translate(hoejre ? -dw / 2 : dw / 2, 0, 0);
    const door = new THREE.Mesh(geo, [M.korpus, M.korpus, M.korpus, M.korpus, M.front, M.inner]);
    door.castShadow = true; door.receiveShadow = true; pivot.add(door); ekstra.forEach((o) => pivot.add(o)); unit!.add(pivot);
    const sign = hoejre ? 1 : -1, aj = ajar ? 0.62 * sign : 0;
    const l: Laage = { pivot, a: reduce ? aj : 1.85 * sign, t: aj, open: 1.75 * sign, start: reduce ? 0 : performance.now() + delay };
    pivot.rotation.y = l.a; door.userData.l = l; laager.push(l); fronter.push(door);
  };

  function lockers() {
    const C = st.c, R = st.r, W = C * RW + T, x0 = -W / 2, baseH = 0.40, baseD = 0.42, benchT = 0.03, benchD = 0.47;
    box(W - 0.05, 0.07, baseD - 0.05, M.sokkel, 0, 0.035, (baseD - 0.05) / 2);
    for (let i = 0; i <= C; i++) box(T, baseH - 0.07, baseD, M.korpus, x0 + T / 2 + i * RW, 0.07 + (baseH - 0.07) / 2, baseD / 2);
    box(W, T, baseD, M.korpus, 0, 0.07 + T / 2, baseD / 2);
    box(W, T, baseD, M.korpus, 0, 0.07 + (baseH - 0.07) / 2, baseD / 2);
    box(W, baseH - 0.07, 0.008, M.inner, 0, 0.07 + (baseH - 0.07) / 2, 0.004);
    box(W + 0.01, benchT, benchD, M.bench, 0, baseH + benchT / 2, benchD / 2);
    const y0 = baseH + benchT, LD = 0.40, H = R * RH;
    for (let i = 0; i <= C; i++) box(T, H, LD, M.korpus, x0 + T / 2 + i * RW, y0 + H / 2, LD / 2);
    for (let j = 0; j <= R; j++) box(W, T, LD, M.korpus, 0, y0 + j * RH + (j === R ? -T / 2 : T / 2), LD / 2);
    box(W, H, 0.008, M.inner, 0, y0 + H / 2, 0.004);
    const dw = RW - T - 0.004, dh = RH - T - 0.006;
    for (let i = 0; i < C; i++) for (let j = 0; j < R; j++) {
      const lock = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.014, 24), M.lock);
      lock.rotation.x = Math.PI / 2;
      const top = (j === 0 && R > 1) || R === 1;
      lock.position.set(dw - 0.06, top ? dh / 2 - 0.09 : -dh / 2 + 0.09, 0.014);
      laage(x0 + i * RW + T + 0.002, y0 + j * RH + RH / 2, LD + 0.011, dw, dh, false, j === R - 1 && i === Math.min(2, C - 1) && C > 1, 120 + i * 55 + (R - 1 - j) * 90, [lock]);
    }
    dims = { w: W, h: y0 + H };
  }

  function hoejskab() {
    const C = st.c, CW = 0.60, TT = 0.019, D = 0.58, SO = 0.10, HT = st.h, HK = HT - SO, W = C * CW + TT, x0 = -W / 2;
    box(W - 0.06, SO, D - 0.06, M.natur, 0, SO / 2, (D - 0.06) / 2);
    for (let i = 0; i <= C; i++) box(TT, HK, D, M.korpus, x0 + TT / 2 + i * CW, SO + HK / 2, D / 2);
    box(W, TT, D, M.korpus, 0, SO + TT / 2, D / 2);
    box(W, TT, D, M.korpus, 0, HT - TT / 2, D / 2);
    box(W, HK, 0.008, M.inner, 0, SO + HK / 2, 0.004);
    const nh = Math.max(1, Math.round((HK - 0.3) / 0.42));
    for (let i = 0; i < C; i++) for (let k = 1; k <= nh; k++) box(CW - TT - 0.004, TT, D - 0.04, M.korpus, x0 + TT + i * CW + (CW - TT) / 2, SO + k * HK / (nh + 1), (D - 0.04) / 2);
    const dw = CW - 0.004, dh = HK - 0.004;
    for (let i = 0; i < C; i++) {
      const hoejre = i % 2 === 1;
      const hole = new THREE.Mesh(new THREE.CylinderGeometry(0.021, 0.021, 0.004, 28), M.hole);
      hole.rotation.x = Math.PI / 2;
      hole.position.set(hoejre ? -dw + 0.045 : dw - 0.045, 0.02, 0.008);
      const px = hoejre ? x0 + (i + 1) * CW + TT / 2 - 0.002 : x0 + i * CW + TT / 2 + 0.002;
      laage(px, SO + HK / 2, D + 0.011, dw, dh, hoejre, i === Math.min(1, C - 1) && C > 1, 140 + i * 90, [hole]);
    }
    dims = { w: W, h: HT };
  }

  function byg() {
    if (unit) { scene.remove(unit); unit.traverse((n) => { if ((n as THREE.Mesh).geometry) (n as THREE.Mesh).geometry.dispose(); }); }
    unit = new THREE.Group(); laager = []; fronter = [];
    farv();
    if (st.produkt === 'locker') lockers(); else hoejskab();
    scene.add(unit); fit(); kick();
  }

  let yawUser = 0, lastUser = -1e9, dist = 5, yawCur = 0;
  const tStart = performance.now(), target = new THREE.Vector3();
  function fit() {
    const w = canvas.clientWidth || 600, h = canvas.clientHeight || 420;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    const vf = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    dist = Math.max((dims.h + 0.5) / (2 * vf), (dims.w + 0.7) / (2 * vf * camera.aspect), 2.6) * 1.08;
    target.set(0, dims.h * 0.5, 0.25);
  }

  let down: { x: number; yaw: number; moved: boolean } | null = null;
  const ray = new THREE.Raycaster(), ptr = new THREE.Vector2();
  const onDown = (e: PointerEvent) => { down = { x: e.clientX, yaw: yawUser, moved: false }; };
  const onMove = (e: PointerEvent) => { if (!down) return; const dx = e.clientX - down.x; if (Math.abs(dx) > 4) down.moved = true; if (down.moved) { yawUser = Math.max(-0.75, Math.min(0.75, down.yaw + dx * 0.006)); lastUser = performance.now(); kick(); } };
  const onUp = (e: PointerEvent) => {
    if (!down) return; const moved = down.moved; down = null; if (moved) return;
    const r = canvas.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) return;
    ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ptr, camera);
    const hit = ray.intersectObjects(fronter, false)[0];
    if (hit) { const l = hit.object.userData.l as Laage; l.t = Math.abs(l.t) > 0.2 ? 0 : l.open; l.start = 0; lastUser = performance.now(); kick(); }
  };
  canvas.addEventListener('pointerdown', onDown); window.addEventListener('pointermove', onMove); window.addEventListener('pointerup', onUp);

  let running = false, visible = true, stoppet = false;
  function frame(now: number) {
    let settled = true;
    for (const l of laager) {
      if (now < l.start) { settled = false; continue; }
      const diff = l.t - l.a; if (Math.abs(diff) > 0.0015) { l.a += diff * (reduce ? 1 : 0.11); settled = false; } else l.a = l.t;
      l.pivot.rotation.y = l.a;
    }
    const yawAuto = reduce ? 0 : 0.34 * Math.sin((now - tStart) / 4200);
    const userActive = now - lastUser < 4000; if (!userActive) yawUser *= 0.97;
    yawCur += (((userActive ? 0 : yawAuto) + yawUser) - yawCur) * 0.08;
    camera.position.set(target.x + Math.sin(yawCur) * dist, target.y + dist * 0.13, target.z + Math.cos(yawCur) * dist); camera.lookAt(target);
    renderer.render(scene, camera);
    if (!stoppet && visible && (!reduce || !settled || userActive)) requestAnimationFrame(frame); else running = false;
  }
  function kick() { if (!running && visible && !stoppet) { running = true; requestAnimationFrame(frame); } }
  const ro = 'ResizeObserver' in window ? new ResizeObserver(() => { fit(); kick(); }) : null; ro?.observe(canvas);
  const io = 'IntersectionObserver' in window ? new IntersectionObserver((es) => { visible = es[0].isIntersecting; if (visible) kick(); }) : null; io?.observe(canvas);
  byg();

  return {
    saet(t: Partial<Tilstand>) {
      const nyGeometri = t.produkt !== undefined && t.produkt !== st.produkt || t.c !== undefined && t.c !== st.c || t.r !== undefined && t.r !== st.r || t.h !== undefined && t.h !== st.h;
      Object.assign(st, t);
      if (nyGeometri) byg(); else { farv(); kick(); }
      lyttere.forEach((f) => f({ ...st }));
    },
    on(_e: 'aendret', f: Lytter) { lyttere.push(f); },
    vaek() { fit(); kick(); },
    ryd() {
      stoppet = true; ro?.disconnect(); io?.disconnect();
      canvas.removeEventListener('pointerdown', onDown); window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp);
      renderer.dispose(); canvas.remove();
    },
  };
}
