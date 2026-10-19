import Phaser from "phaser";
import { createBattle, stepBattle, battleWinner, buildStats, type Combatant, type CombatEvent } from "./combat";
import { pokemonDatabase } from "../data/pokemon";
import { moveFor, abilityStageScaling, DEFAULT_ABILITY_POWER } from "./abilities";
import { COLORS, baseOf, FAMILIES, useGameStore, type Unit } from "../store/gameStore";
import { COLS, ROWS, HEX_SIZE, hexPosition, nearestFriendlyHex } from "./hex";
import { bonusesForPokemon, EMPTY_BONUSES } from "./synergies";
import { items } from "../data/items";

export class BattleScene extends Phaser.Scene {
  private tokenObjects: Phaser.GameObjects.GameObject[] = [];
  private detailPanel?: Phaser.GameObjects.Container;
  private unsubscribe?: () => void;
  private renderedUnitsKey = "";
  private renderedSelectionKey = "";
  private fighters: Combatant[] = [];
  private battleObjects: Phaser.GameObjects.GameObject[] = [];
  private battleElapsed = 0;
  private effectObjects: Phaser.GameObjects.GameObject[] = [];
  private lastPhase = '';
  private battleFrame?: Phaser.Time.TimerEvent;
  private inspectedCombatUid: string | null = null;
  private renderedCombatInfoKey = "";

  constructor() { super("BattleScene"); }

  create() {
    this.cameras.main.setBackgroundColor("#17212e");
    this.add.text(400, 34, "POKÉTACTICS", {
      fontFamily: "monospace", fontSize: "30px", fontStyle: "bold", color: "#ffffff",
    }).setOrigin(0.5);
    this.add.text(255, 94, "ENEMY TERRITORY", {
      fontFamily: "monospace", fontSize: "13px", color: "#cbd5e1",
    }).setOrigin(0.5);
    this.add.text(255, 520, "YOUR TEAM  •  DRAG TO POSITION", {
      fontFamily: "monospace", fontSize: "13px", color: "#a7f3d0",
    }).setOrigin(0.5);
    this.drawBoard();
    this.lastPhase = useGameStore.getState().phase;
    this.drawTokens();
    this.drawInfoPanel();
    this.unsubscribe = useGameStore.subscribe((state, prev) => {
      if (state.units !== prev.units) this.drawTokens();
      if (state.selectedUid !== prev.selectedUid || state.units !== prev.units) this.drawInfoPanel();
    });
    this.events.once("shutdown", () => {
      this.unsubscribe?.(); this.unsubscribe = undefined;
      this.battleFrame?.remove(); this.clearBattle();
    });
  }

  private drawBoard() {
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const { x, y } = hexPosition(row, col);
        const g = this.add.graphics();
        g.fillStyle(row < 4 ? 0x465267 : 0x326b66, 1);
        g.lineStyle(1.5, 0x94a3b8, 1);
        const points: Phaser.Math.Vector2[] = [];
        for (let i = 0; i < 6; i++) {
          const a = Phaser.Math.DegToRad(60 * i - 30);
          points.push(new Phaser.Math.Vector2(x + HEX_SIZE * Math.cos(a), y + HEX_SIZE * Math.sin(a)));
        }
        g.fillPoints(points, true);
        g.strokePoints(points, true);
      }
    }
  }

  // Phaser can miss a store notification during scene startup.
  // Verify the rendered unit positions on every game tick so purchases
  // and HTML bench drops always appear on the board.
  update() {
    const phase = useGameStore.getState().phase;
    if (phase !== this.lastPhase) {
      this.lastPhase = phase;
      if (phase === 'combat') this.beginCombat();
      if (phase === 'planning') this.clearBattle();
      this.drawTokens();
    }
    const key = this.unitsKey();
    if (key !== this.renderedUnitsKey) this.drawTokens();
    if (phase === 'combat' || phase === 'results') {
      const current = this.fighters.find(f => f.uid === this.inspectedCombatUid);
      const combatKey = `${phase}|${current?.uid ?? ''}|${current?.hp ?? ''}|${current?.mana ?? ''}|${current?.shield ?? ''}`;
      if (combatKey !== this.renderedCombatInfoKey) this.drawInfoPanel();
    } else {
      const selectionKey = `${useGameStore.getState().selectedUid ?? ""}|${key}`;
      if (selectionKey !== this.renderedSelectionKey) this.drawInfoPanel();
    }
  }

  private unitsKey() {
    return useGameStore.getState().units.map(u =>
      `${u.uid}:${u.pokemonId}:${u.row}:${u.col}:${u.items.map(item=>item.itemId).join(',')}`
    ).join("|");
  }

  private drawTokens() {
    this.renderedUnitsKey = this.unitsKey();
    this.tokenObjects.forEach(o => { this.tweens.killTweensOf(o); o.destroy(); });
    this.tokenObjects = [];
    if (useGameStore.getState().phase !== 'planning') return;
    for (const unit of useGameStore.getState().units) {
      if (unit.row === null || unit.col === null) continue;
      this.drawToken(unit);
    }
  }

  private drawToken(unit: Unit) {
    if (unit.row === null || unit.col === null) return;
    const data = pokemonDatabase[unit.pokemonId];
    const p = hexPosition(unit.row, unit.col);
    const shadow = this.add.ellipse(p.x, p.y + 13, 30, 9, 0x000000, 0.4);
    const body = this.add.circle(p.x, p.y, 17, COLORS[baseOf(unit.pokemonId)]);
    body.setStrokeStyle(2, 0xffffff);
    body.setInteractive({ draggable: true });
    const initial = this.add.text(p.x, p.y, data.name[0], {
      fontFamily: "monospace", fontSize: "17px", color: "#ffffff", fontStyle: "bold",
    }).setOrigin(0.5);
    const name = this.add.text(p.x, p.y - 29, data.name, {
      fontFamily: "monospace", fontSize: "11px", color: "#ffffff", backgroundColor: "#17212e",
      padding: { x: 3, y: 1 },
    }).setOrigin(0.5);
    const hpBg = this.add.rectangle(p.x, p.y + 25, 35, 5, 0x101827);
    const hp = this.add.rectangle(p.x, p.y + 25, 32, 3, 0x41d67e);
    this.tokenObjects.push(shadow, body, initial, name, hpBg, hp);
    // Small inventory indicator on deployed Pokémon.
    if (unit.items.length) {
      const icons = this.add.text(p.x, p.y + 32, unit.items.map(i=>items[i.itemId]?.symbol ?? '?').join(' '), {
        fontFamily:'monospace',fontSize:'9px',color:'#f8d780',backgroundColor:'#17212e'
      }).setOrigin(0.5);
      this.tokenObjects.push(icons);
    }
    const moveVisual = (x: number, y: number) => {
      body.setPosition(x, y);
      initial.setPosition(x, y);
      shadow.setPosition(x, y + 13);
      name.setPosition(x, y - 29);
      hpBg.setPosition(x, y + 25);
      hp.setPosition(x, y + 25);
    };
    const idle = this.tweens.add({ targets: [body, initial], scale: 1.07,
      duration: 500, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    // Phaser's canvas and React's bench use different drag systems.
    // Watch the browser pointer release so units can be dragged OUT of the canvas.
    let droppedOutside = false;
    let dragging = false;
    const benchElement = () => document.querySelector<HTMLElement>(".bench-panel");
    // The entire Pokémon shop is the sell target (no separate sell area).
    const sellElement = () => document.querySelector<HTMLElement>(".shop-panel");
    const inside = (element: HTMLElement | null, clientX: number, clientY: number) => {
      const bounds = element?.getBoundingClientRect();
      return !!bounds && clientX >= bounds.left && clientX <= bounds.right &&
        clientY >= bounds.top && clientY <= bounds.bottom;
    };
    const overBench = (x: number, y: number) => inside(benchElement(), x, y);
    const overSell = (x: number, y: number) => inside(sellElement(), x, y);
    const clearHighlights = () => {
      benchElement()?.classList.remove("drag-to-bench-hover");
      sellElement()?.classList.remove("shop-drop-hover");
    };
    const onDocumentMove = (event: PointerEvent) => {
      benchElement()?.classList.toggle("drag-to-bench-hover", overBench(event.clientX, event.clientY));
      sellElement()?.classList.toggle("shop-drop-hover", overSell(event.clientX, event.clientY));
    };
    const stopTracking = () => {
      dragging = false;
      document.removeEventListener("pointermove", onDocumentMove);
      document.removeEventListener("pointerup", onDocumentUp, true);
      document.removeEventListener("pointercancel", onDocumentCancel, true);
      clearHighlights();
    };
    const onDocumentCancel = () => stopTracking();
    const onDocumentUp = (event: PointerEvent) => {
      if (!dragging) return;
      const onBench = overBench(event.clientX, event.clientY);
      const onSell = overSell(event.clientX, event.clientY);
      stopTracking();
      if (!onBench && !onSell) return;
      droppedOutside = true;
      if (onSell) useGameStore.getState().sell(unit.uid);
      else useGameStore.getState().bench(unit.uid);
    };

    body.on("pointerdown", () => useGameStore.getState().select(unit.uid));
    body.on("dragstart", () => {
      idle.pause(); body.setScale(1); initial.setScale(1);
      droppedOutside = false;
      dragging = true;
      document.addEventListener("pointermove", onDocumentMove);
      document.addEventListener("pointerup", onDocumentUp, true);
      document.addEventListener("pointercancel", onDocumentCancel, true);
    });
    body.on("drag", (_pointer: Phaser.Input.Pointer, x: number, y: number) => moveVisual(x, y));
    body.on("dragend", () => {
      stopTracking();
      if (droppedOutside) return;
      const target = nearestFriendlyHex(body.x, body.y);
      const ok = useGameStore.getState().deploy(unit.uid, target.row, target.col);
      if (!ok) { moveVisual(p.x, p.y); idle.resume(); }
    });
    body.once("destroy", stopTracking);
  }

  private clearBattle() {
    this.battleFrame?.remove(); this.battleFrame = undefined;
    this.battleObjects.forEach(o => o.destroy());
    this.battleObjects = [];
    this.effectObjects.forEach(o => { this.tweens.killTweensOf(o); o.destroy(); });
    this.effectObjects = [];
    this.fighters = [];
    this.inspectedCombatUid = null;
    this.renderedCombatInfoKey = "";
  }

  private beginCombat() {
    this.clearBattle();
    this.fighters = createBattle(useGameStore.getState().units);
    const selectedUid = useGameStore.getState().selectedUid;
    this.inspectedCombatUid = this.fighters.find(f => f.uid === selectedUid)?.uid ?? null;
    this.renderedCombatInfoKey = "";
    this.drawInfoPanel();
    this.battleElapsed = 0;
    this.renderCombat();
    this.battleFrame = this.time.addEvent({ delay: 100, loop: true, callback: () => {
      if (useGameStore.getState().phase !== 'combat') return;
      this.battleElapsed += 0.1;
      const events = stepBattle(this.fighters);
      this.renderCombat();
      this.animateCombatEvents(events);
      const winner = battleWinner(this.fighters);
      if (winner || this.battleElapsed >= 55) {
        this.battleFrame?.remove(); this.battleFrame = undefined;
        useGameStore.getState().finishBattle(winner === 'player' ? 'win' : winner === 'enemy' ? 'loss' : 'draw', this.fighters.filter(f => f.side === 'enemy' && f.hp > 0).length);
      }
    }});
  }

  private renderCombat() {
    this.battleObjects.forEach(o => o.destroy());
    this.battleObjects = [];
    for (const fighter of this.fighters) {
      if (fighter.hp <= 0) continue;
      const pos = hexPosition(fighter.y, fighter.x);
      const data = pokemonDatabase[fighter.pokemonId];
      const color = COLORS[baseOf(fighter.pokemonId)];
      const body = this.add.circle(pos.x, pos.y, 17, color)
        .setStrokeStyle(3, this.inspectedCombatUid === fighter.uid ? 0xffd166 :
          fighter.side === 'player' ? 0xb8f5c4 : 0xf5a5a5);
      // Combatants are recreated visually each tick; bind inspection to the
      // persistent simulation uid, never the short-lived Phaser object.
      body.setInteractive({ useHandCursor: true });
      body.on('pointerdown', () => {
        this.inspectedCombatUid = fighter.uid;
        this.drawInfoPanel();
      });
      const label = this.add.text(pos.x, pos.y - 28, data.name, {
        fontFamily: 'monospace', fontSize: '11px', color: '#ffffff', backgroundColor: '#17212e'
      }).setOrigin(0.5);
      const initial = this.add.text(pos.x, pos.y, data.name[0], {
        fontFamily: 'monospace', fontSize: '17px', color: '#ffffff', fontStyle: 'bold'
      }).setOrigin(0.5);
      const hpBack = this.add.rectangle(pos.x, pos.y + 23, 36, 6, 0x121923);
      const hp = this.add.rectangle(pos.x - 17, pos.y + 23, 34 * (fighter.hp / fighter.maxHp), 4,
        fighter.side === 'player' ? 0x41d67e : 0xf87171).setOrigin(0, 0.5);
      const manaBack = this.add.rectangle(pos.x, pos.y + 31, 36, 5, 0x121923);
      const mana = this.add.rectangle(pos.x - 17, pos.y + 31, 34 * (fighter.mana / fighter.maxMana), 3,
        0x38a8ff).setOrigin(0, 0.5);
      this.battleObjects.push(body, label, initial, hpBack, hp, manaBack, mana);
      if (fighter.shield > 0) {
        const ring = this.add.circle(pos.x, pos.y, 21).setStrokeStyle(2, 0xedd7ac, 0.85);
        this.battleObjects.push(ring);
      }
    }
  }

  /** Cosmetic feedback only: ability mechanics are resolved in combat.ts. */
  private animateCombatEvents(events: CombatEvent[]) {
    const loc = (uid: string) => {
      const unit = this.fighters.find(f => f.uid === uid);
      return unit ? hexPosition(unit.y, unit.x) : null;
    };
    const track = <T extends Phaser.GameObjects.GameObject>(obj: T): T => {
      this.effectObjects.push(obj);
      obj.once('destroy', () => {
        this.effectObjects = this.effectObjects.filter(o => o !== obj);
      });
      return obj;
    };
    for (const event of events) {
      const source = loc(event.uid);
      const target = event.targetUid ? loc(event.targetUid) : source;
      if (!source) continue;
      if (event.kind === 'cast') {
        const moveLabel = track(this.add.text(source.x, source.y - 49, event.move ?? 'Move!', {
          fontFamily:'monospace',fontSize:'12px',fontStyle:'bold',color:'#ffffff',
          backgroundColor:'#243047',padding:{x:3,y:2},
        }).setOrigin(0.5).setDepth(65));
        this.tweens.add({targets:moveLabel,y:moveLabel.y-18,alpha:0,duration:750,
          onComplete:()=>moveLabel.destroy()});
        const flash=track(this.add.circle(source.x,source.y,22,event.color ?? 0xffffff,0.35).setDepth(52));
        this.tweens.add({targets:flash,scale:1.6,alpha:0,duration:330,onComplete:()=>flash.destroy()});
      }
      if ((event.kind === 'hit' || event.kind === 'ability') && target) {
        if (event.kind === 'ability') {
          const bolt=track(this.add.circle(source.x,source.y,5,event.color ?? 0x4fb7fb).setDepth(63));
          this.tweens.add({targets:bolt,x:target.x,y:target.y,duration:180,
            onComplete:()=>bolt.destroy()});
        }
        const damage=track(this.add.text(target.x,target.y-23,`-${event.damage ?? 0}`,{
          fontFamily:'monospace',fontSize:'13px',fontStyle:'bold',
          color:event.kind === 'ability'?'#ffe08a':'#ffffff',
        }).setOrigin(0.5).setDepth(70));
        this.tweens.add({targets:damage,y:damage.y-19,alpha:0,duration:600,
          onComplete:()=>damage.destroy()});
      }
      if (event.kind === 'shield' || event.kind === 'heal') {
        const label=track(this.add.text(source.x,source.y-30,
          event.kind === 'shield'?`SHIELD +${event.amount}`:`+${event.amount} HP`,{
            fontFamily:'monospace',fontSize:'12px',fontStyle:'bold',
            color:event.kind === 'shield'?'#fde68a':'#86efac',
          }).setOrigin(0.5).setDepth(70));
        this.tweens.add({targets:label,y:label.y-24,alpha:0,duration:650,
          onComplete:()=>label.destroy()});
      }
    }
  }

  private drawInfoPanel() {
    const state = useGameStore.getState();
    const phase = state.phase;
    const isBattle = phase === 'combat' || phase === 'results';
    const fighter = isBattle ? this.fighters.find(f => f.uid === this.inspectedCombatUid) : undefined;
    this.renderedCombatInfoKey = `${phase}|${fighter?.uid ?? ''}|${fighter?.hp ?? ''}|${fighter?.mana ?? ''}|${fighter?.shield ?? ''}`;
    this.renderedSelectionKey = `${state.selectedUid ?? ''}|${this.unitsKey()}`;
    this.detailPanel?.destroy();
    const selected = state.units.find(u => u.uid === state.selectedUid);
    const id = isBattle ? fighter?.pokemonId : selected?.pokemonId;
    const data = id ? pokemonDatabase[id] : undefined;
    const children: Phaser.GameObjects.GameObject[] = [];
    const panel = this.add.rectangle(0, 0, 255, 518, 0x233247).setOrigin(0, 0).setStrokeStyle(2, 0x627d93);
    children.push(panel);
    const write = (label: string, y: number, size = 11, color = '#e2e8f0') => {
      children.push(this.add.text(12, y, label, {
        fontFamily: 'monospace', fontSize: `${size}px`, color,
        wordWrap: { width: 231 },
      }));
    };
    write('POKÉMON INFO', 10, 16, '#93c5fd');
    if (!data || (isBattle ? !fighter : !selected)) {
      write(isBattle ? 'Click a Pokémon during combat to view live stats.' :
        'Click a deployed Pokémon or bench card to view stats.', 75, 12);
    } else {
      const move = moveFor(data.id);
      // Planning preview uses exactly the same synergy formulas as combat.ts.
      const alliedIds = state.units.filter(u => u.row !== null && u.col !== null).map(u => u.pokemonId);
      const bonus = fighter?.bonuses ?? (selected?.row !== null && selected?.col !== null
        ? bonusesForPokemon(data.id, alliedIds) : { ...EMPTY_BONUSES });
      const equippedItems = fighter?.items ?? selected?.items ?? [];
      const preview = buildStats(data.id, alliedIds, selected?.items ?? []);
      const gear = fighter?.itemBonuses ?? preview.gear;
      const maxHp = fighter?.maxHp ?? (selected?.row !== null ? preview.maxHp :
        buildStats(data.id,[],equippedItems).maxHp);
      const attack = fighter?.stats.attack ?? (selected?.row !== null ? preview.stats.attack :
        buildStats(data.id,[],equippedItems).stats.attack);
      const defense = fighter?.stats.defense ?? (selected?.row !== null ? preview.stats.defense :
        buildStats(data.id,[],equippedItems).stats.defense);
      const speed = fighter?.stats.attackSpeed ?? (selected?.row !== null ? preview.stats.attackSpeed :
        buildStats(data.id,[],equippedItems).stats.attackSpeed);
      const ap = fighter?.stats.ap ?? (selected?.row !== null ? preview.stats.ap :
        buildStats(data.id,[],equippedItems).stats.ap);
      const mr = fighter?.stats.mr ?? (selected?.row !== null ? preview.stats.mr :
        buildStats(data.id,[],equippedItems).stats.mr);
      const crit = (fighter?.critChance ?? Math.min(1,bonus.critChance+gear.critChance))*100;
      const critMultiplier = fighter?.critMultiplier ?? bonus.critMultiplier+gear.critDamage;
      const manaAttack = 20 * (1 + (bonus.manaGainPercent + gear.manaGainPercent + gear.attackManaGainPercent) / 100);
      const manaHit = 8 * (1 + (bonus.manaGainPercent + gear.manaGainPercent) / 100);
      const amp = bonus.spellAmpPercent + gear.spellAmpPercent;
      const fmt = (value: number) => Number.isInteger(value) ? String(value) : value.toFixed(1);
      const change = (base: number, current: number, decimals = 0) =>
        Math.abs(base - current) > 0.001 ? `${base.toFixed(decimals)} > ${current.toFixed(decimals)}` : current.toFixed(decimals);
      write(data.name, 36, 20, '#ffffff');
      write(`${data.role} | Stage ${data.stage} | ${data.cost}g${fighter ? ` | ${fighter.side.toUpperCase()}` : ''}`, 62, 10, '#b8c7d9');
      write(data.types.join(' / '), 80, 12, '#93c5fd');
      write(`HP ${fighter ? `${Math.ceil(fighter.hp)}/` : ''}${change(data.hp, maxHp)}`, 104, 11, '#86efac');
      write(`ATK ${change(data.attack, attack)}   ARMOR ${change(data.defense, defense)}`, 124, 11);
      write(`SPD ${change(data.attackSpeed, speed, 2)}   RANGE ${data.range}`, 144, 11);
      write(`AP ${change(DEFAULT_ABILITY_POWER, ap)}   MR ${change(data.magicResist, mr)}`, 164, 11);
      write(`CRIT ${crit.toFixed(0)}%  CRIT DMG ${(critMultiplier * 100).toFixed(0)}%`, 184, 11, '#fde68a');
      write(`MANA +${fmt(manaAttack)}/attack  +${fmt(manaHit)}/hit`, 204, 10, '#93c5fd');
      write(`START MANA +${gear.startingMana}  PASSIVE: 0/sec`, 221, 10, '#93c5fd');
      if (fighter) write(`LIVE MANA ${Math.floor(fighter.mana)}/${fighter.maxMana}  SHIELD ${Math.ceil(fighter.shield)}`, 239, 10, '#93c5fd');
      write('ABILITY', 262, 12, '#93c5fd');
      write(`${move.name} | ${move.mana} mana`, 282, 12, '#fde68a');
      const stage = abilityStageScaling(data.id);
      write(`${move.damageType.toUpperCase()} • ${stage.base} + ${Math.round(stage.ratio * 100)}% ${move.scaling}`, 301, 10, '#fde68a');
      const family = FAMILIES[baseOf(data.id)];
      const stageValues = family.map((formId, i) => {
        const form = pokemonDatabase[formId];
        const coeff = move.stages[i];
        return Math.round(coeff.base + coeff.ratio * (move.scaling === 'AD' ? form.attack : DEFAULT_ABILITY_POWER));
      });
      write(`STAGES ${stageValues.join(' / ')}${move.style === 'multi' ? ' per hit' : ''}`, 318, 10, '#93c5fd');
      const raw = Math.round((stage.base + stage.ratio * (move.scaling === 'AD' ? attack : ap)) *
        (move.damageType === 'shield' ? 1 + gear.healShieldAmpPercent / 100 :
          (1 + amp / 100) * (1 + gear.damageAmpPercent / 100)));
      write(`RAW ${raw}${amp ? ` (ability amp +${amp}%)` : ''}`, 335, 11, '#86efac');
      write(move.description, 354, 10);
      const buffs = [
        bonus.hpPercent && `HP +${bonus.hpPercent}%`, bonus.attackPercent && `AD +${bonus.attackPercent}%`,
        bonus.attackSpeedPercent && `AS +${bonus.attackSpeedPercent}%`, bonus.defense && `ARMOR +${bonus.defense}`,
        bonus.ap && `AP +${bonus.ap}`, bonus.magicResist && `MR +${bonus.magicResist}`,
        bonus.spellAmpPercent && `SPELL +${bonus.spellAmpPercent}%`,
        bonus.manaGainPercent && `MANA +${bonus.manaGainPercent}%`,
        bonus.critChance && `CRIT +${(bonus.critChance * 100).toFixed(0)}%`,
        bonus.regenPercentPerSecond && `REGEN ${(bonus.regenPercentPerSecond * 100).toFixed(1)}%/s`,
      ].filter(Boolean);
      write('ACTIVE SYNERGY EFFECTS', 395, 11, '#86efac');
      write(buffs.length ? buffs.join('  •  ') : 'None active', 414, 10, '#86efac');
      write(`EQUIPMENT (${equippedItems.length}/3)`, 443, 11, '#f5cf7b');
      write(equippedItems.length ? equippedItems.map(i=>items[i.itemId]?.name ?? i.itemId).join(', ') : 'None equipped', 460, 10, '#f7dca9');
      write('EVOLUTION', 481, 11, '#93c5fd');
      write(family.map(k => pokemonDatabase[k].name).join(' > '), 497, 9);
    }
    this.detailPanel = this.add.container(525, 65, children).setDepth(30);
  }
}
