(() => {
  'use strict';
  const SAVE = 'wrdhound-save-v2', LEGACY_SAVE = 'wrdhound-save-v1', THEME = 'wrdhound-theme', TUTORIAL = 'wrdhound-tutorial-v1';
  const START_SCORE = 25, HINT_BASE = 5, SLACK = 5;
  let words = [], idx = new Map(), adj = [], giant = [], dist = new Int8Array(0), S = null, busy = false;

  /* ---------- graph core (pattern index + BFS, same idea as WRDLINK) ---------- */
  function buildGraph() {
    const source = window.WRDLINK_DICTIONARY;
    if (!source || typeof source[Symbol.iterator] !== 'function') throw new Error('Dictionary data is missing or unreadable.');
    words = [...new Set(source)].filter((w) => typeof w === 'string' && /^[A-Z]{4}$/.test(w)).sort();
    if (words.length < 4) throw new Error('The dictionary does not contain enough valid four letter words.');
    idx = new Map(words.map((w, i) => [w, i]));
    const buckets = new Map();
    words.forEach((w, i) => { for (let p = 0; p < 4; p++) { const k = w.slice(0, p) + '_' + w.slice(p + 1); (buckets.get(k) || buckets.set(k, []).get(k)).push(i); } });
    adj = words.map((w, i) => {
      const s = new Set();
      for (let p = 0; p < 4; p++) for (const j of buckets.get(w.slice(0, p) + '_' + w.slice(p + 1))) if (j !== i) s.add(j);
      return [...s].sort((a, b) => a - b); // ids follow alphabetical order, so this is the Hound's tie-break
    });
    const comp = new Int32Array(words.length).fill(-1); let best = [], c = 0;
    for (let i = 0; i < words.length; i++) {
      if (comp[i] >= 0) continue;
      const q = [i]; comp[i] = c;
      for (let h = 0; h < q.length; h++) for (const v of adj[q[h]]) if (comp[v] < 0) { comp[v] = c; q.push(v); }
      if (q.length > best.length) best = q; c++;
    }
    giant = best.filter((i) => adj[i].length >= 2);
    // All-pairs BFS distances (about 15 MB) so the Hound's moves and the solver are instant.
    const N = words.length, q = new Int32Array(N); dist = new Int8Array(N * N).fill(-1);
    for (let s0 = 0; s0 < N; s0++) {
      const base = s0 * N; let head = 0, tail = 0; q[tail++] = s0; dist[base + s0] = 0;
      while (head < tail) { const u = q[head++], du = dist[base + u] + 1; for (const v of adj[u]) if (dist[base + v] < 0) { dist[base + v] = du; q[tail++] = v; } }
    }
  }
  function distFrom(s) { return dist.subarray(s * words.length, (s + 1) * words.length); }
  // The Hound steps to the neighbour closest to you; ties go to the alphabetically first word.
  function houndStep(h, r) {
    if (h === r) return h;
    const d = distFrom(r); let best = h, bd = d[h];
    for (const n of adj[h]) if (d[n] < bd) { bd = d[n]; best = n; }
    return best;
  }
  const dangerous = (h, w) => w === h || adj[h].includes(w);
  function safeMoves(r, h, e) { return adj[r].filter((w) => w !== h && (w === e || !adj[h].includes(w))); }
  // Because the Hound is deterministic, the chase is a one-player search over (runner, hound) pairs.
  function solve(r0, h0, e, maxDepth = 16, cap = 45000) {
    const N = words.length, seen = new Map([[r0 * N + h0, -1]]); let frontier = [[r0, h0]];
    for (let depth = 1; depth <= maxDepth; depth++) {
      const next = [];
      for (const [r, h] of frontier) for (const r2 of adj[r]) {
        if (r2 === h) continue;
        if (r2 === e) { const path = [e]; let k = r * N + h; while (k !== -1) { path.push((k / N) | 0); k = seen.get(k); } return path.reverse(); }
        if (adj[h].includes(r2)) continue;
        const h2 = houndStep(h, r2), k = r2 * N + h2;
        if (!seen.has(k)) { seen.set(k, r * N + h); next.push([r2, h2]); }
      }
      if (!next.length || seen.size > cap) return null;
      frontier = next;
    }
    return null;
  }
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  function makePuzzle(level) {
    const tier = Math.floor(Math.max(0, level) / 2);
    const lo = 3 + Math.min(tier, 3), hi = 5 + Math.min(tier, 5);
    for (let t = 0; t < 90; t++) {
      const r = pick(giant), d = distFrom(r), ex = [], ho = [];
      for (const i of giant) { if (d[i] >= lo && d[i] <= hi) ex.push(i); if (d[i] >= 3 && d[i] <= 5) ho.push(i); }
      if (!ex.length || !ho.length) continue;
      const e = pick(ex), h = pick(ho); if (e === h) continue;
      const sol = solve(r, h, e); if (!sol) continue;
      const par = sol.length - 1, detour = par - distFrom(e)[r];
      if (par > 10 || par < 3) continue;
      if (t < 25 && level >= 2 && detour < 1) continue;
      return { r: words[r], h: words[h], e: words[e], par };
    }
    return null;
  }
  const budget = () => S.puzzle.par + Math.max(2, SLACK - Math.floor(S.level / 3));
  const hintCost = () => HINT_BASE + S.hints;

  if (typeof document === 'undefined') { window.WRDHOUND_CORE = { buildGraph, makePuzzle, solve, houndStep, distFrom, get words() { return words; }, idx: () => idx, adj: () => adj }; return; }

  /* ---------- UI helpers ---------- */
  const $ = (id) => document.getElementById(id);
  const tick = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 30)));
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const vt = (fn) => (document.startViewTransition && !reduced ? document.startViewTransition(fn) : fn());
  const buzz = (p) => { try { navigator.vibrate && navigator.vibrate(p); } catch (_) {} };
  function splash(pct, text) { $('splash-bar').style.width = pct + '%'; $('splash-text').textContent = text; }
  function tiles(el, word, flipAll) {
    const prev = el.dataset.w || ''; if (prev === word) return;
    el.replaceChildren(...[...word].map((c, i) => { const s = document.createElement('span'); s.textContent = c; if (flipAll || (prev && prev[i] !== c)) s.className = 'flip'; return s; }));
    el.dataset.w = word; el.setAttribute('aria-label', word);
  }
  function say(text, type) { const m = $('message'); m.textContent = text || ''; m.hidden = !text; m.className = 'game-message' + (type === 'error' ? ' error' : ''); }

  /* ---------- state ---------- */
  function fresh(level, score) {
    const p = makePuzzle(level); if (!p) return null;
    return { level, score, hints: 0, moves: 0, status: 'play', challenge: false, puzzle: p, runner: p.r, hound: p.h, exit: p.e, log: [{ y: p.r, h: p.h }] };
  }
  function save() { if (S && !S.challenge) try { localStorage.setItem(SAVE, JSON.stringify(S)); } catch (_) {} }
  function validSave(s) {
    try {
      if (!s || typeof s !== 'object' || !s.puzzle || typeof s.puzzle !== 'object') return false;
      const ok = (w) => typeof w === 'string' && idx.has(w);
      const p = s.puzzle;
      if (![p.r, p.h, p.e, s.runner, s.hound, s.exit].every(ok)) return false;
      if (new Set([p.r, p.h, p.e]).size !== 3 || p.e !== s.exit || !Number.isInteger(p.par) || p.par < 1 || p.par > 14) return false;
      if (!Number.isInteger(s.level) || s.level < 0 || !Number.isInteger(s.score) || s.score < 0) return false;
      if (!Number.isInteger(s.moves) || s.moves < 0 || !Number.isInteger(s.hints) || s.hints < 0 || s.hints > s.moves) return false;
      if (!['play', 'won', 'lost'].includes(s.status) || typeof s.challenge !== 'boolean') return false;
      if (!Array.isArray(s.log) || s.log.length !== s.moves + 1 || !s.log.length) return false;
      if (s.log.some((l) => !l || !ok(l.y) || !(l.h === null || ok(l.h)))) return false;
      if (s.log[0].y !== p.r || s.log[0].h !== p.h || s.log[s.log.length - 1].y !== s.runner) return false;
      const [ri, hi, ei] = [p.r, p.h, p.e].map((w) => idx.get(w));
      if (dangerous(hi, ri)) return false;
      const optimal = solve(ri, hi, ei);
      if (!optimal || optimal.length - 1 !== p.par) return false;
      let previousHound = hi;
      for (let i = 1; i < s.log.length; i++) {
        const current = s.log[i], previous = s.log[i - 1];
        const y = idx.get(current.y), priorY = idx.get(previous.y);
        if (!adj[priorY].includes(y)) return false;
        if (current.y === p.e) {
          if (i !== s.log.length - 1 || current.h !== null || s.status !== 'won') return false;
          continue;
        }
        if (dangerous(previousHound, y)) return false;
        const expectedHound = houndStep(previousHound, y);
        if (current.h !== words[expectedHound]) return false;
        previousHound = expectedHound;
      }
      if (s.status === 'won' && s.runner !== p.e) return false;
      if (s.status !== 'won' && s.runner === p.e) return false;
      if (s.status === 'play' && s.log[s.log.length - 1].h !== s.hound) return false;
      if (s.status !== 'won' && s.hound !== words[previousHound]) return false;
      if (s.status === 'lost' && !['time', 'cornered'].includes(s.why)) return false;
      if (s.status === 'play' && s.why) return false;
      return true;
    } catch (_) { return false; }
  }
  function challengeFromUrl() {
    const c = new URLSearchParams(location.search).get('c'); if (!c || c.length > 14) return null;
    const parts = c.toUpperCase().split('.');
    if (parts.length !== 3) return null;
    const [r, h, e] = parts; if (![r, h, e].every((w) => idx.has(w)) || new Set([r, h, e]).size !== 3) return null;
    const [ri, hi, ei] = [r, h, e].map((w) => idx.get(w)); if (dangerous(hi, ri)) return null;
    const sol = solve(ri, hi, ei); if (!sol) return null;
    const p = { r, h, e, par: sol.length - 1 };
    return { level: 0, score: START_SCORE, hints: 0, moves: 0, status: 'play', challenge: true, puzzle: p, runner: r, hound: h, exit: e, log: [{ y: r, h }] };
  }

  /* ---------- render ---------- */
  function render(animateLog = true) {
    const r = idx.get(S.runner), h = idx.get(S.hound), e = idx.get(S.exit);
    tiles($('you-word'), S.runner); tiles($('exit-word'), S.exit); tiles($('hound-word'), S.hound);
    $('level-label').textContent = S.challenge ? 'DUEL' : 'LV' + S.level;
    $('score-label').textContent = S.score; $('moves-label').textContent = S.moves;
    const dl = $('danger-list');
    if (dl.dataset.w !== S.hound) { dl.dataset.w = S.hound; dl.replaceChildren(...[0, 1, 2, 3].map((p) => { const li = document.createElement('li'); li.textContent = S.hound.slice(0, p) + '_' + S.hound.slice(p + 1); return li; })); }
    const dE = distFrom(e)[r], dH = distFrom(h)[r], start = distFrom(e)[idx.get(S.puzzle.r)] || 1;
    $('exit-dist').textContent = dE + (dE === 1 ? ' step' : ' steps');
    $('exit-bar').style.width = Math.max(4, Math.min(100, (1 - dE / Math.max(start, dE)) * 100 + 4)) + '%';
    $('gap-val').textContent = dH <= 1 ? 'ON YOU' : dH;
    $('sr-live').textContent = S.status === 'play'
      ? `You are on ${S.runner}. The exit is ${dE} ${dE === 1 ? 'step' : 'steps'} away. The Hound is ${dH} ${dH === 1 ? 'step' : 'steps'} away.`
      : S.status === 'won' ? `Escaped in ${S.moves} moves.` : 'The chase is over. You were caught.';
    const pips = $('gap-pips'); if (!pips.children.length) pips.replaceChildren(...Array.from({ length: 6 }, () => document.createElement('i')));
    [...pips.children].forEach((el, i) => { el.className = i < Math.min(dH, 6) ? 'on' + (dH <= 2 ? ' danger' : '') : ''; });
    $('hound-panel').classList.toggle('alert', dH <= 2);
    const left = Math.max(0, budget() - S.moves);
    $('moves-left').textContent = left; $('moves-bar').style.width = (left / budget()) * 100 + '%'; $('moves-bar').parentElement.classList.toggle('low', left <= 2);
    const list = $('chain-list');
    list.replaceChildren(...S.log.map((l, i) => {
      const li = document.createElement('li'); if (animateLog && i === S.log.length - 1) li.className = 'new';
      if (S.status === 'won' && i === S.log.length - 1) li.classList.add('chain-final');
      li.innerHTML = `<span>${String(i).padStart(2, '0')}</span><b>${l.y}</b><em>${l.h ? 'hound ' + l.h : ''}</em>`; return li;
    }));
    list.scrollTop = list.scrollHeight;
    const cost = hintCost(); $('hint-cost-chip').textContent = '−' + (cost + 1); $('hint-button').disabled = S.status !== 'play' || S.score < hintCost() + 1;
    const done = S.status !== 'play'; $('entry-panel').hidden = done; $('finish-panel').hidden = !done;
    if (done) renderFinish();
  }
  function renderFinish() {
    const won = S.status === 'won', fp = $('finish-panel'); fp.classList.toggle('lost', !won);
    $('finish-badge').textContent = won ? '✓' : '!';
    $('finish-title').textContent = won ? 'Escaped!' : S.why === 'time' ? 'Out of time' : 'Cornered!';
    $('finish-description').textContent = won
      ? `You reached ${S.exit} in ${S.moves} moves (par ${S.puzzle.par}). Level score: ${S.score}.${S.moves <= S.puzzle.par ? ' A perfect run.' : ''}`
      : S.why === 'time' ? 'The Hound caught up while you were still running. Try a tighter route.' : 'Every word you could reach sits in the Hound’s jaws. Try again from the start.';
    $('finish-primary').textContent = won ? (S.challenge ? 'PLAY CAMPAIGN' : 'NEXT LEVEL') : 'RETRY';
    $('finish-secondary').textContent = won ? 'SHARE RESULT' : 'NEW PUZZLE'; $('share-status').textContent = '';
  }

  /* ---------- gameplay ---------- */
  function apply(w) {
    const e = idx.get(S.exit); S.moves++; S.score = Math.max(0, S.score - 1); S.runner = w; S.log.push({ y: w, h: null });
    if (w === S.exit) { S.status = 'won'; buzz([30, 40, 30]); }
    else {
      const h2 = words[houndStep(idx.get(S.hound), idx.get(w))]; S.hound = h2; S.log[S.log.length - 1].h = h2;
      if (!safeMoves(idx.get(w), idx.get(h2), e).length) { S.status = 'lost'; S.why = 'cornered'; buzz([80, 50, 80]); }
      else if (S.moves >= budget()) { S.status = 'lost'; S.why = 'time'; buzz([80, 50, 80]); }
    }
    save(); vt(() => render());
  }
  function previewDanger(raw) { return raw.length === 4 && idx.has(raw) && dangerous(idx.get(S.hound), idx.get(raw)); }
  function submit(ev) {
    ev.preventDefault(); if (S.status !== 'play') return;
    const input = $('word-entry'), w = input.value.trim().toUpperCase();
    const fail = (m) => { say(m, 'error'); input.classList.remove('shake'); void input.offsetWidth; input.classList.add('shake'); buzz(60); };
    if (!/^[A-Z]{4}$/.test(w)) return fail('Enter exactly four letters.');
    if (!idx.has(w)) return fail(`${w} isn’t in the dictionary.`);
    if (w === S.runner) return fail('That’s the word you are already on.');
    if (!adj[idx.get(S.runner)].includes(idx.get(w))) return fail('Change exactly one letter of your word.');
    if (w !== S.exit && dangerous(idx.get(S.hound), idx.get(w))) return fail(`${w} is one step from the Hound. It would catch you.`);
    input.value = ''; input.classList.remove('danger'); $('submit-button').disabled = true; say('');
    apply(w);
  }
  function openHint() {
    if (S.status !== 'play') return; const c = hintCost() + 1;
    if (S.score < c) { say(`You need ${c} points for a hint.`, 'error'); return; }
    $('hint-confirm-cost').textContent = c;
    $('hint-confirm-balance').textContent = S.score - c;
    $('hint-confirmation').hidden = false;
    $('hint-confirm-button').focus();
  }
  function closeHint() {
    $('hint-confirmation').hidden = true;
    if (S && S.status === 'play' && !$('hint-button').disabled) $('hint-button').focus();
    else $('word-entry').focus({ preventScroll: true });
  }
  function confirmHint() {
    $('hint-confirmation').hidden = true; if (S.status !== 'play' || S.score < hintCost() + 1) return;
    const path = solve(idx.get(S.runner), idx.get(S.hound), idx.get(S.exit));
    if (!path || path.length < 2) { S.status = 'lost'; S.why = 'cornered'; save(); vt(() => render()); return; }
    S.score = Math.max(0, S.score - hintCost()); S.hints++; say('Hint played: ' + words[path[1]]); apply(words[path[1]]);
  }

  async function startLevel(opts = {}) {
    if (busy) return; busy = true;
    $('game').hidden = true; $('error-panel').hidden = true; $('loading').hidden = false; await tick();
    const n = opts.same && S ? { ...S.puzzle } : null;
    let s = opts.same && n
      ? { level: S.level, score: START_SCORE, hints: 0, moves: 0, status: 'play', challenge: S.challenge, puzzle: n, runner: n.r, hound: n.h, exit: n.e, log: [{ y: n.r, h: n.h }] }
      : fresh(Number.isInteger(opts.level) ? opts.level : 0, opts.score ?? START_SCORE);
    $('loading').hidden = true; busy = false;
    if (!s) { $('error-message').textContent = 'The puzzle could not be generated.'; $('error-panel').hidden = false; return; }
    S = s; save(); say(''); vt(() => { $('game').hidden = false; ['you-word', 'hound-word', 'exit-word'].forEach((id) => delete $(id).dataset.w); $('danger-list').dataset.w = ''; render(false); });
    setTimeout(() => $('word-entry').focus({ preventScroll: true }), 300);
  }
  const link = () => location.origin + location.pathname + '?c=' + [S.puzzle.r, S.puzzle.h, S.puzzle.e].join('.');
  async function shareText(text, status) {
    try { if (navigator.share) { await navigator.share({ title: 'WRDHOUND', text, url: link() }); return; } await navigator.clipboard.writeText(text + '\n' + link()); status('Copied to clipboard.'); }
    catch (e) { if (e.name !== 'AbortError') status('Could not share on this device.'); }
  }

  /* ---------- first-run guide ---------- */
  const guide = [
    { icon: '↗', title: 'Reach the EXIT. Stay ahead.', copy: 'Change exactly one letter per move. Every move must form a valid four letter word. Reach the EXIT before the Hound catches you.' },
    { icon: '⌁', title: 'Watch the Hound’s reach.', copy: 'The four patterns under the Hound show every word one letter away from it. Never move onto one of those words. The GAP meter shows how close it is.' },
    { icon: '✦', title: 'Plan, then make your move.', copy: 'The EXIT distance and moves left help you plan. Hints reveal and play a safe route step, but cost points. Your campaign progress saves automatically.' }
  ];
  let guideStep = 0;
  function showGuide(firstRun = false) {
    guideStep = 0;
    $('tutorial-dialog').dataset.firstRun = String(firstRun);
    paintGuide();
    $('tutorial-dialog').hidden = false;
    $('tutorial-next').focus();
  }
  function paintGuide() {
    const item = guide[guideStep];
    $('tutorial-step-label').textContent = `FIELD GUIDE · ${guideStep + 1} OF ${guide.length}`;
    $('tutorial-icon').textContent = item.icon;
    $('tutorial-title').textContent = item.title;
    $('tutorial-copy').textContent = item.copy;
    $('tutorial-next').textContent = guideStep === guide.length - 1 ? 'LET’S PLAY' : 'NEXT';
    [...document.querySelectorAll('.tutorial-progress i')].forEach((el, i) => el.classList.toggle('active', i <= guideStep));
  }
  function closeGuide(completed = true) {
    $('tutorial-dialog').hidden = true;
    if (completed) try { localStorage.setItem(TUTORIAL, '1'); } catch (_) {}
    $('guide-button').focus({ preventScroll: true });
  }
  function advanceGuide() {
    if (guideStep < guide.length - 1) { guideStep++; paintGuide(); }
    else closeGuide(true);
  }

  /* ---------- init + events ---------- */
  function bind() {
    $('guide-button').addEventListener('click', () => showGuide(false));
    $('tutorial-next').addEventListener('click', advanceGuide);
    $('tutorial-skip').addEventListener('click', () => closeGuide(true));
    $('tutorial-dialog').addEventListener('click', (e) => { if (e.target === e.currentTarget) closeGuide(true); });
    $('word-entry').addEventListener('input', (e) => {
      const v = e.target.value.replace(/[^a-z]/gi, '').toUpperCase().slice(0, 4); e.target.value = v;
      $('submit-button').disabled = v.length !== 4; const d = previewDanger(v) && v !== S.exit; e.target.classList.toggle('danger', d);
      if (d) say(`${v} is inside the Hound’s reach.`, 'error'); else if (!$('message').hidden && $('message').classList.contains('error')) say('');
    });
    $('move-form').addEventListener('submit', submit);
    $('hint-button').addEventListener('click', openHint);
    $('hint-cancel-button').addEventListener('click', closeHint);
    $('hint-confirm-button').addEventListener('click', confirmHint);
    $('hint-confirmation').addEventListener('click', (e) => { if (e.target === e.currentTarget) closeHint(); });
    addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (!$('tutorial-dialog').hidden) closeGuide(true);
        else if (!$('new-confirmation').hidden) $('new-cancel-button').click();
        else if (!$('hint-confirmation').hidden) closeHint();
      }
      const activeDialog = !$('tutorial-dialog').hidden ? $('tutorial-dialog') : !$('new-confirmation').hidden ? $('new-confirmation') : !$('hint-confirmation').hidden ? $('hint-confirmation') : null;
      if (activeDialog && e.key === 'Tab') {
        const focusable = [...activeDialog.querySelectorAll('button:not(:disabled), [href], input:not(:disabled), [tabindex]:not([tabindex="-1"])')];
        if (!focusable.length) return;
        const first = focusable[0], last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
    const initialDark = document.documentElement.dataset.theme === 'dark';
    $('theme-toggle').setAttribute('aria-pressed', String(initialDark));
    $('theme-toggle').setAttribute('aria-label', initialDark ? 'Switch to light theme' : 'Switch to dark theme');
    $('theme-toggle').addEventListener('click', () => {
      const t = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      vt(() => { document.documentElement.dataset.theme = t; });
      $('theme-toggle').setAttribute('aria-pressed', String(t === 'dark'));
      $('theme-toggle').setAttribute('aria-label', t === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
      try { localStorage.setItem(THEME, t); } catch (_) {}
      document.querySelector('meta[name=theme-color]').content = t === 'dark' ? '#151026' : '#eee9f7';
    });
    let dialogReturnFocus = null;
    const openNewGame = () => {
      if (!S || S.moves === 0) { history.replaceState(null, '', location.pathname); startLevel({ level: 0 }); return; }
      dialogReturnFocus = document.activeElement;
      $('new-confirmation').hidden = false;
      $('new-cancel-button').focus();
    };
    const closeNewGame = () => {
      $('new-confirmation').hidden = true;
      if (dialogReturnFocus && dialogReturnFocus.focus) dialogReturnFocus.focus();
    };
    $('new-game-button').addEventListener('click', openNewGame);
    $('new-cancel-button').addEventListener('click', closeNewGame);
    $('new-confirm-button').addEventListener('click', () => {
      $('new-confirmation').hidden = true;
      history.replaceState(null, '', location.pathname);
      startLevel({ level: 0 });
    });
    $('new-confirmation').addEventListener('click', (e) => { if (e.target === e.currentTarget) closeNewGame(); });
    $('retry-button').addEventListener('click', () => startLevel({ level: S ? S.level : 0 }));
    $('share-challenge-button').addEventListener('click', () => shareText(`Can you outrun the Hound? ${S.puzzle.r} to ${S.puzzle.e}, hound on ${S.puzzle.h}. Par ${S.puzzle.par}.`, say));
    $('finish-primary').addEventListener('click', () => {
      if (S.status === 'won') { history.replaceState(null, '', location.pathname); startLevel({ level: S.challenge ? 0 : S.level + 1 }); } else startLevel({ same: true });
    });
    $('finish-secondary').addEventListener('click', () => {
      if (S.status === 'won') shareText(`WRDHOUND LV${S.level} escaped the Hound in ${S.moves} moves (par ${S.puzzle.par}). Score ${S.score}.`, (m) => { $('share-status').textContent = m; });
      else startLevel({ level: S.level });
    });
  }
  async function init() {
    const t0 = performance.now();
    try {
      splash(12, 'Loading dictionary'); await tick();
      buildGraph();
      splash(58, `Mapping ${words.length.toLocaleString()} words`); await tick(); bind();
    } catch (error) {
      console.error('WRDHOUND initialization failed:', error);
      splash(100, 'Unable to load game');
      $('error-message').textContent = error && error.message ? error.message : 'The game could not be initialized. Check that all game files are present.';
      $('error-panel').hidden = false;
      $('splash').classList.add('out');
      setTimeout(() => $('splash').remove(), 600);
      return;
    }
    let saved = null;
    try {
      const current = localStorage.getItem(SAVE);
      const legacy = current ? null : localStorage.getItem(LEGACY_SAVE);
      saved = JSON.parse(current || legacy || 'null');
      if (!current && saved && validSave(saved)) localStorage.setItem(SAVE, JSON.stringify(saved));
    } catch (_) {}
    S = challengeFromUrl() || (validSave(saved) ? saved : null); splash(82, 'Finding a hound');
    await tick(); if (!S) S = fresh(0, START_SCORE); if (S) save();
    if (!S) { $('error-message').textContent = 'The puzzle could not be generated.'; $('error-panel').hidden = false; }
    splash(100, 'Releasing the hound'); await wait(Math.max(0, 1300 - (performance.now() - t0)));
    if (S) { $('game').hidden = false; render(false); }
    $('splash').classList.add('out'); setTimeout(() => $('splash').remove(), 600);
    if (S) { let seen = false; try { seen = localStorage.getItem(TUTORIAL) === '1'; } catch (_) {} if (!seen) showGuide(true); }
  }
  init();
})();
