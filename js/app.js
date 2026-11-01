// Satisfacción del cliente · SGC Silver Industrial (ISO 9001, 9.1.2)
// El cálculo es el de la planilla: índice = Σ(nota × peso) ÷ (escala × Σ pesos). Los datos viven en la API (Neon).
const API = (window.SAT_API || '').replace(/\/$/, '');
const KEY = 'sat-clave';
const D1 = ['Calidad del producto', 'Cumplimiento de fechas', 'Asesoramiento', 'Comunicación efectiva'];
const D2 = ['Calidad del producto', 'Cumplimiento de fechas', 'Flexibilidad', 'Asesoramiento', 'Comunicación efectiva'];
const TEMAS = ['Calidad del producto', 'Cumplimiento de fechas', 'Flexibilidad', 'Asesoramiento', 'Comunicación efectiva', 'Otro'];
const ESTADOS = ['Propuesta', 'Aprobada en RxD', 'En curso', 'Cumplida', 'Descartada'];
const DEF = { w1: [2, 2, 1, 1], w2: [2, 2, 1.5, 1, 1], meta: 87 };

const S = { list: [], rxd: { revisiones: [], valores: [] }, anio: null, E: null, tab: 'res', solo: false, up: null };

const $ = id => document.getElementById(id);
const q = s => document.querySelectorAll(s);
const f1 = n => n.toFixed(1).replace('.', ',');
const f2 = n => n.toFixed(2).replace('.', ',');
const fp = n => (Number.isInteger(n) ? String(n) : f1(n));
const sum = a => a.reduce((x, y) => x + y, 0);
const esc = s => String(s ?? '').replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
const idx = (v, w, mx) => sum(v.map((x, i) => x * w[i])) / (mx * sum(w)) * 100;
const col = c => (c === 'ok' ? 'good' : c === 'wa' ? 'warn' : 'crit');

function toast(m, bad) {
  const t = $('toast'); t.textContent = m; t.className = 'toast' + (bad ? ' bad' : ''); t.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => (t.hidden = true), bad ? 6000 : 3800);
}

/* ---------------- API ---------------- */
async function api(path, opt = {}) {
  let r;
  try {
    r = await fetch(API + path, {
      method: opt.method || 'GET',
      headers: { 'Content-Type': 'application/json', 'X-Clave': localStorage.getItem(KEY) || '' },
      body: opt.body === undefined ? undefined : JSON.stringify(opt.body),
    });
  } catch { throw new Error('No se pudo conectar con la API. Revisá la conexión o que el Worker esté activo.'); }
  let j = null; try { j = await r.json(); } catch { /* sin cuerpo */ }
  if (r.status === 401) { showLogin(); throw new Error('Clave incorrecta.'); }
  if (!r.ok) { const e = new Error((j && j.error) || 'Error ' + r.status); e.status = r.status; e.data = j; throw e; }
  return j;
}
function showLogin(msg) { $('login').hidden = false; $('loginErr').textContent = msg || ''; $('clave').focus(); }
$('loginForm').onsubmit = async ev => {
  ev.preventDefault(); localStorage.setItem(KEY, $('clave').value); $('loginErr').textContent = '';
  try { await init(); $('login').hidden = true; $('clave').value = ''; } catch (e) { $('loginErr').textContent = e.message; }
};

/* ---------------- datos y cálculo ---------------- */
function rows() { return S.E ? S.E.respuestas : []; }
function enc() { return S.E.encuesta; }
function cls(p) { const m = enc().meta; return p >= m ? 'ok' : p >= m - 5 ? 'wa' : 'ko'; }
function calc() {
  const e = enc();
  const cl = rows().map(r => ({ ...r, i1: idx(r.e1, e.w1, 5), i2: idx(r.e2, e.w2, 3) }));
  const n = cl.length, d = n || 1;
  const g1 = sum(cl.map(c => c.i1)) / d, g2 = sum(cl.map(c => c.i2)) / d;
  return {
    cl, n, g1, g2,
    d1: D1.map((_, k) => sum(cl.map(c => c.e1[k])) / d / 5 * 100),
    d2: D2.map((_, k) => sum(cl.map(c => c.e2[k])) / d / 3 * 100),
    p1: Math.round(g1 * sum(e.w1) * 5 * d) / 100, p2: Math.round(g2 * sum(e.w2) * 3 * d) / 100,
    m1: sum(e.w1) * 5 * n, m2: sum(e.w2) * 3 * n, resp: e.enviadas ? n / e.enviadas * 100 : null,
  };
}
// señales de la voz del cliente: las de puntaje salen solas, el resto son comentarios clasificados a mano
function senales(c) {
  const out = [];
  c.cl.forEach(r => {
    r.e1.forEach((v, k) => { if (v <= 3) out.push({ cliente: r.cliente, tema: D1[k], tono: '-', origen: 'puntaje', texto: `1.ª etapa: ${D1[k]} ${v} de 5` }); });
    r.e2.forEach((v, k) => { if (v <= 2) out.push({ cliente: r.cliente, tema: D2[k], tono: '-', origen: 'puntaje', texto: `2.ª etapa: ${D2[k]} ${v === 1 ? 'peor' : 'igual'} que la competencia` }); });
  });
  S.E.voc.forEach(v => out.push({ ...v }));
  return out;
}
function prioridades(c) {
  const sg = senales(c), meta = enc().meta;
  return TEMAS.map(t => {
    const neg = sg.filter(s => s.tema === t && s.tono === '-');
    const cli = [...new Set(neg.map(s => s.cliente).filter(Boolean))];
    const pcts = []; const i1 = D1.indexOf(t), i2 = D2.indexOf(t);
    if (i1 >= 0) pcts.push(c.d1[i1]); if (i2 >= 0) pcts.push(c.d2[i2]);
    const pc = pcts.length ? Math.min(...pcts) : null;
    const pos = sg.filter(s => s.tema === t && s.tono === '+').length;
    const pr = pc !== null && c.n && pc < meta ? 'Alta' : cli.length >= 3 ? 'Media' : 'Baja';
    return { t, pc, cli, pos, pr };
  }).filter(x => x.pc !== null || x.cli.length || x.pos)
    .sort((a, b) => ({ Alta: 0, Media: 1, Baja: 2 }[a.pr] - { Alta: 0, Media: 1, Baja: 2 }[b.pr]) || b.cli.length - a.cli.length);
}

/* ---------------- carga de CSV ---------------- */
function parseCSV(txt) {
  txt = txt.replace(/^﻿/, '');
  const first = txt.split(/\r?\n/)[0];
  const cnt = ch => (first.match(new RegExp(ch === '\t' ? '\t' : '\\' + ch, 'g')) || []).length;
  const d = [',', ';', '\t'].map(ch => [ch, cnt(ch)]).sort((a, b) => b[1] - a[1])[0][0];
  const out = []; let row = [], cur = '', inq = false;
  for (let i = 0; i < txt.length; i++) {
    const ch = txt[i];
    if (inq) { if (ch === '"') { if (txt[i + 1] === '"') { cur += '"'; i++; } else inq = false; } else cur += ch; }
    else if (ch === '"') inq = true;
    else if (ch === d) { row.push(cur); cur = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && txt[i + 1] === '\n') i++; row.push(cur); out.push(row); row = []; cur = ''; }
    else cur += ch;
  }
  if (cur !== '' || row.length) { row.push(cur); out.push(row); }
  return out.filter(r => r.some(x => x.trim() !== ''));
}
const nz = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
function autoMap(h) {
  const H = h.map(nz), m = { fecha: -1, cliente: -1, contacto: -1, com: [] };
  D1.forEach((_, k) => (m['a' + k] = -1)); D2.forEach((_, k) => (m['b' + k] = -1));
  // [expresión, índice en la 1.ª etapa (null si no existe), índice en la 2.ª]
  const dimKey = [[/calidad/, 0, 0], [/cumpl|plazo|entrega/, 1, 1], [/flexib/, null, 2], [/asesor/, 2, 3], [/comunic|atenci|telef/, 3, 4]];
  const marca = H.some(x => /\(1\)\s*$/.test(x));   // el formulario marca la 1.ª etapa con «(1)» al final
  const seen = {};
  H.forEach((x, i) => {
    if (/marca temporal|^fecha|timestamp/.test(x) && m.fecha < 0) { m.fecha = i; return; }
    if (/empresa|cliente|razon social/.test(x) && !/calidad|cumpl|flexib|asesor|atenci|comunic/.test(x) && m.cliente < 0) { m.cliente = i; return; }
    if (/contacto|^nombre|persona|completa|usuario/.test(x) && m.contacto < 0) { m.contacto = i; return; }
    for (const [re, k1, k2] of dimKey) {
      if (re.test(x)) {
        const comp = /competencia|respecto|compar|mejor que|peor que/.test(x);
        const n = (seen[k2] = (seen[k2] || 0) + 1);
        const etapa1 = marca ? /\(1\)\s*$/.test(x) : (k1 !== null && !comp && n === 1);
        if (etapa1 && k1 !== null) { if (m['a' + k1] < 0) m['a' + k1] = i; } else if (m['b' + k2] < 0) m['b' + k2] = i;
        return;
      }
    }
    if (/coment|sugerenc|observ|oportunidad|opini|motivo|mejorar|detalle/.test(x)) m.com.push(i);
  });
  return m;
}
function toNum(v, mx) {
  const s = nz(v).trim(); if (!s) return null;
  const mm = s.match(/^(\d+(?:[.,]\d+)?)/);
  if (mm) { const n = parseFloat(mm[1].replace(',', '.')); return Number.isInteger(n) && n >= 1 && n <= mx ? n : null; }
  const T = mx === 5 ? { 'muy malo': 1, malo: 2, regular: 3, bueno: 4, 'muy bueno': 5, excelente: 5 } : { peor: 1, igual: 2, mejor: 3 };
  for (const k of Object.keys(T).sort((a, b) => b.length - a.length)) if (s.includes(k)) return T[k];
  return null;
}
function fechaTxt(v) {
  const s = String(v || '').trim();
  const a = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/); if (a) return a[1].padStart(2, '0') + '/' + a[2].padStart(2, '0') + '/' + a[3];
  const b = s.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/); return b ? `${b[3].padStart(2, '0')}/${b[2].padStart(2, '0')}/${b[1]}` : s;
}
const normCli = s => nz(s).replace(/\s+/g, ' ').trim();
function buildRows(U) {
  const out = [], bad = [];
  U.data.forEach((r, ix) => {
    const g = i => (i >= 0 ? r[i] : '');
    const e1 = D1.map((_, k) => toNum(g(U.map['a' + k]), 5)), e2 = D2.map((_, k) => toNum(g(U.map['b' + k]), 3));
    const cli = (g(U.map.cliente) || '').trim();
    if (!cli || e1.includes(null) || e2.includes(null)) { bad.push(ix + 2); return; }
    out.push({ fecha: fechaTxt(g(U.map.fecha)), cliente: cli, e1, e2, comentario: U.map.com.map(i => (r[i] || '').trim()).filter(Boolean).join(' · ') });
  });
  return { out, bad };
}
function openUpload(file) {
  const rd = new FileReader();
  rd.onload = () => {
    const t = parseCSV(rd.result);
    if (t.length < 2) { toast('El archivo no tiene filas de respuestas.', 1); return; }
    S.up = { name: file.name, head: t[0], data: t.slice(1), map: autoMap(t[0]), modo: 'add' }; draw();
  };
  rd.readAsText(file);
}
function vUp() {
  const U = S.up, H = U.head;
  const opt = sel => '<option value="-1">— sin columna —</option>' + H.map((h, i) => `<option value="${i}" ${sel === i ? 'selected' : ''}>${esc(h.length > 46 ? h.slice(0, 44) + '…' : h)}</option>`).join('');
  const sel = (key, label) => `<label class="mrow"><span>${label}</span><select data-m="${key}">${opt(U.map[key])}</select></label>`;
  const { out, bad } = buildRows(U);
  const ya = new Set(rows().map(r => normCli(r.cliente)));
  const dup = out.filter(o => ya.has(normCli(o.cliente))).length;
  return `<div class="ov"><div class="pn"><h3>Cargar encuestas desde CSV</h3><div class="sub">${esc(U.name)} · ${U.data.length} filas · revisá que cada dato apunte a la columna correcta · se carga en la encuesta ${S.anio}</div>
  <div class="mgrid"><div><b class="mh">Datos</b>${sel('fecha', 'Fecha')}${sel('cliente', 'Cliente')}${sel('contacto', 'Contacto (no se guarda)')}
  <label class="mrow"><span>Comentarios</span><span class="det">${U.map.com.length ? U.map.com.map(i => esc(H[i])).join(' · ') : 'ninguna columna detectada'}</span></label></div>
  <div><b class="mh">1.ª etapa · hacia Silver</b>${D1.map((n, k) => sel('a' + k, n)).join('')}</div>
  <div><b class="mh">2.ª etapa · frente a la competencia</b>${D2.map((n, k) => sel('b' + k, n)).join('')}</div></div>
  <div class="note" style="margin:12px 0 8px">Se pueden importar <b>${out.length}</b> de ${U.data.length} respuestas${bad.length ? `; las filas ${bad.slice(0, 8).join(', ')}${bad.length > 8 ? '…' : ''} quedan afuera por falta de cliente o de alguna nota` : ''}. ${dup ? `<b>${dup}</b> ya existen (mismo cliente) y se omiten al agregar.` : ''}</div>
  <div class="toolbar"><label><input type="radio" name="modo" value="add" ${U.modo === 'add' ? 'checked' : ''}> Agregar a las ya cargadas</label><label><input type="radio" name="modo" value="rep" ${U.modo === 'rep' ? 'checked' : ''}> Reemplazar todas</label><span class="spacer"></span><button id="upCancel">Cancelar</button><button class="pri" id="upOk" ${out.length ? '' : 'disabled'}>Importar ${out.length}</button></div></div></div>`;
}

/* ---------------- vistas ---------------- */
const TABS = [['res', 'Resultados', 'Índice y publicación'], ['cli', 'Por cliente', 'Respuestas'], ['voc', 'Voz del cliente', 'Análisis y acciones'], ['his', 'Histórico', 'Apéndice C'], ['pon', 'Ponderación', 'Pesos y meta']];
function nav() {
  $('tabs').innerHTML = TABS.map(t => `<a href="#" data-t="${t[0]}" ${S.tab === t[0] ? 'aria-current="page"' : ''}>${t[1]}<small>${t[2]}</small></a>`).join('');
  q('#tabs a').forEach(a => (a.onclick = e => { e.preventDefault(); S.tab = a.dataset.t; draw(); }));
}
function dimBars(names, vals, w) {
  const meta = enc().meta;
  return names.map((n, i) => `<div class="sc2 ${cls(vals[i])}"><div class="nm">${n}<small>peso ×${String(w[i]).replace('.', ',')}</small></div><div class="track"><i style="width:${vals[i]}%"></i><u style="left:${meta}%" title="Meta"></u></div><div class="vv">${f1(vals[i])}%</div></div>`).join('');
}
function rxdValor(clave, anio) { return S.rxd.valores.find(v => v.clave === clave && v.anio === anio); }
function vPublicar(c) {
  const e = enc();
  const revs = S.E.rxd.revisiones;
  if (!revs.length) return '';
  const def = (revs.find(r => r.estado === 'borrador') || revs[0]).anio;
  const sel = S.pubAnio && revs.some(r => r.anio === S.pubAnio) ? S.pubAnio : def;
  const prev = rxdValor('satisfaccion', sel), prevR = rxdValor('resp_encuesta', sel);
  const listo = c.n > 0 && e.enviadas > 0;
  return `<div class="card" style="margin-top:12px"><h3>Publicar en la revisión por la dirección</h3>
  <div class="sub">Escribe el índice de la 1.ª etapa y el nivel de respuesta en los indicadores de la RxD del año que elijas. Nunca lo hace sola.</div>
  <div class="toolbar"><label for="pubAnio" class="det">Revisión</label><select id="pubAnio">${revs.map(r => `<option value="${r.anio}" ${r.anio === sel ? 'selected' : ''}>RxD ${r.anio} (${esc(r.estado)})</option>`).join('')}</select>
  <button class="pri" id="btnPub" ${listo ? '' : 'disabled'}>Publicar ${c.n ? f1(c.g1) + '%' : ''}</button></div>
  <p class="det">Hoy en la RxD ${sel}: satisfacción <b>${prev ? f2(prev.valor) + '%' : 'sin dato'}</b>, nivel de respuesta <b>${prevR ? prevR.valor + '%' : 'sin dato'}</b>. ${prev && c.n ? 'Si publicás, se reemplazan (queda registrado en el historial de la RxD).' : ''}${listo ? '' : ' Para publicar hacen falta respuestas cargadas y la cantidad de encuestas enviadas.'}</p></div>`;
}
function vRes(c) {
  const e = enc(), meta = e.meta;
  const lows = c.cl.filter(x => x.i2 < meta || x.i1 < meta);
  const dimLow = [...D1.map((n, k) => ['1.ª', n, c.d1[k]]), ...D2.map((n, k) => ['2.ª', n, c.d2[k]])].filter(x => x[2] < meta);
  const al = [];
  if (c.n) {
    dimLow.forEach(x => al.push(['ko', `${x[1]} (${x[0]} etapa) en ${f1(x[2])}%`, `Por debajo de la meta de ${meta}%. Está en Voz del cliente como candidata a acción.`]));
    if (lows.length) al.push(['wa', `${lows.length} clientes bajo la meta`, lows.map(x => `${esc(x.cliente)} (${f1(Math.min(x.i1, x.i2))}%)`).join(', ') + '. Los promedios los esconden; conviene contactarlos.']);
    if (c.resp !== null && c.resp < 60) al.push(['wa', `Cobertura ${f1(c.resp)}%: ${c.n} de ${e.enviadas} encuestas enviadas`, `Con ${c.n} respuestas, un solo cliente mueve el índice varios puntos. Informar siempre n junto al índice.`]);
    if (!e.enviadas) al.push(['wa', 'Falta cargar las encuestas enviadas', 'Sin ese dato no se puede calcular el nivel de respuesta ni publicar en la RxD.']);
  }
  if (!c.n) return `<div class="note">Esta encuesta todavía no tiene respuestas. Usá <b>Cargar encuestas (CSV)</b> con el archivo descargado de la hoja de respuestas del formulario.</div>`;
  const tile = (lab, v, sm, ccls) => `<div class="card tile" style="--c:var(--${col(ccls)})"><div class="lab">${lab}</div><div class="big num">${v}</div><div class="sm num">${sm}</div></div>`;
  return `<div class="note">Índice = puntos ponderados ÷ puntos máximos, igual que la planilla. Los pesos se editan en <b>Ponderación</b>.${e.nota ? ' · ' + esc(e.nota) : ''}</div>
  <div class="grid g3" style="margin-bottom:12px">
   ${tile('1.ª etapa · hacia Silver', f1(c.g1) + '%', `${fp(c.p1)} de ${fp(c.m1)} puntos · meta ${meta}%`, cls(c.g1))}
   ${tile('2.ª etapa · frente a la competencia', f1(c.g2) + '%', `${fp(c.p2)} de ${fp(c.m2)} puntos · meta ${meta}%`, cls(c.g2))}
   <div class="card tile" style="--c:var(--warn)"><div class="lab">Nivel de respuesta</div><div class="big num">${c.resp === null ? '—' : f1(c.resp).replace(',0', '') + '%'}</div><div class="sm">${c.n} respondieron de ${e.enviadas || '¿?'} enviadas</div></div>
  </div>
  <div class="grid g2" style="margin-bottom:12px">
   <div class="card"><h3>1.ª etapa · calificación hacia Silver</h3><div class="sub">Escala 1 a 5 · promedio por dimensión sobre el máximo · la línea negra es la meta</div>${dimBars(D1, c.d1, e.w1)}</div>
   <div class="card"><h3>2.ª etapa · Silver frente a la competencia</h3><div class="sub">Escala 1 peor · 2 igual · 3 mejor</div>${dimBars(D2, c.d2, e.w2)}</div>
  </div>
  <div class="card"><h3>Alertas para la revisión por la dirección</h3><div class="sub">Se calculan solas con los datos cargados</div><div class="al">${al.map(a => `<div style="--c:var(--${a[0] === 'ko' ? 'crit' : 'warn'})"><b>${a[1]}</b>${a[2]}</div>`).join('') || '<div style="--c:var(--good)"><b>Sin alertas</b>Todas las dimensiones cumplen la meta.</div>'}</div></div>${vPublicar(c)}`;
}
function vCli(c) {
  const meta = enc().meta;
  const list = S.solo ? c.cl.filter(x => x.i1 < meta || x.i2 < meta) : c.cl;
  const cell = (v, mx) => `<td class="cellv ${v <= mx * 0.4 ? 'v1' : v <= mx * 0.6 ? 'v2' : ''}">${v}</td>`;
  return `<div class="toolbar"><div class="seg"><button aria-pressed="${!S.solo}" id="b_all">Todos (${c.n})</button> <button aria-pressed="${S.solo}" id="b_low">Bajo la meta</button></div><span class="det">En rojo y ámbar las notas bajas. El índice es el ponderado de cada etapa.</span></div>
  <div class="tw"><table><thead><tr><th>Cliente</th><th>Fecha</th><th class="cellv">Calidad</th><th class="cellv">Fechas</th><th class="cellv">Asesor.</th><th class="cellv">Comunic.</th><th class="cellv">Índice 1.ª</th><th class="cellv">Calidad</th><th class="cellv">Fechas</th><th class="cellv">Flexib.</th><th class="cellv">Asesor.</th><th class="cellv">Comunic.</th><th class="cellv">Índice 2.ª</th><th></th></tr></thead><tbody>
  ${list.map(r => `<tr class="${r.i1 < meta || r.i2 < meta ? 'row-flag' : ''}"><td><b>${esc(r.cliente)}</b>${r.comentario ? `<div class="det">“${esc(r.comentario)}”</div>` : ''}</td><td class="num">${esc(r.fecha)}</td>${r.e1.map(v => cell(v, 5)).join('')}<td class="cellv"><span class="ix ${cls(r.i1)}">${f1(r.i1)}</span></td>${r.e2.map(v => cell(v, 3)).join('')}<td class="cellv"><span class="ix ${cls(r.i2)}">${f1(r.i2)}</span></td><td><button class="sm danger" data-delr="${r.id}" title="Eliminar esta respuesta">✕</button></td></tr>`).join('')}
  ${c.n ? `<tr style="background:var(--surface2);font-weight:700"><td>Promedio (% del máximo)</td><td></td>${c.d1.map(v => `<td class="cellv">${f1(v)}%</td>`).join('')}<td class="cellv">${f1(c.g1)}%</td>${c.d2.map(v => `<td class="cellv">${f1(v)}%</td>`).join('')}<td class="cellv">${f1(c.g2)}%</td><td></td></tr>` : ''}</tbody></table></div>`;
}
function vVoc(c) {
  const pr = prioridades(c), sg = senales(c), meta = enc().meta;
  const bajos = c.cl.filter(x => x.i1 < meta || x.i2 < meta);
  const cierre = Object.fromEntries(S.E.cierre.map(k => [k.cliente, k]));
  const opts = (arr, sel) => arr.map(x => `<option ${x === sel ? 'selected' : ''}>${esc(x)}</option>`).join('');
  const prc = { Alta: 'ko', Media: 'wa', Baja: 'ok' };
  const revs = S.E.rxd.revisiones;
  const defR = (revs.find(r => r.estado === 'borrador') || revs[0] || {}).anio;
  return `<div class="note">La <b>voz del cliente</b> (ISO 9001, 9.1.2) junta lo que dicen los puntajes y los comentarios, lo ordena por tema, decide qué atender y lo lleva a la dirección (9.3.2). Los comentarios se clasifican a mano: con pocas respuestas la lectura humana rinde más que una clasificación automática.</div>
  <div class="grid g2" style="margin-bottom:12px">
   <div class="card"><h3>Prioridades de mejora</h3><div class="sub">Alta: el tema está bajo la meta · Media: 3 o más clientes con señal negativa</div>
    <div class="tw"><table style="min-width:0"><thead><tr><th>Tema</th><th class="cellv">Mínimo</th><th>Clientes con señal negativa</th><th>Prioridad</th></tr></thead><tbody>
    ${pr.map(x => `<tr><td><b>${esc(x.t)}</b></td><td class="cellv num">${x.pc === null ? '—' : f1(x.pc) + '%'}</td><td>${x.cli.length ? `<b>${x.cli.length}</b> · <span class="det">${esc(x.cli.join(', '))}</span>` : '<span class="det">ninguno</span>'}</td><td><span class="ix ${prc[x.pr]}">${x.pr}</span></td></tr>`).join('') || '<tr><td colspan="4" class="det">Sin datos todavía.</td></tr>'}</tbody></table></div></div>
   <div class="card"><h3>Cierre de ciclo con clientes bajo la meta</h3><div class="sub">Llamar al cliente, entender qué pasó y registrarlo. Un cliente al que se le responde, vuelve a responder.</div>
    ${bajos.length ? bajos.map(r => { const k = cierre[r.cliente] || {}; return `<div class="cc"><label><input type="checkbox" data-cc="${esc(r.cliente)}" ${k.contactado ? 'checked' : ''}> <b>${esc(r.cliente)}</b></label><span class="det">1.ª ${f1(r.i1)}% · 2.ª ${f1(r.i2)}%</span><input type="text" class="ccn" data-ccn="${esc(r.cliente)}" placeholder="Qué dijo, con quién y cuándo" value="${esc(k.nota || '')}"></div>`; }).join('') : '<p class="det">Ningún cliente quedó bajo la meta.</p>'}
    <p class="det" style="margin-top:8px">${S.E.cierre.filter(k => k.contactado && bajos.some(b => b.cliente === k.cliente)).length} de ${bajos.length} contactados.</p></div>
  </div>
  <div class="card" style="margin-bottom:12px"><h3>Señales y comentarios</h3><div class="sub">${sg.length} señales: las de puntaje se generan solas; los comentarios que lleguen en el CSV o agregues vos se clasifican acá.</div>
   <div class="tw"><table style="min-width:640px"><thead><tr><th>Cliente</th><th>Qué dijo</th><th>Tema</th><th>Tono</th><th>Origen</th><th></th></tr></thead><tbody>
   ${sg.map(s => `<tr><td><b>${esc(s.cliente)}</b></td><td>${esc(s.texto)}</td><td>${s.id ? `<select data-vt="${s.id}">${opts(TEMAS, s.tema)}</select>` : esc(s.tema)}</td><td>${s.id ? `<select data-vo="${s.id}">${['-', '0', '+'].map(x => `<option value="${x}" ${s.tono === x ? 'selected' : ''}>${x === '-' ? 'Negativo' : x === '+' ? 'Positivo' : 'Neutro'}</option>`).join('')}</select>` : 'Negativo'}</td><td><span class="chip">${esc(s.origen)}</span></td><td>${s.id ? `<button class="sm danger" data-delv="${s.id}" title="Eliminar">✕</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="6" class="det">Sin señales: ninguna nota baja ni comentarios.</td></tr>'}</tbody></table></div>
   <form id="fVoc" class="frm"><select name="cliente">${opts(c.cl.map(x => x.cliente), '')}</select><input name="texto" placeholder="Comentario del cliente (llamada, visita, mail)" required><select name="tema">${opts(TEMAS, '')}</select><select name="tono"><option value="-">Negativo</option><option value="0">Neutro</option><option value="+">Positivo</option></select><button class="pri">Agregar</button></form></div>
  <div class="card"><h3>Acciones para trabajar con la dirección</h3><div class="sub">Cada acción nace de un tema priorizado y se lleva a la revisión por la dirección como decisión propuesta; el seguimiento sigue en la RxD.</div>
   <div class="tw"><table style="min-width:900px"><thead><tr><th>Tema</th><th>Hallazgo y acción propuesta</th><th>Responsable</th><th>Fecha límite</th><th>Cómo sabremos que funcionó</th><th>Estado</th><th></th></tr></thead><tbody>
   ${S.E.acciones.map(a => `<tr><td><b>${esc(a.tema || '')}</b>${a.borrador ? '<div><span class="pill warn">borrador</span></div>' : ''}</td><td><div>${esc(a.hallazgo)}</div><div class="det"><b>Acción:</b> ${esc(a.accion)}</div>${a.rxd_codigo ? `<div class="det">En la RxD ${a.rxd_anio} como <b>${esc(a.rxd_codigo)}</b></div>` : ''}</td>
   <td><input class="ccn" data-af="responsable" data-id="${a.id}" value="${esc(a.responsable || '')}" placeholder="Responsable"></td><td><input type="date" class="ccn" data-af="fecha_limite" data-id="${a.id}" value="${esc((a.fecha_limite || '').slice(0, 10))}"></td><td>${esc(a.indicador || '')}</td>
   <td><select data-af="estado" data-id="${a.id}">${opts(ESTADOS, a.estado)}</select></td><td>${a.rxd_codigo ? '' : `<button class="sm pri" data-rxd="${a.id}" ${defR ? '' : 'disabled'}>Llevar a la RxD ${defR || ''}</button>`} <button class="sm danger" data-dela="${a.id}" title="Eliminar">✕</button></td></tr>`).join('') || '<tr><td colspan="7" class="det">Todavía no hay acciones.</td></tr>'}</tbody></table></div>
   <form id="fAcc" class="frm"><select name="tema">${opts(TEMAS, '')}</select><input name="hallazgo" placeholder="Qué encontramos" required><input name="accion" placeholder="Qué proponemos hacer" required><input name="indicador" placeholder="Cómo sabremos que funcionó"><button class="pri">Agregar acción</button></form>
   <p class="toolbar" style="margin-top:8px"><button id="btnSug" ${pr.some(x => x.pr === 'Alta') ? '' : 'disabled'}>Proponer acción para el tema con prioridad alta</button><span class="det">Crea un borrador con el hallazgo calculado; la acción y el responsable los definís vos. «Llevar a la RxD» exige responsable.</span></p></div>`;
}
function histRows() {
  const years = new Set([...S.list.map(e => e.anio), ...S.rxd.valores.filter(v => v.clave === 'satisfaccion').map(v => v.anio)]);
  return [...years].sort().map(a => {
    const e = S.list.find(x => x.anio === a), v = rxdValor('satisfaccion', a), r = rxdValor('resp_encuesta', a);
    return { a, e, v, r };
  });
}
function vHis() {
  const all = histRows();
  const val = x => (x.e && x.e.indice1 != null ? x.e.indice1 : x.v ? x.v.valor : null);
  const vals = all.map(val).filter(v => v != null);
  const min = Math.floor(Math.min(80, ...vals) / 5) * 5, max = 100, H = 170;
  const h = v => Math.max(4, (v - min) / (max - min) * H);
  const meta = enc().meta;
  return `<div class="note">El Apéndice C informa el índice de la 1.ª etapa. «En la RxD» es lo que hoy figura en la revisión por la dirección; «Encuesta» es lo que calcula este módulo con los pesos guardados. Si difieren, decidí cuál queda y publicá.</div>
  <div class="grid g2"><div class="card"><h3>Índice de satisfacción por año</h3><div class="sub">1.ª etapa ponderada, eje desde ${min}%</div>
  <div class="hist">${all.map(x => { const v = val(x); return v == null ? '' : `<div class="b ${x.a === S.anio ? 'cur' : ''}"><span class="num">${f1(v)}</span><i style="height:${h(v)}px"></i><small>${x.a}</small></div>`; }).join('')}<div class="mt" style="bottom:${h(meta)}px"><em>meta ${meta}%</em></div></div><div style="height:22px"></div></div>
  <div class="card"><h3>Serie</h3><div class="sub">Encuesta, RxD y nivel de respuesta</div><div class="tw"><table style="min-width:0"><thead><tr><th>Año</th><th class="cellv">Encuesta</th><th class="cellv">En la RxD</th><th class="cellv">Respuesta</th></tr></thead><tbody>
  ${all.map(x => { const dif = x.e && x.e.indice1 != null && x.v && Math.abs(x.e.indice1 - x.v.valor) >= 0.01; return `<tr><td>${x.a}</td><td class="cellv num">${x.e && x.e.indice1 != null ? f2(x.e.indice1) + '%' : '—'}</td><td class="cellv num">${x.v ? f2(x.v.valor) + '%' : '—'}${dif ? ' <span class="pill warn">difiere</span>' : ''}</td><td class="cellv">${x.e && x.e.respuesta != null ? f1(x.e.respuesta).replace(',0', '') + '%' : x.r ? x.r.valor + '%' : '—'}</td></tr>`; }).join('')}</tbody></table></div>
  <p class="det">Los archivos de 2009 a 2020 siguen en Drive y se pueden importar con el mismo formato cuando se necesiten.</p></div></div>`;
}
function vPon(c) {
  const e = enc();
  const inp = (k, i, v) => `<input type="number" step="0.5" min="0" value="${v}" data-k="${k}" data-i="${i}" aria-label="Peso ${k} ${i}">`;
  return `<div class="note">Estos pesos y la meta se guardan con cada encuesta, así las series anteriores se pueden recalcular y comparar. Al cambiarlos se guardan y todo se recalcula.</div>
  <div class="grid g2"><div class="card"><h3>Ponderación · encuesta ${S.anio}</h3><div class="sub">Factor que multiplica la nota de cada dimensión</div>
  <div class="wgrid"><b>Dimensión</b><b>1.ª etapa</b><b>2.ª etapa</b>
  <span>Calidad del producto</span>${inp('w1', 0, e.w1[0])}${inp('w2', 0, e.w2[0])}
  <span>Cumplimiento de fechas</span>${inp('w1', 1, e.w1[1])}${inp('w2', 1, e.w2[1])}
  <span>Flexibilidad</span><span class="det">no se pregunta</span>${inp('w2', 2, e.w2[2])}
  <span>Asesoramiento</span>${inp('w1', 2, e.w1[2])}${inp('w2', 3, e.w2[3])}
  <span>Comunicación efectiva</span>${inp('w1', 3, e.w1[3])}${inp('w2', 4, e.w2[4])}
  <span>Escala máxima de la nota</span><span class="num">5</span><span class="num">3</span>
  <span>Meta del índice (%)</span><input type="number" min="0" max="100" value="${e.meta}" id="meta"><span></span></div>
  <p style="margin-top:12px"><button id="rst">Restablecer valores de la planilla</button></p></div>
  <div class="card"><h3>Resultado con estos pesos</h3><div class="sub">La misma cuenta de la planilla</div>
  <div class="formula">Máximo 1.ª = ${e.w1.join(' + ').replace(/\./g, ',')} = ${String(sum(e.w1)).replace('.', ',')} × 5 × ${c.n} clientes = <b>${fp(c.m1)}</b><br>Puntos 1.ª = <b>${fp(c.p1)}</b> → <b>${c.n ? f1(c.g1) : '—'}%</b><br><br>Máximo 2.ª = ${e.w2.join(' + ').replace(/\./g, ',')} = ${String(sum(e.w2)).replace('.', ',')} × 3 × ${c.n} clientes = <b>${fp(c.m2)}</b><br>Puntos 2.ª = <b>${fp(c.p2)}</b> → <b>${c.n ? f1(c.g2) : '—'}%</b></div>
  <p class="det">La meta de la planilla es 87%; el Apéndice C usó 92% en 2025. Conviene fijar una sola.</p></div></div>`;
}

/* ---------------- dibujo y eventos ---------------- */
async function guardar(fn, okMsg) {
  try { const r = await fn(); if (okMsg) toast(okMsg); return r; } catch (e) { toast(e.message, 1); return null; }
}
async function recargar() {
  const [l, e] = await Promise.all([api('/api/encuestas'), api('/api/encuesta/' + S.anio)]);
  S.list = l.encuestas; S.rxd = l.rxd; S.E = e; draw();
}
async function putCfg(body) {
  const r = await guardar(() => api('/api/encuesta/' + S.anio, { method: 'PUT', body }));
  if (r) { S.E = r; const l = await api('/api/encuestas'); S.list = l.encuestas; S.rxd = l.rxd; }
  draw();
}
function vImportar() {
  return `<div class="note">Todavía no hay ninguna encuesta cargada. Podés empezar con la <b>encuesta 2025</b> (la planilla «Encuestas de satisfacción del cliente 2025», 10 respuestas) o crear una nueva y cargarle un CSV.</div>
  <p class="toolbar"><button class="pri" id="btnImp">Cargar la encuesta 2025 desde la planilla</button><button id="btnNueva2">Crear una encuesta vacía</button></p>`;
}
function draw() {
  nav();
  const hay = S.E && S.anio;
  $('year').innerHTML = S.list.map(e => `<option value="${e.anio}" ${e.anio === S.anio ? 'selected' : ''}>${esc(e.titulo || 'Encuesta ' + e.anio)}</option>`).join('');
  $('env').value = hay ? enc().enviadas : 0; $('env').disabled = !hay; $('btnCsv').disabled = !hay;
  if (!hay) {
    $('main').innerHTML = vImportar();
    $('btnImp').onclick = importar; $('btnNueva2').onclick = nueva; return;
  }
  const c = calc();
  $('main').innerHTML = { res: vRes, cli: vCli, voc: vVoc, his: vHis, pon: vPon }[S.tab](c) + (S.up ? vUp() : '');
  const bl = $('b_low'); if (bl) { bl.onclick = () => { S.solo = true; draw(); }; $('b_all').onclick = () => { S.solo = false; draw(); }; }
  q('[data-delr]').forEach(e => (e.onclick = async () => { if (!confirm('¿Eliminar esta respuesta?')) return; await guardar(() => api('/api/respuesta/' + e.dataset.delr, { method: 'DELETE' })); await recargar(); }));
  q('.wgrid input[data-k]').forEach(e => (e.onchange = () => { const k = e.dataset.k, v = parseFloat(e.value); const w = [...enc()[k]]; w[+e.dataset.i] = isNaN(v) || v < 0 ? 0 : v; putCfg({ [k]: w }); }));
  const m = $('meta'); if (m) m.onchange = () => putCfg({ meta: Math.min(100, Math.max(0, parseFloat(m.value) || 0)) });
  const r = $('rst'); if (r) r.onclick = () => putCfg({ w1: DEF.w1, w2: DEF.w2, meta: DEF.meta });
  q('[data-cc]').forEach(e => (e.onchange = async () => { await guardar(() => api('/api/cierre/' + S.anio, { method: 'PUT', body: { cliente: e.dataset.cc, contactado: e.checked, fecha: e.checked ? new Date().toISOString().slice(0, 10) : null } })); await recargar(); }));
  q('[data-ccn]').forEach(e => (e.onchange = async () => { await guardar(() => api('/api/cierre/' + S.anio, { method: 'PUT', body: { cliente: e.dataset.ccn, nota: e.value } }), 'Nota guardada.'); const k = S.E.cierre.find(x => x.cliente === e.dataset.ccn); if (k) k.nota = e.value; else S.E.cierre.push({ cliente: e.dataset.ccn, contactado: false, nota: e.value }); }));
  q('[data-vt]').forEach(e => (e.onchange = async () => { await guardar(() => api('/api/voc/' + e.dataset.vt, { method: 'PUT', body: { tema: e.value } })); await recargar(); }));
  q('[data-vo]').forEach(e => (e.onchange = async () => { await guardar(() => api('/api/voc/' + e.dataset.vo, { method: 'PUT', body: { tono: e.value } })); await recargar(); }));
  q('[data-delv]').forEach(e => (e.onclick = async () => { await guardar(() => api('/api/voc/' + e.dataset.delv, { method: 'DELETE' })); await recargar(); }));
  q('[data-af]').forEach(e => (e.onchange = async () => { const ok = await guardar(() => api('/api/acciones/' + e.dataset.id, { method: 'PUT', body: { [e.dataset.af]: e.value } })); if (ok) await recargar(); }));
  q('[data-dela]').forEach(e => (e.onclick = async () => { if (!confirm('¿Eliminar esta acción?')) return; await guardar(() => api('/api/acciones/' + e.dataset.dela, { method: 'DELETE' })); await recargar(); }));
  q('[data-rxd]').forEach(e => (e.onclick = async () => {
    const revs = S.E.rxd.revisiones, ra = (revs.find(x => x.estado === 'borrador') || revs[0]).anio;
    if (!confirm(`Se crea la decisión propuesta en la RxD ${ra}. ¿Continuar?`)) return;
    const res = await guardar(() => api(`/api/acciones/${e.dataset.rxd}/rxd`, { method: 'POST', body: { rxd_anio: ra } }));
    if (res) { toast(`Quedó en la RxD ${ra} como ${res.rxd_codigo}.`); await recargar(); }
  }));
  const fv = $('fVoc'); if (fv) fv.onsubmit = async ev => { ev.preventDefault(); const d = new FormData(fv); await guardar(() => api('/api/voc', { method: 'POST', body: { anio: S.anio, cliente: d.get('cliente'), texto: d.get('texto'), tema: d.get('tema'), tono: d.get('tono') } })); await recargar(); };
  const fa = $('fAcc'); if (fa) fa.onsubmit = async ev => { ev.preventDefault(); const d = new FormData(fa); await guardar(() => api('/api/acciones', { method: 'POST', body: { anio: S.anio, tema: d.get('tema'), hallazgo: d.get('hallazgo'), accion: d.get('accion'), indicador: d.get('indicador') } })); await recargar(); };
  const bs = $('btnSug'); if (bs) bs.onclick = async () => {
    const top = prioridades(c).find(x => x.pr === 'Alta'); if (!top) return;
    const hallazgo = `${top.t} en ${f1(top.pc)}% (meta ${enc().meta}%)${top.cli.length ? `; ${top.cli.length} clientes con señal negativa: ${top.cli.join(', ')}` : ''}.`;
    await guardar(() => api('/api/acciones', { method: 'POST', body: { anio: S.anio, tema: top.t, hallazgo, accion: '[Definir la acción con la dirección]', indicador: `${top.t} ≥ ${enc().meta}% en la próxima encuesta`, borrador: true } }), 'Borrador creado.'); await recargar();
  };
  const ps = $('pubAnio'); if (ps) ps.onchange = () => { S.pubAnio = parseInt(ps.value); draw(); };
  const bp = $('btnPub'); if (bp) bp.onclick = async () => {
    const ra = parseInt($('pubAnio').value);
    try {
      let r;
      try { r = await api(`/api/encuesta/${S.anio}/publicar`, { method: 'POST', body: { rxd_anio: ra } }); }
      catch (e) {
        if (e.status !== 409 || !e.data || !e.data.requiere_confirmacion) throw e;
        const a = e.data.anterior.satisfaccion, n = e.data.nuevo;
        if (!confirm(`La RxD ${ra} ya tiene ${a.valor}% de satisfacción. Se reemplaza por ${n.satisfaccion}% (nivel de respuesta ${n.resp_encuesta}%). Queda registrado en el historial. ¿Continuar?`)) return;
        r = await api(`/api/encuesta/${S.anio}/publicar`, { method: 'POST', body: { rxd_anio: ra, confirmar: true } });
      }
      toast(`Publicado en la RxD ${ra}: ${r.satisfaccion}% y respuesta ${r.resp_encuesta}%.`); await recargar();
    } catch (e) { toast(e.message, 1); }
  };
  if (S.up) {
    q('[data-m]').forEach(e => (e.onchange = () => { S.up.map[e.dataset.m] = parseInt(e.value); draw(); }));
    q('input[name=modo]').forEach(e => (e.onchange = () => { S.up.modo = e.value; }));
    $('upCancel').onclick = () => { S.up = null; draw(); };
    $('upOk').onclick = async () => {
      const { out } = buildRows(S.up);
      if (S.up.modo === 'rep' && !confirm('Se reemplazan todas las respuestas de esta encuesta por las del archivo. ¿Continuar?')) return;
      const r = await guardar(() => api(`/api/encuesta/${S.anio}/respuestas`, { method: 'POST', body: { filas: out, modo: S.up.modo } }));
      if (!r) return;
      S.E = r.encuesta; S.up = null;
      const l = await api('/api/encuestas'); S.list = l.encuestas; S.rxd = l.rxd;
      toast(`Se importaron ${r.insertadas} respuestas${r.omitidas.length ? `; ${r.omitidas.length} ya estaban (${r.omitidas.slice(0, 3).join(', ')}${r.omitidas.length > 3 ? '…' : ''})` : ''}${r.con_comentario ? `; ${r.con_comentario} con comentario para clasificar en Voz del cliente` : ''}.`);
      if (r.con_comentario) S.tab = 'voc';
      draw();
    };
  }
}
async function importar() {
  try {
    const data = await (await fetch('data/encuesta-2025.json')).json();
    const r = await api('/api/admin/importar', { method: 'POST', body: data });
    toast('Encuesta 2025 cargada: ' + r.encuestas.map(e => `${e.anio}: ${e.insertadas ?? 0} respuestas`).join(', ') + '.'); await init();
  } catch (e) { toast(e.message, 1); }
}
async function nueva() {
  const a = parseInt(prompt('Año de la encuesta nueva (por ejemplo 2026):', String(new Date().getFullYear())));
  if (!a || a < 2000 || a > 2100) return;
  if (S.list.some(e => e.anio === a)) { toast('Esa encuesta ya existe.', 1); return; }
  const base = S.E ? enc() : { w1: DEF.w1, w2: DEF.w2, meta: DEF.meta };
  const r = await guardar(() => api('/api/encuesta/' + a, { method: 'PUT', body: { titulo: 'Encuesta de satisfacción ' + a, enviadas: 0, meta: base.meta, w1: base.w1, w2: base.w2 } }), `Encuesta ${a} creada con los mismos pesos y meta.`);
  if (r) { S.anio = a; S.tab = 'res'; await recargar(); }
}
async function init() {
  $('status').textContent = 'Conectando…';
  const l = await api('/api/encuestas');
  S.list = l.encuestas; S.rxd = l.rxd; $('status').textContent = '';
  if (!S.list.length) { S.anio = null; S.E = null; draw(); return; }
  if (!S.list.some(e => e.anio === S.anio)) S.anio = S.list[S.list.length - 1].anio;
  S.E = await api('/api/encuesta/' + S.anio); draw();
}
$('year').onchange = async e => { S.anio = parseInt(e.target.value); S.E = await api('/api/encuesta/' + S.anio); draw(); };
$('env').onchange = e => putCfg({ enviadas: Math.max(0, parseInt(e.target.value) || 0) });
$('csv').onchange = e => { const f = e.target.files[0]; if (f) openUpload(f); e.target.value = ''; };
$('btnCsv').onclick = () => $('csv').click();
$('btnNueva').onclick = nueva;
if (!localStorage.getItem(KEY)) showLogin(); else init().catch(e => { if (e.message !== 'Clave incorrecta.') $('status').textContent = e.message; });
