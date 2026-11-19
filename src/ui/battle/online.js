import { adventureFor, difficultyForAdventure } from '../../domain/adventures.js';
import { VERSUS } from '../../domain/versus.js';
import { avatarColor } from '../../domain/duel.js';
import { connectDuels } from '../../online/client.js';
import { battleView, ICONS } from './view.js';
import { wizardSVG, escapeHTML } from './characters.js';
import { sceneSVG } from './scenes.js';
import { aimSpell } from './spell.js';

const MODE_NAMES = { clock: 'Horloge magique', math: 'Maths magiques' };
const CLOSED = {
  declined: 'Ton défi a été refusé.',
  cancelled: 'Le défi a été annulé.',
  timeout: 'Le défi est resté sans réponse.',
  gone: 'Ce joueur est parti.',
};
const ERRORS = {
  busy: 'Ce joueur est déjà occupé.',
  gone: 'Ce joueur est parti.',
  mode: 'Ce duel n’existe pas.',
  room: 'Ce code n’existe pas. Vérifie-le avec ton ami.',
  'room-full': 'Ce salon est complet.',
  'room-tries': 'Trop de codes essayés. Reviens plus tard.',
};
// Delay between a spell leaving the wand and its impact, in milliseconds.
const IMPACT_MS = 1000;

// Online duels: a lobby listing connected players, invitations, then a duel in the arena.
export function createOnlineDuel({ url, getState, setState, render, onNavigate, sounds }) {
  let link = null,
    mode = null,
    stage = null,
    players = [],
    rival = null,
    health = { me: VERSUS.health, rival: VERSUS.health },
    round = null,
    exercise = null,
    locked = false,
    answer = '',
    hour = '',
    minute = '',
    field = 'hour',
    deadline = 0,
    ticker = null,
    timers = [],
    notice = '',
    room = null,
    origin = null;
  const portrait = matchMedia('(max-width: 600px) and (orientation: portrait)');
  const root = () => document.querySelector('.battle-shell');
  const $ = (selector) => document.querySelector(selector);
  const sound = () => getState().settings.sound;
  const later = (fn, ms) => timers.push(setTimeout(fn, ms));
  const clearTimers = () => {
    timers.forEach(clearTimeout);
    timers = [];
    clearInterval(ticker);
  };
  function stop() {
    clearTimers();
    link?.close();
    link = null;
    stage = null;
    mode = null;
    sounds.stop();
  }
  // `from` is where the back button returns: the duel against the machine, or home.
  function open(nextMode, from = origin ?? 'duel') {
    stop();
    mode = nextMode;
    origin = from;
    room = null;
    notice = '';
    players = [];
    lobby('connecting');
    link = connectDuels(url, {
      onOpen() {
        const state = getState();
        const tier = (m) => difficultyForAdventure(m, state.settings, adventureFor(state, m)).level;
        link.send({
          t: 'hello',
          name: state.avatar.name,
          avatar: state.avatar,
          levels: { clock: tier('clock'), math: tier('math') },
        });
      },
      onMessage: receive,
      onClose() {
        clearTimers();
        link = null;
        if (stage === 'duel') finish('lost');
        else if (stage) lobby('offline');
      },
    });
  }
  function syncRotation() {
    const shell = root();
    if (!shell || !stage) return;
    const turn = shell.querySelector('.rotate-notice');
    if (turn) turn.hidden = !portrait.matches;
    shell.classList.toggle('needs-rotation', portrait.matches);
  }

  // Lobby ---------------------------------------------------------------------------------
  function lobby(status) {
    stage = status === 'connecting' || status === 'offline' ? status : 'lobby';
    const me = getState().avatar;
    render(
      `<section class="battle-shell online-lobby" data-phase="lobby" data-mode="${mode}">${sceneSVG(19)}<div class="battle-vignette" aria-hidden="true"></div>
 <header class="battle-toolbar"><button class="battle-tool" id="online-back" aria-label="${origin === 'home' ? 'Retour à l’accueil' : 'Retour au duel contre la machine'}" title="Retour">${ICONS.back}</button><div class="battle-title"><h1>Duel en ligne</h1><p>${MODE_NAMES[mode]}</p></div><div class="battle-tools"><span class="battle-xp" id="online-count"></span></div></header>
 <div class="lobby-body"><figure class="lobby-me"><div class="lobby-portrait" aria-hidden="true">${wizardSVG({ avatar: me, prefix: 'lobby-me' })}</div><figcaption><span>TON MAGE</span><strong>${escapeHTML(me.name)}</strong></figcaption></figure>
 <section class="lobby-panel" aria-labelledby="lobby-title"><div class="lobby-head"><h2 id="lobby-title">${room ? 'Salon privé' : 'Qui veux-tu défier ?'}</h2><div class="lobby-modes" role="group" aria-label="Épreuve du duel">${Object.entries(
   MODE_NAMES,
 )
   .map(
     ([id, label]) =>
       `<button data-lobby-mode="${id}" aria-pressed="${mode === id}">${label.split(' ')[0]}</button>`,
   )
   .join(
     '',
   )}</div></div><div id="lobby-room" class="lobby-room"></div><p id="lobby-status" class="lobby-status" role="status"></p><ul id="lobby-list" class="lobby-list"></ul></section></div>
 <div class="duel-pause" id="lobby-dialog" hidden></div>
 <section class="rotate-notice" hidden aria-label="Tourne ton téléphone"><div class="rotate-phone" aria-hidden="true">▯ ↻ ▭</div><h2>Tourne ton téléphone</h2><p>Le duel se joue à l’horizontale.</p><button class="battle-tool" id="rotate-exit">Retour à l’accueil</button></section></section>`,
    );
    $('#online-back').onclick = () => onNavigate(origin === 'home' ? 'home' : mode);
    $('#rotate-exit').onclick = () => onNavigate('home');
    document.querySelectorAll('[data-lobby-mode]').forEach(
      (button) =>
        (button.onclick = () => {
          mode = button.dataset.lobbyMode;
          lobby('lobby');
        }),
    );
    syncRotation();
    drawRoom();
    drawPlayers();
  }
  // A private room: one friend creates a four-digit code, the other types it in.
  function drawRoom() {
    const box = $('#lobby-room');
    if (!box) return;
    if (stage !== 'lobby') {
      box.innerHTML = '';
      return;
    }
    if (room) {
      box.innerHTML = `<p class="lobby-code">Code du salon <strong id="room-code">${escapeHTML(room)}</strong></p><button class="panel-quiet" id="room-leave">Quitter le salon</button>`;
      $('#room-leave').onclick = () => link?.send({ t: 'room-leave' });
      return;
    }
    box.innerHTML = `<button class="panel-quiet" id="room-create">Créer un code</button><form id="room-form" class="lobby-join"><label for="room-input">J’ai un code</label><input id="room-input" inputmode="numeric" autocomplete="off" maxlength="4" pattern="[0-9]{4}" placeholder="0000" required /><button class="panel-go" id="room-join">Rejoindre</button></form>`;
    $('#room-create').onclick = () => {
      notice = '';
      link?.send({ t: 'room-create' });
    };
    const input = $('#room-input');
    input.oninput = () => (input.value = input.value.replace(/\D/g, '').slice(0, 4));
    $('#room-form').onsubmit = (event) => {
      event.preventDefault();
      notice = '';
      if (/^\d{4}$/.test(input.value)) link?.send({ t: 'room-join', code: input.value });
    };
  }
  function drawPlayers() {
    const list = $('#lobby-list');
    if (!list) return;
    const status = $('#lobby-status');
    const free = players.filter((p) => !p.busy).length;
    $('#online-count').textContent = stage === 'lobby' ? `${players.length} en ligne` : '';
    if (stage === 'connecting') {
      status.textContent = 'Connexion à l’arène…';
      list.innerHTML = '';
      return;
    }
    if (stage === 'offline') {
      status.innerHTML =
        'L’arène en ligne ne répond pas. Vérifie ta connexion. <button class="panel-quiet" id="lobby-retry">Réessayer</button>';
      list.innerHTML = '';
      $('#lobby-retry').onclick = () => open(mode);
      return;
    }
    status.textContent =
      notice ||
      (players.length
        ? free
          ? 'Touche « Défier » pour inviter un joueur.'
          : 'Tous les joueurs sont déjà en duel.'
        : room
          ? 'Donne ce code à ton ami : il apparaîtra ici dès qu’il l’aura saisi.'
          : 'Aucun autre joueur pour l’instant. Reste ici : la liste se met à jour toute seule.');
    list.innerHTML = players
      .map(
        (p) =>
          `<li class="${p.busy ? 'is-busy' : ''}"><span class="lobby-thumb" aria-hidden="true">${wizardSVG({ avatar: p.avatar, prefix: `lobby-${p.id}` })}</span><strong>${escapeHTML(p.name)}</strong>${p.busy ? '<em>En duel</em>' : `<button class="panel-go" data-challenge="${escapeHTML(p.id)}">Défier</button>`}</li>`,
      )
      .join('');
    list.querySelectorAll('[data-challenge]').forEach(
      (button) =>
        (button.onclick = () => {
          notice = '';
          if (sound()) void sounds.unlock();
          link?.send({ t: 'challenge', to: button.dataset.challenge, mode });
        }),
    );
  }
  function dialog(html) {
    const box = $('#lobby-dialog');
    if (!box) return;
    box.hidden = !html;
    box.innerHTML = html ? `<section role="dialog" aria-modal="true">${html}</section>` : '';
    box.querySelector('button')?.focus({ preventScroll: true });
  }
  function closeInvite(text) {
    notice = text;
    if (stage !== 'lobby') return;
    dialog('');
    drawPlayers();
  }

  // Duel ----------------------------------------------------------------------------------
  const valid = () =>
    mode === 'math'
      ? answer !== ''
      : hour !== '' && Number(hour) <= 23 && minute !== '' && Number(minute) <= 59;
  function draw() {
    const state = getState();
    render(
      battleView({
        exercise,
        encounter: {
          index: 19,
          targetStar: 1,
          stars: 0,
          remaining: health.rival,
          rescued: false,
          enemy: { name: rival.name, accent: '#e58bf0', kind: 'player' },
        },
        avatar: state.avatar,
        xp: 0,
        sound: state.settings.sound,
        health: health.me,
        rival,
        round,
      }),
    );
    const shell = root();
    shell.dataset.phase = 'active';
    shell.classList.add('online-duel');
    shell.style.setProperty('--spell-color', avatarColor(state.avatar, 'wand'));
    $('#pause').setAttribute('aria-label', 'Abandonner le duel');
    $('#pause').onclick = () => ($('.duel-pause').hidden = false);
    $('#pause-resume').onclick = () => ($('.duel-pause').hidden = true);
    $('#pause-quit').onclick = () => {
      link?.send({ t: 'leave' });
      onNavigate('home');
    };
    $('#rotate-exit').onclick = () => {
      link?.send({ t: 'leave' });
      onNavigate('home');
    };
    $('#toggle-sound').onclick = toggleSound;
    document.querySelectorAll('[data-key]').forEach((b) => (b.onclick = () => key(b.dataset.key)));
    for (const name of ['hour', 'minute']) {
      const button = $(`#${name}`);
      if (button) button.onclick = () => selectField(name);
    }
    $('#validate').onclick = submit;
    $('#player-health-text').textContent = `${health.me} / 100 PV`;
    $('#enemy-health-text').textContent = `${health.rival} / 100 PV`;
    syncRotation();
    syncInputs();
  }
  function syncInputs() {
    if (!root()) return;
    document.querySelectorAll('[data-key], .answer-field').forEach((b) => (b.disabled = locked));
    const button = $('#validate');
    button.disabled = locked || !valid();
    if (locked && root().dataset.phase === 'active')
      button.textContent = `Raté ! ${rival.name} peut encore répondre…`;
  }
  function selectField(name) {
    if (locked) return;
    field = name;
    for (const id of ['hour', 'minute']) {
      const button = $(`#${id}`);
      button.classList.toggle('selected', id === name);
      button.setAttribute('aria-pressed', String(id === name));
    }
  }
  function key(k) {
    if (locked || stage !== 'duel') return;
    const edit = (value, size) =>
      k === 'clear'
        ? ''
        : k === 'delete'
          ? value.slice(0, -1)
          : size === 2 && value.length === 2
            ? k
            : (value + k).slice(0, size);
    if (mode === 'math') {
      answer = edit(answer, 4);
      $('#math-answer').textContent = answer || '?';
    } else if (field === 'hour') {
      hour = edit(hour, 2);
      $('#hour-value').textContent = hour || '--';
      if (/^\d$/.test(k) && (hour.length === 2 || Number(hour) > 2)) selectField('minute');
    } else {
      minute = edit(minute, 2);
      $('#minute-value').textContent = minute || '--';
    }
    syncInputs();
  }
  function submit() {
    if (locked || stage !== 'duel' || !valid()) return;
    locked = true;
    link?.send({ t: 'answer', n: round.n, value: mode === 'math' ? answer : { hour, minute } });
    if (sound()) void sounds.unlock();
    syncInputs();
  }
  function tick() {
    const timer = $('#timer');
    if (!timer || root().dataset.phase !== 'active') return;
    const left = Math.max(0, (deadline - performance.now()) / 1000);
    timer.textContent = `${Math.ceil(left)} s`;
    $('#timer-bar').style.width = `${(left / exercise.limit) * 100}%`;
    timer.classList.toggle('urgent', left < 6);
    if (left === 0 && !locked) {
      locked = true;
      syncInputs();
      $('#validate').textContent = 'Temps écoulé…';
    }
  }
  function toggleSound() {
    const state = structuredClone(getState());
    state.settings.sound = !state.settings.sound;
    setState(state);
    if (state.settings.sound) void sounds.unlock();
    else sounds.stop();
    const button = $('#toggle-sound');
    button.setAttribute('aria-pressed', String(state.settings.sound));
    button.innerHTML = state.settings.sound ? ICONS.soundOn : ICONS.soundOff;
  }
  // One spell: the caster's pose, the flight, then the hit and the falling life bar.
  function cast(mine, dealt, left) {
    const shell = root();
    if (!shell) return;
    shell.classList.remove('is-casting', 'is-enemy-casting', 'spell-blocked', 'spell-hit');
    $('#damage-pop').classList.remove('visible');
    void shell.offsetWidth;
    shell.style.setProperty(
      '--spell-color',
      avatarColor(mine ? getState().avatar : rival.avatar, 'wand'),
    );
    shell.classList.add(...(mine ? ['is-casting'] : ['is-enemy-casting', 'spell-blocked']));
    aimSpell(shell, !mine);
    if (sound()) sounds.cue(mine ? 'cast' : 'enemy-cast');
    later(() => {
      if (!root()) return;
      root().classList.add('spell-hit');
      const who = mine ? 'enemy' : 'player';
      $(`#${who}-health`).value = left;
      $(`#${who}-health-text`).textContent = `${left} / 100 PV`;
      if (!mine) root().classList.toggle('player-critical', left <= 25);
      const pop = $('#damage-pop');
      pop.textContent = `−${dealt}`;
      pop.classList.add('visible');
      if (sound()) sounds.cue(mine ? 'impact' : 'enemy-impact');
    }, IMPACT_MS);
  }
  function showResult({ you, rival: other }) {
    locked = true;
    health = { me: you.health, rival: other.health };
    const shell = root();
    if (!shell) return;
    shell.dataset.phase = you.correct ? 'success' : 'failure';
    const name = escapeHTML(rival.name);
    const mine = you.correct
      ? `<h3>Bravo !</h3><p>Plus rapide que ${name} : ton sort lui retire <strong>${you.dealt}</strong>${you.fast ? ' · Sort éclair !' : ''}</p>`
      : `<h3>${you.given ? 'Oups, c’est raté !' : you.beaten ? `${name} a été plus rapide !` : 'Temps écoulé !'}</h3><p>Il fallait <strong>${escapeHTML(you.expected)}</strong>.</p>`;
    const theirs = other.correct
      ? `${name} te touche : −${other.dealt} PV.`
      : you.correct
        ? ''
        : `${name} n’a pas trouvé non plus.`;
    const feedback = $('#feedback');
    feedback.className = `duel-feedback ${you.correct ? 'success' : 'retry'}`;
    feedback.innerHTML = `<div class="feedback-text">${mine}</div><div class="feedback-meta"><span>${theirs}</span><span class="feedback-wait"><span>Manche suivante…</span></span></div>`;
    if (you.correct) cast(true, you.dealt, other.health);
    if (other.correct) cast(false, other.dealt, you.health);
  }
  function finish(result, reason) {
    clearTimers();
    stage = 'end';
    const shell = root();
    const name = escapeHTML(rival?.name ?? '');
    const text = {
      win: [
        'Victoire !',
        reason === 'forfeit' ? `${name} a quitté le duel.` : `Tu as vaincu ${name}.`,
      ],
      loss: [`${name} a gagné… cette fois !`, 'Entraîne-toi encore, puis retente ta chance.'],
      draw: ['Égalité !', 'Vous êtes de force égale. Une revanche ?'],
      lost: ['Connexion perdue', 'Le duel s’est interrompu. Vérifie ta connexion.'],
    }[result];
    if (!shell || !$('#duel-panel')) return lobby(link ? 'lobby' : 'offline');
    shell.dataset.phase = result === 'win' ? 'victory' : 'defeat';
    shell.classList.remove('is-casting', 'is-enemy-casting', 'spell-blocked', 'spell-hit');
    $('.duel-pause').hidden = true;
    $('#feedback').innerHTML = '';
    const panel = $('#duel-panel');
    panel.hidden = false;
    panel.dataset.panel = result === 'win' ? 'victory' : result === 'draw' ? 'intro' : 'defeat';
    panel.setAttribute('aria-label', 'Fin du duel');
    panel.innerHTML = `<div class="panel-title"><h2>${text[0]}</h2></div><p class="panel-lead">${text[1]}</p><p class="panel-pill">Toi ${health.me} PV · ${name || 'Adversaire'} ${health.rival} PV</p><div class="panel-actions"><button class="panel-quiet" id="panel-home">${ICONS.home}Accueil</button><button class="panel-go" id="panel-next">${ICONS.players}AUTRE DUEL</button></div>`;
    $('#panel-home').onclick = () => onNavigate('home');
    $('#panel-next').onclick = () => (link ? lobby('lobby') : open(mode));
    $('#panel-next').focus({ preventScroll: true });
    if (sound() && result === 'win') sounds.play(true);
  }

  function receive(message) {
    switch (message.t) {
      case 'welcome':
        lobby('lobby');
        break;
      case 'room':
        room = message.code;
        notice = '';
        if (stage === 'lobby') lobby('lobby');
        break;
      case 'players':
        players = message.list;
        if (stage === 'lobby') drawPlayers();
        break;
      case 'error':
        closeInvite(ERRORS[message.code] ?? 'Ce défi est impossible.');
        break;
      case 'pending':
        dialog(
          `<div class="panel-title"><h2>Défi envoyé</h2></div><p class="panel-lead">En attente de ${escapeHTML(message.to.name)}…</p><button class="panel-quiet" id="invite-cancel">Annuler</button>`,
        );
        $('#invite-cancel').onclick = () => {
          link?.send({ t: 'cancel' });
          dialog('');
        };
        break;
      case 'invite':
        if (stage !== 'lobby') {
          link?.send({ t: 'reply', accept: false });
          break;
        }
        dialog(
          `<div class="panel-title"><h2>${escapeHTML(message.from.name)} te défie !</h2></div><p class="panel-lead">Épreuve : ${MODE_NAMES[message.mode]}</p><button class="panel-go" id="invite-accept">${ICONS.bolt}ACCEPTER</button><button class="panel-quiet" id="invite-decline">Refuser</button>`,
        );
        $('#invite-accept').onclick = () => link?.send({ t: 'reply', accept: true });
        $('#invite-decline').onclick = () => {
          link?.send({ t: 'reply', accept: false });
          dialog('');
        };
        if (sound()) sounds.cue('go');
        break;
      case 'invite-closed':
        closeInvite(CLOSED[message.reason] ?? '');
        break;
      case 'duel-start':
        stage = 'duel';
        mode = message.mode;
        rival = message.rival;
        health = { me: message.health, rival: message.health };
        notice = '';
        break;
      case 'round':
        if (stage !== 'duel') break;
        clearTimers();
        round = { n: message.n, of: message.of };
        exercise = message.exercise;
        locked = false;
        answer = hour = minute = '';
        field = 'hour';
        deadline = performance.now() + exercise.limit * 1000;
        draw();
        ticker = setInterval(tick, 100);
        if (sound() && round.n === 1) sounds.cue('go');
        break;
      case 'rival-missed':
        root()?.classList.add('rival-missed');
        break;
      case 'round-result':
        if (stage !== 'duel') break;
        clearInterval(ticker);
        showResult(message);
        break;
      case 'duel-end':
        if (stage === 'duel') finish(message.result, message.reason);
        break;
    }
  }
  document.addEventListener('keydown', (e) => {
    if (stage !== 'duel' || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
    if (/^\d$/.test(e.key)) key(e.key);
    else if (['Delete', 'Backspace'].includes(e.key)) key('delete');
    else if (e.key === 'Enter' && !e.target.matches('button,a')) submit();
    else return;
    e.preventDefault();
  });
  portrait.addEventListener('change', syncRotation);
  return { open, stop };
}
