export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 30;

export function secureRandomInt(maxExclusive, cryptoSource = globalThis.crypto) {
  if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) throw new RangeError('최댓값은 양의 정수여야 합니다.');
  if (!cryptoSource?.getRandomValues) throw new Error('안전한 난수를 사용할 수 없습니다.');
  const range = 0x100000000;
  const limit = range - (range % maxExclusive);
  const buffer = new Uint32Array(1);
  do { cryptoSource.getRandomValues(buffer); } while (buffer[0] >= limit);
  return buffer[0] % maxExclusive;
}

export function validatePlayerCount(count) {
  if (!Number.isInteger(count) || count < MIN_PLAYERS || count > MAX_PLAYERS) {
    throw new RangeError(`참가자 수는 ${MIN_PLAYERS}명에서 ${MAX_PLAYERS}명 사이여야 합니다.`);
  }
  return count;
}

export function normalizeParticipantNames(names) {
  if (!Array.isArray(names)) throw new TypeError('참가자 목록이 올바르지 않습니다.');
  return names.map((name, index) => String(name ?? '').trim() || `참가자 ${index + 1}`);
}

export function generateLadder(count, options = {}) {
  validatePlayerCount(count);
  const rowCount = options.rowCount ?? Math.min(60, Math.max(10, count * 3));
  const randomInt = options.randomInt ?? secureRandomInt;
  if (!Number.isInteger(rowCount) || rowCount < 1 || rowCount > 60) throw new RangeError('사다리 줄 수가 올바르지 않습니다.');

  const rows = Array.from({ length: rowCount }, () => []);
  let rungCount = 0;
  for (let row = 0; row < rowCount; row += 1) {
    for (let column = 0; column < count - 1; column += 1) {
      if (randomInt(100) < 34) {
        rows[row].push(column);
        rungCount += 1;
        column += 1;
      }
    }
  }

  let attempts = 0;
  const desired = Math.max(count, 3);
  while (rungCount < desired && attempts < rowCount * count * 3) {
    const row = randomInt(rowCount);
    const column = randomInt(count - 1);
    const occupied = rows[row].includes(column);
    const adjacent = rows[row].includes(column - 1) || rows[row].includes(column + 1);
    if (!occupied && !adjacent) {
      rows[row].push(column);
      rows[row].sort((a, b) => a - b);
      rungCount += 1;
    }
    attempts += 1;
  }
  return rows;
}

export function validateLadder(rows, count) {
  validatePlayerCount(count);
  if (!Array.isArray(rows) || rows.length === 0) throw new Error('사다리 정보가 없습니다.');
  for (const row of rows) {
    if (!Array.isArray(row)) throw new Error('사다리 줄 정보가 올바르지 않습니다.');
    const sorted = [...row].sort((a, b) => a - b);
    for (let index = 0; index < sorted.length; index += 1) {
      const column = sorted[index];
      if (!Number.isInteger(column) || column < 0 || column >= count - 1) throw new Error('가로선 위치가 올바르지 않습니다.');
      if (index > 0 && column - sorted[index - 1] <= 1) throw new Error('같은 높이의 가로선이 겹칩니다.');
    }
  }
  return true;
}

export function tracePath(startColumn, rows, count) {
  validateLadder(rows, count);
  if (!Number.isInteger(startColumn) || startColumn < 0 || startColumn >= count) throw new RangeError('참가자 위치가 올바르지 않습니다.');
  let column = startColumn;
  const moves = [];
  rows.forEach((rungs, row) => {
    const from = column;
    if (rungs.includes(column)) column += 1;
    else if (rungs.includes(column - 1)) column -= 1;
    moves.push({ row, from, to: column });
  });
  return { start: startColumn, end: column, moves };
}

export function calculateResults(rows, count) {
  validateLadder(rows, count);
  return Array.from({ length: count }, (_, start) => tracePath(start, rows, count).end);
}
