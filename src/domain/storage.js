import { freshOnboarding, restoreOnboarding } from './onboarding.js';
import {
  freshAdventure,
  MAX_HEALTH,
  LEVELS_PER_STAR,
  frontierOf,
  journeyFor,
  levelUnlocked,
  runCursor,
  starsOf,
  starsFromXP,
} from './adventures.js';
import { DEFAULT_AVATAR, normalizeAvatar } from './duel.js';
import { DIFFICULTIES } from './exercises.js';
import { rewardsFor, unlockedRewards } from './progression.js';
export const SAVE_KEY = 'astrea.save';
export const SAVE_VERSION = 2;
const stats = () => ({ correct: 0, wrong: 0, totalMs: 0, buckets: {} });
export function freshState() {
  return {
    version: SAVE_VERSION,
    onboarding: freshOnboarding(),
    xp: 0,
    unlocksXP: 0,
    score: 0,
    streak: 0,
    bestStreak: 0,
    rewards: [],
    legacyRewards: [],
    adventures: { clock: freshAdventure(), math: freshAdventure() },
    avatar: { ...DEFAULT_AVATAR },
    settings: {
      difficulty: 'auto',
      clockLevel: 'auto',
      relaxed: false,
      sound: true,
    },
    stats: { clock: stats(), math: stats() },
    history: [],
  };
}
const natural = (x) => Number.isSafeInteger(x) && x >= 0;
const levelList = (list, max) =>
  Array.isArray(list) &&
  list.length === LEVELS_PER_STAR &&
  list.every((value) => natural(value) && value <= max);
// Stars per level and the level being played. Older saves only have XP, which says both.
function levelProgress(source) {
  if (source.stars === undefined && source.cursor === undefined) {
    return {};
  }
  if (
    !levelList(source.stars, 3) ||
    (source.partial !== undefined && !levelList(source.partial, 99))
  )
    throw new Error('Invalid levels');
  const stars = [...source.stars];
  if (stars.some((count, index) => count > 0 && index > 0 && stars[index - 1] === 0))
    throw new Error('Invalid levels');
  const partial = source.partial ? [...source.partial] : starsFromXP(0);
  const run = natural(source.cursor) ? journeyFor(source.cursor) : null;
  const mastered = stars.every((count) => count === 3);
  const consistent =
    run &&
    (run.complete
      ? mastered
      : levelUnlocked(stars, run.stageIndex) &&
        run.targetStar === Math.min(3, stars[run.stageIndex] + 1));
  const index = frontierOf(stars);
  return {
    stars,
    partial,
    cursor: consistent ? source.cursor : mastered ? 6000 : runCursor(stars, index, partial[index]),
  };
}
export function restore(raw) {
  try {
    const data = JSON.parse(raw);
    if (!data || ![1, SAVE_VERSION].includes(data.version))
      return {
        state: freshState(),
        warning: raw ? 'Sauvegarde incompatible. Une nouvelle aventure est prête.' : '',
      };
    const base = freshState();
    for (const key of ['xp', 'score', 'streak', 'bestStreak'])
      if (!natural(data[key])) throw new Error('Invalid save');
      else base[key] = data[key];
    if (
      !DIFFICULTIES.includes(data.settings?.difficulty) ||
      !['auto', '0', '1', '2', '3', '4'].includes(String(data.settings?.clockLevel)) ||
      typeof data.settings?.relaxed !== 'boolean' ||
      (data.settings.sound !== undefined && typeof data.settings.sound !== 'boolean')
    )
      throw new Error('Invalid settings');
    base.settings = {
      difficulty: data.settings.difficulty,
      clockLevel: String(data.settings.clockLevel),
      relaxed: data.settings.relaxed,
      sound: data.settings.sound ?? true,
    };
    for (const mode of ['math', 'clock']) {
      const source = data.stats?.[mode];
      if (
        !source ||
        !['correct', 'wrong', 'totalMs'].every((k) => natural(source[k])) ||
        !source.buckets ||
        typeof source.buckets !== 'object' ||
        Array.isArray(source.buckets)
      )
        throw new Error('Invalid stats');
      const buckets = {};
      for (const [key, value] of Object.entries(source.buckets)) {
        if (
          !/^(minute:\d{2}|[+−×]:[0-2])$/.test(key) ||
          !value ||
          !['correct', 'wrong', 'totalMs'].every((k) => natural(value[k]))
        )
          throw new Error('Invalid bucket');
        buckets[key] = {
          correct: value.correct,
          wrong: value.wrong,
          totalMs: value.totalMs,
        };
      }
      base.stats[mode] = {
        correct: source.correct,
        wrong: source.wrong,
        totalMs: source.totalMs,
        buckets,
      };
    }
    if (data.version === 1) {
      const count = base.stats.clock.correct + base.stats.math.correct;
      const clockShare = count ? base.stats.clock.correct / count : 1;
      for (const mode of ['clock', 'math']) {
        const xp =
          mode === 'clock'
            ? Math.floor(base.xp * clockShare)
            : base.xp - Math.floor(base.xp * clockShare);
        const score =
          mode === 'clock'
            ? Math.floor(base.score * clockShare)
            : base.score - Math.floor(base.score * clockShare);
        const lastMode = Array.isArray(data.history) ? data.history.at(-1)?.mode : 'clock';
        base.adventures[mode] = {
          ...freshAdventure(),
          xp,
          score,
          streak: mode === (lastMode ?? 'clock') ? base.streak : 0,
          bestStreak: mode === (lastMode ?? 'clock') ? base.bestStreak : 0,
          cycleCorrect: xp ? Math.floor((base.stats[mode].correct * (xp % 2000)) / xp) : 0,
          rewards: unlockedRewards(xp),
          ...levelProgress({ xp }),
        };
        base.adventures[mode].levelStartCorrect = base.adventures[mode].cycleCorrect;
      }
      base.legacyRewards = unlockedRewards(base.xp);
    } else {
      for (const mode of ['clock', 'math']) {
        const source = data.adventures?.[mode];
        if (
          !source ||
          !['xp', 'score', 'streak', 'bestStreak', 'cycleCorrect'].every((k) => natural(source[k]))
        )
          throw new Error('Invalid adventure');
        if (
          (source.health !== undefined &&
            (!natural(source.health) || source.health > MAX_HEALTH)) ||
          (source.defeats !== undefined && !natural(source.defeats)) ||
          (source.levelStartCorrect !== undefined &&
            (!natural(source.levelStartCorrect) || source.levelStartCorrect > source.cycleCorrect))
        )
          throw new Error('Invalid combat');
        base.adventures[mode] = {
          ...freshAdventure(),
          health: source.health ?? MAX_HEALTH,
          defeats: source.defeats ?? 0,
          levelStartCorrect: source.levelStartCorrect ?? source.cycleCorrect,
          ...Object.fromEntries(
            ['xp', 'score', 'streak', 'bestStreak', 'cycleCorrect'].map((k) => [k, source[k]]),
          ),
          ...levelProgress(source),
        };
        base.adventures[mode].rewards = rewardsFor(starsOf(base.adventures[mode]));
      }
      base.legacyRewards = Array.isArray(data.legacyRewards)
        ? data.legacyRewards.filter((r) => unlockedRewards(6000).includes(r))
        : [];
      base.xp = base.adventures.clock.xp + base.adventures.math.xp;
      base.score = base.adventures.clock.score + base.adventures.math.score;
    }
    if (!natural(base.xp) || !natural(base.score)) throw new Error('Invalid aggregate');
    base.unlocksXP = Math.max(base.xp, natural(data.unlocksXP) ? data.unlocksXP : 0);
    base.avatar = normalizeAvatar(data.avatar, base.unlocksXP);
    base.onboarding = restoreOnboarding(data.onboarding, base.unlocksXP);
    base.rewards = [
      ...new Set([
        ...base.legacyRewards,
        ...base.adventures.clock.rewards,
        ...base.adventures.math.rewards,
      ]),
    ];
    base.history = Array.isArray(data.history)
      ? data.history
          .filter(
            (h) =>
              h &&
              ['clock', 'math'].includes(h.mode) &&
              typeof h.correct === 'boolean' &&
              natural(h.elapsed) &&
              natural(h.at),
          )
          .slice(-500)
      : [];
    return {
      state: base,
      warning: '',
      ...(data.version === 1 ? { migrated: true } : {}),
    };
  } catch {
    return {
      state: freshState(),
      warning: 'La sauvegarde est illisible. Une nouvelle aventure est prête.',
    };
  }
}
export function load(storage) {
  try {
    const target = storage ?? localStorage;
    const raw = target.getItem(SAVE_KEY);
    const result = restore(raw);
    if (result.migrated) {
      try {
        if (!target.getItem(`${SAVE_KEY}.v1.backup`)) target.setItem(`${SAVE_KEY}.v1.backup`, raw);
        target.setItem(SAVE_KEY, JSON.stringify(result.state));
      } catch {
        result.warning =
          'La nouvelle sauvegarde est prête en mémoire mais ne peut pas être enregistrée. Garde la page ouverte.';
      }
    }
    return result;
  } catch {
    return {
      state: freshState(),
      warning: 'Le stockage est indisponible. Garde cette page ouverte pour conserver ta partie.',
    };
  }
}
export function save(state, storage) {
  try {
    (storage ?? localStorage).setItem(SAVE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}
