/* راسم الدولة المتساوي القياس (Canvas 2D بلا مكتبات)
   الدولة تنمو: بيوت طين ونخيل في المجتمع التقليدي، ثم طرق ومصانع ومدارس، ثم أبراج ومنشآت الرؤية. */
(function () {
  'use strict';
  const N = 18;                 // حجم الشبكة
  const TW = 64, TH = 32;       // أبعاد البلاطة
  const P = {
    sand: ['#ecd9aa', '#e7d29f', '#efdfb4', '#e3cc96'], grass: ['#9cc46e', '#8fbb62', '#a7cc79'], farm: ['#c9b463', '#b9a552'],
    water: '#4fa3bd', water2: '#7cc3d4', road: '#8d8574', roadLine: '#f3e7b9', mud: ['#c9a678', '#b8946a', '#a8845c'],
    white: ['#fbf8f0', '#e9e2d1', '#d8cfba'], cream: ['#f4ead2', '#e2d5b6', '#cfc09c'], green: ['#1b7a5a', '#145f48', '#0d4d3a'],
    gold: ['#e0bd55', '#c9a43a', '#a9862a'], glass: ['#8ed1d6', '#5fb3bd', '#3f8f99'], brick: ['#d08f62', '#b8774d', '#9d633e'],
    steel: ['#c4ccd0', '#a4aeb3', '#87929a'], roof: ['#b5523b', '#9a4330', '#7f3727'], dark: '#2b2b2b', shadow: 'rgba(40,30,10,.18)'
  };
  const R = (() => { let s = 11; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();

  let cv, g, W = 0, H = 0, dpr = 1, ox = 0, oy = 0, scale = 1;
  let stage = 0;
  const tiles = [];   // terrain
  const items = [];   // buildings {type,i,j,born,lvl}
  const cars = [], smoke = [];
  let hoverTip = null;

  /* ---------- التضاريس ---------- */
  function idx(i, j) { return i * N + j; }
  function buildTerrain() {
    tiles.length = 0;
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) tiles.push({ t: 'sand', v: Math.floor(R() * 4), shrub: R() < .12 ? [(R() - .5) * 26, (R() - .5) * 8] : null, rock: R() < .06 ? (R() - .5) * 20 : 0 });
    // واحة وماء
    const water = [[3, 3], [3, 4], [4, 3], [4, 4], [2, 4], [4, 5], [5, 4]];
    water.forEach(([i, j]) => tiles[idx(i, j)].t = 'water');
    // الطرق الرئيسة (صليب)
    for (let k = 0; k < N; k++) { tiles[idx(9, k)].road = 'h'; tiles[idx(k, 9)].road = 'v'; }
    tiles[idx(9, 9)].road = 'x';
  }
  const roadAt = (i, j) => i >= 0 && j >= 0 && i < N && j < N && tiles[idx(i, j)].road;
  // البلاطات المزروعة تزيد مع المرحلة والبيئة
  let greenR = 2.5;

  /* ---------- مواقع المباني ---------- */
  // ترتيب ثابت لملء المواقع: من قرب المركز إلى الأطراف، بعيدًا عن الطرق والماء
  const slots = [];
  function makeSlots() {
    slots.length = 0;
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      const t = tiles[idx(i, j)];
      if (t.road || t.t === 'water') continue;
      if (i === 0 || j === 0 || i === N - 1 || j === N - 1) continue;
      const d = Math.hypot(i - 9, j - 9) + R() * 1.2;
      slots.push({ i, j, d, used: false });
    }
    slots.sort((a, b) => a.d - b.d);
  }
  function takeSlot(near) {
    let best = null, bd = 1e9;
    for (const s of slots) { if (s.used) continue; const d = near ? Math.hypot(s.i - near[0], s.j - near[1]) : s.d; if (d < bd) { bd = d; best = s; } }
    if (best) best.used = true; return best;
  }
  // مناطق مفضلة لكل نوع
  const zone = { farm: [5, 13], palm: [5, 6], mud: [11, 12], house: [12, 6], school: [7, 11], clinic: [11, 7], hospital: [11, 7], market: [8, 8], mosque: [10, 10],
    factory: [14, 14], power: [15, 12], workshop: [13, 14], road: null, bank: [7, 7], tower: [7, 8], university: [6, 11], park: [5, 7], stats: [8, 11],
    ministry: [10, 8], hub: [10, 11], council: [8, 10], port: [3, 6], vision: [8, 7], solar: [15, 4], company: [7, 6] };

  /* ---------- الرسم الأساسي ---------- */
  function iso(i, j) { return [(j - i) * TW / 2, (i + j) * TH / 2]; }
  function diamond(x, y, fill, stroke) {
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + TW / 2, y + TH / 2); g.lineTo(x, y + TH); g.lineTo(x - TW / 2, y + TH / 2); g.closePath();
    g.fillStyle = fill; g.fill(); if (stroke) { g.strokeStyle = stroke; g.lineWidth = 1; g.stroke(); }
  }
  // منشور بثلاثة أوجه: w,d بوحدات البلاطة (0..1) وh بالبكسل
  function prism(x, y, w, d, h, c, opt = {}) {
    const hw = TW / 2, hh = TH / 2;
    const cx = x, cy = y + TH / 2; // مركز البلاطة
    // رؤوس القاعدة
    const top = [cx + (-w + d) * 0 , 0];
    const A = [cx - w * hw * 0 + (d - w) * 0, 0];
    const p = (u, v) => [cx + (v - u) * hw, cy + (u + v) * hh]; // u على محور i، v على محور j، من -0.5 إلى 0.5
    const a = p(-w / 2, -d / 2), b = p(-w / 2, d / 2), c2 = p(w / 2, d / 2), e = p(w / 2, -d / 2);
    // الظل
    g.fillStyle = P.shadow; g.beginPath(); g.moveTo(b[0], b[1]); g.lineTo(c2[0], c2[1]); g.lineTo(c2[0] + h * .45, c2[1] - h * .08); g.lineTo(b[0] + h * .45, b[1] - h * .08); g.closePath(); g.fill();
    // الوجه الأيسر (u=+w/2)
    g.beginPath(); g.moveTo(e[0], e[1]); g.lineTo(c2[0], c2[1]); g.lineTo(c2[0], c2[1] - h); g.lineTo(e[0], e[1] - h); g.closePath(); g.fillStyle = c[1]; g.fill();
    // الوجه الأيمن (v=+d/2)
    g.beginPath(); g.moveTo(c2[0], c2[1]); g.lineTo(b[0], b[1]); g.lineTo(b[0], b[1] - h); g.lineTo(c2[0], c2[1] - h); g.closePath(); g.fillStyle = c[2]; g.fill();
    // السطح
    g.beginPath(); g.moveTo(a[0], a[1] - h); g.lineTo(b[0], b[1] - h); g.lineTo(c2[0], c2[1] - h); g.lineTo(e[0], e[1] - h); g.closePath(); g.fillStyle = c[0]; g.fill();
    g.strokeStyle = 'rgba(0,0,0,.08)'; g.lineWidth = 1; g.stroke();
    if (opt.windows) {
      const rows = Math.floor(h / 9), cols = 3;
      g.fillStyle = opt.windows;
      for (let r = 1; r < rows; r++) for (let k = 0; k < cols; k++) {
        const t = (k + .5) / cols;
        // الوجه الأيسر
        const lx = e[0] + (c2[0] - e[0]) * t, ly = e[1] + (c2[1] - e[1]) * t - r * 9;
        g.fillRect(lx - 2, ly - 5, 4, 4);
        const rx = c2[0] + (b[0] - c2[0]) * t, ry = c2[1] + (b[1] - c2[1]) * t - r * 9;
        g.fillRect(rx - 2, ry - 5, 4, 4);
      }
    }
    return { topCenter: [cx, cy - h], a, b, c: c2, e };
  }
  function dome(x, y, r, c) {
    const grd = g.createRadialGradient(x - r * .35, y - r * .5, r * .1, x, y, r * 1.1);
    grd.addColorStop(0, c[0]); grd.addColorStop(1, c[2]);
    g.beginPath(); g.ellipse(x, y, r, r * .5, 0, 0, Math.PI); g.lineTo(x - r, y); g.fillStyle = c[1]; g.fill();
    g.beginPath(); g.arc(x, y, r, Math.PI, 0); g.ellipse(x, y, r, r * .5, 0, 0, Math.PI); g.fillStyle = grd; g.fill();
    g.fillStyle = c[0]; g.fillRect(x - 1, y - r - 7, 2, 7); g.beginPath(); g.arc(x, y - r - 8, 2, 0, Math.PI * 2); g.fill();
  }
  function palm(x, y, s = 1, t = 0) {
    const h = 26 * s;
    g.strokeStyle = '#7d5a35'; g.lineWidth = 3 * s; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 3 * s, y - h / 2, x + 1 * s, y - h); g.stroke();
    const sway = Math.sin(t * 1.4 + x) * 1.5;
    g.strokeStyle = '#3f8a3a'; g.lineWidth = 2.6 * s;
    for (let k = 0; k < 7; k++) {
      const a = k / 7 * Math.PI * 2; const ex = x + 1 * s + Math.cos(a) * 12 * s + sway, ey = y - h + Math.sin(a) * 5 * s + 4 * s;
      g.beginPath(); g.moveTo(x + 1 * s, y - h); g.quadraticCurveTo((x + ex) / 2, y - h - 6 * s, ex, ey); g.stroke();
    }
    g.fillStyle = '#8a5a2b'; g.beginPath(); g.arc(x + 1 * s, y - h + 2, 2.5 * s, 0, Math.PI * 2); g.fill();
  }
  function tree(x, y, s = 1) {
    g.fillStyle = '#6d4c2f'; g.fillRect(x - 1.5, y - 8 * s, 3, 8 * s);
    g.fillStyle = '#4f9a4a'; g.beginPath(); g.arc(x, y - 13 * s, 7 * s, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#69b25d'; g.beginPath(); g.arc(x - 2 * s, y - 15 * s, 4 * s, 0, Math.PI * 2); g.fill();
  }

  /* ---------- المباني ---------- */
  const NAMES = { mud: 'بيت طين', house: 'مساكن', palm: 'نخيل', farm: 'مزرعة', school: 'مدرسة', clinic: 'مستوصف', hospital: 'مستشفى', market: 'سوق',
    mosque: 'جامع', factory: 'مصنع', power: 'محطة طاقة', workshop: 'ورشة ابتكار', bank: 'مصرف إسلامي', tower: 'برج أعمال', university: 'جامعة', park: 'حديقة',
    stats: 'مركز الإحصاء', ministry: 'وزارة الاقتصاد والتخطيط', hub: 'مركز النقل', council: 'مجلس الشورى', port: 'ميناء', vision: 'برج الرؤية', solar: 'حقل شمسي', company: 'شركة' };

  function drawItem(it, t) {
    const [bx, by] = iso(it.i, it.j); const x = bx, y = by;
    const age = Math.min(1, (t - it.born) / .6);
    const k = age < 1 ? (1 - Math.pow(1 - age, 3)) * (1 + Math.sin(age * Math.PI) * .12) : 1;
    g.save(); g.translate(x, y + TH / 2); g.scale(1, k); g.translate(-x, -(y + TH / 2));
    const lv = stage;
    switch (it.type) {
      case 'mud': {
        if (lv >= 2) { prism(x, y, .7, .7, 22, P.cream); g.fillStyle = '#5b4a33'; const tc = iso(it.i, it.j); g.fillRect(x + 6, y + TH / 2 + 2, 5, 7); }
        else { prism(x, y, .6, .6, 14, P.mud); g.fillStyle = '#4a3a28'; g.fillRect(x + 5, y + TH / 2 + 3, 4, 6); }
        break; }
      case 'house': {
        const h = lv >= 3 ? 30 : 20; prism(x - 6, y + 2, .45, .5, h, P.white, { windows: '#7fb6c2' }); prism(x + 9, y + 5, .4, .4, h * .7, P.cream, { windows: '#7fb6c2' }); break; }
      case 'palm': palm(x - 8, y + TH / 2 + 4, .9, t); palm(x + 9, y + TH / 2 + 8, .75, t + 1); break;
      case 'farm': {
        diamond(x, y, P.farm[0]); g.strokeStyle = '#8f7d33'; g.lineWidth = 1;
        for (let r = 1; r < 5; r++) { g.beginPath(); g.moveTo(x - TW / 2 + r * 6.4, y + TH / 2 - r * 3.2 + 0); g.lineTo(x + r * 6.4, y + TH - r * 3.2); g.stroke(); }
        break; }
      case 'school': { const b = prism(x, y, .8, .6, 22, P.cream, { windows: '#4b8fa0' }); g.fillStyle = P.green[0]; g.fillRect(b.topCenter[0] - 1, b.topCenter[1] - 16, 2, 16); g.fillStyle = '#2e9e6a'; g.fillRect(b.topCenter[0] + 1, b.topCenter[1] - 16, 9, 6); break; }
      case 'clinic': case 'hospital': { const b = prism(x, y, .8, .7, it.type === 'hospital' ? 34 : 20, P.white, { windows: '#7fb6c2' }); g.fillStyle = '#c0392b'; g.fillRect(b.topCenter[0] - 6, b.topCenter[1] - 2, 12, 4); g.fillRect(b.topCenter[0] - 2, b.topCenter[1] - 6, 4, 12); break; }
      case 'market': { prism(x, y, .85, .85, 12, P.brick); for (let k = -1; k <= 1; k++) { g.fillStyle = k % 2 ? '#e0bd55' : '#1b7a5a'; g.beginPath(); g.moveTo(x + k * 12 - 7, y + TH / 2 - 10); g.lineTo(x + k * 12 + 7, y + TH / 2 - 10); g.lineTo(x + k * 12, y + TH / 2 - 20); g.fill(); } break; }
      case 'mosque': { const b = prism(x, y, .8, .8, 20, P.white); dome(b.topCenter[0], b.topCenter[1] + 2, 13, P.gold);
        const m = prism(x - 18, y + 4, .16, .16, 46, P.white); g.fillStyle = P.gold[1]; g.beginPath(); g.moveTo(m.topCenter[0] - 4, m.topCenter[1]); g.lineTo(m.topCenter[0] + 4, m.topCenter[1]); g.lineTo(m.topCenter[0], m.topCenter[1] - 12); g.fill(); break; }
      case 'factory': case 'workshop': {
        const b = prism(x + 4, y + 2, .75, .6, 20, it.type === 'workshop' ? P.steel : P.brick, { windows: '#f5d58a' });
        for (let k = 0; k < 3; k++) { g.fillStyle = k % 2 ? P.steel[2] : P.steel[1]; g.beginPath(); g.moveTo(b.e[0] + k * 9, b.e[1] - 20); g.lineTo(b.e[0] + 9 + k * 9, b.e[1] - 26); g.lineTo(b.e[0] + 9 + k * 9, b.e[1] - 20 + 4); g.fill(); }
        if (it.type === 'factory') { prism(x - 16, y + 6, .14, .14, 44, P.brick); it.chim = [x - 16, y + TH / 2 + 6 - 44]; }
        break; }
      case 'power': { prism(x, y, .7, .7, 10, P.steel); g.fillStyle = P.steel[1];
        g.beginPath(); g.moveTo(x - 10, y + 10); g.quadraticCurveTo(x - 4, y - 10, x - 9, y - 30); g.lineTo(x + 9, y - 30); g.quadraticCurveTo(x + 4, y - 10, x + 10, y + 10); g.fill(); g.fillStyle = P.steel[0]; g.beginPath(); g.ellipse(x, y - 30, 9, 3.5, 0, 0, Math.PI * 2); g.fill(); it.chim = [x, y - 32]; break; }
      case 'bank': { const b = prism(x, y, .85, .75, 26, P.white); g.fillStyle = P.gold[1];
        for (let k = 0; k < 4; k++) { const tt = (k + .5) / 4; g.fillRect(b.c[0] + (b.b[0] - b.c[0]) * tt - 1.5, b.c[1] + (b.b[1] - b.c[1]) * tt - 24, 3, 20); }
        dome(b.topCenter[0], b.topCenter[1] + 3, 12, P.gold); break; }
      case 'tower': case 'company': { const h = it.type === 'tower' ? 70 + (it.i * 7 + it.j * 3) % 30 : 48; prism(x, y, .6, .6, h, it.type === 'tower' ? P.glass : P.cream, { windows: it.type === 'tower' ? '#d9f3f5' : '#6aa9b4' }); break; }
      case 'university': { const b = prism(x, y, .9, .7, 24, P.cream, { windows: '#4b8fa0' }); dome(b.topCenter[0], b.topCenter[1] + 2, 10, P.green); break; }
      case 'park': { diamond(x, y, '#86c06a'); tree(x - 12, y + TH / 2 + 4, .8); tree(x + 10, y + TH / 2 + 2, .9); tree(x, y + TH / 2 + 10, .7); g.fillStyle = P.water; g.beginPath(); g.ellipse(x + 2, y + TH / 2 - 2, 7, 3.5, 0, 0, Math.PI * 2); g.fill(); break; }
      case 'stats': { const b = prism(x, y, .55, .55, 40, P.glass, { windows: '#e9fbfc' }); g.strokeStyle = '#444'; g.beginPath(); g.moveTo(b.topCenter[0], b.topCenter[1]); g.lineTo(b.topCenter[0], b.topCenter[1] - 14); g.stroke(); g.fillStyle = '#e74c3c'; g.beginPath(); g.arc(b.topCenter[0], b.topCenter[1] - 14, 2, 0, 7); g.fill(); break; }
      case 'ministry': { const b = prism(x, y, .9, .8, 30, P.cream, { windows: '#356b78' }); g.fillStyle = P.green[0]; g.fillRect(b.topCenter[0] - 1, b.topCenter[1] - 22, 2, 22); g.fillStyle = '#1b7a5a'; g.fillRect(b.topCenter[0] + 1, b.topCenter[1] - 22, 12, 8); g.fillStyle = '#fff'; g.fillRect(b.topCenter[0] + 4, b.topCenter[1] - 19, 6, 1.5); break; }
      case 'hub': { prism(x, y, .9, .9, 8, P.steel); g.strokeStyle = P.gold[1]; g.lineWidth = 3; g.beginPath(); g.arc(x, y + TH / 2 - 4, 18, Math.PI * 1.05, Math.PI * 1.95); g.stroke(); break; }
      case 'council': { const b = prism(x, y, .8, .8, 18, P.white); for (let k = 0; k < 5; k++) { const tt = (k + .5) / 5; g.fillStyle = P.gold[2]; g.fillRect(b.e[0] + (b.c[0] - b.e[0]) * tt - 1, b.e[1] + (b.c[1] - b.e[1]) * tt - 16, 2, 14); } dome(b.topCenter[0], b.topCenter[1] + 2, 9, P.green); break; }
      case 'port': { diamond(x, y, '#9aa5a8'); prism(x + 8, y + 4, .3, .5, 14, P.roof); g.strokeStyle = '#c0392b'; g.lineWidth = 2; g.beginPath(); g.moveTo(x - 10, y + 16); g.lineTo(x - 10, y - 18); g.lineTo(x + 6, y - 14); g.stroke(); break; }
      case 'vision': { let yy = y, h = 0; [[.8, 16], [.62, 22], [.46, 26], [.3, 24]].forEach(([s, hh], k) => { const b = prism(x, yy - h, s, s, hh, k % 2 ? P.green : P.white, { windows: k % 2 ? '#e0bd55' : '#7fb6c2' }); h += hh; });
        const glow = g.createRadialGradient(x, y + TH / 2 - h - 8, 1, x, y + TH / 2 - h - 8, 14); glow.addColorStop(0, 'rgba(255,233,150,1)'); glow.addColorStop(1, 'rgba(255,233,150,0)');
        g.fillStyle = glow; g.beginPath(); g.arc(x, y + TH / 2 - h - 8, 14 + Math.sin(t * 3) * 2, 0, 7); g.fill(); g.fillStyle = '#ffe9a3'; g.beginPath(); g.arc(x, y + TH / 2 - h - 8, 4, 0, 7); g.fill(); break; }
      case 'solar': { diamond(x, y, '#d9cfb3'); for (let r = 0; r < 3; r++) for (let c = 0; c < 2; c++) { const px = x - 14 + r * 10 - c * 10, py = y + 8 + r * 5 + c * 5; g.fillStyle = '#2c4d6e'; g.beginPath(); g.moveTo(px, py); g.lineTo(px + 9, py - 3); g.lineTo(px + 14, py + 2); g.lineTo(px + 5, py + 5); g.fill(); } break; }
    }
    g.restore();
  }

  /* ---------- الحلقة ---------- */
  let last = performance.now(), t0 = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    if (document.hidden) return;
    const dt = Math.min(.05, (now - last) / 1000); last = now; const t = (now - t0) / 1000;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    // السماء
    const sky = g.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, stage >= 4 ? '#7cb8cf' : '#8cc3d1'); sky.addColorStop(.5, '#d7ebe6'); sky.addColorStop(1, '#f3e4bf');
    g.fillStyle = sky; g.fillRect(0, 0, W, H);
    // جبال الأفق
    g.fillStyle = 'rgba(150,115,80,.35)'; g.beginPath(); g.moveTo(0, H * .42);
    for (let x = 0; x <= W; x += 40) g.lineTo(x, H * .42 - 30 - Math.abs(Math.sin(x * .013) * 50) - Math.sin(x * .05) * 8); g.lineTo(W, H); g.lineTo(0, H); g.fill();
    g.save(); g.translate(ox, oy); g.scale(scale, scale);
    // جوانب الجزيرة (ديوراما)
    {
      const [lx, ly] = iso(N, 0), [bx, by] = iso(N, N), [rx, ry] = iso(0, N), D = 34;
      g.fillStyle = '#b08856'; g.beginPath(); g.moveTo(lx, ly); g.lineTo(bx, by); g.lineTo(bx, by + D); g.lineTo(lx, ly + D); g.closePath(); g.fill();
      g.fillStyle = '#9a7445'; g.beginPath(); g.moveTo(bx, by); g.lineTo(rx, ry); g.lineTo(rx, ry + D); g.lineTo(bx, by + D); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(80,55,25,.35)'; g.lineWidth = 2;
      for (let k = 1; k < 3; k++) { g.beginPath(); g.moveTo(lx, ly + k * 11); g.lineTo(bx, by + k * 11); g.lineTo(rx, ry + k * 11); g.stroke(); }
      g.fillStyle = 'rgba(0,0,0,.12)'; g.beginPath(); g.ellipse(bx, by + D + 18, (rx - lx) * .55, 28, 0, 0, 7); g.fill();
    }
    // البلاطات
    for (let s = 0; s < N * 2 - 1; s++) for (let i = 0; i < N; i++) {
      const j = s - i; if (j < 0 || j >= N) continue;
      const tl = tiles[idx(i, j)], [x, y] = iso(i, j);
      let col;
      const dc = Math.hypot(i - 9, j - 9);
      if (tl.t === 'water') col = (Math.sin(t * 2 + i + j) > .6) ? P.water2 : P.water;
      else if (dc < greenR) col = P.grass[tl.v % 3];
      else col = P.sand[tl.v];
      diamond(x, y, col, 'rgba(120,90,40,.07)');
      if (tl.t === 'sand' && tl.shrub && dc >= greenR) { g.fillStyle = '#9aa56a'; g.beginPath(); g.arc(x + tl.shrub[0], y + TH / 2 + tl.shrub[1], 2.6, 0, 7); g.arc(x + tl.shrub[0] + 3, y + TH / 2 + tl.shrub[1] + 1, 2, 0, 7); g.fill(); }
      if (tl.t === 'sand' && tl.rock) { g.fillStyle = '#b9a27a'; g.beginPath(); g.ellipse(x + tl.rock, y + TH / 2 + 3, 4, 2.4, 0, 0, 7); g.fill(); g.fillStyle = '#cdb88f'; g.beginPath(); g.ellipse(x + tl.rock - 1, y + TH / 2 + 2, 2.4, 1.3, 0, 0, 7); g.fill(); }
      if (tl.road && (stage >= 1 || Math.abs(i - 9) + Math.abs(j - 9) < 5)) {
        diamond(x, y, stage >= 1 ? P.road : '#cdb88c');
        if (stage >= 1) { // أرصفة
          g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 1.2; g.beginPath();
          if (tl.road === 'h') { g.moveTo(x - TW / 2, y + TH / 2); g.lineTo(x, y); g.moveTo(x, y + TH); g.lineTo(x + TW / 2, y + TH / 2); }
          if (tl.road === 'v') { g.moveTo(x, y); g.lineTo(x + TW / 2, y + TH / 2); g.moveTo(x - TW / 2, y + TH / 2); g.lineTo(x, y + TH); }
          g.stroke();
        }
        if (stage >= 2 && tl.road !== 'x') { g.strokeStyle = P.roadLine; g.setLineDash([5, 5]); g.lineWidth = 1.4; g.beginPath();
          if (tl.road === 'h') { g.moveTo(x - TW / 4, y + TH / 4); g.lineTo(x + TW / 4, y + TH * 3 / 4); }
          else { g.moveTo(x + TW / 4, y + TH / 4); g.lineTo(x - TW / 4, y + TH * 3 / 4); }
          g.stroke(); g.setLineDash([]); }
      }
    }
    // المباني والسيارات بترتيب العمق
    const draw = items.map(it => ({ z: it.i + it.j, f: () => drawItem(it, t) }));
    for (const c of cars) { draw.push({ z: c.i + c.j + .5, f: () => drawCar(c) }); }
    draw.sort((a, b) => a.z - b.z).forEach(d => d.f());
    // الدخان
    for (const it of items) if (it.chim && R() < dt * 6) smoke.push({ x: it.chim[0], y: it.chim[1], r: 3, a: .55 });
    for (let k = smoke.length - 1; k >= 0; k--) { const s = smoke[k]; s.y -= 14 * dt; s.x += 6 * dt; s.r += 6 * dt; s.a -= .25 * dt; if (s.a <= 0) { smoke.splice(k, 1); continue; }
      g.fillStyle = `rgba(230,230,230,${s.a})`; g.beginPath(); g.arc(s.x, s.y, s.r, 0, 7); g.fill(); }
    // تحرك السيارات
    for (const c of cars) { c.p += dt * c.sp; if (c.p > N - .6) c.p = 0; if (c.axis === 'h') { c.i = 9 + (c.lane ? .25 : -.25); c.j = c.dir > 0 ? c.p : N - 1 - c.p; } else { c.j = 9 + (c.lane ? .25 : -.25); c.i = c.dir > 0 ? c.p : N - 1 - c.p; } }
    // الإبراز
    if (hoverTip && hoverTip.until > t) {
      const [x, y] = iso(hoverTip.i, hoverTip.j);
      g.strokeStyle = 'rgba(201,164,58,' + (0.5 + Math.sin(t * 6) * .4) + ')'; g.lineWidth = 3; g.beginPath(); g.moveTo(x, y); g.lineTo(x + TW / 2, y + TH / 2); g.lineTo(x, y + TH); g.lineTo(x - TW / 2, y + TH / 2); g.closePath(); g.stroke();
    }
    g.restore();
  }
  function drawCar(c) {
    const [x, y] = iso(c.i, c.j); const cx = x, cy = y + TH / 2;
    g.fillStyle = 'rgba(0,0,0,.2)'; g.beginPath(); g.ellipse(cx + 2, cy + 2, 6, 3, 0, 0, 7); g.fill();
    g.fillStyle = c.col; g.beginPath(); g.ellipse(cx, cy - 2, 6, 3.4, c.axis === 'h' ? -.46 : .46, 0, 7); g.fill();
    g.fillStyle = 'rgba(255,255,255,.7)'; g.beginPath(); g.ellipse(cx, cy - 4, 3, 1.8, c.axis === 'h' ? -.46 : .46, 0, 7); g.fill();
  }

  function resize() {
    const r = cv.getBoundingClientRect(); W = r.width; H = r.height; dpr = Math.min(devicePixelRatio || 1, 2);
    cv.width = W * dpr; cv.height = H * dpr;
    const gw = N * TW, gh = N * TH + 90;
    const zoom = W < 700 ? 1.25 : 1.45;
    scale = Math.min(W / gw, (H * .92) / gh) * zoom;
    // تمركز على قلب الدولة (البلاطة 9،9) مع إزاحة طفيفة للأسفل
    const [cx, cy] = iso(9.5, 9.5);
    ox = W / 2 - cx * scale; oy = H * .52 - cy * scale;
  }

  function add(type, near) {
    const z = near || zone[type];
    const s = takeSlot(z); if (!s) return null;
    const it = { type, i: s.i, j: s.j, born: (performance.now() - t0) / 1000 };
    items.push(it);
    return it;
  }
  function baseVillage() {
    for (let k = 0; k < 7; k++) add('mud', [11 + (k % 3), 11 + Math.floor(k / 3)]);
    for (let k = 0; k < 6; k++) add('palm', [4 + (k % 3) * 1.5, 6 + Math.floor(k / 3)]);
    for (let k = 0; k < 4; k++) add('farm', [5 + k % 2, 12 + Math.floor(k / 2)]);
    items.forEach(it => it.born = -5);
  }
  function setCars(n) {
    n = Math.max(0, Math.min(14, Math.round(n)));
    const cols = ['#c0392b', '#f4f4f4', '#2c3e50', '#e0bd55', '#1b7a5a', '#7f8c8d'];
    while (cars.length < n) { const k = cars.length; cars.push({ axis: k % 2 ? 'h' : 'v', dir: k % 4 < 2 ? 1 : -1, lane: k % 4 < 2, p: R() * N, sp: .9 + R() * .9, col: cols[k % cols.length], i: 0, j: 0 }); }
    cars.length = n;
  }

  window.ISO = {
    init(canvas) {
      cv = canvas; g = cv.getContext('2d');
      buildTerrain(); makeSlots(); baseVillage();
      resize(); addEventListener('resize', resize);
      if ('ResizeObserver' in window) new ResizeObserver(resize).observe(cv);
      cv.addEventListener('pointermove', (e) => {
        const r = cv.getBoundingClientRect(); const mx = (e.clientX - r.left - ox) / scale, my = (e.clientY - r.top - oy) / scale;
        // تحويل عكسي للبلاطة
        const fi = (my / (TH / 2) - mx / (TW / 2)) / 2, fj = (my / (TH / 2) + mx / (TW / 2)) / 2;
        const i = Math.floor(fi), j = Math.floor(fj);
        const it = items.find(x => x.i === i && x.j === j);
        cv.title = it ? NAMES[it.type] || '' : '';
      });
      requestAnimationFrame(frame);
    },
    setStage(s) { stage = s; greenR = Math.min(7.5, 2.5 + s * 1.2); },
    setGreen(env) { greenR = Math.max(1.5, Math.min(8, 2.5 + stage * 1.2 + (env - 50) / 15)); },
    setCars,
    build(type, near) { const it = add(type, near); if (it) hoverTip = { i: it.i, j: it.j, until: it.born + 2.5 }; return it ? NAMES[type] : null; },
    upgradeVillage() { items.filter(i => i.type === 'mud').slice(0, 3).forEach(i => { i.type = 'house'; i.born = (performance.now() - t0) / 1000; }); },
    count: () => items.length,
    names: NAMES,
    snapshot: () => items.map(i => i.type)
  };
})();
