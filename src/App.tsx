import { useEffect, useRef, useState } from "react";
import Phaser from "phaser";
import { BattleScene } from "./game/BattleScene";
import { hexPosition, nearestFriendlyHex } from "./game/hex";
import { pokemonDatabase } from "./data/pokemon";
import { craftedFrom, items } from "./data/items";
import { effectiveTierOdds, MAX_LEVEL, REROLL_COST, teamCapacity, xpNeeded } from "./game/matchRules";
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
    const itemUid = event.dataTransfer.getData("text/poketactics-item");
    const canvas = mount.current?.querySelector("canvas");
    if ((!uid && !itemUid) || !canvas) return;
    const bounds = canvas.getBoundingClientRect();
    const x = (event.clientX - bounds.left) * 800 / bounds.width;
    const y = (event.clientY - bounds.top) * 600 / bounds.height;
    const tile = nearestFriendlyHex(x, y);
    // Avoid accidental deployments when the drop is far outside the board.
    const center = hexPosition(tile.row, tile.col);
    if (Math.hypot(x - center.x, y - center.y) < 55) {
      if (itemUid) {
        const unit = useGameStore.getState().units.find(u => u.row === tile.row && u.col === tile.col);
        if (unit) useGameStore.getState().equipItem(itemUid, unit.uid);
        else useGameStore.setState({ notice: "Drop equipment on an occupied friendly hex." });
      } else useGameStore.getState().deploy(uid, tile.row, tile.col);
    } else {
      useGameStore.setState({ notice: "Drop on a green hex or equipped Pokémon." });
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

function Bench() {
  const units = useGameStore(s => s.units);
  const select = useGameStore(s => s.select);
  const selectedUid = useGameStore(s => s.selectedUid);
  const sell = useGameStore(s => s.sell);
  const bench = useGameStore(s => s.bench);
  const equipItem = useGameStore(s => s.equipItem);
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
          onClick={() => select(unit.uid)}
          onDragOver={e=>e.preventDefault()}
          onDrop={e=>{
            const itemUid=e.dataTransfer.getData('text/poketactics-item');
            if(itemUid) {e.preventDefault();e.stopPropagation();equipItem(itemUid,unit.uid);}
          }}
          title={`Drag ${data.name} onto a green hex; drop an item here to equip`}>
          <span className="bench-icon" style={{ backgroundColor: creatureColor(unit.pokemonId) }} aria-hidden="true">{creatureLabel(unit.pokemonId)}</span>
          <span className="bench-name">{data.name}</span>
          {unit.items.length>0 && <span className="bench-items">{unit.items.map(item=><span key={item.uid} title={items[item.itemId]?.name}>{items[item.itemId]?.symbol ?? '?'}</span>)}</span>}
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


// Item descriptions are rendered in a floating overlay rather than the layout.
// Showing or hiding them therefore never changes the space allocated to Phaser.
const ITEM_STAT_LABELS: Record<string, string> = {
  attack: "Attack", attackPercent: "Attack", ap: "Ability Power",
  attackSpeedPercent: "Attack Speed", armor: "Armor", mr: "Magic Resist",
  hp: "Maximum HP", startingMana: "Starting Mana",
  manaGainPercent: "Mana Generated", attackManaGainPercent: "Attack Mana Generated",
  critChance: "Critical Chance", critDamage: "Critical Damage",
  spellAmpPercent: "Ability Damage", damageAmpPercent: "All Damage",
  healShieldAmpPercent: "Healing & Shields", healingReceivedPercent: "Healing Received",
  regenPercentPerSecond: "Max HP Regen / sec", lifestealPercent: "Lifesteal",
};
function describeItemStat(stat: string, value: number) {
  const name = ITEM_STAT_LABELS[stat] ?? stat;
  if (stat === "critChance" || stat === "critDamage") {
    return `+${Math.round(value * 100)} percentage points ${name}`;
  }
  if (stat === "regenPercentPerSecond") {
    return `+${(value * 100).toFixed(1)}% ${name}`;
  }
  if (stat.endsWith("Percent")) return `+${value}% ${name}`;
  return `+${value} ${name}`;
}

function ItemDetails({ itemId, onClose }: { itemId: string; onClose: () => void }) {
  const item = items[itemId];
  if (!item) return null;
  const stats = Object.entries(item.stats);
  return <aside className="item-detail-popover" role="dialog" aria-modal="false" aria-label={`${item.name} item details`}>
    <div className="item-detail-heading">
      <span className="item-detail-symbol" style={{ color: item.color, borderColor: item.color }}>{item.symbol}</span>
      <div className="item-detail-title">
        <strong>{item.name}</strong>
        <small>{item.kind === "component" ? "Crafting component" : "Completed item"}</small>
      </div>
      <button type="button" className="item-detail-close" aria-label="Close item details" onClick={onClose}>×</button>
    </div>
    <p className="item-detail-description">{item.description}</p>
    {stats.length > 0 && <div className="item-detail-stats">
      <strong>Stat bonuses</strong>
      {stats.map(([key, value]) => <span key={key}>{describeItemStat(key, value)}</span>)}
    </div>}
    {item.recipe ? <div className="item-detail-recipe">
      <strong>Crafting recipe</strong>
      <span>{items[item.recipe[0]].name} + {items[item.recipe[1]].name} → {item.name}</span>
    </div> : <p className="item-detail-tip">Combine this component with another component to craft an item.</p>}
    <p className="item-detail-tip">Click × or press Escape to close. You can keep dragging items while this panel is open.</p>
  </aside>;
}

function ItemInventory() {
  const [inspectedItemId, setInspectedItemId] = useState<string | null>(null);
  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setInspectedItemId(null);
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, []);
  const inventory = useGameStore(s=>s.inventory);
  const units = useGameStore(s=>s.units);
  const selectedUid = useGameStore(s=>s.selectedUid);
  const selectedItemUids = useGameStore(s=>s.selectedItemUids);
  const toggle = useGameStore(s=>s.toggleItemSelection);
  const craft = useGameStore(s=>s.craft);
  const equipItem = useGameStore(s=>s.equipItem);
  const unequip = useGameStore(s=>s.unequipItem);
  const grant = useGameStore(s=>s.grantTestComponents);
  const phase = useGameStore(s=>s.phase);
  const selected = units.find(u=>u.uid===selectedUid);
  const a=inventory.find(i=>i.uid===selectedItemUids[0]);
  const b=inventory.find(i=>i.uid===selectedItemUids[1]);
  const crafted=a&&b?craftedFrom(a.itemId,b.itemId):undefined;
  return <section className="items-panel">
    <div className="section-heading">
      <h2>ITEM INVENTORY <small>({inventory.length})</small></h2>
      <div className="item-buttons">
        <button disabled={phase!=='planning'||!crafted} onClick={()=>a&&b&&craft(a.uid,b.uid)} title="Select two components to craft">
          {crafted?`Craft ${crafted.name}`:'Craft 2 components'}
        </button>
        <button disabled={phase!=='planning'||!selected||selected.items.length>=3||selectedItemUids.length!==1}
          onClick={()=>selected&&selectedItemUids.length===1&&equipItem(selectedItemUids[0],selected.uid)}>Equip selected</button>
        <button onClick={grant} disabled={phase!=='planning'} title="Demo-only: generate one of each basic component">+ Test items</button>
      </div>
    </div>
    <div className="inventory-strip">
      {inventory.length===0 && <span className="inventory-empty">No items. Craft or earn components in future PvE rounds.</span>}
      {inventory.map(held=>{
        const data=items[held.itemId];
        if(!data)return null;
        return <button type="button" key={held.uid} draggable={phase==='planning'}
          className={`inventory-item ${selectedItemUids.includes(held.uid)?'chosen':''}`}
          onClick={()=>{toggle(held.uid);setInspectedItemId(held.itemId);}}
          aria-label={`Select ${data.name} and show its item description`}
          aria-pressed={selectedItemUids.includes(held.uid)}
          onDragStart={e=>{ e.dataTransfer.setData('text/poketactics-item',held.uid);e.dataTransfer.effectAllowed='move';}}
          onDragOver={e=>e.preventDefault()}
          onDrop={e=>{e.preventDefault();e.stopPropagation();const from=e.dataTransfer.getData('text/poketactics-item');if(from&&from!==held.uid)craft(from,held.uid);}}
          title={`${data.name} — ${data.description}${data.kind==='component'?' • Drag onto another component to craft.':''}`}
          style={{borderColor:data.color}}>
          <span className="item-token" style={{color:data.color}}>{data.symbol}</span>
          <span className="item-name">{data.name}</span>
        </button>;
      })}
    </div>
    <div className="inventory-bottom">
      <span className="inventory-instruction">
        {selectedItemUids.length === 2 && !crafted
          ? "Only two crafting components can combine."
          : "Click an item for its effects and recipe · drag to equip or craft"}
      </span>
      <span className="inventory-equipped-count">
        {selected ? `${pokemonDatabase[selected.pokemonId].name}: ${selected.items.length}/3 equipped` : "Select Pokémon to view equipped items"}
      </span>
      {selected && selected.items.map(held => <span className="equipped-item-control" key={held.uid}>
        <button type="button" className="equipped-item" onClick={() => setInspectedItemId(held.itemId)}
          title={`Inspect ${items[held.itemId]?.name}`}>
          {items[held.itemId]?.name ?? held.itemId} · Info
        </button>
        <button type="button" className="equipped-item-remove"
          disabled={phase !== "planning"} onClick={() => unequip(selected.uid, held.uid)}
          aria-label={`Unequip ${items[held.itemId]?.name ?? held.itemId}`} title="Unequip item">×</button>
      </span>)}
    </div>
    <span className="item-rule">36 standard recipes · Three equipment slots per Pokémon · Special emblems later</span>
    {inspectedItemId && <ItemDetails itemId={inspectedItemId} onClose={() => setInspectedItemId(null)}/>}
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
  const stage = useGameStore(s => s.stage);
  const stageRound = useGameStore(s => s.stageRound);
  const playerHp = useGameStore(s => s.playerHp);
  const streak = useGameStore(s => s.streak);
  const level = useGameStore(s => s.level);
  const xp = useGameStore(s => s.xp);
  const planningSeconds = useGameStore(s => s.planningSeconds);
  const timerPaused = useGameStore(s => s.timerPaused);
  const toggleTimerPause = useGameStore(s => s.toggleTimerPause);
  const buyXp = useGameStore(s => s.buyXp);
  const pendingIncome = useGameStore(s => s.pendingIncome);
  const lastHpLoss = useGameStore(s => s.lastHpLoss);
  const restartMatch = useGameStore(s => s.restartMatch);
  const startBattle = useGameStore(s => s.startBattle);
  const nextRound = useGameStore(s => s.nextRound);
  const offers = useGameStore(s => s.offers);
  const reroll = useGameStore(s => s.reroll);
  const deployed = useGameStore(s => s.units.filter(u => u.row !== null).length);
  const notice = useGameStore(s => s.notice);
  const sell = useGameStore(s => s.sell);
  const [shopDragOver, setShopDragOver] = useState(false);
  const [showOdds, setShowOdds] = useState(false);
  useEffect(() => {
    // A single timer for the entire match, independent of shop and item UI.
    const interval = window.setInterval(() => useGameStore.getState().tickPlanning(), 1000);
    return () => window.clearInterval(interval);
  }, []);
  const availableRoster = Object.values(pokemonDatabase)
    .filter(p => p.stage === 1)
    .map(p => ({id: p.id, cost: p.cost}));
  const odds = effectiveTierOdds(level, availableRoster);
  const resetShopHighlight = () => setShopDragOver(false);
  return <main className="app">
    <header className="top-bar">
      <div><h1>POKÉTACTICS</h1><p>Retro auto-battler · Battle & synergy prototype</p></div>
      <div className="top-stats">
        <span>ROUND <b>{stage}-{stageRound}</b></span>
        <span>HP <b className={playerHp<=30?'hp-low':'hp-normal'}>{playerHp}/100</b></span>
        <span>LEVEL <b>{level}</b></span>
        <span>XP <b>{level>=MAX_LEVEL?'MAX':`${xp}/${xpNeeded(level)}`}</b></span>
        <span>TEAM <b>{deployed}/{teamCapacity(level)}</b></span>
        <span>STREAK <b>{streak.kind ? `${streak.kind==='win'?'W':'L'}${streak.count}` : '—'}</b></span>
        <span title={`Current interest: +${Math.min(5,Math.floor(gold/10))} gold if the round ends now`}>GOLD <b className="gold">● {gold}</b></span>
      </div>
    </header>
    <section className="battle-controls">
      <div className="phase-title">
        <strong>{phase === 'planning' ? 'PLANNING PHASE' :
          phase === 'combat' ? 'COMBAT IN PROGRESS' :
          phase === 'gameover' ? 'TRAINER ELIMINATED' : `BATTLE ${outcome?.toUpperCase()}`}</strong>
        <small>{stage===1 && stageRound<=3 ? 'Opening practice · no trainer HP damage' : 'AI opponent · multiplayer later'} · Interest +{Math.min(5, Math.floor(gold/10))}g</small>
      </div>
      <div className="match-control-actions">
        {phase === 'planning' ? <>
          <span className={`planning-clock ${planningSeconds<=10?'clock-warning':''}`} role="timer">
            {timerPaused?'Paused':`⏱ ${planningSeconds}s`}
          </span>
          <button className="economy-button" type="button" onClick={toggleTimerPause}>
            {timerPaused?'Resume timer':'Pause timer'}
          </button>
          <button className="economy-button" type="button" onClick={buyXp} disabled={gold<4||level>=MAX_LEVEL}>
            +4 XP · 4 Gold
          </button>
          <button type="button" onClick={() => startBattle()}>⚔ Start Battle</button>
        </> : phase === 'results' ? <>
          <span className="income-summary" title="Gold is paid when you continue to the next round">
            {lastHpLoss>0?`-${lastHpLoss} HP · `:''}
            {pendingIncome ? `Income +${pendingIncome.total}g (base ${pendingIncome.base} / interest ${pendingIncome.interest} / win ${pendingIncome.victory} / streak ${pendingIncome.streak})` : ''}
          </span>
          <button type="button" onClick={nextRound}>Next Round · +{pendingIncome?.total ?? 0} Gold</button>
        </> : phase === 'gameover' ? <>
          <span className="income-summary">You reached Stage {stage}-{stageRound}</span>
          <button type="button" onClick={restartMatch}>Restart Match</button>
        </> : <span className="income-summary">Basic attacks charge mana · abilities cast automatically</span>}
      </div>
    </section>
    <div className="battle-layout">
      <SynergyPanel/>
      <section className="game-area"><Board/></section>
    </div>
    <Bench/>
    <ItemInventory/>
    <section className={`shop-panel ${shopDragOver ? "shop-html-hover" : ""}`}
      aria-label="Pokémon shop and sell drop target"
      onDragOverCapture={event => {
        if (phase !== "planning") return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        if (!shopDragOver) setShopDragOver(true);
      }}
      onDragLeave={event => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) resetShopHighlight();
      }}
      onDropCapture={event => {
        event.preventDefault();
        event.stopPropagation();
        resetShopHighlight();
        const uid = event.dataTransfer.getData("text/poketactics-unit");
        if (uid && useGameStore.getState().phase === "planning") sell(uid);
      }}
      onDragEnd={resetShopHighlight}>
      <div className="shop-title"><div><h2>POKÉMON SHOP</h2><p>Click to buy · Drag a Pokémon anywhere onto the shop to sell</p></div>
        <div className="shop-actions">
          <button className="shop-odds-button" type="button" onClick={() => setShowOdds(v=>!v)}
            aria-expanded={showOdds} aria-label="View level-based shop probabilities">Tier odds</button>
          <button className="reroll" onClick={reroll} disabled={gold < REROLL_COST || phase !== "planning"}>↻ Reroll · {REROLL_COST} Gold</button>
        </div>
      </div>
      {showOdds && <aside className="shop-odds-popover" role="dialog" aria-label="Shop tier probabilities">
        <div className="shop-odds-header"><strong>Level {level} shop odds</strong>
          <button type="button" aria-label="Close shop odds" onClick={() => setShowOdds(false)}>×</button>
        </div>
        {odds.map((chance,i) => <div className="shop-odds-row" key={i}>
          <span className="shop-odds-color" style={{background:tierColors[i+1]}}/>
          <span>Tier {i+1}</span><strong>{chance.toFixed(1)}%</strong>
        </div>)}
        <small>Per shop slot. Tier 5 has no Pokémon yet, so available-tier probabilities are normalized. Finite shared pools come later.</small>
      </aside>}
      <div className="shop-drop-hint" aria-hidden="true">Release to sell Pokémon for gold</div>
      <div className="shop-slots">{Array.from({length:5},(_,slotId) => {
        const offer = offers.find(o => o.slotId === slotId);
        return offer ? <ShopCard key={slotId} slotId={slotId} id={offer.pokemonId}/> :
          <div key={slotId} className="shop-empty">Purchased</div>;
      })}</div>
    </section>
    <p className="notice" role="status">{notice}</p>
    <p className="footnote">1.1 prototype: round schedule, HP, gold interest, streaks, XP and level-based odds. Opponents are still AI; augments, carousel, shared pools and full PvP come later.</p>
  </main>;
}
