import { pokemonDatabase } from '../data/pokemon';
import { moves, type MoveDefinition } from '../data/moves';
import { baseOf } from '../store/gameStore';
import type { Combatant, CombatEvent } from './combat';

export function moveFor(pokemonId: string): MoveDefinition { return moves[baseOf(pokemonId)]; }
export function hexDistance(a: Pick<Combatant,'x'|'y'>, b: Pick<Combatant,'x'|'y'>): number {
  const toCube = ({x,y}: {x:number;y:number}) => {
    const q = x - (y - (y & 1)) / 2;
    return {q,r:y,s:-q-y};
  };
  const p = toCube(a), q = toCube(b);
  return Math.max(Math.abs(p.q-q.q), Math.abs(p.r-q.r), Math.abs(p.s-q.s));
}

// Interim prototype baselines. Move these into PokemonData when balancing starts.
export const DEFAULT_ABILITY_POWER = 100;
export const DEFAULT_MAGIC_RESIST = 30;
export function abilityStageScaling(pokemonId: string) {
  const stats = pokemonDatabase[pokemonId];
  if (!stats) throw new Error(`Unknown Pokemon: ${pokemonId}`);
  return moveFor(pokemonId).stages[stats.stage - 1];
}
/** Raw damage/shield PER HIT, before defenses. AD is Pokemon ATK; AP defaults to 100. */
export function abilityBasePower(pokemonId: string): number {
  const move = moveFor(pokemonId);
  const stage = abilityStageScaling(pokemonId);
  const stats = pokemonDatabase[pokemonId];
  const scalingStat = move.scaling === 'AD' ? stats.attack : DEFAULT_ABILITY_POWER;
  return Math.round(stage.base + stage.ratio * scalingStat);
}
function resistanceAdjusted(raw: number, resistance: number) {
  return Math.max(1, Math.round(raw * 100 / (100 + Math.max(-50, resistance))));
}
function hit(caster: Combatant, target: Combatant, raw: number, events: CombatEvent[], move: MoveDefinition) {
  const resistance = move.damageType === 'physical' ? target.stats.defense : target.stats.mr;
  const damage = resistanceAdjusted(raw, resistance);
  const absorbed = Math.min(target.shield, damage);
  target.shield -= absorbed;
  target.hp = Math.max(0, target.hp - (damage - absorbed));
  // A shield still counts as taking a hit for mana generation.
  target.mana = Math.min(target.maxMana, target.mana + 8 * (1 + target.bonuses.manaGainPercent / 100));
  events.push({ kind:'ability', uid:caster.uid, targetUid:target.uid, damage:damage-absorbed, absorbed, color:move.color, move:move.name });
}
function hopToward(caster: Combatant, target: Combatant, units: Combatant[], events: CombatEvent[]) {
  if (hexDistance(caster,target) <= 1) return;
  const offsets = [[0,-1],[0,1],[-1,0],[1,0],[-1,-1],[1,-1],[-1,1],[1,1]];
  for (let step=0;step<2;step++) {
    const next = offsets.map(([dx,dy])=>({x:caster.x+dx,y:caster.y+dy}))
      .filter(p=>p.x>=0&&p.x<8&&p.y>=0&&p.y<8 && hexDistance(caster,p)===1)
      .filter(p=>!units.some(u=>u!==caster&&u.hp>0&&u.x===p.x&&u.y===p.y))
      .sort((a,b)=>hexDistance(a,target)-hexDistance(b,target))[0];
    if (!next || hexDistance(next,target)>=hexDistance(caster,target)) break;
    caster.x=next.x; caster.y=next.y;
    events.push({kind:'move',uid:caster.uid});
  }
}

/** Called by the simulation, independent of Phaser. */
export function castMove(caster: Combatant, units: Combatant[], events: CombatEvent[]): boolean {
  const enemies = units.filter(u=>u.hp>0 && u.side!==caster.side);
  if (!enemies.length) return false;
  const move=moveFor(caster.pokemonId);
  const byNearest=[...enemies].sort((a,b)=>hexDistance(caster,a)-hexDistance(caster,b)||a.uid.localeCompare(b.uid));
  const target=move.style==='backline'
    ? [...enemies].sort((a,b)=>(caster.side==='player'?a.y-b.y:b.y-a.y)||a.uid.localeCompare(b.uid))[0]
    : byNearest[0];
  const stage = abilityStageScaling(caster.pokemonId);
  const scalingStat = move.scaling === 'AD' ? caster.stats.attack : caster.stats.ap;
  const basePower = stage.base + stage.ratio * scalingStat;
  const power = Math.round(basePower * (move.damageType === 'shield' ? 1 : 1 + caster.bonuses.spellAmpPercent / 100));
  caster.mana=0;
  events.push({kind:'cast',uid:caster.uid,targetUid:target.uid,color:move.color,move:move.name});
  switch(move.style) {
    case 'shield': {
      const shield=Math.round(power);
      caster.shield+=shield;
      events.push({kind:'shield',uid:caster.uid,amount:shield,color:move.color,move:move.name});
      break;
    }
    case 'dash':
    case 'backline':
      hopToward(caster,target,units,events);
      hit(caster,target,power,events,move);
      break;
    case 'multi':
      for(let i=0;i<3&&target.hp>0;i++) hit(caster,target,power,events,move);
      break;
    case 'drain': {
      const before=target.hp;
      hit(caster,target,power,events,move);
      const healing=Math.min(caster.maxHp-caster.hp,Math.round((before-target.hp)*0.6));
      caster.hp+=healing;
      events.push({kind:'heal',uid:caster.uid,amount:healing,color:move.color});
      break;
    }
    case 'line':
    case 'beam': {
      // Simplified AoE: strikes primary target and nearby enemies (within one hex).
      const targets=enemies.filter(u=>u===target||hexDistance(u,target)<=1).slice(0,3);
      for(const enemy of targets) if(enemy.hp>0) hit(caster,enemy,power,events,move);
      break;
    }
    default: hit(caster,target,power,events,move);
  }
  return true;
}
