/**
 * DSC Toolkit extensions — conditions, rest, death saves, attunement,
 * encounter builder, loot, timeline, calendar, tables, VTT I/O.
 * Loaded after app.js; hooks into existing globals when present.
 */
(function (global) {
  'use strict';

  const CONDITIONS = [
    { id: 'blinded', name: 'Blinded', text: 'Can\'t see; auto-fail sight checks; attacks have disadvantage; attacks against have advantage.' },
    { id: 'charmed', name: 'Charmed', text: 'Can\'t attack the charmer; charmer has advantage on social checks against you.' },
    { id: 'deafened', name: 'Deafened', text: 'Can\'t hear; auto-fail hearing checks.' },
    { id: 'frightened', name: 'Frightened', text: 'Disadvantage on checks and attacks while source is in sight; can\'t willingly move closer.' },
    { id: 'grappled', name: 'Grappled', text: 'Speed 0; ends if grappler is incapacitated or you are moved away.' },
    { id: 'incapacitated', name: 'Incapacitated', text: 'Can\'t take actions or reactions.' },
    { id: 'invisible', name: 'Invisible', text: 'Heavily obscured; advantage on attacks; attacks against have disadvantage.' },
    { id: 'paralyzed', name: 'Paralyzed', text: 'Incapacitated; auto-fail STR/DEX saves; attacks against have advantage; hits within 5 ft are crits.' },
    { id: 'petrified', name: 'Petrified', text: 'Transformed to solid; incapacitated; resistant to all damage; immune to poison/disease.' },
    { id: 'poisoned', name: 'Poisoned', text: 'Disadvantage on attack rolls and ability checks.' },
    { id: 'prone', name: 'Prone', text: 'Crawl only or stand (half movement); disadvantage on attacks; melee against has advantage; ranged against has disadvantage.' },
    { id: 'restrained', name: 'Restrained', text: 'Speed 0; attacks against have advantage; your attacks have disadvantage; DEX saves disadvantage.' },
    { id: 'stunned', name: 'Stunned', text: 'Incapacitated; auto-fail STR/DEX saves; attacks against have advantage.' },
    { id: 'unconscious', name: 'Unconscious', text: 'Incapacitated; drop prone; auto-fail STR/DEX saves; attacks against have advantage; hits within 5 ft are crits.' },
    { id: 'exhaustion', name: 'Exhaustion', text: 'Levels 1–6: disadv. checks → speed/2 → disadv. attacks/saves → HP max/2 → speed 0 → death.' },
    { id: 'concentrating', name: 'Concentrating', text: 'CON save to keep spell when damaged (DC 10 or half damage).' }
  ];

  const BACKGROUNDS = [
    { name: 'Acolyte', skills: ['Insight', 'Religion'], feature: 'Shelter of the Faithful', featureText: 'You and your companions can expect free healing and care at a temple, shrine, or other established presence of your faith.' },
    { name: 'Criminal', skills: ['Deception', 'Stealth'], feature: 'Criminal Contact', featureText: 'You have a reliable contact who acts as a liaison to a network of other criminals.' },
    { name: 'Folk Hero', skills: ['Animal Handling', 'Survival'], feature: 'Rustic Hospitality', featureText: 'Common folk help you hide, rest, or recover; they shield you from the law or anyone else searching for you, though they will not risk their lives.' },
    { name: 'Noble', skills: ['History', 'Persuasion'], feature: 'Position of Privilege', featureText: 'People are inclined to think the best of you; you can secure an audience with a local noble.' },
    { name: 'Sage', skills: ['Arcana', 'History'], feature: 'Researcher', featureText: 'When you attempt to learn or recall a piece of lore, if you do not know that information, you often know where and from whom you can obtain it.' },
    { name: 'Soldier', skills: ['Athletics', 'Intimidation'], feature: 'Military Rank', featureText: 'Soldiers loyal to your former organization still recognize your rank and authority.' },
    { name: 'Hermit', skills: ['Medicine', 'Religion'], feature: 'Discovery', featureText: 'Your seclusion gave you access to a unique and powerful discovery — the exact nature is up to you and the DM.' },
    { name: 'Entertainer', skills: ['Acrobatics', 'Performance'], feature: 'By Popular Demand', featureText: 'You can always find a place to perform; in exchange you receive free lodging and food of a modest or comfortable standard.' },
    { name: 'Guild Artisan', skills: ['Insight', 'Persuasion'], feature: 'Guild Membership', featureText: 'Guild members provide lodging and food; you can also gain access to powerful political figures through the guild.' },
    { name: 'Outlander', skills: ['Athletics', 'Survival'], feature: 'Wanderer', featureText: 'You have an excellent memory for maps and geography; you can find food and fresh water for yourself and up to five others each day.' },
    { name: 'Sailor', skills: ['Athletics', 'Perception'], feature: "Ship's Passage", featureText: 'You can secure free passage on a sailing ship for yourself and your companions.' },
    { name: 'Urchin', skills: ['Sleight of Hand', 'Stealth'], feature: 'City Secrets', featureText: 'You know the secret patterns and flow of cities; you can move through urban crowds at a fast pace when not in combat.' },
    { name: 'Charlatan', skills: ['Deception', 'Sleight of Hand'], feature: 'False Identity', featureText: 'You have created a second identity with documentation, established acquaintances, and disguises.' },
    { name: 'DSC — Sword-Touched', skills: ['Arcana', 'Survival'], feature: 'Echo of the Blade', featureText: 'Once per long rest, you sense nearby Sword-scarred phenomena or residual blade-magic within 300 feet.' },
    { name: 'DSC — Worldwalker', skills: ['History', 'Persuasion'], feature: 'Sevenfold Paths', featureText: 'You have contacts or trail-lore on at least two of the Seven Worlds; local guides treat you as a known traveler.' }
  ];

  const ENCOUNTER_XP = {
    0: 10, 0.125: 25, 0.25: 50, 0.5: 100,
    1: 200, 2: 450, 3: 700, 4: 1100, 5: 1800,
    6: 2300, 7: 2900, 8: 3900, 9: 5000, 10: 5900,
    11: 7200, 12: 8400, 13: 10000, 14: 11500, 15: 13000,
    16: 15000, 17: 18000, 18: 20000, 19: 22000, 20: 25000,
    21: 33000, 22: 41000, 23: 50000, 24: 62000, 25: 75000,
    26: 90000, 27: 105000, 28: 120000, 29: 135000, 30: 155000
  };

  const DAILY_XP_BUDGET = {
    1: 300, 2: 600, 3: 1200, 4: 1700, 5: 3500,
    6: 4000, 7: 5000, 8: 6000, 9: 7500, 10: 9000,
    11: 10500, 12: 11500, 13: 13500, 14: 15000, 15: 18000,
    16: 20000, 17: 25000, 18: 27000, 19: 30000, 20: 40000
  };

  const LOOT_BY_CR = [
    { max: 4, coins: '2d6 × 10 gp', items: '1d4 common trinkets; 10% chance 1 uncommon' },
    { max: 10, coins: '2d6 × 100 gp', items: '1d4 uncommon; 25% chance 1 rare' },
    { max: 16, coins: '2d6 × 1,000 gp', items: '1d4 rare; 25% chance 1 very rare' },
    { max: 20, coins: '2d6 × 10,000 gp', items: '1d4 very rare; 25% chance 1 legendary' },
    { max: 99, coins: '2d6 × 50,000 gp', items: '1d4 legendary; artifact (story)' }
  ];

  const RANDOM_TABLES = {
    'Corruption Omens (DSC)': [
      'Shadows lean the wrong way for a breath.',
      'A shard-whisper offers a gift for a name.',
      'Metal tastes of ozone and regret.',
      'An ally\'s reflection mouths different words.',
      'Local beasts refuse a road the party must take.',
      'A clock runs backward until someone lies.'
    ],
    'Travel Complications (Seven Worlds)': [
      'Border patrol demands a favor or bribe.',
      'Weather tied to a world\'s dominant force.',
      'Refugee caravan with conflicting stories.',
      'Ruined waypoint claimed by a minor force.',
      'Shortcut through a Sword-scarred zone.',
      'Guide vanishes; map symbols shift.'
    ],
    'Faction Reactions': [
      'Offers patronage with strings.',
      'Quiet sabotage of the party\'s plans.',
      'Public praise that paints a target.',
      'Demands proof of loyalty.',
      'Trades intel for a shared enemy.',
      'Retreats influence from a region the PCs need.'
    ],
    'Downtime Events': [
      'A rival appears in town.',
      'Training yields a temporary boon.',
      'Research uncovers a true name or weakness.',
      'Carousing attracts unwanted attention.',
      'Crafting succeeds with a minor quirk.',
      'Religious service grants inspiration.'
    ]
  };

  const MOON_PHASES = ['New', 'Waxing Crescent', 'First Quarter', 'Waxing Gibbous', 'Full', 'Waning Gibbous', 'Last Quarter', 'Waning Crescent'];
  const DSC_MOONS = ['Luna', 'Umbra', 'Sol-Eye', 'Aether Veil'];

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return [...(root || document).querySelectorAll(sel)]; }

  function loadExtState() {
    try {
      return JSON.parse(localStorage.getItem('dsc_ext_state') || '{}') || {};
    } catch (e) { return {}; }
  }
  function saveExtState(patch) {
    const cur = loadExtState();
    const next = { ...cur, ...patch, updatedAt: new Date().toISOString() };
    try { localStorage.setItem('dsc_ext_state', JSON.stringify(next)); } catch (e) {}
    return next;
  }

  function downloadJson(filename, obj) {
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  function downloadText(filename, text, mime) {
    const blob = new Blob([text], { type: mime || 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  function toast(msg) {
    if (typeof global.toast === 'function') global.toast(msg);
    else console.log(msg);
  }

  // ─── Encounter XP ─────────────────────────────────────────────────────────
  function xpForCr(cr) {
    const n = Number(cr);
    if (ENCOUNTER_XP[n] != null) return ENCOUNTER_XP[n];
    if (ENCOUNTER_XP[cr] != null) return ENCOUNTER_XP[cr];
    return ENCOUNTER_XP[Math.round(n)] || 0;
  }

  function encounterMultiplier(count) {
    if (count <= 1) return 1;
    if (count === 2) return 1.5;
    if (count <= 6) return 2;
    if (count <= 10) return 2.5;
    if (count <= 14) return 3;
    return 4;
  }

  // ─── Character combat helpers ─────────────────────────────────────────────
  function applyShortRest(ch) {
    const next = { ...ch };
    // Warlock pact slots recover
    const used = { ...(next.spellSlotsUsed || {}) };
    if (used.pact != null) used.pact = 0;
    next.spellSlotsUsed = used;
    next.inspiration = next.inspiration;
    return next;
  }

  function applyLongRest(ch) {
    const next = { ...ch };
    next.hp = next.hpMax != null ? next.hpMax : next.hp;
    next.spellSlotsUsed = {};
    next.deathSaves = { successes: 0, failures: 0 };
    next.exhaustedFromDying = false;
    if (next.attunement) {
      // attunement persists
    }
    return next;
  }

  // ─── Foundry export/import ────────────────────────────────────────────────
  function characterToFoundryActor(ch) {
    const abilities = {
      str: { value: Number(ch.str) || 10 },
      dex: { value: Number(ch.dex) || 10 },
      con: { value: Number(ch.con) || 10 },
      int: { value: Number(ch.int) || 10 },
      wis: { value: Number(ch.wis) || 10 },
      cha: { value: Number(ch.cha) || 10 }
    };
    const classes = Array.isArray(ch.classes) && ch.classes.length
      ? ch.classes
      : [{ name: ch.class || 'Adventurer', level: ch.level || 1, subclass: ch.subclass || '' }];
    const items = [];
    (ch.inventory || []).forEach((it, i) => {
      items.push({
        _id: 'item' + i,
        name: it.name || 'Item',
        type: it.category === 'weapon' ? 'weapon' : it.category === 'armor' || it.category === 'shield' ? 'equipment' : 'loot',
        system: {
          quantity: it.qty || 1,
          equipped: !!it.equipped,
          description: { value: it.notes || '' },
          damage: it.damage ? { parts: [[it.damage, it.damageType || '']] } : undefined,
          armor: it.acBase != null ? { value: it.acBase } : undefined
        }
      });
    });
    (ch.spellIds || []).forEach((id, i) => {
      items.push({
        _id: 'spell' + i,
        name: id,
        type: 'spell',
        system: { description: { value: '' } }
      });
    });
    return {
      name: ch.name || 'Unknown',
      type: 'character',
      img: ch.avatar || 'icons/svg/mystery-man.svg',
      system: {
        abilities,
        attributes: {
          hp: { value: ch.hp != null ? ch.hp : ch.hpMax, max: ch.hpMax || ch.hp || 1 },
          ac: { value: ch.ac || 10 },
          death: {
            success: (ch.deathSaves && ch.deathSaves.successes) || 0,
            failure: (ch.deathSaves && ch.deathSaves.failures) || 0
          }
        },
        details: {
          biography: { value: ch.notes || ch.features || '' },
          background: ch.background || '',
          race: ch.race || ''
        },
        traits: { size: 'med' }
      },
      items,
      flags: {
        dscToolkt: {
          classes,
          umbrarian: ch.umbrarian || null,
          corruption: ch.corruption,
          spellcastingAbility: ch.spellcastingAbility,
          attunement: ch.attunement || [],
          conditions: ch.conditions || [],
          source: 'DSCToolkt'
        }
      }
    };
  }

  function creatureToFoundryNpc(b) {
    return {
      name: b.n || b.name || 'Creature',
      type: 'npc',
      system: {
        abilities: {
          str: { value: Number(b.str) || 10 },
          dex: { value: Number(b.dex) || 10 },
          con: { value: Number(b.con) || 10 },
          int: { value: Number(b.int) || 10 },
          wis: { value: Number(b.wis) || 10 },
          cha: { value: Number(b.cha) || 10 }
        },
        attributes: {
          hp: { value: b.hp || 1, max: b.hp || 1 },
          ac: { value: b.ac || 10 }
        },
        details: {
          cr: b.cr,
          biography: { value: [b.desc, b.run, b.eco].filter(Boolean).join('\n\n') },
          type: { value: b.classif || '' }
        }
      },
      flags: { dscToolkt: { source: b.source || b.w || 'DSC', origin: b.o } }
    };
  }

  function foundryActorToCharacter(actor) {
    const sys = actor.system || actor.data || {};
    const ab = sys.abilities || {};
    const hp = sys.attributes?.hp || {};
    const flags = actor.flags?.dscToolkt || {};
    const inv = (actor.items || []).filter(i => i.type !== 'spell').map((it, i) => ({
      uid: 'fvtt-' + i,
      name: it.name,
      category: it.type === 'weapon' ? 'weapon' : it.type === 'equipment' ? 'armor' : 'gear',
      qty: it.system?.quantity || 1,
      equipped: !!it.system?.equipped,
      notes: it.system?.description?.value || ''
    }));
    const spellIds = (actor.items || []).filter(i => i.type === 'spell').map(i => i.name);
    return {
      name: actor.name || 'Imported',
      race: sys.details?.race || '',
      background: sys.details?.background || '',
      class: flags.classes?.[0]?.name || '',
      level: flags.classes?.reduce((s, c) => s + (c.level || 0), 0) || 1,
      classes: flags.classes || [],
      str: ab.str?.value || 10,
      dex: ab.dex?.value || 10,
      con: ab.con?.value || 10,
      int: ab.int?.value || 10,
      wis: ab.wis?.value || 10,
      cha: ab.cha?.value || 10,
      hp: hp.value,
      hpMax: hp.max,
      ac: sys.attributes?.ac?.value || 10,
      inventory: inv,
      spellIds,
      deathSaves: {
        successes: sys.attributes?.death?.success || 0,
        failures: sys.attributes?.death?.failure || 0
      },
      conditions: flags.conditions || [],
      attunement: flags.attunement || [],
      umbrarian: flags.umbrarian || null,
      features: sys.details?.biography?.value || '',
      _importedFrom: 'foundry'
    };
  }

  // ─── Roll20 export/import ─────────────────────────────────────────────────
  function characterToRoll20Handout(ch) {
    const lines = [
      `# ${ch.name || 'Character'}`,
      `**Race:** ${ch.race || '—'} | **Class:** ${classSummary(ch)} | **Level:** ${ch.level || 1}`,
      `**Background:** ${ch.background || '—'}`,
      '',
      `**HP:** ${ch.hp ?? '—'}/${ch.hpMax ?? '—'} | **AC:** ${ch.ac ?? '—'} | **PB:** +${ch.profBonus || 2}`,
      `**STR** ${ch.str} **DEX** ${ch.dex} **CON** ${ch.con} **INT** ${ch.int} **WIS** ${ch.wis} **CHA** ${ch.cha}`,
      '',
      '## Features',
      ch.features || '—',
      '',
      '## Spells',
      `Cantrips: ${ch.cantrips || '—'}`,
      ch.spells || (ch.spellIds || []).join(', ') || '—',
      '',
      '## Inventory',
      (ch.inventory || []).map(i => `- ${i.name} ×${i.qty || 1}${i.equipped ? ' (equipped)' : ''}`).join('\n') || '—'
    ];
    return lines.join('\n');
  }

  function classSummary(ch) {
    if (Array.isArray(ch.classes) && ch.classes.length) {
      return ch.classes.map(c => `${c.name} ${c.level}${c.subclass ? ' (' + c.subclass + ')' : ''}`).join(' / ');
    }
    return `${ch.class || '—'} ${ch.level || ''}${ch.subclass ? ' (' + ch.subclass + ')' : ''}`;
  }

  function roll20TableFromList(name, rows) {
    return {
      name,
      entries: (rows || []).map((t, i) => ({
        id: i + 1,
        weight: 1,
        text: typeof t === 'string' ? t : (t.text || t.name || String(t))
      }))
    };
  }

  function parseRoll20OrFoundryImport(obj) {
    // Foundry actor
    if (obj.type === 'character' || obj.type === 'npc' || obj.system?.abilities) {
      if (obj.type === 'npc') {
        const sys = obj.system || {};
        return {
          kind: 'creature',
          data: {
            n: obj.name,
            str: sys.abilities?.str?.value || 10,
            dex: sys.abilities?.dex?.value || 10,
            con: sys.abilities?.con?.value || 10,
            int: sys.abilities?.int?.value || 10,
            wis: sys.abilities?.wis?.value || 10,
            cha: sys.abilities?.cha?.value || 10,
            hp: sys.attributes?.hp?.max || sys.attributes?.hp?.value || 1,
            ac: sys.attributes?.ac?.value || 10,
            cr: sys.details?.cr || 0,
            desc: sys.details?.biography?.value || '',
            o: 'Imported',
            w: 'Foundry',
            _src: 'Imported',
            _key: 'foundry-' + (obj.name || 'npc')
          }
        };
      }
      return { kind: 'character', data: foundryActorToCharacter(obj) };
    }
    // Foundry pack { actors: [] }
    if (Array.isArray(obj.actors)) {
      return { kind: 'pack', data: obj.actors.map(a => parseRoll20OrFoundryImport(a)) };
    }
    // DSC character
    if (obj.name && (obj.class || obj.classes || obj.str != null)) {
      return { kind: 'character', data: obj };
    }
    // Roll20 character-ish
    if (obj.character || obj.attribs) {
      const attrs = {};
      (obj.attribs || obj.character?.attribs || []).forEach(a => {
        if (a.name) attrs[a.name] = a.current;
      });
      return {
        kind: 'character',
        data: {
          name: obj.name || obj.character?.name || 'Roll20 Import',
          hp: Number(attrs.hp) || Number(attrs['hit_points']) || 1,
          hpMax: Number(attrs.hp_max) || Number(attrs['hit_points_max']) || 1,
          ac: Number(attrs.ac) || Number(attrs.armor_class) || 10,
          str: Number(attrs.strength) || 10,
          dex: Number(attrs.dexterity) || 10,
          con: Number(attrs.constitution) || 10,
          int: Number(attrs.intelligence) || 10,
          wis: Number(attrs.wisdom) || 10,
          cha: Number(attrs.charisma) || 10,
          class: attrs.class || attrs.class_display || '',
          level: Number(attrs.level) || 1,
          race: attrs.race || '',
          _importedFrom: 'roll20'
        }
      };
    }
    // Roll20 table
    if (obj.entries && obj.name) {
      return { kind: 'table', data: obj };
    }
    return { kind: 'unknown', data: obj };
  }

  // ─── UI: Extensions tools panel ───────────────────────────────────────────
  function renderExtensionsTools(root, opts) {
    if (!root) return;
    const isPlayer = !!opts?.player;
    const st = loadExtState();
    const cal = st.calendar || { day: 1, month: 1, year: 1, moonIndex: 0 };

    root.innerHTML = `
      <div class="compendium-panel" id="ext-panel">
        <h3>Play Aids</h3>
        <p class="muted small">Conditions, rests, death saves, attunement, inspiration — applied when editing characters / combat.</p>
        <div class="form-row" style="flex-wrap:wrap;gap:0.4rem">
          <button type="button" class="btn secondary" id="ext-conditions-ref">Conditions reference</button>
          <button type="button" class="btn secondary" id="ext-backgrounds-ref">Backgrounds</button>
        </div>
        <div id="ext-ref-out" class="muted small" style="margin-top:0.5rem"></div>
      </div>

      ${!isPlayer ? `
      <div class="compendium-panel">
        <h3>Encounter Builder</h3>
        <div class="form-row triple">
          <div class="field"><label>Party size</label><input type="number" id="enc-party-size" min="1" value="${st.encPartySize || 4}" /></div>
          <div class="field"><label>Avg party level</label><input type="number" id="enc-party-lvl" min="1" max="20" value="${st.encPartyLvl || 5}" /></div>
          <div class="field"><label>Monster CR list (comma)</label><input type="text" id="enc-crs" placeholder="1,1,0.5,2" value="${st.encCrs || ''}" /></div>
        </div>
        <button type="button" class="btn primary" id="enc-calc">Calculate difficulty</button>
        <p class="muted small" id="enc-result" style="margin-top:0.5rem"></p>
      </div>

      <div class="compendium-panel">
        <h3>Loot / Hoard</h3>
        <div class="form-row">
          <div class="field"><label>Encounter CR</label><input type="number" id="loot-cr" min="0" step="0.125" value="5" /></div>
          <button type="button" class="btn primary" id="loot-gen">Generate loot</button>
        </div>
        <pre class="sample-pre" id="loot-out" style="margin-top:0.5rem;min-height:2rem"></pre>
      </div>

      <div class="compendium-panel">
        <h3>Campaign Calendar (DSC moons)</h3>
        <div class="form-row triple">
          <div class="field"><label>Day</label><input type="number" id="cal-day" min="1" value="${cal.day}" /></div>
          <div class="field"><label>Month</label><input type="number" id="cal-month" min="1" value="${cal.month}" /></div>
          <div class="field"><label>Year</label><input type="number" id="cal-year" min="1" value="${cal.year}" /></div>
        </div>
        <p class="muted small" id="cal-moons"></p>
        <button type="button" class="btn secondary" id="cal-advance">Advance 1 day</button>
        <button type="button" class="btn secondary" id="cal-save">Save calendar</button>
      </div>

      <div class="compendium-panel">
        <h3>Random Tables</h3>
        <select id="tbl-pick">${Object.keys(RANDOM_TABLES).map(k => `<option value="${k}">${k}</option>`).join('')}</select>
        <button type="button" class="btn primary" id="tbl-roll">Roll</button>
        <button type="button" class="btn secondary" id="tbl-export-r20">Export table (Roll20 JSON)</button>
        <p id="tbl-result" style="margin-top:0.5rem"></p>
      </div>

      <div class="compendium-panel">
        <h3>Timeline / Session beats</h3>
        <textarea id="timeline-entry" rows="2" placeholder="Session beat or milestone…"></textarea>
        <button type="button" class="btn primary" id="timeline-add">Add to timeline</button>
        <ul id="timeline-list" class="trait-list" style="margin-top:0.5rem"></ul>
      </div>

      <div class="compendium-panel">
        <h3>Region checklist</h3>
        <div id="region-list"></div>
        <button type="button" class="btn secondary" id="region-save">Save regions</button>
      </div>
      ` : ''}

      <div class="compendium-panel">
        <h3>VTT: Foundry &amp; Roll20 (import / export)</h3>
        <p class="muted small">Bidirectional JSON bridges. Foundry uses actor JSON; Roll20 uses handout Markdown + table JSON (and character attrib export when available).</p>
        <div class="form-row" style="flex-wrap:wrap;gap:0.4rem">
          <button type="button" class="btn primary" id="vtt-export-foundry-party">Export party → Foundry</button>
          <button type="button" class="btn primary" id="vtt-export-roll20-party">Export party → Roll20 handouts</button>
          ${!isPlayer ? `<button type="button" class="btn secondary" id="vtt-export-foundry-bestiary">Export visible bestiary → Foundry NPCs</button>` : ''}
          <button type="button" class="btn secondary" id="vtt-import-btn">Import Foundry / Roll20 JSON</button>
          <input type="file" id="vtt-import-file" accept=".json,application/json" hidden />
        </div>
        <p class="muted small" id="vtt-status">Ready.</p>
      </div>

      <div class="compendium-panel">
        <h3>Handout export</h3>
        <button type="button" class="btn secondary" id="handout-md">Download party handouts (.md)</button>
      </div>
    `;

    wireExtensionsTools(root, opts);
    if (!isPlayer) {
      updateCalendarLabel();
      renderTimeline();
      renderRegions();
    }
  }

  function updateCalendarLabel() {
    const st = loadExtState();
    const cal = st.calendar || { day: 1, month: 1, year: 1, moonIndex: 0 };
    const el = $('#cal-moons');
    if (!el) return;
    const phases = DSC_MOONS.map((m, i) => {
      const idx = (cal.moonIndex + i * 2) % MOON_PHASES.length;
      return `${m}: ${MOON_PHASES[idx]}`;
    });
    el.textContent = `Date ${cal.year}.${cal.month}.${cal.day} · ${phases.join(' · ')}`;
  }

  function renderTimeline() {
    const ul = $('#timeline-list');
    if (!ul) return;
    const items = loadExtState().timeline || [];
    ul.innerHTML = items.length
      ? items.map((t, i) => `<li><strong>${escape(t.at)}</strong> — ${escape(t.text)} <button type="button" data-i="${i}" class="btn danger btn-tiny tl-del">✕</button></li>`).join('')
      : '<li class="muted">No beats yet.</li>';
    ul.querySelectorAll('.tl-del').forEach(btn => {
      btn.addEventListener('click', () => {
        const st = loadExtState();
        const timeline = (st.timeline || []).slice();
        timeline.splice(Number(btn.dataset.i), 1);
        saveExtState({ timeline });
        renderTimeline();
      });
    });
  }

  function renderRegions() {
    const root = $('#region-list');
    if (!root) return;
    const worlds = ['Luminaris', 'Umbraria', 'Eternum', 'Solara', 'Aetheria', 'Harmonia', 'Celestia'];
    const checked = loadExtState().regions || {};
    root.innerHTML = worlds.map(w =>
      `<label class="checkbox-row"><input type="checkbox" class="region-cb" data-w="${w}" ${checked[w] ? 'checked' : ''}/> <span>${w} visited / open</span></label>`
    ).join('');
  }

  function escape(s) {
    return String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function getPartyCharacters() {
    // Try common app state shapes
    if (typeof global.getActiveCampaign === 'function') {
      const c = global.getActiveCampaign();
      if (c?.party) return c.party;
      if (c?.characters) return c.characters;
    }
    if (global.state?.campaign?.party) return global.state.campaign.party;
    if (global.state?.party) return global.state.party;
    try {
      const raw = localStorage.getItem('dsc_state') || localStorage.getItem('dsc_player_state');
      if (raw) {
        const st = JSON.parse(raw);
        const camp = (st.campaigns || []).find(x => x.id === st.activeCampaignId) || st.campaigns?.[0];
        return camp?.party || camp?.characters || [];
      }
    } catch (e) {}
    return [];
  }

  function getBestiaryArray() {
    return global.BESTIARY_MERGED || global.BESTIARY_DATA || global.BESTIARY || [];
  }

  function wireExtensionsTools(root, opts) {
    const isPlayer = !!opts?.player;

    $('#ext-conditions-ref')?.addEventListener('click', () => {
      const out = $('#ext-ref-out');
      if (out) out.innerHTML = CONDITIONS.map(c => `<div><strong>${escape(c.name)}</strong> — ${escape(c.text)}</div>`).join('');
    });
    $('#ext-backgrounds-ref')?.addEventListener('click', () => {
      const out = $('#ext-ref-out');
      if (out) out.innerHTML = BACKGROUNDS.map(b => `<div><strong>${escape(b.name)}</strong> — ${escape(Array.isArray(b.skills)?b.skills.join(', '):b.skills)} · ${escape(b.feature)}</div>`).join('');
    });

    if (!isPlayer) {
      $('#enc-calc')?.addEventListener('click', () => {
        const size = Number($('#enc-party-size')?.value) || 4;
        const lvl = Number($('#enc-party-lvl')?.value) || 5;
        const crs = ($('#enc-crs')?.value || '').split(/[,\s]+/).map(s => s.trim()).filter(Boolean);
        const base = crs.reduce((s, c) => s + xpForCr(c), 0);
        const mult = encounterMultiplier(crs.length);
        const adj = Math.floor(base * mult);
        const budget = (DAILY_XP_BUDGET[lvl] || 300) * size;
        const thresh = {
          easy: lvl * size * 25,
          medium: lvl * size * 50,
          hard: lvl * size * 75,
          deadly: lvl * size * 100
        };
        // simplified thresholds scaled
        const easy = 25 * lvl * size;
        const medium = 50 * lvl * size;
        const hard = 75 * lvl * size;
        const deadly = 100 * lvl * size;
        let diff = 'Trivial';
        if (adj >= deadly) diff = 'Deadly';
        else if (adj >= hard) diff = 'Hard';
        else if (adj >= medium) diff = 'Medium';
        else if (adj >= easy) diff = 'Easy';
        saveExtState({ encPartySize: size, encPartyLvl: lvl, encCrs: crs.join(',') });
        const el = $('#enc-result');
        if (el) el.innerHTML = `Base XP ${base} × ${mult} = <strong>${adj}</strong> adjusted XP → <strong>${diff}</strong>. Daily budget (~)${budget}. Thresholds E/M/H/D: ${easy}/${medium}/${hard}/${deadly}.`;
      });

      $('#loot-gen')?.addEventListener('click', () => {
        const cr = Number($('#loot-cr')?.value) || 0;
        const band = LOOT_BY_CR.find(b => cr <= b.max) || LOOT_BY_CR[LOOT_BY_CR.length - 1];
        const out = $('#loot-out');
        if (out) out.textContent = `CR ${cr}\nCoins: ${band.coins}\nItems: ${band.items}`;
      });

      $('#cal-advance')?.addEventListener('click', () => {
        const st = loadExtState();
        const cal = { ...(st.calendar || { day: 1, month: 1, year: 1, moonIndex: 0 }) };
        cal.day = Number($('#cal-day')?.value) || cal.day;
        cal.month = Number($('#cal-month')?.value) || cal.month;
        cal.year = Number($('#cal-year')?.value) || cal.year;
        cal.day += 1;
        if (cal.day > 30) { cal.day = 1; cal.month += 1; }
        if (cal.month > 12) { cal.month = 1; cal.year += 1; }
        cal.moonIndex = (cal.moonIndex + 1) % MOON_PHASES.length;
        if ($('#cal-day')) $('#cal-day').value = cal.day;
        if ($('#cal-month')) $('#cal-month').value = cal.month;
        if ($('#cal-year')) $('#cal-year').value = cal.year;
        saveExtState({ calendar: cal });
        updateCalendarLabel();
      });
      $('#cal-save')?.addEventListener('click', () => {
        const cal = {
          day: Number($('#cal-day')?.value) || 1,
          month: Number($('#cal-month')?.value) || 1,
          year: Number($('#cal-year')?.value) || 1,
          moonIndex: (loadExtState().calendar || {}).moonIndex || 0
        };
        saveExtState({ calendar: cal });
        updateCalendarLabel();
        toast('Calendar saved');
      });

      $('#tbl-roll')?.addEventListener('click', () => {
        const key = $('#tbl-pick')?.value;
        const rows = RANDOM_TABLES[key] || [];
        const pick = rows[Math.floor(Math.random() * rows.length)];
        const el = $('#tbl-result');
        if (el) el.textContent = pick || '—';
      });
      $('#tbl-export-r20')?.addEventListener('click', () => {
        const key = $('#tbl-pick')?.value;
        downloadJson('roll20-table-' + (key || 'table').replace(/\s+/g, '-') + '.json', roll20TableFromList(key, RANDOM_TABLES[key]));
      });

      $('#timeline-add')?.addEventListener('click', () => {
        const text = ($('#timeline-entry')?.value || '').trim();
        if (!text) return;
        const st = loadExtState();
        const timeline = (st.timeline || []).concat([{ at: new Date().toISOString().slice(0, 10), text }]);
        saveExtState({ timeline });
        if ($('#timeline-entry')) $('#timeline-entry').value = '';
        renderTimeline();
      });

      $('#region-save')?.addEventListener('click', () => {
        const regions = {};
        $$('.region-cb').forEach(cb => { regions[cb.dataset.w] = cb.checked; });
        saveExtState({ regions });
        toast('Regions saved');
      });

      $('#vtt-export-foundry-bestiary')?.addEventListener('click', () => {
        const list = getBestiaryArray().slice(0, 200);
        const pack = {
          name: 'DSC Bestiary Export',
          actors: list.map(creatureToFoundryNpc)
        };
        downloadJson('foundry-bestiary-dsc.json', pack);
        toast('Foundry bestiary pack downloaded');
      });
    }

    $('#vtt-export-foundry-party')?.addEventListener('click', () => {
      const party = getPartyCharacters();
      const pack = {
        name: 'DSC Party Export',
        actors: party.map(characterToFoundryActor)
      };
      downloadJson('foundry-party-dsc.json', pack);
      const stEl = $('#vtt-status');
      if (stEl) stEl.textContent = `Exported ${party.length} actors for Foundry.`;
      toast('Foundry party exported');
    });

    $('#vtt-export-roll20-party')?.addEventListener('click', () => {
      const party = getPartyCharacters();
      const md = party.map(characterToRoll20Handout).join('\n\n---\n\n');
      downloadText('roll20-party-handouts.md', md, 'text/markdown');
      const tables = {
        name: 'DSC Random Tables Pack',
        tables: Object.keys(RANDOM_TABLES).map(k => roll20TableFromList(k, RANDOM_TABLES[k]))
      };
      downloadJson('roll20-tables-dsc.json', tables);
      toast('Roll20 handouts + tables exported');
    });

    $('#vtt-import-btn')?.addEventListener('click', () => $('#vtt-import-file')?.click());
    $('#vtt-import-file')?.addEventListener('change', async (ev) => {
      const file = ev.target.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const obj = JSON.parse(text);
        const parsed = parseRoll20OrFoundryImport(obj);
        const stEl = $('#vtt-status');
        if (parsed.kind === 'character') {
          // Store pending import for party UI
          saveExtState({ pendingCharacterImport: parsed.data });
          if (stEl) stEl.textContent = `Parsed character "${parsed.data.name}". Open Party → Add / Import pending VTT character (saved to pending import).`;
          // Try to push into party if helper exists
          if (typeof global.importCharacterToParty === 'function') {
            global.importCharacterToParty(parsed.data);
          }
          toast('Character imported to pending state');
        } else if (parsed.kind === 'creature') {
          if (typeof global.importCompendiumPack === 'function') {
            global.importCompendiumPack({ creatures: [parsed.data], meta: { source: 'Foundry/Roll20' } });
          } else {
            saveExtState({ pendingCreatureImport: parsed.data });
          }
          toast('Creature import queued');
        } else if (parsed.kind === 'pack') {
          const chars = [];
          const creatures = [];
          (parsed.data || []).forEach(p => {
            if (p.kind === 'character') chars.push(p.data);
            if (p.kind === 'creature') creatures.push(p.data);
          });
          if (creatures.length && typeof global.importCompendiumPack === 'function') {
            global.importCompendiumPack({ creatures, meta: { source: 'Foundry pack' } });
          }
          if (chars.length) saveExtState({ pendingCharacterImport: chars[0], pendingCharacterPack: chars });
          if (stEl) stEl.textContent = `Pack: ${chars.length} characters, ${creatures.length} creatures.`;
          toast('Pack processed');
        } else if (parsed.kind === 'table') {
          saveExtState({ customTable: parsed.data });
          toast('Roll20 table stored');
        } else {
          if (stEl) stEl.textContent = 'Unrecognized JSON shape.';
          toast('Unrecognized import');
        }
      } catch (err) {
        console.warn(err);
        toast('Import failed');
        const stEl = $('#vtt-status');
        if (stEl) stEl.textContent = 'Error: ' + (err.message || err);
      }
      ev.target.value = '';
    });

    $('#handout-md')?.addEventListener('click', () => {
      const party = getPartyCharacters();
      const md = party.map(characterToRoll20Handout).join('\n\n---\n\n');
      downloadText('dsc-party-handouts.md', md, 'text/markdown');
    });
  }

  // ─── Character sheet extras HTML ──────────────────────────────────────────
  function characterExtrasHtml(ch) {
    const ds = ch.deathSaves || { successes: 0, failures: 0 };
    const conds = ch.conditions || [];
    const att = ch.attunement || [];
    const insp = !!ch.inspiration;
    const bg = ch.background || '';
    const prepMode = ch.spellPrepMode || 'known';
    const preparedSet = new Set(
      String(ch.preparedSpells || '')
        .split(/[\n,;]+/)
        .map(s => s.trim().toLowerCase())
        .filter(Boolean)
    );
    // Known spells for prep checkboxes
    const knownIds = Array.isArray(ch.spellIds) ? ch.spellIds.slice() : [];
    const knownNames = []
      .concat(String(ch.cantrips || '').split(/[\n,;]+/))
      .concat(String(ch.spells || '').split(/[\n,;]+/))
      .map(s => s.trim().replace(/\s*\(.*?\)\s*$/, ''))
      .filter(Boolean);
    const spellLib = (typeof global !== 'undefined' && global.SPELLS) ? global.SPELLS
      : (typeof window !== 'undefined' && window.SPELLS) ? window.SPELLS : [];
    const knownSpells = [];
    const seen = new Set();
    knownIds.forEach(id => {
      const sp = spellLib.find(s => s.id === id || (s.name && s.name.toLowerCase() === String(id).toLowerCase()));
      if (sp && !seen.has(sp.name.toLowerCase())) {
        seen.add(sp.name.toLowerCase());
        knownSpells.push(sp);
      }
    });
    knownNames.forEach(n => {
      const key = n.toLowerCase();
      if (seen.has(key)) return;
      const sp = spellLib.find(s => s.name && s.name.toLowerCase() === key);
      if (sp) { seen.add(key); knownSpells.push(sp); }
      else { seen.add(key); knownSpells.push({ id: key, name: n, level: 1 }); }
    });
    // Only leveled spells for preparation (cantrips always available)
    const prepCandidates = knownSpells.filter(s => (s.level || 0) > 0);
    const prepHtml = prepCandidates.length
      ? prepCandidates.map(s => {
          const checked = preparedSet.has(s.name.toLowerCase()) || preparedSet.has(String(s.id).toLowerCase());
          return `<label class="checkbox-row"><input type="checkbox" class="m-prep-spell" value="${escape(s.name)}" ${checked ? 'checked' : ''} ${prepMode === 'known' ? 'disabled' : ''}/> <span>${escape(s.name)} <span class="muted small">(L${s.level})</span></span></label>`;
        }).join('')
      : '<p class="muted small">Add known spells first (Spellcasting section), then select which are prepared.</p>';

    // Attunement candidates from inventory
    const inv = Array.isArray(ch.inventory) ? ch.inventory : (typeof window !== 'undefined' && window.__draftInventory) ? window.__draftInventory : [];
    const attuneCandidates = inv.filter(i => {
      const cat = String(i.category || '').toLowerCase();
      const name = String(i.name || '').toLowerCase();
      return i.attunement || /magic|rare|legendary|very rare|uncommon|wand|ring|rod|staff|amulet|cloak|boots|gloves/.test(name + ' ' + cat) || cat === 'wondrous' || cat === 'magic';
    });
    // Also allow any inventory item
    const allInv = inv.length ? inv : [];
    const attHtml = allInv.length
      ? allInv.map((i, idx) => {
          const nm = i.name || ('Item ' + (idx + 1));
          const checked = att.some(a => String(a).toLowerCase() === nm.toLowerCase());
          return `<label class="checkbox-row"><input type="checkbox" class="m-attune-item" value="${escape(nm)}" ${checked ? 'checked' : ''}/> <span>${escape(nm)}${i.equipped ? ' <span class="muted small">(equipped)</span>' : ''}</span></label>`;
        }).join('')
      : '<p class="muted small">Add equipment to inventory to choose attunement (max 3).</p>';

    return `
      <div class="compendium-panel" style="margin-top:0.75rem">
        <h3 class="section-label">Combat status</h3>
        <div class="form-row triple">
          <div class="field"><label>Inspiration</label>
            <label class="checkbox-row"><input type="checkbox" id="m-inspiration" ${insp ? 'checked' : ''}/> <span>Has inspiration</span></label>
          </div>
          <div class="field"><label>Death saves (successes)</label>
            <input type="number" id="m-ds-ok" min="0" max="3" value="${ds.successes || 0}" />
          </div>
          <div class="field"><label>Death saves (failures)</label>
            <input type="number" id="m-ds-fail" min="0" max="3" value="${ds.failures || 0}" />
          </div>
        </div>
        <div class="field"><label>Conditions</label>
          <div class="form-row" style="flex-wrap:wrap;gap:0.35rem" id="m-conditions">
            ${CONDITIONS.map(c => `
              <label class="checkbox-row"><input type="checkbox" class="m-cond" value="${c.id}" ${conds.includes(c.id) || conds.includes(c.name) ? 'checked' : ''}/> <span>${c.name}</span></label>
            `).join('')}
          </div>
        </div>
        <div class="form-row">
          <button type="button" class="btn secondary" id="m-short-rest">Short Rest</button>
          <button type="button" class="btn secondary" id="m-long-rest">Long Rest</button>
        </div>
        <div class="field"><label>Spell preparation mode</label>
          <select id="m-spell-prep-mode">
            <option value="known" ${prepMode === 'known' ? 'selected' : ''}>Known (always available)</option>
            <option value="prepared" ${prepMode === 'prepared' ? 'selected' : ''}>Prepared (check spells below)</option>
          </select>
        </div>
        <div class="field" id="m-prep-spells-wrap" style="${prepMode === 'prepared' ? '' : 'opacity:0.55'}">
          <label>Prepared spells <span class="muted small">(from known list)</span></label>
          <div class="form-row" style="flex-wrap:wrap;gap:0.35rem;max-height:12rem;overflow:auto;border:1px solid rgba(255,255,255,0.08);padding:0.4rem;border-radius:6px">
            ${prepHtml}
          </div>
          <textarea id="m-prepared-spells" rows="2" style="display:none">${escape(ch.preparedSpells || '')}</textarea>
        </div>
        <div class="field"><label>Attunement <span class="muted small">(max 3 — from inventory)</span></label>
          <div class="form-row" style="flex-wrap:wrap;gap:0.35rem;max-height:10rem;overflow:auto;border:1px solid rgba(255,255,255,0.08);padding:0.4rem;border-radius:6px" id="m-attune-list">
            ${attHtml}
          </div>
          <input type="hidden" id="m-attune-1" value="${escape(att[0] || '')}" />
          <input type="hidden" id="m-attune-2" value="${escape(att[1] || '')}" />
          <input type="hidden" id="m-attune-3" value="${escape(att[2] || '')}" />
        </div>
      </div>
    `;
  }

  function collectCharacterExtras() {
    const conds = $$('.m-cond:checked').map(c => c.value);
    const attChecked = $$('.m-attune-item:checked').map(c => c.value).slice(0, 3);
    // sync hidden fields
    if ($('#m-attune-1')) $('#m-attune-1').value = attChecked[0] || '';
    if ($('#m-attune-2')) $('#m-attune-2').value = attChecked[1] || '';
    if ($('#m-attune-3')) $('#m-attune-3').value = attChecked[2] || '';
    const prepMode = $('#m-spell-prep-mode')?.value || 'known';
    let prepared = '';
    if (prepMode === 'prepared') {
      prepared = $$('.m-prep-spell:checked').map(c => c.value).join(', ');
    } else {
      prepared = '';
    }
    if ($('#m-prepared-spells')) $('#m-prepared-spells').value = prepared;
    const bg = $('#m-background-select')?.value || $('#m-background')?.value || '';
    if ($('#m-background')) $('#m-background').value = bg;
    return {
      inspiration: !!$('#m-inspiration')?.checked,
      deathSaves: {
        successes: Number($('#m-ds-ok')?.value) || 0,
        failures: Number($('#m-ds-fail')?.value) || 0
      },
      conditions: conds,
      background: bg,
      attunement: attChecked,
      spellPrepMode: prepMode,
      preparedSpells: prepared
    };
  }

  function wireCharacterExtras(onPatch) {
    $('#m-short-rest')?.addEventListener('click', () => {
      if (typeof onPatch === 'function') onPatch({ rest: 'short' });
      toast('Short rest: pact slots recovered (apply on save)');
    });
    $('#m-long-rest')?.addEventListener('click', () => {
      if (typeof onPatch === 'function') onPatch({ rest: 'long' });
      if ($('#m-ds-ok')) $('#m-ds-ok').value = 0;
      if ($('#m-ds-fail')) $('#m-ds-fail').value = 0;
      toast('Long rest: HP & slots recover on save');
    });
    // Background is only on the identity row (select#m-background) — no duplicate control

    // Prep mode toggle
    const prepMode = $('#m-spell-prep-mode');
    function syncPrepMode() {
      const prepared = prepMode?.value === 'prepared';
      const wrap = $('#m-prep-spells-wrap');
      if (wrap) wrap.style.opacity = prepared ? '1' : '0.55';
      $$('.m-prep-spell').forEach(cb => { cb.disabled = !prepared; });
    }
    prepMode?.addEventListener('change', syncPrepMode);
    syncPrepMode();

    // Attunement max 3
    const attRoot = $('#m-attune-list');
    attRoot?.addEventListener('change', (e) => {
      if (!e.target.classList.contains('m-attune-item')) return;
      const checked = $$('.m-attune-item:checked');
      if (checked.length > 3) {
        e.target.checked = false;
        toast('Maximum 3 attuned items');
      }
    });
  }

  // Public API
  global.DSCExtensions = {
    CONDITIONS,
    BACKGROUNDS,
    RANDOM_TABLES,
    renderExtensionsTools,
    characterExtrasHtml,
    collectCharacterExtras,
    wireCharacterExtras,
    applyShortRest,
    applyLongRest,
    characterToFoundryActor,
    creatureToFoundryNpc,
    foundryActorToCharacter,
    characterToRoll20Handout,
    parseRoll20OrFoundryImport,
    xpForCr,
    loadExtState,
    saveExtState
  };

  // Auto-mount into tools if placeholder exists
  function tryMount() {
    const host = document.getElementById('extensions-tools') || document.getElementById('compendium-tools');
    const player = document.body?.dataset?.app === 'player' || /player/i.test(document.title || '');
    if (document.getElementById('extensions-tools')) {
      renderExtensionsTools(document.getElementById('extensions-tools'), { player });
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(tryMount, 100));
  else setTimeout(tryMount, 100);

})(typeof window !== 'undefined' ? window : globalThis);
