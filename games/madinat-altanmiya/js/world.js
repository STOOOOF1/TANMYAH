/* طبقة العالم: «مدينة التنمية» ثلاثية الأبعاد (three.js, WebGLRenderer)
   كل النصوص العربية في DOM فوق اللوحة؛ اللوحة لا ترسم نصًا. */
import * as THREE from 'three';

export function init(container, APP) {
  const C = APP.content;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const touch = document.body.classList.contains('touch');
  const low = touch || (navigator.hardwareConcurrency || 8) <= 4;

  /* ---------- المُصيِّر والمشهد ---------- */
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: !low, powerPreference: 'high-performance' }); }
  catch (e) { APP.no3d(); return; }
  renderer.setPixelRatio(Math.min(devicePixelRatio, low ? 1.5 : 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = !low;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  // سماء متدرجة مرسومة على لوحة
  {
    const cv = document.createElement('canvas'); cv.width = 4; cv.height = 256;
    const g = cv.getContext('2d'); const gr = g.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, '#6fb3c9'); gr.addColorStop(.55, '#cfe8e6'); gr.addColorStop(1, '#f3e6c4');
    g.fillStyle = gr; g.fillRect(0, 0, 4, 256);
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; scene.background = tex;
  }
  scene.fog = new THREE.Fog(0xe6e3cf, 70, 190);

  const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.5, 500);

  scene.add(new THREE.HemisphereLight(0xfff6e0, 0x7d8f6a, 1.5));
  const sun = new THREE.DirectionalLight(0xfff1d0, 2.5);
  sun.position.set(-40, 70, 30);
  if (!low) {
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const s = sun.shadow.camera; s.left = -80; s.right = 80; s.top = 80; s.bottom = -80; s.near = 10; s.far = 200;
    sun.shadow.bias = -0.0005;
  }
  scene.add(sun);

  /* ---------- مواد ---------- */
  const M = (color, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: .85, metalness: 0 }, o));
  const mat = {
    sand: M(0xe9dcb8), stone: M(0xf4ecd8), road: M(0xd7c9a6), white: M(0xfbf8f0), gold: M(0xc9a43a, { metalness: .55, roughness: .35 }),
    green: M(0x145f48), darkGreen: M(0x0d4d3a), trunk: M(0x8a6a44), leaf: M(0x3f7d3a), water: M(0x5aa9bf, { roughness: .2, metalness: .1 }),
    skin: M(0xc99a72), black: M(0x222222), mountain: M(0xb08a63, { flatShading: true }), glass: M(0x9fd3c7, { roughness: .1, metalness: .3 })
  };
  const shadow = (m, cast = true, recv = true) => { m.castShadow = cast && !low; m.receiveShadow = recv && !low; return m; };
  const add = (geo, material, x = 0, y = 0, z = 0, parent = scene) => { const m = shadow(new THREE.Mesh(geo, material)); m.position.set(x, y, z); parent.add(m); return m; };

  /* ---------- الأرض والساحة ---------- */
  const ground = new THREE.Mesh(new THREE.CircleGeometry(260, 64), mat.sand);
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = !low; scene.add(ground);
  // ساحة مركزية بنجمة ثمانية
  const plaza = add(new THREE.CylinderGeometry(13, 13.5, .3, 48), mat.stone, 0, .15, 0);
  for (let k = 0; k < 2; k++) {
    const star = add(new THREE.BoxGeometry(9, .12, 9), mat.green, 0, .36, 0);
    star.rotation.y = k * Math.PI / 4;
  }
  add(new THREE.CylinderGeometry(3.2, 3.2, .16, 8), mat.gold, 0, .42, 0).rotation.y = Math.PI / 8;
  add(new THREE.CylinderGeometry(2.2, 2.4, .5, 32), mat.water, 0, .5, 0);
  // لوحة المنهج
  const board = new THREE.Group(); board.position.set(0, 0, -6); scene.add(board);
  add(new THREE.BoxGeometry(6.4, 4, .35), mat.gold, 0, 3.6, 0, board);
  add(new THREE.BoxGeometry(5.8, 3.4, .4), mat.darkGreen, 0, 3.6, 0, board);
  add(new THREE.BoxGeometry(.4, 2, .4), mat.gold, -2.6, 1, 0, board);
  add(new THREE.BoxGeometry(.4, 2, .4), mat.gold, 2.6, 1, 0, board);
  // خطوط ذهبية على اللوحة ترمز إلى الأحياء الخمسة
  for (let k = 0; k < 5; k++) add(new THREE.BoxGeometry(4.2 - k * .3, .18, .45), M(new THREE.Color(C.chapters[k].color).getHex(), { emissive: C.chapters[k].color, emissiveIntensity: .35 }), 0, 4.8 - k * .55, 0, board);

  /* ---------- الأحياء ---------- */
  const R = 58, DR = 19;
  const districts = [];
  const interact = []; // {id, pos:Vector3, r, obj, label}
  const colliders = []; // {x,z,r}
  const labels = [];
  const labelsEl = document.getElementById('labels');
  function label(text, sub, cls) {
    const d = document.createElement('div'); d.className = 'wlabel ' + (cls || '');
    d.textContent = text; if (sub) { const s = document.createElement('small'); s.textContent = sub; d.append(s); }
    labelsEl.append(d); return d;
  }

  C.chapters.forEach((ch, ci) => {
    const a = Math.PI - ci * (2 * Math.PI / 5); // الحي الأول أمام اللاعب (اتجاه -z)
    const cx = Math.sin(a) * R, cz = Math.cos(a) * R;
    const center = new THREE.Vector3(cx, 0, cz);
    const col = new THREE.Color(ch.color);
    const tint = col.clone().lerp(new THREE.Color(0xf4ecd8), .72);
    const g = new THREE.Group(); g.position.copy(center); scene.add(g);
    const toPlaza = Math.atan2(-cx, -cz); // زاوية الاتجاه نحو الساحة
    g.rotation.y = toPlaza;
    add(new THREE.CylinderGeometry(DR, DR + .6, .35, 56), M(tint.getHex()), 0, .17, 0, g);
    add(new THREE.TorusGeometry(DR - .3, .18, 6, 72), mat.gold, 0, .37, 0, g).rotation.x = Math.PI / 2;
    // الطريق إلى الساحة
    const road = add(new THREE.BoxGeometry(5, .2, R - 13 - DR + 1), mat.road, 0, .1, 0);
    road.position.set(Math.sin(a) * (13 + (R - 13 - DR) / 2), .1, Math.cos(a) * (13 + (R - 13 - DR) / 2)); road.rotation.y = a;
    const accent = M(col.getHex(), { emissive: col, emissiveIntensity: .15 });
    // المَعلم
    buildLandmark(ci, g, accent);
    colliders.push({ x: cx, z: cz, r: ci === 1 ? 7 : 5.5 });
    const lab = label(ch.title, ch.emblem); labels.push({ el: lab, pos: new THREE.Vector3(cx, ci === 4 ? 24 : 13, cz), far: 140, district: ci });
    // الأقواس: درس لكل قوس، على قوس مواجه للساحة
    const n = ch.lessons.length, span = Math.PI * .9;
    const portals = [];
    ch.lessons.forEach((l, li) => {
      const t = n === 1 ? 0 : -span / 2 + span * li / (n - 1);
      const lx = Math.sin(t) * 12, lz = Math.cos(t) * 12;
      const p = new THREE.Group(); p.position.set(lx, 0, lz); p.rotation.y = t; g.add(p);
      const pm = M(col.getHex(), { emissive: col, emissiveIntensity: .5, metalness: .2, roughness: .4 });
      add(new THREE.CylinderGeometry(.28, .32, 3.2, 10), pm, -1.9, 1.6, 0, p);
      add(new THREE.CylinderGeometry(.28, .32, 3.2, 10), pm, 1.9, 1.6, 0, p);
      const arch = add(new THREE.TorusGeometry(1.9, .3, 8, 24, Math.PI), pm, 0, 3.2, 0, p);
      const veil = new THREE.Mesh(new THREE.PlaneGeometry(3.5, 4.6), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: .18, side: THREE.DoubleSide, depthWrite: false }));
      veil.position.set(0, 2.4, 0); p.add(veil);
      add(new THREE.CylinderGeometry(2.4, 2.4, .12, 24), mat.stone, 0, .38, 0, p);
      const wp = new THREE.Vector3(); p.getWorldPosition(wp);
      const lb = label(l.title, null, 'portal');
      labels.push({ el: lb, pos: wp.clone().setY(5.6), far: 34, district: ci, lesson: l.id });
      const it = { id: l.id, pos: wp, r: 4.2, obj: p, district: ci, mat: pm, veil, arch };
      interact.push(it); portals.push(it);
    });
    // جناح الاختبار خلف المَعلم
    const qz = new THREE.Group(); qz.position.set(0, 0, -12.5); g.add(qz);
    add(new THREE.CylinderGeometry(3.2, 3.4, .4, 8), mat.stone, 0, .45, 0, qz);
    for (let k = 0; k < 8; k++) { const aa = k * Math.PI / 4; add(new THREE.CylinderGeometry(.18, .18, 3, 6), mat.white, Math.sin(aa) * 2.8, 2.1, Math.cos(aa) * 2.8, qz); }
    add(new THREE.SphereGeometry(3.1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat.gold, 0, 3.6, 0, qz);
    const qwp = new THREE.Vector3(); qz.getWorldPosition(qwp);
    interact.push({ id: 'quiz:' + ch.id, pos: qwp, r: 4.8, obj: qz, district: ci });
    labels.push({ el: label('اختبار الحي', null, 'portal'), pos: qwp.clone().setY(7.6), far: 40, district: ci, quiz: ch.id });
    // قبة القفل
    const lockMat = new THREE.MeshStandardMaterial({ color: 0x8b8f8d, transparent: true, opacity: .28, roughness: .3, depthWrite: false, side: THREE.DoubleSide });
    const lock = new THREE.Mesh(new THREE.SphereGeometry(DR + 1, 40, 16, 0, Math.PI * 2, 0, Math.PI / 2), lockMat);
    lock.position.copy(center); scene.add(lock);
    districts.push({ ch, ci, center, group: g, portals, lock, unlocked: ci === 0, label: lab, a });
  });

  function buildLandmark(ci, g, accent) {
    if (ci === 0) { // دار المفاهيم: بيت بقبة
      add(new THREE.BoxGeometry(8, 5, 8), mat.white, 0, 2.5, 0, g);
      add(new THREE.CylinderGeometry(3, 3.2, 1, 24), accent, 0, 5.5, 0, g);
      add(new THREE.SphereGeometry(3, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), mat.gold, 0, 6, 0, g);
      add(new THREE.ConeGeometry(.3, 1.4, 8), mat.gold, 0, 9.6, 0, g);
      for (let k = -1; k <= 1; k++) add(new THREE.BoxGeometry(1.4, 2.6, .3), mat.darkGreen, k * 2.4, 1.3, 4.05, g);
    } else if (ci === 1) { // الأعمدة السبعة
      add(new THREE.CylinderGeometry(7.5, 7.8, .6, 40), mat.stone, 0, .55, 0, g);
      for (let k = 0; k < 7; k++) {
        const aa = -Math.PI * .8 + k * (Math.PI * 1.6 / 6);
        add(new THREE.CylinderGeometry(.55, .65, 7, 16), k % 2 ? mat.white : accent, Math.sin(aa + Math.PI) * 5.5, 4.3, Math.cos(aa + Math.PI) * 5.5, g);
        add(new THREE.BoxGeometry(1.6, .5, 1.6), mat.gold, Math.sin(aa + Math.PI) * 5.5, 8, Math.cos(aa + Math.PI) * 5.5, g);
      }
      const ring = add(new THREE.TorusGeometry(5.5, .35, 8, 60, Math.PI * 1.6), mat.gold, 0, 8.4, 0, g);
      ring.rotation.x = Math.PI / 2; ring.rotation.z = Math.PI * .7;
    } else if (ci === 2) { // جسر النهوض فوق جدول
      const w = add(new THREE.BoxGeometry(18, .2, 4.5), mat.water, 0, .42, 0, g);
      const br = add(new THREE.TorusGeometry(5, .7, 10, 30, Math.PI), accent, 0, .3, 0, g);
      br.scale.set(1, .7, 1);
      add(new THREE.BoxGeometry(2.6, .4, 9.6), mat.stone, 0, 3.7, 0, g).scale.set(1, 1, 1);
      for (const s of [-1, 1]) {
        add(new THREE.BoxGeometry(.3, 1.2, 9.6), mat.gold, s * 1.3, 4.4, 0, g);
        add(new THREE.CylinderGeometry(.5, .5, 4, 10), mat.white, s * 1.3, 2, 4.8, g);
        add(new THREE.CylinderGeometry(.5, .5, 4, 10), mat.white, s * 1.3, 2, -4.8, g);
      }
      add(new THREE.BoxGeometry(2.6, .4, 4), mat.stone, 0, 1.9, 6.3, g).rotation.x = .5;
      add(new THREE.BoxGeometry(2.6, .4, 4), mat.stone, 0, 1.9, -6.3, g).rotation.x = -.5;
      w.rotation.y = Math.PI / 2;
    } else if (ci === 3) { // بيت المال
      add(new THREE.BoxGeometry(10, 4.5, 7), mat.white, 0, 2.25, 0, g);
      for (let k = -2; k <= 2; k++) {
        add(new THREE.BoxGeometry(1.4, 3, .4), accent, k * 1.9, 1.5, 3.6, g);
        add(new THREE.TorusGeometry(.7, .15, 6, 12, Math.PI), mat.gold, k * 1.9, 3, 3.65, g);
      }
      add(new THREE.BoxGeometry(10.6, .5, 7.6), mat.gold, 0, 4.7, 0, g);
      add(new THREE.CylinderGeometry(2.4, 2.6, 1.2, 20), mat.white, 0, 5.5, 0, g);
      add(new THREE.SphereGeometry(2.4, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat.gold, 0, 6.1, 0, g);
      for (const s of [-1, 1]) { // مئذنتان صغيرتان
        add(new THREE.CylinderGeometry(.5, .6, 8, 12), mat.white, s * 4.6, 4, -2.8, g);
        add(new THREE.ConeGeometry(.65, 1.6, 12), mat.gold, s * 4.6, 8.8, -2.8, g);
      }
    } else { // برج الرؤية
      let y = 0;
      [[5, 4], [4, 5], [3.1, 5], [2.3, 5], [1.5, 3]].forEach(([r, h], k) => {
        add(new THREE.CylinderGeometry(r * .9, r, h, 8), k % 2 ? accent : mat.white, 0, y + h / 2, 0, g);
        add(new THREE.CylinderGeometry(r * .95, r * .95, .35, 8), mat.gold, 0, y + h, 0, g);
        y += h;
      });
      const top = add(new THREE.SphereGeometry(1, 16, 12), new THREE.MeshStandardMaterial({ color: 0xffe9a3, emissive: 0xffd36b, emissiveIntensity: 1.2 }), 0, y + 1, 0, g);
      top.castShadow = false;
    }
  }

  /* ---------- البيوت والنخيل (InstancedMesh) ---------- */
  const rng = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
  const spots = [];
  const blocked = (x, z, r) => {
    if (Math.hypot(x, z) < 20) return true;
    for (const d of districts) if (Math.hypot(x - d.center.x, z - d.center.z) < DR + 3 + r) return true;
    for (const d of districts) { // الطرق
      const ux = Math.sin(d.a), uz = Math.cos(d.a); const along = x * ux + z * uz; const across = Math.abs(-x * uz + z * ux);
      if (along > 0 && along < R && across < 4.5 + r) return true;
    }
    for (const s of spots) if (Math.hypot(x - s.x, z - s.z) < s.r + r + 1) return true;
    return false;
  };
  let tries = 0;
  while (spots.length < (low ? 110 : 190) && tries++ < 6000) {
    const ang = rng() * Math.PI * 2, rad = 22 + rng() * 85;
    const x = Math.sin(ang) * rad, z = Math.cos(ang) * rad;
    const house = rng() < .62, r = house ? 3.2 : 1.6;
    if (!blocked(x, z, r)) spots.push({ x, z, r, house });
  }
  const houses = spots.filter(s => s.house), palms = spots.filter(s => !s.house);
  const dummy = new THREE.Object3D();
  const hGeo = new THREE.BoxGeometry(1, 1, 1); hGeo.translate(0, .5, 0);
  const hMesh = shadow(new THREE.InstancedMesh(hGeo, M(0xffffff), houses.length));
  const roofGeo = new THREE.BoxGeometry(1, 1, 1); roofGeo.translate(0, .5, 0);
  const rMesh = shadow(new THREE.InstancedMesh(roofGeo, M(0xffffff), houses.length));
  const hc = [0xfbf8f0, 0xf1e7d0, 0xece3cf, 0xf6efe0, 0xe8dcc2];
  houses.forEach((s, i) => {
    const w = 3 + rng() * 2.5, d = 3 + rng() * 2.5, h = 2.5 + rng() * 3.5;
    dummy.position.set(s.x, 0, s.z); dummy.rotation.set(0, Math.round(rng() * 4) * Math.PI / 2 + Math.atan2(s.x, s.z), 0); dummy.scale.set(w, h, d); dummy.updateMatrix();
    hMesh.setMatrixAt(i, dummy.matrix); hMesh.setColorAt(i, new THREE.Color(hc[i % hc.length]));
    dummy.position.y = h; dummy.scale.set(w + .3, .35, d + .3); dummy.updateMatrix();
    rMesh.setMatrixAt(i, dummy.matrix); rMesh.setColorAt(i, new THREE.Color(rng() < .3 ? 0xc9a43a : 0xd9cba8));
    colliders.push({ x: s.x, z: s.z, r: Math.max(w, d) * .6 });
  });
  scene.add(hMesh, rMesh);
  const tGeo = new THREE.CylinderGeometry(.22, .32, 1, 7); tGeo.translate(0, .5, 0);
  const tMesh = shadow(new THREE.InstancedMesh(tGeo, mat.trunk, palms.length));
  const cGeo = new THREE.ConeGeometry(1, .8, 7); cGeo.rotateX(Math.PI);
  const cMesh = shadow(new THREE.InstancedMesh(cGeo, mat.leaf, palms.length));
  palms.forEach((s, i) => {
    const h = 4 + rng() * 3;
    dummy.position.set(s.x, 0, s.z); dummy.rotation.set((rng() - .5) * .15, 0, (rng() - .5) * .15); dummy.scale.set(1, h, 1); dummy.updateMatrix(); tMesh.setMatrixAt(i, dummy.matrix);
    dummy.position.set(s.x, h + .1, s.z); dummy.rotation.set(0, rng() * 6, 0); dummy.scale.set(2.4, 1.4, 2.4); dummy.updateMatrix(); cMesh.setMatrixAt(i, dummy.matrix);
    colliders.push({ x: s.x, z: s.z, r: .6 });
  });
  scene.add(tMesh, cMesh);
  // نخيل الساحة
  for (let k = 0; k < 8; k++) {
    const aa = k * Math.PI / 4 + Math.PI / 8, x = Math.sin(aa) * 11, z = Math.cos(aa) * 11;
    add(new THREE.CylinderGeometry(.22, .3, 5, 7), mat.trunk, x, 2.5, z);
    add(new THREE.ConeGeometry(2.2, 1.1, 7), mat.leaf, x, 5.2, z).rotation.x = Math.PI;
    colliders.push({ x, z, r: .6 });
  }
  // جبال الأفق
  const mGeo = new THREE.ConeGeometry(1, 1, 6);
  const mMesh = new THREE.InstancedMesh(mGeo, mat.mountain, 26);
  for (let i = 0; i < 26; i++) {
    const aa = i / 26 * Math.PI * 2 + rng() * .2, rr = 165 + rng() * 25, h = 14 + rng() * 26, w = 18 + rng() * 22;
    dummy.position.set(Math.sin(aa) * rr, h / 2 - 1, Math.cos(aa) * rr); dummy.rotation.set(0, rng() * 3, 0); dummy.scale.set(w, h, w); dummy.updateMatrix(); mMesh.setMatrixAt(i, dummy.matrix);
  }
  scene.add(mMesh);
  colliders.push({ x: 0, z: 0, r: 2.6 }, { x: 0, z: -6, r: 3.4 });

  /* ---------- اللاعب ---------- */
  const player = new THREE.Group(); scene.add(player);
  add(new THREE.CylinderGeometry(.55, .75, 1.9, 14), mat.white, 0, .95, 0, player);
  add(new THREE.SphereGeometry(.42, 16, 12), mat.skin, 0, 2.2, 0, player);
  const ghutra = add(new THREE.ConeGeometry(.62, .9, 14), M(0xffffff), 0, 2.45, -.05, player); ghutra.scale.set(1, .8, 1.05);
  add(new THREE.TorusGeometry(.4, .06, 6, 18), mat.black, 0, 2.55, 0, player).rotation.x = Math.PI / 2;
  add(new THREE.BoxGeometry(.5, .08, .08), mat.gold, 0, 1.55, .62, player); // ذهبي على الصدر يدل على الاتجاه
  const ring = new THREE.Mesh(new THREE.RingGeometry(.9, 1.1, 32), new THREE.MeshBasicMaterial({ color: 0xc9a43a, transparent: true, opacity: .7 }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = .42; player.add(ring);
  player.position.set(0, 0, 9); player.rotation.y = Math.PI;

  /* ---------- التحكم ---------- */
  let yaw = 0, pitch = .42, dist = 15;
  const keys = new Set();
  let paused = false;
  addEventListener('keydown', (e) => {
    if (APP.modalOpen() || e.target.matches('input,textarea')) return;
    const k = e.key.toLowerCase();
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd', 'ص', 'ش', 'س', 'ي'].includes(k)) { keys.add(k); e.preventDefault(); }
    if (k === 'e' || k === 'enter' || k === 'ث' || k === ' ') { if (nearId) { e.preventDefault(); APP.activate(nearId); } }
  });
  addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
  addEventListener('blur', () => keys.clear());

  const cv = renderer.domElement;
  let drag = null;
  cv.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, moved: 0, id: e.pointerId }; });
  cv.addEventListener('pointermove', (e) => {
    if (!drag || drag.id !== e.pointerId) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY; drag.moved += Math.abs(dx) + Math.abs(dy);
    yaw -= dx * .006; pitch = Math.max(.12, Math.min(1.1, pitch + dy * .004));
  });
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  cv.addEventListener('pointerup', (e) => {
    if (drag && drag.moved < 6) { // نقرة: اختيار قوس أو مَعلم
      ndc.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      const objs = interact.map(i => i.obj).concat([board]);
      const hit = ray.intersectObjects(objs, true)[0];
      if (hit) {
        let o = hit.object; while (o && !objs.includes(o)) o = o.parent;
        if (o === board) APP.activate('board');
        else { const it = interact.find(i => i.obj === o); if (it) APP.activate(it.id); }
      }
    }
    drag = null;
  });
  cv.addEventListener('wheel', (e) => { dist = Math.max(7, Math.min(30, dist + e.deltaY * .02)); e.preventDefault(); }, { passive: false });

  // عصا الجوال
  const joy = document.getElementById('joy'), knob = joy.firstElementChild;
  const jv = { x: 0, y: 0 }; let jid = null;
  const jmove = (e) => {
    const r = joy.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    let x = (e.clientX - cx) / (r.width / 2), y = (e.clientY - cy) / (r.height / 2); const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; }
    jv.x = x; jv.y = y; knob.style.transform = `translate(${x * 34}px,${y * 34}px)`;
  };
  joy.addEventListener('pointerdown', (e) => { jid = e.pointerId; joy.setPointerCapture(jid); jmove(e); });
  joy.addEventListener('pointermove', (e) => { if (e.pointerId === jid) jmove(e); });
  const jend = () => { jid = null; jv.x = jv.y = 0; knob.style.transform = ''; };
  joy.addEventListener('pointerup', jend); joy.addEventListener('pointercancel', jend);

  /* ---------- الحالة من طبقة التعلّم ---------- */
  const gold = new THREE.Color(0xc9a43a);
  function setUnlocked(arr) {
    districts.forEach((d, i) => {
      d.unlocked = !!arr[i]; d.lock.visible = !d.unlocked;
      d.label.classList.toggle('lock', !d.unlocked);
      d.label.querySelector('small').textContent = d.unlocked ? d.ch.emblem : '🔒 مغلق: انجح في الحي السابق';
    });
  }
  function setDone(ids) {
    const s = new Set(ids);
    interact.forEach(it => {
      if (!it.mat) return;
      const done = s.has(it.id), col = new THREE.Color(C.chapters[it.district].color);
      it.mat.color.copy(done ? gold : col); it.mat.emissive.copy(done ? gold : col); it.mat.emissiveIntensity = done ? .35 : .5;
      it.veil.material.color.copy(done ? gold : col);
    });
    labels.forEach(l => { if (l.lesson) l.el.classList.toggle('done', s.has(l.lesson)); });
  }
  function teleport(cid) {
    const d = districts.find(x => x.ch.id === cid); if (!d) return;
    const dir = d.center.clone().setY(0).normalize();
    player.position.copy(d.center).addScaledVector(dir, -(DR + 2));
    yaw = Math.atan2(dir.x, dir.z) + Math.PI; player.rotation.y = yaw + Math.PI;
    APP.toast('وصلت إلى ' + d.ch.title + ': اقترب من أي قوس لتفتح درسه.');
  }

  /* ---------- الاحتفال ---------- */
  const confN = 90;
  const conf = new THREE.InstancedMesh(new THREE.BoxGeometry(.18, .18, .05), new THREE.MeshBasicMaterial({ color: 0xffffff }), confN);
  conf.visible = false; scene.add(conf);
  const cparts = [];
  const ccols = [0xc9a43a, 0x1b7a5a, 0xe7cf86, 0xffffff];
  for (let i = 0; i < confN; i++) { conf.setColorAt(i, new THREE.Color(ccols[i % 4])); cparts.push({ p: new THREE.Vector3(), v: new THREE.Vector3(), r: 0 }); }
  let confT = 0;
  function celebrate() {
    if (reduce) return;
    conf.visible = true; confT = 2.2;
    cparts.forEach(c => { c.p.copy(player.position).setY(3); c.v.set((Math.random() - .5) * 9, 6 + Math.random() * 7, (Math.random() - .5) * 9); c.r = Math.random() * 6; });
  }

  /* ---------- الحلقة ---------- */
  let nearId = null, curDistrict = null, last = performance.now(), labelTick = 0;
  const v = new THREE.Vector3(), camTarget = new THREE.Vector3(), tmp = new THREE.Vector3();
  function resolve(p) {
    for (const c of colliders) {
      const dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz), m = c.r + .7;
      if (d < m && d > 1e-4) { p.x = c.x + dx / d * m; p.z = c.z + dz / d * m; }
    }
    for (const d of districts) {
      if (d.unlocked) continue;
      const dx = p.x - d.center.x, dz = p.z - d.center.z, dd = Math.hypot(dx, dz), m = DR + 1.6;
      if (dd < m) { p.x = d.center.x + dx / dd * m; p.z = d.center.z + dz / dd * m; if (!resolve.warned) { APP.toast('🔒 ' + d.ch.title + ' مغلق: انجح في اختبار الحي السابق بـ٨٠٪.'); resolve.warned = true; setTimeout(() => resolve.warned = false, 3000); } }
    }
    const rr = Math.hypot(p.x, p.z); if (rr > 120) { p.x *= 120 / rr; p.z *= 120 / rr; }
  }
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    if (paused && !confT) return;
    // الحركة
    let f = 0, s = 0;
    if (!paused && !APP.modalOpen()) {
      if (keys.has('w') || keys.has('arrowup') || keys.has('ص')) f += 1;
      if (keys.has('s') || keys.has('arrowdown') || keys.has('س')) f -= 1;
      if (keys.has('a') || keys.has('arrowleft') || keys.has('ش')) s -= 1;
      if (keys.has('d') || keys.has('arrowright') || keys.has('ي')) s += 1;
      f -= jv.y; s += jv.x;
    }
    const mag = Math.min(1, Math.hypot(f, s));
    if (mag > .05) {
      const fx = -Math.sin(yaw), fz = -Math.cos(yaw); // الأمام بعيدًا عن الكاميرا
      const rx = -fz, rz = fx;
      v.set(fx * f + rx * s, 0, fz * f + rz * s).normalize().multiplyScalar(14 * mag * dt);
      player.position.add(v); resolve(player.position);
      const target = Math.atan2(v.x, v.z);
      let dy = target - player.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      player.rotation.y += dy * Math.min(1, dt * 12);
      player.position.y = reduce ? 0 : Math.abs(Math.sin(now * .012)) * .12;
    } else player.position.y *= .8;
    // الكاميرا
    camTarget.set(player.position.x, 2.2, player.position.z);
    tmp.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)).multiplyScalar(dist).add(camTarget);
    camera.position.lerp(tmp, Math.min(1, dt * 8)); camera.lookAt(camTarget);
    // القرب
    let best = null, bd = 1e9;
    for (const it of interact) { const d = it.pos.distanceTo(player.position); if (d < it.r && d < bd && districts[it.district].unlocked) { best = it.id; bd = d; } }
    if (!best && player.position.distanceTo(board.position) < 5.5) best = 'board';
    if (best !== nearId) { nearId = best; APP.onNear(best); }
    let dist0 = null; for (const d of districts) if (Math.hypot(player.position.x - d.center.x, player.position.z - d.center.z) < DR + 2) dist0 = d.ch.id;
    if (dist0 !== curDistrict) { curDistrict = dist0; APP.onDistrict(dist0); }
    // الحركة الحية
    const tt = now * .001;
    for (const it of interact) if (it.veil) { it.veil.material.opacity = .14 + (reduce ? 0 : Math.sin(tt * 2 + it.pos.x) * .06) + (it.id === nearId ? .2 : 0); }
    ring.material.opacity = nearId ? .95 : .55;
    if (confT > 0) {
      confT -= dt;
      cparts.forEach((c, i) => { c.v.y -= 12 * dt; c.p.addScaledVector(c.v, dt); c.r += dt * 8; dummy.position.copy(c.p); dummy.rotation.set(c.r, c.r * .7, 0); dummy.scale.setScalar(1); dummy.updateMatrix(); conf.setMatrixAt(i, dummy.matrix); });
      conf.instanceMatrix.needsUpdate = true; if (confT <= 0) conf.visible = false;
    }
    renderer.render(scene, camera);
    // الأسماء فوق العالم (DOM)
    if (++labelTick % 2 === 0) {
      const w = innerWidth, h = innerHeight;
      for (const l of labels) {
        const d = l.pos.distanceTo(camera.position);
        tmp.copy(l.pos).project(camera);
        const vis = !APP.modalOpen() && tmp.z < 1 && d < l.far && Math.abs(tmp.x) < 1.1 && Math.abs(tmp.y) < 1.1 && !(l.lesson && !districts[l.district].unlocked);
        if (!vis) { if (l.el.style.display !== 'none') l.el.style.display = 'none'; continue; }
        l.el.style.display = '';
        const x = (tmp.x * .5 + .5) * w, y = (-tmp.y * .5 + .5) * h;
        l.el.style.right = (w - x) + 'px'; l.el.style.top = y + 'px';
        l.el.style.opacity = Math.max(.25, 1 - d / l.far).toFixed(2);
      }
    }
  }

  addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

  window.WORLD = {
    setUnlocked, setDone, teleport, celebrate,
    pause: (p) => { paused = p; if (p) { keys.clear(); jend(); } },
    debug: { scene, camera, player, districts, interact, renderer }
  };
  APP.ready();
  requestAnimationFrame(frame);
}
