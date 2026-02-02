import { initDice3D } from './dice3d.js';

const $ = (s) => document.querySelector(s);

const STORAGE_KEY = 'dice_roller_v4';

const COLORS = [
  '#ff3b3b', '#ff8a00', '#ffd400', '#4cd964',
  '#00d2ff', '#3a7bff', '#8a5cff', '#ff4fd8',
  '#ffffff', '#9aa0a6'
];

let players = [];          // { name, color }
let turn = 0;
let rollingIndex = -1;
let addColor = COLORS[0];

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
        .map(p => ({ name: p.name, color: p.color || COLORS[0] }));
    }
    turn = clamp(Number(data.turn || 0), 0, Math.max(0, players.length - 1));
  } catch {}
}

function nowStr() {
  const d = new Date();
  return d.toLocaleString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function currentPlayer() {
  if (!players.length) return { name: '— (добавь игроков слева)', color: '#9aa0a6' };
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

function renderPlayers() {
  const elPlayers = $('#players');
  elPlayers.innerHTML = '';

  players.forEach((p, i) => {
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
        <div class="palette" style="margin-top:10px">${paletteHtml}</div>
      </div>

      <div class="pactions">
        <button class="iconbtn" data-act="set" data-i="${i}" title="Сделать текущим">🎯</button>
        <button class="iconbtn" data-act="del" data-i="${i}" title="Удалить">🗑️</button>
      </div>
    `;

    elPlayers.appendChild(row);
  });

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

  const exists = players.some(p => p.name.toLowerCase() === n.toLowerCase());
  if (exists) return;

  players.push({ name: n, color: addColor });
  if (players.length === 1) turn = 0;

  $('#nick').value = '';
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
  players[i].color = color;
  renderPlayers();
}

window.addEventListener('DOMContentLoaded', () => {
  // 1) init 3D (важно: после DOM)
  try {
    initDice3D('#dice3d');
  } catch (e) {
    console.error('initDice3D failed:', e);
  }

  // 2) palette
  renderAddPalette();

  // 3) restore state
  load();
  renderPlayers();

  // 4) UI events
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

  $('#next').addEventListener('click', nextTurn);

  $('#clearHistory').addEventListener('click', () => {
    $('#history').innerHTML = '';
  });

  async function doRoll() {
    const sides = parseInt($('#sides').value, 10);
    const count = clamp(parseInt($('#count').value || '1', 10), 1, 100);
    const p = currentPlayer();

    $('#roll').disabled = true;
    $('#result').textContent = '—';

    try {
      // если функция не появилась — значит dice3d.js не подцепился (путь/имя/кейс)
      if (typeof window.rollDice3D !== 'function') {
        console.error('rollDice3D missing. Check filenames: index.html / main.js / dice3d.js (case-sensitive).');
        alert('3D не инициализирован. Проверь имена файлов и регистр: index.html / main.js / dice3d.js');
        return;
      }

      rollingIndex = players.length ? turn : -1;
      renderPlayers();

      const values = await window.rollDice3D({ sides, count });

      $('#result').textContent = values.join(', ');
      flashResult();
      pushHistory({ player: p.name, color: p.color, sides, count, values });

      if ($('#autoNext').checked && players.length) nextTurn();
    } catch (e) {
      console.error('Roll failed:', e);
    } finally {
      rollingIndex = -1;
      renderPlayers();
      $('#roll').disabled = false;
    }
  }

  $('#roll').addEventListener('click', doRoll);
  $('#dice3d').addEventListener('pointerdown', () => doRoll());
});
