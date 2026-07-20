import { MAX_PLAYERS, calculateResults, generateLadder, normalizeParticipantNames, tracePath, validateLadder } from './ladder-core.js';

const palette = ['#6375f4', '#e06b76', '#28a384', '#e49a3a', '#8b63d9', '#277fb5', '#d56a35', '#56708f', '#bd4f94', '#3c8c55'];
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
const addButton = document.querySelector('[data-add]');
const toggleMaskButton = document.querySelector('[data-toggle-mask]');
const boardInner = document.querySelector('[data-board-inner]');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

function getPlayerColor(index) {
  return palette[index] ?? `hsl(${Math.round((index * 137.508 + 224) % 360)} 62% 50%)`;
}

let state = {
  count: 4,
  participants: ['민준', '서연', '지우', '도윤'],
  results: ['점심 메뉴 정하기', '커피 사기', '간식 받기', '다음 기회'],
  rows: [],
  selected: null,
  revealed: new Set(),
  uncoveredDestinations: new Set(),
  masked: true,
  animating: false,
};

function getParticipantName(index) {
  return state.participants[index] || `참가자 ${index + 1}`;
}

function showError(message = '') {
  error.textContent = message;
  error.hidden = !message;
}

function renderFields() {
  fields.replaceChildren();
  for (let index = 0; index < state.count; index += 1) {
    const row = document.createElement('div');
    row.className = 'entry-row';
    row.innerHTML = `<span class="entry-number">${index + 1}</span><label><span>참가자</span><input maxlength="30" autocomplete="off" placeholder="참가자 ${index + 1}" data-lockable data-participant-index="${index}"></label><label><span>결과</span><input maxlength="30" autocomplete="off" placeholder="결과 입력" data-lockable data-result-index="${index}"></label><button class="remove-entry-button" type="button" data-remove-index="${index}" data-lockable aria-label="${index + 1}번 사다리 삭제">×</button>`;
    row.querySelector('[data-participant-index]').value = state.participants[index];
    row.querySelector('[data-result-index]').value = state.results[index];
    fields.appendChild(row);
  }
  fields.querySelectorAll('[data-remove-index]').forEach((button) => { button.disabled = state.count <= 2 || state.animating; });
  addButton.disabled = state.count >= MAX_PLAYERS || state.animating;
}

function readFields() {
  state.participants = [...fields.querySelectorAll('[data-participant-index]')].map((input) => input.value.trim());
  state.results = [...fields.querySelectorAll('[data-result-index]')].map((input) => input.value.trim());
}

function validateEntries() {
  readFields();
  state.participants = normalizeParticipantNames(state.participants);
  fields.querySelectorAll('[data-participant-index]').forEach((input, index) => { input.value = state.participants[index]; });
  if (state.results.some((value) => !value)) throw new Error('모든 결과 항목을 입력해 주세요.');
  if (new Set(state.participants).size !== state.participants.length) throw new Error('참가자 이름은 서로 다르게 입력해 주세요.');
}

function setLocked(locked) {
  state.animating = locked;
  document.querySelectorAll('[data-lockable]').forEach((element) => { element.disabled = locked; });
  addButton.disabled = locked || state.count >= MAX_PLAYERS;
  fields.querySelectorAll('[data-remove-index]').forEach((button) => { button.disabled = locked || state.count <= 2; });
  participantButtons.querySelectorAll('button').forEach((button) => { button.disabled = locked; });
}

function renderEndpoints(revealedDestination = null) {
  participantButtons.replaceChildren();
  resultLabels.replaceChildren();
  boardInner.style.setProperty('--player-count', state.count);
  boardInner.style.setProperty('--board-min-width', `${Math.max(500, state.count * 82)}px`);

  state.participants.forEach((name, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'endpoint participant-button';
    button.dataset.startIndex = String(index);
    button.style.setProperty('--endpoint-color', getPlayerColor(index));
    button.textContent = getParticipantName(index);
    button.setAttribute('aria-label', `${getParticipantName(index)}의 경로 확인`);
    participantButtons.appendChild(button);
  });

  state.results.forEach((value, index) => {
    const label = document.createElement('div');
    label.className = 'endpoint result-label';
    const covered = state.masked && !state.uncoveredDestinations.has(index);
    label.classList.toggle('is-masked', covered);
    label.classList.toggle('is-revealing', index === revealedDestination && !covered);
    label.dataset.resultIndex = String(index);
    label.textContent = covered ? '?' : (value || `결과 ${index + 1}`);
    label.setAttribute('aria-label', covered ? `${index + 1}번 결과 가림막` : (value || `결과 ${index + 1}`));
    resultLabels.appendChild(label);
  });
  toggleMaskButton.textContent = state.masked ? '가림막 모두 열기' : '결과 다시 가리기';
  toggleMaskButton.setAttribute('aria-pressed', String(state.masked));
}

function animateResultMessage() {
  if (reduceMotion) return;
  resultMessage.classList.remove('is-revealing');
  void resultMessage.offsetWidth;
  resultMessage.classList.add('is-revealing');
}

function resetRound({ createRows = true } = {}) {
  if (createRows) state.rows = generateLadder(state.count);
  state.selected = null;
  state.revealed.clear();
  state.uncoveredDestinations.clear();
  state.masked = true;
  resultPanel.hidden = true;
  resultMessage.textContent = '선택 결과';
  renderEndpoints();
  draw();
  status.textContent = '참가자 이름을 눌러 경로를 확인하세요.';
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
  context.shadowColor = color;
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
    drawPathProgress(layout, pathPoints(path, layout), progress, getPlayerColor(selected));
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
    dot.style.setProperty('--dot-color', getPlayerColor(participant));
    participantCell.append(dot, document.createTextNode(getParticipantName(participant)));
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
    state.uncoveredDestinations.add(path.end);
    resultMessage.textContent = `${getParticipantName(index)} → ${state.results[path.end]}`;
    status.textContent = `${getParticipantName(index)}의 결과를 확인했습니다.`;
    renderEndpoints(path.end);
    animateResultMessage();
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
    resetRound({ createRows: false });
  } catch (caught) { showError(caught.message); }
}

fields.addEventListener('input', () => {
  readFields();
  state.selected = null;
  state.masked = true;
  state.uncoveredDestinations.clear();
  renderEndpoints();
  resultPanel.hidden = true;
  state.revealed.clear();
  status.textContent = '입력 내용이 바뀌었습니다. 참가자 이름을 눌러 확인하세요.';
  draw();
});

fields.addEventListener('click', (event) => {
  const button = event.target.closest('[data-remove-index]');
  if (!button || state.animating) return;
  if (state.count <= 2) { showError('사다리는 최소 2줄이 필요합니다.'); return; }
  readFields();
  const index = Number(button.dataset.removeIndex);
  state.participants.splice(index, 1);
  state.results.splice(index, 1);
  state.count -= 1;
  renderFields();
  resetRound();
  showError();
});

addButton.addEventListener('click', () => {
  if (state.animating) return;
  if (state.count >= MAX_PLAYERS) { showError(`사다리는 최대 ${MAX_PLAYERS}줄까지 추가할 수 있습니다.`); return; }
  readFields();
  state.count += 1;
  state.participants.push('');
  state.results.push('');
  renderFields();
  resetRound();
  showError();
  fields.querySelector(`[data-participant-index="${state.count - 1}"]`)?.focus();
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
  state.uncoveredDestinations = new Set(Array.from({ length: state.count }, (_, index) => index));
  state.masked = false;
  resultMessage.textContent = '전체 결과를 공개했습니다.';
  status.textContent = '전체 결과를 확인했습니다.';
  draw();
  renderEndpoints();
  renderResultTable();
  resultPanel.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'nearest' });
});

toggleMaskButton.addEventListener('click', () => {
  if (state.animating) return;
  state.masked = !state.masked;
  if (state.masked) {
    state.uncoveredDestinations.clear();
    state.revealed.clear();
    state.selected = null;
    resultPanel.hidden = true;
    draw();
  } else {
    state.uncoveredDestinations = new Set(Array.from({ length: state.count }, (_, index) => index));
  }
  renderEndpoints();
  status.textContent = state.masked ? '결과를 다시 가렸습니다.' : '모든 가림막을 열었습니다.';
});

resetButton.addEventListener('click', () => {
  if (state.animating) return;
  state = { count: 4, participants: ['', '', '', ''], results: ['', '', '', ''], rows: [], selected: null, revealed: new Set(), uncoveredDestinations: new Set(), masked: true, animating: false };
  renderFields();
  resetRound();
  showError();
  status.textContent = '참가자와 결과를 입력해 주세요.';
  fields.querySelector('input')?.focus();
});

new ResizeObserver(() => draw()).observe(boardInner);
renderFields();
createNewLadder();
