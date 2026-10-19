import { useEffect, useRef, useState } from "react";
import Phaser from "phaser";
import { BattleScene } from "./game/BattleScene";
import { hexPosition, nearestFriendlyHex } from "./game/hex";
import { pokemonDatabase } from "./data/pokemon";
import { TRAIT_RULES, traitCounts, type TraitRule } from "./game/synergies";
import { COLORS, baseOf, price, sellValue, useGameStore, type BaseId } from "./store/gameStore";
import "./App.css";

// Text placeholders are intentional: unusual Unicode glyphs can render as
// missing characters or unrelated symbols on different computers.
// baseOf() resolves evolved Pokémon to their original family for coloring.
const creatureInitials: Record<BaseId, string> = {
  geodude: "GE", rowlet: "RO", piplup: "PI", charmander: "CH", gible: "GI",
  froakie: "FR", axew: "AX", scorbunny: "SC", bulbasaur: "BU", abra: "AB",
};
const creatureColor = (pokemonId: string) =>
  `#${(COLORS[baseOf(pokemonId)] ?? 0x667788).toString(16).padStart(6, "0")}`;
const creatureLabel = (pokemonId: string) =>
  creatureInitials[baseOf(pokemonId)];
const tierColors = ["", "#97a6b1", "#45b878", "#4f9feb", "#ad7af1", "#e6b552"];

function Board() {
  const mount = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!mount.current) return;
    const game = new Phaser.Game({
      type: Phaser.AUTO, parent: mount.current, width: 800, height: 600,
      backgroundColor: "#17212e", scene: [BattleScene],
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    });
    return () => game.destroy(true);
  }, []);

  const deployAtDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const uid = event.dataTransfer.getData("text/poketactics-unit");
    const canvas = mount.current?.querySelector("canvas");
    if (!uid || !canvas) return;
    const bounds = canvas.getBoundingClientRect();
    const x = (event.clientX - bounds.left) * 800 / bounds.width;
    const y = (event.clientY - bounds.top) * 600 / bounds.height;
    const tile = nearestFriendlyHex(x, y);
    // Avoid accidental deployments when the drop is far outside the board.
    const center = hexPosition(tile.row, tile.col);
    if (Math.hypot(x - center.x, y - center.y) < 55) {
      useGameStore.getState().deploy(uid, tile.row, tile.col);
    } else {
      useGameStore.setState({ notice: "Drop your Pokémon on a green hex." });
    }
  };
  return <div className="canvas-mount" ref={mount} onDragOver={e => e.preventDefault()} onDrop={deployAtDrop}/>;
}

function ShopCard({ id, slotId }: { id: BaseId; slotId: number }) {
  const gold = useGameStore(s => s.gold);
  const buy = useGameStore(s => s.buy);
  const cost = price(id);
  const data = pokemonDatabase[id];
  return <button className="shop-card" style={{ borderColor: tierColors[cost] }}
      onClick={() => buy(slotId)} disabled={gold < cost || useGameStore.getState().phase !== "planning"} title={`Buy ${data.name} for ${cost} gold`}>
    <span className="creature-mark" style={{ backgroundColor: creatureColor(id) }}>{creatureLabel(id)}</span>
    <strong>{data.name}</strong>
    <small>{data.role}</small>
    <span className="type-line">{data.types.join(" / ")}</span>
    <span className="gold-label">● {cost} Gold</span>
  </button>;
}

function SellZone() {
  const sell = useGameStore(s => s.sell);
  const [hovering, setHovering] = useState(false);
  return <div className={`sell-zone ${hovering ? "sell-zone-hover" : ""}`}
    onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }}
    onDragEnter={e => { e.preventDefault(); setHovering(true); }}
    onDragLeave={() => setHovering(false)}
    onDrop={e => {
      e.preventDefault(); setHovering(false);
      const uid = e.dataTransfer.getData("text/poketactics-unit");
      if (uid) sell(uid);
    }}>
    SELL AREA • Drag a Pokémon here to sell it for gold
  </div>;
}

function Bench() {
  const units = useGameStore(s => s.units);
  const select = useGameStore(s => s.select);
  const selectedUid = useGameStore(s => s.selectedUid);
  const sell = useGameStore(s => s.sell);
  const bench = useGameStore(s => s.bench);
  const benched = units.filter(u => u.row === null);
  const selected = units.find(u => u.uid === selectedUid);
  return <section className="bench-panel">
    <div className="section-heading"><h2>BENCH</h2><span>{benched.length}/9</span></div>
    <div className="bench-slots">
      {Array.from({length: 9}, (_, i) => {
        const unit = benched[i];
        if (!unit) return <div key={i} className="bench-slot empty">{i + 1}</div>;
        const data = pokemonDatabase[unit.pokemonId];
        return <div key={unit.uid} className={`bench-slot filled ${selectedUid === unit.uid ? "selected" : ""}`}
          draggable onDragStart={e => { e.dataTransfer.setData("text/poketactics-unit", unit.uid); e.dataTransfer.effectAllowed = "move"; }}
          onClick={() => select(unit.uid)} title={`Drag ${data.name} onto a green hex`}>
          <span className="bench-icon" style={{ backgroundColor: creatureColor(unit.pokemonId) }} aria-hidden="true">{creatureLabel(unit.pokemonId)}</span>
          <span className="bench-name">{data.name}</span>
        </div>;
      })}
    </div>
    <div className="bench-controls">
      <span>{selected ? `Selected: ${pokemonDatabase[selected.pokemonId].name} (sell +${sellValue(selected.pokemonId)} gold)` : "Select a unit to manage it"}</span>
      <div className="control-buttons">
        <button disabled={!selected || selected.row === null} onClick={() => selected && bench(selected.uid)}>To bench</button>
        <button disabled={!selected} onClick={() => selected && sell(selected.uid)}>Sell selected</button>
      </div>
    </div>
  </section>;
}


function formatTraitValue(rule: TraitRule, tier: 0 | 1): string {
  const value = rule.values[tier];
  switch (rule.stat) {
    case "regenPercentPerSecond":
      return `+${(value * 100).toFixed(1)}% max HP regenerated per second`;
    case "critChance":
      return `+${(value * 100).toFixed(0)}% critical-hit chance`;
    case "ap": return `+${value} Ability Power`;
    case "defense": return `+${value} Defense`;
    case "magicResist": return `+${value} Magic Resist`;
    case "manaGainPercent": return `+${value}% mana generated`;
    case "hpPercent": return `+${value}% maximum HP`;
    case "attackPercent": return `+${value}% Attack Damage`;
    case "attackSpeedPercent": return `+${value}% attack speed`;
    case "spellAmpPercent": return `+${value}% ability damage`;
    default: return `+${value} ${rule.description}`;
  }
}

function SynergyPanel() {
  const [expandedTraits, setExpandedTraits] = useState<string[]>([]);
  const toggleTrait = (trait: string) => setExpandedTraits(current => current.includes(trait) ? current.filter(t => t !== trait) : [...current, trait]);
  const units = useGameStore(s => s.units);
  const pokemonIds = units.filter(u => u.row !== null).map(u => u.pokemonId);
  // Shared with the combat engine: duplicates of an evolution family count once.
  const counts = traitCounts(pokemonIds);
  const shown = TRAIT_RULES.filter(rule => (counts.get(rule.trait) ?? 0) > 0)
    .sort((a, b) => (counts.get(b.trait) ?? 0) - (counts.get(a.trait) ?? 0)
      || a.trait.localeCompare(b.trait));

  return <section className="synergy-panel">
    <div className="section-heading"><h2>TEAM SYNERGIES</h2><span>Click a trait for bonuses</span></div>
    {shown.length === 0 ? <p className="synergy-empty">Deploy Pokémon to discover elemental and role bonuses.</p> :
      <div className="synergy-list">{shown.map(rule => {
        const count = counts.get(rule.trait) ?? 0;
        const first = rule.thresholds[0], second = rule.thresholds[1];
        const tier = count >= second ? 2 : count >= first ? 1 : 0;
        const next = tier === 0 ? first : tier === 1 ? second : null;
        const expanded = expandedTraits.includes(rule.trait);
        return <div className={`synergy-item synergy-explained ${tier ? "synergy-active" : ""}`} key={rule.trait}>
          <button type="button" className="synergy-toggle" onClick={() => toggleTrait(rule.trait)} aria-expanded={expanded} aria-label={`${rule.trait} synergy: ${count} units. ${expanded ? "Hide" : "Show"} bonuses`}>
            <span className="trait-symbol" aria-hidden="true">{pokemonIds.some(id => pokemonDatabase[id]?.role === rule.trait) ? "◆" : "✦"}</span>
            <span className="trait-summary"><small>{pokemonIds.some(id => pokemonDatabase[id]?.role === rule.trait) ? "ROLE" : "TYPE"}</small><strong>{rule.trait}</strong><small className={tier ? "trait-active-label" : ""}>{tier ? `Tier ${tier} active` : `Need ${first - count} more`}</small></span>
            <span className="trait-progress"><b>{count}{next ? `/${next}` : " MAX"}</b><span className="trait-chevron" aria-hidden="true">{expanded ? "−" : "+"}</span></span>
          </button>
          {expanded && <div className="synergy-effects" id={`trait-${rule.trait}`}>
            <div className={tier === 1 ? "effect-unlocked" : ""}><b>{first} units:</b> {formatTraitValue(rule, 0)}</div>
            <div className={tier === 2 ? "effect-unlocked" : ""}><b>{second} units:</b> {formatTraitValue(rule, 1)}</div>
          </div>}
        </div>;
      })}</div>}
    <p className="synergy-note">Bonuses apply in combat. Dual types count toward both traits. Only the highest tier of each trait applies.</p>
  </section>;
}

export default function App() {
  const gold = useGameStore(s => s.gold);
  const phase = useGameStore(s => s.phase);
  const outcome = useGameStore(s => s.outcome);
  const round = useGameStore(s => s.round);
  const startBattle = useGameStore(s => s.startBattle);
  const nextRound = useGameStore(s => s.nextRound);
  const offers = useGameStore(s => s.offers);
  const reroll = useGameStore(s => s.reroll);
  const deployed = useGameStore(s => s.units.filter(u => u.row !== null).length);
  const notice = useGameStore(s => s.notice);
  return <main className="app">
    <header className="top-bar">
      <div><h1>POKÉTACTICS</h1><p>Retro auto-battler · Battle & synergy prototype</p></div>
      <div className="top-stats"><span>ROUND <b>1-{round}</b></span><span>TEAM <b>{deployed}/4</b></span><span>GOLD <b className="gold">● {gold}</b></span></div>
    </header>
    <section className="battle-controls">
      <strong>{phase === 'planning' ? 'PLANNING PHASE' : phase === 'combat' ? 'COMBAT IN PROGRESS' : `BATTLE ${outcome?.toUpperCase()}`}</strong>
      {phase === 'planning' ? <button onClick={startBattle}>⚔ Start Battle</button> :
       phase === 'results' ? <button onClick={nextRound}>Next Round (+5 Gold)</button> :
       <span>Basic attacks charge mana • special moves trigger automatically</span>}
    </section>
    <div className="battle-layout">
      <SynergyPanel/>
      <section className="game-area"><Board/></section>
    </div>
    <Bench/>
    <section className="shop-panel">
      <div className="shop-title"><div><h2>POKÉMON SHOP</h2><p>Click to buy · Each card's border shows its cost tier</p></div>
        <button className="reroll" onClick={reroll} disabled={gold < 2 || phase !== "planning"}>↻ Reroll · 2 Gold</button></div>
      <div className="shop-slots">{Array.from({length:5},(_,slotId) => {
        const offer = offers.find(o => o.slotId === slotId);
        return offer ? <ShopCard key={slotId} slotId={slotId} id={offer.pokemonId}/> :
          <div key={slotId} className="shop-empty">Purchased</div>;
      })}</div>
    </section>
    <SellZone/>
    <p className="notice" role="status">{notice}</p>
    <p className="footnote">Combat demo: 10 signature move families, mana bars, shields, healing and projectiles. PvP, augments and carousel remain future milestones.</p>
  </main>;
}
