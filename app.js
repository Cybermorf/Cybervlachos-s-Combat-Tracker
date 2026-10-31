/**
 * Dark Sun Chronicles — DM Companion
 * Local-first campaign tracker + dice roller for Eldoria living campaigns.
 * Includes random generators for Factions, Active Forces, and Dynamic Influence progression.
 * Data persists in localStorage. Export/import as JSON.
 */

(() => {
  'use strict';

  const STORAGE_KEY = 'cybervlachos_combat_v1';

  // Token image API on window (always available to file-input handlers)
  window.__tokenImgCache = window.__tokenImgCache || {};
  window.loadTokenImageStore = function loadTokenImageStore() {
    try { return JSON.parse(localStorage.getItem('cybervlachos_token_images_v1') || '{}') || {}; } catch (e) { return {}; }
  };
  window.saveTokenImageStore = function saveTokenImageStore(store) {
    try { localStorage.setItem('cybervlachos_token_images_v1', JSON.stringify(store)); return true; } catch (e) { return false; }
  };
  window.tokenImageKey = function tokenImageKey(cb) {
    return String(cb && (cb.id != null ? cb.id : cb.name) || '');
  };
  window.getTokenImageForCombatant = function getTokenImageForCombatant(cb) {
    if (!cb) return null;
    let src = cb.tokenImage || cb.tokenImg || cb.avatar || cb.portrait || '';
    if (!src) {
      try {
        const store = window.loadTokenImageStore();
        const k = window.tokenImageKey(cb);
        if (k && store[k]) { src = store[k]; cb.tokenImage = src; }
      } catch (e) {}
    }
    if (!src || typeof src !== 'string') return null;
    const cache = window.__tokenImgCache;
    if (cache[src] === false) return null;
    if (cache[src] && cache[src].complete) return cache[src];
    if (!cache[src]) {
      const img = new Image();
      img.onload = () => { try { if (typeof renderBattleMap === 'function') renderBattleMap(); if (typeof paintMapFrame === 'function') paintMapFrame(); } catch (e) {} };
      img.onerror = () => { cache[src] = false; };
      img.src = src;
      cache[src] = img;
    }
    return cache[src].complete ? cache[src] : null;
  };
  window.setTokenImageFromFile = async function setTokenImageFromFile(file, cb) {
    if (!file || !cb) return;
    if (!/^image\//i.test(file.type || '')) {
      if (typeof toast === 'function') toast('Choose an image file (png, jpg, webp, …)');
      return;
    }
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    if (String(dataUrl).length > 1.8e6) {
      if (typeof toast === 'function') toast('Image too large — try a smaller token (under ~1MB)');
      return;
    }
    cb.tokenImage = dataUrl;
    try {
      const store = window.loadTokenImageStore();
      store[window.tokenImageKey(cb)] = dataUrl;
      window.saveTokenImageStore(store);
    } catch (e) {}
    try { if (typeof save === 'function') save(); } catch (e) {}
    try {
      delete window.__tokenImgCache[dataUrl];
      window.getTokenImageForCombatant(cb);
    } catch (e) {}
    try { if (typeof paintMapFrame === 'function') paintMapFrame(); } catch (e) {}
    try { if (typeof renderBattleMap === 'function') renderBattleMap(); } catch (e) {}
    try { if (typeof renderCombat === 'function') renderCombat(); } catch (e) {}
    if (typeof toast === 'function') toast('Token image set for ' + (cb.name || 'combatant'));
  };
  window.clearTokenImage = function clearTokenImage(cb) {
    if (!cb) return;
    const k = window.tokenImageKey(cb);
    delete cb.tokenImage;
    delete cb.tokenImg;
    try {
      const store = window.loadTokenImageStore();
      if (k && store[k]) { delete store[k]; window.saveTokenImageStore(store); }
    } catch (e) {}
    try { if (typeof save === 'function') save(); } catch (e) {}
    try { if (typeof paintMapFrame === 'function') paintMapFrame(); } catch (e) {}
    try { if (typeof renderBattleMap === 'function') renderBattleMap(); } catch (e) {}
    if (typeof toast === 'function') toast('Token image cleared');
  };



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
    if (!workspaceId) return;
    try {
      const db = await openMapDb();
      await new Promise((resolve, reject) => {
        const tx = db.transaction(MAP_IDB_STORE, 'readwrite');
        const store = tx.objectStore(MAP_IDB_STORE);
        if (blob) store.put(blob, 'mapvideo:' + workspaceId);
        else store.delete('mapvideo:' + workspaceId);
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
    // Player (including player+mapPopout): persist combat mutations + sync to DM
    try {
      if (typeof isPlayerRole === 'function' && isPlayerRole()) {
        try { playerPersistAndSyncCombat(); } catch (e) { console.warn('playerPersist', e); }
        return;
      }
    } catch (e) {}
    // Map pop-out (DM share window): persist map tokens/fog so drag/place works on video maps
    try {
      if (typeof isMapPopoutMode === 'function' && isMapPopoutMode()) {
        try {
          const payload = typeof cloneStateForLocalStorage === 'function'
            ? cloneStateForLocalStorage()
            : { campaigns: state.campaigns, activeCampaignId: state.activeCampaignId };
          localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
        } catch (e) { console.warn('popout save', e); }
        try { if (typeof broadcastTokenPositions === 'function') broadcastTokenPositions('popout-map'); } catch (e) {}
        try { if (typeof broadcastVttState === 'function') broadcastVttState('popout-map'); } catch (e) {}
        try { if (typeof notifyMapWindows === 'function') setTimeout(notifyMapWindows, 0); } catch (e) {}
        return;
      }
    } catch (e) {}

    try { if (typeof notifyMapWindows === "function") setTimeout(notifyMapWindows, 0); } catch (e) {}
    try { if (typeof broadcastVttState === "function") setTimeout(function(){ broadcastVttState("save"); }, 0); } catch (e) {}

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
    const camps = state.campaigns || [];
    let c = camps.find(x => x.id === state.activeCampaignId) || null;
    if (!c && camps.length) {
      c = camps[0];
      state.activeCampaignId = c.id;
    }
    if (!c && document.body && document.body.dataset && document.body.dataset.app === 'combat-tracker') {
      // Never invent a blank workspace from a map pop-out
      if (!(typeof isMapPopoutMode === 'function' && isMapPopoutMode())) {
        c = ensureCombatWorkspace();
      }
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
        var addedCombat = 0;
        var addToCombat = (window._rosterImportAddToCombat !== false);
        if (addToCombat && typeof combatantFromChar === 'function') {
          try {
            var combat = getCombat(c);
            if (!combat.combatants) combat.combatants = [];
            var existingIds = new Set((combat.combatants || []).map(function(cb) { return String(cb.charId || cb.sourceId || ''); }));
            var existingNames = new Set((combat.combatants || []).map(function(cb) { return String(cb.name || '').toLowerCase(); }));
            function upsertSide(list, side) {
              (list || []).forEach(function(ch) {
                if (!ch || !ch.name) return;
                var cid = String(ch.characterId || ch.id || '');
                var nm = String(ch.name || '').toLowerCase();
                if (cid && existingIds.has(cid)) return;
                if (nm && existingNames.has(nm)) return;
                try {
                  var row = combatantFromChar(ch, side);
                  if (row && row.name) {
                    combat.combatants.push(row);
                    if (cid) existingIds.add(cid);
                    if (nm) existingNames.add(nm);
                    addedCombat++;
                  }
                } catch (err) { console.warn('add to combat', err); }
              });
            }
            upsertSide(party, 'party');
            upsertSide(villains, 'enemy');
            if (combat.selectedIndex == null || combat.selectedIndex < 0) combat.selectedIndex = 0;
          } catch (err) { console.warn('roster add-to-combat', err); }
        }
        save();
        var msg = 'Roster imported: ' + party.length + ' party, ' + villains.length + ' villains';
        if (addToCombat) msg += (addedCombat ? (' · ' + addedCombat + ' added to combat') : ' · combat unchanged');
        toast(msg);
        try { if (typeof renderParty === 'function' && $('#view-party')?.classList.contains('active')) renderParty(); } catch (e) {}
        try { if (typeof setView === 'function' && addToCombat && addedCombat) setView('combat'); } catch (e) {}
        try { if (typeof renderCombat === 'function') renderCombat(); } catch (e) {}
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
        if (typeof bindTokenImageControls === 'function') bindTokenImageControls();
        if (typeof bindMapCanvasInteractions === 'function') bindMapCanvasInteractions(false);
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
    // Explicit sheet / roster value wins when higher (e.g. Garrick attacksMax: 3)
    const sheetMax = Number(ch.attacksMax != null ? ch.attacksMax : ch.extraAttacks != null ? (Number(ch.extraAttacks) + 1) : 0) || 0;
    if (sheetMax > 0) n = Math.max(n, sheetMax);
    // Eldritch Knight / Spellblade named as subclass of fighter-style
    if (sub.indexOf('eldritch knight') !== -1 || sub.indexOf('spellblade') !== -1 || sub.indexOf('echo knight') !== -1) {
      const ftr = list.find(function(c) { return /fighter/i.test(String(c.name || '')); });
      const fl = ftr ? (Number(ftr.level) || 0) : totalLvl;
      if (fl >= 20) n = Math.max(n, 4);
      else if (fl >= 11) n = Math.max(n, 3);
      else if (fl >= 5) n = Math.max(n, 2);
    }
    return Math.max(1, n);
  }


  /** Base actions per turn: 1 + Haste + extraActionsGranted (Action Surge, etc.). */
  function actionsMaxForCombatant(cb, ch) {
    let n = 1;
    try {
      const conds = [];
      if (cb) {
        if (Array.isArray(cb.conditionList)) {
          cb.conditionList.forEach(c => conds.push(String(c.name || c || '').toLowerCase()));
        }
        String(cb.conditions || '').split(/[,;]/).forEach(s => { if (s.trim()) conds.push(s.trim().toLowerCase()); });
      }
      if (conds.some(c => c.includes('haste'))) n += 1;
    } catch (e) {}
    n += Math.max(0, Number(cb && cb.extraActionsGranted) || 0);
    if (n < 1) n = 1;
    return n;
  }

  function actionsRemaining(cb) {
    if (!cb) return 0;
    const max = Number(cb.actionsMax) || 1;
    const used = Number(cb.actionsUsed) || 0;
    return Math.max(0, max - used);
  }

  /** Spend one Action (Attack, Cast, Dash, …). */
  
  /**
   * Linked economy: Cast OR Attack both spend 1 Action and reduce weapon-attack budget.
   * After a Cast, weapon attacks are exhausted for the turn so you cannot also Attack.
   * After an Attack action starts, Actions is spent so you cannot also Cast (unless Haste/Surge).
   */
  
  function combatRoundKey() {
    try {
      const combat = getCombat(getActive());
      return String((combat && (combat.round != null ? combat.round : combat.turnIndex)) || 0);
    } catch (e) { return '0'; }
  }
  function attackLockKey(cb) {
    const id = String(cb && (cb.id != null ? cb.id : cb.name) || '');
    return id + '@' + combatRoundKey();
  }
  function sessionAttackKey(cb) {
    return 'cyber_atk_' + attackLockKey(cb);
  }
  function getSessionAttacksUsed(cb) {
    try { return Number(sessionStorage.getItem(sessionAttackKey(cb)) || 0) || 0; } catch (e) { return 0; }
  }
  function bumpSessionAttacksUsed(cb) {
    const n = getSessionAttacksUsed(cb) + 1;
    try { sessionStorage.setItem(sessionAttackKey(cb), String(n)); } catch (e) {}
    return n;
  }
  function clearSessionAttacksUsed(cb) {
    try { sessionStorage.removeItem(sessionAttackKey(cb)); } catch (e) {}
  }
  
  function refreshTurnEconomyUI(cb) {
    if (!cb) return;
    try {
      let atkMax = Math.max(1, Number(cb.attacksMax) || 1);
      const sess = typeof getSessionAttacksUsed === 'function' ? getSessionAttacksUsed(cb) : 0;
      let mirrorUsed = 0, mirrorAct = 0;
      try {
        const mir = JSON.parse(sessionStorage.getItem('cyber_econ_' + String(cb.id || cb.name || '')) || 'null');
        if (mir) {
          mirrorUsed = Number(mir.attacksUsed) || 0;
          mirrorAct = Number(mir.actionsUsed) || 0;
          if (mir.attacksMax) atkMax = Math.max(atkMax, Number(mir.attacksMax) || 1);
        }
      } catch (e) {}
      const atkUsed = Math.max(Number(cb.attacksUsed) || 0, sess, mirrorUsed);
      cb.attacksUsed = atkUsed;
      const atkLeft = Math.max(0, atkMax - atkUsed);
      let actMax = Math.max(1, Number(cb.actionsMax) || 1);
      let actUsed = Math.max(Number(cb.actionsUsed) || 0, mirrorAct || 0);
      if (atkUsed > 0 && actUsed < 1) {
        actUsed = 1;
        cb.actionsUsed = 1;
        cb.actionUsed = true;
      }
      cb.actionsUsed = actUsed;
      const actLeft = Math.max(0, actMax - actUsed);

      function patchVal(root, predicate, html) {
        if (!root) return;
        root.querySelectorAll('.turn-stage-sub').forEach(function(sub) {
          const head = sub.querySelector('.turn-stage-sub-head');
          if (!head || !predicate(head.textContent || '')) return;
          const val = sub.querySelector('.combat-res-val');
          if (val) val.innerHTML = html;
        });
      }

      const roots = [document];
      try {
        document.querySelectorAll('[data-player-detail], .player-combat-body, #combat-detail, .combat-turn-board').forEach(function(el) {
          roots.push(el);
        });
      } catch (e) {}

      const atkHtml = '<strong>' + atkLeft + '</strong> / ' + atkMax;
      const actHtml = '<strong>' + actLeft + '</strong> left of ' + actMax + (actUsed ? ' · used ' + actUsed : '');

      roots.forEach(function(root) {
        try {
          patchVal(root, function(tx) { return /Weapon attacks/i.test(tx); }, atkHtml);
          patchVal(root, function(tx) { return /Actions budget/i.test(tx); }, actHtml);
          root.querySelectorAll('#cd-weapon-atk-val, [data-econ-val="weapon-attacks"]').forEach(function(el) {
            el.innerHTML = atkHtml;
          });
          root.querySelectorAll('#cd-actions-val, [data-econ-val="actions"]').forEach(function(el) {
            el.innerHTML = actHtml;
          });
          root.querySelectorAll('.turn-stage[data-stage="action"] .stage-badge').forEach(function(badge) {
            if (actLeft <= 0) {
              badge.textContent = 'Used';
              badge.classList.remove('open');
              badge.classList.add('used');
            } else if (actUsed > 0) {
              badge.textContent = actLeft + ' left';
              badge.classList.add('open');
              badge.classList.remove('used');
            } else {
              badge.textContent = 'Available';
              badge.classList.add('open');
              badge.classList.remove('used');
            }
          });
        } catch (e) {}
      });

      try { if (typeof applyRollAttackButtonState === 'function') applyRollAttackButtonState(document, cb); } catch (e) {}
      try { console.debug('[econ]', cb.name, 'atk', atkUsed + '/' + atkMax, 'act', actUsed + '/' + actMax, 'sess', sess); } catch (e) {}
    } catch (e) { console.warn('refreshTurnEconomyUI', e); }
  }

  function remainingWeaponAttacks(cb) {
    if (!cb) return 0;
    try { if (typeof restoreTurnEconomy === 'function') restoreTurnEconomy(cb); } catch (e) {}
    const atkMax = Math.max(1, Number(cb.attacksMax) || 1);
    const sess = typeof getSessionAttacksUsed === 'function' ? getSessionAttacksUsed(cb) : 0;
    const atkUsed = Math.max(Number(cb.attacksUsed) || 0, sess);
    cb.attacksUsed = atkUsed;
    const actMax = Math.max(1, Number(cb.actionsMax) || 1);
    let actUsed = Number(cb.actionsUsed) || 0;
    // Session is authoritative for this browser tab (player popup)
    if (sess >= atkMax) {
      cb.attacksUsed = Math.max(atkUsed, atkMax);
      if (actUsed < 1) { cb.actionsUsed = 1; actUsed = 1; }
      return 0;
    }
    if (atkUsed > 0 && actUsed < 1) {
      actUsed = 1;
      cb.actionsUsed = Math.max(actUsed, Number(cb.actionsUsed) || 0);
    }
    if (actUsed >= actMax && atkUsed >= atkMax) return 0;
    if (actUsed >= actMax && atkUsed > 0) return Math.max(0, atkMax - atkUsed);
    if (actUsed >= actMax && sess > 0) return 0;
    if (actUsed >= actMax) return 0;
    return Math.max(0, atkMax - atkUsed);
  }
  function canRollWeaponAttack(cb) {
    return remainingWeaponAttacks(cb) > 0;
  }
  function applyRollAttackButtonState(panel, cb) {
    if (!panel || !cb) return;
    const btn = panel.querySelector('#cr-roll-btn');
    if (!btn) return;
    const left = remainingWeaponAttacks(cb);
    // Keep enabled so click can show a toast (disabled buttons do not fire click)
    btn.disabled = false;
    btn.removeAttribute('disabled');
    if (left <= 0) {
      btn.title = 'No weapon attacks left this turn';
      btn.classList.add('is-budget-locked');
      btn.dataset.budgetLocked = '1';
    } else {
      btn.title = left + ' attack(s) left this turn';
      btn.classList.remove('is-budget-locked');
      btn.dataset.budgetLocked = '0';
    }
  }


  function spendMainCombatAction(cb, kind, label) {
    if (!cb) return false;
    if (cb.actionsMax == null || !(Number(cb.actionsMax) > 0)) cb.actionsMax = 1;
    if (cb.actionsUsed == null) cb.actionsUsed = 0;
    if (cb.attacksMax == null) cb.attacksMax = 1;
    if (cb.attacksUsed == null) cb.attacksUsed = 0;
    const actMax = Number(cb.actionsMax) || 1;
    const actUsed = Number(cb.actionsUsed) || 0;
    const atkMax = Number(cb.attacksMax) || 1;
    const atkUsed = Number(cb.attacksUsed) || 0;

    if (kind === 'cast') {
      if (actUsed >= actMax) {
        toast('No actions left — cannot cast');
        return false;
      }
      cb.actionsUsed = actUsed + 1;
      cb.actionUsed = cb.actionsUsed >= actMax;
      // Casting uses the Action: no weapon Attack action this turn
      cb.attacksUsed = atkMax;
      cb.lastAction = label || 'Cast';
      try { if (typeof persistTurnEconomy === 'function') persistTurnEconomy(cb); } catch (e) {}
      return true;
    }

    if (kind === 'attack') {
      // Continue Extra Attack series (action already paid this Attack action)
      if (atkUsed > 0 && atkUsed < atkMax) {
        cb.attacksUsed = atkUsed + 1;
        try { bumpSessionAttacksUsed(cb); } catch (e) {}
        try { if (typeof persistTurnEconomy === 'function') persistTurnEconomy(cb); } catch (e) {}
        return true;
      }
      // Need a free Action to start Attack (or new series after Action Surge)
      if (actUsed >= actMax) {
        toast('No actions left — cannot Attack (already cast or acted)');
        return false;
      }
      cb.actionsUsed = actUsed + 1;
      cb.actionUsed = cb.actionsUsed >= actMax;
      cb.attacksUsed = 1;
      cb.lastAction = label || 'Attack';
      try { bumpSessionAttacksUsed(cb); } catch (e) {}
      try { if (typeof persistTurnEconomy === 'function') persistTurnEconomy(cb); } catch (e) {}
      try { save(); } catch (e) {}
      return true;
    }

    return false;
  }

function spendAction(cb, label) {
    if (!cb) return false;
    if (cb.actionsMax == null) cb.actionsMax = 1;
    if (cb.actionsUsed == null) cb.actionsUsed = 0;
    if (cb.actionsUsed >= cb.actionsMax) {
      toast('No actions left this turn (' + cb.actionsUsed + '/' + cb.actionsMax + ')');
      return false;
    }
    cb.actionsUsed = (Number(cb.actionsUsed) || 0) + 1;
    cb.actionUsed = cb.actionsUsed >= cb.actionsMax;
    if (label) cb.lastAction = label;
    try { if (typeof persistTurnEconomy === 'function') persistTurnEconomy(cb); } catch (e) {}
    return true;
  }

  /** Start-of-turn reset driven by DM Next Turn. */
  
  function persistTurnEconomy(cb) {
    if (!cb) return;
    try {
      const c = getActive();
      const combat = c ? getCombat(c) : null;
      if (!combat) return;
      if (!combat.turnEconomy) combat.turnEconomy = {};
      const id = String(cb.id != null ? cb.id : cb.name || '');
      if (!id) return;
      combat.turnEconomy[id] = {
        actionsUsed: Number(cb.actionsUsed) || 0,
        actionsMax: Number(cb.actionsMax) || 1,
        actionUsed: !!cb.actionUsed,
        attacksUsed: Number(cb.attacksUsed) || 0,
        attacksMax: cb.attacksMax,
        lastAction: cb.lastAction || null,
        bonusUsed: !!cb.bonusUsed,
        reactionUsed: !!cb.reactionUsed,
        turnPhase: cb.turnPhase || 'active',
        extraActionsGranted: Number(cb.extraActionsGranted) || 0
      };
    } catch (e) {}
  }
  function restoreTurnEconomy(cb) {
    if (!cb) return;
    try {
      const c = getActive();
      const combat = c ? getCombat(c) : null;
      const id = String(cb.id != null ? cb.id : cb.name || '');
      const row = combat && combat.turnEconomy && combat.turnEconomy[id];
      if (!row) return;
      // Monotonic for spend counters: never clobber a higher in-memory value
      // (fixes player popup: showCombatDetail was resetting attacksUsed after Roll Attack)
      if (row.actionsUsed != null) cb.actionsUsed = Math.max(Number(cb.actionsUsed) || 0, Number(row.actionsUsed) || 0);
      if (row.actionsMax != null) cb.actionsMax = Math.max(Number(cb.actionsMax) || 1, Number(row.actionsMax) || 1);
      if (row.actionUsed != null) cb.actionUsed = !!(cb.actionUsed || row.actionUsed);
      if (row.attacksUsed != null) cb.attacksUsed = Math.max(Number(cb.attacksUsed) || 0, Number(row.attacksUsed) || 0);
      if (row.attacksMax != null) cb.attacksMax = Math.max(Number(cb.attacksMax) || 1, Number(row.attacksMax) || 1);
      if (row.lastAction != null && !cb.lastAction) cb.lastAction = row.lastAction;
      else if (row.lastAction != null && (Number(cb.attacksUsed) || 0) > 0) cb.lastAction = cb.lastAction || row.lastAction;
      if (row.bonusUsed != null) cb.bonusUsed = !!(cb.bonusUsed || row.bonusUsed);
      if (row.reactionUsed != null) cb.reactionUsed = !!(cb.reactionUsed || row.reactionUsed);
      if (row.turnPhase != null) {
        // Prefer active over ready if we already started
        if (cb.turnPhase === 'active' || row.turnPhase === 'active') cb.turnPhase = 'active';
        else cb.turnPhase = row.turnPhase;
      }
      if (row.extraActionsGranted != null) cb.extraActionsGranted = Math.max(Number(cb.extraActionsGranted) || 0, Number(row.extraActionsGranted) || 0);
    } catch (e) {}
  }

function beginCombatantTurn(cb, ch) {
    if (!cb) return;
    cb.turnPhase = 'active';
    cb.attacksUsed = 0;
    cb.moveUsed = 0;
    cb.actionsUsed = 0;
    // Recalculate Extra Attack budget every turn start (fixes DM 2/2 vs player 3/3)
    try {
      if (typeof ensureCombatantTurnState === 'function') ensureCombatantTurnState(cb, ch);
      if (ch && Number(ch.attacksMax) > 0) cb.attacksMax = Math.max(Number(cb.attacksMax) || 1, Number(ch.attacksMax) || 1);
      if (typeof attacksPerAction === 'function') {
        const calc = attacksPerAction(ch || cb);
        if (calc > 0) cb.attacksMax = Math.max(Number(cb.attacksMax) || 1, calc);
      }
    } catch (e) {}
    // Clear stored economy for this combatant so restore cannot resurrect old spends
    try {
      const c = typeof getActive === 'function' ? getActive() : null;
      const combat = c && typeof getCombat === 'function' ? getCombat(c) : null;
      const id = String(cb.id != null ? cb.id : cb.name || '');
      if (combat && combat.turnEconomy && id) delete combat.turnEconomy[id];
    } catch (e) {}
    // New turn: must Roll Attack again before Damage Roll
    try {
      window.__lastCombatRoll = { canDamage: false, hit: false, applied: true, damage: 0 };
      if (typeof setDamageRollEnabled === 'function') {
        setDamageRollEnabled(document, false, 'Roll Attack and hit first');
      }
      document.querySelectorAll('#cr-roll-dmg').forEach(function(btn) {
        btn.disabled = true;
        btn.setAttribute('disabled', 'disabled');
        btn.classList.remove('is-ready');
        btn.title = 'Roll Attack and hit first';
      });
    } catch (e) {}
    cb.extraActionsGranted = 0;
    cb.actionUsed = false;
    cb.bonusUsed = false;
    cb.objectInteractUsed = false;
    cb.reactionUsed = false;
    cb.bonusActionsUsed = {};
    cb.disengage = false;
    cb.dashSpeed = 0;
    cb.lastAction = null;
    // Clear session/mirror attack counters so UI cannot show 0/max from a prior turn
    try { if (typeof clearSessionAttacksUsed === 'function') clearSessionAttacksUsed(cb); } catch (e) {}
    try {
      sessionStorage.removeItem('cyber_econ_' + String(cb.id || cb.name || ''));
      Object.keys(sessionStorage).forEach(function(k) {
        if (k.indexOf('cyber_atk_') === 0) sessionStorage.removeItem(k);
      });
    } catch (e) {}
    try {
      if (typeof ensureCombatantTurnState === 'function') ensureCombatantTurnState(cb, ch || null);
    } catch (e) {}
    cb.actionsMax = (typeof actionsMaxForCombatant === 'function') ? actionsMaxForCombatant(cb, ch || null) : 1;
    cb.actionsUsed = 0;
    cb.actionUsed = false;
    try { if (typeof persistTurnEconomy === 'function') persistTurnEconomy(cb); } catch (e) {}
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

  
  function resourceRemaining(r) {
    if (!r) return 0;
    if (r.current != null && !isNaN(Number(r.current))) return Math.max(0, Number(r.current));
    const max = Number(r.max) || 0;
    const used = Number(r.used) || 0;
    return Math.max(0, max - used);
  }
  function spendCombatResource(cb, id, amount) {
    amount = Math.max(1, Number(amount) || 1);
    if (!cb) return false;
    if (!cb.combatResources) cb.combatResources = {};
    let r = cb.combatResources[id];
    if (!r) return false;
    const max = Number(r.max) || 0;
    let left = resourceRemaining(r);
    if (left < amount) return false;
    left -= amount;
    r.current = left;
    r.used = Math.max(0, max - left);
    r.max = max;
    return true;
  }
  function ensureCombatantLR(cb) {
    if (!cb) return;
    try {
      // Pull from campaign villains/party roster if combatant is missing LR
      if ((cb.legendaryResist == null || cb.legendaryResistMax == null) && typeof getActive === 'function') {
        var camp = getActive();
        var lists = [].concat((camp && camp.villains) || [], (camp && camp.party) || []);
        var src = lists.find(function(x) {
          return x && (String(x.id) === String(cb.sourceId || cb.charId) || x.name === cb.name);
        });
        if (src) {
          if (cb.legendaryResist == null && src.legendaryResist != null) cb.legendaryResist = Number(src.legendaryResist);
          if (cb.legendaryResistMax == null && src.legendaryResistMax != null) cb.legendaryResistMax = Number(src.legendaryResistMax);
          if (src.legendary) cb.legendary = true;
        }
      }
      if (cb.legendaryResistMax != null && (cb.legendaryResist == null || cb.legendaryResist === '')) {
        cb.legendaryResist = Number(cb.legendaryResistMax) || 0;
      }
      if (cb.legendaryResistMax == null && cb.legendaryResist != null) {
        cb.legendaryResistMax = Number(cb.legendaryResist) || 0;
      }
    } catch (e) {}
  }
  function legendaryResistRemaining(cb) {
    if (!cb) return 0;
    try { ensureCombatantLR(cb); } catch (e) {}
    if (cb.legendaryResist != null) return Math.max(0, Number(cb.legendaryResist) || 0);
    if (cb.legendaryResistLeft != null) return Math.max(0, Number(cb.legendaryResistLeft) || 0);
    return Math.max(0, Number(cb.legendaryResistMax) || 0);
  }
  function spendLegendaryResist(cb) {
    if (!cb) return false;
    const left = legendaryResistRemaining(cb);
    if (left <= 0) return false;
    cb.legendaryResist = left - 1;
    cb.legendaryResistLeft = cb.legendaryResist;
    return true;
  }


  function resolveCharacterForCombatant(cb) {
    if (!cb) return null;
    try {
      const c = typeof getActive === 'function' ? getActive() : null;
      if (!c) return null;
      const id = cb.sourceId || cb.charId || cb.characterId || cb.id;
      const lists = [].concat(c.party || [], c.villains || [], c.npcs || [], c.allies || []);
      let hit = lists.find(function(x) {
        if (!x) return false;
        return String(x.id) === String(id) || String(x.characterId) === String(id) || String(x.name) === String(cb.name);
      });
      if (hit) return hit;
    } catch (e) {}
    // Combatant may itself carry class/level (roster import)
    if (cb.class || cb.className || cb.classes || cb.classLevels || cb.level) return cb;
    return null;
  }

  function ensureCombatantTurnState(cb, ch) {
    if (!cb) return;
    if (!ch) {
      try { ch = resolveCharacterForCombatant(cb); } catch (e) { ch = null; }
    }
    // Recalc from class levels unless DM locked the budget
    if (!cb.attacksMaxLocked) {
      const calc = attacksPerAction(ch || cb);
      // Never shrink a higher already-set max mid-turn unless calc is higher (Extra Attack etc.)
      if (calc > 1 || cb.attacksMax == null || !(Number(cb.attacksMax) > 0)) {
        cb.attacksMax = Math.max(Number(cb.attacksMax) || 0, calc) || calc;
      }
      // Prefer class-derived value when we have character data
      if (ch || cb.class || cb.classes || cb.classLevels) {
        cb.attacksMax = Math.max(calc, Number(cb.attacksMax) || 1);
      }
      // Linked sheet / roster explicit attacksMax (Garrick = 3)
      if (ch && Number(ch.attacksMax) > 0) {
        cb.attacksMax = Math.max(Number(cb.attacksMax) || 1, Number(ch.attacksMax) || 1);
      }
    } else if (cb.attacksMax == null) {
      cb.attacksMax = attacksPerAction(ch || cb);
    }
    if (ch && Number(ch.attacksMax) > 0) {
      cb.attacksMax = Math.max(Number(cb.attacksMax) || 1, Number(ch.attacksMax) || 1);
    }
    if (cb.attacksUsed == null) cb.attacksUsed = 0;
    if (cb.attacksUsed > cb.attacksMax) cb.attacksUsed = cb.attacksMax;
    // Full turn economy defaults
    if (cb.speed == null || (typeof cb.speed === 'number' && isNaN(cb.speed))) cb.speed = parseSpeed(ch && ch.speed);
    if (cb.moveUsed == null) cb.moveUsed = 0;
    // Keep actionsMax in sync with Action Surge / Haste grants
    if ((Number(cb.extraActionsGranted) || 0) > 0 || cb.actionsMax == null || !(Number(cb.actionsMax) > 0)) {
      cb.actionsMax = (typeof actionsMaxForCombatant === 'function') ? actionsMaxForCombatant(cb, ch) : Math.max(1, Number(cb.actionsMax) || 1);
    }
    if (cb.actionsUsed == null) cb.actionsUsed = cb.actionUsed ? 1 : 0;
    if (cb.extraActionsGranted == null) cb.extraActionsGranted = 0;
    cb.actionUsed = (Number(cb.actionsUsed) || 0) >= (Number(cb.actionsMax) || 1);
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
        const prevR = prev[r.id] || {};
        const prevUsed = prevR.used != null ? Number(prevR.used) : null;
        const prevCur = prevR.current != null ? Number(prevR.current) : null;
        const charUsed = fromChar[r.id] != null ? Number(fromChar[r.id]) : null;
        let used;
        // Prefer explicit used count (spend buttons update used); current can be stale
        if (prevUsed != null && !isNaN(prevUsed)) {
          used = Math.max(0, prevUsed);
        } else if (prevCur != null && !isNaN(prevCur)) {
          used = Math.max(0, (Number(r.max) || 0) - prevCur);
        } else if (charUsed != null) {
          used = Math.max(0, charUsed);
        } else {
          used = 0;
        }
        const max = Number(r.max) || 0;
        if (used > max) used = max;
        next[r.id] = {
          label: r.label,
          max: max,
          used: used,
          current: Math.max(0, max - used),
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
            ${(typeof isPlayerRole === 'function' && isPlayerRole()) ? '' : `<button type="button" class="btn secondary btn-tiny cd-res-dec" data-res="${escapeAttr(k)}">−</button>`}
            <span class="combat-res-val"><strong>${left}</strong>/${maxL}</span>
            ${(typeof isPlayerRole === 'function' && isPlayerRole()) ? '' : `<button type="button" class="btn secondary btn-tiny cd-res-inc" data-res="${escapeAttr(k)}">+</button>`}
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

  
  function sanitizeSpellDescription(sp) {
    if (!sp) return '';
    let d = String(sp.description || sp.summary || '');
    const name = String(sp.name || '').toLowerCase();
    const cutMarkers = [
      'Otherworldly Steed',
      'MOD SAVE MOD SAVE',
      'MOD SAVE Str ',
      'Find Steed',
      'Phantom Steed'
    ];
    if (name && !name.includes('steed')) {
      for (const mk of cutMarkers) {
        const i = d.indexOf(mk);
        if (i > 80) { d = d.slice(0, i).trim(); break; }
      }
    }
    if (name === 'fireball' || name === 'delayed blast fireball') {
      const m = d.match(/^([\s\S]*?Using a Higher-Level Spell Slot\.\s*The damage increases by 1d6 for each spell slot level above \d+\.)/i);
      if (m) d = m[1];
    }
    if (d.length > 1200) {
      let cut = d.lastIndexOf('.', 1100);
      if (cut > 400) d = d.slice(0, cut + 1);
    }
    return d.trim();
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
      const name = typeof spellLabelName === 'function' ? spellLabelName(label) : String(label || '').trim();
      if (!name || /^\[object object\]$/i.test(name)) return;
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
    (typeof splitSpellNames === 'function' ? splitSpellNames(ch.cantrips) : []).forEach(s => add(s, 'cantrip'));
    const prepared = ch.spellPrepMode === 'prepared' && ch.preparedSpells
      ? ch.preparedSpells
      : ch.spells;
    (typeof splitSpellNames === 'function' ? splitSpellNames(prepared) : []).forEach(s => add(s, 'spell'));
    // Additional common fields from imports / combatants
    (typeof splitSpellNames === 'function' ? splitSpellNames(ch.knownSpells) : []).forEach(s => add(s, 'spell'));
    (typeof splitSpellNames === 'function' ? splitSpellNames(ch.preparedSpells) : []).forEach(s => add(s, 'spell'));
    (typeof splitSpellNames === 'function' ? splitSpellNames(ch.spellList) : []).forEach(s => add(s, 'spell'));
    (ch.spellIds || []).forEach(id => {
      const sp = (window.SPELLS || []).find(x => x.id === id || x.name === id);
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
    // Current initiative combatant is started by DM Next Turn
    try {
      const c0 = getActive();
      const combat0 = c0 ? getCombat(c0) : null;
      if (combat0 && Array.isArray(combat0.combatants)) {
        const cur = combat0.combatants[combat0.turnIndex];
        if (cur && String(cur.id) === String(cb.id) && (cb.turnPhase === 'ready' || cb.turnPhase === 'pending' || !cb.turnPhase)) {
          cb.turnPhase = 'active';
        }
      }
    } catch (e) {}
    const phase = cb.turnPhase || 'ready';
    // active: full turn (DM Next Turn)
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
    const lockMsg = lockedUntilStart ? 'Wait for DM Next Turn' : (turnEnded ? 'Turn ended — only Reaction / Legendary' : '');

    // Turn economy buttons
    ['cd-move-dec','cd-move-inc','cd-move-all','cd-move-reset',
     'cd-action-toggle',
     'cd-bonus-toggle','cd-object-toggle','cd-end-turn-local',
     'cr-spell-cast','cr-spell-pick','cr-spell-slot','cr-roll-btn'
    ].forEach(id => {
      const el = panel.querySelector('#' + id);
      setDisabled(el, !allowMain, lockMsg);
    });
    // DM can always adjust/reset action & weapon budgets
    ['cd-atk-dec','cd-atk-inc','cd-atk-reset','cd-act-dec','cd-act-inc','cd-act-reset'].forEach(id => {
      const el = panel.querySelector('#' + id);
      if (!el) return;
      const dm = !(typeof isPlayerRole === 'function' && isPlayerRole());
      setDisabled(el, !dm && !allowMain, dm ? '' : lockMsg);
    });
    // No Action left (e.g. after Cast) → cannot start Attack or another action-cast
    try {
      const actLeft2 = Math.max(0, (Number(cb.actionsMax) || 1) - (Number(cb.actionsUsed) || 0));
      const atkLeft2 = Math.max(0, (Number(cb.attacksMax) || 1) - (Number(cb.attacksUsed) || 0));
      const canContinueAtk = (Number(cb.attacksUsed) || 0) > 0 && atkLeft2 > 0;
      try { applyRollAttackButtonState(panel, cb); } catch (e) {}
      const castBtn = panel.querySelector('#cr-spell-cast');
      if (castBtn && allowMain && actLeft2 <= 0) {
        setDisabled(castBtn, true, 'No actions left to cast');
      }
    } catch (e) {}
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
        <div class="detail-text" style="margin-top:0.5rem">${formatRichText(sanitizeSpellDescription(sp) || 'No full text in catalog.')}</div>
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
    const isPlayer = (typeof isPlayerRole === 'function' && isPlayerRole())
      || /[?&]role=player(?:&|$)/i.test(String(location.search || ''));
    const slotOpts = levels.filter(L => (slots[L].max - (slots[L].used||0)) > 0).map(L =>
      `<option value="${L}">${L}${L===1?'st':L===2?'nd':L===3?'rd':'th'} (${slots[L].max-(slots[L].used||0)} left)</option>`
    ).join('');
    const pact = cb.pactSlotsMax
      ? (isPlayer
          ? `<div class="combat-res-row"><span class="combat-res-name">Pact (${cb.pactSlotLevel})</span>
          <span class="combat-res-val"><strong>${Math.max(0,(cb.pactSlotsMax||0)-(cb.pactSlotsUsed||0))}</strong>/${cb.pactSlotsMax}</span></div>`
          : `<div class="combat-res-row"><span class="combat-res-name">Pact (${cb.pactSlotLevel})</span>
          <button type="button" class="btn secondary btn-tiny" id="cd-pact-dec">−</button>
          <span class="combat-res-val"><strong>${Math.max(0,(cb.pactSlotsMax||0)-(cb.pactSlotsUsed||0))}</strong>/${cb.pactSlotsMax}</span>
          <button type="button" class="btn secondary btn-tiny" id="cd-pact-inc">+</button>
          <button type="button" class="btn secondary btn-tiny" id="cd-pact-spend">Use</button></div>`)
      : '';
    return `<div class="detail-block">
      <div class="detail-label">Spell Slots</div>
      <div class="combat-slots-grid">
        ${levels.map(L => {
          const s = slots[L];
          const left = Math.max(0, s.max - (s.used||0));
          const steppers = isPlayer ? '' : `<button type="button" class="btn secondary btn-tiny cd-slot-spend" data-slot="${L}">−</button>
            <button type="button" class="btn secondary btn-tiny cd-slot-restore" data-slot="${L}">+</button>`;
          return `<div class="combat-slot-chip ${left===0?'empty':''}" data-slot="${L}" title="Level ${L}">
            <span class="slot-lvl">L${L}</span>
            <span class="slot-val">${left}/${s.max}</span>
            ${steppers}
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
    const _playerBudgetSimple = (typeof isPlayerRole === 'function' && isPlayerRole());
    const max = cb.attacksMax != null ? cb.attacksMax : 1;
    const used = cb.attacksUsed || 0;
    const left = Math.max(0, max - used);
    // Actions budget (1 base + Haste + Action Surge grants, etc.)
    if (cb.actionsMax == null) cb.actionsMax = (typeof actionsMaxForCombatant === 'function') ? actionsMaxForCombatant(cb, ch) : 1;
    if (cb.actionsUsed == null) cb.actionsUsed = cb.actionUsed ? 1 : 0;
    const actMax = Number(cb.actionsMax) || 1;
    const actUsed = Number(cb.actionsUsed) || 0;
    const actLeft = Math.max(0, actMax - actUsed);
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
          ${badge(actLeft <= 0, actLeft <= 0 ? 'All used' : (actUsed > 0 ? actLeft + ' left' : 'Available'))}
        </div>
        <p class="muted small">Cast or Attack both spend your Action and lock the other. Weapon attacks also count Extra Attack swings within the Attack action.</p>
        <div class="action-menu" id="cd-action-menu">
          <button type="button" class="btn secondary btn-tiny act-opt" data-act="attack" title="Use the Attack action">Attack</button>
          <button type="button" class="btn secondary btn-tiny act-opt" data-act="cast" title="Cast a 1-action spell (use Spellcasting panel)">Cast a spell</button>
          <button type="button" class="btn secondary btn-tiny act-opt" data-act="dash" title="Gain extra movement equal to your speed">Dash</button>
          <button type="button" class="btn secondary btn-tiny act-opt" data-act="disengage" title="Movement does not provoke opportunity attacks">Disengage</button>
          <button type="button" class="btn secondary btn-tiny act-opt" data-act="dodge" title="Attacks vs you have disadvantage; Dex saves advantage">Dodge</button>
          <button type="button" class="btn secondary btn-tiny act-opt" data-act="grapple" title="Athletics contest">Grapple</button>
          <button type="button" class="btn secondary btn-tiny act-opt" data-act="shove" title="Push or prone">Shove</button>
          <button type="button" class="btn secondary btn-tiny act-opt" data-act="help" title="Help an ally (advantage)">Help</button>
          <button type="button" class="btn secondary btn-tiny act-opt" data-act="hide" title="Make a Stealth check to Hide">Hide</button>
          <button type="button" class="btn secondary btn-tiny act-opt" data-act="ready" title="Ready a trigger; response uses your reaction">Ready</button>
          <button type="button" class="btn secondary btn-tiny act-opt" data-act="search" title="Search for something">Search</button>
          <button type="button" class="btn secondary btn-tiny act-opt" data-act="use-object" title="Use an object that needs your action">Use an object</button>
          <button type="button" class="btn secondary btn-tiny act-opt" data-act="other" title="Other action">Other…</button>
        </div>
        <div class="turn-stage-sub" style="margin-top:0.35rem">
          <div class="turn-stage-sub-head">Actions budget <span class="muted small">(1 + Haste / Action Surge)</span></div>
          <div class="combat-res-row" data-econ="actions">
            <span class="combat-res-val" id="cd-actions-val" data-econ-val="actions"><strong id="cd-actions-left">${actLeft}</strong> left of <span id="cd-actions-max">${actMax}</span>${actUsed ? ' · used <span id="cd-actions-used">' + actUsed + '</span>' : ''}</span>
            ${ _playerBudgetSimple ? '' : `<button type="button" class="btn secondary btn-tiny" id="cd-act-dec" title="Refund 1 action">−</button>
            <button type="button" class="btn secondary btn-tiny" id="cd-act-inc" title="Spend 1 action">+</button>
            <button type="button" class="btn secondary btn-tiny" id="cd-act-reset">Reset</button>`}
            <button type="button" class="btn secondary btn-tiny" id="cd-action-toggle">${actLeft <= 0 ? 'Mark available' : 'Mark used'}</button>
          </div>
          ${cb.lastAction ? `<span class="muted small">Last: ${escapeHtml(cb.lastAction)}</span>` : ''}
        </div>
        <div class="turn-stage-sub">
          <div class="turn-stage-sub-head">Weapon attacks <span class="muted small">(also locked after Cast)</span></div>
          <div class="combat-res-row" data-econ="weapon-attacks">
            <span class="combat-res-val" id="cd-weapon-atk-val" data-econ-val="weapon-attacks"><strong id="cd-weapon-atk-left">${left}</strong> / <span id="cd-weapon-atk-max">${max}</span></span>
            ${ _playerBudgetSimple ? '' : `<button type="button" class="btn secondary btn-tiny" id="cd-atk-dec">−</button>
            <button type="button" class="btn secondary btn-tiny" id="cd-atk-inc">+</button>
            <button type="button" class="btn secondary btn-tiny" id="cd-atk-reset">Reset</button>`}
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
          <span class="combat-res-val"><strong>${typeof legendaryResistRemaining === 'function' ? legendaryResistRemaining(cb) : (cb.legendaryResist != null ? cb.legendaryResist : (cb.legendaryResistMax || 0))}</strong>/${cb.legendaryResistMax != null ? cb.legendaryResistMax : 0}</span>
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
      size: ch.size || 'Medium',
      tokenSize: ch.tokenSize != null ? Number(ch.tokenSize) : null,
      legendary: !!ch.legendary,
      legendaryResist: ch.legendaryResist != null ? Number(ch.legendaryResist) : null,
      legendaryResistMax: ch.legendaryResistMax != null ? Number(ch.legendaryResistMax) : null,
      legendaryActions: ch.legendaryActions || [],
      legendaryActionsMax: ch.legendaryActionsMax != null ? Number(ch.legendaryActionsMax) : null,
      legendaryActionsUsed: Number(ch.legendaryActionsUsed) || 0,
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
  async function critterDbFetchJson(url) {
    const res = await fetch(url, { credentials: 'omit' });
    if (!res.ok) throw new Error('CritterDB ' + res.status);
    return res.json();
  }


  async function fetchCritterDbPublishedBestiary(bestiaryId, { onPage, maxPages = 40 } = {}) {
    const id = parseCritterDbBestiaryId(bestiaryId);
    if (!id) throw new Error('Invalid CritterDB bestiary id or URL');
    const all = [];
    let page = 1;
    while (page <= maxPages) {
      const url = `https://critterdb.com/api/publishedbestiaries/${id}/creatures/${page}`;
      let batch;
      try {
        batch = await critterDbFetchJson(url);
      } catch (err) {
        if (page === 1) throw err;
        break;
      }
      if (!Array.isArray(batch) || !batch.length) break;
      all.push(...batch);
      if (typeof onPage === 'function') onPage(page, all.length);
      // CritterDB pages typically return up to 25; stop when short page
      if (batch.length < 20) break;
      page += 1;
    }
    return all;
  }

  async function fetchCritterDbBestiaryIndex({ lists = ['recent', 'popular'], maxPagesPerList = 80, onProgress } = {}) {
    const byId = new Map();
    for (const list of lists) {
      for (let page = 1; page <= maxPagesPerList; page++) {
        const url = `https://critterdb.com/api/publishedbestiaries/${list}/${page}`;
        let batch;
        try {
          batch = await critterDbFetchJson(url);
        } catch (err) {
          if (page === 1) throw new Error(`Network error listing ${list} p${page}: ${err.message || err}`);
          break;
        }
        if (!Array.isArray(batch) || !batch.length) break;
        batch.forEach(b => {
          const id = b._id || b.id;
          if (id) byId.set(id, { id, name: b.name || id, description: b.description || '' });
        });
        if (typeof onProgress === 'function') {
          onProgress({ phase: 'index', list, page, bestiaries: byId.size });
        }
        if (batch.length < 5) break; // likely last page
        await sleepMs(120);
      }
    }
    // most popular (single payload if available)
    try {
      const data = await critterDbFetchJson('https://critterdb.com/api/publishedbestiaries/mostpopular');
      const arr = Array.isArray(data) ? data : (data.bestiaries || data.results || []);
      arr.forEach(b => {
        const id = b._id || b.id;
        if (id) byId.set(id, { id, name: b.name || id, description: b.description || '' });
      });
    } catch (e) { /* optional */ }
    return [...byId.values()];
  }

  /**
   * Bulk crawl all discoverable public bestiaries (recent + popular feeds)
   * and merge creatures into the user compendium.
   */
  async function syncCritterDb({ bestiaryIdOrUrl, statusEl } = {}) {
    const setStatus = (msg) => { if (statusEl) statusEl.textContent = msg; };
    setStatus('Fetching CritterDB bestiary…');
    const rows = await fetchCritterDbPublishedBestiary(bestiaryIdOrUrl, {
      onPage: (p, n) => setStatus(`CritterDB page ${p} — ${n} creatures…`)
    });
    if (!rows.length) {
      setStatus('No creatures returned.');
      return { creatures: 0 };
    }
    const mapped = rows.map(r => mapCritterDbCreature(r, 'CritterDB')).filter(Boolean);
    const pack = {
      creatures: mapped,
      meta: {
        edition: '5e-critterdb',
        source: 'CritterDB',
        attribution: 'Imported from CritterDB (https://critterdb.com). Respect original authors’ licenses.',
        bestiaryId: parseCritterDbBestiaryId(bestiaryIdOrUrl),
        syncedAt: new Date().toISOString()
      }
    };
    setStatus(`Merging ${mapped.length} creatures…`);
    const res = importCompendiumPack(pack);
    setStatus(`Done — +${res.creaturesAdded ?? res.creatures} new, ${res.creaturesUpdated || 0} updated, ${res.creaturesSkipped || 0} duplicates skipped (bestiary total ${res.totalCreatures}).`);
    return res;
  }

  async function syncCritterDbCatalog({
    statusEl,
    maxBestiaries = 500,
    maxPagesPerList = 100,
    delayMs = 150,
    abortSignal
  } = {}) {
    const setStatus = (msg) => { if (statusEl) statusEl.textContent = msg; };
    setStatus('Indexing published bestiaries (recent + popular)…');
    const index = await fetchCritterDbBestiaryIndex({
      lists: ['recent', 'popular'],
      maxPagesPerList,
      onProgress: ({ list, page, bestiaries }) => {
        setStatus(`Indexing ${list} p${page} — ${bestiaries} unique bestiaries…`);
      }
    });
    if (!index.length) {
      setStatus('No published bestiaries found (API empty or blocked).');
      return { bestiaries: 0, creatures: 0 };
    }
    const slice = index.slice(0, maxBestiaries);
    setStatus(`Found ${index.length} bestiaries — importing up to ${slice.length}…`);

    let totalMapped = 0;
    let bestiariesOk = 0;
    let bestiariesFail = 0;
    const allMapped = [];

    for (let i = 0; i < slice.length; i++) {
      if (abortSignal?.aborted) {
        setStatus(`Aborted after ${bestiariesOk} bestiaries / ${totalMapped} creatures.`);
        break;
      }
      const b = slice[i];
      setStatus(`Bestiary ${i + 1}/${slice.length}: ${b.name}…`);
      try {
        const rows = await fetchCritterDbPublishedBestiary(b.id, {
          maxPages: 60,
          onPage: (p, n) => setStatus(`Bestiary ${i + 1}/${slice.length}: ${b.name} — creature page ${p} (${n})`)
        });
        const mapped = rows
          .map(r => mapCritterDbCreature(r, `CritterDB: ${b.name}`))
          .filter(Boolean);
        allMapped.push(...mapped);
        totalMapped += mapped.length;
        bestiariesOk++;
      } catch (err) {
        console.warn('CritterDB bestiary failed', b.id, err);
        bestiariesFail++;
      }
      // Merge in chunks so progress is saved if the tab dies mid-crawl
      if (allMapped.length >= 80 || i === slice.length - 1) {
        if (allMapped.length) {
          importCompendiumPack({
            creatures: allMapped.splice(0, allMapped.length),
            meta: {
              edition: '5e-critterdb-bulk',
              source: 'CritterDB public catalog',
              attribution: 'Bulk import from CritterDB published bestiaries (https://critterdb.com). Respect authors’ licenses.',
              syncedAt: new Date().toISOString()
            }
          });
        }
      }
      await sleepMs(delayMs);
    }

    applyCompendiumToRuntime();
    const totalCreatures = (window.BESTIARY_MERGED || []).length;
    setStatus(`Done — ${bestiariesOk} bestiaries OK, ${bestiariesFail} failed, ~${totalMapped} creatures merged (runtime bestiary ${totalCreatures}).`);
    return { bestiaries: bestiariesOk, failed: bestiariesFail, creatures: totalMapped, totalCreatures };
  }


  function importCritterDbText(text) {
    const data = JSON.parse(text);
    // Normalize to pack
    let creatures = [];
    if (Array.isArray(data)) creatures = data;
    else if (data.creatures) creatures = data.creatures;
    else if (data.stats && data.name) creatures = [data];
    else throw new Error('Unrecognized CritterDB JSON (need creature or bestiary with creatures[])');
    const mapped = creatures.map(r => mapCritterDbCreature(r, data.name ? `CritterDB: ${data.name}` : 'CritterDB')).filter(Boolean);
    return importCompendiumPack({
      creatures: mapped,
      meta: {
        edition: '5e-critterdb',
        source: data.name || 'CritterDB JSON',
        attribution: 'Imported from CritterDB JSON export.'
      }
    });
  }

  async function syncOpen5e({
    srdOnly = true,
    spells = true,
    equipment = true,
    items = true,
    magicItems = true,
    feats = false,
    creatures = false,
    statusEl
  } = {}) {
    const setStatus = (msg) => { if (statusEl) statusEl.textContent = msg; };
    const params = srdOnly ? { document__key: 'srd-2024' } : {};
    const pack = {
      spells: [],
      equipment: [],
      creatures: [],
      meta: {
        edition: srdOnly ? '5e-srd-2024-open5e' : '5e-open5e-v2-all',
        source: 'Open5e API v2',
        attribution: 'Data from Open5e API v2 (https://api.open5e.com). Documents retain their original licenses.',
        syncedAt: new Date().toISOString()
      }
    };

    try {
      if (spells) {
        setStatus('Fetching spells…');
        const rows = await open5eFetchAll('/spells/', params, {
          maxPages: 120,
          onPage: (p, n, total) => setStatus(`Spells page ${p} — ${n}/${total || '?'}`)
        });
        pack.spells = rows.map(mapOpen5eSpell).filter(Boolean);
        setStatus(`Mapped ${pack.spells.length} spells`);
      }

      if (equipment) {
        setStatus('Fetching weapons…');
        const weapons = await open5eFetchAll('/weapons/', params, {
          maxPages: 40,
          onPage: (p, n, total) => setStatus(`Weapons page ${p} — ${n}/${total || '?'}`)
        });
        setStatus('Fetching armor…');
        const armor = await open5eFetchAll('/armor/', params, {
          maxPages: 20,
          onPage: (p, n, total) => setStatus(`Armor page ${p} — ${n}/${total || '?'}`)
        });
        pack.equipment.push(...weapons.map(mapOpen5eWeapon).filter(Boolean));
        pack.equipment.push(...armor.map(mapOpen5eArmor).filter(Boolean));
      }

      if (items) {
        setStatus('Fetching adventuring gear (items)…');
        const rows = await open5eFetchAll('/items/', params, {
          maxPages: 80,
          onPage: (p, n, total) => setStatus(`Items page ${p} — ${n}/${total || '?'}`)
        });
        pack.equipment.push(...rows.map(mapOpen5eItem).filter(Boolean));
      }

      if (magicItems) {
        setStatus('Fetching magic items…');
        // Full catalog (SRD filter alone misses many +1 weapons / wondrous items)
        let magicRows = await open5eFetchAll('/magicitems/', {}, {
          maxPages: 50,
          onPage: (p, n, total) => setStatus(`Magic items page ${p} — ${n}/${total || '?'}`)
        });
        pack.equipment.push(...magicRows.map(mapOpen5eMagicItem).filter(Boolean));
        setStatus(`Mapped ${magicRows.length} magic items`);
      }

      if (feats) {
        setStatus('Fetching feats…');
        const rows = await open5eFetchAll('/feats/', params, {
          maxPages: 40,
          onPage: (p, n, total) => setStatus(`Feats page ${p} — ${n}/${total || '?'}`)
        });
        pack.equipment.push(...rows.map(mapOpen5eFeat).filter(Boolean));
      }


      if (creatures) {
        setStatus('Fetching creatures (bestiary)…');
        try {
          const rows = await open5eFetchAll('/creatures/', params, {
            maxPages: 150,
            onPage: (p, n, total) => setStatus(`Creatures page ${p} — ${n}/${total || '?'}`)
          });
          pack.creatures = rows.map(mapOpen5eCreature).filter(Boolean);
        } catch (err) {
          console.warn('Creature sync failed', err);
          setStatus('Creature sync failed (API may rate-limit). Spells/equipment still saved.');
        }
      }

      setStatus(`Merging ${pack.spells.length} spells, ${pack.equipment.length} equipment…`);
      const res = importCompendiumPack(pack);
      setStatus(`Done — +${res.spells} spells, +${res.equipment} equipment${res.creatures ? ', +' + res.creatures + ' creatures' : ''}. Runtime: ${res.totalSpells} spells / ${res.totalEquipment} equipment.`);
      return res;
    } catch (err) {
      console.warn(err);
      setStatus('Error: ' + (err.message || err));
      throw err;
    }
  }

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
    const player = (typeof isPlayerRole === 'function' && isPlayerRole())
      || /[?&]role=player(?:&|$)/i.test(String(location.search || ''))
      || !!(document.body && document.body.classList.contains('vtt-player'));
    // Players never get DM-only slot steppers
    const dec = player ? '' : '<button type="button" class="slot-dec" aria-label="Decrease">−</button>';
    const inc = player ? '' : '<button type="button" class="slot-inc" aria-label="Increase">+</button>';
    return `<div class="slot-stepper" data-sl="${level}">
      <span class="slot-label">L${level}</span>
      ${dec}
      <span class="slot-val" data-sl="${level}">${used}</span>
      <span class="slot-max">/ ${max}</span>
      ${inc}
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
  
  function renderCompendiumTools() {
    const root = document.getElementById('compendium-tools');
    if (!root) return;
    let extra = { spells: [], equipment: [], creatures: [] };
    try { extra = getUserCompendium() || extra; } catch (e) {}
    const sN = (extra.spells || []).length;
    const eN = (extra.equipment || []).length;
    const cN = (extra.creatures || []).length;
    root.innerHTML = `
      <div class="card tool-card" style="margin-bottom:1rem">
        <h3>Open5e Sync</h3>
        <p class="muted small">Pull SRD spells, equipment, and monsters into this Combat Tracker (browser storage).</p>
        <div class="tool-btns" style="flex-wrap:wrap;gap:0.5rem">
          <button type="button" class="btn primary" id="open5e-sync-srd">Sync Open5e SRD (spells + equipment)</button>
          <button type="button" class="btn secondary" id="open5e-sync-monsters">Sync Open5e monsters</button>
        </div>
        <p class="muted small" id="open5e-status">User pack: ${sN} spells · ${eN} equipment · ${cN} creatures</p>
      </div>
      <div class="card tool-card" style="margin-bottom:1rem">
        <h3>CritterDB</h3>
        <p class="muted small">Import a published CritterDB bestiary by ID or URL, or paste JSON.</p>
        <div style="display:flex;flex-wrap:wrap;gap:0.5rem;align-items:center">
          <input type="text" id="critterdb-id" placeholder="Bestiary ID or critterdb.com URL" style="flex:1;min-width:12rem">
          <button type="button" class="btn primary" id="critterdb-sync-btn">Import bestiary</button>
        </div>
        <div class="tool-btns" style="margin-top:0.5rem;flex-wrap:wrap;gap:0.5rem">
          <button type="button" class="btn secondary" id="critterdb-json-btn">Import CritterDB JSON file</button>
          <input type="file" id="critterdb-json-file" accept=".json,application/json" hidden>
        </div>
        <p class="muted small" id="critterdb-status">—</p>
      </div>
      <div class="card tool-card">
        <h3>Compendium file</h3>
        <div class="tool-btns" style="flex-wrap:wrap;gap:0.5rem">
          <button type="button" class="btn secondary" id="comp-export-btn">Export user pack</button>
          <button type="button" class="btn secondary" id="comp-import-btn">Import JSON pack</button>
          <input type="file" id="comp-import-file" accept=".json,application/json" hidden>
        </div>
      </div>`;

    const oStatus = root.querySelector('#open5e-status');
    const cStatus = root.querySelector('#critterdb-status');
    root.querySelector('#open5e-sync-srd')?.addEventListener('click', async () => {
      if (typeof syncOpen5e !== 'function') { toast('Open5e sync not available'); return; }
      try {
        oStatus.textContent = 'Syncing SRD…';
        await syncOpen5e({ srdOnly: true, spells: true, equipment: true, creatures: false, statusEl: oStatus });
        toast('Open5e SRD sync done');
        renderCompendiumTools();
      } catch (e) {
        console.error(e);
        oStatus.textContent = 'Error: ' + (e.message || e);
        toast('Open5e sync failed');
      }
    });
    root.querySelector('#open5e-sync-monsters')?.addEventListener('click', async () => {
      if (typeof syncOpen5e !== 'function') { toast('Open5e sync not available'); return; }
      try {
        oStatus.textContent = 'Syncing monsters…';
        await syncOpen5e({ srdOnly: true, spells: false, equipment: false, creatures: true, statusEl: oStatus });
        toast('Open5e monsters synced');
        renderCompendiumTools();
      } catch (e) {
        console.error(e);
        oStatus.textContent = 'Error: ' + (e.message || e);
      }
    });
    root.querySelector('#critterdb-sync-btn')?.addEventListener('click', async () => {
      const id = root.querySelector('#critterdb-id')?.value?.trim();
      if (!id) { toast('Enter CritterDB bestiary ID or URL'); return; }
      if (typeof syncCritterDb !== 'function') { toast('CritterDB not available'); return; }
      try {
        await syncCritterDb({ bestiaryIdOrUrl: id, statusEl: cStatus });
        toast('CritterDB import done');
        renderCompendiumTools();
      } catch (e) {
        console.error(e);
        if (cStatus) cStatus.textContent = 'Error: ' + (e.message || e);
        toast('CritterDB failed (CORS/network)');
      }
    });
    root.querySelector('#critterdb-json-btn')?.addEventListener('click', () => root.querySelector('#critterdb-json-file')?.click());
    root.querySelector('#critterdb-json-file')?.addEventListener('change', async (ev) => {
      const f = ev.target.files && ev.target.files[0];
      if (!f) return;
      try {
        const text = await f.text();
        if (typeof importCritterDbText === 'function') {
          const n = importCritterDbText(text);
          if (cStatus) cStatus.textContent = 'Imported from file';
          toast('Imported CritterDB JSON');
          renderCompendiumTools();
        }
      } catch (e) { toast('Import failed: ' + (e.message || e)); }
      ev.target.value = '';
    });
    root.querySelector('#comp-export-btn')?.addEventListener('click', () => {
      try {
        const pack = getUserCompendium();
        const blob = new Blob([JSON.stringify(pack, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'combat-compendium.json';
        a.click();
      } catch (e) { toast('Export failed'); }
    });
    root.querySelector('#comp-import-btn')?.addEventListener('click', () => root.querySelector('#comp-import-file')?.click());
    root.querySelector('#comp-import-file')?.addEventListener('change', async (ev) => {
      const f = ev.target.files && ev.target.files[0];
      if (!f) return;
      try {
        const data = JSON.parse(await f.text());
        const cur = getUserCompendium() || {};
        const merged = {
          spells: [].concat(cur.spells || [], data.spells || []),
          equipment: [].concat(cur.equipment || [], data.equipment || []),
          creatures: [].concat(cur.creatures || [], data.creatures || data.monsters || []),
          meta: Object.assign({}, cur.meta || {}, data.meta || {}, { importedAt: Date.now() })
        };
        if (typeof saveUserCompendium === 'function') await saveUserCompendium(merged);
        toast('Compendium imported');
        renderCompendiumTools();
      } catch (e) { toast('Import failed'); }
      ev.target.value = '';
    });
  }

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
        var addCb = document.querySelector('#roster-import-add-combat');
        window._rosterImportAddToCombat = addCb ? !!addCb.checked : true;
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
      const id = cb.charId || cb.sourceId || cb.id;
      let ch = null;
      const pool = [...(c.party||[]), ...(c.villains||[])];
      if (id) ch = pool.find(x => x.id === id);
      if (!ch) ch = pool.find(x => x.name === cb.name) || null;
      // Also check combatant-carried spells/inventory
      const spellBag = (src) => {
        if (!src) return '';
        const parts = []
          .concat(typeof splitSpellNames === 'function' ? splitSpellNames(src.cantrips) : [])
          .concat(typeof splitSpellNames === 'function' ? splitSpellNames(src.spells) : [])
          .concat(typeof splitSpellNames === 'function' ? splitSpellNames(src.knownSpells) : [])
          .concat(typeof splitSpellNames === 'function' ? splitSpellNames(src.preparedSpells) : []);
        return parts.join(', ');
      };
      const spells = spellBag(ch) || spellBag(cb) || '';
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
    const row = {
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
      legendaryActions: n.legendaryActions || ch.legendaryActions || [],
      legendary: !!(n.legendary || ch.legendary || (side === 'enemy' || side === 'villain')),
      // normalizeCharacter historically dropped these — always prefer raw roster values
      size: (n.size || ch.size || 'Medium'),
      tokenSize: (n.tokenSize != null ? n.tokenSize : (ch.tokenSize != null ? ch.tokenSize : sizeToTokenSquares(n.size || ch.size || 'Medium'))),
      legendaryResist: (n.legendaryResist != null ? n.legendaryResist : ch.legendaryResist),
      legendaryResistMax: (n.legendaryResistMax != null ? n.legendaryResistMax : ch.legendaryResistMax),
      legendaryActionsMax: (n.legendaryActionsMax != null ? n.legendaryActionsMax : ch.legendaryActionsMax),
      legendaryActionsUsed: (n.legendaryActionsUsed != null ? n.legendaryActionsUsed : ch.legendaryActionsUsed) || 0,
      resistances: n.resistances || '',
      immunities: n.immunities || '',
      speed: n.speed || '30 ft.',
      tempHp: 0,
      concentrating: false,
      combatLog: []
    };
    try {
      if (row.legendaryResistMax != null && (row.legendaryResist == null || row.legendaryResist === '')) {
        row.legendaryResist = Number(row.legendaryResistMax) || 0;
      }
      if (row.legendaryResistMax == null && row.legendaryResist != null) {
        row.legendaryResistMax = Number(row.legendaryResist) || 0;
      }
      // Coerce numbers
      if (row.legendaryResist != null) row.legendaryResist = Number(row.legendaryResist) || 0;
      if (row.legendaryResistMax != null) row.legendaryResistMax = Number(row.legendaryResistMax) || 0;
    } catch (e) {}
    return row;
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
  function isPowerWordKillName(name) {
    return /power\s*word\s*:?\s*kill/i.test(String(name || ''));
  }
  function isPowerWordStunName(name) {
    return /power word stun|power word: stun/i.test(String(name || ''));
  }
  function isPowerWordHealName(name) {
    return /power word heal|power word: heal/i.test(String(name || ''));
  }
  function isPowerWordBlindName(name) {
    return /power word blind|power word: blind/i.test(String(name || ''));
  }
  function resolveSpecialSpellOnCast(sp, panel, cb, getSelectedTargets, appendLog, toast, escapeHtml) {
    const name = (sp && sp.name) || '';
    const packs = typeof getSelectedTargets === 'function' ? getSelectedTargets() : [];
    if (typeof isPowerWordKillName === 'function' && isPowerWordKillName(name)) {
      if (!packs.length) { toast('Power Word Kill — select a target first'); return true; }
      const lines = [];
      packs.forEach(({ target }) => {
        const hp = Number(target.hp) || 0;
        if (hp <= 100) {
          target.hp = 0; target.dead = true; target.concentrating = false;
          target.tempHp = 0;
          if (!target.combatLog) target.combatLog = [];
          target.combatLog.push('Slain by Power Word Kill');
          try { if (typeof syncLinkedCharacterHp === 'function') syncLinkedCharacterHp(target); } catch (e) {}
          lines.push(target.name + ' (' + hp + ' HP ≤ 100) → DIES (no save, no damage)');
          appendLog('Power Word Kill: ' + target.name + ' dies');
        } else {
          lines.push(target.name + ' (' + hp + ' HP > 100) → no effect (no save, no damage)');
          appendLog('Power Word Kill: ' + target.name + ' unaffected (' + hp + ' HP)');
        }
      });
      // Prevent a later Apply Damage from using a stale roll
      window.__lastCombatRoll = { damage: 0, heal: 0, hit: false, name: 'Power Word Kill', isSpecial: true };
      const applyAmt = panel && panel.querySelector('#cr-apply-amt');
      if (applyAmt) applyAmt.value = '';
      toast(lines.join(' · '));
      return true;
    }
    if (isPowerWordStunName(name)) {
      if (!packs.length) { toast('Power Word Stun — select a target first'); return true; }
      const lines = [];
      packs.forEach(({ target }) => {
        const hp = Number(target.hp) || 0;
        if (hp <= 150) {
          const cond = String(target.conditions || '');
          if (!/stunned/i.test(cond)) target.conditions = (cond ? cond + ', ' : '') + 'stunned';
          lines.push(target.name + ' (' + hp + ' HP ≤ 150) → Stunned');
        } else lines.push(target.name + ' (' + hp + ' HP > 150) → no effect');
      });
      toast(lines.join(' · '));
      return true;
    }
    if (isPowerWordHealName(name)) {
      if (!packs.length) { toast('Power Word Heal — select a target first'); return true; }
      const lines = [];
      packs.forEach(({ target }) => {
        const hp = Number(target.hp) || 0;
        const max = Number(target.hpMax) || hp;
        if (hp <= 100) {
          target.hp = max;
          target.dead = false;
          lines.push(target.name + ' → healed to full ' + max);
        } else lines.push(target.name + ' (' + hp + ' HP > 100) → no effect');
      });
      toast(lines.join(' · '));
      return true;
    }
    if (isPowerWordBlindName(name)) {
      if (!packs.length) { toast('Power Word Blind — select a target first'); return true; }
      const lines = [];
      packs.forEach(({ target }) => {
        const hp = Number(target.hp) || 0;
        if (hp <= 200) {
          const cond = String(target.conditions || '');
          if (!/blinded/i.test(cond)) target.conditions = (cond ? cond + ', ' : '') + 'blinded';
          lines.push(target.name + ' → Blinded');
        } else lines.push(target.name + ' (' + hp + ' HP > 200) → no effect');
      });
      toast(lines.join(' · '));
      return true;
    }
    if (/^sleep$/i.test(String(name).trim())) {
      if (!packs.length) { toast('Sleep — select targets in area first'); return true; }
      let budget = 0;
      for (let i = 0; i < 5; i++) budget += 1 + Math.floor(Math.random() * 8);
      const sorted = packs.map(p => p.target).slice().sort((a, b) => (Number(a.hp)||0) - (Number(b.hp)||0));
      const lines = ['Sleep pool: ' + budget + ' HP'];
      for (const target of sorted) {
        const hp = Number(target.hp) || 0;
        if (hp <= 0) continue;
        if (budget >= hp) {
          budget -= hp;
          const cond = String(target.conditions || '');
          if (!/unconscious/i.test(cond)) target.conditions = (cond ? cond + ', ' : '') + 'unconscious';
          lines.push(target.name + ' → unconscious');
        } else {
          lines.push(target.name + ' not enough pool (' + budget + ' left)');
          break;
        }
      }
      toast(lines.join(' · '));
      return true;
    }
    return false;
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


  function rollFairDie(sides) {
    sides = Math.max(1, parseInt(sides, 10) || 20);
    try {
      if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        // Rejection sampling — uniform 1..sides
        const max = 0x100000000;
        const limit = max - (max % sides);
        const buf = new Uint32Array(1);
        let x;
        do {
          crypto.getRandomValues(buf);
          x = buf[0];
        } while (x >= limit);
        return (x % sides) + 1;
      }
    } catch (e) {}
    return 1 + Math.floor(Math.random() * sides);
  }

  function rollDieExpr(expr) {
    const s = String(expr || '').replace(/\s+/g, '');
    const m = s.match(/^(\d+)d(\d+)([+-]\d+)?$/i);
    if (!m) {
      const flat = parseInt(s, 10);
      return {
        total: isNaN(flat) ? 0 : flat,
        detail: String(expr || '0'),
        faces: [],
        sides: 0,
        expr: String(expr || '0')
      };
    }
    const n = Math.min(20, parseInt(m[1], 10) || 1);
    const sides = parseInt(m[2], 10) || 6;
    const bonus = m[3] ? parseInt(m[3], 10) : 0;
    const rolls = [];
    const faces = [];
    let sum = 0;
    for (let i = 0; i < n; i++) {
      const r = typeof rollFairDie === "function" ? rollFairDie(sides) : (1 + Math.floor(Math.random() * sides));
      rolls.push(r);
      faces.push({ sides: sides, value: r });
      sum += r;
    }
    return {
      total: sum + bonus,
      detail: rolls.join('+') + (bonus ? (bonus >= 0 ? '+' : '') + bonus : '') + '=' + (sum + bonus),
      faces: faces,
      sides: sides,
      expr: n + 'd' + sides + (bonus ? (bonus >= 0 ? '+' : '') + bonus : '')
    };
  }

  
  
  


  
  /**
   * Document-level combat roller — works on player popup even after partial rebuilds.
   * Uses live DOM values for adv / to-hit / damage.
   */
  function getCombatRollPanel() {
    const btn = document.getElementById('cr-roll-btn') || document.getElementById('cr-roll-dmg');
    return btn ? (btn.closest('[data-player-detail]') || btn.closest('.player-combat-body') || btn.closest('#combat-detail') || btn.parentElement) : null;
  }
  function readAdvMode() {
    const el = document.getElementById('cr-adv');
    const v = el ? String(el.value || 'normal') : 'normal';
    try { sessionStorage.setItem('cr_adv_mode', v); } catch (e) {}
    return v;
  }
  function restoreAdvMode() {
    try {
      const saved = sessionStorage.getItem('cr_adv_mode');
      const el = document.getElementById('cr-adv');
      if (el && saved && (saved === 'normal' || saved === 'adv' || saved === 'dis')) el.value = saved;
    } catch (e) {}
  }
  function activeCombatantForRoll() {
    try {
      if (typeof isPlayerRole === 'function' && isPlayerRole() && typeof getClaimedCombatant === 'function') {
        const me = getClaimedCombatant();
        if (me) return me;
      }
    } catch (e) {}
    try {
      const c = getActive();
      const combat = c ? getCombat(c) : null;
      if (combat && combat.combatants && combat.selectedIndex != null) {
        return combat.combatants[combat.selectedIndex] || null;
      }
    } catch (e) {}
    return null;
  }
  function runDelegatedAttackRoll() {
    const cb = activeCombatantForRoll();
    if (!cb) { try { toast('No combatant selected'); } catch (e) {} return; }
    const panel = getCombatRollPanel() || document;
    const mode = (document.getElementById('cr-mode') && document.getElementById('cr-mode').value) || 'attack';
    const atkSel = document.getElementById('cr-attack');
    const atkName = (atkSel && atkSel.selectedOptions && atkSel.selectedOptions[0])
      ? atkSel.selectedOptions[0].textContent
      : 'Attack';
    const toHit = parseInt((document.getElementById('cr-tohit') || {}).value, 10) || 0;
    const hitBonus = parseInt((document.getElementById('cr-hit-bonus') || {}).value, 10) || 0;
    const adv = readAdvMode();
    const forceCrit = !!(document.getElementById('cr-force-crit') && document.getElementById('cr-force-crit').checked);
    // Budget — session counter is hard gate on player popup
    try { if (typeof restoreTurnEconomy === 'function') restoreTurnEconomy(cb); } catch (e) {}
    try { if (typeof ensureCombatantTurnState === 'function') ensureCombatantTurnState(cb, null); } catch (e) {}
    const atkMaxGate = Math.max(1, Number(cb.attacksMax) || 1);
    const sessGate = typeof getSessionAttacksUsed === 'function' ? getSessionAttacksUsed(cb) : 0;
    if (sessGate >= atkMaxGate) {
      try { toast('No weapon attacks left this turn (' + sessGate + '/' + atkMaxGate + ')'); } catch (e) {}
      try { if (typeof applyRollAttackButtonState === 'function') applyRollAttackButtonState(document, cb); } catch (e) {}
      return;
    }
    if (typeof canRollWeaponAttack === 'function' && !canRollWeaponAttack(cb)) {
      try { toast('No actions / weapon attacks left this turn'); } catch (e) {}
      return;
    }
    if (typeof spendMainCombatAction === 'function') {
      if (!spendMainCombatAction(cb, 'attack', 'Attack')) {
        try { toast('No actions left — cannot Attack'); } catch (e) {}
        return;
      }
    } else {
      // Fallback spend if helper missing
      cb.attacksUsed = (Number(cb.attacksUsed) || 0) + 1;
      cb.actionsUsed = Math.max(1, Number(cb.actionsUsed) || 0);
      try { bumpSessionAttacksUsed(cb); } catch (e) {}
    }
    try {
      if (typeof persistTurnEconomy === 'function') persistTurnEconomy(cb);
    } catch (e) {}
    try {
      if (typeof refreshTurnEconomyUI === 'function') refreshTurnEconomyUI(cb);
    } catch (e) {}
    try {
      if (typeof applyRollAttackButtonState === 'function') applyRollAttackButtonState(document, cb);
    } catch (e) {}
    const res = rollCombatAttack({
      adv: adv,
      toHit: toHit,
      hitBonus: hitBonus,
      damage: '0',
      dmgBonus: 0,
      forceCrit: forceCrit,
      attackOnly: true
    });
    let acVal = parseInt((document.getElementById('cr-ac') || {}).value, 10);
    try {
      const c = getActive();
      const combat = c ? getCombat(c) : null;
      const sel = document.getElementById('cr-target');
      if (sel && sel.selectedOptions && sel.selectedOptions.length && combat) {
        const idx = parseInt(sel.selectedOptions[0].value, 10);
        const tgt = combat.combatants[idx];
        if (tgt && tgt.ac != null && (isNaN(acVal) || acVal === 0)) {
          acVal = parseInt(tgt.ac, 10);
          const acInput = document.getElementById('cr-ac');
          if (acInput && !acInput.value) acInput.value = String(acVal);
        }
      }
    } catch (e) {}
    let hits = false;
    let hitLine = '';
    if (!isNaN(acVal)) {
      hits = res.isFumble ? false : (res.isCrit || res.hitTotal >= acVal);
      hitLine = hits ? (' · HIT vs AC ' + acVal) : (' · MISS vs AC ' + acVal);
    } else {
      hitLine = ' · set Target AC to resolve hit';
      hits = false;
    }
    const dmgEl = document.getElementById('cr-dmg');
    const dmgBonusEl = document.getElementById('cr-dmg-bonus');
    const rollHtml = '<div><strong>' + (atkName || 'Attack') + '</strong> · ' + (res.note || '') + '</div>'
      + '<div>To hit: <strong>' + res.formula + '</strong>'
      + (res.isCrit ? ' · CRIT' : '') + (res.isFumble ? ' · FUMBLE' : '') + hitLine + '</div>'
      + '<div class="muted">' + (hits ? 'Damage Roll is ready.' : 'Miss — Damage Roll locked.') + '</div>';
    try { window.__pendingDiceFaces = (res.faces && res.faces.length) ? res.faces : [{ sides: 20, value: res.used }]; } catch (e) {}
    try { if (typeof publishCombatRollResult === 'function') publishCombatRollResult(rollHtml, cb); } catch (e) {}
    var snapTargetIds = [];
    var snapTargetIdxs = [];
    try {
      var selSnap = document.getElementById('cr-target');
      var listSnap = [];
      try {
        var cSnap = getActive();
        listSnap = (getCombat(cSnap).combatants || []);
      } catch (eS) {}
      if (selSnap) {
        [...selSnap.selectedOptions].forEach(function(o) {
          var ix = parseInt(o.value, 10);
          if (!isNaN(ix)) {
            snapTargetIdxs.push(ix);
            if (listSnap[ix]) snapTargetIds.push(String(listSnap[ix].id || listSnap[ix].name));
          }
        });
      }
      if (snapTargetIds.length) window.__crSelectedTargetIds = snapTargetIds.slice();
    } catch (eS2) {}
    window.__lastCombatRoll = {
      damage: 0,
      heal: 0,
      hit: hits,
      isCrit: !!res.isCrit,
      isFumble: !!res.isFumble,
      hitTotal: res.hitTotal,
      ac: acVal,
      canDamage: hits,
      name: atkName,
      dmgExpr: (dmgEl && dmgEl.value) || '1d8',
      dmgBonus: parseInt((dmgBonusEl || {}).value, 10) || 0,
      toHit: toHit,
      hitBonus: hitBonus,
      adv: adv,
      targetIds: snapTargetIds,
      targetIdxs: snapTargetIdxs
    };
    try {
      const rollPanel = typeof getCombatRollPanel === 'function' ? getCombatRollPanel() : null;
      if (typeof setDamageRollEnabled === 'function') {
        setDamageRollEnabled(rollPanel, !!hits, hits ? 'Roll damage and apply' : 'Hit the target AC first');
      } else {
        (rollPanel || document).querySelectorAll('#cr-roll-dmg').forEach(btn => {
          btn.disabled = !hits;
          if (hits) { btn.removeAttribute('disabled'); btn.classList.add('is-ready'); }
          else { btn.setAttribute('disabled', 'disabled'); btn.classList.remove('is-ready'); }
        });
      }
    } catch (e) {}
    try {
      if (typeof setDamageRollEnabled === 'function') setDamageRollEnabled(document, hits, hits ? '' : 'Attack missed AC');
    } catch (e) {}
    try { if (typeof persistTurnEconomy === 'function') persistTurnEconomy(cb); } catch (e) {}
    try { if (typeof save === 'function') save(); } catch (e) {}
    // Sync roll gate + economy to other windows
    try {
      const payload = {
        type: 'vtt-combat-roll',
        room: (typeof getVttRoomCode === 'function' ? getVttRoomCode() : '') || sessionStorage.getItem('vtt_room') || '',
        at: Date.now(),
        clientId: window.__vttClientId || null,
        from: (typeof isPlayerRole === 'function' && isPlayerRole()) ? 'player' : 'dm',
        lastCombatRoll: window.__lastCombatRoll,
        attackerId: cb.id || cb.name,
        economy: { actionsUsed: cb.actionsUsed, attacksUsed: cb.attacksUsed, actionsMax: cb.actionsMax, attacksMax: cb.attacksMax }
      };
      localStorage.setItem('cybervlachos_vtt_combat_roll', JSON.stringify(payload));
      const ch = typeof getVttChannel === 'function' ? getVttChannel() : null;
      if (ch) ch.postMessage(payload);
      if (window.__mapBc) window.__mapBc.postMessage(payload);
    } catch (e) {}
    try { toast((atkName || 'Attack') + ': ' + res.formula + hitLine); } catch (e) {}
    try { if (typeof persistTurnEconomy === 'function') persistTurnEconomy(cb); } catch (e) {}
    try { if (typeof refreshTurnEconomyUI === 'function') refreshTurnEconomyUI(cb); } catch (e) {}
    // Player popup: full panel rebuild so Action / Weapon attacks numbers always refresh
    try {
      if (typeof isPlayerRole === 'function' && isPlayerRole()) {
        if (typeof renderPlayerCombatPanel === 'function') renderPlayerCombatPanel();
        if (typeof refreshTurnEconomyUI === 'function') refreshTurnEconomyUI(cb);
      }
    } catch (e) {}
    // DM: re-assert Damage Roll enable after save/broadcast may have rebuilt the panel
    try {
      var lastHit = window.__lastCombatRoll || {};
      if (lastHit.canDamage === true && lastHit.applied !== true) {
        setTimeout(function() {
          try {
            var p = typeof getCombatRollPanel === 'function' ? getCombatRollPanel() : document;
            if (typeof setDamageRollEnabled === 'function') setDamageRollEnabled(p, true, 'Roll damage and apply');
            document.querySelectorAll('#cr-roll-dmg').forEach(function(btn) {
              btn.disabled = false;
              btn.removeAttribute('disabled');
              btn.classList.add('is-ready');
            });
          } catch (e2) {}
        }, 50);
        setTimeout(function() {
          try {
            var last2 = window.__lastCombatRoll || {};
            if (last2.canDamage !== true || last2.applied === true) return;
            document.querySelectorAll('#cr-roll-dmg').forEach(function(btn) {
              btn.disabled = false;
              btn.removeAttribute('disabled');
              btn.classList.add('is-ready');
            });
          } catch (e3) {}
        }, 200);
      }
    } catch (e) {}
    try {
      if (typeof isPlayerRole === 'function' && isPlayerRole() && typeof playerPersistAndSyncCombat === 'function') {
        playerPersistAndSyncCombat();
      } else if (typeof save === 'function') {
        save();
      }
    } catch (e) {}
    // Economy ping both directions
    try {
      var econMsg = {
        type: 'vtt-economy',
        room: (typeof getVttRoomCode === 'function' ? getVttRoomCode() : '') || '',
        at: Date.now(),
        id: cb.id,
        name: cb.name,
        attacksUsed: Number(cb.attacksUsed) || 0,
        attacksMax: Number(cb.attacksMax) || 1,
        actionsUsed: Number(cb.actionsUsed) || 0,
        actionsMax: Number(cb.actionsMax) || 1,
        actionUsed: !!cb.actionUsed,
        turnPhase: cb.turnPhase || ''
      };
      localStorage.setItem('cybervlachos_vtt_economy', JSON.stringify(econMsg));
      try {
        var ch = typeof getVttChannel === 'function' ? getVttChannel() : null;
        if (ch) ch.postMessage(econMsg);
      } catch (e2) {}
    } catch (e) {}
    try {
      setTimeout(function() {
        try { if (typeof refreshTurnEconomyUI === 'function') refreshTurnEconomyUI(cb); } catch (e) {}
        try {
          if (typeof isPlayerRole === 'function' && isPlayerRole() && typeof renderPlayerCombatPanel === 'function') {
            renderPlayerCombatPanel();
            if (typeof refreshTurnEconomyUI === 'function') refreshTurnEconomyUI(cb);
          }
        } catch (e) {}
      }, 40);
    } catch (e) {}
  }
  function runDelegatedDamageRoll() {
    // Prevent double-fire (capture + panel / double click) applying damage twice
    if (window.__dmgRollLock) return;
    window.__dmgRollLock = true;
    setTimeout(function() { window.__dmgRollLock = false; }, 600);
    const last = window.__lastCombatRoll || {};
    if (last.applied) {
      try { toast('Damage already applied — Roll Attack again to hit'); } catch (e) {}
      try {
        document.querySelectorAll('#cr-roll-dmg').forEach(btn => {
          btn.disabled = true;
          btn.setAttribute('disabled', 'disabled');
          btn.classList.remove('is-ready');
        });
      } catch (e) {}
      return;
    }
    // Only allow when this hit still has an open damage gate (not merely historical hit)
    let allowed = last.canDamage === true;
    if (!allowed) {
      try { toast('Score a hit with Roll Attack first'); } catch (e) {}
      return;
    }
    const cb = activeCombatantForRoll();
    const expr = (document.getElementById('cr-dmg') && document.getElementById('cr-dmg').value) || last.dmgExpr || '1d8';
    let dmg = rollDieExpr(expr);
    const bonus = parseInt((document.getElementById('cr-dmg-bonus') || {}).value, 10) || last.dmgBonus || 0;
    let faces = (dmg.faces || []).slice();
    if (last.isCrit) {
      const dmg2 = rollDieExpr(expr);
      faces = faces.concat(dmg2.faces || []);
      dmg = { total: dmg.total + dmg2.total, detail: dmg.detail + ' + crit ' + dmg2.detail, faces: faces, expr: dmg.expr };
    }
    const exprHasBonus = /[+-]\d+$/.test(String(expr).replace(/\s+/g, ''));
    let total = exprHasBonus ? dmg.total : (dmg.total + bonus);
    const halfBox = !!(document.getElementById('cr-half') && document.getElementById('cr-half').checked);
    const rollHtml = '<div><strong>' + (last.name || 'Attack') + '</strong> · Damage Roll' + (last.isCrit ? ' (CRIT)' : '') + ' · ' + (dmg.expr || expr) + '</div>'
      + '<div>Damage: <strong>' + total + '</strong> <span class="muted">(' + dmg.detail + ')</span></div>';
    try { window.__pendingDiceFaces = faces.length ? faces : null; } catch (e) {}
    try { if (typeof publishCombatRollResult === 'function') publishCombatRollResult(rollHtml, cb); } catch (e) {}
    window.__lastCombatRoll = Object.assign({}, last, { damage: total, heal: 0, hit: true, canDamage: true, applied: false });
    const applyAmt = document.getElementById('cr-apply-amt');
    if (applyAmt) applyAmt.value = String(total);
    // Targets
    let packs = [];
    try {
      const c = getActive();
      const combat = c ? getCombat(c) : null;
      const list = (combat && combat.combatants) || [];
      const sel = document.getElementById('cr-target');
      if (sel) {
        [...sel.selectedOptions].forEach(o => {
          const idx = parseInt(o.value, 10);
          if (!isNaN(idx) && list[idx]) packs.push({ combat: combat, idx: idx, target: list[idx] });
        });
      }
      if (!packs.length && combat) {
        const last = window.__lastCombatRoll || {};
        const ids = (last.targetIds && last.targetIds.length) ? last.targetIds : (window.__crSelectedTargetIds || []);
        const idxs = last.targetIdxs || [];
        if (ids && ids.length) {
          list.forEach(function(x, idx) {
            if (!x) return;
            if (ids.indexOf(String(x.id)) !== -1 || ids.indexOf(String(x.name)) !== -1) {
              packs.push({ combat: combat, idx: idx, target: x });
            }
          });
        }
        if (!packs.length && idxs && idxs.length) {
          idxs.forEach(function(ix) {
            if (list[ix]) packs.push({ combat: combat, idx: ix, target: list[ix] });
          });
        }
      }
      if (!packs.length && combat) {
        let tIdx = -1;
        if (combat.selectedIndex != null && list[combat.selectedIndex] && (!cb || String(list[combat.selectedIndex].id) !== String(cb.id))) {
          tIdx = combat.selectedIndex;
        }
        if (tIdx < 0) {
          tIdx = list.findIndex(x => {
            const s = String(x.side || '').toLowerCase();
            return s === 'enemy' || s === 'villain' || s === 'enemies';
          });
        }
        if (tIdx < 0) tIdx = list.findIndex(x => !cb || String(x.id) !== String(cb.id));
        if (tIdx >= 0) packs.push({ combat: combat, idx: tIdx, target: list[tIdx] });
      }
    } catch (e) {}
    if (!packs.length) {
      try { toast('Damage rolled (' + total + ') — select target(s) in the list, then Damage Roll again'); } catch (e) {}
      // Keep canDamage open so DM/player can pick a target and retry
      window.__lastCombatRoll = Object.assign({}, window.__lastCombatRoll || {}, {
        damage: total, heal: 0, hit: true, canDamage: true, applied: false
      });
      try {
        document.querySelectorAll('#cr-roll-dmg').forEach(function(btn) {
          btn.disabled = false;
          btn.removeAttribute('disabled');
          btn.classList.add('is-ready');
        });
      } catch (e) {}
      return;
    }
    const attackerName = (cb && cb.name) || 'Attacker';
    const logLines = [];
    packs.forEach(({ target }) => {
      let amt = typeof computeAppliedDamage === 'function' ? computeAppliedDamage(total, target, { half: halfBox }) : total;
      if (halfBox && typeof computeAppliedDamage !== 'function') amt = Math.floor(total / 2);
      let left = amt;
      const temp = Number(target.tempHp) || 0;
      if (temp > 0) {
        const absorb = Math.min(temp, left);
        target.tempHp = temp - absorb;
        left -= absorb;
      }
      const beforeHp = Number(target.hp) || 0;
      target.hp = Math.max(0, beforeHp - left);
      // Public log: never reveal current/max HP (FoW / hide-HP)
      const line = attackerName + ' deals ' + amt + ' damage to ' + (target.name || 'target')
        + (halfBox ? ' [half]' : '');
      logLines.push(line);
      // Only shared log once (avoid duplicate lines from appendLog + shared)
      try {
        if (typeof appendSharedCombatLog === 'function') {
          appendSharedCombatLog(line, {
            names: [attackerName, target.name],
            ids: [cb && cb.id, target.id]
          });
        } else if (typeof appendLog === 'function') {
          appendLog(line);
        }
      } catch (e) {}
      // Concentration on real HP loss (force-detect from flag, conditions string/array, UI label)
      if (left > 0) {
        try {
          // Pull freshest concentrating flag from combat list by id/name (player window may lag DM checkbox)
          var cFresh = typeof getActive === 'function' ? getActive() : null;
          var combatFresh = cFresh && typeof getCombat === 'function' ? getCombat(cFresh) : null;
          if (combatFresh && combatFresh.combatants) {
            var src = combatFresh.combatants.find(function(x) {
              return x && (String(x.id) === String(target.id) || x.name === target.name);
            });
            if (src) {
              if (src.concentrating) target.concentrating = src.concentrating;
              if (src.conditions != null) target.conditions = src.conditions;
              if (src.legendaryResist != null) target.legendaryResist = src.legendaryResist;
              if (src.legendaryResistMax != null) target.legendaryResistMax = src.legendaryResistMax;
            }
          }
        } catch (e) {}
        var isCon = false;
        try {
          isCon = typeof isConcentratingCombatant === 'function' ? isConcentratingCombatant(target) : !!target.concentrating;
        } catch (e) { isCon = !!target.concentrating; }
        // Also treat explicit UI condition text
        if (!isCon) {
          try {
            var blob = JSON.stringify(target.conditions || '') + ' ' + String(target.concentrating || '');
            if (/concentrat/i.test(blob)) isCon = true;
          } catch (e) {}
        }
        if (isCon) {
          try {
            if (typeof concentrationCheck === 'function') concentrationCheck(target, left);
            else console.warn('concentrationCheck missing');
          } catch (e) { console.warn('concentrationCheck', e); }
        }
      }
      if (target.hp === 0) {
        target.deathSaves = target.deathSaves || { successes: 0, failures: 0 };
      }
    });
    window.__lastCombatRoll = Object.assign({}, window.__lastCombatRoll || {}, {
      applied: true,
      canDamage: false,
      hit: false,
      damage: total
    });
    try {
      document.querySelectorAll('#cr-roll-dmg').forEach(btn => {
        btn.disabled = true;
        btn.setAttribute('disabled', 'disabled');
        btn.classList.remove('is-ready');
        btn.title = 'Roll Attack again to hit';
      });
    } catch (e) {}
    try { if (typeof setDamageRollEnabled === 'function') setDamageRollEnabled(document, false, 'Roll Attack again to hit'); } catch (e) {}
    // Persist HP + economy without wiping attack budget
    try {
      if (cb && typeof persistTurnEconomy === 'function') persistTurnEconomy(cb);
    } catch (e) {}
    try {
      if (typeof isPlayerRole === 'function' && isPlayerRole() && typeof playerPersistAndSyncCombat === 'function') {
        playerPersistAndSyncCombat();
      } else if (typeof save === 'function') {
        save();
      }
    } catch (e) {}
    try {
      const payload = {
        type: 'vtt-combat-roll',
        room: (typeof getVttRoomCode === 'function' ? getVttRoomCode() : '') || sessionStorage.getItem('vtt_room') || '',
        at: Date.now(),
        clientId: window.__vttClientId || null,
        from: (typeof isPlayerRole === 'function' && isPlayerRole()) ? 'player' : 'dm',
        lastCombatRoll: window.__lastCombatRoll,
        logLines: logLines,
        hpUpdates: packs.map(p => ({
          id: p.target.id,
          name: p.target.name,
          hp: p.target.hp,
          hpMax: p.target.hpMax,
          tempHp: p.target.tempHp,
          concentrating: p.target.concentrating
        }))
      };
      localStorage.setItem('cybervlachos_vtt_combat_roll', JSON.stringify(payload));
      const ch = typeof getVttChannel === 'function' ? getVttChannel() : null;
      if (ch) ch.postMessage(payload);
      if (window.__mapBc) window.__mapBc.postMessage(payload);
    } catch (e) {}
    try { toast('Damage applied: ' + total); } catch (e) {}
    // Refresh rosters / map / combat list — do NOT rebuild player roller (keeps budget + hit gate)
    try {
      if (typeof renderCombat === 'function') renderCombat();
      if (typeof renderMapRoster === 'function') renderMapRoster();
      if (typeof paintMapFrame === 'function') paintMapFrame();
      if (typeof refreshTurnEconomyUI === 'function' && cb) refreshTurnEconomyUI(cb);
      if (typeof renderSharedCombatLog === 'function') renderSharedCombatLog();
    } catch (e) {}
  }
  function applyCombatRollMessage(msg) {
    if (!msg || msg.type !== 'vtt-combat-roll') return;
    if (msg.clientId && window.__vttClientId && msg.clientId === window.__vttClientId) return;
    try {
      // Do NOT copy canDamage / enable Damage Roll from another window —
      // that was enabling the player's Damage Roll when the DM scored a hit (and vice versa).
      if (msg.lastCombatRoll) {
        var remote = msg.lastCombatRoll;
        // Keep shared display fields only; never open this client's damage gate from remote
        window.__lastCombatRoll = Object.assign({}, window.__lastCombatRoll || {}, {
          // preserve LOCAL gate
          canDamage: (window.__lastCombatRoll && window.__lastCombatRoll.canDamage) || false,
          applied: (window.__lastCombatRoll && window.__lastCombatRoll.applied) || false,
          hit: (window.__lastCombatRoll && window.__lastCombatRoll.hit) || false,
          // optional display of remote roll text handled elsewhere
          remoteName: remote.name,
          remoteHitTotal: remote.hitTotal,
          remoteAc: remote.ac
        });
      }
      if (msg.hpUpdates && msg.hpUpdates.length) {
        const c = getActive();
        const combat = c ? getCombat(c) : null;
        const list = (combat && combat.combatants) || [];
        msg.hpUpdates.forEach(u => {
          const t = list.find(x => String(x.id) === String(u.id) || String(x.name) === String(u.name));
          if (t) {
            if (u.hp != null) t.hp = u.hp;
            if (u.hpMax != null) t.hpMax = u.hpMax;
            if (u.tempHp != null) t.tempHp = u.tempHp;
            if (u.concentrating !== undefined) t.concentrating = u.concentrating;
          }
        });
        try { if (typeof save === 'function') save(); } catch (e) {}
        try { if (typeof renderCombat === 'function') renderCombat(); } catch (e) {}
        try { if (typeof renderMapRoster === 'function') renderMapRoster(); } catch (e) {}
        try { if (typeof paintMapFrame === 'function') paintMapFrame(); } catch (e) {}
      }
      // Log lines: skip if sharedLog merge will carry them (player→DM). Avoid double entries.
      if (msg.logLines && msg.logLines.length && msg.from !== 'player') {
        msg.logLines.forEach(function(line) {
          var text = String(line || '');
          text = text.replace(/\s*\(\s*\d+\s*[→\-]\s*\d+\s*\/\s*\d+\s*\)/g, '');
          text = text.replace(/\s*\(\s*\d+\s*→\s*\d+\s*\)/g, '');
          try {
            if (typeof appendSharedCombatLog === 'function') appendSharedCombatLog(text, {});
            else if (typeof appendLog === 'function') appendLog(text);
          } catch (e) {}
        });
        try { if (typeof renderSharedCombatLog === 'function') renderSharedCombatLog(); } catch (e) {}
      }
      if (msg.economy && msg.attackerId) {
        const c = getActive();
        const combat = c ? getCombat(c) : null;
        const list = (combat && combat.combatants) || [];
        const atk = list.find(x => String(x.id) === String(msg.attackerId) || String(x.name) === String(msg.attackerId));
        if (atk && msg.economy) {
          if (msg.economy.actionsUsed != null) atk.actionsUsed = Math.max(Number(atk.actionsUsed) || 0, Number(msg.economy.actionsUsed) || 0);
          if (msg.economy.attacksUsed != null) atk.attacksUsed = Math.max(Number(atk.attacksUsed) || 0, Number(msg.economy.attacksUsed) || 0);
          if (msg.economy.actionsMax != null) atk.actionsMax = Math.max(Number(atk.actionsMax) || 1, Number(msg.economy.actionsMax) || 1);
          if (msg.economy.attacksMax != null) atk.attacksMax = Math.max(Number(atk.attacksMax) || 1, Number(msg.economy.attacksMax) || 1);
          try { if (typeof refreshTurnEconomyUI === 'function') refreshTurnEconomyUI(atk); } catch (e) {}
          try {
            // DM detail panel may show selected combatant
            if (!(typeof isPlayerRole === 'function' && isPlayerRole())) {
              if (typeof showCombatDetail === 'function' && combat && list[combat.selectedIndex] === atk) {
                /* avoid full rebuild mid-player-roll; numbers updated above */
              } else if (typeof renderCombat === 'function') {
                /* light: only refresh if this combatant is selected */
                try {
                  const sel = combat && combat.selectedIndex != null ? list[combat.selectedIndex] : null;
                  if (sel && (String(sel.id) === String(atk.id) || sel.name === atk.name)) {
                    showCombatDetail(sel);
                  }
                } catch (e2) {}
              }
            }
          } catch (e) {}
        }
      }
    } catch (e) { console.warn('applyCombatRollMessage', e); }
  }
  if (!window.__combatRollDelegated) {
    window.__combatRollDelegated = true;
    document.addEventListener('click', function combatRollDelegate(ev) {
      const t = ev.target;
      if (!t || !t.closest) return;
      const dmgBtn = t.closest('#cr-roll-dmg');
      const atkBtn = t.closest('#cr-roll-btn');
      if (atkBtn) {
        // Capture phase single handler — prevents panel double-fire / freeze
        ev.preventDefault();
        ev.stopPropagation();
        try { ev.stopImmediatePropagation(); } catch (e) {}
        runDelegatedAttackRoll();
        return;
      }
      if (dmgBtn) {
        ev.preventDefault();
        ev.stopPropagation();
        try { ev.stopImmediatePropagation(); } catch (e) {}
        const last = window.__lastCombatRoll || {};
        // Strict: only an open, unapplied hit gate allows Damage Roll
        if (last.canDamage !== true || last.applied === true) {
          try { if (typeof toast === 'function') toast('Score a hit with Roll Attack first'); } catch (e) {}
          try {
            dmgBtn.disabled = true;
            dmgBtn.setAttribute('disabled', 'disabled');
            dmgBtn.classList.remove('is-ready');
          } catch (e) {}
          return;
        }
        if (dmgBtn.disabled) {
          dmgBtn.disabled = false;
          dmgBtn.removeAttribute('disabled');
        }
        runDelegatedDamageRoll();
        return;
      }
    }, true);
    window.addEventListener('storage', function(ev) {
      if (ev.key === 'cybervlachos_vtt_combat_roll' && ev.newValue) {
        try { applyCombatRollMessage(JSON.parse(ev.newValue)); } catch (e) {}
      }
    }, true);
    try {
      const ch = typeof getVttChannel === 'function' ? getVttChannel() : null;
      if (ch && !window.__combatRollChBound) {
        window.__combatRollChBound = true;
        ch.addEventListener('message', function(ev) {
          if (ev && ev.data && ev.data.type === 'vtt-combat-roll') applyCombatRollMessage(ev.data);
        });
      }
    } catch (e) {}
  }


  function restoreDamageRollButtonState(root) {
    try {
      const last = window.__lastCombatRoll || {};
      let ok = !!(last.canDamage || last.hit || last.isCrit);
      if (!ok && last.hitTotal != null && last.ac != null && !isNaN(Number(last.ac)) && !last.isFumble) {
        if (Number(last.hitTotal) >= Number(last.ac)) ok = true;
      }
      const scope = root && root.querySelectorAll ? root : document;
      scope.querySelectorAll('#cr-roll-dmg').forEach(btn => {
        if (ok) {
          btn.disabled = false;
          btn.removeAttribute('disabled');
          btn.classList.add('is-ready');
          btn.title = 'Roll damage and apply to selected target(s)';
        }
      });
    } catch (e) {}
  }

  function setDamageRollEnabled(panel, enabled, reason) {
    try {
      // Scope to the roller panel when provided so DM/player UIs never cross-toggle
      const roots = [];
      if (panel && panel.querySelector) roots.push(panel);
      else {
        const p = typeof getCombatRollPanel === 'function' ? getCombatRollPanel() : null;
        if (p) roots.push(p);
        roots.push(document);
      }
      const seen = new Set();
      roots.forEach(root => {
        root.querySelectorAll('#cr-roll-dmg, [data-roll-dmg]').forEach(btn => {
          if (seen.has(btn)) return;
          seen.add(btn);
          if (enabled) {
            btn.disabled = false;
            btn.removeAttribute('disabled');
            btn.classList.add('is-ready');
            btn.title = 'Roll damage and apply to selected target(s)';
          } else {
            btn.disabled = true;
            btn.setAttribute('disabled', 'disabled');
            btn.classList.remove('is-ready');
            btn.title = reason || 'Hit the target AC first';
          }
        });
      });
    } catch (e) {}
  }

  function targetHasDamageResistance(target, dmgType) {
    if (!target) return false;
    const blob = JSON.stringify(target).toLowerCase();
    // Rage / resistance keywords
    if (/\braging\b|\brage\b/.test(blob) && (!dmgType || /bludgeoning|piercing|slashing|weapon/.test(String(dmgType).toLowerCase()))) {
      // PHB Rage: resistance to bludgeoning/piercing/slashing while raging
      return true;
    }
    if (target.resistances) {
      const r = Array.isArray(target.resistances) ? target.resistances.join(' ') : String(target.resistances);
      if (/all|weapon|nonmagical/i.test(r)) return true;
      if (dmgType && r.toLowerCase().includes(String(dmgType).toLowerCase())) return true;
    }
    if (target.conditions) {
      const c = Array.isArray(target.conditions) ? target.conditions.join(' ') : String(target.conditions);
      if (/\brage\b|\braging\b|\bresistant\b/i.test(c)) return true;
    }
    return false;
  }

  function computeAppliedDamage(baseAmt, target, opts) {
    opts = opts || {};
    let amt = Math.max(0, Number(baseAmt) || 0);
    const half = !!opts.half;
    if (half) amt = Math.floor(amt / 2);
    if (targetHasDamageResistance(target, opts.dmgType)) {
      amt = Math.floor(amt / 2);
    }
    // Vulnerability simple tag
    if (target && target.vulnerabilities) {
      const v = Array.isArray(target.vulnerabilities) ? target.vulnerabilities.join(' ') : String(target.vulnerabilities);
      if (opts.dmgType && v.toLowerCase().includes(String(opts.dmgType).toLowerCase())) amt = amt * 2;
    }
    return Math.max(0, amt);
  }


  function rollCombatAttack(opts) {
    const adv = opts.adv || 'normal';
    const hitBonus = Number(opts.hitBonus) || 0;
    const dmgBonus = Number(opts.dmgBonus) || 0;
    const toHit = opts.toHit != null ? Number(opts.toHit) : 0;
    const dmgExpr = opts.damage || '1d8';
    function d20() { return typeof rollFairDie === "function" ? rollFairDie(20) : (1 + Math.floor(Math.random() * 20)); }
    const r1 = d20();
    const r2 = d20();
    let used = r1;
    let note = '';
    let faces = [{ sides: 20, value: r1 }];
    if (adv === 'adv') {
      used = Math.max(r1, r2);
      note = `Advantage [${r1}, ${r2}] → ${used}`;
      faces = [{ sides: 20, value: r1 }, { sides: 20, value: r2 }];
    } else if (adv === 'dis') {
      used = Math.min(r1, r2);
      note = `Disadvantage [${r1}, ${r2}] → ${used}`;
      faces = [{ sides: 20, value: r1 }, { sides: 20, value: r2 }];
    } else {
      note = `d20=${used}`;
      faces = [{ sides: 20, value: used }];
    }
    const hitTotal = used + toHit + hitBonus;
    const isCrit = !!opts.forceCrit || used === 20;
    const isFumble = !opts.forceCrit && used === 1;
    let dmg = { total: 0, detail: '—' };
    if (!opts.attackOnly && dmgExpr && dmgExpr !== '0') {
      dmg = rollDieExpr(dmgExpr);
      if (isCrit) {
        const dmg2 = rollDieExpr(dmgExpr);
        dmg = { total: dmg.total + dmg2.total, detail: dmg.detail + ' + crit ' + dmg2.detail };
      }
    }
    const formula = `${used}${toHit || hitBonus ? (toHit + hitBonus >= 0 ? '+' : '') + (toHit + hitBonus) : ''} = ${hitTotal}`;
    return {
      hitTotal, used, r1, r2, adv, faces, note, isCrit, isFumble, toHit, hitBonus,
      formula: formula,
      dmgTotal: dmg.total + (opts.attackOnly ? 0 : dmgBonus),
      dmgDetail: dmg.detail + (!opts.attackOnly && dmgBonus ? ((dmgBonus >= 0 ? '+' : '') + dmgBonus) : '')
    };
  }


  // ═══════════════════════════════════════════════════════════════════════════
  // Combat mechanics expansion: conditions, damage types, death saves, rests,
  // legendary resistance, grapple/shove, concentration, resistances
  // ═══════════════════════════════════════════════════════════════════════════

  const CONDITION_RULES = {
    blinded: { label: 'Blinded', attackDis: true, attackedAdv: true, speedMult: 1 },
    charmed: { label: 'Charmed', notes: 'Cannot attack charmer' },
    deafened: { label: 'Deafened' },
    frightened: { label: 'Frightened', attackDis: true, notes: 'Disadv while source in sight' },
    grappled: { label: 'Grappled', speedMult: 0 },
    incapacitated: { label: 'Incapacitated', noActions: true, breaksConcentration: true },
    invisible: { label: 'Invisible', attackAdv: true, attackedDis: true },
    paralyzed: { label: 'Paralyzed', noActions: true, speedMult: 0, autoFailStrDex: true, attackedAdv: true, critMelee: true, breaksConcentration: true },
    petrified: { label: 'Petrified', noActions: true, speedMult: 0, resistAll: true, breaksConcentration: true },
    poisoned: { label: 'Poisoned', attackDis: true },
    prone: { label: 'Prone', attackDis: true, attackedAdvMelee: true, attackedDisRanged: true, notes: 'Crawl or stand (half move)' },
    restrained: { label: 'Restrained', speedMult: 0, attackDis: true, attackedAdv: true },
    stunned: { label: 'Stunned', noActions: true, autoFailStrDex: true, attackedAdv: true, breaksConcentration: true },
    unconscious: { label: 'Unconscious', noActions: true, speedMult: 0, autoFailStrDex: true, attackedAdv: true, critMelee: true, prone: true, breaksConcentration: true },
    exhausted: { label: 'Exhaustion', notes: 'Track level separately' },
    blessed: { label: 'Blessed', attackBonus: 4, notes: '+1d4 attacks/saves (approx +2)' },
    hasted: { label: 'Hasted', extraAttack: true, notes: 'Extra action (Attack/Dash/Disengage/Hide)' },
    raging: { label: 'Raging', notes: 'Rage damage & resistance as per class' },
    dodging: { label: 'Dodging', attackedDis: true },
    hiding: { label: 'Hidden', attackedDis: true },
    concentrating: { label: 'Concentrating', notes: 'Shown via concentrating field' }
  };

  function normalizeConditionList(cb) {
    if (!cb) return [];
    if (Array.isArray(cb.conditionList) && cb.conditionList.length) return cb.conditionList;
    const raw = cb.conditions;
    if (Array.isArray(raw)) return raw.map(c => typeof c === 'string' ? { id: c.toLowerCase(), name: c } : c);
    if (typeof raw === 'string' && raw.trim()) {
      return raw.split(/[,;]/).map(s => s.trim()).filter(Boolean).map(s => ({ id: s.toLowerCase(), name: s }));
    }
    return [];
  }

  function combatantHasCondition(cb, id) {
    const idn = String(id).toLowerCase();
    return normalizeConditionList(cb).some(c => (c.id || c.name || '').toLowerCase() === idn || (c.name || '').toLowerCase().includes(idn));
  }

  function addCondition(cb, name, rounds) {
    if (!cb) return;
    const id = String(name).toLowerCase().replace(/\s+/g, '-');
    const list = normalizeConditionList(cb);
    if (!list.some(c => (c.id || c.name || '').toLowerCase() === id)) {
      list.push({ id, name: CONDITION_RULES[id]?.label || name, rounds: rounds || 0 });
    }
    cb.conditionList = list;
    cb.conditions = list.map(c => c.name).join(', ');
    const rule = CONDITION_RULES[id];
    if (rule && rule.breaksConcentration) {
      cb.concentrating = false;
    }
    if (id === 'unconscious' || id === 'incapacitated' || id === 'paralyzed' || id === 'stunned') {
      cb.concentrating = false;
    }
  }

  function removeCondition(cb, name) {
    if (!cb) return;
    const id = String(name).toLowerCase().replace(/\s+/g, '-');
    cb.conditionList = normalizeConditionList(cb).filter(c => (c.id || c.name || '').toLowerCase() !== id && (c.name || '').toLowerCase() !== String(name).toLowerCase());
    cb.conditions = cb.conditionList.map(c => c.name).join(', ');
  }

  function getAttackModifiers(attacker, target, opts) {
    opts = opts || {};
    let adv = false, dis = false;
    const notes = [];
    if (combatantHasCondition(attacker, 'blinded') || combatantHasCondition(attacker, 'frightened') || combatantHasCondition(attacker, 'poisoned') || combatantHasCondition(attacker, 'prone') || combatantHasCondition(attacker, 'restrained')) {
      dis = true; notes.push('attacker condition → dis');
    }
    if (combatantHasCondition(attacker, 'invisible')) { adv = true; notes.push('invisible'); }
    if (combatantHasCondition(attacker, 'blessed')) notes.push('bless');
    if (combatantHasCondition(target, 'dodging') || combatantHasCondition(target, 'hiding')) { dis = true; notes.push('target dodge/hide'); }
    if (combatantHasCondition(target, 'blinded') || combatantHasCondition(target, 'paralyzed') || combatantHasCondition(target, 'restrained') || combatantHasCondition(target, 'stunned') || combatantHasCondition(target, 'unconscious')) {
      adv = true; notes.push('target helpless');
    }
    if (combatantHasCondition(target, 'prone')) {
      if (opts.ranged) { dis = true; notes.push('prone vs ranged'); }
      else { adv = true; notes.push('prone vs melee'); }
    }
    if (combatantHasCondition(target, 'invisible')) { dis = true; notes.push('target invisible'); }
    // Cover
    const cover = Number(target.cover) || 0; // 0, 2 half, 5 three-quarters
    return { adv, dis, cover, notes };
  }

  function rollD20WithAdv(adv, dis) {
    const a = 1 + Math.floor(Math.random() * 20);
    const b = 1 + Math.floor(Math.random() * 20);
    if (adv && !dis) return { used: Math.max(a, b), rolls: [a, b], mode: 'adv' };
    if (dis && !adv) return { used: Math.min(a, b), rolls: [a, b], mode: 'dis' };
    return { used: a, rolls: [a], mode: 'normal' };
  }

  function parseDamageTypesString(s) {
    return String(s || '').toLowerCase().split(/[,;]/).map(x => x.trim()).filter(Boolean);
  }

  function applyDamageTypeModifiers(target, amount, damageType) {
    let amt = Number(amount) || 0;
    const dt = String(damageType || '').toLowerCase();
    const resists = parseDamageTypesString(target.resistances);
    const immunes = parseDamageTypesString(target.immunities);
    const vulns = parseDamageTypesString(target.vulnerabilities);
    if (combatantHasCondition(target, 'petrified')) {
      // resistance to all non-magical typically - approximate resistance to all
      amt = Math.floor(amt / 2);
    }
    if (dt) {
      if (immunes.some(x => dt.includes(x) || x.includes(dt) || x === 'all')) return { amount: 0, note: 'immune' };
      if (resists.some(x => dt.includes(x) || x.includes(dt))) { amt = Math.floor(amt / 2); }
      if (vulns.some(x => dt.includes(x) || x.includes(dt))) { amt = amt * 2; }
    }
    // Raging resistance bludgeoning/piercing/slashing
    if (combatantHasCondition(target, 'raging') || target.raging) {
      if (/bludgeoning|piercing|slashing/.test(dt)) amt = Math.floor(amt / 2);
    }
    return { amount: amt, note: '' };
  }

  function applyDamageToCombatant(target, amount, opts) {
    opts = opts || {};
    let amt = Math.max(0, Number(amount) || 0);
    const dtype = opts.damageType || opts.type || '';
    if (opts.half) amt = Math.floor(amt / 2);
    const mod = applyDamageTypeModifiers(target, amt, dtype);
    amt = mod.amount;
    // Temp HP
    let left = amt;
    const temp = Number(target.tempHp) || 0;
    if (temp > 0 && left > 0) {
      const absorb = Math.min(temp, left);
      target.tempHp = temp - absorb;
      left -= absorb;
    }
    target.hp = Math.max(0, (Number(target.hp) || 0) - left);
    // Concentration
    if ((typeof isConcentratingCombatant === 'function' ? isConcentratingCombatant(target) : target.concentrating) && left > 0) {
      try { if (typeof concentrationCheck === 'function') concentrationCheck(target, left); } catch (e) { console.warn(e); }
    }
    // Death / unconscious
    if (target.hp <= 0) {
      target.hp = 0;
      target.deathSaves = target.deathSaves || { successes: 0, failures: 0 };
      if (opts.massive && (opts.rawDamage || amt) >= (target.hpMax || 1)) {
        target.dead = true;
        if (typeof appendLog === 'function') appendLog(`${target.name} dies instantly (massive damage)`);
      } else {
        addCondition(target, 'unconscious');
        addCondition(target, 'prone');
      }
    }
    return { applied: amt, remainingHp: target.hp };
  }

  function applyHealToCombatant(target, amount) {
    const amt = Math.max(0, Number(amount) || 0);
    const wasDying = (target.hp || 0) <= 0;
    target.hp = Math.min(target.hpMax || amt, (target.hp || 0) + amt);
    if (target.hp > 0) {
      target.deathSaves = { successes: 0, failures: 0 };
      target.dead = false;
      if (wasDying) {
        removeCondition(target, 'unconscious');
      }
    }
    return target.hp;
  }

  function rollDeathSave(cb) {
    if (!cb || cb.dead || (cb.hp || 0) > 0) return null;
    cb.deathSaves = cb.deathSaves || { successes: 0, failures: 0 };
    const r = 1 + Math.floor(Math.random() * 20);
    if (r === 1) {
      cb.deathSaves.failures = Math.min(3, (cb.deathSaves.failures || 0) + 2);
    } else if (r === 20) {
      cb.hp = 1;
      cb.deathSaves = { successes: 0, failures: 0 };
      removeCondition(cb, 'unconscious');
      if (typeof appendLog === 'function') appendLog(`${cb.name} death save 20 — regains 1 HP!`);
      return { roll: r, result: 'revive' };
    } else if (r >= 10) {
      cb.deathSaves.successes = Math.min(3, (cb.deathSaves.successes || 0) + 1);
    } else {
      cb.deathSaves.failures = Math.min(3, (cb.deathSaves.failures || 0) + 1);
    }
    if (cb.deathSaves.successes >= 3) {
      if (typeof appendLog === 'function') appendLog(`${cb.name} is stable`);
      cb.stable = true;
    }
    if (cb.deathSaves.failures >= 3) {
      cb.dead = true;
      if (typeof appendLog === 'function') appendLog(`${cb.name} has died`);
    }
    return { roll: r, successes: cb.deathSaves.successes, failures: cb.deathSaves.failures };
  }

  function useLegendaryResistance(cb) {
    if (!cb) return false;
    const max = Number(cb.legendaryResistMax != null ? cb.legendaryResistMax : cb.legendaryResist) || 0;
    let left = Number(cb.legendaryResist != null ? cb.legendaryResist : max);
    if (left <= 0) {
      if (typeof toast === 'function') toast('No Legendary Resistances left');
      return false;
    }
    cb.legendaryResist = left - 1;
    if (typeof appendLog === 'function') appendLog(`${cb.name} uses Legendary Resistance (${cb.legendaryResist} left)`);
    if (typeof toast === 'function') toast('Legendary Resistance — save succeeds');
    return true;
  }

  /* ===== Concentration: PC click-d20 / NPC auto+LR ===== */
  function isConcentratingCombatant(cb) {
    if (!cb) return false;
    if (cb.concentrating) return true;
    try {
      var conds = cb.conditions;
      if (typeof conds === 'string' && /concentrat/i.test(conds)) return true;
      if (Array.isArray(conds) && conds.some(function(c) {
        return /concentrat/i.test(String(c && (c.name || c) || ''));
      })) return true;
    } catch (e) {}
    if (cb.isConcentrating || cb.concentration) return true;
    return false;
  }
  function concentrationDcFromDamage(dmg) {
    return Math.max(10, Math.floor((Number(dmg) || 0) / 2));
  }
  function combatantConMod(cb) {
    if (!cb) return 0;
    if (cb.conMod != null) return Number(cb.conMod) || 0;
    try {
      var score = (cb.abilities && (cb.abilities.con || cb.abilities.CON))
        || (cb.stats && (cb.stats.con || cb.stats.CON));
      if (score != null) return Math.floor((Number(score) - 10) / 2);
    } catch (e) {}
    return 0;
  }
  function isPlayerCombatant(cb) {
    if (!cb) return false;
    var side = String(cb.side || cb.team || '').toLowerCase();
    if (side === 'enemy' || side === 'foe' || side === 'hostile' || side === 'villain') return false;
    if (side === 'pc' || side === 'ally' || side === 'player' || side === 'party') return true;
    if (cb.isPC || cb.isPlayer) return true;
    try {
      var c = typeof getActive === 'function' ? getActive() : null;
      if (c && Array.isArray(c.villains) && c.villains.some(function(v) {
        return v && (String(v.id) === String(cb.sourceId) || v.name === cb.name);
      })) return false;
      if (c && Array.isArray(c.party) && c.party.some(function(p) {
        return p && (String(p.id) === String(cb.sourceId) || String(p.id) === String(cb.charId) || p.name === cb.name);
      })) return true;
    } catch (e) {}
    return false;
  }
  function conLog(msg, cb) {
    try { if (typeof appendLog === 'function') appendLog(msg); } catch (e) {}
    try {
      if (typeof appendSharedCombatLog === 'function') {
        appendSharedCombatLog(msg, cb ? { names: [cb.name], ids: [cb.id] } : {});
      }
    } catch (e) {}
    try { if (typeof renderSharedCombatLog === 'function') renderSharedCombatLog(); } catch (e) {}
  }
  function dropConcentration(cb, reason) {
    if (!cb) return;
    cb.concentrating = false;
    cb.isConcentrating = false;
    cb.concentration = false;
    cb._concentrationSpell = null;
    try { if (typeof removeCondition === 'function') removeCondition(cb, 'concentrating'); } catch (e) {}
    try { if (typeof removeCondition === 'function') removeCondition(cb, 'Concentrating'); } catch (e) {}
    try {
      if (typeof cb.conditions === 'string') {
        cb.conditions = cb.conditions.split(/[,;]/).map(function(s) { return s.trim(); })
          .filter(function(s) { return s && !/concentrat/i.test(s); }).join(', ');
      } else if (Array.isArray(cb.conditions)) {
        cb.conditions = cb.conditions.filter(function(c) {
          return !/concentrat/i.test(String(c && (c.name || c) || ''));
        });
      }
    } catch (e) {}
    try {
      if (Array.isArray(cb.conditionList)) {
        cb.conditionList = cb.conditionList.filter(function(c) {
          return !/concentrat/i.test(String(c && (c.name || c.id || '') || ''));
        });
      }
    } catch (e) {}
    conLog((cb.name || 'Combatant') + ' loses concentration' + (reason ? ' (' + reason + ')' : ''), cb);
    try { if (typeof toast === 'function') toast((cb.name || 'Target') + ' loses concentration'); } catch (e) {}
  }
  function promptLegendaryResistanceForConcentration(cb, dc, total) {
    try { document.querySelectorAll('.con-check-overlay[data-lr]').forEach(function(el) { el.remove(); }); } catch (e) {}
    var left = typeof legendaryResistRemaining === 'function' ? legendaryResistRemaining(cb) : (Number(cb.legendaryResist) || 0);
    var overlay = document.createElement('div');
    overlay.className = 'con-check-overlay';
    overlay.setAttribute('data-lr', '1');
    overlay.innerHTML = '<div class="con-check-card"><div class="con-check-title">Legendary Resistance?</div>'
      + '<p><strong>' + (cb.name || 'NPC') + '</strong> failed concentration</p>'
      + '<p class="muted">Rolled <strong>' + total + '</strong> vs DC <strong>' + dc + '</strong></p>'
      + '<p class="muted small">' + left + ' LR left</p>'
      + '<div class="con-check-actions">'
      + '<button type="button" class="btn primary" data-lr="yes">Use Legendary Resistance</button>'
      + '<button type="button" class="btn danger" data-lr="no">Lose Concentration</button></div></div>';
    document.body.appendChild(overlay);
    conLog((cb.name || 'NPC') + ' failed concentration (' + total + ' vs DC ' + dc + ') — choose Legendary Resistance (' + left + ' left)', cb);
    overlay.addEventListener('click', function(ev) {
      var btn = ev.target && ev.target.closest && ev.target.closest('[data-lr]');
      if (!btn) return;
      if (btn.getAttribute('data-lr') === 'yes') {
        if (typeof useLegendaryResistance === 'function') useLegendaryResistance(cb);
        conLog((cb.name || 'NPC') + ' uses Legendary Resistance — concentration HELD', cb);
      } else if (btn.getAttribute('data-lr') === 'no') {
        dropConcentration(cb, 'failed DC ' + dc);
      } else return;
      try { overlay.remove(); } catch (e) {}
      try { if (typeof save === 'function') save(); } catch (e) {}
      try { if (typeof renderCombat === 'function') renderCombat(); } catch (e) {}
    });
  }
  function resolveConcentrationResult(cb, dc, total, opts) {
    opts = opts || {};
    var ok = total >= dc;
    if (ok) {
      conLog((cb.name || 'Combatant') + ' concentration save: ' + total + ' vs DC ' + dc + ' — SUCCESS (held)', cb);
      try { if (typeof toast === 'function') toast((cb.name || 'Target') + ' maintains concentration'); } catch (e) {}
      return true;
    }
    var lr = typeof legendaryResistRemaining === 'function' ? legendaryResistRemaining(cb) : (Number(cb.legendaryResist) || 0);
    if (!isPlayerCombatant(cb) && lr > 0 && !opts.skipLegendary) {
      promptLegendaryResistanceForConcentration(cb, dc, total);
      return false;
    }
    conLog((cb.name || 'Combatant') + ' concentration save: ' + total + ' vs DC ' + dc + ' — FAILED', cb);
    dropConcentration(cb, 'failed DC ' + dc);
    try {
      if (typeof isPlayerRole === 'function' && isPlayerRole() && typeof playerPersistAndSyncCombat === 'function') playerPersistAndSyncCombat();
      else if (typeof save === 'function') save();
    } catch (e) {}
    return false;
  }
  function showPlayerConcentrationPopup(cb, dc) {
    try { document.querySelectorAll('.con-check-overlay').forEach(function(el) { el.remove(); }); } catch (e) {}
    var conMod = combatantConMod(cb);
    var overlay = document.createElement('div');
    overlay.className = 'con-check-overlay';
    overlay.innerHTML = '<div class="con-check-card con-check-player">'
      + '<div class="con-check-title">Concentration Check</div>'
      + '<p><strong>' + (cb.name || 'You') + '</strong> — Constitution save</p>'
      + '<p class="con-check-dc">DC <strong>' + dc + '</strong> · CON ' + (conMod >= 0 ? '+' : '') + conMod + '</p>'
      + '<button type="button" class="con-d20-btn" id="con-d20-roll">d20</button>'
      + '<p class="muted small" id="con-d20-hint">Press the die to roll</p>'
      + '<div class="con-check-result" id="con-check-result" hidden></div></div>';
    document.body.appendChild(overlay);
    conLog((cb.name || 'PC') + ' concentration check DC ' + dc + ' — waiting for player d20', cb);
    var dieBtn = overlay.querySelector('#con-d20-roll');
    var rolling = false;
    dieBtn.addEventListener('click', function() {
      if (rolling) return;
      rolling = true;
      dieBtn.classList.add('spinning');
      var ticks = 0;
      var spin = setInterval(function() {
        dieBtn.textContent = String(1 + Math.floor(Math.random() * 20));
        ticks++;
        if (ticks < 12) return;
        clearInterval(spin);
        var r1 = 1 + Math.floor(Math.random() * 20);
        var total = r1 + conMod;
        dieBtn.textContent = String(r1);
        dieBtn.classList.remove('spinning');
        dieBtn.classList.add('revealed');
        var ok = total >= dc;
        var res = overlay.querySelector('#con-check-result');
        if (res) {
          res.hidden = false;
          res.innerHTML = '<strong>' + total + '</strong> vs DC ' + dc + ' — <span style="color:' + (ok ? '#8d8' : '#c66') + '">' + (ok ? 'SUCCESS' : 'FAILED') + '</span>';
        }
        setTimeout(function() {
          resolveConcentrationResult(cb, dc, total, { skipLegendary: true });
          // Force the live combatant in the combat list (popup cb can be stale)
          try {
            var cLive = typeof getActive === 'function' ? getActive() : null;
            var combatLive = cLive && typeof getCombat === 'function' ? getCombat(cLive) : null;
            var live = null;
            if (combatLive && combatLive.combatants) {
              live = combatLive.combatants.find(function(x) {
                return x && (String(x.id) === String(cb.id) || x.name === cb.name);
              });
            }
            if (live) {
              if (total < dc) {
                if (typeof dropConcentration === 'function') dropConcentration(live, 'failed DC ' + dc);
                else { live.concentrating = false; live.isConcentrating = false; }
              }
              cb.concentrating = live.concentrating;
            } else if (total < dc) {
              if (typeof dropConcentration === 'function') dropConcentration(cb, 'failed DC ' + dc);
              else cb.concentrating = false;
            }
          } catch (eForce) {}
          try {
            var payload = {
              type: 'vtt-con-result',
              room: (typeof getVttRoomCode === 'function' ? getVttRoomCode() : '') || sessionStorage.getItem('vtt_room') || '',
              at: Date.now(),
              targetId: cb.id || cb.name,
              targetName: cb.name,
              dc: dc,
              total: total,
              success: total >= dc && !!cb.concentrating,
              concentrating: !!cb.concentrating
            };
            if (total < dc) { payload.success = false; payload.concentrating = false; }
            localStorage.setItem('cybervlachos_vtt_con_result', JSON.stringify(payload));
            try {
              var ch = typeof getVttChannel === 'function' ? getVttChannel() : null;
              if (ch) ch.postMessage(payload);
            } catch (e2) {}
          } catch (e) {}
          try { overlay.remove(); } catch (e) {}
          try {
            if (typeof playerPersistAndSyncCombat === 'function') playerPersistAndSyncCombat();
            else if (typeof save === 'function') save();
          } catch (e) {}
          try {
            if (typeof renderPlayerCombatPanel === 'function') renderPlayerCombatPanel();
          } catch (e) {}
        }, 800);
      }, 55);
    });
  }
  function broadcastConcentrationRequest(cb, dc, damage) {
    try {
      var payload = {
        type: 'vtt-con-check',
        room: (typeof getVttRoomCode === 'function' ? getVttRoomCode() : '') || '',
        at: Date.now(),
        targetId: cb.id || cb.name,
        targetName: cb.name,
        dc: dc,
        damage: damage,
        conMod: combatantConMod(cb)
      };
      localStorage.setItem('cybervlachos_vtt_con_check', JSON.stringify(payload));
      try {
        var ch = typeof getVttChannel === 'function' ? getVttChannel() : null;
        if (ch) ch.postMessage(payload);
      } catch (e) {}
    } catch (e) {}
  }
  function concentrationCheck(target, damage) {
    if (!target || !isConcentratingCombatant(target)) return;
    try { ensureCombatantLR(target); } catch (e) {}
    var dmg = Number(damage) || 0;
    if (dmg <= 0) return;
    if (target.concentrating && target.concentrating !== true) {
      target._concentrationSpell = String(target.concentrating);
      target.concentrating = true;
    } else {
      target.concentrating = true;
    }
    var dc = concentrationDcFromDamage(dmg);
    var isPc = isPlayerCombatant(target);
    conLog((target.name || 'Combatant') + ' was hit for ' + dmg + ' while concentrating — Constitution save DC ' + dc, target);

    var mine = false;
    try {
      var claimed = typeof getClaimedCombatant === 'function' ? getClaimedCombatant() : null;
      if (claimed && (String(claimed.id) === String(target.id) || claimed.name === target.name)) mine = true;
    } catch (e) {}

    // Player window
    if (typeof isPlayerRole === 'function' && isPlayerRole()) {
      // Your PC → click-to-roll popup
      if (mine && isPc) {
        showPlayerConcentrationPopup(target, dc);
        return;
      }
      // Another PC → ask that player (via DM broadcast path)
      if (isPc && !mine) {
        broadcastConcentrationRequest(target, dc, dmg);
        conLog((target.name || 'PC') + ' concentration check DC ' + dc + ' — waiting for player', target);
        return;
      }
      // Enemy/NPC damaged by player: MUST resolve here (DM never sees the damage event)
      // Auto-roll; on fail with LR, auto-spend LR and log (DM sees via sync)
      var conModP = combatantConMod(target);
      var rP = 1 + Math.floor(Math.random() * 20);
      var totalP = rP + conModP;
      conLog((target.name || 'NPC') + ' rolls concentration: d20 (' + rP + ') + CON ' + (conModP >= 0 ? '+' : '') + conModP + ' = ' + totalP + ' vs DC ' + dc, target);
      var okP = totalP >= dc;
      if (okP) {
        conLog((target.name || 'NPC') + ' concentration save: ' + totalP + ' vs DC ' + dc + ' — SUCCESS (held)', target);
      } else {
        var lrP = typeof legendaryResistRemaining === 'function' ? legendaryResistRemaining(target) : (Number(target.legendaryResist) || 0);
        if (lrP > 0 && typeof useLegendaryResistance === 'function') {
          useLegendaryResistance(target);
          conLog((target.name || 'NPC') + ' fails concentration (' + totalP + ' vs DC ' + dc + ') — Legendary Resistance used — HELD', target);
        } else {
          conLog((target.name || 'NPC') + ' concentration save: ' + totalP + ' vs DC ' + dc + ' — FAILED', target);
          dropConcentration(target, 'failed DC ' + dc);
        }
      }
      // Push outcome + log to DM (so NPC concentration appears on DM log)
      try {
        var payloadNpc = {
          type: 'vtt-con-result',
          room: (typeof getVttRoomCode === 'function' ? getVttRoomCode() : '') || sessionStorage.getItem('vtt_room') || '',
          at: Date.now(),
          targetId: target.id || target.name,
          targetName: target.name,
          dc: dc,
          total: totalP,
          success: !!target.concentrating,
          concentrating: !!target.concentrating,
          fromPlayerNpc: true
        };
        localStorage.setItem('cybervlachos_vtt_con_result', JSON.stringify(payloadNpc));
        try {
          var chN = typeof getVttChannel === 'function' ? getVttChannel() : null;
          if (chN) chN.postMessage(payloadNpc);
        } catch (eN) {}
      } catch (e) {}
      try { if (typeof playerPersistAndSyncCombat === 'function') playerPersistAndSyncCombat(); } catch (e) {}
      return;
    }

    // DM window: PCs roll on their client
    if (isPc) {
      broadcastConcentrationRequest(target, dc, dmg);
      conLog((target.name || 'PC') + ' concentration check DC ' + dc + ' — waiting for player to roll', target);
      try { if (typeof toast === 'function') toast((target.name || 'PC') + ' — concentration DC ' + dc + ' (player rolls)'); } catch (e) {}
      return;
    }

    // DM window: NPC / villain auto-roll (+ LR prompt on fail)
    var conMod = combatantConMod(target);
    var r1 = 1 + Math.floor(Math.random() * 20);
    var total = r1 + conMod;
    conLog((target.name || 'NPC') + ' rolls concentration: d20 (' + r1 + ') + CON ' + (conMod >= 0 ? '+' : '') + conMod + ' = ' + total + ' vs DC ' + dc, target);
    resolveConcentrationResult(target, dc, total);
  }
  if (!window.__conCheckListener) {
    window.__conCheckListener = true;
    // Purge stale concentration prompts left in localStorage
    try {
      var rawPurge = localStorage.getItem('cybervlachos_vtt_con_check');
      if (rawPurge) {
        var msgPurge = JSON.parse(rawPurge);
        if (!msgPurge.at || (Date.now() - Number(msgPurge.at)) > 20000
            || localStorage.getItem('handled_con_check_' + msgPurge.at)) {
          localStorage.removeItem('cybervlachos_vtt_con_check');
        }
      }
    } catch (e) {}
    function handleConMsg(msg) {
      if (!msg || msg.type !== 'vtt-con-check') return;
      if (typeof isPlayerRole !== 'function' || !isPlayerRole()) return;
      if (msg.at && msg.at === window.__lastConCheckAt) return;
      // Survive refresh AND new player popup windows (sessionStorage is per-tab)
      try {
        if (msg.at && localStorage.getItem('handled_con_check_' + msg.at)) return;
      } catch (e) {}
      // Ignore stale checks (>20s)
      try {
        if (msg.at && (Date.now() - Number(msg.at)) > 20000) {
          try { localStorage.removeItem('cybervlachos_vtt_con_check'); } catch (e2) {}
          return;
        }
      } catch (e) {}
      window.__lastConCheckAt = msg.at;
      try { if (msg.at) localStorage.setItem('handled_con_check_' + msg.at, '1'); } catch (e) {}
      // Consume so refresh / new popup does not reopen the dialog
      try { localStorage.removeItem('cybervlachos_vtt_con_check'); } catch (e) {}
      var target = null;
      try {
        var c = getActive();
        var combat = getCombat(c);
        target = (combat.combatants || []).find(function(x) {
          return String(x.id) === String(msg.targetId) || x.name === msg.targetName;
        });
      } catch (e) {}
      if (!target) target = { id: msg.targetId, name: msg.targetName, concentrating: true, conMod: msg.conMod };
      // Only the claimed PC rolls concentration on the player client
      try {
        var claimed = typeof getClaimedCombatant === 'function' ? getClaimedCombatant() : null;
        if (!claimed || (String(claimed.id) !== String(target.id) && claimed.name !== target.name
            && String(claimed.id) !== String(msg.targetId) && claimed.name !== msg.targetName)) {
          return;
        }
      } catch (e) { return; }
      showPlayerConcentrationPopup(target, msg.dc || 10);
    }
    function handleConResult(msg) {
      if (!msg || msg.type !== 'vtt-con-result') return;
      // DM only
      if (typeof isPlayerRole === 'function' && isPlayerRole()) return;
      if (msg.at && msg.at === window.__lastConResultAt) return;
      window.__lastConResultAt = msg.at;
      var target = null;
      try {
        var c = getActive();
        var combat = getCombat(c);
        target = (combat.combatants || []).find(function(x) {
          return String(x.id) === String(msg.targetId) || x.name === msg.targetName;
        });
      } catch (e) {}
      if (!target) return;
      var dc = msg.dc || 10;
      var total = msg.total;
      if (total == null) return;
      // Apply the same outcome the player already resolved
      if (msg.success) {
        conLog((target.name || 'Combatant') + ' concentration save: ' + total + ' vs DC ' + dc + ' — SUCCESS (held)' + (msg.fromPlayerNpc ? '' : ' [player]'), target);
        if (msg.concentrating !== false) target.concentrating = true;
      } else {
        conLog((target.name || 'Combatant') + ' concentration save: ' + total + ' vs DC ' + dc + ' — FAILED' + (msg.fromPlayerNpc ? '' : ' [player]'), target);
        try {
          if (typeof dropConcentration === 'function') dropConcentration(target, 'failed DC ' + dc);
          else {
            target.concentrating = false;
            target.isConcentrating = false;
          }
        } catch (e) { target.concentrating = false; }
      }
      // Honor explicit flag from the resolving client
      if (msg.concentrating === false) {
        try {
          if (typeof dropConcentration === 'function') dropConcentration(target, 'synced drop');
          else target.concentrating = false;
        } catch (e) { target.concentrating = false; }
      }
      try { if (typeof save === 'function') save(); } catch (e) {}
      try { if (typeof renderCombat === 'function') renderCombat(); } catch (e) {}
      try { if (typeof renderSharedCombatLog === 'function') renderSharedCombatLog(); } catch (e) {}
    }
    window.addEventListener('storage', function(ev) {
      if (ev.key === 'cybervlachos_vtt_con_check' && ev.newValue) {
        try { handleConMsg(JSON.parse(ev.newValue)); } catch (e) {}
      }
      if (ev.key === 'cybervlachos_vtt_con_result' && ev.newValue) {
        try { handleConResult(JSON.parse(ev.newValue)); } catch (e) {}
      }
    });
    setInterval(function() {
      try {
        if (typeof isPlayerRole === 'function' && isPlayerRole()) {
          var raw = localStorage.getItem('cybervlachos_vtt_con_check');
          if (raw) handleConMsg(JSON.parse(raw));
        } else {
          var rawR = localStorage.getItem('cybervlachos_vtt_con_result');
          if (rawR) handleConResult(JSON.parse(rawR));
        }
      } catch (e) {}
    }, 600);
    try {
      var ch = typeof getVttChannel === 'function' ? getVttChannel() : null;
      if (ch && typeof ch.addEventListener === 'function') {
        ch.addEventListener('message', function(ev) {
          try {
            var m = ev.data;
            if (!m) return;
            if (m.type === 'vtt-con-check') handleConMsg(m);
            if (m.type === 'vtt-con-result') handleConResult(m);
          } catch (e) {}
        });
      }
    } catch (e) {}
  }


  function shortRestCombat(combat) {
    if (!combat || !combat.combatants) return;
    combat.combatants.forEach(cb => {
      const res = cb.combatResources || {};
      Object.keys(res).forEach(k => {
        const recover = String(res[k].recover || '').toLowerCase();
        if (recover.includes('short')) res[k].used = 0;
        if (k === 'lunar' && res[k].used > 0) {
          const half = Math.floor((res[k].max || 0) / 2);
          res[k].used = Math.max(0, (res[k].used || 0) - half);
        }
      });
      // Warlock pact slots recover on short rest
      const cls = String(cb.className || cb.class || '').toLowerCase();
      if (cls.includes('warlock') && cb.combatSpellSlots) {
        Object.keys(cb.combatSpellSlots).forEach(L => {
          const slot = cb.combatSpellSlots[L];
          if (slot && typeof slot === 'object') slot.used = 0;
        });
      }
      if (cls.includes('warlock') && cb.spellSlotsUsed) {
        Object.keys(cb.spellSlotsUsed).forEach(k => { cb.spellSlotsUsed[k] = 0; });
      }
    });
    try { appendSharedCombatLog('Party takes a Short Rest (short-rest resources recover)'); } catch (e) {}
  }

  function longRestCombat(combat) {
    if (!combat || !combat.combatants) return;
    combat.combatants.forEach(cb => {
      cb.hp = cb.hpMax || cb.hp;
      cb.tempHp = 0;
      cb.deathSaves = { successes: 0, failures: 0 };
      cb.dead = false;
      cb.stable = false;
      cb.concentrating = false;
      cb.moveUsed = 0;
      cb.actionUsed = false;
      cb.bonusUsed = false;
      cb.reactionUsed = false;
      cb.attacksUsed = 0;
      cb.turnPhase = 'ready';
      const res = cb.combatResources || {};
      Object.keys(res).forEach(k => { res[k].used = 0; });
      if (cb.combatSpellSlots) {
        Object.keys(cb.combatSpellSlots).forEach(L => {
          cb.combatSpellSlots[L].used = 0;
        });
      }
      if (cb.legendaryResistMax != null) cb.legendaryResist = cb.legendaryResistMax;
      // Clear end-of-rest conditions
      ['dodging', 'hiding', 'grappled', 'restrained'].forEach(c => removeCondition(cb, c));
      removeCondition(cb, 'unconscious');
    });
    try { appendSharedCombatLog('Party takes a Long Rest — HP, slots, and resources restored'); } catch (e) {}
  }


  /** Table-wide combat log (synced to players). */
  function getSharedCombatLog() {
    try {
      const c = getActive();
      const combat = c ? getCombat(c) : null;
      if (!combat) return [];
      if (!Array.isArray(combat.sharedLog)) combat.sharedLog = [];
      return combat.sharedLog;
    } catch (e) { return []; }
  }
  function appendSharedCombatLog(line, meta) {
    const msg = String(line || '').trim();
    if (!msg) return;
    try {
      const c = getActive();
      const combat = c ? getCombat(c) : null;
      if (!combat) return;
      if (!Array.isArray(combat.sharedLog)) combat.sharedLog = [];
      const stamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const entry = {
        t: stamp,
        text: msg,
        names: (meta && meta.names) ? meta.names.filter(Boolean) : [],
        ids: (meta && meta.ids) ? meta.ids.map(String) : []
      };
      // Infer names from text if not provided
      if (!entry.names.length) {
        try {
          const list = combat.combatants || [];
          list.forEach(cb => {
            if (cb && cb.name && msg.indexOf(cb.name) !== -1) entry.names.push(cb.name);
            if (cb && cb.id != null && msg.indexOf(String(cb.id)) !== -1) entry.ids.push(String(cb.id));
          });
        } catch (e) {}
      }
      // Dedupe identical line in the last 2s (stops double Damage Roll / double con logs)
      try {
        var now = Date.now();
        var dup = combat.sharedLog.slice(-8).some(function(e) {
          return e && e.text === entry.text && e._at && (now - e._at) < 2000;
        });
        if (dup) return;
        entry._at = now;
      } catch (e) {}
      combat.sharedLog.push(entry);
      if (combat.sharedLog.length > 80) combat.sharedLog = combat.sharedLog.slice(-80);
      try { save(); } catch (e) {}
      try { broadcastVttState('combat-log'); } catch (e) {}
      renderSharedCombatLog();
    } catch (e) {}
  }

  /** Player-facing: hide log lines that mention combatants the viewer cannot see (FoW / not on map). */
  function sharedLogEntryVisible(entry) {
    try {
      const facing = (typeof isPlayerFacingView === 'function') ? isPlayerFacingView() : (typeof isPlayerRole === 'function' && isPlayerRole());
      // DM main window sees everything
      if (!facing) return true;
      if (!entry) return false;
      const text = typeof entry === 'string' ? entry : (entry.text || '');
      // Always show round markers / pure system lines with no combatant names
      if (/^—\s*Round/i.test(text) || /^Round\s/i.test(text)) return true;
      const c = getActive();
      const combat = c ? getCombat(c) : null;
      const list = (combat && combat.combatants) || [];
      const names = (typeof entry === 'object' && entry.names && entry.names.length)
        ? entry.names
        : list.filter(cb => cb && cb.name && text.indexOf(cb.name) !== -1).map(cb => cb.name);
      // No known combatant mentioned → show (generic system)
      if (!names.length) return true;
      const viewer = (typeof getClaimedCombatant === 'function') ? getClaimedCombatant() : null;
      // Visible if ANY mentioned combatant is visible to player (so you see your own attacks)
      // Hidden only when EVERY mentioned combatant is not visible — actually:
      // Hide if the line involves an unseen combatant as subject/target the player shouldn't know about.
      // Rule: show line only if every *enemy* mentioned is visible; allies/PCs mentioned must be on map+revealed too.
      for (let i = 0; i < names.length; i++) {
        const nm = names[i];
        const cb = list.find(x => x && x.name === nm);
        if (!cb) continue;
        if (viewer && (String(cb.id) === String(viewer.id) || cb.name === viewer.name)) continue;
        if (typeof playerCanSeeCombatant === 'function') {
          if (!playerCanSeeCombatant(viewer, cb)) return false;
        }
      }
      return true;
    } catch (e) { return true; }
  }

  function formatSharedLogEntry(entry) {
    if (typeof entry === 'string') return entry;
    if (!entry) return '';
    return '[' + (entry.t || '') + '] ' + (entry.text || '');
  }

  function renderSharedCombatLog() {
    const lines = getSharedCombatLog();
    const facing = (typeof isPlayerFacingView === 'function') ? isPlayerFacingView() : (typeof isPlayerRole === 'function' && isPlayerRole());
    const visible = facing ? lines.filter(sharedLogEntryVisible) : lines;
    const htmlLines = visible.slice(-40).map(l => {
      const s = formatSharedLogEntry(l);
      return '<div class="clog-line">' + (typeof escapeHtml === 'function' ? escapeHtml(s) : s) + '</div>';
    }).join('') || '<div class="muted small">No combat events yet.</div>';
    // DM main: full log; player panel: filtered
    const dmEl = document.getElementById('combat-shared-log');
    if (dmEl) {
      const all = lines.slice(-40).map(l => {
        const s = formatSharedLogEntry(l);
        return '<div class="clog-line">' + (typeof escapeHtml === 'function' ? escapeHtml(s) : s) + '</div>';
      }).join('') || '<div class="muted small">No combat events yet.</div>';
      dmEl.innerHTML = all;
      dmEl.scrollTop = dmEl.scrollHeight;
    }
    document.querySelectorAll('#player-shared-log, #map-shared-log').forEach(el => {
      if (!el) return;
      el.innerHTML = htmlLines;
      el.scrollTop = el.scrollHeight;
    });
  }

  function resetCombatResourcesOnly(combat) {
    if (!combat || !combat.combatants) return;
    combat.combatants.forEach(cb => {
      const res = cb.combatResources || {};
      Object.keys(res).forEach(k => { res[k].used = 0; });
      if (cb.combatSpellSlots) {
        Object.keys(cb.combatSpellSlots).forEach(L => {
          const slot = cb.combatSpellSlots[L];
          if (slot && typeof slot === 'object') slot.used = 0;
          else if (typeof slot === 'number') { /* max tracked elsewhere */ }
        });
      }
      // Common flat fields
      if (cb.spellSlotsUsed && typeof cb.spellSlotsUsed === 'object') {
        Object.keys(cb.spellSlotsUsed).forEach(k => { cb.spellSlotsUsed[k] = 0; });
      }
      if (cb.legendaryResistMax != null) cb.legendaryResist = cb.legendaryResistMax;
      cb.attacksUsed = 0;
      cb.actionUsed = false;
      cb.bonusUsed = false;
      cb.reactionUsed = false;
      cb.moveUsed = 0;
    });
    appendSharedCombatLog('DM reset combat resources (slots, Ki, Lunar, Rage, etc.) — HP unchanged');
  }

  function tickConditionRounds(cb) {
    if (!cb || !cb.conditionList) return;
    cb.conditionList = normalizeConditionList(cb).map(c => {
      if (c.rounds > 0) c.rounds -= 1;
      return c;
    }).filter(c => !c.rounds || c.rounds > 0);
    cb.conditions = cb.conditionList.map(c => c.name + (c.rounds ? ` (${c.rounds})` : '')).join(', ');
  }

  function canTakeActions(cb) {
    if (!cb || cb.dead) return false;
    if ((cb.hp || 0) <= 0 && !cb.stable) return false;
    if (combatantHasCondition(cb, 'incapacitated') || combatantHasCondition(cb, 'paralyzed') ||
        combatantHasCondition(cb, 'petrified') || combatantHasCondition(cb, 'stunned') ||
        combatantHasCondition(cb, 'unconscious')) return false;
    return true;
  }


  
  function playerPersistAndSyncCombat() {
    const c = getActive();
    if (!c) {
      console.warn('playerPersist: no active workspace');
      return;
    }
    const combat = getCombat(c);
    const room = (typeof getVttRoomCode === 'function' ? getVttRoomCode() : '') || '';
    // 1) Merge into shared campaign storage
    try {
      const key = (typeof STORAGE_KEY !== 'undefined') ? STORAGE_KEY : 'cybervlachos_combat_v1';
      let data;
      try { data = JSON.parse(localStorage.getItem(key) || 'null'); } catch (e) { data = null; }
      if (!data || !data.campaigns) {
        data = { campaigns: [c], activeCampaignId: c.id };
      }
      const camps = data.campaigns || [];
      let camp = camps.find(x => x.id === data.activeCampaignId) || camps.find(x => x.id === c.id) || camps[0];
      if (!camp) {
        camp = c;
        camps.push(camp);
        data.campaigns = camps;
        data.activeCampaignId = c.id;
      }
      if (!camp.combat) camp.combat = { round: 1, turnIndex: 0, combatants: [] };
      const remoteList = camp.combat.combatants || [];
      (combat.combatants || []).forEach(local => {
        let r = remoteList.find(x => String(x.id) === String(local.id) || x.name === local.name);
        if (!r) {
          remoteList.push(JSON.parse(JSON.stringify(local)));
          return;
        }
        r.hp = local.hp;
        r.hpMax = local.hpMax;
        r.tempHp = local.tempHp;
        r.conditions = local.conditions;
        r.turnState = local.turnState;
        r.turnPhase = local.turnPhase;
        r.actionUsed = local.actionUsed || r.actionUsed;
        r.actionsUsed = Math.max(Number(r.actionsUsed) || 0, Number(local.actionsUsed) || 0);
        if (local.actionsMax != null) r.actionsMax = Math.max(Number(r.actionsMax) || 0, Number(local.actionsMax) || 0);
        r.bonusUsed = local.bonusUsed || r.bonusUsed;
        r.reactionUsed = local.reactionUsed || r.reactionUsed;
        r.moveUsed = Math.max(Number(r.moveUsed) || 0, Number(local.moveUsed) || 0);
        r.attacksUsed = Math.max(Number(r.attacksUsed) || 0, Number(local.attacksUsed) || 0);
        if (local.attacksMax != null) r.attacksMax = Math.max(Number(r.attacksMax) || 1, Number(local.attacksMax) || 1);
        if (local.lastAction) r.lastAction = local.lastAction;
        r.combatSpellSlots = local.combatSpellSlots;
        r.combatResources = local.combatResources;
        r.concentrating = local.concentrating;
        r.spellSlots = local.spellSlots;
        r.deathSaves = local.deathSaves;
      });
      camp.combat.combatants = remoteList;
      if (combat.turnEconomy) camp.combat.turnEconomy = combat.turnEconomy;
      if (combat.round != null) camp.combat.round = combat.round;
      if (combat.turnIndex != null) camp.combat.turnIndex = combat.turnIndex;
      // Merge concentration / combat log lines so DM sees player-side rolls (NPC + PC)
      try {
        if (Array.isArray(combat.sharedLog) && combat.sharedLog.length) {
          if (!Array.isArray(camp.combat.sharedLog)) camp.combat.sharedLog = [];
          var existing = {};
          camp.combat.sharedLog.forEach(function(e) {
            if (e && e.t && e.text) existing[e.t + '|' + e.text] = true;
          });
          combat.sharedLog.forEach(function(e) {
            if (!e || !e.text) return;
            var k = (e.t || '') + '|' + e.text;
            if (!existing[k]) {
              camp.combat.sharedLog.push(e);
              existing[k] = true;
            }
          });
          if (camp.combat.sharedLog.length > 80) {
            camp.combat.sharedLog = camp.combat.sharedLog.slice(-80);
          }
        }
      } catch (eLog) {}
      // Merge map tokens so player token moves persist for DM (same-browser localStorage)
      if (c.combatMap && c.combatMap.tokens) {
        if (!camp.combatMap) camp.combatMap = Object.assign({}, c.combatMap);
        camp.combatMap.tokens = camp.combatMap.tokens || {};
        Object.keys(c.combatMap.tokens).forEach(k => {
          camp.combatMap.tokens[k] = c.combatMap.tokens[k];
        });
      }
      data.activeCampaignId = camp.id || data.activeCampaignId;
      localStorage.setItem(key, JSON.stringify(data));
    } catch (e) { console.warn('playerPersist storage', e); }

    // 2) Broadcast snapshot (multiple keys so DM always sees it)
    try {
      const snapshot = {
        type: 'vtt-state',
        from: 'player',
        clientId: window.__vttClientId || null,
        room: room,
        reason: 'player-combat',
        at: Date.now(),
        combat: {
          round: combat.round,
          current: combat.current,
          turnIndex: combat.turnIndex,
          sharedLog: Array.isArray(combat.sharedLog) ? combat.sharedLog.slice(-40) : [],
          combatants: (combat.combatants || []).map(cb => ({
            id: cb.id, name: cb.name, hp: cb.hp, hpMax: cb.hpMax, ac: cb.ac,
            init: cb.init, side: cb.side, conditions: cb.conditions, hideHp: cb.hideHp,
            tempHp: cb.tempHp, concentrating: cb.concentrating, dead: cb.dead,
            size: cb.size, tokenSize: cb.tokenSize,
            turnState: cb.turnState, turnPhase: cb.turnPhase,
            actionUsed: cb.actionUsed, bonusUsed: cb.bonusUsed, reactionUsed: cb.reactionUsed,
            moveUsed: cb.moveUsed, attacksUsed: cb.attacksUsed,
            combatSpellSlots: cb.combatSpellSlots, combatResources: cb.combatResources,
            spellSlots: cb.spellSlots, deathSaves: cb.deathSaves
          }))
        },
        map: c.combatMap ? {
          tokens: c.combatMap.tokens || {},
          fogEnabled: !!c.combatMap.fogEnabled,
          fogRevealed: Object.assign({}, c.combatMap.fogRevealed || {}),
          gridSize: c.combatMap.gridSize,
          gridOffsetX: c.combatMap.gridOffsetX,
          gridOffsetY: c.combatMap.gridOffsetY
        } : null
      };
      localStorage.setItem('cybervlachos_vtt_sync', JSON.stringify(snapshot));
      localStorage.setItem('cybervlachos_vtt_player_combat', JSON.stringify(snapshot));
      // Dedicated token channel so DM popups/main pick up player moves
      if (c.combatMap && c.combatMap.tokens) {
        const tokPayload = {
          type: 'vtt-tokens',
          from: 'player',
          room: room,
          reason: 'player-persist',
          at: Date.now(),
          clientId: window.__vttClientId || null,
          tokens: JSON.parse(JSON.stringify(c.combatMap.tokens || {})),
          fogEnabled: !!c.combatMap.fogEnabled,
          fogRevealed: Object.assign({}, c.combatMap.fogRevealed || {})
        };
        localStorage.setItem('cybervlachos_vtt_tokens', JSON.stringify(tokPayload));
        try {
          const ch2 = typeof getVttChannel === 'function' ? getVttChannel() : null;
          if (ch2) ch2.postMessage(tokPayload);
        } catch (e3) {}
      }
      const ch = typeof getVttChannel === 'function' ? getVttChannel() : null;
      if (ch) try { ch.postMessage(snapshot); } catch (e) {}
    } catch (e) { console.warn('playerPersist broadcast', e); }

    try { if (typeof renderPlayerCombatPanel === 'function') renderPlayerCombatPanel(); } catch (e) {}
    try { if (typeof renderBattleMap === 'function') renderBattleMap(); } catch (e) {}
    try { if (typeof renderMapRoster === 'function') renderMapRoster(); } catch (e) {}
  }

  
  function isEnemySide(cb) {
    const side = String(cb && cb.side || '').toLowerCase();
    return side === 'enemy' || side === 'villain' || side === 'enemies';
  }
  function getCombatantTokenPos(target, map) {
    if (!target || !map) return null;
    const tokens = map.tokens || {};
    const id = target.id != null ? String(target.id) : '';
    if (id && tokens[id]) return tokens[id];
    if (target.id != null && tokens[target.id]) return tokens[target.id];
    try {
      const c = getActive();
      const list = (c && getCombat(c).combatants) || [];
      for (const k of Object.keys(tokens)) {
        if (id && String(k) === id) return tokens[k];
        const cb = list.find(x => String(x.id) === String(k));
        if (cb && target.name && cb.name === target.name) return tokens[k];
        if (target.name && String(k) === String(target.name)) return tokens[k];
      }
    } catch (e) {}
    return null;
  }

  function playerCanSeeCombatant(viewer, target) {
    // DM main window (not popout): always see everyone
    if (typeof isPlayerFacingView === 'function' ? !isPlayerFacingView() : !isPlayerRole()) return true;
    if (!target) return false;
    // Always see claimed/self character (player combat panel)
    if (viewer && (String(target.id) === String(viewer.id) || target.name === viewer.name)) return true;
    const map = getCombatMap();
    // Has a real battle map? (image, video, or mediaType) — do not treat video maps as "no map"
    var hasMapMedia = !!(map && (
      map.image || map.video || map.mapImage || map.src || map.videoSrc || map.mediaUrl ||
      map.mediaType === 'video' || map.mediaType === 'image' || map.mapDataUrl
    ));
    // Theater of the mind only when there is no map media at all
    if (!map || !hasMapMedia) {
      return true;
    }
    const pos = (typeof getCombatantTokenPos === 'function')
      ? getCombatantTokenPos(target, map)
      : (map.tokens && (map.tokens[String(target.id)] || map.tokens[target.id]));
    // No token on map: still list for targeting (ToTM hybrid), but not "seen" under fog as a map figure
    if (!pos) return true;
    // Token on map + FoW: must be in a revealed cell
    if (!map.fogEnabled) return true;
    try {
      ensureMapFog(map);
      const cell = worldToFogCell(map, pos.x, pos.y);
      return !!(map.fogRevealed && map.fogRevealed[cell]);
    } catch (e) { return false; }
  }
  function formatCombatTargetLabel(x, viewer) {
    if (isPlayerRole() && isEnemySide(x)) {
      // No HP for enemies on player clients
      return `${x.name || '?'} · enemy`;
    }
    return `${x.name || '?'} (${x.hp}/${x.hpMax} HP)${x.side ? ' · ' + x.side : ''}`;
  }




  
  const POPUP_DICE_SPIN_MS = 900;
  const POPUP_DICE_REVEAL_MS = 1200;
  const POPUP_DICE_TICK_MS = 70;

  function isPopupDiceClient() {
    try {
      if (typeof isMapPopoutMode === 'function' && isMapPopoutMode()) return true;
      if (typeof isPlayerRole === 'function' && isPlayerRole()) return true;
      // body class fallback
      if (document.body && (document.body.classList.contains('map-popout') || document.body.classList.contains('vtt-player'))) return true;
    } catch (e) {}
    return false;
  }

  function extractDiceFromRollHtml(html) {
    const text = String(html || '').replace(/<[^>]+>/g, ' ');
    const faces = [];
    // Explicit NdM notations first (damage, etc.)
    const multi = text.match(/(\d+)d(\d+)/gi) || [];
    multi.forEach(m => {
      const p = String(m).match(/(\d+)d(\d+)/i);
      if (!p) return;
      const count = Math.min(6, Math.max(1, parseInt(p[1], 10) || 1));
      const sides = parseInt(p[2], 10) || 6;
      for (let i = 0; i < count; i++) {
        faces.push({ sides: sides, value: null });
      }
    });
    // Parenthetical face list: (3+5+2) with a dX nearby
    if (!faces.length) {
      const d20 = text.match(/\b(?:d20[:\s]+)(\d{1,2})\b/i) || text.match(/\b(1[0-9]|20|[1-9])\s*(?:\+|vs|to hit)/i);
      if (d20) {
        const n = parseInt(d20[1], 10);
        if (n >= 1 && n <= 20) faces.push({ sides: 20, value: n });
      }
    } else {
      // If we already have d20 notation from NdM skip; else try attach attack d20 total
      const atk = text.match(/(?:to hit|attack)[^\d]*(\d{1,2})/i) || text.match(/\b(\d{1,2})\s*vs\s*AC/i);
      if (atk && !faces.some(f => f.sides === 20)) {
        const n = parseInt(atk[1], 10);
        if (n >= 1 && n <= 30) {
          // total may include mod — still show as d20 face when plausible
          faces.unshift({ sides: 20, value: n <= 20 ? n : null });
        }
      }
    }
    // Try to fill individual values from patterns like "d20: 17" or "rolled 17"
    faces.forEach((f, idx) => {
      if (f.value != null) return;
      if (f.sides === 20) {
        const m = text.match(/\bd20[:\s]+(\d{1,2})\b/i) || text.match(/\b(1[0-9]|20|[1-9])\s*(?:\+|vs)/i);
        if (m) {
          const n = parseInt(m[1], 10);
          if (n >= 1 && n <= 20) f.value = n;
        }
      }
    });
    if (!faces.length) faces.push({ sides: 20, value: null });
    return faces.slice(0, 6);
  }

  function ensurePopupDiceOverlay() {
    let el = document.getElementById('popup-dice-overlay');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'popup-dice-overlay';
    el.className = 'popup-dice-overlay';
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = '<div class="popup-dice-stage"><div class="popup-dice-label">Rolling…</div><div class="popup-dice-row" id="popup-dice-row"></div><div class="popup-dice-result" id="popup-dice-result"></div></div>';
    document.body.appendChild(el);
    el.addEventListener('click', () => {
      el.classList.remove('is-on', 'is-rolling', 'is-reveal');
      el.setAttribute('aria-hidden', 'true');
    });
    return el;
  }

  function broadcastPopupDiceAnimation(html, meta) {
    try {
      meta = meta || {};
      const payload = {
        type: 'vtt-dice-anim',
        room: (typeof getVttRoomCode === 'function' ? getVttRoomCode() : '') || sessionStorage.getItem('vtt_room') || '',
        html: String(html || ''),
        at: Date.now(),
        startAt: meta.startAt || Date.now(),
        spinMs: meta.spinMs || (typeof POPUP_DICE_SPIN_MS !== 'undefined' ? POPUP_DICE_SPIN_MS : 900),
        revealMs: meta.revealMs || (typeof POPUP_DICE_REVEAL_MS !== 'undefined' ? POPUP_DICE_REVEAL_MS : 1200),
        faces: meta.faces || null,
        clientId: window.__vttClientId || null
      };
      try { localStorage.setItem('cybervlachos_vtt_dice', JSON.stringify(payload)); } catch (e) {}
      try {
        const ch = typeof getVttChannel === 'function' ? getVttChannel() : null;
        if (ch) ch.postMessage(payload);
      } catch (e) {}
      try {
        if (window.__mapBc) window.__mapBc.postMessage(payload);
      } catch (e) {}
    } catch (e) {
      console.warn('dice bc', e);
    }
  }

  function playPopupDiceAnimation(html, opts) {
    opts = opts || {};
    const rawHtml = String(html || '');
    if (!opts.force && !isPopupDiceClient()) return Promise.resolve();

    const spinMs = Number(opts.spinMs) > 0 ? Number(opts.spinMs) : (typeof POPUP_DICE_SPIN_MS !== 'undefined' ? POPUP_DICE_SPIN_MS : 900);
    const revealMs = Number(opts.revealMs) > 0 ? Number(opts.revealMs) : (typeof POPUP_DICE_REVEAL_MS !== 'undefined' ? POPUP_DICE_REVEAL_MS : 1200);
    const tickMs = typeof POPUP_DICE_TICK_MS !== 'undefined' ? POPUP_DICE_TICK_MS : 70;
    const startAt = Number(opts.startAt) > 0 ? Number(opts.startAt) : Date.now();
    // Skip duplicate packet for the same animation wave (keeps DM/player clocks aligned)
    if (opts.noBroadcast && window.__diceAnimStartAt && startAt === window.__diceAnimStartAt && window.__diceAnimPlaying) {
      return window.__diceAnimPromise || Promise.resolve();
    }
    window.__diceAnimStartAt = startAt;
    window.__diceAnimPlaying = true;
    let facesIn = Array.isArray(opts.faces) && opts.faces.length ? opts.faces : null;
    if (!facesIn || !facesIn.length) {
      try {
        if (window.__pendingDiceFaces && window.__pendingDiceFaces.length) {
          facesIn = window.__pendingDiceFaces;
        }
      } catch (e) {}
    }
    if (!facesIn || !facesIn.length) {
      facesIn = typeof extractDiceFromRollHtml === 'function' ? extractDiceFromRollHtml(rawHtml) : [{ sides: 20, value: null }];
    }
    try { window.__pendingDiceFaces = null; } catch (e) {}

    // Originating client broadcasts shared clock + faces so DM/player stay in sync
    if (!opts.noBroadcast) {
      try {
        broadcastPopupDiceAnimation(rawHtml, {
          startAt: startAt,
          spinMs: spinMs,
          revealMs: revealMs,
          faces: facesIn
        });
      } catch (e) {}
    }

    try {
      // Cancel any prior run so late packets don't stack different timers
      if (window.__popupDiceSpinTimer) {
        try { clearInterval(window.__popupDiceSpinTimer); } catch (e) {}
        window.__popupDiceSpinTimer = null;
      }
      if (window.__popupDiceSpinTimeout) {
        try { clearTimeout(window.__popupDiceSpinTimeout); } catch (e) {}
        window.__popupDiceSpinTimeout = null;
      }
      if (window.__popupDiceRevealTimeout) {
        try { clearTimeout(window.__popupDiceRevealTimeout); } catch (e) {}
        window.__popupDiceRevealTimeout = null;
      }

      const overlay = ensurePopupDiceOverlay();
      const row = document.getElementById('popup-dice-row');
      const res = document.getElementById('popup-dice-result');
      const label = overlay.querySelector('.popup-dice-label');
      if (!row) return Promise.resolve();

      row.innerHTML = '';
      facesIn.forEach((f) => {
        const sides = parseInt(f.sides, 10) || 20;
        const d = document.createElement('div');
        d.className = 'popup-die die-d' + sides;
        d.dataset.sides = 'd' + sides;
        d.dataset.dieSides = String(sides);
        d.dataset.final = f.value != null ? String(f.value) : '';
        d.setAttribute('title', 'd' + sides);
        d.innerHTML = '<span class="popup-die-face">?</span>';
        row.appendChild(d);
      });

      if (res) {
        res.innerHTML = '';
        const tmp = document.createElement('div');
        tmp.innerHTML = rawHtml || '';
        let plain = (tmp.innerText || '').replace(/\s+/g, ' ').trim();
        plain = plain.replace(/\s*vs\s*AC\s*\?+\s*/gi, ' ').replace(/\s*vs\s*AC\s*$/i, '');
        plain = plain.replace(/set Target AC to resolve hit/gi, '').replace(/\s+/g, ' ').trim();
        res.textContent = plain.slice(0, 160);
      }
      if (label) label.textContent = 'Rolling…';
      overlay.classList.add('is-on', 'is-rolling');
      overlay.classList.remove('is-reveal');
      overlay.setAttribute('aria-hidden', 'false');

      const diceEls = row.querySelectorAll('.popup-die');
      const spin = setInterval(() => {
        diceEls.forEach(d => {
          const sides = parseInt(d.dataset.dieSides || d.dataset.sides, 10) || 20;
          const face = d.querySelector('.popup-die-face') || d;
          face.textContent = String(1 + Math.floor(Math.random() * sides));
        });
      }, tickMs);
      window.__popupDiceSpinTimer = spin;

      // Align to shared startAt so DM/player reveal at the same wall-clock time
      const elapsed = Math.max(0, Date.now() - startAt);
      const remainingSpin = Math.max(120, spinMs - elapsed);

      const animPromise = new Promise((resolve) => {
        window.__popupDiceSpinTimeout = setTimeout(() => {
          try { clearInterval(spin); } catch (e) {}
          window.__popupDiceSpinTimer = null;
          diceEls.forEach(d => {
            const sides = parseInt(d.dataset.dieSides || d.dataset.sides, 10) || 20;
            let final = parseInt(d.dataset.final, 10);
            if (!(final >= 1 && final <= sides)) final = 1 + Math.floor(Math.random() * sides);
            const face = d.querySelector('.popup-die-face') || d;
            face.textContent = String(final);
            d.classList.toggle('is-crit', sides === 20 && final === 20);
            d.classList.toggle('is-fumble', sides === 20 && final === 1);
          });
          // Advantage / disadvantage: highlight kept die
          try {
            const d20s = [...diceEls].filter(d => parseInt(d.dataset.dieSides || d.dataset.sides, 10) === 20);
            if (d20s.length === 2) {
              const v0 = parseInt(d20s[0].dataset.final, 10);
              const v1 = parseInt(d20s[1].dataset.final, 10);
              const plain = (res && res.textContent) || '';
              const isDis = /disadvantage/i.test(plain) || /dis \[/i.test(plain);
              const keepIdx = isDis ? (v0 <= v1 ? 0 : 1) : (v0 >= v1 ? 0 : 1);
              d20s.forEach((d, i) => {
                d.classList.toggle('is-kept', i === keepIdx);
                d.classList.toggle('is-dropped', i !== keepIdx);
              });
            }
          } catch (e) {}
          overlay.classList.remove('is-rolling');
          overlay.classList.add('is-reveal');
          if (label) label.textContent = 'Result';
          window.__popupDiceRevealTimeout = setTimeout(() => {
            overlay.classList.remove('is-on', 'is-reveal');
            overlay.setAttribute('aria-hidden', 'true');
            window.__diceAnimPlaying = false;
            resolve();
          }, revealMs);
        }, remainingSpin);
      });
      window.__diceAnimPromise = animPromise;
      return animPromise;
    } catch (e) {
      console.warn('popup dice anim', e);
      window.__diceAnimPlaying = false;
      return Promise.resolve();
    }
  }


  function publishCombatRollResult(html, cb) {
    const raw = String(html || '').trim();
    if (!raw) return;
    // Popup-only dice animation (never blocks combat math)
    try {
      if (isPopupDiceClient()) {
        playPopupDiceAnimation(raw).catch(() => {});
      }
    } catch (e) {}
    try {
      if (cb) cb.lastRollHtml = raw;
      const id = cb && (cb.id != null ? String(cb.id) : '');
      if (id) {
        window.__playerLastRollById = window.__playerLastRollById || {};
        window.__playerLastRollById[id] = raw;
      }
      window.__playerLastRollHtml = raw;
    } catch (e) {}
    // In-panel result boxes
    try {
      document.querySelectorAll('#cr-result, #combat-roll-result, .combat-roll-result').forEach(el => {
        if (el.id === 'player-roll-result') return;
        el.classList.remove('muted');
        el.style.display = 'block';
        el.style.visibility = 'visible';
        el.style.opacity = '1';
        el.innerHTML = raw;
      });
    } catch (e) {}
    // Persistent player strip (survives body rebuild)
    try {
      const pr = document.getElementById('player-roll-result');
      if (pr) {
        pr.innerHTML = raw;
        pr.hidden = false;
        pr.removeAttribute('hidden');
        pr.classList.add('is-active');
        pr.style.display = 'block';
        try { pr.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (e2) {}
      }
    } catch (e) {}
    // Toast always for player clients
    try {
      if (typeof isPlayerRole === 'function' && isPlayerRole()) {
        const tmp = document.createElement('div');
        tmp.innerHTML = raw;
        const plain = (tmp.innerText || '').replace(/\s+/g, ' ').trim();
        if (plain) toast(plain.slice(0, 140));
      }
    } catch (e) {}
  }

  function restorePlayerRollResult(cb) {
    let html = '';
    try {
      if (cb && cb.lastRollHtml) html = cb.lastRollHtml;
      const id = cb && (cb.id != null ? String(cb.id) : '');
      if (!html && id && window.__playerLastRollById) html = window.__playerLastRollById[id] || '';
      if (!html) html = window.__playerLastRollHtml || '';
    } catch (e) {}
    const pr = document.getElementById('player-roll-result');
    if (!pr) return;
    if (html) {
      pr.innerHTML = html;
      pr.hidden = false;
      pr.removeAttribute('hidden');
      pr.classList.add('is-active');
      pr.style.display = 'block';
    }
  }

  function softRefreshCombatDetail(cb, panelHint) {
    try {
      if (typeof isPlayerRole === 'function' && isPlayerRole()) {
        if (typeof renderPlayerCombatPanel === 'function') renderPlayerCombatPanel();
        return;
      }
      if (typeof showCombatDetail === 'function') showCombatDetail(cb, panelHint);
      else if (typeof renderCombat === 'function') renderCombat();
    } catch (e) {
      try { renderCombat(); } catch (e2) {}
    }
  }

  function showCombatDetail(cb, panelOverride) {
    if (!cb) return;
    try { ensureCombatantLR(cb); } catch (e) {}
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
    // Save in-memory spends first, then merge stored economy without wiping them
    try { if (typeof persistTurnEconomy === 'function') persistTurnEconomy(cb); } catch (e) {}
    if (typeof restoreTurnEconomy === 'function') restoreTurnEconomy(cb);

    const panel = panelOverride || $('#combat-detail');
    if (!panel) return;
    if (!cb) {
      panel.innerHTML = '<div class="combat-detail-empty muted">Select a combatant to view details, traits, and actions.</div>';
      return;
    }
    // Mark player panel for styling
    if (panelOverride) panel.setAttribute('data-player-detail', '1');
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
            ${(cb.legendaryResistMax != null || cb.legendaryResist != null || cb.legendary) ? `<div class="muted small" style="margin-top:0.25rem">Legendary Resistance: <strong>${Number(cb.legendaryResist != null ? cb.legendaryResist : cb.legendaryResistMax) || 0}</strong> / ${Number(cb.legendaryResistMax != null ? cb.legendaryResistMax : cb.legendaryResist) || 0}</div>` : ''}
            <div class="field" style="margin-top:0.4rem">
              <label>Creature size (token footprint)</label>
              <select id="cd-token-size" ${(typeof isPlayerRole === 'function' && isPlayerRole()) ? 'disabled' : ''}>
                ${['Tiny','Small','Medium','Large','Huge','Gargantuan'].map(function(sz) {
                  const cur = String(cb.size || 'Medium');
                  const sel = (cur.toLowerCase() === sz.toLowerCase()) || (sizeToTokenSquares(cur) === sizeToTokenSquares(sz) && !['Tiny','Small','Medium','Large','Huge','Gargantuan'].some(function(x){ return x.toLowerCase()===cur.toLowerCase(); }) && sz==='Medium');
                  return '<option value="'+sz+'" '+(String(cb.size||'Medium').toLowerCase()===sz.toLowerCase()?'selected':'')+'>'+sz+' ('+sizeToTokenSquares(sz)+' sq)</option>';
                }).join('')}
              </select>
            </div>
            ${(typeof isPlayerRole === 'function' && isPlayerRole()) ? '' : `<label class="checkbox-row"><input type="checkbox" id="cd-hidden-hp" ${cb.hideHp ? 'checked' : ''}/> Hide HP on map</label>`}
        <div class="form-row" style="margin-top:0.35rem;gap:0.35rem;flex-wrap:wrap">
          <button type="button" class="btn secondary btn-tiny" id="cd-death-save">Death Save</button>
          <button type="button" class="btn secondary btn-tiny" id="cd-leg-resist">Legendary Resistance</button>
          <label class="muted small">Cover
            <select id="cd-cover">
              <option value="0">None</option>
              <option value="2">Half (+2 AC)</option>
              <option value="5">3/4 (+5 AC)</option>
            </select>
          </label>
          <span class="muted small" id="cd-death-status"></span>
        </div>
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
            <div class="field"><label>Damage type</label>
              <select id="cr-dmg-type">
                <option value="">—</option>
                <option>slashing</option><option>piercing</option><option>bludgeoning</option>
                <option>fire</option><option>cold</option><option>lightning</option><option>thunder</option>
                <option>acid</option><option>poison</option><option>necrotic</option><option>radiant</option>
                <option>force</option><option>psychic</option>
              </select>
            </div>
          </div>
          <div class="tool-btns" style="margin-top:0.5rem;flex-wrap:wrap">
            <button type="button" class="btn primary" id="cr-roll-btn">Roll Attack</button>
            <button type="button" class="btn secondary" id="cr-roll-dmg" disabled title="Roll damage only after a hit">Damage Roll</button>
            <button type="button" class="btn secondary" id="cr-roll-save">Save DC check</button>
          </div>
          <div class="field" style="margin-top:0.35rem">
            <label>Save DC (for save roll)</label>
            <input type="number" id="cr-dc" value="15" min="1" max="40" />
          </div>
          <div id="cr-result" class="combat-roll-result muted small">${cb.lastRollHtml ? cb.lastRollHtml : 'Select an attack and roll.'}</div>
          <div class="combat-apply-row" style="margin-top:0.5rem;display:flex;flex-wrap:wrap;gap:0.35rem;align-items:center">
            <button type="button" class="btn primary" id="cr-apply-effect" title="Apply this ability/spell effect to selected targets">Apply Effect</button>
            <button type="button" class="btn danger" id="cr-apply-dmg" class="dm-only-apply-dmg" title="Apply damage to target(s)">Apply Damage</button>
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
      var prevIds = [];
      try {
        [...sel.selectedOptions].forEach(function(o) {
          var ix = parseInt(o.value, 10);
          if (!isNaN(ix) && combatants[ix]) prevIds.push(String(combatants[ix].id || combatants[ix].name));
        });
      } catch (e) {}
      try {
        if ((!prevIds || !prevIds.length) && window.__crSelectedTargetIds && window.__crSelectedTargetIds.length) {
          prevIds = window.__crSelectedTargetIds.slice();
        }
      } catch (e) {}
      try {
        var last = window.__lastCombatRoll || {};
        if ((!prevIds || !prevIds.length) && last.targetIds && last.targetIds.length) {
          prevIds = last.targetIds.map(String);
        }
      } catch (e) {}
      const opts = [];
      combatants.forEach((x, idx) => {
        if (typeof playerCanSeeCombatant === 'function' && !playerCanSeeCombatant(cb, x)) return;
        const label = typeof formatCombatTargetLabel === 'function'
          ? formatCombatTargetLabel(x, cb)
          : `${x.name} (${x.hp}/${x.hpMax} HP)${x.side ? ' · ' + x.side : ''}`;
        opts.push(`<option value="${idx}">${escapeHtml(label)}</option>`);
      });
      sel.innerHTML = opts.join('') || '<option value="" disabled>No visible combatants</option>';
      let picked = false;
      if (prevIds && prevIds.length) {
        for (let oi = 0; oi < sel.options.length; oi++) {
          const idx = parseInt(sel.options[oi].value, 10);
          const x = combatants[idx];
          if (!x) continue;
          const id = String(x.id || x.name);
          if (prevIds.indexOf(id) !== -1 || prevIds.indexOf(String(x.name)) !== -1) {
            sel.options[oi].selected = true;
            picked = true;
          }
        }
      }
      if (!picked) {
        for (let oi = 0; oi < sel.options.length; oi++) {
          const idx = parseInt(sel.options[oi].value, 10);
          const x = combatants[idx];
          if (x && typeof isEnemySide === 'function' && isEnemySide(x) && String(x.id) !== String(cb.id)) {
            sel.options[oi].selected = true;
            picked = true;
            break;
          }
        }
      }
      if (!picked && sel.options[0]) sel.options[0].selected = true;
      try {
        window.__crSelectedTargetIds = [...sel.selectedOptions].map(function(o) {
          var ix = parseInt(o.value, 10);
          var x = combatants[ix];
          return x ? String(x.id || x.name) : '';
        }).filter(Boolean);
      } catch (e) {}
      try {
        sel.onchange = function() {
          try {
            var list = [];
            try {
              const c2 = getActive();
              list = (getCombat(c2).combatants || []);
            } catch (e2) {}
            window.__crSelectedTargetIds = [...sel.selectedOptions].map(function(o) {
              var ix = parseInt(o.value, 10);
              var x = list[ix];
              return x ? String(x.id || x.name) : '';
            }).filter(Boolean);
          } catch (e3) {}
        };
      } catch (e) {}
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
    panel.querySelector('#cr-roll-btn')?.addEventListener('click', (ev) => {
      // Document-level combatRollDelegate is the single source of truth (economy + player sync).
      // Running both handlers double-spends attacks and can freeze the player popup.
      if (window.__combatRollDelegated) {
        try { ev && ev.preventDefault && ev.preventDefault(); } catch (e) {}
        return;
      }
      const mode = panel.querySelector('#cr-mode')?.value || 'attack';
      const box = panel.querySelector('#cr-result') || panel.querySelector('#combat-roll-result');
      const atkName = (list[parseInt(atkSel?.value, 10) || 0] || {}).name || 'Attack';
      function showRollHtml(html) {
        try { publishCombatRollResult(html, cb); } catch (e) {
          if (box) { box.classList.remove('muted'); box.style.display = 'block'; box.innerHTML = html; }
        }
      }
      if (mode === 'utility') {
        showRollHtml(`<div><strong>${escapeHtml(atkName)}</strong> — utility (no attack roll).</div>`);
        appendLog(`${atkName}: utility`);
        return;
      }
      if (mode === 'auto') {
        const dmg = rollDieExpr(dmgEl?.value || '1d4+1');
        const bonus = parseInt(panel.querySelector('#cr-dmg-bonus')?.value, 10) || 0;
        const total = dmg.total + bonus;
        const asHeal = isHealingSpellName(atkName) || (window.__lastCombatRoll && window.__lastCombatRoll.isHeal);
        if (asHeal) {
          showRollHtml(`<div><strong>${escapeHtml(atkName)}</strong> — healing</div><div>Heal: <strong>${total}</strong></div>`);
          window.__lastCombatRoll = { damage: 0, heal: total, healDice: dmgEl?.value || '', hit: true, isHeal: true, name: atkName };
          const applyAmt = panel.querySelector('#cr-apply-amt');
          if (applyAmt) applyAmt.value = String(total);
          appendLog(`${atkName}: heal ${total}`);
        } else {
          showRollHtml(`<div><strong>${escapeHtml(atkName)}</strong> — auto-hit</div><div>Damage: <strong>${total}</strong></div>`);
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
        showRollHtml(`<div><strong>${escapeHtml(atkName)}</strong> · Save vs DC ${dc}</div>
          <div>Roll: <strong>${total}</strong> → <strong style="color:${ok?'#8d8':'#c66'}">${ok?'SUCCESS':'FAIL'}</strong></div>${dmgLine}`);
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
      // Attack budget — hard gate before any dice
      {
        try { restoreTurnEconomy(cb); } catch (e) {}
        if (typeof canRollWeaponAttack === 'function' && !canRollWeaponAttack(cb)) {
          toast('No actions / weapon attacks left this turn');
          try { applyRollAttackButtonState(panel, cb); } catch (e) {}
          return;
        }
        if (typeof spendMainCombatAction === 'function') {
          if (!spendMainCombatAction(cb, 'attack', 'Attack')) {
            toast('No actions left — cannot Attack');
            try { applyRollAttackButtonState(panel, cb); } catch (e) {}
            return;
          }
        } else {
          const atkUsed = Number(cb.attacksUsed) || 0;
          const actUsed = Number(cb.actionsUsed) || 0;
          const actMax = Number(cb.actionsMax) || 1;
          if (atkUsed > 0 && atkUsed < maxAtk) {
            cb.attacksUsed = atkUsed + 1;
          } else if (actUsed >= actMax) {
            toast('No actions left — already used on ' + (cb.lastAction || 'Cast'));
            return;
          } else {
            cb.actionsUsed = actUsed + 1;
            cb.actionUsed = true;
            cb.attacksUsed = 1;
            cb.lastAction = 'Attack';
          }
        }
      }
      const forceCrit = !!panel.querySelector('#cr-force-crit')?.checked;
      // Attack roll only — damage is a separate step after HIT
      const advNow = (document.getElementById('cr-adv') && document.getElementById('cr-adv').value)
        || (panel.querySelector('#cr-adv') && panel.querySelector('#cr-adv').value)
        || 'normal';
      const toHitLive = parseInt((document.getElementById('cr-tohit') || toHitEl || {}).value, 10) || 0;
      const hitBonusLive = parseInt((document.getElementById('cr-hit-bonus') || {}).value, 10) || 0;
      const res = rollCombatAttack({
        adv: advNow,
        toHit: toHitLive,
        hitBonus: hitBonusLive,
        damage: '0',
        dmgBonus: 0,
        forceCrit,
        attackOnly: true
      });
      // Prefer selected target AC if present
      let acVal = parseInt(panel.querySelector('#cr-ac')?.value, 10);
      try {
        const packs = typeof getSelectedTargets === 'function' ? getSelectedTargets() : [];
        if (packs && packs[0] && packs[0].target && packs[0].target.ac != null) {
          const tac = parseInt(packs[0].target.ac, 10);
          if (!isNaN(tac)) {
            acVal = tac;
            const acInput = panel.querySelector('#cr-ac');
            if (acInput && !acInput.value) acInput.value = String(tac);
          }
        }
      } catch (e) {}
      let hits = false;
      let hitLine = '';
      if (!isNaN(acVal)) {
        hits = res.isFumble ? false : (res.isCrit || res.hitTotal >= acVal);
        hitLine = hits ? ` · <strong style="color:#8d8">HIT</strong> vs AC ${acVal}` : ` · <strong style="color:#c66">MISS</strong> vs AC ${acVal}`;
      } else {
        hitLine = ' · <span class="muted">set Target AC to resolve hit</span>';
        hits = false;
      }
      const rollHtml = `<div><strong>${escapeHtml(atkName)}</strong> · ${escapeHtml(res.note)}</div>
          <div>To hit: <strong>${res.formula}</strong>${res.isCrit ? ' · CRIT' : ''}${res.isFumble ? ' · FUMBLE' : ''}${hitLine}</div>
          <div class="muted">${hits ? 'Damage Roll is ready.' : 'Miss — Damage Roll locked.'}</div>`;
      // Adv/dis: animate both d20s; normal: single d20
      try {
        window.__pendingDiceFaces = (res.faces && res.faces.length) ? res.faces : [{ sides: 20, value: res.used }];
      } catch (e) {}
      showRollHtml(rollHtml);
      try { cb.lastRollHtml = rollHtml; } catch (e) {}
      window.__lastCombatRoll = {
        damage: 0,
        heal: 0,
        hit: hits,
        isCrit: !!res.isCrit,
        isFumble: !!res.isFumble,
        hitTotal: res.hitTotal,
        ac: acVal,
        canDamage: hits,
        name: atkName,
        dmgExpr: dmgEl?.value || '1d8',
        dmgBonus: parseInt(panel.querySelector('#cr-dmg-bonus')?.value, 10) || 0
      };
      setDamageRollEnabled(panel, hits, hits ? '' : 'Attack missed AC');
      appendLog(`${atkName}: ${res.formula}` + (isNaN(acVal) ? '' : ((hits ? ' HIT' : ' MISS') + ' vs AC ' + acVal)));
      try {
        appendSharedCombatLog((cb.name || 'Attacker') + ' · ' + atkName + ': ' + res.formula + (isNaN(acVal) ? '' : ((hits ? ' HIT' : ' MISS') + ' vs AC ' + acVal)), { names: [cb.name], ids: [cb.id] });
      } catch (e) {}
      try {
        if (typeof isPlayerRole === 'function' && isPlayerRole()) {
          toast(atkName + ': ' + res.formula + (isNaN(acVal) ? '' : ((hits ? ' HIT' : ' MISS') + ' vs AC ' + acVal)));
        }
      } catch (e) {}
      // Refresh action economy UI (critical on player popup)
      try {
        if (typeof persistTurnEconomy === 'function') persistTurnEconomy(cb);
        save();
        try { if (typeof syncPlayerCombatToDm === 'function') syncPlayerCombatToDm({ kind: 'economy', attacksUsed: cb.attacksUsed, actionsUsed: cb.actionsUsed }); } catch (e) {}
        if (typeof broadcastVttState === 'function' && !(typeof isPlayerRole === 'function' && isPlayerRole())) broadcastVttState('economy');
        // Do NOT full-rebuild the combat panel here — it resets Advantage to Normal
        // and destroys the enabled Damage Roll button / click wiring.
        try {
          if (typeof applyRollAttackButtonState === 'function') applyRollAttackButtonState(panel, cb);
        } catch (e) {}
        try {
          const last = window.__lastCombatRoll || {};
          if (typeof setDamageRollEnabled === 'function') {
            setDamageRollEnabled(panel, !!(last.canDamage || last.hit || last.isCrit), last.canDamage ? '' : 'Hit AC first');
          }
          document.querySelectorAll('#cr-roll-dmg').forEach(btn => {
            if (last.canDamage || last.hit || last.isCrit) {
              btn.disabled = false;
              btn.removeAttribute('disabled');
              btn.classList.add('is-ready');
            }
          });
        } catch (e) {}
        // Light HP/economy text refresh only
        try {
          panel.querySelectorAll('[data-economy], .turn-economy, #pc-economy').forEach(el => {
            el.textContent = el.textContent; // no-op placeholder
          });
        } catch (e) {}
      } catch (e) { /* do not full renderCombat — preserves adv + damage button */ }
      // Hard-disable Roll Attack if no budget left
      try {
        const actLeft = Math.max(0, (Number(cb.actionsMax) || 1) - (Number(cb.actionsUsed) || 0));
        const atkLeft = Math.max(0, (Number(cb.attacksMax) || 1) - (Number(cb.attacksUsed) || 0));
        try { applyRollAttackButtonState(panel, cb); } catch (e) {}
      } catch (e) {}
    });
    try { restoreAdvMode(); } catch (e) {}
    panel.querySelector('#cr-adv')?.addEventListener('change', function() {
      try { sessionStorage.setItem('cr_adv_mode', this.value || 'normal'); } catch (e) {}
    });
    // cr-adv change persist
    panel.querySelector('#cr-roll-dmg')?.addEventListener('click', () => {
      if (window.__combatRollDelegated) return; // capture handler owns Damage Roll
      const last = window.__lastCombatRoll || {};
      let allowed = !!(last.canDamage || last.hit || last.isCrit);
      // Recover if panel rebuild cleared canDamage but totals still show a hit
      // Do not revive a spent hit from historical hitTotal
      if (last.applied === true) {
        toast('Damage already applied — Roll Attack again');
        setDamageRollEnabled(panel, false, 'Roll Attack again');
        return;
      }
      if (!allowed && last.canDamage === true) {
        allowed = true;
      }
      if (!allowed) {
        toast('Score a hit with Roll Attack first');
        setDamageRollEnabled(panel, false, 'Hit AC first');
        return;
      }
      last.canDamage = true;
      last.hit = true;
      const liveDmg = document.getElementById('cr-dmg');
      const expr = (liveDmg && liveDmg.value) || (dmgEl && dmgEl.value) || last.dmgExpr || '1d8';
      let dmg = rollDieExpr(expr);
      const bonus = parseInt(panel.querySelector('#cr-dmg-bonus')?.value, 10) || last.dmgBonus || 0;
      let faces = (dmg.faces || []).slice();
      if (last.isCrit) {
        const dmg2 = rollDieExpr(expr);
        faces = faces.concat(dmg2.faces || []);
        dmg = { total: dmg.total + dmg2.total, detail: dmg.detail + ' + crit ' + dmg2.detail, faces: faces, expr: dmg.expr };
      }
      // bonus is outside dice; do not add to die faces
      let total = dmg.total + (last.isCrit ? 0 : 0);
      // rollDieExpr already includes +bonus in total if present in expr; add field bonus once
      const exprHasBonus = /[+-]\d+$/.test(String(expr).replace(/\s+/g,''));
      if (!exprHasBonus) total = dmg.total + bonus;
      else total = dmg.total;
      // if both, avoid double count: prefer field bonus when expr has no trailing bonus
      const halfBox = !!panel.querySelector('#cr-half')?.checked;
      const previewHalf = halfBox ? Math.floor(total / 2) : total;
      const exprLabel = dmg.expr || expr;
      const rollHtml = `<div><strong>${escapeHtml(last.name || 'Attack')}</strong> · Damage Roll${last.isCrit ? ' (CRIT)' : ''} · ${escapeHtml(String(exprLabel))}</div>
          <div>Damage: <strong>${total}</strong> <span class="muted">(${escapeHtml(dmg.detail)}${(!exprHasBonus && bonus) ? ((bonus >= 0 ? '+' : '') + bonus) : ''})</span>${halfBox ? ' · half preview ' + previewHalf : ''}</div>`;
      // Prefer real die faces for animation (d6/d8/etc.), not a default d20
      try { window.__pendingDiceFaces = faces.length ? faces : null; } catch (e) {}
      showRollHtml(rollHtml); // publishCombatRollResult → playPopupDiceAnimation uses __pendingDiceFaces
      window.__lastCombatRoll = Object.assign({}, last, {
        damage: total,
        heal: 0,
        hit: true,
        canDamage: true,
        applied: false
      });
      const applyAmt = panel.querySelector('#cr-apply-amt');
      if (applyAmt) applyAmt.value = String(total);
      appendLog(`Damage Roll: ${total}`);
      // Auto-apply to selected targets (player + DM)
      try {
        let packs = typeof getSelectedTargets === 'function' ? getSelectedTargets() : [];
        // Fallback: if multi-select empty, use a sensible target so hit damage still applies
        if (!packs.length) {
          try {
            const c2 = getActive();
            const combat2 = c2 ? getCombat(c2) : null;
            const list2 = (combat2 && combat2.combatants) || [];
            let tIdx = -1;
            // Prefer selected combatant if not the attacker
            if (combat2 && combat2.selectedIndex != null && combat2.selectedIndex >= 0) {
              const cand = list2[combat2.selectedIndex];
              if (cand && String(cand.id) !== String(cb.id)) tIdx = combat2.selectedIndex;
            }
            // Else first enemy/villain
            if (tIdx < 0) {
              tIdx = list2.findIndex(x => {
                const s = String(x.side || '').toLowerCase();
                return s === 'enemy' || s === 'villain' || s === 'enemies';
              });
            }
            // Else any other combatant
            if (tIdx < 0) {
              tIdx = list2.findIndex(x => String(x.id) !== String(cb.id));
            }
            if (tIdx >= 0 && list2[tIdx]) {
              packs = [{ combat: combat2, idx: tIdx, target: list2[tIdx] }];
              // Reflect in UI multi-select if present
              try {
                const sel = panel.querySelector('#cr-target');
                if (sel) {
                  [...sel.options].forEach(o => { o.selected = (String(o.value) === String(tIdx)); });
                }
              } catch (e3) {}
            }
          } catch (e2) {}
        }
        if (!packs.length) {
          toast('Damage rolled — select a target to apply, or click Apply Damage (DM)');
        } else {
          packs.forEach(({ target }) => {
            let amt = computeAppliedDamage(total, target, { half: halfBox });
            let left = amt;
            const temp = target.tempHp || 0;
            if (temp > 0) {
              const absorb = Math.min(temp, left);
              target.tempHp = temp - absorb;
              left -= absorb;
            }
            target.hp = Math.max(0, (target.hp || 0) - left);
            if ((typeof isConcentratingCombatant === 'function' ? isConcentratingCombatant(target) : target.concentrating) && left > 0) {
              try { if (typeof concentrationCheck === 'function') concentrationCheck(target, left); } catch (e) { console.warn(e); }
            }
            appendLog(`${target.name || 'Target'} takes ${amt} damage (${target.hp} HP)`);
            try {
              appendSharedCombatLog((cb.name || 'Attacker') + ' deals ' + amt + ' to ' + (target.name || 'target'), { names: [cb.name, target.name], ids: [cb.id, target.id] });
            } catch (e) {}
          });
          window.__lastCombatRoll.applied = true;
          // Consume the hit gate so spam-clicking Damage Roll requires a new hit
          window.__lastCombatRoll.canDamage = false;
          setDamageRollEnabled(panel, false, 'Roll Attack again to hit');
          toast('Damage applied');
          try { save(); } catch (e) {}
          // Sync player → DM
          try {
            packs.forEach(({ target }) => {
              if (typeof broadcastPlayerAction === 'function') {
                broadcastPlayerAction({
                  kind: 'damage',
                  targetId: target.id || target.name,
                  amount: window.__lastCombatRoll.damage,
                  name: window.__lastCombatRoll.name || 'Attack'
                });
              }
            });
          } catch (e) {}
          try {
            if (typeof syncPlayerCombatToDm === 'function') syncPlayerCombatToDm({ kind: 'damage' });
          } catch (e) {}
          try {
            if (typeof isPlayerRole === 'function' && isPlayerRole()) renderPlayerCombatPanel();
            else { renderCombat(); }
            renderMapRoster();
            paintMapFrame();
          } catch (e) {}
        }
      } catch (e) {
        console.warn(e);
      }
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
      showRollHtml(`<div>Save: <strong>${used}${bonus ? (bonus >= 0 ? '+' : '') + bonus : ''} = ${total}</strong> vs DC ${dc} → <strong style="color:${ok ? '#8d8' : '#c66'}">${ok ? 'SUCCESS' : 'FAIL'}</strong></div>`);
      appendLog(`Save ${total} vs DC ${dc}: ${ok ? 'SUCCESS' : 'FAIL'}`);
    });

    panel.querySelector('#cd-conditions')?.addEventListener('change', (e) => {
      cb.conditions = e.target.value;
      try { save(); } catch (err) {}
    });
    panel.querySelector('#cd-token-size')?.addEventListener('change', (e) => {
      const sz = e.target.value || 'Medium';
      cb.size = sz;
      cb.tokenSize = typeof sizeToTokenSquares === 'function' ? sizeToTokenSquares(sz) : 1;
      try { save(); } catch (err) {}
      try { if (typeof paintMapFrame === 'function') paintMapFrame(); } catch (err) {}
      try { if (typeof broadcastVttState === 'function') broadcastVttState('token-size'); } catch (err) {}
      try { if (typeof renderCombat === 'function') renderCombat(); } catch (err) {}
    });
    panel.querySelector('#cd-conc')?.addEventListener('change', (e) => {
      cb.concentrating = !!e.target.checked;
      if (cb.concentrating) {
        // Ensure conditions also mark concentrating for string/array detectors
        try {
          if (typeof cb.conditions === 'string') {
            if (!/concentrat/i.test(cb.conditions)) cb.conditions = (cb.conditions ? cb.conditions + ', ' : '') + 'Concentrating';
          } else if (Array.isArray(cb.conditions)) {
            if (!cb.conditions.some(function(c) { return /concentrat/i.test(String(c && (c.name || c) || '')); })) {
              cb.conditions.push('Concentrating');
            }
          } else {
            cb.conditions = ['Concentrating'];
          }
        } catch (e2) {}
      }
      try { save(); } catch (err) {}
      try { if (typeof broadcastVttState === 'function') broadcastVttState('concentrating-toggle'); } catch (err) {}
      try { if (typeof playerPersistAndSyncCombat === 'function' && isPlayerRole()) playerPersistAndSyncCombat(); } catch (err) {}
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
      // Public log: no HP totals
      try {
        if (typeof appendSharedCombatLog === 'function') {
          appendSharedCombatLog((cb.name || 'Combatant') + ' takes ' + amt + ' damage', { names: [cb.name], ids: [cb.id] });
        } else {
          appendLog((cb.name || 'Combatant') + ' takes ' + amt + ' damage');
        }
      } catch (e) {}
      if (left > 0 && (typeof isConcentratingCombatant === 'function' ? isConcentratingCombatant(cb) : cb.concentrating)) {
        try { if (typeof concentrationCheck === 'function') concentrationCheck(cb, left); } catch (e) { console.warn(e); }
      }
      try { save(); } catch (e) {}
      try { if (isPlayerRole()) renderPlayerCombatPanel(); else renderCombat(); } catch (e) { try { renderCombat(); } catch (e2) {} }
    });
    panel.querySelector('#cd-heal')?.addEventListener('click', async () => {
      const amt = parseInt(prompt('Heal amount?', '5'), 10);
      if (isNaN(amt) || amt <= 0) return;
      cb.hp = Math.min(cb.hpMax || amt, (cb.hp || 0) + amt);
      appendLog(`Healed ${amt} (HP now ${cb.hp})`);
      try { appendSharedCombatLog((cb.name || 'Character') + ' healed for ' + amt + ' (now ' + cb.hp + ')', { names: [cb.name], ids: [cb.id] }); } catch (e) {}
      try { save(); } catch (e) {}
      try { if (isPlayerRole()) renderPlayerCombatPanel(); else renderCombat(); } catch (e) { try { renderCombat(); } catch (e2) {} }
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
      if (window.__lastCombatRoll && window.__lastCombatRoll.isSpecial && kind === 'damage') {
        toast('That effect already resolved (no damage roll)');
        return;
      }
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
          amt = (typeof computeAppliedDamage === 'function')
            ? computeAppliedDamage(amt, target, { half: half })
            : (half ? Math.floor(amt / 2) : amt);
          let left = amt;
          const temp = target.tempHp || 0;
          if (temp > 0) {
            const absorb = Math.min(temp, left);
            target.tempHp = temp - absorb;
            left -= absorb;
          }
          const fromSpell = (window.__lastCombatRoll && window.__lastCombatRoll.name) || '';
          if (/^harm$/i.test(String(fromSpell).trim())) {
            target.hp = Math.max(1, (target.hp || 0) - left);
          } else {
            target.hp = Math.max(0, (target.hp || 0) - left);
          }
          if ((typeof isConcentratingCombatant === 'function' ? isConcentratingCombatant(target) : target.concentrating) && left > 0) {
            try { if (typeof concentrationCheck === 'function') concentrationCheck(target, left); } catch (e) { console.warn(e); }
          }
          if (target.hp === 0) target.deathSaves = target.deathSaves || { successes: 0, failures: 0 };
          if (!target.combatLog) target.combatLog = [];
          target.combatLog.push(`Took ${amt} from ${cb.name || 'attacker'}`);
          try { appendSharedCombatLog((cb.name || 'Attacker') + ' dealt ' + amt + ' to ' + (target.name || 'target') + ' (now ' + target.hp + '/' + (target.hpMax || '?') + ')', { names: [cb.name, target.name], ids: [cb.id, target.id] }); } catch (e) {}
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
          applyHealToCombatant(target, amt);
          appendLog(`Healed ${target.name} for ${amt} (now ${target.hp}/${target.hpMax})`);
          try { appendSharedCombatLog((cb.name || 'Healer') + ' healed ' + (target.name || 'ally') + ' for ' + amt, { names: [cb.name, target.name], ids: [cb.id, target.id] }); } catch (e) {}
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
        if (typeof spendLegendaryResist === 'function') spendLegendaryResist(cb);
        else cb.legendaryResist = Math.max(0, (cb.legendaryResist != null ? cb.legendaryResist : cb.legendaryResistMax) - 1);
        try { save(); } catch (e) {}
        try { renderCombat(); } catch (e) {}
        try { if (typeof showCombatDetail === 'function') showCombatDetail(cb, window.__combatDetailPanel); } catch (e) {}
      });
      panel.querySelector('#cd-lr-use')?.addEventListener('click', () => {
        const ok = typeof spendLegendaryResist === 'function' ? spendLegendaryResist(cb) : false;
        if (!ok && (cb.legendaryResist == null || cb.legendaryResist <= 0)) { toast('No Legendary Resistances left'); return; }
        if (!ok) cb.legendaryResist = Math.max(0, (Number(cb.legendaryResist) || 0) - 1);
        toast('Legendary Resistance used (' + (cb.legendaryResist || 0) + ' left)');
        try { save(); } catch (e) {}
        try { renderCombat(); } catch (e) {}
        try { if (typeof showCombatDetail === 'function') showCombatDetail(cb, window.__combatDetailPanel); } catch (e) {}
      });
      panel.querySelector('#cd-lr-dec')?.addEventListener('click', () => {
        if (typeof spendLegendaryResist === 'function') spendLegendaryResist(cb);
        else cb.legendaryResist = Math.max(0, (Number(cb.legendaryResist) || 0) - 1);
        try { save(); } catch (e) {}
        try { renderCombat(); } catch (e) {}
      });
    })();

    
    // Resource / slot / attack budget wiring
    panel.querySelectorAll('.cd-res-dec').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.res;
        if (!cb.combatResources || !cb.combatResources[id]) return;
        const r = cb.combatResources[id];
        const max = Number(r.max) || 0;
        r.used = Math.max(0, (Number(r.used) || 0) - 1);
        r.current = Math.max(0, max - (Number(r.used) || 0));
        if (max >= 99) r.current = 99;
        syncCombatResourcesToCharacter(cb);
        try { save(); } catch(e) {}
        try { appendSharedCombatLog((cb.name || 'Character') + ' restored 1 ' + (r.label || id), { names: [cb.name], ids: [cb.id] }); } catch (e) {}
        softRefreshCombatDetail(cb, panel);
      });
    });
    panel.querySelectorAll('.cd-res-inc').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.res;
        if (!cb.combatResources || !cb.combatResources[id]) return;
        const r = cb.combatResources[id];
        const maxU = r.max >= 99 ? 99 : (Number(r.max) || 0);
        r.used = Math.min(maxU, (Number(r.used) || 0) + 1);
        r.current = Math.max(0, maxU - (Number(r.used) || 0));
        if (r.max >= 99) r.current = 99;
        syncCombatResourcesToCharacter(cb);
        try { save(); } catch(e) {}
        softRefreshCombatDetail(cb, panel);
      });
    });
    panel.querySelectorAll('.cd-res-spend').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.res;
        if (!cb.combatResources || !cb.combatResources[id]) {
          toast('Resource not available');
          return;
        }
        const r = cb.combatResources[id];
        const maxU = r.max >= 99 ? 99 : (Number(r.max) || 0);
        const left = maxU >= 99 ? 99 : Math.max(0, maxU - (Number(r.used) || 0));
        if (maxU < 99 && left <= 0) {
          toast((r.label || id) + ' exhausted');
          return;
        }
        // Prefer spendCombatResource when present
        let ok = false;
        if (typeof spendCombatResource === 'function') {
          ok = spendCombatResource(cb, id, 1);
        }
        if (!ok) {
          r.used = Math.min(maxU, (Number(r.used) || 0) + 1);
          r.current = Math.max(0, maxU - (Number(r.used) || 0));
          if (r.max >= 99) r.current = 99;
          ok = true;
        }
        // Keep used/current consistent after spendCombatResource
        if (r.max != null) {
          const max = Number(r.max) || 0;
          if (r.current != null && (r.used == null || isNaN(r.used))) {
            r.used = Math.max(0, max - (Number(r.current) || 0));
          }
          if (r.used != null) r.current = Math.max(0, max - (Number(r.used) || 0));
        }
        syncCombatResourcesToCharacter(cb);
        try { save(); } catch(e) {}
        // Action Surge: +1 Action this turn AND allow a fresh Attack series (Extra Attack again)
        if (String(id) === 'action-surge' || /action.?surge/i.test(String(r.label || ''))) {
          cb.extraActionsGranted = (Number(cb.extraActionsGranted) || 0) + 1;
          let newMax = (typeof actionsMaxForCombatant === 'function') ? actionsMaxForCombatant(cb, null) : ((Number(cb.actionsMax) || 1) + 1);
          const used = Number(cb.actionsUsed) || 0;
          if (newMax <= used) newMax = used + 1;
          cb.actionsMax = newMax;
          cb.actionUsed = used >= newMax;
          // New Action can be Attack → reset weapon-attack budget for Extra Attack
          cb.attacksUsed = 0;
          try { if (typeof clearSessionAttacksUsed === 'function') clearSessionAttacksUsed(cb); } catch (e) {}
          try { if (typeof persistTurnEconomy === 'function') persistTurnEconomy(cb); } catch (e) {}
          try { save(); } catch (e) {}
          toast('Action Surge — +1 Action · weapon attacks refreshed');
          try {
            if (typeof isPlayerRole === 'function' && isPlayerRole()) renderPlayerCombatPanel();
            else { try { renderCombat(); } catch (e2) {} try { refreshCombatDetail(); } catch (e2) {} }
          } catch (e) {}
          try { if (typeof syncPlayerCombatToDm === 'function') syncPlayerCombatToDm({ kind: 'action-surge' }); } catch (e) {}
        }
        const leftAfter = (Number(r.max) || 0) >= 99 ? '∞' : Math.max(0, (Number(r.max) || 0) - (Number(r.used) || 0));
        if (String(id) !== 'action-surge' && !/action.?surge/i.test(String(r.label || ''))) {
          toast((r.label || id) + ' used · ' + leftAfter + ' left');
        }
        try {
          appendSharedCombatLog((cb.name || 'Character') + ' used ' + (r.label || id) + ' (' + leftAfter + ' left)', { names: [cb.name], ids: [cb.id] });
        } catch (e) {}
        softRefreshCombatDetail(cb, panel);
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
      const L = panel.querySelector('#cr-upcast-level')?.value
        || panel.querySelector('#cr-spell-slot')?.value
        || '';
      if (!L || L === '0' || !cb.combatSpellSlots || !cb.combatSpellSlots[L]) { toast('No slot available at that level'); return; }
      const s = cb.combatSpellSlots[L];
      if ((s.used || 0) >= s.max) { toast('No slots left at this level'); return; }
      // Spending a leveled slot is casting — costs 1 Action unless already paid this turn for a cast
      if (cb.actionsMax == null) cb.actionsMax = 1;
      if (cb.actionsUsed == null) cb.actionsUsed = 0;
      // Slot spend is a cast: only skip charge if menu prepaid exactly once
      const menuPrepaid = String(cb.lastAction || '') === 'Cast a spell' && (Number(cb.actionsUsed) || 0) > 0;
      if (menuPrepaid) {
        cb.lastAction = 'Cast (slot L' + L + ')';
        cb.attacksUsed = Number(cb.attacksMax) || 1;
        cb.actionUsed = true;
      } else {
        if (typeof spendMainCombatAction === 'function') {
          if (!spendMainCombatAction(cb, 'cast', 'Cast (slot L' + L + ')')) return;
        } else if ((Number(cb.actionsUsed) || 0) >= (Number(cb.actionsMax) || 1)) {
          toast('No actions left — cannot spend slot as a new cast');
          return;
        } else {
          cb.actionsUsed = (Number(cb.actionsUsed) || 0) + 1;
          cb.actionUsed = true;
          cb.attacksUsed = Number(cb.attacksMax) || 1;
          cb.lastAction = 'Cast (slot L' + L + ')';
        }
      }
      s.used = (s.used || 0) + 1;
      const act = window.__activeCombatAction;
      const left = Math.max(0, (Number(cb.actionsMax) || 1) - (Number(cb.actionsUsed) || 0));
      appendLog('Spent L' + L + ' slot' + (act ? ' for ' + act.name : '') + ' · Action ' + cb.actionsUsed + '/' + cb.actionsMax);
      toast('Spent level ' + L + ' slot · Action used (' + left + ' left)');
      try {
        appendSharedCombatLog((cb.name || 'Caster') + ' spent L' + L + ' slot (Action · ' + left + ' left)', { names: [cb.name], ids: [cb.id] });
      } catch (e) {}
      syncCombatResourcesToCharacter(cb);
      try { save(); } catch (e) {}
      refreshCombatDetail();
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
          if (typeof showCombatDetail === 'function') showCombatDetail(combat.combatants[sel], window.__combatDetailPanel);
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
      cb.attacksUsed = 0;
      try { if (typeof persistTurnEconomy === 'function') persistTurnEconomy(cb); } catch (e) {}
      try { save(); } catch (e) {}
      refreshCombatDetail();
    });
    // Actions budget (+ Haste / Action Surge)
    panel.querySelector('#cd-act-dec')?.addEventListener('click', () => {
      cb.actionsUsed = Math.max(0, (Number(cb.actionsUsed) || 0) - 1);
      cb.actionUsed = (Number(cb.actionsUsed) || 0) >= (Number(cb.actionsMax) || 1);
      refreshCombatDetail();
    });
    panel.querySelector('#cd-act-inc')?.addEventListener('click', () => {
      const max = Number(cb.actionsMax) || 1;
      cb.actionsUsed = Math.min(max, (Number(cb.actionsUsed) || 0) + 1);
      cb.actionUsed = (Number(cb.actionsUsed) || 0) >= max;
      refreshCombatDetail();
    });
    panel.querySelector('#cd-act-reset')?.addEventListener('click', () => {
      cb.actionsUsed = 0;
      cb.actionUsed = false;
      cb.lastAction = null;
      try { if (typeof persistTurnEconomy === 'function') persistTurnEconomy(cb); } catch (e) {}
      try { save(); } catch (e) {}
      refreshCombatDetail();
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
      const max = Number(cb.actionsMax) || 1;
      if ((Number(cb.actionsUsed) || 0) >= max) {
        cb.actionsUsed = 0;
        cb.actionUsed = false;
      } else {
        cb.actionsUsed = max;
        cb.actionUsed = true;
      }
      refreshCombatDetail();
    });

    // Full Action menu
    panel.querySelectorAll('.act-opt').forEach(btn => {
      btn.addEventListener('click', async () => {
        if ((cb.turnPhase || 'ready') !== 'active') { toast('Wait for the DM to advance to your turn'); return; }
        if ((Number(cb.actionsUsed) || 0) >= (Number(cb.actionsMax) || 1)) { toast('No actions left this turn'); return; }
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
        } else if (act === 'grapple' || act === 'shove') {
          cb.lastAction = act === 'grapple' ? 'Grapple' : 'Shove';
          toast(cb.lastAction + ' — resolve Athletics contest vs target (use Apply condition Grappled/Prone on success)');
        } else {
          cb.lastAction = labels[act] || act;
        }
        if (act === 'cast') {
          // Mark Action spent for casting; finish with Spellcasting panel (slot / Cast button)
          if (cb.actionsMax == null) cb.actionsMax = 1;
          if (cb.actionsUsed == null) cb.actionsUsed = 0;
          if ((Number(cb.actionsUsed) || 0) >= (Number(cb.actionsMax) || 1)) {
            toast('No actions left this turn');
            return;
          }
          if (typeof spendMainCombatAction === 'function') {
            if (!spendMainCombatAction(cb, 'cast', 'Cast a spell')) return;
          } else {
            cb.actionsUsed = (Number(cb.actionsUsed) || 0) + 1;
            cb.actionUsed = true;
            cb.attacksUsed = Number(cb.attacksMax) || 1;
            cb.lastAction = 'Cast a spell';
          }
          toast('Action+Attack budget: Cast a spell — pick spell and Cast / Spend Slot');
          try { appendSharedCombatLog((cb.name || 'Caster') + ' uses Action to Cast a spell', { names: [cb.name], ids: [cb.id] }); } catch (e) {}
        } else if (typeof spendAction === 'function') {
          if (!spendAction(cb, labels[act] || act)) return;
        } else {
          cb.actionsUsed = (Number(cb.actionsUsed) || 0) + 1;
          cb.actionUsed = true;
          cb.lastAction = labels[act] || act;
        }
        if (act === 'dodge') { try { addCondition(cb, 'dodging', 1); } catch (e) {} }
        if (act === 'hide') { try { addCondition(cb, 'hiding', 1); } catch (e) {} }
        if (act === 'disengage') { cb.disengage = true; }
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
      // Manual start (normally DM presses Next Turn)
      try {
        const c0 = getActive();
        let ch0 = null;
        if (c0) {
          const lists = [].concat(c0.party || [], c0.villains || []);
          ch0 = lists.find(x => x && (x.id === cb.charId || x.id === cb.sourceId || x.name === cb.name));
        }
        if (typeof beginCombatantTurn === 'function') beginCombatantTurn(cb, ch0);
        else {
          cb.turnPhase = 'active';
          cb.attacksUsed = 0;
          cb.moveUsed = 0;
          cb.actionsUsed = 0;
          cb.actionsMax = 1;
          cb.extraActionsGranted = 0;
          cb.actionUsed = false;
          cb.bonusUsed = false;
          cb.objectInteractUsed = false;
          cb.reactionUsed = false;
        }
      } catch (e) {
        cb.turnPhase = 'active';
      }
      if ((cb.hp || 0) <= 0 && !cb.dead) {
        try {
          const ds = rollDeathSave(cb);
          if (ds) toast('Death save: ' + ds.roll + ' (S' + (ds.successes||cb.deathSaves?.successes||0) + '/F' + (ds.failures||cb.deathSaves?.failures||0) + ')');
        } catch (e) {}
      }
      if (typeof canTakeActions === 'function' && !canTakeActions(cb) && (cb.hp || 0) > 0) {
        toast(cb.name + ' cannot take actions (condition)');
      }
      if (cb.legendary) {
        cb.legendaryActionsLeft = cb.legendaryActionsPerRound != null ? cb.legendaryActionsPerRound : 3;
      }
      if ((cb.hp || 0) <= 0) {
        toast('At 0 HP — roll death save (Death Saves section)');
      }
      try { appendLog((cb.name || 'Combatant') + ': start of turn'); } catch (e) {}
      try { appendSharedCombatLog('Start turn: ' + (cb.name || 'Combatant'), { names: [cb.name], ids: [cb.id] }); } catch (e) {}
      refreshCombatDetail();
    });
    panel.querySelector('#cd-end-turn-local')?.addEventListener('click', () => {
      cb.turnPhase = 'ended';
      try { tickConditionRounds(cb); } catch (e) {}
      try { removeCondition(cb, 'dodging'); } catch (e) {}
      appendLog(`${cb.name}: end of turn`);
      refreshCombatDetail();
    });
    panel.querySelector('#cd-death-save')?.addEventListener('click', () => {
      const ds = rollDeathSave(cb);
      if (!ds) toast('Not dying');
      else toast('Death save ' + ds.roll);
      save(); refreshCombatDetail();
    });
    panel.querySelector('#cd-leg-resist')?.addEventListener('click', () => {
      useLegendaryResistance(cb);
      save(); refreshCombatDetail();
    });
    panel.querySelector('#cd-cover')?.addEventListener('change', (e) => {
      cb.cover = Number(e.target.value) || 0;
      save();
    });
    const cov = panel.querySelector('#cd-cover');
    if (cov) cov.value = String(cb.cover || 0);
    const dsEl = panel.querySelector('#cd-death-status');
    if (dsEl && cb.deathSaves) {
      dsEl.textContent = (cb.hp <= 0 ? ('Death S' + (cb.deathSaves.successes||0) + '/F' + (cb.deathSaves.failures||0) + (cb.dead ? ' DEAD' : cb.stable ? ' stable' : '')) : '');
    }
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
        ? listCharacterSpellsForCombat(partyChar || cb)
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
        // Prefer shared helper (syncs to character + toast)
        if (typeof expendCombatSpellSlot === 'function') {
          const ok = expendCombatSpellSlot(cb, level);
          if (ok) {
            try { if (typeof persistTurnEconomy === 'function') persistTurnEconomy(cb); } catch (e) {}
            try { save(); } catch (e) {}
            try { if (typeof syncPlayerCombatToDm === 'function') syncPlayerCombatToDm({ kind: 'slot', level: level }); } catch (e) {}
          }
          return ok;
        }
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
        try { if (typeof syncCombatResourcesToCharacter === 'function') syncCombatResourcesToCharacter(cb); } catch (e) {}
        try { save(); } catch (e) {}
        return true;
      }

      function applyCastEconomy(sp, slotLevel) {
        if (cb.actionsMax == null || !(Number(cb.actionsMax) > 0)) cb.actionsMax = 1;
        if (cb.actionsUsed == null) cb.actionsUsed = 0;
        const timeRaw = sp && (sp.time || sp.castingTime || sp.casting_time);
        const bucket = castingTimeBucket(timeRaw);
        const spellLabel = (sp && (sp.name || sp.label)) || 'spell';
        if (bucket === 'bonus') {
          if (cb.bonusUsed) {
            toast('Bonus action already used this turn');
            return false;
          }
          cb.bonusUsed = true;
          if (!cb.bonusActionsUsed) cb.bonusActionsUsed = {};
          cb.bonusActionsUsed['cast-spell'] = true;
          toast('Bonus action: Cast ' + spellLabel);
        } else if (bucket === 'reaction') {
          if (cb.reactionUsed) {
            toast('Reaction already used');
            return false;
          }
          cb.reactionUsed = true;
          toast('Reaction: Cast ' + spellLabel);
        } else {
          // Only the action-menu placeholder "Cast a spell" pre-pays a single cast
          const menuPrepaid = (Number(cb.actionsUsed) || 0) > 0 && String(cb.lastAction || '') === 'Cast a spell';
          if (menuPrepaid) {
            cb.lastAction = 'Cast ' + spellLabel;
            cb.attacksUsed = Number(cb.attacksMax) || 1;
            cb.actionUsed = true;
          } else {
            if (typeof spendMainCombatAction === 'function') {
              if (!spendMainCombatAction(cb, 'cast', 'Cast ' + spellLabel)) return false;
            } else {
              if ((Number(cb.actionsUsed) || 0) >= (Number(cb.actionsMax) || 1)) {
                toast('No actions left this turn — cannot cast');
                return false;
              }
              cb.actionsUsed = (Number(cb.actionsUsed) || 0) + 1;
              cb.actionUsed = true;
              cb.attacksUsed = Number(cb.attacksMax) || 1;
              cb.lastAction = 'Cast ' + spellLabel;
            }
          }
          try { if (typeof persistTurnEconomy === 'function') persistTurnEconomy(cb); } catch (e) {}
          const left = Math.max(0, (Number(cb.actionsMax) || 1) - (Number(cb.actionsUsed) || 0));
          const atkLeft = Math.max(0, (Number(cb.attacksMax) || 1) - (Number(cb.attacksUsed) || 0));
          toast('Cast ' + spellLabel + ' · Actions ' + left + ' · Weapon attacks ' + atkLeft);
          try {
            appendSharedCombatLog((cb.name || 'Caster') + ' casts ' + spellLabel + ' (Action+Attack budget)', { names: [cb.name], ids: [cb.id] });
          } catch (e) {}
        }
        {
          // Resolve leveled slot even if sp.level missing on imported spell objects
          let need = Math.max(Number(sp && sp.level) || 0, Number(slotLevel) || 0);
          try {
            const up = panel.querySelector('#cr-upcast-level') || panel.querySelector('#cr-spell-slot') || panel.querySelector('#cr-slot-level');
            if (up && up.value) need = Math.max(need, parseInt(up.value, 10) || 0);
          } catch (e) {}
          // Magic Missile etc. are level 1 minimum when recognized
          const nm = String((sp && (sp.name || sp.label)) || '').toLowerCase();
          if (need <= 0 && /missile|fireball|shield|mage armor|magic missile/.test(nm)) need = 1;
          if (need > 0) {
            if (typeof spendSlot === 'function') {
              if (!spendSlot(need)) return false;
            } else if (typeof expendCombatSpellSlot === 'function') {
              if (!expendCombatSpellSlot(cb, need)) return false;
            }
          }
        }
        if (sp && sp.concentration) {
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
        try { save(); } catch (e) {}
        // Prefill roller for damage / heal
        const mode = panel.querySelector('#cr-mode');
        const hitIn = panel.querySelector('#cr-hit-bonus') || panel.querySelector('#cr-to-hit') || panel.querySelector('#cr-tohit');
        const dmgIn = panel.querySelector('#cr-dmg') || panel.querySelector('#cr-damage') || panel.querySelector('#cr-damage-dice');
        const dcIn = panel.querySelector('#cr-dc') || panel.querySelector('#cr-save-dc');
        const applyAmt = panel.querySelector('#cr-apply-amt');
        const slotNeed = Math.max(sp.level || 0, Number(slotLevel) || sp.level || 0);
        const cls = typeof classifySpellAction === 'function' ? classifySpellAction(sp.name, sp.description || '') : { kind: 'utility' };
        const spellName = String(sp.name || sp.label || '').trim();
        const isHeal = isHealingSpellName(spellName);
        const isAuto = isAutoHitSpellName(spellName) || (/missile/i.test(spellName) && !/power\s*word/i.test(spellName));

        // Special threshold spells (PWK etc.) — before heal/auto damage paths
        if (typeof resolveSpecialSpellOnCast === 'function') {
          const handled = resolveSpecialSpellOnCast(
            Object.assign({}, sp, { name: spellName }),
            panel, cb, getSelectedTargets, appendLog, toast, escapeHtml
          );
          if (handled) {
            window.__lastCombatRoll = window.__lastCombatRoll || { damage: 0, heal: 0, hit: false, name: spellName, isSpecial: true };
            try { save(); } catch (e) {}
            try { renderCombat(); } catch (e) {}
            try {
              const c2 = getActive();
              const combat2 = getCombat(c2);
              if (combat2) {
                combat2.selectedIndex = (combat2.combatants || []).findIndex(x => x.id === cb.id || x.name === cb.name);
              }
            } catch (e) {}
            try { refreshCombatDetail(); } catch (e) {}
            return;
          }
        }

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
          // Auto-hit (Magic Missile etc.): no attack roll, but damage dice ARE rolled
          let expr = (typeof spellDamageDice === 'function') ? spellDamageDice(sp, slotNeed || 1) : '3d4+3';
          if (!expr || expr === '1d8' || expr === '1d8+3') {
            // Fallback Magic Missile: 3 darts at L1, +1 dart/level
            const L = Math.max(1, slotNeed || sp.level || 1);
            const darts = 2 + L; // L1 = 3 darts
            expr = darts + 'd4+' + darts;
          }
          if (dmgIn) dmgIn.value = expr;
          const rolled = rollDieExpr(expr);
          const total = rolled.total;
          const rollHtml = `<div><strong>${escapeHtml(sp.name)}</strong> · auto-hit</div>
            <div>Damage: <strong>${total}</strong> <span class="muted">(${escapeHtml(rolled.detail)})</span></div>
            <div class="muted">No attack roll — force darts hit automatically.</div>`;
          try {
            if (typeof publishCombatRollResult === 'function') publishCombatRollResult(rollHtml, cb);
            else {
              const box = panel.querySelector('#cr-result') || panel.querySelector('#combat-roll-result');
              if (box) { box.classList.remove('muted'); box.style.display = 'block'; box.innerHTML = rollHtml; }
            }
          } catch (e) {}
          window.__lastCombatRoll = {
            damage: total,
            heal: 0,
            hit: true,
            isHeal: false,
            isAuto: true,
            name: sp.name,
            dmgExpr: expr,
            dmgDetail: rolled.detail
          };
          if (applyAmt) applyAmt.value = String(total);
          {
            const packs = getSelectedTargets();
            if (packs.length) {
              applyToTarget('damage');
              try { if (typeof syncPlayerCombatToDm === 'function') syncPlayerCombatToDm({ kind: 'damage', name: sp.name }); } catch (e) {}
              toast(sp.name + ': rolled ' + total + ' damage → applied to ' + packs.length + ' target(s)');
            } else {
              toast(sp.name + ': rolled ' + total + ' damage — select target(s), then Apply Damage');
            }
          }
          try { appendLog(sp.name + ' damage ' + total + ' (' + rolled.detail + ')'); } catch (e) {}
        } else {
          const expr = spellDamageDice(sp, slotNeed || sp.level || 1);
          // Always apply upcast-scaled dice into the roller
          if (dmgIn && expr) dmgIn.value = expr;
          try {
            // Prefill animation faces from a sample roll only when auto-applying later; store expr for Damage Roll
            window.__lastCombatRoll = Object.assign({}, window.__lastCombatRoll || {}, {
              dmgExpr: expr,
              name: sp.name || (window.__lastCombatRoll && window.__lastCombatRoll.name) || 'Spell',
              // Save DC / attack spells still need a hit or save before damage unless auto
            });
          } catch (e) {}
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
          onCast: (slot) => { Promise.resolve(doCast(sp, slot)).then(function() {
          try { persistTurnEconomy(cb); save(); refreshCombatDetail(); } catch (e) {}
        }); }
        });
      });

      panel.querySelector('#cr-spell-cast')?.addEventListener('click', () => {
        const sp = currentSpell();
        const up = panel.querySelector('#cr-upcast-level');
        const fromSlot = slotSel ? Number(slotSel.value) || 0 : 0;
        const fromUp = up ? Number(up.value) || 0 : 0;
        let slot = Math.max(fromSlot, fromUp);
        if (sp && sp.level > 0) slot = Math.max(slot, Number(sp.level) || 0);
        // Keep both selects in sync
        if (slotSel && slot) slotSel.value = String(slot);
        if (up && slot) up.value = String(slot);
        doCast(sp, slot).then(function() {
          try { if (typeof persistTurnEconomy === 'function') persistTurnEconomy(cb); } catch (e) {}
          try { save(); } catch (e) {}
          try { refreshCombatDetail(); } catch (e) { try { softRefreshCombatDetail(cb, panel); } catch (e2) {} }
        }).catch(function() {});
      });
      // Keep upcast + cast-with-slot selects synchronized
      function syncSlotSelects(from) {
        const a = panel.querySelector('#cr-spell-slot');
        const b = panel.querySelector('#cr-upcast-level');
        if (!a || !b) return;
        if (from === 'a' && a.value && a.value !== '0') b.value = a.value;
        if (from === 'b' && b.value) a.value = b.value;
      }
      panel.querySelector('#cr-spell-slot')?.addEventListener('change', () => syncSlotSelects('a'));
      panel.querySelector('#cr-upcast-level')?.addEventListener('change', () => syncSlotSelects('b'));


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

    panel.querySelector('#cr-apply-dmg')?.addEventListener('click', () => {
      applyToTarget('damage');
      try { save(); } catch (e) {}
      try { if (typeof syncPlayerCombatToDm === 'function') syncPlayerCombatToDm({ kind: 'damage' }); } catch (e) {}
      try {
        if (typeof isPlayerRole === 'function' && isPlayerRole()) renderPlayerCombatPanel();
        else renderCombat();
      } catch (e) {}
    });
    panel.querySelector('#cr-apply-heal')?.addEventListener('click', () => {
      applyToTarget('heal');
      try { save(); } catch (e) {}
      try { if (typeof syncPlayerCombatToDm === 'function') syncPlayerCombatToDm({ kind: 'heal' }); } catch (e) {}
      try {
        if (typeof isPlayerRole === 'function' && isPlayerRole()) renderPlayerCombatPanel();
        else renderCombat();
      } catch (e) {}
    });
    panel.querySelector('#cr-apply-cond')?.addEventListener('click', () => applyToTarget('cond'));

    window.__activeCombatAction = null;
    function refreshTargetList(profile) {
      const sel = panel.querySelector('#cr-target');
      const hint = panel.querySelector('#cr-target-hint');
      if (!sel) return;
      let combatants = [];
      try { combatants = getCombat(getActive()).combatants || []; } catch (e) {}
      const visible = combatants.filter(x => typeof playerCanSeeCombatant !== 'function' || playerCanSeeCombatant(cb, x));
      const valid = profile ? filterTargetsByProfile(visible, cb, profile) : visible;
      const validSet = new Set(valid.map(x => x.id || x.name));
      sel.innerHTML = visible.map((x) => {
        const i = combatants.indexOf(x);
        const ok = validSet.has(x.id || x.name);
        const base = typeof formatCombatTargetLabel === 'function' ? formatCombatTargetLabel(x, cb) : `${x.name} (${x.hp}/${x.hpMax}) · ${x.side || '?'}`;
        const label = base + (ok ? '' : ' · invalid');
        return `<option value="${i}" ${ok ? '' : 'disabled'}>${escapeHtml(label)}</option>`;
      }).join('') || '<option disabled>No visible combatants</option>';
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
        const list = listCharacterSpellsForCombat(partyChar || cb);
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
    // After any panel rebuild, restore open Damage Roll gate (save/render was clearing disabled state)
    try {
      var lastGate = window.__lastCombatRoll || {};
      if (lastGate.canDamage === true && lastGate.applied !== true) {
        if (typeof setDamageRollEnabled === 'function') {
          setDamageRollEnabled(panel, true, 'Roll damage and apply');
        }
        panel.querySelectorAll('#cr-roll-dmg').forEach(function(btn) {
          btn.disabled = false;
          btn.removeAttribute('disabled');
          btn.classList.add('is-ready');
          btn.title = 'Roll damage and apply to selected target(s)';
        });
      }
    } catch (e) {}
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

  function spellLabelName(label) {
    if (label == null) return '';
    if (typeof label === 'object') {
      return String(label.name || label.label || label.title || label.spell || '').trim();
    }
    return String(label).trim();
  }

  function splitSpellNames(raw) {
    if (raw == null || raw === '') return [];
    if (Array.isArray(raw)) {
      return raw.map(spellLabelName).filter(Boolean).map(s => s.replace(/\s+/g, ' '));
    }
    if (typeof raw === 'object') {
      // single spell object
      const one = spellLabelName(raw);
      return one ? [one] : [];
    }
    return String(raw)
      .replace(/\r/g, '')
      .split(/[\n;,]+/)
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
      const cleanName = (typeof spellLabelName === 'function' ? spellLabelName(name) : String(name || '')).replace(/\\n/g, ' ').replace(/\s+/g, ' ').trim();
      if (!cleanName || /^\[object object\]$/i.test(cleanName)) return;
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
    try { renderSharedCombatLog(); } catch (e) {}

    ensureCombatWorkspace();
    // Player client: keep map + personal panel, don't rebuild DM combat list
    if (typeof isPlayerRole === 'function' && isPlayerRole()) {
      try { renderPlayerCombatPanel(); } catch (e) {}
      try { renderMapRoster(); } catch (e) {}
      try { renderBattleMap(); } catch (e) {}
      return;
    }
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
      if (dmg > 0 && (typeof isConcentratingCombatant === 'function' ? isConcentratingCombatant(cb) : cb.concentrating)) {
        try {
          if (typeof concentrationCheck === 'function') concentrationCheck(cb, dmg);
          else {
            const dc = Math.max(10, Math.floor(dmg / 2));
            const roll = 1 + Math.floor(Math.random() * 20);
            const ok = roll >= dc;
            if (!ok) cb.concentrating = false;
            try { toast('Concentration DC ' + dc + ': ' + roll + ' (' + (ok ? 'maintained' : 'lost') + ')'); } catch (e) {}
          }
        } catch (e) { console.warn(e); }
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
      try { appendSharedCombatLog('End turn: ' + (prev.name || 'Combatant'), { names: [prev.name], ids: [prev.id] }); } catch (e) {}
    }
    combat.turnIndex = (combat.turnIndex + 1) % combat.combatants.length;
    const next = combat.combatants[combat.turnIndex];
    if (next) {
      // DM Next Turn both ends previous and starts next (no separate Start turn required)
      let chNext = null;
      try {
        const lists = [].concat(c.party || [], c.villains || []);
        chNext = lists.find(x => x && (x.id === next.sourceId || x.id === next.charId || x.characterId === next.sourceId)) || null;
      } catch (e) {}
      if (typeof beginCombatantTurn === 'function') beginCombatantTurn(next, chNext);
      else {
        next.turnPhase = 'active';
        next.attacksUsed = 0;
        next.moveUsed = 0;
        next.actionsUsed = 0;
        next.actionsMax = 1;
        next.extraActionsGranted = 0;
        next.actionUsed = false;
        next.bonusUsed = false;
        next.objectInteractUsed = false;
        next.reactionUsed = false;
      }
      try { appendSharedCombatLog('Start turn: ' + (next.name || 'Combatant'), { names: [next.name], ids: [next.id] }); } catch (e) {}
    }
    if (combat.turnIndex === 0) {
      combat.round = (combat.round || 1) + 1;
      try { appendSharedCombatLog('— Round ' + combat.round + ' —'); } catch (e) {}
      tickConditionDurations(combat);
      // Refresh legendary actions budget each round (NOT legendary resistances — those are /day)
      combat.combatants.forEach(cb => {
        if (cb.legendary || cb.legendaryActionsMax || (cb.legendaryActions && cb.legendaryActions.length)) {
          const max = cb.legendaryActionsMax != null ? cb.legendaryActionsMax
            : (cb.legendaryActionsPerRound != null ? cb.legendaryActionsPerRound : 3);
          cb.legendaryActionsMax = max;
          cb.legendaryActionsLeft = max;
          cb.legendaryActionsUsed = 0;
        }
        // Do not reset legendaryResist here
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
    let c = getActive();
    if (!c) { c = ensureCombatWorkspace() || getActive(); if (!c) { toast('Workspace unavailable'); return; } }
    const world = c.currentWorld || '';
    // Estimate party tier from average level
    const levels = (c.party || []).map(p => Number(p.level) || 1);
    const avgLevel = levels.length ? levels.reduce((a, b) => a + b, 0) / levels.length : 3;
    // Target CR band roughly party level / 2 to party level
    const minCr = Math.max(0, avgLevel * 0.4 - 1);
    const maxCr = avgLevel + 2;
    try { if (typeof refreshBestiaryRef === 'function') refreshBestiaryRef(); } catch (e) {}
    let pool = (BESTIARY || []).filter(b => Number(b.cr) >= minCr && Number(b.cr) <= maxCr);
    if (world) {
      const worldPool = pool.filter(b => b.w === world);
      if (worldPool.length) pool = worldPool;
    }
    if (!pool.length) pool = world ? (BESTIARY || []).filter(b => b.w === world) : (BESTIARY || []).slice();
    if (!pool.length) {
      // Fallback so Random Encounter never silently no-ops when bestiary data failed to load
      pool = [
        { n: 'Goblin', cr: 0.25, ac: 15, hp: 7, o: 'humanoid', w: world || 'Generic', atk: 'Scimitar: +4 to hit, 1d6+2' },
        { n: 'Orc', cr: 0.5, ac: 13, hp: 15, o: 'humanoid', w: world || 'Generic', atk: 'Greataxe: +5 to hit, 1d12+3' },
        { n: 'Ogre', cr: 2, ac: 11, hp: 59, o: 'giant', w: world || 'Generic', atk: 'Greatclub: +6 to hit, 2d8+4' },
        { n: 'Owlbear', cr: 3, ac: 13, hp: 59, o: 'monstrosity', w: world || 'Generic', atk: 'Beak: +7 to hit, 1d10+5' },
        { n: 'Troll', cr: 5, ac: 15, hp: 84, o: 'giant', w: world || 'Generic', atk: 'Bite: +7 to hit, 1d6+4' },
        { n: 'Young Red Dragon', cr: 10, ac: 18, hp: 178, o: 'dragon', w: world || 'Generic', atk: 'Bite: +10 to hit, 2d10+6' }
      ];
      toast('Bestiary empty — using fallback monsters');
    }

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
    const nextTurnHandler = () => {
      try { combatNextTurn(); } catch (e) { console.error(e); toast('Next turn failed: ' + (e && e.message ? e.message : e)); }
    };
    $('#combat-next-btn')?.addEventListener('click', nextTurnHandler);
    // Toolbar label is "End Turn / Next"
    document.getElementById('combat-end-round-btn')?.addEventListener('click', nextTurnHandler);
    const wireRest = (id, fn, label) => {
      const el = document.getElementById(id);
      if (!el || el.dataset.wiredRest) return;
      el.dataset.wiredRest = '1';
      el.addEventListener('click', () => {
        const c = getActive();
        if (!c) { toast('No workspace'); return; }
        const combat = getCombat(c);
        if (!combat || !(combat.combatants || []).length) { toast('No combatants'); return; }
        fn(combat);
        c.updatedAt = new Date().toISOString();
        try { save(); } catch (e) {}
        try { renderCombat(); } catch (e) {}
        try { renderSharedCombatLog(); } catch (e) {}
        toast(label);
      });
    };
    wireRest('combat-short-rest', shortRestCombat, 'Short Rest applied');
    wireRest('combat-long-rest', longRestCombat, 'Long Rest applied');
    wireRest('combat-reset-resources', resetCombatResourcesOnly, 'Resources reset (HP unchanged)');
    document.getElementById('combat-log-clear')?.addEventListener('click', () => {
      const c = getActive();
      const combat = c ? getCombat(c) : null;
      if (combat) combat.sharedLog = [];
      try { save(); } catch (e) {}
      try { renderSharedCombatLog(); } catch (e) {}
      toast('Combat log cleared');
    });
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
    (function wireAddAllRoster() {
      var allBtn = document.querySelector('#combat-add-all-roster-btn');
      if (!allBtn || allBtn.dataset.wiredP0) return;
      allBtn.dataset.wiredP0 = '1';
      allBtn.addEventListener('click', function() {
        var c = getActive();
        if (!c) { toast('No workspace'); return; }
        ensureCampaignShape(c);
        var combat = getCombat(c);
        if (!combat.combatants) combat.combatants = [];
        var existingIds = new Set((combat.combatants || []).map(function(cb) { return String(cb.charId || cb.sourceId || ''); }));
        var existingNames = new Set((combat.combatants || []).map(function(cb) { return String(cb.name || '').toLowerCase(); }));
        var added = 0;
        function pushList(list, side) {
          (list || []).forEach(function(ch) {
            if (!ch || !ch.name) return;
            var cid = String(ch.characterId || ch.id || '');
            var nm = String(ch.name || '').toLowerCase();
            if (cid && existingIds.has(cid)) return;
            if (nm && existingNames.has(nm)) return;
            try {
              var row = combatantFromChar(ch, side);
              if (row && row.name) {
                combat.combatants.push(row);
                if (cid) existingIds.add(cid);
                if (nm) existingNames.add(nm);
                added++;
              }
            } catch (err) { console.warn(err); }
          });
        }
        pushList(c.party, 'party');
        pushList(c.villains, 'enemy');
        if (!added) { toast('No new combatants to add'); return; }
        if (combat.selectedIndex == null || combat.selectedIndex < 0) combat.selectedIndex = 0;
        c.updatedAt = new Date().toISOString();
        save();
        toast('Added ' + added + ' to combat');
        try { renderCombat(); } catch (e) {}
      });
    })();
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
    try {
      // Clear stale player role left by older builds (sessionStorage is per-tab but was set on DM by mistake)
      const q = new URLSearchParams(location.search);
      if (q.get('role') !== 'player' && q.get('mapPopout') !== '1') {
        sessionStorage.setItem('vtt_role', 'dm');
      }
    } catch (e) {}
    try { bindVttSync(); } catch (e) { console.warn('bindVttSync', e); }
    try { wireVttRoomUi(); } catch (e) { console.warn('wireVttRoomUi', e); }
    try { applyPlayerShell(); } catch (e) { console.warn('applyPlayerShell', e); }
    try { applyMapPopoutMode(); } catch (e) {}
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

  /** Shared map / player clients: solid FoW + hide unrevealed tokens (player perspective). */
  function usePlayerFogView() {
    try {
      if (typeof isPlayerRole === 'function' && isPlayerRole()) return true;
    } catch (e) {}
    try {
      if (typeof isMapPopoutMode === 'function' && isMapPopoutMode()) return true;
    } catch (e) {}
    return false;
  }

  
  function schedulePopoutMapRefit() {
    if (typeof isMapPopoutMode !== 'function' || !isMapPopoutMode()) return;
    const run = () => {
      try {
        const m = getCombatMap();
        if (!m) return;
        m._fitSrcW = null;
        m._fitSrcH = null;
        window.__mapVideoTicking = false;
        renderBattleMap();
      } catch (e) {}
    };
    setTimeout(run, 50);
    setTimeout(run, 200);
    setTimeout(run, 500);
    setTimeout(run, 1200);
  }

  function applyMapPopoutMode() {
    if (!isMapPopoutMode()) return;
    document.body.classList.add('map-popout');
    document.title = 'Battle Map (shared)';
    const playerPop = typeof isPlayerRole === 'function' && isPlayerRole();
    // Physically remove chrome so it cannot reappear or stay clickable
    // DM share popout: KEEP .map-toolbar so FoW tools work; player popout: strip toolbar
    const strip = [
      '.app-header', 'header', '#menu-toggle', '.menu-toggle',
      '#sidebar-collapse-btn', '.sidebar-collapse-btn',
      '#sidebar', 'aside.sidebar', '.sidebar',
      '.app-nav', 'nav.app-nav', 'nav', '#view-combat', '#view-tools', '#view-campaigns',
      '.view-desc', '#view-map .view-header', '#dice-toggle', '#dice-panel'
    ];
    if (playerPop) {
      strip.push('.map-toolbar', '#map-fog-toggle', '#map-fog-reveal', '#map-fog-hide', '#map-fog-reset', '#map-fog-brush');
    }
    // DM share map: no player combat panel. Player clients use role=player.
    if (!playerPop) {
      strip.push('#player-combat-panel', '.player-combat-panel');
    }
    // Keep #map-roster for both
    strip.forEach(sel => {
      document.querySelectorAll(sel).forEach(el => {
        if (!el) return;
        if (el.id === 'map-roster' || el.id === 'map-roster-list' || el.classList.contains('map-roster')) return;
        if (el.id === 'player-combat-panel' || el.classList.contains('player-combat-panel')) return;
        if (el.closest && (el.closest('#map-roster') || el.closest('#player-combat-panel'))) return;
        try { el.remove(); } catch (e) { try { el.style.display = 'none'; } catch (e2) {} }
      });
    });
    // DM popout: hide non-FoW toolbar chrome (import/video/etc.) but keep fog controls
    if (!playerPop) {
      try {
        const tb = document.querySelector('.map-toolbar');
        if (tb) {
          tb.querySelectorAll('button, label, input, select, a').forEach(el => {
            const id = el.id || '';
            const fog = /fog/i.test(id) || /fog/i.test(el.className || '') || /fog/i.test(el.textContent || '');
            if (!fog) {
              el.style.setProperty('display', 'none', 'important');
              el.setAttribute('data-popout-hidden', '1');
            }
          });
          // keep fog-related visible
          ['map-fog-toggle','map-fog-reveal','map-fog-hide','map-fog-reset','map-fog-brush'].forEach(fid => {
            const el = document.getElementById(fid);
            if (el) {
              el.style.removeProperty('display');
              el.removeAttribute('data-popout-hidden');
              // show parent label if any
              let p = el.parentElement;
              while (p && p !== tb) {
                p.style.removeProperty('display');
                p = p.parentElement;
              }
            }
          });
        }
      } catch (e) {}
    }
    // Hard-remove menu toggle if it resurfaces
    try {
      document.querySelectorAll('#menu-toggle, button.menu-toggle, #sidebar-collapse-btn').forEach(el => el.remove());
    } catch (e) {}
    // Full-bleed layout: drop sidebar grid column
    try {
      const appEl = document.getElementById('app');
      if (appEl) {
        appEl.style.setProperty('display', 'grid', 'important');
        appEl.style.setProperty('grid-template-columns', '1fr', 'important');
        appEl.style.setProperty('grid-template-rows', '1fr', 'important');
        appEl.style.setProperty('width', '100%', 'important');
        appEl.style.setProperty('height', '100dvh', 'important');
        appEl.style.setProperty('margin', '0', 'important');
        appEl.style.setProperty('padding', '0', 'important');
      }
      const mainEl = document.getElementById('main');
      if (mainEl) {
        mainEl.style.setProperty('grid-column', '1 / -1', 'important');
        mainEl.style.setProperty('grid-row', '1 / -1', 'important');
        mainEl.style.setProperty('margin', '0', 'important');
        mainEl.style.setProperty('padding', '0', 'important');
        mainEl.style.setProperty('width', '100%', 'important');
        mainEl.style.setProperty('max-width', 'none', 'important');
        mainEl.style.setProperty('height', '100dvh', 'important');
        mainEl.style.setProperty('padding-left', '0', 'important');
      }
      document.body.classList.add('sidebar-collapsed', 'map-popout');
    } catch (e) {}
    // Force Combatants roster visible on popouts
    try {
      const roster = document.getElementById('map-roster');
      if (roster) {
        roster.style.setProperty('display', 'block', 'important');
        roster.style.setProperty('visibility', 'visible', 'important');
        roster.style.setProperty('min-width', '240px', 'important');
        roster.style.setProperty('max-width', '300px', 'important');
        roster.style.setProperty('flex', '0 0 260px', 'important');
        roster.style.removeProperty('opacity');
        roster.style.removeProperty('position');
        roster.style.removeProperty('left');
        roster.style.removeProperty('height');
        roster.style.removeProperty('width');
      }
      const layout = document.querySelector('.map-layout');
      if (layout) {
        layout.style.setProperty('display', 'flex', 'important');
        layout.style.setProperty('flex-direction', 'row', 'important');
        layout.style.setProperty('align-items', 'stretch', 'important');
      }
    } catch (e) {}
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
        try {
          const map = typeof getCombatMap === 'function' ? getCombatMap() : null;
          if (map) ensureMapFog(map);
        } catch (e) {}
        renderBattleMap();
        renderMapRoster();
        // Re-draw after image decode so FoW overlays stick
        setTimeout(function() {
          try { renderBattleMap(); renderMapRoster(); } catch (e) {}
        }, 200);
        setTimeout(function() {
          try { renderBattleMap(); } catch (e) {}
        }, 800);
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
      // While this tab is dragging a token, skip reload (DM windows rely on __tokenDragActive in apply only;
      // player also skips STORAGE reload mid-drag because player save() path differs).
      if (window.__tokenDragActive) return;
      // Soft throttle: full campaign load is heavy; token moves use cybervlachos_vtt_tokens.
      try {
        const combatOn = document.getElementById('view-combat')?.classList.contains('active');
        const mapOn = document.getElementById('view-map')?.classList.contains('active') || (typeof isMapPopoutMode === 'function' && isMapPopoutMode());
        if (combatOn && !mapOn) {
          const now = Date.now();
          if (window.__lastStorageLoadAt && (now - window.__lastStorageLoadAt) < 350) return;
          window.__lastStorageLoadAt = now;
        }
      } catch (e) {}
      // Snapshot tokens if we have a newer local version than storage
      let guardTokens = null;
      let guardVer = Number(window.__tokenVerApplied) || 0;
      try {
        const map0 = typeof getCombatMap === 'function' ? getCombatMap() : null;
        if (map0 && map0.tokens && guardVer) guardTokens = JSON.parse(JSON.stringify(map0.tokens));
      } catch (err) {}
      try { if (typeof load === 'function') load(); } catch (err) {}
      try {
        if (guardTokens && guardVer) {
          const map1 = typeof getCombatMap === 'function' ? getCombatMap() : null;
          const storedVer = map1 && map1.tokenVer != null ? Number(map1.tokenVer) : 0;
          if (map1 && guardVer >= storedVer) {
            map1.tokens = guardTokens;
            map1.tokenVer = guardVer;
            window.__tokenVerApplied = guardVer;
          }
        }
      } catch (err) {}
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
        if (!ev.data) return;
        // Live token stream (player ↔ DM)
        if (ev.data.type === 'vtt-tokens' || ev.data.type === 'tokens') {
          try {
            const msg = ev.data.type === 'tokens'
              ? { type: 'vtt-tokens', tokens: ev.data.tokens, at: ev.data.at, from: ev.data.from || 'dm', room: ev.data.room || '' }
              : ev.data;
            if (typeof applyTokenMessage === 'function') applyTokenMessage(msg);
          } catch (err) {}
          return;
        }
        if (ev.data.type !== 'state') return;
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
        scale: 1,
        fogEnabled: false,
        fogRevealed: {},
        fogBrush: 1
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
    const playerMode = typeof isPlayerRole === 'function' && isPlayerRole();
    const popoutMode = typeof isMapPopoutMode === 'function' && isMapPopoutMode();
    // Popups (player or DM share) and player role use FoW roster filtering
    const fogView = (typeof usePlayerFogView === 'function' && usePlayerFogView())
      || (typeof isPlayerFacingView === 'function' && isPlayerFacingView())
      || playerMode
      || popoutMode;
    if (map) try { ensureMapFog(map); } catch (e) {}
    listEl.innerHTML = list.map((cb, idx) => {
      const id = String(cb.id != null ? cb.id : idx);
      const side = String(cb.side || '').toLowerCase();
      const isEnemy = (typeof isEnemySide === 'function') ? isEnemySide(cb) : (side === 'enemy' || side === 'villain' || side === 'enemies' || side === 'hostile');
      const sideClass = isEnemy ? 'enemy' : ((side === 'ally' || side === 'allies') ? 'ally' : 'pc');
      // Popups + player clients: only show combatants on the map; enemies also need FoW reveal
      if (fogView) {
        const viewer = (typeof getClaimedCombatant === 'function') ? getClaimedCombatant() : null;
        if (typeof playerCanSeeCombatant === 'function') {
          if (!playerCanSeeCombatant(viewer, cb)) return '';
        } else {
          // Fallback: must have token; enemies need reveal
          const pos = map && map.tokens && (map.tokens[id] || map.tokens[cb.id]);
          if (!pos) return '';
          if (isEnemy && map.fogEnabled) {
            try {
              const cell = worldToFogCell(map, pos.x, pos.y);
              if (!map.fogRevealed || !map.fogRevealed[cell]) return '';
            } catch (e) { return ''; }
          }
        }
      }
      const hp = Number(cb.hp) || 0;
      const hpMax = Math.max(1, Number(cb.hpMax) || 1);
      const hide = !!cb.hideHp || ((playerMode || (typeof usePlayerFogView === 'function' && usePlayerFogView())) && isEnemy);
      const pct = hide ? 0 : Math.max(0, Math.min(100, Math.round(100 * hp / hpMax)));
      const placed = map && map.tokens && map.tokens[id];
      const sel = idx === selectedIdx ? ' selected' : '';
      const init = (cb.init != null && cb.init !== '') ? cb.init : (cb.initiative != null ? cb.initiative : '—');
      const popout = typeof isMapPopoutMode === 'function' && isMapPopoutMode();
      // Shared/player popouts: never show enemy AC (and hideHp already covers HP)
      const hideAc = isEnemy && (playerMode || popout);
      const acPart = hideAc ? '' : (' · AC ' + (cb.ac != null ? cb.ac : '—'));
      return `<div class="map-roster-card ${sideClass}${sel}" data-id="${escapeAttr(id)}" data-idx="${idx}">
        <div class="mr-name">${escapeHtml(cb.name || 'Combatant')}</div>
        <div class="mr-meta">Init ${escapeHtml(String(init))}${acPart} · ${escapeHtml(sideClass)}${placed ? '' : ' · <em>not on map</em>'}</div>
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


  
  // ─── Phase 1 VTT: roles, room sync, fog of war ───────────────────────────
  function getVttRole() {
    try {
      const q = new URLSearchParams(location.search);
      // ONLY role=player is a player client (not mapPopout alone — that is the DM shared map)
      if (String(q.get('role') || '').toLowerCase() === 'player') return 'player';
      return 'dm';
    } catch (e) { return 'dm'; }
  }
  function isPlayerRole() {
    try {
      if (typeof getVttRole === 'function' && getVttRole() === 'player') return true;
      if (/[?&]role=player(?:&|$)/i.test(String(location.search || ''))) return true;
      if (document.body && document.body.classList.contains('vtt-player')) return true;
      if (document.documentElement && document.documentElement.classList.contains('vtt-player')) return true;
    } catch (e) {}
    return false;
  }
  /** Shared map or player client: fog / hide enemy HP rules */
  function isPlayerFacingView() {
    return isPlayerRole() || (typeof isMapPopoutMode === 'function' && isMapPopoutMode());
  }
  function isDmRole() { return getVttRole() === 'dm'; }
  function getVttRoomCode() {
    try {
      return (new URLSearchParams(location.search).get('room') || sessionStorage.getItem('vtt_room') || '').toUpperCase();
    } catch (e) { return ''; }
  }
  function setVttSession(role, room) {
    try {
      if (role) sessionStorage.setItem('vtt_role', role);
      if (room) sessionStorage.setItem('vtt_room', String(room).toUpperCase());
    } catch (e) {}
  }
  function generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let s = '';
    for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return s;
  }
  function ensureMapFog(map) {
    if (!map) return;
    if (!map.fogRevealed || typeof map.fogRevealed !== 'object') map.fogRevealed = {};
    if (map.fogEnabled == null) map.fogEnabled = false;
    if (!map.fogBrush) map.fogBrush = 1;
  }
  function worldToFogCell(map, wx, wy) {
    const g = Number(map.gridSize) || 70;
    const ox = Number(map.gridOffsetX) || 0;
    const oy = Number(map.gridOffsetY) || 0;
    const gx = Math.floor((wx - ox) / g);
    const gy = Math.floor((wy - oy) / g);
    return gx + ',' + gy;
  }
  /** 5e size label → footprint in grid squares (Medium = 1). */
  function sizeToTokenSquares(size) {
    const s = String(size || '').toLowerCase().trim();
    if (s === 'tiny') return 0.5;
    if (s === 'small' || s === 'medium' || s === 'med' || s === '') return 1;
    if (s === 'large') return 2;
    if (s === 'huge') return 3;
    if (s === 'gargantuan' || s === 'gargantua') return 4;
    const n = Number(size);
    if (!isNaN(n) && n > 0) return n;
    return 1;
  }
  function combatantTokenSquares(cb) {
    if (!cb) return 1;
    if (cb.tokenSize != null && cb.tokenSize !== '' && !isNaN(Number(cb.tokenSize))) {
      return Math.max(0.5, Math.min(8, Number(cb.tokenSize)));
    }
    if (cb.size) return sizeToTokenSquares(cb.size);
    return 1;
  }
  /** Pixel radius for drawing/hit-test (circle fits footprint). */
  function tokenRadiusForCombatant(map, cb, scale) {
    const g = (Number(map && map.gridSize) || 70) * (scale || 1);
    const sq = combatantTokenSquares(cb);
    return Math.max(6, g * sq * 0.42);
  }
  function findCombatantByTokenId(id) {
    try {
      const c = getActive();
      const list = (c && getCombat(c).combatants) || [];
      return list.find(function(x) {
        return x && (String(x.id) === String(id) || String(x.charId) === String(id));
      }) || null;
    } catch (e) { return null; }
  }
  function getFogBrushSize(map) {
    const fromInput = parseInt(document.getElementById('map-fog-brush')?.value, 10);
    if (!isNaN(fromInput) && fromInput >= 1) return Math.min(12, fromInput);
    const fromMap = Number(map && map.fogBrush);
    if (!isNaN(fromMap) && fromMap >= 1) return Math.min(12, fromMap);
    return 1;
  }
  function paintFog(map, wx, wy, reveal) {
    ensureMapFog(map);
    map.fogEnabled = true;
    const g = Number(map.gridSize) || 70;
    const brush = getFogBrushSize(map);
    map.fogBrush = brush;
    const ox = Number(map.gridOffsetX) || 0;
    const oy = Number(map.gridOffsetY) || 0;
    const cx = Math.floor((wx - ox) / g);
    const cy = Math.floor((wy - oy) / g);
    // brush N → exactly N×N cells (odd centered; even biased bottom-right)
    const half = Math.floor((brush - 1) / 2);
    for (let dy = 0; dy < brush; dy++) {
      for (let dx = 0; dx < brush; dx++) {
        const key = (cx - half + dx) + ',' + (cy - half + dy);
        if (reveal) map.fogRevealed[key] = true;
        else delete map.fogRevealed[key];
      }
    }
    // Keep popup combatant lists in sync with FoW (throttled)
    try {
      const now = Date.now();
      if (!window.__lastRosterFogRefresh || now - window.__lastRosterFogRefresh > 120) {
        window.__lastRosterFogRefresh = now;
        if (typeof renderMapRoster === 'function') renderMapRoster();
        if (typeof renderSharedCombatLog === 'function') renderSharedCombatLog();
      }
    } catch (e) {}
  }
  function drawFogOfWar(ctx, canvas, map, scale) {
    ensureMapFog(map);
    if (!map.fogEnabled) return;
    const g = (Number(map.gridSize) || 70) * scale;
    if (g < 4) return;
    const gox = (Number(map.gridOffsetX) || 0) * scale;
    const goy = (Number(map.gridOffsetY) || 0) * scale;
    const playerView = typeof usePlayerFogView === 'function' ? usePlayerFogView() : (typeof isPlayerRole === 'function' && isPlayerRole());
    const isVideoMap = map && map.mediaType === 'video';
    // Player / shared mapPopout: fully opaque black; DM main: translucent
    ctx.fillStyle = playerView ? 'rgba(0,0,0,1)' : (isVideoMap ? 'rgba(0,0,0,0.82)' : 'rgba(0,0,0,0.62)');
    const cols = Math.ceil(canvas.width / g) + 2;
    const rows = Math.ceil(canvas.height / g) + 2;
    const startCol = Math.floor(-gox / g) - 1;
    const startRow = Math.floor(-goy / g) - 1;
    for (let gy = startRow; gy < startRow + rows; gy++) {
      for (let gx = startCol; gx < startCol + cols; gx++) {
        const key = gx + ',' + gy;
        if (map.fogRevealed[key]) continue;
        const x = gox + gx * g;
        const y = goy + gy * g;
        ctx.fillRect(x, y, g + 0.5, g + 0.5);
      }
    }
  }
  function getVttChannel() {
    if (!window.__vttBc && typeof BroadcastChannel !== 'undefined') {
      try { window.__vttBc = new BroadcastChannel('cybervlachos-vtt-v1'); } catch (e) {}
    }
    return window.__vttBc || null;
  }
  function buildVttStatePayload(reason) {
    const c = getActive();
    if (!c) return null;
    const combat = getCombat(c);
    const map = c.combatMap || null;
    const mapLite = map ? {
      gridSize: map.gridSize,
      gridOffsetX: map.gridOffsetX,
      gridOffsetY: map.gridOffsetY,
      width: map.width,
      height: map.height,
      walls: map.walls || [],
      tokens: JSON.parse(JSON.stringify(map.tokens || {})),
      aoe: map.aoe || null,
      scale: map.scale || 1,
      fogEnabled: !!map.fogEnabled,
      fogRevealed: Object.assign({}, map.fogRevealed || {}),
      fogBrush: map.fogBrush || 1,
      hasImage: !!(map.imageDataUrl || map.videoObjectUrl),
      mediaType: map.mediaType || null
    } : null;
    return {
      type: 'vtt-state',
      from: 'dm',
      clientId: window.__vttClientId || null,
      room: getVttRoomCode() || sessionStorage.getItem('vtt_room') || '',
      reason: reason || 'update',
      at: Date.now(),
      combat: combat ? {
        round: combat.round,
        current: combat.current,
        combatants: (combat.combatants || []).map(cb => ({
          id: cb.id, name: cb.name, hp: cb.hp, hpMax: cb.hpMax, ac: cb.ac,
          init: cb.init != null ? cb.init : cb.initiative,
          initiative: cb.initiative != null ? cb.initiative : cb.init,
          side: cb.side, conditions: cb.conditions, hideHp: cb.hideHp,
          concentrating: cb.concentrating, dead: cb.dead
        }))
      } : null,
      map: mapLite
    };
  }
  
  
  /**
   * Write token positions the same way DM mapPopout does.
   * Player save() takes a different path (combat-only); token drags must NOT depend on it.
   */
  function syncTokensLikeMapPopout(reason) {
    try {
      const c = getActive();
      if (!c) return;
      if (!c.combatMap) c.combatMap = { tokens: {}, gridSize: 70, fogEnabled: false, fogRevealed: {} };
      const at = Date.now();
      window.__lastTokenSent = at;
      window.__lastLocalTokenChange = at;
      const tokens = JSON.parse(JSON.stringify(c.combatMap.tokens || {}));
      const room = (typeof getVttRoomCode === 'function' ? getVttRoomCode() : '') || sessionStorage.getItem('vtt_room') || '';
      const payload = {
        type: 'vtt-tokens',
        room: room,
        reason: reason || 'token-move',
        at: at,
        clientId: window.__vttClientId || null,
        from: (typeof isPlayerRole === 'function' && isPlayerRole()) ? 'player' : 'dm',
        tokens: tokens,
        fogEnabled: !!c.combatMap.fogEnabled,
        fogRevealed: Object.assign({}, c.combatMap.fogRevealed || {})
      };
      // 1) Token channel (storage event + polls)
      try { localStorage.setItem('cybervlachos_vtt_tokens', JSON.stringify(payload)); } catch (e) {}
      // 2) Merge tokens into shared campaign storage (same as DM mapPopout) — critical for player
      try {
        const key = (typeof STORAGE_KEY !== 'undefined') ? STORAGE_KEY : 'cybervlachos_combat_v1';
        let data = null;
        try { data = JSON.parse(localStorage.getItem(key) || 'null'); } catch (e2) { data = null; }
        if (data && Array.isArray(data.campaigns) && data.campaigns.length) {
          let camp = data.campaigns.find(x => x && x.id === data.activeCampaignId) || data.campaigns[0];
          if (camp) {
            if (!camp.combatMap) camp.combatMap = {};
            camp.combatMap.tokens = tokens;
            // keep other map fields if present on local
            if (c.combatMap.gridSize != null) camp.combatMap.gridSize = c.combatMap.gridSize;
            if (c.combatMap.gridOffsetX != null) camp.combatMap.gridOffsetX = c.combatMap.gridOffsetX;
            if (c.combatMap.gridOffsetY != null) camp.combatMap.gridOffsetY = c.combatMap.gridOffsetY;
            localStorage.setItem(key, JSON.stringify(data));
          }
        } else if (c) {
          // Minimal write so other windows still get tokens via campaign load
          const payload2 = {
            campaigns: [Object.assign({}, c, { combatMap: Object.assign({}, c.combatMap, { tokens: tokens }) })],
            activeCampaignId: c.id
          };
          try { localStorage.setItem(key, JSON.stringify(payload2)); } catch (e3) {}
        }
      } catch (e) {}
      // 3) BroadcastChannel (same channels DM mapPopout uses)
      try {
        const ch = typeof getVttChannel === 'function' ? getVttChannel() : null;
        if (ch) ch.postMessage(payload);
      } catch (e) {}
      try {
        if (window.__mapBc) window.__mapBc.postMessage(payload);
      } catch (e) {}
      try {
        if (!window.__mapBc2 && typeof BroadcastChannel !== 'undefined') {
          try { window.__mapBc2 = new BroadcastChannel('dsc_combat_map_sync'); } catch (e2) {}
        }
        if (window.__mapBc2) window.__mapBc2.postMessage(payload);
      } catch (e) {}
      // 4) Also update in-memory state campaigns so this tab stays consistent
      try {
        if (typeof state !== 'undefined' && state && Array.isArray(state.campaigns)) {
          const camp = state.campaigns.find(x => x && x.id === state.activeCampaignId) || state.campaigns[0];
          if (camp) {
            if (!camp.combatMap) camp.combatMap = c.combatMap;
            camp.combatMap.tokens = tokens;
          }
        }
      } catch (e) {}
    } catch (e) {
      console.warn('syncTokensLikeMapPopout', e);
    }
  }


  function broadcastTokenPositions(reason) {
    try {
      const c = getActive();
      if (!c || !c.combatMap) return;
      const at = Date.now();
      window.__lastTokenSent = at;
      window.__tokenVerLocal = (Number(window.__tokenVerLocal) || 0) + 1;
      // Ensure local ver always wins over concurrent remote packets we already had
      const tokenVer = Math.max(at, (Number(window.__tokenVerApplied) || 0) + 1, window.__tokenVerLocal);
      window.__tokenVerApplied = tokenVer;
      const tokens = JSON.parse(JSON.stringify(c.combatMap.tokens || {}));
      const payload = {
        type: 'vtt-tokens',
        room: (typeof getVttRoomCode === 'function' ? getVttRoomCode() : '') || sessionStorage.getItem('vtt_room') || '',
        reason: reason || 'token-move',
        at: at,
        tokenVer: tokenVer,
        clientId: window.__vttClientId || null,
        from: (typeof isPlayerRole === 'function' && isPlayerRole()) ? 'player' : 'dm',
        tokens: tokens,
        fogEnabled: !!c.combatMap.fogEnabled,
        fogRevealed: Object.assign({}, c.combatMap.fogRevealed || {})
      };
      try { localStorage.setItem('cybervlachos_vtt_tokens', JSON.stringify(payload)); } catch (e) {}
      try {
        const key = (typeof STORAGE_KEY !== 'undefined') ? STORAGE_KEY : 'cybervlachos_combat_v1';
        let data = null;
        try { data = JSON.parse(localStorage.getItem(key) || 'null'); } catch (e2) { data = null; }
        if (data && Array.isArray(data.campaigns) && data.campaigns.length) {
          const camp = data.campaigns.find(x => x && x.id === data.activeCampaignId) || data.campaigns[0];
          if (camp) {
            if (!camp.combatMap) camp.combatMap = {};
            camp.combatMap.tokens = tokens;
            camp.combatMap.tokenVer = tokenVer;
            localStorage.setItem(key, JSON.stringify(data));
          }
        }
      } catch (e) {}
      try {
        const full = Object.assign(
          (typeof buildVttStatePayload === 'function' ? buildVttStatePayload(reason) : null) || { type: 'vtt-state', at: at },
          { map: { tokens: payload.tokens, fogEnabled: payload.fogEnabled, fogRevealed: payload.fogRevealed }, tokenVer: tokenVer }
        );
        localStorage.setItem('cybervlachos_vtt_sync', JSON.stringify(full));
      } catch (e) {}
      try {
        const ch = typeof getVttChannel === 'function' ? getVttChannel() : null;
        if (ch) ch.postMessage(payload);
      } catch (e) {}
      try { if (window.__mapBc) window.__mapBc.postMessage(payload); } catch (e) {}
    } catch (e) {
      console.warn('token bc', e);
    }
  }
  
  /** Player token authority: prevents DM broadcasts from snapping player-moved tokens back. */
  function notePlayerTokenAuthority(tokenId, pos) {
    if (!window.__tokenAuthority) window.__tokenAuthority = {};
    if (tokenId == null) return;
    window.__tokenAuthority[String(tokenId)] = {
      x: pos && pos.x,
      y: pos && pos.y,
      at: Date.now()
    };
    // Hold long enough that late DM broadcasts cannot bounce the token
    window.__tokenAuthorityUntil = Date.now() + 5000;
  }
  function applyTokenAuthorityToMap(map) {
    if (!map || !window.__tokenAuthority) return;
    const now = Date.now();
    if (window.__tokenAuthorityUntil && now > window.__tokenAuthorityUntil) {
      // Expire old locks
      Object.keys(window.__tokenAuthority).forEach(k => {
        const row = window.__tokenAuthority[k];
        if (!row || (now - (row.at || 0)) > 2500) delete window.__tokenAuthority[k];
      });
    }
    map.tokens = map.tokens || {};
    Object.keys(window.__tokenAuthority).forEach(k => {
      const row = window.__tokenAuthority[k];
      if (!row) return;
      if ((now - (row.at || 0)) > 2500) {
        delete window.__tokenAuthority[k];
        return;
      }
      map.tokens[k] = { x: row.x, y: row.y };
    });
  }
  function shouldIgnoreRemoteTokens(msg) {
    try {
      if (!(typeof isPlayerRole === 'function' && isPlayerRole())) return false;
      // Never ignore our own player broadcasts (already filtered by __lastTokenSent)
      if (msg && msg.from === 'player') return false;
      // While dragging or briefly after, ignore DM token streams that would snap back
      if (window.__tokenDragActive) return true;
      if (window.__tokenAuthorityUntil && Date.now() < window.__tokenAuthorityUntil) {
        // Allow merge but caller will re-apply authority
        return false;
      }
    } catch (e) {}
    return false;
  }


  
  /** Resolve all possible keys a combatant token may be stored under. */
  function tokenKeysForCombatant(cb, idx) {
    if (!cb) return idx != null ? [String(idx)] : [];
    const keys = [];
    const add = (v) => {
      if (v == null || v === '') return;
      const s = String(v);
      if (!keys.includes(s)) keys.push(s);
    };
    add(cb.id);
    add(cb.name);
    add(cb.sourceId);
    add(cb.charId);
    add(cb.characterId);
    if (idx != null) add(idx);
    return keys;
  }
  /** Get token position for a combatant from map.tokens (id/name/aliases). */
  function tokenPosForCombatant(map, cb, idx) {
    if (!map || !map.tokens) return null;
    const keys = tokenKeysForCombatant(cb, idx);
    for (let i = 0; i < keys.length; i++) {
      const p = map.tokens[keys[i]];
      if (p && (p.x != null || p.y != null)) return { pos: p, key: keys[i] };
    }
    return null;
  }
  /** Canonical key used when writing a combatant token. */
  function canonicalTokenKey(cb, idx) {
    if (cb && cb.id != null && String(cb.id) !== '') return String(cb.id);
    if (cb && cb.name) return String(cb.name);
    return String(idx != null ? idx : '');
  }


  function applyTokenMessage(msg) {
    if (!msg || (msg.type !== 'vtt-tokens' && msg.type !== 'vtt-state')) return;
    if (window.__tokenDragActive) return;
    const room = (typeof getVttRoomCode === 'function' ? getVttRoomCode() : '') || sessionStorage.getItem('vtt_room') || '';
    const msgRoom = msg.room || '';
    if (room && msgRoom && String(room).toUpperCase() !== String(msgRoom).toUpperCase()) return;
    if (msg.at && window.__lastTokenSent && msg.at === window.__lastTokenSent) return;
    // Monotonic version: ignore stale packets (main cause of intermittent snap-back)
    const ver = Number(msg.tokenVer != null ? msg.tokenVer : msg.at) || 0;
    if (ver && window.__tokenVerApplied && ver < window.__tokenVerApplied) return;
    try {
      const map = getCombatMap();
      if (!map) return;
      const tokens = (msg.type === 'vtt-tokens') ? msg.tokens : (msg.map && msg.map.tokens);
      if (!tokens) return;
      map.tokens = tokens;
      if (ver) window.__tokenVerApplied = ver;
      if (msg.type === 'vtt-tokens') {
        if (msg.fogRevealed) map.fogRevealed = msg.fogRevealed;
        if (msg.fogEnabled != null) map.fogEnabled = msg.fogEnabled;
      } else if (msg.map) {
        if (msg.map.fogRevealed) map.fogRevealed = msg.map.fogRevealed;
        if (msg.map.fogEnabled != null) map.fogEnabled = msg.map.fogEnabled;
      }
      try {
        const c = getActive();
        if (c) c.combatMap = map;
      } catch (e) {}
      try { if (typeof paintMapFrame === 'function') paintMapFrame(); } catch (e) {}
      try { redrawMapLive(); } catch (e) { try { renderBattleMap(); } catch (e2) {} }
      try { renderMapRoster(); } catch (e) {}
    } catch (e) {
      console.warn('applyTokenMessage', e);
    }
  }

  function broadcastVttState(reason) {
    if (isPlayerRole()) return; // only DM host pushes
    try {
      const payload = buildVttStatePayload(reason);
      if (!payload) return;
      // localStorage: works across tabs even when BC is flaky
      try { localStorage.setItem('cybervlachos_vtt_sync', JSON.stringify(payload)); } catch (e) {}
      const ch = getVttChannel();
      if (ch) {
        try { ch.postMessage(payload); } catch (e) {}
      }
    } catch (e) { console.warn('VTT broadcast', e); }
  }
  function applyVttStateMessage(msg) {
    if (!msg || msg.type !== 'vtt-state') return;
    const room = getVttRoomCode();
    // Only reject if BOTH sides have a room code and they differ
    if (room && msg.room && String(room).toUpperCase() !== String(msg.room).toUpperCase()) return;
    try {
      const c = getActive();
      if (!c) return;
      if (msg.combat) {
        const combat = getCombat(c);
        if (combat && msg.combat.combatants) {
          combat.round = msg.combat.round != null ? msg.combat.round : combat.round;
          combat.current = msg.combat.current != null ? msg.combat.current : combat.current;
          // Merge HP/conditions by id/name without wiping local full data
          (msg.combat.combatants || []).forEach(remote => {
            const local = (combat.combatants || []).find(x => String(x.id) === String(remote.id) || x.name === remote.name);
            if (local) {
              local.hp = remote.hp;
              local.hpMax = remote.hpMax;
              if (remote.tempHp != null) local.tempHp = remote.tempHp;
              if (remote.init != null) local.init = remote.init;
              if (remote.initiative != null) local.initiative = remote.initiative;
              if (remote.init != null && local.initiative == null) local.initiative = remote.init;
              local.conditions = remote.conditions;
              local.hideHp = remote.hideHp;
              local.concentrating = remote.concentrating;
              local.dead = remote.dead;
              if (remote.turnState) local.turnState = remote.turnState;
              if (remote.turnPhase != null) local.turnPhase = remote.turnPhase;
              if (remote.actionUsed != null) local.actionUsed = remote.actionUsed;
              if (remote.bonusUsed != null) local.bonusUsed = remote.bonusUsed;
              if (remote.reactionUsed != null) local.reactionUsed = remote.reactionUsed;
              if (remote.moveUsed != null) local.moveUsed = remote.moveUsed;
              if (remote.attacksUsed != null) local.attacksUsed = remote.attacksUsed;
              if (remote.combatSpellSlots) local.combatSpellSlots = remote.combatSpellSlots;
              if (remote.combatResources) local.combatResources = remote.combatResources;
              if (remote.spellSlots) local.spellSlots = remote.spellSlots;
              if (remote.deathSaves) local.deathSaves = remote.deathSaves;
            }
          });
        }
      }
      if (msg.map) {
        const map = getCombatMap();
        if (map) {
          if (msg.map.gridSize != null) map.gridSize = msg.map.gridSize;
          if (msg.map.gridOffsetX != null) map.gridOffsetX = msg.map.gridOffsetX;
          if (msg.map.gridOffsetY != null) map.gridOffsetY = msg.map.gridOffsetY;
          if (msg.map.tokens) map.tokens = msg.map.tokens;
          map.aoe = msg.map.aoe;
          if (msg.map.walls) map.walls = msg.map.walls;
          if (msg.map.fogEnabled != null) map.fogEnabled = msg.map.fogEnabled;
          if (msg.map.fogRevealed) map.fogRevealed = msg.map.fogRevealed;
        }
      }
      try { if (typeof renderBattleMap === 'function') renderBattleMap(); } catch (e) {}
      try { if (typeof renderMapRoster === 'function') renderMapRoster(); } catch (e) {}
      try { if (typeof renderPlayerCombatPanel === 'function') renderPlayerCombatPanel(); } catch (e) {}
      try {
        if (typeof renderCombat === 'function' && !(typeof isPlayerRole === 'function' && isPlayerRole())) {
          renderCombat();
        }
      } catch (e) {}
    } catch (e) { console.warn('applyVttState', e); }
  }
  
  function wireVttRoomUi() {
    if (window.__vttRoomWired) return;
    window.__vttRoomWired = true;
    // Document-level delegation so buttons work even if re-rendered
    document.addEventListener('click', (ev) => {
      const t = ev.target && ev.target.closest && (ev.target.closest('#vtt-create-room') || ev.target.closest('#vtt-join-player') ||
        ev.target.closest('#map-fog-toggle') || ev.target.closest('#map-fog-reveal') ||
        ev.target.closest('#map-fog-hide') || ev.target.closest('#map-fog-reset'));
      if (!t) return;
      const id = t.id;
      try {
        if (id === 'vtt-create-room') {
          const code = generateRoomCode();
          setVttSession('dm', code);
          const inp = document.getElementById('vtt-room-code');
          if (inp) inp.value = code;
          try { bindVttSync(); } catch (e) {}
          try { broadcastVttState('create'); } catch (e) {}
          toast('Room ' + code + ' created — click Player view');
          return;
        }
        if (id === 'vtt-join-player') {
          let code = (document.getElementById('vtt-room-code')?.value || getVttRoomCode() || '').toUpperCase().trim();
          if (!code) code = generateRoomCode();
          setVttSession('dm', code);
          const inp = document.getElementById('vtt-room-code');
          if (inp) inp.value = code;
          const url = new URL(location.href);
          // Player view = clean shared map (same shell as popout) + player rules
          url.searchParams.set('role', 'player');
          url.searchParams.set('room', code);
          url.searchParams.set('mapPopout', '1');
          const w = window.open(url.toString(), 'vtt-player-' + code, 'noopener,noreferrer,width=1280,height=800');
          const joinUrl = location.origin + location.pathname + '?join=1';
          if (!w) toast('Popup blocked — players can open: ' + joinUrl);
          else toast('Player view opened · Room ' + code + ' · share join link: ?join=1');
          try { broadcastVttState('player-open'); } catch (e) {}
          return;
        }
        if (id === 'map-fog-toggle' || id === 'map-fog-reveal' || id === 'map-fog-hide' || id === 'map-fog-reset') {
          if (typeof isPlayerRole === 'function' && isPlayerRole()) { toast('Players cannot edit fog'); return; }
          ensureCombatWorkspace();
          const map = getCombatMap();
          if (!map) { toast('No map workspace — open Map tab once'); return; }
          ensureMapFog(map);
          if (id === 'map-fog-toggle') {
            map.fogEnabled = !map.fogEnabled;
            toast(map.fogEnabled ? 'Fog ON — Reveal/Hide brush on map' : 'Fog OFF');
          } else if (id === 'map-fog-reset') {
            map.fogRevealed = {};
            map.fogEnabled = true;
            toast('Map fully fogged');
          } else if (id === 'map-fog-reveal') {
            window.__mapFogTool = window.__mapFogTool === 'reveal' ? null : 'reveal';
            if (window.__mapFogTool) map.fogEnabled = true;
            const toolEl = document.getElementById('map-tool');
            if (toolEl) toolEl.value = window.__mapFogTool ? 'fog-reveal' : 'token';
            toast(window.__mapFogTool ? 'Reveal brush ON — click/drag map' : 'Reveal off — token tool');
          } else if (id === 'map-fog-hide') {
            window.__mapFogTool = window.__mapFogTool === 'hide' ? null : 'hide';
            if (window.__mapFogTool) map.fogEnabled = true;
            const toolEl = document.getElementById('map-tool');
            if (toolEl) toolEl.value = window.__mapFogTool ? 'fog-hide' : 'token';
            toast(window.__mapFogTool ? 'Hide brush ON — click/drag map' : 'Hide off — token tool');
          }
          try { save(); } catch (e) {}
          try { renderBattleMap(); } catch (e) {}
          try { renderMapRoster(); } catch (e) {}
          try { renderSharedCombatLog(); } catch (e) {}
          try { broadcastVttState('fog'); } catch (e) {}
        }
      } catch (err) {
        console.error(err);
        toast('VTT error: ' + (err && err.message ? err.message : err));
      }
    });
    const inp = document.getElementById('vtt-room-code');
    if (inp && getVttRoomCode()) inp.value = getVttRoomCode();
    // Debug presence
    try {
      console.log('[VTT] wired. buttons:',
        !!document.getElementById('vtt-create-room'),
        !!document.getElementById('map-fog-toggle'));
    } catch (e) {}
  }

  
  
  function startDmTokenPoll() {
    if (window.__dmTokenPoll) return;
    if (typeof isPlayerRole === 'function' && isPlayerRole()) return;
    window.__dmTokenPoll = setInterval(() => {
      try {
        const raw = localStorage.getItem('cybervlachos_vtt_tokens');
        if (!raw) return;
        const msg = JSON.parse(raw);
        if (!msg || msg.type !== 'vtt-tokens' || !msg.tokens) return;
        if (msg.from !== 'player') return;
        if (msg.at && msg.at === window.__lastDmTokenApplied) return;
        if (msg.clientId && msg.clientId === window.__vttClientId) return;
        window.__lastDmTokenApplied = msg.at;
        applyTokenMessage(msg);
      } catch (e) {}
    }, 200);
  }

  function startPlayerTokenPoll() {
    // Disabled: caused player token bounce. Token sync uses the same BC/storage path as DM windows.
    return;
  }

  function bindVttSync() {
    if (window.__vttSyncBound) return;
    window.__vttSyncBound = true;
    try { startPlayerTokenPoll(); } catch (e) {}
    try { startDmTokenPoll(); } catch (e) {}
    if (!window.__vttClientId) {
      window.__vttClientId = 'c' + Math.random().toString(36).slice(2, 10);
    }

    // Cross-tab via localStorage (works when BC is flaky)
    window.addEventListener('storage', (ev) => {
      try {
        if (ev.key === 'cybervlachos_vtt_tokens' && ev.newValue) {
          const msg = JSON.parse(ev.newValue);
          if (msg && msg.type === 'vtt-tokens') applyTokenMessage(msg);
        }
        if (ev.key === 'cybervlachos_vtt_dice' && ev.newValue) {
          const msg = JSON.parse(ev.newValue);
          if (msg && msg.type === 'vtt-dice-anim' && msg.html) {
            if (!(msg.clientId && msg.clientId === window.__vttClientId) && isPopupDiceClient()) {
              playPopupDiceAnimation(msg.html, { noBroadcast: true, force: true, startAt: msg.startAt, spinMs: msg.spinMs, revealMs: msg.revealMs, faces: msg.faces });
            }
          }
        }
        if (ev.key === 'cybervlachos_vtt_player_action' && ev.newValue && !isPlayerRole()) {
          const msg = JSON.parse(ev.newValue);
          if (msg && msg.type === 'vtt-player-action') applyPlayerActionMessage(msg);
        }
        if (ev.key === 'cybervlachos_vtt_sync' && ev.newValue && !isPlayerRole()) {
          const msg = JSON.parse(ev.newValue);
          if (msg && msg.type === 'vtt-state' && msg.from === 'player') applyPlayerCombatPatch(msg);
        }
      } catch (e) {}
    });

    const ch = getVttChannel();
    if (ch) {
      ch.onmessage = (ev) => {
        try {
          const msg = ev.data;
          if (!msg || !msg.type) return;
          // Ignore our own echoes
          if (msg.clientId && msg.clientId === window.__vttClientId) return;

          if (msg.type === 'vtt-dice-anim' && msg.html) {
            if (msg.clientId && msg.clientId === window.__vttClientId) return;
            try {
              if (isPopupDiceClient()) {
                playPopupDiceAnimation(msg.html, { noBroadcast: true, force: true, startAt: msg.startAt, spinMs: msg.spinMs, revealMs: msg.revealMs, faces: msg.faces });
              }
            } catch (e) {}
            return;
          }
          if (msg.type === 'vtt-tokens') {
            applyTokenMessage(msg);
            return;
          }
          if (msg.type === 'vtt-player-action') {
            if (!isPlayerRole()) applyPlayerActionMessage(msg);
            return;
          }
          if (msg.type === 'vtt-state') {
            // DM only accepts player-originated combat patches
            if (!isPlayerRole() && msg.from === 'player') {
              applyPlayerCombatPatch(msg);
              return;
            }
            // Players accept DM (or unknown) full/partial state
            if (isPlayerRole() && msg.from !== 'player') {
              applyVttStateMessage(msg);
            }
          }
        } catch (e) { console.warn('vtt bc', e); }
      };
    }

    // storage events only fire in *other* documents — ideal for DM↔player
    window.addEventListener('storage', (e) => {
      if (!e.newValue) return;
      try {
        if (e.key === 'cybervlachos_vtt_tokens') {
          applyTokenMessage(JSON.parse(e.newValue));
          return;
        }
        if (e.key === 'cybervlachos_vtt_player_combat') {
          // Player → DM only
          if (!isPlayerRole()) {
            applyPlayerCombatPatch(JSON.parse(e.newValue));
          }
          return;
        }
        if (e.key === 'cybervlachos_vtt_sync') {
          // DM → player only (players apply; DM ignores to avoid fighting local UI)
          if (isPlayerRole()) {
            applyVttStateMessage(JSON.parse(e.newValue));
          }
          return;
        }
      } catch (err) { console.warn('vtt storage', err); }
    });

    // Lightweight poll fallback — role-specific, never re-apply own traffic on DM
    window.__vttClientId = window.__vttClientId || ('c' + Math.random().toString(36).slice(2, 10));
    let lastPlayerCombat = 0;
    let lastDmSync = 0;
    setInterval(() => {
      try {
        if (isPlayerRole()) {
          // Player listens for DM broadcasts
          const raw = localStorage.getItem('cybervlachos_vtt_sync');
          if (raw) {
            const msg = JSON.parse(raw);
            if (msg && msg.at && msg.at !== lastDmSync && msg.from !== 'player') {
              lastDmSync = msg.at;
              applyVttStateMessage(msg);
            }
          }
        } else {
          // DM listens only for player combat patches
          const raw = localStorage.getItem('cybervlachos_vtt_player_combat');
          if (raw) {
            const msg = JSON.parse(raw);
            if (msg && msg.at && msg.at !== lastPlayerCombat && msg.from === 'player') {
              lastPlayerCombat = msg.at;
              applyPlayerCombatPatch(msg);
            }
          }
        }
      } catch (e) {}
    }, 300);
  }

  /** DM-side: apply HP/slots/resources from a player without clobbering DM turn flow */
  function applyPlayerCombatPatch(msg) {
    if (!msg || !msg.combat || !msg.combat.combatants) return;
    if (isPlayerRole()) return;
    const room = getVttRoomCode();
    // Player combat patches: do not drop on room mismatch (DM main often has no ?room=)
    // if (room && msg.room && ...) return;.toUpperCase() !== String(msg.room).toUpperCase()) return;
    // Ignore stale
    if (msg.at && window.__lastAppliedPlayerCombat === msg.at) return;
    window.__lastAppliedPlayerCombat = msg.at;

    try {
      const c = getActive();
      if (!c) return;
      const combat = getCombat(c);
      let changed = false;
      (msg.combat.combatants || []).forEach(remote => {
        const local = (combat.combatants || []).find(x =>
          String(x.id) === String(remote.id) || x.name === remote.name
        );
        if (!local) return;
        const fields = [
          'hp','hpMax','tempHp','conditions','concentrating','dead','size','tokenSize',
          'turnState','turnPhase','actionUsed','actionsUsed','actionsMax','bonusUsed','reactionUsed','moveUsed',
          'attacksUsed','attacksMax','lastAction','combatSpellSlots','combatResources','spellSlots','deathSaves'
        ];
        fields.forEach(f => {
          // concentrating:false must apply (do not skip null/false)
          if (f === 'concentrating') {
            if (remote[f] !== undefined) {
              const before = local[f];
              local[f] = remote[f];
              if (!remote[f]) {
                local.concentrating = false;
                local.isConcentrating = false;
                try {
                  if (typeof dropConcentration === 'function' && before) {
                    // clear condition strings without double-logging
                    if (typeof local.conditions === 'string') {
                      local.conditions = local.conditions.split(/[,;]/).map(function(s){return s.trim();}).filter(function(s){return s && !/concentrat/i.test(s);}).join(', ');
                    }
                  }
                } catch (e) {}
              }
              if (before !== local[f]) changed = true;
            }
            return;
          }
          if (remote[f] !== undefined && remote[f] !== null) {
            const before = JSON.stringify(local[f]);
            // Monotonic for spend counters so player attacks never go backwards on DM
            if (f === 'attacksUsed' || f === 'actionsUsed' || f === 'moveUsed') {
              local[f] = Math.max(Number(local[f]) || 0, Number(remote[f]) || 0);
            } else if (f === 'actionUsed' || f === 'bonusUsed' || f === 'reactionUsed') {
              local[f] = !!(local[f] || remote[f]);
            } else {
              local[f] = remote[f];
            }
            if (JSON.stringify(local[f]) !== before) changed = true;
          }
        });
        // Always mark changed if economy fields present (force UI refresh)
        if (remote.attacksUsed != null || remote.actionsUsed != null) changed = true;
      });
      if (msg.combat && msg.combat.turnEconomy) {
        combat.turnEconomy = Object.assign({}, combat.turnEconomy || {}, msg.combat.turnEconomy);
        changed = true;
      }
      // Fog reveal from player? usually no — skip map unless tokens moved by player
      if (msg.map && msg.map.tokens) {
        const map = getCombatMap();
        if (map) {
          map.tokens = msg.map.tokens;
          changed = true;
        }
      }
      if (!changed) return;
      // Persist without going through full save recursion storms
      try {
        const key = (typeof STORAGE_KEY !== 'undefined') ? STORAGE_KEY : 'cybervlachos_combat_v1';
        const raw = localStorage.getItem(key);
        if (raw) {
          const data = JSON.parse(raw);
          const camp = (data.campaigns || []).find(x => x.id === data.activeCampaignId) || (data.campaigns || [])[0];
          if (camp && camp.combat) camp.combat.combatants = combat.combatants;
          localStorage.setItem(key, JSON.stringify(data));
        }
      } catch (e) {}
      // Merge player combat log (concentration rolls, etc.)
      try {
        if (msg.combat && Array.isArray(msg.combat.sharedLog) && msg.combat.sharedLog.length) {
          if (!Array.isArray(combat.sharedLog)) combat.sharedLog = [];
          var seen = {};
          combat.sharedLog.forEach(function(e) {
            if (e && e.t && e.text) seen[e.t + '|' + e.text] = true;
          });
          msg.combat.sharedLog.forEach(function(e) {
            if (!e || !e.text) return;
            var k = (e.t || '') + '|' + e.text;
            if (!seen[k]) { combat.sharedLog.push(e); seen[k] = true; }
          });
          if (combat.sharedLog.length > 80) combat.sharedLog = combat.sharedLog.slice(-80);
          try { if (typeof renderSharedCombatLog === 'function') renderSharedCombatLog(); } catch (e2) {}
        }
      } catch (e) {}
      try { if (typeof broadcastVttState === 'function') broadcastVttState('from-player-patch'); } catch (e) {}
      try { renderCombat(); } catch (e) {}
      try { renderBattleMap(); } catch (e) {}
      try { renderMapRoster(); } catch (e) {}
      // Restore DM Damage Roll if a hit is still open
      try {
        var lg = window.__lastCombatRoll || {};
        if (lg.canDamage === true && lg.applied !== true && typeof setDamageRollEnabled === 'function') {
          setDamageRollEnabled(document.getElementById('combat-detail') || document, true, 'Roll damage and apply');
        }
      } catch (e) {}
      // Refresh economy UI for every combatant that has attacks/actions (player may not be selected on DM)
      try {
        (combat.combatants || []).forEach(function(sel) {
          if (!sel) return;
          if (typeof refreshTurnEconomyUI === 'function') refreshTurnEconomyUI(sel);
        });
        const sel = (combat.combatants || [])[combat.selectedIndex]
          || (combat.combatants || []).find(function(x) { return x && x.turnPhase === 'active'; });
        if (sel && typeof renderCombatDetail === 'function') renderCombatDetail(sel);
        else if (typeof refreshCombatDetail === 'function') refreshCombatDetail();
      } catch (e) {}
    } catch (e) { console.warn('applyPlayerCombatPatch', e); }
  }


  
  
  if (!window.__economyListener) {
    window.__economyListener = true;
    function applyEconomyMessage(msg) {
      if (!msg || msg.type !== 'vtt-economy') return;
      try {
        var c = typeof getActive === 'function' ? getActive() : null;
        if (!c) return;
        var combat = typeof getCombat === 'function' ? getCombat(c) : null;
        if (!combat) return;
        var cb = (combat.combatants || []).find(function(x) {
          return String(x.id) === String(msg.id) || x.name === msg.name;
        });
        if (!cb) return;
        if (msg.attacksUsed != null) cb.attacksUsed = Math.max(Number(cb.attacksUsed) || 0, Number(msg.attacksUsed) || 0);
        if (msg.attacksMax != null) cb.attacksMax = Math.max(Number(cb.attacksMax) || 1, Number(msg.attacksMax) || 1);
        if (msg.actionsUsed != null) cb.actionsUsed = Math.max(Number(cb.actionsUsed) || 0, Number(msg.actionsUsed) || 0);
        if (msg.actionsMax != null) cb.actionsMax = Math.max(Number(cb.actionsMax) || 1, Number(msg.actionsMax) || 1);
        if (msg.actionUsed) cb.actionUsed = true;
        if (msg.turnPhase) cb.turnPhase = msg.turnPhase;
        if (typeof refreshTurnEconomyUI === 'function') refreshTurnEconomyUI(cb);
        try {
          if (typeof isPlayerRole === 'function' && isPlayerRole()) {
            if (typeof renderPlayerCombatPanel === 'function') renderPlayerCombatPanel();
            if (typeof refreshTurnEconomyUI === 'function') refreshTurnEconomyUI(cb);
          } else if (typeof renderCombat === 'function') {
            renderCombat();
            if (typeof refreshTurnEconomyUI === 'function') refreshTurnEconomyUI(cb);
          }
        } catch (e) {}
      } catch (e) {}
    }
    window.addEventListener('storage', function(ev) {
      if (ev.key === 'cybervlachos_vtt_economy' && ev.newValue) {
        try { applyEconomyMessage(JSON.parse(ev.newValue)); } catch (e) {}
      }
    });
    setInterval(function() {
      try {
        var raw = localStorage.getItem('cybervlachos_vtt_economy');
        if (!raw) return;
        var msg = JSON.parse(raw);
        if (!msg || !msg.at || msg.at === window.__lastEconAt) return;
        window.__lastEconAt = msg.at;
        applyEconomyMessage(msg);
      } catch (e) {}
    }, 350);
  }

  /* __player_combat_poll__ */
  (function playerCombatPoll() {
    if (window.__playerCombatPollStarted) return;
    window.__playerCombatPollStarted = true;
    let lastAt = 0;
    setInterval(function () {
      try {
        if (typeof isPlayerRole === 'function' && isPlayerRole()) return;
        const raw = localStorage.getItem('cybervlachos_vtt_player_combat');
        if (!raw) return;
        const msg = JSON.parse(raw);
        if (!msg || !msg.at || msg.at <= lastAt) return;
        lastAt = msg.at;
        if (typeof applyPlayerCombatPatch === 'function') applyPlayerCombatPatch(msg);
      } catch (e) {}
    }, 400);
  })();

  function isJoinLanding() {
    try {
      const q = new URLSearchParams(location.search);
      if (q.get('join') === '1') return true;
      if (q.get('role') === 'player' && !(q.get('room') || '').trim()) return true;
      return false;
    } catch (e) { return false; }
  }
  function wirePlayerLanding() {
    if (!isJoinLanding()) {
      const el = document.getElementById('player-landing');
      if (el) el.classList.add('hidden');
      return;
    }
    document.documentElement.classList.add('vtt-landing');
    const el = document.getElementById('player-landing');
    if (el) el.classList.remove('hidden');
    // Prefer global __joinBattleMap (defined next to the form) so the button always works
    const go = () => { if (typeof window.__joinBattleMap === 'function') window.__joinBattleMap(); };
    document.getElementById('player-room-join-btn')?.addEventListener('click', (e) => { e.preventDefault(); go(); });
    document.getElementById('player-room-input')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); go(); }
    });
  }

  
  // ─── Player claim + personal combat panel ────────────────────────────────
  function claimStorageKey() {
    const room = (getVttRoomCode() || 'default').toUpperCase();
    return 'cybervlachos_claim_' + room;
  }
  function getClaimedId() {
    try { return sessionStorage.getItem(claimStorageKey()) || localStorage.getItem(claimStorageKey()) || ''; } catch (e) { return ''; }
  }
  function setClaimedId(id) {
    try {
      sessionStorage.setItem(claimStorageKey(), String(id || ''));
      localStorage.setItem(claimStorageKey(), String(id || ''));
    } catch (e) {}
  }
  function getClaimedCombatant() {
    const id = getClaimedId();
    if (!id) return null;
    const c = getActive();
    const combat = c ? getCombat(c) : null;
    const list = (combat && combat.combatants) || [];
    return list.find(cb => String(cb.id) === String(id) || String(cb.name) === String(id)) || null;
  }
  function broadcastPlayerAction(action) {
    try {
      const room = getVttRoomCode() || sessionStorage.getItem('vtt_room') || '';
      const payload = {
        type: 'vtt-player-action',
        room: room,
        at: Date.now(),
        clientId: window.__vttClientId || null,
        claimedId: typeof getClaimedId === 'function' ? getClaimedId() : '',
        action: action || {}
      };
      try { localStorage.setItem('cybervlachos_vtt_player_action', JSON.stringify(payload)); } catch (e) {}
      try {
        const ch = getVttChannel();
        if (ch) ch.postMessage(payload);
      } catch (e) {}
      // Always push a player combat patch so DM receives HP / economy
      try { syncPlayerCombatToDm(action); } catch (e) { console.warn(e); }
    } catch (e) { console.warn('broadcastPlayerAction', e); }
  }

  function syncPlayerCombatToDm(action) {
    if (typeof isPlayerRole === 'function' && !isPlayerRole()) {
      // DM side can still broadcast full state
      try { if (typeof broadcastVttState === 'function') broadcastVttState('dm-action'); } catch (e) {}
      return;
    }
    try {
      const c = getActive();
      const combat = c ? getCombat(c) : null;
      if (!combat) return;
      const room = getVttRoomCode() || sessionStorage.getItem('vtt_room') || '';
      const lite = {
        type: 'vtt-state',
        from: 'player',
        room: room,
        reason: (action && action.kind) || 'player-combat',
        at: Date.now(),
        clientId: window.__vttClientId || null,
        action: action || null,
        combat: {
          round: combat.round,
          current: combat.current,
          turnIndex: combat.turnIndex,
          turnEconomy: combat.turnEconomy || {},
          combatants: (combat.combatants || []).map(cb => ({
            id: cb.id,
            name: cb.name,
            hp: cb.hp,
            hpMax: cb.hpMax,
            tempHp: cb.tempHp,
            ac: cb.ac,
            init: cb.init,
            side: cb.side,
            conditions: cb.conditions,
            hideHp: cb.hideHp,
            concentrating: cb.concentrating,
            dead: cb.dead,
            turnPhase: cb.turnPhase,
            actionUsed: cb.actionUsed,
            actionsUsed: cb.actionsUsed,
            actionsMax: cb.actionsMax,
            bonusUsed: cb.bonusUsed,
            reactionUsed: cb.reactionUsed,
            moveUsed: cb.moveUsed,
            attacksUsed: cb.attacksUsed,
            attacksMax: cb.attacksMax,
            lastAction: cb.lastAction,
            combatSpellSlots: cb.combatSpellSlots,
            combatResources: cb.combatResources,
            spellSlots: cb.spellSlots,
            deathSaves: cb.deathSaves
          }))
        },
        map: c.combatMap ? {
          tokens: c.combatMap.tokens || {},
          fogEnabled: c.combatMap.fogEnabled,
          fogRevealed: c.combatMap.fogRevealed || {}
        } : null
      };
      try { localStorage.setItem('cybervlachos_vtt_sync', JSON.stringify(lite)); } catch (e) {}
      try {
        const ch = getVttChannel();
        if (ch) ch.postMessage(lite);
      } catch (e) {}
      try {
        if (window.__mapBc) window.__mapBc.postMessage(lite);
      } catch (e) {}
    } catch (e) { console.warn('syncPlayerCombatToDm', e); }
  }


  function applyPlayerActionMessage(msg) {
    if (!msg || msg.type !== 'vtt-player-action') return;
    const room = getVttRoomCode();
    if (room && msg.room && String(room).toUpperCase() !== String(msg.room).toUpperCase()) return;
    const act = msg.action || {};
    const c = getActive();
    if (!c) return;
    const combat = getCombat(c);
    const target = (combat.combatants || []).find(cb =>
      String(cb.id) === String(act.targetId) || String(cb.name) === String(act.targetId)
    );
    if (!target) return;
    if (act.kind === 'heal') {
      const amt = Math.max(0, Number(act.amount) || 0);
      target.hp = Math.min(Number(target.hpMax) || amt, (Number(target.hp) || 0) + amt);
    } else if (act.kind === 'damage') {
      const amt = Math.max(0, Number(act.amount) || 0);
      // temp HP first
      let left = amt;
      const th = Number(target.tempHp) || 0;
      if (th > 0) {
        const use = Math.min(th, left);
        target.tempHp = th - use;
        left -= use;
      }
      target.hp = Math.max(0, (Number(target.hp) || 0) - left);
    } else if (act.kind === 'setHp') {
      target.hp = Math.max(0, Math.min(Number(target.hpMax) || 0, Number(act.amount) || 0));
    } else if (act.kind === 'tempHp') {
      target.tempHp = Math.max(0, Number(act.amount) || 0);
    } else if (act.kind === 'markAction') {
      if (!target.turnState) target.turnState = {};
      target.turnState.actionUsed = !!act.value;
    } else if (act.kind === 'markBonus') {
      if (!target.turnState) target.turnState = {};
      target.turnState.bonusUsed = !!act.value;
    } else if (act.kind === 'markReaction') {
      if (!target.turnState) target.turnState = {};
      target.turnState.reactionUsed = !!act.value;
    }
    try { if (!isPlayerRole()) save(); } catch (e) {}
    try { renderBattleMap(); renderMapRoster(); renderPlayerCombatPanel(); } catch (e) {}
    try { if (!isPlayerRole() && typeof renderCombat === 'function') renderCombat(); } catch (e) {}
  }
  function ensurePlayerCombatPanel() {
    let panel = document.getElementById('player-combat-panel');
    if (!panel) {
      const layout = document.querySelector('.map-layout');
      if (!layout) return null;
      panel = document.createElement('aside');
      panel.id = 'player-combat-panel';
      panel.className = 'player-combat-panel card';
      panel.innerHTML = '<div class="map-roster-head"><strong>Your character</strong></div><div id="player-combat-body" class="player-combat-body"></div>';
      layout.appendChild(panel);
    }
    return panel;
  }  function renderPlayerCombatPanel() {
    try { renderSharedCombatLog(); } catch (e) {}
 // Combat controls only for role=player (not DM mapPopout share window)
    if (!isPlayerRole()) {
      const p = document.getElementById('player-combat-panel');
      if (p) { p.style.display = 'none'; p.setAttribute('hidden', ''); }
      return;
    }
    const panel = ensurePlayerCombatPanel();
    if (!panel) return;
    panel.style.display = 'flex';
    let body = document.getElementById('player-combat-body');
    if (!body) {
      body = document.createElement('div');
      body.id = 'player-combat-body';
      body.className = 'player-combat-body';
      panel.appendChild(body);
    }
    // Ensure header
    let head = panel.querySelector('.map-roster-head');
    if (!head) {
      head = document.createElement('div');
      head.className = 'map-roster-head';
      panel.insertBefore(head, body);
    }

    const c = getActive();
    const combat = c ? getCombat(c) : null;
    const list = (combat && combat.combatants) || [];
    const claimable = list.filter(cb => {
      const side = String(cb.side || '').toLowerCase();
      return side !== 'enemy' && side !== 'villain' && side !== 'enemies';
    });
    let me = getClaimedCombatant();
    if (me && !list.some(cb => String(cb.id) === String(me.id))) me = null;

    if (!me) {
      head.innerHTML = '<strong>Your character</strong>';
      if (!claimable.length) {
        body.innerHTML = '<p class="muted small">No party members in combat yet. Ask the DM to add your character.</p>';
        return;
      }
      body.innerHTML = '<p class="muted small">Choose your character to open the full combat panel:</p><div class="pc-claim-list">' +
        claimable.map(cb => {
          const hp = Number(cb.hp) || 0, hpMax = Number(cb.hpMax) || 0;
          return `<button type="button" class="btn secondary" data-claim-id="${String(cb.id).replace(/"/g,'')}">${(cb.name || 'Unknown').replace(/</g,'')} · ${hp}/${hpMax} HP</button>`;
        }).join('') + '</div>';
      body.querySelectorAll('[data-claim-id]').forEach(btn => {
        btn.addEventListener('click', () => {
          setClaimedId(btn.getAttribute('data-claim-id'));
          // Select this combatant in combat state for roller targeting context
          try {
            const combat2 = getCombat(getActive());
            const idx = (combat2.combatants || []).findIndex(x => String(x.id) === String(btn.getAttribute('data-claim-id')));
            if (idx >= 0) combat2.selectedIndex = idx;
          } catch (e) {}
          renderPlayerCombatPanel();
        });
      });
      return;
    }

    head.innerHTML = `<strong>Your character</strong>
      <button type="button" class="btn ghost btn-tiny" id="pc-switch-char" title="Claim a different character">Switch</button>`;
    head.querySelector('#pc-switch-char')?.addEventListener('click', () => {
      setClaimedId('');
      renderPlayerCombatPanel();
    });

    // Select claimed combatant so detail/roller context matches
    try {
      const idx = list.findIndex(x => String(x.id) === String(me.id));
      if (idx >= 0) combat.selectedIndex = idx;
    } catch (e) {}

    // Auto-activate turn for claimed PC so Action/Cast/Roll are not locked behind "Start turn"
    // Do NOT reset attacksUsed/actionsUsed — only mark phase active and restore saved economy
    try {
      if (!me.turnPhase || me.turnPhase === 'ready' || me.turnPhase === 'pending') {
        me.turnPhase = 'active';
      }
      if (typeof ensureCombatantTurnState === 'function') ensureCombatantTurnState(me, null);
      if (typeof restoreTurnEconomy === 'function') restoreTurnEconomy(me);
    } catch (e) {}
    // Full combat detail + attack/spell roller (same as DM panel)
    try {
      if (typeof showCombatDetail === 'function') {
        showCombatDetail(me, body);
      } else {
        body.innerHTML = '<p class="muted">Combat detail unavailable.</p>';
      }
    } catch (e) {
      console.error(e);
      body.innerHTML = '<p class="muted">Error loading combat panel.</p>';
    }
    try { applyRollAttackButtonState(body, me); } catch (e) {}
    try { restorePlayerRollResult(me); } catch (e) {}
    try {
      const last = window.__lastCombatRoll || {};
      // Only an open, unapplied hit gate — never last.hit alone (that re-enabled Damage Roll after apply / across turns)
      if (last.canDamage === true && last.applied !== true) {
        const btn = body.querySelector('#cr-roll-dmg');
        if (btn) {
          btn.disabled = false;
          btn.removeAttribute('disabled');
          btn.classList.add('is-ready');
          btn.title = 'Roll damage and apply to selected target(s)';
        }
      }
    } catch (e) {}
  }

  function applyPlayerShell() {
    if (!isPlayerRole()) return;
    document.body.classList.add('vtt-player');
    document.documentElement.classList.add('vtt-player');
    document.title = 'Battle Map (Player)' + (getVttRoomCode() ? ' · ' + getVttRoomCode() : '');

    const hideSel = [
      '#view-combat', '#view-tools', '#sidebar', '#menu-toggle', '.menu-toggle',
      '#sidebar-collapse-btn', '.sidebar-collapse-btn',
      '.app-header', 'header.app-header', 'header', '.view-desc',
      '#vtt-create-room', '#vtt-join-player', '#vtt-room-code',
      '#map-fog-toggle', '#map-fog-reveal', '#map-fog-hide', '#map-fog-reset', '#map-fog-brush',
      '#map-file-image', '#map-file-uvtt', '#map-import-image', '#map-import-uvtt',
      '#dice-toggle', '#dice-panel', '.map-toolbar', 'nav', '.app-nav'
    ];
    hideSel.forEach(sel => {
      document.querySelectorAll(sel).forEach(el => {
        try {
          el.remove();
        } catch (e) {
          try {
            el.style.setProperty('display', 'none', 'important');
            el.style.pointerEvents = 'none';
            el.setAttribute('data-player-hidden', '1');
          } catch (e2) {}
        }
      });
    });

    // Force map view visible
    const mapView = document.getElementById('view-map');
    if (mapView) {
      mapView.classList.add('active');
      mapView.style.setProperty('display', 'flex', 'important');
      mapView.style.setProperty('flex-direction', 'column', 'important');
      mapView.style.setProperty('min-height', '100dvh', 'important');
    }
    document.querySelectorAll('.view').forEach(v => {
      if (v.id !== 'view-map') {
        v.classList.remove('active');
        v.style.setProperty('display', 'none', 'important');
      }
    });

    try { if (typeof setView === 'function') setView('map'); } catch (e) {}
    try { if (typeof initBattleMapUi === 'function') initBattleMapUi(); } catch (e) {}
    try { if (typeof renderBattleMap === 'function') renderBattleMap(); } catch (e) {}
    try { if (typeof renderMapRoster === 'function') renderMapRoster(); } catch (e) {}
    try { if (typeof renderPlayerCombatPanel === 'function') renderPlayerCombatPanel(); } catch (e) {}

    // Re-apply after short delay (setView/render may restore combat)
    setTimeout(() => {
      document.querySelectorAll('#view-combat, #view-tools').forEach(el => {
        el.style.setProperty('display', 'none', 'important');
        el.classList.remove('active');
      });
      const mv = document.getElementById('view-map');
      if (mv) {
        mv.classList.add('active');
        mv.style.setProperty('display', 'flex', 'important');
      }
      try { renderBattleMap(); renderMapRoster(); } catch (e) {}
    }, 100);
    setTimeout(() => {
      document.querySelectorAll('#view-combat').forEach(el => el.style.setProperty('display', 'none', 'important'));
      try { renderBattleMap(); } catch (e) {}
      try { renderPlayerCombatPanel(); } catch (e) {}
    }, 500);
  }

  /** Player-facing combatant summary: hide enemy HP / optionally mask names in fog */
  function playerVisibleCombatant(cb) {
    if (!cb) return null;
    if (!isPlayerRole()) return cb;
    const side = String(cb.side || '').toLowerCase();
    const isEnemy = side === 'enemy' || side === 'villain' || side === 'enemies';
    const copy = Object.assign({}, cb);
    if (isEnemy) {
      // Hide precise HP from players unless DM cleared hideHp flag meaning "show"
      if (cb.hideHp !== false) {
        copy.hp = null;
        copy.hpMax = null;
        copy.hideHp = true;
      }
      // Unrevealed enemies can stay on map but roster shows generic label if fogged - handled in roster
    }
    return copy;
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
    const playerMode = typeof isPlayerRole === 'function' && isPlayerRole();
    ensureMapFog(map);
    list.forEach((cb, idx) => {
      const id = String(cb.id || idx);
      const resolved = typeof tokenPosForCombatant === 'function' ? tokenPosForCombatant(map, cb, idx) : null;
      const pos = resolved ? resolved.pos : (map.tokens[id]);
      if (!pos) return;
      // Player clients: hide tokens in unrevealed fog (DM mapPopout still sees all so DM can move them)
      const hideFogTokens = typeof isPlayerRole === 'function' && isPlayerRole();
      if (hideFogTokens && map.fogEnabled) {
        try {
          // Always show the player's own claimed token
          var claimed = typeof getClaimedCombatant === 'function' ? getClaimedCombatant() : null;
          var isSelf = claimed && (String(claimed.id) === String(cb.id) || claimed.name === cb.name);
          if (!isSelf) {
            const cell = worldToFogCell(map, pos.x, pos.y);
            if (!map.fogRevealed || !map.fogRevealed[cell]) return;
          }
        } catch (e) {
          const cell = worldToFogCell(map, pos.x, pos.y);
          if (!map.fogRevealed || !map.fogRevealed[cell]) return;
        }
      }
      const x = pos.x * scale, y = pos.y * scale;
      const r = typeof tokenRadiusForCombatant === 'function'
        ? tokenRadiusForCombatant(map, cb, scale)
        : Math.max(8, (Number(map.gridSize) || 70) * scale * 0.35);
      const side = String(cb.side || '').toLowerCase();
      const isEnemy = side === 'enemy' || side === 'villain' || side === 'enemies';
      const isAlly = side === 'ally' || side === 'allies';
      let fill = isEnemy ? 'rgba(180,40,40,0.9)' : (isAlly ? 'rgba(50,100,180,0.9)' : 'rgba(40,120,80,0.9)');
      const hp = Number(cb.hp) || 0;
      const hpMax = Math.max(1, Number(cb.hpMax) || 1);
      const ratio = Math.max(0, Math.min(1, hp / hpMax));
      if (hp <= 0) fill = 'rgba(60,60,60,0.85)';
      // Player: never show enemy HP numbers/arcs
      const showHp = !cb.hideHp && !(playerMode && isEnemy);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      const tokImg = (typeof window.getTokenImageForCombatant === 'function') ? window.getTokenImageForCombatant(cb) : ((typeof getTokenImageForCombatant === 'function') ? getTokenImageForCombatant(cb) : null);
      if (tokImg && tokImg.complete && tokImg.naturalWidth) {
        // Circular token portrait (template: clipped art + bold ring)
        ctx.save();
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        const size = r * 2;
        // Cover-fit: scale image to fill circle
        const iw = tokImg.naturalWidth, ih = tokImg.naturalHeight;
        const cover = Math.max(size / iw, size / ih);
        const dw = iw * cover, dh = ih * cover;
        ctx.drawImage(tokImg, x - dw / 2, y - dh / 2, dw, dh);
        ctx.restore();
        // Outer ring — enemy red / ally gold / pc green-tinted
        const ring = isEnemy ? '#c23b22' : (isAlly ? '#c4a35a' : '#2d6a4f');
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.strokeStyle = ring;
        ctx.lineWidth = Math.max(3, r * 0.18);
        ctx.stroke();
        // Inner rim
        ctx.beginPath();
        ctx.arc(x, y, Math.max(1, r - ctx.lineWidth * 0.35), 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(0,0,0,0.45)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      } else {
        ctx.fillStyle = fill;
        ctx.fill();
      }
      if (showHp && hp > 0) {
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
      // Name plate only (HP is on the ring — keep plate uncluttered)
      const label = (playerMode && isEnemy)
        ? (cb.hideName ? 'Creature' : (cb.name || 'Enemy').slice(0, 16))
        : (cb.name || '?').slice(0, 16);
      ctx.font = '600 11px system-ui,Segoe UI,sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      const lw = Math.min(110, Math.max(28, ctx.measureText(label).width + 10));
      const lh = 14;
      const lx = x - lw / 2;
      const ly = y + r + 3;
      ctx.fillStyle = 'rgba(6,4,2,0.78)';
      ctx.strokeStyle = isEnemy ? 'rgba(200,80,80,0.75)' : 'rgba(196,163,90,0.7)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(lx, ly, lw, lh, 3);
      else ctx.rect(lx, ly, lw, lh);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#efe6d6';
      ctx.fillText(label, x, ly + 1);
      if (cb.concentrating) {
        ctx.font = '600 9px system-ui,sans-serif';
        ctx.fillStyle = '#9ec9ff';
        ctx.fillText('Conc', x, ly + lh + 1);
      }
      // Conditions under name
      let condStr = '';
      try {
        const cl = (cb.conditionList && cb.conditionList.length)
          ? cb.conditionList.map(c => (c.name || c)).filter(Boolean)
          : String(cb.conditions || '').split(/[,;]/).map(s => s.trim()).filter(Boolean);
        if (cb.concentrating) cl.unshift('Conc.');
        if (cb.dead || hp <= 0) cl.unshift('Down');
        condStr = cl.slice(0, 3).join(', ');
      } catch (e) { condStr = ''; }
      if (condStr) {
        ctx.font = '10px system-ui,sans-serif';
        const cw = Math.min(130, Math.max(28, ctx.measureText(condStr).width + 8));
        ctx.fillStyle = 'rgba(40,20,10,0.8)';
        ctx.fillRect(x - cw / 2, ly + 16, cw, 13);
        ctx.fillStyle = '#e8b86a';
        ctx.fillText(condStr.slice(0, 22), x, ly + 17);
      }
      if (showHp) {
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 10px system-ui,sans-serif';
        ctx.textBaseline = 'middle';
        ctx.fillText(hp + '/' + hpMax, x, y + 1);
      }
    });

    // Ruler / range measure
    if (map.ruler && map.ruler.x1 != null) {
      const r = map.ruler;
      const x1 = r.x1 * scale, y1 = r.y1 * scale;
      const x2 = (r.x2 != null ? r.x2 : r.x1) * scale;
      const y2 = (r.y2 != null ? r.y2 : r.y1) * scale;
      ctx.strokeStyle = 'rgba(255,220,100,0.95)';
      ctx.fillStyle = 'rgba(255,220,100,0.95)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath(); ctx.arc(x1, y1, 4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(x2, y2, 4, 0, Math.PI * 2); ctx.fill();
      const dx = (r.x2 != null ? r.x2 : r.x1) - r.x1;
      const dy = (r.y2 != null ? r.y2 : r.y1) - r.y1;
      const distPx = Math.sqrt(dx * dx + dy * dy);
      const ft = distPx / ((Number(map.gridSize) || 70) / 5);
      const label = (Math.round(ft * 2) / 2) + ' ft';
      const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
      ctx.font = 'bold 13px system-ui,sans-serif';
      ctx.textAlign = 'center';
      const tw = ctx.measureText(label).width + 10;
      ctx.fillStyle = 'rgba(0,0,0,0.75)';
      ctx.fillRect(mx - tw / 2, my - 18, tw, 18);
      ctx.fillStyle = '#ffe566';
      ctx.fillText(label, mx, my - 4);
    }

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

    // Fog of war (on top of map/tokens in unrevealed cells)
    try { drawFogOfWar(ctx, canvas, map, scale); } catch (e) {}

    // Dragged token always on top of fog so DM sees live movement
    try {
      const dragId = window.__mapDragId;
      if (dragId && map.tokens && map.tokens[dragId]) {
        const pos = map.tokens[dragId];
        const x = pos.x * scale, y = pos.y * scale;
        const dragCb = typeof findCombatantByTokenId === 'function' ? findCombatantByTokenId(dragId) : null;
        const r = typeof tokenRadiusForCombatant === 'function'
          ? tokenRadiusForCombatant(map, dragCb || {}, scale)
          : Math.max(10, (Number(map.gridSize) || 70) * scale * 0.35);
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 210, 74, 0.95)';
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        ctx.stroke();
      }
    } catch (e) {}

  }
  window.__drawMapOverlays = drawMapOverlays;


  function fitMapCanvasToWrap(canvas, srcW, srcH, force) {
    if (!canvas || !srcW || !srcH) return 1;
    const pop = typeof isMapPopoutMode === 'function' && isMapPopoutMode();
    const layout = document.querySelector('.map-layout');
    const wrap = canvas.parentElement;
    const roster = document.getElementById('map-roster');
    const playerPanel = document.getElementById('player-combat-panel');
    let side = 0;
    try {
      if (roster && getComputedStyle(roster).display !== 'none') side += (roster.offsetWidth || 280) + 12;
      if (playerPanel && getComputedStyle(playerPanel).display !== 'none') side += (playerPanel.offsetWidth || 300) + 12;
    } catch (e) {}
    // Prefer window size on popout (layout often 0-height for first frames)
    let maxW, maxH;
    if (pop) {
      maxW = Math.max(280, window.innerWidth - side - 16);
      maxH = Math.max(220, window.innerHeight - 16);
      if (layout && layout.clientWidth > 120 && layout.clientHeight > 120) {
        maxW = Math.max(280, layout.clientWidth - side - 12);
        maxH = Math.max(220, layout.clientHeight - 12);
      }
    } else if (layout && layout.clientWidth > 80) {
      maxW = Math.max(280, layout.clientWidth - side - 12);
      maxH = Math.max(220, (layout.clientHeight > 80 ? layout.clientHeight : window.innerHeight * 0.6) - 12);
    } else if (wrap && wrap.clientWidth > 80 && wrap.clientHeight > 80) {
      maxW = wrap.clientWidth - 8;
      maxH = wrap.clientHeight - 8;
    } else {
      maxW = Math.max(320, window.innerWidth - side - 100);
      maxH = Math.max(240, window.innerHeight - 140);
    }
    if (!pop) {
      maxW = Math.min(maxW, Math.max(600, window.innerWidth - 320));
      maxH = Math.min(maxH, window.innerHeight - 140);
    }
    let scale = Math.min(maxW / srcW, maxH / srcH, 1);
    const map = (typeof getCombatMap === 'function') ? getCombatMap() : null;
    // Shrink-guard only after layout has stabilized (skip on popout first paints / force)
    const layoutReady = !pop || (layout && layout.clientWidth > 120 && layout.clientHeight > 120);
    if (!force && layoutReady && map && map._fitSrcW === srcW && map._fitSrcH === srcH && map.scale > 0) {
      if (scale < map.scale * 0.98) scale = map.scale;
      // Allow grow when window got larger
      if (scale > map.scale * 1.02) { /* use new larger scale */ }
      else if (scale < map.scale) scale = map.scale;
    }
    const w = Math.max(1, Math.floor(srcW * scale));
    const h = Math.max(1, Math.floor(srcH * scale));
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    canvas.style.maxWidth = '100%';
    canvas.style.maxHeight = '100%';
    canvas.style.objectFit = 'contain';
    if (map) {
      map._fitSrcW = srcW;
      map._fitSrcH = srcH;
      map.scale = scale;
    }
    return scale;
  }

  
  if (!window.__mapResizeBound) {
    window.__mapResizeBound = true;
    let resizeTimer = null;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        try {
          const m = getCombatMap();
          if (!m) return;
          m._fitSrcW = null;
          m._fitSrcH = null;
          window.__mapVideoTicking = false;
          renderBattleMap();
        } catch (e) {}
      }, 150);
    });
  }

  function renderBattleMap() {
    const canvas = document.getElementById('map-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const map = getCombatMap();
    const status = document.getElementById('map-status');
    const videoEl = document.getElementById('map-video');
    const hasVideo = !!(map && map.mediaType === 'video' && map.videoObjectUrl);
    const hasImage = !!(map && map.imageDataUrl);
    const sameVideoRunning = !!(hasVideo && window.__mapVideoTicking && window.__mapVideoSrc === map.videoObjectUrl);
    // Never cancel the video draw loop when only FoW/tokens changed — tick already redraws overlays
    if (!sameVideoRunning && window.__mapRaf) {
      cancelAnimationFrame(window.__mapRaf);
      window.__mapRaf = null;
    }
    if (!map) {
      if (status) status.textContent = 'No map workspace';
      return;
    }
    if (!hasImage && !hasVideo) {
      // Still allow fog/grid overlay on empty canvas so FoW tools are visible
      const w = canvas.clientWidth || 900, h = canvas.clientHeight || 600;
      if (canvas.width !== w) canvas.width = w;
      if (canvas.height !== h) canvas.height = h;
      ctx.fillStyle = '#1a1a22';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      try { drawMapOverlays(ctx, canvas, map, 1); } catch (e) {}
      if (status) status.textContent = map.fogEnabled ? 'FoW on (no map image yet)' : 'No map image — import one';
      return;
    }
    // Live video map: draw frames to canvas under tokens/grid
    if (hasVideo && videoEl) {
      videoEl.style.display = 'none';
      const want = map.videoObjectUrl;
      videoEl.muted = true;
      videoEl.defaultMuted = true;
      videoEl.loop = true;
      videoEl.playsInline = true;
      videoEl.setAttribute('muted', '');
      videoEl.setAttribute('loop', '');
      videoEl.setAttribute('playsinline', '');
      videoEl.preload = 'auto';
      if (videoEl.getAttribute('data-src') !== want) {
        videoEl.setAttribute('data-src', want);
        videoEl.src = want;
        try { videoEl.load(); } catch (e) {}
      }
      let started = false;
      let waitFrames = 0;
      const startVideoDraw = (forceFit) => {
        const srcW = videoEl.videoWidth;
        const srcH = videoEl.videoHeight;
        if (!srcW || !srcH) {
          if (started) return;
          waitFrames++;
          if (waitFrames < 180) {
            window.__mapRaf = requestAnimationFrame(() => startVideoDraw(forceFit));
          } else if (status) {
            status.textContent = 'Video still loading… use tool Select and click map once to retry play';
          }
          return;
        }
        map.width = srcW;
        map.height = srcH;
        // Only fit once (or when forced e.g. new video / window resize)
        const needFit = forceFit || !started || !map.scale || map._fitSrcW !== srcW || map._fitSrcH !== srcH || !canvas.width;
        const scale = needFit ? fitMapCanvasToWrap(canvas, srcW, srcH, !!forceFit) : (map.scale || fitMapCanvasToWrap(canvas, srcW, srcH, false));
        map.scale = scale;
        if (started && window.__mapVideoTicking) return;
        started = true;
        window.__mapVideoTicking = true;
        const ensurePlaying = () => {
          try {
            videoEl.muted = true;
            videoEl.loop = true;
            if (videoEl.paused || videoEl.ended) {
              const p = videoEl.play();
              if (p && p.catch) p.catch(() => {});
            }
          } catch (e) {}
        };
        ensurePlaying();
        const tick = () => {
          const m = getCombatMap();
          if (!m || m.mediaType !== 'video') {
            window.__mapVideoTicking = false;
            return;
          }
          // Keep looping even if browser cleared loop flag
          if (videoEl.ended || (videoEl.duration && videoEl.currentTime >= videoEl.duration - 0.05)) {
            try { videoEl.currentTime = 0; } catch (e) {}
            ensurePlaying();
          } else {
            ensurePlaying();
          }
          try { paintMapFrame(); } catch (e) {
            try {
              ctx.setTransform(1, 0, 0, 1, 0, 0);
              ctx.clearRect(0, 0, canvas.width, canvas.height);
              ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
              window.__drawMapOverlays && window.__drawMapOverlays(ctx, canvas, m, m.scale || scale);
            } catch (e2) {}
          }
          window.__mapRaf = requestAnimationFrame(tick);
        };
        tick();
        if (status) status.textContent = `Video ${srcW}×${srcH} · looping · grid ${map.gridSize}px · FoW ${map.fogEnabled ? 'ON' : 'off'}`;
        try { renderMapRoster(); } catch (e) {}
      };
      videoEl.onloadedmetadata = startVideoDraw;
      videoEl.onloadeddata = startVideoDraw;
      videoEl.oncanplay = startVideoDraw;
      videoEl.onerror = () => {
        const err = videoEl.error;
        toast('Video failed to decode — use H.264 MP4 or WebM (' + (err && err.message ? err.message : 'unknown') + ')');
        if (status) status.textContent = 'Video decode failed';
      };
      // Click-to-play only — never re-fit (prevents map shrinking every click)
      if (!canvas.dataset.videoPlayBound) {
        canvas.dataset.videoPlayBound = '1';
        canvas.addEventListener('pointerdown', () => {
          const m = getCombatMap();
          if (!m || m.mediaType !== 'video') return;
          try {
            videoEl.muted = true;
            videoEl.loop = true;
            const p = videoEl.play();
            if (p && p.catch) p.catch(() => {});
          } catch (e) {}
        });
      }
      // Already running this video: keep size + tick; overlays update every frame from live map state
      if (videoEl.getAttribute('data-src') === want && window.__mapVideoSrc === want && window.__mapVideoTicking) {
        if (!window.__mapRaf) {
          // Tick was dropped — restart draw loop without refit
          const restartTick = () => {
            const m = getCombatMap();
            if (!m || m.mediaType !== 'video' || m.videoObjectUrl !== want) {
              window.__mapVideoTicking = false;
              return;
            }
            try {
              if (videoEl.ended || (videoEl.duration && videoEl.currentTime >= videoEl.duration - 0.05)) {
                videoEl.currentTime = 0;
              }
              if (videoEl.paused) videoEl.play().catch(() => {});
            } catch (e) {}
            try { paintMapFrame(); } catch (e) {
              ctx.setTransform(1, 0, 0, 1, 0, 0);
              ctx.clearRect(0, 0, canvas.width, canvas.height);
              try { ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height); } catch (e2) {}
              try { window.__drawMapOverlays && window.__drawMapOverlays(ctx, canvas, m, m.scale || 1); } catch (e2) {}
            }
            window.__mapRaf = requestAnimationFrame(restartTick);
          };
          window.__mapRaf = requestAnimationFrame(restartTick);
        }
        if (status) {
          status.textContent = `Video ${videoEl.videoWidth||'?'}×${videoEl.videoHeight||'?'} · looping · grid ${map.gridSize}px · FoW ${map.fogEnabled ? 'ON' : 'off'} (${Object.keys(map.fogRevealed||{}).length} revealed)`;
        }
        try { renderMapRoster(); } catch (e) {}
        return;
      }
      window.__mapVideoSrc = want;
      window.__mapVideoTicking = false;
      started = false;
      if (videoEl.readyState >= 2 && videoEl.videoWidth) startVideoDraw(false);
      else startVideoDraw(false);
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
      const scale = fitMapCanvasToWrap(canvas, img.width, img.height);
      map.scale = scale;
      window.__mapStaticImg = img;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      try {
        if (window.__drawMapOverlays) window.__drawMapOverlays(ctx, canvas, map, scale);
        else drawMapOverlays(ctx, canvas, map, scale);
      } catch (e) { console.warn('overlays', e); }

      if (status) {
        status.textContent = `${img.width}×${img.height}px · grid ${map.gridSize}px · FoW ${map.fogEnabled ? 'ON' : 'off'} (${Object.keys(map.fogRevealed||{}).length} revealed) · ${Object.keys(map.tokens||{}).length} tokens`;
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

  
  // ═══════════════════════════════════════════════════════════
  // Map canvas interactions (main DM + popout + player)
  // ═══════════════════════════════════════════════════════════
  
  
  function adjustTokensForNewMap(map, prevW, prevH, newW, newH) {
    if (!map || !map.tokens) return;
    const ids = Object.keys(map.tokens);
    if (!ids.length) return;
    if (!prevW || !prevH || !newW || !newH) {
      // Center tokens on new map in a small cluster
      const cx = newW / 2, cy = newH / 2;
      const g = Number(map.gridSize) || 70;
      ids.forEach((id, i) => {
        const col = i % 4, row = Math.floor(i / 4);
        map.tokens[id] = snapWorldToGrid(map, cx + (col - 1.5) * g, cy + (row - 1) * g);
      });
      return;
    }
    const sx = newW / prevW, sy = newH / prevH;
    ids.forEach(id => {
      const p = map.tokens[id];
      if (!p) return;
      map.tokens[id] = snapWorldToGrid(map, (p.x || 0) * sx, (p.y || 0) * sy);
    });
  }

  function measureImageDataUrl(dataUrl) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.naturalWidth || img.width, h: img.naturalHeight || img.height });
      img.onerror = () => resolve(null);
      img.src = dataUrl;
    });
  }


  function bindMapMediaInputs() {
    if (window.__mapMediaInputsBound) return;
    window.__mapMediaInputsBound = true;
    document.addEventListener('change', async (e) => {
      const el = e.target;
      if (!el || !el.id) return;
      try {
        if (el.id === 'map-file-image') {
          const f = el.files && el.files[0];
          if (!f) return;
          const reader = new FileReader();
          reader.onload = () => {
            try { ensureCombatWorkspace(); } catch (err) {}
            const map = getCombatMap();
            if (!map) { toast('No workspace — open Combat once first'); return; }
            // Clear prior video
            if (map.videoObjectUrl && String(map.videoObjectUrl).startsWith('blob:')) {
              try { URL.revokeObjectURL(map.videoObjectUrl); } catch (err) {}
            }
            map.videoObjectUrl = null;
            map.mediaType = 'image';
            const prevW = map._fitSrcW || map.width || 0;
            const prevH = map._fitSrcH || map.height || 0;
            map.imageDataUrl = reader.result;
            map.hasImageInIdb = false;
            map.tokens = map.tokens || {};
            map.walls = map.walls || [];
            map.aoe = null;
            map._fitSrcW = null; map._fitSrcH = null; map.scale = null;
            const gs = document.getElementById('map-grid-size');
            if (gs) map.gridSize = Number(gs.value) || 70;
            measureImageDataUrl(reader.result).then((dim) => {
              if (dim) {
                adjustTokensForNewMap(map, prevW, prevH, dim.w, dim.h);
                map.width = dim.w; map.height = dim.h;
              }
              // Cache for paintMapFrame during drag
              try {
                const img = new Image();
                img.onload = () => { window.__mapStaticImg = img; try { paintMapFrame(); } catch (e) {} };
                img.src = reader.result;
                window.__mapStaticImg = img;
              } catch (e) {}
              try { save(); } catch (err) { console.warn(err); }
              try { if (typeof persistMapMediaToIdb === 'function') persistMapMediaToIdb(); } catch (err) {}
              renderBattleMap();
              try { bindMapCanvasInteractions(false); } catch (e) {}
              toast('Map image loaded');
            });
            return;
          };
          reader.onerror = () => toast('Failed to read image');
          reader.readAsDataURL(f);
          el.value = '';
          return;
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
            if (map.videoObjectUrl && String(map.videoObjectUrl).startsWith('blob:')) {
              try { URL.revokeObjectURL(map.videoObjectUrl); } catch (err) {}
            }
            map.videoObjectUrl = null;
            map.mediaType = 'image';
            if (parsed.imageDataUrl) map.imageDataUrl = parsed.imageDataUrl;
            else toast('UVTT has no image — import image separately');
            map.gridSize = parsed.gridSize || 70;
            map.walls = parsed.walls || [];
            map.tokens = map.tokens || {};
            map.aoe = null;
            map._fitSrcW = null; map._fitSrcH = null; map.scale = null;
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
          return;
        }
        if (el.id === 'map-file-video') {
          const f = el.files && el.files[0];
          if (!f) return;
          try {
            ensureCombatWorkspace();
            const map = getCombatMap();
            if (!map) { toast('No workspace — open Map tab first'); return; }
            const mime = f.type || (/\.webm$/i.test(f.name) ? 'video/webm' : 'video/mp4');
            const buf = await f.arrayBuffer();
            const blob = new Blob([buf], { type: mime });
            if (map.videoObjectUrl && String(map.videoObjectUrl).startsWith('blob:')) {
              try { URL.revokeObjectURL(map.videoObjectUrl); } catch (err) {}
            }
            map.videoObjectUrl = URL.createObjectURL(blob);
            map.mediaType = 'video';
            map.imageDataUrl = null;
            map.hasVideoInIdb = true;
            map.tokens = map.tokens || {};
            map.walls = map.walls || [];
            map.aoe = null;
            map._fitSrcW = null; map._fitSrcH = null; map.scale = null;
            try { save(); } catch (err) {}
            try { if (typeof persistMapMediaToIdb === 'function') persistMapMediaToIdb(); } catch (err) {}
            renderBattleMap();
            toast('Video map loaded (looping)');
          } catch (err) {
            console.error(err);
            toast('Video import failed: ' + (err.message || err));
          }
          el.value = '';
        }
      } catch (err) {
        console.error('map media import', err);
        toast('Import failed');
      }
    });
  }


  
  function bindMapMeasureClear() {
    if (window.__mapMeasureClearBound) return;
    window.__mapMeasureClearBound = true;
    const clearMeasures = () => {
      const map = getCombatMap();
      if (!map) return;
      map.aoe = null;
      map.ruler = null;
      window.__rulerDrag = false;
      window.__aoeDrag = null;
      try { save(); } catch (e) {}
      try { if (typeof paintMapFrame === 'function') paintMapFrame(); } catch (e) {}
      try { renderBattleMap(); } catch (e) {}
      toast('AoE / ruler cleared');
    };
    document.getElementById('map-clear-aoe')?.addEventListener('click', clearMeasures);
    document.getElementById('map-token-combatant')?.addEventListener('change', () => {
      try { syncMapTokenSizeSelect(); } catch (e) {}
    });
    document.getElementById('map-token-size')?.addEventListener('change', () => {
      try { applyMapTokenSizeFromSelect(); } catch (e) {}
    });
    document.addEventListener('keydown', (ev) => {
      if (ev.key !== 'Escape') return;
      try {
        const map = getCombatMap();
        if (!map || (!map.ruler && !map.aoe)) return;
        clearMeasures();
      } catch (e) {}
    });
  }

function bindMapCanvasInteractions(force) {
    // Same real-time path as DM main/mapPopout; player only restricted by claim.
    if (window.__simpleMapDragBound && !force) return true;
    window.__simpleMapDragBound = true;

    const getCanvas = () => document.getElementById('map-canvas');
    const worldAt = (ev) => {
      const canvas = getCanvas();
      if (!canvas) return null;
      return mapCanvasToWorld(canvas, ev.clientX, ev.clientY);
    };
    const hitToken = (map, x, y) => {
      const g = Number(map.gridSize) || 70;
      let found = null, best = Infinity;
      Object.keys(map.tokens || {}).forEach((id) => {
        const p = map.tokens[id];
        if (!p) return;
        const cb = typeof findCombatantByTokenId === 'function' ? findCombatantByTokenId(id) : null;
        const sq = typeof combatantTokenSquares === 'function' ? combatantTokenSquares(cb) : 1;
        const hitR = Math.max(g * 0.45 * sq, 16);
        const d = Math.hypot((p.x || 0) - x, (p.y || 0) - y);
        if (d <= hitR && d < best) { found = id; best = d; }
      });
      return found;
    };
    const paintNow = () => {
      try {
        if (typeof paintMapFrame === 'function') paintMapFrame();
        else if (typeof redrawMapLive === 'function') redrawMapLive();
        else if (typeof renderBattleMap === 'function') renderBattleMap();
      } catch (e) {}
    };
    const canDragToken = (id) => {
      if (!(typeof isPlayerRole === 'function' && isPlayerRole())) return true;
      try {
        const claimed = typeof getClaimedCombatant === 'function' ? getClaimedCombatant() : null;
        if (!claimed) {
          try { toast('Claim your character first to move a token'); } catch (e) {}
          return false;
        }
        const tid = String(id || '');
        if (String(claimed.id) === tid || String(claimed.name || '') === tid) return true;
        const combat = typeof getCombat === 'function' ? getCombat(getActive()) : null;
        const list = (combat && combat.combatants) || [];
        const cb = list.find((x, i) => String(x.id) === tid || String(x.name) === tid || String(i) === tid);
        if (cb && (String(cb.id) === String(claimed.id) || String(cb.name) === String(claimed.name))) return true;
        try { toast('You can only move ' + (claimed.name || 'your character')); } catch (e) {}
        return false;
      } catch (e) { return false; }
    };

    const onDown = (ev) => {
      if (ev.button != null && ev.button !== 0) return;
      const canvas = getCanvas();
      if (!canvas) return;
      const tEl = ev.target;
      if (tEl !== canvas && !(tEl && tEl.closest && tEl.closest('#map-canvas-wrap'))) return;
      const rect = canvas.getBoundingClientRect();
      if (ev.clientX < rect.left || ev.clientX > rect.right || ev.clientY < rect.top || ev.clientY > rect.bottom) return;
      const map = getCombatMap();
      if (!map) return;
      const tool = (document.getElementById('map-tool') && document.getElementById('map-tool').value) || 'token';
      const w = worldAt(ev);
      if (!w) return;
      const { x, y } = w;

      if ((tool === 'fog-reveal' || tool === 'fog-hide') && !(typeof isPlayerRole === 'function' && isPlayerRole())) {
        const mode = tool === 'fog-hide' ? 'hide' : 'reveal';
        if (typeof paintFog === 'function') paintFog(map, x, y, mode === 'reveal');
        window.__fogDrag = mode;
        paintNow();
        return;
      }
      if (tool === 'grid-offset') {
        window.__gridDrag = { startX: x, startY: y, ox: Number(map.gridOffsetX) || 0, oy: Number(map.gridOffsetY) || 0 };
        return;
      }
      if (tool === 'ruler') {
        map.ruler = { x1: x, y1: y, x2: x, y2: y };
        window.__rulerDrag = true;
        paintNow();
        return;
      }

      if (tool === 'token' || tool === 'pan' || !tool) {
        const found = hitToken(map, x, y);
        if (found) {
          try { if (typeof selectCombatantById === 'function') selectCombatantById(found); } catch (e) {}
          if (!canDragToken(found)) return;
          if (tool === 'pan' && !ev.shiftKey) return;
          window.__mapDragId = found;
          window.__tokenDragActive = true;
          window.__tokenDragStartedAt = Date.now();
          try { canvas.setPointerCapture(ev.pointerId); } catch (e) {}
          paintNow();
          return;
        }
        if (tool === 'token' && !(typeof isPlayerRole === 'function' && isPlayerRole())) {
          let id = null;
          const sel = document.getElementById('map-token-combatant');
          if (sel && sel.value) id = sel.value;
          if (!id) {
            try {
              const combat = getCombat(getActive());
              const cur = combat && combat.combatants && combat.combatants[combat.selectedIndex];
              if (cur) id = String(cur.id != null ? cur.id : combat.selectedIndex);
            } catch (e) {}
          }
          if (!id) return;
          map.tokens = map.tokens || {};
          map.tokens[id] = (typeof snapWorldToGrid === 'function') ? snapWorldToGrid(map, x, y) : { x, y };
          try { save(); } catch (e) {}
          try { broadcastTokenPositions('place'); } catch (e) {}
          paintNow();
        }
      }
    };

    const onMove = (ev) => {
      const map = getCombatMap();
      if (!map) return;
      const w = worldAt(ev);
      if (!w) return;
      const { x, y } = w;
      if (window.__fogDrag && !(typeof isPlayerRole === 'function' && isPlayerRole())) {
        if (typeof paintFog === 'function') paintFog(map, x, y, window.__fogDrag === 'reveal');
        paintNow();
        return;
      }
      if (window.__gridDrag) {
        const d = window.__gridDrag;
        map.gridOffsetX = d.ox + (x - d.startX);
        map.gridOffsetY = d.oy + (y - d.startY);
        paintNow();
        return;
      }
      if (window.__rulerDrag && map.ruler) {
        map.ruler.x2 = x; map.ruler.y2 = y;
        paintNow();
        return;
      }
      if (!window.__mapDragId) return;
      map.tokens = map.tokens || {};
      const pos = (typeof snapWorldToGrid === 'function') ? snapWorldToGrid(map, x, y) : { x, y };
      map.tokens[window.__mapDragId] = pos;
      // Normalize: also write under combatant id/name so draw/hit/sync share one position
      try {
        const combat = typeof getCombat === 'function' ? getCombat(getActive()) : null;
        const list = (combat && combat.combatants) || [];
        const tid = String(window.__mapDragId);
        const cb = list.find((x, i) => String(x.id) === tid || String(x.name) === tid || String(i) === tid);
        if (cb) {
          const keys = typeof tokenKeysForCombatant === 'function' ? tokenKeysForCombatant(cb, list.indexOf(cb)) : [tid];
          keys.forEach(k => { map.tokens[k] = pos; });
        }
      } catch (e) {}
      paintNow();
      const now = Date.now();
      if (!window.__lastTokenDragBc || now - window.__lastTokenDragBc > 40) {
        window.__lastTokenDragBc = now;
        // Identical to DM windows: broadcast live (includes player)
        try { broadcastTokenPositions('drag'); } catch (e) {}
      }
    };

    const onUp = (ev) => {
      const had = window.__mapDragId || window.__fogDrag || window.__gridDrag || window.__rulerDrag;
      window.__mapDragId = null;
      window.__tokenDragActive = false;
      window.__fogDrag = null;
      window.__gridDrag = null;
      window.__rulerDrag = false;
      if (had) {
        // Tokens first (works for player — does not depend on player save())
        try { broadcastTokenPositions('up'); } catch (e) {}
        try { save(); } catch (e) {}
        paintNow();
      }
    };

    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('pointermove', onMove, true);
    document.addEventListener('pointerup', onUp, true);
    document.addEventListener('pointercancel', onUp, true);
    const canvas = getCanvas();
    if (canvas) {
      canvas.style.pointerEvents = 'auto';
      canvas.style.zIndex = '10';
    }
    return true;
  }

  
  function bindTokenImageControls() {
    if (!window.__tokenImageDocBound) {
      window.__tokenImageDocBound = true;
      document.addEventListener('change', async (ev) => {
        const el = ev.target;
        if (!el || el.id !== 'map-file-token') return;
        const file = el.files && el.files[0];
        el.value = '';
        if (!file) return;
        try {
          const c = getActive();
          const combat = c ? getCombat(c) : null;
          let cb = null;
          if (combat && combat.selectedIndex != null) cb = combat.combatants[combat.selectedIndex];
          if (!cb && combat && combat.turnIndex != null) cb = combat.combatants[combat.turnIndex];
          if (!cb) {
            const sel = document.getElementById('map-token-combatant');
            if (sel && sel.value && combat) {
              cb = (combat.combatants || []).find(x => String(x.id) === String(sel.value));
            }
          }
          if (!cb) { toast('Select a combatant first (Combat list or Token for dropdown)'); return; }
          if (typeof window.setTokenImageFromFile !== "function") { toast("Token image API missing — hard refresh"); return; }
          await window.setTokenImageFromFile(file, cb);
        } catch (err) {
          console.error(err);
          toast('Token import failed: ' + (err && err.message ? err.message : err));
        }
      }, true);
    }
    const inp = document.getElementById('map-file-token');
    if (inp && inp.dataset.cyberBound !== '2') {
      inp.dataset.cyberBound = '2';
      inp.addEventListener('change', async (ev) => {
        const file = ev.target.files && ev.target.files[0];
        ev.target.value = '';
        if (!file) return;
        try {
          const c = getActive();
          const combat = c ? getCombat(c) : null;
          let cb = null;
          if (combat && combat.selectedIndex != null) cb = combat.combatants[combat.selectedIndex];
          if (!cb && combat && combat.turnIndex != null) cb = combat.combatants[combat.turnIndex];
          if (!cb) {
            const sel = document.getElementById('map-token-combatant');
            if (sel && sel.value && combat) {
              cb = (combat.combatants || []).find(x => String(x.id) === String(sel.value));
            }
          }
          if (!cb) { toast('Select a combatant in Combat or Map list first'); return; }
          if (typeof window.setTokenImageFromFile !== "function") { toast("Token image API missing — hard refresh"); return; }
          await window.setTokenImageFromFile(file, cb);
        } catch (err) {
          console.error(err);
          toast('Token import failed: ' + (err && err.message ? err.message : err));
        }
      });
    }
    ['map-token-clear-btn'].forEach(cid => {
    const clr = document.getElementById(cid);
    if (clr && clr.dataset.cyberBound !== '2') {
      clr.dataset.cyberBound = '2';
      clr.addEventListener('click', () => {
        try {
          const c = getActive();
          const combat = c ? getCombat(c) : null;
          let cb = null;
          if (combat && combat.selectedIndex != null) cb = combat.combatants[combat.selectedIndex];
          if (!cb) { toast('Select a combatant first'); return; }
          if (typeof window.clearTokenImage === "function") window.clearTokenImage(cb); else if (typeof clearTokenImage === "function") clearTokenImage(cb);
        } catch (e) { console.error(e); }
      });
    }
    });
  }


  function initBattleMapUi() {
    // Always ensure workspace exists
    try { ensureCombatWorkspace(); } catch (e) {}
    try { refreshMapTokenSelect(); } catch (e) {}
    try { bindMapMediaInputs(); } catch (e) { console.error(e); }
    try { bindTokenImageControls(); } catch (e) { console.error(e); }
    try { bindMapCanvasInteractions(false); } catch (e) { console.error(e); }
    try { bindMapMeasureClear(); } catch (e) {}

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
    if (!window.__mapUiControlsBound) {
    window.__mapUiControlsBound = true;
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
      // Stop video draw loop
      try {
        if (window.__mapRaf) { cancelAnimationFrame(window.__mapRaf); window.__mapRaf = null; }
      } catch (e) {}
      window.__mapVideoTicking = false;
      window.__mapVideoSrc = null;
      map.imageDataUrl = null;
      if (map.videoObjectUrl && String(map.videoObjectUrl).startsWith('blob:')) {
        try { URL.revokeObjectURL(map.videoObjectUrl); } catch (e) {}
      }
      map.videoObjectUrl = null;
      map.mediaType = null;
      map.hasVideoInIdb = false;
      map.hasImageInIdb = false;
      map._fitSrcW = null;
      map._fitSrcH = null;
      map.scale = null;
      map.walls = [];
      map.tokens = {};
      map.aoe = null;
      map.fogRevealed = {};
      map.fogEnabled = false;
      // Reset video element
      const videoEl = document.getElementById('map-video');
      if (videoEl) {
        try { videoEl.pause(); } catch (e) {}
        try { videoEl.removeAttribute('src'); videoEl.removeAttribute('data-src'); videoEl.load(); } catch (e) {}
      }
      // Drop IDB media for this workspace
      try {
        const c = getActive();
        if (c && c.id) {
          idbSetMapVideo(c.id, null).catch(() => {});
          // best-effort: also clear image key if helper exists
          if (typeof idbSetMapImage === 'function') idbSetMapImage(c.id, null).catch(() => {});
        }
      } catch (e) {}
      try { save(); } catch (err) {}
      try { broadcastVttState('map-clear'); } catch (e) {}
      renderBattleMap();
      toast('Map cleared');
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
      const v = tool && tool.value;
      if (v === 'fog-reveal') {
        window.__mapFogTool = 'reveal';
        toast('Fog Reveal — click or drag on the map');
      } else if (v === 'fog-hide') {
        window.__mapFogTool = 'hide';
        toast('Fog Hide — click or drag on the map');
      } else {
        window.__mapFogTool = null;
      }
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

    (function bindTokenImageInput() {
      const inp = document.getElementById('map-file-token');
      if (!inp || inp.dataset.bound === '1') return;
      inp.dataset.bound = '1';
      inp.addEventListener('change', async (ev) => {
        const file = ev.target.files && ev.target.files[0];
        ev.target.value = '';
        if (!file) return;
        try {
          const c = getActive();
          const combat = c ? getCombat(c) : null;
          let cb = null;
          if (combat && combat.selectedIndex != null) cb = combat.combatants[combat.selectedIndex];
          if (!cb && combat && combat.turnIndex != null) cb = combat.combatants[combat.turnIndex];
          // Also try map token select
          if (!cb) {
            const sel = document.getElementById('map-token-combatant');
            if (sel && sel.value && combat) {
              cb = (combat.combatants || []).find(x => String(x.id) === String(sel.value));
            }
          }
          if (!cb) { toast('Select a combatant in the list first'); return; }
          if (typeof window.setTokenImageFromFile !== "function") { toast("Token image API missing — hard refresh"); return; }
          await window.setTokenImageFromFile(file, cb);
        } catch (e) {
          console.error(e);
          toast('Token import failed: ' + (e && e.message ? e.message : e));
        }
      });
    })();
    (function bindTokenClear() {
      const btn = document.getElementById('map-token-clear-btn');
      if (!btn || btn.dataset.bound === '1') return;
      btn.dataset.bound = '1';
      btn.addEventListener('click', () => {
        try {
          const c = getActive();
          const combat = c ? getCombat(c) : null;
          let cb = null;
          if (combat && combat.selectedIndex != null) cb = combat.combatants[combat.selectedIndex];
          if (!cb && combat && combat.turnIndex != null) cb = combat.combatants[combat.turnIndex];
          if (!cb) { toast('Select a combatant first'); return; }
          if (typeof window.clearTokenImage === "function") window.clearTokenImage(cb); else if (typeof clearTokenImage === "function") clearTokenImage(cb);
        } catch (e) { console.error(e); }
      });
    })();
getElementById('map-clear-aoe')?.addEventListener('click', () => {
      const map = getCombatMap();
      if (!map) return;
      map.aoe = null;
      map.ruler = null;
      window.__rulerDrag = false;
      window.__aoeDrag = null;
      try { save(); } catch (err) {}
      try { if (typeof paintMapFrame === 'function') paintMapFrame(); } catch (e) {}
      try { renderBattleMap(); } catch (e) {}
      toast('AoE / ruler cleared');
    });
    if (!window.__mapMeasureEscBound) {
      window.__mapMeasureEscBound = true;
      document.addEventListener('keydown', (ev) => {
        if (ev.key !== 'Escape') return;
        try {
          const map = getCombatMap();
          if (!map) return;
          if (!map.ruler && !map.aoe) return;
          map.ruler = null;
          map.aoe = null;
          window.__rulerDrag = false;
          window.__aoeDrag = null;
          try { save(); } catch (e) {}
          try { if (typeof paintMapFrame === 'function') paintMapFrame(); } catch (e) {}
          try { renderBattleMap(); } catch (e) {}
          toast('AoE / ruler cleared');
        } catch (e) {}
      });
    }
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


    if (false && !window.__mapFileChangeBound) {
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
        }

        if (el.id === 'map-file-video') {
          const f = el.files && el.files[0];
          if (!f) return;
          try {
            ensureCombatWorkspace();
            let c = getActive();
            if (!c) c = ensureCombatWorkspace() || getActive();
            const map = getCombatMap();
            if (!map) { toast('No workspace — open Map tab first'); return; }
            const mime = f.type || (/\.webm$/i.test(f.name) ? 'video/webm' : 'video/mp4');
            const buf = await f.arrayBuffer();
            const blob = new Blob([buf], { type: mime });
            if (map.videoObjectUrl && String(map.videoObjectUrl).startsWith('blob:')) {
              try { URL.revokeObjectURL(map.videoObjectUrl); } catch (e) {}
            }
            // Blob URL first so playback works even if IDB fails
            map.videoObjectUrl = URL.createObjectURL(blob);
            map.mediaType = 'video';
            map.imageDataUrl = null;
            map.aoe = null;
            map.videoName = f.name || 'map-video';
            map.hasVideoInIdb = false;
            map._fitSrcW = null;
            map._fitSrcH = null;
            map.scale = null;
            window.__mapVideoTicking = false;
            window.__mapVideoSrc = null;
            if (c && c.id) {
              try {
                await idbSetMapVideo(c.id, blob);
                map.hasVideoInIdb = true;
              } catch (e) {
                console.warn('video IDB', e);
              }
            }
            try { save(); } catch (e) {}
            // Reset video element so new src always reloads
            const videoEl = document.getElementById('map-video');
            if (videoEl) {
              try { videoEl.pause(); } catch (e) {}
              videoEl.removeAttribute('data-src');
              videoEl.removeAttribute('src');
              try { videoEl.load(); } catch (e) {}
            }
            renderBattleMap();
            toast('Video map loaded — loops muted (' + (f.name || mime) + ')');
          } catch (err) {
            console.warn(err);
            toast('Could not load video: ' + (err && err.message ? err.message : err));
          }
          el.value = '';
        }
      });
    }

    
  
  
  const TOKEN_IMG_KEY = 'cybervlachos_token_images_v1';
  function loadTokenImageStore() {
    try { return JSON.parse(localStorage.getItem(TOKEN_IMG_KEY) || '{}') || {}; } catch (e) { return {}; }
  }
  function saveTokenImageStore(store) {
    try { localStorage.setItem(TOKEN_IMG_KEY, JSON.stringify(store)); return true; }
    catch (e) {
      try {
        // Store only this id if full dump fails
        return false;
      } catch (e2) { return false; }
    }
  }
  function tokenImageKey(cb) {
    return String(cb && (cb.id != null ? cb.id : cb.name) || '');
  }

  const __tokenImgCache = {};
  function getTokenImageForCombatant(cb) {
    if (!cb) return null;
    let src = cb.tokenImage || cb.tokenImg || cb.avatar || cb.portrait || '';
    if (!src) {
      try {
        const store = loadTokenImageStore();
        const k = tokenImageKey(cb);
        if (k && store[k]) {
          src = store[k];
          cb.tokenImage = src;
        }
      } catch (e) {}
    }
    if (!src || typeof src !== 'string') return null;
    if (__tokenImgCache[src] === false) return null;
    if (__tokenImgCache[src] && __tokenImgCache[src].complete) return __tokenImgCache[src];
    if (!__tokenImgCache[src]) {
      const img = new Image();
      img.onload = () => { try { renderBattleMap(); } catch (e) {} };
      img.onerror = () => { __tokenImgCache[src] = false; };
      img.src = src;
      __tokenImgCache[src] = img;
    }
    return __tokenImgCache[src].complete ? __tokenImgCache[src] : null;
  }

  async function setTokenImageFromFile(file, cb) {
    if (!file || !cb) return;
    if (!/^image\//i.test(file.type || '')) {
      toast('Choose an image file (png, jpg, webp, …)');
      return;
    }
    // Prefer object URL + dataURL for persistence
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    // Mild size guard (~1.5MB data URL)
    if (String(dataUrl).length > 1.8e6) {
      toast('Image too large — try a smaller token (under ~1MB)');
      return;
    }
    cb.tokenImage = dataUrl;
    try {
      const store = loadTokenImageStore();
      store[tokenImageKey(cb)] = dataUrl;
      if (!saveTokenImageStore(store)) {
        // fallback: keep on combatant only
        toast('Saved on combatant (storage nearly full)');
      }
    } catch (e) {}
    try { save(); } catch (e) {}
    try {
      delete __tokenImgCache[dataUrl];
      getTokenImageForCombatant(cb);
    } catch (e) {}
    try { renderBattleMap(); } catch (e) {}
    try { if (typeof paintMapFrame === 'function') paintMapFrame(); } catch (e) {}
    try { renderCombat(); } catch (e) {}
    toast('Token image set for ' + (cb.name || 'combatant'));
  }

  function clearTokenImage(cb) {
    if (!cb) return;
    const k = tokenImageKey(cb);
    delete cb.tokenImage;
    delete cb.tokenImg;
    try {
      const store = loadTokenImageStore();
      if (k && store[k]) { delete store[k]; saveTokenImageStore(store); }
    } catch (e) {}
    try { save(); } catch (e) {}
    try { renderBattleMap(); } catch (e) {}
    toast('Token image cleared');
  }

  // Expose for map UI handlers (avoid scope issues across reloads / nested binds)
  try {
    window.setTokenImageFromFile = setTokenImageFromFile;
    window.clearTokenImage = clearTokenImage;
    window.getTokenImageForCombatant = getTokenImageForCombatant;
    window.bindMapCanvasInteractions = bindMapCanvasInteractions;
    window.broadcastTokenPositions = broadcastTokenPositions;
  } catch (e) {}

function paintMapFrame() {
    try {
      const map = getCombatMap();
      const canvas = document.getElementById('map-canvas');
      if (!map || !canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const scale = map.scale || 1;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (map.mediaType === 'video') {
        const videoEl = document.getElementById('map-video');
        if (videoEl && videoEl.videoWidth) {
          try { ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height); } catch (e) {}
        } else {
          ctx.fillStyle = '#1a1a22';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
      } else if (map.imageDataUrl) {
        if (!window.__mapStaticImg || window.__mapStaticImgSrc !== map.imageDataUrl) {
          const im = new Image();
          im.onload = () => { window.__mapStaticImg = im; window.__mapStaticImgSrc = map.imageDataUrl; try { paintMapFrame(); } catch (e) {} };
          im.src = map.imageDataUrl;
          window.__mapStaticImg = im;
          window.__mapStaticImgSrc = map.imageDataUrl;
        }
        if (window.__mapStaticImg && window.__mapStaticImg.complete && window.__mapStaticImg.naturalWidth) {
          try { ctx.drawImage(window.__mapStaticImg, 0, 0, canvas.width, canvas.height); } catch (e) {}
        } else {
          ctx.fillStyle = '#1a1a22';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
      } else {
        ctx.fillStyle = '#1a1a22';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      try {
        if (window.__drawMapOverlays) window.__drawMapOverlays(ctx, canvas, map, scale);
        else drawMapOverlays(ctx, canvas, map, scale);
      } catch (e) {}
    } catch (e) {
      console.warn('paintMapFrame', e);
    }
  }

  function redrawMapLive() {
    try {
      const map = getCombatMap();
      if (!map) return;
      // Always fast-path paint (tokens must move under cursor on main + popouts)
      if (typeof paintMapFrame === 'function') {
        paintMapFrame();
        return;
      }
      renderBattleMap();
    } catch (e) {
      try { renderBattleMap(); } catch (e2) {}
    }
  }

// end one-time control wiring
    }

    
    // Canvas interactions: only via bindMapCanvasInteractions (no legacy dual-bind)
    try { bindMapCanvasInteractions(false); } catch (e) { console.error(e); }
    try { bindMapMeasureClear(); } catch (e) {}
    try { bindTokenImageControls(); } catch (e) { console.error(e); }
    try { bindMapMediaInputs(); } catch (e) { console.error(e); }
  }

  if (document.readyState === 'loading') {
    try { const ve = document.getElementById('app-version'); if (ve && typeof APP_VERSION !== 'undefined') ve.textContent = 'v' + APP_VERSION; } catch (e) {}
  document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

  try { window.importCompendiumPack = importCompendiumPack; } catch (e) {}
