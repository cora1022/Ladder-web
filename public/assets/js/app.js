import { calculateResults, generateLadder, tracePath, validateLadder } from './ladder-core.js';

const palette = ['#6375f4', '#e06b76', '#28a384', '#e49a3a', '#8b63d9', '#277fb5', '#d56a35', '#56708f', '#bd4f94', '#3c8c55'];
const countSelect = document.querySelector('[data-count]');
const fields = document.querySelector('[data-fields]');
const canvas = document.querySelector('[data-ladder]');
const participantButtons = document.querySelector('[data-participant-buttons]');
const resultLabels = document.querySelector('[data-result-labels]');
const resultPanel = document.querySelector('[data-result-panel]');
const resultMessage = document.querySelector('[data-result-message]');
const resultTableBody = document.querySelector('[data-result-table-body]');
const error = document.querySelector('[data-error]');
const status = document.querySelector('[data-status]');
const generateButton = document.querySelector('[data-generate]');
const revealAllButton = document.querySelector('[data-reveal-all]');
const resetButton = document.querySelector('[data-reset]');
const boardInner = document.querySelector('[data-board-inner]');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

let state = {
  count: 4,
  participants: ['민준', '서연', '지우', '도윤'],
  results: ['점심 메뉴 정하기', '커피 사기', '간식 받기', '다음 기회'],
  rows: [],
  selected: null,
  revealed: new Set(),
  animating: false,
};

function showError(message = '') {
  error.textContent = message;
  error.hidden = !message;
}

function normalizeValues(values, count, prefix) {
  return Array.from({ length: count }, (_, index) => values[index] ?? `${prefix} ${index + 1}`);
}

function renderFields() {
  fields.replaceChildren();
  for (let index = 0; index < state.count; index += 1) {
    const row = document.createElement('div');
    row.className = 'entry-row';
    row.innerHTML = `<span class="entry-number">${index + 1}</span><label><span>참가자</span><input maxlength="30" autocomplete="off" data-lockable data-participant-index="${index}"></label><label><span>결과</span><input maxlength="30" autocomplete="off" data-lockable data-result-index="${index}"></label>`;
    row.querySelector('[data-participant-index]').value = state.participants[index];
    row.querySelector('[data-result-index]').value = state.results[index];
    fields.appendChild(row);
  }
}

function readFields() {
  state.participants = [...fields.querySelectorAll('[data-participant-index]')].map((input) => input.value.trim());
  state.results = [...fields.querySelectorAll('[data-result-index]')].map((input) => input.value.trim());
}

function validateEntries() {
  readFields();
  if (state.participants.some((name) => !name)) throw new Error('모든 참가자 이름을 입력해 주세요.');
  if (state.results.some((value) => !value)) throw new Error('모든 결과 항목을 입력해 주세요.');
  if (new Set(state.participants).size !== state.participants.length) throw new Error('참가자 이름은 서로 다르게 입력해 주세요.');
}

function setLocked(locked) {
  state.animating = locked;
  document.querySelectorAll('[data-lockable]').forEach((element) => { element.disabled = locked; });
  participantButtons.querySelectorAll('button').forEach((button) => { button.disabled = locked; });
}

function renderEndpoints() {
  participantButtons.replaceChildren();
  resultLabels.replaceChildren();
  boardInner.style.setProperty('--player-count', state.count);
  boardInner.style.setProperty('--board-min-width', `${Math.max(500, state.count * 82)}px`);

  state.participants.forEach((name, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'endpoint participant-button';
    button.dataset.startIndex = String(index);
    button.style.setProperty('--endpoint-color', palette[index]);
    button.textContent = name || `참가자 ${index + 1}`;
    button.setAttribute('aria-label', `${name || `참가자 ${index + 1}`}의 경로 확인`);
    participantButtons.appendChild(button);
  });

  state.results.forEach((value, index) => {
    const label = document.createElement('div');
    label.className = 'endpoint result-label';
    label.textContent = value || `결과 ${index + 1}`;
    resultLabels.appendChild(label);
  });
}

function getLayout() {
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(500, Math.round(rect.width));
  const height = Math.max(360, Math.min(540, Math.round(width * .68)));
  const scale = Math.min(devicePixelRatio || 1, 2);
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  canvas.style.height = `${height}px`;
  const context = canvas.getContext('2d');
  context.setTransform(scale, 0, 0, scale, 0, 0);
  const paddingX = 42;
  const paddingY = 18;
  return {
    context, width, height, paddingX, paddingY,
    columnGap: (width - paddingX * 2) / (state.count - 1),
    rowGap: (height - paddingY * 2) / (state.rows.length + 1),
  };
}

function pathPoints(path, layout) {
  const points = [{ x: layout.paddingX + path.start * layout.columnGap, y: layout.paddingY }];
  path.moves.forEach((move) => {
    const y = layout.paddingY + (move.row + 1) * layout.rowGap;
    points.push({ x: layout.paddingX + move.from * layout.columnGap, y });
    if (move.to !== move.from) points.push({ x: layout.paddingX + move.to * layout.columnGap, y });
  });
  points.push({ x: layout.paddingX + path.end * layout.columnGap, y: layout.height - layout.paddingY });
  return points;
}

function drawBase(layout) {
  const { context, width, height, paddingX, paddingY, columnGap, rowGap } = layout;
  context.clearRect(0, 0, width, height);
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.strokeStyle = '#cfd3df';
  context.lineWidth = 3;
  for (let column = 0; column < state.count; column += 1) {
    const x = paddingX + column * columnGap;
    context.beginPath(); context.moveTo(x, paddingY); context.lineTo(x, height - paddingY); context.stroke();
  }
  state.rows.forEach((rungs, row) => {
    const y = paddingY + (row + 1) * rowGap;
    rungs.forEach((column) => {
      context.beginPath();
      context.moveTo(paddingX + column * columnGap, y);
      context.lineTo(paddingX + (column + 1) * columnGap, y);
      context.stroke();
    });
  });
}

function drawPathProgress(layout, points, progress, color) {
  const context = layout.context;
  const segments = points.slice(1).map((point, index) => ({
    from: points[index], to: point,
    length: Math.hypot(point.x - points[index].x, point.y - points[index].y),
  }));
  const total = segments.reduce((sum, segment) => sum + segment.length, 0);
  let remaining = total * progress;
  context.strokeStyle = color;
  context.lineWidth = 7;
  context.shadowColor = `${color}55`;
  context.shadowBlur = 8;
  context.beginPath();
  context.moveTo(points[0].x, points[0].y);
  for (const segment of segments) {
    if (remaining <= 0) break;
    if (remaining >= segment.length) {
      context.lineTo(segment.to.x, segment.to.y);
      remaining -= segment.length;
    } else {
      const ratio = remaining / segment.length;
      context.lineTo(segment.from.x + (segment.to.x - segment.from.x) * ratio, segment.from.y + (segment.to.y - segment.from.y) * ratio);
      remaining = 0;
    }
  }
  context.stroke();
  context.shadowBlur = 0;
}

function draw(selected = state.selected, progress = 1) {
  const layout = getLayout();
  drawBase(layout);
  if (selected !== null && state.rows.length) {
    const path = tracePath(selected, state.rows, state.count);
    drawPathProgress(layout, pathPoints(path, layout), progress, palette[selected]);
  }
}

function renderResultTable() {
  const mapping = calculateResults(state.rows, state.count);
  resultTableBody.replaceChildren();
  mapping.forEach((destination, participant) => {
    const row = document.createElement('tr');
    const visible = state.revealed.has(participant);
    const participantCell = document.createElement('td');
    const resultCell = document.createElement('td');
    const dot = document.createElement('span');
    dot.className = 'result-dot';
    dot.style.setProperty('--dot-color', palette[participant]);
    participantCell.append(dot, document.createTextNode(state.participants[participant]));
    resultCell.textContent = visible ? state.results[destination] : '아직 확인하지 않음';
    row.append(participantCell, resultCell);
    if (!visible) row.className = 'is-hidden-result';
    resultTableBody.appendChild(row);
  });
  resultPanel.hidden = state.revealed.size === 0;
}

function revealPath(index) {
  if (state.animating) return;
  showError();
  try { validateEntries(); } catch (caught) { showError(caught.message); return; }
  renderEndpoints();
  setLocked(true);
  state.selected = index;
  const path = tracePath(index, state.rows, state.count);
  const finish = () => {
    state.revealed.add(index);
    resultMessage.textContent = `${state.participants[index]} → ${state.results[path.end]}`;
    status.textContent = `${state.participants[index]}의 결과를 확인했습니다.`;
    renderResultTable();
    setLocked(false);
  };
  if (reduceMotion) { draw(index, 1); finish(); return; }
  const started = performance.now();
  const duration = 1500;
  const frame = (time) => {
    const progress = Math.min(1, (time - started) / duration);
    draw(index, 1 - (1 - progress) ** 3);
    if (progress < 1) requestAnimationFrame(frame);
    else finish();
  };
  requestAnimationFrame(frame);
}

function createNewLadder() {
  showError();
  try {
    validateEntries();
    state.rows = generateLadder(state.count);
    validateLadder(state.rows, state.count);
    state.selected = null;
    state.revealed.clear();
    resultPanel.hidden = true;
    resultMessage.textContent = '';
    renderEndpoints();
    draw();
    status.textContent = '참가자 이름을 눌러 경로를 확인하세요.';
  } catch (caught) { showError(caught.message); }
}

countSelect.addEventListener('change', () => {
  if (state.animating) return;
  readFields();
  state.count = Number(countSelect.value);
  state.participants = normalizeValues(state.participants, state.count, '참가자');
  state.results = normalizeValues(state.results, state.count, '결과');
  renderFields();
  createNewLadder();
});

fields.addEventListener('input', () => {
  readFields();
  renderEndpoints();
  resultPanel.hidden = true;
  state.revealed.clear();
});

participantButtons.addEventListener('click', (event) => {
  const button = event.target.closest('[data-start-index]');
  if (button) revealPath(Number(button.dataset.startIndex));
});

generateButton.addEventListener('click', createNewLadder);
revealAllButton.addEventListener('click', () => {
  if (state.animating) return;
  showError();
  try { validateEntries(); } catch (caught) { showError(caught.message); return; }
  state.selected = null;
  state.revealed = new Set(Array.from({ length: state.count }, (_, index) => index));
  resultMessage.textContent = '전체 결과를 공개했습니다.';
  status.textContent = '전체 결과를 확인했습니다.';
  draw();
  renderResultTable();
  resultPanel.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'nearest' });
});

resetButton.addEventListener('click', () => {
  if (state.animating) return;
  state = { count: 4, participants: ['', '', '', ''], results: ['', '', '', ''], rows: [], selected: null, revealed: new Set(), animating: false };
  countSelect.value = '4';
  renderFields();
  state.rows = generateLadder(4);
  renderEndpoints();
  resultPanel.hidden = true;
  showError();
  status.textContent = '참가자와 결과를 입력해 주세요.';
  draw();
  fields.querySelector('input')?.focus();
});

new ResizeObserver(() => draw()).observe(boardInner);
renderFields();
createNewLadder();
