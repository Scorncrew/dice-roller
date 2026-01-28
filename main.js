import { initDice3D } from './dice3d.js';

const $ = (s) => document.querySelector(s);

const elTurn    = $('#turn');
const elResult  = $('#result');
const elStatus  = $('#status');
const elSides   = $('#sides');
const elCount   = $('#count');
const elAuto    = $('#autoNext');
const elRoll    = $('#roll');
const elNext    = $('#next');

const elNick    = $('#nick');
const elAddNick = $('#addNick');
const elPlayers = $('#players');
const elHist    = $('#history');

const STORAGE_KEY = 'dice_roller_players_v1';

let players = [];
let turn = 0;

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ players, turn }));
}

function load() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (data && Array.isArray(data.players)) {
      players = data.players;
      turn = Math.max(0, Math.min(players.length - 1, data.turn || 0));
    }
  } catch {}
}

function nowStr() {
  const d = new Date();
  return d.toLocaleString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function currentPlayerName() {
  if (!players.length) return '— (добавь игроков справа)';
  return players[turn];
}

function renderPlayers() {
  elPlayers.innerHTML = '';
  players.forEach((name, i) => {
    const row = document.createElement('div');
    row.className = 'player' + (i === turn ? ' active' : '');
    row.innerHTML = `
      <div>
        <div class="name">${name}</div>
        <div class="mini">${i === turn ? 'сейчас ходит' : 'в очереди'}</div>
      </div>
      <div style="display:flex; gap:8px;">
        <button class="iconbtn" data-act="set" data-i="${i}">🎯</button>
        <button class="iconbtn" data-act="del" data-i="${i}">🗑️</button>
      </div>
    `;
    elPlayers.appendChild(row);
  });

  elTurn.textContent = currentPlayerName();
  save();
}

function pushHistory({ player, sides, count, values }) {
  const div = document.createElement('div');
  div.className = 'item';
  div.innerHTML = `
    <div class="meta">${nowStr()} • ${player} • d${sides} × ${count}</div>
    <div class="vals">${values.join(', ')}</div>
  `;
  elHist.prepend(div);
}

function nextTurn() {
  if (!players.length) return;
  turn = (turn + 1) % players.length;
  renderPlayers();
}

function addPlayer(name) {
  const n = (name || '').trim();
  if (!n) return;
  players.push(n);
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

// init 3D
try {
  initDice3D('#dice3d');
} catch (e) {
  console.error(e);
  elStatus.textContent = 'ошибка инициализации 3D (см. Console)';
}

// UI events
elAddNick.addEventListener('click', () => addPlayer(elNick.value));
elNick.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') addPlayer(elNick.value);
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

elNext.addEventListener('click', nextTurn);

async function doRoll() {
  const sides = parseInt(elSides.value, 10);
  const count = Math.max(1, Math.min(10, parseInt(elCount.value || '1', 10)));
  const player = currentPlayerName();

  elRoll.disabled = true;
  elStatus.textContent = 'бросаю...';
  elResult.textContent = '—';

  try {
    if (typeof window.rollDice3D !== 'function') {
      throw new Error('rollDice3D is not available (dice3d.js failed to load)');
    }
    const values = await window.rollDice3D({ sides, count });

    elResult.textContent = values.join(', ');
    elStatus.textContent = 'готов';
    pushHistory({ player, sides, count, values });

    if (elAuto.checked && players.length) nextTurn();
  } catch (e) {
    console.error(e);
    elStatus.textContent = 'ошибка (см. Console)';
  } finally {
    elRoll.disabled = false;
  }
}

elRoll.addEventListener('click', doRoll);

// click on table => roll
$('#dice3d').addEventListener('pointerdown', () => doRoll());

// load state
load();
renderPlayers();
