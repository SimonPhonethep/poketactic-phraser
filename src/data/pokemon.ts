export type PokemonType =
  | "Normal" | "Fire" | "Water" | "Electric" | "Grass" | "Ice"
  | "Fighting" | "Poison" | "Ground" | "Flying" | "Psychic"
  | "Bug" | "Rock" | "Ghost" | "Dragon" | "Dark" | "Steel" | "Fairy";

export type PokemonRole = "Fighter" | "Mage" | "Tank" | "Ranged" | "Assassin";
export type PokemonTier = 1 | 2 | 3 | 4 | 5;

export interface PokemonData {
  id: string;
  name: string;
  types: PokemonType[];
  role: PokemonRole;
  stage: 1 | 2 | 3;
  cost: PokemonTier;
  hp: number;
  attack: number;
  /** Armor: the existing defense stat, retained for backwards compatibility. */
  defense: number;
  /** Base Magic Resist. Each evolution form has its own value. */
  magicResist: number;
  attackSpeed: number;
  range: number;
  evolvesTo?: string;
}

export const pokemonDatabase: Record<string, PokemonData> = {
  piplup: { id: "piplup", name: "Piplup", types: ["Water"], role: "Fighter", stage: 1, cost: 3, hp: 650, attack: 55, defense: 35, magicResist: 35, attackSpeed: 0.8, range: 1, evolvesTo: "prinplup" },
  prinplup: { id: "prinplup", name: "Prinplup", types: ["Water"], role: "Fighter", stage: 2, cost: 3, hp: 1000, attack: 85, defense: 55, magicResist: 45, attackSpeed: 0.9, range: 1, evolvesTo: "empoleon" },
  empoleon: { id: "empoleon", name: "Empoleon", types: ["Water", "Steel"], role: "Fighter", stage: 3, cost: 3, hp: 1600, attack: 135, defense: 90, magicResist: 70, attackSpeed: 1.0, range: 1 },

  charmander: { id: "charmander", name: "Charmander", types: ["Fire"], role: "Mage", stage: 1, cost: 2, hp: 450, attack: 65, defense: 20, magicResist: 30, attackSpeed: 0.7, range: 3, evolvesTo: "charmeleon" },
  charmeleon: { id: "charmeleon", name: "Charmeleon", types: ["Fire"], role: "Mage", stage: 2, cost: 2, hp: 700, attack: 100, defense: 35, magicResist: 35, attackSpeed: 0.8, range: 3, evolvesTo: "charizard" },
  charizard: { id: "charizard", name: "Charizard", types: ["Fire", "Flying"], role: "Mage", stage: 3, cost: 2, hp: 1100, attack: 170, defense: 55, magicResist: 50, attackSpeed: 0.9, range: 4 },

  geodude: { id: "geodude", name: "Geodude", types: ["Rock", "Ground"], role: "Tank", stage: 1, cost: 1, hp: 950, attack: 35, defense: 75, magicResist: 40, attackSpeed: 0.5, range: 1, evolvesTo: "graveler" },
  graveler: { id: "graveler", name: "Graveler", types: ["Rock", "Ground"], role: "Tank", stage: 2, cost: 1, hp: 1500, attack: 55, defense: 110, magicResist: 50, attackSpeed: 0.55, range: 1, evolvesTo: "golem" },
  golem: { id: "golem", name: "Golem", types: ["Rock", "Ground"], role: "Tank", stage: 3, cost: 1, hp: 2400, attack: 90, defense: 170, magicResist: 65, attackSpeed: 0.6, range: 1 },

  rowlet: { id: "rowlet", name: "Rowlet", types: ["Grass", "Flying"], role: "Ranged", stage: 1, cost: 2, hp: 420, attack: 70, defense: 25, magicResist: 30, attackSpeed: 0.85, range: 4, evolvesTo: "dartrix" },
  dartrix: { id: "dartrix", name: "Dartrix", types: ["Grass", "Flying"], role: "Ranged", stage: 2, cost: 2, hp: 650, attack: 105, defense: 40, magicResist: 35, attackSpeed: 0.95, range: 4, evolvesTo: "decidueye" },
  decidueye: { id: "decidueye", name: "Decidueye", types: ["Grass", "Ghost"], role: "Ranged", stage: 3, cost: 2, hp: 1000, attack: 165, defense: 60, magicResist: 45, attackSpeed: 1.1, range: 5 },

  gible: { id: "gible", name: "Gible", types: ["Dragon", "Ground"], role: "Assassin", stage: 1, cost: 4, hp: 550, attack: 85, defense: 30, magicResist: 30, attackSpeed: 1.0, range: 1, evolvesTo: "gabite" },
  gabite: { id: "gabite", name: "Gabite", types: ["Dragon", "Ground"], role: "Assassin", stage: 2, cost: 4, hp: 850, attack: 135, defense: 50, magicResist: 40, attackSpeed: 1.15, range: 1, evolvesTo: "garchomp" },
  garchomp: { id: "garchomp", name: "Garchomp", types: ["Dragon", "Ground"], role: "Assassin", stage: 3, cost: 4, hp: 1350, attack: 210, defense: 75, magicResist: 55, attackSpeed: 1.3, range: 1 },

  froakie: { id: "froakie", name: "Froakie", types: ["Water"], role: "Assassin", stage: 1, cost: 4, hp: 490, attack: 83, defense: 25, magicResist: 25, attackSpeed: 1.05, range: 1, evolvesTo: "frogadier" },
  frogadier: { id: "frogadier", name: "Frogadier", types: ["Water"], role: "Assassin", stage: 2, cost: 4, hp: 780, attack: 130, defense: 40, magicResist: 30, attackSpeed: 1.2, range: 1, evolvesTo: "greninja" },
  greninja: { id: "greninja", name: "Greninja", types: ["Water", "Dark"], role: "Assassin", stage: 3, cost: 4, hp: 1250, attack: 205, defense: 65, magicResist: 40, attackSpeed: 1.4, range: 1 },

  axew: { id: "axew", name: "Axew", types: ["Dragon"], role: "Fighter", stage: 1, cost: 3, hp: 680, attack: 68, defense: 35, magicResist: 35, attackSpeed: 0.75, range: 1, evolvesTo: "fraxure" },
  fraxure: { id: "fraxure", name: "Fraxure", types: ["Dragon"], role: "Fighter", stage: 2, cost: 3, hp: 1050, attack: 110, defense: 55, magicResist: 45, attackSpeed: 0.85, range: 1, evolvesTo: "haxorus" },
  haxorus: { id: "haxorus", name: "Haxorus", types: ["Dragon"], role: "Fighter", stage: 3, cost: 3, hp: 1700, attack: 180, defense: 85, magicResist: 60, attackSpeed: 1.0, range: 1 },

  scorbunny: { id: "scorbunny", name: "Scorbunny", types: ["Fire"], role: "Ranged", stage: 1, cost: 1, hp: 430, attack: 55, defense: 22, magicResist: 25, attackSpeed: 0.9, range: 3, evolvesTo: "raboot" },
  raboot: { id: "raboot", name: "Raboot", types: ["Fire"], role: "Ranged", stage: 2, cost: 1, hp: 670, attack: 88, defense: 38, magicResist: 30, attackSpeed: 1.0, range: 3, evolvesTo: "cinderace" },
  cinderace: { id: "cinderace", name: "Cinderace", types: ["Fire"], role: "Ranged", stage: 3, cost: 1, hp: 1080, attack: 150, defense: 58, magicResist: 40, attackSpeed: 1.15, range: 4 },

  bulbasaur: { id: "bulbasaur", name: "Bulbasaur", types: ["Grass", "Poison"], role: "Tank", stage: 1, cost: 2, hp: 840, attack: 40, defense: 60, magicResist: 40, attackSpeed: 0.6, range: 1, evolvesTo: "ivysaur" },
  ivysaur: { id: "ivysaur", name: "Ivysaur", types: ["Grass", "Poison"], role: "Tank", stage: 2, cost: 2, hp: 1320, attack: 65, defense: 95, magicResist: 50, attackSpeed: 0.65, range: 1, evolvesTo: "venusaur" },
  venusaur: { id: "venusaur", name: "Venusaur", types: ["Grass", "Poison"], role: "Tank", stage: 3, cost: 2, hp: 2140, attack: 105, defense: 145, magicResist: 70, attackSpeed: 0.72, range: 1 },

  abra: { id: "abra", name: "Abra", types: ["Psychic"], role: "Mage", stage: 1, cost: 1, hp: 370, attack: 68, defense: 18, magicResist: 35, attackSpeed: 0.7, range: 3, evolvesTo: "kadabra" },
  kadabra: { id: "kadabra", name: "Kadabra", types: ["Psychic"], role: "Mage", stage: 2, cost: 1, hp: 580, attack: 105, defense: 32, magicResist: 40, attackSpeed: 0.8, range: 3, evolvesTo: "alakazam" },
  alakazam: { id: "alakazam", name: "Alakazam", types: ["Psychic"], role: "Mage", stage: 3, cost: 1, hp: 920, attack: 170, defense: 50, magicResist: 60, attackSpeed: 0.95, range: 4 },
};

// Only first-stage Pokémon appear in shop rolls.
export const shopPokemon = [
  "piplup", "charmander", "geodude", "rowlet", "gible",
  "froakie", "axew", "scorbunny", "bulbasaur", "abra",
];
