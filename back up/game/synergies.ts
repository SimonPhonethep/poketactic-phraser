import { pokemonDatabase, type PokemonRole, type PokemonType } from '../data/pokemon';
import { baseOf } from '../store/gameStore';

export type Trait = PokemonType | PokemonRole;
export type CombatBonuses = {
  attackPercent: number; ap: number; defense: number; magicResist: number;
  hpPercent: number; attackSpeedPercent: number; spellAmpPercent: number;
  manaGainPercent: number; regenPercentPerSecond: number;
  critChance: number; critMultiplier: number;
};
export const EMPTY_BONUSES: CombatBonuses = {
  attackPercent: 0, ap: 0, defense: 0, magicResist: 0, hpPercent: 0,
  attackSpeedPercent: 0, spellAmpPercent: 0, manaGainPercent: 0,
  regenPercentPerSecond: 0, critChance: 0, critMultiplier: 1.5,
};
export type TraitRule = { trait: Trait; thresholds: readonly [number, number];
  stat: Exclude<keyof CombatBonuses, 'critMultiplier'>; values: readonly [number, number]; description: string; scope: 'trait'|'team' };

// These are custom prototype values, NOT official TFT balance data.
// Every rule needs two distinct deployed evolution families to activate.
export const TRAIT_RULES: TraitRule[] = [
  {trait:'Fire',thresholds:[2,4],stat:'spellAmpPercent',values:[15,35],description:'Fire ability damage',scope:'trait'},
  {trait:'Water',thresholds:[2,4],stat:'manaGainPercent',values:[20,40],description:'Mana gained',scope:'trait'},
  {trait:'Grass',thresholds:[2,4],stat:'regenPercentPerSecond',values:[0.008,0.02],description:'Max HP regeneration / sec',scope:'trait'},
  {trait:'Rock',thresholds:[2,4],stat:'defense',values:[20,50],description:'Armor',scope:'trait'},
  {trait:'Ground',thresholds:[2,4],stat:'hpPercent',values:[10,25],description:'Max HP',scope:'trait'},
  {trait:'Dragon',thresholds:[2,4],stat:'attackPercent',values:[15,30],description:'Attack damage',scope:'trait'},
  {trait:'Flying',thresholds:[2,4],stat:'attackSpeedPercent',values:[15,30],description:'Attack speed',scope:'trait'},
  {trait:'Psychic',thresholds:[2,4],stat:'ap',values:[25,60],description:'Ability power',scope:'trait'},
  {trait:'Poison',thresholds:[2,4],stat:'spellAmpPercent',values:[10,25],description:'Ability damage',scope:'trait'},
  {trait:'Steel',thresholds:[2,4],stat:'defense',values:[25,55],description:'Armor',scope:'trait'},
  {trait:'Dark',thresholds:[2,4],stat:'critChance',values:[0.15,0.3],description:'Critical chance',scope:'trait'},
  {trait:'Ghost',thresholds:[2,4],stat:'ap',values:[20,45],description:'Ability power',scope:'trait'},
  {trait:'Electric',thresholds:[2,4],stat:'attackSpeedPercent',values:[20,40],description:'Attack speed',scope:'trait'},
  {trait:'Ice',thresholds:[2,4],stat:'magicResist',values:[20,45],description:'Magic resist',scope:'trait'},
  {trait:'Fighting',thresholds:[2,4],stat:'attackPercent',values:[15,35],description:'Attack damage',scope:'trait'},
  {trait:'Normal',thresholds:[2,4],stat:'hpPercent',values:[10,25],description:'Max HP',scope:'trait'},
  {trait:'Bug',thresholds:[2,4],stat:'attackSpeedPercent',values:[15,35],description:'Attack speed',scope:'trait'},
  {trait:'Fairy',thresholds:[2,4],stat:'regenPercentPerSecond',values:[0.008,0.018],description:'Max HP regeneration / sec',scope:'trait'},
  {trait:'Mage',thresholds:[2,4],stat:'ap',values:[30,65],description:'Ability power',scope:'trait'},
  {trait:'Tank',thresholds:[2,4],stat:'hpPercent',values:[20,45],description:'Max HP',scope:'trait'},
  {trait:'Fighter',thresholds:[2,4],stat:'attackPercent',values:[20,40],description:'Attack damage',scope:'trait'},
  {trait:'Ranged',thresholds:[2,4],stat:'attackSpeedPercent',values:[20,45],description:'Attack speed',scope:'trait'},
  {trait:'Assassin',thresholds:[2,4],stat:'critChance',values:[0.2,0.4],description:'Critical chance',scope:'trait'},
];
export type ActiveTrait = { trait: Trait; count: number; tier: number; description: string };

export function traitCounts(pokemonIds: readonly string[]): Map<Trait, number> {
  // TFT-style: copies of the same evolution family count once per synergy.
  const unique = new Map<string, string>();
  for (const id of pokemonIds) unique.set(baseOf(id), id);
  const counts = new Map<Trait, number>();
  for (const id of unique.values()) {
    const p = pokemonDatabase[id];
    if (!p) continue;
    for (const trait of [...p.types, p.role]) counts.set(trait, (counts.get(trait) ?? 0) + 1);
  }
  return counts;
}
export function activeTraits(pokemonIds: readonly string[]): ActiveTrait[] {
  const counts = traitCounts(pokemonIds);
  return TRAIT_RULES.flatMap(rule => {
    const count = counts.get(rule.trait) ?? 0;
    const tier = count >= rule.thresholds[1] ? 2 : count >= rule.thresholds[0] ? 1 : 0;
    return tier ? [{trait:rule.trait, count, tier, description:`+${rule.values[tier - 1]} ${rule.description}`}] : [];
  });
}
export function bonusesForPokemon(pokemonId: string, alliedIds: readonly string[]): CombatBonuses {
  const p = pokemonDatabase[pokemonId];
  if (!p) return {...EMPTY_BONUSES};
  const counts = traitCounts(alliedIds);
  const result = {...EMPTY_BONUSES};
  for (const rule of TRAIT_RULES) {
    if (rule.scope === 'trait' && !([...p.types, p.role] as string[]).includes(rule.trait)) continue;
    const count = counts.get(rule.trait) ?? 0;
    const tier = count >= rule.thresholds[1] ? 2 : count >= rule.thresholds[0] ? 1 : 0;
    if (tier) result[rule.stat] += rule.values[tier - 1];
  }
  return result;
}
