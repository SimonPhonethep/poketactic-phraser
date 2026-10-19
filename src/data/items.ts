/** PokéTactics items — 8 standard components, 36 unique combinations.
 * Trainer Crest / Tactics Pan are reserved for the later emblem update.
 * Crafted items replace their components; component stats do not carry over.
 */
export const COMPONENT_IDS = ['fang','spoon','feather','plate','seed','crystal','cloak','charm'] as const;
export type ComponentId = typeof COMPONENT_IDS[number];
export type ItemId = ComponentId | string;
export type ItemInstance = { uid: string; itemId: ItemId };
export type ItemStats = Partial<{
  attack: number; attackPercent: number; ap: number; attackSpeedPercent: number;
  armor: number; mr: number; hp: number; startingMana: number;
  manaGainPercent: number; attackManaGainPercent: number;
  critChance: number; critDamage: number; spellAmpPercent: number;
  damageAmpPercent: number; healShieldAmpPercent: number;
  healingReceivedPercent: number; regenPercentPerSecond: number;
  lifestealPercent: number;
}>;
export type ItemDefinition = {
  id: string; name: string; kind: 'component' | 'crafted'; symbol: string;
  color: string; stats: ItemStats; description: string;
  recipe?: readonly [ComponentId, ComponentId];
};
const c = (id: ComponentId, name: string, symbol: string, color: string, stats: ItemStats, description: string): ItemDefinition =>
  ({ id, name, kind: 'component', symbol, color, stats, description });
const f = (id: string, name: string, a: ComponentId, b: ComponentId, symbol: string,
  stats: ItemStats, description: string): ItemDefinition => ({
  id, name, kind: 'crafted', symbol, color: '#e8bf67', stats, description, recipe: [a, b]
});
export const items: Record<string, ItemDefinition> = Object.fromEntries(([
  c('fang','Attack Fang','ATK','#e88f70',{attack:10},'+10 Attack'),
  c('spoon','Mystic Spoon','AP','#ae8bef',{ap:20},'+20 Ability Power'),
  c('feather','Swift Feather','AS','#63c6cb',{attackSpeedPercent:10},'+10% attack speed'),
  c('plate','Iron Plate','ARM','#8eb5d7',{armor:20},'+20 Armor'),
  c('seed','Vital Seed','HP','#67c99e',{hp:150},'+150 max HP'),
  c('crystal','Mana Crystal','MP','#62aaf5',{startingMana:15},'+15 starting mana'),
  c('cloak','Resist Cloak','MR','#a3b2e0',{mr:20},'+20 Magic Resist'),
  c('charm','Lucky Charm','CRT','#e6c466',{critChance:0.1},'+10 percentage points crit chance'),
  f('choice-band','Choice Band','fang','fang','CB',{attackPercent:30},'+30% Attack'),
  f('life-orb','Life Orb','fang','spoon','LO',{damageAmpPercent:15},'+15% basic and ability damage; lose 2% max HP per cast'),
  f('scope-lens','Scope Lens','fang','feather','SL',{critChance:0.2,critDamage:0.3},'+20 pp crit chance; +30 pp crit damage'),
  f('weakness-policy','Weakness Policy','fang','plate','WP',{},'After first hit: +15% Attack and +15 Armor for the battle'),
  f('drain-fang','Drain Fang','fang','seed','DF',{lifestealPercent:15},'Heal for 15% of basic attack HP damage'),
  f('razor-claw','Razor Claw','fang','crystal','RC',{},'Next basic attack after casting deals +60 physical raw damage'),
  f('choice-specs','Choice Specs','spoon','spoon','CS',{ap:50},'+50 Ability Power'),
  f('wise-glasses','Wise Glasses','spoon','feather','WG',{ap:20,attackSpeedPercent:15},'+20 AP, +15% attack speed'),
  f('spellguard-charm','Spellguard Charm','spoon','plate','SC',{mr:35,ap:20},'+35 MR, +20 AP'),
  f('big-root','Big Root','spoon','seed','BR',{hp:150,healShieldAmpPercent:20},'+150 HP; your heals and shields +20%'),
  f('twisted-spoon','Twisted Spoon','spoon','crystal','TS',{spellAmpPercent:20,startingMana:15},'+20% ability damage, +15 starting mana'),
  f('quick-claw','Quick Claw','feather','feather','QC',{attackSpeedPercent:35},'+35% attack speed'),
  f('rocky-helmet','Rocky Helmet','feather','plate','RH',{armor:20},'+20 Armor; reflect 12% of melee basic damage as physical'),
  f('leftovers','Leftovers','feather','seed','LF',{regenPercentPerSecond:0.015},'Regenerate 1.5% max HP per second'),
  f('power-herb','Power Herb','feather','crystal','PH',{attackManaGainPercent:25},'+25% mana from basic attacks'),
  f('metal-coat','Metal Coat','plate','plate','MC',{armor:45,mr:25},'+45 Armor and +25 MR'),
  f('sitrus-berry','Sitrus Berry','plate','seed','SB',{hp:300},'+300 HP; below 40% HP, heal 18% max HP once'),
  f('focus-sash','Focus Sash','plate','crystal','FS',{},'Survive one otherwise-lethal hit at 1 HP per battle'),
  f('dynamax-band','Dynamax Band','seed','seed','DB',{hp:500},'+500 max HP'),
  f('shell-bell','Shell Bell','seed','crystal','SH',{},'On cast heal 12% max HP (6-second cooldown)'),
  f('energy-amplifier','Energy Amplifier','crystal','crystal','EA',{startingMana:35,manaGainPercent:15},'+35 starting mana; +15% mana gain'),
  f('assault-vest','Assault Vest','fang','cloak','AV',{attack:15,mr:35},'+15 Attack and +35 MR'),
  f('sharp-beak','Sharp Beak','fang','charm','SB',{attack:20,critChance:0.15},'+20 Attack; +15 pp crit chance'),
  f('calm-mind-charm','Calm Mind Charm','spoon','cloak','CM',{ap:30,mr:30},'+30 AP and +30 MR'),
  f('spell-lens','Spell Lens','spoon','charm','SP',{ap:25,critChance:0.2},'+25 AP; +20 pp crit chance; abilities can crit using your crit chance'),
  f('safety-goggles','Safety Goggles','feather','cloak','SG',{attackSpeedPercent:20,mr:30},'+20% attack speed; +30 MR'),
  f('kings-rock',"King's Rock",'feather','charm','KR',{attackSpeedPercent:20,critChance:0.15},'+20% attack speed; +15 pp crit chance'),
  f('eviolite','Eviolite','plate','cloak','EV',{armor:35,mr:35},'+35 Armor, +35 MR (versatile defense)'),
  f('sturdy-band','Sturdy Band','plate','charm','ST',{armor:35},'+35 Armor; incoming critical bonus damage reduced 15%'),
  f('assault-shield','Assault Shield','seed','cloak','AS',{hp:250,mr:35},'+250 max HP and +35 MR (anti-magic frontline)'),
  f('lucky-egg','Lucky Egg','seed','charm','LE',{hp:250,healingReceivedPercent:20},'+250 HP; +20% healing received'),
  f('mental-herb','Mental Herb','crystal','cloak','MH',{startingMana:20,mr:30},'+20 starting mana, +30 MR'),
  f('razor-fang','Razor Fang','crystal','charm','RF',{startingMana:20,critChance:0.15},'+20 starting mana; +15 pp crit chance'),
  f('clear-amulet','Clear Amulet','cloak','cloak','CA',{mr:70},'+70 MR'),
  f('protective-specs','Protective Specs','cloak','charm','PS',{mr:40,critChance:0.15},'+40 MR; +15 pp crit chance'),
  f('super-luck-band','Super Luck Band','charm','charm','LB',{critChance:0.4,critDamage:0.2},'+40 pp crit chance; +20 pp crit damage'),
] as ItemDefinition[]).map(item => [item.id, item]));

export function isComponent(id: ItemId): id is ComponentId {
  return (COMPONENT_IDS as readonly string[]).includes(id);
}
const recipeKey = (a: string,b: string) => [a,b].sort().join('+');
const recipeMap = new Map<string,string>();
for (const item of Object.values(items)) if (item.recipe) recipeMap.set(recipeKey(...item.recipe), item.id);
export function craftedFrom(a: ItemId,b: ItemId): ItemDefinition | undefined {
  return isComponent(a) && isComponent(b) ? items[recipeMap.get(recipeKey(a,b)) ?? ''] : undefined;
}
export function itemStats(itemInstances: readonly ItemInstance[]): Required<ItemStats> {
  const base: Required<ItemStats> = {
    attack:0,attackPercent:0,ap:0,attackSpeedPercent:0,armor:0,mr:0,hp:0,startingMana:0,
    manaGainPercent:0,attackManaGainPercent:0,critChance:0,critDamage:0,spellAmpPercent:0,
    damageAmpPercent:0,healShieldAmpPercent:0,healingReceivedPercent:0,regenPercentPerSecond:0,lifestealPercent:0
  };
  for (const held of itemInstances) {
    const stats = items[held.itemId]?.stats ?? {};
    for (const [key,value] of Object.entries(stats)) {
      const k = key as keyof ItemStats;
      base[k] += value as number;
    }
  }
  base.critChance = Math.min(1,base.critChance);
  return base;
}
export function equipped(unit: {items: readonly ItemInstance[]} | undefined, id: string): boolean {
  return !!unit?.items.some(item => item.itemId === id);
}
