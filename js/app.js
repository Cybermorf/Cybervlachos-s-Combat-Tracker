/**
 * Dark Sun Chronicles — DM Companion
 * Local-first campaign tracker + dice roller for Eldoria living campaigns.
 * Includes random generators for Factions, Active Forces, and Dynamic Influence progression.
 * Data persists in localStorage. Export/import as JSON.
 */

(() => {
  'use strict';

  const STORAGE_KEY = 'cybervlachos_combat_v1';

  const MAP_IDB_NAME = 'dsc_combat_map_v1';
  const MAP_IDB_STORE = 'maps';
  const ROSTER_BACKUP_KEY = 'cybervlachos_combat_roster_v1';

  function openMapDb() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) {
        reject(new Error('IndexedDB unavailable'));
        return;
      }
      const req = indexedDB.open(MAP_IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(MAP_IDB_STORE)) {
          db.createObjectStore(MAP_IDB_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('Map IDB open failed'));
    });
  }

  async function idbSetMapImage(workspaceId, imageDataUrl) {
    if (!workspaceId) return;
    try {
      const db = await openMapDb();
      await new Promise((resolve, reject) => {
        const tx = db.transaction(MAP_IDB_STORE, 'readwrite');
        tx.objectStore(MAP_IDB_STORE).put(imageDataUrl || null, 'map:' + workspaceId);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (e) {
      console.warn('Map IDB save failed', e);
    }
  }

  async function idbGetMapImage(workspaceId) {
    if (!workspaceId) return null;
    try {
      const db = await openMapDb();
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(MAP_IDB_STORE, 'readonly');
        const req = tx.objectStore(MAP_IDB_STORE).get('map:' + workspaceId);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      console.warn('Map IDB load failed', e);
      return null;
    }
  }

  async function idbSetMapVideo(workspaceId, blob) {
    if (!workspaceId || !blob) return;
    try {
      const db = await openMapDb();
      await new Promise((resolve, reject) => {
        const tx = db.transaction(MAP_IDB_STORE, 'readwrite');
        tx.objectStore(MAP_IDB_STORE).put(blob, 'mapvideo:' + workspaceId);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (e) {
      console.warn('Map video IDB save failed', e);
    }
  }

  async function idbGetMapVideo(workspaceId) {
    if (!workspaceId) return null;
    try {
      const db = await openMapDb();
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(MAP_IDB_STORE, 'readonly');
        const req = tx.objectStore(MAP_IDB_STORE).get('mapvideo:' + workspaceId);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      return null;
    }
  }

  function stripHeavyFields(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) {
      obj.forEach(stripHeavyFields);
      return obj;
    }
    const heavyKeys = ['imageDataUrl', 'videoObjectUrl', 'avatar', 'portrait', 'image', 'tokenImage', 'raw'];
    Object.keys(obj).forEach(k => {
      const v = obj[k];
      if (heavyKeys.includes(k) && typeof v === 'string' && v.length > 500) {
        if (k === 'imageDataUrl') obj.hasImageInIdb = true;
        if (k === 'videoObjectUrl' || (typeof v === 'string' && v.startsWith('blob:'))) {
          obj.hasVideoInIdb = true;
        }
        obj[k] = null;
      } else if (typeof v === 'string' && v.startsWith('data:') && v.length > 2000) {
        obj[k] = null;
      } else if (v && typeof v === 'object') {
        stripHeavyFields(v);
      }
    });
    return obj;
  }

  function cloneStateForLocalStorage() {
    const campaigns = (state.campaigns || []).map(c => {
      let copy;
      try {
        copy = JSON.parse(JSON.stringify(c));
      } catch (e) {
        // Fallback: keep essential combat only
        copy = {
          id: c.id,
          name: c.name,
          party: c.party || [],
          villains: c.villains || [],
          combat: c.combat || { combatants: [], round: 1, turnIndex: 0, selectedIndex: 0 },
          combatMap: c.combatMap ? {
            gridSize: c.combatMap.gridSize,
            gridOffsetX: c.combatMap.gridOffsetX,
            gridOffsetY: c.combatMap.gridOffsetY,
            tokens: c.combatMap.tokens,
            walls: c.combatMap.walls,
            mediaType: c.combatMap.mediaType,
            hasImageInIdb: true,
            hasVideoInIdb: !!c.combatMap.mediaType && c.combatMap.mediaType !== 'image',
            imageDataUrl: null,
            videoObjectUrl: null
          } : null
        };
      }
      if (copy.combatMap) {
        if (copy.combatMap.imageDataUrl) {
          copy.combatMap.hasImageInIdb = true;
          copy.combatMap.imageDataUrl = null;
        }
        if (copy.combatMap.videoObjectUrl) {
          copy.combatMap.hasVideoInIdb = true;
          copy.combatMap.videoObjectUrl = null;
        }
      }
      stripHeavyFields(copy);
      return copy;
    });
    return {
      campaigns,
      activeCampaignId: state.activeCampaignId,
      diceHistory: (state.diceHistory || []).slice(0, 50)
    };
  }

  function backupRosterLite() {
    try {
      const c = getActive();
      if (!c) return;
      const combat = c.combat || {};
      const payload = {
        activeCampaignId: state.activeCampaignId,
        party: c.party || [],
        villains: c.villains || [],
        combatants: (combat.combatants || []).map(cb => ({
          id: cb.id,
          name: cb.name,
          side: cb.side,
          hp: cb.hp,
          hpMax: cb.hpMax,
          ac: cb.ac,
          initiative: cb.initiative,
          hideHp: cb.hideHp,
          class: cb.class,
          level: cb.level
        })),
        combatMapMeta: c.combatMap ? {
          gridSize: c.combatMap.gridSize,
          gridOffsetX: c.combatMap.gridOffsetX,
          gridOffsetY: c.combatMap.gridOffsetY,
          tokens: c.combatMap.tokens,
          walls: c.combatMap.walls,
          hasImageInIdb: true
        } : null,
        t: Date.now()
      };
      localStorage.setItem(ROSTER_BACKUP_KEY, JSON.stringify(payload));
    } catch (e) {
      console.warn('roster backup failed', e);
    }
  }


  const WORLDS = ['Luminaris', 'Umbraria', 'Eternum', 'Solara', 'Aetheria', 'Harmonia', 'Celestia'];

    function getBestiaryList() {
      if (window.BESTIARY_MERGED && window.BESTIARY_MERGED.length) return window.BESTIARY_MERGED;
      return (typeof window !== 'undefined' && window.BESTIARY_DATA) ? window.BESTIARY_DATA : [];
    }
    // legacy alias used in closures — always call getBestiaryList()
    let BESTIARY = getBestiaryList();
    function refreshBestiaryRef() { BESTIARY = getBestiaryList(); }
  // short alias fields kept for older saves: n,w,o,cr,ac,hp + desc/eco/people/run/seeds
  // 115 creatures with descriptions
  // 115 principal creatures from Bestiary of the Seven Worlds

  // ─── Generators (setting-flavored) ───────────────────────────────────────
  const GENERATORS = {
    factionTypes: [
      'Government', 'Cult', 'Merchant House', 'Temple', 'Guild',
      'Military Order', 'Secret Society', 'Trade Consortium', 'Noble House',
      'Pilgrim Order', 'Arcane Cabal', 'Criminal Syndicate'
    ],
    factionPrefixes: [
      'Solar', 'Umbral', 'Aether', 'Celestial', 'Harmonic', 'Eternal', 'Radiant',
      'Ashen', 'Hollow', 'Gilded', 'Silent', 'Crimson', 'Ivory', 'Obsidian',
      'Verdant', 'Storm', 'Twin', 'Seventh', 'Bound', 'Unseen'
    ],
    factionNouns: [
      'Concord', 'Court', 'Circle', 'Syndicate', 'Legion', 'Covenant', 'Spire',
      'Assembly', 'Order', 'Conclave', 'Cabal', 'Throne', 'Gate', 'Fleet',
      'Archive', 'Chorus', 'Blade', 'Chain', 'Veil', 'Forge', 'Market', 'Host'
    ],
    forceTypes: ['Antagonist', 'Faction', 'Cult', 'Government', 'Disaster', 'Supernatural', 'Other'],
    forceNameTemplates: [
      'The {adj} {noun}',
      '{adj} {noun}',
      'The {noun} of {place}',
      '{name}\'s {noun}',
      'The {adj} {place} {noun}'
    ],
    forceAdjs: [
      'Hollow', 'Ashen', 'Silent', 'Burning', 'Forgotten', 'Radiant', 'Twisted',
      'Eternal', 'Shattered', 'Gilded', 'Umbral', 'Primordial', 'Starved',
      'Bound', 'Unraveling', 'Celestial', 'Corrupt', 'Wandering', 'Hungering'
    ],
    forceNouns: [
      'Sovereign', 'Plague', 'Court', 'Host', 'Tide', 'Engine', 'Prophet',
      'Shadow', 'Flame', 'Archive', 'Gate', 'Choir', 'Legion', 'Bargain',
      'Storm', 'Crown', 'Hunger', 'Mirror', 'Veil', 'Spire', 'Pact', 'Woe'
    ],
    forcePlaces: [
      'Luminaris', 'Umbraria', 'the Gateways', 'the Outer Dark', 'Solara',
      'the Aetherian Routes', 'Celestia', 'the Broken Clock', 'the Seven Suns',
      'Harmonia', 'the Deep Archives', 'the Ashen Sea'
    ],
    forceNames: [
      'Vaelith', 'Korr', 'Saphira', 'Thane', 'Mirael', 'Orrin', 'Leth',
      'Nyxara', 'Druin', 'Selene', 'Vorath', 'Elara', 'Kael', 'Zir'
    ],
    goals: [
      'Seize control of a major Celestial Gateway',
      'Corrupt a key faction from within',
      'Redirect trade routes to starve a rival world',
      'Awaken a dormant Primordial power',
      'Eliminate the party before they grow too strong',
      'Install a puppet ruler on a target world',
      'Harvest corruption from pilgrim routes',
      'Break a long-standing treaty between two worlds',
      'Recover an artifact sealed in Eternum',
      'Spread a supernatural plague or blight',
      'Force a celestial alignment for a ritual',
      'Undermine the reputation of the party\'s patrons',
      'Monopolize a critical resource (spice, crystal, memory-ink)',
      'Convert a major temple to a darker doctrine',
      'Open a permanent rift between two worlds',
      'Collect blood-debts from every major house',
      'Erase a prophecy that threatens its plans',
      'Bind a powerful spirit or entity as a permanent ally'
    ],
    resources: [
      'Loyal agents embedded in three courts',
      'A private fleet of shadow-vessels',
      'Vast merchant wealth and blackmail ledgers',
      'Access to a minor Celestial Gateway',
      'A cadre of corrupted priests',
      'Ancient knowledge from pre-Sundering archives',
      'Control of a vital trade choke-point',
      'A network of informants across two worlds',
      'A bound supernatural entity of moderate power',
      'Political leverage over a planetary government',
      'A growing cult of true believers',
      'Experimental rituals and forbidden lore',
      'A hidden fortress or sanctuary',
      'Stolen identities and forged documents',
      'Weather or environmental manipulation on a local scale'
    ],
    statusSnippets: [
      'Recently moved agents into position near the party\'s last known location.',
      'Suffered a setback and is regrouping; may seek temporary allies.',
      'Successfully expanded influence into a new world.',
      'Is watching the party with increased interest after recent events.',
      'Has begun a long-term ritual that will complete in 1d4 sessions if uninterrupted.',
      'Lost a key lieutenant; recruiting replacements.',
      'Offered a dark bargain to a secondary NPC the party knows.',
      'Diverted a trade caravan; shortages will be felt soon.',
      'Publicly denounced the party (or their patrons) on one world.',
      'Quietly secured a new source of power or funding.',
      'Is preparing a direct strike against a location the party cares about.',
      'Has gone silent — either in hiding or preparing something larger.'
    ],
    factionNotes: [
      'Values loyalty above all; remembers both favors and insults for years.',
      'Publicly neutral but privately advancing a long game.',
      'Currently locked in quiet conflict with another faction.',
      'Eager for capable outsiders who can solve problems deniably.',
      'Suspicious of anyone who travels freely between worlds.',
      'Holds a secret that could destabilize a planetary government.',
      'Recently suffered a leadership change; internal power struggle ongoing.',
      'Controls a key resource or route the party may need later.',
      'Has both a public face and a deeply hidden agenda.',
      'Open to alliance if the price (and the risk) is right.'
    ],
    complications: [
      'A rival force claims credit for the party\'s last success.',
      'A trusted contact has been compromised or replaced.',
      'A celestial alignment closes a major route for 1d3 sessions.',
      'A local power demands tribute or service for continued safe passage.',
      'Evidence of the party\'s actions reaches an unexpected faction.',
      'A prophecy or omen begins circulating that names the party.',
      'Supply lines the party relies on are disrupted by distant conflict.',
      'An old debt or favor is called in at the worst possible moment.',
      'A disaster (plague, storm, riot) erupts in a city the party just left.',
      'Two factions the party deals with declare open hostility toward each other.'
    ],
    // Dynamic Influence Engine tables
    publicFaces: [
      'A respected healing ministry and charity',
      'The only order capable of keeping the trade roads safe',
      'A scholarly archive preserving pre-Sundering knowledge',
      'A reform movement promising justice for the common folk',
      'A merchant consortium that stabilizes prices across worlds',
      'A temple devoted to balance and celestial harmony',
      'A private security company hired by nervous cities',
      'An obscure pilgrim order few take seriously',
      'A legitimate planetary ministry of transit and gateways',
      'A celebrated artistic collective with political patrons'
    ],
    assets: [
      'Loyal agents embedded in three courts',
      'Blackmail ledgers on mid-tier officials',
      'A minor Celestial Gateway under quiet control',
      'A cadre of corrupted or devoted priests',
      'Vast merchant wealth and shell companies',
      'A bound supernatural entity of moderate power',
      'Control of a vital trade choke-point',
      'Ancient knowledge from sealed archives',
      'A network of informants across two worlds',
      'Political leverage over a planetary office',
      'A hidden fortress or sanctuary',
      'Stolen identities and forged documents',
      'Experimental rituals and forbidden lore',
      'Weather or environmental manipulation on a local scale',
      'A private fleet of shadow-vessels'
    ],
    vulnerabilities: [
      'Depends on a single irreplaceable specialist',
      'Public face would collapse if true nature were exposed',
      'Rival force holds compromising evidence',
      'Supply line runs through a contested Gateway',
      'Internal schism between hardliners and pragmatists',
      'Key asset is a person the party could reach',
      'Ritual or plan requires a specific celestial window',
      'Overextended across too many worlds',
      'Recent failure damaged legitimacy',
      'A former member knows dangerous secrets'
    ],
    politicalActions: [
      'Secures a favorable treaty or edict on one world',
      'Redirects trade to starve a rival or reward allies',
      'Discredits a rival through public accusation',
      'Places a sympathetic official in a useful post',
      'Buys silence or loyalty from a mid-tier institution',
      'Announces a legitimate-seeming initiative that advances its goal',
      'Forms a temporary alliance of convenience with another force'
    ],
    corruptiveActions: [
      'Recruits a spy inside an institution the party trusts',
      'Offers a tempting bargain to a secondary NPC',
      'Infiltrates a temple or guild under false credentials',
      'Normalizes a harmful practice through soft pressure',
      'Blackmails a mid-level official into cooperation',
      'Spreads a doctrine or rumor that weakens resistance',
      'Compromises a contact the party has relied on'
    ],
    disruptiveActions: [
      'Blockades or disrupts a route the party uses',
      'Raids a resource depot or caravan',
      'Provokes unrest in a city the party cares about',
      'Releases a localized hazard or blight',
      'Assassinates or removes a supporting NPC',
      'Stages a military or paramilitary demonstration',
      'Sabotages a Gateway or vessel the party might need'
    ],
    clockStageLabels: [
      'Dormant',
      'Signs & rumors',
      'Local consequences',
      'Gains leverage',
      'Institutions react',
      'Goal imminent',
      'Goal achieved — campaign transforms'
    ],
    // NPC generator
    npcRoles: [
      'Gate warden', 'Merchant factor', 'Cult acolyte', 'City guard captain',
      'Pilgrim guide', 'Archive scribe', 'Shadow broker', 'Temple priest',
      'Caravan master', 'Dock smuggler', 'Court attendant', 'Wandering seer',
      'Guild enforcer', 'Refugee leader', 'Vessel navigator', 'Debt collector',
      'Shard-touched hermit', 'Planetary magistrate', 'Spy for a rival force',
      'Healer with a secret'
    ],
    npcNameParts: {
      first: ['Vael', 'Korr', 'Saph', 'Thane', 'Mir', 'Orrin', 'Leth', 'Nyx', 'Druin', 'Sel', 'Vor', 'Ela', 'Kael', 'Zir', 'Ash', 'Ren', 'Tova', 'Jor', 'Ilya', 'Brek'],
      second: ['ith', 'ara', 'en', 'is', 'ael', 'or', 'un', 'ara', 'eth', 'ene', 'ath', 'ra', 'os', 'an', 'e', 'na', 'ik', 'el', 'as', 'or'],
      titles: ['the Pale', 'of the Gate', 'Twice-Marked', 'the Silent', 'Sunscarred', 'of Seven Roads', 'the Bound', 'Ashwalker', 'the Ledger-Keeper', 'Star-Eyed']
    },
    npcTraits: [
      'Speaks in proverbs from another world',
      'Never removes a distinctive glove or veil',
      'Collects debts in favors, not coin',
      'Afraid of open Gateways',
      'Quietly devout to a forgotten power',
      'Knows the party by reputation already',
      'Owes a blood-debt to a major faction',
      'Hums a Harmonian work-song when nervous',
      'Carries a sealed letter they refuse to open',
      'Has one glass eye that sometimes tracks movement on its own'
    ],
    npcSecrets: [
      'Is an agent of an Active Force the party has not met',
      'Carries a minor Shard fragment without knowing it',
      'Falsified travel papers for a dangerous passenger',
      'Witnessed a celestial alignment ritual and survived',
      'Is blackmailing a mid-tier official on another world',
      'Plans to abandon their post at the next Gateway opening',
      'Once belonged to a cult they now hunt',
      'Has a sibling among the party\'s allies or enemies'
    ]
  };

  function generateNpcName() {
    const a = pick(GENERATORS.npcNameParts.first);
    const b = pick(GENERATORS.npcNameParts.second);
    const useTitle = Math.random() < 0.35;
    const name = a + b;
    return useTitle ? `${name} ${pick(GENERATORS.npcNameParts.titles)}` : name;
  }

  function scoresForCr(cr) {
    // Rough 5e-ish arrays by CR band
    const bands = {
      0:  [10, 10, 10, 10, 10, 10],
      1:  [13, 12, 12, 10, 11, 10],
      2:  [14, 13, 13, 10, 12, 10],
      3:  [15, 14, 14, 11, 12, 11],
      5:  [16, 14, 15, 12, 13, 12],
      8:  [18, 15, 16, 12, 14, 13],
      11: [19, 16, 17, 14, 15, 14]
    };
    const keys = Object.keys(bands).map(Number).sort((a, b) => a - b);
    let chosen = bands[0];
    for (const k of keys) { if (cr >= k) chosen = bands[k]; }
    // Shuffle assignment to abilities for variety
    const shuffled = [...chosen].sort(() => Math.random() - 0.5);
    return { str: shuffled[0], dex: shuffled[1], con: shuffled[2], int: shuffled[3], wis: shuffled[4], cha: shuffled[5] };
  }

  function generateNpc(opts = {}) {
    const crOptions = [0, 0.25, 0.5, 1, 2, 3, 5, 8];
    const cr = opts.cr != null ? opts.cr : pick(crOptions);
    const role = opts.role || pick(GENERATORS.npcRoles);
    const world = opts.world || pick(WORLDS);
    const scores = scoresForCr(Number(cr) || 0);
    const dexMod = abilityMod(scores.dex);
    const conMod = abilityMod(scores.con);
    const strMod = abilityMod(scores.str);
    const wisMod = abilityMod(scores.wis);
    const chaMod = abilityMod(scores.cha);

    let hpMax, ac, attackBonus, damage;
    const crn = Number(cr) || 0;
    if (crn <= 0.5) { hpMax = 8 + Math.floor(Math.random() * 12) + conMod; ac = 11 + Math.max(0, dexMod); attackBonus = 3 + Math.max(strMod, dexMod); damage = '1d6+' + Math.max(0, strMod); }
    else if (crn <= 2) { hpMax = 22 + Math.floor(Math.random() * 18) + conMod * 2; ac = 13 + Math.max(0, Math.min(2, dexMod)); attackBonus = 4 + Math.max(strMod, dexMod); damage = '1d8+' + Math.max(0, strMod); }
    else if (crn <= 5) { hpMax = 45 + Math.floor(Math.random() * 30) + conMod * 3; ac = 14 + Math.max(0, Math.min(2, dexMod)); attackBonus = 5 + Math.max(strMod, dexMod); damage = '2d6+' + Math.max(0, strMod); }
    else { hpMax = 80 + Math.floor(Math.random() * 40) + conMod * 4; ac = 15 + Math.max(0, Math.min(3, dexMod)); attackBonus = 7 + Math.max(strMod, dexMod); damage = '2d8+' + Math.max(0, strMod); }

    const weapons = ['shortsword', 'spear', 'scimitar', 'light crossbow', 'dagger', 'mace', 'quarterstaff', 'handaxe'];
    const weapon = pick(weapons);
    const attackModStr = attackBonus >= 0 ? `+${attackBonus}` : `${attackBonus}`;

    const asUmbrarian = !!opts.umbrarian;
    const stages = ['dormant', 'awakened', 'ascendant'];
    const umbStage = opts.umbrarianStage || (asUmbrarian ? pick(stages) : '');
    const shards = (window.UMBRARIANS && window.UMBRARIANS.shards) ? window.UMBRARIANS.shards : [];
    const shard = opts.shard || (asUmbrarian && shards.length ? pick(shards) : null);
    const shardAbility = opts.shardAbility || pick(['INT', 'WIS', 'CHA']);
    const levelApprox = Math.max(1, Math.round(Number(cr) || 1));
    const pb = (window.PHB_PROF_BY_LEVEL && window.PHB_PROF_BY_LEVEL[levelApprox]) || 2;
    const shardMod = shardAbility === 'INT' ? abilityMod(scores.int) : shardAbility === 'CHA' ? chaMod : wisMod;
    const shardDC = 8 + pb + shardMod;

    let traits = pick(GENERATORS.npcTraits);
    let secret = pick(GENERATORS.npcSecrets);
    let attacks = `${weapon} ${attackModStr} to hit, ${damage} damage`;
    let corruption = 0;

    if (asUmbrarian) {
      corruption = umbStage === 'ascendant' ? pick([4, 5, 6]) : umbStage === 'awakened' ? pick([1, 2, 3]) : pick([0, 1]);
      const shardName = shard ? shard.name : 'Unknown Shard';
      const umbLines = [
        `Umbrarian (${umbStage}) — Shard: ${shardName}`,
        `Shard Mark; Resonant Sense 1/LR (30 ft.)`,
        `Shard DC ${shardDC} (${shardAbility})`,
        umbStage === 'dormant' ? 'Dormant: dreams/impulses only' :
          umbStage === 'awakened' ? 'Awakened: 1–2 Gifts; Dark Bargains' :
          'Ascendant: Ascendant Gift + regional effect'
      ];
      if (shard) umbLines.push(`Theme: ${shard.theme}`);
      traits = umbLines.join(' · ');
      if (umbStage !== 'dormant') attacks += `; Whisper Lash (action, DC ${shardDC} WIS, 2d8 psychic)`;
      secret = `Bears ${shardName}. ${secret}`;
    }

    return {
      name: generateNpcName(),
      role,
      world: shard && asUmbrarian ? (opts.world || shard.world || world) : world,
      cr: String(cr),
      ...scores,
      ac,
      hp: hpMax,
      hpMax,
      speed: '30 ft.',
      perception: 10 + wisMod + (Math.random() < 0.4 ? 2 : 0),
      attacks,
      traits,
      secret,
      notes: '',
      isUmbrarian: asUmbrarian,
      umbrarianStage: umbStage,
      shard: shard ? shard.name : '',
      shardAbility: asUmbrarian ? shardAbility : '',
      corruption,
      features: traits
    };
  }


  function generateVillain(opts = {}) {
    const base = generateNpc({
      cr: opts.cr != null ? opts.cr : pick([5, 8, 10, 12, 15, 17, 20]),
      role: opts.role || pick(['Warlord', 'Archmage', 'Cult Leader', 'Fallen Knight', 'Shadow Broker', 'High Priest', 'Beastmaster', 'Assassin-Lord']),
      world: opts.world,
      umbrarian: opts.umbrarian,
      umbrarianStage: opts.umbrarianStage,
      shard: opts.shard
    });
    const crn = Number(base.cr) || 8;
    // Boost to boss tier
    base.hpMax = Math.round(base.hpMax * 1.8 + 30);
    base.hp = base.hpMax;
    base.ac = Math.min(22, (base.ac || 15) + 2);
    base.legendary = true;
    base.legendaryResistMax = crn >= 13 ? 3 : (crn >= 5 ? 2 : 1);
    base.legendaryResist = base.legendaryResistMax;
    base.type = 'villain';
    base.name = base.name.replace(/^(.*)$/, (m) => pick(['Lord', 'Lady', 'Archon', 'Vizier', 'Warlord', 'High']) + ' ' + generateNpcName().split(' ').pop());

    const atk = 6 + Math.floor(crn / 3);
    const dmgDie = crn >= 15 ? '3d10' : crn >= 10 ? '2d10' : '2d8';
    const strMod = Math.floor(((base.str || 16) - 10) / 2);
    const spellDC = 12 + Math.floor(crn / 4);
    const spellAtk = 4 + Math.floor(crn / 3);

    base.attacks = [
      `Multiattack: The villain makes two weapon attacks.`,
      `Weapon +${atk} to hit, ${dmgDie}+${Math.max(0, strMod)} damage.`,
      `Spell Attack +${spellAtk} to hit, 3d8 force damage.`
    ].join('\\n');

    base.actions = [
      { kind: 'action', name: 'Multiattack', toHit: null, damage: '', text: 'Two weapon attacks.' },
      { kind: 'action', name: 'Weapon Attack', toHit: atk, damage: `${dmgDie}+${Math.max(0, strMod)}`, text: 'Melee or ranged weapon.' },
      { kind: 'action', name: 'Spell Attack', toHit: spellAtk, damage: '3d8', text: `Spell attack, DC ${spellDC} for secondary effects.` }
    ];
    base.bonusActions = [
      { name: 'Command Minion', text: 'One ally within 60 ft. can use a reaction to move up to half speed or make one weapon attack.' },
      { name: 'Dark Recovery', text: 'Regain 2d8 HP. 1/round while bloodied.' }
    ];
    base.reactions = [
      { name: 'Parry', text: `Add +${2 + Math.floor(crn / 5)} to AC against one melee attack that would hit.` }
    ];
    base.legendaryActions = [
      { name: 'Detect', text: '1 LA — Make a Wisdom (Perception) check.' },
      { name: 'Move', text: '1 LA — Move up to half speed without provoking opportunity attacks.' },
      { name: 'Attack', toHit: atk, damage: `${dmgDie}+${Math.max(0, strMod)}`, text: '2 LA — Make one weapon attack.' },
      { name: 'Cast a Cantrip', toHit: spellAtk, damage: '2d8', text: '2 LA — Cast a cantrip.' }
    ];
    base.legendaryActionsPerRound = 3;

    const resistPools = [
      'necrotic; psychic',
      'fire; cold',
      'lightning; thunder',
      'poison; nonmagical bludgeoning, piercing, and slashing'
    ];
    const immunePools = ['poison', 'charmed', 'frightened', 'exhaustion'];
    base.resistances = pick(resistPools);
    base.immunities = Math.random() < 0.5 ? pick(immunePools) : '';
    base.vulnerabilities = Math.random() < 0.25 ? pick(['radiant', 'fire', 'psychic']) : '';

    // Spell list for sheet
    const cantrips = ['Fire Bolt', 'Minor Illusion', 'Mage Hand', 'Toll the Dead', 'Message'];
    const spells = [
      'Shield (1st)', 'Magic Missile (1st)', 'Hold Person (2nd)', 'Misty Step (2nd)',
      'Counterspell (3rd)', 'Fireball (3rd)', 'Greater Invisibility (4th)', 'Dimension Door (4th)',
      'Dominate Person (5th)', 'Wall of Force (5th)'
    ];
    base.cantrips = cantrips.slice(0, 3 + Math.floor(Math.random() * 2)).join(', ');
    base.spells = spells.slice(0, 4 + Math.floor(crn / 4)).join('\n');
    base.spellcastingAbility = pick(['INT', 'WIS', 'CHA']);
    base.spellSlots = { 1: 4, 2: 3, 3: 3, 4: 2, 5: 1 };

    // Gear
    const armors = [
      { name: 'Studded Leather', category: 'armor', armorType: 'light', acBase: 12, equipped: true },
      { name: 'Half Plate', category: 'armor', armorType: 'medium', acBase: 15, acDexMax: 2, equipped: true },
      { name: 'Plate', category: 'armor', armorType: 'heavy', acBase: 18, acDexMax: 0, equipped: true }
    ];
    const armor = crn >= 12 ? armors[2] : crn >= 6 ? armors[1] : armors[0];
    const weapons = [
      { name: 'Longsword', category: 'weapon', damage: '1d8', damageType: 'slashing', equipped: true },
      { name: 'Glaive', category: 'weapon', damage: '1d10', damageType: 'slashing', equipped: true },
      { name: 'Staff of Power', category: 'weapon', damage: '1d6', damageType: 'bludgeoning', magic: true, equipped: true }
    ];
    base.inventory = [
      { ...armor, uid: 'v-armor', qty: 1, id: 'villain-armor' },
      { ...pick(weapons), uid: 'v-weapon', qty: 1, id: 'villain-weapon' }
    ];
    base.equipment = base.inventory.filter(i => i.equipped).map(i => i.name + ' (equipped)').join(', ');
    base.class = pick(['Wizard', 'Fighter', 'Warlock', 'Paladin', 'Sorcerer', 'Bloodhunter']);
    base.level = Math.min(20, 8 + Math.floor(crn / 2));
    base.classes = [{ name: base.class, level: base.level, subclass: '' }];
    base.features = (base.features || '') + `\\n\\nLegendary Resistance (${base.legendaryResistMax}/Day). If the villain fails a saving throw, it can choose to succeed instead.\\nLegendary Actions (3/round).`;
    base.notes = base.attacks;
    base.traits = (base.traits || '') + ` · Legendary · LR ${base.legendaryResistMax}`;
    base.secret = (base.secret || '') + ' Boss agenda: dominate a region of the Seven Worlds.';
    return base;
  }

  function villainToCombatant(v) {
    return {
      id: (typeof uid === 'function' ? uid() : 'v' + Date.now()),
      name: v.name,
      side: 'enemy',
      init: (Math.floor(Math.random() * 20) + 1) + Math.floor(((v.dex || 10) - 10) / 2),
      ac: v.ac,
      hp: v.hp,
      hpMax: v.hpMax,
      tempHp: 0,
      conditions: '',
      notes: v.attacks || v.notes || '',
      attacks: v.attacks,
      cantrips: v.cantrips || '',
      spells: v.spells || '',
      actions: v.actions || [],
      bonusActions: v.bonusActions || [],
      reactions: v.reactions || [],
      legendaryActions: v.legendaryActions || [],
      legendary: true,
      legendaryResist: v.legendaryResist,
      legendaryResistMax: v.legendaryResistMax,
      resistances: v.resistances || '',
      immunities: v.immunities || '',
      vulnerabilities: v.vulnerabilities || '',
      speed: v.speed || '30 ft.',
      concentrating: false,
      combatLog: [],
      charId: v.id || null
    };
  }


  function formatNpcBlock(npc) {
    const abs = `STR ${npc.str} (${modStr(npc.str)})  DEX ${npc.dex} (${modStr(npc.dex)})  CON ${npc.con} (${modStr(npc.con)})  INT ${npc.int} (${modStr(npc.int)})  WIS ${npc.wis} (${modStr(npc.wis)})  CHA ${npc.cha} (${modStr(npc.cha)})`;
    const lines = [
      `AC ${npc.ac} · HP ${npc.hp}/${npc.hpMax} · Speed ${npc.speed}`,
      abs,
      `Passive Perception ${npc.perception}`,
      `Attacks: ${npc.attacks}`,
      `Trait: ${npc.traits}`,
      `Secret: ${npc.secret}`
    ];
    if (npc.isUmbrarian) {
      lines.splice(3, 0, `Umbrarian · ${npc.umbrarianStage || '?'} · ${npc.shard || 'Shard'} · Corruption ${npc.corruption}/6`);
    }
    return {
      title: npc.name,
      subtitle: `${npc.role} · ${npc.world} · CR ${npc.cr}${npc.isUmbrarian ? ' · Umbrarian' : ''}`,
      lines
    };
  }

  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function generateFactionName() {
    return `The ${pick(GENERATORS.factionPrefixes)} ${pick(GENERATORS.factionNouns)}`;
  }

  function generateForceName() {
    const tpl = pick(GENERATORS.forceNameTemplates);
    return tpl
      .replace('{adj}', pick(GENERATORS.forceAdjs))
      .replace('{noun}', pick(GENERATORS.forceNouns))
      .replace('{place}', pick(GENERATORS.forcePlaces))
      .replace('{name}', pick(GENERATORS.forceNames));
  }

  function generateFaction() { /* stripped from Combat Tracker */ return null; }

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  function generateForce() { /* stripped from Combat Tracker */ return null; }

  function normalizeForce(f) {
    // Migrate older force records to full DIE shape
    return {
      id: f.id,
      name: f.name || 'Unnamed Force',
      type: f.type || 'Antagonist',
      publicFace: f.publicFace || '',
      goal: f.goal || '',
      political: clamp(Number(f.political) || 0, 0, 6),
      corruptive: clamp(Number(f.corruptive) || 0, 0, 6),
      disruptive: clamp(Number(f.disruptive) || 0, 0, 6),
      agendaClock: clamp(Number(f.agendaClock) || 0, 0, 6),
      awareness: clamp(Number(f.awareness) || 0, 0, 4),
      pressure: clamp(Number(f.pressure) || 0, 0, 4),
      assets: f.assets || f.resources || '',
      vulnerabilities: f.vulnerabilities || '',
      resources: f.resources || '',
      status: f.status || '',
      lastAction: f.lastAction || '',
      notes: f.notes || ''
    };
  }

  function dominantInfluence(f) {
    const scores = [
      { key: 'political', val: f.political || 0 },
      { key: 'corruptive', val: f.corruptive || 0 },
      { key: 'disruptive', val: f.disruptive || 0 }
    ];
    scores.sort((a, b) => b.val - a.val);
    return scores[0].key;
  }

  function influenceReach(rating) {
    const labels = [
      'none', 'individual / crew', 'settlement', 'regional',
      'planetary', 'multi-world', 'system-defining'
    ];
    return labels[clamp(rating, 0, 6)] || 'none';
  }

  // ─── State ───────────────────────────────────────────────────────────────
  let state = {
    campaigns: [],
    activeCampaignId: null,
    diceHistory: [],
    selectedDie: 20,
  };

  // ─── DOM refs ────────────────────────────────────────────────────────────
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

  // ─── Persistence ─────────────────────────────────────────────────────────
  function load() {
    try {
      // Preserve heavy media already in memory (storage events strip data URLs)
      const prevMedia = {};
      (state.campaigns || []).forEach(c => {
        if (!c || !c.id) return;
        prevMedia[c.id] = {
          imageDataUrl: c.combatMap && c.combatMap.imageDataUrl,
          videoObjectUrl: c.combatMap && c.combatMap.videoObjectUrl,
          mediaType: c.combatMap && c.combatMap.mediaType
        };
      });

      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        state.campaigns = (parsed.campaigns || []).map(ensureCampaignShape);
        state.activeCampaignId = parsed.activeCampaignId || null;
        state.diceHistory = parsed.diceHistory || [];
        // Restore media from memory if stripped in JSON
        state.campaigns.forEach(c => {
          if (!c.combatMap) c.combatMap = {};
          const prev = prevMedia[c.id];
          if (prev) {
            if (!c.combatMap.imageDataUrl && prev.imageDataUrl) c.combatMap.imageDataUrl = prev.imageDataUrl;
            if (!c.combatMap.videoObjectUrl && prev.videoObjectUrl) {
              c.combatMap.videoObjectUrl = prev.videoObjectUrl;
              c.combatMap.mediaType = prev.mediaType || c.combatMap.mediaType;
            }
          }
        });
      }
    } catch (e) {
      console.warn('Failed to load state', e);
    }
  }

  
  async function restoreMapImagesAfterLoad() {
    try {
      for (const c of (state.campaigns || [])) {
        if (!c.combatMap) c.combatMap = {};
        if (!c.combatMap.imageDataUrl) {
          const img = await idbGetMapImage(c.id);
          if (img) {
            c.combatMap.imageDataUrl = img;
            c.combatMap.hasImageInIdb = true;
            if (!c.combatMap.mediaType) c.combatMap.mediaType = 'image';
          }
        }
        if (!c.combatMap.videoObjectUrl && (c.combatMap.hasVideoInIdb || c.combatMap.mediaType === 'video')) {
          const blob = await idbGetMapVideo(c.id);
          if (blob) {
            if (c.combatMap.videoObjectUrl && String(c.combatMap.videoObjectUrl).startsWith('blob:')) {
              try { URL.revokeObjectURL(c.combatMap.videoObjectUrl); } catch (e) {}
            }
            c.combatMap.videoObjectUrl = URL.createObjectURL(blob);
            c.combatMap.mediaType = 'video';
            c.combatMap.hasVideoInIdb = true;
          }
        }
      }
    } catch (e) {
      console.warn('restore map media', e);
    }
  }

  function tryRestoreRosterBackupIfEmpty() {
    try {
      if (typeof isMapPopoutMode === 'function' && isMapPopoutMode()) return;
      if ((state.campaigns || []).length && (getCombat(getActive()) || {}).combatants?.length) return;
      const raw = localStorage.getItem(ROSTER_BACKUP_KEY);
      if (!raw) return;
      const b = JSON.parse(raw);
      if (!b || !b.combatants || !b.combatants.length) return;
      ensureCombatWorkspace();
      const c = getActive();
      if (!c) return;
      if (!c.combat) c.combat = { round: 1, turnIndex: 0, combatants: [], selectedIndex: 0 };
      if (!(c.combat.combatants || []).length && b.combatants.length) {
        c.combat.combatants = b.combatants;
        if (b.party) c.party = b.party;
        if (b.villains) c.villains = b.villains;
        if (b.combatMapMeta) {
          c.combatMap = Object.assign({ tokens: {}, walls: [], gridSize: 70 }, b.combatMapMeta, { imageDataUrl: null });
        }
        toast('Restored roster from backup');
        try { save(); } catch (e) {}
      }
    } catch (e) {
      console.warn('roster backup restore', e);
    }
  }

  function save() {
    // Pop-out window is view-only — never write state (prevents wiping main workspace)
    try {
      if (typeof isMapPopoutMode === 'function' && isMapPopoutMode()) {
        try { if (typeof notifyMapWindows === 'function') setTimeout(notifyMapWindows, 0); } catch (e) {}
        return;
      }
    } catch (e) {}

    try { if (typeof notifyMapWindows === "function") setTimeout(notifyMapWindows, 0); } catch (e) {}

    // Persist large map image outside localStorage (quota)
    try {
      const c = (state.campaigns || []).find(x => x.id === state.activeCampaignId);
      if (c && c.combatMap) {
        if (c.combatMap.imageDataUrl) idbSetMapImage(c.id, c.combatMap.imageDataUrl);
        // video blob saved at import time via idbSetMapVideo
      }
    } catch (e) {}

    try {
      const payload = typeof cloneStateForLocalStorage === 'function'
        ? cloneStateForLocalStorage()
        : {
            campaigns: state.campaigns,
            activeCampaignId: state.activeCampaignId,
            diceHistory: (state.diceHistory || []).slice(0, 50)
          };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      try { backupRosterLite(); } catch (e) {}
    } catch (e) {
      console.warn('save failed', e);
      try { backupRosterLite(); } catch (e2) {}
      toast('Storage full — roster backed up; map image uses IndexedDB');
    }
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function getActive() {
    let c = (state.campaigns || []).find(x => x.id === state.activeCampaignId) || null;
    if (!c && document.body && document.body.dataset && document.body.dataset.app === 'combat-tracker') {
      c = ensureCombatWorkspace();
    }
    return c || null;
  }

  // ─── Toast ───────────────────────────────────────────────────────────────
  let toastTimer;
  function toast(msg, ms = 2200) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.add('hidden'), ms);
  }

  // ─── Modal ───────────────────────────────────────────────────────────────
  let modalResolve = null;

  function openModal({ title, bodyHtml, confirmText = 'Save', onConfirm, afterOpen, wide = false, xwide = false }) {
    $('#modal-title').textContent = title;
    $('#modal-body').innerHTML = bodyHtml;
    $('#modal-confirm').textContent = confirmText;
    const panel = $('.modal-content') || $('.modal-panel');
    if (panel) {
      panel.classList.toggle('wide', !!wide || !!xwide);
      panel.classList.toggle('xwide', !!xwide);
    }
    $('#modal').classList.remove('hidden');

    // Run afterOpen immediately so generators / extra UI can bind while modal is visible
    if (typeof afterOpen === 'function') {
      try { afterOpen(); } catch (e) { console.warn('afterOpen error', e); }
    }

    return new Promise(resolve => {
      modalResolve = (result) => {
        $('#modal').classList.add('hidden');
        if (panel) { panel.classList.remove('wide'); panel.classList.remove('xwide'); }
        resolve(result);
      };
      $('#modal-confirm').onclick = () => {
        if (onConfirm) {
          let ok = true;
          try {
            ok = onConfirm();
          } catch (err) {
            console.error('Save failed', err);
            if (typeof toast === 'function') toast('Save failed: ' + (err.message || err));
            return;
          }
          if (ok !== false) modalResolve(true);
        } else {
          modalResolve(true);
        }
      };
      $('#modal-cancel').onclick = () => modalResolve(false);
      $('#modal-close').onclick = () => modalResolve(false);
      $('.modal-backdrop').onclick = () => modalResolve(false);
    });
  }

  // ─── Navigation ──────────────────────────────────────────────────────────
  
  function ensureCombatWorkspace() {
    try {
      if (!state.campaigns) state.campaigns = [];
      // Never create a blank workspace from the map pop-out (would desync / wipe on bad save)
      if (!state.campaigns.length && typeof isMapPopoutMode === 'function' && isMapPopoutMode()) {
        return null;
      }
      if (!state.campaigns.length) {
        const id = typeof uid === 'function' ? uid() : ('c' + Date.now());
        state.campaigns = [{
          id,
          name: 'Combat Workspace',
          world: 'Eldoria',
          party: [],
          villains: [],
          sessions: [],
          notes: '',
          combat: { round: 1, turnIndex: 0, combatants: [], selectedIndex: 0 },
          factions: [],
          forces: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }];
        state.activeCampaignId = id;
      }
      if (!state.activeCampaignId || !state.campaigns.some(function(c) { return c.id === state.activeCampaignId; })) {
        state.activeCampaignId = state.campaigns[0].id;
      }
      const c = state.campaigns.find(function(x) { return x.id === state.activeCampaignId; }) || state.campaigns[0];
      if (c && !c.combat) c.combat = { round: 1, turnIndex: 0, combatants: [], selectedIndex: 0 };
      if (c && !Array.isArray(c.combat.combatants)) c.combat.combatants = [];
      if (c && !Array.isArray(c.party)) c.party = [];
      if (c && !Array.isArray(c.villains)) c.villains = [];
      try { save(); } catch (e) {}
      return c;
    } catch (e) {
      console.warn('ensureCombatWorkspace', e);
      return null;
    }
  }


  function exportPartyRoster(opts) {
    opts = opts || {};
    ensureCombatWorkspace();
    const c = getActive();
    if (!c) { toast('No workspace'); return; }
    const payload = {
      format: 'DSC-roster-v1',
      exportedAt: new Date().toISOString(),
      source: opts.source || (document.body?.dataset?.app === 'combat-tracker' ? 'CombatTracker' : 'DSCToolkt'),
      campaignName: c.name || '',
      party: (c.party || []).map(ch => ({ ...ch })),
      villains: (c.villains || []).map(ch => ({ ...ch }))
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (c.name || 'roster').replace(/[^\w\-]+/g, '_') + '-roster.json';
    a.click();
    URL.revokeObjectURL(a.href);
    toast('Roster exported (' + payload.party.length + ' party, ' + payload.villains.length + ' villains)');
  }

  function importPartyRoster(file) {
    if (!file) return;
    ensureCombatWorkspace();
    const c = getActive();
    if (!c) { toast('No workspace'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        let party = [];
        let villains = [];
        if (data && data.format === 'DSC-roster-v1') {
          party = Array.isArray(data.party) ? data.party : [];
          villains = Array.isArray(data.villains) ? data.villains : [];
        } else if (Array.isArray(data)) {
          // bare array of characters
          party = data;
        } else if (data && Array.isArray(data.party)) {
          party = data.party;
          villains = Array.isArray(data.villains) ? data.villains : [];
        } else if (data && (data.name || data.characterId || data.id) && (data.class || data.classes || data.level != null)) {
          // single character sheet
          party = [data];
        } else {
          toast('Unrecognized roster JSON');
          return;
        }
        const mode = window._rosterImportMode || 'merge';
        const byId = (list) => {
          const m = new Map();
          (list || []).forEach(ch => {
            const id = ch.characterId || ch.id;
            if (id) m.set(id, ch);
          });
          return m;
        };
        if (mode === 'replace') {
          c.party = party.map(ch => ({ ...ch, id: ch.id || ch.characterId || uid(), characterId: ch.characterId || ch.id || uid() }));
          c.villains = villains.map(ch => ({ ...ch, id: ch.id || ch.characterId || uid(), characterId: ch.characterId || ch.id || uid() }));
        } else {
          // merge / upsert by characterId
          const pm = byId(c.party);
          party.forEach(ch => {
            const id = ch.characterId || ch.id || uid();
            const merged = { ...ch, id, characterId: id };
            pm.set(id, merged);
          });
          c.party = Array.from(pm.values());
          const vm = byId(c.villains);
          villains.forEach(ch => {
            const id = ch.characterId || ch.id || uid();
            const merged = { ...ch, id, characterId: id };
            vm.set(id, merged);
          });
          c.villains = Array.from(vm.values());
        }
        c.updatedAt = new Date().toISOString();
        save();
        toast('Roster imported: ' + party.length + ' party, ' + villains.length + ' villains');
        try { if (typeof renderParty === 'function' && $('#view-party')?.classList.contains('active')) renderParty(); } catch (e) {}
        try { if (typeof renderCombat === 'function' && $('#view-combat')?.classList.contains('active')) renderCombat(); } catch (e) {}
        try { renderTools(); } catch (e) {}
      } catch (e) {
        console.warn(e);
        toast('Failed to import roster');
      }
    };
    reader.readAsText(file);
  }


  function setView(viewName) {
    // Combat Tracker app: only combat + tools are valid top-level views
    if (document.body && document.body.dataset && document.body.dataset.app === 'combat-tracker') {
      if (viewName !== 'combat' && viewName !== 'tools' && viewName !== 'map') {
        viewName = 'combat';
      }
    }
    if (viewName === 'map') {
      try {
        if (typeof initBattleMapUi === 'function') initBattleMapUi();
        refreshMapTokenSelect();
        renderBattleMap();
      } catch (e) { console.warn(e); }
    }

    $$('.view').forEach(v => v.classList.remove('active'));
    $$('.nav-item').forEach(n => n.classList.remove('active'));

    const view = $(`#view-${viewName}`);
    const nav = $(`.nav-item[data-view="${viewName}"]`);
    if (view) view.classList.add('active');
    if (nav) nav.classList.add('active');

    const sidebar = $('#sidebar');
    if (sidebar) sidebar.classList.remove('open');

    if (viewName === 'combat') {
      renderCombat();
      try { applyAoeTargetsToRoller(); } catch (e) {}
    } else if (viewName === 'map') {
      try {
        if (typeof initBattleMapUi === 'function') initBattleMapUi();
        refreshMapTokenSelect();
        renderBattleMap();
      } catch (e) {}
    } else if (viewName === 'tools') { try { renderCompendiumTools(); } catch (e) {} renderTools(); }
    else if (viewName === 'campaigns') {
      if (document.body && document.body.dataset && document.body.dataset.app === 'combat-tracker') {
        renderCombat();
      } else {
        renderCampaigns();
      }
    }
    else if (viewName === 'overview') renderOverview();
    else if (viewName === 'sessions') renderSessions();
    else if (viewName === 'party') renderParty();
    else if (viewName === 'bestiary') renderBestiary();
    else if (viewName === 'umbrarians') renderUmbrarians();
    else if (viewName === 'dsc-classes') renderDscClasses();
    else if (viewName === 'factions') renderFactions();
    else if (viewName === 'forces') renderForces();
    else if (viewName === 'notes') renderNotes();
  }

  function updateNavEnabled() {
    const isCombatApp = document.body?.dataset?.app === 'combat-tracker';
    const hasActive = !!getActive();
    (function bindSidebarToggle() {
      function isMobile() { return window.matchMedia && window.matchMedia('(max-width: 900px)').matches; }
      function setCollapsed(collapsed) {
        document.body.classList.toggle('sidebar-collapsed', !!collapsed);
        const sb = document.getElementById('sidebar');
        if (sb) {
          if (isMobile()) {
            sb.classList.toggle('open', !collapsed);
          } else {
            sb.classList.remove('open');
          }
        }
        document.querySelectorAll('#sidebar-collapse-btn, #menu-toggle').forEach(function(btn) {
          if (!btn) return;
          btn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
          btn.title = collapsed ? 'Show menu' : 'Hide menu';
        });
        try { localStorage.setItem('cv_combat_sidebar_v4', collapsed ? '1' : '0'); } catch (e) {}
      }
      function toggle() {
        const collapsed = !document.body.classList.contains('sidebar-collapsed');
        // if mobile and sidebar has .open, treat as visible
        if (isMobile()) {
          const sb = document.getElementById('sidebar');
          const open = sb && sb.classList.contains('open');
          setCollapsed(open); // if open -> collapse; if closed -> show
          if (!open) { if (sb) sb.classList.add('open'); document.body.classList.remove('sidebar-collapsed'); }
          else { if (sb) sb.classList.remove('open'); }
          try { localStorage.setItem('cv_combat_sidebar_v4', open ? '1' : '0'); } catch (e) {}
          return;
        }
        setCollapsed(!document.body.classList.contains('sidebar-collapsed') ? true : false);
        setCollapsed(document.body.classList.contains('sidebar-collapsed'));
        document.body.classList.toggle('sidebar-collapsed');
        try { localStorage.setItem('cv_combat_sidebar_v4', document.body.classList.contains('sidebar-collapsed') ? '1' : '0'); } catch (e) {}
        document.querySelectorAll('#sidebar-collapse-btn, #menu-toggle').forEach(function(btn) {
          if (!btn) return;
          const col = document.body.classList.contains('sidebar-collapsed');
          btn.setAttribute('aria-expanded', col ? 'false' : 'true');
          btn.title = col ? 'Show menu' : 'Hide menu';
        });
      }
      ['sidebar-collapse-btn', 'menu-toggle'].forEach(function(id) {
        const btn = document.getElementById(id);
        if (!btn || btn.dataset.wired === '1') return;
        btn.dataset.wired = '1';
        btn.addEventListener('click', function(e) {
          e.preventDefault();
          e.stopPropagation();
          if (isMobile()) {
            const sb = document.getElementById('sidebar');
            if (!sb) return;
            sb.classList.toggle('open');
            document.body.classList.toggle('sidebar-collapsed', !sb.classList.contains('open'));
          } else {
            document.body.classList.toggle('sidebar-collapsed');
          }
          const col = document.body.classList.contains('sidebar-collapsed');
          try { localStorage.setItem('cv_combat_sidebar_v4', col ? '1' : '0'); } catch (err) {}
          document.querySelectorAll('#sidebar-collapse-btn, #menu-toggle').forEach(function(b) {
            if (!b) return;
            b.setAttribute('aria-expanded', col ? 'false' : 'true');
            b.title = col ? 'Show menu' : 'Hide menu';
          });
        });
      });
      // Restore preference (default: menu visible)
      try {
        // Default menu OPEN — only collapse if user explicitly set v4
        if (localStorage.getItem('cv_combat_sidebar_v4') === '1') {
          document.body.classList.add('sidebar-collapsed');
        } else {
          document.body.classList.remove('sidebar-collapsed');
        }
      } catch (e) {}
    })();

    $$('.nav-item').forEach(btn => {
      const v = btn.dataset.view;
      if (isCombatApp) {
        btn.disabled = false; // Combat Tracker: no campaign gate
      } else if (v === 'campaigns' || v === 'tools' || v === 'bestiary') {
        btn.disabled = false;
      } else {
        btn.disabled = !hasActive;
      }
    });

    const badge = $('#active-campaign-badge');
    const active = getActive();
    if (active) {
      badge.textContent = active.name;
      badge.classList.remove('hidden');
      badge.title = active.name;
    } else {
      badge.classList.add('hidden');
    }
  }

  // ─── Campaigns ───────────────────────────────────────────────────────────
  function createCampaign(data) {
    const c = {
      id: uid(),
      name: data.name || 'Untitled Campaign',
      description: data.description || '',
      currentWorld: data.currentWorld || 'Luminaris',
      tier: data.tier || '1-4',
      status: data.status || '',
      goals: data.goals || '',
      notes: data.notes || '',
      sessions: [],
      party: [],
      villains: [],
      combat: null,
      factions: [],
      forces: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    state.campaigns.unshift(c);
    state.activeCampaignId = c.id;
    save();
    updateNavEnabled();
    return c;
  }

  function ensureCampaignShape(c) {
    if (!Array.isArray(c.party)) c.party = [];
    if (!Array.isArray(c.villains)) c.villains = [];
    if (!Array.isArray(c.factions)) c.factions = [];
    if (!Array.isArray(c.forces)) c.forces = [];
    if (!Array.isArray(c.sessions)) c.sessions = [];
    if (!c.combat || typeof c.combat !== 'object') c.combat = { round: 1, turnIndex: 0, combatants: [], selectedIndex: 0 };
    return c;
  }

  function deleteCampaign(id) {
    state.campaigns = state.campaigns.filter(c => c.id !== id);
    if (state.activeCampaignId === id) {
      state.activeCampaignId = state.campaigns[0]?.id || null;
    }
    save();
    updateNavEnabled();
  }

  function setActiveCampaign(id) {
    state.activeCampaignId = id;
    save();
    updateNavEnabled();
    setView('overview');
  }

  async function promptNewCampaign(existing = null) {
    const isEdit = !!existing;
    const body = `
      <div class="field">
        <label>Campaign Name</label>
        <input type="text" id="m-name" value="${escapeAttr(existing?.name || '')}" placeholder="e.g. Shadows of Umbraria" />
      </div>
      <div class="field">
        <label>Description / Premise</label>
        <textarea id="m-desc" rows="3" placeholder="Short premise or starting situation...">${formatRichText(existing?.description || '')}</textarea>
      </div>
      <div class="form-row">
        <div class="field">
          <label>Starting / Current World</label>
          <select id="m-world">
            ${WORLDS.map(w => `<option value="${w}" ${ (existing?.currentWorld || 'Luminaris') === w ? 'selected' : '' }>${w}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label>Tier</label>
          <select id="m-tier">
            <option value="1-4" ${existing?.tier === '1-4' ? 'selected' : ''}>Local (1–4)</option>
            <option value="5-10" ${existing?.tier === '5-10' ? 'selected' : ''}>Regional (5–10)</option>
            <option value="11-16" ${existing?.tier === '11-16' ? 'selected' : ''}>Planetary (11–16)</option>
            <option value="17-20" ${existing?.tier === '17-20' ? 'selected' : ''}>Cosmic (17–20)</option>
          </select>
        </div>
      </div>
    `;

    const confirmed = await openModal({
      title: isEdit ? 'Edit Campaign' : 'New Campaign',
      bodyHtml: body,
      confirmText: isEdit ? 'Update' : 'Create',
      onConfirm: () => {
        const name = $('#m-name')?.value?.trim();
        if (!name) {
          toast('Name is required');
          return false;
        }
        if (isEdit) {
          existing.name = name;
          existing.description = $('#m-desc').value.trim();
          existing.currentWorld = $('#m-world').value;
          existing.tier = $('#m-tier').value;
          existing.updatedAt = new Date().toISOString();
          save();
        } else {
          createCampaign({
            name,
            description: $('#m-desc').value.trim(),
            currentWorld: $('#m-world').value,
            tier: $('#m-tier').value,
          });
        }
        return true;
      },
    });

    if (confirmed) {
      toast(isEdit ? 'Campaign updated' : 'Campaign created');
      renderCampaigns();
      if (!isEdit) setView('overview');
      else if (getActive()?.id === existing.id) renderOverview();
    }
  }

  function renderCampaigns() { /* stripped: Combat Tracker */ }

  // ─── Overview ────────────────────────────────────────────────────────────
  function renderOverview() { /* stripped */ }

  function bindOverviewListeners() {
    $('#current-world')?.addEventListener('change', () => {
      const c = getActive();
      if (!c) return;
      c.currentWorld = $('#current-world').value;
      c.updatedAt = new Date().toISOString();
      save();
      updateNavEnabled();
    });
    $('#campaign-tier')?.addEventListener('change', () => {
      const c = getActive();
      if (!c) return;
      c.tier = $('#campaign-tier').value;
      c.updatedAt = new Date().toISOString();
      save();
    });
    let statusTimer, goalsTimer;
    $('#campaign-status')?.addEventListener('input', () => {
      clearTimeout(statusTimer);
      statusTimer = setTimeout(() => {
        const c = getActive();
        if (!c) return;
        c.status = $('#campaign-status').value;
        c.updatedAt = new Date().toISOString();
        save();
      }, 400);
    });
    $('#campaign-goals')?.addEventListener('input', () => {
      clearTimeout(goalsTimer);
      goalsTimer = setTimeout(() => {
        const c = getActive();
        if (!c) return;
        c.goals = $('#campaign-goals').value;
        c.updatedAt = new Date().toISOString();
        save();
      }, 400);
    });
    $('#edit-campaign-btn')?.addEventListener('click', () => {
      const c = getActive();
      if (c) promptNewCampaign(c);
    });
  }

  // ─── Sessions ────────────────────────────────────────────────────────────
  async function promptSession(existing = null) {
    const c = getActive();
    if (!c) return;

    const body = `
      <div class="field">
        <label>Session Title</label>
        <input type="text" id="m-title" value="${escapeAttr(existing?.title || '')}" placeholder="e.g. The Gate of Ashen Stars" />
      </div>
      <div class="field">
        <label>Date</label>
        <input type="date" id="m-date" value="${existing?.date || new Date().toISOString().slice(0, 10)}" />
      </div>
      <div class="field">
        <label>Summary / What Happened</label>
        <textarea id="m-summary" rows="5" placeholder="Key events, decisions, consequences, open threads...">${escapeHtml(existing?.summary || '')}</textarea>
      </div>
      <div class="field">
        <label>World(s) Visited</label>
        <input type="text" id="m-worlds" value="${escapeAttr(existing?.worlds || c.currentWorld || '')}" placeholder="e.g. Umbraria, Aetheria" />
      </div>
    `;

    const confirmed = await openModal({
      title: existing ? 'Edit Session' : 'Log Session',
      bodyHtml: body,
      onConfirm: () => {
        const title = $('#m-title').value.trim() || 'Untitled Session';
        const data = {
          title,
          date: $('#m-date').value,
          summary: $('#m-summary').value.trim(),
          worlds: $('#m-worlds').value.trim(),
        };
        if (existing) {
          Object.assign(existing, data);
        } else {
          c.sessions.unshift({ id: uid(), ...data });
        }
        c.updatedAt = new Date().toISOString();
        save();
        return true;
      },
    });

    if (confirmed) {
      toast(existing ? 'Session updated' : 'Session logged');
      renderSessions();
    }
  }

  function renderSessions() { /* stripped */ }

  // ─── Party ───────────────────────────────────────────────────────────────
  function abilityMod(score) {
    const s = parseInt(score, 10);
    if (isNaN(s)) return 0;
    return Math.floor((s - 10) / 2);
  }

  function modStr(score) {
    const m = abilityMod(score);
    return m >= 0 ? `+${m}` : `${m}`;
  }

  function profBonusForLevel(level) {
    const lv = clamp(parseInt(level, 10) || 1, 1, 20);
    return 2 + Math.floor((lv - 1) / 4);
  }


  // ─── Feats library (SRD core + imported Open5e) ─────────────────────────
  const SRD_FEATS = [
    { id: 'alert', name: 'Alert', prerequisite: '', text: 'You gain a +5 bonus to initiative, you can\'t be surprised while conscious, and other creatures don\'t gain advantage on attack rolls against you as a result of being unseen by you.' },
    { id: 'athlete', name: 'Athlete', prerequisite: '', text: 'Increase STR or DEX by 1. Standing from prone costs only 5 feet of movement. Climbing doesn\'t cost extra movement. You can make a running long jump or high jump after moving only 5 feet.' },
    { id: 'actor', name: 'Actor', prerequisite: '', text: 'Increase CHA by 1. Advantage on Deception and Performance when passing yourself off as someone else. You can mimic speech or sounds; Insight vs your Deception to detect the mimicry.' },
    { id: 'charger', name: 'Charger', prerequisite: '', text: 'When you use Dash and move at least 10 feet in a straight line toward a target, you can make one melee attack or shove as a bonus action with +5 damage or an extra 10 feet of shove distance.' },
    { id: 'crossbow-expert', name: 'Crossbow Expert', prerequisite: '', text: 'Ignore the loading property of crossbows you are proficient with. Being within 5 feet of a hostile creature doesn\'t impose disadvantage on your ranged attack rolls. When you use the Attack action with a one-handed weapon, you can fire a hand crossbow as a bonus action.' },
    { id: 'defensive-duelist', name: 'Defensive Duelist', prerequisite: 'DEX 13+', text: 'When you are hit by a melee attack while wielding a finesse weapon you are proficient with, you can use your reaction to add your proficiency bonus to your AC for that attack.' },
    { id: 'dual-wielder', name: 'Dual Wielder', prerequisite: '', text: '+1 AC while dual-wielding. You can dual-wield weapons that aren\'t light. You can draw or stow two one-handed weapons when you would normally draw or stow only one.' },
    { id: 'dungeon-delver', name: 'Dungeon Delver', prerequisite: '', text: 'Advantage on Perception and Investigation to detect secret doors. Advantage on saves vs traps; resistance to trap damage. You can search for traps while traveling at a normal pace.' },
    { id: 'durable', name: 'Durable', prerequisite: '', text: 'Increase CON by 1. When you roll a Hit Die to regain HP, the minimum you regain equals twice your CON modifier (minimum 2).' },
    { id: 'elemental-adept', name: 'Elemental Adept', prerequisite: 'Spellcasting', text: 'Choose a damage type: acid, cold, fire, lightning, or thunder. Spells you cast ignore resistance to that type. Any 1 on a damage die for that type becomes a 2.' },
    { id: 'grappler', name: 'Grappler', prerequisite: 'STR 13+', text: 'Advantage on attack rolls against a creature you are grappling. You can use your action to try to pin a creature grappled by you (another grapple check); on a success, you and the creature are both restrained.' },
    { id: 'great-weapon-master', name: 'Great Weapon Master', prerequisite: '', text: 'On a melee critical hit or when you reduce a creature to 0 HP with a melee attack, you can make one melee weapon attack as a bonus action. Before you make a melee attack with a heavy weapon you are proficient with, you can take -5 to hit for +10 damage.' },
    { id: 'healer', name: 'Healer', prerequisite: '', text: 'When you use a healer\'s kit to stabilize, the creature also regains 1 HP. As an action, you can spend one use of a healer\'s kit to restore 1d6 + 4 + character level HP (once per creature per short rest).' },
    { id: 'heavily-armored', name: 'Heavily Armored', prerequisite: 'Medium armor proficiency', text: 'Increase STR by 1. You gain proficiency with heavy armor.' },
    { id: 'heavy-armor-master', name: 'Heavy Armor Master', prerequisite: 'Heavy armor proficiency', text: 'Increase STR by 1. While wearing heavy armor, bludgeoning, piercing, and slashing damage from nonmagical attacks is reduced by 3.' },
    { id: 'inspiring-leader', name: 'Inspiring Leader', prerequisite: 'CHA 13+', text: 'Spend 10 minutes inspiring up to six friendly creatures (including yourself) within 30 feet. Each gains temporary HP equal to your level + CHA modifier. A creature can\'t benefit again until it finishes a short or long rest.' },
    { id: 'keen-mind', name: 'Keen Mind', prerequisite: '', text: 'Increase INT by 1. Always know which way is north and the number of hours left before the next sunrise or sunset. You can accurately recall anything you have seen or heard within the past month.' },
    { id: 'lightly-armored', name: 'Lightly Armored', prerequisite: '', text: 'Increase STR or DEX by 1. You gain proficiency with light armor.' },
    { id: 'linguist', name: 'Linguist', prerequisite: '', text: 'Increase INT by 1. Learn three languages. Create written ciphers; INT (Investigation) DC equals your INT score + proficiency bonus to decipher.' },
    { id: 'lucky', name: 'Lucky', prerequisite: '', text: 'You have 3 luck points. Spend one to roll an additional d20 when you make an attack, ability check, or saving throw, or when an attack is made against you; choose which die to use. Regain expended luck points after a long rest.' },
    { id: 'mage-slayer', name: 'Mage Slayer', prerequisite: '', text: 'When a creature within 5 feet casts a spell, you can use your reaction to make a melee weapon attack against that creature. You have advantage on saving throws against spells cast by creatures within 5 feet of you.' },
    { id: 'magic-initiate', name: 'Magic Initiate', prerequisite: '', text: 'Choose a class: bard, cleric, druid, sorcerer, warlock, or wizard. Learn two cantrips and one 1st-level spell from that class. You can cast the 1st-level spell once per long rest. Spellcasting ability matches that class.' },
    { id: 'martial-adept', name: 'Martial Adept', prerequisite: '', text: 'Learn two maneuvers from the Battle Master list. Gain one superiority die (d6), recovered on short or long rest.' },
    { id: 'medium-armor-master', name: 'Medium Armor Master', prerequisite: 'Medium armor proficiency', text: 'Wearing medium armor doesn\'t impose disadvantage on Stealth. When you wear medium armor, you can add 3 (instead of 2) to AC if your DEX is 16+.' },
    { id: 'mobile', name: 'Mobile', prerequisite: '', text: 'Your speed increases by 10 feet. When you use Dash, difficult terrain doesn\'t cost extra movement that turn. After you make a melee attack against a creature, you don\'t provoke opportunity attacks from that creature for the rest of the turn.' },
    { id: 'moderately-armored', name: 'Moderately Armored', prerequisite: 'Light armor proficiency', text: 'Increase STR or DEX by 1. You gain proficiency with medium armor and shields.' },
    { id: 'mounted-combatant', name: 'Mounted Combatant', prerequisite: '', text: 'Advantage on melee attacks against unmounted creatures smaller than your mount. Force an attack targeting your mount to target you instead. If your mount is subjected to an effect that allows a DEX save for half damage, it takes no damage on a success and half on a failure.' },
    { id: 'observant', name: 'Observant', prerequisite: '', text: 'Increase INT or WIS by 1. If you can see a creature\'s mouth while it speaks a language you understand, you can read its lips. Your passive Perception and Investigation scores increase by 5.' },
    { id: 'polearm-master', name: 'Polearm Master', prerequisite: '', text: 'When you take the Attack action with a glaive, halberd, quarterstaff, or spear, you can use a bonus action to make a melee attack with the opposite end (d4 bludgeoning). While wielding those weapons, other creatures provoke an opportunity attack when they enter your reach.' },
    { id: 'resilient', name: 'Resilient', prerequisite: '', text: 'Increase one ability score by 1 and gain proficiency in saving throws using that ability.' },
    { id: 'ritual-caster', name: 'Ritual Caster', prerequisite: 'INT or WIS 13+', text: 'You gain a ritual book with two 1st-level ritual spells from one class (bard, cleric, druid, sorcerer, warlock, or wizard). You can only cast these as rituals. You can add more ritual spells to the book as you find them.' },
    { id: 'savage-attacker', name: 'Savage Attacker', prerequisite: '', text: 'Once per turn when you roll damage for a melee weapon attack, you can reroll the weapon\'s damage dice and use either total.' },
    { id: 'sentinel', name: 'Sentinel', prerequisite: '', text: 'When you hit a creature with an opportunity attack, its speed becomes 0 for the rest of the turn. Creatures provoke opportunity attacks from you even if they take the Disengage action. When a creature within 5 feet attacks a target other than you (and that target doesn\'t have this feat), you can use your reaction to make a melee weapon attack against the attacker.' },
    { id: 'sharpshooter', name: 'Sharpshooter', prerequisite: '', text: 'Attacking at long range doesn\'t impose disadvantage on your ranged weapon attack rolls. Your ranged weapon attacks ignore half and three-quarters cover. Before you make a ranged attack with a weapon you are proficient with, you can take -5 to hit for +10 damage.' },
    { id: 'shield-master', name: 'Shield Master', prerequisite: '', text: 'If you take the Attack action on your turn, you can use a bonus action to shove with your shield. If you aren\'t incapacitated, you can add your shield\'s AC bonus to a DEX save that targets only you. If an effect allows a DEX save for half damage, you can use your reaction to take no damage on a success.' },
    { id: 'skilled', name: 'Skilled', prerequisite: '', text: 'You gain proficiency in any combination of three skills or tools of your choice.' },
    { id: 'skulker', name: 'Skulker', prerequisite: 'DEX 13+', text: 'You can try to hide when you are lightly obscured. When you are hidden and miss with a ranged weapon attack, making the attack doesn\'t reveal your position. Dim light doesn\'t impose disadvantage on your Wisdom (Perception) checks relying on sight.' },
    { id: 'spell-sniper', name: 'Spell Sniper', prerequisite: 'Spellcasting', text: 'When you cast a spell that requires an attack roll, the spell\'s range is doubled. Your ranged spell attacks ignore half and three-quarters cover. You learn one cantrip that requires an attack roll (from bard, cleric, druid, sorcerer, warlock, or wizard).' },
    { id: 'tavern-brawler', name: 'Tavern Brawler', prerequisite: '', text: 'Increase STR or CON by 1. You are proficient with improvised weapons and unarmed strikes. Unarmed strike uses a d4. When you hit with an unarmed strike or improvised weapon, you can use a bonus action to attempt to grapple the target.' },
    { id: 'tough', name: 'Tough', prerequisite: '', text: 'Your hit point maximum increases by 2 × your level when you gain this feat, and by 2 whenever you gain a level thereafter.' },
    { id: 'war-caster', name: 'War Caster', prerequisite: 'Spellcasting', text: 'Advantage on CON saves to maintain concentration. You can perform somatic components even when hands are full with weapons or a shield. When a creature\'s movement provokes an opportunity attack from you, you can use your reaction to cast a spell at it (1 action casting time, targets only that creature) instead of making an opportunity attack.' },
    { id: 'weapon-master', name: 'Weapon Master', prerequisite: '', text: 'Increase STR or DEX by 1. You gain proficiency with four simple or martial weapons of your choice.' }
  ];

  function getFeatLibrary() {
    const byId = new Map();
    const add = (f, source) => {
      if (!f || !f.name) return;
      const id = String(f.id || f.name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const key = id || f.name.toLowerCase();
      if (byId.has(key)) return;
      if ([...byId.values()].some(x => x.name.toLowerCase() === String(f.name).toLowerCase())) return;
      byId.set(key, {
        id: key,
        name: f.name,
        prerequisite: f.prerequisite || '',
        text: f.text || f.description || f.notes || '',
        source: source || f.source || ''
      });
    };
    if (typeof SRD_FEATS !== 'undefined') SRD_FEATS.forEach(f => add(f, 'SRD'));
    const custom = (typeof window !== 'undefined' && Array.isArray(window.CUSTOM_FEATS)) ? window.CUSTOM_FEATS : [];
    custom.forEach(f => add(f, f.source || 'Custom'));
    const extra = (typeof window !== 'undefined' && Array.isArray(window.FEATS)) ? window.FEATS : [];
    extra.forEach(f => add(f, f.source || 'Imported'));
    const equip = (typeof window !== 'undefined' && window.EQUIPMENT) ? window.EQUIPMENT : [];
    equip.forEach(e => {
      if (!e || !e.isFeat) return;
      add({
        id: e.id,
        name: String(e.name || '').replace(/\s*\(Feat\)\s*$/i, '').trim(),
        text: e.notes || e.description || '',
        prerequisite: ''
      }, e.source || 'Imported');
    });
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  function findFeat(idOrName) {
    if (!idOrName) return null;
    const k = String(idOrName).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const name = String(idOrName).toLowerCase();
    return getFeatLibrary().find(f => f.id === k || f.id === name || f.name.toLowerCase() === name) || null;
  }


  // ─── Ability Score Improvements (ASI) / Feat choices ─────────────────────
  // Best practice: track each slot; allow limited player re-picks; DM unlimited.
  const ASI_PLAYER_MAX_EDITS = 3; // initial choice + 2 mind-changes

  function isPlayerApp() {
    if (typeof window !== 'undefined' && window.DSC_APP_MODE === 'player') return true;
    try {
      return /player companion/i.test(document.title || '');
    } catch (e) { return false; }
  }

  function asiLevelsForClass(className) {
    const n = String(className || '');
    if (n === 'Fighter') return [4, 6, 8, 12, 14, 16, 19];
    if (n === 'Rogue') return [4, 8, 10, 12, 16, 19];
    // Epic optional: every 4 levels above 20 for that class
    const base = [4, 8, 12, 16, 19];
    return base;
  }

  function asiBudgetSummary(ch) {
    const slots = getAsiSlots(ch);
    const choices = getAsiChoices(ch);
    const claimed = choices.filter(c => {
      if (!c || !c.id) return false;
      if (c.type === 'feat') return !!(c.featId || c.featName);
      if (c.type === 'asi') {
        const sum = Object.values(c.scores || {}).reduce((a, b) => a + (Number(b) || 0), 0);
        return sum === 2;
      }
      return false;
    });
    const feats = claimed.filter(c => c.type === 'feat').length;
    const asis = claimed.filter(c => c.type === 'asi').length;
    return {
      total: slots.length,
      claimed: claimed.length,
      open: Math.max(0, slots.length - claimed.length),
      feats,
      asis
    };
  }

  function getAsiSlots(ch) {
    const list = normalizeClassLevels(ch);
    const slots = [];
    list.forEach(c => {
      const levels = asiLevelsForClass(c.name);
      levels.forEach(L => {
        if ((c.level || 0) >= L) {
          slots.push({
            id: `${c.name}|${L}`,
            className: c.name,
            level: L,
            label: `${c.name} L${L}`
          });
        }
      });
      // Epic: class levels > 20 → ASI every 4 class levels after 20
      if ((c.level || 0) > 20) {
        for (let L = 24; L <= c.level; L += 4) {
          slots.push({
            id: `${c.name}|${L}`,
            className: c.name,
            level: L,
            label: `${c.name} L${L} (epic)`
          });
        }
      }
    });
    return slots;
  }

  function getAsiChoices(ch) {
    return Array.isArray(ch.asiChoices) ? ch.asiChoices.map(c => ({ ...c })) : [];
  }

  function findAsiChoice(choices, slotId) {
    return (choices || []).find(c => c.id === slotId) || null;
  }

  function asiSlotLocked(choice) {
    if (!choice) return false;
    if (choice.locked) return true;
    if (isPlayerApp() && (choice.editCount || 0) >= ASI_PLAYER_MAX_EDITS) return true;
    return false;
  }


  function openLevelUpDialog() { /* stripped */ return null; }


  function asiEditorHtml() { /* stripped */ return null; }

  function wireAsiEditor() { /* stripped */ return null; }

  function applyAsiToAbilityInputs(choices, ch) {
    // Store baseline once (scores without ASI) on the form
    let base = window.__asiBaseline;
    if (!base) {
      base = {};
      ABS.forEach(a => {
        const el = document.getElementById('m-' + a);
        const cur = el ? (parseInt(el.value, 10) || 10) : (Number(ch?.[a]) || 10);
        // Subtract any existing ASI from current to recover baseline
        let asiSum = 0;
        (choices || getAsiChoices(ch) || []).forEach(c => {
          if (c.type === 'asi' && c.scores) asiSum += Number(c.scores[a]) || 0;
        });
        // When baseline first captured from ch that already includes ASI, strip them
        base[a] = cur;
      });
      // Recompute baseline from ch if we have stored baseline on character
      if (ch && ch.abilityBase) {
        ABS.forEach(a => { base[a] = Number(ch.abilityBase[a]) || base[a]; });
      } else if (ch) {
        // Strip current ASI from displayed totals to form baseline
        const strip = { ...base };
        (ch.asiChoices || []).forEach(c => {
          if (c.type === 'asi' && c.scores) {
            ABS.forEach(a => { strip[a] = (strip[a] || 10) - (Number(c.scores[a]) || 0); });
          }
        });
        base = strip;
      }
      window.__asiBaseline = base;
    }
    const totals = { ...base };
    (choices || []).forEach(c => {
      if (c.type === 'asi' && c.scores) {
        ABS.forEach(a => { totals[a] = (totals[a] || 10) + (Number(c.scores[a]) || 0); });
      }
    });
    ABS.forEach(a => {
      const el = document.getElementById('m-' + a);
      if (el) el.value = String(Math.max(1, Math.min(30, totals[a] || 10)));
    });
    // Sync feats from ASI feat picks into feats json (add only; removals of ASI-feats handled on collect)
  }

  function collectAsiFromForm() {
    const hidden = document.getElementById('m-asi-json');
    if (!hidden) return [];
    try {
      const list = JSON.parse(hidden.value || '[]');
      return list.filter(c => c && c.id && (c.type === 'feat' || c.type === 'asi'));
    } catch (e) { return []; }
  }

  function mergeAsiFeatsIntoFeats(asiChoices, existingFeats) {
    const feats = Array.isArray(existingFeats) ? existingFeats.slice() : [];
    const asiFeatIds = new Set(
      (asiChoices || []).filter(c => c.type === 'feat' && c.featId).map(c => c.featId)
    );
    // Keep non-ASI feats + current ASI feats
    const kept = feats.filter(f => !f.fromAsi);
    asiFeatIds.forEach(id => {
      const feat = findFeat(id);
      if (!feat) return;
      if (kept.some(f => f.id === feat.id || f.name === feat.name)) return;
      kept.push({
        id: feat.id,
        name: feat.name,
        text: feat.text || '',
        prerequisite: feat.prerequisite || '',
        fromAsi: true
      });
    });
    return kept;
  }

  function abilityBaseFromCharacter(ch) {
    const base = {};
    const choices = getAsiChoices(ch);
    ABS.forEach(a => {
      let v = Number(ch[a]) || 10;
      choices.forEach(c => {
        if (c.type === 'asi' && c.scores) v -= Number(c.scores[a]) || 0;
      });
      base[a] = v;
    });
    return base;
  }


  function featsEditorHtml(ch) {
    const selected = Array.isArray(ch.feats) ? ch.feats : [];
    const selIds = new Set(selected.map(f => (f.id || f.name || '').toLowerCase()));
    const chips = selected.map((f, i) => {
      const name = f.name || findFeat(f.id)?.name || f.id;
      return `<span class="feat-chip" data-feat-id="${escapeAttr(f.id || name)}">${escapeHtml(name)} <button type="button" class="feat-remove" data-idx="${i}" title="Remove">×</button></span>`;
    }).join('');
    const asiLevels = [4, 8, 12, 16, 19];
    const total = totalCharacterLevel(ch);
    const classLevels = normalizeClassLevels(ch);
    const asiNotes = [];
    classLevels.forEach(c => {
      asiLevels.forEach(L => {
        if (c.level >= L) asiNotes.push(`${c.name} L${L}`);
      });
    });
    return `
      <div class="sheet-section" id="m-feats-section">
        <label class="section-label">Feats</label>
        <p class="muted small">Pick a feat below and click <strong>Add selected feat</strong> — it consumes the next open <strong>ASI / Feat</strong> slot. You can also choose Feat inside each ASI slot. Removing a feat frees its slot.</p>
        ${asiNotes.length ? `<p class="muted small">ASI / feat slots reached: <strong>${asiNotes.join(', ')}</strong></p>` : ''}
        <div id="m-feats-selected" class="feat-chips">${chips || '<span class="muted small">No feats selected</span>'}</div>
        <div class="form-row">
          <div class="field" style="flex:1">
            <label>Add feat</label>
            <input type="search" id="m-feat-search" placeholder="Search feats…" />
            <select id="m-feat-pick" size="6" style="width:100%;margin-top:0.35rem">
              ${getFeatLibrary().map(f => `<option value="${escapeAttr(f.id)}" title="${escapeAttr((f.prerequisite ? 'Prereq: ' + f.prerequisite + ' — ' : '') + f.text)}">${escapeHtml(f.name)}${f.prerequisite ? ' *' : ''}</option>`).join('')}
            </select>
          </div>
        </div>
        <p class="muted small" id="m-feat-detail"></p>
        <button type="button" class="btn secondary btn-tiny" id="m-feat-add">Add selected feat</button>
        <input type="hidden" id="m-feats-json" value="${escapeAttr(JSON.stringify(selected))}" />
      </div>`;
  }

  function wireFeatsEditor() { /* stripped */ return null; }

  function releaseAsiFeatSlot(featIdOrName) {
    const asiHidden = document.getElementById('m-asi-json');
    if (!asiHidden) return;
    let list = [];
    try { list = JSON.parse(asiHidden.value || '[]'); } catch (e) { return; }
    const k = String(featIdOrName || '').toLowerCase();
    list = list.filter(c => {
      if (c.type !== 'feat') return true;
      const id = String(c.featId || '').toLowerCase();
      const name = String(c.featName || '').toLowerCase();
      return id !== k && name !== k;
    });
    asiHidden.value = JSON.stringify(list);
    const ch = window.__editingCharacter || {};
    const slots = (typeof getAsiSlots === 'function') ? getAsiSlots(ch) : [];
    const label = document.querySelector('#m-asi-section .section-label');
    if (label) {
      const claimed = list.filter(c => c.type === 'feat' || (c.type === 'asi' && Object.values(c.scores||{}).reduce((a,b)=>a+(Number(b)||0),0)===2));
      label.innerHTML = `ASI / Feat Choices <span class="muted small">(${claimed.length}/${slots.length} used · ${Math.max(0, slots.length - claimed.length)} open)</span>`;
    }
  }


  function collectFeatsFromForm() {
    const hidden = document.getElementById('m-feats-json');
    if (!hidden) return [];
    try { return JSON.parse(hidden.value || '[]'); } catch (e) { return []; }
  }


  function asiSheetHtml(ch) {
    const slots = getAsiSlots(ch);
    const choices = getAsiChoices(ch);
    if (!slots.length) return '';
    const lines = slots.map(s => {
      const c = findAsiChoice(choices, s.id);
      if (!c) return `<div><strong>${escapeHtml(s.label)}:</strong> <span class="muted">Unclaimed</span></div>`;
      if (c.type === 'feat') return `<div><strong>${escapeHtml(s.label)}:</strong> Feat — ${escapeHtml(c.featName || c.featId || '—')}</div>`;
      const parts = ABS.filter(a => c.scores && c.scores[a]).map(a => `${a.toUpperCase()} +${c.scores[a]}`);
      return `<div><strong>${escapeHtml(s.label)}:</strong> ${escapeHtml(parts.join(', ') || 'ASI')}</div>`;
    }).join('');
    return `<div class="cs-panel"><div class="cs-panel-title">ASI / Feat Choices</div><div class="cs-body">${lines}</div></div>`;
  }

  function featsSheetHtml(ch) {
    const list = Array.isArray(ch.feats) ? ch.feats : [];
    if (!list.length) return '';
    return `<div class="cs-panel"><div class="cs-panel-title">Feats</div>
      <ul class="trait-list compact">
        ${list.map(f => {
          const full = findFeat(f.id) || f;
          const prereq = full.prerequisite ? ` <span class="muted small">(${escapeHtml(full.prerequisite)})</span>` : '';
          return `<li><strong>${escapeHtml(full.name || f.name)}</strong>${prereq}. ${formatRichText(full.text || f.text || '')}</li>`;
        }).join('')}
      </ul>
    </div>`;
  }




  // ─── Class resource pools (Ki, Lunar Charges, Rage, Channel Divinity, etc.) ─
  function lunarChargesMax(mgLevel) {
    const L = clamp(Number(mgLevel) || 0, 0, 40);
    if (L < 2) return 0;
    if (L < 5) return 2;
    if (L < 9) return 3;
    if (L < 13) return 4;
    if (L < 17) return 5;
    let n = 6;
    if (L >= 10) n += 1;
    if (L >= 17) n += 1;
    return n;
  }

  function classResourcesForCharacter(ch) {
    const list = normalizeClassLevels(ch);
    const resources = [];
    const push = (id, label, max, recover, className) => {
      if (max <= 0) return;
      resources.push({
        id,
        label,
        max,
        recover: recover || '',
        className: className || ''
      });
    };

    list.forEach(c => {
      const name = c.name;
      const lvl = clamp(Number(c.level) || 1, 1, 40);
      const sub = (c.subclass || '').toLowerCase();

      // Monk
      if (name === 'Monk' && lvl >= 2) {
        push('ki', 'Ki Points', lvl, 'Short Rest', 'Monk');
      }
      // Moon Guardian
      if (name === 'Moon Guardian' && lvl >= 2) {
        push('lunar', 'Lunar Charges', lunarChargesMax(lvl), 'Long Rest; Lunar Recovery (half on Short Rest, 1/LR)', 'Moon Guardian');
      }
      // Barbarian
      if (name === 'Barbarian') {
        const rage = lvl < 3 ? 2 : lvl < 6 ? 3 : lvl < 12 ? 4 : lvl < 17 ? 5 : lvl < 20 ? 6 : 99;
        push('rage', 'Rages', rage === 99 ? 99 : rage, 'Long Rest (unlimited at 20)', 'Barbarian');
      }
      // Sorcerer
      if (name === 'Sorcerer' && lvl >= 1) {
        push('sorcery', 'Sorcery Points', lvl, 'Long Rest', 'Sorcerer');
      }
      // Warlock — pact slots tracked in spell slots; Arcane Focus uses separate
      if (name === 'Warlock' && lvl >= 11) {
        // Mystic Arcanum not a pool
      }
      // Fighter — Action Surge / Second Wind / Superiority
      if (name === 'Fighter') {
        if (lvl >= 1) push('second-wind', 'Second Wind', 1, 'Short Rest', 'Fighter');
        if (lvl >= 2) push('action-surge', 'Action Surge', lvl >= 17 ? 2 : 1, 'Short Rest', 'Fighter');
        if (lvl >= 9) push('indomitable', 'Indomitable', lvl >= 17 ? 3 : lvl >= 13 ? 2 : 1, 'Long Rest', 'Fighter');
        if (/battle.?master|battlemaster/i.test(sub) && lvl >= 3) {
          const die = lvl < 7 ? 4 : lvl < 15 ? 5 : 6;
          push('superiority', 'Superiority Dice', die, 'Short Rest', 'Fighter');
        }
      }
      // Rogue — no major pool (Sneak Attack is dice)
      // Cleric / Paladin Channel Divinity
      if (name === 'Cleric' && lvl >= 2) {
        const chd = lvl >= 18 ? 3 : lvl >= 6 ? 2 : 1;
        push('channel-divinity', 'Channel Divinity', chd, 'Short Rest', 'Cleric');
      }
      if (name === 'Paladin' && lvl >= 3) {
        push('channel-divinity', 'Channel Divinity', 1, 'Short Rest', 'Paladin');
        // Lay on Hands
        push('lay-on-hands', 'Lay on Hands (HP pool)', lvl * 5, 'Long Rest', 'Paladin');
      }
      // Druid Wild Shape
      if (name === 'Druid' && lvl >= 2) {
        push('wild-shape', 'Wild Shape', 2, 'Short Rest', 'Druid');
      }
      // Bard Bardic Inspiration
      if (name === 'Bard' && lvl >= 1) {
        const cha = Number(ch.cha) || 10;
        const uses = Math.max(1, Math.floor((cha - 10) / 2));
        push('bardic', 'Bardic Inspiration', uses, lvl >= 5 ? 'Short Rest' : 'Long Rest', 'Bard');
      }
      // Ranger — Favored Foe optional; skip
      // Bloodhunter
      if (name === 'Bloodhunter') {
        push('blood-maledict', 'Blood Maledict', Math.max(1, Math.floor((lvl - 1) / 6) + 1), 'Short Rest', 'Bloodhunter');
        if (lvl >= 2) {
          // Rite - often at-will after unlock; track crimson rite as optional
        }
      }
      // Ghostblade
      if (name === 'Ghostblade' && lvl >= 2) {
        push('spirit-step', 'Spirit Step', Math.max(1, Math.ceil(lvl / 4)), 'Short Rest', 'Ghostblade');
      }
      // Shadowblade
      if (name === 'Shadowblade' && lvl >= 2) {
        push('shadow-surge', 'Shadow Surge', Math.max(1, Math.ceil(lvl / 3)), 'Short Rest', 'Shadowblade');
      }
      // Wizard Arcane Recovery (special - slots not points)
      if (name === 'Wizard' && lvl >= 1) {
        push('arcane-recovery', 'Arcane Recovery (used)', 1, 'Long Rest (recover slots ≤ half wizard level on Short Rest once)', 'Wizard');
      }
    });

    // Deduplicate ids (e.g. two Channel Divinity sources) — keep highest max
    const byId = new Map();
    resources.forEach(r => {
      const prev = byId.get(r.id);
      if (!prev || prev.max < r.max) byId.set(r.id, r);
      else if (prev && prev.className !== r.className) {
        byId.set(r.id, { ...prev, label: prev.label, className: prev.className + ' + ' + r.className });
      }
    });
    return [...byId.values()];
  }


  
  function bonusActionOptionsForCharacter(ch) {
    if (!ch) return [];
    const opts = [];
    const seen = new Set();
    const push = (id, label, limit, note, extraBA) => {
      if (seen.has(id)) return;
      seen.add(id);
      opts.push({ id: id, label: label, limit: limit || '', note: note || '', grantsExtraBA: !!extraBA });
    };
    let list = [];
    try {
      if (typeof normalizeClassLevels === 'function') list = normalizeClassLevels(ch) || [];
    } catch (e) {}
    if (!list.length && (ch.className || ch.class)) {
      list = [{ name: ch.className || ch.class, level: Number(ch.level) || 1, subclass: ch.subclass || '' }];
    }
    if (Array.isArray(ch.classes) && !list.length) {
      list = ch.classes.map(function(c) {
        return typeof c === 'string' ? { name: c, level: Number(ch.level) || 1 } : { name: c.name || c.className || '', level: Number(c.level) || 1, subclass: c.subclass || '' };
      });
    }
    list.forEach(function(cl) {
      const name = String(cl.name || '');
      const lvl = Number(cl.level) || 1;
      const sub = String(cl.subclass || ch.subclass || '').toLowerCase();
      const low = name.toLowerCase();
      if (low === 'barbarian') {
        const rageMax = lvl < 3 ? 2 : lvl < 6 ? 3 : lvl < 12 ? 4 : lvl < 17 ? 5 : lvl < 20 ? 6 : 99;
        push('rage', 'Rage', rageMax >= 99 ? 'Unlimited (20)' : rageMax + '/LR', 'Bonus action to enter rage');
      }
      if (low === 'fighter' && lvl >= 1) {
        push('second-wind', 'Second Wind', '1/SR', 'Bonus action; regain 1d10 + fighter level HP');
      }
      if (low === 'rogue' && lvl >= 2) {
        push('cunning-action', 'Cunning Action', 'Each turn', 'Bonus action: Dash, Disengage, or Hide');
      }
      if (low === 'monk') {
        if (lvl >= 1) push('martial-arts-ba', 'Martial Arts (bonus strike)', 'After Attack action', 'Bonus unarmed or monk weapon attack');
        if (lvl >= 2) {
          push('patient-defense', 'Patient Defense', '1 Ki', 'Bonus action: Dodge');
          push('step-of-the-wind', 'Step of the Wind', '1 Ki', 'Bonus action: Dash or Disengage');
          push('flurry-of-blows', 'Flurry of Blows', '1 Ki', 'Bonus action after Attack: two unarmed strikes');
        }
      }
      if (low === 'moon guardian' && lvl >= 2) {
        push('lunar-ba', 'Lunar feature (bonus)', 'Lunar Charges', 'Path-dependent Moon Guardian bonus action');
      }
      if (low === 'bard' && lvl >= 1) {
        push('bardic-inspiration', 'Bardic Inspiration', 'CHA mod / LR (SR at 5+)', 'Bonus action; inspire one creature within 60 ft');
      }
      if (low === 'sorcerer' && lvl >= 2) {
        push('quickened-spell', 'Quickened Spell', '2 sorcery points', 'Cast a 1-action spell as a bonus action');
      }
      if (low === 'warlock') {
        push('hex-ba', 'Hex (cast / move)', 'Spell slot / free move', 'BA to cast Hex; BA to move after target drops');
      }
      if (low === 'ranger') {
        push('hunters-mark-ba', "Hunter's Mark", 'Spell slot', 'Bonus action to cast; BA to retarget');
      }
      if (low === 'paladin' && lvl >= 3) {
        // many oath features
        push('paladin-ba', 'Oath / channel option', 'Per feature', 'Some oath features use a bonus action');
      }
      if (low === 'cleric') {
        push('spiritual-weapon', 'Spiritual Weapon', 'Spell slot', 'Bonus action to cast; BA to attack with it');
      }
    });

    // Equipment / inventory scan for bonus-action items
    const inv = [].concat(ch.inventory || [], ch.equipment || [], ch.items || [], ch.magicItems || []);
    inv.forEach(function(item, idx) {
      if (!item) return;
      const name = String(item.name || item.label || item.id || (typeof item === 'string' ? item : '')).trim();
      if (!name) return;
      const desc = String(item.description || item.desc || item.notes || item.text || item.effect || '').toLowerCase();
      const props = String(item.properties || item.activation || item.usage || '').toLowerCase();
      const blob = (name + ' ' + desc + ' ' + props).toLowerCase();
      const isBA = /bonus action|as a bonus action|bonus-action/.test(blob)
        || item.bonusAction === true
        || String(item.actionType || item.activationType || '').toLowerCase().indexOf('bonus') !== -1;
      // Common BA gear patterns even without explicit text
      const commonBA = /boots of speed|winged boots|cape of the mountebank|dagger of venom|flame tongue|sun blade|moonblade|luck blade|ring of spell storing|wand of|staff of|necklace of fireballs|heward|efficient quiver/i.test(name);
      if (!isBA && !commonBA) return;
      const charges = item.charges != null ? item.charges : (item.maxCharges != null ? item.maxCharges : null);
      const limit = charges != null ? (charges + ' charges') : (item.attunement ? 'Attuned item' : 'Item');
      const id = 'item-' + (item.id || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40) + '-' + idx);
      push(id, name + (isBA || commonBA ? '' : ''), limit, (desc || 'Equipment — uses bonus action').slice(0, 160));
    });

    // Weapon TWF
    push('two-weapon', 'Two-Weapon Fighting', 'If dual wielding', 'Bonus action off-hand attack after Attack action');
    push('other-ba', 'Other bonus action', '—', 'Spell or feature not listed (Healing Word, Misty Step, …)');
    return opts;
  }


  function attacksPerAction(ch) {
    if (!ch) return 1;
    let n = 1;
    let list = [];
    try {
      if (typeof normalizeClassLevels === 'function') list = normalizeClassLevels(ch) || [];
    } catch (e) { list = []; }
    // Fallback: single class fields
    if (!list.length) {
      const cn = ch.className || ch.class || (ch.classes && ch.classes[0] && (ch.classes[0].name || ch.classes[0])) || '';
      const lv = Number(ch.level) || Number(ch.totalLevel) || 1;
      if (cn) list = [{ name: cn, level: lv }];
      // multiclass array without normalize
      if (Array.isArray(ch.classes)) {
        list = ch.classes.map(function(c) {
          if (typeof c === 'string') return { name: c, level: lv };
          return { name: c.name || c.className || c.class || '', level: Number(c.level) || 1 };
        });
      }
      if (Array.isArray(ch.classLevels)) {
        list = ch.classLevels.map(function(c) {
          return { name: c.name || c.className || '', level: Number(c.level) || 1 };
        });
      }
    }
    // Official rule: Extra Attack does not stack across classes — take the best progression
    list.forEach(function(c) {
      const name = String(c.name || c.className || '').trim();
      const lvl = Number(c.level) || 1;
      const low = name.toLowerCase();
      // Fighter (and Echo Knight etc.): 5→2, 11→3, 20→4
      if (low === 'fighter' || low.indexOf('fighter') === 0) {
        if (lvl >= 20) n = Math.max(n, 4);
        else if (lvl >= 11) n = Math.max(n, 3);
        else if (lvl >= 5) n = Math.max(n, 2);
      } else if ([
        'barbarian','monk','paladin','ranger','moon guardian','bloodhunter','blood hunter',
        'ghostblade','bladesinger','valor','college of valor','college of swords'
      ].some(function(x) { return low === x || low.indexOf(x) !== -1; })) {
        // Extra Attack at 5 (Valor/Swords Bard / Bladesinger often at 6)
        const thr = (low.indexOf('valor') !== -1 || low.indexOf('swords') !== -1 || low.indexOf('bladesinger') !== -1) ? 6 : 5;
        if (lvl >= thr) n = Math.max(n, 2);
      }
      // Path of the Beast / other subclass extras not auto-counted
    });
    // Subclass on character may grant Extra Attack at 6 (Valor Bard stored as Bard)
    const sub = String(ch.subclass || ch.subClass || '').toLowerCase();
    const totalLvl = list.reduce(function(s, c) { return s + (Number(c.level) || 0); }, 0) || Number(ch.level) || 1;
    if ((sub.indexOf('valor') !== -1 || sub.indexOf('swords') !== -1 || sub.indexOf('bladesinger') !== -1) && totalLvl >= 6) {
      n = Math.max(n, 2);
    }
    return Math.max(1, n);
  }

  function mergeCondition(existing, add) {
    const cur = String(existing || '').trim();
    if (!add) return cur;
    if (!cur) return add;
    const parts = cur.split(/[,;]+/).map(s => s.trim()).filter(Boolean);
    if (parts.some(p => p.toLowerCase() === String(add).toLowerCase())) return cur;
    return parts.concat([add]).join(', ');
  }

  function parseSpeed(v) {
    if (v == null || v === '') return 30;
    if (typeof v === 'number' && !isNaN(v) && v > 0) return v;
    const m = String(v).match(/(\d+)/);
    return m ? Math.max(0, Number(m[1])) : 30;
  }

  function ensureCombatantTurnState(cb, ch) {
    if (!cb) return;
    // Recalc from class levels unless DM locked the budget
    if (!cb.attacksMaxLocked) {
      cb.attacksMax = attacksPerAction(ch);
    } else if (cb.attacksMax == null) {
      cb.attacksMax = attacksPerAction(ch);
    }
    if (cb.attacksUsed == null) cb.attacksUsed = 0;
    if (cb.attacksUsed > cb.attacksMax) cb.attacksUsed = cb.attacksMax;
    // Full turn economy defaults
    if (cb.speed == null || (typeof cb.speed === 'number' && isNaN(cb.speed))) cb.speed = parseSpeed(ch && ch.speed);
    if (cb.moveUsed == null) cb.moveUsed = 0;
    if (cb.actionUsed == null) cb.actionUsed = false;
    if (cb.bonusUsed == null) cb.bonusUsed = false;
    if (cb.objectInteractUsed == null) cb.objectInteractUsed = false;
    if (cb.reactionUsed == null) cb.reactionUsed = false;
    if (cb.turnPhase == null) cb.turnPhase = 'ready'; // ready | active | ended

    if (ch && typeof classResourcesForCharacter === 'function') {
      const pools = classResourcesForCharacter(ch) || [];
      const prev = cb.combatResources || {};
      const fromChar = (ch.resourceUsed && typeof ch.resourceUsed === 'object') ? ch.resourceUsed : {};
      const next = {};
      pools.forEach(function(r) {
        const prevUsed = prev[r.id] && prev[r.id].used != null ? Number(prev[r.id].used) : null;
        const charUsed = fromChar[r.id] != null ? Number(fromChar[r.id]) : null;
        const u = prevUsed != null ? prevUsed : (charUsed != null ? charUsed : 0);
        next[r.id] = {
          label: r.label,
          max: r.max,
          used: Math.max(0, u),
          recover: r.recover || '',
          className: r.className || ''
        };
      });
      // keep any ad-hoc combat-only pools
      Object.keys(prev).forEach(function(k) {
        if (!next[k]) next[k] = prev[k];
      });
      cb.combatResources = next;
    }
    if (ch && (!cb.combatSpellSlots || !Object.keys(cb.combatSpellSlots).length)) {
      try {
        const used = ch.spellSlotsUsed || {};
        const fromChar = ch.spellSlots || ch.spell_slots || {};
        let maxes = typeof getMulticlassSpellSlotMaxes === 'function' ? getMulticlassSpellSlotMaxes(ch) : null;
        if (!maxes || !Object.keys(maxes).length) {
          maxes = {};
          for (let L = 1; L <= 9; L++) {
            const m = fromChar[L] != null ? Number(fromChar[L]) : (fromChar[String(L)] != null ? Number(fromChar[String(L)]) : 0);
            if (m > 0) maxes[L] = m;
          }
        }
        if (!Object.keys(maxes).length) {
          const cls = String(ch.class || (ch.classes && ch.classes[0] && ch.classes[0].name) || '').toLowerCase();
          const lvl = Number(ch.level) || 1;
          if (/cleric|druid|bard|wizard|sorcerer|warlock|paladin|ranger|artificer|priest|moon guardian/.test(cls)) {
            maxes[1] = lvl >= 1 ? (lvl >= 3 ? 4 : (lvl >= 2 ? 3 : 2)) : 0;
            if (lvl >= 3) maxes[2] = lvl >= 4 ? 3 : 2;
            if (lvl >= 5) maxes[3] = 2;
            if (lvl >= 7) maxes[4] = 1;
            if (lvl >= 9) maxes[5] = 1;
          }
        }
        if (maxes && Object.keys(maxes).length) {
          cb.combatSpellSlots = {};
          for (let L = 1; L <= 9; L++) {
            const m = Number(maxes[L] || maxes[String(L)] || 0);
            if (m > 0) {
              const u = used[L] != null ? Number(used[L]) : (used[String(L)] != null ? Number(used[String(L)]) : 0);
              cb.combatSpellSlots[L] = { max: m, used: Math.min(m, Math.max(0, u)) };
            }
          }
          // If sheet had every slot spent, refill for this encounter so casting works
          let remain = 0;
          Object.keys(cb.combatSpellSlots).forEach(L => {
            const r = cb.combatSpellSlots[L];
            remain += Math.max(0, (r.max || 0) - (r.used || 0));
          });
          if (remain === 0) {
            Object.keys(cb.combatSpellSlots).forEach(L => {
              cb.combatSpellSlots[L].used = 0;
            });
            cb._slotsRefilledForEncounter = true;
          }
        }
        // Warlock pact
        const wl = typeof warlockLevels === 'function' ? warlockLevels(ch) : 0;
        if (wl > 0 && window.SPELL_SLOTS_WARLOCK) {
          const row = window.SPELL_SLOTS_WARLOCK[Math.min(wl, 20)];
          if (row) {
            cb.pactSlotLevel = row[0];
            cb.pactSlotsMax = row[1];
            cb.pactSlotsUsed = used.pact != null ? Number(used.pact) : 0;
          }
        }
      } catch (e) {}
    }
  }

  function syncCombatResourcesToCharacter(cb) {
    if (!cb) return;
    const id = cb.charId || cb.sourceId;
    if (!id) return;
    try {
      const c = getActive();
      if (!c) return;
      const lists = [c.party, c.villains];
      for (const list of lists) {
        if (!Array.isArray(list)) continue;
        const ch = list.find(x => x.id === id);
        if (!ch) continue;
        if (cb.combatResources) {
          ch.resourceUsed = ch.resourceUsed || {};
          Object.keys(cb.combatResources).forEach(rid => {
            ch.resourceUsed[rid] = cb.combatResources[rid].used || 0;
          });
        }
        if (cb.combatSpellSlots) {
          ch.spellSlotsUsed = ch.spellSlotsUsed || {};
          Object.keys(cb.combatSpellSlots).forEach(L => {
            ch.spellSlotsUsed[L] = cb.combatSpellSlots[L].used || 0;
          });
        }
        if (cb.pactSlotsUsed != null) {
          ch.spellSlotsUsed = ch.spellSlotsUsed || {};
          ch.spellSlotsUsed.pact = cb.pactSlotsUsed;
        }
      }
    } catch (e) {}
  }

  function combatResourcesHtml(cb) {
    const res = cb.combatResources || {};
    const keys = Object.keys(res);
    if (!keys.length) return '';
    return `<div class="detail-block">
      <div class="detail-label">Class Resources</div>
      <div class="combat-res-list">
        ${keys.map(k => {
          const r = res[k];
          const left = r.max >= 99 ? '∞' : Math.max(0, r.max - (r.used || 0));
          const maxL = r.max >= 99 ? '∞' : r.max;
          return `<div class="combat-res-row" data-res="${escapeAttr(k)}">
            <span class="combat-res-name" title="${escapeAttr(r.recover || '')}">${escapeHtml(r.label)}</span>
            <button type="button" class="btn secondary btn-tiny cd-res-dec" data-res="${escapeAttr(k)}">−</button>
            <span class="combat-res-val"><strong>${left}</strong>/${maxL}</span>
            <button type="button" class="btn secondary btn-tiny cd-res-inc" data-res="${escapeAttr(k)}">+</button>
            <button type="button" class="btn secondary btn-tiny cd-res-spend" data-res="${escapeAttr(k)}" title="Spend 1">Use</button>
          </div>`;
        }).join('')}
      </div>
    </div>`;
  }

  
  function abilityModFromScore(score) {
    const n = Number(score);
    if (isNaN(n)) return 0;
    return Math.floor((n - 10) / 2);
  }

  function getCharacterCastingAbility(ch) {
    if (!ch) return 'WIS';
    if (ch.spellcastingAbility) return String(ch.spellcastingAbility).toUpperCase().slice(0, 3);
    const list = (typeof normalizeClassLevels === 'function') ? normalizeClassLevels(ch) : [];
    const priority = ['Wizard','Sorcerer','Bard','Warlock','Cleric','Druid','Paladin','Ranger','Artificer','Moon Guardian'];
    for (const p of priority) {
      if (list.some(c => c.name === p) || ch.class === p) {
        if (p === 'Wizard' || p === 'Artificer') return 'INT';
        if (p === 'Sorcerer' || p === 'Bard' || p === 'Warlock' || p === 'Moon Guardian') return 'CHA';
        if (p === 'Cleric' || p === 'Druid' || p === 'Ranger') return 'WIS';
        if (p === 'Paladin') return 'CHA';
      }
    }
    return 'WIS';
  }

  function getSpellAttackAndDC(ch) {
    const ab = getCharacterCastingAbility(ch);
    const key = ab.toLowerCase();
    const score = ch ? (ch[key] != null ? ch[key] : ch[ab]) : 10;
    const mod = abilityModFromScore(score);
    const pb = ch && ch.profBonus != null ? Number(ch.profBonus) : (typeof proficiencyBonusForLevel === 'function' ? proficiencyBonusForLevel(ch && ch.level) : 2);
    return {
      ability: ab,
      mod: mod,
      attack: pb + mod,
      dc: 8 + pb + mod,
      pb: pb
    };
  }

  function lookupSpellByName(name) {
    if (!name) return null;
    const bare = String(name).replace(/\s*\(\d+\w*\)\s*$/, '').trim().toLowerCase();
    const list = window.SPELLS || window.SPELLS_BASE || [];
    let hit = list.find(s => String(s.name || '').toLowerCase() === bare || String(s.id || '').toLowerCase() === bare);
    if (hit) return hit;
    hit = list.find(s => String(s.name || '').toLowerCase().replace(/\s+/g, ' ') === bare);
    if (hit) return hit;
    return list.find(s => String(s.name || '').toLowerCase().includes(bare) || bare.includes(String(s.name || '').toLowerCase())) || null;
  }

  function parseSpellLevelFromLabel(label) {
    const m = String(label || '').match(/\((\d+)(?:st|nd|rd|th)?\)/i);
    if (m) return Number(m[1]);
    const sp = lookupSpellByName(label);
    return sp && sp.level != null ? Number(sp.level) : 0;
  }

  function listCharacterSpellsForCombat(ch) {
    if (!ch) return [];
    const out = [];
    const seen = new Set();
    function add(label, kind) {
      const name = String(label || '').trim();
      if (!name) return;
      const sp = lookupSpellByName(name);
      const displayName = sp ? sp.name : name.replace(/\s*\(\d+\w*\)\s*$/, '').trim();
      const dedupeKey = (sp && sp.id) ? String(sp.id).toLowerCase() : displayName.toLowerCase().replace(/\s+/g, ' ');
      if (seen.has(dedupeKey)) return;
      seen.add(dedupeKey);
      const level = sp ? Number(sp.level) || 0 : parseSpellLevelFromLabel(name);
      const time = sp ? String(sp.time || sp.casting_time || 'Action') : 'Action';
      out.push({
        name: displayName,
        label: displayName,
        level: level,
        kind: kind || (level === 0 ? 'cantrip' : 'spell'),
        time: time,
        concentration: !!(sp && (sp.concentration || /concentration/i.test(String(sp.duration || '')))),
        ritual: !!(sp && sp.ritual),
        school: sp ? (sp.school || '') : '',
        range: sp ? (sp.range || '') : '',
        components: sp ? (sp.components || '') : '',
        duration: sp ? (sp.duration || '') : '',
        description: sp ? (sp.description || sp.summary || '') : '',
        higher: sp ? (sp.higher_level || sp.higherLevel || '') : '',
        raw: sp
      });
    }
    (typeof splitSpellNames === 'function' ? splitSpellNames(ch.cantrips) : String(ch.cantrips || '').split(/[,;\n]+/)).forEach(s => add(s, 'cantrip'));
    const prepared = ch.spellPrepMode === 'prepared' && ch.preparedSpells
      ? ch.preparedSpells
      : ch.spells;
    (typeof splitSpellNames === 'function' ? splitSpellNames(prepared) : String(prepared || '').split(/[,;\n]+/)).forEach(s => add(s, 'spell'));
    (ch.spellIds || []).forEach(id => {
      const sp = (window.SPELLS || []).find(x => x.id === id);
      if (sp) add(sp.name, sp.level === 0 ? 'cantrip' : 'spell');
    });
    out.sort((a, b) => (a.level - b.level) || a.name.localeCompare(b.name));
    return out;
  }

  function getChannelDivinityMax(ch) {
    if (!ch) return 0;
    let max = 0;
    const list = (typeof normalizeClassLevels === 'function') ? normalizeClassLevels(ch) : [];
    list.forEach(c => {
      const n = c.name || '';
      const lvl = Number(c.level) || 1;
      if (n === 'Cleric' && lvl >= 2) max = Math.max(max, lvl >= 18 ? 3 : lvl >= 6 ? 2 : 1);
      if (n === 'Paladin' && lvl >= 3) max = Math.max(max, lvl >= 11 ? 2 : 1);
    });
    if (!list.length && (ch.class === 'Cleric' || ch.class === 'Paladin')) {
      const lvl = Number(ch.level) || 1;
      if (ch.class === 'Cleric' && lvl >= 2) max = lvl >= 18 ? 3 : lvl >= 6 ? 2 : 1;
      if (ch.class === 'Paladin' && lvl >= 3) max = lvl >= 11 ? 2 : 1;
    }
    return max;
  }

  function getChannelDivinityOptions(ch) {
    const opts = [];
    if (!ch || getChannelDivinityMax(ch) <= 0) return opts;
    opts.push({
      id: 'turn-undead',
      name: 'Turn Undead',
      actionType: 'action',
      range: 30,
      save: 'WIS',
      text: 'Each undead that can see or hear you within 30 ft must make a Wisdom saving throw. On a failed save, it is Turned for 1 minute or until it takes any damage.'
    });
    const sub = String(ch.subclass || '').toLowerCase();
    if (/immortality/i.test(sub)) {
      opts.push({
        id: 'immortality-domain',
        name: 'Channel Divinity: Immortality Domain',
        actionType: 'action',
        range: 30,
        save: '',
        text: 'Domain Channel Divinity — resolve per Immortality Domain feature text in the class description.'
      });
    }
    return opts;
  }

  function castingTimeBucket(timeStr) {
    const t = String(timeStr || 'Action').toLowerCase();
    if (/bonus/.test(t)) return 'bonus';
    if (/reaction/.test(t)) return 'reaction';
    return 'action';
  }

  
  function applyCombatTurnPhaseLocks(panel, cb) {
    if (!panel || !cb) return;
    const phase = cb.turnPhase || 'ready';
    // ready: must Start turn first
    // active: full turn
    // ended: only reaction + legendary
    const lockedUntilStart = phase === 'ready' || phase === 'pending' || !phase;
    const turnEnded = phase === 'ended';
    const allowMain = phase === 'active';
    const allowReaction = phase === 'active' || turnEnded || lockedUntilStart; // reaction anytime until next start — but if not started yet, still allow reaction from prior turn
    // Clarify rules:
    // - Before Start turn: block move/action/bonus/object/cast/attack (except reaction if not used)
    // - Active: all on-turn options
    // - Ended: only reaction + legendary (+ legendary resistance if present)

    const setDisabled = (el, dis, title) => {
      if (!el) return;
      el.disabled = !!dis;
      if (dis && title) el.title = title;
      else if (!dis) el.removeAttribute('title');
      el.classList.toggle('turn-locked', !!dis);
    };
    const lockMsg = lockedUntilStart ? 'Start turn first' : (turnEnded ? 'Turn ended — only Reaction / Legendary' : '');

    // Turn economy buttons
    ['cd-move-dec','cd-move-inc','cd-move-all','cd-move-reset',
     'cd-action-toggle','cd-atk-dec','cd-atk-inc','cd-atk-reset',
     'cd-bonus-toggle','cd-object-toggle','cd-end-turn-local',
     'cr-spell-cast','cr-spell-pick','cr-spell-slot','cr-roll-btn'
    ].forEach(id => {
      const el = panel.querySelector('#' + id);
      setDisabled(el, !allowMain, lockMsg);
    });
    panel.querySelectorAll('.ba-toggle, .cd-option-btn, .act-opt').forEach(el => {
      setDisabled(el, !allowMain, lockMsg);
    });
    panel.querySelectorAll('.reac-opt').forEach(el => {
      setDisabled(el, !!cb.reactionUsed, cb.reactionUsed ? 'Reaction already used' : '');
    });
    ['cd-short-rest','cd-long-rest'].forEach(id => {
      // rests allowed anytime when viewing this creature
      setDisabled(panel.querySelector('#' + id), false);
    });

    // Attack roller main actions
    ['cr-roll-btn','cr-dmg-only','cr-damage-only','cr-apply-dmg','cr-apply-heal','cr-apply-effect','cr-apply-condition','cr-save-check'].forEach(id => {
      const el = panel.querySelector('#' + id);
      if (!el) return;
      // Apply is always available so HP can change after rolls even before/after turn
      if (id === 'cr-apply-dmg' || id === 'cr-apply-heal' || id === 'cr-apply-effect' || id === 'cr-apply-condition') {
        setDisabled(el, false);
        return;
      }
      if (lockedUntilStart) setDisabled(el, true, lockMsg);
      else if (turnEnded) setDisabled(el, true, 'Turn ended — only Reaction / Legendary');
      else setDisabled(el, !allowMain, lockMsg);
    });
    // Save DC check can be used for reaction (e.g. Counterspell) when turn ended
    const saveBtn = panel.querySelector('#cr-save-check') || panel.querySelector('#cr-save-btn');
    if (saveBtn && turnEnded) setDisabled(saveBtn, false);

    // Also disable Roll Attack buttons by text search
    panel.querySelectorAll('button').forEach(btn => {
      const label = (btn.textContent || '').trim().toLowerCase();
      if (/^roll attack|damage only|cast spell$/.test(label)) {
        setDisabled(btn, !allowMain, lockMsg);
      }
      if (/^use reaction|restore reaction/.test(label)) {
        setDisabled(btn, false); // reaction always interactive if available
      }
      if (/^spend$|^cd-la|legendary/i.test(btn.id + label)) {
        setDisabled(btn, lockedUntilStart && !turnEnded ? true : false, lockMsg);
      }
    });

    // Reaction controls always available if not used (anytime)
    setDisabled(panel.querySelector('#cd-reaction-toggle'), false);
    // Legendary only when ended or active (enemy)
    ['cd-la-dec','cd-la-inc','cd-spend-la'].forEach(id => {
      setDisabled(panel.querySelector('#' + id), lockedUntilStart, lockMsg);
    });

    // Start turn only when not active
    const startBtn = panel.querySelector('#cd-start-turn');
    if (startBtn) {
      setDisabled(startBtn, phase === 'active', phase === 'active' ? 'Turn already started' : '');
      startBtn.classList.toggle('btn-primary', lockedUntilStart || turnEnded);
    }

    // Banner
    let banner = panel.querySelector('#turn-phase-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'turn-phase-banner';
      banner.className = 'turn-phase-banner muted small';
      const board = panel.querySelector('.combat-turn-board');
      if (board) board.insertBefore(banner, board.firstChild);
    }
    if (banner) {
      if (lockedUntilStart) {
        banner.textContent = 'Press Start turn before moving, acting, casting, or attacking.';
        banner.className = 'turn-phase-banner warn small';
      } else if (turnEnded) {
        banner.textContent = 'Turn ended — only Reaction and Legendary Actions / Resistances are available until this creature’s next turn.';
        banner.className = 'turn-phase-banner warn small';
      } else {
        banner.textContent = 'Turn in progress — move, action, and bonus action are independent.';
        banner.className = 'turn-phase-banner ok small';
      }
    }
  }


  function combatSpellcastingPanelHtml(cb, ch) {
    if (!ch && !cb) return '';
    const src = ch || cb;
    const spells = listCharacterSpellsForCombat(src);
    const stats = getSpellAttackAndDC(src);
    const slots = (cb && cb.combatSpellSlots) || {};
    const levels = Object.keys(slots).map(Number).sort((a,b)=>a-b);
    const slotSummary = levels.length
      ? levels.map(L => {
          const left = Math.max(0, (slots[L].max || 0) - (slots[L].used || 0));
          return left > 0 ? `${L}:${left}` : null;
        }).filter(Boolean).join(' · ') || 'No slots left'
      : '—';
    const cdMax = getChannelDivinityMax(src);
    const cdUsed = (cb.combatResources && cb.combatResources['channel-divinity'])
      ? (cb.combatResources['channel-divinity'].used || 0)
      : ((src.resourceUsed && src.resourceUsed['channel-divinity']) || 0);
    const cdLeft = Math.max(0, cdMax - cdUsed);
    const cdOpts = getChannelDivinityOptions(src);

    const spellOpts = spells.map((s, i) =>
      `<option value="${i}" data-level="${s.level}" data-time="${escapeAttr(s.time)}" data-conc="${s.concentration ? '1' : '0'}">${s.level === 0 ? 'C' : s.level} · ${escapeHtml(s.name)}${s.concentration ? ' ◎' : ''}</option>`
    ).join('');

    const upcastOpts = levels.filter(L => ((slots[L].max || 0) - (slots[L].used || 0)) > 0)
      .map(L => `<option value="${L}">${L}${L===1?'st':L===2?'nd':L===3?'rd':'th'} (${(slots[L].max||0)-(slots[L].used||0)} left)</option>`)
      .join('');

    return `<div class="detail-block combat-spell-panel" id="combat-spell-panel">
      <div class="detail-label">Spellcasting</div>
      <p class="muted small">Spell atk +${stats.attack} · Save DC ${stats.dc} (${stats.ability}) · Slots ${escapeHtml(slotSummary)}</p>
      <div class="field">
        <label>Spell</label>
        <select id="cr-spell-pick" size="6" style="width:100%;min-height:6rem">
          <option value="">— Select a spell —</option>
          ${spellOpts || '<option value="" disabled>No spells on sheet</option>'}
        </select>
      </div>
      <div class="form-row">
        <div class="field"><label>Cast with slot</label>
          <select id="cr-spell-slot"><option value="0">Cantrip / at-will</option>${upcastOpts}</select>
        </div>
        <div class="field"><label>Casting time</label>
          <input id="cr-spell-time" type="text" readonly value="—" />
        </div>
      </div>
      <div class="tool-btns" style="flex-wrap:wrap;gap:0.35rem;margin-top:0.35rem">
        <button type="button" class="btn secondary btn-tiny" id="cr-spell-info">Spell info</button>
        <button type="button" class="btn primary btn-tiny" id="cr-spell-cast">Cast spell</button>
      </div>
      <p class="muted small" id="cr-spell-hint">Casting marks Action, Bonus, or Reaction from the spell’s casting time. Upcast spends a higher slot.</p>
      ${cdMax > 0 ? `<div class="cd-block" style="margin-top:0.5rem;padding-top:0.4rem;border-top:1px solid rgba(196,163,90,0.2)">
        <div class="detail-label">Channel Divinity <span class="muted small">${cdLeft}/${cdMax}</span></div>
        ${cdOpts.map(o => `<button type="button" class="btn secondary btn-tiny cd-option-btn" data-cd="${escapeAttr(o.id)}" style="margin:0.2rem 0.2rem 0 0">${escapeHtml(o.name)}</button>`).join('')}
      </div>` : ''}
    </div>`;
  }

  async function openSpellDetailModal(spellEntry, ctx) {
    ctx = ctx || {};
    const sp = spellEntry || {};
    const body = `
      <div class="spell-modal">
        <p class="muted small">${sp.level === 0 ? 'Cantrip' : (sp.level + (sp.level===1?'st':sp.level===2?'nd':sp.level===3?'rd':'th') + '-level')} ${escapeHtml(sp.school || '')}</p>
        <p><strong>Time:</strong> ${escapeHtml(sp.time || 'Action')} · <strong>Range:</strong> ${escapeHtml(sp.range || '—')} · <strong>Duration:</strong> ${escapeHtml(sp.duration || '—')}</p>
        <p><strong>Components:</strong> ${escapeHtml(sp.components || '—')}${sp.concentration ? ' · <strong>Concentration</strong>' : ''}${sp.ritual ? ' · Ritual' : ''}</p>
        <div class="detail-text" style="margin-top:0.5rem">${formatRichText(sp.description || 'No full text in catalog.')}</div>
        ${sp.higher ? `<div class="detail-block" style="margin-top:0.5rem"><div class="detail-label">At higher levels</div><div class="detail-text">${formatRichText(sp.higher)}</div></div>` : ''}
        ${ctx.slotOptionsHtml ? `<div class="field" style="margin-top:0.75rem"><label>Cast at level</label><select id="modal-spell-slot">${ctx.slotOptionsHtml}</select></div>` : ''}
      </div>`;
    return openModal({
      title: sp.name || 'Spell',
      bodyHtml: body,
      confirmText: ctx.allowCast ? 'Cast' : 'Close',
      wide: true,
      onConfirm: () => {
        if (!ctx.allowCast) return true;
        const sel = document.getElementById('modal-spell-slot');
        const slot = sel ? Number(sel.value) || 0 : 0;
        if (typeof ctx.onCast === 'function') ctx.onCast(slot);
        return true;
      }
    });
  }


  function combatSpellSlotsHtml(cb) {
    const slots = cb.combatSpellSlots || {};
    const levels = Object.keys(slots).map(Number).sort((a,b)=>a-b);
    if (!levels.length && !cb.pactSlotsMax) return '';
    const slotOpts = levels.filter(L => (slots[L].max - (slots[L].used||0)) > 0).map(L =>
      `<option value="${L}">${L}${L===1?'st':L===2?'nd':L===3?'rd':'th'} (${slots[L].max-(slots[L].used||0)} left)</option>`
    ).join('');
    const pact = cb.pactSlotsMax
      ? `<div class="combat-res-row"><span class="combat-res-name">Pact (${cb.pactSlotLevel})</span>
          <button type="button" class="btn secondary btn-tiny" id="cd-pact-dec">−</button>
          <span class="combat-res-val"><strong>${Math.max(0,(cb.pactSlotsMax||0)-(cb.pactSlotsUsed||0))}</strong>/${cb.pactSlotsMax}</span>
          <button type="button" class="btn secondary btn-tiny" id="cd-pact-inc">+</button>
          <button type="button" class="btn secondary btn-tiny" id="cd-pact-spend">Use</button></div>`
      : '';
    return `<div class="detail-block">
      <div class="detail-label">Spell Slots</div>
      <div class="combat-slots-grid">
        ${levels.map(L => {
          const s = slots[L];
          const left = Math.max(0, s.max - (s.used||0));
          return `<div class="combat-slot-chip ${left===0?'empty':''}" data-slot="${L}" title="Level ${L}">
            <span class="slot-lvl">L${L}</span>
            <span class="slot-val">${left}/${s.max}</span>
            <button type="button" class="btn secondary btn-tiny cd-slot-spend" data-slot="${L}">−</button>
            <button type="button" class="btn secondary btn-tiny cd-slot-restore" data-slot="${L}">+</button>
          </div>`;
        }).join('')}
      </div>
      ${pact}
      <div class="field" style="margin-top:0.4rem">
        <label>Cast / Upcast using slot</label>
        <div class="tool-btns" style="align-items:center">
          <select id="cr-upcast-level" style="min-width:7rem">${slotOpts || '<option value="">No slots</option>'}</select>
          <button type="button" class="btn primary btn-tiny" id="cr-cast-slot">Spend Slot</button>
        </div>
        <p class="muted small">Select slot level to upcast, then Spend Slot (or after rolling a spell).</p>
      </div>
    </div>`;
  }

  function combatAttacksBudgetHtml(cb, ch) {
    const max = cb.attacksMax != null ? cb.attacksMax : 1;
    const used = cb.attacksUsed || 0;
    const left = Math.max(0, max - used);
    const speed = parseSpeed(cb.speed);
    const moveUsed = Math.max(0, Number(cb.moveUsed) || 0);
    const moveLeft = Math.max(0, speed - moveUsed);
    const phase = cb.turnPhase || 'ready';
    const phaseLabel = phase === 'active' ? 'Your turn' : phase === 'ended' ? 'Turn ended' : 'Waiting';
    const badge = (flag, openLabel) => flag
      ? '<span class="stage-badge used">Used</span>'
      : `<span class="stage-badge open">${openLabel || 'Available'}</span>`;

    // Independent trackers — move / action / bonus may be used in any order or split
    const baOpts = (typeof bonusActionOptionsForCharacter === 'function')
      ? bonusActionOptionsForCharacter(ch || null)
      : [];
    const baUsedMap = cb.bonusActionsUsed || {};
    const baListHtml = baOpts.length
      ? `<ul class="ba-options-list">${baOpts.map(function(o) {
          const spent = !!baUsedMap[o.id];
          return `<li class="ba-option ${spent ? 'spent' : ''}" data-ba-id="${escapeAttr(o.id)}">
            <button type="button" class="btn secondary btn-tiny ba-toggle" data-ba-id="${escapeAttr(o.id)}">${spent ? '✓' : '○'}</button>
            <span class="ba-label"><strong>${escapeHtml(o.label)}</strong>
              <span class="muted small">${escapeHtml(o.limit || '')}</span>
              ${o.note ? `<span class="ba-note muted small">${escapeHtml(o.note)}</span>` : ''}
            </span>
          </li>`;
        }).join('')}</ul>`
      : '<p class="muted small">No class bonus actions detected — use “Mark used” or Other.</p>';

    return `<div class="combat-turn-board">
      <div class="turn-board-header">
        <span class="detail-label">Turn economy</span>
        <span class="turn-phase-pill phase-${escapeHtml(phase)}">${escapeHtml(phaseLabel)}</span>
      </div>
      <p class="muted small turn-econ-hint">Move, Action, and Bonus action are <strong>independent</strong> — you may split movement before/after actions, or not move at all.</p>

      <section class="turn-stage" data-stage="start">
        <div class="turn-stage-head">
          <span class="turn-stage-num">⏱</span>
          <strong>Start of turn</strong>
          ${phase === 'active' || phase === 'ended' ? '<span class="stage-badge open">Begun</span>' : '<span class="stage-badge muted">Pending</span>'}
        </div>
        <p class="muted small">Start-of-turn effects · reaction refreshes · death saves at 0 HP.</p>
        <div class="tool-btns">
          <button type="button" class="btn primary btn-tiny" id="cd-start-turn">Start turn</button>
          <button type="button" class="btn secondary btn-tiny" id="cd-short-rest" title="Recover CD, some class resources, Warlock slots (edition-dependent)">Short Rest</button>
          <button type="button" class="btn secondary btn-tiny" id="cd-long-rest" title="Recover slots, CD, most resources">Long Rest</button>
        </div>
      </section>

      <section class="turn-stage ${moveUsed > 0 ? 'stage-partial' : ''}" data-stage="move">
        <div class="turn-stage-head">
          <span class="turn-stage-num">M</span>
          <strong>Movement</strong>
          ${moveUsed <= 0 ? '<span class="stage-badge open">Full speed</span>' : (moveLeft <= 0 ? '<span class="stage-badge used">All used</span>' : `<span class="stage-badge open">${moveLeft} ft left</span>`)}
        </div>
        <p class="muted small">Can be split anytime during your turn — not a prerequisite for Action.</p>
        <div class="combat-res-row">
          <span class="combat-res-val"><strong>${moveLeft}</strong> / ${speed} ft left</span>
          <button type="button" class="btn secondary btn-tiny" id="cd-move-dec">−5</button>
          <button type="button" class="btn secondary btn-tiny" id="cd-move-inc">+5</button>
          <button type="button" class="btn secondary btn-tiny" id="cd-move-all">All</button>
          <button type="button" class="btn secondary btn-tiny" id="cd-move-reset">Reset</button>
        </div>
      </section>

      <section class="turn-stage ${cb.actionUsed || used > 0 ? 'stage-partial' : ''}" data-stage="action">
        <div class="turn-stage-head">
          <span class="turn-stage-num">A</span>
          <strong>Action</strong>
          ${badge(!!cb.actionUsed || used >= max, used > 0 && !cb.actionUsed ? 'Attacks spent' : 'Available')}
        </div>
        <p class="muted small">Choose one Action (or Mark used). Independent of movement.</p>
        <div class="action-menu" id="cd-action-menu">
          <button type="button" class="btn secondary btn-tiny act-opt" data-act="attack" title="Use the Attack action">Attack</button>
          <button type="button" class="btn secondary btn-tiny act-opt" data-act="cast" title="Cast a 1-action spell (use Spellcasting panel)">Cast a spell</button>
          <button type="button" class="btn secondary btn-tiny act-opt" data-act="dash" title="Gain extra movement equal to your speed">Dash</button>
          <button type="button" class="btn secondary btn-tiny act-opt" data-act="disengage" title="Movement does not provoke opportunity attacks">Disengage</button>
          <button type="button" class="btn secondary btn-tiny act-opt" data-act="dodge" title="Attacks vs you have disadvantage; Dex saves advantage">Dodge</button>
          <button type="button" class="btn secondary btn-tiny act-opt" data-act="help" title="Help an ally (advantage)">Help</button>
          <button type="button" class="btn secondary btn-tiny act-opt" data-act="hide" title="Make a Stealth check to Hide">Hide</button>
          <button type="button" class="btn secondary btn-tiny act-opt" data-act="ready" title="Ready a trigger; response uses your reaction">Ready</button>
          <button type="button" class="btn secondary btn-tiny act-opt" data-act="search" title="Search for something">Search</button>
          <button type="button" class="btn secondary btn-tiny act-opt" data-act="use-object" title="Use an object that needs your action">Use an object</button>
          <button type="button" class="btn secondary btn-tiny act-opt" data-act="other" title="Other action">Other…</button>
        </div>
        <div class="combat-res-row" style="margin-top:0.35rem">
          <button type="button" class="btn secondary btn-tiny" id="cd-action-toggle">${cb.actionUsed ? 'Mark available' : 'Mark used'}</button>
          ${cb.lastAction ? `<span class="muted small">Last: ${escapeHtml(cb.lastAction)}</span>` : ''}
        </div>
        <div class="turn-stage-sub">
          <div class="turn-stage-sub-head">Attack budget <span class="muted small">(Extra Attack · multiclass = best progression)</span></div>
          <div class="combat-res-row">
            <span class="combat-res-val"><strong>${left}</strong> / ${max}</span>
            <button type="button" class="btn secondary btn-tiny" id="cd-atk-dec">−</button>
            <button type="button" class="btn secondary btn-tiny" id="cd-atk-inc">+</button>
            <button type="button" class="btn secondary btn-tiny" id="cd-atk-reset">Reset</button>
          </div>
        </div>
      </section>

      <section class="turn-stage ${cb.bonusUsed ? 'stage-partial' : ''}" data-stage="bonus">
        <div class="turn-stage-head">
          <span class="turn-stage-num">B</span>
          <strong>Bonus action</strong>
          ${badge(!!cb.bonusUsed)}
        </div>
        <p class="muted small">One bonus action per turn (unless a feature grants an extra). Class features + equipment. Selecting one clears the previous.</p>
        ${baListHtml}
        <button type="button" class="btn secondary btn-tiny" id="cd-bonus-toggle" style="margin-top:0.35rem">${cb.bonusUsed ? 'Clear bonus used' : 'Mark bonus used'}</button>
      </section>

      <section class="turn-stage" data-stage="object">
        <div class="turn-stage-head">
          <span class="turn-stage-num">O</span>
          <strong>Object interaction</strong>
          ${badge(!!cb.objectInteractUsed)}
        </div>
        <p class="muted small">Draw/stow weapon, open door… (free once per turn).</p>
        <button type="button" class="btn secondary btn-tiny" id="cd-object-toggle">${cb.objectInteractUsed ? 'Mark available' : 'Mark used'}</button>
      </section>

      <section class="turn-stage" data-stage="end">
        <div class="turn-stage-head">
          <span class="turn-stage-num">E</span>
          <strong>End of turn</strong>
          ${phase === 'ended' ? '<span class="stage-badge used">Ended</span>' : '<span class="stage-badge open">Not yet</span>'}
        </div>
        <div class="tool-btns">
          <button type="button" class="btn secondary btn-tiny" id="cd-end-turn-local">Mark turn ended</button>
          <button type="button" class="btn secondary btn-tiny" id="cd-reset-turn">Reset turn economy</button>
        </div>
      </section>

      <section class="turn-stage turn-stage-anytime ${cb.reactionUsed ? 'stage-partial' : ''}" data-stage="reaction">
        <div class="turn-stage-head">
          <span class="turn-stage-num">⟳</span>
          <strong>Reaction</strong>
          ${badge(!!cb.reactionUsed, 'Ready anytime')}
        </div>
        <p class="muted small">One reaction until the start of your next turn (not only on your turn).</p>
        <div class="action-menu" id="cd-reaction-menu">
          <button type="button" class="btn secondary btn-tiny reac-opt" data-reac="opportunity-attack">Opportunity Attack</button>
          <button type="button" class="btn secondary btn-tiny reac-opt" data-reac="shield">Shield</button>
          <button type="button" class="btn secondary btn-tiny reac-opt" data-reac="counterspell">Counterspell</button>
          <button type="button" class="btn secondary btn-tiny reac-opt" data-reac="uncanny-dodge">Uncanny Dodge</button>
          <button type="button" class="btn secondary btn-tiny reac-opt" data-reac="absorb">Absorb / other</button>
        </div>
        <button type="button" class="btn secondary btn-tiny" id="cd-reaction-toggle" style="margin-top:0.35rem">${cb.reactionUsed ? 'Restore reaction' : 'Use reaction'}</button>
        ${cb.lastReaction ? `<span class="muted small"> Last: ${escapeHtml(cb.lastReaction)}</span>` : ''}
      </section>

      ${cb.legendary ? `<section class="turn-stage turn-stage-anytime" data-stage="legendary">
        <div class="turn-stage-head">
          <span class="turn-stage-num">★</span>
          <strong>Legendary actions</strong>
          <span class="stage-badge open">${cb.legendaryActionsLeft != null ? cb.legendaryActionsLeft : 3} left</span>
        </div>
        <div class="combat-res-row">
          <button type="button" class="btn secondary btn-tiny" id="cd-la-dec">−</button>
          <span class="combat-res-val"><strong>${cb.legendaryActionsLeft != null ? cb.legendaryActionsLeft : 3}</strong> / ${cb.legendaryActionsPerRound != null ? cb.legendaryActionsPerRound : 3}</span>
          <button type="button" class="btn secondary btn-tiny" id="cd-la-inc">+</button>
          <button type="button" class="btn secondary btn-tiny" id="cd-spend-la">Spend</button>
        </div>
        <div class="combat-res-row" style="margin-top:0.35rem">
          <span class="muted small">Legendary Resistance</span>
          <button type="button" class="btn secondary btn-tiny" id="cd-lr-dec">−</button>
          <span class="combat-res-val"><strong>${cb.legendaryResistLeft != null ? cb.legendaryResistLeft : (cb.legendaryResistMax != null ? cb.legendaryResistMax : 0)}</strong>/${cb.legendaryResistMax != null ? cb.legendaryResistMax : 0}</span>
          <button type="button" class="btn secondary btn-tiny" id="cd-lr-use" title="Succeed on a save">Use LR</button>
        </div>
      </section>` : ''}
      ${(() => {
        const surge = cb.combatResources && cb.combatResources['action-surge'];
        if (!surge) return '';
        const left = Math.max(0, (surge.max||0) - (surge.used||0));
        return `<section class="turn-stage" data-stage="action-surge">
          <div class="turn-stage-head"><span class="turn-stage-num">⚡</span><strong>Action Surge</strong>
            <span class="stage-badge open">${left}/${surge.max||0}</span></div>
          <button type="button" class="btn secondary btn-tiny" id="cd-action-surge" ${left<=0?'disabled':''}>Use Action Surge (extra Action)</button>
        </section>`;
      })()}
    </div>`;
  }


  function resourcesSheetHtml(ch, opts = {}) {
    const res = classResourcesForCharacter(ch);
    if (!res.length) return '';
    const used = ch.resourceUsed && typeof ch.resourceUsed === 'object' ? ch.resourceUsed : {};
    const compact = !!opts.compact;
    const pills = res.map(r => {
      const u = used[r.id] != null ? Number(used[r.id]) : 0;
      const remaining = Math.max(0, (r.max >= 99 ? r.max : r.max) - u);
      const showMax = r.max >= 99 ? '∞' : String(r.max);
      const showRem = r.max >= 99 ? (u ? String(Math.max(0, 99 - u)) : '∞') : String(Math.max(0, r.max - u));
      // Display remaining / max (more intuitive than used/max for combat)
      const left = r.max >= 99 ? '∞' : Math.max(0, r.max - u);
      return `<div class="cs-resource-pill" title="${escapeAttr((r.className ? r.className + ' · ' : '') + (r.recover || ''))}">
        <div class="cs-res-name">${escapeHtml(r.label)}</div>
        <div class="cs-res-val"><span class="cs-res-left">${left}</span><span class="cs-res-sep">/</span><span class="cs-res-max">${showMax}</span></div>
        <div class="cs-res-sub muted small">${escapeHtml(r.className || '')}${r.recover ? ' · ' + escapeHtml(r.recover) : ''}</div>
      </div>`;
    }).join('');
    if (compact) {
      return `<div class="cs-resource-bar cs-resource-bar-compact">${pills}</div>`;
    }
    return `<div class="cs-panel cs-resources-panel">
      <div class="cs-panel-title">Class Resources</div>
      <p class="muted small" style="margin:0 0 0.35rem">Remaining / Max (tracked from Edit sheet). Short Rest: Ki, Channel Divinity, Wild Shape, Superiority, Second Wind… · Long Rest: Rage, Sorcery, Lunar, Lay on Hands…</p>
      <div class="cs-resource-bar">${pills}</div>
    </div>`;
  }

  function resourcesEditorHtml(ch) {
    const res = classResourcesForCharacter(ch);
    if (!res.length) return '';
    const used = ch.resourceUsed && typeof ch.resourceUsed === 'object' ? ch.resourceUsed : {};
    return `<div class="sheet-section" id="m-resources-section">
      <label class="section-label">Class Resources / Charges</label>
      <p class="muted small">Track <strong>used</strong> points. View sheet shows remaining. Multiclass lists every pool (Ki, Lunar Charges, Rage, Blood Maledict, etc.).</p>
      <div class="resource-track">
        ${res.map(r => {
          const u = used[r.id] != null ? used[r.id] : 0;
          const maxLabel = r.max >= 99 ? '∞' : r.max;
          return `<div class="res-stepper" data-res="${escapeAttr(r.id)}" data-max="${r.max >= 99 ? 99 : r.max}" title="${escapeAttr((r.className || '') + ' · ' + (r.recover || ''))}">
            <span class="res-label">${escapeHtml(r.label)}${r.className ? ' <span class="muted">(' + escapeHtml(r.className) + ')</span>' : ''}</span>
            <button type="button" class="res-dec">−</button>
            <span class="res-val">${u}</span>
            <span class="res-max">used / ${maxLabel}</span>
            <button type="button" class="res-inc">+</button>
            <input type="hidden" class="m-resource" data-res="${escapeAttr(r.id)}" value="${u}" />
            <span class="muted small">${escapeHtml(r.recover || '')}</span>
          </div>`;
        }).join('')}
      </div>
    </div>`;
  }

  function collectResourcesFromForm() {
    const used = {};
    document.querySelectorAll('.m-resource').forEach(inp => {
      used[inp.dataset.res] = clamp(parseInt(inp.value, 10) || 0, 0, 99);
    });
    return used;
  }


  // ─── Feature / ability / feat searchable compendium ──────────────────────
  function buildFeatureCompendiumEntries() { /* stripped */ return null; }

  function renderFeatureCompendium() { /* stripped */ return null; }


  function normalizeCharacter(ch) {
    // Preserve extension fields
    const _ext = {
      inspiration: ch.inspiration,
      deathSaves: ch.deathSaves,
      conditions: ch.conditions,
      attunement: ch.attunement,
      background: ch.background,
      spellPrepMode: ch.spellPrepMode,
      preparedSpells: ch.preparedSpells
    };

    ch = ch || {};
    const _mc = normalizeClassLevels(ch);
    if (_mc.length && _mc[0].name) {
      ch.classes = _mc;
      ch.level = _mc.reduce((s, c) => s + c.level, 0) || ch.level || 1;
      ch.class = _mc[0].name;
      if (_mc[0].subclass) ch.subclass = _mc[0].subclass;
      ch.profBonus = ch.profBonus || profBonusForTotalLevel(ch.level);
    }

    return {
      id: ch.id,
      name: ch.name || '',
      player: ch.player || '',
      type: ch.type || (ch.player === 'NPC' ? 'ally' : 'pc'),
      class: ch.class || '',
      subclass: ch.subclass || '',
      level: clamp(Number(ch.level) || 1, 1, 40),
      race: ch.race || '',
      background: ch.background || '',
      world: ch.world || '',
      alignment: ch.alignment || '',
      str: Number(ch.str) || 10,
      dex: Number(ch.dex) || 10,
      con: Number(ch.con) || 10,
      int: Number(ch.int) || 10,
      wis: Number(ch.wis) || 10,
      cha: Number(ch.cha) || 10,
      hp: Number(ch.hp) || 0,
      hpMax: Number(ch.hpMax) || 0,
      ac: Number(ch.ac) || 10,
      speed: ch.speed || '30 ft.',
      profBonus: Number(ch.profBonus) || profBonusForLevel(ch.level || 1),
      saves: ch.saves || '',
      skills: ch.skills || '',
      attacks: ch.attacks || '',
      features: ch.features || '',
      equipment: ch.equipment || '',
      inventory: Array.isArray(ch.inventory) ? ch.inventory.map(normalizeInventoryItem) : [],
      corruption: clamp(Number(ch.corruption) || 0, 0, 6),
      classes: normalizeClassLevels(ch),
      isUmbrarian: !!ch.isUmbrarian,
      umbrarianStage: ch.umbrarianStage || '',
      shard: ch.shard || '',
      shardAbility: ch.shardAbility || '',
      notes: ch.notes || '',
      avatar: ch.avatar || '',
      spellcastingAbility: ch.spellcastingAbility || '',
      spells: ch.spells || '',
      spellSlots: ch.spellSlots && typeof ch.spellSlots === 'object' ? ch.spellSlots : {},
      spellSlotsUsed: ch.spellSlotsUsed && typeof ch.spellSlotsUsed === 'object' ? ch.spellSlotsUsed : {},
      cantrips: ch.cantrips || '',
      spells: ch.spells || '',
      spellIds: Array.isArray(ch.spellIds) ? ch.spellIds : [],
      notes: ch.notes || '',
      avatar: ch.avatar || '',
      inspiration: !!ch.inspiration,
      deathSaves: ch.deathSaves && typeof ch.deathSaves === 'object' ? ch.deathSaves : { successes: 0, failures: 0 },
      conditions: Array.isArray(ch.conditions) ? ch.conditions : [],
      attunement: Array.isArray(ch.attunement) ? ch.attunement : [],
      spellPrepMode: ch.spellPrepMode || 'known',
      preparedSpells: ch.preparedSpells || '',
      umbrarianLocked: !!ch.umbrarianLocked,
      feats: Array.isArray(ch.feats) ? ch.feats : [],
      asiChoices: Array.isArray(ch.asiChoices) ? ch.asiChoices : [],
      playerSheetLocked: !!ch.playerSheetLocked,
      sheetLocked: !!ch.sheetLocked,
      abilityBase: ch.abilityBase && typeof ch.abilityBase === 'object' ? ch.abilityBase : null,
      resourceUsed: ch.resourceUsed && typeof ch.resourceUsed === 'object' ? ch.resourceUsed : {}
    };
  }

  function abilityRowHtml(prefix, ch) {
    const raceBon = getRaceBonuses(ch.race || '');
    // Interpret stored scores as totals; derive display base = total - racial (min 8)
    return ABS.map(k => {
      const label = k.toUpperCase();
      const total = Number(ch[k]) || 10;
      const bon = raceBon[k] || 0;
      const base = Math.max(3, total - bon);
      return `<div class="ability-box" data-ab="${k}">
        <label class="small">${label}</label>
        <input type="number" id="${prefix}-${k}" min="3" max="20" value="${base}" class="ability-score" data-ab="${k}" data-base="1" title="Base score (before racial bonus)" />
        <div class="ability-bonus-line"><span class="racial-bon" id="${prefix}-rbon-${k}">${bon ? '+' + bon : '—'}</span></div>
        <span class="ability-total" id="${prefix}-total-${k}">${total}</span>
        <span class="ability-mod" id="${prefix}-mod-${k}">${modStr(total)}</span>
      </div>`;
    }).join('');
  }


  function getPhbClasses() {
    return (typeof window !== 'undefined' && window.PHB_CLASSES) ? window.PHB_CLASSES : [];
  }
  function getPhbSkills() {
    return (typeof window !== 'undefined' && window.PHB_SKILLS) ? window.PHB_SKILLS : [];
  }
  function getPhbRaces() {
    return (typeof window !== 'undefined' && window.PHB_RACES) ? window.PHB_RACES : [];
  }
  function findPhbClass(name) {
    if (!name) return null;
    const n = String(name).toLowerCase();
    return getPhbClasses().find(c => c.name.toLowerCase() === n) || null;
  }

  function classOptionsHtml(selected) {
    const classes = getPhbClasses();
    const core = classes.filter(c => !c.setting);
    const dsc = classes.filter(c => c.setting);
    let html = `<option value="">— Select class —</option>`;
    html += `<optgroup label="Core Classes">`;
    core.forEach(c => {
      html += `<option value="${escapeAttr(c.name)}" ${selected === c.name ? 'selected' : ''}>${escapeHtml(c.name)}</option>`;
    });
    html += `</optgroup><optgroup label="Dark Sun Chronicles">`;
    dsc.forEach(c => {
      html += `<option value="${escapeAttr(c.name)}" ${selected === c.name ? 'selected' : ''}>${escapeHtml(c.name)}</option>`;
    });
    html += `</optgroup>`;
    if (selected && !classes.some(c => c.name === selected)) {
      html += `<option value="${escapeAttr(selected)}" selected>${escapeHtml(selected)} (custom)</option>`;
    }
    return html;
  }


  // ─── Subclass unlock levels, skill/feat limits, player sheet lock ─────────
  function subclassUnlockLevel(className) {
    const n = String(className || '');
    const map = {
      'Barbarian': 3, 'Bard': 3, 'Cleric': 1, 'Druid': 2, 'Fighter': 3,
      'Monk': 3, 'Paladin': 3, 'Ranger': 3, 'Rogue': 3, 'Sorcerer': 1,
      'Warlock': 3,  // 2024 PHB: subclass at 3 (was 1 in 2014) 'Wizard': 2, 'Artificer': 3, 'Bloodhunter': 3,
      'Moon Guardian': 3, 'Ghostblade': 3, 'Shadowblade': 3
    };
    return map[n] != null ? map[n] : 3;
  }

  function isOriginal5eRace(r) {
    if (!r || isDscRace(r)) return false;
    const src = String(r.source || '').toLowerCase();
    const name = String(r.name || '').toLowerCase();
    const core = ['human','elf','dwarf','halfling','dragonborn','gnome','half-elf','half-orc','tiefling','orc','aasimar','goliath','firbolg','tabaxi','kenku','lizardfolk','yuan-ti','triton','bugbear','hobgoblin','goblin','kobold','genasi','changeling','shifter','warforged','kalashtar','centaur','minotaur','satyr','harengon','fairy','owlin','leonin','vedalken','loxodon','simic hybrid','verdan'];
    if (core.some(c => name === c || name.startsWith(c + ' ('))) return true;
    if (/phb|player.?s handbook|basic rules|srd|volo|mordenkainen|tasha|monsters of the multiverse|elemental evil|sword coast|guildmasters|eberron|mythic odysseys|van richten|fizban|spelljammer|dragonlance|planescape|bigby|book of many things/i.test(src)) {
      if (/custom|agp|imported|aurora|homebrew/i.test(src)) return false;
      return true;
    }
    return false;
  }

  function raceCategory(r) {
    if (isDscRaceStrict(r)) return 'dsc';
    if (isOriginal5eRace(r)) return 'original';
    const src = String(r.source || '').toLowerCase();
    const world = String(r.world || '').toLowerCase();
    if (r.group === 'Imported' || r.dsc === false) return 'imported';
    if (/custom|agp|imported|aurora|homebrew/i.test(src)) return 'imported';
    // Unmarked built-in races without Eldoria world → Original 5e
    if (!world && (!src || /phb|srd|basic/i.test(src))) return 'original';
    return 'imported';
  }

  function isDscRaceStrict(r) {
    if (!r) return false;
    if (r.dsc === true || r.group === 'DSC') return true;
    const world = String(r.world || '').toLowerCase();
    const src = String(r.source || '').toLowerCase();
    const dscWorlds = ['luminaris','umbraria','eternum','solara','aetheria','harmonia','celestia','eldoria'];
    if (dscWorlds.includes(world)) return true;
    if (/dark sun chronicles|dsc\b/.test(src) && !/imported|custom|agp/.test(src)) return true;
    // Built-in PHB_RACES with Eldoria world field
    if (r.world && dscWorlds.includes(world)) return true;
    return false;
  }

  function isPlayerSheetLocked(ch) {
    if (!isPlayerApp()) return false;
    return !!(ch && (ch.playerSheetLocked || ch.sheetLocked));
  }

  function canPlayerEditField(ch, field) {
    // Always allowed after lock on player app
    if (!isPlayerSheetLocked(ch)) return true;
    const allowed = new Set([
      'equipment', 'inventory', 'hp', 'hpMax', 'deathSaves', 'conditions',
      'inspiration', 'resourceUsed', 'spellSlotsUsed', 'levelup', 'multiclass',
      'asi', 'skills' // skills only when unlocking new class skill slots via multiclass/level
    ]);
    return allowed.has(field);
  }

  function validateCharacterForLock(ch, formData) {
    const missing = [];
    const d = formData || ch || {};
    if (!(d.name || '').trim()) missing.push('Character Name');
    if (!(d.race || '').trim()) missing.push('Race / Origin');
    const classes = Array.isArray(d.classes) ? d.classes : (typeof normalizeClassLevels === 'function' ? normalizeClassLevels(d) : []);
    if (!classes.length || !(classes[0]?.name || '').trim()) missing.push('Class');
    // Ability scores present (not soft-lock on ASI)
    let scoresOk = true;
    (typeof ABS !== 'undefined' ? ABS : ['str','dex','con','int','wis','cha']).forEach(a => {
      const v = Number(d[a]);
      if (!v || v < 3) scoresOk = false;
    });
    if (!scoresOk) missing.push('Ability Scores (all six)');
    return missing;
  }



  function isDscRace(r) {
    if (!r) return false;
    if (r.dsc === true || r.group === 'DSC') return true;
    const src = String(r.source || '').toLowerCase();
    const world = String(r.world || '').toLowerCase();
    const dscWorlds = ['luminaris','umbraria','eternum','solara','aetheria','harmonia','celestia','eldoria'];
    if (dscWorlds.includes(world)) return true;
    if (/custom|agp|imported|aurora|unearthed|reddit|kobold/i.test(src)) return false;
    if (/phb|player|dsc|dark sun|basic rules|srd/i.test(src)) return true;
    // Core list entries without import source
    if (!src || src === '—') return true;
    return false;
  }

  function raceOptionsHtml(selected) {
    const races = getPhbRaces();
    const dsc = [], original = [], imported = [];
    races.forEach(r => {
      const cat = (typeof raceCategory === 'function') ? raceCategory(r) : (isDscRace(r) ? 'dsc' : 'imported');
      if (cat === 'dsc') dsc.push(r);
      else if (cat === 'original') original.push(r);
      else imported.push(r);
    });
    const mk = (r) => `<option value="${escapeAttr(r.name)}" ${r.name === selected ? 'selected' : ''}>${escapeHtml(r.name)}${r.world ? ' (' + escapeHtml(r.world) + ')' : ''}</option>`;
    let html = `<option value="">— Choose race —</option>`;
    if (dsc.length) html += `<optgroup label="DSC Races">${dsc.map(mk).join('')}</optgroup>`;
    if (original.length) html += `<optgroup label="Original 5e Races">${original.map(mk).join('')}</optgroup>`;
    if (imported.length) html += `<optgroup label="Homebrew / Imported">${imported.map(mk).join('')}</optgroup>`;
    if (selected && !races.some(r => r.name === selected)) {
      html += `<option value="${escapeAttr(selected)}" selected>${escapeHtml(selected)}</option>`;
    }
    return html;
  }




  function skillPickerHtml(className, selectedSkills, opts) {
    opts = opts || {};
    const locked = !!opts.locked;
    // Multiclass: pass classNames array or read from form
    let classNames = opts.classNames;
    if (!classNames || !classNames.length) {
      if (typeof readMulticlassFromForm === 'function') {
        try {
          const list = readMulticlassFromForm();
          if (list && list.length) classNames = list.map(c => c.name).filter(Boolean);
        } catch (e) {}
      }
    }
    if (!classNames || !classNames.length) {
      classNames = className ? [className] : [];
    }
    const all = getPhbSkills();
    const selected = new Set((selectedSkills || []).map(s => String(s).toLowerCase()));
    let choose = 0;
    let allowedSet = null; // null = any
    const notes = [];
    classNames.forEach((cn, i) => {
      const cls = findPhbClass(cn);
      if (!cls) return;
      const n = cls.skillsChoose || 2;
      choose += n;
      notes.push(`${cn}: ${n}`);
      if (cls.skills === 'Any') {
        /* keep any */
      } else if (Array.isArray(cls.skills)) {
        if (allowedSet === null) allowedSet = new Set();
        // If previous was Any (allowedSet still null from only Any classes), handle:
        cls.skills.forEach(s => allowedSet.add(String(s).toLowerCase()));
      }
    });
    // If any class is Any, allow all skills
    const anyClass = classNames.some(cn => {
      const cls = findPhbClass(cn);
      return cls && cls.skills === 'Any';
    });
    if (anyClass) allowedSet = null;
    if (!choose) choose = 2;
    let allowed = all;
    if (allowedSet) {
      allowed = all.filter(s => allowedSet.has(s.name.toLowerCase()));
    }
    return `
      <div class="skill-picker" data-choose="${choose}" data-locked="${locked ? '1' : '0'}">
        <p class="muted small">Choose <strong>${choose}</strong> skill${choose > 1 ? 's' : ''} total${notes.length > 1 ? ' <span class="muted">(' + escapeHtml(notes.join(' + ')) + ')</span>' : ''}. Selected: <span class="skill-count">0</span>/${choose}</p>
        <div class="skill-grid">
          ${allowed.map(s => `
            <label class="skill-chip" title="${escapeAttr((s.desc || '') + ' (' + (s.ability || '') + ')')}">
              <input type="checkbox" class="m-skill-cb" value="${escapeAttr(s.name)}" ${selected.has(s.name.toLowerCase()) ? 'checked' : ''} ${locked ? 'disabled' : ''} />
              <span>${escapeHtml(s.name)}</span>
            </label>`).join('')}
        </div>
      </div>`;
  }

  function refreshSkillsForPrimaryClass(className) {
    const skillBox = document.getElementById('m-skill-picker');
    if (!skillBox) return;
    const names = (typeof readMulticlassFromForm === 'function')
      ? readMulticlassFromForm().map(c => c.name).filter(Boolean)
      : (className ? [className] : []);
    const prevSkills = [...document.querySelectorAll('.m-skill-cb:checked')].map(cb => cb.value);
    skillBox.innerHTML = skillPickerHtml(names[0] || className || '', prevSkills, { classNames: names });
    if (typeof wireSkillPickerLimits === 'function') wireSkillPickerLimits();
  }

  function wireSkillPickerLimits() {
    document.querySelectorAll('.skill-picker').forEach(picker => {
      const max = parseInt(picker.dataset.choose, 10) || 2;
      const locked = picker.dataset.locked === '1';
      const boxes = [...picker.querySelectorAll('.m-skill-cb')];
      // Clone to drop old listeners by replacing nodes
      boxes.forEach(b => {
        const n = b.cloneNode(true);
        b.parentNode.replaceChild(n, b);
      });
      const fresh = [...picker.querySelectorAll('.m-skill-cb')];
      function sync() {
        if (locked) {
          fresh.forEach(b => { b.disabled = true; });
          const countEl = picker.querySelector('.skill-count');
          if (countEl) countEl.textContent = String(fresh.filter(b => b.checked).length);
          return;
        }
        let checked = fresh.filter(b => b.checked);
        // If over limit (e.g. after class change), uncheck from the end
        if (checked.length > max) {
          checked.slice(max).forEach(b => { b.checked = false; });
          checked = fresh.filter(b => b.checked);
        }
        const now = checked.length;
        const countEl = picker.querySelector('.skill-count');
        if (countEl) countEl.textContent = String(now);
        fresh.forEach(b => {
          b.disabled = !b.checked && now >= max;
        });
      }
      fresh.forEach(b => b.addEventListener('change', sync));
      sync();
    });
  }



  function getClassAbilities(className) {
    const all = (typeof window !== 'undefined' && window.CLASS_ABILITIES) ? window.CLASS_ABILITIES : {};
    return all[className] || [];
  }

  function progressionTableHtml(className) {
    const cls = findPhbClass(className);
    if (!cls) return '<p class="muted small">Select a class to view its progression and abilities.</p>';
    const rows = (cls.progression || []).map(([lvl, feat]) =>
      `<tr><td>${lvl}</td><td>${escapeHtml(feat)}</td></tr>`).join('');
    const abilities = getClassAbilities(className);
    const abilityHtml = abilities.length ? `
      <div class="class-abilities">
        <div class="detail-label">Class Abilities</div>
        <ul class="trait-list">
          ${abilities.map(a => `<li><strong>L${a.lvl} — ${escapeHtml(a.name)}.</strong> ${formatRichText(a.text)}</li>`).join('')}
        </ul>
      </div>` : '';
    return `
      <div class="class-summary">
        <p><strong>${escapeHtml(cls.name)}</strong> — ${escapeHtml(cls.summary || '')}</p>
        <p class="muted small">Hit Die ${cls.hitDie} · Primary ${escapeHtml(cls.primary)} · Saves ${escapeHtml(cls.saves)} · Armor: ${escapeHtml(cls.armor || '')}${cls.weapons ? ' · Weapons: ' + escapeHtml(cls.weapons) : ''}</p>
        ${cls.skills ? `<p class="muted small">Skills: choose ${cls.skillsChoose || '?'} from ${cls.skills === 'Any' ? 'any' : (Array.isArray(cls.skills) ? cls.skills.join(', ') : cls.skills)}</p>` : ''}
      </div>
      <table class="prog-table">
        <thead><tr><th>Level</th><th>Features</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      ${abilityHtml}`;
  }


  function multiclassProgressionHtml(ch) {
    const list = normalizeClassLevels(ch);
    if (!list.length) {
      return progressionTableHtml(ch.class || '');
    }
    return list.map(c => {
      const sub = c.subclass ? ` <span class="muted small">(${escapeHtml(c.subclass)})</span>` : '';
      return `<div class="mc-prog-block" style="margin-bottom:1rem">
        <h4 class="section-label" style="margin-bottom:0.35rem">${escapeHtml(c.name)} ${c.level}${sub}</h4>
        ${progressionTableHtml(c.name)}
      </div>`;
    }).join('');
  }

  function getMoonPaths() {
    return (typeof window !== 'undefined' && window.MOON_PATHS) ? window.MOON_PATHS : [];
  }

  function findMoonPath(nameOrId) {
    if (!nameOrId) return null;
    const n = String(nameOrId).toLowerCase();
    return getMoonPaths().find(p => p.id === n || p.name.toLowerCase() === n || p.world.toLowerCase() === n) || null;
  }

  function moonPathOptionsHtml(selected) {
    let html = `<option value="">— Choose Moon Path —</option>`;
    getMoonPaths().forEach(p => {
      const sel = (selected === p.name || selected === p.id || selected === p.world) ? 'selected' : '';
      html += `<option value="${escapeAttr(p.name)}" ${sel}>${escapeHtml(p.name)}</option>`;
    });
    return html;
  }

  function abilityModNum(score) {
    return Math.floor(((Number(score) || 10) - 10) / 2);
  }

  function formatAttackBonus(mod, prof) {
    const t = mod + prof;
    return t >= 0 ? `+${t}` : `${t}`;
  }

  function cantripDiceForLevel(level) {
    if (level >= 17) return '4d';
    if (level >= 11) return '3d';
    if (level >= 5) return '2d';
    return '1d';
  }

  function buildAttacksForClass(className, level, scores, profBonus) {
    const table = (window.CLASS_ATTACKS || {})[className];
    if (!table) return '';
    const lvl = clamp(Number(level) || 1, 1, 20);
    const pb = Number(profBonus) || (window.PHB_PROF_BY_LEVEL ? window.PHB_PROF_BY_LEVEL[lvl] : 2);
    const str = abilityModNum(scores.str);
    const dex = abilityModNum(scores.dex);
    const int = abilityModNum(scores.int);
    const wis = abilityModNum(scores.wis);
    const cha = abilityModNum(scores.cha);
    let atkMod = str;
    let style = table.style || 'str_melee';
    if (style.includes('dex')) atkMod = dex;
    if (style.includes('wis')) atkMod = Math.max(str, wis);
    if (style === 'wis_spell') atkMod = wis;
    if (style === 'cha_spell') atkMod = cha;
    if (style === 'int_spell') atkMod = int;
    if (style === 'wis_hybrid') atkMod = Math.max(str, dex);
    if (style === 'dex_ranged') atkMod = dex;

    const lines = [];
    (table.weapons || []).forEach(([name, dice, dtype], idx) => {
      const dmgMod = atkMod;
      const dmgStr = dmgMod >= 0 ? `${dice}+${dmgMod}` : `${dice}${dmgMod}`;
      lines.push(`${name}: ${formatAttackBonus(atkMod, pb)} to hit, ${dmgStr} ${dtype}`);
    });
    if (table.cantrip) {
      const c = table.cantrip;
      // scale dice if pattern like 1d10
      let scaled = c;
      const m = c.match(/(\d+)d(\d+)/);
      if (m && (style.includes('spell') || className === 'Warlock' || className === 'Sorcerer' || className === 'Wizard' || className === 'Cleric' || className === 'Druid' || className === 'Bard')) {
        const n = cantripDiceForLevel(lvl).replace('d','');
        scaled = c.replace(/(\d+)d(\d+)/, `${cantripDiceForLevel(lvl)}${m[2]}`);
      }
      const spellMod = style.includes('cha') ? cha : style.includes('int') ? int : style.includes('wis') ? wis : atkMod;
      if (/to hit|attack/i.test(scaled) || /Bolt|Blast|Flame/.test(scaled)) {
        lines.push(`${scaled.split('(')[0].trim()}: ${formatAttackBonus(spellMod, pb)} to hit (${scaled.includes('(') ? scaled.slice(scaled.indexOf('(')+1).replace(')','') : 'see PHB'})`);
      } else {
        lines.push(scaled + ` [DC ${8 + pb + spellMod}]`);
      }
    }
    if (table.note) lines.push(`Note: ${table.note}`);
    // Extra Attack note
    if (lvl >= 5 && ['Barbarian','Fighter','Paladin','Ranger','Monk','Moon Guardian','Bloodhunter','Ghostblade'].includes(className)) {
      lines.push(lvl >= 20 && className === 'Fighter' ? 'Extra Attack (3)' : lvl >= 11 && className === 'Fighter' ? 'Extra Attack (2)' : 'Extra Attack (2 attacks)');
    }
    if (className === 'Rogue' || className === 'Shadowblade') {
      const sa = Math.ceil(lvl / 2);
      lines.push(`Sneak Attack: ${sa}d6 when eligible`);
    }
    if (className === 'Moon Guardian' && lvl >= 2) {
      lines.push(`Spell save DC ${8 + pb + wis}; Spell attack ${formatAttackBonus(wis, pb)}`);
      lines.push('Moonlight Infusion: spend Lunar Charges (see class features)');
    }
    return lines.join('\n');
  }


  /** Feature sections that can be updated independently without wiping others. */
  
  
  
  
  

  const COMPENDIUM_IDB_NAME = 'dsc-toolkt';
  const COMPENDIUM_IDB_STORE = 'compendium';
  const COMPENDIUM_IDB_KEY = 'user';
  let _compendiumCache = null;
  let _compendiumSaveTimer = null;

  function emptyCompendium() {
    return {
      spells: [], equipment: [], creatures: [],
      races: [], classes: [], subclasses: [], feats: [],
      meta: {}
    };
  }

  function openCompendiumDb() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) {
        reject(new Error('IndexedDB unavailable'));
        return;
      }
      const req = indexedDB.open(COMPENDIUM_IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(COMPENDIUM_IDB_STORE)) {
          db.createObjectStore(COMPENDIUM_IDB_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('IDB open failed'));
    });
  }

  async function idbGetCompendium() {
    const db = await openCompendiumDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(COMPENDIUM_IDB_STORE, 'readonly');
      const store = tx.objectStore(COMPENDIUM_IDB_STORE);
      const req = store.get(COMPENDIUM_IDB_KEY);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async function idbSetCompendium(data) {
    const db = await openCompendiumDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(COMPENDIUM_IDB_STORE, 'readwrite');
      const store = tx.objectStore(COMPENDIUM_IDB_STORE);
      const req = store.put(data, COMPENDIUM_IDB_KEY);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  function getUserCompendium() {
    if (_compendiumCache) return _compendiumCache;
    // Synchronous fallback: try tiny localStorage stub / legacy, else empty
    try {
      const legacy = localStorage.getItem('cv_combat_compendium_extra');
      if (legacy) {
        const parsed = JSON.parse(legacy);
        _compendiumCache = {
          spells: parsed.spells || [],
          equipment: parsed.equipment || [],
          creatures: parsed.creatures || [],
          meta: parsed.meta || {}
        };
        return _compendiumCache;
      }
    } catch (e) {
      // quota or parse error — ignore
    }
    _compendiumCache = emptyCompendium();
    return _compendiumCache;
  }

  function saveUserCompendium(data) {
    const normalized = {
      spells: data.spells || [],
      equipment: data.equipment || [],
      creatures: data.creatures || [],
      meta: data.meta || {}
    };
    _compendiumCache = normalized;
    // Persist to IndexedDB (large capacity). Debounce rapid writes.
    if (_compendiumSaveTimer) clearTimeout(_compendiumSaveTimer);
    _compendiumSaveTimer = setTimeout(() => {
      idbSetCompendium(normalized).then(() => {
        // Drop legacy localStorage copy so it cannot blow the quota
        try { localStorage.removeItem('cv_combat_compendium_extra'); } catch (e) {}
        // Keep only a tiny pointer in localStorage
        try {
          localStorage.setItem('cv_combat_compendium_meta', JSON.stringify({
            backend: 'indexeddb',
            spells: normalized.spells.length,
            equipment: normalized.equipment.length,
            creatures: normalized.creatures.length,
            updatedAt: normalized.meta?.updatedAt || new Date().toISOString()
          }));
        } catch (e) {}
      }).catch(err => {
        console.warn('IndexedDB save failed', err);
        // Last resort: try trimmed localStorage (no creature descriptions)
        try {
          const slim = {
            spells: normalized.spells,
            equipment: normalized.equipment,
            creatures: (normalized.creatures || []).map(c => ({
              n: c.n, w: c.w, o: c.o || 'Imported', classif: c.classif,
              cr: c.cr, ac: c.ac, hp: c.hp, speed: c.speed,
              str: c.str, dex: c.dex, con: c.con, int: c.int, wis: c.wis, cha: c.cha,
              source: c.source, _src: c._src || 'Imported', _key: c._key,
              desc: (c.desc || '').slice(0, 280)
            })),
            meta: { ...(normalized.meta || {}), trimmed: true }
          };
          localStorage.setItem('cv_combat_compendium_extra', JSON.stringify(slim));
        } catch (e2) {
          console.warn('localStorage fallback also failed', e2);
          if (typeof toast === 'function') toast('Storage full — could not save full compendium');
        }
      });
    }, 50);
  }

  async function loadUserCompendiumAsync() {
    try {
      const fromIdb = await idbGetCompendium();
      if (fromIdb && (fromIdb.spells || fromIdb.equipment || fromIdb.creatures)) {
        _compendiumCache = {
          spells: fromIdb.spells || [],
          equipment: fromIdb.equipment || [],
          creatures: fromIdb.creatures || [],
          meta: fromIdb.meta || {}
        };
        try { localStorage.removeItem('cv_combat_compendium_extra'); } catch (e) {}
        return _compendiumCache;
      }
    } catch (e) {
      console.warn('IndexedDB load failed', e);
    }
    // Migrate legacy localStorage → IndexedDB
    try {
      const legacy = localStorage.getItem('cv_combat_compendium_extra');
      if (legacy) {
        const parsed = JSON.parse(legacy);
        _compendiumCache = {
          spells: parsed.spells || [],
          equipment: parsed.equipment || [],
          creatures: parsed.creatures || [],
          meta: parsed.meta || {}
        };
        await idbSetCompendium(_compendiumCache);
        try { localStorage.removeItem('cv_combat_compendium_extra'); } catch (e) {}
        return _compendiumCache;
      }
    } catch (e) {
      try { localStorage.removeItem('cv_combat_compendium_extra'); } catch (e2) {}
    }
    if (!_compendiumCache) _compendiumCache = emptyCompendium();
    return _compendiumCache;
  }



  function mergeSpellRecord(raw) {
    if (!raw || !raw.name) return null;
    const name = String(raw.name).trim();
    const id = (raw.id || name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const level = raw.level != null ? Number(raw.level) : (String(raw.levelText || '').toLowerCase().includes('cantrip') ? 0 : parseInt(raw.levelText, 10) || 0);
    return {
      id,
      name,
      level: isNaN(level) ? 0 : level,
      school: raw.school || 'Unknown',
      time: raw.time || raw.castingTime || raw.casting_time || '—',
      range: raw.range || '—',
      components: raw.components || '—',
      duration: raw.duration || '—',
      classes: Array.isArray(raw.classes) ? raw.classes : String(raw.classes || '').split(/[,;]/).map(s => s.trim()).filter(Boolean),
      summary: raw.summary || (raw.description || '').slice(0, 200),
      description: raw.description || raw.text || raw.summary || '',
      ritual: !!(raw.ritual),
      concentration: !!(raw.concentration) || /concentration/i.test(String(raw.duration || '')),
      source: raw.source || raw.edition || 'Imported'
    };
  }

  function mergeEquipmentRecord(raw) {
    if (!raw || !raw.name) return null;
    const name = String(raw.name).trim();
    const id = (raw.id || name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const cat = (raw.category || raw.type || 'gear').toLowerCase();
    let catNorm = ['armor','weapon','shield','gear','tool','consumable','potion'].includes(cat) ? cat : 'gear';
    if (catNorm === 'potion') catNorm = 'consumable';
    const nmLow = name.toLowerCase();
    if (/potion|elixir|philter/.test(nmLow)) catNorm = 'consumable';
    const item = {
      id,
      name,
      category: catNorm,
      cost: raw.cost || '',
      weight: raw.weight != null ? Number(raw.weight) || 0 : 0,
      notes: raw.notes || raw.description || '',
      source: raw.source || raw.edition || 'Imported'
    };
    if (item.category === 'armor') {
      item.armorType = raw.armorType || raw.armor_type || 'light';
      item.acBase = raw.acBase != null ? Number(raw.acBase) : (raw.ac != null ? Number(raw.ac) : 11);
      item.acDexMax = raw.acDexMax != null ? raw.acDexMax : null;
    }
    if (item.category === 'shield') {
      item.armorType = 'shield';
      item.acBonus = raw.acBonus != null ? Number(raw.acBonus) : 2;
    }
    if (item.category === 'consumable' || /potion|elixir/i.test(item.name)) {
      item.consumable = true;
      const blob = (item.notes || '') + ' ' + item.name;
      if (/heal|regain|hit point/i.test(blob)) {
        item.healing = true;
        const hm = blob.match(/(\d+d\d+\s*[+]?\s*\d*)/i);
        if (hm) item.healDice = hm[1].replace(/\s+/g, '');
        if (/potion of healing/i.test(item.name) && !/greater|superior|supreme/i.test(item.name)) item.healDice = item.healDice || '2d4+2';
        if (/greater healing/i.test(item.name)) item.healDice = item.healDice || '4d4+4';
        if (/superior healing/i.test(item.name)) item.healDice = item.healDice || '8d4+8';
        if (/supreme healing/i.test(item.name)) item.healDice = item.healDice || '10d4+20';
      }
      if (raw.healDice) item.healDice = raw.healDice;
      if (raw.healFlat != null) item.healFlat = Number(raw.healFlat);
    }
    if (item.category === 'weapon') {
      item.weaponType = raw.weaponType || raw.weapon_type || '';
      item.damage = raw.damage || '';
      item.damageType = raw.damageType || raw.damage_type || '';
      item.props = raw.props || raw.properties || '';
    }
    return item;
  }

  function applyCompendiumToRuntime() {
    const baseSpells = (window.SPELLS_BASE || window.SPELLS || []).slice();
    const baseEquip = (window.EQUIPMENT_BASE || window.EQUIPMENT || []).slice();
    if (!window.SPELLS_BASE) window.SPELLS_BASE = baseSpells.map(s => ({ ...s }));
    if (!window.EQUIPMENT_BASE) window.EQUIPMENT_BASE = baseEquip.map(e => ({ ...e }));
    if (!window.BESTIARY_BASE) {
      window.BESTIARY_BASE = (typeof window !== 'undefined' && window.BESTIARY_DATA)
        ? window.BESTIARY_DATA.map(b => ({ ...b }))
        : [];
    }
    const extra = getUserCompendium();
    const spellMap = new Map(window.SPELLS_BASE.map(s => [s.id, s]));
    (extra.spells || []).forEach(s => {
      const m = mergeSpellRecord(s);
      if (m) spellMap.set(m.id, m);
    });
    const eqMap = new Map(window.EQUIPMENT_BASE.map(e => [e.id, e]));
    (extra.equipment || []).forEach(e => {
      const m = mergeEquipmentRecord(e);
      if (m) eqMap.set(m.id, m);
    });
    window.SPELLS = [...spellMap.values()].sort((a,b) => (a.level-b.level) || a.name.localeCompare(b.name));
    try { ensureMoonGuardianSpellList(); } catch (e) {}
      try { mergeAllCustomContent(); } catch (e) {}
    window.EQUIPMENT = [...eqMap.values()];
    // Homebrew catalog → runtime CUSTOM_* arrays (merged with file-based custom content)
    const homeRaces = extra.races || [];
    const homeClasses = extra.classes || [];
    const homeSubs = extra.subclasses || [];
    const homeFeats = extra.feats || [];
    window.CUSTOM_RACES = [...(Array.isArray(window.CUSTOM_RACES_FILE) ? window.CUSTOM_RACES_FILE : (window.CUSTOM_RACES || [])), ...homeRaces];
    // Dedupe races by name
    (function dedupe(arr, key) {
      const m = new Map();
      arr.forEach(x => { if (x && x[key]) m.set(String(x[key]).toLowerCase(), x); });
      return [...m.values()];
    });
    window.CUSTOM_RACES = (() => { const m = new Map(); (window.CUSTOM_RACES || []).forEach(r => { if (r && r.name) m.set(r.name.toLowerCase(), r); }); return [...m.values()]; })();
    window.CUSTOM_CLASSES = (() => { const m = new Map(); [...(window.CUSTOM_CLASSES || []), ...homeClasses].forEach(c => { if (c && c.name) m.set(c.name.toLowerCase(), c); }); return [...m.values()]; })();
    window.CUSTOM_SUBCLASSES = (() => { const m = new Map(); [...(window.CUSTOM_SUBCLASSES || []), ...homeSubs].forEach(s => { if (s && s.name) m.set((s.parentClass||'') + '::' + s.name.toLowerCase(), s); }); return [...m.values()]; })();
    window.CUSTOM_FEATS = (() => { const m = new Map(); [...(window.CUSTOM_FEATS || []), ...homeFeats].forEach(f => { if (f && f.name) m.set(f.name.toLowerCase(), f); }); return [...m.values()]; })();
    try { if (typeof mergeAllCustomContent === 'function') mergeAllCustomContent(); } catch (e) {}

    // Bestiary merge: DSC base + imported (imported keyed by n+source)
    const srcFilter = window.BESTIARY_SOURCE || 'all';
    const importedRaw = (extra.creatures || []).map(c => ({ ...c, _src: c._src || c.source || 'Imported' }));
    // Dedupe imported by _key then by lowercase name
    const seenKey = new Set();
    const seenName = new Set();
    const imported = [];
    importedRaw.forEach(c => {
      const key = String(c._key || '').trim();
      const nm = String(c.n || c.name || '').trim().toLowerCase();
      if (key && seenKey.has(key)) return;
      if (nm && seenName.has(nm)) return;
      if (key) seenKey.add(key);
      if (nm) seenName.add(nm);
      imported.push(c);
    });
    let list;
    if (srcFilter === 'dsc') list = window.BESTIARY_BASE.slice();
    else if (srcFilter === 'imported') list = imported.slice();
    else list = window.BESTIARY_BASE.concat(imported);
    window.BESTIARY_MERGED = list;
    if (typeof refreshBestiaryRef === 'function') refreshBestiaryRef();
  }

  function importCompendiumPack(obj) {
    // exposed for extensions / VTT import
    window.importCompendiumPack = importCompendiumPack;
    // Flexible: accepts DSCToolkt-compendium-v1, or raw {spells:[], equipment:[]},
    // or Open5e-ish / homebrew arrays
    let spellsIn = [];
    let equipIn = [];
    let creaturesIn = [];
    let meta = { edition: '', source: '', attribution: '' };
    if (Array.isArray(obj)) {
      obj.forEach(row => {
        if (row.level != null || row.school || row.castingTime || row.casting_time) spellsIn.push(row);
        else if (row.stats || row.n || row.cr != null || row.challenge_rating != null || row.hit_points != null || row.challengeRating != null)
          creaturesIn.push(row);
        else equipIn.push(row);
      });
    } else if (obj && typeof obj === 'object') {
      meta.edition = obj.edition || obj.system || '';
      meta.source = obj.source || obj.name || '';
      meta.attribution = obj.attribution || '';
      spellsIn = obj.spells || obj.spell || obj.Spells || [];
      equipIn = obj.equipment || obj.items || obj.gear || obj.Equipment || [];
      creaturesIn = obj.creatures || obj.monsters || obj.bestiary || [];
      // CritterDB single creature export
      if (!creaturesIn.length && obj.stats && obj.name) creaturesIn = [obj];
      // CritterDB bestiary export { name, creatures: [...] }
      if (!creaturesIn.length && Array.isArray(obj.Creatures)) creaturesIn = obj.Creatures;
      if (!spellsIn.length && obj.compendium?.spells) spellsIn = obj.compendium.spells;
      if (!equipIn.length && obj.compendium?.items) equipIn = obj.compendium.items;
      if (!creaturesIn.length && obj.compendium?.creatures) creaturesIn = obj.compendium.creatures;
    }
    const extra = getUserCompendium();
    const spellMap = new Map((extra.spells || []).map(s => [s.id || s.name, s]));
    let sCount = 0, eCount = 0, cCount = 0;
    spellsIn.forEach(raw => {
      const m = mergeSpellRecord(raw);
      if (m) { spellMap.set(m.id, m); sCount++; }
    });
    const eqMap = new Map((extra.equipment || []).map(e => [e.id || e.name, e]));
    equipIn.forEach(raw => {
      const m = mergeEquipmentRecord(raw);
      if (m) { eqMap.set(m.id, m); eCount++; }
    });
    const creMap = new Map();
    const creByName = new Map(); // lowercase name → map key (dedupe aliases)
    function registerExistingCreature(c) {
      if (!c) return;
      const key = String(c._key || c.n || c.name || '').trim();
      if (!key) return;
      creMap.set(key, c);
      const nm = String(c.n || c.name || '').trim().toLowerCase();
      if (nm) creByName.set(nm, key);
    }
    (extra.creatures || []).forEach(registerExistingCreature);
    let cAdded = 0, cUpdated = 0, cSkipped = 0;
    creaturesIn.forEach(raw => {
      let c = raw;
      if (raw && raw.stats && (raw.stats.abilityScores || raw.stats.armorClass != null))
        c = mapCritterDbCreature(raw, raw._bestiaryName ? `CritterDB: ${raw._bestiaryName}` : undefined);
      else if (raw.challenge_rating != null || raw.hit_points != null || raw.ability_scores)
        c = mapOpen5eCreature(raw);
      else if (raw.name && !raw.n) c = { ...raw, n: raw.name, o: raw.o || 'Imported', _src: 'Imported' };
      if (!c || !(c.n || c.name)) return;
      c = { ...c, _src: c._src || 'Imported' };
      const key = String(c._key || c.n || c.name).trim();
      const nm = String(c.n || c.name || '').trim().toLowerCase();
      // Prefer match by stable key, else by name (avoids same monster from two bestiaries)
      const existingKey = creMap.has(key) ? key : (nm && creByName.has(nm) ? creByName.get(nm) : null);
      if (existingKey) {
        const prev = creMap.get(existingKey);
        // Same content signature → skip; else update in place under existing key
        const sig = (x) => [x.n || x.name, x.ac, x.hp, x.cr, (x.desc || '').length].join('|');
        if (prev && sig(prev) === sig(c)) {
          cSkipped++;
          return;
        }
        creMap.set(existingKey, { ...c, _key: prev?._key || c._key || existingKey });
        if (nm) creByName.set(nm, existingKey);
        cUpdated++;
      } else {
        creMap.set(key, c);
        if (nm) creByName.set(nm, key);
        cAdded++;
      }
      cCount++;
    });
    // expose for status messages
    importCompendiumPack._lastCreatureStats = { added: cAdded, updated: cUpdated, skipped: cSkipped };
    // Races / classes / subclasses / feats (homebrew)
    function mergeList(existing, incoming, mapFn) {
      const map = new Map();
      (existing || []).forEach(x => {
        const m = mapFn(x);
        if (m) map.set(m.id || m.name, m);
      });
      let n = 0;
      (incoming || []).forEach(raw => {
        const m = mapFn(raw);
        if (!m) return;
        map.set(m.id || m.name, m);
        n++;
      });
      return { list: [...map.values()], count: n };
    }
    const raceIn = obj.races || obj.race || meta.races || [];
    const classIn = obj.classes || obj.class || [];
    const subIn = obj.subclasses || obj.subclass || [];
    const featIn = obj.feats || obj.feat || [];
    const raceMerge = mergeList(extra.races, Array.isArray(raceIn) ? raceIn : [], (raw) => {
      if (!raw || !raw.name) return null;
      const name = String(raw.name).trim();
      const id = (raw.id || name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      return {
        id, name,
        source: raw.source || 'Homebrew',
        size: raw.size || 'Medium',
        speed: raw.speed || '30 ft.',
        summary: raw.summary || raw.description || '',
        abilityBonuses: raw.abilityBonuses || raw.asi || {},
        traits: Array.isArray(raw.traits) ? raw.traits : [],
        world: raw.world || '',
        tagline: raw.tagline || raw.summary || ''
      };
    });
    const classMerge = mergeList(extra.classes, Array.isArray(classIn) ? classIn : [], (raw) => {
      if (!raw || !raw.name) return null;
      const name = String(raw.name).trim();
      const id = (raw.id || name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      return {
        id, name,
        source: raw.source || 'Homebrew',
        hitDie: raw.hitDie || raw.hit_die || 'd8',
        primaryAbility: raw.primaryAbility || [],
        saves: raw.saves || [],
        skillsChoose: raw.skillsChoose != null ? Number(raw.skillsChoose) : 2,
        skills: raw.skills || [],
        summary: raw.summary || '',
        progression: raw.progression || [],
        features: raw.features || []
      };
    });
    const subMerge = mergeList(extra.subclasses, Array.isArray(subIn) ? subIn : [], (raw) => {
      if (!raw || !raw.name) return null;
      const name = String(raw.name).trim();
      const id = (raw.id || name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      return {
        id, name,
        parentClass: raw.parentClass || raw.parent || raw.class || '',
        source: raw.source || 'Homebrew',
        summary: raw.summary || '',
        features: raw.features || []
      };
    });
    const featMerge = mergeList(extra.feats, Array.isArray(featIn) ? featIn : [], (raw) => {
      if (!raw || !raw.name) return null;
      const name = String(raw.name).trim();
      const id = (raw.id || name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      return {
        id, name,
        source: raw.source || 'Homebrew',
        prerequisite: raw.prerequisite || '',
        text: raw.text || raw.description || ''
      };
    });

    const next = {
      spells: [...spellMap.values()],
      equipment: [...eqMap.values()],
      creatures: [...creMap.values()],
      races: raceMerge.list,
      classes: classMerge.list,
      subclasses: subMerge.list,
      feats: featMerge.list,
      meta: { ...(extra.meta || {}), ...meta, updatedAt: new Date().toISOString() }
    };
    saveUserCompendium(next);
    applyCompendiumToRuntime();
    const cStats = importCompendiumPack._lastCreatureStats || { added: cCount, updated: 0, skipped: 0 };
    return {
      spells: sCount,
      equipment: eCount,
      creatures: cCount,
      races: raceMerge.count,
      classes: classMerge.count,
      subclasses: subMerge.count,
      feats: featMerge.count,
      creaturesAdded: cStats.added,
      creaturesUpdated: cStats.updated,
      creaturesSkipped: cStats.skipped,
      totalSpells: window.SPELLS.length,
      totalEquipment: window.EQUIPMENT.length,
      totalCreatures: (window.BESTIARY_MERGED || []).length
    };
  }

  

  const OPEN5E_V2 = 'https://api.open5e.com/v2';

  async function open5eFetchAll(path, params = {}, { maxPages = 80, onPage } = {}) {
    const results = [];
    const qs = new URLSearchParams({ limit: '100', ...params });
    let url = `${OPEN5E_V2}${path}?${qs.toString()}`;
    let page = 0;
    while (url && page < maxPages) {
      page++;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Open5e ${res.status} ${path}`);
      const data = await res.json();
      results.push(...(data.results || []));
      if (typeof onPage === 'function') onPage(page, results.length, data.count);
      url = data.next || null;
    }
    return results;
  }

  function open5eComponents(s) {
    if (s.components) return String(s.components);
    const parts = [];
    if (s.verbal) parts.push('V');
    if (s.somatic) parts.push('S');
    if (s.material || s.material_specified) {
      const mat = s.material_specified || s.material;
      parts.push(mat ? `M (${mat})` : 'M');
    }
    return parts.length ? parts.join(', ') : '—';
  }

  function open5eCastingTime(s) {
    let t = s.casting_time || 'action';
    t = String(t).replace(/_/g, ' ');
    if (/^\d/.test(t)) return t;
    // v2 often uses "action", "bonus_action", "reaction", "1 minute"
    if (t === 'action') return '1 action';
    if (t === 'bonus action' || t === 'bonus_action') return '1 bonus action';
    if (t === 'reaction') {
      return s.reaction_condition ? `1 reaction (${s.reaction_condition})` : '1 reaction';
    }
    return t;
  }


  function mapOpen5eSpell(s) {
    const level = s.level != null ? Number(s.level) : 0;
    const classes = Array.isArray(s.classes)
      ? s.classes.map(c => (typeof c === 'string' ? c : (c.name || c.key || ''))).filter(Boolean)
      : [];
    let school = 'Unknown';
    if (typeof s.school === 'object' && s.school) school = s.school.name || s.school.key || 'Unknown';
    else if (s.school) school = String(s.school);
    school = String(school).replace(/_/g, ' ');
    school = school.charAt(0).toUpperCase() + school.slice(1);

    // v2 may put overrides on casting_options[0]
    const opt = Array.isArray(s.casting_options) && s.casting_options.length ? s.casting_options[0] : {};
    let durationRaw = opt.duration != null ? opt.duration : (s.duration || '—');
    durationRaw = String(durationRaw).replace(/_/g, ' ');
    const concentration = s.concentration === true || opt.concentration === true || /concentration/i.test(durationRaw);
    let duration = durationRaw;
    if (concentration && !/concentration/i.test(durationRaw)) duration = `Concentration, ${durationRaw}`;

    let time = open5eCastingTime(s);
    if (opt.type && opt.type !== 'default' && !s.casting_time) {
      time = open5eCastingTime({ casting_time: opt.type, reaction_condition: s.reaction_condition });
    }

    let range = s.range_text || '';
    if (!range && (opt.range != null || s.range != null)) {
      const r = opt.range != null ? opt.range : s.range;
      range = `${r} ${s.range_unit || 'feet'}`.trim();
    }
    if (!range) range = '—';

    const descParts = [s.desc || ''];
    if (s.higher_level) descParts.push(`\n\nAt Higher Levels. ${s.higher_level}`);
    if (s.damage_roll) descParts.push(`\n\nDamage: ${s.damage_roll}`);
    if (s.saving_throw_ability) descParts.push(`\n\nSave: ${s.saving_throw_ability}`);
    const desc = descParts.join('').trim();
    const doc = s.document || {};
    const key = s.key || s.name || '';
    const id = String(key).toLowerCase().replace(/^[^_]*_/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || String(s.name).toLowerCase().replace(/[^a-z0-9]+/g, '-');

    return mergeSpellRecord({
      id,
      name: s.name,
      level,
      school,
      time,
      range,
      components: open5eComponents(s),
      duration,
      classes,
      description: desc,
      summary: (s.desc || '').slice(0, 220),
      ritual: !!s.ritual,
      concentration,
      source: doc.display_name || doc.name || doc.key || 'Open5e'
    });
  }

  function mapOpen5eWeapon(w) {
    const isSimple = w.is_simple === true;
    const ranged = (w.range != null && Number(w.range) > 0) || (w.long_range != null && Number(w.long_range) > 0);
    let weaponType = isSimple
      ? (ranged ? 'simple ranged' : 'simple melee')
      : (ranged ? 'martial ranged' : 'martial melee');
    const props = Array.isArray(w.properties)
      ? w.properties.map(p => {
          const name = p?.property?.name || p?.name || '';
          const detail = p?.detail;
          return detail ? `${name} (${detail})` : name;
        }).filter(Boolean).join(', ')
      : '';
    const dtype = typeof w.damage_type === 'object' && w.damage_type
      ? (w.damage_type.name || '').toLowerCase()
      : String(w.damage_type || '').toLowerCase();
    const doc = w.document || {};
    const key = w.key || w.name || '';
    return mergeEquipmentRecord({
      id: String(key).toLowerCase().replace(/^[^_]*_/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
      name: w.name,
      category: 'weapon',
      weaponType,
      damage: w.damage_dice || '',
      damageType: dtype,
      props,
      cost: w.cost != null ? String(w.cost) : '',
      weight: w.weight != null ? Number(w.weight) || 0 : 0,
      notes: [props, ranged && w.range ? `Range ${w.range}${w.long_range ? '/' + w.long_range : ''}` : ''].filter(Boolean).join(' · '),
      source: doc.display_name || doc.name || 'Open5e'
    });
  }

  function mapOpen5eArmor(a) {
    const doc = a.document || {};
    const catRaw = (a.category || '').toLowerCase();
    const isShield = catRaw.includes('shield') || /shield/i.test(a.name || '');
    const key = a.key || a.name || '';
    const id = String(key).toLowerCase().replace(/^[^_]*_/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    if (isShield) {
      return mergeEquipmentRecord({
        id,
        name: a.name,
        category: 'shield',
        acBonus: 2,
        cost: a.cost != null ? String(a.cost) : '',
        weight: a.weight != null ? Number(a.weight) || 0 : 0,
        notes: a.ac_display || '',
        source: doc.display_name || doc.name || 'Open5e'
      });
    }
    let armorType = 'light';
    if (catRaw.includes('medium')) armorType = 'medium';
    else if (catRaw.includes('heavy')) armorType = 'heavy';
    else if (catRaw.includes('light')) armorType = 'light';
    return mergeEquipmentRecord({
      id,
      name: a.name,
      category: 'armor',
      armorType,
      acBase: a.ac_base != null ? Number(a.ac_base) : 11,
      acDexMax: a.ac_cap_dexmod != null ? a.ac_cap_dexmod : (a.ac_add_dexmod === false ? 0 : null),
      cost: a.cost != null ? String(a.cost) : '',
      weight: a.weight != null ? Number(a.weight) || 0 : 0,
      notes: [a.ac_display || '', a.grants_stealth_disadvantage ? 'Stealth disadvantage' : '', a.strength_score_required ? `Str ${a.strength_score_required}` : ''].filter(Boolean).join(' · '),
      source: doc.display_name || doc.name || 'Open5e'
    });
  }

  function mapOpen5eItem(it) {
    const doc = it.document || {};
    const catObj = it.category;
    const catName = (typeof catObj === 'object' ? (catObj.name || catObj.key) : catObj) || 'gear';
    const catL = String(catName).toLowerCase();
    let category = 'gear';
    if (catL.includes('weapon')) category = 'weapon';
    else if (catL.includes('armor')) category = 'armor';
    else if (catL.includes('shield')) category = 'shield';
    else if (catL.includes('tool')) category = 'tool';
    const key = it.key || it.name || '';
    const id = String(key).toLowerCase().replace(/^[^_]*_/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return mergeEquipmentRecord({
      id,
      name: it.name,
      category,
      cost: it.cost != null ? String(it.cost) : '',
      weight: it.weight != null ? Number(it.weight) || 0 : 0,
      notes: (it.desc || '').slice(0, 500),
      source: doc.display_name || doc.name || 'Open5e'
    });
  }

  function mapOpen5eMagicItem(it) {
    const doc = it.document || {};
    const rarity = typeof it.rarity === 'object' ? (it.rarity.name || '') : (it.rarity || '');
    const key = it.key || it.name || '';
    const id = 'magic-' + String(key).toLowerCase().replace(/^[^_]*_/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    let category = 'magic';
    if (it.armor) category = /shield/i.test(String(it.armor.name || it.armor.category || '')) ? 'shield' : 'armor';
    else if (it.weapon) category = 'weapon';
    const bonusMatch = String(it.name || '').match(/\(\+(\d+)\)/);
    const magicBonus = bonusMatch ? parseInt(bonusMatch[1], 10) : 0;
    const notes = [
      rarity ? `Rarity: ${rarity}` : '',
      magicBonus ? `Magic bonus: +${magicBonus}` : '',
      it.requires_attunement ? `Attunement${it.attunement_detail ? ': ' + it.attunement_detail : ''}` : '',
      (it.desc || '').slice(0, 700)
    ].filter(Boolean).join('\n');
    const rec = {
      id,
      name: it.name,
      category,
      cost: it.cost != null ? String(it.cost) : '',
      weight: it.weight != null ? Number(it.weight) || 0 : 0,
      notes,
      source: doc.display_name || doc.name || 'Open5e',
      magic: true,
      rarity: typeof rarity === 'string' ? rarity : (rarity && rarity.name) || '',
      attunement: !!it.requires_attunement,
      magicBonus
    };
    if ((category === 'armor' || category === 'shield') && it.armor) {
      rec.armorType = (it.armor.category || it.armor.name || 'medium').toString().toLowerCase();
      rec.acBase = it.armor.ac_base != null ? Number(it.armor.ac_base) : (it.armor.base_ac != null ? Number(it.armor.base_ac) : 11);
      rec.acDexMax = it.armor.ac_cap_dexmod != null ? it.armor.ac_cap_dexmod : null;
    }
    if (category === 'weapon' && it.weapon) {
      const w = it.weapon;
      rec.damage = w.damage_dice || w.damage || '';
      const dtype = w.damage_type;
      rec.damageType = typeof dtype === 'object' ? (dtype.name || '') : (dtype || '');
      rec.weaponType = w.is_simple ? 'simple' : (w.is_martial ? 'martial' : 'weapon');
      if (magicBonus) rec.atkBonus = magicBonus;
    }
    return mergeEquipmentRecord(rec);
  }

  function mapOpen5eFeat(f) {
    const doc = f.document || {};
    const key = f.key || f.name || '';
    const id = 'feat-' + String(key).toLowerCase().replace(/^[^_]*_/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const benefits = Array.isArray(f.benefits) ? f.benefits.map(b => (typeof b === 'string' ? b : (b.desc || b.name || ''))).filter(Boolean).join('\n') : '';
    const notes = [
      f.prerequisite ? `Prerequisite: ${f.prerequisite}` : '',
      f.desc || '',
      benefits
    ].filter(Boolean).join('\n\n');
    return mergeEquipmentRecord({
      id,
      name: f.name + ' (Feat)',
      category: 'gear',
      cost: '',
      weight: 0,
      notes: notes.slice(0, 900),
      source: doc.display_name || doc.name || 'Open5e',
      isFeat: true
    });
  }

  function mapOpen5eCreature(c) {
    const doc = c.document || {};
    const scores = c.ability_scores || c.abilities || {};
    const size = typeof c.size === 'object' ? (c.size.name || '') : (c.size || '');
    const type = typeof c.type === 'object' ? (c.type.name || '') : (c.type || c.creature_type || '');
    const speedObj = c.speed || {};
    let speedParts = [];
    if (typeof speedObj === 'object' && speedObj) {
      Object.entries(speedObj).forEach(([k, v]) => {
        if (v != null && k !== 'unit') speedParts.push(`${k} ${v}${speedObj.unit ? ' ' + speedObj.unit : ' ft.'}`);
      });
    } else if (typeof c.speed === 'string') speedParts = [c.speed];
    const traits = (c.traits || []).map(t => `**${t.name}.** ${(t.desc || '').slice(0, 600)}`).join('\\n');
    const actions = (c.actions || []).map(a => `**${a.name}.** ${(a.desc || '').slice(0, 800)}`).join('\\n');
    const cr = c.challenge_rating_text != null ? c.challenge_rating_text : (c.challenge_rating != null ? Number(c.challenge_rating) : 0);
    const name = c.name || 'Unknown';
    const ac = c.armor_class != null ? c.armor_class : (c.ac != null ? c.ac : 10);
    return {
      n: name,
      w: doc.display_name || doc.name || 'Open5e',
      o: 'Imported',
      classif: [size, type].filter(Boolean).join(' ') || type || '',
      cr: typeof cr === 'number' && !isNaN(cr) ? cr : parseFloat(cr) || 0,
      ac: typeof ac === 'object' ? (ac.value || ac.armor_class || 10) : ac,
      hp: c.hit_points != null ? c.hit_points : (c.hp != null ? c.hp : 1),
      speed: speedParts.join(', ') || '30 ft.',
      str: scores.strength || scores.str || 10,
      dex: scores.dexterity || scores.dex || 10,
      con: scores.constitution || scores.con || 10,
      int: scores.intelligence || scores.int || 10,
      wis: scores.wisdom || scores.wis || 10,
      cha: scores.charisma || scores.cha || 10,
      desc: [
        c.alignment ? `Alignment: ${c.alignment}.` : '',
        c.languages?.as_string ? `Languages: ${c.languages.as_string}.` : '',
        traits ? `Traits:\\n${traits}` : '',
        actions ? `Actions:\\n${actions}` : ''
      ].filter(Boolean).join('\\n\\n'),
      eco: '',
      people: '',
      run: actions ? String(actions).slice(0, 800) : '',
      seeds: '',
      source: doc.display_name || doc.name || 'Open5e',
      _src: 'Imported',
      _key: c.key || name
    };
  }


  function stripHtmlTags(s) {
    return String(s || '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/?i>/gi, '')
      .replace(/<\/?b>/gi, '')
      .replace(/<\/?em>/gi, '')
      .replace(/<\/?strong>/gi, '')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .trim();
  }

  function abilityModFromScore(score) {
    const n = Number(score);
    if (isNaN(n)) return 0;
    return Math.floor((n - 10) / 2);
  }

  function mapCritterDbCreature() { /* stripped */ return null; }

  function parseCritterDbBestiaryId(input) {
    const s = String(input || '').trim();
    if (!s) return '';
    // Full URL: .../publishedbestiary/view/HEX or .../bestiary/view/HEX
    const m = s.match(/(?:publishedbestiary|bestiary)\/(?:view\/)?([a-f0-9]{24})/i)
      || s.match(/publishedbestiaries\/([a-f0-9]{24})/i)
      || s.match(/\b([a-f0-9]{24})\b/i);
    return m ? m[1] : (s.length === 24 && /^[a-f0-9]+$/i.test(s) ? s : '');
  }

  /**
   * Fetch CritterDB JSON (direct only — no third-party proxies).
   * Browsers usually block this via CORS; use tools/critterdb-bulk-crawl.mjs or JSON export.
   */
  async function critterDbFetchJson() { /* stripped */ return null; }


  function resolveFeaturePlaceholders(text, ch) {
    if (!text) return '';
    let s = String(text);
    if (!ch) return s.replace(/\{\{[^}]+\}\}/g, '—');
    const pb = Number(ch.profBonus) || profBonusForTotalLevel(totalCharacterLevel(ch));
    const mod = (ab) => abilityModNum(ch[ab] != null ? ch[ab] : 10);
    const dcCon = 8 + pb + mod('con');
    const dcCha = 8 + pb + mod('cha');
    const dcWis = 8 + pb + mod('wis');
    const dcInt = 8 + pb + mod('int');
    s = s.replace(/\{\{\s*wild\s*surge\s*:\s*dc\s*\}\}/gi, String(dcCon));
    s = s.replace(/\{\{\s*save\s*dc\s*:\s*con\s*\}\}/gi, String(dcCon));
    s = s.replace(/\{\{\s*save\s*dc\s*:\s*cha\s*\}\}/gi, String(dcCha));
    s = s.replace(/\{\{\s*save\s*dc\s*:\s*wis\s*\}\}/gi, String(dcWis));
    s = s.replace(/\{\{\s*save\s*dc\s*:\s*int\s*\}\}/gi, String(dcInt));
    s = s.replace(/\{\{\s*pb\s*\}\}/gi, String(pb));
    // Plain language fallbacks often found in imported XML
    s = s.replace(/the save DC is \{\{[^}]+\}\}/gi, `the save DC is ${dcCon}`);
    return s;
  }

  function tableDcForCharacter(table, ch) {
    if (!ch || !table) return null;
    const pb = Number(ch.profBonus) || profBonusForTotalLevel(totalCharacterLevel(ch));
    const ab = (table.dcAbility || 'con').toLowerCase();
    const score = ch[ab] != null ? ch[ab] : 10;
    return 8 + pb + abilityModNum(score);
  }


  function getClassTables() {
    return (typeof window !== 'undefined' && Array.isArray(window.CLASS_TABLES)) ? window.CLASS_TABLES : [];
  }

  function rollClassTable(tableId, ch) {
    const table = getClassTables().find(t => t.id === tableId);
    if (!table) return null;
    const n = table.rows.length;
    if (!n) return null;
    let idx;
    let displayRoll;
    const dice = String(table.dice || '').toLowerCase();
    if (dice === 'd8' && n === 8) {
      const r = 1 + Math.floor(Math.random() * 8);
      idx = r - 1;
      displayRoll = String(r);
    } else if (dice === 'd100') {
      const r = 1 + Math.floor(Math.random() * 100);
      // Map 100 -> row labeled 99–00 if present
      idx = Math.min(n - 1, Math.floor((r === 100 ? 99 : r - 1) / (100 / n)));
      // Better: find row whose range contains r
      idx = Math.floor((Math.min(r, 100) - 1) / 2); // PHB pairs 01-02, 03-04...
      if (idx >= n) idx = n - 1;
      displayRoll = r === 100 ? '00' : String(r).padStart(2, '0');
    } else {
      idx = Math.floor(Math.random() * n);
      displayRoll = table.rows[idx].roll;
    }
    const row = table.rows[idx];
    let effect = row.effect;
    if (ch) effect = resolveFeaturePlaceholders(effect, ch);
    const dc = tableDcForCharacter(table, ch);
    return { table, roll: displayRoll || row.roll, effect, index: idx + 1, dc };
  }

  function renderClassTablesTools() {
    const host = document.getElementById('class-tables-tools');
    if (!host) return;
    const tables = getClassTables();
    if (!tables.length) {
      host.innerHTML = '<div class="tools-block"><h3>Class Tables</h3><p class="muted small">No tables loaded.</p></div>';
      return;
    }
    // Characters from active campaign for DC context
    let party = [];
    try {
      const c = typeof getActive === 'function' ? getActive() : null;
      if (c) {
        ensureCampaignShape(c);
        party = [...(c.party || []), ...(c.villains || [])];
      }
    } catch (e) {}
    host.innerHTML = `
      <div class="tools-block card tool-card span-2">
        <h3>Class Tables</h3>
        <p class="muted small">Subclass tables (Path of Wild Magic, Wild Magic Surge, Divine Intervention). Roll during play. Feature text uses save DC when a character is selected.</p>
        <div class="form-row">
          <div class="field" style="flex:2">
            <label>Table</label>
            <select id="ct-table">
              ${tables.map(t => `<option value="${escapeAttr(t.id)}">${escapeHtml(t.name)}</option>`).join('')}
            </select>
          </div>
          <div class="field" style="flex:1.5">
            <label>Character (for save DC)</label>
            <select id="ct-char">
              <option value="">— None —</option>
              ${party.map(p => `<option value="${escapeAttr(p.id)}">${escapeHtml(p.name || 'Unnamed')}</option>`).join('')}
            </select>
          </div>
          <div class="field" style="align-self:flex-end">
            <button type="button" class="btn primary" id="ct-roll">Roll</button>
          </div>
        </div>
        <div id="ct-detail" class="detail-text" style="margin-top:0.5rem"></div>
        <div id="ct-result" class="cs-panel" style="margin-top:0.5rem;display:none"></div>
      </div>`;
    const sel = host.querySelector('#ct-table');
    const charSel = host.querySelector('#ct-char');
    const detail = host.querySelector('#ct-detail');
    const result = host.querySelector('#ct-result');
    function selectedChar() {
      const id = charSel?.value;
      return party.find(p => p.id === id) || null;
    }
    function showDetail() {
      const t = tables.find(x => x.id === sel.value);
      if (!t || !detail) return;
      const ch = selectedChar();
      const dc = tableDcForCharacter(t, ch);
      detail.innerHTML = `<strong>${escapeHtml(t.name)}</strong> · ${escapeHtml(t.dice || '')} · ${escapeHtml(t.source || '')}
        ${dc != null ? `<span class="stat-chip" style="margin-left:0.35rem">Save DC ${dc}</span>` : ''}
        <p class="muted small">${escapeHtml(t.note || '')}</p>
        <details><summary class="muted small">Show full table (${t.rows.length} rows)</summary>
          <ol class="trait-list compact">${t.rows.map(r => `<li><strong>${escapeHtml(r.roll)}.</strong> ${escapeHtml(r.effect)}</li>`).join('')}</ol>
        </details>`;
    }
    sel?.addEventListener('change', showDetail);
    charSel?.addEventListener('change', showDetail);
    showDetail();
    host.querySelector('#ct-roll')?.addEventListener('click', () => {
      const ch = selectedChar();
      const r = rollClassTable(sel.value, ch);
      if (!r || !result) return;
      result.style.display = 'block';
      result.innerHTML = `<div class="cs-panel-title">Result — ${escapeHtml(r.table.dice || '')}${r.dc != null ? ' · Save DC ' + r.dc : ''}</div>
        <p><strong>Roll:</strong> ${escapeHtml(String(r.roll))} <span class="muted small">(entry ${r.index}/${r.table.rows.length})</span>
        ${ch ? ` · <span class="muted small">for ${escapeHtml(ch.name || 'character')}</span>` : ''}</p>
        <p class="cs-body">${escapeHtml(r.effect)}</p>`;
    });
  }


  function getAllSubclasses() {
    const list = (typeof window !== 'undefined' && Array.isArray(window.CUSTOM_SUBCLASSES))
      ? window.CUSTOM_SUBCLASSES.slice() : [];
    // Moon Paths as subclasses of Moon Guardian
    if (typeof getMoonPaths === 'function') {
      getMoonPaths().forEach(p => {
        if (!list.some(s => s.name === p.name && s.parentClass === 'Moon Guardian')) {
          list.push({
            id: 'moon-' + (p.id || p.name),
            name: p.name,
            parentClass: 'Moon Guardian',
            source: 'DSC',
            summary: p.summary || '',
            features: (p.features || []).map(f => ({ name: f.name, lvl: f.lvl, text: f.text || '' }))
          });
        }
      });
    }
    return list;
  }

  function subclassesForClass(className) {
    const n = String(className || '').trim().toLowerCase();
    if (!n) return [];
    return getAllSubclasses().filter(s => String(s.parentClass || '').toLowerCase() === n)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  function findSubclass(className, subclassName) {
    if (!subclassName) return null;
    const list = subclassesForClass(className);
    const q = String(subclassName).toLowerCase();
    return list.find(s => s.name.toLowerCase() === q) ||
      getAllSubclasses().find(s => s.name.toLowerCase() === q) || null;
  }

  function subclassOptionsHtml(className, selected, classLevel) {
    const unlockAt = subclassUnlockLevel(className);
    const lvl = classLevel != null && classLevel !== '' ? Number(classLevel) : 1;
    const locked = lvl < unlockAt;
    const cn = String(className || '').trim();
    const isMG = cn === 'Moon Guardian';
    // DSC Moon Guardian world-paths only (not Barbarian "Path of the Berserker" etc.)
    const moonPathNames = new Set();
    if (typeof getMoonPaths === 'function') {
      (getMoonPaths() || []).forEach(p => { if (p && p.name) moonPathNames.add(String(p.name)); });
    }
    // Known DSC path labels even if getMoonPaths is incomplete
    ['Path of Luna','Path of Harmonia','Path of Umbraria','Path of Aetheria','Path of Solara','Path of Eternum','Path of Celestia','Path of the Eclipse','Path of the Full Moon'].forEach(n => moonPathNames.add(n));

    const subs = (typeof getAllSubclasses === 'function' ? getAllSubclasses() : [])
      .filter(s => {
        const parent = String(s.parentClass || '').trim();
        if (!parent || parent.toLowerCase() !== cn.toLowerCase()) return false;
        // Only strip DSC moon paths from non–Moon Guardian classes
        if (!isMG && moonPathNames.has(s.name)) return false;
        return true;
      });
    if (isMG) {
      moonPathNames.forEach(name => {
        if (!subs.some(s => s.name === name)) {
          subs.push({ name, parentClass: 'Moon Guardian', summary: '' });
        }
      });
    }
    let selVal = selected || '';
    // Clear only true DSC moon paths stuck on the wrong class
    if (selVal && !isMG && moonPathNames.has(selVal)) selVal = '';
    let html = '';
    if (locked) {
      html += `<option value="">— Subclass at class level ${unlockAt} —</option>`;
    } else {
      html += `<option value="">— Choose subclass —</option>`;
    }
    subs.forEach(s => {
      const dis = locked ? 'disabled' : '';
      const sel = (!locked && selVal && selVal === s.name) ? 'selected' : '';
      html += `<option value="${escapeAttr(s.name)}" ${sel} ${dis}>${escapeHtml(s.name)}</option>`;
    });
    // Preserve legitimate custom selected values for this class
    if (!locked && selVal && !subs.some(s => s.name === selVal)) {
      html += `<option value="${escapeAttr(selVal)}" selected>${escapeHtml(selVal)}</option>`;
    }
    return html;
  }



  function getBackgroundList() {
    const a = (window.DSCExtensions && window.DSCExtensions.BACKGROUNDS) || [];
    const b = window.DSC_BACKGROUNDS || [];
    const map = new Map();
    [...a, ...b].forEach(bg => { if (bg && bg.name) map.set(bg.name.toLowerCase(), bg); });
    return [...map.values()].sort((x,y) => x.name.localeCompare(y.name));
  }

  function mergeAllCustomContent() {
    try { mergeCustomFeatsIntoLibrary(); } catch (e) {}
    try { mergeCustomClassesIntoPhb(); } catch (e) {}
    // Races
    const races = (typeof window !== 'undefined' && Array.isArray(window.CUSTOM_RACES)) ? window.CUSTOM_RACES : [];
    if (races.length) {
      if (!Array.isArray(window.PHB_RACES)) window.PHB_RACES = [];
      const have = new Set(window.PHB_RACES.map(r => (r.name || '').toLowerCase()));
      races.forEach(r => {
        const n = (r.name || '').toLowerCase();
        if (!n || have.has(n)) return;
        window.PHB_RACES.push({
          name: r.name,
          world: '',
          tagline: r.summary || '',
          short: r.summary || '',
          size: r.size || 'Medium',
          speed: r.speed || '30 ft.',
          traits: (r.traits || []).map(t => ({ name: t.name, text: t.text || '' })),
          source: r.source || 'Imported',
          group: 'Imported',
          dsc: false
        });
        have.add(n);
      });
    }
    // Backgrounds
    const bgs = (typeof window !== 'undefined' && Array.isArray(window.CUSTOM_BACKGROUNDS)) ? window.CUSTOM_BACKGROUNDS : [];
    if (bgs.length) {
      if (!Array.isArray(window.BACKGROUNDS)) window.BACKGROUNDS = window.BACKGROUNDS || [];
      // extensions.js uses BACKGROUNDS const - also try window
      const target = (typeof BACKGROUNDS !== 'undefined' && Array.isArray(BACKGROUNDS)) ? BACKGROUNDS : null;
      const list = target || window.DSC_BACKGROUNDS || [];
      if (!window.DSC_BACKGROUNDS) window.DSC_BACKGROUNDS = list.slice ? list.slice() : [];
      const haveB = new Set((window.DSC_BACKGROUNDS || []).map(b => (b.name || '').toLowerCase()));
      bgs.forEach(b => {
        const n = (b.name || '').toLowerCase();
        if (!n || haveB.has(n)) return;
        window.DSC_BACKGROUNDS.push({
          name: b.name,
          skills: b.skills || [],
          feature: b.feature || b.name,
          featureText: b.featureText || b.summary || '',
          source: b.source || 'Custom'
        });
        haveB.add(n);
      });
    }
    // Spells
    const spells = (typeof window !== 'undefined' && Array.isArray(window.CUSTOM_SPELLS)) ? window.CUSTOM_SPELLS : [];
    if (spells.length && Array.isArray(window.SPELLS)) {
      const haveS = new Set(window.SPELLS.map(s => (s.name || '').toLowerCase()));
      spells.forEach(sp => {
        const n = (sp.name || '').toLowerCase();
        if (!n || haveS.has(n)) return;
        window.SPELLS.push({
          id: sp.id || n.replace(/\s+/g, '-'),
          name: sp.name,
          level: sp.level || 0,
          school: sp.school || '—',
          time: sp.time || '1 action',
          range: sp.range || '—',
          duration: sp.duration || '—',
          components: sp.components || '—',
          description: sp.description || '',
          summary: (sp.description || '').slice(0, 160),
          classes: Array.isArray(sp.classes) ? sp.classes : [],
          source: sp.source || 'Custom'
        });
        haveS.add(n);
      });
    }
    // Items / equipment
    const items = (typeof window !== 'undefined' && Array.isArray(window.CUSTOM_ITEMS)) ? window.CUSTOM_ITEMS : [];
    if (items.length && Array.isArray(window.EQUIPMENT)) {
      const haveE = new Set(window.EQUIPMENT.map(e => (e.name || '').toLowerCase()));
      items.forEach(it => {
        const n = (it.name || '').toLowerCase();
        if (!n || haveE.has(n)) return;
        window.EQUIPMENT.push({
          id: it.id || n.replace(/\s+/g, '-'),
          name: it.name,
          category: it.category || (it.magic ? 'magic' : 'gear'),
          cost: it.cost || '',
          weight: it.weight || 0,
          notes: it.notes || '',
          magic: !!it.magic,
          source: it.source || 'Custom'
        });
        haveE.add(n);
      });
    }
    // Extra class names for dropdowns
    const xcls = (typeof window !== 'undefined' && Array.isArray(window.CUSTOM_CLASSES)) ? window.CUSTOM_CLASSES : [];
    if (xcls.length && typeof getPhbClasses === 'function') {
      // ensure PHB_CLASSES list includes them as minimal entries
      if (!Array.isArray(window.PHB_CLASSES)) window.PHB_CLASSES = [];
      const haveC = new Set(window.PHB_CLASSES.map(c => (c.name || '').toLowerCase()));
      xcls.forEach(c => {
        const n = (c.name || '').toLowerCase();
        if (!n || haveC.has(n)) return;
        window.PHB_CLASSES.push({
          name: c.name,
          hitDie: c.hitDie || 'd8',
          primary: c.primary || '—',
          saves: c.saves || '—',
          summary: c.summary || '',
          progression: [],
          source: c.source || 'Custom'
        });
        haveC.add(n);
      });
    }
  }


  function mergeCustomFeatsIntoLibrary() {
    const custom = (typeof window !== 'undefined' && Array.isArray(window.CUSTOM_FEATS)) ? window.CUSTOM_FEATS : [];
    if (!custom.length) return;
    if (!Array.isArray(window.FEATS)) window.FEATS = [];
    const have = new Set(window.FEATS.map(f => (f.name || '').toLowerCase()));
    custom.forEach(f => {
      const n = (f.name || '').toLowerCase();
      if (!n || have.has(n)) return;
      window.FEATS.push({
        id: f.id || n.replace(/\s+/g, '-'),
        name: f.name,
        text: f.text || '',
        prerequisite: f.prerequisite || '',
        source: f.source || 'Custom'
      });
      have.add(n);
    });
  }

  function mergeCustomClassesIntoPhb() {
    const extra = (typeof window !== 'undefined' && Array.isArray(window.CUSTOM_CLASSES)) ? window.CUSTOM_CLASSES : [];
    if (!extra.length || typeof getPhbClasses !== 'function') return;
    // Soft: only ensure names appear in class dropdown via window.CUSTOM_CLASS_NAMES
    window.CUSTOM_CLASS_NAMES = extra.map(c => c.name).filter(Boolean);
  }


  // ─── Multiclass (PHB rules) ──────────────────────────────────────────────
  const MULTICLASS_PREREQS = {
    Barbarian: { any: ['str'], min: 13 },
    Bard: { all: ['cha'], min: 13 },
    Cleric: { all: ['wis'], min: 13 },
    Druid: { all: ['wis'], min: 13 },
    Fighter: { any: ['str', 'dex'], min: 13 },
    Monk: { all: ['dex', 'wis'], min: 13 },
    Paladin: { all: ['str', 'cha'], min: 13 },
    Ranger: { all: ['dex', 'wis'], min: 13 },
    Rogue: { all: ['dex'], min: 13 },
    Sorcerer: { all: ['cha'], min: 13 },
    Warlock: { all: ['cha'], min: 13 },
    Wizard: { all: ['int'], min: 13 },
    'Moon Guardian': { any: ['wis', 'cha'], min: 13 },
    Bloodhunter: { any: ['str', 'dex'], min: 13 },
    Ghostblade: { any: ['dex', 'int'], min: 13 },
    Shadowblade: { any: ['dex', 'cha'], min: 13 }
  };

  const THIRD_CASTERS = ['Fighter', 'Rogue']; // Eldritch Knight / Arcane Trickster — treated when subclass hints

  function normalizeClassLevels(ch) {
    let list = Array.isArray(ch.classes) ? ch.classes.map(c => ({
      name: String(c.name || c.class || '').trim(),
      level: clamp(parseInt(c.level, 10) || 1, 1, 40),
      subclass: String(c.subclass || '').trim()
    })).filter(c => c.name) : [];
    if (!list.length && ch.class) {
      list = [{ name: ch.class, level: clamp(parseInt(ch.level, 10) || 1, 1, 40), subclass: ch.subclass || '' }];
    }
    if (!list.length) list = [{ name: '', level: 1, subclass: '' }];
    return list;
  }

  function totalCharacterLevel(ch) {
    return normalizeClassLevels(ch).reduce((s, c) => s + (c.level || 0), 0) || clamp(parseInt(ch.level, 10) || 1, 1, 40);
  }

  function primaryClassName(ch) {
    const list = normalizeClassLevels(ch);
    return (list[0] && list[0].name) || ch.class || '';
  }

  function classLevelsSummary(ch) {
    return normalizeClassLevels(ch)
      .filter(c => c.name)
      .map(c => `${c.name} ${c.level}${c.subclass ? ' (' + c.subclass + ')' : ''}`)
      .join(' / ') || (ch.class ? `${ch.class} ${ch.level || 1}` : '—');
  }

  function profBonusForTotalLevel(level) {
    const lvl = clamp(Number(level) || 1, 1, 40);
    if (window.PHB_PROF_BY_LEVEL && window.PHB_PROF_BY_LEVEL[Math.min(lvl, 20)]) {
      if (lvl <= 20) return window.PHB_PROF_BY_LEVEL[lvl] || 2;
    }
    // PHB progression, extended for epic (DM optional)
    if (lvl <= 4) return 2;
    if (lvl <= 8) return 3;
    if (lvl <= 12) return 4;
    if (lvl <= 16) return 5;
    if (lvl <= 20) return 6;
    if (lvl <= 24) return 7;
    if (lvl <= 28) return 8;
    if (lvl <= 32) return 9;
    return 10;
  }

  function checkMulticlassPrereq(className, scores) {
    const rule = MULTICLASS_PREREQS[className];
    if (!rule) return { ok: true, note: '' };
    const min = rule.min || 13;
    const val = (k) => Number(scores[k]) || 10;
    if (rule.any) {
      const ok = rule.any.some(a => val(a) >= min);
      return { ok, note: ok ? '' : `Requires ${rule.any.map(a => a.toUpperCase()).join(' or ')} ${min}+` };
    }
    if (rule.all) {
      const ok = rule.all.every(a => val(a) >= min);
      return { ok, note: ok ? '' : `Requires ${rule.all.map(a => a.toUpperCase() + ' ' + min).join(' and ')}` };
    }
    return { ok: true, note: '' };
  }

  /** Multiclass caster level for the combined spell slot table (PHB). */
  function multiclassCasterLevel(ch) {
    let total = 0;
    const list = normalizeClassLevels(ch);
    list.forEach(c => {
      if (!c.name || !c.level) return;
      const type = getCasterType(c.name);
      if (type === 'full') total += c.level;
      else if (type === 'half') total += Math.floor(c.level / 2);
      else if (type === 'pact') { /* pact magic separate */ }
      else if (THIRD_CASTERS.includes(c.name)) {
        // Only if subclass suggests caster archetype
        const sub = (c.subclass || '').toLowerCase();
        if (sub.includes('eldritch') || sub.includes('arcane trickster') || sub.includes('trickster')) {
          total += Math.floor(c.level / 3);
        }
      }
    });
    return total;
  }

  function warlockLevels(ch) {
    return normalizeClassLevels(ch).filter(c => c.name === 'Warlock').reduce((s, c) => s + c.level, 0);
  }

  function getMulticlassSpellSlotMaxes(ch) {
    const casterLvl = clamp(multiclassCasterLevel(ch), 0, 20);
    const out = {};
    if (casterLvl > 0) {
      const row = (window.SPELL_SLOTS_FULL || [])[casterLvl] || [];
      row.forEach((n, i) => { out[i + 1] = n; });
    }
    const wl = warlockLevels(ch);
    if (wl > 0) {
      const row = (window.SPELL_SLOTS_WARLOCK || [])[clamp(wl, 1, 20)];
      if (row) {
        out.pactLevel = row[0];
        out.pactCount = row[1];
      }
    }
    return out;
  }

  function multiclassEditorHtml(ch, opts = {}) {
    const allowEpic = opts.allowEpic !== false;
    const maxLvl = allowEpic ? 40 : 20;
    const list = normalizeClassLevels(ch);
    const rows = list.map((c, idx) => `
      <div class="mc-row" data-mc-idx="${idx}">
        <select class="mc-class" data-idx="${idx}">
          <option value="">— Class —</option>
          ${classOptionsHtml(c.name)}
        </select>
        <input type="number" class="mc-level" data-idx="${idx}" min="1" max="${maxLvl}" value="${c.level}" title="Levels in this class" />
        <select class="mc-subclass" data-idx="${idx}">${subclassOptionsHtml(c.name, c.subclass, c.level)}</select>
        <button type="button" class="btn ghost btn-tiny mc-remove" data-idx="${idx}" title="Remove">✕</button>
      </div>`).join('');
    const total = list.reduce((s, c) => s + (c.level || 0), 0);
    return `
      <div class="multiclass-editor" id="m-multiclass">
        <div class="mc-toolbar">
          <button type="button" class="btn primary btn-tiny" id="m-level-up" title="Increase a class level and unlock new ASI slots">Level Up</button>
          <span class="muted small" id="m-mc-total">Character level: <strong>${total}</strong>${total > 20 ? ' <em>(epic)</em>' : ''}</span>
        </div>
        <div class="mc-head">
          <span>Class</span><span>Lvl</span><span>Subclass</span><span></span>
        </div>
        <div id="m-mc-rows">${rows}</div>
        <div class="mc-footer">
          <button type="button" class="btn secondary btn-tiny" id="m-mc-add">+ Add class</button>
        </div>
        <p class="muted small">Multiclass follows PHB rules: total level sums class levels; proficiency from total level; spell slots use the multiclass caster table. ${allowEpic ? 'Levels above 20 are allowed (DM option).' : 'Max total level 20.'}</p>
        <p class="muted small" id="m-mc-prereq"></p>
      </div>`;
  }

  function readMulticlassFromForm() {
    const rows = document.querySelectorAll('#m-mc-rows .mc-row');
    const list = [];
    rows.forEach(row => {
      const name = row.querySelector('.mc-class')?.value?.trim() || '';
      const level = clamp(parseInt(row.querySelector('.mc-level')?.value, 10) || 1, 1, 40);
      const subclass = row.querySelector('.mc-subclass')?.value?.trim() || '';
      if (name) list.push({ name, level, subclass });
    });
    if (!list.length) {
      const fallback = $('#m-class')?.value?.trim();
      if (fallback) list.push({ name: fallback, level: clamp(parseInt($('#m-level')?.value, 10) || 1, 1, 40), subclass: $('#m-subclass')?.value?.trim() || '' });
    }
    return list;
  }

  function wireMulticlassEditor() { /* stripped */ return null; }


  function getCasterType(className) {
    if ((window.FULL_CASTERS || []).includes(className)) return 'full';
    if ((window.HALF_CASTERS || []).includes(className)) return 'half';
    if ((window.PACT_CASTERS || []).includes(className)) return 'pact';
    return 'none';
  }

  function defaultSpellAbility(className) {
    const map = {
      Bard: 'CHA', Cleric: 'WIS', Druid: 'WIS', Sorcerer: 'CHA', Wizard: 'INT',
      Paladin: 'CHA', Ranger: 'WIS', Warlock: 'CHA', 'Moon Guardian': 'WIS'
    };
    return map[className] || '';
  }

  function getSpellSlotMaxes(className, level) {
    const lvl = clamp(Number(level) || 1, 1, 20);
    const type = getCasterType(className);
    if (type === 'full') {
      const row = (window.SPELL_SLOTS_FULL || [])[lvl] || [];
      const out = {};
      row.forEach((n, i) => { out[i + 1] = n; });
      return out;
    }
    if (type === 'half') {
      const row = (window.SPELL_SLOTS_HALF || [])[lvl] || [];
      const out = {};
      row.forEach((n, i) => { out[i + 1] = n; });
      return out;
    }
    if (type === 'pact') {
      const row = (window.SPELL_SLOTS_WARLOCK || [])[lvl];
      if (!row) return {};
      return { pactLevel: row[0], pactCount: row[1] };
    }
    return {};
  }

  function collectSpellSlotsUsed() {
    const used = {};
    try {
      const pact = $('#m-slot-pact');
      if (pact) used.pact = clamp(parseInt(pact.value, 10) || 0, 0, 99);
      document.querySelectorAll('.m-slot').forEach(inp => {
        used[inp.dataset.sl] = clamp(parseInt(inp.value, 10) || 0, 0, 99);
      });
    } catch (e) {}
    return used;
  }


  function slotStepperHtml(level, used, max) {
    return `<div class="slot-stepper" data-sl="${level}">
      <span class="slot-label">L${level}</span>
      <button type="button" class="slot-dec" aria-label="Decrease">−</button>
      <span class="slot-val" data-sl="${level}">${used}</span>
      <span class="slot-max">/ ${max}</span>
      <button type="button" class="slot-inc" aria-label="Increase">+</button>
      <input type="hidden" class="m-slot" data-sl="${level}" value="${used}" />
    </div>`;
  }

  function wireSlotSteppers(root) {
    const scope = root || document;
    scope.querySelectorAll('.slot-stepper').forEach(el => {
      if (el.dataset.wired) return;
      el.dataset.wired = '1';
      const maxFromData = parseInt(el.dataset.max || '0', 10);
      const max = maxFromData || parseInt(el.querySelector('.slot-max')?.textContent.replace(/\D/g, '') || '0', 10) || 0;
      const valEl = el.querySelector('.slot-val');
      const hidden = el.querySelector('.m-slot') || el.querySelector('#m-slot-pact');
      const set = (n) => {
        n = Math.max(0, Math.min(max, n));
        if (valEl) valEl.textContent = String(n);
        if (hidden) hidden.value = String(n);
      };
      el.querySelector('.slot-dec')?.addEventListener('click', () => set((parseInt(valEl?.textContent, 10) || 0) - 1));
      el.querySelector('.slot-inc')?.addEventListener('click', () => set((parseInt(valEl?.textContent, 10) || 0) + 1));
    });
    scope.querySelectorAll('.res-stepper').forEach(el => {
      if (el.dataset.wired) return;
      el.dataset.wired = '1';
      const max = parseInt(el.dataset.max || '0', 10) || 0;
      const valEl = el.querySelector('.res-val');
      const hidden = el.querySelector('.m-resource');
      const set = (n) => {
        n = Math.max(0, Math.min(max, n));
        if (valEl) valEl.textContent = String(n);
        if (hidden) hidden.value = String(n);
      };
      el.querySelector('.res-dec')?.addEventListener('click', () => set((parseInt(valEl?.textContent, 10) || 0) - 1));
      el.querySelector('.res-inc')?.addEventListener('click', () => set((parseInt(valEl?.textContent, 10) || 0) + 1));
    });
  }


  function spellSlotsEditorHtml() { /* stripped */ return null; }

  function computeSpellDcAtk(ability, scores, pb) {
    const key = (ability || 'WIS').toLowerCase();
    const mod = abilityModNum(scores[key] != null ? scores[key] : 10);
    const p = Number(pb) || 2;
    return { dc: 8 + p + mod, atk: p + mod, mod, ability: (ability || 'WIS').toUpperCase() };
  }

  function spellSheetBlock(ch) {
    const list = normalizeClassLevels(ch);
    const casterLvl = multiclassCasterLevel(ch);
    const wl = warlockLevels(ch);
    const type = getCasterType(primaryClassName(ch));
    if (type === 'none' && casterLvl <= 0 && wl <= 0 && !(ch.spells || ch.cantrips || (ch.spellIds || []).length)) return '';
    const ab = ch.spellcastingAbility || defaultSpellAbility(primaryClassName(ch)) || 'WIS';
    const pb = ch.profBonus || profBonusForTotalLevel(totalCharacterLevel(ch));
    const info = computeSpellDcAtk(ab, ch, pb);
    const multiCaster = list.length > 1 && (casterLvl > 0 || wl > 0);
    const maxes = multiCaster || (casterLvl > 0 && list.length > 1)
      ? getMulticlassSpellSlotMaxes(ch)
      : (type !== 'none'
          ? getSpellSlotMaxes(primaryClassName(ch), (list.find(c => c.name === primaryClassName(ch)) || {}).level || ch.level || 1)
          : getMulticlassSpellSlotMaxes(ch));
    const used = ch.spellSlotsUsed || {};
    let slotsLine = '';
    const levelKeys = Object.keys(maxes).map(Number).filter(n => !isNaN(n)).sort((a,b)=>a-b);
    if (levelKeys.length) {
      slotsLine = levelKeys.map(sl => {
        const u = used[sl] != null ? used[sl] : 0;
        return `L${sl} ${u}/${maxes[sl]}`;
      }).join(' · ');
    }
    if (maxes.pactLevel) {
      const u = used.pact != null ? used.pact : 0;
      slotsLine = (slotsLine ? slotsLine + ' · ' : '') + `Pact L${maxes.pactLevel}: ${u}/${maxes.pactCount}`;
    }
    const cantrips = (ch.cantrips || '').trim();
    const spells = (ch.spells || '').trim();
    return `
      <div class="cs-panel">
        <div class="cs-panel-title">Spellcasting</div>
        <div class="cs-umb-stats">
          <div class="cs-stat-box"><div class="cs-stat-val">${info.dc}</div><div class="cs-stat-label">Spell Save DC</div><div class="cs-stat-sub muted small">${info.ability}</div></div>
          <div class="cs-stat-box"><div class="cs-stat-val">${info.atk >= 0 ? '+' + info.atk : info.atk}</div><div class="cs-stat-label">Spell Attack</div></div>
        </div>
        ${slotsLine ? `<p class="cs-body"><strong>Slots:</strong> ${escapeHtml(slotsLine)}</p>` : ''}
        ${cantrips ? `<p class="cs-body"><strong>Cantrips:</strong> ${escapeHtml(cantrips)}</p>` : ''}
        ${spells ? `<pre class="cs-pre">${formatRichText(spells)}</pre>` : ''}
      </div>`;
  }

function getEquipmentList() {
    return (typeof window !== 'undefined' && window.EQUIPMENT) ? window.EQUIPMENT : [];
  }

  function normalizeInventoryItem(it) {
    if (!it) return null;
    const o = typeof it === 'string' ? { name: it } : { ...it };
    o.uid = o.uid || (typeof uid === 'function' ? uid() : 'i' + Math.random().toString(36).slice(2, 9));
    o.id = o.id || '';
    o.name = o.name || 'Item';
    o.category = (o.category || 'gear').toLowerCase();
    o.qty = Math.max(1, parseInt(o.qty, 10) || 1);
    o.equipped = !!o.equipped;
    o.weight = o.weight != null ? Number(o.weight) || 0 : 0;
    o.cost = o.cost || '';
    o.notes = o.notes || '';
    // Consumables / potions
    const nm = String(o.name).toLowerCase();
    const notes = String(o.notes || '').toLowerCase();
    if (o.category === 'potion' || o.category === 'consumable' || /potion|elixir|philter/.test(nm)) {
      o.category = o.category === 'gear' ? 'consumable' : o.category;
      if (/potion/.test(nm)) o.category = 'consumable';
      o.consumable = true;
    }
    if (o.healDice || o.healFlat) {
      o.consumable = true;
      o.healing = true;
    } else if (/regains?|restores?|hit points|heal/i.test(notes + ' ' + nm) && /potion|elixir|medicine|salve|bandage|potion of healing/.test(nm + notes)) {
      o.healing = true;
      o.consumable = true;
      // Parse common heal dice from notes e.g. 2d4 + 2
      const hm = String(o.notes || '').match(/(\d+d\d+\s*[+]?\s*\d*|\d+d\d+)/i);
      if (hm) o.healDice = hm[1].replace(/\s+/g, '');
      if (/potion of healing\b/i.test(o.name) && !/greater|superior|supreme/i.test(o.name)) o.healDice = o.healDice || '2d4+2';
      if (/greater healing/i.test(o.name)) o.healDice = o.healDice || '4d4+4';
      if (/superior healing/i.test(o.name)) o.healDice = o.healDice || '8d4+8';
      if (/supreme healing/i.test(o.name)) o.healDice = o.healDice || '10d4+20';
    }
    if (o.category === 'weapon') {
      o.damage = o.damage || '';
      o.damageType = o.damageType || '';
      o.weaponType = o.weaponType || '';
    }
    if (o.category === 'armor') {
      o.armorType = o.armorType || 'light';
      o.acBase = o.acBase != null ? Number(o.acBase) : null;
      o.acDexMax = o.acDexMax != null ? o.acDexMax : null;
    }
    if (o.category === 'shield') {
      o.acBonus = o.acBonus != null ? Number(o.acBonus) : 2;
    }
    o.magic = !!o.magic;
    o.magicBonus = Number(o.magicBonus) || 0;
    o.attunement = !!o.attunement;
    o.rarity = o.rarity || '';
    return o;
  }


  function catalogItemToInventory(cat) {
    return normalizeInventoryItem({
      id: cat.id,
      name: cat.name,
      category: cat.category,
      magic: cat.magic,
      magicBonus: cat.magicBonus,
      rarity: cat.rarity,
      attunement: cat.attunement,
      qty: 1,
      equipped: cat.category === 'armor' || cat.category === 'shield' || cat.category === 'weapon',
      armorType: cat.armorType || '',
      acBase: cat.acBase,
      acDexMax: cat.acDexMax,
      acBonus: cat.acBonus || 0,
      damage: cat.damage || '',
      damageType: cat.damageType || '',
      props: cat.props || '',
      weaponType: cat.weaponType || '',
      notes: cat.notes || '',
      cost: cat.cost || '',
      weight: cat.weight
    });
  }

  function calcAcFromInventory(inventory, scores, className) {
    const dex = abilityModNum(scores.dex != null ? scores.dex : 10);
    const con = abilityModNum(scores.con != null ? scores.con : 10);
    const wis = abilityModNum(scores.wis != null ? scores.wis : 10);
    const inv = inventory || [];
    const armor = inv.find(i => i.equipped && i.category === 'armor');
    const shield = inv.find(i => i.equipped && i.category === 'shield');
    let ac;
    if (armor && armor.acBase != null) {
      let dexBonus = dex;
      if (armor.acDexMax === 0) dexBonus = 0;
      else if (armor.acDexMax != null) dexBonus = Math.min(dex, Number(armor.acDexMax));
      ac = armor.acBase + dexBonus;
    } else if (className === 'Barbarian') {
      ac = 10 + dex + con;
    } else if (className === 'Monk') {
      ac = 10 + dex + wis;
    } else {
      ac = 10 + dex;
    }
    if (shield) ac += (shield.acBonus || 2);
    return ac;
  }

  function inventoryWeight(inventory) {
    return (inventory || []).reduce((s, i) => s + (Number(i.weight) || 0) * (Number(i.qty) || 1), 0);
  }

  function equipmentSearchHtml(query, category) {
    const q = (query || '').trim().toLowerCase();
    let list = getEquipmentList();
    if (category && category !== 'all') {
      if (category === 'magic') {
        list = list.filter(e => e.magic || e.category === 'magic' || e.magicBonus || /rarity\s*:|attunement|\(\+\d+\)/i.test((e.notes || '') + (e.name || '')));
      } else if (category === 'weapon') {
        list = list.filter(e => e.category === 'weapon');
      } else {
        list = list.filter(e => e.category === category);
      }
    }
    if (q) {
      list = list.filter(e =>
        e.name.toLowerCase().includes(q) ||
        (e.category || '').includes(q) ||
        (e.weaponType || '').toLowerCase().includes(q) ||
        (e.armorType || '').toLowerCase().includes(q) ||
        (e.notes || '').toLowerCase().includes(q) ||
        (e.props || '').toLowerCase().includes(q) ||
        (e.rarity || '').toLowerCase().includes(q)
      );
    }
    // Prefer showing magic weapons when searching for +1/+2 or "magic"
    list = list.slice(0, category === 'magic' || /\+\d|magic/i.test(q) ? 80 : 40);
    if (!list.length) return '<p class="muted small">No equipment matches.</p>';
    return `<ul class="equip-search-results">${list.map(e => {
      const detail = e.category === 'armor'
        ? `AC ${e.acBase}${e.acDexMax === 0 ? '' : e.acDexMax != null ? ' + Dex (max ' + e.acDexMax + ')' : ' + Dex'} · ${e.armorType}`
        : e.category === 'shield'
          ? `+${e.acBonus || 2} AC`
          : e.category === 'weapon'
            ? `${e.damage || ''} ${e.damageType || ''} · ${e.props || ''}`
            : (e.notes || e.cost || '');
      return `<li class="equip-result" data-equip-id="${escapeAttr(e.id)}">
        <div class="equip-result-main"><strong>${escapeHtml(e.name)}</strong>${e.magic || e.category === 'magic' || e.magicBonus ? '<span class="equip-badge-magic">Magic</span>' : ''} <span class="muted small">${escapeHtml(e.category)}${e.rarity ? ' · ' + escapeHtml(e.rarity) : ''}${e.cost ? ' · ' + escapeHtml(e.cost) : ''}${e.damage ? ' · ' + escapeHtml(e.damage) : ''}</span></div>
        <div class="muted small">${escapeHtml(detail)}</div>
        <button type="button" class="btn secondary btn-tiny add-equip" data-equip-id="${escapeAttr(e.id)}">Add</button>
      </li>`;
    }).join('')}</ul>`;
  }

  function inventoryListHtml(inventory) {
    const inv = inventory || [];
    if (!inv.length) {
      return '<p class="muted small">Inventory empty. Search equipment to add armor, weapons, potions, and gear.</p>';
    }
    const groups = {
      armor: [], weapon: [], shield: [], consumable: [], gear: [], other: []
    };
    inv.forEach(it => {
      const c = (it.category || 'gear').toLowerCase();
      if (c === 'armor') groups.armor.push(it);
      else if (c === 'weapon') groups.weapon.push(it);
      else if (c === 'shield') groups.shield.push(it);
      else if (c === 'consumable' || c === 'potion' || it.consumable || it.healing) groups.consumable.push(it);
      else if (c === 'gear' || c === 'tool') groups.gear.push(it);
      else groups.other.push(it);
    });
    function row(it) {
      const tags = [];
      if (it.healing) tags.push('healing');
      if (it.consumable) tags.push('consumable');
      if (it.magic) tags.push('magic');
      if (it.attunement) tags.push('attune');
      if (it.healDice) tags.push(it.healDice);
      return `<li class="inv-item ${it.equipped ? 'equipped' : ''} ${it.healing ? 'inv-healing' : ''}" data-uid="${escapeAttr(it.uid)}">
        <label class="inv-equip"><input type="checkbox" class="inv-eq" data-uid="${escapeAttr(it.uid)}" ${it.equipped ? 'checked' : ''} ${it.consumable ? 'disabled title="Consumable — use from combat"' : ''} /> ${it.consumable ? '' : 'Equip'}</label>
        <span class="inv-name">${escapeHtml(it.name)}</span>
        <span class="inv-meta muted small">${escapeHtml(it.category || '')}${it.damage ? ' · ' + escapeHtml(it.damage) : ''}${it.acBase != null ? ' · AC ' + it.acBase : ''}${it.acBonus ? ' · +' + it.acBonus + ' AC' : ''}${tags.length ? ' · ' + tags.join(', ') : ''}</span>
        <input type="number" class="inv-qty" data-uid="${escapeAttr(it.uid)}" min="0" value="${it.qty}" title="Qty" />
        <button type="button" class="btn danger btn-tiny inv-remove" data-uid="${escapeAttr(it.uid)}">✕</button>
      </li>`;
    }
    function section(title, arr) {
      if (!arr.length) return '';
      return `<div class="inv-group"><div class="inv-group-title">${escapeHtml(title)} (${arr.length})</div><ul class="inv-list">${arr.map(row).join('')}</ul></div>`;
    }
    return `
    <div class="inventory-ui">
      ${section('Armor', groups.armor)}
      ${section('Shields', groups.shield)}
      ${section('Weapons', groups.weapon)}
      ${section('Potions & Consumables', groups.consumable)}
      ${section('Gear & Tools', groups.gear)}
      ${section('Other', groups.other)}
      <p class="muted small">Weight: ${inventoryWeight(inv).toFixed(1)} lb · Equip armor/shield/weapon for AC & attacks. Healing potions appear under Consumables and can be used from the combat tracker.</p>
    </div>`;
  }


const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];
  const POINT_BUY_COST = {8:0,9:1,10:2,11:3,12:4,13:5,14:7,15:9};
  const POINT_BUY_BUDGET = 27;
  const ABS = ['str','dex','con','int','wis','cha'];

  function getRaceBonuses(raceName) {
    const race = getPhbRaces().find(r => r.name === raceName);
    const b = { str:0, dex:0, con:0, int:0, wis:0, cha:0 };
    if (race && race.bonuses) {
      ABS.forEach(a => { b[a] = Number(race.bonuses[a]) || 0; });
    }
    return b;
  }

  function pointBuyCost(score) {
    const s = clamp(Number(score) || 8, 8, 15);
    return POINT_BUY_COST[s] != null ? POINT_BUY_COST[s] : 99;
  }

  function pointBuyTotal(bases) {
    return ABS.reduce((sum, a) => sum + pointBuyCost(bases[a]), 0);
  }

  function hitDieSides(className) {
    const cls = findPhbClass(className);
    if (!cls || !cls.hitDie) return 8;
    const m = String(cls.hitDie).match(/d(\d+)/i);
    return m ? parseInt(m[1], 10) : 8;
  }

  function suggestedHpMax(className, level, conScore) {
    const sides = hitDieSides(className);
    const lvl = clamp(Number(level) || 1, 1, 20);
    const conMod = abilityModNum(conScore);
    // Max at 1st, average rounded up each level after
    let hp = sides + conMod;
    const avg = Math.floor(sides / 2) + 1;
    for (let i = 2; i <= lvl; i++) hp += avg + conMod;
    return Math.max(1, hp);
  }

  function suggestedAc(className, scores) {
    const dex = abilityModNum(scores.dex);
    const con = abilityModNum(scores.con);
    const wis = abilityModNum(scores.wis);
    if (className === 'Barbarian') return 10 + dex + con;
    if (className === 'Monk') return 10 + dex + wis;
    // Default unarmored / light
    return 10 + dex;
  }

  function suggestedSpeed(raceName, className) {
    const race = getPhbRaces().find(r => r.name === raceName);
    let spd = (race && race.speed) ? race.speed : 30;
    if (className === 'Monk') {/* unarmored movement not auto */}
    return `${spd} ft.`;
  }

  function abilityTotalsFromBases(bases, raceName) {
    const bon = getRaceBonuses(raceName);
    const totals = {};
    ABS.forEach(a => { totals[a] = (Number(bases[a]) || 10) + (bon[a] || 0); });
    return totals;
  }

  function abilityMethodBarHtml(method) {
    const m = method || 'manual';
    return `
      <div class="ability-method-bar">
        <label class="method-opt"><input type="radio" name="m-ab-method" value="manual" ${m==='manual'?'checked':''}/> Manual</label>
        <label class="method-opt"><input type="radio" name="m-ab-method" value="standard" ${m==='standard'?'checked':''}/> Standard Array</label>
        <label class="method-opt"><input type="radio" name="m-ab-method" value="pointbuy" ${m==='pointbuy'?'checked':''}/> Point Buy (27)</label>
        <span class="pointbuy-status muted small" id="m-pb-status"></span>
      </div>
      <div class="standard-array-row hidden" id="m-std-row">
        <div class="std-pool-label muted small">Click an ability score to assign the next value (highest → lowest). Dimmed values are already used.</div>
        <div class="std-pool" id="m-std-pool">
          ${STANDARD_ARRAY.map(v => `<button type="button" class="std-chip" data-val="${v}" disabled>${v}</button>`).join('')}
        </div>
        <button type="button" class="btn secondary btn-tiny" id="m-std-reset">Reset Array</button>
      </div>`;
  }

const FEATURE_SECTION = {
    race: '— Race Traits —',
    path: '— Moon Path —',
    umbrarian: '— Umbrarian Template —'
  };

  function getFeatureSection(text, marker) {
    if (!text || !marker) return '';
    const idx = text.indexOf(marker);
    if (idx < 0) return '';
    const rest = text.slice(idx);
    // end at next known section marker
    let end = rest.length;
    for (const m of Object.values(FEATURE_SECTION)) {
      if (m === marker) continue;
      const j = rest.indexOf(m, marker.length);
      if (j > 0 && j < end) end = j;
    }
    return rest.slice(0, end).trim();
  }

  function setFeatureSection(text, marker, bodyLines) {
    const base = String(text || '');
    // Remove existing section for this marker
    let without = base;
    const idx = without.indexOf(marker);
    if (idx >= 0) {
      let end = without.length;
      const rest = without.slice(idx);
      for (const m of Object.values(FEATURE_SECTION)) {
        if (m === marker) continue;
        const j = rest.indexOf(m, marker.length);
        if (j > 0 && j < end - idx) end = idx + j;
      }
      without = (without.slice(0, idx) + without.slice(end)).trim();
    }
    if (!bodyLines || (Array.isArray(bodyLines) && !bodyLines.length)) {
      return without;
    }
    const block = Array.isArray(bodyLines) ? [marker, ...bodyLines].join('\n') : `${marker}\n${bodyLines}`;
    return (without ? without + '\n\n' : '') + block;
  }

  function rebuildRaceFeatureBlock(raceName) {
    const race = getPhbRaces().find(r => r.name === raceName);
    if (!race || !race.traits || !race.traits.length) return null;
    const lines = [`${race.name}${race.world ? ' (' + race.world + ')' : ''}`];
    race.traits.forEach(t => lines.push(`${t.name}: ${t.text}`));
    return lines;
  }


  
  

  function refreshPreparedSpellCheckboxes() {
    const wrap = document.getElementById('m-prep-spells-wrap');
    if (!wrap) return;
    const mode = document.getElementById('m-spell-prep-mode')?.value || 'known';
    const preparedSet = new Set(
      String(document.getElementById('m-prepared-spells')?.value || '')
        .split(/[\n,;]+/).map(s => s.trim().toLowerCase()).filter(Boolean)
    );
    const ids = (document.getElementById('m-spell-ids')?.value || '').split(',').map(s => s.trim()).filter(Boolean);
    const names = [];
    ids.forEach(id => {
      const sp = typeof findSpell === 'function' ? findSpell(id) : null;
      if (sp && sp.level > 0) names.push(sp);
    });
    // also from text
    String(document.getElementById('m-spells')?.value || '').split(/[\n,;]+/).forEach(n => {
      n = n.trim();
      if (!n) return;
      const sp = typeof findSpell === 'function' ? findSpell(n) : null;
      if (sp && sp.level > 0 && !names.some(x => x.id === sp.id)) names.push(sp);
      else if (!sp) names.push({ id: n, name: n, level: 1 });
    });
    const listEl = wrap.querySelector('.form-row') || wrap;
    if (!names.length) {
      const target = wrap.querySelector('[class*="form-row"]') || wrap;
      // rebuild checkbox area
    }
    let box = document.getElementById('m-prep-checkbox-list');
    if (!box) {
      box = document.createElement('div');
      box.id = 'm-prep-checkbox-list';
      box.className = 'form-row';
      box.style.cssText = 'flex-wrap:wrap;gap:0.35rem;max-height:12rem;overflow:auto;border:1px solid rgba(255,255,255,0.08);padding:0.4rem;border-radius:6px';
      wrap.insertBefore(box, wrap.querySelector('#m-prepared-spells') || null);
    }
    box.innerHTML = names.length
      ? names.map(s => {
          const checked = preparedSet.has(s.name.toLowerCase()) || preparedSet.has(String(s.id).toLowerCase());
          return `<label class="checkbox-row"><input type="checkbox" class="m-prep-spell" value="${escapeAttr(s.name)}" ${checked ? 'checked' : ''} ${mode === 'known' ? 'disabled' : ''}/> <span>${escapeHtml(s.name)} <span class="muted small">(L${s.level})</span></span></label>`;
        }).join('')
      : '<p class="muted small">Add known spells first (Spellcasting section), then select which are prepared.</p>';
    wrap.style.opacity = mode === 'prepared' ? '1' : '0.55';
  }

  function wireSpellPicker() { /* stripped */ return null; }

function wireAvatarPicker() {
    const file = $('#m-avatar-file');
    const uploadBtn = $('#m-avatar-upload');
    const clearBtn = $('#m-avatar-clear');
    const preview = $('#m-avatar-preview');
    const nameInp = $('#m-name');
    uploadBtn?.addEventListener('click', () => file?.click());
    file?.addEventListener('change', () => {
      const f = file.files && file.files[0];
      if (!f) return;
      if (f.size > 1.5 * 1024 * 1024) {
        toast('Image too large (max ~1.5 MB)');
        file.value = '';
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        // Downscale via canvas for storage
        const img = new Image();
        img.onload = () => {
          const max = 256;
          let w = img.width, h = img.height;
          if (w > max || h > max) {
            const r = Math.min(max / w, max / h);
            w = Math.round(w * r);
            h = Math.round(h * r);
          }
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          canvas.getContext('2d').drawImage(img, 0, 0, w, h);
          const data = canvas.toDataURL('image/jpeg', 0.85);
          window.__draftAvatar = data;
          const avData = $('#m-avatar-data');
          if (avData) avData.value = data;
          if (preview) {
            preview.classList.add('has-avatar');
            preview.innerHTML = `<img src="${data}" alt="" class="cs-avatar-img" />`;
          }
          clearBtn?.classList.remove('hidden');
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(f);
    });
    clearBtn?.addEventListener('click', () => {
      window.__draftAvatar = '';
      const avData = $('#m-avatar-data');
      if (avData) avData.value = '';
      if (file) file.value = '';
      const letter = (nameInp?.value || '?').charAt(0).toUpperCase() || '?';
      if (preview) {
        preview.classList.remove('has-avatar');
        preview.innerHTML = `<span id="m-avatar-letter">${escapeHtml(letter)}</span>`;
      }
      clearBtn.classList.add('hidden');
    });
    nameInp?.addEventListener('input', () => {
      if (window.__draftAvatar) return;
      const letter = (nameInp.value || '?').charAt(0).toUpperCase() || '?';
      const span = $('#m-avatar-letter');
      if (span) span.textContent = letter;
      else if (preview && !preview.classList.contains('has-avatar')) {
        preview.innerHTML = `<span id="m-avatar-letter">${escapeHtml(letter)}</span>`;
      }
    });
  }

function wireInventoryUI() { /* stripped */ return null; }

  function wireCharacterFormHelpers() { /* stripped */ return null; }

  async function promptCharacter() { /* stripped */ return null; }

  function characterCardHtml(ch, roleLabel, roleClass) {
    const corrClass = ch.corruption >= 5 ? 'high' : ch.corruption >= 3 ? 'mid' : '';
    return `
      <div class="sheet-card-header">
        ${portraitHtml(ch, 'sm')}
        <div>
          <h3>${escapeHtml(ch.name || 'Unnamed')}</h3>
          <p class="muted small">${escapeHtml(roleLabel)} · ${escapeHtml(ch.race || '—')} · ${escapeHtml(classLevelsSummary(ch))} · L${totalCharacterLevel(ch)}</p>
        </div>
        <div class="sheet-card-stats">
          <span class="stat-chip" title="AC">AC ${ch.ac}</span>
          <span class="stat-chip" title="HP">HP ${ch.hp}/${ch.hpMax}</span>
          ${ch.isUmbrarian ? `<span class="stat-chip umbrarian" title="${escapeAttr((ch.umbrarianStage||'') + ' · ' + (ch.shard||'Shard'))}">Umbrarian${ch.umbrarianStage ? ' · ' + ch.umbrarianStage : ''}</span>` : ''}
          ${ch.corruption > 0 ? `<span class="stat-chip corruption ${corrClass}" title="Corruption">☠ ${ch.corruption}/6</span>` : ''}
        </div>
      </div>
      <div class="sheet-card-abilities">
        ${ABS.map(a => `<span><strong>${a.toUpperCase()}</strong> ${ch[a]} (${modStr(ch[a])})</span>`).join('')}
      </div>
      <div class="sheet-card-actions">
        <button class="btn primary view-sheet">View Sheet</button>
        <button class="btn secondary edit-char">Edit</button>
        <button class="btn primary level-up-char">Level Up</button>
        <button class="btn danger delete-char">Remove</button>
      </div>`;
  }

  
  function bestShardAbility(ch) {
    const scores = {
      INT: Number(ch.int) || 10,
      WIS: Number(ch.wis) || 10,
      CHA: Number(ch.cha) || 10
    };
    // Prefer explicit choice if set; else highest mental score
    if (ch.shardAbility && scores[ch.shardAbility] != null) {
      // still allow auto if user wants - auto picks highest
    }
    let best = 'WIS';
    let bestScore = -99;
    ['INT', 'WIS', 'CHA'].forEach(a => {
      if (scores[a] > bestScore) { bestScore = scores[a]; best = a; }
    });
    return best;
  }

  function computeShardDc(ch) {
    const ab = ch.shardAbility || bestShardAbility(ch);
    const key = ab.toLowerCase();
    const mod = abilityModNum(ch[key] != null ? ch[key] : 10);
    const pb = Number(ch.profBonus) || 2;
    return {
      ability: ab,
      mod,
      pb,
      dc: 8 + pb + mod,
      attack: pb + mod
    };
  }

  function umbrarianSheetBlock() { /* stripped */ return null; }


  function portraitHtml(ch, sizeClass = '') {
    const letter = escapeHtml((ch.name || '?').charAt(0).toUpperCase());
    if (ch.avatar) {
      return `<div class="cs-portrait-ring has-avatar ${sizeClass}"><img src="${ch.avatar}" alt="" class="cs-avatar-img" /></div>`;
    }
    return `<div class="cs-portrait-ring ${sizeClass}"><span>${letter}</span></div>`;
  }

function parseAttackLines(ch) {
    const lines = [];
    const inv = ch.inventory || [];
    const weapons = inv.filter(i => i.equipped && i.category === 'weapon');
    const pb = ch.profBonus || 2;
    const str = abilityModNum(ch.str);
    const dex = abilityModNum(ch.dex);
    weapons.forEach(w => {
      const finesse = (w.props || '').toLowerCase().includes('finesse');
      const ranged = (w.weaponType || '').includes('ranged') || (w.props || '').toLowerCase().includes('ammunition');
      const mod = (finesse || ranged) ? Math.max(str, dex) : str;
      const atk = mod + pb;
      lines.push({
        name: w.name,
        bonus: atk >= 0 ? `+${atk}` : `${atk}`,
        damage: `${w.damage || '?'}${mod >= 0 ? '+' + mod : mod} ${w.damageType || ''}`.trim(),
        range: ranged ? ((w.props || '').match(/\((\d+\/\d+)\)/) || [])[1] || 'ranged' : '5 ft.',
        props: w.props || w.weaponType || ''
      });
    });
    // Also parse free-text attacks
    String(ch.attacks || '').split('\n').forEach(line => {
      line = line.trim();
      if (!line || /extra attack|sneak attack|note:/i.test(line)) return;
      const name = line.split(':')[0].trim();
      if (weapons.some(w => w.name === name)) return;
      if (name.length < 2) return;
      const bonusM = line.match(/([+-]\d+)\s*to hit/i);
      const dmgM = line.match(/,\s*([^,]+)$/) || line.match(/hit,\s*(.+)/i);
      lines.push({
        name,
        bonus: bonusM ? bonusM[1] : '—',
        damage: dmgM ? dmgM[1].trim() : line,
        range: '—',
        props: ''
      });
    });
    return lines;
  }


  /** Structured Features & Traits HTML for View / Print */
  function featuresStructuredHtml(ch) {
    const raw = String(ch.features || '').trim();
    const sections = [];
    // Split on known markers or blank-line blocks starting with "— "
    const markerRe = /(?:^|\n)(—\s*[^\n]+—)\s*\n/g;
    const parts = [];
    let last = 0;
    let m;
    const text = raw;
    const markers = [];
    while ((m = markerRe.exec(text)) !== null) {
      markers.push({ title: m[1].trim(), index: m.index + (m[0].startsWith('\n') ? 1 : 0), end: m.index + m[0].length });
    }
    if (markers.length) {
      for (let i = 0; i < markers.length; i++) {
        const start = markers[i].end;
        const end = i + 1 < markers.length ? markers[i + 1].index : text.length;
        sections.push({ title: markers[i].title.replace(/^—\s*|\s*—$/g, '').trim(), body: (typeof resolveFeaturePlaceholders === "function" ? resolveFeaturePlaceholders(text.slice(start, end).trim(), ch) : text.slice(start, end).trim()) });
      }
      // preamble before first marker
      const pre = text.slice(0, markers[0].index).trim();
      if (pre) sections.unshift({ title: 'Notes', body: pre });
    } else if (raw) {
      sections.push({ title: 'Features & Traits', body: raw });
    }

    // Append class features for EVERY multiclass entry (data-driven, not only free text)
    const classBlocks = multiclassClassFeaturesHtml(ch);
    const featsBlock = Array.isArray(ch.feats) && ch.feats.length
      ? `<div class="cs-feat-block"><div class="cs-panel-subtitle">Feats</div><ul class="trait-list compact">${ch.feats.map(f => {
          const full = (typeof findFeat === 'function' ? findFeat(f.id) : null) || f;
          return `<li><strong>${escapeHtml(full.name || f.name)}</strong>. ${formatRichText(full.text || f.text || '')}</li>`;
        }).join('')}</ul></div>`
      : '';

    const bodyHtml = sections.length
      ? sections.map(s => `
          <div class="cs-feat-block">
            <div class="cs-panel-subtitle">${escapeHtml(s.title)}</div>
            <div class="cs-feat-body">${formatFeatureBody(s.body, ch)}</div>
          </div>`).join('')
      : '<p class="muted small">No features recorded.</p>';

    return `<div class="cs-features-structured">${bodyHtml}${classBlocks}${featsBlock}</div>`;
  }

  function formatFeatureBody(body, ch) {
    if (!body) return '';
    body = expandTemplatePlaceholders(body, ch);
    // Bullet-like lines
    const lines = String(body).split(/\n+/).map(l => l.trim()).filter(Boolean);
    if (lines.length <= 1) return `<p class="cs-body">${escapeHtml(body)}</p>`;
    return `<ul class="trait-list compact">${lines.map(l => {
      const bold = l.match(/^([^.:—-]{2,40})[.:—-]\s*(.*)$/);
      if (bold && bold[2]) return `<li><strong>${escapeHtml(bold[1])}.</strong> ${escapeHtml(bold[2])}</li>`;
      return `<li>${escapeHtml(l)}</li>`;
    }).join('')}</ul>`;
  }

  function multiclassClassFeaturesHtml(ch) {
    const list = normalizeClassLevels(ch);
    if (!list.length) return '';
    const abilities = (typeof window !== 'undefined' && window.CLASS_ABILITIES) ? window.CLASS_ABILITIES : {};
    return list.map(c => {
      const feats = (abilities[c.name] || []).filter(a => (a.lvl || 0) <= (c.level || 1));
      const cls = findPhbClass(c.name);
      const prog = (cls && cls.progression) ? cls.progression.filter(([lvl]) => lvl <= c.level) : [];
      const sub = c.subclass ? ` · ${escapeHtml(c.subclass)}` : '';
      let inner = '';
      if (prog.length) {
        inner += `<p class="muted small"><strong>Progression:</strong> ${prog.map(([lvl, f]) => `L${lvl} ${escapeHtml(f)}`).join(' · ')}</p>`;
      }
      if (feats.length) {
        inner += `<ul class="trait-list compact">${feats.map(a =>
          `<li><strong>L${a.lvl} — ${escapeHtml(a.name)}.</strong> ${escapeHtml(expandTemplatePlaceholders(a.text || '', ch))}</li>`
        ).join('')}</ul>`;
      }
      // Subclass features (custom AGP pack + official stubs + Moon Paths)
      const subData = findSubclass(c.name, c.subclass);
      if (subData && Array.isArray(subData.features) && subData.features.length) {
        const pf = subData.features.filter(f => (f.lvl || 0) <= (c.level || 1));
        if (pf.length) {
          inner += `<p class="muted small"><strong>${escapeHtml(subData.name)}</strong>${subData.source ? ' · ' + escapeHtml(subData.source) : ''}</p>`;
          inner += `<ul class="trait-list compact">${pf.map(f =>
            `<li><strong>L${f.lvl || '—'} ${escapeHtml(f.name)}.</strong> ${escapeHtml(expandTemplatePlaceholders(f.text || '', ch))}</li>`
          ).join('')}</ul>`;
        }
      } else if (c.name === 'Moon Guardian') {
        const path = findMoonPath(c.subclass || ch.subclass);
        if (path) {
          const pf = (path.features || []).filter(f => f.lvl <= c.level);
          if (pf.length) {
            inner += `<p class="muted small"><strong>${escapeHtml(path.name)}</strong></p>`;
            inner += `<ul class="trait-list compact">${pf.map(f =>
              `<li><strong>L${f.lvl} ${escapeHtml(f.name)}.</strong> ${formatRichText(f.text || '')}</li>`
            ).join('')}</ul>`;
          }
        }
      }
      if (!inner) inner = '<p class="muted small">No detailed features in data for this class level.</p>';
      return `<div class="cs-feat-block">
        <div class="cs-panel-subtitle">${escapeHtml(c.name)} ${c.level}${sub}</div>
        ${inner}
      </div>`;
    }).join('');
  }

  function multiclassSavesHtml(ch) {
    const list = normalizeClassLevels(ch);
    const saves = new Set();
    list.forEach(c => {
      const cls = findPhbClass(c.name);
      if (cls && cls.saves) {
        String(cls.saves).split(/[,&]/).map(s => s.trim()).filter(Boolean).forEach(s => saves.add(s.toUpperCase().slice(0, 3)));
      }
    });
    // Map INT -> Intelligence style for display
    const map = { STR: 'Strength', DEX: 'Dexterity', CON: 'Constitution', INT: 'Intelligence', WIS: 'Wisdom', CHA: 'Charisma' };
    if (saves.size) {
      return [...saves].map(s => map[s] || s).join(', ');
    }
    return ch.saves || '—';
  }


  function characterSheetViewHtml() { /* stripped */ return null; }

  async function viewCharacterSheet() { return null; }

  function exportCharacterJson(ch) {
    const data = {
      format: 'DSCToolkt-character-v1',
      exportedAt: new Date().toISOString(),
      characterId: ch.id,
      character: ch
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${(ch.name || 'character').replace(/[^a-z0-9_-]+/gi, '_')}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast('Character exported');
  }

  function importCharacterJson(file, asVillain) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        let raw = data.character || data;
        if (!raw || typeof raw !== 'object') throw new Error('Invalid file');
        // Stable unique id (hidden from view/edit/print UI — stored on the record only)
        const stableId = raw.id || data.characterId || data.id || uid();
        let ch = normalizeCharacter({ ...raw, id: stableId });
        ch.id = stableId;
        // DM Toolkit export: if Umbrarian template is active, lock it for the player app
        if (ch.isUmbrarian || data.umbrarian || data.template === 'umbrarian') {
          ch.isUmbrarian = true;
          ch.umbrarianLocked = true;
          if (!ch.umbrarianStage) ch.umbrarianStage = data.umbrarianStage || 'dormant';
        } else if (data.umbrarian === false) {
          // explicit clear only if export says so — otherwise keep existing on update
        }
        const c = getActive();
        if (!c) { c = ensureCombatWorkspace() || getActive(); if (!c) { toast('Workspace unavailable'); return; } }
        ensureCampaignShape(c);
        const isVillain = asVillain || ch.type === 'villain' || data.asVillain;
        if (isVillain) {
          ch.type = 'villain';
          const idx = (c.villains || []).findIndex(p => p.id === ch.id);
          if (idx >= 0) {
            const prev = c.villains[idx];
            c.villains[idx] = { ...prev, ...ch, id: ch.id, updatedAt: new Date().toISOString() };
            toast(`Updated villain ${ch.name || 'character'}`);
          } else {
            c.villains.push(ch);
            toast(`Imported ${ch.name || 'character'}`);
          }
        } else {
          ch.type = ch.type === 'ally' ? 'ally' : 'pc';
          const idx = (c.party || []).findIndex(p => p.id === ch.id);
          if (idx >= 0) {
            const prev = c.party[idx];
            // Preserve local play-state the player may have changed if not in export
            const merged = {
              ...prev,
              ...ch,
              id: ch.id,
              // Prefer imported combat state when present
              hp: ch.hp != null ? ch.hp : prev.hp,
              hpMax: ch.hpMax != null ? ch.hpMax : prev.hpMax,
              conditions: Array.isArray(ch.conditions) ? ch.conditions : (prev.conditions || []),
              resourceUsed: ch.resourceUsed || prev.resourceUsed || {},
              updatedAt: new Date().toISOString()
            };
            c.party[idx] = merged;
            toast(`Updated ${ch.name || 'character'} (matched id)`);
          } else {
            c.party.push(ch);
            toast(`Imported ${ch.name || 'character'}`);
          }
        }
        c.updatedAt = new Date().toISOString();
        save();
        renderParty();
        if (typeof renderVillains === 'function') renderVillains();
      } catch (e) {
        console.warn(e);
        toast('Import failed — invalid JSON');
      }
    };
    reader.readAsText(file);
  }

  function printCharacterSheet() { /* stripped from Combat Tracker */ return null; }


  function renderParty() { /* stripped — use roster import + combat add */ }

  async function promptVillain(existing = null) {
    // Reuse character sheet modal but save to villains list
    const c = getActive();
    if (!c) return;
    const ch = existing ? normalizeCharacter(existing) : normalizeCharacter({ level: 1, player: 'NPC', type: 'villain', str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10, ac: 10, speed: '30 ft.', profBonus: 2 });
    // Temporarily treat as existing character for form, then route save
    const confirmed = await openModal({
      title: existing ? `Villain Sheet — ${ch.name || 'Edit'}` : 'New Villain',
      wide: true,
      bodyHtml: (() => {
        // Build same body as promptCharacter by calling internal structure
        return `
      <div class="sheet-section">
        <div class="form-row">
          <div class="field"><label>Name</label><input type="text" id="m-name" value="${escapeAttr(ch.name)}" placeholder="Villain name" /></div>
          <div class="field"><label>Role / Class</label><input type="text" id="m-class" value="${escapeAttr(ch.class)}" placeholder="e.g. Cult leader, Warlord" /></div>
        </div>
        <div class="form-row triple">
          <div class="field"><label>Level / CR</label><input type="number" id="m-level" min="1" max="20" value="${ch.level}" /></div>
          <div class="field"><label>World</label>
            <select id="m-world">
              <option value="">—</option>
              ${WORLDS.map(w => `<option value="${w}" ${ch.world === w ? 'selected' : ''}>${w}</option>`).join('')}
            </select>
          </div>
          <div class="field"><label>Corruption</label><input type="number" id="m-corruption" min="0" max="10" value="${ch.corruption}" /></div>
        </div>
      </div>
      <div class="sheet-section">
        <span class="section-label">Ability Scores</span>
        <div class="ability-grid">${abilityRowHtml('m', ch)}</div>
      </div>
      <div class="sheet-section">
        <div class="form-row triple">
          <div class="field"><label>HP</label><input type="number" id="m-hp" min="0" value="${ch.hp}" /></div>
          <div class="field"><label>HP Max</label><input type="number" id="m-hpmax" min="0" value="${ch.hpMax}" /></div>
          <div class="field"><label>AC</label><input type="number" id="m-ac" min="1" value="${ch.ac}" /></div>
        </div>
        <div class="form-row">
          <div class="field"><label>Speed</label><input type="text" id="m-speed" value="${escapeAttr(ch.speed)}" /></div>
          <div class="field"><label>Prof. Bonus</label><input type="number" id="m-prof" min="2" max="9" value="${ch.profBonus}" /></div>
        </div>
      </div>
      <div class="sheet-section">
        <div class="field"><label>Attacks</label><textarea id="m-attacks" rows="2">${formatRichText(ch.attacks)}</textarea></div>
        <div class="field"><label>Features &amp; Traits</label><textarea id="m-features" rows="2">${formatRichText(ch.features)}</textarea></div>
        <div class="field"><label>Notes / Secret</label><textarea id="m-notes" rows="2">${formatRichText(ch.notes)}</textarea></div>
      </div>`;
      })(),
      afterOpen: () => {
        $$('.ability-score').forEach(inp => {
          inp.addEventListener('input', () => {
            const k = inp.dataset.ab;
            const modEl = $(`#m-mod-${k}`);
            if (modEl) modEl.textContent = modStr(parseInt(inp.value, 10) || 10);
          });
        });
      },
      onConfirm: () => {
        const name = $('#m-name')?.value?.trim();
        if (!name) { toast('Name required'); return false; }
        const level = clamp(parseInt($('#m-level')?.value, 10) || 1, 1, 40);
        const data = {
          name,
          player: 'NPC',
          type: 'villain',
          class: $('#m-class')?.value?.trim() || '',
          level,
          world: $('#m-world').value,
          corruption: clamp(parseInt($('#m-corruption').value, 10) || 0, 0, 10),
          str: parseInt($('#m-total-str')?.textContent, 10) || parseInt($('#m-str')?.value, 10) || 10,
          dex: parseInt($('#m-total-dex')?.textContent, 10) || parseInt($('#m-dex')?.value, 10) || 10,
          con: parseInt($('#m-total-con')?.textContent, 10) || parseInt($('#m-con')?.value, 10) || 10,
          int: parseInt($('#m-total-int')?.textContent, 10) || parseInt($('#m-int')?.value, 10) || 10,
          wis: parseInt($('#m-total-wis')?.textContent, 10) || parseInt($('#m-wis')?.value, 10) || 10,
          cha: parseInt($('#m-total-cha')?.textContent, 10) || parseInt($('#m-cha')?.value, 10) || 10,
          hp: parseInt($('#m-hp')?.value, 10) || 0,
          hpMax: parseInt($('#m-hpmax')?.value, 10) || 0,
          ac: parseInt($('#m-ac')?.value, 10) || 10,
          speed: ($('#m-speed')?.value || '').trim() || '30 ft.',
          profBonus: parseInt($('#m-prof')?.value, 10) || profBonusForLevel(level),
          attacks: ($('#m-attacks')?.value || '').trim(),
          features: ($('#m-features')?.value || '').trim(),
          notes: ($('#m-notes')?.value || '').trim(),
          subclass: '', race: '', background: '', alignment: '', saves: '', skills: '', equipment: ''
        };
        if (existing) Object.assign(existing, data);
        else c.villains.push({ id: uid(), ...data });
        c.updatedAt = new Date().toISOString();
        save();
        return true;
      }
    });
    if (confirmed) {
      toast(existing ? 'Villain updated' : 'Villain added');
      renderParty();
    }
  }

  // ─── Factions (with generator) ───────────────────────────────────────────
  async function promptFaction(existing = null) {
    const c = getActive();
    if (!c) return;

    const prefill = existing || {};
    const body = `
      <div class="field gen-row">
        <label>Faction Name</label>
        <div class="input-with-btn">
          <input type="text" id="m-name" value="${escapeAttr(prefill.name || '')}" placeholder="e.g. The Solar Concord, Umbral Court" />
          <button type="button" class="btn secondary gen-btn" id="gen-faction-btn" title="Generate random faction">🎲</button>
        </div>
      </div>
      <div class="field">
        <label>Type / Affiliation</label>
        <input type="text" id="m-type" value="${escapeAttr(prefill.type || '')}" placeholder="Government, Cult, Merchant House, Temple..." />
      </div>
      <div class="field">
        <label>World (primary)</label>
        <select id="m-world">
          <option value="">— Multi / None —</option>
          ${WORLDS.map(w => `<option value="${w}" ${prefill.world === w ? 'selected' : ''}>${w}</option>`).join('')}
        </select>
      </div>
      <div class="field">
        <label>Reputation (−3 to +3)</label>
        <input type="number" id="m-rep" min="-3" max="3" value="${prefill.reputation ?? 0}" />
      </div>
      <div class="field">
        <label>Notes</label>
        <textarea id="m-notes" rows="2" placeholder="Goals, key NPCs, how they view the party...">${formatRichText(prefill.notes || '')}</textarea>
      </div>
    `;

    const confirmed = await openModal({
      title: existing ? 'Edit Faction' : 'Add Faction',
      bodyHtml: body,
      onConfirm: () => {
        const name = $('#m-name')?.value?.trim();
        if (!name) {
          toast('Name required');
          return false;
        }
        let rep = parseInt($('#m-rep').value, 10);
        if (isNaN(rep)) rep = 0;
        rep = Math.max(-3, Math.min(3, rep));
        const data = {
          name,
          type: $('#m-type').value.trim(),
          world: $('#m-world').value,
          reputation: rep,
          notes: ($('#m-notes')?.value || '').trim(),
        };
        if (existing) {
          Object.assign(existing, data);
        } else {
          c.factions.push({ id: uid(), ...data });
        }
        c.updatedAt = new Date().toISOString();
        save();
        return true;
      },
      afterOpen: () => {
        const genBtn = $('#gen-faction-btn');
        if (genBtn) {
          genBtn.onclick = () => {
            const g = generateFaction();
            $('#m-name').value = g.name;
            $('#m-type').value = g.type;
            $('#m-world').value = g.world;
            $('#m-rep').value = g.reputation;
            $('#m-notes').value = g.notes;
            toast('Faction generated — edit as needed');
          };
        }
      },
    });

    if (confirmed) {
      toast(existing ? 'Faction updated' : 'Faction added');
      renderFactions();
    }
  }

  function renderFactions() { /* stripped */ }

  // ─── Dynamic Influence Engine ────────────────────────────────────────────
  function clockHtml(segments) {
    const filled = clamp(segments, 0, 6);
    let dots = '';
    for (let i = 1; i <= 6; i++) {
      dots += `<span class="clock-seg ${i <= filled ? 'filled' : ''}" title="Segment ${i}"></span>`;
    }
    const label = GENERATORS.clockStageLabels[filled] || '';
    return `<div class="agenda-clock" title="Primary Agenda Clock: ${filled}/6 — ${label}">${dots}<span class="clock-label">${filled}/6 · ${escapeHtml(label)}</span></div>`;
  }

  function influenceBarHtml(label, value, cls) {
    const v = clamp(value, 0, 6);
    return `<div class="inf-bar ${cls}" title="${label}: ${v}/6 (${influenceReach(v)})"><span class="inf-name">${label.slice(0, 3)}</span><div class="inf-track"><div class="inf-fill" style="width:${(v / 6) * 100}%"></div></div><span class="inf-val">${v}</span></div>`;
  }

  async function promptForce() { /* stripped */ return null; }

  /** Apply player disruption before / during a Force Turn. Mutates force. */
  function applyPlayerDisruption(f, level) {
    const notes = [];
    const clockBefore = f.agendaClock;
    if (level === 'minor') {
      f.agendaClock = clamp(f.agendaClock - 1, 0, 6);
      f.pressure = clamp(f.pressure + 1, 0, 4);
      if (f.awareness < 4 && Math.random() < 0.5) f.awareness = clamp(f.awareness + 1, 0, 4);
      notes.push(`Players disrupted operations: agenda clock retracts ${clockBefore} → ${f.agendaClock}/6.`);
      notes.push(`Pressure rises to ${f.pressure}/4 as the force reacts.`);
    } else if (level === 'major') {
      f.agendaClock = clamp(f.agendaClock - 2, 0, 6);
      f.pressure = clamp(f.pressure + 1, 0, 4);
      f.awareness = clamp(f.awareness + 1, 0, 4);
      const dom = dominantInfluence(f);
      if (dom === 'political') f.political = clamp(f.political - 1, 0, 6);
      else if (dom === 'corruptive') f.corruptive = clamp(f.corruptive - 1, 0, 6);
      else f.disruptive = clamp(f.disruptive - 1, 0, 6);
      notes.push(`Major player interference: agenda clock retracts ${clockBefore} → ${f.agendaClock}/6.`);
      notes.push(`Dominant ${dom} influence slips by 1. Awareness ${f.awareness}/4 · Pressure ${f.pressure}/4.`);
    } else if (level === 'thwarted') {
      const target = Math.min(f.agendaClock - 3, 2);
      f.agendaClock = clamp(target, 0, 6);
      f.pressure = clamp(f.pressure + 2, 0, 4);
      f.awareness = clamp(f.awareness + 1, 0, 4);
      const dom = dominantInfluence(f);
      if (dom === 'political') f.political = clamp(f.political - 1, 0, 6);
      else if (dom === 'corruptive') f.corruptive = clamp(f.corruptive - 1, 0, 6);
      else f.disruptive = clamp(f.disruptive - 1, 0, 6);
      notes.push(`Goal actively thwarted: agenda clock collapses ${clockBefore} → ${f.agendaClock}/6.`);
      notes.push(`The force is wounded but alert — Awareness ${f.awareness}/4 · Pressure ${f.pressure}/4.`);
    }
    if (level !== 'none') {
      f.status = `Player disruption (${level}): clock ${f.agendaClock}/6`;
    }
    return { level, notes, clockBefore, clockAfter: f.agendaClock };
  }

  function applyFactionGoalRetraction(c, force, disruption) {
    if (!c.factions || !disruption || disruption.level === 'none') return null;
    const fname = String(force.name || '').toLowerCase().trim();
    if (!fname) return null;
    const fac = c.factions.find(x => {
      const n = String(x.name || '').toLowerCase().trim();
      return n && (n === fname || n.includes(fname) || fname.includes(n));
    });
    if (!fac) return null;
    const before = Number(fac.reputation) || 0;
    let delta = 0;
    if (disruption.level === 'major') delta = before >= 0 ? -1 : 1;
    else if (disruption.level === 'thwarted') delta = before > 0 ? -1 : (before < 0 ? 1 : 0);
    fac.reputation = clamp(before + delta, -3, 3);
    const goalNote = disruption.level === 'thwarted'
      ? 'Primary agenda stalled by the party.'
      : disruption.level === 'major'
        ? 'Agenda set back by party action.'
        : 'Operations hindered.';
    const line = `[Force Turn] ${goalNote} Linked force «${force.name}» clock ${disruption.clockBefore}→${disruption.clockAfter}.`;
    fac.notes = [fac.notes || '', line].filter(Boolean).join('\n');
    return {
      faction: fac.name,
      reputationBefore: before,
      reputationAfter: fac.reputation,
      note: goalNote
    };
  }

  /** Run one Force Turn for a single force. Mutates the force in place. Returns report object. */
  function runForceTurn() { /* stripped from Combat Tracker */ return null; }

  async function forceTurn() { /* stripped */ return null; }


  function renderForces() { /* stripped */ }

  // ─── Notes ───────────────────────────────────────────────────────────────
  function renderNotes() { /* stripped */ }

  function bindNotes() {
    let notesTimer;
    $('#campaign-notes')?.addEventListener('input', () => {
      clearTimeout(notesTimer);
      notesTimer = setTimeout(() => {
        const c = getActive();
        if (!c) return;
        c.notes = $('#campaign-notes').value;
        c.updatedAt = new Date().toISOString();
        save();
      }, 500);
    });
    $('#save-notes-btn')?.addEventListener('click', () => {
      const c = getActive();
      if (!c) return;
      c.notes = $('#campaign-notes').value;
      c.updatedAt = new Date().toISOString();
      save();
      toast('Notes saved');
    });
  }

  // ─── Tools (generators + reference) ──────────────────────────────────────
  function renderTools() {
    try { renderClassTablesTools(); } catch (e) {}
    try { if (typeof renderCompendiumTools === 'function') renderCompendiumTools(); } catch (e) {}
    const rosterStatus = document.querySelector('#roster-io-status');
    if (rosterStatus) {
      try { ensureCombatWorkspace(); } catch (e) {}
      const c = typeof getActive === 'function' ? getActive() : null;
      const pc = (c && c.party) ? c.party.length : 0;
      const vc = (c && c.villains) ? c.villains.length : 0;
      rosterStatus.textContent = 'Workspace roster: ' + pc + ' party · ' + vc + ' villains';
    }
    const expBtn = document.querySelector('#roster-export-btn');
    if (expBtn && !expBtn.dataset.wired) {
      expBtn.dataset.wired = '1';
      expBtn.addEventListener('click', function() { exportPartyRoster(); });
    }
    const impBtn = document.querySelector('#roster-import-btn');
    const impFile = document.querySelector('#roster-import-file');
    if (impBtn && impFile && !impBtn.dataset.wired) {
      impBtn.dataset.wired = '1';
      impBtn.addEventListener('click', function() { impFile.click(); });
      impFile.addEventListener('change', function() {
        const f = impFile.files && impFile.files[0];
        window._rosterImportMode = (document.querySelector('#roster-import-mode') || {}).value || 'merge';
        if (f) importPartyRoster(f);
        impFile.value = '';
      });
    }
  }

  // ─── Combat Tracker ──────────────────────────────────────────────────────

  function syncLinkedCharacterHp(cb) {
    if (!cb) return;
    const id = cb.charId || cb.sourceId;
    if (!id) return;
    try {
      const c = getActive();
      if (!c) return;
      const lists = [c.party, c.villains];
      lists.forEach(list => {
        if (!Array.isArray(list)) return;
        const ch = list.find(x => x.id === id);
        if (ch) {
          ch.hp = cb.hp;
          ch.hpMax = cb.hpMax;
          if (cb.tempHp != null) ch.tempHp = cb.tempHp;
          if (cb.deathSaves) ch.deathSaves = { ...cb.deathSaves };
        }
      });
    } catch (e) {}
  }

  function characterCanHeal(cb) {
    // Healing allowed if linked character has healing spells or healing consumables
    try {
      const c = getActive();
      if (!c) return { ok: false, reasons: [] };
      const id = cb.charId || cb.sourceId;
      let ch = null;
      if (id) ch = [...(c.party||[]), ...(c.villains||[])].find(x => x.id === id);
      // Also check combatant-carried spells/inventory
      const spells = (ch && (ch.spells || ch.cantrips)) || (cb.spells || cb.cantrips) || '';
      const inv = (ch && ch.inventory) || cb.inventory || [];
      const healSpellRe = /cure wounds|healing word|heal\b|mass heal|prayer of healing|aura of vitality|goodberry|preservation|revivify|regenerate|spare the dying/i;
      const hasSpell = healSpellRe.test(String(spells));
      const potions = (Array.isArray(inv) ? inv : []).filter(i => i && (i.healing || /potion of healing|greater healing|superior healing|supreme healing/i.test(i.name || '')));
      const hasPotion = potions.some(p => (p.qty || 0) > 0);
      // Generic NPC/enemy with no sheet: allow heal only via potions on combatant
      if (!ch && !hasPotion && !hasSpell) {
        // Bestiary creatures generally don't heal allies unless notes say so — allow if side is party
        if (cb.side === 'party' || cb.side === 'ally') return { ok: true, reasons: ['ally'], potions };
        return { ok: false, reasons: [], potions: [] };
      }
      return { ok: hasSpell || hasPotion, reasons: [hasSpell ? 'spell' : null, hasPotion ? 'potion' : null].filter(Boolean), potions };
    } catch (e) {
      return { ok: false, reasons: [], potions: [] };
    }
  }

  function consumeHealingPotion(cb, potionName) {
    try {
      const c = getActive();
      const id = cb.charId || cb.sourceId;
      if (!id || !c) return null;
      const lists = [c.party, c.villains];
      for (const list of lists) {
        if (!Array.isArray(list)) continue;
        const ch = list.find(x => x.id === id);
        if (!ch || !Array.isArray(ch.inventory)) continue;
        const item = ch.inventory.find(i => (i.healing || /potion/i.test(i.name||'')) && (!potionName || i.name === potionName) && (i.qty || 0) > 0);
        if (item) {
          item.qty = Math.max(0, (item.qty || 1) - 1);
          if (item.qty === 0) ch.inventory = ch.inventory.filter(x => x.uid !== item.uid);
          return item;
        }
      }
    } catch (e) {}
    return null;
  }

  function tickConditionDurations(combat) {
    (combat.combatants || []).forEach(cb => {
      if (!cb.effectList || !Array.isArray(cb.effectList)) return;
      cb.effectList = cb.effectList.map(e => ({ ...e, rounds: (e.rounds || 1) - 1 })).filter(e => e.rounds > 0);
      // rebuild conditions string from effects + free text sticky
      const fromEffects = cb.effectList.map(e => `${e.name}${e.rounds ? ' (' + e.rounds + ' rd)' : ''}`).join(', ');
      cb.conditions = fromEffects;
    });
  }

  function loadEncounterPresets() {
    try { return JSON.parse(localStorage.getItem('cv_combat_encounter_presets') || '[]'); } catch (e) { return []; }
  }
  function saveEncounterPresets(list) {
    try { localStorage.setItem('cv_combat_encounter_presets', JSON.stringify(list.slice(0, 30))); } catch (e) {}
  }

  function getCombat(c) {
    ensureCampaignShape(c);
    if (!c.combat || !Array.isArray(c.combat.combatants)) {
      c.combat = { round: 1, turnIndex: 0, combatants: [] };
    }
    return c.combat;
  }

  function combatantFromChar(ch, side) {
    const n = normalizeCharacter(ch);
    const dexMod = abilityMod(n.dex);
    return {
      id: uid(),
      sourceId: n.id || null,
      charId: n.id || null,
      name: n.name,
      init: 10 + dexMod,
      hp: n.hp,
      hpMax: n.hpMax || n.hp,
      ac: n.ac,
      conditions: '',
      side: side || 'party',
      speed: (typeof parseSpeed === 'function' ? parseSpeed(n.speed) : (Number(n.speed) || 30)),
      moveUsed: 0,
      actionUsed: false,
      bonusUsed: false,
      objectInteractUsed: false,
      reactionUsed: false,
      attacksUsed: 0,
      attacksMax: (typeof attacksPerAction === 'function' ? attacksPerAction(n) : 1),
      turnPhase: 'ready',
      notes: n.attacks || '',
      attacks: n.attacks || '',
      cantrips: n.cantrips || '',
      spells: n.spells || '',
      isUmbrarian: !!n.isUmbrarian,
      umbrarianStage: n.umbrarianStage || '',
      shard: n.shard || '',
      shardAbility: n.shardAbility || '',
      inventory: n.inventory || [],
      actions: n.actions || [],
      bonusActions: n.bonusActions || [],
      reactions: n.reactions || [],
      legendaryActions: n.legendaryActions || [],
      legendary: !!(n.legendary && (side === 'enemy' || side === 'villain' || n.type === 'enemy' || n.type === 'villain')),
      legendaryResist: n.legendaryResist,
      legendaryResistMax: n.legendaryResistMax,
      resistances: n.resistances || '',
      immunities: n.immunities || '',
      speed: n.speed || '30 ft.',
      tempHp: 0,
      concentrating: false,
      combatLog: []
    };
  }

  function lookupBestiary(name) {
    if (!name) return null;
    return BESTIARY.find(b => b.n.toLowerCase() === String(name).toLowerCase()) || null;
  }


  function parseCombatAttacks(cb, best) {
    const attacks = [];
    const seen = new Set();
    function add(name, toHit, damage, notes) {
      const key = (name + '|' + toHit + '|' + damage).toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      attacks.push({
        name: name || 'Attack',
        toHit: toHit != null && toHit !== '' ? Number(toHit) : null,
        damage: damage || '',
        notes: notes || ''
      });
    }
    if (cb && Array.isArray(cb.attackList)) {
      cb.attackList.forEach(a => add(a.name, a.toHit, a.damage, a.notes));
    }
    const blobs = [cb && cb.notes, cb && cb.attacks, best && best.run, best && best.desc]
      .filter(Boolean).map(String);
    blobs.forEach(blob => {
      String(blob).split(/\n|;/).forEach(raw => {
        const line = raw.trim();
        if (!line || line.length < 4) return;
        let m = line.match(/^([A-Za-z][A-Za-z0-9' \-]{1,36}?)\s*\+?\s*([+-]?\d+)\s*to hit[,:]?\s*(.*)$/i);
        if (m) {
          const dmg = (m[3] || '').match(/(\d+d\d+(?:\s*[+-]\s*\d+)?(?:\s+[A-Za-z]+)?)/);
          add(m[1].trim(), m[2], dmg ? dmg[1] : (m[3] || '').trim());
          return;
        }
        m = line.match(/^([A-Za-z][A-Za-z0-9' \-]{1,36}?)\s*\(\s*([+-]?\d+)\s*to hit,\s*([^)]+)\)/i);
        if (m) { add(m[1].trim(), m[2], m[3].trim()); return; }
        m = line.match(/^([A-Za-z][A-Za-z0-9' \-]{1,36}?)\s*\+?\s*([+-]?\d+)\s*\(([^)]+)\)/);
        if (m) { add(m[1].trim(), m[2], m[3].trim()); return; }
      });
    });
    if (!attacks.length) {
      add('Melee Attack', 5, '1d8+3', 'Generic');
      add('Ranged Attack', 5, '1d6+2', 'Generic');
    }
    add('Custom…', null, '', 'Enter bonus below');
    return attacks;
  }

  
  function isHealingSpellName(name) {
    return /cure wounds|healing word|heal\b|mass cure|mass heal|prayer of healing|aura of vitality|goodberry|life transference|healing spirit|power word heal|spare the dying/i.test(String(name || ''));
  }
  function isAutoHitSpellName(name) {
    return /magic missile|magic missle/i.test(String(name || ''));
  }
  function spellHealDice(sp, slotLevel, abilityMod) {
    const name = (sp && sp.name) || '';
    const lvl = Math.max(Number(sp && sp.level) || 1, Number(slotLevel) || 1);
    const mod = Number(abilityMod) || 0;
    const modStr = mod >= 0 ? '+' + mod : String(mod);
    if (/healing word/i.test(name)) return (1 + Math.max(0, lvl - 1)) + 'd4' + modStr;
    if (/cure wounds/i.test(name)) return (1 + Math.max(0, lvl - 1)) + 'd8' + modStr;
    if (/prayer of healing/i.test(name)) return '2d8' + modStr;
    if (/^heal$/i.test(String(name).trim())) return '70';
    return '1d8' + modStr;
  }
  function spellDamageDice(sp, slotLevel) {
    const name = (sp && sp.name) || '';
    const lvl = Math.max(Number(sp && sp.level) || 1, Number(slotLevel) || 1);
    if (isAutoHitSpellName(name)) {
      const n = 2 + lvl;
      return n + 'd4+' + n;
    }
    if (/guiding bolt/i.test(name)) return (4 + Math.max(0, lvl - 1)) + 'd6';
    if (/fireball/i.test(name)) return (8 + Math.max(0, lvl - 3)) + 'd6';
    const desc = String((sp && (sp.description || sp.summary)) || '');
    const m = desc.match(/(\d+d\d+(?:\s*[+-]\s*\d+)?)/i);
    if (m) return m[1].replace(/\s+/g, '');
    return '1d8';
  }
  function resolveRollAmount(panel, kind) {
    const override = parseInt(panel && panel.querySelector('#cr-apply-amt')?.value, 10);
    if (!isNaN(override) && override > 0) return override;
    const last = window.__lastCombatRoll || {};
    if (kind === 'heal' && last.heal > 0) return last.heal;
    if (kind === 'damage' && last.damage > 0) return last.damage;
    const dmgEl = panel && panel.querySelector('#cr-dmg');
    const expr = (dmgEl && dmgEl.value) ? dmgEl.value.trim() : '';
    if (expr) {
      const rolled = rollDieExpr(expr);
      const bonus = parseInt(panel.querySelector('#cr-dmg-bonus')?.value, 10) || 0;
      return (rolled.total || 0) + bonus;
    }
    return 0;
  }

function rollDieExpr(expr) {
    const s = String(expr || '').replace(/\s+/g, '');
    const m = s.match(/^(\d+)d(\d+)([+-]\d+)?$/i);
    if (!m) {
      const flat = parseInt(s, 10);
      return { total: isNaN(flat) ? 0 : flat, detail: String(expr || '0') };
    }
    const n = Math.min(20, parseInt(m[1], 10) || 1);
    const sides = parseInt(m[2], 10) || 6;
    const bonus = m[3] ? parseInt(m[3], 10) : 0;
    const rolls = [];
    let sum = 0;
    for (let i = 0; i < n; i++) {
      const r = 1 + Math.floor(Math.random() * sides);
      rolls.push(r);
      sum += r;
    }
    return { total: sum + bonus, detail: rolls.join('+') + (bonus ? (bonus >= 0 ? '+' : '') + bonus : '') + '=' + (sum + bonus) };
  }

  function rollCombatAttack(opts) {
    const adv = opts.adv || 'normal';
    const hitBonus = Number(opts.hitBonus) || 0;
    const dmgBonus = Number(opts.dmgBonus) || 0;
    const toHit = opts.toHit != null ? Number(opts.toHit) : 0;
    const dmgExpr = opts.damage || '1d8';
    function d20() { return 1 + Math.floor(Math.random() * 20); }
    const r1 = d20();
    const r2 = d20();
    let used = r1;
    let note = '';
    if (adv === 'adv') { used = Math.max(r1, r2); note = `adv [${r1}, ${r2}] → ${used}`; }
    else if (adv === 'dis') { used = Math.min(r1, r2); note = `dis [${r1}, ${r2}] → ${used}`; }
    else { note = `d20=${used}`; }
    const hitTotal = used + toHit + hitBonus;
    const isCrit = !!opts.forceCrit || used === 20;
    const isFumble = !opts.forceCrit && used === 1;
    let dmg = rollDieExpr(dmgExpr);
    if (isCrit) {
      const dmg2 = rollDieExpr(dmgExpr);
      dmg = { total: dmg.total + dmg2.total, detail: dmg.detail + ' + crit ' + dmg2.detail };
    }
    return {
      hitTotal, used, note, isCrit, isFumble, toHit, hitBonus,
      dmgTotal: dmg.total + dmgBonus,
      dmgDetail: dmg.detail + (dmgBonus ? ((dmgBonus >= 0 ? '+' : '') + dmgBonus) : ''),
      formula: `${used} ${toHit >= 0 ? '+' : ''}${toHit}${hitBonus ? (hitBonus >= 0 ? ' +' : ' ') + hitBonus : ''} = ${hitTotal}`
    };
  }

  function showCombatDetail(cb) {
    if (!cb) return;
    // Resolve linked character for Extra Attack / speed
    let _ch = null;
    try {
      const _c = getActive();
      if (_c && cb.sourceId) {
        const lists = [].concat(_c.party || [], _c.villains || []);
        _ch = lists.find(function(x) { return x && (x.id === cb.sourceId || x.characterId === cb.sourceId || x.id === cb.charId); }) || null;
      }
    } catch (e) {}
    if (typeof ensureCombatantTurnState === 'function') ensureCombatantTurnState(cb, _ch);

    const panel = $('#combat-detail');
    if (!panel) return;
    if (!cb) {
      panel.innerHTML = '<div class="combat-detail-empty muted">Select a combatant to view details, traits, and actions.</div>';
      return;
    }
    const best = lookupBestiary(cb.bestiaryName || cb.name);
    const partyChar = (function() {
      try {
        const c = getActive();
        if (!c) return null;
        const id = cb.charId || cb.sourceId || cb.id;
        return [...(c.party||[]), ...(c.villains||[])].find(x => x.id === id || x.name === cb.name) || null;
      } catch (e) { return null; }
    })();
    const hpPct = cb.hpMax > 0 ? cb.hp / cb.hpMax : 1;
    let status = 'Healthy';
    if (cb.hp <= 0) status = 'Defeated';
    else if (hpPct <= 0.25) status = 'Critical';
    else if (hpPct <= 0.5) status = 'Bloodied';

    const attacks = parseCombatAttacks(cb, best);
    // Build action lists from combatant / character / bestiary
    const actions = collectCombatActions(cb, best, partyChar);

    panel.innerHTML = `
      <div class="combat-detail-grid">
        <div class="combat-detail-info">
          <h3>${escapeHtml(cb.name)}</h3>
          <div class="detail-sub">${escapeHtml(cb.side || 'neutral')} · Init ${cb.init} · ${status}${cb.legendary ? ' · Legendary' : ''}</div>
          <div class="detail-block">
            <div class="detail-label">Combat Stats</div>
            <div class="bestiary-stats">
              <span class="stat-chip">AC ${cb.ac}</span>
              <span class="stat-chip">HP ${cb.hp}/${cb.hpMax}</span>
              <span class="stat-chip">Init ${cb.init}</span>
              ${cb.speed ? `<span class="stat-chip">${escapeHtml(cb.speed)}</span>` : ''}
            </div>
          </div>
          <div class="detail-block">
            <div class="detail-label">Quick HP</div>
            <div class="combat-qhp">
              <button type="button" class="btn secondary combat-qhp-btn" id="cd-dmg" title="Apply damage">− Damage</button>
              <button type="button" class="btn secondary combat-qhp-btn" id="cd-heal" title="Heal">+ Heal</button>
              <button type="button" class="btn secondary combat-qhp-btn" id="cd-temp" title="Temp HP">Temp HP</button>
            </div>
            <div class="muted small" style="margin-top:0.25rem">Temp HP: <strong id="cd-temphp-val">${cb.tempHp || 0}</strong>
              ${cb.concentrating ? ' · <span style="color:#c4a35a">Concentrating</span>' : ''}</div>
          </div>
          ${typeof combatAttacksBudgetHtml === 'function' ? combatAttacksBudgetHtml(cb, (typeof partyChar !== 'undefined' && partyChar) ? partyChar : (typeof _ch !== 'undefined' ? _ch : null)) : ''}
          ${typeof combatResourcesHtml === 'function' ? combatResourcesHtml(cb) : ''}
          ${typeof combatSpellSlotsHtml === 'function' ? combatSpellSlotsHtml(cb) : ''}
          <div class="detail-block">
            <div class="detail-label">Conditions & Effects (buffs + debuffs)</div>
            <input type="text" id="cd-conditions" value="${escapeAttr(cb.conditions || '')}" placeholder="poisoned, prone…" style="width:100%" />
            <label class="checkbox-row" style="margin-top:0.35rem"><input type="checkbox" id="cd-conc" ${cb.concentrating ? 'checked' : ''}/> Concentrating</label>
            <label class="checkbox-row"><input type="checkbox" id="cd-hidden-hp" ${cb.hideHp ? 'checked' : ''}/> Hide HP on map</label>
          </div>
          ${(cb.hp <= 0 || (cb.deathSaves && (cb.deathSaves.successes || cb.deathSaves.failures))) ? `
          <div class="detail-block">
            <div class="detail-label">Death Saves</div>
            <div class="death-saves-ui">
              <span>OK: <strong>${(cb.deathSaves&&cb.deathSaves.successes)||0}</strong>/3</span>
              <span>Fail: <strong>${(cb.deathSaves&&cb.deathSaves.failures)||0}</strong>/3</span>
              <button type="button" class="btn secondary btn-tiny" id="cd-ds-roll">Roll</button>
              <button type="button" class="btn secondary btn-tiny" id="cd-ds-ok-btn">+OK</button>
              <button type="button" class="btn secondary btn-tiny" id="cd-ds-fail-btn">+Fail</button>
            </div>
          </div>` : ''}
          ${cb.legendaryResistMax ? `<div class="detail-block">
            <div class="detail-label">Legendary Resistance</div>
            <div class="combat-res-row">
              <span class="combat-res-name">LR</span>
              <span class="combat-res-val"><strong>${cb.legendaryResist != null ? cb.legendaryResist : cb.legendaryResistMax}</strong>/${cb.legendaryResistMax}</span>
              <button type="button" class="btn secondary btn-tiny" id="cd-spend-lr">Use LR</button>
            </div>
          </div>` : ''}
          ${cb.resistances || cb.immunities || cb.vulnerabilities || (best && (best.resistances || best.immunities)) ? `
          <div class="detail-block">
            <div class="detail-label">Defenses</div>
            <div class="detail-text muted small">
              ${cb.resistances || best?.resistances ? `<div><strong>Resist:</strong> ${escapeHtml(cb.resistances || best.resistances || '')}</div>` : ''}
              ${cb.immunities || best?.immunities ? `<div><strong>Immune:</strong> ${escapeHtml(cb.immunities || best.immunities || '')}</div>` : ''}
              ${cb.vulnerabilities || best?.vulnerabilities ? `<div><strong>Vulnerable:</strong> ${formatRichText(cb.vulnerabilities || best.vulnerabilities || '')}</div>` : ''}
              ${cb.legendaryResist != null ? `<div><strong>Legendary Resist:</strong> ${cb.legendaryResist}/${cb.legendaryResistMax || cb.legendaryResist}</div>` : ''}
            </div>
          </div>` : ''}
          ${renderActionSection('Actions', actions.action)}
          ${renderActionSection('Bonus Actions', actions.bonus)}
          ${renderActionSection('Reactions', actions.reaction)}
          ${renderActionSection('Legendary Actions', actions.legendary)}
          ${renderActionSection('Special Abilities', actions.ability)}
          ${renderActionSection('Spells', actions.spell)}
          ${cb.notes ? `<div class="detail-block"><div class="detail-label">Notes</div><div class="detail-text">${formatRichText(cb.notes)}</div></div>` : ''}
          ${best && best.desc ? `<div class="detail-block"><div class="detail-label">Description</div><div class="detail-text">${formatRichText(best.desc)}</div></div>` : ''}
          ${best && best.run ? `<div class="detail-block"><div class="detail-label">Running the Creature</div><div class="detail-text">${formatRichText(best.run)}</div></div>` : ''}
        </div>
        <div class="combat-detail-roller">
          <div class="detail-label">Attack / Check Roller</div>
          <div class="field" style="margin-top:0.35rem">
            <label>Target(s) — filtered by ability · Ctrl/Cmd multi-select</label>
            <div id="cr-target-hint" class="muted small">Select an action/spell to auto-filter valid targets.</div>
            <select id="cr-target" multiple size="5" style="min-height:5.5rem;width:100%"></select>
            <div class="tool-btns" style="margin-top:0.35rem">
              <button type="button" class="btn secondary btn-tiny" id="cr-select-all-targets">Select all valid</button>
              <button type="button" class="btn secondary btn-tiny" id="cr-select-none-targets">Clear</button>
              <button type="button" class="btn secondary btn-tiny" id="cr-open-map" title="Open battle map">Open Map</button>
              <button type="button" class="btn secondary btn-tiny" id="cr-open-map-aoe" title="Open map with AoE tool">Map AoE</button>
            </div>
          </div>
          <div class="field" style="margin-top:0.35rem">
            <label>Roll mode</label>
            <select id="cr-mode">
              <option value="attack">Attack roll</option>
              <option value="save">Saving throw</option>
              <option value="auto">Auto-hit damage</option>
              <option value="utility">Utility (no roll)</option>
            </select>
          </div>
          <div class="field" style="margin-top:0.35rem">
            <label>Attack / Action</label>
            <select id="cr-attack">
              ${attacks.map((a, i) => `<option value="${i}">${escapeHtml(a.name)}${a.toHit != null ? ' (+' + a.toHit + ')' : ''}${a.damage ? ' · ' + escapeHtml(a.damage) : ''}</option>`).join('')}
            </select>
          </div>
          ${typeof combatSpellcastingPanelHtml === 'function' ? combatSpellcastingPanelHtml(cb, typeof partyChar !== 'undefined' ? partyChar : null) : ''}
          <div class="field">
            <label>Or pick listed action</label>
            <select id="cr-action-pick">
              <option value="">— From action lists —</option>
              ${[...actions.action, ...actions.bonus, ...actions.legendary, ...actions.spell].map((a, i) =>
                `<option value="${escapeAttr(a.name)}" data-hit="${a.toHit != null ? a.toHit : ''}" data-dmg="${escapeAttr(a.damage || '')}" data-type="${escapeAttr(a.type || '')}">${escapeHtml(a.section || '')}: ${escapeHtml(a.name)}</option>`
              ).join('')}
            </select>
          </div>
          <div class="form-row">
            <div class="field"><label>Roll</label>
              <select id="cr-adv">
                <option value="normal">Normal</option>
                <option value="adv">Advantage</option>
                <option value="dis">Disadvantage</option>
              </select>
            </div>
            <div class="field"><label>To-hit bonus</label>
              <input type="number" id="cr-hit-bonus" value="0" step="1" />
            </div>
          </div>
          <div class="form-row">
            <div class="field"><label>Damage bonus</label>
              <input type="number" id="cr-dmg-bonus" value="0" step="1" />
            </div>
            <div class="field"><label>Target AC</label>
              <input type="number" id="cr-ac" value="" placeholder="—" min="1" max="40" />
            </div>
          </div>
          <div class="form-row">
            <div class="field"><label>To-hit mod</label>
              <input type="number" id="cr-tohit" value="${attacks[0] && attacks[0].toHit != null ? attacks[0].toHit : 0}" step="1" />
            </div>
            <div class="field"><label>Damage dice</label>
              <input type="text" id="cr-dmg" value="${escapeAttr((attacks[0] && attacks[0].damage) || '1d8+3')}" placeholder="2d6+4" />
            </div>
          </div>
          <div class="tool-btns" style="margin-top:0.5rem;flex-wrap:wrap">
            <button type="button" class="btn primary" id="cr-roll-btn">Roll Attack</button>
            <button type="button" class="btn secondary" id="cr-roll-dmg">Damage only</button>
            <button type="button" class="btn secondary" id="cr-roll-save">Save DC check</button>
          </div>
          <div class="field" style="margin-top:0.35rem">
            <label>Save DC (for save roll)</label>
            <input type="number" id="cr-dc" value="15" min="1" max="40" />
          </div>
          <div id="cr-result" class="combat-roll-result muted small">Select an attack and roll.</div>
          <div class="combat-apply-row" style="margin-top:0.5rem;display:flex;flex-wrap:wrap;gap:0.35rem;align-items:center">
            <button type="button" class="btn primary" id="cr-apply-effect" title="Apply this ability/spell effect to selected targets">Apply Effect</button>
            <button type="button" class="btn danger" id="cr-apply-dmg" title="Apply damage to target(s)">Apply Damage</button>
            <button type="button" class="btn primary" id="cr-apply-heal" title="Requires healing spell or potion">Apply Heal</button>
            <button type="button" class="btn secondary" id="cr-apply-cond">Apply Condition</button>
            <label class="checkbox-row" style="margin:0"><input type="checkbox" id="cr-half" /> Half dmg</label>
            <input type="number" id="cr-apply-amt" value="" placeholder="Amt" style="width:4.5rem" />
            <input type="text" id="cr-apply-cond-text" value="" placeholder="Condition…" style="flex:1;min-width:5rem" />
            <input type="number" id="cr-cond-rounds" value="" placeholder="Rds" style="width:3.5rem" min="0" title="Duration rounds" />
            <button type="button" class="btn secondary btn-tiny" id="cr-copy-roll">Copy</button>
            <label class="checkbox-row" style="margin:0"><input type="checkbox" id="cr-force-crit" /> Force crit</label>
          </div>
          <div class="detail-block" style="margin-top:0.75rem">
            <div class="detail-label">Combat Log</div>
            <div id="cr-log" class="combat-log muted small">${(cb.combatLog || []).slice(-8).map(l => `<div>${escapeHtml(l)}</div>`).join('') || '—'}</div>
          </div>
        </div>
      </div>`;

    function appendLog(line) {
      if (!cb.combatLog) cb.combatLog = [];
      cb.combatLog.push(line);
      if (cb.combatLog.length > 30) cb.combatLog = cb.combatLog.slice(-30);
      try { save(); } catch (e) {}
      const log = panel.querySelector('#cr-log');
      if (log) log.innerHTML = cb.combatLog.slice(-8).map(l => `<div>${escapeHtml(l)}</div>`).join('');
    }


    // Populate targets from current combat
    (function fillTargets() {
      const sel = panel.querySelector('#cr-target');
      if (!sel) return;
      let combatants = [];
      try {
        const c = getActive();
        combatants = (getCombat(c).combatants || []);
      } catch (e) {}
      const opts = combatants.map((x, i) => {
        const label = `${x.name} (${x.hp}/${x.hpMax} HP)${x.side ? ' · ' + x.side : ''}`;
        return `<option value="${i}">${escapeHtml(label)}</option>`;
      });
      sel.innerHTML = opts.join('') || '<option value="" disabled>No combatants</option>';
      const selfIdx = combatants.findIndex(x => x === cb || x.id === cb.id || x.name === cb.name);
      const enemy = combatants.findIndex((x, i) => i !== selfIdx && x.side !== (cb.side || ''));
      if (enemy >= 0 && sel.options[enemy]) sel.options[enemy].selected = true;
      else if (sel.options[0]) sel.options[0].selected = true;
    })();
    try { applyAoeTargetsToRoller(panel); } catch (e) {}

    window.__lastCombatRoll = window.__lastCombatRoll || { damage: 0, heal: 0, hit: null };

    // Wire roller
    const atkSel = panel.querySelector('#cr-attack');
    const toHitEl = panel.querySelector('#cr-tohit');
    const dmgEl = panel.querySelector('#cr-dmg');
    const list = attacks;
    atkSel?.addEventListener('change', () => {
      const a = list[parseInt(atkSel.value, 10) || 0];
      if (!a) return;
      if (toHitEl && a.toHit != null) toHitEl.value = a.toHit;
      if (dmgEl && a.damage) dmgEl.value = a.damage;
    });
    panel.querySelector('#cr-action-pick')?.addEventListener('change', (e) => {
      const opt = e.target.selectedOptions?.[0];
      if (!opt || !opt.value) return;
      if (opt.dataset.hit !== '' && toHitEl) toHitEl.value = opt.dataset.hit;
      if (opt.dataset.dmg && dmgEl) dmgEl.value = opt.dataset.dmg;
    });
    panel.querySelector('#cr-roll-btn')?.addEventListener('click', () => {
      const mode = panel.querySelector('#cr-mode')?.value || 'attack';
      const box = panel.querySelector('#cr-result');
      const atkName = (list[parseInt(atkSel?.value, 10) || 0] || {}).name || 'Attack';
      if (mode === 'utility') {
        if (box) box.innerHTML = `<div><strong>${escapeHtml(atkName)}</strong> — utility (no attack roll).</div>`;
        appendLog(`${atkName}: utility`);
        return;
      }
      if (mode === 'auto') {
        const dmg = rollDieExpr(dmgEl?.value || '1d4+1');
        const bonus = parseInt(panel.querySelector('#cr-dmg-bonus')?.value, 10) || 0;
        const total = dmg.total + bonus;
        const asHeal = isHealingSpellName(atkName) || (window.__lastCombatRoll && window.__lastCombatRoll.isHeal);
        if (asHeal) {
          if (box) box.innerHTML = `<div><strong>${escapeHtml(atkName)}</strong> — healing</div><div>Heal: <strong>${total}</strong></div>`;
          window.__lastCombatRoll = { damage: 0, heal: total, healDice: dmgEl?.value || '', hit: true, isHeal: true, name: atkName };
          const applyAmt = panel.querySelector('#cr-apply-amt');
          if (applyAmt) applyAmt.value = String(total);
          appendLog(`${atkName}: heal ${total}`);
        } else {
          if (box) box.innerHTML = `<div><strong>${escapeHtml(atkName)}</strong> — auto-hit</div><div>Damage: <strong>${total}</strong></div>`;
          window.__lastCombatRoll = { damage: total, heal: 0, hit: true, isHeal: false, name: atkName };
          const applyAmt = panel.querySelector('#cr-apply-amt');
          if (applyAmt) applyAmt.value = String(total);
          appendLog(`${atkName}: auto-hit dmg ${total}`);
        }
        return;
      }
      if (mode === 'save') {
        const dc = parseInt(panel.querySelector('#cr-dc')?.value, 10) || 15;
        const adv = panel.querySelector('#cr-adv')?.value || 'normal';
        const r1 = 1 + Math.floor(Math.random() * 20);
        const r2 = 1 + Math.floor(Math.random() * 20);
        let used = r1;
        if (adv === 'adv') used = Math.max(r1, r2);
        if (adv === 'dis') used = Math.min(r1, r2);
        const bonus = parseInt(panel.querySelector('#cr-hit-bonus')?.value, 10) || 0;
        const total = used + bonus;
        const ok = total >= dc;
        let dmgLine = '';
        if (dmgEl?.value && !ok) {
          const dmg = rollDieExpr(dmgEl.value);
          const db = parseInt(panel.querySelector('#cr-dmg-bonus')?.value, 10) || 0;
          dmgLine = `<div>Damage: <strong>${dmg.total + db}</strong></div>`;
        } else if (dmgEl?.value && ok) {
          dmgLine = `<div class="muted">Saved — no damage (or half if the effect allows)</div>`;
        }
        if (box) box.innerHTML = `<div><strong>${escapeHtml(atkName)}</strong> · Save vs DC ${dc}</div>
          <div>Roll: <strong>${total}</strong> → <strong style="color:${ok?'#8d8':'#c66'}">${ok?'SUCCESS':'FAIL'}</strong></div>${dmgLine}`;
        if (!ok && dmgEl?.value) {
          const dmg = rollDieExpr(dmgEl.value);
          const db = parseInt(panel.querySelector('#cr-dmg-bonus')?.value, 10) || 0;
          window.__lastCombatRoll = { damage: dmg.total + db, heal: 0, hit: true, name: atkName };
        } else {
          window.__lastCombatRoll = { damage: 0, heal: 0, hit: false, name: atkName };
        }
        appendLog(`${atkName}: save ${total} vs DC ${dc} ${ok?'OK':'FAIL'}`);
        return;
      }
      // Attack budget (Extra Attack)
      {
        const maxAtk = cb.attacksMax != null ? cb.attacksMax : 1;
        if ((cb.attacksUsed || 0) >= maxAtk) {
          if (!confirm('Attack budget for this turn is used (' + maxAtk + '). Roll anyway?')) return;
        } else {
          cb.attacksUsed = (cb.attacksUsed || 0) + 1;
          cb.actionUsed = true; // Attack action (independent of movement)
        }
      }
      const forceCrit = !!panel.querySelector('#cr-force-crit')?.checked;
      const res = rollCombatAttack({
        adv: panel.querySelector('#cr-adv')?.value || 'normal',
        toHit: parseInt(toHitEl?.value, 10) || 0,
        hitBonus: parseInt(panel.querySelector('#cr-hit-bonus')?.value, 10) || 0,
        damage: dmgEl?.value || '1d8',
        dmgBonus: parseInt(panel.querySelector('#cr-dmg-bonus')?.value, 10) || 0,
        forceCrit
      });
      const acVal = parseInt(panel.querySelector('#cr-ac')?.value, 10);
      let hitLine = '';
      if (!isNaN(acVal)) {
        const hits = res.isFumble ? false : (res.isCrit || res.hitTotal >= acVal);
        hitLine = hits ? ` HIT vs AC ${acVal}` : ` MISS vs AC ${acVal}`;
      }
      if (box) {
        box.innerHTML = `<div><strong>${escapeHtml(atkName)}</strong> · ${escapeHtml(res.note)}</div>
          <div>To hit: <strong>${res.formula}</strong>${res.isCrit ? ' · CRIT' : ''}${res.isFumble ? ' · FUMBLE' : ''}${hitLine}</div>
          <div>Damage: <strong>${res.dmgTotal}</strong> <span class="muted">(${escapeHtml(res.dmgDetail)})</span></div>`;
      }
      window.__lastCombatRoll = { damage: res.dmgTotal, heal: 0, hit: !hitLine.includes('MISS'), name: atkName };
        appendLog(`${atkName}: ${res.formula}${hitLine} · dmg ${res.dmgTotal}`);
    });
    panel.querySelector('#cr-roll-dmg')?.addEventListener('click', () => {
      const dmg = rollDieExpr(dmgEl?.value || '1d8');
      const bonus = parseInt(panel.querySelector('#cr-dmg-bonus')?.value, 10) || 0;
      const box = panel.querySelector('#cr-result');
      if (box) box.innerHTML = `<div>Damage: <strong>${dmg.total + bonus}</strong> (${escapeHtml(dmg.detail)}${bonus ? (bonus >= 0 ? '+' : '') + bonus : ''})</div>`;
      appendLog(`Damage only: ${dmg.total + bonus}`);
    });
    panel.querySelector('#cr-roll-save')?.addEventListener('click', () => {
      const dc = parseInt(panel.querySelector('#cr-dc')?.value, 10) || 15;
      const adv = panel.querySelector('#cr-adv')?.value || 'normal';
      const r1 = 1 + Math.floor(Math.random() * 20);
      const r2 = 1 + Math.floor(Math.random() * 20);
      let used = r1;
      if (adv === 'adv') used = Math.max(r1, r2);
      if (adv === 'dis') used = Math.min(r1, r2);
      const bonus = parseInt(panel.querySelector('#cr-hit-bonus')?.value, 10) || 0;
      const total = used + bonus;
      const ok = total >= dc;
      const box = panel.querySelector('#cr-result');
      if (box) box.innerHTML = `<div>Save: <strong>${used}${bonus ? (bonus >= 0 ? '+' : '') + bonus : ''} = ${total}</strong> vs DC ${dc} → <strong style="color:${ok ? '#8d8' : '#c66'}">${ok ? 'SUCCESS' : 'FAIL'}</strong></div>`;
      appendLog(`Save ${total} vs DC ${dc}: ${ok ? 'SUCCESS' : 'FAIL'}`);
    });

    panel.querySelector('#cd-conditions')?.addEventListener('change', (e) => {
      cb.conditions = e.target.value;
      try { save(); } catch (err) {}
    });
    panel.querySelector('#cd-conc')?.addEventListener('change', (e) => {
      cb.concentrating = !!e.target.checked;
      try { save(); } catch (err) {}
    });
    panel.querySelector('#cd-dmg')?.addEventListener('click', async () => {
      const amt = parseInt(prompt('Damage amount?', '5'), 10);
      if (isNaN(amt) || amt <= 0) return;
      let left = amt;
      const temp = cb.tempHp || 0;
      if (temp > 0) {
        const absorb = Math.min(temp, left);
        cb.tempHp = temp - absorb;
        left -= absorb;
      }
      cb.hp = Math.max(0, (cb.hp || 0) - left);
      appendLog(`Took ${amt} damage (HP now ${cb.hp})`);
      try { save(); } catch (e) {}
      renderCombat();
    });
    panel.querySelector('#cd-heal')?.addEventListener('click', async () => {
      const amt = parseInt(prompt('Heal amount?', '5'), 10);
      if (isNaN(amt) || amt <= 0) return;
      cb.hp = Math.min(cb.hpMax || amt, (cb.hp || 0) + amt);
      appendLog(`Healed ${amt} (HP now ${cb.hp})`);
      try { save(); } catch (e) {}
      renderCombat();
    });
    panel.querySelector('#cd-temp')?.addEventListener('click', async () => {
      const amt = parseInt(prompt('Temporary HP?', '5'), 10);
      if (isNaN(amt) || amt < 0) return;
      cb.tempHp = Math.max(cb.tempHp || 0, amt);
      appendLog(`Temp HP set to ${cb.tempHp}`);
      try { save(); } catch (e) {}
      renderCombat();
    });

    // Click action chips → load into roller

    function getSelectedTargets() {
      const c = getActive();
      if (!c) return [];
      const combat = getCombat(c);
      const sel = panel.querySelector('#cr-target');
      const idxs = sel ? [...sel.selectedOptions].map(o => parseInt(o.value, 10)).filter(n => !isNaN(n)) : [];
      return idxs.map(idx => ({ combat, idx, target: combat.combatants[idx] })).filter(x => x.target);
    }
    function applyToTarget(kind) {
      const packs = getSelectedTargets();
      if (!packs.length) { toast('Choose one or more targets'); return; }
      if (kind === 'heal') {
        const can = characterCanHeal(cb);
        const lastHeal = window.__lastCombatRoll && (window.__lastCombatRoll.heal > 0 || window.__lastCombatRoll.isHeal || isHealingSpellName(window.__lastCombatRoll.name));
        const overridePre = parseInt(panel.querySelector('#cr-apply-amt')?.value, 10);
        if (!can.ok && !lastHeal && !(overridePre > 0)) {
          toast('No healing spell/potion detected — set Apply amount or cast a heal spell first');
          return;
        }
      }
      const override = parseInt(panel.querySelector('#cr-apply-amt')?.value, 10);
      const half = !!panel.querySelector('#cr-half')?.checked;
      packs.forEach(({ target }) => {
        if (kind === 'damage') {
          let amt = resolveRollAmount(panel, 'damage');
          if (!amt) {
            toast('No damage amount — Roll Attack / auto-hit first, or set Apply amount');
            return;
          }
          if (half) amt = Math.floor(amt / 2);
          let left = amt;
          const temp = target.tempHp || 0;
          if (temp > 0) {
            const absorb = Math.min(temp, left);
            target.tempHp = temp - absorb;
            left -= absorb;
          }
          target.hp = Math.max(0, (target.hp || 0) - left);
          if (target.concentrating && left > 0) {
            const dc = Math.max(10, Math.floor(left / 2));
            const roll = 1 + Math.floor(Math.random() * 20);
            const ok = roll >= dc;
            if (!ok) target.concentrating = false;
            appendLog(`${target.name} concentration DC ${dc}: ${roll} (${ok ? 'OK' : 'LOST'})`);
          }
          if (target.hp === 0) target.deathSaves = target.deathSaves || { successes: 0, failures: 0 };
          if (!target.combatLog) target.combatLog = [];
          target.combatLog.push(`Took ${amt} from ${cb.name || 'attacker'}`);
          appendLog(`Applied ${amt} damage to ${target.name} (now ${target.hp}/${target.hpMax})`);
          syncLinkedCharacterHp(target);
        } else if (kind === 'heal') {
          let amt = resolveRollAmount(panel, 'heal');
          if (!amt) {
            const can = characterCanHeal(cb);
            const pot = (can.potions || [])[0];
            if (pot && pot.healDice) {
              const rolled = rollDieExpr(pot.healDice);
              amt = rolled.total;
              try { consumeHealingPotion(cb, pot.name); } catch (e) {}
              appendLog(`Used ${pot.name}: ${pot.healDice} = ${amt}`);
            } else if (window.__lastCombatRoll && window.__lastCombatRoll.healDice) {
              const rolled = rollDieExpr(window.__lastCombatRoll.healDice);
              amt = rolled.total;
              appendLog(`Heal roll ${window.__lastCombatRoll.healDice} = ${amt}`);
            } else {
              amt = parseInt(prompt('Heal amount?', String(window.__lastCombatRoll?.heal || 8)), 10) || 0;
            }
          }
          if (amt <= 0) {
            toast('No heal amount — cast/roll a healing spell first or enter Apply amount');
            return;
          }
          target.hp = Math.min(target.hpMax || amt, (target.hp || 0) + amt);
          if (target.hp > 0) target.deathSaves = { successes: 0, failures: 0 };
          appendLog(`Healed ${target.name} for ${amt} (now ${target.hp}/${target.hpMax})`);
          syncLinkedCharacterHp(target);
        } else if (kind === 'cond') {
          const cond = (panel.querySelector('#cr-apply-cond-text')?.value || '').trim() || prompt('Condition?', 'poisoned');
          if (!cond) return;
          const rounds = parseInt(panel.querySelector('#cr-cond-rounds')?.value, 10) || 0;
          if (!target.effectList) target.effectList = [];
          if (rounds > 0) {
            target.effectList.push({ name: cond, rounds });
            target.conditions = target.effectList.map(e => e.name + ' (' + e.rounds + ' rd)').join(', ');
          } else {
            const prev = (target.conditions || '').trim();
            target.conditions = prev ? (prev + ', ' + cond) : cond;
          }
          appendLog(`${target.name}: ${cond}${rounds ? ' (' + rounds + ' rd)' : ''}`);
        }
      });
      try { save(); } catch (e) {}
      renderCombat();
      try {
        const c2 = getActive();
        const combat2 = getCombat(c2);
        combat2.selectedIndex = (combat2.combatants || []).findIndex(x => x.id === cb.id || x.name === cb.name);
      } catch (e) {}
    }
    
    (function extraCombatUi() {
      const healBtn = panel.querySelector('#cr-apply-heal');
      const can = characterCanHeal(cb);
      if (healBtn) {
        healBtn.disabled = !can.ok;
        healBtn.title = can.ok ? ('Healing: ' + (can.reasons || []).join(', ')) : 'No healing spells or potions';
      }
      panel.querySelector('#cr-copy-roll')?.addEventListener('click', () => {
        const text = panel.querySelector('#cr-result')?.innerText || '';
        if (text && navigator.clipboard) navigator.clipboard.writeText(text).then(() => toast('Copied')).catch(() => toast(text));
        else toast(text || 'Nothing');
      });
      panel.querySelector('#cd-hidden-hp')?.addEventListener('change', (e) => {
        cb.hideHp = !!e.target.checked;
        try { save(); } catch (err) {}
        try { renderCombat(); } catch (err) {}
        try { renderBattleMap(); } catch (err) {}
        try { renderMapRoster(); } catch (err) {}
      });
      panel.querySelector('#cd-ds-roll')?.addEventListener('click', () => {
        cb.deathSaves = cb.deathSaves || { successes: 0, failures: 0 };
        const r = 1 + Math.floor(Math.random() * 20);
        if (r === 20) { cb.hp = 1; cb.deathSaves = { successes: 0, failures: 0 }; toast('Nat 20 — 1 HP'); }
        else if (r === 1) cb.deathSaves.failures = Math.min(3, (cb.deathSaves.failures || 0) + 2);
        else if (r >= 10) cb.deathSaves.successes = Math.min(3, (cb.deathSaves.successes || 0) + 1);
        else cb.deathSaves.failures = Math.min(3, (cb.deathSaves.failures || 0) + 1);
        if ((cb.deathSaves.successes || 0) >= 3) toast('Stabilized');
        if ((cb.deathSaves.failures || 0) >= 3) toast('Dead');
        syncLinkedCharacterHp(cb); try { save(); } catch (e) {} renderCombat();
      });
      panel.querySelector('#cd-ds-ok-btn')?.addEventListener('click', () => {
        cb.deathSaves = cb.deathSaves || { successes: 0, failures: 0 };
        cb.deathSaves.successes = Math.min(3, (cb.deathSaves.successes || 0) + 1);
        syncLinkedCharacterHp(cb); save(); renderCombat();
      });
      panel.querySelector('#cd-ds-fail-btn')?.addEventListener('click', () => {
        cb.deathSaves = cb.deathSaves || { successes: 0, failures: 0 };
        cb.deathSaves.failures = Math.min(3, (cb.deathSaves.failures || 0) + 1);
        syncLinkedCharacterHp(cb); save(); renderCombat();
      });
      panel.querySelector('#cd-toggle-reaction')?.addEventListener('click', () => { cb.reactionUsed = !cb.reactionUsed; save(); renderCombat(); });
      panel.querySelector('#cd-spend-la')?.addEventListener('click', () => {
        const max = cb.legendaryActionsPerRound != null ? cb.legendaryActionsPerRound : 3;
        cb.legendaryActionsLeft = Math.max(0, (cb.legendaryActionsLeft != null ? cb.legendaryActionsLeft : max) - 1);
        save(); renderCombat();
      });
      panel.querySelector('#cd-spend-lr')?.addEventListener('click', () => {
        cb.legendaryResist = Math.max(0, (cb.legendaryResist != null ? cb.legendaryResist : cb.legendaryResistMax) - 1);
        save(); renderCombat();
      });
    })();

    
    // Resource / slot / attack budget wiring
    panel.querySelectorAll('.cd-res-dec').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.res;
        if (!cb.combatResources || !cb.combatResources[id]) return;
        cb.combatResources[id].used = Math.max(0, (cb.combatResources[id].used || 0) - 1);
        syncCombatResourcesToCharacter(cb); try { save(); } catch(e) {} renderCombat();
      });
    });
    panel.querySelectorAll('.cd-res-inc, .cd-res-spend').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.res;
        if (!cb.combatResources || !cb.combatResources[id]) return;
        const r = cb.combatResources[id];
        const maxU = r.max >= 99 ? 99 : r.max;
        r.used = Math.min(maxU, (r.used || 0) + 1);
        syncCombatResourcesToCharacter(cb); try { save(); } catch(e) {} renderCombat();
      });
    });
    panel.querySelectorAll('.cd-slot-spend').forEach(btn => {
      btn.addEventListener('click', () => {
        const L = btn.dataset.slot;
        if (!cb.combatSpellSlots || !cb.combatSpellSlots[L]) return;
        const s = cb.combatSpellSlots[L];
        s.used = Math.min(s.max, (s.used || 0) + 1);
        syncCombatResourcesToCharacter(cb); try { save(); } catch(e) {} renderCombat();
      });
    });
    panel.querySelectorAll('.cd-slot-restore').forEach(btn => {
      btn.addEventListener('click', () => {
        const L = btn.dataset.slot;
        if (!cb.combatSpellSlots || !cb.combatSpellSlots[L]) return;
        cb.combatSpellSlots[L].used = Math.max(0, (cb.combatSpellSlots[L].used || 0) - 1);
        syncCombatResourcesToCharacter(cb); try { save(); } catch(e) {} renderCombat();
      });
    });
    panel.querySelector('#cd-pact-spend, #cd-pact-inc')?.addEventListener('click', () => {
      cb.pactSlotsUsed = Math.min(cb.pactSlotsMax || 0, (cb.pactSlotsUsed || 0) + 1);
      syncCombatResourcesToCharacter(cb); save(); renderCombat();
    });
    panel.querySelector('#cd-pact-dec')?.addEventListener('click', () => {
      cb.pactSlotsUsed = Math.max(0, (cb.pactSlotsUsed || 0) - 1);
      syncCombatResourcesToCharacter(cb); save(); renderCombat();
    });
    panel.querySelector('#cr-cast-slot')?.addEventListener('click', () => {
      const L = panel.querySelector('#cr-upcast-level')?.value;
      if (!L || !cb.combatSpellSlots || !cb.combatSpellSlots[L]) { toast('No slot available'); return; }
      const s = cb.combatSpellSlots[L];
      if ((s.used || 0) >= s.max) { toast('No slots left at this level'); return; }
      s.used = (s.used || 0) + 1;
      const act = window.__activeCombatAction;
      appendLog(`Spent L${L} slot${act ? ' for ' + act.name : ''} (upcast)`);
      toast(`Spent level ${L} slot`);
      syncCombatResourcesToCharacter(cb); save(); renderCombat();
    });
    function refreshCombatDetail() {
      try { save(); } catch(e) {}
      const c = getActive();
      const combat = c ? getCombat(c) : null;
      const sel = combat && combat.selectedIndex;
      renderCombat();
      // Re-open detail so turn stage numbers update
      if (combat && sel != null && combat.combatants[sel]) {
        try {
          combat.selectedIndex = sel;
          if (typeof showCombatDetail === 'function') showCombatDetail(combat.combatants[sel], sel);
        } catch (e) {}
      }
    }
    panel.querySelector('#cd-atk-dec')?.addEventListener('click', () => {
      cb.attacksUsed = Math.max(0, (cb.attacksUsed || 0) - 1); refreshCombatDetail();
    });
    panel.querySelector('#cd-atk-inc')?.addEventListener('click', () => {
      const max = cb.attacksMax != null ? cb.attacksMax : 1;
      cb.attacksUsed = Math.min(max, (cb.attacksUsed || 0) + 1); refreshCombatDetail();
    });
    panel.querySelector('#cd-atk-reset')?.addEventListener('click', () => {
      cb.attacksUsed = 0; refreshCombatDetail();
    });
    panel.querySelector('#cd-move-dec')?.addEventListener('click', () => {
      const sp = typeof parseSpeed === 'function' ? parseSpeed(cb.speed) : 30;
      cb.speed = sp;
      cb.moveUsed = Math.max(0, (Number(cb.moveUsed) || 0) - 5);
      try { save(); } catch (e) {}
      refreshCombatDetail();
    });
    panel.querySelector('#cd-move-inc')?.addEventListener('click', () => {
      const sp = typeof parseSpeed === 'function' ? parseSpeed(cb.speed) : 30;
      cb.speed = sp;
      cb.moveUsed = Math.min(sp, (Number(cb.moveUsed) || 0) + 5);
      try { save(); } catch (e) {}
      refreshCombatDetail();
    });
    panel.querySelector('#cd-move-all')?.addEventListener('click', () => {
      const sp = typeof parseSpeed === 'function' ? parseSpeed(cb.speed) : 30;
      cb.speed = sp;
      cb.moveUsed = sp;
      try { save(); } catch (e) {}
      refreshCombatDetail();
    });
    panel.querySelector('#cd-move-reset')?.addEventListener('click', () => {
      cb.moveUsed = 0;
      try { save(); } catch (e) {}
      refreshCombatDetail();
    });
    panel.querySelector('#cd-action-toggle')?.addEventListener('click', () => {
      cb.actionUsed = !cb.actionUsed; refreshCombatDetail();
    });

    // Full Action menu
    panel.querySelectorAll('.act-opt').forEach(btn => {
      btn.addEventListener('click', async () => {
        if ((cb.turnPhase || 'ready') !== 'active') { toast('Start turn first'); return; }
        if (cb.actionUsed) { toast('Action already used'); return; }
        const act = btn.getAttribute('data-act');
        const labels = {
          attack: 'Attack', cast: 'Cast a spell', dash: 'Dash', disengage: 'Disengage',
          dodge: 'Dodge', help: 'Help', hide: 'Hide', ready: 'Ready', search: 'Search',
          'use-object': 'Use an object', other: 'Other'
        };
        if (act === 'ready') {
          const note = prompt('Ready what? (trigger → response)', cb.readyText || '');
          if (note == null) return;
          cb.readyText = note;
        }
        if (act === 'other') {
          const note = prompt('Describe the action', cb.lastAction || '');
          if (note == null) return;
          cb.lastAction = note;
        } else {
          cb.lastAction = labels[act] || act;
        }
        cb.actionUsed = true;
        if (act === 'dash') {
          const sp = typeof parseSpeed === 'function' ? parseSpeed(cb.speed) : 30;
          cb.speed = sp;
          // Dash: track bonus movement available this turn
          cb.dashSpeed = sp;
          cb.moveUsed = Math.max(0, (Number(cb.moveUsed) || 0)); // leave used as-is; left increases via dashSpeed in display optional
          toast('Dash — +' + sp + ' ft movement this turn');
        }
        if (act === 'disengage') {
          cb.conditions = mergeCondition(cb.conditions, 'Disengaging');
          toast('Disengage');
        }
        if (act === 'dodge') {
          cb.conditions = mergeCondition(cb.conditions, 'Dodging');
          toast('Dodge');
        }
        if (act === 'cast') {
          toast('Use Spellcasting panel to cast (1 Action)');
        }
        if (act === 'attack') {
          toast('Use Attack budget + Roll Attack');
        }
        try { save(); } catch (e) {}
        refreshCombatDetail();
      });
    });

    // Reaction presets
    panel.querySelectorAll('.reac-opt').forEach(btn => {
      btn.addEventListener('click', () => {
        if (cb.reactionUsed) { toast('Reaction already used'); return; }
        const id = btn.getAttribute('data-reac');
        const labels = {
          'opportunity-attack': 'Opportunity Attack',
          shield: 'Shield',
          counterspell: 'Counterspell',
          'uncanny-dodge': 'Uncanny Dodge',
          absorb: 'Reaction'
        };
        cb.reactionUsed = true;
        cb.lastReaction = labels[id] || id;
        if (id === 'opportunity-attack') {
          const mode = panel.querySelector('#cr-mode');
          if (mode) mode.value = 'attack';
          toast('Opportunity Attack — use Roll Attack (does not use your Action)');
        } else if (id === 'shield' || id === 'counterspell') {
          const mode = panel.querySelector('#cr-mode');
          if (mode) mode.value = id === 'counterspell' ? 'save' : 'utility';
          toast(labels[id] + ' — reaction spent');
        } else {
          toast(labels[id] + ' — reaction spent');
        }
        try { save(); } catch (e) {}
        refreshCombatDetail();
      });
    });

    function recoverCombatantRest(kind) {
      // kind: 'short' | 'long'
      if (cb.combatResources) {
        Object.keys(cb.combatResources).forEach(k => {
          const r = cb.combatResources[k];
          if (!r) return;
          const rec = String(r.recover || '').toLowerCase();
          if (kind === 'long' || /short/.test(rec)) {
            r.used = 0;
          }
        });
      }
      if (kind === 'long' && cb.combatSpellSlots) {
        Object.keys(cb.combatSpellSlots).forEach(L => {
          if (cb.combatSpellSlots[L]) cb.combatSpellSlots[L].used = 0;
        });
      }
      // Warlock-style: often short rest — if pact slots present, short rest clears them
      if (cb.pactSlotsMax != null) {
        if (kind === 'short' || kind === 'long') cb.pactSlotsUsed = 0;
      }
      if (kind === 'long') {
        cb.hp = cb.hpMax;
        cb.tempHp = 0;
        cb.concentrating = null;
      }
      appendLog && appendLog(`${cb.name}: ${kind === 'long' ? 'Long' : 'Short'} Rest`);
      toast((kind === 'long' ? 'Long' : 'Short') + ' Rest recovered');
      try { save(); } catch (e) {}
      refreshCombatDetail();
    }
    panel.querySelector('#cd-short-rest')?.addEventListener('click', () => recoverCombatantRest('short'));
    panel.querySelector('#cd-long-rest')?.addEventListener('click', () => recoverCombatantRest('long'));

    panel.querySelector('#cd-bonus-toggle')?.addEventListener('click', () => {
      cb.bonusUsed = !cb.bonusUsed; refreshCombatDetail();
    });

    panel.querySelectorAll('.ba-toggle').forEach(function(btn) {
      btn.addEventListener('click', function() {
        const id = btn.getAttribute('data-ba-id');
        if (!id) return;
        if (!cb.bonusActionsUsed) cb.bonusActionsUsed = {};
        const turningOn = !cb.bonusActionsUsed[id];
        // Only one bonus action per turn unless a feature grants an extra
        const allowExtra = !!(cb.extraBonusAction || cb.bonusActionsPerTurn > 1);
        if (turningOn && !allowExtra) {
          Object.keys(cb.bonusActionsUsed).forEach(function(k) { cb.bonusActionsUsed[k] = false; });
        }
        if (turningOn && allowExtra) {
          const spent = Object.keys(cb.bonusActionsUsed).filter(function(k) { return cb.bonusActionsUsed[k]; }).length;
          const maxBA = cb.bonusActionsPerTurn || 2;
          if (spent >= maxBA) {
            toast('No more bonus actions this turn');
            return;
          }
        }
        cb.bonusActionsUsed[id] = turningOn;
        cb.bonusUsed = Object.keys(cb.bonusActionsUsed).some(function(k) { return cb.bonusActionsUsed[k]; });
        try { save(); } catch (e) {}
        refreshCombatDetail();
      });
    });

    panel.querySelector('#cd-object-toggle')?.addEventListener('click', () => {
      cb.objectInteractUsed = !cb.objectInteractUsed; refreshCombatDetail();
    });
    panel.querySelector('#cd-reaction-toggle')?.addEventListener('click', () => {
      cb.reactionUsed = !cb.reactionUsed; refreshCombatDetail();
    });
    panel.querySelector('#cd-la-dec')?.addEventListener('click', () => {
      const max = cb.legendaryActionsPerRound != null ? cb.legendaryActionsPerRound : 3;
      cb.legendaryActionsLeft = Math.max(0, (cb.legendaryActionsLeft != null ? cb.legendaryActionsLeft : max) - 1);
      refreshCombatDetail();
    });
    panel.querySelector('#cd-la-inc')?.addEventListener('click', () => {
      const max = cb.legendaryActionsPerRound != null ? cb.legendaryActionsPerRound : 3;
      cb.legendaryActionsLeft = Math.min(max, (cb.legendaryActionsLeft != null ? cb.legendaryActionsLeft : max) + 1);
      refreshCombatDetail();
    });
    panel.querySelector('#cd-start-turn')?.addEventListener('click', () => {
      // Start of turn: reset per-turn resources, keep reaction until start (reaction already available from previous end)
      cb.turnPhase = 'active';
          try {
            const c0 = getActive();
            let ch0 = null;
            if (c0) {
              const lists = [].concat(c0.party||[], c0.villains||[]);
              ch0 = lists.find(x => x && (x.id === cb.charId || x.id === cb.sourceId || x.name === cb.name));
            }
            ensureCombatantTurnState(cb, ch0);
          } catch (e) {}
      cb.moveUsed = 0;
      cb.actionUsed = false;
      cb.bonusUsed = false;
      cb.objectInteractUsed = false;
      cb.attacksUsed = 0;
      cb.reactionUsed = false; // reaction refreshes at start of turn
      if (cb.legendary) {
        cb.legendaryActionsLeft = cb.legendaryActionsPerRound != null ? cb.legendaryActionsPerRound : 3;
      }
      // Death saves at start of turn if at 0 HP
      if ((cb.hp || 0) <= 0) {
        toast('At 0 HP — roll death save (Death Saves section)');
      }
      appendLog(`${cb.name}: start of turn`);
      refreshCombatDetail();
    });
    panel.querySelector('#cd-end-turn-local')?.addEventListener('click', () => {
      cb.turnPhase = 'ended';
      appendLog(`${cb.name}: end of turn`);
      refreshCombatDetail();
    });
    panel.querySelector('#cd-reset-turn')?.addEventListener('click', () => {
      cb.turnPhase = 'active';
      cb.moveUsed = 0;
      cb.actionUsed = false;
      cb.bonusUsed = false;
      cb.objectInteractUsed = false;
      cb.attacksUsed = 0;
      cb.reactionUsed = false;
      refreshCombatDetail();
    });

    
    // ── Spellcasting panel ──
    (function wireSpellcastingPanel() {
      const spellList = (typeof listCharacterSpellsForCombat === 'function')
        ? listCharacterSpellsForCombat(partyChar || null)
        : [];
      const stats = (typeof getSpellAttackAndDC === 'function')
        ? getSpellAttackAndDC(partyChar || cb)
        : { attack: 0, dc: 10, ability: 'WIS' };
      const pick = panel.querySelector('#cr-spell-pick');
      const slotSel = panel.querySelector('#cr-spell-slot');
      const timeIn = panel.querySelector('#cr-spell-time');
      const hint = panel.querySelector('#cr-spell-hint');

      function currentSpell() {
        if (!pick || pick.value === '') return null;
        return spellList[Number(pick.value)] || null;
      }

      function syncSpellUi() {
        const sp = currentSpell();
        const descEl = panel.querySelector('#cr-spell-desc');
        if (!sp) {
          if (timeIn) timeIn.value = '—';
          if (descEl) descEl.textContent = 'Select a spell to see range, targets, and description.';
          return;
        }
        if (timeIn) timeIn.value = sp.time || 'Action';
        if (slotSel) {
          if (sp.level === 0) {
            slotSel.value = '0';
          } else {
            const opts = Array.from(slotSel.options).map(o => Number(o.value)).filter(v => v >= sp.level);
            if (opts.length) slotSel.value = String(Math.min(...opts));
          }
        }
        if (hint) {
          const bucket = castingTimeBucket(sp.time);
          hint.textContent = (sp.concentration ? 'Concentration ◎ · ' : '') +
            'Uses your ' + (bucket === 'bonus' ? 'Bonus Action' : bucket === 'reaction' ? 'Reaction' : 'Action') +
            (sp.level > 0 ? ' · spends a slot on Cast' : ' · cantrip (no slot)');
        }
        if (descEl) {
          const bits = [];
          bits.push('Level: ' + (sp.level === 0 ? 'Cantrip' : sp.level));
          if (sp.school) bits.push('School: ' + sp.school);
          if (sp.time) bits.push('Casting time: ' + sp.time);
          if (sp.range) bits.push('Range: ' + sp.range);
          if (sp.components) bits.push('Components: ' + sp.components);
          if (sp.duration) bits.push('Duration: ' + sp.duration);
          if (sp.concentration) bits.push('Concentration');
          const body = (sp.description || sp.summary || '').trim();
          descEl.textContent = bits.join(' · ') + (body ? '\n\n' + body : '\n\n(No description in catalog — import Open5e/SRD spells in Tools.)');
        }
      }
      pick?.addEventListener('change', syncSpellUi);
      syncSpellUi();

      function spendSlot(level) {
        level = Number(level) || 0;
        if (level <= 0) return true;
        if (!cb.combatSpellSlots) cb.combatSpellSlots = {};
        if (!Object.keys(cb.combatSpellSlots).length) {
          try {
            const c0 = getActive();
            let ch0 = null;
            if (c0) {
              const lists = [].concat(c0.party || [], c0.villains || []);
              ch0 = lists.find(x => x && (x.id === cb.charId || x.id === cb.sourceId || x.name === cb.name));
            }
            ensureCombatantTurnState(cb, ch0);
          } catch (e) {}
        }
        let row = cb.combatSpellSlots[level] || cb.combatSpellSlots[String(level)];
        if (!row || ((row.max || 0) - (row.used || 0)) <= 0) {
          for (let L = level; L <= 9; L++) {
            const r = cb.combatSpellSlots[L] || cb.combatSpellSlots[String(L)];
            if (r && ((r.max || 0) - (r.used || 0)) > 0) { row = r; break; }
          }
        }
        if (!row || ((row.max || 0) - (row.used || 0)) <= 0) {
          toast('No spell slots left — slots may be missing on this sheet');
          return false;
        }
        row.used = (row.used || 0) + 1;
        return true;
      }

      function applyCastEconomy(sp, slotLevel) {
        const bucket = castingTimeBucket(sp.time);
        if (bucket === 'bonus') {
          if (cb.bonusUsed) {
            toast('Bonus action already used this turn');
            return false;
          }
          cb.bonusUsed = true;
          if (!cb.bonusActionsUsed) cb.bonusActionsUsed = {};
          cb.bonusActionsUsed['cast-spell'] = true;
        } else if (bucket === 'reaction') {
          if (cb.reactionUsed) {
            toast('Reaction already used');
            return false;
          }
          cb.reactionUsed = true;
        } else {
          cb.actionUsed = true;
        }
        if (sp.level > 0) {
          const need = Math.max(sp.level, Number(slotLevel) || sp.level);
          if (!spendSlot(need)) return false;
        }
        // Concentration warn + set
        if (sp.concentration) {
          if (cb.concentrating && cb.concentrating !== sp.name) {
            // warn already handled by caller sometimes
          }
          cb.concentrating = sp.name;
        }
        return true;
      }

      async function doCast(sp, slotLevel) {
        if (!sp) { toast('Select a spell'); return; }
        if (sp.concentration && cb.concentrating && cb.concentrating !== sp.name) {
          const ok = await openModal({
            title: 'Concentration',
            bodyHtml: `<p>Already concentrating on <strong>${escapeHtml(String(cb.concentrating))}</strong>.</p>
              <p>Cast <strong>${escapeHtml(sp.name)}</strong> and drop the previous spell?</p>`,
            confirmText: 'Drop & Cast',
            onConfirm: () => true
          });
          if (!ok) return;
        }
        // Bonus-action leveled spell soft warning
        const bucket = castingTimeBucket(sp.time);
        if (bucket === 'bonus' && sp.level > 0 && cb.actionUsed) {
          toast('Reminder: after a bonus-action spell, only a cantrip (action) that turn (2014)');
        }
        if (!applyCastEconomy(sp, slotLevel)) return;

        // Prefill roller for damage / heal
        const mode = panel.querySelector('#cr-mode');
        const hitIn = panel.querySelector('#cr-hit-bonus') || panel.querySelector('#cr-to-hit') || panel.querySelector('#cr-tohit');
        const dmgIn = panel.querySelector('#cr-dmg') || panel.querySelector('#cr-damage') || panel.querySelector('#cr-damage-dice');
        const dcIn = panel.querySelector('#cr-dc') || panel.querySelector('#cr-save-dc');
        const applyAmt = panel.querySelector('#cr-apply-amt');
        const slotNeed = Math.max(sp.level || 0, Number(slotLevel) || sp.level || 0);
        const cls = typeof classifySpellAction === 'function' ? classifySpellAction(sp.name, sp.description || '') : { kind: 'utility' };
        const isHeal = isHealingSpellName(sp.name);
        const isAuto = isAutoHitSpellName(sp.name) || /missile/i.test(sp.name);

        if (mode) {
          if (isHeal) mode.value = 'auto';
          else if (isAuto) mode.value = 'auto';
          else if (cls.kind === 'attack') mode.value = 'attack';
          else if (cls.kind === 'save') mode.value = 'save';
          else mode.value = cls.kind === 'utility' ? 'utility' : 'save';
        }
        if (hitIn && mode && mode.value === 'attack') hitIn.value = String(stats.attack);
        if (dcIn) dcIn.value = String(stats.dc);

        if (isHeal) {
          const expr = spellHealDice(sp, slotNeed, stats.mod);
          if (dmgIn) dmgIn.value = expr;
          const rolled = rollDieExpr(expr);
          window.__lastCombatRoll = {
            damage: 0,
            heal: rolled.total,
            healDice: expr,
            hit: true,
            isHeal: true,
            name: sp.name
          };
          if (applyAmt) applyAmt.value = String(rolled.total);
          {
            const packs = getSelectedTargets();
            if (packs.length) {
              applyToTarget('heal');
              toast(sp.name + ' healed ' + rolled.total + ' on ' + packs.length + ' target(s)');
            } else {
              toast(sp.name + ' heal ' + rolled.total + ' — select target(s), then Apply Heal');
            }
          }
        } else if (isAuto) {
          const expr = spellDamageDice(sp, slotNeed || 1);
          if (dmgIn) dmgIn.value = expr;
          const rolled = rollDieExpr(expr);
          window.__lastCombatRoll = {
            damage: rolled.total,
            heal: 0,
            hit: true,
            isHeal: false,
            name: sp.name
          };
          if (applyAmt) applyAmt.value = String(rolled.total);
          {
            const packs = getSelectedTargets();
            if (packs.length) {
              applyToTarget('damage');
              toast(sp.name + ' dealt ' + rolled.total + ' to ' + packs.length + ' target(s)');
            } else {
              toast(sp.name + ' damage ' + rolled.total + ' — select target(s), then Apply Damage');
            }
          }
        } else {
          const expr = spellDamageDice(sp, slotNeed || sp.level || 1);
          if (dmgIn && (!dmgIn.value || dmgIn.value === '1d8+3' || dmgIn.value === '1d4+1')) dmgIn.value = expr;
        }
        try { save(); } catch (e) {}
        try { renderCombat(); } catch (e) {}
        const resEl = panel.querySelector('#combat-roll-result');
        if (resEl) {
          resEl.innerHTML = `<strong>${escapeHtml(sp.name)}</strong> cast` +
            (sp.level > 0 ? ` at ${Math.max(sp.level, Number(slotLevel)||sp.level)} level` : ' (cantrip)') +
            ` · ${escapeHtml(sp.time || 'Action')}` +
            (sp.concentration ? ' · Concentrating ◎' : '') +
            `<br><span class="muted small">Spell atk +${stats.attack} · DC ${stats.dc}. Use Roll / Apply for effect.</span>`;
        }
        try { save(); } catch (e) {}
        toast('Cast ' + sp.name);
        refreshCombatDetail();
      }

      panel.querySelector('#cr-spell-info')?.addEventListener('click', async () => {
        const sp = currentSpell();
        if (!sp) { toast('Select a spell'); return; }
        const levels = Object.keys(cb.combatSpellSlots || {}).map(Number).sort((a,b)=>a-b);
        const slotOptionsHtml = ['<option value="0">Cantrip / at-will</option>'].concat(
          levels.filter(L => {
            const row = cb.combatSpellSlots[L];
            return row && ((row.max||0)-(row.used||0)) > 0 && L >= (sp.level || 0);
          }).map(L => `<option value="${L}">${L}${L===1?'st':L===2?'nd':L===3?'rd':'th'}</option>`)
        ).join('');
        await openSpellDetailModal(sp, {
          allowCast: true,
          slotOptionsHtml,
          onCast: (slot) => { doCast(sp, slot); }
        });
      });

      panel.querySelector('#cr-spell-cast')?.addEventListener('click', () => {
        const sp = currentSpell();
        const slot = slotSel ? Number(slotSel.value) || 0 : 0;
        doCast(sp, slot);
      });

      // Channel Divinity
      panel.querySelectorAll('.cd-option-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.getAttribute('data-cd');
          const opts = getChannelDivinityOptions(partyChar || cb);
          const opt = opts.find(o => o.id === id);
          if (!opt) return;
          const max = getChannelDivinityMax(partyChar || cb);
          if (!cb.combatResources) cb.combatResources = {};
          if (!cb.combatResources['channel-divinity']) {
            cb.combatResources['channel-divinity'] = { label: 'Channel Divinity', max: max, used: 0, recover: 'Short Rest' };
          }
          const row = cb.combatResources['channel-divinity'];
          row.max = max;
          if ((row.used || 0) >= max) { toast('No Channel Divinity uses left'); return; }
          if (opt.actionType === 'action' && cb.actionUsed) {
            toast('Action already used');
            return;
          }
          const ok = await openModal({
            title: opt.name,
            bodyHtml: `<div class="detail-text">${formatRichText(opt.text)}</div>
              <p class="muted small" style="margin-top:0.5rem">Spend 1 Channel Divinity${opt.save ? ' · Save ' + opt.save + ' vs DC ' + stats.dc : ''}.</p>`,
            confirmText: 'Use',
            onConfirm: () => true
          });
          if (!ok) return;
          row.used = (row.used || 0) + 1;
          if (opt.actionType === 'action') cb.actionUsed = true;
          if (opt.id === 'turn-undead') {
            const mode = panel.querySelector('#cr-mode');
            const dcIn = panel.querySelector('#cr-dc') || panel.querySelector('#cr-save-dc');
            if (mode) mode.value = 'save';
            if (dcIn) dcIn.value = String(stats.dc);
            const resEl = panel.querySelector('#combat-roll-result');
            if (resEl) resEl.innerHTML = `<strong>Turn Undead</strong> · WIS save DC ${stats.dc}, 30 ft. On fail: Turned 1 minute or until damaged.`;
            toast('Channel Divinity: Turn Undead');
          } else {
            toast('Channel Divinity used');
          }
          try { save(); } catch (e) {}
          refreshCombatDetail();
        });
      });
    })();

    panel.querySelector('#cr-apply-dmg')?.addEventListener('click', () => { applyToTarget('damage'); try { save(); renderCombat(); } catch (e) {} });
    panel.querySelector('#cr-apply-heal')?.addEventListener('click', () => { applyToTarget('heal'); try { save(); renderCombat(); } catch (e) {} });
    panel.querySelector('#cr-apply-cond')?.addEventListener('click', () => applyToTarget('cond'));

    window.__activeCombatAction = null;
    function refreshTargetList(profile) {
      const sel = panel.querySelector('#cr-target');
      const hint = panel.querySelector('#cr-target-hint');
      if (!sel) return;
      let combatants = [];
      try { combatants = getCombat(getActive()).combatants || []; } catch (e) {}
      const valid = profile ? filterTargetsByProfile(combatants, cb, profile) : combatants;
      const validSet = new Set(valid.map(x => x.id || x.name));
      sel.innerHTML = combatants.map((x, i) => {
        const ok = validSet.has(x.id || x.name);
        const label = `${x.name} (${x.hp}/${x.hpMax}) · ${x.side || '?'}${ok ? '' : ' · invalid'}`;
        return `<option value="${i}" ${ok ? '' : 'disabled'}>${escapeHtml(label)}</option>`;
      }).join('') || '<option disabled>No combatants</option>';
      // Auto-select all valid for aoe/sense, or single default
      [...sel.options].forEach(o => { o.selected = false; });
      if (profile && (profile.aoe || profile.targetType === 'any' || profile.effect === 'sense')) {
        [...sel.options].forEach(o => { if (!o.disabled) o.selected = true; });
      } else {
        const first = [...sel.options].find(o => !o.disabled);
        if (first) first.selected = true;
        // self
        if (profile && profile.targetType === 'self') {
          const selfIdx = combatants.findIndex(x => x === cb || x.id === cb.id || x.name === cb.name);
          if (selfIdx >= 0 && sel.options[selfIdx]) {
            [...sel.options].forEach(o => o.selected = false);
            sel.options[selfIdx].selected = true;
          }
        }
      }
      if (hint) {
        const rng = profile && profile.range != null ? (profile.range === 0 ? 'Self' : profile.range + ' ft.') : '—';
        hint.innerHTML = profile
          ? `<strong>${escapeHtml(profile.name || '')}</strong> · targets <strong>${escapeHtml(profile.targetType || 'any')}</strong> · range <strong>${escapeHtml(String(rng))}</strong>${profile.aoe ? ' · <em>AoE</em>' : ''} · effect <strong>${escapeHtml(profile.effect || '')}</strong>`
          : 'Select an action/spell to auto-filter valid targets.';
      }
    }
    panel.querySelector('#cr-select-all-targets')?.addEventListener('click', () => {
      const sel = panel.querySelector('#cr-target');
      if (!sel) return;
      [...sel.options].forEach(o => { if (!o.disabled) o.selected = true; });
    });
    panel.querySelector('#cr-select-none-targets')?.addEventListener('click', () => {
      const sel = panel.querySelector('#cr-target');
      if (!sel) return;
      [...sel.options].forEach(o => { o.selected = false; });

    panel.querySelector('#cr-open-map')?.addEventListener('click', () => {
      openMapForCombat({ combatantId: cb && (cb.id != null ? cb.id : null) });
    });
    panel.querySelector('#cr-open-map-aoe')?.addEventListener('click', () => {
      let ft = 20;
      let shape = 'sphere';
      const sp = panel.querySelector('#cr-spell-pick');
      if (sp && sp.value !== '' && typeof listCharacterSpellsForCombat === 'function') {
        const list = listCharacterSpellsForCombat(partyChar || null);
        const entry = list[Number(sp.value)];
        if (entry && entry.range) {
          const m = String(entry.range).match(/(\\d+)\\s*(foot|feet|ft)/i);
          if (m) ft = Number(m[1]);
          if (/cone/i.test(entry.range + entry.name)) shape = 'cone';
          if (/line/i.test(entry.range + entry.name)) shape = 'line';
          if (/cube|square/i.test(entry.description || '')) shape = 'cube';
        }
      }
      openMapForCombat({ combatantId: cb.id, aoeFt: ft, aoeShape: shape });
    });

    });
    panel.querySelector('#cr-apply-effect')?.addEventListener('click', () => {
      const act = window.__activeCombatAction;
      if (!act) { toast('Select an ability, spell, or attack first'); return; }
      const packs = getSelectedTargets();
      if (!packs.length) { toast('Select one or more valid targets'); return; }
      const effect = act.effect || 'damage';
      const override = parseInt(panel.querySelector('#cr-apply-amt')?.value, 10);
      // Roll once for shared damage if needed
      let sharedDmg = window.__lastCombatRoll?.damage || 0;
      if ((effect === 'damage' || effect === 'debuff') && !sharedDmg && act.damage) {
        sharedDmg = rollDieExpr(act.damage).total;
        window.__lastCombatRoll = { damage: sharedDmg, heal: 0, hit: true, name: act.name };
      }
      if (effect === 'heal' && !characterCanHeal(cb).ok) {
        // still allow ability-based heals like Cure Wounds loaded as spell
        if (!/cure|heal|healing word|goodberry|aid/i.test(act.name || '')) {
          toast('No healing available for this combatant');
          return;
        }
      }
      packs.forEach(({ target }) => {
        if (effect === 'damage' || effect === 'debuff') {
          let amt = !isNaN(override) ? override : sharedDmg;
          if (panel.querySelector('#cr-half')?.checked) amt = Math.floor(amt / 2);
          if (amt > 0) {
            let left = amt;
            const temp = target.tempHp || 0;
            if (temp > 0) { const a = Math.min(temp, left); target.tempHp = temp - a; left -= a; }
            target.hp = Math.max(0, (target.hp || 0) - left);
            if (target.hp === 0) target.deathSaves = target.deathSaves || { successes: 0, failures: 0 };
            syncLinkedCharacterHp(target);
          }
          if (effect === 'debuff') {
            const cond = act.name || 'Affected';
            if (!target.effectList) target.effectList = [];
            target.effectList.push({ name: cond, rounds: parseInt(panel.querySelector('#cr-cond-rounds')?.value, 10) || 1 });
            target.conditions = target.effectList.map(e => e.name + ' (' + e.rounds + ' rd)').join(', ');
          }
          appendLog(`${act.name} → ${target.name}: ${effect}${sharedDmg ? ' ' + sharedDmg : ''}`);
        } else if (effect === 'heal') {
          let amt = !isNaN(override) ? override : (window.__lastCombatRoll?.heal || 0);
          if (!amt && act.damage) amt = rollDieExpr(act.damage).total; // some heals store dice in damage field
          if (!amt) amt = parseInt(prompt('Heal amount for ' + target.name + '?', '5'), 10) || 0;
          target.hp = Math.min(target.hpMax || amt, (target.hp || 0) + amt);
          if (target.hp > 0) target.deathSaves = { successes: 0, failures: 0 };
          syncLinkedCharacterHp(target);
          appendLog(`${act.name} → healed ${target.name} for ${amt}`);
        } else if (effect === 'buff') {
          const cond = (act.name || 'Buff') + ' (buff)';
          if (!target.effectList) target.effectList = [];
          target.effectList.push({ name: cond, rounds: parseInt(panel.querySelector('#cr-cond-rounds')?.value, 10) || 1 });
          target.conditions = target.effectList.map(e => e.name + ' (' + e.rounds + ' rd)').join(', ');
          appendLog(`${act.name} → buffed ${target.name}`);
        } else if (effect === 'sense') {
          appendLog(`${act.name} → sensed ${target.name} (${act.text || 'GM reveals info'})`);
          if (!target.combatLog) target.combatLog = [];
          target.combatLog.push(`Sensed by ${cb.name}: ${act.name}`);
        } else {
          appendLog(`${act.name} → ${target.name}: ${act.text || 'utility'}`);
          if (act.targetType === 'self' && target.name === cb.name) {
            // Dark Bargain etc.
            if (/dark bargain/i.test(act.name) && (cb.charId || cb.sourceId)) {
              try {
                const c = getActive();
                const ch = [...(c.party||[]),...(c.villains||[])].find(x => x.id === (cb.charId||cb.sourceId));
                if (ch) { ch.corruption = Math.min(6, (ch.corruption || 0) + 1); }
              } catch (e) {}
            }
          }
        }
      });
      toast(`${act.name} applied to ${packs.length} target(s)`);
      try { save(); } catch (e) {}
      renderCombat();
    });
    panel.querySelectorAll('.combat-action-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        const hit = btn.dataset.hit;
        const dmg = btn.dataset.dmg;
        const kind = btn.dataset.kind || 'attack';
        const saveAb = btn.dataset.save || '';
        const name = btn.dataset.name || '';
        const targetType = btn.dataset.targetType || 'enemy';
        const range = btn.dataset.range !== '' ? parseInt(btn.dataset.range, 10) : null;
        const effect = btn.dataset.effect || 'damage';
        const aoe = btn.dataset.aoe === '1';
        const text = btn.dataset.text || '';
        if (hit !== '' && toHitEl) toHitEl.value = hit;
        if (dmg && dmgEl) dmgEl.value = dmg;
        const modeEl = panel.querySelector('#cr-mode');
        if (modeEl) modeEl.value = kind === 'save' ? 'save' : kind === 'auto' ? 'auto' : kind === 'utility' ? 'utility' : 'attack';
        const dcEl = panel.querySelector('#cr-dc');
        if (dcEl && kind === 'save') {
          if (btn.dataset.dc) dcEl.value = btn.dataset.dc;
          else if (!dcEl.value) dcEl.value = '15';
        }
        const profile = { name, targetType, range: isNaN(range) ? null : range, effect, aoe, damage: dmg, text, rollKind: kind };
        window.__activeCombatAction = profile;
        refreshTargetList(profile);
        const box = panel.querySelector('#cr-result');
        if (box) {
          box.innerHTML = `<div>Loaded <strong>${escapeHtml(name)}</strong></div>
            <div class="muted small">Targets: <strong>${escapeHtml(targetType)}</strong> · Range: <strong>${range === 0 ? 'Self' : (range != null ? range + ' ft.' : '—')}</strong> · Effect: <strong>${escapeHtml(effect)}</strong>${aoe ? ' · AoE' : ''}</div>
            <div class="muted small">${formatRichText(text || '')}</div>
            <div class="muted small">Select targets, roll if needed, then <strong>Apply Effect</strong>.</div>`;
        }
        panel.querySelectorAll('.combat-action-chip').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });
  }


  function lookupSpellInfo(name) {
    const q = String(name || '').toLowerCase().replace(/\s*\(\d+\w*\)\s*$/, '').trim();
    if (!q) return null;
    const list = (typeof window !== 'undefined' && Array.isArray(window.SPELLS)) ? window.SPELLS : [];
    let sp = list.find(s => String(s.name || '').toLowerCase() === q);
    if (!sp) sp = list.find(s => String(s.name || '').toLowerCase().includes(q) || q.includes(String(s.name || '').toLowerCase()));
    return sp || null;
  }

  /** Classify a spell/action for the roller: attack | save | auto | utility */
  function classifySpellAction(name, text) {
    const sp = lookupSpellInfo(name);
    const blob = ((sp && (sp.description || sp.summary)) || text || name || '').toLowerCase();
    const clean = String(name || '').toLowerCase();
    // Auto-hit
    if (/magic missile|heal(?:ing)? word|cure wounds|goodberry|aid\b/.test(clean + ' ' + blob) && !/attack roll/.test(blob)) {
      if (/magic missile/.test(clean) || /magic missile/.test(blob)) {
        return { kind: 'auto', saveAbility: null, damage: '3d4+3', note: 'Auto-hit (Magic Missile)' };
      }
    }
    // Attack rolls
    if (/ranged spell attack|melee spell attack|spell attack|make a .* attack roll|to hit/.test(blob) ||
        /fire bolt|ray of frost|eldritch blast|chill touch|sacred flame/.test(clean)) {
      // sacred flame is save in 5e - exception
      if (/sacred flame/.test(clean)) {
        return { kind: 'save', saveAbility: 'DEX', damage: '1d8', note: 'DEX save' };
      }
      let dmg = '';
      const dm = blob.match(/(\d+d\d+(?:\s*[+\-]\s*\d+)?)\s*(\w+)?\s*damage/);
      if (dm) dmg = dm[1].replace(/\s+/g, '');
      if (/fire bolt/.test(clean)) dmg = dmg || '1d10';
      if (/ray of frost/.test(clean)) dmg = dmg || '1d8';
      return { kind: 'attack', saveAbility: null, damage: dmg || '1d10', note: 'Spell attack' };
    }
    // Saves
    const sm = blob.match(/(strength|dexterity|constitution|intelligence|wisdom|charisma)\s+saving throw/);
    if (sm || /saving throw|must succeed on a/.test(blob) ||
        /fireball|hold person|counterspell|shield\b|misty step/.test(clean)) {
      const ab = sm ? sm[1].slice(0, 3).toUpperCase() : (
        /fireball|lightning|thunderwave|burning hands/.test(clean) ? 'DEX' :
        /hold person|dominate|suggestion|hideous/.test(clean) ? 'WIS' :
        /counterspell|dispel/.test(clean) ? '—' :
        /misty step|shield\b|invisibility|dimension door/.test(clean) ? null : 'WIS'
      );
      if (/shield\b|misty step|invisibility|dimension door|counterspell/.test(clean) && !sm) {
        return { kind: 'utility', saveAbility: null, damage: '', note: 'Utility / reaction / defense' };
      }
      let dmg = '';
      const dm = blob.match(/(\d+d\d+(?:\s*[+\-]\s*\d+)?)\s*(\w+)?\s*damage/);
      if (dm) dmg = dm[1].replace(/\s+/g, '');
      if (/fireball/.test(clean)) dmg = dmg || '8d6';
      return { kind: 'save', saveAbility: ab || 'DEX', damage: dmg, note: (ab || 'Save') + ' save' };
    }
    return { kind: 'utility', saveAbility: null, damage: '', note: 'Utility' };
  }


  /** Infer who an ability/spell can target and at what range (feet). */
  function inferTargetProfile(name, text, extra) {
    const blob = `${name || ''} ${text || ''} ${(extra && extra.note) || ''}`.toLowerCase();
    const sp = typeof lookupSpellInfo === 'function' ? lookupSpellInfo(name) : null;
    const rangeText = (sp && sp.range) || '';
    const full = blob + ' ' + String(rangeText).toLowerCase() + ' ' + String((sp && (sp.description || sp.summary)) || '').toLowerCase();

    let range = null;
    const rm = full.match(/(\d+)\s*(?:feet|foot|ft\.?)/i);
    if (rm) range = parseInt(rm[1], 10);
    if (/touch/i.test(rangeText) || /\btouch\b/.test(full)) range = range || 5;
    if (/self/i.test(rangeText) && !rm) range = 0;

    let targetType = 'enemy'; // default for attacks
    let effect = 'damage';
    let aoe = /each creature|all creatures|sphere|cone|line|within \d+ feet of|radius/i.test(full);

    // Self
    if (/\bself\b/.test(rangeText) || /\bon yourself\b|\byou gain\b|\byourself\b/.test(full) ||
        /patient defense|step of the wind|rage\b|blade ward|shield\b|mirror image|blur\b|stoneskin|absorb elements|dark bargain|shard mark/i.test(name + full)) {
      if (!/creature within|another creature|one creature|a creature|enemy|ally within/i.test(full) || /self \(/.test(rangeText)) {
        targetType = 'self';
        effect = /heal|regain|hit point/i.test(full) ? 'heal' : 'buff';
      }
    }
    // Ally / friendly
    if (/willing creature|creature you can see|ally|allies|friendly|cure wounds|healing word|aid\b|bless\b|shield of faith|haste\b|greater restoration|lesser restoration|spare the dying/i.test(full) &&
        !/hostile|enemy only/i.test(full)) {
      if (/willing|ally|allies|cure wounds|healing word|aid\b|bless\b/i.test(full)) {
        targetType = /self or|you or a|yourself or/i.test(full) ? 'self-or-ally' : 'ally';
        effect = /heal|regain|cure wounds|healing word/i.test(full) ? 'heal' : 'buff';
      }
    }
    // Enemy / hostile
    if (/hostile|enemy|enemies|spell attack|to hit|must succeed|saving throw|damage|umbrarian|whisper lash|eldritch blast|fire bolt|hold person|bane\b/i.test(full) &&
        targetType !== 'self' && targetType !== 'ally' && targetType !== 'self-or-ally') {
      targetType = aoe ? 'enemy' : 'enemy';
      effect = /heal/i.test(full) ? 'heal' : 'damage';
    }
    // Sense / utility (Resonant Sense etc.)
    if (/resonant sense|detect|reveal|know whether|sense the presence/i.test(full)) {
      targetType = 'any';
      effect = 'sense';
      range = range || 30;
    }
    // Dark Bargain — self
    if (/dark bargain/i.test(name + full)) {
      targetType = 'self';
      effect = 'utility';
    }
    // Explicit overrides from extra
    if (extra && extra.targetType) targetType = extra.targetType;
    if (extra && extra.range != null) range = extra.range;
    if (extra && extra.effect) effect = extra.effect;
    if (extra && extra.aoe != null) aoe = !!extra.aoe;

    return { targetType, range, aoe, effect, rangeLabel: range === 0 ? 'Self' : (range != null ? range + ' ft.' : '—') };
  }

  function filterTargetsByProfile(combatants, actor, profile) {
    const list = combatants || [];
    const actorSide = actor.side || 'neutral';
    const isAlly = (x) => {
      if (x === actor || x.id === actor.id) return true;
      if (actorSide === 'party' || actorSide === 'ally') return x.side === 'party' || x.side === 'ally';
      if (actorSide === 'enemy') return x.side === 'enemy';
      return x.side === actorSide;
    };
    const isEnemy = (x) => {
      if (x === actor || x.id === actor.id) return false;
      if (actorSide === 'party' || actorSide === 'ally') return x.side === 'enemy' || x.side === 'neutral';
      if (actorSide === 'enemy') return x.side === 'party' || x.side === 'ally' || x.side === 'neutral';
      return x.side !== actorSide;
    };
    switch (profile.targetType) {
      case 'self':
        return list.filter(x => x === actor || x.id === actor.id || x.name === actor.name);
      case 'ally':
        return list.filter(x => isAlly(x) && x !== actor && x.id !== actor.id);
      case 'self-or-ally':
        return list.filter(x => isAlly(x));
      case 'enemy':
        return list.filter(x => isEnemy(x));
      case 'any':
      default:
        return list.slice();
    }
  }

  function splitSpellNames(raw) {
    return String(raw || '')
      .replace(/\\n/g, '\n')
      .split(/\n|;|,/)
      .map(s => s.trim())
      .filter(Boolean)
      .map(s => s.replace(/\s+/g, ' '));
  }

  function renderActionSection(title, items) {
    if (!items || !items.length) return '';
    return `<div class="detail-block">
      <div class="detail-label">${escapeHtml(title)}</div>
      <div class="combat-action-list">
        ${items.map(a => {
          const kind = a.rollKind || a.effect || '';
          const tgt = a.targetType || '';
          const rng = a.rangeLabel || (a.range != null ? a.range + ' ft.' : '');
          const badge = [kind, tgt, rng].filter(Boolean).map(x => `<span class="action-kind">${escapeHtml(x)}</span>`).join(' ');
          return `<button type="button" class="combat-action-chip"
            data-name="${escapeAttr(a.name)}"
            data-hit="${a.toHit != null ? a.toHit : ''}"
            data-dmg="${escapeAttr(a.damage || '')}"
            data-kind="${escapeAttr(a.rollKind || 'attack')}"
            data-save="${escapeAttr(a.saveAbility || '')}"
            data-dc="${a.dc != null ? a.dc : ''}"
            data-target-type="${escapeAttr(a.targetType || 'enemy')}"
            data-range="${a.range != null ? a.range : ''}"
            data-effect="${escapeAttr(a.effect || 'damage')}"
            data-aoe="${a.aoe ? '1' : '0'}"
            data-text="${escapeAttr(a.text || a.note || '')}"
            title="${escapeAttr((a.text || a.name) + (a.note ? ' · ' + a.note : '') + (rng ? ' · ' + rng : '') + (tgt ? ' · ' + tgt : ''))}"
          >${escapeHtml(a.name)} ${badge}${a.toHit != null ? ' +' + a.toHit : ''}${a.damage ? ' (' + escapeHtml(a.damage) + ')' : ''}</button>`;
        }).join('')}
      </div>
    </div>`;
  }

  function collectCombatActions(cb, best, ch) {
    const out = { action: [], bonus: [], reaction: [], legendary: [], spell: [], ability: [] };
    const _pcSide = cb && (cb.side === 'party' || cb.side === 'ally');
    function push(section, name, toHit, damage, text, extra) {
      const cleanName = String(name || '').replace(/\\n/g, ' ').replace(/\s+/g, ' ').trim();
      if (!cleanName) return;
      const key = ['action','bonus','reaction','legendary','spell','ability'].includes(section) ? section : 'action';
      const profile = inferTargetProfile(cleanName, text || '', extra || {});
      const item = Object.assign({
        name: cleanName,
        toHit: toHit != null && toHit !== '' ? Number(toHit) : null,
        damage: damage || '',
        text: text || '',
        section: key,
        targetType: profile.targetType,
        range: profile.range,
        rangeLabel: profile.rangeLabel,
        aoe: profile.aoe,
        effect: profile.effect
      }, extra || {});
      // extra may override profile
      if (extra && extra.targetType) item.targetType = extra.targetType;
      if (extra && extra.range != null) { item.range = extra.range; item.rangeLabel = extra.range === 0 ? 'Self' : extra.range + ' ft.'; }
      if (extra && extra.effect) item.effect = extra.effect;
      out[key] = out[key] || [];
      out[key].push(item);
    }
    (cb.actions || []).forEach(a => push(a.kind || 'action', a.name, a.toHit, a.damage, a.text, a));
    (cb.bonusActions || []).forEach(a => push('bonus', a.name, a.toHit, a.damage, a.text, a));
    (cb.reactions || []).forEach(a => push('reaction', a.name, a.toHit, a.damage, a.text, a));
    if (!_pcSide) (cb.legendaryActions || []).forEach(a => push('legendary', a.name, a.toHit, a.damage, a.text, a));
    parseCombatAttacks(cb, best).forEach(a => {
      if (a.name === 'Custom…') return;
      push('action', a.name, a.toHit, a.damage, a.notes, { rollKind: 'attack', targetType: 'enemy', effect: 'damage' });
    });
    const spellSrc = ch || cb;
    if (spellSrc) {
      splitSpellNames(spellSrc.cantrips).forEach(s => {
        const cls = classifySpellAction(s, '');
        const prof = inferTargetProfile(s, cls.note || '', cls);
        push('spell', s, null, cls.damage || '', 'Cantrip', {
          rollKind: cls.kind, saveAbility: cls.saveAbility, note: cls.note,
          targetType: prof.targetType, range: prof.range, effect: prof.effect, aoe: prof.aoe
        });
      });
      splitSpellNames(spellSrc.spells).slice(0, 24).forEach(s => {
        const bare = s.replace(/\s*\(\d+\w*\)\s*$/, '').trim();
        const cls = classifySpellAction(bare, s);
        const prof = inferTargetProfile(bare, s + ' ' + (cls.note || ''), cls);
        push('spell', s, null, cls.damage, 'Spell', {
          rollKind: cls.kind, saveAbility: cls.saveAbility, note: cls.note,
          targetType: prof.targetType, range: prof.range, effect: prof.effect, aoe: prof.aoe
        });
      });
      if (String(spellSrc.class || '').includes('Monk') || (spellSrc.classes || []).some(c => c.name === 'Monk')) {
        push('bonus', 'Flurry of Blows', null, '1d6', 'Ki — melee', { targetType: 'enemy', range: 5, effect: 'damage', rollKind: 'attack' });
        push('bonus', 'Patient Defense', null, '', 'Ki — self', { targetType: 'self', range: 0, effect: 'buff', rollKind: 'utility' });
        push('bonus', 'Step of the Wind', null, '', 'Ki — self', { targetType: 'self', range: 0, effect: 'buff', rollKind: 'utility' });
      }
      if ((spellSrc.classes || []).some(c => c.name === 'Barbarian') || spellSrc.class === 'Barbarian') {
        push('bonus', 'Rage', null, '', 'Bonus action — self', { targetType: 'self', range: 0, effect: 'buff', rollKind: 'utility' });
      }
      if ((spellSrc.classes || []).some(c => c.name === 'Bloodhunter') || spellSrc.class === 'Bloodhunter') {
        push('bonus', 'Blood Maledict', null, '', 'Bloodhunter — enemy', { targetType: 'enemy', range: 30, effect: 'debuff', rollKind: 'save' });
      }
      // ── Umbrarian template abilities ──
      const isUmb = !!(spellSrc.isUmbrarian || cb.isUmbrarian);
      if (isUmb) {
        const stage = spellSrc.umbrarianStage || cb.umbrarianStage || 'dormant';
        const shard = spellSrc.shard || cb.shard || 'Shard';
        const ab = spellSrc.shardAbility || cb.shardAbility || 'INT';
        push('ability', 'Resonant Sense', null, '',
          'Action, 1/LR, 30 ft. — GM reveals true Shard / echo / Sword influence / Guardian ward (not which). Blocked by wards.',
          { targetType: 'any', range: 30, effect: 'sense', rollKind: 'utility', aoe: false });
        push('ability', 'Dark Bargain', null, '',
          '1/LR — After failing a d20 test, reroll (must use); Corruption +1. Self.',
          { targetType: 'self', range: 0, effect: 'utility', rollKind: 'utility' });
        if (stage !== 'dormant') {
          push('action', 'Whisper Lash', null, '2d8',
            `Action — DC uses ${ab}; WIS save, 2d8 psychic. Range 30 ft.`,
            { targetType: 'enemy', range: 30, effect: 'damage', rollKind: 'save', saveAbility: 'WIS', dc: 15 });
        }
        if (stage === 'ascendant' || stage === 'awakened') {
          push('ability', 'Shard Gift (Awakened)', null, '',
            `Use a Shard Gift from ${shard}. Typical range 30 ft. or self — pick targets in range.`,
            { targetType: 'any', range: 30, effect: 'utility', rollKind: 'utility' });
        }
        if (stage === 'ascendant') {
          push('ability', 'Dominion Demand', null, '',
            'Corruption 4+: Shard Demand on a creature. Refuse → psychic damage 2× level. Range 30 ft.',
            { targetType: 'enemy', range: 30, effect: 'debuff', rollKind: 'save', saveAbility: 'WIS' });
        }
      }
    }

      // ── CLASS_ABILITIES combat features (level-gated) ──
      try {
        const abilities = (typeof window !== 'undefined' && window.CLASS_ABILITIES) ? window.CLASS_ABILITIES : {};
        const list = normalizeClassLevels(spellSrc);
        list.forEach(c => {
          const arr = abilities[c.name];
          if (!Array.isArray(arr)) return;
          const lvl = Number(c.level) || 1;
          arr.forEach(feat => {
            if ((feat.lvl || 1) > lvl) return;
            const nm = feat.name || '';
            // Skip passives, progressions, and non-action labels that clutter combat
            if (/^(extra attack|ability score|asi\b|hit points|proficiency|expertise|spellcasting|pact magic|divine domain|primal path|martial archetype|monastic tradition|otherworldly patron|sacred oath|ranger archetype|rogueish archetype|bard college|sorcerous origin|druid circle|arcane tradition|fighter archetype|elite progress|lunar charges|ki points?|channel divinity features)$/i.test(nm.trim())) return;
            if (/ability score|asi\b|proficiency bonus|expertise|jack of all|spellcasting\b|pact magic|divine domain|primal path|martial archetype|monastic tradition|arcane recovery|unarmored defense|unarmored movement|timeless body|empty body|diamond soul|pure body|tongue of the sun|elusive|slippery mind|reliable talent|blindsense|stroke of luck|indomitable might|primal champion|survivor|superior critical|fighter weapon|fighting style\b/i.test(nm) && !/attack action|strike|surge|rage\b|smite|inspiration|wild shape|second wind|action surge|stunning strike|flurry|patient defense|step of the wind|cunning action|reckless attack|weapon master/i.test(nm)) return;
            const combatish = /attack|strike|surge|rage|ki |channel divinity|smite|inspiration|wild shape|second wind|action surge|indomitable|lunar|moonlight|blood maledict|blood rite|spirit step|shadow |flurry|patient defense|step of the wind|uncanny|evasion|deflect|stunning|reckless|danger sense|lay on hands|divine sense|cunning action|sneak attack|font of magic|metamagic|eldritch|arcane recovery|brand of|phase strike|ghostwalk|umbral|resonant/i.test(nm + ' ' + (feat.text||''));
            if (!combatish && (feat.lvl || 1) > 1) return; // keep level 1 staples
            const section = /bonus action|as a bonus/i.test(feat.text||'') ? 'bonus'
              : /reaction|when hit|when a creature/i.test(feat.text||'') ? 'reaction'
              : 'ability';
            const prof = inferTargetProfile(nm, feat.text || '', {});
            push(section, nm, null, '', (feat.text || '').slice(0, 220), {
              targetType: prof.targetType, range: prof.range, effect: prof.effect, aoe: prof.aoe,
              rollKind: /save|dc /i.test(feat.text||'') ? 'save' : (/attack/i.test(nm) ? 'attack' : 'utility'),
              featureLevel: feat.lvl
            });
          });
        });
      } catch (e) {}
      // Moon Path features
      try {
        const paths = (typeof window !== 'undefined' && window.MOON_PATHS) ? window.MOON_PATHS : [];
        const list = normalizeClassLevels(spellSrc);
        const mg = list.find(c => c.name === 'Moon Guardian');
        if (mg && mg.subclass) {
          const path = paths.find(p => p.name === mg.subclass || (p.id && mg.subclass.toLowerCase().includes(p.id)));
          if (path && Array.isArray(path.features)) {
            path.features.forEach(f => {
              if ((f.lvl || 1) > (mg.level || 1)) return;
              const prof = inferTargetProfile(f.name, f.text || '', {});
              push('ability', f.name, null, '', (f.text || '').slice(0, 220), {
                targetType: prof.targetType, range: prof.range, effect: prof.effect,
                rollKind: 'utility', featureLevel: f.lvl
              });
            });
          }
        }
      } catch (e) {}
      // Feats with combat use
      try {
        const feats = spellSrc.feats || [];
        (Array.isArray(feats) ? feats : []).forEach(f => {
          const full = typeof findFeat === 'function' ? (findFeat(f.id || f.name) || f) : f;
          const nm = full.name || f.name || '';
          if (!nm) return;
          if (!/sharpshooter|great weapon master|polearm|sentinel|war caster|alert|mobile|tough|lucky|healer|crossbow expert|dual wielder|defensive duelist|mage slayer|savage attacker|tavern brawler|grappler/i.test(nm)) return;
          push('ability', nm, null, '', (full.text || '').slice(0, 180), { targetType: 'self', range: 0, effect: 'buff', rollKind: 'utility' });
        });
      } catch (e) {}

    // Legendary actions: NPC/villain only — never player characters / party
    const isPcOrAlly = (cb.side === 'party' || cb.side === 'ally' || (ch && (ch.type === 'pc' || ch.type === 'ally')))
      && !(cb.side === 'enemy' || cb.side === 'villain');
    if (!isPcOrAlly && (cb.legendary || (cb.legendaryActions && cb.legendaryActions.length))) {
      if (!out.legendary.length) {
        push('legendary', 'Detect', null, '', '1 LA', { targetType: 'any', range: 30, effect: 'sense' });
        push('legendary', 'Move', null, '', '1 LA — self', { targetType: 'self', range: 0, effect: 'utility' });
        push('legendary', 'Attack', null, '', '2 LA', { targetType: 'enemy', range: 5, effect: 'damage', rollKind: 'attack' });
      }
    }
    return out;
  }

  function renderCombat() {
    ensureCombatWorkspace();
    const c = getActive();
    if (!c) {
      console.warn('renderCombat: no active workspace');
      return;
    }
    const combat = getCombat(c);
    const list = $('#combat-list');
    const empty = $('#empty-combat');
    list.innerHTML = '';

    $('#combat-round').textContent = combat.round;

    if (combat.selectedIndex == null) combat.selectedIndex = combat.turnIndex || 0;

    if (combat.combatants.length === 0) {
      empty.classList.remove('hidden');
      $('#combat-turn-label').textContent = '—';
      showCombatDetail(null);
      return;
    }
    empty.classList.add('hidden');

    // Clamp turn index
    if (combat.turnIndex >= combat.combatants.length) combat.turnIndex = 0;
    if (combat.turnIndex < 0) combat.turnIndex = 0;
    if (combat.selectedIndex >= combat.combatants.length) combat.selectedIndex = combat.turnIndex;

    const active = combat.combatants[combat.turnIndex];
    $('#combat-turn-label').textContent = active ? `Turn: ${active.name}` : '—';

    combat.combatants.forEach((cb, idx) => {
      const row = document.createElement('div');
      const dead = cb.hp <= 0;
      const selected = idx === combat.selectedIndex;
      row.className = `combatant-row side-${cb.side || 'neutral'}${idx === combat.turnIndex ? ' active-turn' : ''}${dead ? ' dead' : ''}${selected ? ' selected' : ''}`;
      row.dataset.idx = String(idx);
      const hpPct = cb.hpMax > 0 ? cb.hp / cb.hpMax : 1;
      let hpClass = '';
      if (dead) hpClass = 'dead-hp';
      else if (hpPct <= 0.25) hpClass = 'critical';
      else if (hpPct <= 0.5) hpClass = 'hurt';

      row.innerHTML = `
        <div class="combat-init" title="Click to edit initiative" data-idx="${idx}">${cb.init}</div>
        <div class="combat-name-block">
          <div class="combat-name">${escapeHtml(cb.name)}${cb.concentrating ? ' <span class="muted small" title="Concentrating">◎</span>' : ''}${cb.legendary ? ' <span class="muted small">★</span>' : ''}${cb.hp <= 0 ? ' <span class="muted small">☠</span>' : ''}</div>
          <div class="combat-sub">AC ${cb.ac}${cb.tempHp ? ' · THP ' + cb.tempHp : ''}${cb.actionUsed ? ' · Act' : ''}${cb.bonusUsed ? ' · BA' : ''}${cb.reactionUsed ? ' · Reac' : ''}${(cb.attacksMax != null) ? ' · Atk ' + Math.max(0, (cb.attacksMax||1)-(cb.attacksUsed||0)) + '/' + (cb.attacksMax||1) : ''}${cb.turnPhase === 'active' ? ' · ▶' : ''}</div>
          <div class="combat-res-chips">${(function(){
            const res = cb.combatResources || {};
            return Object.keys(res).map(function(k){
              const r = res[k];
              const left = r.max >= 99 ? '∞' : Math.max(0, (r.max||0) - (r.used||0));
              const maxL = r.max >= 99 ? '∞' : r.max;
              return '<span class="res-chip" title="' + escapeAttr(r.label||k) + '">' + escapeHtml(r.label||k) + ' ' + left + '/' + maxL + '</span>';
            }).join('');
          })()}</div>
          <div class="hp-bar"><span style="width:${Math.max(0, Math.min(100, hpPct * 100))}%"></span></div>
        </div>
        <div class="combat-hp-controls">
          <button type="button" class="hp-minus" data-idx="${idx}" title="-1 HP">−</button>
          <button type="button" class="hp-minus5" data-idx="${idx}" title="-5 HP">−5</button>
          <span class="combat-hp-val ${hpClass}" data-idx="${idx}" title="Click to set HP">${cb.hp}/${cb.hpMax}</span>
          <button type="button" class="hp-plus" data-idx="${idx}" title="+1 HP">+</button>
          <button type="button" class="hp-plus5" data-idx="${idx}" title="+5 HP">+5</button>
        </div>
        <div class="combat-actions">
          <button type="button" class="icon-btn combat-remove" data-idx="${idx}" title="Remove">✕</button>
        </div>
        <div class="combat-conditions">
          <input type="text" class="cond-input" data-idx="${idx}" value="${escapeAttr(cb.conditions || '')}" placeholder="Conditions & effects (poisoned, prone, Blessed, Hasted, Invisible…)" />
        </div>
      `;
      row.addEventListener('click', (e) => {
        if (e.target.closest('button, input, .combat-init, .combat-hp-val')) return;
        combat.selectedIndex = idx;
        save();
        renderCombat();
      });
      list.appendChild(row);
    });

    showCombatDetail(combat.combatants[combat.selectedIndex]);

    // Wire HP buttons
    list.querySelectorAll('.hp-minus').forEach(btn => {
      btn.addEventListener('click', () => adjustHp(parseInt(btn.dataset.idx, 10), -1));
    });
    list.querySelectorAll('.hp-minus5').forEach(btn => {
      btn.addEventListener('click', () => adjustHp(parseInt(btn.dataset.idx, 10), -5));
    });
    list.querySelectorAll('.hp-plus').forEach(btn => {
      btn.addEventListener('click', () => adjustHp(parseInt(btn.dataset.idx, 10), 1));
    });
    list.querySelectorAll('.hp-plus5').forEach(btn => {
      btn.addEventListener('click', () => adjustHp(parseInt(btn.dataset.idx, 10), 5));
    });
    list.querySelectorAll('.combat-hp-val').forEach(el => {
      el.addEventListener('click', async () => {
        const idx = parseInt(el.dataset.idx, 10);
        const cb = getCombat(c).combatants[idx];
        if (!cb) return;
        const ok = await openModal({
          title: `Set HP — ${cb.name}`,
          bodyHtml: `
            <div class="form-row">
              <div class="field"><label>Current HP</label><input type="number" id="m-hp" value="${cb.hp}" /></div>
              <div class="field"><label>Max HP</label><input type="number" id="m-hpmax" value="${cb.hpMax}" /></div>
            </div>`,
          onConfirm: () => {
            cb.hp = parseInt($('#m-hp')?.value, 10) || 0;
            cb.hpMax = parseInt($('#m-hpmax')?.value, 10) || cb.hpMax;
            save();
            return true;
          }
        });
        if (ok) renderCombat();
      });
    });
    list.querySelectorAll('.combat-init').forEach(el => {
      el.addEventListener('click', async () => {
        const idx = parseInt(el.dataset.idx, 10);
        const cb = getCombat(c).combatants[idx];
        if (!cb) return;
        const ok = await openModal({
          title: `Initiative — ${cb.name}`,
          bodyHtml: `<div class="field"><label>Initiative</label><input type="number" id="m-init" value="${cb.init}" /></div>`,
          onConfirm: () => {
            cb.init = parseInt($('#m-init').value, 10) || 0;
            save();
            return true;
          }
        });
        if (ok) renderCombat();
      });
    });
    list.querySelectorAll('.combat-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx, 10);
        const combat = getCombat(c);
        combat.combatants.splice(idx, 1);
        if (combat.turnIndex >= combat.combatants.length) combat.turnIndex = Math.max(0, combat.combatants.length - 1);
        save();
        renderCombat();
      });
    });
    list.querySelectorAll('.cond-input').forEach(inp => {
      inp.addEventListener('change', () => {
        const idx = parseInt(inp.dataset.idx, 10);
        const cb = getCombat(c).combatants[idx];
        if (cb) {
          cb.conditions = inp.value.trim();
          save();
        }
      });
    });
  }

  function adjustHp(idx, delta) {
    const c = getActive();
    if (!c) return;
    const combat = getCombat(c);
    const cb = combat.combatants[idx];
    if (!cb) return;
    const before = cb.hp || 0;
    if (delta < 0) {
      let dmg = -delta;
      const temp = cb.tempHp || 0;
      if (temp > 0) {
        const absorb = Math.min(temp, dmg);
        cb.tempHp = temp - absorb;
        dmg -= absorb;
      }
      cb.hp = Math.max(0, before - dmg);
      // Concentration check when taking damage while concentrating
      if (cb.concentrating && dmg > 0) {
        const dc = Math.max(10, Math.floor(dmg / 2));
        const roll = 1 + Math.floor(Math.random() * 20);
        // CON mod unknown — use flat roll; DM can override
        const ok = roll >= dc;
        if (!cb.combatLog) cb.combatLog = [];
        cb.combatLog.push(`Concentration DC ${dc}: rolled ${roll} → ${ok ? 'OK' : 'LOST'}`);
        if (!ok) cb.concentrating = false;
        toast(`Concentration DC ${dc}: ${roll} (${ok ? 'maintained' : 'lost'})`);
      }
      if (cb.hp === 0) {
        cb.deathSaves = cb.deathSaves || { successes: 0, failures: 0 };
      }
    } else {
      cb.hp = Math.min(cb.hpMax || before + delta, before + delta);
      if (cb.hp > 0) cb.deathSaves = { successes: 0, failures: 0 };
    }
    if (cb.hp > cb.hpMax) cb.hp = cb.hpMax;
    syncLinkedCharacterHp(cb);
    save();
    renderCombat();
  }

  function combatNextTurn() {
    const c = getActive();
    if (!c) return;
    const combat = getCombat(c);
    if (combat.combatants.length === 0) return;
    // Reset reaction used for the combatant whose turn is ending
    const prev = combat.combatants[combat.turnIndex];
    if (prev) {
      prev.turnPhase = 'ended';
    }
    combat.turnIndex = (combat.turnIndex + 1) % combat.combatants.length;
    const next = combat.combatants[combat.turnIndex];
    if (next) {
      // Start of turn for next combatant
      next.turnPhase = 'ready';
      next.attacksUsed = 0;
      next.moveUsed = 0;
      next.actionUsed = false;
      next.bonusUsed = false;
      next.objectInteractUsed = false;
      next.reactionUsed = false; // refreshes at start of their turn
      if (next.legendary) {
        next.legendaryActionsLeft = next.legendaryActionsPerRound != null ? next.legendaryActionsPerRound : 3;
      }
    }
    if (combat.turnIndex === 0) {
      combat.round = (combat.round || 1) + 1;
      tickConditionDurations(combat);
      // Refresh legendary actions budget each round
      combat.combatants.forEach(cb => {
        if (cb.legendary) cb.legendaryActionsLeft = cb.legendaryActionsPerRound != null ? cb.legendaryActionsPerRound : 3;
      });
    }
    const cur = combat.combatants[combat.turnIndex];
    if (cur) {
      combat.selectedIndex = combat.turnIndex;
    }
    save();
    renderCombat();
  }

  function combatClear() {
    const c = getActive();
    if (!c) return;
    c.combat = { round: 1, turnIndex: 0, combatants: [] };
    save();
    renderCombat();
    toast('Combat cleared');
  }

  function combatSortInit() {
    const c = getActive();
    if (!c) return;
    const combat = getCombat(c);
    const activeId = combat.combatants[combat.turnIndex]?.id;
    combat.combatants.sort((a, b) => (b.init || 0) - (a.init || 0));
    if (activeId) {
      const newIdx = combat.combatants.findIndex(x => x.id === activeId);
      combat.turnIndex = newIdx >= 0 ? newIdx : 0;
    } else {
      combat.turnIndex = 0;
    }
    save();
    renderCombat();
    toast('Sorted by initiative');
  }

  function combatRollInit() {
    const c = getActive();
    if (!c) return;
    const combat = getCombat(c);
    combat.combatants.forEach(cb => {
      // d20 + keep relative dex bias if we stored notes; simple d20 for now, preserve existing as base offset
      cb.init = Math.floor(Math.random() * 20) + 1;
    });
    combat.combatants.sort((a, b) => (b.init || 0) - (a.init || 0));
    combat.turnIndex = 0;
    combat.round = 1;
    save();
    renderCombat();
    toast('Initiative rolled');
  }

  async function combatPickFromList(list, side, title) {
    const c = getActive();
    if (!c) return;
    ensureCampaignShape(c);
    const items = list || [];
    if (items.length === 0) {
      toast(side === 'enemy' ? 'No villains in roster' : 'No party members');
      return;
    }
    const options = items.map((ch, i) =>
      `<label class="pick-row" style="display:flex;align-items:center;gap:0.5rem;margin:0.35rem 0;cursor:pointer">
        <input type="checkbox" class="pick-cb" value="${i}" />
        <span>${escapeHtml(ch.name)} <span class="muted small">(AC ${ch.ac || 10}, HP ${ch.hp || 0}/${ch.hpMax || ch.hp || 0})</span></span>
      </label>`
    ).join('');
    const ok = await openModal({
      title,
      bodyHtml: `<p class="muted small" style="margin-bottom:0.75rem">Select one or more to add to combat.</p>${options}`,
      confirmText: 'Add Selected',
      onConfirm: () => {
        const checked = $$('.pick-cb:checked');
        if (checked.length === 0) { toast('Select at least one'); return false; }
        const combat = getCombat(c);
        checked.forEach(cb => {
          const ch = items[parseInt(cb.value, 10)];
          if (ch) combat.combatants.push(combatantFromChar(ch, side));
        });
        c.updatedAt = new Date().toISOString();
        save();
        return true;
      }
    });
    if (ok) {
      toast('Added to combat');
      renderCombat();
    }
  }

  async function combatQuickAdd() {
    const c = getActive();
    if (!c) return;
    const ok = await openModal({
      title: 'Quick Add Combatant',
      bodyHtml: `
        <div class="form-row">
          <div class="field"><label>Name</label><input type="text" id="m-name" placeholder="Goblin 1" /></div>
          <div class="field"><label>Side</label>
            <select id="m-side">
              <option value="enemy">Enemy</option>
              <option value="party">Party</option>
              <option value="neutral">Neutral</option>
            </select>
          </div>
        </div>
        <div class="form-row triple">
          <div class="field"><label>Init</label><input type="number" id="m-init" value="10" /></div>
          <div class="field"><label>HP</label><input type="number" id="m-hp" value="10" /></div>
          <div class="field"><label>AC</label><input type="number" id="m-ac" value="12" /></div>
        </div>
        <div class="field"><label>Notes / Attacks</label><input type="text" id="m-notes" placeholder="Scimitar +4 (1d6+2)" /></div>
      `,
      confirmText: 'Add',
      onConfirm: () => {
        const name = $('#m-name')?.value?.trim();
        if (!name) { toast('Name required'); return false; }
        const combat = getCombat(c);
        const hp = parseInt($('#m-hp')?.value, 10) || 1;
        combat.combatants.push({
          id: uid(),
          sourceId: null,
          name,
          init: parseInt($('#m-init').value, 10) || 0,
          hp,
          hpMax: hp,
          ac: parseInt($('#m-ac')?.value, 10) || 10,
          conditions: '',
          side: $('#m-side').value || 'enemy',
          notes: ($('#m-notes')?.value || '').trim()
        });
        save();
        return true;
      }
    });
    if (ok) {
      toast('Combatant added');
      renderCombat();
    }
  }


  function combatantFromCharacter(ch, side) {
    const dexMod = Math.floor(((ch.dex || 10) - 10) / 2);
    return {
      id: uid(),
      charId: ch.id,
      name: ch.name,
      side: side || (ch.type === 'villain' ? 'enemy' : 'ally'),
      init: (1 + Math.floor(Math.random() * 20)) + dexMod,
      ac: ch.ac || 10,
      hp: ch.hp != null ? ch.hp : (ch.hpMax || 10),
      hpMax: ch.hpMax || ch.hp || 10,
      tempHp: ch.tempHp || 0,
      conditions: Array.isArray(ch.conditions) ? ch.conditions.join(', ') : (ch.conditions || ''),
      notes: ch.attacks || ch.notes || '',
      attacks: ch.attacks || '',
      actions: ch.actions || [],
      bonusActions: ch.bonusActions || [],
      reactions: ch.reactions || [],
      legendaryActions: ch.legendaryActions || [],
      legendary: !!(ch.legendary && (side === 'enemy' || side === 'villain' || ch.type === 'enemy' || ch.type === 'villain')),
      legendaryResist: ch.legendaryResist,
      legendaryResistMax: ch.legendaryResistMax,
      resistances: ch.resistances || '',
      immunities: ch.immunities || '',
      vulnerabilities: ch.vulnerabilities || '',
      speed: ch.speed || '30 ft.',
      concentrating: false,
      combatLog: []
    };
  }

  function combatantFromBestiary(b, side) {
    return {
      id: uid(),
      sourceId: null,
      bestiaryName: b.n,
      name: b.n,
      init: 10,
      hp: b.hp,
      hpMax: b.hp,
      ac: b.ac,
      conditions: '',
      side: side || 'enemy',
      notes: `CR ${b.cr} · ${b.o} · ${b.w}`
    };
  }

  function addBestiaryToCombat(b) {
    const c = getActive();
    if (!c) { c = ensureCombatWorkspace() || getActive(); if (!c) { toast('Workspace unavailable'); return; } }
    const combat = getCombat(c);
    combat.combatants.push(combatantFromBestiary(b));
    save();
    toast(`${b.n} added to combat`);
  }

  function addBestiaryAsVillain(b) {
    const c = getActive();
    if (!c) { c = ensureCombatWorkspace() || getActive(); if (!c) { toast('Workspace unavailable'); return; } }
    ensureCampaignShape(c);
    c.villains.push({
      id: uid(),
      name: b.n,
      player: 'NPC',
      type: 'villain',
      class: b.o,
      level: Math.max(1, Math.round(Number(b.cr) || 1)),
      world: b.w,
      hp: b.hp,
      hpMax: b.hp,
      ac: b.ac,
      speed: '30 ft.',
      str: 10, dex: 12, con: 12, int: 8, wis: 10, cha: 8,
      profBonus: 2,
      attacks: '',
      features: `${b.o} creature of ${b.w}`,
      notes: `CR ${b.cr}. From Bestiary of the Seven Worlds.`,
      corruption: b.o === 'Swordborn' || b.o === 'Sword-Touched' ? 2 : 0,
      subclass: '', race: '', background: '', alignment: '', saves: '', skills: '', equipment: ''
    });
    c.updatedAt = new Date().toISOString();
    save();
    toast(`${b.n} saved as Villain`);
  }

  async function combatPickBestiary() {
    const c = getActive();
    if (!c) return;
    const world = c.currentWorld || '';
    const filtered = world ? BESTIARY.filter(b => b.w === world) : BESTIARY;
    const pool = filtered.length ? filtered : BESTIARY;
    // Show searchable multi-pick of up to ~30 entries from pool sorted by CR
    const sorted = [...pool].sort((a, b) => a.cr - b.cr || a.n.localeCompare(b.n));
    const options = sorted.map((b, i) =>
      `<label class="pick-row" style="display:flex;align-items:center;gap:0.5rem;margin:0.3rem 0;cursor:pointer">
        <input type="checkbox" class="pick-cb" value="${i}" />
        <span><strong>${escapeHtml(b.n)}</strong> <span class="muted small">CR ${b.cr} · ${escapeHtml(b.o)} · AC ${b.ac} HP ${b.hp}</span></span>
      </label>`
    ).join('');
    const ok = await openModal({
      title: world ? `Bestiary — ${world}` : 'Add from Bestiary',
      bodyHtml: `<p class="muted small" style="margin-bottom:0.6rem">${sorted.length} creatures${world ? ' on ' + world : ''}. Select one or more.</p>
        <div style="max-height:50vh;overflow-y:auto">${options}</div>`,
      confirmText: 'Add to Combat',
      wide: true,
      onConfirm: () => {
        const checked = $$('.pick-cb:checked');
        if (!checked.length) { toast('Select at least one'); return false; }
        const combat = getCombat(c);
        checked.forEach(cb => {
          const b = sorted[parseInt(cb.value, 10)];
          if (b) combat.combatants.push(combatantFromBestiary(b));
        });
        save();
        return true;
      }
    });
    if (ok) { toast('Added to combat'); renderCombat(); }
  }

  async function combatRandomEncounter() {
    const c = getActive();
    if (!c) { c = ensureCombatWorkspace() || getActive(); if (!c) { toast('Workspace unavailable'); return; } }
    const world = c.currentWorld || '';
    // Estimate party tier from average level
    const levels = (c.party || []).map(p => Number(p.level) || 1);
    const avgLevel = levels.length ? levels.reduce((a, b) => a + b, 0) / levels.length : 3;
    // Target CR band roughly party level / 2 to party level
    const minCr = Math.max(0, avgLevel * 0.4 - 1);
    const maxCr = avgLevel + 2;
    let pool = BESTIARY.filter(b => b.cr >= minCr && b.cr <= maxCr);
    if (world) {
      const worldPool = pool.filter(b => b.w === world);
      if (worldPool.length) pool = worldPool;
    }
    if (!pool.length) pool = world ? BESTIARY.filter(b => b.w === world) : BESTIARY;
    if (!pool.length) { toast('No creatures match'); return; }

    // Prefer 1–3 creatures totaling ~party CR budget
    const budget = Math.max(1, avgLevel * 1.2);
    const picks = [];
    let spent = 0;
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    for (const b of shuffled) {
      if (picks.length >= 3) break;
      if (spent > 0 && spent + b.cr > budget * 1.5) continue;
      picks.push(b);
      spent += b.cr;
      if (spent >= budget * 0.7 && picks.length >= 1 && Math.random() < 0.5) break;
    }
    if (!picks.length) picks.push(shuffled[0]);

    const lines = picks.map(b => `• <strong>${escapeHtml(b.n)}</strong> — CR ${b.cr}, AC ${b.ac}, HP ${b.hp} (${escapeHtml(b.o)}, ${escapeHtml(b.w)})`).join('<br>');
    const ok = await openModal({
      title: 'Random Encounter',
      bodyHtml: `<p class="muted small">World: <strong>${escapeHtml(world || 'Any')}</strong> · Party avg level ~${avgLevel.toFixed(1)} · Target CR ${minCr.toFixed(1)}–${maxCr.toFixed(1)}</p>
        <p style="margin:0.75rem 0">${lines}</p>
        <p class="muted small">Add these to the combat tracker?</p>`,
      confirmText: 'Add to Combat',
      onConfirm: () => {
        const combat = getCombat(c);
        picks.forEach(b => combat.combatants.push(combatantFromBestiary(b)));
        save();
        return true;
      }
    });
    if (ok) {
      toast(`Encounter: ${picks.map(p => p.n).join(', ')}`);
      renderCombat();
    }
  }

  function bindCombatListeners() {
    $('#combat-next-btn')?.addEventListener('click', combatNextTurn);
    $('#combat-clear-btn')?.addEventListener('click', async () => {
      const ok = await openModal({
        title: 'Clear Combat?',
        bodyHtml: '<p>Remove all combatants and reset the round counter?</p>',
        confirmText: 'Clear',
        onConfirm: () => true
      });
      if (ok) combatClear();
    });
    $('#combat-add-party-btn')?.addEventListener('click', () => {
      const c = getActive();
      if (!c) return;
      combatPickFromList(c.party, 'party', 'Add from Party');
    });
    $('#combat-add-villain-btn')?.addEventListener('click', () => {
      const c = getActive();
      if (!c) return;
      ensureCampaignShape(c);
      combatPickFromList(c.villains, 'enemy', 'Add from Villains');
    });
    $('#combat-add-bestiary-btn')?.addEventListener('click', combatPickBestiary);
    $('#combat-random-enc-btn')?.addEventListener('click', combatRandomEncounter);
    $('#combat-quick-add-btn')?.addEventListener('click', combatQuickAdd);
    $('#combat-roll-init-btn')?.addEventListener('click', combatRollInit);
    $('#combat-delay-btn')?.addEventListener('click', () => {
    const c = getActive();
    if (!c) return;
    const combat = getCombat(c);
    const i = combat.turnIndex || 0;
    if (i >= combat.combatants.length - 1) { combatNextTurn(); return; }
    const [row] = combat.combatants.splice(i, 1);
    combat.combatants.push(row);
    // stay on same index (next person slides up)
    save(); renderCombat();
    toast(row.name + ' delayed');
  });
  $('#combat-save-enc-btn')?.addEventListener('click', () => {
    const c = getActive();
    if (!c) return;
    const combat = getCombat(c);
    const name = prompt('Encounter name?', 'Encounter ' + new Date().toLocaleDateString());
    if (!name) return;
    const presets = loadEncounterPresets();
    presets.unshift({ name, at: new Date().toISOString(), combatants: JSON.parse(JSON.stringify(combat.combatants || [])) });
    saveEncounterPresets(presets);
    toast('Encounter saved');
  });
  $('#combat-load-enc-btn')?.addEventListener('click', async () => {
    const presets = loadEncounterPresets();
    if (!presets.length) { toast('No saved encounters'); return; }
    const body = presets.map((p, i) => `<label class="checkbox-row"><input type="radio" name="enc" value="${i}" ${i===0?'checked':''}/> ${escapeHtml(p.name)} <span class="muted small">(${(p.combatants||[]).length})</span></label>`).join('');
    const ok = await openModal({
      title: 'Load Encounter',
      bodyHtml: body,
      confirmText: 'Load',
      onConfirm: () => {
        const pick = document.querySelector('input[name=enc]:checked');
        if (!pick) return false;
        const p = presets[parseInt(pick.value, 10)];
        const c = getActive();
        if (!c || !p) return false;
        const combat = getCombat(c);
        combat.combatants = JSON.parse(JSON.stringify(p.combatants || []));
        combat.turnIndex = 0;
        combat.round = 1;
        save();
        return true;
      }
    });
    if (ok) { renderCombat(); toast('Encounter loaded'); }
  });
  $('#combat-export-log-btn')?.addEventListener('click', () => {
    const c = getActive();
    if (!c) return;
    const combat = getCombat(c);
    const lines = [`# Combat Log — Round ${combat.round || 1}`, ''];
    (combat.combatants || []).forEach(cb => {
      lines.push(`## ${cb.name}`);
      (cb.combatLog || []).forEach(l => lines.push('- ' + l));
      lines.push('');
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'combat-log.md';
    a.click();
    toast('Log exported');
  });
  $('#combat-end-round-btn')?.addEventListener('click', () => {
    // End Round = advance to next combatant in initiative (and bump round when wrapping)
    combatNextTurn();
    const c = getActive();
    if (!c) return;
    const combat = getCombat(c);
    const cur = combat.combatants[combat.turnIndex];
    toast(cur ? `Turn: ${cur.name} (Round ${combat.round || 1})` : `Round ${combat.round || 1}`);
  });
  $('#combat-add-villain-gen-btn')?.addEventListener('click', () => {
    const v = generateVillain({});
    const c = getActive();
    if (!c) { c = ensureCombatWorkspace() || getActive(); if (!c) { toast('Workspace unavailable'); return; } }
    getCombat(c).combatants.push(villainToCombatant(v));
    save();
    renderCombat();
    toast(v.name + ' enters the fray');
  });
  $('#combat-sort-btn')?.addEventListener('click', combatSortInit);
  }

  // ─── Bestiary ────────────────────────────────────────────────────────────
  function bestiaryMatches(b, q, world, origin, crBand) {
    if (world && b.w !== world) return false;
    if (origin && b.o !== origin) return false;
    if (q) {
      const hay = [b.n, b.w, b.o, b.classif, b.desc, b.eco, b.people, b.run, b.seeds]
        .filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (crBand) {
      const cr = Number(b.cr);
      if (crBand === '0-2' && !(cr <= 2)) return false;
      if (crBand === '3-5' && !(cr >= 3 && cr <= 5)) return false;
      if (crBand === '6-9' && !(cr >= 6 && cr <= 9)) return false;
      if (crBand === '10-14' && !(cr >= 10 && cr <= 14)) return false;
      if (crBand === '15+' && !(cr >= 15)) return false;
    }
    return true;
  }

  function originClass(o) {
    return String(o || '').toLowerCase().replace(/\s+/g, '-');
  }

  
  function renderDscClasses() { /* stripped */ }

function renderUmbrarians() { /* stripped */ }

  function renderBestiary() { /* full bestiary view stripped — picker still works */ }

  function bindBestiaryListeners() {
    ['bestiary-search', 'bestiary-world', 'bestiary-origin', 'bestiary-cr', 'bestiary-source'].forEach(id => {
      const el = document.getElementById(id);
      if (!el || el.dataset.wired) return;
      el.dataset.wired = '1';
      el.addEventListener('input', renderBestiary);
      el.addEventListener('change', () => {
        if (id === 'bestiary-source') {
          window.BESTIARY_SOURCE = el.value || 'all';
          applyCompendiumToRuntime();
        }
        renderBestiary();
      });
    });
    const refBtn = document.getElementById('bestiary-refresh-btn');
    if (refBtn && !refBtn.dataset.wired) {
      refBtn.dataset.wired = '1';
      refBtn.addEventListener('click', async () => {
        refBtn.disabled = true;
        try {
          if (typeof loadUserCompendiumAsync === 'function') await loadUserCompendiumAsync();
          if (typeof applyCompendiumToRuntime === 'function') applyCompendiumToRuntime();
          if (typeof refreshBestiaryRef === 'function') refreshBestiaryRef();
          renderBestiary();
          toast('Bestiary refreshed');
        } catch (e) {
          console.warn(e);
          toast('Refresh failed');
        } finally {
          refBtn.disabled = false;
        }
      });
    }
  }

  // ─── Dice Roller ─────────────────────────────────────────────────────────
  function rollDie(sides) {
    return Math.floor(Math.random() * sides) + 1;
  }

  function parseFormula(str) {
    str = str.replace(/\s+/g, '').toLowerCase();
    const match = str.match(/^(\d*)d(\d+)([+-]\d+)?$/i);
    if (match) {
      const count = parseInt(match[1] || '1', 10);
      const sides = parseInt(match[2], 10);
      const mod = match[3] ? parseInt(match[3], 10) : 0;
      return { count, sides, mod };
    }
    return null;
  }

  function performRoll({ count = 1, sides = 20, mod = 0, advantage = false, disadvantage = false, label = null }) {
    let rolls = [];
    let detail = '';

    if (advantage || disadvantage) {
      const r1 = Array.from({ length: count }, () => rollDie(sides));
      const r2 = Array.from({ length: count }, () => rollDie(sides));
      const sum1 = r1.reduce((a, b) => a + b, 0);
      const sum2 = r2.reduce((a, b) => a + b, 0);
      if (advantage && !disadvantage) {
        rolls = sum1 >= sum2 ? r1 : r2;
        detail = `Adv [${r1.join(', ')}] vs [${r2.join(', ')}] → `;
      } else if (disadvantage && !advantage) {
        rolls = sum1 <= sum2 ? r1 : r2;
        detail = `Dis [${r1.join(', ')}] vs [${r2.join(', ')}] → `;
      } else {
        rolls = r1;
        detail = '';
      }
    } else {
      rolls = Array.from({ length: count }, () => rollDie(sides));
    }

    const subtotal = rolls.reduce((a, b) => a + b, 0);
    const total = subtotal + mod;
    const modStr = mod === 0 ? '' : (mod > 0 ? ` + ${mod}` : ` − ${Math.abs(mod)}`);
    detail += `${count}d${sides}: [${rolls.join(', ')}]${modStr}`;

    const entry = {
      total,
      detail,
      label: label || `${count}d${sides}${modStr}`,
      time: new Date().toLocaleTimeString(),
    };

    state.diceHistory.unshift(entry);
    if (state.diceHistory.length > 40) state.diceHistory.pop();
    save();

    $('#dice-result .result-total').textContent = total;
    $('#dice-result .result-detail').textContent = detail;
    renderDiceHistory();

    const totalEl = $('#dice-result .result-total');
    totalEl.style.transform = 'scale(1.15)';
    setTimeout(() => { totalEl.style.transform = ''; }, 150);

    return entry;
  }

  function renderDiceHistory() {
    const ul = $('#roll-history');
    ul.innerHTML = state.diceHistory.slice(0, 20).map(h =>
      `<li><span class="total">${h.total}</span> ← ${escapeHtml(h.detail)} <small>${h.time}</small></li>`
    ).join('');
  }

  function setupDice() {
    $$('.die-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        $$('.die-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        state.selectedDie = parseInt(btn.dataset.sides, 10);
      });
    });
    $('.die-btn[data-sides="20"]')?.classList.add('selected');

    $('#roll-btn')?.addEventListener('click', () => {
      const count = Math.max(1, Math.min(99, parseInt($('#dice-count').value, 10) || 1));
      const mod = parseInt($('#dice-mod').value, 10) || 0;
      const advantage = $('#adv-check').checked;
      const disadvantage = $('#dis-check').checked;
      performRoll({ count, sides: state.selectedDie, mod, advantage, disadvantage });
    });

    $('#roll-custom')?.addEventListener('click', () => {
      const formula = $('#custom-formula').value.trim();
      if (!formula) return;
      const parsed = parseFormula(formula);
      if (!parsed) {
        toast('Invalid formula. Try 2d6+3 or 1d20');
        return;
      }
      performRoll({ ...parsed, label: formula });
    });

    $('#custom-formula')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') $('#roll-custom').click();
    });

    $('#clear-history')?.addEventListener('click', () => {
      state.diceHistory = [];
      save();
      renderDiceHistory();
      $('#dice-result .result-total').textContent = '—';
      $('#dice-result .result-detail').textContent = '';
    });

    $('#dice-toggle')?.addEventListener('click', () => {
      $('#dice-panel').classList.toggle('hidden');
    });
    $('#dice-close')?.addEventListener('click', () => {
      $('#dice-panel').classList.add('hidden');
    });

    $('#adv-check')?.addEventListener('change', () => {
      if ($('#adv-check').checked) $('#dis-check').checked = false;
    });
    $('#dis-check')?.addEventListener('change', () => {
      if ($('#dis-check').checked) $('#adv-check').checked = false;
    });

    renderDiceHistory();
  }

  // ─── Export / Import ─────────────────────────────────────────────────────
  function exportData() {
    const data = {
      version: 1,
      exportedAt: new Date().toISOString(),
      campaigns: state.campaigns,
      diceHistory: state.diceHistory,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dark-sun-chronicles-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast('Data exported');
  }

  function importData(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (!data.campaigns || !Array.isArray(data.campaigns)) {
          toast('Invalid backup file');
          return;
        }
        openModal({
          title: 'Import Data?',
          bodyHtml: `<p>This will replace your current campaigns with the imported data (${data.campaigns.length} campaign${data.campaigns.length !== 1 ? 's' : ''}). Export first if you want a backup.</p>`,
          confirmText: 'Import & Replace',
          onConfirm: () => {
            state.campaigns = data.campaigns;
            state.activeCampaignId = data.campaigns[0]?.id || null;
            if (data.diceHistory) state.diceHistory = data.diceHistory;
            save();
            updateNavEnabled();
            ensureCombatWorkspace(); setView(document.body?.dataset?.app === 'combat-tracker' ? 'combat' : 'campaigns');
            toast('Data imported');
            return true;
          },
        });
      } catch {
        toast('Could not parse file');
      }
    };
    reader.readAsText(file);
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────
  
  /** Safe rich text: newlines + **bold** + *italic* without full HTML inject */
  function formatRichText(str) {
    if (str == null || str === '') return '';
    let s = String(str);
    // Literal backslash-n from JSON/export dumps → real newline
    s = s.replace(/\\n/g, '\n').replace(/\\r/g, '');
    s = s.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    s = s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/(^|[^*])\*([^\*\n]+)\*(?!\*)/g, '$1<em>$2</em>');
    s = s.replace(/(^|\n)\s*-\s+/g, '$1• ');
    s = s.replace(/\n/g, '<br>');
    return s;
  }

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function escapeAttr(str) {
    return escapeHtml(str).replace(/'/g, '&#39;');
  }

  // ─── Init ────────────────────────────────────────────────────────────────
  function init() {
    // Load persisted workspace FIRST so nothing creates a blank over it
    try { load(); } catch (e) { console.warn(e); }
    try { tryRestoreRosterBackupIfEmpty(); } catch (e) {}
    try { bindMapCrossWindowSync(); } catch (e) {}
    document.getElementById('combat-map-popout-btn')?.addEventListener('click', () => openMapPopout());
    document.getElementById('map-popout-btn')?.addEventListener('click', () => openMapPopout());
    loadUserCompendiumAsync().then(() => {
      try { applyCompendiumToRuntime(); } catch (e) { console.warn(e); }
      if (typeof renderCompendiumTools === 'function' && $('#compendium-tools')) renderCompendiumTools();
      if ($('#feature-compendium-tools') && typeof renderFeatureCompendium === 'function') renderFeatureCompendium($('#feature-compendium-tools'));
      if (window.DSCExtensions && $('#extensions-tools')) {
        window.DSCExtensions.renderExtensionsTools($('#extensions-tools'), { player: false });
      }
      if (typeof renderBestiary === 'function' && $('#view-bestiary')?.classList.contains('active')) renderBestiary();
    }).catch(e => console.warn(e));
    try { applyCompendiumToRuntime(); } catch (e) { console.warn(e); }
    try {
      restoreMapImagesAfterLoad().then(() => {
        try {
          if (typeof isMapPopoutMode === 'function' && isMapPopoutMode()) applyMapPopoutMode();
          else if (typeof initBattleMapUi === 'function') initBattleMapUi();
          if (document.getElementById('view-map')?.classList.contains('active') || isMapPopoutMode()) {
            renderBattleMap();
            renderMapRoster();
          }
          if (document.getElementById('view-combat')?.classList.contains('active') && !isMapPopoutMode()) renderCombat();
        } catch (e) {}
      });
    } catch (e) {}
    if (document.body?.dataset?.app === 'combat-tracker') {
      if (!(typeof isMapPopoutMode === 'function' && isMapPopoutMode())) {
        ensureCombatWorkspace();
        updateNavEnabled();
        setView('combat');
      } else {
        updateNavEnabled();
        // pop-out: stay on map only
        try { applyMapPopoutMode(); } catch (e) {}
      }
    } else {
      updateNavEnabled();
    }

    $$('.nav-item').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.disabled) return;
        setView(btn.dataset.view);
      });
    });

    // menu-toggle wired in bindSidebarToggle()

    $('#new-campaign-btn')?.addEventListener('click', () => promptNewCampaign());
    $('#new-session-btn')?.addEventListener('click', () => promptSession());
    
    const impCharBtn = $('#import-character-btn');
    const impCharFile = $('#import-character-file');
    if (impCharBtn && impCharFile && !impCharBtn.dataset.wired) {
      impCharBtn.dataset.wired = '1';
      impCharBtn.addEventListener('click', () => impCharFile.click());
      impCharFile.addEventListener('change', () => {
        const f = impCharFile.files && impCharFile.files[0];
        if (f) importCharacterJson(f, false);
        impCharFile.value = '';
      });
    }

    $('#new-character-btn')?.addEventListener('click', () => promptCharacter());
    $('#new-faction-btn')?.addEventListener('click', () => promptFaction());
    $('#new-force-btn')?.addEventListener('click', () => promptForce());

    try { bindOverviewListeners(); } catch (e) { console.warn(e); }
    try { bindNotes(); } catch (e) { console.warn(e); }
    try { bindCombatListeners(); } catch (e) { console.warn(e); }
    try { bindBestiaryListeners(); } catch (e) { console.warn(e); }
    try { setupDice(); } catch (e) { console.warn(e); }

    

  $('#export-btn')?.addEventListener('click', exportData);
    $('#import-btn')?.addEventListener('click', () => $('#import-file').click());
    $('#import-file')?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (file) importData(file);
      e.target.value = '';
    });

    setView(document.body?.dataset?.app === 'combat-tracker' ? 'combat' : 'campaigns');

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (!$('#modal').classList.contains('hidden')) {
          $('#modal-cancel').click();
        } else if (!$('#dice-panel').classList.contains('hidden')) {
          $('#dice-panel').classList.add('hidden');
        }
      }
    });
  }

  document.body.dataset.app = 'combat-tracker';

  // ═══════════════════════════════════════════════════════════
  // Battle Map — image / UVTT + tokens + AoE
  // ═══════════════════════════════════════════════════════════
  
  function applyAoeTargetsToRoller(panelEl) {
    const c = getActive();
    const combat = c ? getCombat(c) : null;
    if (!combat || !combat.aoeTargetIds || !combat.aoeTargetIds.length) return 0;
    const ids = new Set(combat.aoeTargetIds.map(String));
    const root = panelEl || document;
    const sel = root.querySelector ? root.querySelector('#cr-target') : document.getElementById('cr-target');
    if (!sel) return 0;
    let n = 0;
    Array.from(sel.options).forEach(o => {
      const idx = parseInt(o.value, 10);
      const cb = !isNaN(idx) ? combat.combatants[idx] : null;
      const id = cb ? String(cb.id || idx) : String(o.value);
      const hit = ids.has(id) || ids.has(String(idx)) || (cb && ids.has(String(cb.name)));
      o.selected = !!hit;
      if (hit) n++;
    });
    const hint = root.querySelector ? root.querySelector('#cr-target-hint') : document.getElementById('cr-target-hint');
    if (hint && n) hint.textContent = 'AoE map targets selected (' + n + '). Adjust if needed.';
    if (n) toast('AoE targets selected in roller: ' + n);
    return n;
  }

  function openMapForCombat(opts) {
    opts = opts || {};
    try { ensureCombatWorkspace(); } catch (e) {}
    const map = getCombatMap();
    if (map && opts.aoeFt) {
      map.pendingAoeFt = Number(opts.aoeFt) || 20;
      map.pendingAoeShape = opts.aoeShape || 'sphere';
    }
    if (opts.combatantId) {
      const c = getActive();
      const combat = c ? getCombat(c) : null;
      if (combat) combat.mapFocusId = opts.combatantId;
    }
    if (typeof setView === 'function') setView('map');
    else document.querySelector('.nav-item[data-view="map"]')?.click();
    setTimeout(() => {
      try {
        const ft = document.getElementById('map-aoe-ft');
        if (ft && opts.aoeFt) ft.value = String(opts.aoeFt);
        const tool = document.getElementById('map-tool');
        if (tool && opts.aoeShape) {
          const shape = opts.aoeShape;
          const val = shape === 'sphere' ? 'aoe-sphere' : ('aoe-' + shape);
          if ([...tool.options].some(o => o.value === val)) tool.value = val;
        }
        if (opts.combatantId) {
          const sel = document.getElementById('map-token-combatant');
          if (sel) sel.value = String(opts.combatantId);
        }
        refreshMapTokenSelect();
        renderBattleMap();
      } catch (e) {}
    }, 50);
  }

  function listNameForToken(id) {
    try {
      const c = getActive();
      const combat = c ? getCombat(c) : null;
      const cb = ((combat && combat.combatants) || []).find((x, i) => String(x.id || i) === String(id));
      return cb ? cb.name : '';
    } catch (e) { return ''; }
  }

  function selectCombatantById(id) {
    const c = getActive();
    const combat = c ? getCombat(c) : null;
    if (!combat) return;
    const idx = combat.combatants.findIndex((cb, i) => String(cb.id || i) === String(id));
    if (idx < 0) return;
    combat.selectedIndex = idx;
    try { save(); } catch (e) {}
    try { renderCombat(); } catch (e) {}
  }

  
  function mapGridMetrics(map) {
    const g = Math.max(4, Number(map.gridSize) || 70);
    const ox = Number(map.gridOffsetX) || 0;
    const oy = Number(map.gridOffsetY) || 0;
    return { g, ox, oy };
  }

  function snapWorldToGrid(map, x, y) {
    const { g, ox, oy } = mapGridMetrics(map);
    // Snap to cell center relative to grid origin (offset)
    const cx = Math.floor((x - ox) / g) * g + g / 2 + ox;
    const cy = Math.floor((y - oy) / g) * g + g / 2 + oy;
    return { x: cx, y: cy };
  }

  function snapAllMapTokens(map) {
    if (!map || !map.tokens) return;
    Object.keys(map.tokens).forEach(id => {
      const p = map.tokens[id];
      if (!p) return;
      map.tokens[id] = snapWorldToGrid(map, p.x, p.y);
    });
  }

  
  function openMapPopout() {
    // Persist main window state before opening viewer
    try {
      if (!(typeof isMapPopoutMode === 'function' && isMapPopoutMode())) {
        ensureCombatWorkspace();
        save();
      }
    } catch (e) {}
    const url = new URL(window.location.href);
    url.searchParams.set('mapPopout', '1');
    const w = window.open(url.toString(), 'dsc_map_popout', 'noopener,noreferrer,width=1280,height=800');
    if (!w) {
      toast('Pop-up blocked — allow pop-ups for this site');
      return;
    }
    toast('Map window opened — share that window on Discord');
  }

  function isMapPopoutMode() {
    try {
      return new URLSearchParams(window.location.search).get('mapPopout') === '1';
    } catch (e) { return false; }
  }

  function applyMapPopoutMode() {
    if (!isMapPopoutMode()) return;
    document.body.classList.add('map-popout');
    document.title = 'Battle Map (shared)';
    // Physically remove chrome so it cannot reappear or stay clickable
    const strip = [
      '.app-header', 'header', '#menu-toggle', '#sidebar', '.sidebar',
      '.app-nav', 'nav', '#view-combat', '#view-tools', '#view-campaigns',
      '.view-desc', '.map-toolbar', '#view-map .view-header'
    ];
    strip.forEach(sel => {
      document.querySelectorAll(sel).forEach(el => {
        try { el.remove(); } catch (e) { try { el.style.display = 'none'; } catch (e2) {} }
      });
    });
    // Keep only map view content
    const mapView = document.getElementById('view-map');
    if (mapView) {
      mapView.classList.add('active');
      mapView.style.display = 'flex';
      mapView.style.flexDirection = 'column';
      mapView.style.minHeight = '100dvh';
      mapView.style.margin = '0';
      mapView.style.padding = '0.25rem';
    }
    try { if (typeof load === 'function') load(); } catch (e) {}
    const finish = () => {
      try {
        if (typeof setView === 'function') setView('map');
      } catch (e) {}
      try {
        initBattleMapUi();
        refreshMapTokenSelect();
        renderBattleMap();
        renderMapRoster();
      } catch (err) { console.warn(err); }
      // Second pass strip (setView may re-show)
      strip.forEach(sel => {
        document.querySelectorAll(sel).forEach(el => {
          if (el.id === 'view-map') return;
          try { el.remove(); } catch (e) {}
        });
      });
      document.querySelectorAll('#menu-toggle, .app-header, header').forEach(el => { try { el.remove(); } catch (e) {} });
    };
    if (typeof restoreMapImagesAfterLoad === 'function') {
      restoreMapImagesAfterLoad().then(finish).catch(finish);
    } else finish();
  }

  function bindMapCrossWindowSync() {
    if (window.__mapSyncBound) return;
    window.__mapSyncBound = true;
    // localStorage from other window (same origin)
    window.addEventListener('storage', (e) => {
      if (!e.key) return;
      if (e.key !== STORAGE_KEY && e.key !== ROSTER_BACKUP_KEY) return;
      try { if (typeof load === 'function') load(); } catch (err) {}
      const after = () => {
        if (isMapPopoutMode() || document.getElementById('view-map')?.classList.contains('active')) {
          try { refreshMapTokenSelect(); renderBattleMap(); renderMapRoster(); } catch (err) {}
        }
        if (!isMapPopoutMode() && document.getElementById('view-combat')?.classList.contains('active')) {
          try { renderCombat(); } catch (err) {}
        }
      };
      if (typeof restoreMapImagesAfterLoad === 'function') {
        restoreMapImagesAfterLoad().then(after).catch(after);
      } else after();
    });
    // BroadcastChannel for same-browser live updates
    try {
      const bc = new BroadcastChannel('dsc_combat_map_sync');
      window.__mapBc = bc;
      bc.onmessage = (ev) => {
        if (!ev.data || ev.data.type !== 'state') return;
        // Pop-out: reload light state; main: merge without dropping media
        try { if (typeof load === 'function') load(); } catch (err) {}
        const after = () => {
          try {
            if (isMapPopoutMode() || document.getElementById('view-map')?.classList.contains('active')) {
              refreshMapTokenSelect();
              renderBattleMap();
              renderMapRoster();
            }
            if (!isMapPopoutMode() && document.getElementById('view-combat')?.classList.contains('active')) {
              renderCombat();
            }
          } catch (err) {}
        };
        if (typeof restoreMapImagesAfterLoad === 'function') {
          restoreMapImagesAfterLoad().then(after).catch(after);
        } else after();
      };
    } catch (e) {}
  }

  function notifyMapWindows() {
    try {
      if (window.__mapBc) window.__mapBc.postMessage({ type: 'state', t: Date.now() });
    } catch (e) {}
  }


  function getCombatMap() {
    const c = getActive();
    if (!c) return null;
    if (!c.combatMap) {
      c.combatMap = {
        imageDataUrl: null,
        gridSize: 70,
        gridOffsetX: 0,
        gridOffsetY: 0,
        width: 0,
        height: 0,
        walls: [],
        tokens: {},
        aoe: null,
        scale: 1
      };
    }
    return c.combatMap;
  }

  function parseUvttFile(text) {
    const data = JSON.parse(text);
    // Universal VTT / dd2vtt shapes vary slightly
    const img = data.image || data.map_image || (data.resolution && data.resolution.map_origin) || null;
    let dataUrl = null;
    if (typeof img === 'string') {
      if (img.startsWith('data:')) dataUrl = img;
      else dataUrl = 'data:image/png;base64,' + img.replace(/^base64,/, '');
    }
    const pixels = data.resolution
      ? (data.resolution.pixels_per_grid || data.resolution.pixels_per_square || 70)
      : (data.pixels_per_grid || data.gridSize || 70);
    const walls = [];
    const los = data.line_of_sight || data.walls || data.los || [];
    (Array.isArray(los) ? los : []).forEach(poly => {
      if (Array.isArray(poly)) {
        for (let i = 0; i < poly.length - 1; i++) {
          const a = poly[i], b = poly[i + 1];
          if (a && b && a.length >= 2 && b.length >= 2) {
            walls.push({ x1: a[0], y1: a[1], x2: b[0], y2: b[1] });
          }
        }
      } else if (poly && poly.c != null) {
        // some formats
      }
    });
    // portals sometimes as wall segments
    const portals = data.portals || [];
    (Array.isArray(portals) ? portals : []).forEach(p => {
      if (p.bounds && p.bounds.length >= 2) {
        const a = p.bounds[0], b = p.bounds[1];
        walls.push({ x1: a.x || a[0], y1: a.y || a[1], x2: b.x || b[0], y2: b.y || b[1], door: true });
      }
    });
    return {
      imageDataUrl: dataUrl,
      gridSize: Number(pixels) || 70,
      walls,
      width: data.resolution ? (data.resolution.map_size && data.resolution.map_size.x) : 0,
      height: data.resolution ? (data.resolution.map_size && data.resolution.map_size.y) : 0,
      raw: data
    };
  }

  function refreshMapTokenSelect() {
    const sel = document.getElementById('map-token-combatant');
    if (!sel) return;
    const c = getActive();
    const combat = c ? getCombat(c) : null;
    const list = (combat && combat.combatants) || [];
    sel.innerHTML = list.map((cb, i) =>
      `<option value="${escapeAttr(cb.id || String(i))}">${escapeHtml(cb.name || ('#' + i))}</option>`
    ).join('') || '<option value="">No combatants</option>';
  }

  
  function renderMapRoster() {
    const listEl = document.getElementById('map-roster-list');
    if (!listEl) return;
    const c = getActive();
    const combat = c ? getCombat(c) : null;
    const list = (combat && combat.combatants) || [];
    const map = getCombatMap();
    const selectedIdx = combat ? combat.selectedIndex : -1;
    if (!list.length) {
      listEl.innerHTML = '<p class="muted small">No combatants. Add them in Combat, then place tokens here.</p>';
      return;
    }
    listEl.innerHTML = list.map((cb, idx) => {
      const id = String(cb.id != null ? cb.id : idx);
      const side = String(cb.side || '').toLowerCase();
      const sideClass = (side === 'enemy' || side === 'villain') ? 'enemy' : ((side === 'ally' || side === 'allies') ? 'ally' : 'pc');
      const hp = Number(cb.hp) || 0;
      const hpMax = Math.max(1, Number(cb.hpMax) || 1);
      const hide = !!cb.hideHp;
      const pct = hide ? 0 : Math.max(0, Math.min(100, Math.round(100 * hp / hpMax)));
      const placed = map && map.tokens && map.tokens[id];
      const sel = idx === selectedIdx ? ' selected' : '';
      const init = cb.initiative != null ? cb.initiative : '—';
      return `<div class="map-roster-card ${sideClass}${sel}" data-id="${escapeAttr(id)}" data-idx="${idx}">
        <div class="mr-name">${escapeHtml(cb.name || 'Combatant')}</div>
        <div class="mr-meta">Init ${escapeHtml(String(init))} · AC ${cb.ac != null ? cb.ac : '—'} · ${escapeHtml(sideClass)}${placed ? '' : ' · <em>not on map</em>'}</div>
        <div class="mr-hp${(!hide && hp < hpMax * 0.5) ? ' hurt' : ''}">${hide ? '' : (hp + '/' + hpMax + ' HP')}</div>
        <div class="mr-bar">${hide ? '' : `<span style="width:${pct}%"></span>`}</div>
        <div class="tool-btns" style="margin-top:0.3rem">
          <button type="button" class="btn secondary btn-tiny mr-place" data-id="${escapeAttr(id)}">${placed ? 'Re-place' : 'Place'}</button>
          <button type="button" class="btn secondary btn-tiny mr-focus" data-id="${escapeAttr(id)}">Select</button>
        </div>
      </div>`;
    }).join('');

    listEl.querySelectorAll('.map-roster-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('button')) return;
        const id = card.getAttribute('data-id');
        selectCombatantById(id);
        const sel = document.getElementById('map-token-combatant');
        if (sel) sel.value = id;
        renderMapRoster();
        renderBattleMap();
      });
    });
    listEl.querySelectorAll('.mr-place').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        const sel = document.getElementById('map-token-combatant');
        if (sel) sel.value = id;
        const tool = document.getElementById('map-tool');
        if (tool) tool.value = 'token';
        toast('Click the map to place ' + (listNameForToken(id) || id));
        selectCombatantById(id);
      });
    });
    listEl.querySelectorAll('.mr-focus').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        selectCombatantById(btn.getAttribute('data-id'));
        renderMapRoster();
        renderBattleMap();
      });
    });
  }


  function drawMapOverlays(ctx, canvas, map, scale) {
    if (!ctx || !canvas || !map) return;
      const g = (Number(map.gridSize) || 70) * scale;
    const gox = (Number(map.gridOffsetX) || 0) * scale;
    const goy = (Number(map.gridOffsetY) || 0) * scale;
    if (g >= 8) {
      ctx.strokeStyle = 'rgba(196,163,90,0.28)';
      ctx.lineWidth = 1;
      let x0 = gox % g;
      if (x0 > 0) x0 -= g;
      for (let x = x0; x <= canvas.width + g; x += g) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
      }
      let y0 = goy % g;
      if (y0 > 0) y0 -= g;
      for (let y = y0; y <= canvas.height + g; y += g) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
      }
    }

    // walls
    if (map.walls && map.walls.length) {
      ctx.strokeStyle = 'rgba(255,80,80,0.55)';
      ctx.lineWidth = 2;
      map.walls.forEach(w => {
      ctx.beginPath();
      ctx.moveTo(w.x1 * scale, w.y1 * scale);
      ctx.lineTo(w.x2 * scale, w.y2 * scale);
      ctx.stroke();
      });
    }

    // tokens
    const c = getActive();
    const combat = c ? getCombat(c) : null;
    const list = (combat && combat.combatants) || [];
    const selectedId = combat && combat.selectedIndex != null && combat.combatants[combat.selectedIndex]
      ? String(combat.combatants[combat.selectedIndex].id || combat.selectedIndex)
      : (combat && combat.mapFocusId) || null;
    list.forEach((cb, idx) => {
      const id = String(cb.id || idx);
      const pos = map.tokens[id];
      if (!pos) return;
      const x = pos.x * scale, y = pos.y * scale;
      const r = Math.max(8, (Number(map.gridSize) || 70) * scale * 0.35);
      const side = String(cb.side || '').toLowerCase();
      const isEnemy = side === 'enemy' || side === 'villain' || side === 'enemies';
      const isAlly = side === 'ally' || side === 'allies';
      let fill = isEnemy ? 'rgba(180,40,40,0.9)' : (isAlly ? 'rgba(50,100,180,0.9)' : 'rgba(40,120,80,0.9)');
      const hp = Number(cb.hp) || 0;
      const hpMax = Math.max(1, Number(cb.hpMax) || 1);
      const ratio = Math.max(0, Math.min(1, hp / hpMax));
      if (hp <= 0) fill = 'rgba(60,60,60,0.85)';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = fill;
      ctx.fill();
      // HP arc (hidden when hideHp)
      if (!cb.hideHp && hp > 0) {
      ctx.beginPath();
      ctx.strokeStyle = ratio > 0.5 ? '#5dba6a' : (ratio > 0.25 ? '#d4a017' : '#c44');
      ctx.lineWidth = 3;
      ctx.arc(x, y, r + 2, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ratio);
      ctx.stroke();
      }
      ctx.strokeStyle = String(id) === String(selectedId) ? '#ffd24a' : '#e8dcc8';
      ctx.lineWidth = String(id) === String(selectedId) ? 3 : 2;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText((cb.name || '?').slice(0, 10), x, y + r + 12);
      if (!cb.hideHp) {
      ctx.fillStyle = '#c4a35a';
      ctx.font = '10px sans-serif';
      ctx.fillText(hp + '/' + hpMax, x, y + 3);
      }
      // still draw HP arc only if not hidden
    });

    // AoE
    if (map.aoe) {
      const a = map.aoe;
      const ox = a.x * scale, oy = a.y * scale;
      const ft = a.ft || 20;
      const pxPerFt = ((Number(map.gridSize) || 70) * scale) / 5; // 5 ft square
      const rad = (ft) * pxPerFt;
      ctx.fillStyle = 'rgba(100,160,255,0.25)';
      ctx.strokeStyle = 'rgba(100,180,255,0.9)';
      ctx.lineWidth = 2;
      if (a.shape === 'sphere' || a.shape === 'cube') {
      if (a.shape === 'sphere') {
        ctx.beginPath();
        ctx.arc(ox, oy, rad, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
      } else {
        ctx.fillRect(ox - rad, oy - rad, rad * 2, rad * 2);
        ctx.strokeRect(ox - rad, oy - rad, rad * 2, rad * 2);
      }
      } else if (a.shape === 'cone') {
      const ang = a.angle != null ? a.angle : -Math.PI / 2;
      const spread = Math.PI / 3;
      ctx.beginPath();
      ctx.moveTo(ox, oy);
      ctx.arc(ox, oy, rad, ang - spread / 2, ang + spread / 2);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
      } else if (a.shape === 'line') {
      const ang = a.angle != null ? a.angle : 0;
      const ex = ox + Math.cos(ang) * rad;
      const ey = oy + Math.sin(ang) * rad;
      ctx.strokeStyle = 'rgba(100,180,255,0.9)';
      ctx.lineWidth = Math.max(6, ((Number(map.gridSize) || 70) * scale) * 0.2);
      ctx.beginPath();
      ctx.moveTo(ox, oy);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      }
    }


  }
  window.__drawMapOverlays = drawMapOverlays;

  function renderBattleMap() {
    const canvas = document.getElementById('map-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const map = getCombatMap();
    const status = document.getElementById('map-status');
    if (window.__mapRaf) { cancelAnimationFrame(window.__mapRaf); window.__mapRaf = null; }
    const videoEl = document.getElementById('map-video');
    const hasVideo = !!(map && map.mediaType === 'video' && map.videoObjectUrl);
    const hasImage = !!(map && map.imageDataUrl);
    if (!map || (!hasImage && !hasVideo)) {
      if (videoEl) {
        try { videoEl.pause(); videoEl.removeAttribute('src'); videoEl.load(); } catch (e) {}
        videoEl.style.display = 'none';
      }
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#1a1510';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#c4a35a';
      ctx.font = '16px sans-serif';
      ctx.fillText('Import an image, video (MP4/WebM), or UVTT file to begin.', 24, 40);
      if (status) status.textContent = 'No map loaded';
      try { renderMapRoster(); } catch (e) {}
      return;
    }

    // Live video map: draw frames to canvas under tokens/grid
    if (hasVideo && videoEl) {
      videoEl.style.display = 'none';
      const want = map.videoObjectUrl;
      if (videoEl.getAttribute('data-src') !== want) {
        videoEl.setAttribute('data-src', want);
        videoEl.src = want;
      }
      videoEl.muted = true;
      videoEl.loop = true;
      videoEl.playsInline = true;
      const startVideoDraw = () => {
        const srcW = videoEl.videoWidth || 1280;
        const srcH = videoEl.videoHeight || 720;
        if (!videoEl.videoWidth) {
          // still decoding
          window.__mapRaf = requestAnimationFrame(() => startVideoDraw());
          return;
        }
        map.width = srcW;
        map.height = srcH;
        const maxW = Math.min(1400, window.innerWidth - 100);
        const scale = Math.min(1, maxW / srcW);
        map.scale = scale;
        canvas.width = Math.floor(srcW * scale);
        canvas.height = Math.floor(srcH * scale);
        const tick = () => {
          const m = getCombatMap();
          if (!m || m.mediaType !== 'video') return;
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          try { ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height); } catch (e) {}
          try { window.__drawMapOverlays && window.__drawMapOverlays(ctx, canvas, m, m.scale || scale); } catch (e) {}
          window.__mapRaf = requestAnimationFrame(tick);
        };
        videoEl.play().catch((e) => {
          console.warn('video play', e);
          toast('Click the map once if video is paused (browser autoplay)');
        });
        tick();
        if (status) status.textContent = `Video ${srcW}×${srcH} · grid ${map.gridSize}px`;
        try { renderMapRoster(); } catch (e) {}
      };
      if (videoEl.readyState >= 2 && videoEl.videoWidth) startVideoDraw();
      else {
        videoEl.onloadeddata = startVideoDraw;
        videoEl.onerror = () => toast('Video failed to decode — try WebM or another MP4');
      }
      return;
    }

    if (videoEl) {
      try { videoEl.pause(); } catch (e) {}
      videoEl.style.display = 'none';
    }
    const img = new Image();
    img.onload = () => {
      map.width = img.width;
      map.height = img.height;
      const maxW = Math.min(1200, window.innerWidth - 80);
      const scale = Math.min(1, maxW / img.width);
      map.scale = scale;
      canvas.width = Math.floor(img.width * scale);
      canvas.height = Math.floor(img.height * scale);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const g = (Number(map.gridSize) || 70) * scale;
      const gox = (Number(map.gridOffsetX) || 0) * scale;
      const goy = (Number(map.gridOffsetY) || 0) * scale;
      if (g >= 8) {
        ctx.strokeStyle = 'rgba(196,163,90,0.28)';
        ctx.lineWidth = 1;
        let x0 = gox % g;
        if (x0 > 0) x0 -= g;
        for (let x = x0; x <= canvas.width + g; x += g) {
          ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
        }
        let y0 = goy % g;
        if (y0 > 0) y0 -= g;
        for (let y = y0; y <= canvas.height + g; y += g) {
          ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
        }
      }

      // walls
      if (map.walls && map.walls.length) {
        ctx.strokeStyle = 'rgba(255,80,80,0.55)';
        ctx.lineWidth = 2;
        map.walls.forEach(w => {
          ctx.beginPath();
          ctx.moveTo(w.x1 * scale, w.y1 * scale);
          ctx.lineTo(w.x2 * scale, w.y2 * scale);
          ctx.stroke();
        });
      }

      // tokens
      const c = getActive();
      const combat = c ? getCombat(c) : null;
      const list = (combat && combat.combatants) || [];
      const selectedId = combat && combat.selectedIndex != null && combat.combatants[combat.selectedIndex]
        ? String(combat.combatants[combat.selectedIndex].id || combat.selectedIndex)
        : (combat && combat.mapFocusId) || null;
      list.forEach((cb, idx) => {
        const id = String(cb.id || idx);
        const pos = map.tokens[id];
        if (!pos) return;
        const x = pos.x * scale, y = pos.y * scale;
        const r = Math.max(8, (Number(map.gridSize) || 70) * scale * 0.35);
        const side = String(cb.side || '').toLowerCase();
        const isEnemy = side === 'enemy' || side === 'villain' || side === 'enemies';
        const isAlly = side === 'ally' || side === 'allies';
        let fill = isEnemy ? 'rgba(180,40,40,0.9)' : (isAlly ? 'rgba(50,100,180,0.9)' : 'rgba(40,120,80,0.9)');
        const hp = Number(cb.hp) || 0;
        const hpMax = Math.max(1, Number(cb.hpMax) || 1);
        const ratio = Math.max(0, Math.min(1, hp / hpMax));
        if (hp <= 0) fill = 'rgba(60,60,60,0.85)';
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = fill;
        ctx.fill();
        // HP arc (hidden when hideHp)
        if (!cb.hideHp && hp > 0) {
          ctx.beginPath();
          ctx.strokeStyle = ratio > 0.5 ? '#5dba6a' : (ratio > 0.25 ? '#d4a017' : '#c44');
          ctx.lineWidth = 3;
          ctx.arc(x, y, r + 2, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ratio);
          ctx.stroke();
        }
        ctx.strokeStyle = String(id) === String(selectedId) ? '#ffd24a' : '#e8dcc8';
        ctx.lineWidth = String(id) === String(selectedId) ? 3 : 2;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText((cb.name || '?').slice(0, 10), x, y + r + 12);
        if (!cb.hideHp) {
          ctx.fillStyle = '#c4a35a';
          ctx.font = '10px sans-serif';
          ctx.fillText(hp + '/' + hpMax, x, y + 3);
        }
        // still draw HP arc only if not hidden
      });

      // AoE
      if (map.aoe) {
        const a = map.aoe;
        const ox = a.x * scale, oy = a.y * scale;
        const ft = a.ft || 20;
        const pxPerFt = ((Number(map.gridSize) || 70) * scale) / 5; // 5 ft square
        const rad = (ft) * pxPerFt;
        ctx.fillStyle = 'rgba(100,160,255,0.25)';
        ctx.strokeStyle = 'rgba(100,180,255,0.9)';
        ctx.lineWidth = 2;
        if (a.shape === 'sphere' || a.shape === 'cube') {
          if (a.shape === 'sphere') {
            ctx.beginPath();
            ctx.arc(ox, oy, rad, 0, Math.PI * 2);
            ctx.fill(); ctx.stroke();
          } else {
            ctx.fillRect(ox - rad, oy - rad, rad * 2, rad * 2);
            ctx.strokeRect(ox - rad, oy - rad, rad * 2, rad * 2);
          }
        } else if (a.shape === 'cone') {
          const ang = a.angle != null ? a.angle : -Math.PI / 2;
          const spread = Math.PI / 3;
          ctx.beginPath();
          ctx.moveTo(ox, oy);
          ctx.arc(ox, oy, rad, ang - spread / 2, ang + spread / 2);
          ctx.closePath();
          ctx.fill(); ctx.stroke();
        } else if (a.shape === 'line') {
          const ang = a.angle != null ? a.angle : 0;
          const ex = ox + Math.cos(ang) * rad;
          const ey = oy + Math.sin(ang) * rad;
          ctx.strokeStyle = 'rgba(100,180,255,0.9)';
          ctx.lineWidth = Math.max(6, ((Number(map.gridSize) || 70) * scale) * 0.2);
          ctx.beginPath();
          ctx.moveTo(ox, oy);
          ctx.lineTo(ex, ey);
          ctx.stroke();
        }
      }

      if (status) {
        status.textContent = `${img.width}×${img.height}px · grid ${map.gridSize}px · offset ${map.gridOffsetX||0},${map.gridOffsetY||0} · ${map.walls.length} walls · ${Object.keys(map.tokens||{}).length} tokens`;
      }
      try { renderMapRoster(); } catch (e) {}
    };
    img.onerror = () => {
      if (status) status.textContent = 'Failed to load map image';
    };
    img.src = map.imageDataUrl;
    try { renderMapRoster(); } catch (e) {}
  }

  function mapCanvasToWorld(canvas, clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const map = getCombatMap();
    const scale = map.scale || 1;
    const x = (clientX - rect.left) * (canvas.width / rect.width) / scale;
    const y = (clientY - rect.top) * (canvas.height / rect.height) / scale;
    return { x, y };
  }

  function segmentIntersects(ax, ay, bx, by, cx, cy, dx, dy) {
    function cross(x1,y1,x2,y2) { return x1*y2 - y1*x2; }
    const d1 = cross(bx-ax, by-ay, cx-ax, cy-ay);
    const d2 = cross(bx-ax, by-ay, dx-ax, dy-ay);
    const d3 = cross(dx-cx, dy-cy, ax-cx, ay-cy);
    const d4 = cross(dx-cx, dy-cy, bx-cx, by-cy);
    return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
  }
  function lineBlockedByWalls(map, x1, y1, x2, y2) {
    const walls = map.walls || [];
    for (let i = 0; i < walls.length; i++) {
      const w = walls[i];
      if (w.door) continue; // open doors don't block v1
      if (segmentIntersects(x1, y1, x2, y2, w.x1, w.y1, w.x2, w.y2)) return true;
    }
    return false;
  }
  function tokenIdsInAoe(map) {
    if (!map.aoe) return [];
    const a = map.aoe;
    const ft = a.ft || 20;
    const g = Number(map.gridSize) || 70;
    const pxPerFt = g / 5;
    const rad = ft * pxPerFt;
    const hits = [];
    Object.keys(map.tokens).forEach(id => {
      const p = map.tokens[id];
      const dx = p.x - a.x, dy = p.y - a.y;
      const dist = Math.hypot(dx, dy);
      let inside = false;
      if (a.shape === 'sphere') inside = dist <= rad;
      else if (a.shape === 'cube') inside = Math.abs(dx) <= rad && Math.abs(dy) <= rad;
      else if (a.shape === 'cone') {
        const ang = a.angle != null ? a.angle : -Math.PI / 2;
        const bearing = Math.atan2(dy, dx);
        let d = Math.abs(bearing - ang);
        while (d > Math.PI) d = Math.abs(d - 2 * Math.PI);
        inside = dist <= rad && d <= Math.PI / 6;
      } else if (a.shape === 'line') {
        const ang = a.angle != null ? a.angle : 0;
        const ex = a.x + Math.cos(ang) * rad, ey = a.y + Math.sin(ang) * rad;
        // distance to segment
        const t = Math.max(0, Math.min(1, ((p.x - a.x) * (ex - a.x) + (p.y - a.y) * (ey - a.y)) / (rad * rad || 1)));
        const projx = a.x + t * (ex - a.x), projy = a.y + t * (ey - a.y);
        const width = g * 0.35;
        inside = Math.hypot(p.x - projx, p.y - projy) <= width;
      }
      if (inside && map.walls && map.walls.length) {
        if (lineBlockedByWalls(map, a.x, a.y, p.x, p.y)) inside = false;
      }
      if (inside) hits.push(id);
    });
    return hits;
  }

  function initBattleMapUi() {
    // Always ensure workspace exists
    try { ensureCombatWorkspace(); } catch (e) {}
    if (window.__mapUiReady) {
      refreshMapTokenSelect();
      return;
    }
    window.__mapUiReady = true;

    function triggerImageImport() {
      const inp = document.getElementById('map-file-image');
      if (!inp) { toast('Map file input missing — hard refresh'); return; }
      inp.click();
    }
    function triggerUvttImport() {
      const inp = document.getElementById('map-file-uvtt');
      if (!inp) { toast('UVTT file input missing — hard refresh'); return; }
      inp.click();
    }

    // Labels use for="map-file-*" — native open. Also allow programmatic click.
    document.getElementById('map-import-image-btn')?.addEventListener('click', (e) => {
      if (e.target && e.target.tagName === 'LABEL') return; // native for=
      triggerImageImport();
    });
    document.getElementById('map-import-uvtt-btn')?.addEventListener('click', (e) => {
      if (e.target && e.target.tagName === 'LABEL') return;
      triggerUvttImport();
    });

    document.getElementById('map-popout-btn')?.addEventListener('click', () => openMapPopout());
    document.getElementById('map-clear-btn')?.addEventListener('click', () => {
      const map = getCombatMap();
      if (!map) return;
      map.imageDataUrl = null;
      if (map.videoObjectUrl && String(map.videoObjectUrl).startsWith('blob:')) {
        try { URL.revokeObjectURL(map.videoObjectUrl); } catch (e) {}
      }
      map.videoObjectUrl = null;
      map.mediaType = null;
      map.walls = [];
      map.tokens = {};
      map.aoe = null;
      try { save(); } catch (err) {}
      renderBattleMap();
    });
    document.getElementById('map-grid-size')?.addEventListener('change', (e) => {
      const map = getCombatMap();
      if (!map) return;
      map.gridSize = Number(e.target.value) || 70;
      try { save(); } catch (err) {}
      renderBattleMap();
    });

    document.getElementById('map-grid-ox')?.addEventListener('change', (e) => {
      const map = getCombatMap();
      if (!map) return;
      map.gridOffsetX = Number(e.target.value) || 0;
      snapAllMapTokens(map);
      try { save(); } catch (err) {}
      renderBattleMap();
    });
    document.getElementById('map-grid-oy')?.addEventListener('change', (e) => {
      const map = getCombatMap();
      if (!map) return;
      map.gridOffsetY = Number(e.target.value) || 0;
      snapAllMapTokens(map);
      try { save(); } catch (err) {}
      renderBattleMap();
    });

    document.getElementById('map-grid-adjust-toggle')?.addEventListener('click', () => {
      const tool = document.getElementById('map-tool');
      const btn = document.getElementById('map-grid-adjust-toggle');
      if (!tool) return;
      if (tool.value === 'grid-offset') {
        tool.value = 'token';
        if (btn) btn.classList.remove('primary');
        toast('Grid adjust off');
      } else {
        tool.value = 'grid-offset';
        if (btn) btn.classList.add('primary');
        toast('Grid adjust on — drag the map to move the grid');
      }
    });
    document.getElementById('map-tool')?.addEventListener('change', () => {
      const tool = document.getElementById('map-tool');
      const btn = document.getElementById('map-grid-adjust-toggle');
      if (btn) btn.classList.toggle('primary', tool && tool.value === 'grid-offset');
    });

    document.getElementById('map-snap-all')?.addEventListener('click', () => {
      const map = getCombatMap();
      if (!map) return;
      snapAllMapTokens(map);
      try { save(); } catch (err) {}
      renderBattleMap();
      toast('All tokens snapped to grid centers');
    });
    // sync offset fields from map
    try {
      const map = getCombatMap();
      if (map) {
        const ox = document.getElementById('map-grid-ox');
        const oy = document.getElementById('map-grid-oy');
        if (ox) ox.value = String(map.gridOffsetX || 0);
        if (oy) oy.value = String(map.gridOffsetY || 0);
        const gs = document.getElementById('map-grid-size');
        if (gs && map.gridSize) gs.value = String(map.gridSize);
      }
    } catch (e) {}

    document.getElementById('map-clear-aoe')?.addEventListener('click', () => {
      const map = getCombatMap();
      if (!map) return;
      map.aoe = null;
      try { save(); } catch (err) {}
      renderBattleMap();
    });
    document.getElementById('map-apply-aoe-targets')?.addEventListener('click', () => {
      const map = getCombatMap();
      if (!map || !map.aoe) { toast('Draw an AoE first'); return; }
      const ids = tokenIdsInAoe(map);
      const c = getActive();
      const combat = c ? getCombat(c) : null;
      if (!combat) return;
      // Select matching combatants in combat list / store for roller
      combat.aoeTargetIds = ids;
      const names = [];
      combat.combatants.forEach((cb, i) => {
        const id = cb.id || String(i);
        if (ids.includes(id)) names.push(cb.name);
      });
      try { save(); } catch (err) {}
      toast(names.length ? ('AoE targets: ' + names.join(', ')) : 'No tokens in AoE');
      try {
        if (typeof setView === 'function') setView('combat');
        else document.querySelector('.nav-item[data-view="combat"]')?.click();
        setTimeout(() => { try { applyAoeTargetsToRoller(); } catch (e) {} }, 100);
      } catch (e) {}
    });


    if (!window.__mapFileChangeBound) {
      window.__mapFileChangeBound = true;
      document.addEventListener('change', async (e) => {
        const el = e.target;
        if (!el || !el.id) return;
        if (el.id === 'map-file-image') {
          const f = el.files && el.files[0];
          if (!f) return;
          const reader = new FileReader();
          reader.onload = () => {
            try { ensureCombatWorkspace(); } catch (err) {}
            const map = getCombatMap();
            if (!map) { toast('No workspace — open Combat once first'); return; }
            map.imageDataUrl = reader.result;
            map.tokens = map.tokens || {};
            map.walls = map.walls || [];
            map.aoe = null;
            const gs = document.getElementById('map-grid-size');
            if (gs) map.gridSize = Number(gs.value) || 70;
            try { save(); } catch (err) { console.warn(err); }
            renderBattleMap();
            toast('Map image loaded');
          };
          reader.onerror = () => toast('Failed to read image');
          reader.readAsDataURL(f);
          el.value = '';
        }
        if (el.id === 'map-file-uvtt') {
          const f = el.files && el.files[0];
          if (!f) return;
          try {
            const text = await f.text();
            const parsed = parseUvttFile(text);
            try { ensureCombatWorkspace(); } catch (err) {}
            const map = getCombatMap();
            if (!map) { toast('No workspace — open Combat once first'); return; }
            if (parsed.imageDataUrl) map.imageDataUrl = parsed.imageDataUrl;
            else toast('UVTT has no image — import image separately');
            map.gridSize = parsed.gridSize || 70;
            map.walls = parsed.walls || [];
            map.tokens = map.tokens || {};
            map.aoe = null;
            const gs = document.getElementById('map-grid-size');
            if (gs) gs.value = String(map.gridSize);
            try { save(); } catch (err) { console.warn(err); }
            renderBattleMap();
            toast('UVTT imported (' + (map.walls.length||0) + ' walls)');
          } catch (err) {
            console.warn(err);
            toast('Could not parse UVTT: ' + (err.message || err));
          }
          el.value = '';

        if (el.id === 'map-file-video') {
          const f = el.files && el.files[0];
          if (!f) return;
          try {
            ensureCombatWorkspace();
            const map = getCombatMap();
            if (!map) { toast('No workspace'); return; }
            const c = getActive();
            const buf = await f.arrayBuffer();
            const blob = new Blob([buf], { type: f.type || 'video/mp4' });
            await idbSetMapVideo(c.id, blob);
            if (map.videoObjectUrl && String(map.videoObjectUrl).startsWith('blob:')) {
              try { URL.revokeObjectURL(map.videoObjectUrl); } catch (e) {}
            }
            map.videoObjectUrl = URL.createObjectURL(blob);
            map.mediaType = 'video';
            map.hasVideoInIdb = true;
            map.imageDataUrl = null; // prefer video
            map.aoe = null;
            try { save(); } catch (e) {}
            renderBattleMap();
            toast('Video map loaded (loops muted)');
          } catch (err) {
            console.warn(err);
            toast('Could not load video');
          }
          el.value = '';
        }
        }
      });
    }

    const canvas = document.getElementById('map-canvas');
    if (canvas && !canvas.dataset.mapBound) {
      canvas.dataset.mapBound = '1';
      let dragId = null;
      canvas.addEventListener('mousedown', (ev) => {
        if (ev.button !== 0) return;
        const map = getCombatMap();
        if (!map || (!map.imageDataUrl && !(map.mediaType === 'video' && map.videoObjectUrl))) return;
        const tool = document.getElementById('map-tool')?.value || 'token';
        const { x, y } = mapCanvasToWorld(canvas, ev.clientX, ev.clientY);
        if (tool === 'grid-offset') {
          window.__gridDrag = {
            startX: x, startY: y,
            ox: Number(map.gridOffsetX) || 0,
            oy: Number(map.gridOffsetY) || 0
          };
          return;
        }
        if (tool === 'token' || tool === 'pan') {
          // hit-test existing token
          const g = Number(map.gridSize) || 70;
          const hitR = g * 0.45;
          let found = null;
          Object.keys(map.tokens || {}).forEach(id => {
            const p = map.tokens[id];
            if (Math.hypot(p.x - x, p.y - y) <= hitR) found = id;
          });
          if (found) {
            dragId = found;
            const sel = document.getElementById('map-token-combatant');
            if (sel) sel.value = found;
            try { selectCombatantById(found); } catch (e) {}
            // double-purpose: select in tracker; drag to move if token tool
            if (tool === 'pan') {
              dragId = null;
              toast('Selected ' + (listNameForToken(found) || found));
            }
            return;
          }
        }
        if (tool === 'token') {
          const sel = document.getElementById('map-token-combatant');
          const id = sel && sel.value;
          if (!id) { toast('Pick a combatant'); return; }
          map.tokens[id] = snapWorldToGrid(map, x, y);
          try { save(); } catch (err) {}
          renderBattleMap();
        } else if (tool.startsWith('aoe-')) {
          const shape = tool.replace('aoe-', '');
          const ft = Number(document.getElementById('map-aoe-ft')?.value) || 20;
          map.aoe = { shape: shape === 'sphere' ? 'sphere' : shape, x, y, ft, angle: -Math.PI / 2 };
          try { save(); } catch (err) {}
          renderBattleMap();
        }
      });
      canvas.addEventListener('mousemove', (ev) => {
        const map = getCombatMap();
        if (!map) return;
        const { x, y } = mapCanvasToWorld(canvas, ev.clientX, ev.clientY);
        if (window.__gridDrag) {
          const d = window.__gridDrag;
          map.gridOffsetX = d.ox + (x - d.startX);
          map.gridOffsetY = d.oy + (y - d.startY);
          const ox = document.getElementById('map-grid-ox');
          const oy = document.getElementById('map-grid-oy');
          if (ox) ox.value = String(Math.round(map.gridOffsetX));
          if (oy) oy.value = String(Math.round(map.gridOffsetY));
          // Only redraw overlays if video (avoid restarting stream every move)
          if (map.mediaType === 'video' && window.__mapRaf) {
            // next video frame will pick up offset via drawMapOverlays
          } else {
            renderBattleMap();
          }
          return;
        }
        if (!dragId) return;
        map.tokens[dragId] = snapWorldToGrid(map, x, y);
        renderBattleMap();
      });
      canvas.addEventListener('mouseup', () => {
        if (window.__gridDrag) {
          window.__gridDrag = null;
          const map2 = getCombatMap();
          if (map2) snapAllMapTokens(map2);
          try { save(); } catch (err) {}
          renderBattleMap();
          toast('Grid offset updated — tokens re-centered');
        }
        if (dragId) {
          try { save(); } catch (err) {}
          dragId = null;
        }
      });
      canvas.addEventListener('mouseleave', () => { dragId = null; });
      canvas.addEventListener('contextmenu', (ev) => {
        ev.preventDefault();
        const map = getCombatMap();
        if (!map || !map.aoe) return;
        const { x, y } = mapCanvasToWorld(canvas, ev.clientX, ev.clientY);
        map.aoe.angle = Math.atan2(y - map.aoe.y, x - map.aoe.x);
        try { save(); } catch (err) {}
        renderBattleMap();
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

  try { window.importCompendiumPack = importCompendiumPack; } catch (e) {}
