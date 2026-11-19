import { adventureFor } from '../../domain/adventures.js';
import { MAP_LEVELS as TOTAL, ZONES, mapLevels } from '../../domain/adventure-map.js';
import { isleSVG } from './isles.js';
import './map.css';

// Level map of an adventure: one floating isle per level, the chosen one in the middle.
const STEP = 230;
const ISLE_W = 200;
const ISLE_H = 250;
const BASE_Y = 392;
const TRACK_W = TOTAL * STEP;
const MODES = [
  ['clock', 'HORLOGE', 'Horloge'],
  ['math', 'MATHS', 'Maths'],
];
const STATUS_WORDS = { done: 'terminé', current: 'en cours', locked: 'verrouillé' };
const asset = (name) => `${import.meta.env.BASE_URL}map/${name}.webp`;
const pad = (n) => String(n).padStart(2, '0');
const cx = (n) => (n - 1) * STEP + STEP / 2;
const cy = (n) => BASE_Y + Math.round(20 * Math.sin((n - 1) * 1.25));
const zoneIndex = (n) => ZONES.findIndex(([, last]) => n <= last);
const isleZone = (n) => (n <= 10 ? 'forest' : n <= 15 ? 'mountain' : 'dragon');
const plural = (count, word) => `${count} ${word}${count > 1 ? 's' : ''}`;
function trail(from, to) {
  let d = `M${cx(from)} ${cy(from)}`;
  for (let n = from + 1; n <= to; n++)
    d += ` C${cx(n - 1) + STEP / 2} ${cy(n - 1)}, ${cx(n) - STEP / 2} ${cy(n)}, ${cx(n)} ${cy(n)}`;
  return d;
}
const ICONS = {
  back: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="#4a3017" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12H5"/><path d="M11 5.5L4.5 12l6.5 6.5"/></svg>',
  settings:
    '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="#5d3a16"><circle cx="12" cy="12" r="8.2" stroke-width="3.6" stroke-dasharray="3.2 3.24"/><circle cx="12" cy="12" r="5.6" stroke-width="3"/></svg>',
  lesson:
    '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="#5d3a16" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 6.5C10 5 7 4.6 3.5 5v13c3.5-.4 6.5 0 8.5 1.5 2-1.5 5-1.9 8.5-1.500V5C17 4.6 14 5 12 6.500z"/><path d="M12 6.500V19.5"/></svg>',
  prev: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="#4a3017" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
  next: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="#4a3017" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>',
  clock:
    '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 6.5V12l3.5 2"/></svg>',
  math: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"><path d="M3.5 7h6M6.5 4v6M14.5 4.5l5 5M19.5 4.5l-5 5M3.5 17h6M14 17h6.5"/><circle cx="17.2" cy="13.6" r="0.6"/><circle cx="17.2" cy="20.4" r="0.6"/></svg>',
  spark:
    '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 1.5l2.6 7.9 7.9 2.6-7.9 2.6-2.6 7.9-2.6-7.9L1.5 12l7.9-2.600z" fill="currentColor"/></svg>',
  pointer:
    '<svg class="isle-pointer" aria-hidden="true" viewBox="0 0 34 26"><path d="M4 4h26L17 22z" fill="#ffdc63" stroke="#28152f" stroke-width="3.5" stroke-linejoin="round"/></svg>',
};
const starSVG = (on) =>
  `<svg viewBox="0 0 24 24"><path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.600L12 17.300l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z" fill="${on ? '#ffdc63' : '#4a3f73'}" stroke="#28152f" stroke-width="2.2" stroke-linejoin="round"/></svg>`;

const STAR_WORDS = ['', 'une étoile', 'deux étoiles', 'trois étoiles'];
function levelInfo(level) {
  if (level.status === 'locked')
    return level.n === TOTAL
      ? 'Termine les 19 niveaux pour affronter le dragon.'
      : `Termine le niveau ${level.n - 1} pour l’ouvrir.`;
  const left = level.remaining < 100 ? ` Encore ${level.remaining} XP.` : '';
  if (level.earned === 3) return 'Parfait, 3 étoiles sur 3 ! Rejoue pour t’entraîner.';
  if (level.earned)
    return `${plural(level.earned, 'étoile')} sur 3. Rejoue en difficulté ${STAR_WORDS[level.nextStar]} !${left}`;
  return `${level.n === TOTAL ? 'Le dragon t’attend. Courage !' : 'À toi de jouer !'}${left}`;
}
// The same picture in both adventures and in every state: only the padlock,
// the stars and the greyed look of a locked level change.
const PAINTED = new Set([1, 2, 3, 4, 20]);
const painted = (level) => PAINTED.has(level.n);
const PADLOCK =
  '<svg class="isle-padlock" viewBox="0 0 40 44" aria-hidden="true" fill="none" stroke="#2a1d3d" stroke-linecap="round"><path d="M10 20 V13 A10 10 0 0 1 30 13 V20" stroke-width="4"/><rect x="4" y="18" width="32" height="24" rx="5" fill="#ece6f6" stroke-width="3"/><circle cx="20" cy="28" r="3.5" fill="#2a1d3d" stroke="none"/><path d="M20 30 V36" stroke-width="3"/></svg>';
const artFor = (level) =>
  painted(level)
    ? `<img class="isle-painting" src="${asset(`isle-${pad(level.n)}`)}" alt="" draggable="false" />${level.status === 'locked' ? PADLOCK : ''}`
    : isleSVG({
        num: level.n,
        kind: level.kind,
        tint: level.tint,
        zone: isleZone(level.n),
        locked: level.status === 'locked',
        done: level.status === 'done',
      });

export function createAdventureMap({ getState, onPlay, onNavigate, onLesson, onMode }) {
  let mode = 'clock';
  let picked = {};
  let root = null;
  let levels = [];
  let stars = 0;
  let scale = 1;
  let drag = null;
  let justDragged = false;
  let toastTimer = 0;
  const seen = {};
  // The level the mage stands on, and the furthest level opened so far.
  const active = () => levels.find((level) => level.active);
  const next = () => levels.find((level) => level.status === 'current');
  // Opens on the level being played; once that one is beaten, on the next level to win.
  const current = () =>
    (active().earned && active().remaining === 100 ? (next() ?? active()) : active()).n;
  const frontier = () => levels.findLast((level) => level.status !== 'locked').n;
  const selected = () => picked[mode] ?? current();

  function fit() {
    if (!root?.isConnected) return;
    const frame = root.querySelector('.adventure-map'),
      stage = root.querySelector('.map-stage'),
      box = getComputedStyle(frame);
    const width = frame.clientWidth - parseFloat(box.paddingLeft) - parseFloat(box.paddingRight),
      height = frame.clientHeight - parseFloat(box.paddingTop) - parseFloat(box.paddingBottom);
    const tall = height > width * 1.15;
    scale = tall ? width / 560 : Math.min(width / 1120, height / 720);
    frame.classList.toggle('is-tall', tall);
    stage.style.width = `${width / scale}px`;
    stage.style.height = `${height / scale}px`;
    stage.style.transform = `scale(${scale})`;
    place(false);
  }
  function place(animated = true, offset = 0) {
    const track = root.querySelector('.map-track');
    const middle = root.querySelector('.map-stage').offsetWidth / 2;
    track.style.transition = animated ? '' : 'none';
    track.style.transform = `translateX(${middle - cx(selected()) + offset}px)`;
  }
  function refresh() {
    const n = selected(),
      level = levels[n - 1],
      locked = level.status === 'locked',
      playable = !locked,
      label = MODES.find(([id]) => id === mode)[2];
    root.querySelectorAll('.isle').forEach((button) => {
      const on = Number(button.dataset.level) === n;
      button.classList.toggle('is-selected', on);
      button.setAttribute('aria-pressed', on);
    });
    root
      .querySelectorAll('.map-zone')
      .forEach((zone, index) => zone.classList.toggle('is-on', index === zoneIndex(n)));
    root.querySelector('#map-prev').disabled = n <= 1;
    root.querySelector('#map-next').disabled = n >= TOTAL;
    root.querySelector('.map-summary').textContent =
      `${label} • ${ZONES[zoneIndex(n)][0]} • Niveau ${frontier()} / 20 • ${plural(stars, 'étoile')} sur 60`;
    root.querySelector('.map-thumb').innerHTML = !painted(level)
      ? artFor(level)
      : `<img src="${asset(level.n === 4 ? 'thumb-04' : `isle-${pad(level.n)}`)}" alt="" />${locked ? PADLOCK : ''}`;
    root.querySelector('.map-thumb').classList.toggle('is-locked', locked);
    root.querySelector('.map-thumb').classList.toggle('is-drawn', !painted(level));
    root.querySelector('#map-level-title').textContent = `NIVEAU ${level.n} • ${level.name}`;
    const starRow = root.querySelector('#map-level-stars');
    starRow.innerHTML = locked ? '' : [1, 2, 3].map((k) => starSVG(k <= level.earned)).join('');
    if (locked) starRow.removeAttribute('aria-label');
    else starRow.setAttribute('aria-label', `${plural(level.earned, 'étoile')} sur 3`);
    root.querySelector('#map-level-duel').textContent =
      `${label} : ${locked ? 'un adversaire mystère' : `duel contre ${level.enemy}`}`;
    root.querySelector('#map-level-info').textContent = levelInfo(level);
    const play = root.querySelector('#train-adventure');
    play.disabled = !playable;
    play.querySelector('span').textContent = level.earned ? 'REJOUER' : 'JOUER';
    play.classList.toggle('is-replay', Boolean(level.earned));
    play.setAttribute(
      'aria-label',
      playable
        ? `${level.earned ? 'Rejouer' : 'Jouer'} le niveau ${level.n}, ${label}, difficulté ${STAR_WORDS[level.nextStar]}`
        : `Niveau ${level.n} ${STATUS_WORDS[level.status]}`,
    );
    place();
  }
  function select(n) {
    picked[mode] = Math.max(1, Math.min(TOTAL, n));
    refresh();
  }
  function bindDrag() {
    const area = root.querySelector('.map-drag');
    area.onpointerdown = (event) => {
      drag = { x: event.clientX, moved: false };
    };
    area.onpointermove = (event) => {
      if (!drag) return;
      const dx = (event.clientX - drag.x) / scale;
      if (!drag.moved && Math.abs(dx) > 8) {
        drag.moved = true;
        area.classList.add('is-dragging');
        try {
          area.setPointerCapture(event.pointerId);
        } catch {
          /* The pointer is already gone. */
        }
      }
      if (drag.moved) place(false, dx);
    };
    const release = (event, cancelled) => {
      const held = drag;
      drag = null;
      area.classList.remove('is-dragging');
      if (!held?.moved) return;
      const dx = cancelled ? 0 : (event.clientX - held.x) / scale;
      let steps = 0;
      if (Math.abs(dx) > 40) steps = -Math.sign(dx) * Math.max(1, Math.round(Math.abs(dx) / STEP));
      justDragged = true;
      setTimeout(() => (justDragged = false), 0);
      select(selected() + steps);
    };
    area.onpointerup = (event) => release(event, false);
    area.onpointercancel = (event) => release(event, true);
  }
  function render(container) {
    root = container;
    const progress = adventureFor(getState(), mode);
    levels = mapLevels(progress);
    stars = levels.reduce((sum, level) => sum + level.earned, 0);
    const fresh = seen[mode] !== undefined && frontier() > seen[mode] ? frontier() : 0;
    seen[mode] = frontier();
    if (fresh) picked[mode] = fresh;
    root.innerHTML = `<section class="adventure-map" aria-label="Mon aventure"><div class="map-stage">${ZONES.map((_, index) => `<div class="map-zone map-zone-${index}" aria-hidden="true"></div>`).join('')}<div class="map-drag"><div class="map-track" aria-label="Carte des niveaux" style="width:${TRACK_W}px"><svg class="map-trail" aria-hidden="true" width="${TRACK_W}" height="720" viewBox="0 0 ${TRACK_W} 720" fill="none" stroke-linecap="round"><path d="${trail(1, frontier())}" stroke="#ffdc63" stroke-width="5" stroke-dasharray="1 11"/><path d="${trail(frontier(), TOTAL)}" stroke="#fff6dc" stroke-width="4" stroke-dasharray="1 10" opacity="0.7"/></svg>${levels
      .map(
        (level) =>
          `<button class="isle is-${level.status} ${level.n === fresh ? 'is-fresh' : ''}" data-level="${level.n}" aria-pressed="false" aria-label="Niveau ${level.n}, ${level.name.toLowerCase()}, ${STATUS_WORDS[level.status]}${level.earned ? `, ${plural(level.earned, 'étoile')} sur 3` : ''}" style="left:${cx(level.n) - ISLE_W / 2}px;top:${cy(level.n) - ISLE_H / 2}px">${level.n === fresh ? '<span class="isle-burst" aria-hidden="true"></span>' : ''}${artFor(level)}${ICONS.pointer}${level.earned ? `<span class="isle-stars" aria-hidden="true">${[1, 2, 3].map((k) => starSVG(k <= level.earned)).join('')}</span>` : ''}</button>`,
      )
      .join(
        '',
      )}</div></div>${fresh ? `<p class="map-unlocked" role="status">NIVEAU ${fresh} DÉBLOQUÉ !</p>` : ''}<button class="map-button map-back" id="map-back" aria-label="Retour à l’accueil" title="Retour à l’accueil">${ICONS.back}</button><div class="map-tools"><button class="map-button map-settings" id="map-settings" aria-label="Réglages" title="Réglages">${ICONS.settings}</button>${mode === 'clock' ? `<button class="map-button map-settings is-small" id="read-lesson" aria-label="Relire la leçon" title="Relire la leçon">${ICONS.lesson}</button>` : ''}</div><button class="map-button map-arrow map-prev" id="map-prev" aria-label="Niveau précédent" title="Niveau précédent">${ICONS.prev}</button><button class="map-button map-arrow map-next" id="map-next" aria-label="Niveau suivant" title="Niveau suivant">${ICONS.next}</button><header class="map-header"><h1>MON AVENTURE</h1><div class="map-modes" role="group" aria-label="Choisis ton aventure">${MODES.map(([id, label]) => `<button class="map-mode map-mode-${id}" data-adventure="${id}" aria-pressed="${mode === id}">${ICONS[id]}${label}</button>`).join('')}</div><p class="map-summary"></p></header><section class="map-panel" aria-label="Niveau choisi"><div class="map-thumb"></div><span class="map-rule" aria-hidden="true"></span><div class="map-level"><div class="map-level-head"><h2 id="map-level-title"></h2><span id="map-level-stars" class="map-level-stars" role="img"></span></div><p id="map-level-duel"></p><p id="map-level-info"></p></div><button class="map-play" id="train-adventure">${ICONS.spark}<span>JOUER</span></button></section></div></section>`;
    root.querySelectorAll('.isle').forEach(
      (button) =>
        (button.onclick = () => {
          if (!justDragged) select(Number(button.dataset.level));
        }),
    );
    root.querySelectorAll('[data-adventure]').forEach(
      (button) =>
        (button.onclick = () => {
          mode = button.dataset.adventure;
          onMode?.(mode);
          delete picked[mode];
          render(root);
        }),
    );
    root.querySelector('#map-prev').onclick = () => select(selected() - 1);
    root.querySelector('#map-next').onclick = () => select(selected() + 1);
    root.querySelector('#map-back').onclick = () => onNavigate('home');
    root.querySelector('#map-settings').onclick = () => onNavigate('settings');
    root.querySelector('#read-lesson')?.addEventListener('click', () => onLesson());
    root.querySelector('#train-adventure').onclick = () => onPlay(mode, selected() - 1);
    bindDrag();
    refresh();
    fit();
    clearTimeout(toastTimer);
    if (fresh) toastTimer = setTimeout(() => root.querySelector('.map-unlocked')?.remove(), 2200);
  }
  addEventListener('resize', fit);
  return {
    /** Draws the map in `container`, centred on the level being played. */
    open(container, { adventure } = {}) {
      if (adventure) mode = adventure;
      picked = {};
      render(container);
    },
  };
}
