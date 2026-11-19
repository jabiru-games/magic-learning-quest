import { test, expect } from '@playwright/test';
import {
  boot,
  enter,
  ready,
  begin,
  digits,
  solveClock,
  finish,
  menu,
  state,
  settings,
  landscape,
  base,
} from './helpers.js';

for (const [width, height] of [
  [320, 568],
  [375, 667],
  [390, 844],
  [430, 932],
]) {
  test(`accueil portrait sans scroll ni zoom ${width}×${height}`, async ({ page }, testInfo) => {
    await boot(page);
    await page.setViewportSize({ width, height });
    const geometry = await page.evaluate(() => ({
      width: innerWidth,
      height: innerHeight,
      sw: document.documentElement.scrollWidth,
      sh: document.documentElement.scrollHeight,
    }));
    expect(geometry.sw).toBeLessThanOrEqual(width);
    expect(geometry.sh).toBeLessThanOrEqual(height);
    for (const id of ['#choose-clock', '#choose-math', '#home-settings']) {
      const b = await page.locator(id).boundingBox();
      expect(b.height).toBeGreaterThanOrEqual(44);
      expect(b.y).toBeGreaterThanOrEqual(0);
      expect(b.y + b.height).toBeLessThanOrEqual(height);
      expect(b.x + b.width).toBeLessThanOrEqual(width);
    }
    expect(await page.locator('meta[name=viewport]').getAttribute('content')).toContain(
      'user-scalable=no',
    );
    await page.screenshot({ path: testInfo.outputPath('home.png') });
    await page.setViewportSize({ width: height, height: width });
    await expect(page.locator('.home-rotate')).toBeVisible();
    await expect(page.locator('#choose-clock')).toBeHidden();
    await page.setViewportSize({ width, height });
    await expect(page.locator('#choose-clock')).toBeVisible();
  });
}

test('zoom par geste bloqué, pavé rapide fonctionnel', async ({ page }) => {
  await boot(page);
  const canceled = await page.evaluate(() =>
    ['gesturestart', 'gesturechange'].map(
      (type) => !document.dispatchEvent(new Event(type, { cancelable: true, bubbles: true })),
    ),
  );
  expect(canceled).toEqual([true, true]);
  await ready(page);
  await solveClock(page);
  await finish(page);
  expect((await state(page)).adventures.clock.xp).toBe(20);
});

for (const [period, hour, answer, expected, given, rule] of [
  ['morning', 12, '00', '0:00', '12:00', 'C’est minuit : on écrit 0 heure.'],
  ['afternoon', 12, '12', '12:00', '0:00', 'C’est midi : on écrit 12 heures.'],
  ['afternoon', 3, '15', '15:00', '3:00', 'C’est l’après-midi : 3 + 12 = 15 heures.'],
]) {
  test(`heure 24 h dès étoile 1 : ${hour} ${period} exige ${answer}`, async ({ page }) => {
    await boot(page);
    // Every question drawn in this test shows the same hour and period.
    const sameHour = () =>
      page.evaluate(
        ({ hour, period }) => {
          let i = 0;
          const values = [(hour - 1) / 12, 0, period === 'morning' ? 0 : 0.99];
          Math.random = () => values[i++ % 3];
        },
        { hour, period },
      );
    await sameHour();
    await ready(page);
    await expect(page.locator('.time-period')).toHaveAttribute('data-period', period);
    const wrong = answer === '00' ? '12' : answer === '12' ? '00' : '03';
    await digits(page, wrong + '00');
    await page.locator('#validate').click();
    await expect(page.locator('#feedback')).toContainText('raté');
    expect((await state(page)).adventures.clock.xp).toBe(0);
    await page.clock.runFor(1050);
    await page.locator('#feedback-next').click();
    const panel = page.locator('#duel-panel');
    await expect(panel).toHaveAttribute('data-panel', 'correction');
    await expect(panel.locator('.is-wrong s')).toHaveText(given);
    await expect(panel.locator('.is-right')).toHaveText(expected);
    await expect(panel.locator('.correction-figure .time-period')).toHaveAttribute(
      'data-period',
      period,
    );
    await expect(panel.locator('.correction-steps li')).toHaveCount(3);
    await expect(panel.locator('.correction-steps li').last()).toContainText(rule);
    await expect(page.locator('#panel-next')).toHaveText('ESSAYER UNE AUTRE HEURE');
    await sameHour();
    await page.locator('#panel-next').click();
    await expect(page.locator('.battle-shell')).toHaveAttribute('data-phase', 'active');
    await expect(panel).toBeHidden();
    await expect(page.locator('#hour-value')).toHaveText('--');
    await expect(page.locator('#minute-value')).toHaveText('--');
    await digits(page, answer + '00');
    await page.locator('#validate').click();
    await expect(page.locator('#feedback')).toContainText('Bravo');
    expect((await state(page)).adventures.clock.xp).toBe(20);
  });
}

test('leçon depuis aventure : horloge manipulable, conversions et exemples', async ({ page }) => {
  await boot(page);
  await page.locator('#choose-clock').click();
  await page.locator('#read-lesson').click();
  const lesson = page.locator('.clock-lesson');
  await expect(lesson).toBeVisible();
  await expect(lesson.locator('.lesson-clock-row .clock')).toHaveCount(4);
  await expect(lesson.locator('.lesson-minute-grid span')).toHaveCount(12);
  await lesson.locator('[data-period=afternoon]').click();
  await lesson.locator('[data-minute="35"]').click();
  await expect(lesson.locator('#lesson-answer')).toContainText('14 h 35');
  await lesson.locator('#lesson-hour-minus').click();
  await lesson.locator('#lesson-hour-minus').click();
  await expect(lesson.locator('#lesson-answer')).toContainText('12 h 35');
  await lesson.locator('[data-period=morning]').click();
  await expect(lesson.locator('#lesson-answer')).toContainText('00 h 35');
  await page.getByRole('button', { name: 'Fermer la leçon' }).click();
  await expect(lesson).toHaveCount(0);
  await page.locator('[data-adventure=math]').click();
  await expect(page.locator('#read-lesson')).toHaveCount(0);
  await expect(page.locator('#train-adventure')).toHaveAttribute('aria-label', /Maths/);
});

test('carte des niveaux : île en cours au centre, niveaux verrouillés, étoiles par niveau', async ({
  page,
}) => {
  await boot(page, { clockXP: 350, mathXP: 2100 });
  await page.locator('#choose-clock').click();
  const map = page.locator('.adventure-map');
  await expect(map.getByRole('heading', { name: 'MON AVENTURE' })).toBeVisible();
  await expect(map.locator('.isle')).toHaveCount(20);
  await expect(map.locator('.isle.is-selected')).toHaveAttribute('data-level', '4');
  await expect(map.locator('.map-summary')).toContainText('Niveau 4 / 20 • 3 étoiles sur 60');
  await expect(map.locator('#map-level-title')).toHaveText('NIVEAU 4 • LA TOUR DE L’HORLOGE');
  await expect(map.locator('#train-adventure')).toHaveText('JOUER');
  await expect(map.locator('#map-level-info')).toHaveText('À toi de jouer ! Encore 50 XP.');
  await expect(map.locator('.isle.is-done')).toHaveCount(3);
  await expect(map.locator('.isle.is-locked')).toHaveCount(16);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);

  await map.locator('#map-next').click();
  await expect(map.locator('.isle.is-selected')).toHaveAttribute('data-level', '5');
  await expect(map.locator('#map-level-info')).toHaveText('Termine le niveau 4 pour l’ouvrir.');
  await expect(map.locator('#train-adventure')).toBeDisabled();
  await map.locator('#map-prev').click();
  await map.locator('#map-prev').click();
  await expect(map.locator('#map-level-info')).toHaveText(
    '1 étoile sur 3. Rejoue en difficulté deux étoiles !',
  );
  await expect(map.locator('#train-adventure')).toBeEnabled();
  await expect(map.locator('#train-adventure')).toHaveText('REJOUER');
  for (const size of [
    { width: 390, height: 844 },
    { width: 844, height: 390 },
    { width: 1280, height: 720 },
  ]) {
    await page.setViewportSize(size);
    await page.waitForTimeout(700);
    const stars = await map.locator('.isle.is-selected .isle-stars').boundingBox();
    const panel = await map.locator('.map-panel').boundingBox();
    expect(stars.height).toBeGreaterThan(0);
    expect(stars.y + stars.height).toBeLessThanOrEqual(panel.y);
  }
  await page.setViewportSize({ width: 390, height: 844 });

  const pictures = () =>
    map
      .locator('.isle')
      .evaluateAll((isles) =>
        isles.map((isle) => isle.querySelector('img')?.getAttribute('src') ?? 'drawn'),
      );
  const clockPictures = await pictures();
  await map.locator('[data-adventure=math]').click();
  expect(await pictures()).toEqual(clockPictures);
  await expect(map.locator('.isle.is-selected')).toHaveAttribute('data-level', '2');
  await expect(map.locator('.map-summary')).toContainText('21 étoiles sur 60');
  await expect(map.locator('.isle[data-level="20"]')).toHaveAttribute(
    'aria-label',
    /terminé, 1 étoile sur 3/,
  );
  await map.locator('#map-settings').click();
  await page
    .getByRole('navigation', { name: 'Navigation mobile', exact: true })
    .getByRole('button', { name: 'Aventure' })
    .click();
  await expect(map.locator('[data-adventure=math]')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#map-back').click();
  await expect(page.getByRole('heading', { name: 'Magic Learning Quest' })).toBeVisible();
});

test('carte des niveaux : un niveau terminé se rejoue en difficulté deux étoiles', async ({
  page,
}) => {
  await boot(page, { clockXP: 350 });
  await page.locator('#choose-clock').click();
  await page.setViewportSize({ width: 844, height: 390 });
  const map = page.locator('.adventure-map');
  await expect(map).not.toHaveClass(/is-tall/);
  await map.locator('#train-adventure').click();
  await expect(page.locator('.battle-shell')).toHaveAttribute('data-star', '1');
  await page.evaluate(() => (location.hash = ''));
  await page.reload();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#choose-clock').click();
  await page.locator('.isle[data-level="1"]').evaluate((isle) => isle.click());
  await expect(map.locator('#train-adventure')).toHaveText('REJOUER');
  await page.setViewportSize({ width: 844, height: 390 });
  await map.locator('#train-adventure').click();
  await expect(page.locator('.battle-shell')).toHaveAttribute('data-star', '2');
  const saved = (await state(page)).adventures.clock;
  expect(saved.cursor).toBe(2000);
  expect(saved.stars.slice(0, 5)).toEqual([1, 1, 1, 0, 0]);
  expect(saved.partial[3]).toBe(50);
});

test('accueil : Horloge et Maths ouvrent la carte sur le niveau à jouer', async ({ page }) => {
  await boot(page, { clockXP: 350, mathXP: 120 });
  await expect(page.locator('#explore')).toHaveCount(0);
  await page.locator('#choose-math').click();
  const map = page.locator('.adventure-map');
  await expect(map.locator('[data-adventure=math]')).toHaveAttribute('aria-pressed', 'true');
  await expect(map.locator('.isle.is-selected')).toHaveAttribute('data-level', '2');
  await page.locator('#map-back').click();
  // Level 1 chosen for a replay but not started: it is already won, so the map
  // opens on the next level to win instead.
  await page.evaluate(() => {
    const save = JSON.parse(localStorage.getItem('astrea.save'));
    Object.assign(save.adventures.clock, {
      cursor: 2000,
      stars: [1, 1, 1, ...Array(17).fill(0)],
      partial: [0, 0, 0, 50, ...Array(16).fill(0)],
    });
    localStorage.setItem('astrea.save', JSON.stringify(save));
  });
  await page.reload();
  await page.locator('#choose-clock').click();
  await expect(map.locator('.isle.is-selected')).toHaveAttribute('data-level', '4');
  await expect(map.locator('#train-adventure')).toHaveText('JOUER');
});

test('leçon en combat : défi, question et chrono vraiment suspendus', async ({ page }) => {
  await boot(page, {
    settings: {
      difficulty: 'auto',
      clockLevel: 'auto',
      relaxed: false,
      sound: false,
    },
  });
  await enter(page, 'clock');
  await landscape(page);
  const waiting = await page.locator('#timer').textContent();
  await page.locator('#battle-lesson').click();
  await expect(page.locator('.clock-lesson')).toBeVisible();
  await page.clock.runFor(20000);
  await expect(page.locator('.battle-shell')).toHaveAttribute('data-phase', 'intro');
  await expect(page.locator('#timer')).toHaveText(waiting);
  await page.keyboard.press('Escape');
  await expect(page.locator('.clock-lesson')).toHaveCount(0);
  await expect(page.locator('.duel-pause')).toBeHidden();
  await begin(page);
  await page.clock.runFor(1500);
  await expect(page.locator('#timer')).not.toHaveText(waiting);
  const before = await page.locator('#timer').textContent();
  const hand = await page
    .locator('.hour-hand')
    .evaluate((el) => el.parentNode.getAttribute('transform'));
  await page.locator('#battle-lesson').click();
  await page.clock.runFor(60000);
  await expect(page.locator('#timer')).toHaveText(before);
  await page.getByRole('button', { name: 'Fermer la leçon' }).click();
  await expect(page.locator('.hour-hand')).toHaveCount(1);
  expect(
    await page.locator('.hour-hand').evaluate((el) => el.parentNode.getAttribute('transform')),
  ).toBe(hand);
  await solveClock(page);
  expect((await state(page)).adventures.clock.xp).toBe(25);
});

test('réinitialisation : annulation sûre puis un seul parcours effacé, historique conservé', async ({
  page,
}) => {
  await boot(page, { clockXP: 2020, mathXP: 250 });
  await settings(page);
  await page.locator('#edit-mage').click();
  await page.getByLabel('Ton nom de mage').fill('Mira');
  await page.getByRole('button', { name: 'Enregistrer mon mage' }).click();
  const before = await state(page);
  await page.locator('[data-reset=clock]').click();
  await expect(page.locator('.reset-dialog')).toBeVisible();
  await page.locator('#cancel-reset').click();
  expect(await state(page)).toEqual(before);
  await page.locator('[data-reset=clock]').click();
  await page.locator('#confirm-reset').click();
  const after = await state(page);
  await expect(page.locator('#clock-stat-progression')).toHaveText(
    'Horloge : 0 XP · 0/3 étoiles · 0 points',
  );
  await expect(page.locator('#math-stat-progression')).toContainText('250 XP');
  expect(after.adventures.clock.xp).toBe(0);
  expect(after.adventures.math).toEqual(before.adventures.math);
  expect(after.avatar).toEqual(before.avatar);
  expect(after.stats).toEqual(before.stats);
  expect(after.history).toEqual(before.history);
  await page.reload();
  await expect(page.getByTestId('clock-progress')).toContainText('Niveau 1/20');
  await settings(page);
  expect((await state(page)).adventures.math.xp).toBe(250);
});

test('migration réelle V1 conserve total, avatar, statistiques et copie originale', async ({
  page,
}) => {
  await boot(page);
  const legacy = await state(page);
  legacy.avatar = {
    name: 'Mira',
    skin: 'peach',
    hair: 'chestnut',
    style: 'short',
    face: 'freckles',
    robe: 'violet',
    hat: 'pointed',
    wand: 'star',
  };
  legacy.version = 1;
  delete legacy.adventures;
  legacy.xp = 400;
  legacy.score = 2000;
  legacy.stats.clock.correct = 3;
  legacy.stats.math.correct = 1;
  await page.evaluate((s) => localStorage.setItem('astrea.save', JSON.stringify(s)), legacy);
  await page.reload();
  const migrated = await state(page);
  expect(migrated.version).toBe(2);
  expect(migrated.adventures.clock.xp).toBe(300);
  expect(migrated.adventures.math.xp).toBe(100);
  expect(migrated.avatar).toMatchObject(legacy.avatar);
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem('astrea.save.v1.backup'))),
  ).toEqual(legacy);
  await ready(page);
  await solveClock(page);
  await menu(page);
  await page.reload();
  expect((await state(page)).adventures.math.xp).toBe(100);
});

test('icônes PWA et Apple : nouvelle illustration, PNG valides et cache offline', async ({
  page,
  context,
}) => {
  await boot(page);
  const manifest = await (await page.request.get(base + 'manifest.webmanifest')).json();
  for (const icon of manifest.icons) {
    expect(icon.src).toContain('magic-quest');
    const response = await page.request.get(base + icon.src);
    expect(response.status()).toBe(200);
    const bytes = await response.body();
    const size = Number(icon.sizes.split('x')[0]);
    expect(bytes.readUInt32BE(16)).toBe(size);
    expect(bytes.readUInt32BE(20)).toBe(size);
  }
  const apple = await page.locator('link[rel=apple-touch-icon]').getAttribute('href');
  expect(apple).toContain('apple-touch-magic-quest.png');
  const bytes = await (await page.request.get(apple)).body();
  expect(bytes.readUInt32BE(16)).toBe(180);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);
  await page.reload();
  expect(
    await page.evaluate(async () => {
      const r = await fetch(document.querySelector('link[rel=apple-touch-icon]').href);
      return r.ok;
    }),
  ).toBe(true);
});

test('étoile Horloge : passage indépendant, nouvelles minutes et temps réduit', async ({
  page,
}) => {
  await boot(page, {
    clockXP: 1975,
    mathXP: 300,
    settings: {
      difficulty: 'easy',
      clockLevel: '0',
      relaxed: false,
      sound: false,
    },
  });
  await ready(page);
  await solveClock(page);
  await finish(page);
  await expect(page.locator('.rescue-celebration h2')).toContainText('Étoile 1/3');
  await page.locator('#rescue-continue').click();
  await begin(page);
  await expect(page.locator('.battle-shell')).toHaveAttribute('data-star', '2');
  await expect(page.locator('.exercise-meta')).toContainText('De 5 en 5');
  await expect(page.locator('#timer')).toHaveText('20 s');
  const saved = await state(page);
  expect(saved.adventures.clock.xp).toBe(2000);
  expect(saved.adventures.math.xp).toBe(300);
});
