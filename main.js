import { initDice3D } from './dice3d.js';

const $ = (s) => document.querySelector(s);

const elTurn    = $('#turn');
const elResult  = $('#result');
const elSides   = $('#sides');
const elCount   = $('#count');
const elAuto    = $('#autoNext');
const elRoll    = $('#roll');
const elNext    = $('#next');

const elNick    = $('#nick');
const elPick    = $('#pickColor');
const elAddNick = $('#addNick');
const elClearPlayers = $('#clearPlayers');

const elPlayers = $('#players');
const elHist    = $('#history');
const elClearHistory = $('#clearHistory');

const STORAGE_KEY = 'dice_roller_players_v2';

let players = []; // { name, color }
let turn = 0;
let rollingIndex = -1;

function clamp(n, a, b){ return Math.max(a, Math.min(b, n)); }

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ players, turn }));
}

function load() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (data && Array.isArray(data.players)) {
      players = data.players
        .filter(p => p && typeof p.name === 'string')
        .map(p => ({ name: p.name, color: p.color || '#ff3b3b' }));
      turn = clamp(data.turn || 0, 0, Math.max(0, players.length - 1));
    }
  } catch {}
}

function nowStr() {
  const d = new Date();
  return d.toLocaleString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function currentPlayer() {
  if (!players.length) return { name: '— (добавь игроков слева)', color: '#999999' };
  return players[turn];
}

function flashResult() {
  const card = document.querySelector('.result-card');
  if (!card) return;
  card.classList.add('flash');
  setTimeout(() => card.classList.remove('flash'), 500);
}

function renderPlayers() {
  elPlayers.innerHTML = '';

  players.forEach((p, i) => {
    const isActive = (i === turn);
    const isRolling = (i === rollingIndex);

    const row = document.createElement('div');
    row.className = 'player' + (isActive ? ' active' : '') + (isRolling ? ' rolling' : '');
    row.style.setProperty('--pcolor', p.color);

    row.innerHTML = `
      <div>
        <div class="name">${p.name}</div>
        <div class="mini">${isRolling ? 'бросает…' : (isActive ? 'сейчас ходит' : 'в очереди')}</div>
      </div>

      <div class="pactions">
        <input class="player-color" type="color" value="${p.color}" title="Цвет карточки" data-act="color" data-i="${i}">
        <button class="iconbtn" data-act="set" data-i="${i}" title="Сделать текущим">🎯</button>
        <button class="iconbtn" data-act="del" data-i="${i}" title="Удалить">🗑️</button>
      </div>
    `;

    elPlayers.appendChild(row);
  });

  elTurn.textContent = currentPlayer().name;
  save();
}

function pushHistory({ player, color, sides, count, values }) {
  // ограничитель на историю, чтобы DOM не раздувался бесконечно
  const MAX_ITEMS = 200;

  const div = document.createElement('div');
  div.className = 'item';
  div.innerHTML = `
    <div class="meta">
      ${nowStr()} • <span style="font-weight:900;color:${color}">${player}</span> • d${sides} × ${count}
    </div>
    <div class="vals">${values.join(', ')}</div>
  `;
  elHist.prepend(div);

  // trim
  while (elHist.children.length > MAX_ITEMS) {
    elHist.removeChild(elHist.lastElementChild);
  }
}

function nextTurn() {
  if (!players.length) return;
  turn = (turn + 1) % players.length;
  renderPlayers();
}

function addPlayer(name, color) {
  const n = (name || '').trim();
  if (!n) return;

  // без дублей
  const exists = players.some(p => p.name.toLowerCase() === n.toLowerCase());
  if (exists) return;

  players.push({ name: n, color: color || '#ff3b3b' });
  if (players.length === 1) turn = 0;

  elNick.value = '';
  renderPlayers();
}

function removePlayer(i) {
  players.splice(i, 1);
  if (turn >= players.length) turn = Math.max(0, players.length - 1);
  renderPlayers();
}

function setTurn(i) {
  turn = i;
  renderPlayers();
}

function setPlayerColor(i, color) {
  if (!players[i]) return;
  players[i].color = color || players[i].color;
  renderPlayers();
}

// init 3D
try {
  initDice3D('#dice3d');
} catch (e) {
  console.error(e);
}

// UI events
elAddNick.addEventListener('click', () => addPlayer(elNick.value, elPick.value));
elNick.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') addPlayer(elNick.value, elPick.value);
});

elClearPlayers.addEventListener('click', () => {
  players = [];
  turn = 0;
  rollingIndex = -1;
  renderPlayers();
});

elPlayers.addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  const act = btn.dataset.act;
  const i = parseInt(btn.dataset.i, 10);
  if (Number.isNaN(i)) return;

  if (act === 'del') removePlayer(i);
  if (act === 'set') setTurn(i);
});

elPlayers.addEventListener('input', (e) => {
  const input = e.target.closest('input[type="color"]');
  if (!input) return;
  const act = input.dataset.act;
  const i = parseInt(input.dataset.i, 10);
  if (act === 'color' && !Number.isNaN(i)) {
    setPlayerColor(i, input.value);
  }
});

elNext.addEventListener('click', nextTurn);

elClearHistory.addEventListener('click', () => {
  elHist.innerHTML = '';
});

async function doRoll() {
  const sides = parseInt(elSides.value, 10);
  const count = clamp(parseInt(elCount.value || '1', 10), 1, 100);

  const p = currentPlayer();

  elRoll.disabled = true;
  elResult.textContent = '—';

  try {
    if (typeof window.rollDice3D !== 'function') {
      throw new Error('rollDice3D is not available (dice3d.js failed to load)');
    }

    // подсвечиваем игрока, который СЕЙЧАС бросает
    rollingIndex = players.length ? turn : -1;
    renderPlayers();

    const values = await window.rollDice3D({ sides, count });

    elResult.textContent = values.join(', ');
    flashResult();
    pushHistory({ player: p.name, color: p.color, sides, count, values });

    if (elAuto.checked && players.length) nextTurn();
  } catch (e) {
    console.error(e);
  } finally {
    rollingIndex = -1;
    renderPlayers();
    elRoll.disabled = false;
  }
}

elRoll.addEventListener('click', doRoll);

// click on table => roll
$('#dice3d').addEventListener('pointerdown', () => doRoll());

// load state
load();
renderPlayers();
