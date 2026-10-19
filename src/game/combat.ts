import { pokemonDatabase } from '../data/pokemon';
import { castMove, hexDistance, moveFor } from './abilities';
import { itemStats, equipped, type ItemInstance, type ItemStats } from '../data/items';
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
  items: ItemInstance[]; itemBonuses: Required<ItemStats>;
  critChance: number; critMultiplier: number;
  itemState: { weakness: boolean; sitrus: boolean; sash: boolean; razor: boolean; shellCooldown: number };
};
export type CombatEvent = {
  kind: 'hit'|'move'|'cast'|'ability'|'heal'|'shield';
  uid: string; targetUid?: string; damage?: number; absorbed?: number;
  amount?: number; color?: number; move?: string;
};
export function buildStats(pokemonId:string, alliedIds:readonly string[], equipment:ItemInstance[]) {
  const p=pokemonDatabase[pokemonId];
  const bonuses=bonusesForPokemon(pokemonId,alliedIds);
  const gear=itemStats(equipment);
  return {
    maxHp:Math.round((p.hp+gear.hp)*(1+(bonuses.hpPercent)/100)),
    stats:{
      attack:(p.attack+gear.attack)*(1+(bonuses.attackPercent+gear.attackPercent)/100),
      defense:p.defense+bonuses.defense+gear.armor,
      attackSpeed:p.attackSpeed*(1+(bonuses.attackSpeedPercent+gear.attackSpeedPercent)/100),
      ap:100+bonuses.ap+gear.ap,
      mr:p.magicResist+bonuses.magicResist+gear.mr,
    }, bonuses, gear,
    critChance:Math.min(1,Math.max(0,bonuses.critChance+gear.critChance)),
    critMultiplier:bonuses.critMultiplier+gear.critDamage,
  };
}
function newFighter(uid:string,pokemonId:string,side:Side,x:number,y:number,alliedIds:readonly string[],equipment:ItemInstance[]): Combatant {
  const effective=buildStats(pokemonId,alliedIds,equipment);
  const maxMana=moveFor(pokemonId).mana;
  return {uid,pokemonId,side,x,y,hp:effective.maxHp,maxHp:effective.maxHp,
    mana:Math.min(maxMana,effective.gear.startingMana),maxMana,
    shield:0,attackTimer:0,moveTimer:0,
    stats:effective.stats,bonuses:effective.bonuses,items:equipment,
    itemBonuses:effective.gear,critChance:effective.critChance,critMultiplier:effective.critMultiplier,
    itemState:{weakness:false,sitrus:false,sash:false,razor:false,shellCooldown:0},
  };
}
export function createBattle(team: Unit[]): Combatant[] {
  const deployed=team.filter(u=>u.row!==null&&u.col!==null);
  const playerIds=deployed.map(u=>u.pokemonId);
  const player=deployed.map(u=>newFighter(u.uid,u.pokemonId,'player',u.col!,u.row!,playerIds,u.items));
  const enemyIds=player.length<=2 ? ['geodude','scorbunny'] : ['geodude','scorbunny','abra','rowlet'];
  const enemy=enemyIds.map((id,i)=>newFighter(`enemy-${i}`,id,'enemy',i+2,i%2,enemyIds,[]));
  return [...player,...enemy];
}
export function healUnit(unit:Combatant, raw:number, events:CombatEvent[], sourceUid?:string) {
  const amount=Math.min(unit.maxHp-unit.hp,Math.max(0,Math.round(raw*(1+unit.itemBonuses.healingReceivedPercent/100))));
  unit.hp+=amount;
  if(amount>0) events.push({kind:'heal',uid:sourceUid??unit.uid,targetUid:unit.uid,amount});
  return amount;
}
/** Apply a hit, shield, defensive item triggers and received-hit mana in one shared path. */
export function dealDamage(source:Combatant,target:Combatant,raw:number,type:'physical'|'magic',
  events:CombatEvent[],isAbility=false, move?:{color:number;name:string}, isCritical=false) {
  const resist=type==='physical'?target.stats.defense:target.stats.mr;
  let damage=Math.max(1,Math.round(raw*100/(100+Math.max(-50,resist))));
  if (isCritical && equipped(target,'sturdy-band'))
    damage=Math.max(1,Math.round(damage*(1-0.15*(source.critMultiplier-1)/source.critMultiplier)));
  const absorbed=Math.min(target.shield,damage);
  target.shield-=absorbed;
  let taken=damage-absorbed;
  if (taken>=target.hp && target.hp>0 && equipped(target,'focus-sash') && !target.itemState.sash) {
    taken=Math.max(0,target.hp-1); target.itemState.sash=true;
  }
  target.hp=Math.max(0,target.hp-taken);
  target.mana=Math.min(target.maxMana,target.mana+8*(1+(target.bonuses.manaGainPercent+target.itemBonuses.manaGainPercent)/100));
  events.push({kind:isAbility?'ability':'hit',uid:source.uid,targetUid:target.uid,damage:taken,absorbed,color:move?.color,move:move?.name});
  if (taken>0 && !target.itemState.weakness && equipped(target,'weakness-policy')) {
    target.itemState.weakness=true; target.stats.attack*=1.15; target.stats.defense+=15;
  }
  if (target.hp>0 && target.hp/target.maxHp<0.4 && !target.itemState.sitrus && equipped(target,'sitrus-berry')) {
    target.itemState.sitrus=true; healUnit(target,target.maxHp*0.18,events);
  }
  return taken;
}
const DIRECTIONS=[[0,-1],[0,1],[-1,0],[1,0],[-1,-1],[1,-1],[-1,1],[1,1]];
/** 100 ms simulation timestep. Events drive Phaser effects; no rendering dependencies. */
export function stepBattle(units: Combatant[],dt=0.1):CombatEvent[] {
  const events:CombatEvent[]=[];
  for(const unit of units) {
    if(unit.hp<=0)continue;
    unit.attackTimer-=dt;unit.moveTimer-=dt;
    unit.itemState.shellCooldown=Math.max(0,unit.itemState.shellCooldown-dt);
    const regen=unit.bonuses.regenPercentPerSecond+unit.itemBonuses.regenPercentPerSecond;
    if(regen>0) unit.hp=Math.min(unit.maxHp,unit.hp+unit.maxHp*regen*dt);
    const opponents=units.filter(u=>u.hp>0&&u.side!==unit.side)
      .sort((a,b)=>hexDistance(unit,a)-hexDistance(unit,b)||a.uid.localeCompare(b.uid));
    if(!opponents.length)break;
    const target=opponents[0];
    const p=pokemonDatabase[unit.pokemonId];
    if(unit.mana>=unit.maxMana) {castMove(unit,units,events);unit.attackTimer=Math.max(unit.attackTimer,0.3);continue;}
    if(hexDistance(unit,target)<=p.range) {
      if(unit.attackTimer<=0) {
        const critical=unit.critChance>0&&Math.random()<unit.critChance;
        let raw=unit.stats.attack*(1+unit.itemBonuses.damageAmpPercent/100);
        if (unit.itemState.razor) { raw+=60;unit.itemState.razor=false; }
        if(critical) raw*=unit.critMultiplier;
        const taken=dealDamage(unit,target,raw,'physical',events,false,undefined,critical);
        if(unit.itemBonuses.lifestealPercent>0) healUnit(unit,taken*unit.itemBonuses.lifestealPercent/100,events);
        if (taken>0 && p.range===1 && equipped(target,'rocky-helmet') && target.hp>0) {
          // Reflection is already post-hit damage and is reduced by the attacker's Armor.
          const reflected=Math.max(1,Math.round(taken*0.12*100/(100+Math.max(-50,unit.stats.defense))));
          unit.hp=Math.max(0,unit.hp-reflected);
          events.push({kind:'hit',uid:target.uid,targetUid:unit.uid,damage:reflected});
        }
        unit.mana=Math.min(unit.maxMana,unit.mana+20*(1+(unit.bonuses.manaGainPercent+unit.itemBonuses.manaGainPercent+unit.itemBonuses.attackManaGainPercent)/100));
        unit.attackTimer=1/Math.max(0.2,unit.stats.attackSpeed);
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
