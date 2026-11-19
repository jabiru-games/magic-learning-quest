import test from 'node:test';
import assert from 'node:assert/strict';
import { MAP_LEVELS, PLACES, ZONES, mapLevels } from '../src/domain/adventure-map.js';
import {
  adventureStars,
  cursorOf,
  difficultyForAdventure,
  selectLevel,
  starsOf,
} from '../src/domain/adventures.js';
import { recordAnswer } from '../src/domain/progression.js';
import { freshState, restore } from '../src/domain/storage.js';

const settings = { difficulty: 'auto', clockLevel: 'auto' };
const exercise = { mode: 'clock', key: 'minute:00', level: 0 };
const hit = (state) =>
  recordAnswer(state, exercise, { correct: true, elapsed: 1, limit: 40 }, 0).state;
const win = (state) => {
  const level = () => Math.floor(cursorOf(state.adventures.clock) / 100);
  for (const start = level(); level() === start;) state = hit(state);
  return state;
};

test('carte : vingt lieux nommés, quatre zones qui couvrent tous les niveaux', () => {
  assert.equal(PLACES.length, MAP_LEVELS);
  assert.equal(new Set(PLACES.map(([name]) => name)).size, MAP_LEVELS);
  assert.deepEqual(
    ZONES.map(([, last]) => last),
    [5, 10, 15, 20],
  );
});

test('carte : niveaux terminés, à jouer et verrouillés ; anciennes sauvegardes lues depuis les XP', () => {
  const levels = mapLevels({ xp: 350 });
  assert.deepEqual(
    levels.slice(0, 5).map((level) => [level.status, level.earned]),
    [
      ['done', 1],
      ['done', 1],
      ['done', 1],
      ['current', 0],
      ['locked', 0],
    ],
  );
  assert.equal(levels[3].active, true);
  assert.equal(levels[3].remaining, 50);
  assert.equal(mapLevels({ xp: 0 })[0].status, 'current');
  assert.ok(levels.every((level) => level.enemy));
  assert.ok(mapLevels({ xp: 6040 }).every((level) => level.earned === 3));
});

test('étoiles par niveau : un niveau terminé se rejoue en 2 puis 3 étoiles', () => {
  let state = win(freshState());
  let clock = state.adventures.clock;
  assert.deepEqual(starsOf(clock).slice(0, 3), [1, 0, 0]);
  assert.equal(cursorOf(clock), 100, 'le niveau 2 est ouvert en une étoile');

  state = selectLevel(state, 'clock', 0);
  clock = state.adventures.clock;
  assert.equal(difficultyForAdventure('clock', settings, clock).star, 2);
  assert.equal(mapLevels(clock)[0].nextStar, 2);
  state = win(state);
  assert.deepEqual(starsOf(state.adventures.clock).slice(0, 3), [2, 0, 0]);
  assert.equal(
    difficultyForAdventure('clock', settings, state.adventures.clock).star,
    1,
    'après le niveau 1 rejoué, le niveau 2 reprend en une étoile',
  );

  state = win(selectLevel(state, 'clock', 0));
  assert.equal(starsOf(state.adventures.clock)[0], 3);
  state = selectLevel(state, 'clock', 0);
  assert.equal(difficultyForAdventure('clock', settings, state.adventures.clock).star, 3);
  state = win(state);
  assert.equal(starsOf(state.adventures.clock)[0], 3, 'pas de quatrième étoile');
  assert.equal(adventureStars(state.adventures.clock), 0);
  assert.equal(state.adventures.clock.rewards.includes('Baguette de noisetier'), true);
});

test('étoiles par niveau : niveau verrouillé refusé, XP déjà gagnés conservés en changeant de niveau', () => {
  let state = win(freshState());
  assert.throws(() => selectLevel(state, 'clock', 2), /verrouillé/);
  state = hit(state);
  const onSecond = cursorOf(state.adventures.clock) % 100;
  assert.ok(onSecond > 0);
  state = selectLevel(state, 'clock', 0);
  assert.equal(cursorOf(state.adventures.clock), 2000);
  state = selectLevel(state, 'clock', 1);
  assert.equal(cursorOf(state.adventures.clock), 100 + onSecond);
});

test('étoiles par niveau : sauvegarde relue à l’identique, curseur incohérent réparé', () => {
  let state = win(freshState());
  state = selectLevel(state, 'clock', 0);
  const saved = restore(JSON.stringify(state)).state.adventures.clock;
  assert.deepEqual(saved.stars, state.adventures.clock.stars);
  assert.equal(saved.cursor, 2000);
  const broken = structuredClone(state);
  broken.adventures.clock.cursor = 4500;
  assert.equal(restore(JSON.stringify(broken)).state.adventures.clock.cursor, 100);
  broken.adventures.clock.stars[5] = 2;
  assert.ok(restore(JSON.stringify(broken)).warning);
});
