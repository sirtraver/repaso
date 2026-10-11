'use strict';
const $app = document.getElementById('app');
const S = { idx: null, exams: [], temas: {} };
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\(.*?\)/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const nice = s => { let t = String(s || '').replace(/\s*\((?:[^()]*)\)/g, '').replace(/^\s*iniciaci[oó]n\s+a\s+/i, '').replace(/\s+/g, ' ').trim(); if (t === t.toUpperCase()) t = t.toLowerCase().replace(/^./, c => c.toUpperCase()); return t; };
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem('repaso:' + k)) || {}; } catch { return {}; } },
  set(k, v) { localStorage.setItem('repaso:' + k, JSON.stringify(v)); }
};
async function getJSON(u) { const r = await fetch(u, { cache: 'no-cache' }); if (!r.ok) throw new Error(u); return r.json(); }
async function tema(file) { return S.temas[file] || (S.temas[file] = await getJSON(file)); }
function examFor(asig) {
  const a = norm(asig);
  return S.exams.filter(e => { const b = norm(e.asignatura); return a === b || a.startsWith(b) || b.startsWith(a); })
    .filter(e => new Date(e.fecha) > Date.now() - 864e5).sort((x, y) => new Date(x.fecha) - new Date(y.fecha))[0];
}
function daysTo(f) { return Math.ceil((new Date(f) - Date.now()) / 864e5); }
function fmtDate(f) { return new Date(f).toLocaleString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' }); }
function progress(t) { const m = store.get(t.file); const n = t.tarjetas || 0; const k = Object.values(m).filter(v => v === 'sabida').length; return { k, n, p: n ? Math.round(k / n * 100) : 0 }; }

function home() {
  const subs = [...S.idx.asignaturas].map(s => ({ s, e: examFor(s.asignatura) }))
    .sort((a, b) => (a.e ? new Date(a.e.fecha) : Infinity) - (b.e ? new Date(b.e.fecha) : Infinity) || a.s.asignatura.localeCompare(b.s.asignatura));
  const next = subs.find(x => x.e);
  $app.innerHTML = `<p class="kicker">Curso 2026–27</p><h1>Asignaturas</h1>
  ${next ? `<p class="lead">Próximo examen: <strong>${esc(next.e.titulo || nice(next.s.asignatura))}</strong>, ${esc(fmtDate(next.e.fecha))}.</p>${next.e.nota ? `<p class="note">${esc(next.e.nota)}</p>` : ''}` : ''}
  <ul class="list">${subs.map(({ s, e }) => {
    const pr = s.temas.map(progress); const k = pr.reduce((a, b) => a + b.k, 0), n = pr.reduce((a, b) => a + b.n, 0);
    const d = e && daysTo(e.fecha);
    return `<li><a href="#/a/${s.slug}"><div><div class="t">${esc(nice(s.asignatura))}</div>
    <div class="m">${s.temas.length} tema${s.temas.length !== 1 ? 's' : ''} · ${k}/${n} tarjetas sabidas</div>
    <div class="bar"><i style="width:${n ? k / n * 100 : 0}%"></i></div></div>
    ${e ? `<div class="count"><b>${d <= 0 ? 'Hoy' : d}</b>${d <= 0 ? '' : d === 1 ? 'día' : 'días'}</div>` : ''}</a></li>`;
  }).join('') || '<li class="empty">Todavía no hay apuntes.</li>'}</ul>`;
}
function subject(slug) {
  const s = S.idx.asignaturas.find(x => x.slug === slug); if (!s) return notFound();
  const e = examFor(s.asignatura);
  $app.innerHTML = `<a class="back" href="#/">← Asignaturas</a><p class="kicker">Asignatura</p><h1>${esc(nice(s.asignatura))}</h1>
  ${e ? `<p class="lead">${esc(e.titulo || 'Examen')}: ${esc(fmtDate(e.fecha))} · faltan ${daysTo(e.fecha)} días</p>${e.nota ? `<p class="note">${esc(e.nota)}</p>` : ''}` : ''}
  <ul class="list">${s.temas.map((t, i) => { const p = progress(t); return `<li><a href="#/t/${slug}/${i}"><span class="num">${esc(String(t.tema).padStart(2, '0'))}</span>
  <div style="flex:1"><div class="t">${esc(t.titulo)}</div><div class="m">${p.k}/${p.n} tarjetas · ${p.p}%</div><div class="bar"><i style="width:${p.p}%"></i></div></div></a></li>`; }).join('')}</ul>`;
}
const TABS = [['resumen', 'Resumen'], ['conceptos', 'Conceptos'], ['tablas', 'Tablas'], ['esquemas', 'Esquemas'], ['tarjetas', 'Tarjetas']];
async function topic(slug, i, tab = 'resumen') {
  const s = S.idx.asignaturas.find(x => x.slug === slug); const t = s && s.temas[+i]; if (!t) return notFound();
  const d = await tema(t.file);
  $app.innerHTML = `<a class="back" href="#/a/${slug}">← ${esc(nice(s.asignatura))}</a><p class="kicker">Tema ${esc(d.tema)}</p><h1>${esc(d.titulo)}</h1>
  <nav class="tabs" role="tablist">${TABS.map(([k, l]) => `<button role="tab" aria-selected="${k === tab}" data-tab="${k}">${l}</button>`).join('')}</nav><section id="pane"></section>`;
  $app.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { history.replaceState(null, '', `#/t/${slug}/${i}/${b.dataset.tab}`); topic(slug, i, b.dataset.tab); });
  const pane = document.getElementById('pane');
  const src = f => f ? `<small class="src">Fuente: ${esc(f)}</small>` : '';
  const none = '<p class="empty">Sin contenido en este apartado.</p>';
  if (tab === 'resumen') pane.innerHTML = String(d.resumen || '').split(/\n\s*\n/).map((p, j) => `<p class="${j ? '' : 'lead'}">${esc(p)}</p>`).join('') +
    (d.fuentes?.length ? `<h2>Fuentes</h2>${[].concat(d.fuentes).map(f => `<p class="src">${esc(typeof f === 'string' ? f : JSON.stringify(f))}</p>`).join('')}` : '');
  if (tab === 'conceptos') pane.innerHTML = (d.conceptos || []).map(c => `<div class="concept"><dt>${esc(c.termino)}</dt><dd>${esc(c.definicion)}${src(c.fuente)}</dd></div>`).join('') || none;
  if (tab === 'tablas') pane.innerHTML = (d.tablas || []).map(tb => `<h2>${esc(tb.titulo)}</h2><div class="tablewrap"><table><thead><tr>${(tb.columnas || []).map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${(tb.filas || []).map(r => `<tr>${[].concat(r).map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>${src(tb.fuente)}`).join('') || none;
  if (tab === 'esquemas') pane.innerHTML = (d.esquemas || []).map(e => `<h2>${esc(e.titulo)}</h2><ol class="steps">${(e.pasos || []).map(p => `<li>${esc(typeof p === 'string' ? p : JSON.stringify(p))}</li>`).join('')}</ol>${src(e.fuente)}`).join('') || none;
  if (tab === 'tarjetas') cards(pane, t, d);
}
function cards(pane, t, d) {
  const all = (d.tarjetas || []).map((c, j) => ({ ...c, j }));
  if (!all.length) { pane.innerHTML = '<p class="empty">Sin tarjetas.</p>'; return; }
  let deck = all.slice(), pos = 0, flipped = false, filter = false;
  const draw = () => {
    const m = store.get(t.file);
    const src = filter ? all.filter(c => m[c.j] !== 'sabida') : all;
    if (deck.some(c => !src.includes(c)) || deck.length !== src.length) { deck = deck.filter(c => src.includes(c)); src.forEach(c => { if (!deck.includes(c)) deck.push(c); }); }
    if (pos >= deck.length) pos = 0;
    const k = Object.values(m).filter(v => v === 'sabida').length;
    const c = deck[pos];
    pane.innerHTML = `<div class="toolbar"><button class="btn" id="shuf">Barajar</button><button class="btn" id="filt" aria-pressed="${filter}">Solo pendientes</button>
      <span class="meta">${k}/${all.length} sabidas</span></div>
      ${c ? `<p class="meta">${pos + 1} de ${deck.length}${m[c.j] ? ` · <span class="ok">${m[c.j]}</span>` : ''}</p>
      <button class="card ${flipped ? 'flipped' : ''}" id="card" aria-live="polite"><div class="side">${flipped ? 'Respuesta' : 'Pregunta · toca para girar'}</div>
      <div class="${flipped ? 'a' : 'q'}">${esc(flipped ? c.respuesta : c.pregunta)}</div></button>
      <div class="mark"><button class="btn acc" id="rep">Repasar</button><button class="btn pri" id="sab">Sabida</button></div>
      <div class="mark"><button class="btn" id="prev">← Anterior</button><button class="btn" id="next">Siguiente →</button></div>`
      : `<p class="lead">¡Todas sabidas!</p><button class="btn" id="reset">Reiniciar progreso</button>`}`;
    const on = (id, f) => { const el = document.getElementById(id); if (el) el.onclick = f; };
    on('shuf', () => { for (let x = deck.length - 1; x > 0; x--) { const y = Math.floor(Math.random() * (x + 1)); [deck[x], deck[y]] = [deck[y], deck[x]]; } pos = 0; flipped = false; draw(); });
    on('filt', () => { filter = !filter; pos = 0; flipped = false; draw(); });
    on('card', () => { flipped = !flipped; draw(); });
    const mark = v => { const mm = store.get(t.file); mm[c.j] = v; store.set(t.file, mm); flipped = false; if (!(filter && v === 'sabida')) pos++; draw(); };
    on('sab', () => mark('sabida')); on('rep', () => mark('repasar'));
    on('prev', () => { pos = (pos - 1 + deck.length) % deck.length; flipped = false; draw(); });
    on('next', () => { pos = (pos + 1) % deck.length; flipped = false; draw(); });
    on('reset', () => { store.set(t.file, {}); filter = false; draw(); });
  };
  draw();
}
async function search(q = '') {
  $app.innerHTML = `<a class="back" href="#/">← Asignaturas</a><h1>Buscar</h1><input type="search" id="q" placeholder="Término, idea, pregunta…" autocomplete="off" value="${esc(q)}"><div id="res"></div>`;
  const inp = document.getElementById('q'); inp.focus();
  const docs = [];
  for (const s of S.idx.asignaturas) for (const [i, t] of s.temas.entries()) {
    const d = await tema(t.file); const base = `#/t/${s.slug}/${i}`; const where = `${nice(s.asignatura)} · Tema ${d.tema}`;
    docs.push({ h: base + '/resumen', t: d.titulo, x: d.resumen, w: where + ' · Resumen' });
    (d.conceptos || []).forEach(c => docs.push({ h: base + '/conceptos', t: c.termino, x: c.definicion, w: where + ' · Concepto', f: c.fuente }));
    (d.tablas || []).forEach(tb => docs.push({ h: base + '/tablas', t: tb.titulo, x: (tb.filas || []).flat().join(' · '), w: where + ' · Tabla' }));
    (d.esquemas || []).forEach(e => docs.push({ h: base + '/esquemas', t: e.titulo, x: (e.pasos || []).join(' → '), w: where + ' · Esquema' }));
    (d.tarjetas || []).forEach(c => docs.push({ h: base + '/tarjetas', t: c.pregunta, x: c.respuesta, w: where + ' · Tarjeta' }));
  }
  const run = () => {
    const q = norm(inp.value); const res = document.getElementById('res');
    history.replaceState(null, '', '#/buscar/' + encodeURIComponent(inp.value));
    if (q.length < 2) { res.innerHTML = '<p class="empty">Escribe al menos dos letras.</p>'; return; }
    const terms = q.split(' ');
    const hits = docs.filter(d => { const s = norm(d.t + ' ' + d.x); return terms.every(w => s.includes(w)); }).slice(0, 60);
    const hl = s => { let h = esc(s); terms.forEach(w => { if (w) h = h.replace(new RegExp('(' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi'), '<mark>$1</mark>'); }); return h; };
    res.innerHTML = `<p class="meta">${hits.length} resultado${hits.length !== 1 ? 's' : ''}</p><ul class="list">${hits.map(d => `<li><a href="${d.h}"><div><div class="m">${esc(d.w)}</div><div class="t">${hl(d.t)}</div><div class="m">${hl(String(d.x || '').slice(0, 220))}</div>${d.f ? `<small class="src">Fuente: ${esc(d.f)}</small>` : ''}</div></a></li>`).join('')}</ul>`;
  };
  inp.oninput = run; run();
}
function notFound() { $app.innerHTML = '<h1>No encontrado</h1><a class="back" href="#/">← Volver</a>'; }
async function route() {
  const p = location.hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent);
  window.scrollTo(0, 0);
  if (p[0] === 'a') return subject(p[1]);
  if (p[0] === 't') return topic(p[1], p[2], p[3] || 'resumen');
  if (p[0] === 'buscar') return search(p[1] || '');
  home();
}
(async () => {
  try {
    S.idx = await getJSON('data/index.json');
    try { S.exams = await getJSON('data/examenes.json'); } catch { S.exams = []; }
  } catch { $app.innerHTML = '<h1>Sin conexión</h1><p>No se pudieron cargar los apuntes. Abre la app una vez con conexión.</p>'; return; }
  addEventListener('hashchange', route); route();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
})();
