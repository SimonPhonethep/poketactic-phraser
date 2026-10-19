/** PokéTactics custom balance values. Not official Pokémon move data. */
export type MoveStyle = 'dash' | 'line' | 'shield' | 'arrow' | 'backline' | 'multi' | 'strike' | 'projectile' | 'drain' | 'beam';
export type DamageType = 'physical' | 'magic' | 'shield';
export type ScalingStat = 'AD' | 'AP';
export type StageScaling = { base: number; ratio: number };
export type MoveDefinition = {
  id: string; name: string; style: MoveStyle; mana: number;
  /** Stages 1, 2, 3. Raw effect = base + ratio * (AD or AP). */
  stages: readonly [StageScaling, StageScaling, StageScaling];
  damageType: DamageType; scaling: ScalingStat; color: number; description: string;
};
export const moves: Record<string, MoveDefinition> = {
  piplup: {id:'piplup',name:'Aqua Jet',style:'dash',mana:65,stages:[{base:20,ratio:1.65},{base:45,ratio:1.9},{base:90,ratio:2.3}],damageType:'physical',scaling:'AD',color:0x38bdf8,description:'Dashes to a target and lands a water strike.'},
  charmander: {id:'charmander',name:'Flamethrower',style:'line',mana:80,stages:[{base:0,ratio:2},{base:0,ratio:3},{base:0,ratio:5}],damageType:'magic',scaling:'AP',color:0xfb923c,description:'Scorches up to three nearby enemies in a line.'},
  geodude: {id:'geodude',name:'Rock Guard',style:'shield',mana:70,stages:[{base:100,ratio:1},{base:180,ratio:1.7},{base:300,ratio:3}],damageType:'shield',scaling:'AP',color:0xd6b48e,description:'Gains a shield; shield amount scales with AP.'},
  rowlet: {id:'rowlet',name:'Leaf Arrow',style:'arrow',mana:60,stages:[{base:25,ratio:1.7},{base:45,ratio:2},{base:90,ratio:2.4}],damageType:'physical',scaling:'AD',color:0x4ade80,description:'Fires a powerful leaf arrow at one target.'},
  gible: {id:'gible',name:'Dragon Rush',style:'backline',mana:75,stages:[{base:50,ratio:1.2},{base:90,ratio:1.6},{base:150,ratio:2.2}],damageType:'physical',scaling:'AD',color:0xc084fc,description:'Dashes toward a backline enemy and attacks.'},
  froakie: {id:'froakie',name:'Water Shuriken',style:'multi',mana:65,stages:[{base:5,ratio:0.75},{base:12,ratio:0.95},{base:25,ratio:1.2}],damageType:'physical',scaling:'AD',color:0x67e8f9,description:'Hits one enemy three times; values are PER HIT.'},
  axew: {id:'axew',name:'Dragon Claw',style:'strike',mana:70,stages:[{base:30,ratio:1.8},{base:60,ratio:2.1},{base:100,ratio:2.6}],damageType:'physical',scaling:'AD',color:0x86efac,description:'Heavy single-target physical strike.'},
  scorbunny: {id:'scorbunny',name:'Pyro Ball',style:'projectile',mana:70,stages:[{base:0,ratio:2},{base:0,ratio:3},{base:0,ratio:4.5}],damageType:'magic',scaling:'AP',color:0xf97316,description:'Launches a blazing projectile at one enemy.'},
  bulbasaur: {id:'bulbasaur',name:'Leech Seed',style:'drain',mana:80,stages:[{base:40,ratio:1.2},{base:70,ratio:1.8},{base:110,ratio:2.6}],damageType:'magic',scaling:'AP',color:0x65a30d,description:'Deals magic damage and heals for 60% of actual HP damage.'},
  abra: {id:'abra',name:'Psybeam',style:'beam',mana:75,stages:[{base:0,ratio:1.85},{base:0,ratio:2.75},{base:0,ratio:4.2}],damageType:'magic',scaling:'AP',color:0xe879f9,description:'Psychic beam hits up to three clustered enemies.'},
};
