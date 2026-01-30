import { initDice3D } from './dice3d.js';

const $ = (s) => document.querySelector(s);

const STORAGE_KEY = 'dice_roller_state_v4';

const COLORS = [
  '#ff3b3b', '#ff8a00', '#ffd400', '#4cd964',
  '#00d2ff', '#3a7bff', '#8a5cff', '#ff4fd8',
  '#ffffff', '#9aa0a6'
];

let players = [];      // { name, color }
let turn = 0;
let rollingIndex = -1;
let addColor = COLORS[0];

function clamp(n, a, b){ return Math.max(a, Math.min(b, n)); }

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ players, turn, addColor }));
}

function load() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (data) {
      if (Array.isArray(data.players)) {
        players = data.players
          .filter(p => p && typeof p.name === 'string')
          .map(p => ({ name: p.name, color: p.color || COLORS[0] }));
      }
      if (typeof data.turn === 'number') {
        turn = clamp(data.turn, 0, Math.max(0, players.length - 1));
      }
      if (typeof data.addColor === 'string') addColor = data.addColor;
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
  setTimeout(() => card.classList.remove('flash'), 520);
}

function renderPalette(containerEl, selectedColor, onPick) {
  containerEl.innerHTML = '';
  COLORS.forEach((c) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'swatch' + (c.toLowerCase() === selectedColor.toLowerCase() ? ' selected' : '');
    b.style.setProperty('--c', c);
    b.title = c;
    b.addEventListener('click', () => onPick(c));
    containerEl.appendChild(b);
  });
}

function renderPlayers() {
  const elPlayers = $('#players');
  elPlayers.innerHTML = '';

  players.forEach((p, i) => {
    const isActive = (i === turn);
    const isRolling = (i === rollingIndex);

    const row = document.createElement('div');
    row.className = 'player' + (isActive ? ' active' : '') + (isRolling ? ' rolling' : '');
    row.style.setProperty('--pcolor', p.color);

    row.innerHTML = `
      <div style="min-width:0">
        <div class="name">${p.name}</div>
        <div class="mini">${isRolling ? 'бросает…' : (isActive ? 'сейчас ходит' : 'в очереди')}</div>
        <div class="palette" data-role="ppalette" data-i="${i}" style="margin-top:8px"></div>
      </div>

      <div class="pactions">
        <button class="iconbtn" data-act="set" data-i="${i}" title="Сделать текущим">🎯</button>
        <button class="iconbtn" data-act="del" data-i="${i}" title="Удалить">🗑️</button>
      </div>
    `;

    elPlayers.appendChild(row);

    // рендер палитры на карточке
    const pal = row.querySelector('[data-role="ppalette"]');
    renderPalette(pal, p.color, (c) => {
      players[i].color = c;
      renderPlayers();
      save();
    });
  });

  $('#turn').textContent = currentPlayer().name;
  save();
}

function pushHistory({ player, color, sides, count, values }) {
  const elHist = $('#history');
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

async function doRoll() {
  const sides = parseInt($('#sides').value, 10);
  const count = clamp(parseInt($('#count').value || '1', 10), 1, 100);

  const p = currentPlayer();
  const elRoll = $('#roll');

  elRoll.disabled = true;
  $('#result').textContent = '—';

  try {
    if (typeof window.rollDice3D !== 'function') {
      console.error('rollDice3D is not available. Check filenames and paths.');
      alert('3D не инициализирован. Проверь, что dice3d.js рядом с main.js и имена файлов совпадают по регистру.');
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
    elRoll.disabled = false;
  }
}

window.addEventListener('DOMContentLoaded', () => {
  // init 3D (важно: после DOM)
  try {
    initDice3D('#dice3d');
  } catch (e) {
    console.error('initDice3D failed:', e);
  }

  // bind UI
  $('#addNick').addEventListener('click', () => addPlayer($('#nick').value));
  $('#nick').addEventListener('keydown', (e) => { if (e.key === 'Enter') addPlayer($('#nick').value); });

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
    if (Number.isNaN(i)) return;

    if (act === 'del') removePlayer(i);
    if (act === 'set') setTurn(i);
  });

  $('#next').addEventListener('click', nextTurn);
  $('#roll').addEventListener('click', doRoll);
  $('#dice3d').addEventListener('pointerdown', doRoll);

  $('#clearHistory').addEventListener('click', () => { $('#history').innerHTML = ''; });

  // load + palette for adding player
  load();
  renderPalette($('#addPalette'), addColor, (c) => {
    addColor = c;
    renderPalette($('#addPalette'), addColor, () => {}); // перерисуем ниже корректно
    // (перерисуем по-человечески)
    renderPalette($('#addPalette'), addColor, (cc) => {
      addColor = cc;
      renderPalette($('#addPalette'), addColor, arguments.callee);
      save();
    });
    save();
  });

  // нормальная перерисовка addPalette (без хитростей с arguments.callee)
  // просто сделаем ещё раз правильно:
  renderPalette($('#addPalette'), addColor, (c) => {
    addColor = c;
    renderPalette($('#addPalette'), addColor, (cc) => {
      addColor = cc;
      renderPalette($('#addPalette'), addColor, (ccc) => {
        addColor = ccc;
        renderPalette($('#addPalette'), addColor, () => {});
        save();
      });
      save();
    });
    save();
  });

  // в итоге — перерисуем нормально одним вызовом:
  const addPal = $('#addPalette');
  const repaintAdd = () => renderPalette(addPal, addColor, (c) => { addColor = c; repaintAdd(); save(); });
  repaintAdd();

  renderPlayers();
});
