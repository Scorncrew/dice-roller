import { initDice3D } from './dice3d.js';

const $ = (s) => document.querySelector(s);

const STORAGE_KEY = 'dice_roller_v6';
const MAX_PLAYERS = 6;

const COLORS = [
  '#ff3b3b', '#ff8a00', '#ffd400', '#4cd964',
  '#00d2ff', '#3a7bff', '#8a5cff', '#ff4fd8',
  '#ffffff', '#9aa0a6'
];

let players = [];          // { name, color, order }
let turn = 0;
let rollingIndex = -1;
let addColor = COLORS[0];

// drag-throw state
let drag = {
  active: false,
  startX: 0,
  startY: 0,
  curX: 0,
  curY: 0,
};

function clamp(n, a, b){ return Math.max(a, Math.min(b, n)); }

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ players, turn }));
}

function load() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (!data) return;
    if (Array.isArray(data.players)) {
      players = data.players
        .filter(p => p && typeof p.name === 'string')
        .slice(0, MAX_PLAYERS)
        .map((p, idx) => ({
          name: p.name,
          color: p.color || COLORS[0],
          order: Number.isFinite(+p.order) ? +p.order : (idx + 1),
        }));
    }
    turn = clamp(Number(data.turn || 0), 0, Math.max(0, players.length - 1));
  } catch {}
}

function nowStr() {
  const d = new Date();
  return d.toLocaleString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function currentPlayer() {
  if (!players.length) return { name: '— (добавь игроков слева)', color: '#9aa0a6', order: 0 };
  return players[turn];
}

function flashResult() {
  const card = document.querySelector('.result-card');
  if (!card) return;
  card.classList.add('flash');
  setTimeout(() => card.classList.remove('flash'), 520);
}

function renderAddPalette() {
  const el = $('#addPalette');
  el.innerHTML = '';
  COLORS.forEach((c) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'swatch' + (c.toLowerCase() === addColor.toLowerCase() ? ' selected' : '');
    b.style.setProperty('--c', c);
    b.title = c;
    b.addEventListener('click', () => {
      addColor = c;
      renderAddPalette();
    });
    el.appendChild(b);
  });
}

function sortPlayersByOrder(keepName = null) {
  // sort by order asc, then by name
  players.sort((a, b) => {
    const ao = Number.isFinite(+a.order) ? +a.order : 9999;
    const bo = Number.isFinite(+b.order) ? +b.order : 9999;
    if (ao !== bo) return ao - bo;
    return String(a.name).localeCompare(String(b.name), 'ru');
  });

  if (keepName) {
    const idx = players.findIndex(p => p.name === keepName);
    if (idx >= 0) turn = idx;
    else turn = clamp(turn, 0, Math.max(0, players.length - 1));
  } else {
    turn = clamp(turn, 0, Math.max(0, players.length - 1));
  }
}

function renderPlayers() {
  const elPlayers = $('#players');
  elPlayers.innerHTML = '';

  // РЕНДЕР РОВНО 6 СЛОТОВ
  for (let i = 0; i < MAX_PLAYERS; i++) {
    const p = players[i];

    if (!p) {
      const ph = document.createElement('div');
      ph.className = 'player placeholder';
      ph.style.setProperty('--pcolor', 'rgba(255,255,255,0.12)');
      ph.innerHTML = `
        <div class="pmeta">
          <div class="pname">Пусто</div>
          <div class="pmini">слот ${i + 1} из ${MAX_PLAYERS}</div>
        </div>
        <div class="pactions"></div>
      `;
      elPlayers.appendChild(ph);
      continue;
    }

    const isActive = i === turn;
    const isRolling = i === rollingIndex;

    const row = document.createElement('div');
    row.className = 'player' + (isActive ? ' active' : '') + (isRolling ? ' rolling' : '');
    row.style.setProperty('--pcolor', p.color);

    const paletteHtml = COLORS.map(c =>
      `<button class="swatch ${c.toLowerCase() === p.color.toLowerCase() ? 'selected':''}"
         data-act="pcolor" data-i="${i}" data-color="${c}" style="--c:${c}" title="${c}"></button>`
    ).join('');

    row.innerHTML = `
      <div class="pmeta">
        <div class="pname">${p.name}</div>
        <div class="pmini">${isRolling ? 'бросает…' : (isActive ? 'сейчас ходит' : 'в очереди')}</div>

        <div class="orderRow">
          <span class="orderLabel">Порядок</span>
          <input class="orderInput" type="number" min="1" max="99" step="1"
            value="${Number.isFinite(+p.order) ? +p.order : ''}"
            data-act="order" data-i="${i}" />
        </div>

        <div class="palette">${paletteHtml}</div>
      </div>

      <div class="pactions">
        <button class="iconbtn" data-act="set" data-i="${i}" title="Сделать текущим">🎯</button>
        <button class="iconbtn" data-act="del" data-i="${i}" title="Удалить">🗑️</button>
      </div>
    `;

    elPlayers.appendChild(row);
  }

  $('#turn').textContent = currentPlayer().name;
  save();
}

function pushHistory({ player, color, sides, count, values }) {
  const elHist = $('#history');
  const MAX_ITEMS = 250;

  const div = document.createElement('div');
  div.className = 'item';
  div.innerHTML = `
    <div class="meta">${nowStr()} • <span style="font-weight:900;color:${color}">${player}</span> • d${sides} × ${count}</div>
    <div class="vals">${values.join(', ')}</div>
  `;

  elHist.prepend(div);

  while (elHist.children.length > MAX_ITEMS) {
    elHist.removeChild(elHist.lastElementChild);
  }
}

function nextTurn() {
  if (!players.length) return;
  turn = (turn + 1) % players.length;
  renderPlayers();
}

function addPlayer(name) {
  const n = (name || '').trim();
  if (!n) return;

  if (players.length >= MAX_PLAYERS) {
    alert(`Максимум ${MAX_PLAYERS} игроков.`);
    return;
  }

  const exists = players.some(p => p.name.toLowerCase() === n.toLowerCase());
  if (exists) return;

  // default order: next available
  const used = new Set(players.map(p => +p.order).filter(Number.isFinite));
  let ord = 1;
  while (used.has(ord)) ord++;

  players.push({ name: n, color: addColor, order: ord });
  sortPlayersByOrder(n);
  $('#nick').value = '';
  renderPlayers();
}

function removePlayer(i) {
  const keep = currentPlayer()?.name || null;
  players.splice(i, 1);
  sortPlayersByOrder(keep);
  renderPlayers();
}

function setTurn(i) {
  if (!players[i]) return;
  turn = i;
  renderPlayers();
}

function setPlayerColor(i, color) {
  if (!players[i]) return;
  players[i].color = color;
  renderPlayers();
}

function setPlayerOrder(i, orderValue) {
  if (!players[i]) return;
  const keep = currentPlayer()?.name || null;
  const v = clamp(parseInt(orderValue, 10) || 1, 1, 99);
  players[i].order = v;
  sortPlayersByOrder(keep);
  renderPlayers();
}

// -------- Arrow overlay (SVG) --------
function ensureArrowOverlay() {
  const host = $('#dice3d');
  if (!host) return null;

  let overlay = host.querySelector('.throwOverlay');
  if (overlay) return overlay;

  overlay = document.createElement('div');
  overlay.className = 'throwOverlay';
  overlay.innerHTML = `
    <svg class="throwSvg" viewBox="0 0 100 100" preserveAspectRatio="none">
      <defs>
        <marker id="arrowHead" markerWidth="10" markerHeight="10" refX="7" refY="3" orient="auto">
          <path d="M0,0 L0,6 L8,3 z"></path>
        </marker>
      </defs>
      <line class="throwLine" x1="0" y1="0" x2="0" y2="0" marker-end="url(#arrowHead)"></line>
      <circle class="throwDot" cx="0" cy="0" r="3"></circle>
    </svg>
    <div class="throwHint">Потяни стрелку для силы броска</div>
  `;
  host.appendChild(overlay);
  return overlay;
}

function setArrowVisible(visible) {
  const overlay = ensureArrowOverlay();
  if (!overlay) return;
  overlay.classList.toggle('show', !!visible);
}

function updateArrow() {
  const overlay = ensureArrowOverlay();
  if (!overlay) return;

  const host = $('#dice3d');
  const rect = host.getBoundingClientRect();

  // local coords in px
  const sx = drag.startX - rect.left;
  const sy = drag.startY - rect.top;
  const cx = drag.curX - rect.left;
  const cy = drag.curY - rect.top;

  const svg = overlay.querySelector('.throwSvg');
  svg.setAttribute('viewBox', `0 0 ${rect.width} ${rect.height}`);

  overlay.querySelector('.throwLine').setAttribute('x1', sx);
  overlay.querySelector('.throwLine').setAttribute('y1', sy);
  overlay.querySelector('.throwLine').setAttribute('x2', cx);
  overlay.querySelector('.throwLine').setAttribute('y2', cy);

  overlay.querySelector('.throwDot').setAttribute('cx', sx);
  overlay.querySelector('.throwDot').setAttribute('cy', sy);

  // show strength as hint
  const len = Math.hypot(cx - sx, cy - sy);
  const strength = clamp(len / 65, 0.6, 6.0);
  overlay.querySelector('.throwHint').textContent = `Сила: ${strength.toFixed(1)} (отпусти для броска)`;
}

// -------- Roll logic (with throwCfg from drag) --------
async function doRoll(throwCfg = null) {
  const sides = parseInt($('#sides').value, 10);
  const count = clamp(parseInt($('#count').value || '1', 10), 1, 100);
  const p = currentPlayer();

  $('#roll').disabled = true;
  $('#result').textContent = '—';

  try {
    if (typeof window.rollDice3D !== 'function') {
      alert('3D не инициализирован. Проверь загрузку dice3d.js');
      return;
    }

    rollingIndex = players.length ? turn : -1;
    renderPlayers();

    const values = await window.rollDice3D({ sides, count, throwCfg });

    $('#result').textContent = values.join(', ');
    flashResult();
    pushHistory({ player: p.name, color: p.color, sides, count, values });

    if ($('#autoNext').checked && players.length) nextTurn();
  } finally {
    rollingIndex = -1;
    renderPlayers();
    $('#roll').disabled = false;
  }
}

window.addEventListener('DOMContentLoaded', () => {
  initDice3D('#dice3d');

  renderAddPalette();
  load();
  sortPlayersByOrder(currentPlayer()?.name || null);
  renderPlayers();

  // Add player
  $('#addNick').addEventListener('click', () => addPlayer($('#nick').value));
  $('#nick').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addPlayer($('#nick').value);
  });

  $('#clearPlayers').addEventListener('click', () => {
    players = [];
    turn = 0;
    rollingIndex = -1;
    renderPlayers();
  });

  // Players interactions
  $('#players').addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;

    const act = btn.dataset.act;
    const i = parseInt(btn.dataset.i, 10);

    if (act === 'del' && !Number.isNaN(i)) removePlayer(i);
    if (act === 'set' && !Number.isNaN(i)) setTurn(i);

    if (act === 'pcolor' && !Number.isNaN(i)) {
      const c = btn.dataset.color;
      if (c) setPlayerColor(i, c);
    }
  });

  $('#players').addEventListener('change', (e) => {
    const inp = e.target.closest('input');
    if (!inp) return;
    if (inp.dataset.act !== 'order') return;

    const i = parseInt(inp.dataset.i, 10);
    if (Number.isNaN(i)) return;
    setPlayerOrder(i, inp.value);
  });

  $('#next').addEventListener('click', nextTurn);

  $('#clearHistory').addEventListener('click', () => {
    $('#history').innerHTML = '';
  });

  // Roll button = random throw (still available)
  $('#roll').addEventListener('click', () => doRoll(null));

  // Drag-throw on table
  const host = $('#dice3d');
  ensureArrowOverlay();

  host.addEventListener('pointerdown', (e) => {
    // only left button / primary
    if (e.button !== 0) return;
    host.setPointerCapture?.(e.pointerId);

    drag.active = true;
    drag.startX = e.clientX;
    drag.startY = e.clientY;
    drag.curX = e.clientX;
    drag.curY = e.clientY;

    setArrowVisible(true);
    updateArrow();
  });

  host.addEventListener('pointermove', (e) => {
    if (!drag.active) return;
    drag.curX = e.clientX;
    drag.curY = e.clientY;
    updateArrow();
  });

  async function endDrag(e) {
    if (!drag.active) return;
    drag.active = false;

    setArrowVisible(false);

    const dx = (drag.curX - drag.startX);
    const dy = (drag.curY - drag.startY);
    const len = Math.hypot(dx, dy);

    // tiny drag => ignore
    if (len < 18) return;

    // IMPORTANT: direction is from start to end
    await doRoll({ dx, dy });
  }

  host.addEventListener('pointerup', endDrag);
  host.addEventListener('pointercancel', () => {
    drag.active = false;
    setArrowVisible(false);
  });
});
