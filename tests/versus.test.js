import test from 'node:test';
import assert from 'node:assert/strict';
import {
  VERSUS,
  publicExercise,
  isFast,
  damageFor,
  resolveRound,
  verdict,
} from '../src/domain/versus.js';
import { generateMath, generateClock } from '../src/domain/exercises.js';

test('règles : dégâts, sort éclair, égalité et limite de manches', () => {
  assert.equal(damageFor({ correct: true, fast: false }), VERSUS.hit);
  assert.equal(damageFor({ correct: true, fast: true }), VERSUS.fastHit);
  assert.equal(damageFor({ correct: false, fast: true }), 0);
  assert.equal(isFast(15000, 30), true);
  assert.equal(isFast(15001, 30), false);
  assert.equal(isFast(0, 0), false);
  assert.deepEqual(
    resolveRound(100, 100, { correct: true, fast: true }, { correct: false }),
    [100, 75],
  );
  assert.deepEqual(resolveRound(10, 20, { correct: true }, { correct: true }), [0, 0]);
  assert.equal(verdict(100, 80, 1), null);
  assert.equal(verdict(0, 0, 3), 'draw');
  assert.equal(verdict(20, 0, 3), 'a');
  assert.equal(verdict(0, 20, 3), 'b');
  assert.equal(verdict(60, 60, VERSUS.maxRounds), 'draw');
  assert.equal(verdict(60, 80, VERSUS.maxRounds), 'b');
});
test('une question envoyée à un joueur ne contient jamais sa réponse', () => {
  const math = publicExercise(generateMath(1, () => 0.5));
  assert.equal('answer' in math, false);
  assert.equal(math.mode, 'math');
  const clock = publicExercise(generateClock(2, () => 0.9, true));
  assert.equal('answerHour' in clock, false);
  assert.equal(clock.period, 'afternoon');
});
