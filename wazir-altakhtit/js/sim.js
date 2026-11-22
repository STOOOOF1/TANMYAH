/* «وزير التخطيط»: محرك المحاكاة ومكتب الوزير
   المؤشرات أسماؤها من مقاييس التخلف في المذكرة (ص9–10)، وأرقامها افتراضية لأغراض اللعب. */
(function () {
  'use strict';
  const A = window.APP, C = A.content, el = A.el, AR = A.AR;
  const $ = (s) => document.querySelector(s);
  const S = A.state();

  /* ---------- المؤشرات ---------- */
  const IND = [
    { k: 'income', name: 'دخل الفرد', unit: '$', good: 1, fmt: v => AR(Math.round(v).toLocaleString('en-US')) + ' $', max: 12000 },
    { k: 'poverty', name: 'معدل الفقر', good: -1, fmt: v => AR(v.toFixed(1)) + '٪', max: 60 },
    { k: 'unemp', name: 'معدل البطالة', good: -1, fmt: v => AR(v.toFixed(1)) + '٪', max: 30 },
    { k: 'hdi', name: 'مؤشر التنمية البشرية', good: 1, fmt: v => AR(v.toFixed(3)), max: 1 },
    { k: 'corr', name: 'مؤشر الفساد', good: -1, fmt: v => AR(Math.round(v)) + ' / ١٠٠', max: 100 },
    { k: 'env', name: 'البيئة والموارد', good: 1, fmt: v => AR(Math.round(v)) + ' / ١٠٠', max: 100 },
    { k: 'treasury', name: 'الخزينة', good: 1, fmt: v => AR(Math.round(v)) + ' مليار', max: 200 }
  ];
  const START = { income: 950, poverty: 46, unemp: 21, hdi: .43, corr: 62, env: 68, treasury: 40 };
  const clamp = { poverty: [2, 70], unemp: [2, 40], hdi: [.2, .98], corr: [3, 100], env: [5, 100], treasury: [0, 999], income: [300, 99999] };

  if (!S.sim) S.sim = { ind: Object.assign({}, START), start: Object.assign({}, START), decided: {}, news: [], built: [], penal: {} };
  const M = S.sim;
  const save = () => A.save();

  /* ---------- أثر كل ملف (درس) ---------- */
  const FX = {
    c1l1: { b: 'school', fx: { hdi: .02 }, news: 'افتُتحت مدرسة لنشر المفاهيم الاقتصادية' },
    c1l2: { b: 'market', fx: { income: 120, poverty: -2 }, news: 'سوق جديد: نمو يصحبه تحسن في المعيشة' },
    c1l3: { b: 'clinic', fx: { poverty: -3, hdi: .01 }, news: 'مستوصف يخدم الفئات الأكثر احتياجًا' },
    c2l1: { b: 'workshop', fx: { unemp: -2, income: 100 }, news: 'ورشة ابتكار لرواد الأعمال' },
    c2l2: { b: 'power', fx: { income: 160, env: -3 }, news: 'محطة طاقة: دفعة للبنية التحتية' },
    c2l3: { b: 'factory', fx: { unemp: -2, income: 120, env: -2 }, news: 'مصنع جديد يشغّل الشباب' },
    c2l4: { b: 'university', fx: { hdi: .02 }, news: 'جامعة تدرّس نظريات التنمية' },
    c3l1: { b: 'park', fx: { env: 6, hdi: .01 }, news: 'حديقة عامة: تنمية مستدامة' },
    c3l2: { b: 'stats', fx: { corr: -4 }, news: 'مركز الإحصاء يقيس التخلف بعشرة مقاييس' },
    c3l3: { b: 'hospital', fx: { poverty: -3, hdi: .02 }, news: 'مستشفى: التعليم والصحة لتأهيل القوى العاملة' },
    c3l4: { b: 'mosque', fx: { poverty: -3, corr: -3 }, news: 'جامع ووقف يدعمان التكافل والعدالة' },
    c4l1: { b: 'company', fx: { income: 180, unemp: -2 }, news: 'تحسّن بيئة الأعمال والإنتاج' },
    c4l2: { b: 'bank', fx: { treasury: 10, income: 100 }, news: 'تعبئة المدخرات نحو أنشطة منتجة' },
    c4l3: { b: 'tower', fx: { treasury: 8, poverty: -2 }, news: 'برج أعمال بتمويل قائم على المشاركة' },
    c4l4: { b: 'house', fx: { unemp: -2, env: 2 }, news: 'الدولة والمواطن والمؤسسات يتقاسمون الأدوار' },
    c5l1: { b: 'ministry', fx: { corr: -4, treasury: 5 }, news: 'وزارة الاقتصاد والتخطيط تبدأ عملها' },
    c5l2: { b: 'hub', fx: { income: 150, unemp: -1 }, news: 'مركز نقل: تنسيق بين الجهات' },
    c5l3: { b: 'council', fx: { corr: -5 }, news: 'مجلس شورى للتخطيط' },
    c5l4: { b: 'port', fx: { income: 200, treasury: 6 }, news: 'ميناء: موازين سلعية للصادرات والواردات' },
    c5l5: { b: 'solar', fx: { env: 6, hdi: .02 }, news: 'حقل شمسي ضمن برامج تحقيق الرؤية' }
  };
  const WFX = { w_growth: 'house', w_goals: 'clinic', w_rostow: 'power', w_theories: 'university', w_devtypes: 'park', w_measures: 'stats',
    w_islam: 'mosque', w_finance: 'bank', w_actors: 'company', w_plantypes: 'ministry', w_stages: 'hub', w_saudi: 'tower' };
  const STAGE_UP = [['house', 'house', 'market'], ['factory', 'house', 'school'], ['hospital', 'house', 'tower'], ['tower', 'tower', 'company'], ['vision']];

  /* ---------- القرارات الكبرى (واحد لكل خطة) ---------- */
  const BIG = {
    c1: { title: 'بماذا تقيس نجاح خطتك؟', page: 2,
      brief: 'مستشاروك منقسمون: فريق يريد أن يُعلن النجاح بمجرد ارتفاع الأرقام، وفريق يريد مقياسًا أشمل. اختر معيار الخطة الخمسية الأولى.',
      options: [
        { t: 'بزيادة الناتج المحلي الإجمالي وحدها', fx: { income: 220 }, verdict: 'mid', why: 'هذا نمو لا تنمية: «النمو يركّز على الكم» (ص2). ارتفع الدخل، لكن الفقر لم يتحرك.' },
        { t: 'بتحسين المعيشة وعدالة التوزيع وجودة النمو واستدامته', fx: { income: 120, poverty: -5, hdi: .03 }, verdict: 'best', b: 'school', why: 'هذه التنمية: «تُعنى بجودة النمو واستدامته وعدالته» (ص2)، وتأخذ بعين الاعتبار العوامل الاجتماعية والبيئية.' },
        { t: 'بعدد المشروعات المنفذة مهما كانت', fx: { treasury: -8, env: -4 }, verdict: 'bad', why: 'لم تجعل المذكرة عدد المشروعات مقياسًا؛ المقاييس عندها مثل دخل الفرد ومعدل الفقر ومؤشر التنمية البشرية (ص9).' }
      ] },
    c2: { title: 'اختر النظرية التي تقود استراتيجيتك', page: 7, free: true,
      brief: 'لكل نظرية في جدول المقارنة (ص7) محرك ودور للدولة وسمة للنمو. لا خطأ هنا: اختيارك يحدد شكل نمو دولتك.',
      options: [
        { t: 'الدفع القوي (روسنستين – رودان)', fx: { income: 320, treasury: -18, env: -4 }, b: ['power', 'factory'], why: 'المحرك: الاستثمار المتزامن الكبير، ودور الدولة: تخطيط مركزي قوي، وسمة النمو: قفزات تنموية (ص7). قفزت مؤشراتك، لكن الخزينة تحمّلت دفعة ضخمة.' },
        { t: 'النمو المتوازن (نوركس)', fx: { income: 170, unemp: -3, poverty: -2, treasury: -9 }, b: ['farm', 'factory'], why: 'المحرك: نمو متزامن في القطاعات، ودور الدولة: منسق وموجه، وسمة النمو: مستقر ومنتظم (ص7). تحسن متوازن في الزراعة والصناعة.' },
        { t: 'النمو اللامتوازن (هيرشمان)', fx: { income: 240, unemp: -2, treasury: -6 }, b: ['factory', 'factory'], why: 'المحرك: قطاعات محركة للنمو، ودور الدولة: محفّز ومركّز، وسمة النمو: انتقائي وانتشاري (ص7). ركزت الموارد في قطاع ذي أثر مضاعف.' },
        { t: 'آدم سميث (الكلاسيكية)', fx: { income: 140, treasury: 6 }, b: ['market', 'company'], why: 'المحرك: حرية السوق وتراكم رأس المال، ودور الدولة: محدود (تنظيم وعدالة)، وسمة النمو: طبيعي تدريجي (ص7). وفّرت الخزينة، والنمو أبطأ.' }
      ] },
    c3: { title: 'ميزانية علاج التخلف: اختر وسيلتين', page: 10, pick: 2,
      brief: 'الميزانية تكفي وسيلتين فقط من وسائل معالجة التخلف الخمس (ص10). كل وسيلة تعالج جانبًا بعينه؛ اختر ما يحتاجه مؤشر دولتك الأضعف.',
      options: [
        { t: 'زيادة الإنتاج والاستثمار', fx: { income: 200, unemp: -2 }, b: 'factory', why: 'من خلال تطوير البنية التحتية والتقنيات (ص10).' },
        { t: 'تحسين مستوى المعيشة', fx: { poverty: -3, income: 80 }, b: 'house', why: 'برفع الدخل وتوفير الخدمات الاجتماعية (ص10).' },
        { t: 'التعليم والصحة', fx: { hdi: .03 }, b: 'hospital', why: 'لتأهيل القوى العاملة وتحسين جودة الحياة (ص10).' },
        { t: 'تحقيق العدالة الاجتماعية', fx: { poverty: -4 }, b: 'mosque', why: 'بتوزيع الثروة وتقليل الفوارق (ص10).' },
        { t: 'تعزيز الاستقرار المؤسسي', fx: { corr: -8 }, b: 'stats', why: 'لمحاربة الفساد ورفع كفاءة الإدارة (ص10).' }
      ] },
    c4: { title: 'تمويل مشروع الميناء الكبير', page: 16, finance: true,
      brief: 'شركة وطنية تريد بناء ميناء بـ٢٠ مليارًا من الخزينة. ستُكشف نتيجة المشروع بعد قرارك، وقد يربح أو يخسر. اختر صيغة التمويل (ص16–17).',
      options: [
        { t: 'مضاربة: الخزينة ربّ المال والشركة تعمل، والربح بينهما بالنسبة', islamic: true },
        { t: 'قرض للشركة بفائدة ثابتة ١٠٪', islamic: false }
      ] },
    c5: { title: 'كيف تدير الخطة القادمة؟', page: 24,
      brief: 'أنهيت أربع خطط خمسية. مجلس الشؤون الاقتصادية والتنمية يسألك: كيف ستوجّه المرحلة التالية؟',
      options: [
        { t: 'نكمل بخطط خمسية يحرّكها الإنفاق العام الممول من النفط', fx: { income: 150, treasury: -10, env: -3 }, verdict: 'mid', b: 'hub', why: 'هذه المرحلة الأولى في التجربة السعودية: بنت البنية التحتية بأسلوب الموازين والإنفاق العام (ص24). نجحت في التأسيس، لكنها موجهة بالإنفاق.' },
        { t: 'تحوّل إلى تخطيط استراتيجي موجه بالأداء، يقاس بمؤشرات الأداء الرئيسية', fx: { income: 250, corr: -6, hdi: .03, treasury: 8 }, verdict: 'best', b: 'vision', why: 'هذا تحول الرؤية: «من التخطيط الموجه بالإنفاق إلى التخطيط الاستراتيجي الموجه بالأداء»، ويُقاس التقدم بمؤشرات الأداء الرئيسية (ص24–25).' },
        { t: 'نترك الأمور تمضي بلا خطة محددة', fx: { corr: 8, treasury: -12, unemp: 3 }, verdict: 'bad', why: 'التخطيط يوحّد الجهود ويقلل الهدر ويحسّن اتخاذ القرار (ص19)؛ وتركه هدر للموارد.' }
      ] }
  };

  /* ---------- أدوات ---------- */
  function apply(fx, src) {
    const deltas = [];
    for (const [k, v] of Object.entries(fx || {})) {
      const before = M.ind[k];
      let nv = before + v; const [lo, hi] = clamp[k] || [-1e9, 1e9]; nv = Math.max(lo, Math.min(hi, nv));
      M.ind[k] = nv; deltas.push([k, nv - before]);
    }
    save(); renderInds(deltas);
    return deltas;
  }
  function fxText(deltas) {
    return deltas.filter(([, d]) => Math.abs(d) > 1e-6).map(([k, d]) => {
      const I = IND.find(x => x.k === k); const good = (d > 0) === (I.good > 0);
      const v = k === 'hdi' ? Math.abs(d).toFixed(3) : k === 'income' || k === 'treasury' || k === 'corr' || k === 'env' ? Math.round(Math.abs(d)) : Math.abs(d).toFixed(1);
      return { good, t: I.name + ' ' + (d > 0 ? '▲' : '▼') + AR(v) };
    });
  }
  function news(txt, kind) {
    M.news.unshift({ t: txt, k: kind || 'info', d: Date.now() }); M.news = M.news.slice(0, 12); save(); renderNews();
  }
  function build(type) { if (!type) return; const n = ISO.build(type); if (n) { M.built.push(type); save(); } return n; }
  const stageIdx = () => C.chapters.filter(c => S.passed[c.id]).length;
  const curChapter = () => C.chapters.find(c => !S.passed[c.id]) || C.chapters[C.chapters.length - 1];

  /* ---------- الأحداث من طبقة التعلّم ---------- */
  const SIM = window.SIM = {
    on(evt, d) {
      if (evt === 'quick') {
        const f = FX[d.lesson]; if (!f) return;
        if (d.first) {
          const dl = apply(Object.assign({ treasury: -2 }, f.fx)); const n = build(f.b);
          news('✓ ' + f.news + (n ? ' (' + n + ')' : ''), 'good'); pulse(fxText(dl));
        } else if (!d.ok && !S.quick[d.lesson]) {
          const dl = apply({ treasury: -3, corr: 1 }); news('✗ قرار متعجل في «' + A.lessonById[d.lesson].title + '» كلّف الخزينة', 'bad'); pulse(fxText(dl));
        }
        renderAgenda();
      } else if (evt === 'widget' && d.first) {
        const n = build(WFX[d.wid]); apply({ hdi: .005, treasury: 2 }); if (n) news('🧪 مهمة ميدانية ناجحة: ' + n, 'good');
      } else if (evt === 'councilAnswer') {
        apply(d.ok ? { hdi: .003 } : { treasury: -1 });
      } else if (evt === 'council') {
        if (d.firstPass) stageUp(d.cid); else if (!d.pass) news('⚠ المجلس لم يُقرّ «' + chapterTitle(d.cid) + '» (' + AR(d.pct) + '٪). راجع الملفات وأعد العرض.', 'bad');
        renderAll();
      } else if (evt === 'sync') renderAll();
      else if (evt === 'closed') { renderAll(); if (innerWidth < 900) { const ap = $('#app'); ap.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); } }
      else if (evt === 'begin') { renderAll(); if (!M.welcomed) { M.welcomed = true; save(); setTimeout(intro, 300); } }
    }
  };
  const chapterTitle = (cid) => C.chapters.find(c => c.id === cid).title;

  function stageUp(cid) {
    const s = stageIdx();
    const inc = M.ind.income;
    apply({ income: Math.round(inc * .15 + 150), treasury: Math.round(inc / 60), poverty: -2, unemp: -1 });
    ISO.setStage(s); if (s >= 2) ISO.upgradeVillage(); ISO.setCars(2 + s * 2.5); ISO.setGreen(M.ind.env);
    const ci = C.chapters.findIndex(c => c.id === cid);
    (STAGE_UP[ci] || []).forEach(build);
    news('🏛️ أقرّ المجلس ' + chapterTitle(cid) + '. دولتك تدخل مرحلة «' + C.ranks[Math.min(4, s)] + '»', 'gold');
    celebrate();
  }

  /* ---------- القرار الكبير ---------- */
  function openBig(cid) {
    const B = BIG[cid], done = M.decided[cid];
    const nodes = [el('p', { class: 'big-brief' }, B.brief), el('span', { class: 'pref' }, 'المرجع: ص' + AR(B.page) + (B.finance ? '–١٧' : ''))];
    if (done != null) {
      nodes.push(el('div', { class: 'fb ok revealed' }, el('b', {}, 'اتخذت هذا القرار من قبل:'), el('div', {}, [].concat(done).map(i => B.options[i].t).join('، '))));
      A.openSheet('القرار الكبير', B.title, nodes); return;
    }
    if (B.finance) return openFinance(cid, nodes);
    const box = el('div', { class: 'opts big-opts' });
    const chosen = new Set();
    const go = el('button', { class: 'btn primary', hidden: !B.pick, disabled: true }, 'اعتمد القرار');
    B.options.forEach((o, i) => {
      const b = el('button', { class: 'opt' }, el('span', { class: 'k' }, ['أ', 'ب', 'ج', 'د', 'هـ'][i]), o.t);
      b.onclick = () => {
        if (B.pick) { if (chosen.has(i)) { chosen.delete(i); b.classList.remove('picked'); } else if (chosen.size < B.pick) { chosen.add(i); b.classList.add('picked'); } go.disabled = chosen.size !== B.pick; go.textContent = 'اعتمد القرار (' + AR(chosen.size) + '/' + AR(B.pick) + ')'; return; }
        decide(cid, [i]);
      };
      box.append(b);
    });
    go.onclick = () => decide(cid, [...chosen]);
    nodes.push(box, go);
    A.openSheet('القرار الكبير · ' + chapterTitle(cid), B.title, nodes);
  }
  function decide(cid, idxs) {
    const B = BIG[cid];
    M.decided[cid] = idxs.length === 1 ? idxs[0] : idxs; save();
    const out = [];
    let total = [];
    idxs.forEach(i => {
      const o = B.options[i];
      const dl = apply(o.fx); total = total.concat(dl);
      [].concat(o.b || []).forEach(build);
      out.push(el('div', { class: 'fb ' + (o.verdict === 'bad' ? 'bad' : 'ok') + ' revealed' },
        el('b', {}, (o.verdict === 'best' ? '✓ قرار موفق: ' : o.verdict === 'bad' ? '✗ قرار مكلف: ' : o.verdict === 'mid' ? '◐ قرار ناقص: ' : '◆ ') + o.t), el('div', {}, o.why)));
    });
    const best = B.options.findIndex(o => o.verdict === 'best');
    if (best >= 0 && !idxs.includes(best)) out.push(el('p', { class: 'muted' }, 'القرار الأوفق بحسب المذكرة: «' + B.options[best].t + '». ' + B.options[best].why));
    if (B.options.some(o => o.verdict === 'best') ? idxs.includes(best) : true) A.addXP(25, 'قرار كبير');
    A.tone(idxs.some(i => B.options[i].verdict === 'bad') ? 'bad' : 'win');
    out.push(effectChips(fxText(total)));
    out.push(el('div', { class: 'row' }, el('button', { class: 'btn primary', onclick: () => A.closeSheet() }, 'عد إلى المكتب')));
    news('⚖️ قرار كبير: ' + idxs.map(i => B.options[i].t).join(' + '), 'gold');
    A.openSheet('القرار الكبير · النتيجة', B.title, out);
    renderAll();
  }
  function openFinance(cid, nodes) {
    const B = BIG[cid];
    const box = el('div', { class: 'opts big-opts' });
    B.options.forEach((o, i) => box.append(el('button', { class: 'opt', onclick: () => resolveFinance(cid, i) }, el('span', { class: 'k' }, ['أ', 'ب'][i]), o.t)));
    nodes.push(box);
    A.openSheet('القرار الكبير · ' + chapterTitle(cid), B.title, nodes);
  }
  function resolveFinance(cid, i) {
    const B = BIG[cid], o = B.options[i];
    // نتيجة المشروع: تُحدد عشوائيًا ثم تُحفظ
    const win = Math.random() < .55; const r = win ? .3 : -.3; const cap = 20, res = cap * r; // ربح أو خسارة ٦ مليارات
    M.decided[cid] = i; M.portResult = r; save();
    let fx, story;
    if (o.islamic) {
      if (win) { fx = { treasury: res * .5, unemp: -2, income: 150 }; story = 'ربح الميناء ' + AR(Math.abs(res)) + ' مليارات، فاقتسمتها الخزينة والشركة بالنسبة المتفق عليها. المخاطر «يتقاسمها الممول والمستثمر معًا بعدالة» (ص17).'; }
      else { fx = { treasury: res, unemp: 0, income: 60 }; story = 'خسر الميناء ' + AR(Math.abs(res)) + ' مليارات. تحمّلت الخزينة (ربّ المال) الخسارة المالية، وخسرت الشركة جهدها، لكنها لم تُثقل بدَين؛ فبقيت تعمل ووظائفها قائمة. المخاطر مشتركة بين الأطراف (ص17).'; }
    } else {
      const interest = cap * .1;
      if (win) { fx = { treasury: interest, unemp: -1, income: 120 }; story = 'ربح الميناء، وأخذت الخزينة فائدتها الثابتة ' + AR(interest) + ' مليارين، وذهب باقي الربح للشركة.'; }
      else { fx = { treasury: interest, unemp: 3, poverty: 2 }; story = 'خسر الميناء، ومع ذلك أخذت الخزينة فائدتها ' + AR(interest) + ' مليارين: «يتحملها المقترض فقط، بينما يحصل المقرض على الفائدة في كل الأحوال» (ص17). أفلست الشركة وسرّحت عمالها.'; }
    }
    const dl = apply(fx); build('port');
    A.tone(o.islamic || win ? 'win' : 'bad');
    const nodes = [
      el('div', { class: 'coin ' + (win ? 'win' : 'loss') }, win ? '📈 المشروع ربح ٣٠٪' : '📉 المشروع خسر ٣٠٪'),
      el('div', { class: 'fb ' + (o.islamic || win ? 'ok' : 'bad') + ' revealed' }, el('b', {}, o.t), el('div', {}, story)),
      el('div', { class: 'b-note' }, 'هذه أرقام افتراضية في اللعبة. والفرق الذي تعلمه المذكرة: في التمويل الإسلامي «المال لا يجوز أن يدرّ مالًا بدون مخاطرة أو عمل» (ص16)، وفي الوضعي الفائدة ثمن استخدام رأس المال.'),
      effectChips(fxText(dl)),
      el('div', { class: 'row' }, el('button', { class: 'btn small', onclick: () => A.openLesson('c4l3') }, '📖 جدول المقارنة'), el('button', { class: 'btn primary', onclick: () => A.closeSheet() }, 'عد إلى المكتب'))
    ];
    A.addXP(25, 'قرار التمويل');
    news('⚓ ميناء بـ' + (o.islamic ? 'المضاربة' : 'قرض بفائدة') + ': ' + (win ? 'ربح' : 'خسارة'), win ? 'good' : 'bad');
    A.openSheet('القرار الكبير · النتيجة', B.title, nodes); renderAll();
  }
  function effectChips(list) {
    return el('div', { class: 'chips' }, list.map(x => el('span', { class: 'chip ' + (x.good ? 'up' : 'down') }, x.t)));
  }

  /* ---------- المكتب ---------- */
  let shownVals = {};
  function renderInds(deltas = []) {
    const box = $('#inds'); if (!box) return;
    const dmap = Object.fromEntries(deltas);
    box.replaceChildren(...IND.map(I => {
      const v = M.ind[I.k], s0 = M.start[I.k];
      const pct = Math.max(3, Math.min(100, (v / I.max) * 100));
      const better = I.good > 0 ? v >= s0 : v <= s0;
      const d = dmap[I.k];
      const card = el('div', { class: 'ind' + (d ? ((d > 0) === (I.good > 0) ? ' flash-up' : ' flash-down') : '') + (I.k === 'treasury' && v < 10 ? ' warn' : '') },
        el('div', { class: 'ind-top' }, el('span', {}, I.name), el('b', {}, I.fmt(v))),
        el('div', { class: 'ind-bar' }, el('i', { style: 'width:' + pct + '%;background:' + (better ? 'var(--ok)' : 'var(--bad)') })),
        d ? el('em', { class: 'ind-d ' + ((d > 0) === (I.good > 0) ? 'up' : 'down') }, (d > 0 ? '▲ ' : '▼ ') + (I.k === 'hdi' ? AR(Math.abs(d).toFixed(3)) : AR(Math.round(Math.abs(d) * 10) / 10))) : null);
      return card;
    }));
    ISO.setGreen(M.ind.env);
  }
  function renderAgenda() {
    const c = curChapter(), ci = C.chapters.indexOf(c), done = stageIdx() >= C.chapters.length;
    $('#plan-k').textContent = done ? 'اكتملت الخطط الخمس · ٢٥ عامًا' : 'الخطة الخمسية ' + ['الأولى', 'الثانية', 'الثالثة', 'الرابعة', 'الخامسة'][ci] + ' · الأعوام ' + AR(ci * 5 + 1) + '–' + AR(ci * 5 + 5);
    $('#plan-t').textContent = done ? 'دولتك في مرحلة الاستهلاك الجماهيري الواسع' : c.title.replace(/^الخطة \S+: /, '');
    $('#plan-stage').textContent = 'مرحلة روستو: ' + C.ranks[Math.min(4, stageIdx())];
    $('#plan-dots').replaceChildren(...C.chapters.map((x, i) => el('i', { class: S.passed[x.id] ? 'done' : i === ci && !done ? 'cur' : '' , title: x.title })));
    const list = $('#agenda'); list.replaceChildren();
    if (done) { list.append(el('li', { class: 'ag done' }, el('span', { class: 'ag-i' }, '🏅'), el('button', { class: 'ag-b', onclick: finale }, 'تقرير الدولة بعد ٢٥ عامًا'))); }
    else {
      c.lessons.forEach((l, i) => {
        const st = S.quick[l.id] ? 'done' : '';
        list.append(el('li', { class: 'ag ' + st }, el('span', { class: 'ag-i' }, S.quick[l.id] ? '✓' : AR(i + 1)),
          el('button', { class: 'ag-b', onclick: () => A.openLesson(l.id) }, el('span', {}, l.title), el('small', {}, (l.widget ? '🧪 فيه مهمة ميدانية · ' : '') + 'ص' + AR(l.page)))));
      });
      const bd = M.decided[c.id] != null;
      list.append(el('li', { class: 'ag big ' + (bd ? 'done' : '') }, el('span', { class: 'ag-i' }, bd ? '✓' : '⚖️'), el('button', { class: 'ag-b', onclick: () => openBig(c.id) }, el('span', {}, 'القرار الكبير: ' + BIG[c.id].title), el('small', {}, 'سياسة تغيّر مسار دولتك'))));
      list.append(el('li', { class: 'ag council' }, el('span', { class: 'ag-i' }, '🏛️'), el('button', { class: 'ag-b', onclick: () => A.startQuiz(c.id) }, el('span', {}, 'جلسة المجلس'), el('small', {}, S.scores[c.id] != null ? 'أفضل تقييم: ' + AR(S.scores[c.id]) + '٪ · العتبة ٨٠٪' : 'إقرار الخطة بـ٨٠٪ ينقل دولتك للمرحلة التالية'))));
    }
    // الزر الرئيس
    const cta = $('#cta');
    let next = null, label = '';
    if (done) { next = finale; label = '🏅 تقرير الدولة والشهادة'; }
    else {
      const l = c.lessons.find(x => !S.quick[x.id]);
      if (S.pretestDone[c.id] == null && !c.lessons.some(x => S.quick[x.id]) && ci > 0 && false) { next = () => A.startPretest(c.id); label = 'اختبار تشخيصي'; }
      else if (l) { next = () => A.openLesson(l.id); label = '📂 افتح الملف: ' + l.title; }
      else if (M.decided[c.id] == null) { next = () => openBig(c.id); label = '⚖️ القرار الكبير'; }
      else { next = () => A.startQuiz(c.id); label = '🏛️ اعرض الخطة على المجلس'; }
    }
    cta.textContent = label; cta.onclick = next;
    const tr = $('#ticker-stage'); if (tr) tr.textContent = C.ranks[Math.min(4, stageIdx())];
  }
  function renderNews() {
    const n = $('#news'); if (!n) return;
    n.replaceChildren(...M.news.slice(0, 4).map((x, i) => el('div', { class: 'nw ' + x.k + (i === 0 ? ' new' : '') }, x.t)));
  }
  function renderAll() { renderInds(); renderAgenda(); renderNews(); A.renderHUD(); $('#hud-rank').textContent = 'المرحلة: ' + C.ranks[Math.min(4, stageIdx())]; }

  function pulse(list) {
    const p = $('#pulse'); if (!p || !list.length) return;
    p.replaceChildren(...list.map(x => el('span', { class: 'chip ' + (x.good ? 'up' : 'down') }, x.t)));
    p.classList.remove('show'); void p.offsetWidth; p.classList.add('show');
  }
  function celebrate() {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const c = $('#confetti'); c.replaceChildren();
    for (let i = 0; i < 60; i++) c.append(el('i', { style: `left:${Math.random() * 100}%;background:${['#c9a43a', '#1b7a5a', '#e7cf86', '#fff'][i % 4]};animation-delay:${Math.random() * .5}s;transform:rotate(${Math.random() * 360}deg)` }));
    c.classList.remove('go'); void c.offsetWidth; c.classList.add('go');
  }

  function intro() {
    A.openSheet('مرسوم التعيين', 'مرحبًا معالي الوزير' + (S.name ? ' ' + S.name : ''), [
      el('p', {}, 'عُيّنت وزيرًا للتخطيط في دولة ناشئة ما زالت في مرحلة «المجتمع التقليدي»: اقتصاد زراعي بسيط، وفقر وبطالة مرتفعان.'),
      el('p', {}, 'مهمتك أن تنقلها خلال خمس خطط خمسية عبر مراحل النمو عند روستو. في كل خطة:'),
      el('ol', { class: 'b-list' },
        el('li', {}, el('b', {}, 'ملفات القرار: '), 'كل ملف إحاطة من المذكرة ثم قرار. القرار الصحيح يبني منشأة ويحسّن المؤشرات، والمتعجل يكلّف الخزينة.'),
        el('li', {}, el('b', {}, 'قرار كبير: '), 'سياسة تختارها فتغيّر مسار دولتك.'),
        el('li', {}, el('b', {}, 'جلسة المجلس: '), 'إن أقرّ المجلس خطتك بـ٨٠٪ دخلت دولتك المرحلة التالية.')),
      el('p', { class: 'muted' }, 'المؤشرات أسماؤها من مقاييس التخلف في المذكرة (ص9–10)، وأرقامها افتراضية للعب. أما الإحاطات والأسئلة فمن نص المذكرة.'),
      el('button', { class: 'btn primary', onclick: () => A.closeSheet() }, 'استلم المكتب')
    ]);
  }
  function finale() {
    const rows = IND.map(I => el('tr', {}, el('td', {}, I.name), el('td', {}, I.fmt(M.start[I.k])), el('td', {}, I.fmt(M.ind[I.k]))));
    A.openSheet('تقرير الدولة', 'دولتك بعد ٢٥ عامًا', [
      el('p', {}, 'انتقلت دولتك من «المجتمع التقليدي» إلى «' + C.ranks[4] + '»، وبُنيت فيها ' + AR(M.built.length) + ' منشأة.'),
      el('div', { class: 'tbl-wrap' }, el('table', {}, el('thead', {}, el('tr', {}, ['المؤشر', 'عند تعيينك', 'الآن'].map(h => el('th', {}, h)))), el('tbody', {}, rows))),
      el('div', { class: 'b-rule' }, el('span', { class: 'tag' }, 'الخاتمة (ص٢٥)'), el('p', {}, 'التنمية ليست هدفًا اقتصاديًا فحسب، بل مشروعًا إنسانيًا وحضاريًا يتكامل فيه الاقتصاد مع القيم، والعلم مع العدالة، لتحقيق حياة كريمة للإنسان.')),
      el('div', { class: 'row' }, el('button', { class: 'btn gold', onclick: A.showCert }, '🏅 الشهادة'), el('button', { class: 'btn', onclick: A.showReport }, '📊 تقريري'))
    ]);
  }

  /* ---------- التشغيل ---------- */
  ISO.init($('#iso'));
  // أعد بناء الدولة من الحفظ
  ISO.setStage(stageIdx()); if (stageIdx() >= 2) ISO.upgradeVillage(); ISO.setCars(stageIdx() ? 2 + stageIdx() * 2.5 : 0);
  M.built.forEach(t => ISO.build(t));
  renderAll();
  $('#b-start').addEventListener('click', () => {}, { once: true });
  SIM.BIG = BIG; SIM.FX = FX; SIM.M = M;
})();
