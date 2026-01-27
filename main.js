import { initDice3D } from './dice3d.js';

const $ = (s) => document.querySelector(s);

const elResult = $('#result');
const elStatus = $('#status');
const elSides  = $('#sides');
const elCount  = $('#count');
const elRoll   = $('#roll');
const elHist   = $('#history');

function nowStr() {
  const d = new Date();
  return d.toLocaleString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function pushHistory({ sides, count, values }) {
  const div = document.createElement('div');
  div.className = 'item';
  div.innerHTML = `
    <div class="meta">${nowStr()} • d${sides} × ${count}</div>
    <div class="vals">${values.join(', ')}</div>
  `;
  elHist.prepend(div);
}

initDice3D('#dice3d');

elRoll.addEventListener('click', async () => {
  const sides = parseInt(elSides.value, 10);
  const count = Math.max(1, Math.min(10, parseInt(elCount.value || '1', 10)));

  elRoll.disabled = true;
  elStatus.textContent = 'бросаю...';
  elResult.textContent = '—';

  try {
    const values = await window.rollDice3D({ sides, count });
    elResult.textContent = values.join(', ');
    elStatus.textContent = 'готов';
    pushHistory({ sides, count, values });
  } catch (e) {
    console.error(e);
    elStatus.textContent = 'ошибка';
  } finally {
    elRoll.disabled = false;
  }
});
