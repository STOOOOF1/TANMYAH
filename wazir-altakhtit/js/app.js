/* طبقة التعلّم لـ«مدينة التنمية»: الدروس، والمحاكيات، والاختبارات، والإتقان، والمراجعة، والتقرير، والشهادة، ووضع المعلم */
(function () {
  'use strict';
  const C = window.CONTENT;
  const KEY = 'wazir-takhtit-v1';
  const $ = (s, r = document) => r.querySelector(s);
  const el = (tag, attrs = {}, ...kids) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') n.className = v;
      else if (k === 'html') n.innerHTML = v;
      else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v === true ? '' : v);
    }
    for (const k of kids.flat()) if (k != null && k !== false) n.append(k.nodeType ? k : document.createTextNode(String(k)));
    return n;
  };
  const AR = (n) => String(n).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);
  const today = () => new Date().toISOString().slice(0, 10);
  const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  /* ---------- الفهارس ---------- */
  const chapters = C.chapters;
  const lessonById = {}, chapterOf = {};
  chapters.forEach((c, ci) => c.lessons.forEach((l, li) => { lessonById[l.id] = l; chapterOf[l.id] = c; l._ci = ci; l._li = li; }));
  const allQuestions = {}; // مفتاح ثابت لكل سؤال
  chapters.forEach(c => {
    c.lessons.forEach(l => { allQuestions[l.id + ':quick'] = Object.assign({ lesson: l.id }, l.quick); });
    c.quiz.forEach((q, i) => { allQuestions[c.id + ':q' + i] = q; });
  });

  /* ---------- الحفظ ---------- */
  const fresh = () => ({ name: '', xp: 0, streak: 0, best: 0, visited: {}, quick: {}, pre: {}, pretestDone: {}, scores: {}, passed: {},
    leitner: {}, wrong: {}, time: {}, free: false, fs: 1, muted: false, started: false, teacher: false, finished: null });
  let S = fresh();
  let storageOk = true;
  try { const raw = localStorage.getItem(KEY); if (raw) S = Object.assign(fresh(), JSON.parse(raw)); } catch (e) { storageOk = false; }
  const save = () => { if (!storageOk) return; try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { storageOk = false; } };

  /* ---------- الصوت ---------- */
  let ac = null;
  function tone(kind) {
    if (S.muted) return;
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      const seq = { ok: [[660, .08], [880, .12]], bad: [[220, .16]], win: [[523, .1], [659, .1], [784, .1], [1047, .2]], tick: [[1200, .03]], open: [[440, .06], [554, .08]] }[kind] || [[440, .1]];
      let t = ac.currentTime;
      seq.forEach(([f, d]) => {
        const o = ac.createOscillator(), g = ac.createGain();
        o.type = kind === 'bad' ? 'sawtooth' : 'triangle'; o.frequency.value = f;
        g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.12, t + .015); g.gain.exponentialRampToValueAtTime(.0001, t + d);
        o.connect(g).connect(ac.destination); o.start(t); o.stop(t + d + .02); t += d * .9;
      });
    } catch (e) { /* لا صوت */ }
  }

  /* ---------- التنبيه ---------- */
  let toastT;
  function toast(msg, gold) {
    const t = $('#toast'); t.textContent = msg; t.classList.toggle('gold', !!gold); t.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2400);
  }

  /* ---------- الخبرة والرتب ---------- */
  const rankSteps = [0, 120, 300, 520, 780];
  const rankOf = (xp) => { let r = 0; rankSteps.forEach((s, i) => { if (xp >= s) r = i; }); return r; };
  function addXP(n, reason) {
    const before = rankOf(S.xp);
    const mult = S.streak >= 5 ? 2 : 1;
    S.xp += n * mult; save(); renderHUD();
    const after = rankOf(S.xp);
    if (after > before) { tone('win'); toast('ارتقيت إلى مرحلة: ' + C.ranks[after], true); hook('rank', { rank: after }); }
    else if (reason) toast(reason + ' +' + AR(n * mult) + ' خبرة' + (mult > 1 ? ' (×٢ سلسلة)' : ''));
  }
  function streakHit(ok) {
    if (ok) { S.streak++; S.best = Math.max(S.best, S.streak); } else S.streak = 0;
    save(); renderHUD();
  }
  function renderHUD() {
    const r = rankOf(S.xp), next = rankSteps[r + 1];
    $('#hud-rank').textContent = 'المرحلة: ' + C.ranks[r];
    const pct = next ? ((S.xp - rankSteps[r]) / (next - rankSteps[r])) * 100 : 100;
    $('#xp-fill').style.width = Math.min(100, pct) + '%';
    $('#xp-text').textContent = AR(S.xp) + ' خبرة' + (next ? ' / ' + AR(next) : '');
    const st = $('#streak'); st.hidden = S.streak < 2; st.textContent = '🔥 ' + AR(S.streak);
    const due = dueReview().length; const rc = $('#review-count'); rc.hidden = !due; rc.textContent = AR(due);
    $('#b-mute').textContent = S.muted ? '🔇' : '🔊';
    document.documentElement.style.setProperty('--fs', S.fs);
  }

  /* ---------- الفتح والإتقان ---------- */
  const isUnlocked = (ci) => ci === 0 || S.free || S.teacher || !!S.passed[chapters[ci - 1].id];
  const unlockMap = () => chapters.map((c, i) => isUnlocked(i));
  function syncWorld() { hook('sync', {}); }
  function hook(evt, data) { try { window.SIM && SIM.on(evt, data); } catch (e) { console.error(e); } }

  /* ---------- لايتنر ---------- */
  function leitnerWrong(key) { S.leitner[key] = { box: 1, days: [], last: today() }; save(); }
  function leitnerRight(key) {
    const it = S.leitner[key]; if (!it) return;
    const d = today(); if (!it.days.includes(d)) it.days.push(d);
    it.box = Math.min(3, it.box + 1); it.last = d;
    if (it.days.length >= 2) delete S.leitner[key];
    save();
  }
  const dueReview = () => Object.entries(S.leitner).filter(([k, v]) => allQuestions[k] && !(v.days || []).includes(today())).map(([k]) => k);

  /* ---------- الوقت في كل حي ---------- */
  let curChapter = null, curSince = Date.now();
  function trackChapter(cid) {
    const now = Date.now();
    if (curChapter) { S.time[curChapter] = (S.time[curChapter] || 0) + Math.min(600, (now - curSince) / 1000); }
    curChapter = cid; curSince = now; save();
  }
  setInterval(() => { if (curChapter && !document.hidden) trackChapter(curChapter); }, 20000);

  /* ---------- النافذة ---------- */
  const modal = $('#modal'), body = $('#sheet-body');
  let onClose = null, lastFocus = null;
  function openSheet(kicker, title, nodes, opts = {}) {
    if (modal.hidden) lastFocus = document.activeElement;
    $('#sheet-kicker').textContent = kicker || '';
    $('#sheet-title').textContent = title || '';
    body.replaceChildren(...[].concat(nodes));
    modal.hidden = false; body.scrollTop = 0;
    onClose = opts.onClose || null;
    $('#sheet-close').classList.toggle('hide-no3d', !!opts.home);
    setTimeout(() => body.focus(), 30);
  }
  function closeSheet() {
    if (document.body.classList.contains('no3d') && $('#sheet-close').classList.contains('hide-no3d')) return;
    modal.hidden = true; const f = onClose; onClose = null; f && f();
    hook('closed', {});
    if (document.body.classList.contains('no3d')) { showMap(); return; }
    trackChapter(null);
    lastFocus && lastFocus.focus && lastFocus.focus();
  }
  $('#sheet-close').addEventListener('click', closeSheet);
  modal.addEventListener('click', (e) => { if (e.target === modal) closeSheet(); });

  /* ---------- عرض المحتوى ---------- */
  function renderBlock(b) {
    switch (b.type) {
      case 'p': return el('p', { class: 'b-p' }, b.text);
      case 'rule': return el('div', { class: 'b-rule tag-' + (b.label || '').split(' ')[0] },
        el('span', { class: 'tag' }, b.label), b.title ? el('h4', {}, b.title) : null, el('p', {}, b.text));
      case 'list': return el('div', { class: 'b-list' }, b.title ? el('h4', {}, b.title) : null,
        el(b.ordered ? 'ol' : 'ul', {}, b.items.map(t => el('li', {}, t))));
      case 'table': return el('div', { class: 'b-table' }, b.title ? el('h4', {}, b.title) : null,
        el('div', { class: 'tbl-wrap', tabindex: '0', role: 'region', 'aria-label': b.title || 'جدول' },
          el('table', {}, el('thead', {}, el('tr', {}, b.head.map(h => el('th', { scope: 'col' }, h)))),
            el('tbody', {}, b.rows.map(r => el('tr', {}, r.map(c => el('td', {}, c))))))));
      case 'ayah': return el('div', { class: 'b-ayah' }, b.text, el('small', {}, '(' + b.ref + ')'));
      case 'example': return el('div', { class: 'b-rule' }, el('span', { class: 'tag' }, 'مثال'), el('p', {}, b.text), el('p', {}, b.solution));
      case 'note': return el('p', { class: 'b-note' }, b.text);
    }
    return el('p', {}, b.text || '');
  }

  /* ---------- سؤال واحد ---------- */
  // يعرض سؤالًا بخيارات مخلوطة، ويستدعي done(isCorrect)
  function questionBox(q, { kicker = '', key = null, onDone, back = true, timer = 0 } = {}) {
    const order = shuffle(q.options.map((_, i) => i));
    const box = el('div', { class: 'qbox pop' });
    const tEl = timer ? el('span', { class: 'timer' }, AR(timer) + ' ث') : null;
    box.append(el('div', { class: 'qhead' }, el('span', {}, kicker), el('span', { class: 'pref' }, 'ص' + AR(q.page)), tEl));
    box.append(el('div', { class: 'q', id: 'q-' + Math.random().toString(36).slice(2, 7) }, q.q));
    const opts = el('div', { class: 'opts', role: 'group', 'aria-label': 'الخيارات' });
    let answered = false, iv = null;
    const finish = (picked) => {
      if (answered) return; answered = true; clearInterval(iv);
      const ok = picked === q.answer;
      [...opts.children].forEach((b, i) => {
        b.disabled = true;
        if (order[i] === q.answer) b.classList.add('ok');
        if (order[i] === picked && !ok) b.classList.add('bad');
      });
      tone(ok ? 'ok' : 'bad'); box.classList.remove('pop'); void box.offsetWidth; box.classList.add(ok ? 'pop' : 'shake');
      streakHit(ok);
      if (key) { if (ok) leitnerRight(key); else leitnerWrong(key); }
      if (!ok && q.lesson) { S.wrong[q.lesson] = (S.wrong[q.lesson] || 0) + 1; save(); }
      const fb = el('div', { class: 'fb ' + (ok ? 'ok' : 'bad') + (document.body.classList.contains('present') ? '' : ' revealed'), role: 'status' });
      fb.append(el('b', {}, ok ? '✓ إجابة صحيحة' : (picked === -1 ? '⏱ انتهى الوقت' : '✗ ليست هذه')));
      if (!ok && picked >= 0 && q.why && q.why[picked]) fb.append(el('div', { class: 'why' }, 'لماذا لا؟ ' + q.why[picked]));
      if (q.explain) fb.append(el('div', {}, q.explain));
      const acts = el('div', { class: 'acts' });
      if (!ok && back && q.lesson && lessonById[q.lesson]) acts.append(el('button', { class: 'btn small', onclick: () => openLesson(q.lesson, { returnTo: currentView }) }, '↩ ارجع إلى الدرس'));
      fb.append(acts);
      box.append(fb);
      if (document.body.classList.contains('present')) box.append(el('button', { class: 'btn small gold noprint', onclick: (e) => { fb.classList.add('revealed'); e.target.remove(); } }, 'اكشف التعليل'));
      onDone && onDone(ok, box);
    };
    order.forEach((oi, i) => {
      opts.append(el('button', { class: 'opt', onclick: () => finish(oi) }, el('span', { class: 'k' }, ['أ', 'ب', 'ج', 'د', 'هـ'][i]), q.options[oi]));
    });
    box.append(opts);
    if (timer) {
      let left = timer;
      iv = setInterval(() => { if (!box.isConnected) return clearInterval(iv); left--; tEl.textContent = AR(left) + ' ث'; if (left <= 5) tone('tick'); if (left <= 0) finish(-1); }, 1000);
    }
    box.addEventListener('keydown', (e) => {
      const n = '1234'.indexOf(e.key); if (n >= 0 && opts.children[n]) opts.children[n].click();
    });
    return box;
  }

  /* ---------- الدرس ---------- */
  let currentView = null;
  function openLesson(id, opts = {}) {
    const l = lessonById[id], c = chapterOf[id];
    if (!l) return;
    if (!isUnlocked(l._ci)) { toast('هذه الخطة مغلقة: يجب أن يُقرّ المجلس الخطة السابقة بـ٨٠٪، أو فعّل المراجعة الحرة من الأرشيف.'); return; }
    trackChapter(c.id);
    const firstVisit = !S.visited[id]; S.visited[id] = true; save();
    if (firstVisit) addXP(5);
    tone('open');
    const nodes = [];
    nodes.push(el('div', { class: 'row' }, el('span', { class: 'pref' }, '📖 ' + (l.chapterRef || '') + ' — ص' + AR(l.page)),
      S.pre[id] ? el('span', { class: 'badge pass' }, '★ متقن مبدئيًا من التشخيص') : null));
    l.blocks.forEach(b => nodes.push(renderBlock(b)));
    if (l.widget) nodes.push(renderWidget(l.widget));
    const qwrap = el('div');
    const qdone = !!S.quick[id];
    qwrap.append(questionBox(Object.assign({ lesson: id }, l.quick), {
      kicker: qdone ? 'قرار الملف (اتخذته من قبل)' : 'قرار الملف: اختر الصحيح بحسب الإحاطة', key: id + ':quick', back: false,
      onDone: (ok) => {
        const first = ok && !S.quick[id];
        if (first) { S.quick[id] = true; save(); addXP(15, 'نُفّذ القرار'); syncWorld(); }
        hook('quick', { lesson: id, ok, first });
        if (ok) checkChapterLessons(c);
      }
    }));
    nodes.push(qwrap);
    const ls = c.lessons, i = l._li;
    const nav = el('div', { class: 'lesson-nav noprint' },
      el('div', { class: 'row' },
        i > 0 ? el('button', { class: 'btn small', onclick: () => openLesson(ls[i - 1].id) }, '→ الدرس السابق') : null,
        i < ls.length - 1 ? el('button', { class: 'btn small', onclick: () => openLesson(ls[i + 1].id) }, 'الدرس التالي ←') : el('button', { class: 'btn small gold', onclick: () => startQuiz(c.id) }, 'جلسة المجلس: ' + c.title + ' ←')),
      el('div', { class: 'row' },
        opts.returnTo ? el('button', { class: 'btn small primary', onclick: () => opts.returnTo() }, '↩ عد إلى الاختبار') : null,
        el('button', { class: 'btn small', onclick: showMap }, '🗺️ الخريطة')));
    nodes.push(nav);
    currentView = () => openLesson(id, opts);
    openSheet(c.title + ' · الدرس ' + AR(i + 1) + ' من ' + AR(ls.length), l.title, nodes);
  }
  function checkChapterLessons(c) {
    if (c.lessons.every(l => S.quick[l.id]) && !S.passed[c.id]) toast('أنهيت ملفات ' + c.title + '. المجلس ينتظرك!', true);
  }

  /* ---------- المحاكيات ---------- */
  function renderWidget(wid) {
    const w = C.widgets[wid];
    const wrap = el('section', { class: 'widget', 'aria-label': w.title });
    const bodyW = el('div', { class: 'w-body' });
    const reset = el('button', { class: 'btn small', onclick: () => { bodyW.replaceChildren(...build()); } }, '↺ أعد للأصل');
    wrap.append(el('div', { class: 'w-head' }, el('h4', {}, '🧪 ' + w.title), el('div', { class: 'row' }, el('span', { class: 'pref' }, 'ص' + AR(w.page)), reset)), bodyW);
    const build = () => {
      const out = [el('p', { class: 'w-hint' }, w.hint)];
      if (w.type === 'sort') out.push(...sortWidget(w, wid));
      else if (w.type === 'sequence') out.push(...seqWidget(w, wid));
      else if (w.type === 'finance') out.push(...financeWidget(w));
      return out;
    };
    bodyW.append(...build());
    return wrap;
  }
  function widgetWon(wid) {
    S.widgets = S.widgets || {};
    const first = !S.widgets[wid];
    if (first) { S.widgets[wid] = true; save(); addXP(20, 'أنجزت المهمة الميدانية'); } else toast('أحسنت!');
    hook('widget', { wid, first });
    tone('win');
  }
  function sortWidget(w, wid) {
    const pool = el('div', { class: 'pool', 'aria-label': 'البطاقات' });
    const msg = el('div', { class: 'w-msg', role: 'status' });
    let sel = null, placed = 0, mistakes = 0;
    const bins = el('div', { class: 'bins' });
    const select = (card) => { if (sel) sel.classList.remove('sel'); sel = card === sel ? null : card; if (sel) sel.classList.add('sel'); };
    const drop = (card, bi, binEl) => {
      const cd = w.cards[+card.dataset.i];
      if (cd.bin === bi) {
        card.classList.remove('sel', 'bad'); card.classList.add('ok'); card.setAttribute('aria-disabled', 'true'); card.tabIndex = -1; card.draggable = false;
        binEl.append(card); placed++; tone('ok'); msg.className = 'w-msg ok'; msg.textContent = '✓ «' + cd.text + '» ← ' + w.bins[bi];
        if (placed === w.cards.length) { msg.textContent = mistakes ? '✓ اكتمل التصنيف، مع ' + AR(mistakes) + ' محاولة خاطئة. أعد للأصل لتجرّب دون أخطاء.' : '✓ تصنيف كامل بلا خطأ!'; widgetWon(wid); }
      } else {
        mistakes++; tone('bad'); card.classList.add('bad'); setTimeout(() => card.classList.remove('bad'), 600);
        msg.className = 'w-msg bad'; msg.textContent = '✗ «' + cd.text + '» ليست من «' + w.bins[bi] + '». راجع الدرس ص' + AR(w.page) + '.';
      }
      sel = null;
    };
    w.bins.forEach((b, bi) => {
      const be = el('div', { class: 'bin', role: 'button', tabindex: '0', 'aria-label': 'ضع البطاقة المحددة في: ' + b },
        el('div', { class: 'bt' }, b));
      be.addEventListener('click', () => { if (sel) drop(sel, bi, be); else { msg.className = 'w-msg'; msg.textContent = 'اختر بطاقة أولًا، ثم اضغط الكفة.'; } });
      be.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); be.click(); } });
      be.addEventListener('dragover', (e) => { e.preventDefault(); be.classList.add('over'); });
      be.addEventListener('dragleave', () => be.classList.remove('over'));
      be.addEventListener('drop', (e) => { e.preventDefault(); be.classList.remove('over'); const c = pool.querySelector('[data-i="' + e.dataTransfer.getData('text') + '"]'); if (c) drop(c, bi, be); });
      bins.append(be);
    });
    shuffle(w.cards.map((_, i) => i)).forEach(i => {
      const c = el('button', { class: 'card', 'data-i': i, draggable: 'true' }, w.cards[i].text);
      c.addEventListener('click', (e) => { if (c.classList.contains('ok')) return; e.stopPropagation(); select(c); });
      c.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text', i); c.classList.add('drag'); });
      c.addEventListener('dragend', () => c.classList.remove('drag'));
      // سحب باللمس
      c.addEventListener('touchstart', () => { if (!c.classList.contains('ok')) select(c); }, { passive: true });
      c.addEventListener('touchend', (e) => {
        if (c.classList.contains('ok')) return;
        const t = e.changedTouches[0]; const target = document.elementFromPoint(t.clientX, t.clientY);
        const be = target && target.closest('.bin'); if (be && bins.contains(be)) { e.preventDefault(); drop(c, [...bins.children].indexOf(be), be); }
      });
      pool.append(c);
    });
    return [pool, bins, msg];
  }
  function seqWidget(w, wid) {
    const list = el('ol', { class: 'seq' });
    const msg = el('div', { class: 'w-msg', role: 'status' });
    let order = shuffle(w.items.map((_, i) => i));
    if (order.every((v, i) => v === i)) order.reverse();
    let selI = -1;
    const draw = () => {
      list.replaceChildren(...order.map((it, pos) => {
        const li = el('li', { class: pos === selI ? 'sel' : '', draggable: 'true' },
          el('span', {}, w.items[it]),
          el('button', { 'aria-label': 'إلى الأعلى', onclick: () => move(pos, -1) }, '▲'),
          el('button', { 'aria-label': 'إلى الأسفل', onclick: () => move(pos, 1) }, '▼'));
        li.addEventListener('dragstart', (e) => e.dataTransfer.setData('text', pos));
        li.addEventListener('dragover', (e) => e.preventDefault());
        li.addEventListener('drop', (e) => { e.preventDefault(); const from = +e.dataTransfer.getData('text'); const [x] = order.splice(from, 1); order.splice(pos, 0, x); draw(); });
        return li;
      }));
    };
    const move = (pos, d) => { const to = pos + d; if (to < 0 || to >= order.length) return; [order[pos], order[to]] = [order[to], order[pos]]; selI = to; tone('tick'); draw(); list.children[to].querySelectorAll('button')[d < 0 ? 0 : 1].focus(); };
    draw();
    const check = el('button', { class: 'btn primary small', onclick: () => {
      let right = 0;
      [...list.children].forEach((li, pos) => { const ok = order[pos] === pos; li.classList.toggle('ok', ok); li.classList.toggle('bad', !ok); if (ok) right++; });
      if (right === order.length) { msg.className = 'w-msg ok'; msg.textContent = '✓ ترتيب صحيح كامل!'; widgetWon(wid); }
      else { tone('bad'); msg.className = 'w-msg bad'; msg.textContent = AR(right) + ' من ' + AR(order.length) + ' في موضعها الصحيح. حرّك الحمراء وأعد التحقق.'; }
    } }, 'تحقق من الترتيب');
    return [list, check, msg];
  }
  function financeWidget(w) {
    const fmt = (n) => (n < 0 ? '−' : '') + AR(Math.abs(Math.round(n)).toLocaleString('en-US'));
    const range = el('input', { type: 'range', min: '-40', max: '40', step: '5', value: '20', 'aria-label': 'نتيجة المشروع (نسبة الربح أو الخسارة)' });
    const out = el('output');
    const grid = el('div', { class: 'fin-grid' });
    const row = (label, v) => {
      const pct = Math.max(-50, Math.min(50, v / w.capital * 125));
      return [el('div', { class: 'fin-row' }, el('span', {}, label), el('span', { class: 'num ' + (v < 0 ? 'neg' : v > 0 ? 'pos' : '') }, fmt(v))),
        el('div', { class: 'fin-bar' }, el('i', { class: v < 0 ? 'neg' : '', style: v >= 0 ? 'right:50%;width:' + pct + '%' : 'right:' + (50 + pct) + '%;width:' + (-pct) + '%' }))];
    };
    const draw = () => {
      const r = +range.value, profit = w.capital * r / 100;
      out.textContent = (r > 0 ? 'ربح ' : r < 0 ? 'خسارة ' : 'تعادل ') + AR(Math.abs(r)) + '٪';
      out.style.background = r < 0 ? 'var(--bad-bg)' : r > 0 ? 'var(--ok-bg)' : 'var(--line)';
      // إسلامي (مضاربة): ربح يقسم بالنسبة، وخسارة مالية على رب المال ويخسر العامل جهده
      const isFin = profit > 0 ? profit * w.share / 100 : profit;
      const isWork = profit > 0 ? profit * (100 - w.share) / 100 : 0;
      // وضعي: المقرض يأخذ الفائدة دائمًا، والمقترض يتحمل الباقي
      const interest = w.capital * w.rate / 100;
      const conLend = interest, conBorrow = profit - interest;
      grid.replaceChildren(
        el('div', { class: 'fin-col' }, el('h5', {}, 'التمويل الإسلامي (مضاربة)'), ...row('الممول (رب المال)', isFin), ...row('المستثمر (العامل)', isWork),
          el('div', { class: 'muted' }, profit < 0 ? 'الخسارة لا ينفرد بها المستثمر: المال على الممول، والمستثمر يخسر جهده وعمله.' : profit > 0 ? 'الربح يُقسم بينهما بحسب النسبة المتفق عليها.' : 'لا ربح ولا خسارة.')),
        el('div', { class: 'fin-col' }, el('h5', {}, 'التمويل الوضعي (قرض بفائدة ' + AR(w.rate) + '٪)'), ...row('المقرض', conLend), ...row('المقترض', conBorrow),
          el('div', { class: 'muted' }, 'المقرض يحصل على الفائدة في كل الأحوال، والمقترض يتحمل المخاطر وحده.'))
      );
    };
    range.addEventListener('input', () => { draw(); tone('tick'); });
    draw();
    return [el('div', { class: 'fin-ctrl' }, el('span', {}, 'نتيجة المشروع:'), range, out), grid, el('p', { class: 'fin-note' }, w.note)];
  }

  /* ---------- الاختبار التشخيصي ---------- */
  function startPretest(cid) {
    const c = chapters.find(x => x.id === cid);
    let i = 0; const got = {};
    trackChapter(cid);
    const step = () => {
      if (i >= c.pretest.length) {
        S.pretestDone[cid] = true;
        const good = Object.keys(got).filter(k => got[k]);
        good.forEach(lid => { S.pre[lid] = true; });
        save(); syncWorld();
        openSheet(c.title, 'نتيجة التشخيص', [
          el('p', {}, 'أجبت صحيحًا عن ' + AR(good.length) + ' من ' + AR(c.pretest.length) + '.'),
          good.length ? el('p', {}, 'هذه الدروس موسومة «متقن مبدئيًا»، ويمكنك تجاوزها (وتبقى مفتوحة): ', el('b', {}, good.map(id => lessonById[id].title).join('، '))) : null,
          el('p', {}, 'ابدأ بالدروس التي لم تُتقنها:'),
          el('div', { class: 'row' }, c.lessons.filter(l => !S.pre[l.id]).map(l => el('button', { class: 'btn small', onclick: () => openLesson(l.id) }, l.title)),
            el('button', { class: 'btn small gold', onclick: () => startQuiz(cid) }, 'إلى جلسة المجلس'))
        ]);
        return;
      }
      const q = c.pretest[i];
      const prog = el('div', { class: 'qprog' }, el('i', { style: 'width:' + (i / c.pretest.length * 100) + '%' }));
      const next = el('button', { class: 'btn primary small', hidden: true, onclick: () => { i++; step(); } }, i < c.pretest.length - 1 ? 'التالي ←' : 'النتيجة');
      const box = questionBox(q, { kicker: 'تشخيص ' + AR(i + 1) + ' من ' + AR(c.pretest.length), back: false, onDone: (ok) => { got[q.lesson] = ok && got[q.lesson] !== false; if (!ok) got[q.lesson] = false; next.hidden = false; next.focus(); } });
      openSheet(c.title + ' · اختبار تشخيصي (يمكن تخطيه)', 'ماذا تعرف قبل أن تبدأ؟', [prog, box, el('div', { class: 'lesson-nav' }, el('button', { class: 'btn small', onclick: showMap }, 'تخطَّ التشخيص'), next)]);
    };
    step();
  }

  /* ---------- جلسة المجلس ---------- */
  let quizTimer = false;
  function startQuiz(cid) {
    const c = chapters.find(x => x.id === cid); const ci = chapters.indexOf(c);
    if (!isUnlocked(ci)) { toast('هذه الخطة مغلقة بعد.'); return; }
    trackChapter(cid);
    const qs = shuffle(c.quiz.map((q, i) => ({ q, key: cid + ':q' + i })));
    let i = 0, right = 0;
    const intro = () => {
      const tchk = el('input', { type: 'checkbox', id: 'qtimer' }); tchk.checked = quizTimer;
      tchk.addEventListener('change', () => { quizTimer = tchk.checked; });
      openSheet(c.title, 'جلسة المجلس', [
        el('p', {}, AR(qs.length) + ' أسئلة من ملفات الخطة يطرحها مجلس الشؤون الاقتصادية والتنمية، والخيارات مخلوطة في كل محاولة. النجاح بـ', el('b', {}, '٨٠٪'), ' يفتح الحي التالي، والإعادة غير محدودة.'),
        S.scores[cid] != null ? el('p', { class: 'muted' }, 'أفضل نتيجة سابقة: ' + AR(S.scores[cid]) + '٪') : null,
        el('label', { class: 'check' }, tchk, 'جلسة عاجلة: مؤقت ٤٥ ثانية لكل سؤال'),
        el('div', { class: 'row' }, el('button', { class: 'btn primary', onclick: step }, 'ابدأ'),
          !S.pretestDone[cid] ? el('button', { class: 'btn', onclick: () => startPretest(cid) }, 'اختبار تشخيصي أولًا') : null)
      ]);
    };
    const step = () => {
      if (i >= qs.length) return result();
      const { q, key } = qs[i];
      const prog = el('div', { class: 'qprog' }, el('i', { style: 'width:' + (i / qs.length * 100) + '%' }));
      const next = el('button', { class: 'btn primary', hidden: true, onclick: () => { i++; step(); } }, i < qs.length - 1 ? 'السؤال التالي ←' : 'النتيجة');
      const box = questionBox(q, { kicker: 'سؤال ' + AR(i + 1) + ' من ' + AR(qs.length) + ' · ' + (q.bloom || ''), key, timer: quizTimer ? 45 : 0,
        onDone: (ok) => { if (ok) { right++; addXP(10); } hook('councilAnswer', { ok, cid }); next.hidden = false; next.focus({ preventScroll: true }); } });
      currentView = () => { // عودة من الدرس إلى نفس النقطة
        openSheet(c.title + ' · جلسة المجلس', 'سؤال ' + AR(i + 1), [prog, el('p', { class: 'muted' }, 'تابع من حيث توقفت:'), el('div', { class: 'lesson-nav' }, el('span'), el('button', { class: 'btn primary', onclick: () => { i++; step(); } }, i < qs.length - 1 ? 'السؤال التالي ←' : 'النتيجة'))]);
      };
      openSheet(c.title + ' · جلسة المجلس', 'سؤال ' + AR(i + 1), [prog, box, el('div', { class: 'lesson-nav' }, el('span', { class: 'muted' }, 'الصحيح حتى الآن: ' + AR(right)), next)]);
    };
    const result = () => {
      const pct = Math.round(right / qs.length * 100);
      S.scores[cid] = Math.max(S.scores[cid] || 0, pct);
      const pass = pct >= 80, firstPass = pass && !S.passed[cid];
      if (pass) S.passed[cid] = true;
      save(); syncWorld();
      if (firstPass) { addXP(50, 'أقرّ المجلس ' + c.title); tone('win'); }
      hook('council', { cid, pct, pass, firstPass });
      const nextC = chapters[ci + 1];
      const all = chapters.every(x => S.passed[x.id]);
      if (all && !S.finished) { S.finished = today(); save(); }
      openSheet(c.title, pass ? 'نجحت! 🎉' : 'لم تبلغ عتبة الإتقان بعد', [
        el('div', { class: 'rep-grid' }, el('div', { class: 'kpi' }, el('small', {}, 'نتيجتك'), el('b', {}, AR(pct) + '٪')), el('div', { class: 'kpi' }, el('small', {}, 'الصحيح'), el('b', {}, AR(right) + ' / ' + AR(qs.length))), el('div', { class: 'kpi' }, el('small', {}, 'العتبة'), el('b', {}, '٨٠٪'))),
        pass ? el('p', {}, nextC ? 'فُتح ' + nextC.title + '. ' : 'أتممت الخطط الخمس كلها! ', all ? el('b', {}, 'شهادتك جاهزة.') : null)
          : el('p', {}, 'الأسئلة التي أخطأت فيها دخلت «مراجعة اليوم». راجع دروسها ثم أعد المحاولة؛ الخيارات تُخلط من جديد.'),
        el('div', { class: 'row' },
          !pass ? el('button', { class: 'btn primary', onclick: () => startQuiz(cid) }, 'أعد الاختبار') : null,
          pass && nextC ? el('button', { class: 'btn primary', onclick: () => { closeSheet(); } }, 'إلى الخطة التالية ←') : null,
          all ? el('button', { class: 'btn gold', onclick: showCert }, '🏅 الشهادة') : null,
          el('button', { class: 'btn', onclick: showMap }, '🗺️ الخريطة'))
      ]);
    };
    intro();
  }

  /* ---------- مراجعة اليوم ---------- */
  function showReview() {
    const due = shuffle(dueReview());
    if (!due.length) {
      openSheet('مراجعة اليوم', 'لا شيء للمراجعة الآن', [el('p', {}, 'كل سؤال تخطئ فيه يدخل صندوق المراجعة، ويبقى حتى تجيبه صحيحًا مرتين في يومين مختلفين.'),
        Object.keys(S.leitner).length ? el('p', { class: 'muted' }, 'في الصناديق ' + AR(Object.keys(S.leitner).length) + ' سؤالًا أجبتها اليوم؛ تعود غدًا.') : null,
        el('button', { class: 'btn', onclick: showMap }, '🗺️ الخريطة')]);
      return;
    }
    let i = 0, right = 0;
    const step = () => {
      if (i >= due.length) { openSheet('مراجعة اليوم', 'انتهت المراجعة', [el('p', {}, 'أجبت صحيحًا عن ' + AR(right) + ' من ' + AR(due.length) + '. ما أجبته صحيحًا اليوم يعود مرة أخرى في يوم آخر ليثبت.'), el('button', { class: 'btn', onclick: showMap }, '🗺️ الخريطة')]); renderHUD(); return; }
      const key = due[i], q = allQuestions[key], it = S.leitner[key] || { box: 1 };
      const next = el('button', { class: 'btn primary', hidden: true, onclick: () => { i++; step(); } }, 'التالي ←');
      const box = questionBox(q, { kicker: 'صندوق ' + AR(it.box) + ' · ' + (lessonById[q.lesson] ? lessonById[q.lesson].title : ''), key, onDone: (ok) => { if (ok) { right++; addXP(5); } next.hidden = false; renderHUD(); } });
      currentView = () => { openSheet('مراجعة اليوم', 'تابع المراجعة', [el('button', { class: 'btn primary', onclick: () => { i++; step(); } }, 'التالي ←')]); };
      openSheet('مراجعة اليوم · ' + AR(i + 1) + ' من ' + AR(due.length), 'صندوق المراجعة الذكية', [box, el('div', { class: 'lesson-nav' }, el('span'), next)]);
    };
    step();
  }

  /* ---------- الخريطة ---------- */
  function showMap() {
    trackChapter(null);
    const no3d = document.body.classList.contains('no3d');
    const free = el('input', { type: 'checkbox' }); free.checked = S.free;
    free.addEventListener('change', () => { S.free = free.checked; save(); syncWorld(); showMap(); });
    const done = Object.keys(S.quick).length, total = Object.keys(lessonById).length;
    const nodes = [
      el('div', { class: 'map-intro' },
        el('div', {}, el('b', {}, 'تقدمك: '), AR(done) + ' من ' + AR(total) + ' درسًا، و' + AR(Object.keys(S.passed).length) + ' من ٥ خطط'),
        el('label', { class: 'check' }, free, 'مراجعة حرة (كل الخطط مفتوحة)')),
      no3d ? el('p', { class: 'muted' }, 'تعمل اللعبة الآن بواجهة الخريطة لأن المتصفح لم يشغّل الرسم ثلاثي الأبعاد؛ كل الدروس والاختبارات متاحة كاملة.') : null
    ];
    const grid = el('div', { class: 'dgrid' });
    chapters.forEach((c, ci) => {
      const open = isUnlocked(ci);
      const nDone = c.lessons.filter(l => S.quick[l.id]).length;
      const card = el('article', { class: 'dcard' + (open ? '' : ' locked'), style: '--dc:' + c.color },
        el('div', { class: 'dcard-h' }, el('div', { class: 'dnum' }, AR(ci + 1)),
          el('div', {}, el('h3', {}, c.title + ' ', S.passed[c.id] ? el('span', { class: 'badge pass' }, '✓ ' + AR(S.scores[c.id]) + '٪') : !open ? el('span', { class: 'badge lock' }, '🔒 مغلق') : null),
            el('p', {}, c.subtitle)),
          el('div', { class: 'dstat' }, el('b', {}, AR(nDone) + '/' + AR(c.lessons.length)), 'دروس')),
        el('ul', { class: 'llist' }, c.lessons.map(l => el('li', {},
          el('span', { class: 'st ' + (S.quick[l.id] ? 'done' : S.pre[l.id] ? 'pre' : ''), 'aria-hidden': 'true' }, S.quick[l.id] ? '✓' : S.pre[l.id] ? '★' : ''),
          el('button', { class: 'lk', onclick: () => openLesson(l.id), disabled: !open }, l.title + ' ', el('span', { class: 'pref' }, 'ص' + AR(l.page))))),
        ),
        el('div', { class: 'dacts' },
          el('button', { class: 'btn small', disabled: !open, onclick: () => startPretest(c.id) }, S.pretestDone[c.id] ? 'أعد التشخيص' : 'اختبار تشخيصي'),
          el('button', { class: 'btn small gold', disabled: !open, onclick: () => startQuiz(c.id) }, 'جلسة المجلس'),
          null));
      grid.append(card);
    });
    nodes.push(grid);
    nodes.push(el('div', { class: 'lesson-nav' },
      el('button', { class: 'btn small', onclick: showSummary }, '📌 الخلاصة'),
      el('button', { class: 'btn small', onclick: showReport }, '📊 تقريري'),
      el('button', { class: 'btn small', onclick: showCert }, '🏅 الشهادة'),
      el('button', { class: 'btn small', onclick: () => askTeacher() }, '👩‍🏫 وضع المعلم')));
    currentView = showMap;
    openSheet('أرشيف الملفات', C.meta.subject, nodes, { home: no3d });
  }

  function showSummary() {
    openSheet('الخلاصة الختامية', 'أهم ما في المقرر', [el('ol', { class: 'b-list' }, C.summary.map(s => el('li', {}, s))),
      el('div', { class: 'b-rule' }, el('span', { class: 'tag' }, 'الخاتمة (ص٢٥)'), el('p', {}, lessonById.c5l5.blocks[lessonById.c5l5.blocks.length - 1].text)),
      el('button', { class: 'btn', onclick: showMap }, '🗺️ الخريطة')]);
  }

  /* ---------- التقرير ---------- */
  function reportText() {
    const lines = ['تقرير «وزير التخطيط» — ' + C.meta.subject, 'الطالب: ' + (S.name || 'بلا اسم'), 'المرحلة: ' + C.ranks[rankOf(S.xp)] + ' (' + S.xp + ' خبرة)', 'الدروس المتمة: ' + Object.keys(S.quick).length + '/' + Object.keys(lessonById).length];
    chapters.forEach(c => lines.push('• ' + c.title + ': ' + (S.scores[c.id] != null ? S.scores[c.id] + '٪' : 'لم يُختبر') + (S.passed[c.id] ? ' ✓' : '') + ' — ' + Math.round((S.time[c.id] || 0) / 60) + ' د'));
    const weak = weakest();
    if (weak.length) lines.push('أضعف الدروس: ' + weak.map(([id, n]) => lessonById[id].title + ' (' + n + ' أخطاء)').join('، '));
    lines.push('التاريخ: ' + today());
    return lines.join('\n');
  }
  const weakest = () => Object.entries(S.wrong).filter(([id]) => lessonById[id]).sort((a, b) => b[1] - a[1]).slice(0, 3);
  function showReport() {
    trackChapter(curChapter);
    const nameIn = el('input', { type: 'text', value: S.name, maxlength: '40' });
    nameIn.addEventListener('change', () => { S.name = nameIn.value.trim(); save(); });
    const weak = weakest();
    const copyBtn = el('button', { class: 'btn primary small', onclick: async () => {
      try { await navigator.clipboard.writeText(reportText()); toast('نُسخ التقرير؛ الصقه في واتساب لمعلمك.'); } catch (e) { pre.hidden = false; toast('لم يُسمح بالنسخ؛ انسخ النص الظاهر يدويًا.'); }
    } }, '📋 انسخ التقرير نصًّا');
    const pre = el('pre', { class: 'cov', hidden: true }, reportText());
    openSheet('تقرير الطالب', 'تقريري', [
      el('label', { class: 'field noprint' }, 'الاسم', nameIn),
      el('div', { class: 'rep-grid' },
        el('div', { class: 'kpi' }, el('small', {}, 'المرحلة'), el('b', { style: 'font-size:var(--t-md)' }, C.ranks[rankOf(S.xp)])),
        el('div', { class: 'kpi' }, el('small', {}, 'الخبرة'), el('b', {}, AR(S.xp))),
        el('div', { class: 'kpi' }, el('small', {}, 'الدروس'), el('b', {}, AR(Object.keys(S.quick).length) + '/' + AR(Object.keys(lessonById).length))),
        el('div', { class: 'kpi' }, el('small', {}, 'أطول سلسلة'), el('b', {}, AR(S.best)))),
      el('div', { class: 'tbl-wrap' }, el('table', {}, el('thead', {}, el('tr', {}, ['الخطة', 'تقييم المجلس', 'الحالة', 'الوقت'].map(h => el('th', {}, h)))),
        el('tbody', {}, chapters.map(c => el('tr', {}, el('td', {}, c.title), el('td', {}, S.scores[c.id] != null ? AR(S.scores[c.id]) + '٪' : '—'),
          el('td', {}, S.passed[c.id] ? '✓ متقن' : isUnlocked(chapters.indexOf(c)) ? 'مفتوح' : 'مغلق'), el('td', {}, AR(Math.round((S.time[c.id] || 0) / 60)) + ' دقيقة')))))),
      el('h4', {}, 'أضعف ثلاثة دروس بحسب أخطائك'),
      weak.length ? el('ol', {}, weak.map(([id, n]) => el('li', {}, el('button', { class: 'btn small', onclick: () => openLesson(id) }, lessonById[id].title), ' — ' + AR(n) + ' أخطاء'))) : el('p', { class: 'muted' }, 'لا أخطاء مسجلة بعد.'),
      el('div', { class: 'row noprint' }, copyBtn, el('button', { class: 'btn small', onclick: () => { try { window.print(); } catch (e) { toast('الطباعة غير متاحة هنا؛ استعمل النسخ.'); } } }, '🖨️ اطبع'),
        el('button', { class: 'btn small', onclick: showCert }, '🏅 الشهادة'), el('button', { class: 'btn small', onclick: showMap }, '🗺️ الخريطة')),
      pre,
      el('p', { class: 'muted' }, storageOk ? 'يُحفظ تقدمك في هذا المتصفح فقط، ولا يُرسل إلى أي خادم.' : 'الحفظ غير متاح في هذا المتصفح (تصفح خاص؟)؛ سيضيع التقدم عند إغلاق الصفحة.')
    ]);
  }

  /* ---------- الشهادة ---------- */
  function certCode(name, score, date) {
    let h = 2166136261; const s = (name || '').trim() + '|' + score + '|' + date + '|tanmiya';
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0).toString(36).toUpperCase().padStart(7, '0').slice(0, 7);
  }
  const avgScore = () => Math.round(chapters.reduce((a, c) => a + (S.scores[c.id] || 0), 0) / chapters.length);
  function showCert() {
    const all = chapters.every(c => S.passed[c.id]);
    if (!all) {
      openSheet('الشهادة', 'لم تكتمل بعد', [el('p', {}, 'تُمنح الشهادة بعد النجاح بـ٨٠٪ في جلسات المجلس الخمس. أنجزت ' + AR(Object.keys(S.passed).length) + ' من ٥.'),
        el('button', { class: 'btn', onclick: showMap }, '🗺️ الخريطة')]);
      return;
    }
    if (!S.name) { showReport(); toast('اكتب اسمك أولًا ليظهر في الشهادة.'); return; }
    const sc = avgScore(), d = S.finished || today();
    tone('win');
    openSheet('الشهادة', 'شهادة إتمام', [
      el('div', { class: 'cert' },
        el('div', { class: 'start-emblem', 'aria-hidden': 'true' }),
        el('p', {}, 'تشهد «وزير التخطيط» أن'),
        el('div', { class: 'nm' }, S.name),
        el('p', {}, 'أتمّ مراجعة مقرر'), el('h3', {}, C.meta.subject),
        el('p', {}, 'بمتوسط ', el('b', {}, AR(sc) + '٪'), ' في جلسات المجلس الخمس، وبلغ مرحلة «' + C.ranks[rankOf(S.xp)] + '».'),
        el('p', { class: 'muted' }, 'التاريخ: ' + d + ' — رمز التحقق: ', el('span', { class: 'code' }, certCode(S.name, sc, d))),
        el('p', { class: 'muted' }, 'المصدر: ' + C.meta.source)),
      el('div', { class: 'row noprint' }, el('button', { class: 'btn small', onclick: () => { try { window.print(); } catch (e) { toast('الطباعة غير متاحة هنا.'); } } }, '🖨️ اطبع'),
        el('button', { class: 'btn small', onclick: showReport }, '📊 التقرير'))
    ]);
  }

  /* ---------- وضع المعلم ---------- */
  const PIN = '0000';
  function askTeacher() {
    if (S.teacher) return showTeacher();
    const pin = el('input', { type: 'password', inputmode: 'numeric', maxlength: '8', autocomplete: 'off' });
    const go = () => { if (pin.value === PIN) { S.teacher = true; save(); syncWorld(); showTeacher(); } else { tone('bad'); toast('رمز غير صحيح'); } };
    pin.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
    openSheet('وضع المعلم', 'أدخل رمز المعلم', [el('label', { class: 'field' }, 'الرمز', pin), el('button', { class: 'btn primary', onclick: go }, 'دخول')]);
    setTimeout(() => pin.focus(), 60);
  }
  function showTeacher() {
    const pres = el('input', { type: 'checkbox' }); pres.checked = document.body.classList.contains('present');
    pres.addEventListener('change', () => { document.body.classList.toggle('present', pres.checked); });
    const vName = el('input', { type: 'text' }), vScore = el('input', { type: 'number', min: '0', max: '100' }), vDate = el('input', { type: 'text', placeholder: '2026-11-22' }), vCode = el('input', { type: 'text' });
    const vOut = el('div', { class: 'w-msg' });
    const cov = el('pre', { class: 'cov' }, 'جارٍ تحميل تقرير المطابقة…');
    fetch('coverage.md').then(r => r.ok ? r.text() : Promise.reject()).then(t => { cov.textContent = t; }).catch(() => { cov.textContent = 'تقرير المطابقة (coverage.md) غير متاح في هذه النسخة.'; });
    openSheet('وضع المعلم', 'لوحة المعلم', [
      el('p', {}, 'كل الخطط مفتوحة في هذا الوضع. '),
      el('label', { class: 'check' }, pres, 'وضع العرض في القاعة: خط كبير، والتعليل يُخفى حتى تكشفه'),
      el('div', { class: 'row' }, el('button', { class: 'btn small', onclick: () => { S.teacher = false; save(); syncWorld(); document.body.classList.remove('present'); showMap(); } }, 'خروج من وضع المعلم'),
        el('button', { class: 'btn small', onclick: showMap }, '🗺️ الخريطة')),
      el('h4', {}, 'التحقق من شهادة'),
      el('div', { class: 'bins' }, el('label', { class: 'field' }, 'الاسم', vName), el('label', { class: 'field' }, 'المتوسط ٪', vScore), el('label', { class: 'field' }, 'التاريخ', vDate), el('label', { class: 'field' }, 'الرمز', vCode)),
      el('button', { class: 'btn small primary', onclick: () => { const ok = certCode(vName.value, +vScore.value, vDate.value.trim()) === vCode.value.trim().toUpperCase(); vOut.className = 'w-msg ' + (ok ? 'ok' : 'bad'); vOut.textContent = ok ? '✓ الشهادة صحيحة' : '✗ البيانات لا تطابق الرمز'; } }, 'تحقق'), vOut,
      el('h4', {}, 'مفتاح الإجابات'),
      ...chapters.map(c => el('details', { class: 'key' }, el('summary', {}, c.title),
        ...c.lessons.map(l => el('div', { class: 'keyq' }, el('div', {}, '[' + l.title + '] ' + l.quick.q), el('b', {}, '← ' + l.quick.options[l.quick.answer]), ' (ص' + AR(l.quick.page) + ')')),
        ...c.quiz.map((q, i) => el('div', { class: 'keyq' }, el('div', {}, AR(i + 1) + '. ' + q.q), el('b', {}, '← ' + q.options[q.answer]), ' (ص' + AR(q.page) + '، ' + (q.bloom || '') + ')')))),
      el('h4', {}, 'تقرير المطابقة مع المذكرة'), cov
    ]);
  }

  /* ---------- المساعدة ---------- */
  function showHelp() {
    openSheet('مساعدة', 'كيف ألعب؟', [
      el('ul', { class: 'b-list' },
        el('li', {}, 'تحرّك بالأسهم أو W A S D، واسحب بالفأرة لتدوير الكاميرا، والعجلة للتقريب. وعلى الجوال: العصا للحركة واسحب الشاشة للتدوير.'),
        el('li', {}, 'أنت وزير التخطيط في دولة ناشئة. كل خطة خمسية مرحلة من مراحل روستو، وفيها ملفات قرار مبنية على دروس المذكرة.'),
        el('li', {}, 'افتح الملف، واقرأ الإحاطة (نص المذكرة)، ثم اتخذ القرار. القرار الصحيح يبني منشأة ويحسّن المؤشرات، والخاطئ يكلّف الخزينة.'),
        el('li', {}, 'في كل خطة قرار كبير تختار فيه سياسة، ومهمة ميدانية، ثم جلسة المجلس: إن أقرّ خطتك بـ٨٠٪ انتقلت دولتك إلى المرحلة التالية.'),
        el('li', {}, 'اختصارات: M الأرشيف، R مراجعة اليوم، Esc إغلاق، والأرقام ١–٤ لاختيار الإجابة.')),
      el('p', { class: 'muted' }, 'المصدر: ' + C.meta.source),
      el('button', { class: 'btn', onclick: showMap }, '🗺️ الخريطة')]);
  }

  /* ---------- الأزرار والاختصارات ---------- */
  $('#b-map').onclick = showMap;
  $('#b-review').onclick = showReview;
  $('#b-report').onclick = showReport;
  $('#b-help').onclick = showHelp;
  $('#b-mute').onclick = () => { S.muted = !S.muted; save(); renderHUD(); };
  $('#b-fontup').onclick = () => { S.fs = Math.min(1.5, +(S.fs + .1).toFixed(2)); save(); renderHUD(); };
  $('#b-fontdn').onclick = () => { S.fs = Math.max(.85, +(S.fs - .1).toFixed(2)); save(); renderHUD(); };
  document.addEventListener('keydown', (e) => {
    if (e.target.matches('input,textarea')) return;
    if (e.key === 'Escape' && !modal.hidden) { closeSheet(); return; }
    if (!$('#start').hidden) return;
    if (!modal.hidden) return;
    if (e.key === 'm' || e.key === 'M' || e.key === 'ة') showMap();
    if (e.key === 'r' || e.key === 'R' || e.key === 'ق') showReview();
  });
  // حبس التركيز داخل النافذة
  modal.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    const f = [...modal.querySelectorAll('button:not([disabled]),input,[tabindex="0"],summary')].filter(x => x.offsetParent);
    if (!f.length) return;
    if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
  });

  /* ---------- البداية ---------- */
  function begin(toMap) {
    S.name = $('#in-name').value.trim() || S.name; S.free = $('#in-free').checked || S.free; S.started = true; save();
    $('#start').hidden = true; tone('open'); renderHUD(); syncWorld();
    hook('begin', {});
    if (toMap) showMap();
  }
  $('#in-name').value = S.name; $('#in-free').checked = S.free;
  $('#b-start').onclick = () => begin(false);
  $('#b-start-map').onclick = () => begin(true);
  $('#in-name').addEventListener('keydown', e => { if (e.key === 'Enter') begin(false); });
  if (S.started) { $('#b-start').textContent = 'تابع رحلتك'; }
  if ('ontouchstart' in window || navigator.maxTouchPoints > 0) document.body.classList.add('touch');
  if (location.hash === '#teacher') { $('#start').hidden = true; S.started = true; setTimeout(askTeacher, 50); }
  renderHUD();

  /* ---------- الواجهة البرمجية للمحاكاة ---------- */
  window.APP = {
    content: C, state: () => S, save, el, AR, tone, toast, addXP, today, shuffle,
    openSheet, closeSheet, openLesson, startQuiz, startPretest, showMap, showReport, showCert, showReview,
    isUnlocked, lessonById, chapters, renderHUD,
    modalOpen: () => !modal.hidden || !$('#start').hidden
  };
  hook('ready', {});
})();
