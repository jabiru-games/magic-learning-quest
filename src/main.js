import './style.css';
import {
  adventureFor,
  adventureStars,
  cursorOf,
  journeyFor,
  resetAdventure,
  selectLevel,
} from './domain/adventures.js';
import { mountAdventureReset } from './ui/adventure-settings.js';
import { openClockLesson } from './ui/clock-lesson.js';
import { installZoomGuard } from './ui/zoom-guard.js';
import { load, save } from './domain/storage.js';
import { createBattleController } from './ui/battle/controller.js';
import { createOnlineDuel } from './ui/battle/online.js';
import { DUEL_SERVER } from './online/client.js';
import { wizardSVG } from './ui/battle/characters.js';
import { normalizeAvatar, AVATAR_OPTIONS } from './domain/duel.js';
import './ui/battle/battle.css';
import './ui/battle/arena-arcade.css';
import './ui/adventures.css';
import './ui/onboarding.css';
import { mountOnboarding, installCreationViewport } from './ui/onboarding.js';
import { updateCreation, completeCreation } from './domain/onboarding.js';
import { versionMarkup } from './ui/version.js';
import { createSoundPlayer } from './ui/sound.js';
import { createAdventureMap } from './ui/adventure/map.js';
const sounds = createSoundPlayer();

const restored = load();
let state = restored.state;
let warning = restored.warning;
let screen = 'home';
let selectedAdventure = 'clock';
installZoomGuard();
installCreationViewport();
let installPrompt = null;
const app = document.querySelector('#app');
const escape = (str) =>
  String(str).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
const persist = () => {
  if (!save(state)) {
    warning = 'La sauvegarde est indisponible. Garde cette page ouverte pour conserver ta partie.';
    const main = document.querySelector('#main');
    if (main && !main.querySelector('.notice')) {
      const notice = document.createElement('p');
      notice.className = 'notice';
      notice.role = 'status';
      notice.textContent = warning;
      main.prepend(notice);
    }
  }
};
const modeLabel = (mode) => (mode === 'clock' ? 'Horloge' : 'Maths');
const starsMarkup = (stars) =>
  `<span class="journey-stars" aria-label="${stars} étoiles sur 3">${'★'.repeat(stars)}<span>${'☆'.repeat(3 - stars)}</span></span>`;
const duelLinks = {
  getState: () => state,
  setState: (value) => {
    state = value;
    persist();
  },
  render: (content) => shell(content),
  onNavigate: navigate,
  sounds,
};
// Online duels only exist when the build knows a duel server.
const online = DUEL_SERVER ? createOnlineDuel({ ...duelLinks, url: DUEL_SERVER }) : null;
const battle = createBattleController({
  ...duelLinks,
  onOnline: online
    ? (mode) => {
        battle.stop();
        screen = mode;
        online.open(mode, 'duel');
      }
    : undefined,
});
const adventureMap = createAdventureMap({
  getState: () => state,
  onPlay: (mode, index) => {
    state = selectLevel(state, mode, index);
    persist();
    start(mode);
  },
  onNavigate: (next) => navigate(next),
  onLesson: () => openClockLesson(),
  onMode: (mode) => (selectedAdventure = mode),
});
function start(mode) {
  if (!state.onboarding.completed) return home();
  selectedAdventure = mode;
  screen = mode;
  battle.start(mode);
}
function navButton(id, icon, title) {
  return `<button data-nav="${id}" class="nav-item ${screen === id || (id === 'home' && ['clock', 'math'].includes(screen)) ? 'active' : ''}" ${screen === id ? 'aria-current="page"' : ''}><span aria-hidden="true">${icon}</span><span>${title}</span></button>`;
}
function shell(content) {
  document.documentElement.classList.toggle('home-screen', screen === 'home');
  if (!state.onboarding.completed || screen === 'mage') {
    app.innerHTML = `<div class="app-shell is-home onboarding-welcome ${screen === 'mage' ? 'is-editing-mage' : ''}"><main id="main" tabindex="-1">${warning ? `<p class="notice" role="status">${escape(warning)}</p>` : ''}${content}</main><div id="toast" role="status" class="toast"></div></div>`;
    return;
  }
  if (screen === 'adventure') {
    app.innerHTML = `<div class="app-shell in-map"><main id="main" tabindex="-1">${warning ? `<p class="notice" role="status">${escape(warning)}</p>` : ''}${content}</main><div id="toast" role="status" class="toast"></div></div>`;
    return;
  }
  if (['clock', 'math'].includes(screen)) {
    app.innerHTML = `<div class="app-shell in-exercise"><main id="main" tabindex="-1">${warning ? `<p class="notice" role="status">${escape(warning)}</p>` : ''}${content}</main><div id="toast" role="status" class="toast"></div></div>`;
    return;
  }
  app.innerHTML = `<div class="app-shell ${screen === 'home' ? 'is-home' : ''}"><header class="topbar"><a class="brand" href="#home" aria-label="Astréa, accueil"><span class="brand-mark" aria-hidden="true">✦</span><span>ASTRÉA<small>MAGIC LEARNING QUEST</small></span></a><div class="top-status"><span class="online-dot ${navigator.onLine ? '' : 'offline'}"></span><span id="connection">${navigator.onLine ? 'Prêt à explorer' : 'Hors connexion'}</span></div><div class="profile" aria-label="Ton mage"><span aria-hidden="true">🧙</span><div>${escape(state.avatar.name)}<small>Académie d’Astréa</small></div></div></header><div class="layout"><aside class="sidebar"><p class="eyebrow">TON ACADÉMIE</p><nav aria-label="Navigation principale">${navButton('home', '✦', 'Entraînement')}${navButton('adventure', '◇', 'Aventure')}${navButton('settings', '⚙', 'Réglages')}</nav><div class="sidebar-quote"><span>☾</span><p>Les plus grands sorts<br>commencent par<br>un petit progrès.</p><small>ACADÉMIE D’ASTRÉA</small></div><button class="install sidebar-install" data-install>＋ Installer l’application</button></aside><main id="main" tabindex="-1">${warning ? `<p class="notice" role="status">${escape(warning)}</p>` : ''}${content}</main></div><nav class="mobile-nav" aria-label="Navigation mobile">${navButton('home', '✦', 'S’entraîner')}${navButton('adventure', '◇', 'Aventure')}${navButton('settings', '⚙', 'Réglages')}</nav><div id="toast" role="status" class="toast"></div></div>`;
  if (screen === 'home') app.querySelector('.mobile-nav')?.remove();
  app
    .querySelectorAll('[data-nav]')
    .forEach((b) => b.addEventListener('click', () => navigate(b.dataset.nav)));
  app.querySelector('.brand').addEventListener('click', (e) => {
    e.preventDefault();
    navigate('home');
  });
  app.querySelectorAll('[data-install]').forEach((b) => b.addEventListener('click', install));
}
function home() {
  const firstLaunch = !state.onboarding.completed;
  if (firstLaunch && state.onboarding.step !== 'welcome') {
    shell('<div id="creation-root"></div>');
    mountOnboarding(document.querySelector('#creation-root'), {
      getState: () => state,
      change: (value) => {
        state = updateCreation(state, value);
        persist();
      },
      complete: () => {
        state = completeCreation(state);
        persist();
        home();
        document.querySelector('#main').focus({ preventScroll: true });
      },
    });
    return;
  }
  const card = (mode) => {
    const p = adventureFor(state, mode),
      j = journeyFor(cursorOf(p));
    return `<button class="arcade-menu-button ${mode === 'clock' ? 'clock' : 'math'}-button" id="choose-${mode}"><span aria-hidden="true">${mode === 'clock' ? '◷' : '✦'}</span><span>${mode === 'clock' ? 'Horloge magique' : 'Maths magiques'}<small data-testid="${mode}-progress">${starsMarkup(adventureStars(p))} · Niveau ${j.level}/20${j.complete ? ' · Maîtrise !' : ''}</small></span><span aria-hidden="true">➜</span></button>`;
  };
  shell(
    `<section class="arcade-home" aria-label="Accueil de l’académie d’Astréa">${firstLaunch ? '' : '<button class="home-settings" id="home-settings" aria-label="Réglages" title="Réglages"><span aria-hidden="true">⚙</span></button>'}<header class="arcade-brand"><p>ÉCOLE RONCHÈZE</p><h1 aria-label="Magic Learning Quest"><span>MAGIC</span><span>QUEST</span></h1><p class="arcade-subtitle">Apprendre en s’amusant !</p></header><div class="arcade-heroes" role="img" aria-label="Un apprenti mage, une chouette et un petit dragon"></div><div class="arcade-home-bottom">${firstLaunch ? '<p class="welcome-promise">Ton aventure commence ici !</p><button class="arcade-menu-button clock-button welcome-start" id="begin-creation"><svg aria-hidden="true" viewBox="0 0 44 44"><line x1="7" y1="38" x2="24" y2="21" stroke="#303023" stroke-width="8" stroke-linecap="round"/><line x1="7" y1="38" x2="24" y2="21" stroke="#c38b3f" stroke-width="4.5" stroke-linecap="round"/><polygon points="29,3 32.6,11.6 41.9,12.4 34.8,18.5 37,27.6 29,22.7 21,27.6 23.2,18.5 16.1,12.4 25.4,11.6" fill="#ffdc63" stroke="#303023" stroke-width="2.5" stroke-linejoin="round"/></svg> Commencer</button>' : `<p class="arcade-home-progress home-welcome">Bienvenue <strong>${escape(state.avatar.name)}</strong>, à toi de jouer !</p><div class="arcade-menu" aria-label="Choisis ton entraînement">${card('clock')}${card('math')}${online ? '<button class="arcade-menu-button adventure-button" id="challenge-friend"><span class="menu-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="3.2"/><path d="M2.5 19c.6-3.4 2.7-5 5.5-5s4.900 1.600 5.500 5"/><circle cx="17" cy="9" r="2.6"/><path d="M15.5 14.300c3.200-.5 5.400 1.200 6 4.200"/></svg></span><span>Défier un ami<small>Duel en ligne</small></span><span aria-hidden="true">➜</span></button>' : ''}</div>`}${versionMarkup()}</div></section><section class="home-rotate" aria-label="Accueil en portrait"><div aria-hidden="true">▭ ↻ ▯</div><h2>Tourne ton téléphone à la verticale</h2><p>L’accueil se consulte en portrait.<br>Les duels se jouent en paysage.</p></section>`,
  );
  if (firstLaunch) {
    document.querySelector('#begin-creation').onclick = () => {
      state = updateCreation(state, { step: 'choice' });
      persist();
      home();
    };
    return;
  }
  document.querySelector('#home-settings').onclick = () => navigate('settings');
  document.querySelector('#challenge-friend')?.addEventListener('click', () => {
    battle.stop();
    screen = selectedAdventure;
    online.open(selectedAdventure, 'home');
  });
  for (const mode of ['clock', 'math'])
    document.querySelector(`#choose-${mode}`).onclick = () => {
      selectedAdventure = mode;
      navigate('adventure');
    };
}
function adventure() {
  shell('');
  adventureMap.open(document.querySelector('#main'), { adventure: selectedAdventure });
}
function settings() {
  const math = state.stats.math,
    clock = state.stats.clock;
  const errors = Object.entries(clock.buckets)
    .filter(([, v]) => v.wrong > 0)
    .sort((a, b) => b[1].wrong - a[1].wrong)
    .slice(0, 5);
  shell(
    `<div class="page-heading"><div><p class="eyebrow">À TON RYTHME</p><h1>Réglages de l’académie<span class="gold">.</span></h1><p>Choisis un défi confortable. Tu peux changer à tout moment.</p></div></div><div class="settings-grid"><section class="mage-card" id="mage-card" aria-label="Ton mage"></section><section class="glass settings-panel" id="reset-adventures"></section><section class="glass settings-panel"><h2>✧ Difficulté des maths</h2><fieldset><legend>Choisis ton niveau</legend>${[
      [
        'auto',
        'Progression automatique',
        'Chaque étoile augmente les nombres, les tables et la rapidité.',
      ],
      [
        'easy',
        'Initié · Facile',
        'Additions jusqu’à 20, soustractions positives, tables de 2, 5 et 10.',
      ],
      [
        'medium',
        'Enchanteur · Intermédiaire',
        'Calculs jusqu’à 100, tables de 2, 3, 4, 5, 6, 8 et 10.',
      ],
      ['advanced', 'Grand mage · Avancé', 'Calculs jusqu’à 500, toutes les tables de 2 à 12.'],
    ]
      .map(
        ([v, t, d]) =>
          `<label class="choice"><input type="radio" name="difficulty" value="${v}" ${state.settings.difficulty === v ? 'checked' : ''}><span><strong>${t}</strong><small>${d}</small></span></label>`,
      )
      .join(
        '',
      )}</fieldset></section><section class="glass settings-panel"><h2>◷ Maîtrise de l’heure</h2><fieldset><legend>Choisis un palier</legend>${[
      ['auto', 'Progression automatique'],
      ['0', '1 · Heures pleines'],
      ['1', '2 · Demi-heures'],
      ['2', '3 · Quarts d’heure'],
      ['3', '4 · De 5 en 5 minutes'],
      ['4', '5 · Toutes les minutes'],
    ]
      .map(
        ([v, t]) =>
          `<label class="choice compact"><input type="radio" name="clockLevel" value="${v}" ${String(state.settings.clockLevel) === v ? 'checked' : ''}><span>${t}</span></label>`,
      )
      .join(
        '',
      )}</fieldset><p class="footnote">Étoile 1 : heures et pas de 5 minutes ; étoile 2 : toutes les minutes ; étoile 3 : rapidité. Matin/après-midi dès le début.</p><label class="choice"><input type="checkbox" id="relaxed" ${state.settings.relaxed ? 'checked' : ''}><span><strong>Mode découverte · Sans chrono</strong><small>Tout le temps pour apprendre. Mêmes XP de base.</small></span></label></section><section class="glass settings-panel"><h2>Tes progrès</h2><div class="learning-stats">${[
      ['Horloge', clock],
      ['Maths', math],
    ]
      .map(
        ([n, s]) =>
          `<div><h3>${n}</h3><p>${s.correct} réussites · ${s.wrong} essais à revoir</p><p>Temps moyen : ${s.correct + s.wrong ? (s.totalMs / (s.correct + s.wrong) / 1000).toFixed(1) : '0'} s</p></div>`,
      )
      .join(
        '',
      )}</div><p id="clock-stat-progression">Horloge : ${state.adventures.clock.xp} XP · ${adventureStars(state.adventures.clock)}/3 étoiles · ${state.adventures.clock.score} points</p><p id="math-stat-progression">Maths : ${state.adventures.math.xp} XP · ${adventureStars(state.adventures.math)}/3 étoiles · ${state.adventures.math.score} points</p><h3>Minutes à apprivoiser</h3><p>${errors.length ? errors.map(([k, v]) => `:${k.split(':')[1]} (${v.wrong} essai${v.wrong > 1 ? 's' : ''} à revoir)`).join(' · ') : 'Les difficultés apparaîtront ici après tes premiers essais.'}</p><button class="secondary" id="export">Exporter la sauvegarde</button></section><section class="glass settings-panel"><h2>Emporte ta magie</h2><label class="choice"><input type="checkbox" id="sound-enabled" ${state.settings.sound ? 'checked' : ''}><span><strong>Sons magiques</strong><small>Carillons de victoire et sons doux pour réessayer.</small></span></label><p>Installe Astréa sur ton écran d’accueil. Après une première ouverture en ligne, l’aventure fonctionne hors connexion.</p><button class="primary" data-install>＋ Installer l’application</button><p class="footnote">Sur iPhone ou iPad : dans Safari, touche Partager, puis « Sur l’écran d’accueil ». Sur Android ou ordinateur : utilise le bouton d’installation du navigateur.</p><p class="footnote">Ta progression reste sur cet appareil et ce navigateur. Aucune donnée n’est envoyée à un serveur.</p></section></div><p id="settings-status" class="footnote" role="status">Réglages enregistrés automatiquement.</p>`,
  );
  const option = (key) => AVATAR_OPTIONS[key].find((o) => o[0] === state.avatar[key])?.[1] ?? '';
  document.querySelector('#mage-card').innerHTML =
    `<div class="mage-card-portrait" aria-hidden="true">${wizardSVG({ avatar: state.avatar, prefix: 'card' })}</div><div><p class="mage-card-eyebrow">TON MAGE</p><h2 id="mage-card-name">${escape(state.avatar.name)}</h2><p class="mage-card-summary">Tenue ${option('robe')} · Baguette ${option('wand')}</p><button class="arcade-menu-button adventure-button" id="edit-mage">Personnaliser</button></div>`;
  document.querySelector('#edit-mage').onclick = () => navigate('mage');
  mountAdventureReset(document.querySelector('#reset-adventures'), {
    getState: () => state,
    onReset: (mode) => {
      state = resetAdventure(state, mode);
      persist();
      document.querySelector(`#${mode}-stat-progression`).textContent =
        `${modeLabel(mode)} : 0 XP · 0/3 étoiles · 0 points`;
    },
  });
  app.querySelectorAll('input[name=difficulty], input[name=clockLevel]').forEach(
    (input) =>
      (input.onchange = () => {
        state.settings[input.name] = input.value;
        persist();
        document.querySelector('#settings-status').textContent = 'Nouveaux réglages enregistrés.';
      }),
  );
  document.querySelector('#relaxed').onchange = (e) => {
    state.settings.relaxed = e.target.checked;
    persist();
  };
  document.querySelector('#sound-enabled').onchange = (e) => {
    state.settings.sound = e.target.checked;
    if (state.settings.sound) void sounds.unlock();
    else sounds.stop();
    persist();
  };
  document.querySelector('#export').onclick = () => {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = 'astrea-sauvegarde.json';
    a.click();
    URL.revokeObjectURL(url);
  };
}
function mage() {
  shell('<div id="creation-root"></div>');
  mountOnboarding(document.querySelector('#creation-root'), {
    getState: () => state,
    edit: {
      avatar: () => state.avatar,
      set: (key, value) => {
        state.avatar = normalizeAvatar(
          { ...state.avatar, [key]: value },
          state.unlocksXP ?? state.xp,
        );
        persist();
      },
      done: () => navigate('settings'),
    },
  });
}
function navigate(next) {
  battle.stop();
  online?.stop();
  if (['clock', 'math'].includes(next)) return start(next);
  if (!state.onboarding.completed) {
    screen = 'home';
    home();
    return;
  }
  screen = next;
  (({ home, adventure, settings, mage })[next] ?? home)();
  window.scrollTo(0, 0);
  document.querySelector('#main').focus({ preventScroll: true });
}
async function install() {
  if (installPrompt) {
    await installPrompt.prompt();
    installPrompt = null;
  } else {
    const toast = document.querySelector('#toast');
    toast.textContent =
      'iPhone/iPad : Safari → Partager → Sur l’écran d’accueil. Android/PC : menu du navigateur → Installer l’application.';
    toast.classList.add('visible');
    setTimeout(() => toast.classList.remove('visible'), 12000);
  }
}
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  installPrompt = e;
});
for (const event of ['online', 'offline'])
  window.addEventListener(event, () => {
    const connection = document.querySelector('#connection');
    if (!connection) return;
    connection.textContent = navigator.onLine ? 'Prêt à explorer' : 'Hors connexion';
    document.querySelector('.online-dot').classList.toggle('offline', !navigator.onLine);
  });
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () =>
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`, {
        scope: import.meta.env.BASE_URL,
      })
      .catch(() => {
        const toast = document.querySelector('#toast');
        toast.textContent =
          'Le mode hors connexion n’a pas pu être préparé. Réessaie avec une connexion.';
        toast.classList.add('visible');
      }),
  );
}
home();
