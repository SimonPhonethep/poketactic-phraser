import { pokemonDatabase } from '../data/pokemon';
import { castMove, hexDistance, moveFor } from './abilities';
import type { Unit } from '../store/gameStore';
import { bonusesForPokemon, type CombatBonuses } from './synergies';

export type Side = 'player' | 'enemy';
export type Combatant = {
  uid: string; pokemonId: string; side: Side;
  x: number; y: number; hp: number; maxHp: number;
  mana: number; maxMana: number; shield: number;
  attackTimer: number; moveTimer: number;
  stats: { attack: number; defense: number; attackSpeed: number; ap: number; mr: number };
  bonuses: CombatBonuses;
};
export type CombatEvent = {
  kind: 'hit'|'move'|'cast'|'ability'|'heal'|'shield';
  uid: string; targetUid?: string; damage?: number; absorbed?: number;
  amount?: number; color?: number; move?: string;
};

function newFighter(uid:string,pokemonId:string,side:Side,x:number,y:number,alliedIds:readonly string[]): Combatant {
  const stats=pokemonDatabase[pokemonId];
  const bonuses = bonusesForPokemon(pokemonId, alliedIds);
  const hp = Math.round(stats.hp * (1 + bonuses.hpPercent / 100));
  return {uid,pokemonId,side,x,y,hp,maxHp:hp,mana:0,maxMana:moveFor(pokemonId).mana,
    shield:0,attackTimer:0,moveTimer:0,bonuses,
    stats: {attack:stats.attack*(1+bonuses.attackPercent/100),
      defense:stats.defense+bonuses.defense,
      attackSpeed:stats.attackSpeed*(1+bonuses.attackSpeedPercent/100),
      ap:100+bonuses.ap, mr:30+bonuses.magicResist}};
}
export function createBattle(team: Unit[]): Combatant[] {
  const deployed=team.filter(u=>u.row!==null&&u.col!==null);
  const playerIds=deployed.map(u=>u.pokemonId);
  const player=deployed.map(u=>newFighter(u.uid,u.pokemonId,'player',u.col!,u.row!,playerIds));
  const enemyIds=player.length<=2 ? ['geodude','scorbunny'] : ['geodude','scorbunny','abra','rowlet'];
  const enemy=enemyIds.map((id,i)=>newFighter(`enemy-${i}`,id,'enemy',i+2,i%2,enemyIds));
  return [...player,...enemy];
}
const DIRECTIONS=[[0,-1],[0,1],[-1,0],[1,0],[-1,-1],[1,-1],[-1,1],[1,1]];
/** 100 ms simulation timestep. Events drive effects, simulation never touches Phaser. */
export function stepBattle(units: Combatant[],dt=0.1):CombatEvent[] {
  const events:CombatEvent[]=[];
  for(const unit of units) {
    if(unit.hp<=0)continue;
    unit.attackTimer-=dt;unit.moveTimer-=dt;
    const opponents=units.filter(u=>u.hp>0&&u.side!==unit.side)
      .sort((a,b)=>hexDistance(unit,a)-hexDistance(unit,b)||a.uid.localeCompare(b.uid));
    if(!opponents.length)break;
    const target=opponents[0];
    const stats=pokemonDatabase[unit.pokemonId];
    // Regeneration is continuous during combat and scales with bonus maximum HP.
    if (unit.bonuses.regenPercentPerSecond > 0)
      unit.hp = Math.min(unit.maxHp, unit.hp + unit.maxHp * unit.bonuses.regenPercentPerSecond * dt);
    if(unit.mana>=unit.maxMana) {castMove(unit,units,events);unit.attackTimer=Math.max(unit.attackTimer,0.3);continue;}
    if(hexDistance(unit,target)<=stats.range) {
      if(unit.attackTimer<=0) {
        let damage=Math.max(1,Math.round(unit.stats.attack*100/(100+Math.max(-50,target.stats.defense))));
        // Deterministic pseudo-random critical chance for this demo (no extra RNG state).
        if (unit.bonuses.critChance > 0 && Math.random() < unit.bonuses.critChance)
          damage = Math.round(damage * unit.bonuses.critMultiplier);
        const absorbed=Math.min(target.shield,damage);
        target.shield-=absorbed;
        target.hp=Math.max(0,target.hp-(damage-absorbed));
        unit.mana=Math.min(unit.maxMana,unit.mana+20*(1+unit.bonuses.manaGainPercent/100));
        target.mana=Math.min(target.maxMana,target.mana+8*(1+target.bonuses.manaGainPercent/100));
        unit.attackTimer=1/Math.max(0.2,unit.stats.attackSpeed);
        events.push({kind:'hit',uid:unit.uid,targetUid:target.uid,damage:damage-absorbed,absorbed});
      }
    } else if(unit.moveTimer<=0) {
      const next=DIRECTIONS.map(([dx,dy])=>({x:unit.x+dx,y:unit.y+dy}))
        .filter(p=>p.x>=0&&p.x<8&&p.y>=0&&p.y<8&&hexDistance(unit,p)===1)
        .filter(p=>!units.some(u=>u!==unit&&u.hp>0&&u.x===p.x&&u.y===p.y))
        .sort((a,b)=>hexDistance(a,target)-hexDistance(b,target)||a.y-b.y||a.x-b.x)[0];
      if(next&&hexDistance(next,target)<hexDistance(unit,target)) {
        unit.x=next.x;unit.y=next.y;unit.moveTimer=0.35;
        events.push({kind:'move',uid:unit.uid});
      }
    }
  }
  return events;
}
export function battleWinner(units:Combatant[]):Side|'draw'|null {
  const p=units.some(u=>u.side==='player'&&u.hp>0),e=units.some(u=>u.side==='enemy'&&u.hp>0);
  return p&&e?null:p?'player':e?'enemy':'draw';
}
