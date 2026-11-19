import { cursorOf, journeyFor, levelUnlocked, starsOf, LEVEL_XP, MAX_STARS } from './adventures.js';
import { ENEMIES } from './duel.js';

// The level map of an adventure: twenty places, grouped in four zones.
export const MAP_LEVELS = 20;
export const PLACES = [
  ['LE VILLAGE', 'village'],
  ['LA FORÊT', 'forest'],
  ['LE PONT', 'bridge'],
  ['LA TOUR DE L’HORLOGE'],
  ['LA BIBLIOTHÈQUE', 'library'],
  ['L’ATELIER DES POTIONS', 'cauldron'],
  ['LE JARDIN DES CHAMPIGNONS', 'mushroom'],
  ['LA CLAIRIÈRE DES FÉES', 'tree', '#7fd65a'],
  ['LE LAC MIROIR', 'lake'],
  ['L’ARBRE-MONDE', 'tree', '#3f9e4a'],
  ['LE SENTIER DES NEIGES', 'peak', '#8d9bd6'],
  ['LA GROTTE DE CRISTAL', 'crystal'],
  ['L’OBSERVATOIRE', 'tower'],
  ['LE PONT DE GLACE', 'icebridge', '#a9c6f0'],
  ['LE SOMMET DES VENTS', 'peak', '#7a86c9'],
  ['LES RUINES ANCIENNES', 'ruins'],
  ['LE MARAIS TÉNÉBREUX', 'swamp'],
  ['LE VOLCAN', 'volcano'],
  ['LA PORTE DU DRAGON', 'portal'],
  ['LE CHÂTEAU'],
];
export const ZONES = [
  ['Le Vallon', 5],
  ['La Forêt profonde', 10],
  ['Les Montagnes', 15],
  ['Le Royaume du dragon', 20],
];
/**
 * What the map shows for one adventure: the stars of each level (one per difficulty
 * beaten), whether it can be played, and the level the mage currently stands on.
 */
export function mapLevels(adventure) {
  const stars = starsOf(adventure);
  const cursor = cursorOf(adventure);
  const run = journeyFor(cursor);
  const partial = adventure.partial ?? [];
  return PLACES.map(([name, kind, tint], index) => {
    const earned = stars[index];
    const active = run.stageIndex === index;
    const won = active && !run.complete ? cursor % LEVEL_XP : (partial[index] ?? 0);
    return {
      n: index + 1,
      name,
      kind,
      tint,
      earned,
      active,
      status: earned ? 'done' : levelUnlocked(stars, index) ? 'current' : 'locked',
      nextStar: Math.min(MAX_STARS, earned + 1),
      remaining: LEVEL_XP - won,
      enemy: ENEMIES[index].name,
    };
  });
}
