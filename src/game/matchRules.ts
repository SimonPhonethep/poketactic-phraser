/** PokéTactics 1.1: independently testable match rules. This is a custom,
 * TFT-inspired prototype balance, not a claim of official TFT probabilities.
 */
export type BattleOutcome = 'win' | 'loss' | 'draw';
export type RoundKind = 'practice' | 'opponent';
export type StreakKind = 'win' | 'loss' | null;
export type Tier = 1 | 2 | 3 | 4 | 5;
export interface ShopCandidate { id: string; cost: number }
export interface ShopOffer { slotId: number; pokemonId: string }
export interface RoundNumber { stage: number; stageRound: number }
export interface Streak { kind: StreakKind; count: number }
export interface IncomeBreakdown {
  base: number; interest: number; victory: number; streak: number; total: number;
}

export const STARTING_LEVEL = 4;
export const MAX_LEVEL = 10;
export const STARTING_PLAYER_HP = 100;
export const PLANNING_TIME_SECONDS = 45;
export const XP_COST_GOLD = 4;
export const XP_PER_PURCHASE = 4;
export const PASSIVE_XP_PER_ROUND = 2;
export const REROLL_COST = 2;
export const XP_REQUIREMENTS: Readonly<Record<number, number>> = {
  4: 8, 5: 12, 6: 20, 7: 32, 8: 48, 9: 64,
};

/** Per-slot tier odds before unavailable tiers are excluded. */
export const TIER_ODDS: Readonly<Record<number, readonly [number, number, number, number, number]>> = {
  4: [55, 30, 15, 0, 0],
  5: [45, 33, 20, 2, 0],
  6: [30, 40, 25, 5, 0],
  7: [19, 30, 40, 10, 1],
  8: [15, 25, 35, 20, 5],
  9: [10, 20, 25, 35, 10],
  10: [5, 10, 20, 40, 25],
};
export function teamCapacity(level: number): number {
  return Math.min(MAX_LEVEL, Math.max(STARTING_LEVEL, Math.floor(level)));
}
export function xpNeeded(level: number): number {
  return level >= MAX_LEVEL ? 0 : XP_REQUIREMENTS[level] ?? 8;
}
export function gainExperience(level: number, xp: number, amount: number) {
  let nextLevel = level;
  let nextXp = xp + Math.max(0, amount);
  while (nextLevel < MAX_LEVEL && nextXp >= xpNeeded(nextLevel)) {
    nextXp -= xpNeeded(nextLevel);
    nextLevel += 1;
  }
  return { level: nextLevel, xp: nextLevel === MAX_LEVEL ? 0 : nextXp };
}
export function nextRoundNumber(stage: number, stageRound: number): RoundNumber {
  if (stage === 1 && stageRound >= 4) return { stage: 2, stageRound: 1 };
  if (stage >= 2 && stageRound >= 7) return { stage: stage + 1, stageRound: 1 };
  return { stage, stageRound: stageRound + 1 };
}
export function roundKind(stage: number, stageRound: number): RoundKind {
  return stage === 1 && stageRound <= 3 ? 'practice' : 'opponent';
}
export function nextStreak(previous: Streak, outcome: BattleOutcome, kind: RoundKind): Streak {
  if (kind === 'practice' || outcome === 'draw') return { kind: null, count: 0 };
  return { kind: outcome, count: previous.kind === outcome ? previous.count + 1 : 1 };
}
export function streakGold(count: number): number {
  if (count >= 6) return 3;
  if (count >= 4) return 2;
  if (count >= 2) return 1;
  return 0;
}
export function calculateIncome(goldBeforeRewards: number, outcome: BattleOutcome,
  streak: Streak, kind: RoundKind): IncomeBreakdown {
  const base = 5;
  const interest = Math.min(5, Math.floor(Math.max(0, goldBeforeRewards) / 10));
  const victory = outcome === 'win' && kind === 'opponent' ? 1 : 0;
  const bonus = kind === 'opponent' ? streakGold(streak.count) : 0;
  return { base, interest, victory, streak: bonus, total: base + interest + victory + bonus };
}
export function playerDamage(outcome: BattleOutcome, kind: RoundKind,
  stage: number, enemiesSurviving: number): number {
  if (kind === 'practice' || outcome === 'win') return 0;
  if (outcome === 'draw') return 1 + stage;
  return Math.max(1, 2 + stage + Math.max(0, enemiesSurviving));
}

/** Normalize tier rates only across tiers that currently contain any base units.
 * A future Tier 5 roster will automatically activate the original Level odds.
 * No finite shared shop pool in v1.1 — that is a separate future milestone.
 */
export function effectiveTierOdds(level: number, roster: readonly ShopCandidate[]): number[] {
  const configured = TIER_ODDS[Math.min(MAX_LEVEL, Math.max(STARTING_LEVEL, Math.floor(level)))]
    ?? TIER_ODDS[STARTING_LEVEL];
  const raw = configured.map((odds, index) =>
    roster.some(p => p.cost === index + 1) ? odds : 0);
  const total = raw.reduce((sum, value) => sum + value, 0);
  if (total === 0) return [0, 0, 0, 0, 0];
  return raw.map(value => value * 100 / total);
}
export function rollShop(level: number, roster: readonly ShopCandidate[],
  rng: () => number = Math.random): ShopOffer[] {
  const percentages = effectiveTierOdds(level, roster);
  if (percentages.every(v => v === 0)) return [];
  return Array.from({ length: 5 }, (_, slotId) => {
    let cursor = Math.max(0, Math.min(0.999999999, rng())) * 100;
    let selectedTier = percentages.findIndex(value => {
      cursor -= value;
      return cursor < 0;
    }) + 1;
    if (selectedTier === 0) selectedTier = percentages.reduce((last, v, i) => v > 0 ? i + 1 : last, 0);
    const candidates = roster.filter(p => p.cost === selectedTier);
    const chosen = candidates[Math.floor(Math.max(0, Math.min(0.999999999, rng())) * candidates.length)];
    return { slotId, pokemonId: chosen.id };
  });
}
