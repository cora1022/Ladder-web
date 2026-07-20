import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateResults, generateLadder, secureRandomInt, tracePath, validateLadder } from '../public/assets/js/ladder-core.js';

function sequenceRandom(values) {
  let index = 0;
  return (max) => values[index++ % values.length] % max;
}

test('생성된 같은 높이의 가로선은 서로 겹치지 않는다', () => {
  const rows = generateLadder(10, { rowCount: 30, randomInt: sequenceRandom([10, 20, 90, 5, 75, 12, 99]) });
  assert.equal(validateLadder(rows, 10), true);
  rows.forEach((row) => row.forEach((column, index) => {
    if (index > 0) assert.ok(column - row[index - 1] > 1);
  }));
});

test('모든 참가자는 서로 다른 결과에 도착한다', () => {
  const rows = [[0, 2], [1], [0], [2], [1, 3], [0, 2]];
  const results = calculateResults(rows, 5);
  assert.deepEqual([...results].sort((a, b) => a - b), [0, 1, 2, 3, 4]);
});

test('경로 이동과 최종 결과가 일치한다', () => {
  const rows = [[0], [1], [], [2], [1]];
  const path = tracePath(0, rows, 4);
  assert.equal(path.moves.length, rows.length);
  assert.equal(path.end, calculateResults(rows, 4)[0]);
});

test('범위를 벗어난 참가자 수와 겹친 가로선을 거부한다', () => {
  assert.throws(() => generateLadder(1), /참가자 수/);
  assert.throws(() => validateLadder([[0, 1]], 4), /겹칩니다/);
});

test('안전한 난수는 지정 범위의 정수를 반환한다', () => {
  const fakeCrypto = { getRandomValues(array) { array[0] = 11; return array; } };
  assert.equal(secureRandomInt(5, fakeCrypto), 1);
});
