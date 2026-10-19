import { create } from "zustand";
import { pokemonDatabase } from "../data/pokemon";
import { COMPONENT_IDS, craftedFrom, isComponent, type ItemInstance } from "../data/items";
import {
  STARTING_LEVEL, STARTING_PLAYER_HP, PLANNING_TIME_SECONDS,
  XP_COST_GOLD, XP_PER_PURCHASE, PASSIVE_XP_PER_ROUND, MAX_LEVEL,
  REROLL_COST, calculateIncome, gainExperience, nextRoundNumber,
  nextStreak, playerDamage, rollShop, roundKind, teamCapacity,
  type IncomeBreakdown, type ShopOffer, type Streak,
} from "../game/matchRules";

export type BaseId = string;
export type Unit = { uid: string; pokemonId: string; row: number | null; col: number | null; items: ItemInstance[] };
type Offer = ShopOffer;
type State = {
  gold: number; round: number; stage: number; stageRound: number;
  playerHp: number; level: number; xp: number; planningSeconds: number;
  timerPaused: boolean; streak: Streak; lastIncome: IncomeBreakdown | null;
  pendingIncome: IncomeBreakdown | null; lastHpLoss: number;
  units: Unit[]; offers: Offer[];
  tickPlanning: () => void; toggleTimerPause: () => void;
  buyXp: () => void; restartMatch: () => void;
  inventory: ItemInstance[]; selectedItemUids: string[];
  toggleItemSelection: (uid: string) => void;
  craft: (firstUid: string, secondUid: string) => void;
  equipItem: (itemUid: string, unitUid: string) => void;
  unequipItem: (unitUid: string, itemUid: string) => void;
  grantTestComponents: () => void;
  phase: 'planning' | 'combat' | 'results' | 'gameover'; outcome: 'win' | 'loss' | 'draw' | null;
  startBattle: (automatic?: boolean) => void; finishBattle: (outcome: 'win' | 'loss' | 'draw', enemiesSurviving?: number) => void; nextRound: () => void;
  selectedUid: string | null; notice: string;
  buy: (slotId: number) => void; reroll: () => void;
  deploy: (uid: string, row: number, col: number) => boolean;
  bench: (uid: string) => void; sell: (uid: string) => void;
  select: (uid: string | null) => void;
};
export const BASE_IDS: BaseId[] = Object.values(pokemonDatabase)
  .filter(p => p.stage === 1).map(p => p.id);
export const FAMILIES: Record<string, readonly [string, string, string]> =
  Object.fromEntries(BASE_IDS.map(id => {
    const second = pokemonDatabase[id].evolvesTo;
    const third = second && pokemonDatabase[second]?.evolvesTo;
    if (!second || !third) throw new Error(`Incomplete evolution line: ${id}`);
    return [id, [id, second, third] as const];
  }));
export const baseOf = (pokemonId: string): BaseId => {
  const family = BASE_IDS.find(id => FAMILIES[id].includes(pokemonId));
  if (!family) throw new Error(`Unknown Pokémon: ${pokemonId}`);
  return family;
};
export const COLORS: Record<BaseId, number> = {
  geodude: 0xa18b70, rowlet: 0x66b96e, piplup: 0x399bf0,
  charmander: 0xf59a35, gible: 0x9873d7, froakie: 0x318dbe,
  axew: 0x79ad6a, scorbunny: 0xe58c53, bulbasaur: 0x48a89c,
  abra: 0xc391dd,
};
export const price = (id: BaseId): number => pokemonDatabase[id].cost;
export const sellValue = (id: string): number =>
  price(baseOf(id)) * (pokemonDatabase[id].stage === 1 ? 1 : pokemonDatabase[id].stage === 2 ? 3 : 9);

// Shop is tier-weighted at the current player level. Finite shared
// champion pools and completed-evolution exclusion will come later.
const roster = BASE_IDS.map(id => ({ id, cost: price(id) }));
const randomOffers = (level: number): Offer[] => rollShop(level, roster);
const initialOffers: Offer[] = randomOffers(STARTING_LEVEL);
let serial = 0;
let itemSerial = 0;
export const makeItem = (itemId: string): ItemInstance => ({uid: `item-${++itemSerial}`, itemId});
const starterItems: ItemInstance[] = [...COMPONENT_IDS, 'fang','spoon','feather','seed'].map(makeItem);
const countBenched = (units: Unit[]) => units.filter(u => u.row === null).length;
const countDeployed = (units: Unit[]) => units.filter(u => u.row !== null).length;
const isOccupied = (units: Unit[], uid: string, row: number, col: number) =>
  units.some(u => u.uid !== uid && u.row === row && u.col === col);

/** Merges matching stages recursively: 3 stage-1 -> stage-2, 3 stage-2 -> stage-3.
 * Keeps the deployed unit when possible to preserve its position; otherwise
 * keeps an existing benched unit. The newly purchased copy is merged last.
 */
export function mergeThree(units: Unit[]): { units: Unit[]; overflowItems: ItemInstance[]; upgradedUid: string | null; messages: string[] } {
  let result = [...units];
  let upgradedUid: string | null = null;
  const messages: string[] = [];
  const overflowItems: ItemInstance[] = [];
  for (const familyId of BASE_IDS) {
    const stages = FAMILIES[familyId];
    for (let stage = 0; stage < 2; stage++) {
      while (result.filter(u => u.pokemonId === stages[stage]).length >= 3) {
        const matches = result.filter(u => u.pokemonId === stages[stage]);
        // Existing deployed unit takes priority, then oldest unit.
        const ordered = [...matches].sort((a, b) =>
          Number(b.row !== null) - Number(a.row !== null));
        const keep = ordered[0];
        const used = ordered.slice(0, 3);
        // Preserve items on the deployed survivor first; excess items go to inventory.
        const carried = used.flatMap(u => u.items);
        overflowItems.push(...carried.slice(3));
        const remove = new Set(used.slice(1).map(u => u.uid));
        result = result.filter(u => !remove.has(u.uid)).map(u =>
          u.uid === keep.uid ? { ...u, pokemonId: stages[stage + 1], items: carried.slice(0,3) } : u);
        upgradedUid = keep.uid;
        messages.push(`${pokemonDatabase[stages[stage + 1]].name} evolved!`);
      }
    }
  }
  return { units: result, overflowItems, upgradedUid, messages };
}

export const useGameStore = create<State>((set, get) => ({
  gold: 10,
  round: 1,
  stage: 1,
  stageRound: 1,
  playerHp: STARTING_PLAYER_HP,
  level: STARTING_LEVEL,
  xp: 0,
  planningSeconds: PLANNING_TIME_SECONDS,
  timerPaused: false,
  streak: { kind: null, count: 0 },
  lastIncome: null,
  pendingIncome: null,
  lastHpLoss: 0,
  tickPlanning: () => {
    const state = get();
    if (state.phase !== 'planning' || state.timerPaused) return;
    if (state.planningSeconds > 1) {
      set({ planningSeconds: state.planningSeconds - 1 });
    } else {
      set({ planningSeconds: 0 });
      get().startBattle(true);
    }
  },
  toggleTimerPause: () => {
    const state = get();
    if (state.phase === 'planning') set({ timerPaused: !state.timerPaused });
  },
  buyXp: () => {
    const state = get();
    if (state.phase !== 'planning') return;
    if (state.level >= MAX_LEVEL) { set({notice: 'Maximum level reached.'}); return; }
    if (state.gold < XP_COST_GOLD) {set({notice: 'Not enough gold to buy XP.'}); return;}
    const next = gainExperience(state.level, state.xp, XP_PER_PURCHASE);
    set({ gold: state.gold - XP_COST_GOLD, ...next,
      notice: next.level > state.level
        ? `Level up! Level ${next.level} allows ${teamCapacity(next.level)} Pokémon on the board.`
        : `Purchased ${XP_PER_PURCHASE} XP for ${XP_COST_GOLD} gold.` });
  },
  restartMatch: () => {
    set({ gold: 10, round: 1, stage: 1, stageRound: 1,
      playerHp: STARTING_PLAYER_HP, level: STARTING_LEVEL, xp: 0,
      planningSeconds: PLANNING_TIME_SECONDS, timerPaused: false,
      streak: {kind:null,count:0},lastIncome:null,pendingIncome:null,lastHpLoss:0,
      phase:'planning',outcome:null,units:[],offers:randomOffers(STARTING_LEVEL),
      selectedUid:null,selectedItemUids:[],inventory:[...COMPONENT_IDS,'fang','spoon','feather','seed'].map(makeItem),
      notice:'New match started. Buy and deploy Pokémon to prepare.' });
  },
  inventory: starterItems,
  selectedItemUids: [],
  toggleItemSelection: uid => set(s => ({
    selectedItemUids: s.selectedItemUids.includes(uid)
      ? s.selectedItemUids.filter(id => id !== uid)
      : [...s.selectedItemUids.slice(-1), uid],
  })),
  craft: (firstUid,secondUid) => {
    const s=get();
    if (s.phase!=='planning' || firstUid===secondUid) return;
    const first=s.inventory.find(i=>i.uid===firstUid);
    const second=s.inventory.find(i=>i.uid===secondUid);
    const made=first && second && craftedFrom(first.itemId,second.itemId);
    if (!made) {set({notice:'Only two components can be combined.'});return;}
    set({
      inventory:[...s.inventory.filter(i=>i.uid!==firstUid && i.uid!==secondUid),makeItem(made.id)],
      selectedItemUids:[],notice:`Crafted ${made.name}! Equip it on a Pokémon.`,
    });
  },
  equipItem: (itemUid, unitUid) => {
    const s=get();
    if (s.phase!=='planning') return;
    const held=s.inventory.find(i=>i.uid===itemUid);
    const unit=s.units.find(u=>u.uid===unitUid);
    if (!held || !unit) return;
    // TFT-style: a second component on the unit completes a recipe.
    const firstComponent= isComponent(held.itemId)
      ? unit.items.find(item=>isComponent(item.itemId)) : undefined;
    const made=firstComponent && craftedFrom(firstComponent.itemId,held.itemId);
    if (!made && unit.items.length>=3) {set({notice:'Equipment full (3/3).'});return;}
    const updated=made
      ? [...unit.items.filter(i=>i.uid!==firstComponent?.uid),makeItem(made.id)]
      : [...unit.items,held];
    set({
      units:s.units.map(u=>u.uid===unitUid?{...u,items:updated}:u),
      inventory:s.inventory.filter(i=>i.uid!==itemUid),
      selectedItemUids:s.selectedItemUids.filter(id=>id!==itemUid),
      notice:made?`${made.name} crafted and equipped on ${pokemonDatabase[unit.pokemonId].name}!`
        :`Item equipped on ${pokemonDatabase[unit.pokemonId].name}.`,
    });
  },
  unequipItem: (unitUid,itemUid) => {
    const s=get();
    if (s.phase!=='planning') return;
    const unit=s.units.find(u=>u.uid===unitUid);
    const held=unit?.items.find(i=>i.uid===itemUid);
    if (!unit || !held) return;
    set({units:s.units.map(u=>u.uid===unitUid?{...u,items:u.items.filter(i=>i.uid!==itemUid)}:u),
      inventory:[...s.inventory,held],notice:'Item returned to inventory.'});
  },
  grantTestComponents: () => {
    const s=get();
    if (s.phase!=='planning') return;
    set({inventory:[...s.inventory,...COMPONENT_IDS.map(makeItem)],notice:'Added 8 testing components (temporary demo option).'});
  },
  phase: 'planning', outcome: null,
  startBattle: (automatic = false) => {
    const s = get();
    if (s.phase !== 'planning') return;
    if (!s.units.some(u => u.row !== null)) {
      if (!automatic) {
        set({ notice: 'Deploy at least one Pokémon to start battle.' });
        return;
      }
      // An expired planning timer with no deployed team is a forfeit,
      // rather than getting stuck at 00:00 indefinitely.
      set({ phase: 'combat', outcome: null });
      get().finishBattle('loss', 2);
      return;
    }
    set({ phase: 'combat', outcome: null, timerPaused: false,
      notice: `Battle ${s.stage}-${s.stageRound} started! Pokémon fight automatically.` });
  },
  finishBattle: (outcome, enemiesSurviving = 0) => {
    const s = get();
    if (s.phase !== 'combat') return;
    const kind = roundKind(s.stage, s.stageRound);
    const streak = nextStreak(s.streak, outcome, kind);
    const loss = playerDamage(outcome, kind, s.stage, enemiesSurviving);
    const hp = Math.max(0, s.playerHp - loss);
    const pendingIncome = calculateIncome(s.gold, outcome, streak, kind);
    const gameOver = hp === 0;
    set({ phase: gameOver ? 'gameover' : 'results', outcome,
      playerHp: hp, streak, lastHpLoss: loss, pendingIncome,
      notice: gameOver ? 'Eliminated! Restart to try a new match.' :
        outcome === 'win' ? `Victory! +${pendingIncome.total} gold after this round.` :
        outcome === 'loss' ? `Defeat. ${loss} player HP lost. +${pendingIncome.total} gold after this round.` :
        `Draw! ${loss} player HP lost. +${pendingIncome.total} gold after this round.`,
    });
  },
  nextRound: () => {
    const s = get();
    if (s.phase !== 'results' || !s.pendingIncome) return;
    const target = nextRoundNumber(s.stage,s.stageRound);
    const upgraded = gainExperience(s.level,s.xp,PASSIVE_XP_PER_ROUND);
    const earned = s.pendingIncome;
    set({ phase: 'planning', outcome: null, round: s.round + 1,
      stage: target.stage, stageRound: target.stageRound,
      gold: s.gold + earned.total, level: upgraded.level, xp: upgraded.xp,
      planningSeconds: PLANNING_TIME_SECONDS, timerPaused: false,
      offers: randomOffers(upgraded.level),
      pendingIncome: null, lastIncome: earned, lastHpLoss: 0,
      notice: `Round ${target.stage}-${target.stageRound}: +${earned.total} gold, +${PASSIVE_XP_PER_ROUND} XP.${upgraded.level > s.level ? ` Level ${upgraded.level} reached!` : ''}` });
  },
  units: [],
  offers: initialOffers,
  selectedUid: null,
  notice: "Buy a Pokémon, then drag it from your bench onto a green hex.",
  buy: (slotId) => {
    const s = get();
    if (s.phase !== 'planning') return;
    const offer = s.offers.find(o => o.slotId === slotId);
    if (!offer) return;
    const cost = price(offer.pokemonId);
    if (s.gold < cost) { set({ notice: "Not enough gold!" }); return; }
    const uid = `unit-${++serial}`;
    const candidate = [...s.units, { uid, pokemonId: offer.pokemonId, row: null, col: null, items: [] }];
    const result = mergeThree(candidate);
    // Allow buying into a full bench if it immediately triggers evolution.
    if (countBenched(result.units) > 9) { set({ notice: "Your bench is full (9/9)." }); return; }
    const surviving = result.units.find(u => u.uid === uid);
    set({
      gold: s.gold - cost,
      units: result.units,
      inventory: [...s.inventory,...result.overflowItems],
      offers: s.offers.filter(o => o.slotId !== slotId),
      selectedUid: result.upgradedUid ?? surviving?.uid ?? s.selectedUid,
      notice: result.messages.length
        ? `${pokemonDatabase[offer.pokemonId].name} purchased! ${result.messages.join(" ")}`
        : `${pokemonDatabase[offer.pokemonId].name} purchased! Drag it to the board.`,
    });
  },
  reroll: () => {
    const s = get();
    if (s.phase !== 'planning') return;
    if (s.gold < REROLL_COST) { set({ notice: "You need 2 gold to reroll." }); return; }
    const offers = randomOffers(s.level);
    set({ gold: s.gold - REROLL_COST, offers, notice: "Shop refreshed for 2 gold." });
  },
  deploy: (uid, row, col) => {
    const s = get();
    if (s.phase !== 'planning') return false;
    const u = s.units.find(x => x.uid === uid);
    if (!u) return false;
    if (row < 4 || row > 7 || col < 0 || col > 7) {
      set({ notice: "Place Pokémon on a green hex (bottom four rows)." }); return false;
    }
    if (isOccupied(s.units, uid, row, col)) { set({ notice: "That hex is occupied." }); return false; }
    const capacity = teamCapacity(s.level);
    if (u.row === null && countDeployed(s.units) >= capacity) {
      set({ notice: `Team cap reached (${capacity}). Buy XP to level up.` }); return false;
    }
    set({ units: s.units.map(x => x.uid === uid ? { ...x, row, col } : x),
      selectedUid: uid, notice: `${pokemonDatabase[u.pokemonId].name} deployed.` });
    return true;
  },
  bench: (uid) => {
    const s = get();
    if (s.phase !== 'planning') return;
    const unit = s.units.find(u => u.uid === uid);
    if (!unit || unit.row === null) return;
    if (countBenched(s.units) >= 9) { set({ notice: "Bench is full." }); return; }
    set({ units: s.units.map(u => u.uid === uid ? { ...u, row: null, col: null } : u), notice: "Returned to bench." });
  },
  sell: (uid) => {
    const s = get();
    if (s.phase !== 'planning') return;
    const unit = s.units.find(u => u.uid === uid);
    if (!unit) return;
    const refund = sellValue(unit.pokemonId);
    set({ units: s.units.filter(u => u.uid !== uid), gold: s.gold + refund,
      inventory:[...s.inventory,...unit.items],
      selectedUid: s.selectedUid === uid ? null : s.selectedUid,
      notice: `${pokemonDatabase[unit.pokemonId].name} sold for ${refund} gold.` });
  },
  select: (selectedUid) => set({ selectedUid }),
}));
