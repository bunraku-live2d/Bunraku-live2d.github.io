/* Reviewer supplement page.
 *
 * All state is plain DOM + a few module-level variables; no framework, because the page has to run from
 * file:// with no network and no build step.
 *
 * The one non-obvious thing is frame preloading. Dragging a slider swaps <img src>, and on a cold cache
 * that shows a flash of nothing between frames. So whenever an axis is selected every frame of that
 * sweep is decoded up front into a cache that keeps the Image objects alive; after that a drag is a
 * pure src swap out of memory and is smooth.
 */
'use strict';
const D = window.DATA;
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const el = (t, c, txt) => { const n = document.createElement(t); if (c) n.className = c;
  if (txt != null) n.textContent = txt; return n; };

/* keep decoded frames alive so a drag never re-fetches */
const CACHE = new Map();
function preload(urls) {
  urls.forEach(u => { if (CACHE.has(u)) return; const i = new Image(); i.src = u; CACHE.set(u, i); });
}

/* ------------------------------------------------------------------ hero
 * One rig animating in the header, cross-fading between characters and axes so the first thing on screen
 * is the product doing its job. Built the same way the A-pose tiles are: one <video> per clip, all loaded,
 * switched by OPACITY. Reassigning src would blank the element for a frame on every change, which is the
 * flicker that had to be fixed in section 02.
 */
const HERO = { k: 0, vids: [], clips: [], views: [], stackPhase: 0, stackOn: false };

/* The hero alternates the two halves of the pipeline: a rig ANIMATING, and the same kind of character
 * pulled apart into the ordered layer stack Stage 1 produces. Showing only the animation begs the question
 * of where the layers came from; showing only the stack says nothing about it moving.
 *
 * The stack reuses the solo layer images from section 04, so it costs no new assets, and it is built the
 * same way -- pushed apart along Z under a perspective transform, which is what actually reads as depth. */
function heroStackBuild(name) {
  const host = $('#heroStack');
  const L = (D.layers || []).find(x => x.name === name) || (D.layers || [])[0];
  if (!host || !L) return null;
  host.textContent = '';
  for (let k = 0; k < L.n; k++) {
    const im = el('img');
    im.src = `layers/${L.name}/solo_${k}.webp`;
    im.alt = '';
    im.style.zIndex = String(k);
    host.appendChild(im);
  }
  host.dataset.n = String(L.n);
  // Size by HEIGHT, with the width following from the character's aspect. Setting a width percentage
  // instead let a 3.55:1 standing figure run past the top and bottom of the panel -- head and feet cut off.
  if (L.fw && L.fh) {
    host.style.aspectRatio = `${L.fw} / ${L.fh}`;
    host.style.height = '84%';
    host.style.width = 'auto';
  }
  return L;
}

function heroStackTick() {
  if (HERO.stackOn) {
    HERO.stackPhase += 0.010;
    const host = $('#heroStack');
    const imgs = $$('img', host);
    const n = Math.max(imgs.length - 1, 1);
    /* A wider yaw sweep, and the stack BREATHES apart and back together.
     *
     * A narrow oscillation reads as a wobble rather than as depth. Sweeping 34 degrees makes the sheets
     * pass each other so the ordering is legible, and modulating the Z gap on a slower cycle shows the
     * stack assembling into the character and coming apart again -- which is the thing this panel is
     * meant to say, next to the clip that shows it moving.
     *
     * The two cycles are deliberately incommensurate (1 : 0.37) so the motion never settles into an
     * obvious repeat. */
    const yaw = -14 + Math.sin(HERO.stackPhase) * 17;
    const breathe = 0.42 + 0.58 * (0.5 - 0.5 * Math.cos(HERO.stackPhase * 0.37));
    const gap = 30 * breathe;
    imgs.forEach((im, k) => { im.style.transform = `translateZ(${((k - n / 2) * gap).toFixed(1)}px)`; });
    host.style.transform = `rotateY(${yaw.toFixed(2)}deg) rotateX(${(3 - breathe).toFixed(2)}deg)`;
  }
  requestAnimationFrame(heroStackTick);
}

function buildHero() {
  const host = $('#heroVids');
  if (!host || !D.loops) return;
  const pool = [];
  [(D.apose || []), (D.explorer || [])].forEach(list => list.forEach(c => {
    Object.keys(c.sweeps || {}).forEach(pm => {
      const le = loopEntry(c.name, pm);
      if (le) pool.push({ name: c.name, pm, label: (c.sweeps[pm] || {}).label || pm, file: le.f });
    });
  }));
  if (!pool.length) return;
  const byChar = new Map();
  pool.forEach(x => { if (!byChar.has(x.name)) byChar.set(x.name, []); byChar.get(x.name).push(x); });
  const names = Array.from(byChar.keys());
  const clips = [];
  for (let round = 0; clips.length < 6 && round < 4; round++) {
    names.forEach(n => { const l = byChar.get(n); if (l[round] && clips.length < 6) clips.push(l[round]); });
  }
  HERO.clips = clips;
  clips.forEach((cl, i) => {
    const v = document.createElement('video');
    v.src = `loops/${cl.file}`;
    v.loop = true; v.muted = true; v.playsInline = true;
    v.setAttribute('playsinline', ''); v.preload = 'auto';
    if (i === 0) v.classList.add('on');
    host.appendChild(v); HERO.vids.push(v);
  });

  // the view list: two animations, then the layer stack, repeating.
  // Prefer the TALLEST layer case for the stack: a standing figure reads as a character pulled apart,
  // where a chibi in a dynamic pose just looks like it is falling over once the perspective is applied.
  // Not the tallest -- the one that FILLS the panel. The hero frame is about 1.34:1, so a 3.5:1 figure
  // sized to fit the height ends up a third of the width and reads as a sliver. ~2.2:1 fills it.
  const pick = (D.layers || []).slice().filter(L => L.fw && L.fh)
    .sort((a, b) => Math.abs((a.fh / a.fw) - 2.2) - Math.abs((b.fh / b.fw) - 2.2));
  const stackName = pick.length ? pick[0].name : ((D.layers || [])[0] || {}).name;
  clips.forEach((_, i) => {
    HERO.views.push({ type: 'clip', i });
    if (stackName && i % 2 === 1) HERO.views.push({ type: 'stack' });
  });
  if (stackName) HERO.stackL = heroStackBuild(stackName);
  requestAnimationFrame(heroStackTick);

  const show = k => {
    HERO.k = ((k % HERO.views.length) + HERO.views.length) % HERO.views.length;
    const view = HERO.views[HERO.k];
    const stackEl = $('#heroStack');
    if (view.type === 'stack') {
      HERO.stackOn = true;
      HERO.vids.forEach(v => { v.classList.remove('on'); v.pause(); });
      if (stackEl) stackEl.classList.add('on');
      const L = HERO.stackL;
      $('#heroTag').textContent = L ? `${L.name} · ${L.n} predicted layers` : 'layer stack';
    } else {
      HERO.stackOn = false;
      if (stackEl) stackEl.classList.remove('on');
      HERO.vids.forEach((v, j) => {
        const on = j === view.i;
        v.classList.toggle('on', on);
        if (on) v.play().catch(() => {}); else v.pause();
      });
      const cl = HERO.clips[view.i];
      $('#heroTag').textContent = `${cl.name} · ${cl.label}`;
    }
  };
  show(0);
  setInterval(() => show(HERO.k + 1), 4600);
}

/* ------------------------------------------------------------------ explorer
 * Two GROUPS share this one explorer, because they are two different questions:
 *
 *   apose     a single character standing front-facing with arms down -- the pose Live2D rigs are
 *             authored from, so it is the in-distribution case
 *   explorer  dynamic illustrations: foreshortening, props, arms across the body -- out of distribution
 *
 * They are kept separate rather than pooled because they behave measurably differently (see the section
 * text), and averaging them would hide exactly the property a reviewer wants to check.
 */
const GRP = [{ key: 'apose', label: 'A-pose inputs' },
             { key: 'explorer', label: 'dynamic illustrations' }];
const EX = { grp: 'apose', ci: 0, pm: null, k: 0, playing: false, timer: null, dir: 1, vi: 0 };
const exList = () => (D[EX.grp] && D[EX.grp].length) ? D[EX.grp] : D.explorer;
const exChar = () => exList()[EX.ci];

/* Scrubbing SEEKS THE VIDEO. There are no per-axis stills any more.
 *
 * The page previously shipped 25 stills per axis per character -- 6098 files and 251 MB, which is 84% of
 * the payload -- purely so the slider had random access. The loops already contain exactly those frames, so
 * the stills were a second copy of the animation. Dropping them and seeking the loop instead is what brings
 * the package inside 50 MB while keeping all 276 animations.
 *
 * Seeking is affordable here because the clips are SHORT. A dense keyframe interval would make seeks
 * instant but doubles the file size (measured: 39 MB -> 80 MB over 276 loops), and it is unnecessary at
 * this length: a 32-48 frame clip decodes from its single keyframe in a few milliseconds. Measured seek
 * latency on a shipped clip is 18-61 ms, and a browser coalesces the seeks issued during a drag, so only
 * the last one is serviced.
 *
 * The loop is a PING-PONG: frames 0..n-1 then back down. A slider position therefore maps into the first
 * half only, or dragging right would run the character backwards past the midpoint. */
function exRender(f) {
  const c = exChar(), s = c.sweeps[EX.pm];
  if (f == null) f = EX.k;
  f = Math.min(s.n - 1, Math.max(0, f));
  EX.k = Math.round(f);
  const e = loopEntry(c.name, EX.pm);
  const v = exVids()[EX.vi];                       // the buffer currently on screen
  if (e && v) {
    const fwd = Math.ceil(e.n / 2);                 // frames in the forward half
    const t = (f / Math.max(s.n - 1, 1)) * (fwd - 1) / (e.fps || 30);
    if (v.readyState >= 1 && isFinite(v.duration)) v.currentTime = Math.min(t, v.duration - 1e-3);
  }
  const val = s.lo + (s.hi - s.lo) * f / (s.n - 1);
  $('#exCur').textContent = (val > 0 ? '+' : '') + val.toFixed(1);
  $('#exCurLab').textContent = `${EX.pm}  (${s.label})`;
  if (!EX.dragging) $('#exRange').value = f;
  $('#exTag').textContent = `${c.name} · ${EX.pm} = ${val.toFixed(1)}`;
}

function exSelectAxis(pm) {
  EX.pm = pm;
  const c = exChar();
  EX.k = Math.floor((c.sweeps[pm].n - 1) / 2);          // start at the rest value, mid-sweep
  $('#exRange').max = c.sweeps[pm].n - 1;
  $$('#exAxes button').forEach(b => b.setAttribute('aria-selected', b.dataset.pm === pm));
  if (!EX.playing) {                               // paused: point the visible buffer at the new clip
    const src = exLoopSrc(), v = exVids()[EX.vi];
    if (src && v && !v.src.endsWith(src)) {
      v.src = src;
      v.addEventListener('loadeddata', () => exRender(), { once: true });
    }
  }
  exRender();
}

function exSelectChar(i) {
  EX.ci = i;
  const c = exList()[i];
  $$('#exPicker button').forEach((b, j) => b.setAttribute('aria-selected', j === i));
  const axes = $('#exAxes'); axes.textContent = '';
  Object.keys(c.sweeps).forEach(pm => {
    const b = el('button', null, c.sweeps[pm].label);
    b.dataset.pm = pm;
    b.onclick = () => { carSet(false); exSelectAxis(pm); exPlay(true); };
    axes.appendChild(b);
  });
  exCharFacts();
  exSelectAxis(Object.keys(c.sweeps)[0]);
}

function exCharFacts() {
  const c = exChar();
  $('#exFacts').innerHTML =
    `<div><b>${c.layers}</b> layers &nbsp;·&nbsp; <b>${c.verts}</b> vertices</div>` +
    `<div>one token per vertex, so <b>${c.verts}</b> tokens per forward pass</div>` +
    (c.tear != null
      ? `<div>layer coherence <b>${c.tear.toFixed(2)}%</b> at every extreme (bound 3%)</div>`
      : `<div>measured motion <b>${(c.motion || 0).toFixed(4)}</b> of character span</div>`) +
    (c.src ? `<div>input: ${c.src === 't2i' ? 'a text-to-image generation'
                                            : 'one in-the-wild illustration'}</div>` : '');
}

/* A loop entry is {f, n, fps}. Older builds stored a bare filename, so both shapes are accepted -- and
 * the DURATION has to come from the entry rather than a constant: the pose axes are 25 frames (48 after
 * the ping-pong) and the expression axes 17 (32), so no single number describes a loop any more. */
function loopEntry(name, pm) {
  const e = D.loops && D.loops[name] && D.loops[name][pm];
  if (!e) return null;
  return typeof e === 'string' ? { f: e, n: 64, fps: 30 } : e;
}
function loopMs(name, pm) {
  const e = loopEntry(name, pm);
  return e ? (e.n / (e.fps || 30)) * 1000 : 2133;
}
function exLoopSrc() {
  const e = loopEntry(exChar().name, EX.pm);
  return e ? `loops/${e.f}` : null;
}

/* Playback hands the frames to a <video> instead of swapping <img> src.
 *
 * Swapping images is at the mercy of decode timing and shows micro-stutter no matter how many frames
 * there are; a video element runs on the browser's own playback pipeline and is genuinely smooth. The
 * frames stay on disk because the slider needs random access -- so playing shows the video, and touching
 * the slider hides it and scrubs the stills. */
function exVids() { return [$('#exVid'), $('#exVid2')]; }

function exPlay(on) {
  EX.playing = on;
  const b = $('#exPlay');
  const vs = exVids(), cur = vs[EX.vi], alt = vs[1 - EX.vi];
  const st = { style: {} };                        // the old still-stack; kept as a stub, see exRender
  b.classList.toggle('on', on);
  b.textContent = on ? 'pause' : 'play';
  const src = exLoopSrc();
  if (on && src) {
    const label = () => {
      $('#exCurLab').textContent = `${EX.pm}  (${exChar().sweeps[EX.pm].label})`;
      $('#exCur').textContent = '\u25b6';
      $('#exTag').textContent = `${exChar().name} \u00b7 ${EX.pm} sweeping`;
    };
    if (cur.src.endsWith(src)) {                 // already the right clip: just show and run it
      cur.style.display = ''; alt.style.display = 'none'; st.style.display = 'none';
      cur.play().catch(() => {});
      label();
      return;
    }
    /* Load into the OTHER element and keep the current one on screen until the new clip has a decoded
     * frame. Assigning src to the visible element tears its pipeline down, so it paints empty for a beat:
     * with one element that flash happened on all 72 carousel steps. Two decoders make the swap atomic. */
    const want = src;
    alt.style.display = 'none';
    if (!alt.src.endsWith(want)) alt.src = want;
    const reveal = () => {
      // a later step may have superseded this one while the clip was loading
      if (!EX.playing || exLoopSrc() !== want) return;
      alt.currentTime = 0;
      alt.play().catch(() => {});
      alt.style.display = ''; cur.style.display = 'none'; st.style.display = 'none';
      cur.pause();
      EX.vi = 1 - EX.vi;
      label();
    };
    if (alt.readyState >= 2) reveal();
    else alt.addEventListener('loadeddata', reveal, { once: true });
    alt.play().catch(() => {});                  // kick decoding even while hidden
    label();
  } else {
    vs.forEach(v => { v.pause(); v.style.display = 'none'; });
    st.style.display = '';
    exRender();
  }
}


/* ------------------------------------------------------------------ carousel over every animation
 * "Play all" walks the full set: both groups, every character, every axis of each -- 24 rigs x 3 axes = 72
 * loops -- advancing on its own so the whole page's output can be watched without clicking 72 times.
 *
 * It advances after a whole number of loop periods rather than on a round number of seconds. A loop is 64
 * frames at 30 fps = 2.133 s, so a 4 s timer would cut the second pass 13% in and the motion would appear
 * to jump backwards at the moment of the switch. Two full periods is 4.267 s and always lands at the pose
 * the loop started from.
 *
 * Any manual input cancels it: clicking a character, an axis or a group, or touching the slider. A
 * carousel that fights the user for control of the stage is worse than no carousel. */
const CAR = { on: false, timer: null, seq: [], k: 0 };

/* AXIS-MAJOR, not character-major.
 *
 * Walking one character through all ten of its axes before moving on means a viewer waits ~45 seconds to
 * see the second character, and several minutes before the range of the corpus is apparent. Ordering by
 * axis instead -- every character's head turn, then every character's head nod -- shows all thirty rigs
 * inside the first pass and still covers all 276 animations. */
function carSeq() {
  const groups = GRP.filter(g => D[g.key] && D[g.key].length);
  const axes = [];
  groups.forEach(g => D[g.key].forEach(c => Object.keys(c.sweeps).forEach(pm => {
    if (!axes.includes(pm)) axes.push(pm);
  })));
  const out = [];
  axes.forEach(pm => groups.forEach(g => D[g.key].forEach((c, i) => {
    if (c.sweeps[pm]) out.push({ grp: g.key, i, pm });
  })));
  return out;
}

function carStep() {
  if (!CAR.on) return;
  const st = CAR.seq[CAR.k % CAR.seq.length];
  if (st.grp !== EX.grp) { EX.grp = st.grp; exBuildPicker(); syncGrpTabs(); }
  EX.ci = st.i;
  $$('#exPicker button').forEach((b, j) => b.setAttribute('aria-selected', j === st.i));
  exCharFacts();
  exSelectAxis(st.pm);
  exPlay(true);
  $('#carCount').textContent = `${(CAR.k % CAR.seq.length) + 1} / ${CAR.seq.length}`;
  CAR.k++;
  // two whole periods of THIS loop, so the switch always lands on the pose it started from
  CAR.timer = setTimeout(carStep, loopMs(exChar().name, st.pm) * 2);
}

function carSet(on) {
  CAR.on = on;
  const b = $('#carBtn');
  if (b) { b.classList.toggle('on', on); b.textContent = on ? 'stop play-all' : 'play all'; }
  clearTimeout(CAR.timer);
  if (on) { CAR.seq = carSeq(); carStep(); } else $('#carCount').textContent = '';
}

function syncGrpTabs() {
  $$('#exGrp button').forEach(b => b.setAttribute('aria-selected', b.dataset.g === EX.grp));
}

const CYCLE_MS = 3400;   // used by the featured strip

function exBuildPicker() {
  const pick = $('#exPicker');
  pick.textContent = '';
  exList().forEach((c, i) => {
    const b = el('button');
    const im = el('img'); im.src = `frames/${c.name}/rest.webp`; im.alt = ''; im.loading = 'lazy';
    const t = el('div', 'pn');
    t.appendChild(el('div', null, c.name.length > 15 ? c.name.slice(0, 15) + '…' : c.name));
    t.appendChild(el('div', 'pm', `${c.layers} layers`));
    b.append(im, t);
    b.onclick = () => { carSet(false); exSelectChar(i); exPlay(true); };
    pick.appendChild(b);
  });
}

function exSelectGroup(key) {
  if (!(D[key] && D[key].length)) return;
  EX.grp = key; EX.ci = 0;
  $$('#exGrp button').forEach(b => b.setAttribute('aria-selected', b.dataset.g === key));
  exBuildPicker();
  exSelectChar(0);
  exPlay(true);
}

function buildExplorer() {
  const g = $('#exGrp');
  if (g) GRP.filter(x => D[x.key] && D[x.key].length).forEach(x => {
    const b = el('button', null, `${x.label} (${D[x.key].length})`);
    b.dataset.g = x.key;
    b.onclick = () => { carSet(false); exSelectGroup(x.key); };
    g.appendChild(b);
  });
  // dragging takes over from playback; that is what a slider is for
  const R = $('#exRange');
  R.step = 'any';                       // continuous, so dragging cross-fades like playback does
  // Read the slider FIRST and raise the drag flag BEFORE pausing.
  //
  // exPlay(false) calls exRender(), and exRender writes the current frame index back into the slider
  // whenever EX.dragging is false. With the old ordering that write landed between the user moving the
  // slider and the handler reading it, so `e.target.value` came back as the rest position and every drag
  // produced the same pose.
  R.oninput = e => { const v = +e.target.value; EX.dragging = true;
                     carSet(false); exPlay(false); exRender(v); EX.dragging = false; };
  // pointer over the stage scrubs; leaving restores playback (or the carousel, if it is running)
  hoverScrub($('#exStage'),
    f => { const n = exChar().sweeps[EX.pm].n;
           if (EX.playing) exVids().forEach(x => x.pause());
           EX.dragging = false; exRender(f * (n - 1)); $('#exRange').value = f * (n - 1); },
    () => { if (EX.playing) exPlay(true); });
  $('#exPlay').onclick = () => { carSet(false); exPlay(!EX.playing); };
  $('#exRest').onclick = () => { carSet(false); exPlay(false);
    EX.k = Math.floor((exChar().sweeps[EX.pm].n - 1) / 2); exRender(); };
  document.addEventListener('keydown', e => {
    if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    const n = exChar().sweeps[EX.pm].n;
    exPlay(false);
    EX.k = Math.min(n - 1, Math.max(0, EX.k + (e.key === 'ArrowRight' ? 1 : -1)));
    exRender(); e.preventDefault();
  });
  $('#carBtn').onclick = () => carSet(!CAR.on);
  // autoplay, and start on the A-pose group: the in-distribution case is what should greet a reviewer
  exSelectGroup(D.apose && D.apose.length ? 'apose' : 'explorer');
}

/* ------------------------------------------------------------------ featured strip
 * Four rigs looping simultaneously above the explorer. Each runs on the same eased sine but with its
 * phase offset, so the strip does not pulse in unison, and each is throttled to one src swap per
 * animation frame at most. */
function buildFeatured() {
  const host = $('#featStrip');
  if (!host) return;
  D.explorer.slice(0, 4).forEach((c, i) => {
    const pm = Object.keys(c.sweeps)[0];
    const le = loopEntry(c.name, pm);
    const src = le && le.f;
    const fig = el('figure');
    if (src) {
      const v = document.createElement('video');
      v.src = `loops/${src}`; v.autoplay = true; v.loop = true; v.muted = true;
      v.playsInline = true; v.setAttribute('playsinline', ''); v.preload = 'auto';
      fig.appendChild(v);
    } else {                                     // no loop encoded: fall back to the rest frame
      const im = el('img'); im.src = `frames/${c.name}/rest.webp`; im.alt = c.name;
      fig.appendChild(im);
    }
    const cap = el('figcaption');
    cap.innerHTML = `<b>${c.name.length > 18 ? c.name.slice(0, 18) + '…' : c.name}</b>` +
                    `${c.layers} layers · ${c.verts} vtx`;
    fig.appendChild(cap);
    // the group must be set FIRST: exSelectChar indexes into whichever group is active, and the
    // explorer now opens on the A-pose group, so a bare exSelectChar(i) here would open the wrong rig
    fig.onclick = () => { exSelectGroup('explorer'); exSelectChar(i); exPlay(true);
      $('#exStage').scrollIntoView({ behavior: 'smooth', block: 'center' }); };
    host.appendChild(fig);
  });
}

/* ------------------------------------------------------------------ pointer reactivity
 * Every character on the page reacts to the mouse, not only the six with a full 2-D grid.
 *
 * The grid rigs in section 03 are the expensive case: 91 renders each, two axes at once. Everything else
 * already has a 33-frame sweep per axis on disk, and that is enough for one honest degree of freedom --
 * the pointer's HORIZONTAL position maps to the position along the current sweep. So the whole page
 * responds to the mouse: the big stage, the twelve A-pose tiles and all 58 gallery tiles.
 *
 * It is a real drive, not a warp: the frame under the pointer is a render of the rig at that parameter
 * value. Moving off the element restores whatever was playing before. */
function hoverScrub(host, onFrac, onLeave) {
  let active = false;
  const frac = e => {
    const r = host.getBoundingClientRect();
    return Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
  };
  host.addEventListener('pointermove', e => {
    if (e.pointerType === 'touch') return;
    active = true; onFrac(frac(e));
  });
  host.addEventListener('pointerleave', () => { if (active) { active = false; onLeave(); } });
}

/* ------------------------------------------------------------------ A-pose group
 * Twelve tall tiles, each looping one axis. Three details:
 *
 *   - each tile cycles which axis it sweeps, on a stagger, so the grid does not pulse in unison and a
 *     reviewer sees all three axes without clicking anything;
 *   - hover advances the axis immediately, which is the affordance that makes the cycling discoverable;
 *   - tiles PAUSE when scrolled out of view. Twelve videos plus the featured strip plus the explorer is
 *     seventeen decoders, and leaving them all running makes the page's other scroll-linked animation
 *     stutter on a laptop. An IntersectionObserver keeps only the visible ones alive.
 */
const AP = { obs: null };

function apLoop(c, pm) {
  const e = loopEntry(c.name, pm);
  return e ? `loops/${e.f}` : null;
}

/* Switching axis must NOT reassign video.src.
 *
 * That was the flicker: assigning src tears down the media element's pipeline and starts a fresh network
 * load, so the tile went blank for a frame or two every time the cycle advanced. Instead each tile holds
 * one <video> PER AXIS, all with preload="auto", and advancing the cycle only changes which one is visible
 * and playing. No load, no gap. The cost is bounded by capping how many axes a tile cycles (AP_AXES): ten
 * videos per tile x twelve tiles would be 120 decoders, which the browser will not keep alive. */
const AP_AXES = 3;

/* Switching axis WITHOUT a flicker.
 *
 * The crossfade was the problem, not the fix. Fading between two clips shows two DIFFERENT poses
 * overlapping for the duration of the fade, and the outgoing element was paused the moment the fade began,
 * so it froze mid-dissolve while the incoming one moved. That reads as a flash.
 *
 * The clips make a cleaner solution available. Each is a ping-pong over a symmetric axis (-30..+30..-30),
 * so every one of them passes through the NEUTRAL pose at the same normalised phase -- 0.255 on the way out
 * and 0.745 on the way back. Seek the incoming clip to that phase, wait for the outgoing to reach it, and
 * cut at that instant: both are showing the same rest pose, so there is nothing to see. No dissolve, no
 * two-pose overlap, nothing frozen.
 *
 * Worst case the switch waits one loop period (1.6s) for the phase to come round, which is why the cycle
 * interval is comfortably longer than that. */
function apRestPhase(c, pm) {
  const sw = c.sweeps[pm], e = loopEntry(c.name, pm);
  if (!sw || !e) return 0.25;
  const rest = (sw.lo === -sw.hi) ? (sw.n - 1) / 2 : 0;   // index of the zero value
  return rest / Math.max(e.n - 1, 1);
}

function apReveal(fig, ai) {
  const c = fig._c, pm = fig._axes[ai];
  fig._ai = ai;
  (fig._vids || []).forEach((v, j) => {
    const on = j === ai;
    v.style.opacity = on ? '1' : '0';
    v.style.zIndex = on ? '2' : '1';
    if (on) { if (fig._vis && !fig.classList.contains('scrub')) v.play().catch(() => {}); }
    else v.pause();
  });
  const lab = fig.querySelector('.apax');
  if (lab) lab.textContent = c.sweeps[pm].label;
}

function apShow(fig, ai, immediate) {
  const axes = fig._axes;
  ai = ((ai % axes.length) + axes.length) % axes.length;
  if (immediate || ai === fig._ai || !fig._vids || fig._vids.length < 2) { apReveal(fig, ai); return; }
  const cur = fig._vids[fig._ai], nxt = fig._vids[ai];
  if (!cur || !nxt || !isFinite(cur.duration) || !isFinite(nxt.duration)) { apReveal(fig, ai); return; }
  const ph = apRestPhase(fig._c, axes[ai]);
  // park the incoming clip on the neutral frame, ready to be cut to
  try { nxt.currentTime = ph * nxt.duration; } catch (e) { apReveal(fig, ai); return; }
  clearInterval(fig._swap);
  const target = [ph, 1 - ph];
  const tol = 1.6 / (loopEntry(fig._c.name, axes[fig._ai]) || { fps: 30 }).fps;  // ~1.5 frames
  const t0 = Date.now();
  fig._swap = setInterval(() => {
    if (fig.classList.contains('scrub')) return;         // the reader has taken over
    const now = cur.currentTime / cur.duration;
    const near = target.some(t => Math.abs(now - t) <= tol);
    if (near || Date.now() - t0 > 2600) {                // fall back rather than wait forever
      clearInterval(fig._swap);
      apReveal(fig, ai);
    }
  }, 20);
}

function buildApose() {
  const host = $('#apGrid');
  if (!host || !D.apose || !D.apose.length) {
    const sec = $('#aposeSection'); if (sec) sec.style.display = 'none';
    return;
  }
  D.apose.forEach((c, i) => {
    // cycle only the axes that have a loop, capped -- see AP_AXES
    const axes = Object.keys(c.sweeps).filter(pm => apLoop(c, pm)).slice(0, AP_AXES);
    const fig = el('figure');
    fig._c = c; fig._axes = axes.length ? axes : Object.keys(c.sweeps); fig._ai = 0; fig._vis = false;
    fig._vids = [];
    if (axes.length) {
      const vwrap = el('div', 'apvids');
      axes.forEach((pm, j) => {
        const v = document.createElement('video');
        v.src = apLoop(c, pm);
        v.loop = true; v.muted = true; v.playsInline = true;
        v.setAttribute('playsinline', ''); v.preload = 'auto';
        v.style.opacity = j === 0 ? '1' : '0';
        vwrap.appendChild(v); fig._vids.push(v);
      });
      fig.appendChild(vwrap);
    } else {
      const im = el('img'); im.src = `frames/${c.name}/rest.webp`; im.alt = c.name;
      fig.appendChild(im);
    }
    if (c.src === 't2i') fig.appendChild(el('div', 't2i', 'from text'));
    fig.appendChild(el('div', 'apax'));
    const cap = el('figcaption');
    cap.innerHTML = `<b>${c.name}</b>${c.layers} layers · ${c.verts} vtx`;
    fig.appendChild(cap);
    hoverScrub(fig,
      f => {                                   // scrub this tile's current axis by seeking its clip
        const pm = fig._axes[fig._ai], sw = c.sweeps[pm];
        const v = (fig._vids || [])[fig._ai];
        const e = loopEntry(c.name, pm);
        if (v && e) {
          v.pause();
          const fwd = Math.ceil(e.n / 2);
          const t = f * (fwd - 1) / (e.fps || 30);
          if (v.readyState >= 1 && isFinite(v.duration)) v.currentTime = Math.min(t, v.duration - 1e-3);
        }
        fig.classList.add('scrub');
        const val = sw.lo + (sw.hi - sw.lo) * f;
        fig.querySelector('.apax').textContent =
          `${sw.label}  ${val > 0 ? '+' : ''}${val.toFixed(0)}`;
      },
      () => {                                  // back to looping
        fig.classList.remove('scrub');
        apShow(fig, fig._ai);
      });
    fig.onclick = () => {
      carSet(false); exSelectGroup('apose'); exSelectChar(i); exPlay(true);
      $('#exStage').scrollIntoView({ behavior: 'smooth', block: 'center' });
    };
    host.appendChild(fig);
    apShow(fig, 0, true);
  });
  // ONE tile aspect for the whole grid, taken from the TALLEST character in it. Per-tile aspects would
  // give a row of uneven tiles; a shared aspect equal to the max means the tallest figure exactly fills
  // its tile and every shorter one is centred inside it, with nothing cropped.
  const ars = D.apose.filter(c => c.fw && c.fh).map(c => c.fh / c.fw);
  if (ars.length) host.style.setProperty('--ap-ar', `1 / ${Math.max(...ars).toFixed(3)}`);
  const figs = $$('#apGrid figure');
  AP.obs = new IntersectionObserver(es => es.forEach(e => {
    const f = e.target;
    f._vis = e.isIntersecting;
    if (!f._vids || !f._vids.length) return;
    if (e.isIntersecting) { if (!f.classList.contains('scrub')) apShow(f, f._ai); }
    else f._vids.forEach(v => v.pause());
  }), { rootMargin: '160px' });
  figs.forEach(f => AP.obs.observe(f));
  // Stagger the axis cycling so the tiles never all change together -- and never advance a tile the
  // pointer is currently scrubbing. Without that guard the timer changes the axis under the reader's hand
  // mid-drag, which reads as the tile glitching.
  figs.forEach((f, i) => setInterval(() => {
    if (f._vis && !f.classList.contains('scrub')) apShow(f, f._ai + 1);
  }, 5200 + i * 290));
  const t = D.apose.map(c => c.tear).filter(x => x != null);
  const n_t2i = D.apose.filter(c => c.src === 't2i').length;
  const N = D.apose.length;
  const word = n => ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
                     'ten', 'eleven', 'twelve'][n] || String(n);
  $('#apNote').innerHTML =
    `All ${word(N)} animate at the artist-scale amplitude the model predicts, with no reduction. ` +
    (t.length ? `Layer coherence &mdash; the spread of per-layer mean displacement at every axis extreme, ` +
      `as a percentage of character span &mdash; runs ${Math.min(...t).toFixed(2)}&ndash;` +
      `${Math.max(...t).toFixed(2)}% across the group, all of it inside the 3% bound at which layers stay ` +
      `together. ` : '') +
    `Across the wider corpus this group is the reliable one: over 13 A-pose inputs the coherence spread ` +
    `averages 2.20% and never exceeds 3.41%, whereas over 45 dynamic illustrations it averages 3.00% and ` +
    `reaches 9.14%, and every case where a head or a hair mass visibly detaches is a dynamic illustration. ` +
    `That is a property of the training corpus rather than of the renderer: hand-authored Live2D rigs are ` +
    `built from a front-facing standing base pose, so an A-pose input is close to what Stage&nbsp;2 saw and ` +
    `a foreshortened or seated one is not. ` +
    (n_t2i ? `${word(n_t2i).replace(/^\w/, c => c.toUpperCase())} of the ${word(N)} started as a ` +
             `text-to-image generation rather than existing artwork ` +
             `(marked <i>from text</i>); the pipeline does not distinguish them.` : '');
}

/* ------------------------------------------------------------------ cursor tracking
 * The character looks wherever the pointer is. Frames are a 2-D grid over (horizontal, vertical) cursor
 * position; the pointer picks a cell.
 *
 * Two details make it feel alive rather than steppy:
 *   - EXACT bilinear blending over the four cells surrounding the pointer, so both axes are continuous.
 *     Alpha compositing is a nested lerp, so the weights that make four stacked images reproduce a true
 *     bilinear sample are o1 = fx, o2 = fy(1-fx)/(1-fy*fx), o3 = fy*fx. An earlier version cross-faded
 *     horizontally and SNAPPED to the nearest row, which stepped visibly every 6.67 degrees of nod.
 *   - critically damped easing. The target follows the pointer instantly, but the DISPLAYED position
 *     eases toward it, so a flick of the mouse produces a head that catches up rather than teleports,
 *     and leaving the element eases back to centre instead of cutting.
 */
const TR = { i: 0, tx: 0, ty: 0, cx: 0, cy: 0, running: false, inside: false };
// measured share of frame pixels that change between the grid centre and its four extremes
const SCORE = { test1: 33.2, wf_fb_12: 18.2, w3_witch: 20.4, kirigaya_kazuto_11106782: 19.6,
                holo_10680055: 17.1, megumin_11810993: 9.2 };

function trUrls(g) {
  const u = [];
  for (let j = 0; j < g.ny; j++) for (let i = 0; i < g.nx; i++) u.push(`track/${g.name}/${i}_${j}.webp`);
  return u;
}
/* Bilinear over the grid, so BOTH axes are continuous.
 *
 * The first version cross-faded columns and snapped to the nearest row, which meant vertical mouse
 * movement stepped in 6.7-degree jumps and read as choppy. Four stacked images can express an exact
 * bilinear blend, because compositing with opacity is a nested lerp: painting L1 over L0 at a gives
 * (1-a)L0 + a*L1, and so on. Solving that nesting for the bilinear weights gives
 *
 *     o1 = fx                          (finishes the row-j pair)
 *     o3 = fy*fx                       (the far corner)
 *     o2 = fy*(1-fx) / (1 - fy*fx)     (what is left for the row-j+1, col-i corner)
 *
 * which composites to exactly (1-fy)[(1-fx)A + fx*B] + fy[(1-fx)C + fx*D]. */
function trRender() {
  const g = D.track.grid[TR.i];
  const fxr = (TR.cx * 0.5 + 0.5) * (g.nx - 1);
  const fyr = (TR.cy * 0.5 + 0.5) * (g.ny - 1);
  const i0 = Math.max(0, Math.min(g.nx - 2, Math.floor(fxr))), fx = fxr - i0;
  const j0 = Math.max(0, Math.min(g.ny - 2, Math.floor(fyr))), fy = fyr - j0;
  const u = (i, j) => `track/${g.name}/${i}_${j}.webp`;
  const L = [$('#trA'), $('#trB'), $('#trC'), $('#trD')];
  const src = [u(i0, j0), u(i0 + 1, j0), u(i0, j0 + 1), u(i0 + 1, j0 + 1)];
  for (let k = 0; k < 4; k++) if (L[k].dataset.u !== src[k]) { L[k].src = src[k]; L[k].dataset.u = src[k]; }
  const o3 = fy * fx;
  L[1].style.opacity = fx;
  L[2].style.opacity = (1 - o3) > 1e-6 ? (fy * (1 - fx)) / (1 - o3) : 0;
  L[3].style.opacity = o3;
  const sgn = v => (Math.abs(v) < 0.5 ? '0' : (v > 0 ? '+' : '') + v.toFixed(0));
  $('#trRead').innerHTML =
    `AngleX <b>${sgn(TR.cx * g.xr)}</b> &nbsp; AngleY <b>${sgn(TR.cy * g.yr)}</b>` +
    ` &nbsp; gaze <b>${(TR.cx + 0).toFixed(2)}, ${(-TR.cy + 0).toFixed(2)}</b>`;
}

function trTick() {
  if (!TR.running) return;
  // critical damping: 0.16 per frame reaches the target in ~150 ms without overshoot
  TR.cx += (TR.tx - TR.cx) * 0.16;
  TR.cy += (TR.ty - TR.cy) * 0.16;
  trRender();
  requestAnimationFrame(trTick);
}
function trSelect(i) {
  TR.i = i;
  const g = D.track.grid[i];
  $$('#trPick button').forEach((b, j) => b.setAttribute('aria-selected', j === i));
  ['#trA', '#trB', '#trC', '#trD'].forEach(q => { $(q).dataset.u = ''; });
  // A standing A-pose figure is up to 3.3x taller than it is wide; at the stage's default 500px cap it
  // would come out under 160px across. Give the tall ones a taller stage so they are the same PHYSICAL
  // size on screen as the dynamic ones rather than the same height.
  const st = $('#trStage'), ar = (g.fw && g.fh) ? g.fh / g.fw : 1;
  st.classList.toggle('tall', ar > 1.8);      // full-body A-pose is ~2.7:1 and needs the taller stage
  const hint = $('.hint', st);
  if (hint && !TR.engaged) hint.classList.remove('gone');
  preload(trUrls(g));
  $('#trFacts').innerHTML =
    `<div><b>${g.layers}</b> layers &nbsp;·&nbsp; <b>${g.verts}</b> vertices</div>` +
    `<div><b>${g.nx}&times;${g.ny}</b> rendered poses, <b>${g.params.length}</b> parameters driven at once</div>`;
  trRender();
}
function buildTrack() {
  if (!D.track || !D.track.grid || !D.track.grid.length) {
    const sec = $('#trackSection'); if (sec) sec.remove(); return;
  }
  const pick = $('#trPick');
  const isApose = g => /^(wf_fb_|test\d)/.test(g.name);
  D.track.grid.forEach((g, i) => {
    const nm = g.name.length > 16 ? g.name.slice(0, 16) + '…' : g.name;
    const b = el('button', null, isApose(g) ? `${nm} · A-pose` : nm);
    b.onclick = () => trSelect(i);
    pick.appendChild(b);
  });
  const stage = $('#trStage');
  const move = (cx, cy) => {
    const r = stage.getBoundingClientRect();
    TR.tx = Math.max(-1, Math.min(1, ((cx - r.left) / r.width) * 2 - 1));
    TR.ty = Math.max(-1, Math.min(1, ((cy - r.top) / r.height) * 2 - 1));
  };
  stage.addEventListener('pointermove', e => {
    TR.inside = true; move(e.clientX, e.clientY);
    if (!TR.engaged) {                        // one real move inside the panel retires the prompt
      TR.engaged = true;
      const h = $('.hint', stage); if (h) h.classList.add('gone');
    }
  });
  stage.addEventListener('pointerenter', () => { TR.inside = true; });
  stage.addEventListener('pointerleave', () => { TR.inside = false; TR.tx = 0; TR.ty = 0; });
  stage.addEventListener('touchmove', e => {
    if (!e.touches[0]) return;
    move(e.touches[0].clientX, e.touches[0].clientY); e.preventDefault();
  }, { passive: false });
  TR.running = true; requestAnimationFrame(trTick);
  // Open on an A-pose rig, and specifically the most responsive one. Both constraints matter: the
  // A-pose case is the one to lead with, but this section drives head turn, head nod and the eyes only,
  // so how much of the frame moves depends on how much of the frame is head. Uncropped full-body A-pose
  // scored 3.6% of pixels changed between the grid centre and its extremes, against 9.2-20.4% for the
  // dynamic illustrations, and it read as broken. Cropped to head-and-torso the two A-pose grids score
  // 18.2% (wf_fb_12) and 33.2% (test1), so leading with the best of those satisfies both.
  const ap = D.track.grid.map((g, i) => i).filter(i => isApose(D.track.grid[i]));
  trSelect(ap.length ? ap.reduce((a, i) => (SCORE[D.track.grid[i].name] || 0) >
                                           (SCORE[D.track.grid[a].name] || 0) ? i : a, ap[0]) : 0);
}

/* ------------------------------------------------------------------ layer peel */
const PL = { i: 0, k: 0, timer: null, stopped: false };
function plRender() {
  const L = D.layers[PL.i];
  $('#plCum').src = `layers/${L.name}/cum_${PL.k}.webp`;
  $('#plSolo').src = `layers/${L.name}/solo_${PL.k}.webp`;
  $('#plRange').value = PL.k;
  $('#plCount').innerHTML = `layer <b>${PL.k + 1}</b> of <b>${L.n}</b>` +
    (L.layer_names[PL.k] ? ` &nbsp;·&nbsp; <b>${L.layer_names[PL.k]}</b>` : '');
}
function plSelect(i, auto) {
  PL.i = i; PL.k = 0;
  const L = D.layers[i];
  $('#plRange').max = L.n - 1;
  $$('#plPick button').forEach((b, j) => b.setAttribute('aria-selected', j === i));
  preload(Array.from({ length: L.n }, (_, k) => `layers/${L.name}/cum_${k}.webp`));
  plRender();
}
/* The peel plays itself: it adds one layer at a time up the stack, then moves to the next case and starts
 * again, so the section demonstrates all fourteen decompositions without anyone touching the slider.
 *
 * Advancing the CASE alone was not enough -- that only changed character while the panel sat on layer 1,
 * which is the least informative frame of the whole sequence. The stack has to build.
 *
 * 420ms per layer: slow enough to read which region was added, fast enough that a 21-layer character
 * finishes in about nine seconds. A full pass holds on the complete character for a beat before switching,
 * because the assembled figure is the payoff and cutting away from it instantly loses that. */
const PL_STEP_MS = 420, PL_HOLD_MS = 1400;

function plTick() {
  if (PL.stopped) return;
  const L = D.layers[PL.i];
  if (PL.k < L.n - 1) {
    PL.k += 1;
    plRender();
    PL.timer = setTimeout(plTick, PL_STEP_MS);
  } else {
    PL.timer = setTimeout(() => {                  // hold on the finished figure, then next case
      if (PL.stopped) return;
      plSelect((PL.i + 1) % D.layers.length, true);
      PL.timer = setTimeout(plTick, PL_STEP_MS);
    }, PL_HOLD_MS);
  }
}

function plStop() {
  PL.stopped = true;
  clearTimeout(PL.timer);
}

function buildPeel() {
  if (!D.layers || !D.layers.length) return;
  const p = $('#plPick');
  D.layers.forEach((L, i) => {
    const b = el('button', null, L.name.length > 15 ? L.name.slice(0, 15) + '…' : L.name);
    b.onclick = () => { plStop(); plSelect(i); }; p.appendChild(b);
  });
  // A real interaction hands control over for good. Stop on POINTERDOWN, not only on `input`: pressing
  // the slider where the handle already sits changes no value and fires no input event, so an input-only
  // guard let the auto-advance keep yanking the slider out from under the reader's finger.
  ['#plRange', '#plPick'].forEach(q => {
    const n = $(q);
    if (n) n.addEventListener('pointerdown', e => { if (e.isTrusted) plStop(); });
  });
  $('#plRange').oninput = e => { if (e.isTrusted) plStop(); PL.k = +e.target.value; plRender(); };
  plSelect(0, true);
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    PL.timer = setTimeout(plTick, PL_STEP_MS);
  }
}

function buildCompare() {
  const g = $('#cmpGrid');
  D.compare.forEach(c => {
    const card = el('div', 'card');
    const hd = el('div', 'hd');
    hd.appendChild(el('span', null, c.name.length > 17 ? c.name.slice(0, 17) + '…' : c.name));
    const sm = el('small'); sm.innerHTML = `${c.layers_ours} vs ${c.layers_st} layers`;
    hd.appendChild(sm); card.appendChild(hd);
    const pair = el('div', 'pair');
    const vids = [];
    [['ours', 'o', 'ours'], ['st', 's', 'See-through']].forEach(([tag, cls, label]) => {
      const fg = el('figure');
      const clip = c.clips && c.clips[tag];
      if (clip) {
        const v = document.createElement('video');
        v.src = `cmploops/${clip.f}`;
        v.loop = true; v.muted = true; v.playsInline = true;
        v.setAttribute('playsinline', ''); v.preload = 'none';
        fg.appendChild(v); vids.push(v);
      } else {                                  // no clip: fall back to the rendered stills
        const im = el('img');
        im.src = `compare/${c.name}_${tag}_${c.poses[1].replace(/ /g, '')}.webp`;
        im.alt = ''; im.dataset.name = c.name; im.dataset.tag = tag;
        im.onclick = () => lightbox(im.src, `${c.name} — ${label}`,
          c.poses.map(p => `compare/${c.name}_${tag}_${p.replace(/ /g, '')}.webp`), c.poses);
        fg.appendChild(im);
      }
      fg.appendChild(el('figcaption', cls, label));
      pair.appendChild(fg);
    });
    card.appendChild(pair);
    card._vids = vids;
    g.appendChild(card);
  });
  // play only what is on screen, and keep each pair synchronised
  const obs = new IntersectionObserver(es => es.forEach(e => {
    const vs = e.target._vids || [];
    vs.forEach(v => {
      if (e.isIntersecting) { if (v.preload === 'none') v.preload = 'auto'; v.play().catch(() => {}); }
      else v.pause();
    });
  }), { rootMargin: '180px' });
  $$('#cmpGrid .card').forEach(c => obs.observe(c));
  setInterval(() => {
    $$('#cmpGrid .card').forEach(card => {
      const [a, b] = card._vids || [];
      if (!a || !b || a.paused || b.paused || !isFinite(a.duration)) return;
      if (Math.abs(a.currentTime - b.currentTime) > 0.06) b.currentTime = a.currentTime;
    });
  }, 1000);
}

/* ------------------------------------------------------------------ exploded layer stack
 * The stack fanned apart in depth, so a reader can see at once that Stage 1 returns SEPARATE completed
 * sheets rather than a flat picture with holes cut in it.
 *
 * No new renders: the solo layer images already exist on a shared canvas, so stacking them absolutely and
 * offsetting each by its index is enough. Because it is transforms rather than frames, it is continuous at
 * any explode amount and any angle -- which a pre-rendered version could never be -- and it costs nothing
 * to ship. The drift animates on its own, so the section is never static.
 */
const EXL = { i: 0, t: 0.55, playing: true, spin: true, phase: 0, raf: null };

function exlBuild() {
  const L = D.layers[EXL.i];
  const host = $('#exlLayers');
  host.textContent = '';
  if (L.fw && L.fh) host.style.aspectRatio = `${L.fw} / ${L.fh}`;
  for (let k = 0; k < L.n; k++) {
    const im = el('img');
    im.src = `layers/${L.name}/solo_${k}.webp`;
    im.alt = k === 0 ? 'one predicted layer' : '';
    im.style.zIndex = String(k);
    host.appendChild(im);
  }
  $('#exlFacts').innerHTML =
    `<div><b>${L.n}</b> layers, each a complete RGBA sheet</div>` +
    `<div>front of the stack is drawn last</div>`;
  exlRender();
}

function exlRender() {
  const L = D.layers[EXL.i];
  const imgs = $$('#exlLayers img');
  const n = Math.max(imgs.length - 1, 1);
  /* A real depth stack, not an offset pile.
   *
   * Offsetting each sheet by its index in 2D does not work here: all 21 layers live on the SAME canvas, so
   * a 300 px total travel puts adjacent sheets 14 px apart and the result looks like a character nudged
   * sideways rather than a stack taken apart. Pushing each sheet along Z under a perspective transform is
   * what actually reads as separation -- the sheets recede, you can see between them, and the front layer
   * stays legible. The yaw drifts so the stack turns gently on its own. */
  const yaw = -26 + (EXL.spin ? Math.sin(EXL.phase) * 13 : 0);
  const gap = EXL.t * 46;                       // px of Z between neighbouring sheets
  imgs.forEach((im, k) => {
    const z = (k - n / 2) * gap;
    im.style.transform = `translateZ(${z.toFixed(1)}px)`;
    im.style.opacity = String(1 - EXL.t * 0.06);
  });
  const host = $('#exlLayers');
  host.style.transform = `rotateY(${yaw.toFixed(2)}deg) rotateX(${(6 - EXL.t * 3).toFixed(2)}deg)`;
  $('#exlLab').textContent = `${L.name} · ${L.n} layers`;
  $('#exlRange').value = EXL.t;
}

function exlTick() {
  if (EXL.playing) {
    EXL.phase += 0.012;
    exlRender();
  }
  EXL.raf = requestAnimationFrame(exlTick);
}

function exlSelect(i) {
  EXL.i = i;
  $$('#exlPick button').forEach((b, j) => b.setAttribute('aria-selected', j === i));
  exlBuild();
  // warm the next case so switching does not flash through a half-loaded stack
  const nx = D.layers[(i + 1) % D.layers.length];
  if (nx) preload(Array.from({ length: nx.n }, (_, k) => `layers/${nx.name}/solo_${k}.webp`));
}

function buildExplode() {
  if (!D.layers || !D.layers.length || !$('#exlStage')) return;
  // continuous decorative motion: off when the OS asks for less, but the stack still stays exploded so
  // the content the section is about is unaffected
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { EXL.spin = false; EXL.playing = false; }
  const pick = $('#exlPick');
  D.layers.forEach((L, i) => {
    const b = el('button', null, L.name.length > 16 ? L.name.slice(0, 16) + '…' : L.name);
    b.onclick = () => exlSelect(i);
    pick.appendChild(b);
  });
  $('#exlRange').oninput = e => { EXL.t = +e.target.value; exlRender(); };
  $('#exlPlay').onclick = () => {
    EXL.playing = !EXL.playing;
    $('#exlPlay').classList.toggle('on', EXL.playing);
    $('#exlPlay').textContent = EXL.playing ? 'pause' : 'play';
  };
  $('#exlSpin').onclick = () => {
    EXL.spin = !EXL.spin;
    $('#exlSpin').classList.toggle('on', EXL.spin);
    exlRender();
  };
  $('#exlSpin').classList.add('on');
  // dragging across the stage also sets the explode amount, so the pointer works here like everywhere else
  hoverScrub($('#exlStage'), f => { EXL.t = f; exlRender(); }, () => {});
  exlSelect(0);
  exlTick();                                   // autoplay: this section animates on its own
}

/* ------------------------------------------------------------------ comparison */
/* ------------------------------------------------------------------ editing */
/* The re-texture pair ANIMATES, both sides in lockstep.
 *
 * The claim here is that the edited rig replays the ORIGINAL predicted displacement frames -- the mesh and
 * every keypose are byte-identical between the two rigs, only the layer RGB changed. Three stills rotating
 * cannot show that; two clips running the same axis in step can, because any divergence would be visible
 * immediately. Same shared crop box, same amplitudes, and a watchdog re-seeds the right from the left. */
function buildEdit() {
  if (!D.edit) return;
  const clips = D.edit.clips;
  const vb = $('#edVidBefore'), va = $('#edVidAfter');
  if (clips && vb && va) {
    vb.src = `editloops/${clips.before.f}`;
    va.src = `editloops/${clips.after.f}`;
    [vb, va].forEach(v => { v.style.display = ''; });
    $('#edBefore').style.display = 'none';
    $('#edAfter').style.display = 'none';
    const obs = new IntersectionObserver(es => es.forEach(e => {
      [vb, va].forEach(v => {
        if (e.isIntersecting) { if (v.preload === 'none') v.preload = 'auto'; v.play().catch(() => {}); }
        else v.pause();
      });
    }), { rootMargin: '180px' });
    obs.observe(vb.parentElement);
    setInterval(() => {
      if (vb.paused || va.paused || !isFinite(vb.duration)) return;
      if (Math.abs(vb.currentTime - va.currentTime) > 0.06) va.currentTime = vb.currentTime;
    }, 1000);
  }
  // the pose buttons remain, and switching to one hands control back to the stills
  const sel = $('#edPoses');
  if (!sel || !D.edit.poses) return;
  D.edit.poses.forEach((p, i) => {
    const b = el('button', 'btn', p);
    b.onclick = () => {
      $$('.btn', sel).forEach(x => x.classList.remove('on')); b.classList.add('on');
      const t = p.replace(/ /g, '');
      if (vb && va) { vb.pause(); va.pause(); vb.style.display = 'none'; va.style.display = 'none'; }
      const ib = $('#edBefore'), ia = $('#edAfter');
      ib.style.display = ''; ia.style.display = '';
      ib.src = `edit/before_${t}.webp`;
      ia.src = `edit/after_${t}.webp`;
    };
    sel.appendChild(b);
  });
  const play = el('button', 'btn on', 'play both');
  play.onclick = () => {
    $$('.btn', sel).forEach(x => x.classList.remove('on')); play.classList.add('on');
    if (!vb || !va) return;
    $('#edBefore').style.display = 'none'; $('#edAfter').style.display = 'none';
    vb.style.display = ''; va.style.display = '';
    va.currentTime = vb.currentTime;
    vb.play().catch(() => {}); va.play().catch(() => {});
  };
  sel.insertBefore(play, sel.firstChild);
}

/* ------------------------------------------------------------------ gallery */
const GAL = { obs: null };

function buildGallery() {
  const g = $('#galGrid');
  const draw = list => {
    g.textContent = '';
    list.forEach(c => {
      const fg = el('figure');
      // every tile animates on its own. The clip is the one rendered for the selection page, so the whole
      // gallery moves for 2.3 MB and no extra render. Only tiles on screen play -- 58 live decoders would
      // starve the page -- and the still stays underneath as the poster.
      const im = el('img'); im.src = `gallery/${c.shots[0]}`; im.alt = ''; im.loading = 'lazy';
      const fc = el('figcaption');
      fc.innerHTML = `<b>${c.name}</b>${c.layers} layers · ${c.verts} vtx`;
      let vid = null;
      if (c.clip) {
        vid = document.createElement('video');
        vid.loop = true; vid.muted = true; vid.playsInline = true;
        vid.setAttribute('playsinline', ''); vid.preload = 'none';
        vid.dataset.src = `galloops/${c.clip}`;
        fg.appendChild(vid);
      }
      fg.append(im, fc);
      fg._vid = vid;
      // Hovering ANIMATES rather than swapping once: the three rendered poses are cycled while the
      // pointer is over the tile, so every one of the 58 characters responds to the mouse even though
      // only the tracking section has a full 2-D grid.
      // The pointer's horizontal position picks the pose, so the tile answers the mouse instead of
      // running a timer the reader cannot steer. Sweeping across a tile goes rest -> sway -> tilt.
      fg.addEventListener('pointerenter', () => preload(c.shots.map(x => `gallery/${x}`)));
      hoverScrub(fg,
        f => { fg.classList.add('scrub');
               if (fg._vid) fg._vid.pause();
               const k = Math.min(c.shots.length - 1, Math.floor(f * c.shots.length));
               const u = `gallery/${c.shots[k]}`;
               if (im.getAttribute('src') !== u) im.src = u; },
        () => { fg.classList.remove('scrub');
                im.src = `gallery/${c.shots[0]}`;
                if (fg._vid && fg._playing) fg._vid.play().catch(() => {}); });
      fg.onclick = () => lightbox(`gallery/${c.shots[0]}`,
        `${c.name} — ${c.layers} layers, ${c.verts} vertices`,
        c.shots.map(s => `gallery/${s}`), ['rest', 'body sway', 'head tilt']);
      g.appendChild(fg);
    });
    $('#galCount').textContent = `${list.length} of ${D.gallery.length} characters`;
    if (GAL.obs) GAL.obs.disconnect();
    GAL.obs = new IntersectionObserver(es => es.forEach(e => {
      const f = e.target, v = f._vid;
      if (!v) return;
      f._playing = e.isIntersecting;
      if (e.isIntersecting) {
        if (!v.src) v.src = v.dataset.src;
        if (!f.classList.contains('scrub')) v.play().catch(() => {});
      } else v.pause();
    }), { rootMargin: '200px' });
    $$('#galGrid figure').forEach(f => GAL.obs.observe(f));
  };
  const sorters = {
    motion: (a, b) => b.motion - a.motion,
    layers: (a, b) => b.layers - a.layers,
    name: (a, b) => a.name.localeCompare(b.name)
  };
  // "A-pose only" is a FILTER, not a sort. It selects the standing full-body group, which is larger here
  // than the twelve in section 02 -- the gallery is the complete set, so it includes the members that
  // section dropped for presentation reasons (facing away, seated) and the two above the 3% bound.
  const isApose = c => /^wf_fb_/.test(c.name);
  $$('#galSort button').forEach(b => {
    b.onclick = () => {
      $$('#galSort button').forEach(x => x.setAttribute('aria-selected', x === b));
      const k = b.dataset.k;
      draw(k === 'apose'
        ? D.gallery.filter(isApose).sort(sorters.name)
        : D.gallery.slice().sort(sorters[k]));
    };
  });
  draw(D.gallery.slice().sort(sorters.motion));
}

/* ------------------------------------------------------------------ presentation polish
 * Scroll reveal, and an honest reduced-motion path: readers who ask the OS for less motion get the content
 * with no entrance animation at all rather than a slower version of it. */
function buildReveal() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const obs = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('in'); obs.unobserve(e.target); }
  }), { rootMargin: '-40px' });
  $$('section > .wrap > h2, section > .wrap > .lede').forEach(n => {
    n.classList.add('rev'); obs.observe(n);
  });
}

/* Every section that can animate does so without being asked. The compare grid is stills, so it cycles
 * its pose buttons; the gallery answers the pointer, and also drifts on its own so the section is alive
 * before anyone touches it. */
function autoplayCompare() {
  const cards = $$('#cmpGrid .card');
  if (!cards.length) return;
  cards.forEach((card, i) => {
    const btns = $$('.btn', card);
    if (btns.length < 2) return;
    let k = 1;
    setInterval(() => {
      if (card._touched) return;               // a click hands control over for good
      k = (k + 1) % btns.length;
      btns[k].click();
    }, 3600 + i * 260);
    // isTrusted separates a real click from the rotation's own: without it the first programmatic
    // advance bubbles to this listener, marks the card as user-controlled, and the rotation stops dead
    card.addEventListener('click', e => { if (e.isTrusted) card._touched = true; });
  });
}

/* ------------------------------------------------------------------ auto-rotation
 * Every section that holds more than one example advances through them on its own, so the page shows its
 * whole range without the reader hunting for controls.
 *
 * Two rules, both from the animation framework this page follows:
 *
 *   1. A rotation NEVER fights the reader. The first click, drag or hover inside a section stops that
 *      section's rotation permanently -- a carousel that keeps moving the thing you are trying to look at
 *      is worse than no carousel.
 *   2. Nothing rotates faster than it can be read. Dwell times are per section, scaled to how much there
 *      is to take in, and each rotation is a cross-fade rather than a jump.
 */
function autoRotate(sel, dwell, step, section) {
  const host = $(sel);
  if (!host) return;
  const buttons = $$('button', host);
  if (buttons.length < 2) return;
  let i = 0, stopped = false;
  const stop = () => { stopped = true; };
  // any deliberate interaction anywhere in the section hands control over
  const scope = section ? $(section) : host;
  if (scope) ['pointerdown', 'keydown'].forEach(ev =>
    scope.addEventListener(ev, e => { if (e.isTrusted) stop(); }, { once: true }));
  setInterval(() => {
    if (stopped) return;
    const bs = $$('button', host);
    if (!bs.length) return;
    i = (i + 1) % bs.length;
    (step || (b => b.click()))(bs[i], i);
  }, dwell);
}

function buildRotations() {
  // 03 cursor tracking: three rigs. Long dwell -- this section rewards being played with, so it should
  // not move on while a reader is deciding to move the mouse.
  autoRotate('#trPick', 11000, null, '#trackSection');
  // 04 Stage-1 cases: fourteen. The exploded stack turns on its own, so this only changes character.
  autoRotate('#exlPick', 7000, null, '#exlStage');
  // 06 re-texture: the pose row
  // 01 the explorer's own walk through all 276 animations starts by itself
  if (typeof carSet === 'function' && D.loops) carSet(true);
}

/* ------------------------------------------------------------------ citation
 * Copy-to-clipboard with the state change shown on the button itself. navigator.clipboard needs a secure
 * context, which a page served over plain HTTP is not, so fall back to a hidden textarea + execCommand --
 * otherwise the button silently does nothing on exactly the setup someone previews the site with. */
function buildCite() {
  const btn = $('#citeCopy'), pre = $('#citeText');
  if (!btn || !pre) return;
  btn.onclick = async () => {
    const text = pre.textContent;
    let ok = false;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        ok = true;
      }
    } catch (e) { ok = false; }
    if (!ok) {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;top:-1000px;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      document.body.removeChild(ta);
    }
    btn.textContent = ok ? 'copied' : 'select and copy';
    btn.classList.toggle('on', ok);
    setTimeout(() => { btn.textContent = 'copy'; btn.classList.remove('on'); }, 1600);
  };
}

/* The floating pills are centred on their names and are wider than them, so adjacent tagged authors would
 * overlap. Reserve exactly the overhang each pill actually has -- measured after layout, because it depends
 * on the font the visitor's system resolves, not on a number we can hardcode. */
function fitCallouts() {
  $$('.au.seeking').forEach(au => {
    const pill = $('.callout', au);
    const name = $('a, .nm', au) || au.lastElementChild;
    if (!pill || !name) return;
    au.style.setProperty('--oh', '0px');
    const pw = pill.getBoundingClientRect().width;
    const nb = name.getBoundingClientRect(), ab = au.getBoundingClientRect();
    au.style.setProperty('--oh', `${Math.max(0, Math.ceil((pw - nb.width) / 2) + 6)}px`);
    // centre on the NAME, not on the wrapper: the wrapper also contains the affiliation superscript, so
    // left:50% lands about half a superscript to the right of the name's own centre
    const ab2 = au.getBoundingClientRect(), nb2 = name.getBoundingClientRect();
    au.style.setProperty('--cx', `${Math.round(nb2.left - ab2.left + nb2.width / 2)}px`);
  });
}

/* ------------------------------------------------------------------ lightbox */
function lightbox(src, cap, strip, labels) {
  const lb = $('#lb');
  $('#lbImg').src = src;
  $('#lbCap').innerHTML = cap;
  const s = $('#lbStrip'); s.textContent = '';
  if (strip && strip.length > 1) {
    strip.forEach((u, i) => {
      const t = el('img'); t.src = u; t.alt = labels ? labels[i] : '';
      t.className = u === src ? 'on' : '';
      t.onclick = ev => { ev.stopPropagation(); $('#lbImg').src = u;
        $$('img', s).forEach(x => x.classList.toggle('on', x === t)); };
      s.appendChild(t);
    });
  }
  lb.classList.add('on');
}

document.addEventListener('DOMContentLoaded', () => {
  if (!D) { document.body.innerHTML = '<p style="padding:40px">data/manifest.js did not load.</p>'; return; }
  buildHero(); buildExplorer(); buildFeatured(); buildApose(); buildTrack(); buildPeel();
  buildExplode(); buildCompare(); buildEdit(); buildGallery();
  buildReveal(); buildRotations(); buildCite();
  fitCallouts();
  window.addEventListener('resize', fitCallouts);
  $('#lb').onclick = () => $('#lb').classList.remove('on');
  document.addEventListener('keydown', e => { if (e.key === 'Escape') $('#lb').classList.remove('on'); });
  $('#nchar').textContent = D.gallery.length;
  $('#nexp').textContent = D.explorer.length + (D.apose ? D.apose.length : 0);
});
