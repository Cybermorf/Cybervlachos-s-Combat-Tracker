// Dark Sun Chronicles — PHB reference data for character creation
// Standard 5e skills/classes + DSC signature classes + Umbralites race (Player's Handbook)

window.PHB_SKILLS = [
  { name: 'Acrobatics', ability: 'DEX', desc: 'Stay on your feet in tricky situations, perform stunts, tumble, and keep balance.' },
  { name: 'Animal Handling', ability: 'WIS', desc: 'Calm, train, or control animals, and read an animal’s intentions.' },
  { name: 'Arcana', ability: 'INT', desc: 'Recall lore about spells, magic items, planar lore, symbols, and magical traditions.' },
  { name: 'Athletics', ability: 'STR', desc: 'Climb, jump, swim, grapple, and other feats of raw physical power.' },
  { name: 'Deception', ability: 'CHA', desc: 'Convincingly hide the truth through lies, misdirection, or false appearances.' },
  { name: 'History', ability: 'INT', desc: 'Recall historical events, legends, wars, peoples, and lost civilizations of Eldoria.' },
  { name: 'Insight', ability: 'WIS', desc: 'Determine true intentions, read body language, and sense motives.' },
  { name: 'Intimidation', ability: 'CHA', desc: 'Influence others through threats, hostile actions, and physical presence.' },
  { name: 'Investigation', ability: 'INT', desc: 'Search for clues, deduce from evidence, and piece together hidden information.' },
  { name: 'Medicine', ability: 'WIS', desc: 'Stabilize the dying, diagnose illness, and treat injuries in the field.' },
  { name: 'Nature', ability: 'INT', desc: 'Recall lore about terrain, plants, animals, weather, and natural cycles.' },
  { name: 'Perception', ability: 'WIS', desc: 'Spot, hear, or otherwise detect the presence of something; general awareness.' },
  { name: 'Performance', ability: 'CHA', desc: 'Entertain through music, dance, acting, storytelling, or similar.' },
  { name: 'Persuasion', ability: 'CHA', desc: 'Influence with tact, social grace, good nature, or negotiation.' },
  { name: 'Religion', ability: 'INT', desc: 'Recall lore about deities, rites, prayers, religious hierarchies, and cults.' },
  { name: 'Sleight of Hand', ability: 'DEX', desc: 'Pick pockets, plant objects, conceal items, and perform manual tricks.' },
  { name: 'Stealth', ability: 'DEX', desc: 'Conceal yourself from enemies, slip past guards, and move unseen or unheard.' },
  { name: 'Survival', ability: 'WIS', desc: 'Follow tracks, hunt game, guide a group through wilderness, and avoid natural hazards.' }
];

// Proficiency bonus by level (5e)
window.PHB_PROF_BY_LEVEL = [null,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,6,6,6,6];

window.PHB_CLASSES = [
  {
    name: 'Barbarian', hitDie: 'd12', primary: 'STR', saves: 'STR, CON',
    armor: 'Light, medium, shields', weapons: 'Simple, martial',
    skillsChoose: 2, skills: ['Animal Handling','Athletics','Intimidation','Nature','Perception','Survival'],
    summary: 'Primal warrior who channels rage into unmatched combat ferocity.',
    progression: [
      [1,'Rage, Unarmored Defense'],[2,'Reckless Attack, Danger Sense'],[3,'Primal Path'],[4,'ASI'],
      [5,'Extra Attack, Fast Movement'],[7,'Feral Instinct'],[9,'Brutal Critical (1 die)'],[11,'Relentless Rage'],
      [15,'Persistent Rage'],[18,'Indomitable Might'],[20,'Primal Champion']
    ]
  },
  {
    name: 'Bard', hitDie: 'd8', primary: 'CHA', saves: 'DEX, CHA',
    armor: 'Light', weapons: 'Simple, hand crossbows, longswords, rapiers, shortswords',
    skillsChoose: 3, skills: 'Any',
    summary: 'Master of song, speech, and magic who inspires allies and confounds foes.',
    progression: [
      [1,'Spellcasting, Bardic Inspiration (d6)'],[2,'Jack of All Trades, Song of Rest'],[3,'Bard College, Expertise'],
      [4,'ASI'],[5,'Font of Inspiration, Bardic Inspiration (d8)'],[6,'Countercharm, College feature'],
      [10,'Magical Secrets, Expertise, Bardic Inspiration (d10)'],[14,'Magical Secrets'],[20,'Superior Inspiration']
    ]
  },
  {
    name: 'Cleric', hitDie: 'd8', primary: 'WIS', saves: 'WIS, CHA',
    armor: 'Light, medium, shields', weapons: 'Simple',
    skillsChoose: 2, skills: ['History','Insight','Medicine','Persuasion','Religion'],
    summary: 'Divine agent channeling the power of a god, philosophy, or cosmic force.',
    progression: [
      [1,'Spellcasting, Divine Domain'],[2,'Channel Divinity, Domain feature'],[4,'ASI'],
      [5,'Destroy Undead (CR 1/2)'],[6,'Domain feature'],[8,'ASI, Destroy Undead (CR 1), Domain feature'],
      [10,'Divine Intervention'],[17,'Domain feature'],[20,'Divine Intervention improvement']
    ]
  },
  {
    name: 'Druid', hitDie: 'd8', primary: 'WIS', saves: 'INT, WIS',
    armor: 'Light, medium, shields (nonmetal)', weapons: 'Clubs, daggers, darts, javelins, maces, quarterstaffs, scimitars, sickles, slings, spears',
    skillsChoose: 2, skills: ['Arcana','Animal Handling','Insight','Medicine','Nature','Perception','Religion','Survival'],
    summary: 'Keeper of the old ways who draws power from nature and wild shapes.',
    progression: [
      [1,'Druidic, Spellcasting'],[2,'Wild Shape, Druid Circle'],[4,'ASI, Wild Shape improvement'],
      [6,'Circle feature'],[8,'ASI, Wild Shape improvement'],[10,'Circle feature'],
      [14,'Circle feature'],[18,'Timeless Body, Beast Spells'],[20,'Archdruid']
    ]
  },
  {
    name: 'Fighter', hitDie: 'd10', primary: 'STR or DEX', saves: 'STR, CON',
    armor: 'All armor, shields', weapons: 'Simple, martial',
    skillsChoose: 2, skills: ['Acrobatics','Animal Handling','Athletics','History','Insight','Intimidation','Perception','Survival'],
    summary: 'Versatile martial expert defined by training, tactics, and weapon mastery.',
    progression: [
      [1,'Fighting Style, Second Wind'],[2,'Action Surge'],[3,'Martial Archetype'],[4,'ASI'],
      [5,'Extra Attack'],[6,'ASI'],[9,'Indomitable'],[11,'Extra Attack (2)'],[13,'Indomitable (2)'],
      [15,'Archetype feature'],[17,'Action Surge (2), Indomitable (3)'],[20,'Extra Attack (3)']
    ]
  },
  {
    name: 'Monk', hitDie: 'd8', primary: 'DEX & WIS', saves: 'STR, DEX',
    armor: 'None', weapons: 'Simple, shortswords',
    skillsChoose: 2, skills: ['Acrobatics','Athletics','History','Insight','Religion','Stealth'],
    summary: 'Martial artist who turns body and ki into weapons and defenses.',
    progression: [
      [1,'Unarmored Defense, Martial Arts'],[2,'Ki, Unarmored Movement'],[3,'Monastic Tradition, Deflect Missiles'],
      [4,'ASI, Slow Fall'],[5,'Extra Attack, Stunning Strike'],[6,'Ki-Empowered Strikes, Tradition feature'],
      [7,'Evasion, Stillness of Mind'],[10,'Purity of Body'],[14,'Diamond Soul'],[18,'Empty Body'],[20,'Perfect Self']
    ]
  },
  {
    name: 'Paladin', hitDie: 'd10', primary: 'STR & CHA', saves: 'WIS, CHA',
    armor: 'All armor, shields', weapons: 'Simple, martial',
    skillsChoose: 2, skills: ['Athletics','Insight','Intimidation','Medicine','Persuasion','Religion'],
    summary: 'Oath-bound warrior channeling divine power through martial skill.',
    progression: [
      [1,'Divine Sense, Lay on Hands'],[2,'Fighting Style, Spellcasting, Divine Smite'],[3,'Sacred Oath, Divine Health'],
      [4,'ASI'],[5,'Extra Attack'],[6,'Aura of Protection'],[10,'Aura of Courage'],[11,'Improved Divine Smite'],
      [14,'Cleansing Touch'],[20,'Oath feature']
    ]
  },
  {
    name: 'Ranger', hitDie: 'd10', primary: 'DEX & WIS', saves: 'STR, DEX',
    armor: 'Light, medium, shields', weapons: 'Simple, martial',
    skillsChoose: 3, skills: ['Animal Handling','Athletics','Insight','Investigation','Nature','Perception','Stealth','Survival'],
    summary: 'Hunter and wanderer at home in the wilds between the Seven Worlds.',
    progression: [
      [1,'Favored Enemy, Natural Explorer'],[2,'Fighting Style, Spellcasting'],[3,'Ranger Archetype, Primeval Awareness'],
      [4,'ASI'],[5,'Extra Attack'],[8,'ASI, Land’s Stride'],[10,'Hide in Plain Sight'],[14,'Vanish'],
      [18,'Feral Senses'],[20,'Foe Slayer']
    ]
  },
  {
    name: 'Rogue', hitDie: 'd8', primary: 'DEX', saves: 'DEX, INT',
    armor: 'Light', weapons: 'Simple, hand crossbows, longswords, rapiers, shortswords',
    skillsChoose: 4, skills: ['Acrobatics','Athletics','Deception','Insight','Intimidation','Investigation','Perception','Performance','Persuasion','Sleight of Hand','Stealth'],
    tools: 'Thieves’ tools',
    summary: 'Expert in stealth, precision strikes, and skilled problem-solving.',
    progression: [
      [1,'Expertise, Sneak Attack, Thieves’ Cant'],[2,'Cunning Action'],[3,'Roguish Archetype'],[4,'ASI'],
      [5,'Uncanny Dodge'],[6,'Expertise'],[7,'Evasion'],[11,'Reliable Talent'],[14,'Blind Sense'],
      [15,'Slippery Mind'],[18,'Elusive'],[20,'Stroke of Luck']
    ]
  },
  {
    name: 'Sorcerer', hitDie: 'd6', primary: 'CHA', saves: 'CON, CHA',
    armor: 'None', weapons: 'Daggers, darts, slings, quarterstaffs, light crossbows',
    skillsChoose: 2, skills: ['Arcana','Deception','Insight','Intimidation','Persuasion','Religion'],
    summary: 'Innate spellcaster whose power flows from bloodline, fate, or cosmic accident.',
    progression: [
      [1,'Spellcasting, Sorcerous Origin'],[2,'Font of Magic'],[3,'Metamagic'],[4,'ASI'],
      [5,'—'],[6,'Origin feature'],[10,'Metamagic'],[14,'Origin feature'],[17,'Metamagic'],
      [18,'Origin feature'],[20,'Sorcerous Restoration']
    ]
  },
  {
    name: 'Warlock', hitDie: 'd8', primary: 'CHA', saves: 'WIS, CHA',
    armor: 'Light', weapons: 'Simple',
    skillsChoose: 2, skills: ['Arcana','Deception','History','Intimidation','Investigation','Nature','Religion'],
    summary: 'Pact-bound caster drawing power from a patron beyond mortal ken.',
    progression: [
      [1,'Otherworldly Patron, Pact Magic'],[2,'Eldritch Invocations'],[3,'Pact Boon'],[4,'ASI'],
      [5,'—'],[6,'Patron feature'],[11,'Mystic Arcanum (6th)'],[12,'ASI'],
      [13,'Mystic Arcanum (7th)'],[15,'Mystic Arcanum (8th)'],[17,'Mystic Arcanum (9th)'],[20,'Eldritch Master']
    ]
  },
  {
    name: 'Wizard', hitDie: 'd6', primary: 'INT', saves: 'INT, WIS',
    armor: 'None', weapons: 'Daggers, darts, slings, quarterstaffs, light crossbows',
    skillsChoose: 2, skills: ['Arcana','History','Insight','Investigation','Medicine','Religion'],
    summary: 'Scholar of arcane traditions who prepares spells from a growing grimoire.',
    progression: [
      [1,'Spellcasting, Arcane Recovery'],[2,'Arcane Tradition'],[4,'ASI'],[6,'Tradition feature'],
      [10,'Tradition feature'],[14,'Tradition feature'],[18,'Spell Mastery'],[20,'Signature Spells']
    ]
  },
  // ── DSC signature classes (Player's Handbook Ch. 6) ──────────────────────
  {
    name: 'Moon Guardian', hitDie: 'd10', primary: 'WIS', saves: 'WIS, CHA',
    armor: 'Light, medium, shields', weapons: 'Simple, martial',
    skillsChoose: 2, skills: ['Athletics','Insight','Medicine','Perception','Religion','Survival'],
    summary: 'Celestial half-caster chosen by Luna. Uses Lunar Charges and Moon Paths tied to the Seven Worlds. See PHB Table B-11 for full progression.',
    setting: true,
    progression: [
      [1,'Lunar Bond, Moonlight Infusion, Martial Training'],[2,'Spellcasting (WIS half-caster), Lunar Charges'],
      [3,'Moon Path (Path of Luminaris / Umbraria / …)'],[4,'ASI'],[5,'Extra Attack'],
      [6,'Path feature'],[10,'Improved Lunar Charges'],[11,'Path feature (e.g. Luminous Form)'],
      [15,'Path feature'],[18,'Lunar Mastery'],[20,'Avatar of Luna']
    ]
  },
  {
    name: 'Bloodhunter', hitDie: 'd10', primary: 'STR or DEX & CON', saves: 'DEX, CON',
    armor: 'Light, medium, shields', weapons: 'Simple, martial',
    skillsChoose: 3, skills: ['Athletics','Insight','Intimidation','Medicine','Perception','Survival'],
    summary: 'Hemomantic hunter who sacrifices own vitality for Blood Rites, Crimson rites, and path features (Order / Vitality / Ruin).',
    setting: true,
    progression: [
      [1,'Hunter’s Bane, Blood Maledict'],[2,'Fighting Style'],[3,'Bloodhunter Path, Blood Rite'],
      [4,'ASI'],[5,'Extra Attack'],[6,'Brand of Castigation'],[10,'Dark Augmentation'],
      [11,'Path feature'],[14,'Hardened Soul'],[18,'Path feature'],[20,'Path capstone (e.g. Crimson Apotheosis)']
    ]
  },
  {
    name: 'Ghostblade', hitDie: 'd8', primary: 'DEX & WIS', saves: 'DEX, WIS',
    armor: 'None (spectral defense)', weapons: 'Simple, shortswords; spectral weapons via class features',
    skillsChoose: 2, skills: ['Acrobatics','Athletics','Insight','Perception','Religion','Stealth'],
    summary: 'Umbrarian spectral martial tradition. Channels ethereal weapons and spirit techniques rather than living shadow.',
    setting: true,
    progression: [
      [1,'Spectral Armament, Ethereal Sense'],[2,'Spirit Step'],[3,'Ghostblade Discipline'],
      [4,'ASI'],[5,'Extra Attack'],[6,'Phase Strike'],[9,'Spirit Ward'],
      [11,'Discipline feature'],[14,'Ghostwalk'],[17,'Discipline feature'],[20,'Spectral Mastery']
    ]
  },
  {
    name: 'Shadowblade', hitDie: 'd8', primary: 'DEX', saves: 'DEX, CHA',
    armor: 'Light', weapons: 'Simple, hand crossbows, longswords, rapiers, shortswords',
    skillsChoose: 4, skills: ['Acrobatics','Deception','Insight','Intimidation','Investigation','Perception','Sleight of Hand','Stealth'],
    tools: 'Thieves’ tools',
    summary: 'Covert striker of living shadow—concealment, misdirection, and umbral bursts. Associated with Umbraria (Nightstalkers, Syndicate) but not exclusive.',
    setting: true,
    progression: [
      [1,'Expertise, Shadow Strike, Umbral Veil'],[2,'Cunning Action'],[3,'Shadow Tradition'],
      [4,'ASI'],[5,'Uncanny Dodge'],[6,'Expertise'],[7,'Evasion'],[9,'Shadow Step (class)'],
      [11,'Reliable Talent'],[14,'Shadow Form'],[17,'Tradition feature'],[20,'Living Night']
    ]
  }
];

window.PHB_RACES = [
  {
    "id": "luminari",
    "name": "Luminari",
    "world": "Luminaris",
    "tagline": "Children of Living Light",
    "short": "Radiant people of Luminaris; luminous markings and long memory of scholarship and corroboration.",
    "intro": "The Luminari are the people most closely associated with Luminaris, the radiant world nearest to Luna. Their bodies carry a visible trace of the magical energies that permeate their ancestral home.",
    "appearance": "Luminari typically have graceful builds and skin that carries a soft inner glow or luminous markings. Hair and eyes often show pale gold, silver, crystal white, or living color reminiscent of bioluminescent meadows.",
    "lifeSpan": "Luminari mature slowly, reaching adulthood at roughly one hundred years and often living for about a millennium.",
    "culture": "Traditional Luminari culture values knowledge, magical study, artistic expression, natural harmony, and stewardship. Academies, libraries, and sanctuaries preserve knowledge across generations. Luminari disagree sharply over how dangerous knowledge should be controlled.",
    "beliefs": "Many Luminari revere Luna. A common teaching states: “Light reveals the path. Wisdom decides whether it should be followed.” Light can heal—or blind and expose.",
    "names": "Aurelia, Selene, Seraphina, Lyra, Elara, Caelion, Erevan, Lucien, Orion, Solenar, Aelion, Vaelis. Epithets: Sunweaver, Starwhisper, Moonshadow, Everglow, Lightweaver, Dawnspire, Crystalborn.",
    "adventurers": "Scholars, guardians, healers, diplomats, pilgrims, explorers, or exiles seeking knowledge beyond Luminaris’s libraries.",
    "bonuses": {"int": 2, "wis": 1},
    "size": "Medium",
    "speed": 30,
    "source": "DSC",
    "traits": [
      {
        "name": "Creature Type",
        "text": "Humanoid."
      },
      {
        "name": "Size",
        "text": "Medium. Luminari are typically 5 to 6 feet tall."
      },
      {
        "name": "Speed",
        "text": "30 feet."
      },
      {
        "name": "Life Span",
        "text": "You reach adulthood around 100 years and can live for roughly 1,000 years."
      },
      {
        "name": "Darkvision",
        "text": "You have Darkvision out to 60 feet."
      },
      {
        "name": "Radiant Resistance",
        "text": "You have Resistance to Radiant damage."
      },
      {
        "name": "Luminous Markings",
        "text": "Your markings shed dim light in a 5-foot radius, or you can suppress this light (no action required)."
      },
      {
        "name": "Languages",
        "text": "You can speak, read, and write Common and Luminari."
      }
    ],
    "questions": [
      "What truth are you determined to uncover, even if elders think it should remain unanswered?",
      "What do your luminous markings mean?",
      "Why did you leave Luminaris?",
      "How does your long lifespan affect relationships with shorter-lived companions?",
      "Which tradition shaped you most strongly, and what part of it do you question?"
    ]
  },
  {
    "id": "umbralites",
    "name": "Umbralites",
    "world": "Umbraria",
    "tagline": "People of the Living Shadow",
    "short": "Native people of Umbraria, attuned to dimness, shadow, and subtle energies. Culture prizes discretion and responsible hidden power.",
    "intro": "Umbralites are the native people most closely associated with Umbraria. Outsiders often stereotype them as sinister, but Umbralite culture distinguishes darkness as a natural force from cruelty as a moral choice.",
    "appearance": "Elongated, graceful limbs; skin of charcoal, deep violet, midnight blue, or obsidian with a faint ethereal sheen. Constellation-like markings may glow dimly. Eyes often black, violet, silver, or deep blue.",
    "lifeSpan": "Adulthood around thirty years; roughly one hundred and fifty year lifespan.",
    "culture": "High value on discretion, self-knowledge, philosophy, and responsible use of hidden power. Privacy is dignity. Skilled in espionage, coded communication, and political maneuvering.",
    "beliefs": "Light and shadow define one another. Darkness is associated with rest, concealment, reflection, protection, and the unknown as much as with danger.",
    "names": "Xalith, Seraphina, Malachi, Nyxara, Vesper, Kaelis, Nerezza, Vael, Theren, Isryn, Selvaris. Titles: Nightshade, Shadowcaster, Veilborn, Duskwalker, Eclipsebound, Gloamveil, Nocturne.",
    "adventurers": "Spies, diplomats, scholars, occult investigators, merchants, guardians, fugitives, and seekers of forbidden truths.",
    "bonuses": {"dex": 2, "cha": 1},
    "size": "Medium",
    "speed": 30,
    "source": "DSC",
    "traits": [
      {
        "name": "Creature Type",
        "text": "Humanoid."
      },
      {
        "name": "Size",
        "text": "Medium. Umbralites are typically 5 to 6 feet tall."
      },
      {
        "name": "Speed",
        "text": "30 feet."
      },
      {
        "name": "Life Span",
        "text": "You reach adulthood around 30 years and can live for roughly 150 years."
      },
      {
        "name": "Darkvision",
        "text": "You have Darkvision out to 60 feet."
      },
      {
        "name": "Umbral Resistance",
        "text": "You have Resistance to Necrotic damage."
      },
      {
        "name": "Shadow Blend",
        "text": "While you are in Dim Light or Darkness, you have Advantage on Dexterity (Stealth) checks."
      },
      {
        "name": "Shadow Step",
        "text": "As a Bonus Action, you teleport up to 30 feet to an unoccupied space you can see that is in Dim Light or Darkness. Uses equal to Proficiency Bonus per Long Rest."
      },
      {
        "name": "Languages",
        "text": "You can speak, read, and write Common and Umbral."
      }
    ],
    "questions": [
      "Who taught you that secrecy can be a shield?",
      "What secret are you still protecting?",
      "Do you see shadow as refuge, tool, mystery, or danger?",
      "How do you respond when outsiders assume darkness means evil?",
      "What truth would make you break an oath of silence?"
    ]
  },
  {
    "id": "ravari",
    "name": "Ravari",
    "world": "Eternum",
    "tagline": "People of Scar and Endurance",
    "short": "Hardened folk of Eternum shaped by ruin, recovery, and relentless survival.",
    "intro": "Ravari are the people most closely associated with Eternum, a world scarred by ancient conflict. What many share is respect for resilience and earned loyalty.",
    "appearance": "Often sturdy or scarred builds; practical dress suited to hard travel and war-torn roads. Appearance varies widely across clans and regions.",
    "lifeSpan": "Mature at a rate similar to humans; roughly 200 year lifespan.",
    "culture": "Scars are often respected. Weapons may be inherited because survival is remembered. Loyalty is earned, not assumed.",
    "beliefs": "Endurance and recovery after ruin define worth more than unscarred purity.",
    "names": "Kael, Varek, Nyra, Draven, Sera, Malen, Raska, Toren, Vaela, Kor, Elira, Rhaz. Clan names: Ashwalker, Ironblood, Veilscar, Redhand, Stoneborn, Oathkeeper, Emberfall, Lastwatch.",
    "adventurers": "Mercenaries, scouts, healers, monster hunters, salvagers, diplomats, rebels, scholars, and protectors.",
    "bonuses": {"con": 2, "wis": 1},
    "size": "Medium",
    "speed": 30,
    "source": "DSC",
    "traits": [
      {
        "name": "Creature Type",
        "text": "Humanoid."
      },
      {
        "name": "Size",
        "text": "Medium. Ravari generally range from 5 to 7 feet tall."
      },
      {
        "name": "Speed",
        "text": "30 feet."
      },
      {
        "name": "Life Span",
        "text": "You mature at a rate similar to humans and can live for roughly 200 years."
      },
      {
        "name": "Darkvision",
        "text": "You have Darkvision out to 60 feet."
      },
      {
        "name": "Warrior's Resilience",
        "text": "You have Advantage on saving throws against the Frightened condition."
      },
      {
        "name": "Battle-Hardened",
        "text": "Choose one skill: Athletics, Intimidation, or Survival. You gain proficiency in that skill. You also gain proficiency with one Martial weapon of your choice."
      },
      {
        "name": "Relentless Endurance",
        "text": "When you are reduced to 0 Hit Points but not killed outright, you can drop to 1 Hit Point instead. Once per Long Rest."
      },
      {
        "name": "Languages",
        "text": "You can speak, read, and write Common and Ravari."
      }
    ],
    "questions": [
      "What conflict shaped your childhood?",
      "Who protected you when the world gave them every reason not to?",
      "Do you believe lasting peace is possible?",
      "What part of Eternum remains beautiful enough for you to fight for?",
      "What inherited oath, weapon, or memory do you carry?"
    ]
  },
  {
    "id": "solarians",
    "name": "Solarians",
    "world": "Solara",
    "tagline": "Children of the Sun",
    "short": "Radiant people of Solara shaped by golden plains, living warmth, and solar tradition.",
    "intro": "Solarians are the radiant people of Solara, shaped by a world of golden plains, powerful light, living warmth, and sun-touched traditions.",
    "appearance": "Warm or golden undertones to skin and hair are common; many carry a visible solar vitality.",
    "lifeSpan": "Adulthood around 20 years; roughly 120 year lifespan.",
    "culture": "Leadership, vitality, and communal remembrance of the dead as living obligation.",
    "beliefs": "Light, vitality, and leadership are responsibilities—not merely gifts.",
    "names": "Names often evoke sun, grain, and bright stone. Family titles may reference dawn, harvest, or memorial fire.",
    "adventurers": "Leaders, healers, soldiers, pilgrims, and those who carry Solara’s light beyond its borders.",
    "bonuses": {"str": 2, "cha": 1},
    "size": "Medium",
    "speed": 30,
    "source": "DSC",
    "traits": [
      {
        "name": "Creature Type",
        "text": "Humanoid."
      },
      {
        "name": "Size",
        "text": "Medium."
      },
      {
        "name": "Speed",
        "text": "30 feet."
      },
      {
        "name": "Life Span",
        "text": "You reach adulthood around 20 years and can live for roughly 120 years."
      },
      {
        "name": "Darkvision",
        "text": "You have Darkvision out to 60 feet."
      },
      {
        "name": "Solar Resistance",
        "text": "You have Resistance to Radiant damage."
      },
      {
        "name": "Luminous Presence",
        "text": "As a Bonus Action, you can shed Bright Light in a 10-foot radius and Dim Light for an additional 10 feet, or suppress this light."
      },
      {
        "name": "Languages",
        "text": "You can speak, read, and write Common and Solarian."
      }
    ],
    "questions": [
      "What does the sun mean to your family—life, judgment, or memory?",
      "What warmth do you refuse to let go cold?",
      "Whom do you lead, and who leads you?",
      "What memorial do you carry for the dead?",
      "What would make you dim your light?"
    ]
  },
  {
    "id": "aetherians",
    "name": "Aetherians",
    "world": "Aetheria",
    "tagline": "People of Wind and Sky",
    "short": "Sky-born folk of floating isles and responsible freedom of motion.",
    "intro": "Aetherians are the people of Aetheria’s floating islands, winds, and celestial routes—freedom tempered by responsibility for maintained connection.",
    "appearance": "Often lean builds suited to high places and long travel; clothing and ornaments echo wind, cloud, and compass.",
    "lifeSpan": "Adulthood around 25 years; roughly 180 year lifespan.",
    "culture": "Exploration, route-keeping, and the ethics of motion: freedom that does not abandon those left behind.",
    "beliefs": "Responsible motion keeps the skies alive. Freedom without connection is only drift.",
    "names": "Zephyra, Aurelia, Seraph, Lyra, Aeron, Caelis, Ilyra, Zephren, Aris, Vaela, Nym, Aeriel. Titles: Windrider, Skywake, Cloudspan.",
    "adventurers": "Explorers, pilots, couriers, scouts, and diplomats of the open routes.",
    "bonuses": {"dex": 2, "int": 1},
    "size": "Medium",
    "speed": 30,
    "source": "DSC",
    "traits": [
      {
        "name": "Creature Type",
        "text": "Humanoid."
      },
      {
        "name": "Size",
        "text": "Medium."
      },
      {
        "name": "Speed",
        "text": "30 feet."
      },
      {
        "name": "Life Span",
        "text": "You reach adulthood around 25 years and can live for roughly 180 years."
      },
      {
        "name": "Darkvision",
        "text": "You have Darkvision out to 60 feet."
      },
      {
        "name": "Aether Step",
        "text": "As a Bonus Action, teleport up to 20 feet to an unoccupied space you can see. Uses equal to Proficiency Bonus per Long Rest."
      },
      {
        "name": "Languages",
        "text": "You can speak, read, and write Common and Aetherian."
      }
    ],
    "questions": [
      "What route must you keep open?",
      "Whom did freedom cost?",
      "Do you travel to escape or to connect?",
      "What sky-law do you still obey?",
      "Where is home when the islands drift?"
    ]
  },
  {
    "id": "harmonites",
    "name": "Harmonites",
    "world": "Harmonia",
    "tagline": "Keepers of Balance",
    "short": "People of Harmonia whose cultures developed around interdependence, art, and mediation.",
    "intro": "Harmonites are the people of Harmonia, a world whose cultures developed around interdependence, artistic expression, mediation, and cooperation through meaningful difference.",
    "appearance": "Diverse; dress and ornament often signal role in cooperative networks rather than rank alone.",
    "lifeSpan": "Adulthood around 25 years; roughly 160 year lifespan.",
    "culture": "Interdependence, artistic expression, mediation. Difference is treated as a source of strength when held in balance.",
    "beliefs": "Cooperation requires meaningful difference. Forced sameness is a form of violence.",
    "names": "Names vary by community; titles often reference song, braid, concord, or balance.",
    "adventurers": "Mediators, artists, diplomats, guardians of concord, and those who seek balance beyond Harmonia.",
    "bonuses": {"wis": 2, "cha": 1},
    "size": "Medium",
    "speed": 30,
    "source": "DSC",
    "traits": [
      {
        "name": "Creature Type",
        "text": "Humanoid."
      },
      {
        "name": "Size",
        "text": "Medium."
      },
      {
        "name": "Speed",
        "text": "30 feet."
      },
      {
        "name": "Life Span",
        "text": "You reach adulthood around 25 years and can live for roughly 160 years."
      },
      {
        "name": "Harmonic Resilience",
        "text": "You have Advantage on saving throws you make to avoid or end the Charmed or Frightened condition."
      },
      {
        "name": "Harmonic Affinity",
        "text": "You gain proficiency in Insight or Persuasion."
      },
      {
        "name": "Languages",
        "text": "You can speak, read, and write Common and Harmonic."
      }
    ],
    "questions": [
      "What difference do you refuse to erase?",
      "Whom do you still owe a hearing?",
      "When is harmony a trap?",
      "What song do you refuse to let go silent?",
      "What balance would you break to prevent a greater one from collapsing?"
    ]
  },
  {
    "id": "celestials",
    "name": "Celestials",
    "world": "Celestia",
    "tagline": "People of Sacred Thresholds",
    "short": "Long-lived people of Celestia concerned with consent, identity, and cosmic order.",
    "intro": "Celestials are the people most closely associated with Celestia, concerned with consent, identity, sacred thresholds, and the weight of cosmic knowledge.",
    "appearance": "Often striking presence; starlit or solemn features. Dress may mark temple, archive, or free-order affiliation.",
    "lifeSpan": "Adulthood around 30 years; roughly 500 year lifespan.",
    "culture": "Orders, temples, archives, and philosophies debate what knowledge obligates and what identity may be freely chosen.",
    "beliefs": "A recurring question asks whether wisdom is measured by what one knows or by what one chooses to do with knowledge.",
    "names": "Names may be formal or chosen; titles often reference covenant, threshold, star, or lantern.",
    "adventurers": "Those who leave because institutions claim too much truth, or because ordinary mortal life fascinates more than eternity.",
    "bonuses": {"wis": 1, "cha": 2},
    "size": "Medium",
    "speed": 30,
    "source": "DSC",
    "traits": [
      {
        "name": "Creature Type",
        "text": "Humanoid."
      },
      {
        "name": "Size",
        "text": "Medium."
      },
      {
        "name": "Speed",
        "text": "30 feet."
      },
      {
        "name": "Life Span",
        "text": "You reach adulthood around 30 years and can live for roughly 500 years."
      },
      {
        "name": "Celestial Resistance",
        "text": "Choose Radiant or Necrotic damage when you create your character. You have Resistance to the chosen damage type."
      },
      {
        "name": "Starlit Vision",
        "text": "You have Darkvision out to 60 feet."
      },
      {
        "name": "Celestial Insight",
        "text": "You gain proficiency in Religion or Insight."
      },
      {
        "name": "Celestial Magic",
        "text": "You know the Sacred Flame cantrip. At 3rd level, cast Bless once without a spell slot. At 5th level, cast Lesser Restoration once without a spell slot. Regain uses on a Long Rest. Choose Int, Wis, or Cha as the spellcasting ability."
      },
      {
        "name": "Languages",
        "text": "You can speak, read, and write Common and Celestial."
      }
    ],
    "questions": [
      "Which order, philosophy, temple, archive, or family shaped you?",
      "What question about the cosmos has no one answered to your satisfaction?",
      "Do you regard the other worlds with wonder, duty, affection, pity, or unease?",
      "What ordinary mortal experience fascinates you because it is brief?",
      "What belief would you be willing to abandon if experience proved it wrong?"
    ]
  },
  {
    "id": "other",
    "name": "Other / Custom",
    "world": "",
    "tagline": "",
    "short": "Human, mixed heritage, or a people not listed among the seven dominant ancestries.",
    "intro": "",
    "appearance": "",
    "lifeSpan": "",
    "culture": "",
    "beliefs": "",
    "names": "",
    "adventurers": "",
    "traits": [],
    "questions": []
  }
,
{
  "id": "human",
  "name": "Human",
  "world": "",
  "source": "PHB",
  "tagline": "Versatile and ambitious",
  "short": "The most adaptable of the common peoples.",
  "intro": "Humans are the most adaptable and ambitious people among the common races. They settle every land and pursue every calling.",
  "size": "Medium",
  "speed": 30,
  "bonuses": {
    "str": 1,
    "dex": 1,
    "con": 1,
    "int": 1,
    "wis": 1,
    "cha": 1
  },
  "bonusNote": "Variant Human (optional): +1 to two abilities of your choice, a skill proficiency, and a feat instead of +1 to all.",
  "traits": [
    {
      "name": "Creature Type",
      "text": "Humanoid."
    },
    {
      "name": "Size",
      "text": "Medium."
    },
    {
      "name": "Speed",
      "text": "30 feet."
    },
    {
      "name": "Languages",
      "text": "Common and one extra language of your choice."
    },
    {
      "name": "Ability Score Increase",
      "text": "Your ability scores each increase by 1."
    }
  ]
},
{
  "id": "elf",
  "name": "Elf",
  "world": "",
  "source": "PHB",
  "tagline": "Graceful, long-lived, and keen-sensed",
  "short": "Elves are a magical people of otherworldly grace.",
  "intro": "Elves are a magical people of otherworldly grace, living in places of ethereal beauty.",
  "size": "Medium",
  "speed": 30,
  "bonuses": {
    "dex": 2
  },
  "bonusNote": "Subrace adds further bonuses (High Elf +1 INT; Wood Elf +1 WIS; Drow +1 CHA).",
  "traits": [
    {
      "name": "Creature Type",
      "text": "Humanoid."
    },
    {
      "name": "Size",
      "text": "Medium."
    },
    {
      "name": "Speed",
      "text": "30 feet."
    },
    {
      "name": "Darkvision",
      "text": "60 feet."
    },
    {
      "name": "Keen Senses",
      "text": "Proficiency in Perception."
    },
    {
      "name": "Fey Ancestry",
      "text": "Advantage on saves against being charmed; magic can’t put you to sleep."
    },
    {
      "name": "Trance",
      "text": "4 hours of trance counts as a long rest."
    },
    {
      "name": "Languages",
      "text": "Common and Elvish."
    }
  ]
},
{
  "id": "dwarf",
  "name": "Dwarf",
  "world": "",
  "source": "PHB",
  "tagline": "Bold, hardy, and ancient of craft",
  "short": "Kingdoms of stone and the iron of tradition.",
  "intro": "Bold and hardy, dwarves are known as skilled warriors, miners, and workers of stone and metal.",
  "size": "Medium",
  "speed": 25,
  "bonuses": {
    "con": 2
  },
  "bonusNote": "Subrace: Hill Dwarf +1 WIS; Mountain Dwarf +2 STR.",
  "traits": [
    {
      "name": "Creature Type",
      "text": "Humanoid."
    },
    {
      "name": "Size",
      "text": "Medium."
    },
    {
      "name": "Speed",
      "text": "25 feet. Not reduced by heavy armor."
    },
    {
      "name": "Darkvision",
      "text": "60 feet."
    },
    {
      "name": "Dwarven Resilience",
      "text": "Advantage on saves against poison; resistance to poison damage."
    },
    {
      "name": "Dwarven Combat Training",
      "text": "Proficiency with battleaxe, handaxe, light hammer, and warhammer."
    },
    {
      "name": "Tool Proficiency",
      "text": "Smith, brewer, or mason tools."
    },
    {
      "name": "Stonecunning",
      "text": "Add double PB on History checks related to stonework."
    },
    {
      "name": "Languages",
      "text": "Common and Dwarvish."
    }
  ]
},
{
  "id": "halfling",
  "name": "Halfling",
  "world": "",
  "source": "PHB",
  "tagline": "Small folk of luck and cheer",
  "short": "Practical, curious, and surprisingly brave.",
  "intro": "The comforts of home are the goals of most halflings’ lives—but adventuring ones are the exception.",
  "size": "Small",
  "speed": 25,
  "bonuses": {
    "dex": 2
  },
  "bonusNote": "Subrace: Lightfoot +1 CHA; Stout +1 CON.",
  "traits": [
    {
      "name": "Creature Type",
      "text": "Humanoid."
    },
    {
      "name": "Size",
      "text": "Small."
    },
    {
      "name": "Speed",
      "text": "25 feet."
    },
    {
      "name": "Lucky",
      "text": "When you roll a 1 on a d20 for an attack, ability check, or save, you can reroll and must use the new roll."
    },
    {
      "name": "Brave",
      "text": "Advantage on saves against being frightened."
    },
    {
      "name": "Halfling Nimbleness",
      "text": "Move through the space of any creature that is of a size larger than yours."
    },
    {
      "name": "Languages",
      "text": "Common and Halfling."
    }
  ]
},
{
  "id": "dragonborn",
  "name": "Dragonborn",
  "world": "",
  "source": "PHB",
  "tagline": "Draconic heritage made flesh",
  "short": "Draconic ancestry grants breath and resistance.",
  "intro": "Dragonborn look like dragons standing upright in humanoid form, though they lack wings or a tail.",
  "size": "Medium",
  "speed": 30,
  "bonuses": {
    "str": 2,
    "cha": 1
  },
  "traits": [
    {
      "name": "Creature Type",
      "text": "Humanoid."
    },
    {
      "name": "Size",
      "text": "Medium."
    },
    {
      "name": "Speed",
      "text": "30 feet."
    },
    {
      "name": "Draconic Ancestry",
      "text": "Choose a dragon type for breath weapon and damage resistance."
    },
    {
      "name": "Breath Weapon",
      "text": "Action: exhalation of energy in a line or cone; save for half. Uses scale with level."
    },
    {
      "name": "Damage Resistance",
      "text": "Resistance to the damage type associated with your draconic ancestry."
    },
    {
      "name": "Languages",
      "text": "Common and Draconic."
    }
  ]
},
{
  "id": "gnome",
  "name": "Gnome",
  "world": "",
  "source": "PHB",
  "tagline": "Curious innovators and illusionists",
  "short": "Small, bright-eyed, and endlessly inquisitive.",
  "intro": "A gnome’s energy and enthusiasm for living shine through every inch of their small frame.",
  "size": "Small",
  "speed": 25,
  "bonuses": {
    "int": 2
  },
  "bonusNote": "Subrace: Forest Gnome +1 DEX; Rock Gnome +1 CON.",
  "traits": [
    {
      "name": "Creature Type",
      "text": "Humanoid."
    },
    {
      "name": "Size",
      "text": "Small."
    },
    {
      "name": "Speed",
      "text": "25 feet."
    },
    {
      "name": "Darkvision",
      "text": "60 feet."
    },
    {
      "name": "Gnome Cunning",
      "text": "Advantage on INT, WIS, and CHA saves against magic."
    },
    {
      "name": "Languages",
      "text": "Common and Gnomish."
    }
  ]
},
{
  "id": "half-elf",
  "name": "Half-Elf",
  "world": "",
  "source": "PHB",
  "tagline": "Between two worlds",
  "short": "Diplomats and wanderers with fey ancestry.",
  "intro": "Half-elves combine what some say are the best qualities of humans and elves.",
  "size": "Medium",
  "speed": 30,
  "bonuses": {
    "cha": 2
  },
  "bonusNote": "+1 to two other ability scores of your choice.",
  "traits": [
    {
      "name": "Creature Type",
      "text": "Humanoid."
    },
    {
      "name": "Size",
      "text": "Medium."
    },
    {
      "name": "Speed",
      "text": "30 feet."
    },
    {
      "name": "Darkvision",
      "text": "60 feet."
    },
    {
      "name": "Fey Ancestry",
      "text": "Advantage on saves against being charmed; magic can’t put you to sleep."
    },
    {
      "name": "Skill Versatility",
      "text": "Proficiency in two skills of your choice."
    },
    {
      "name": "Languages",
      "text": "Common, Elvish, and one extra language."
    }
  ]
},
{
  "id": "half-orc",
  "name": "Half-Orc",
  "world": "",
  "source": "PHB",
  "tagline": "Fierce and relentless",
  "short": "Strength and endurance forged between orc and human blood.",
  "intro": "Half-orcs inherit a measure of orc bloodlust and human adaptability.",
  "size": "Medium",
  "speed": 30,
  "bonuses": {
    "str": 2,
    "con": 1
  },
  "traits": [
    {
      "name": "Creature Type",
      "text": "Humanoid."
    },
    {
      "name": "Size",
      "text": "Medium."
    },
    {
      "name": "Speed",
      "text": "30 feet."
    },
    {
      "name": "Darkvision",
      "text": "60 feet."
    },
    {
      "name": "Menacing",
      "text": "Proficiency in Intimidation."
    },
    {
      "name": "Relentless Endurance",
      "text": "When you are reduced to 0 HP but not killed, you can drop to 1 HP instead (1/Long Rest)."
    },
    {
      "name": "Savage Attacks",
      "text": "On a melee critical hit, roll one extra weapon damage die."
    },
    {
      "name": "Languages",
      "text": "Common and Orc."
    }
  ]
},
{
  "id": "tiefling",
  "name": "Tiefling",
  "world": "",
  "source": "PHB",
  "tagline": "Infernal heritage",
  "short": "Marked by a touch of the infernal.",
  "intro": "Tieflings are derived from human bloodlines touched by the infernal.",
  "size": "Medium",
  "speed": 30,
  "bonuses": {
    "int": 1,
    "cha": 2
  },
  "traits": [
    {
      "name": "Creature Type",
      "text": "Humanoid."
    },
    {
      "name": "Size",
      "text": "Medium."
    },
    {
      "name": "Speed",
      "text": "30 feet."
    },
    {
      "name": "Darkvision",
      "text": "60 feet."
    },
    {
      "name": "Hellish Resistance",
      "text": "Resistance to fire damage."
    },
    {
      "name": "Infernal Legacy",
      "text": "Thaumaturgy cantrip; at 3rd Hellish Rebuke; at 5th Darkness (CHA spellcasting)."
    },
    {
      "name": "Languages",
      "text": "Common and Infernal."
    }
  ]
}
];


window.CLASS_ABILITIES = {
  "Barbarian": [
    {
      "lvl": 1,
      "name": "Rage",
      "text": "Bonus Action to enter Rage (PB/Long Rest at early levels; see progression). While raging: advantage on STR checks/saves, bonus melee damage, resistance to bludgeoning/piercing/slashing. Ends early if you don’t attack or take damage."
    },
    {
      "lvl": 1,
      "name": "Unarmored Defense",
      "text": "While not wearing armor, AC = 10 + DEX mod + CON mod."
    },
    {
      "lvl": 2,
      "name": "Reckless Attack",
      "text": "On your turn, gain advantage on melee weapon attacks using STR; attack rolls against you have advantage until your next turn."
    },
    {
      "lvl": 2,
      "name": "Danger Sense",
      "text": "Advantage on DEX saves against effects you can see (not blinded, deafened, or incapacitated)."
    },
    {
      "lvl": 3,
      "name": "Primal Path",
      "text": "Choose a subclass (e.g. Berserker, Totem). Gain path features at the levels listed in that path."
    },
    {
      "lvl": 5,
      "name": "Extra Attack",
      "text": "Attack twice when you take the Attack action."
    },
    {
      "lvl": 5,
      "name": "Fast Movement",
      "text": "+10 ft. speed while not wearing heavy armor."
    },
    {
      "lvl": 7,
      "name": "Feral Instinct",
      "text": "Advantage on initiative; if surprised and not incapacitated, you can act normally on your first turn if you enter Rage first."
    },
    {
      "lvl": 9,
      "name": "Brutal Critical",
      "text": "Extra weapon damage die on melee critical hits (increases at higher levels)."
    },
    {
      "lvl": 11,
      "name": "Relentless Rage",
      "text": "If you drop to 0 HP while raging, you can make a DC 10 CON save to drop to 1 HP instead (DC rises by 5 each use until rest)."
    },
    {
      "lvl": 15,
      "name": "Persistent Rage",
      "text": "Rage only ends early if you fall unconscious or choose to end it."
    },
    {
      "lvl": 18,
      "name": "Indomitable Might",
      "text": "If your total for a STR check is less than your STR score, you can use your STR score instead."
    },
    {
      "lvl": 20,
      "name": "Primal Champion",
      "text": "+4 STR and CON (max 24)."
    }
  ],
  "Bard": [
    {
      "lvl": 1,
      "name": "Spellcasting",
      "text": "CHA spellcasting. Ritual casting. Spell save DC = 8 + PB + CHA mod. Spell attack = PB + CHA mod."
    },
    {
      "lvl": 1,
      "name": "Bardic Inspiration",
      "text": "Bonus Action: give a creature a Bardic Inspiration die (d6, improves with level) usable within 10 minutes on an ability check, attack, or save. Uses = CHA mod (min 1) per Long Rest (Font of Inspiration at 5th improves recovery)."
    },
    {
      "lvl": 2,
      "name": "Jack of All Trades",
      "text": "Add half PB (round down) to ability checks that don’t already include PB."
    },
    {
      "lvl": 2,
      "name": "Song of Rest",
      "text": "Allies who regain HP at the end of a short rest regain extra HP equal to your Song die."
    },
    {
      "lvl": 3,
      "name": "Bard College",
      "text": "Choose a subclass. Expertise: double PB on two skill proficiencies."
    },
    {
      "lvl": 5,
      "name": "Font of Inspiration",
      "text": "Regain all Bardic Inspiration uses when you finish a short or long rest."
    },
    {
      "lvl": 6,
      "name": "Countercharm",
      "text": "Action: performance that gives you and allies within 30 ft. advantage on saves against being frightened or charmed until your next turn."
    },
    {
      "lvl": 10,
      "name": "Magical Secrets",
      "text": "Learn spells from any class list (see progression for counts)."
    },
    {
      "lvl": 20,
      "name": "Superior Inspiration",
      "text": "When you roll initiative with no Inspiration uses left, regain one."
    }
  ],
  "Cleric": [
    {
      "lvl": 1,
      "name": "Spellcasting",
      "text": "WIS spellcasting. Prepare spells from the cleric list. Spell save DC = 8 + PB + WIS mod."
    },
    {
      "lvl": 1,
      "name": "Divine Domain",
      "text": "Choose a domain. Domain spells are always prepared and don’t count against prepared total."
    },
    {
      "lvl": 2,
      "name": "Channel Divinity",
      "text": "1/rest (more at higher levels). Includes Turn Undead and domain options."
    },
    {
      "lvl": 5,
      "name": "Destroy Undead",
      "text": "When an undead fails its save against Turn Undead, it is destroyed if its CR is low enough (threshold rises with level)."
    },
    {
      "lvl": 10,
      "name": "Divine Intervention",
      "text": "Action: beseech your deity; roll d100 ≤ level for success (automatic at 20th). 7 days between successful uses."
    }
  ],
  "Druid": [
    {
      "lvl": 1,
      "name": "Druidic",
      "text": "Know the secret language of druids."
    },
    {
      "lvl": 1,
      "name": "Spellcasting",
      "text": "WIS spellcasting. Prepare from the druid list. Ritual casting."
    },
    {
      "lvl": 2,
      "name": "Wild Shape",
      "text": "Bonus Action/Action (per rules edition) to assume a beast form. Uses per rest; CR and limitations improve with level and circle."
    },
    {
      "lvl": 2,
      "name": "Druid Circle",
      "text": "Choose a circle (e.g. Land, Moon) for additional features and Wild Shape options."
    },
    {
      "lvl": 18,
      "name": "Timeless Body",
      "text": "Age more slowly; can’t be aged magically."
    },
    {
      "lvl": 18,
      "name": "Beast Spells",
      "text": "Cast many druid spells while in Wild Shape (no material components with a cost)."
    },
    {
      "lvl": 20,
      "name": "Archdruid",
      "text": "Unlimited Wild Shape (with limits) and ignore verbal/somatic components for many spells."
    }
  ],
  "Fighter": [
    {
      "lvl": 1,
      "name": "Fighting Style",
      "text": "Choose a Fighting Style (e.g. Archery, Defense, Dueling, Great Weapon Fighting, Protection, Two-Weapon Fighting)."
    },
    {
      "lvl": 1,
      "name": "Second Wind",
      "text": "Bonus Action: regain 1d10 + fighter level HP. 1/Short or Long Rest."
    },
    {
      "lvl": 2,
      "name": "Action Surge",
      "text": "On your turn, take one additional action. 1/Short or Long Rest (2 at 17th)."
    },
    {
      "lvl": 3,
      "name": "Martial Archetype",
      "text": "Choose a subclass (Champion, Battle Master, Eldritch Knight, etc.)."
    },
    {
      "lvl": 5,
      "name": "Extra Attack",
      "text": "Attack twice with the Attack action (3 at 11th, 4 at 20th)."
    },
    {
      "lvl": 9,
      "name": "Indomitable",
      "text": "Reroll a failed save; must use the new roll. Uses increase with level."
    }
  ],
  "Monk": [
    {
      "lvl": 1,
      "name": "Unarmored Defense",
      "text": "While unarmored and not using a shield, AC = 10 + DEX mod + WIS mod."
    },
    {
      "lvl": 1,
      "name": "Martial Arts",
      "text": "Unarmed/monk weapons can use DEX; unarmed die scales with level; Bonus Action unarmed strike after Attack action."
    },
    {
      "lvl": 2,
      "name": "Ki",
      "text": "Ki points = monk level. Spend for Flurry of Blows, Patient Defense, Step of the Wind. Regain on Short or Long Rest."
    },
    {
      "lvl": 2,
      "name": "Unarmored Movement",
      "text": "+10 ft. speed while unarmored (increases with level); later vertical/water movement."
    },
    {
      "lvl": 3,
      "name": "Monastic Tradition",
      "text": "Choose a tradition. Deflect Missiles: reaction to reduce ranged weapon damage; possibly catch and throw."
    },
    {
      "lvl": 5,
      "name": "Extra Attack",
      "text": "Attack twice with the Attack action."
    },
    {
      "lvl": 5,
      "name": "Stunning Strike",
      "text": "Spend 1 ki when you hit with a melee attack: CON save or stunned until the end of your next turn."
    },
    {
      "lvl": 7,
      "name": "Evasion",
      "text": "DEX saves for half damage: success = no damage, failure = half."
    },
    {
      "lvl": 14,
      "name": "Diamond Soul",
      "text": "Proficiency in all saves; spend 1 ki to reroll a failed save."
    }
  ],
  "Paladin": [
    {
      "lvl": 1,
      "name": "Divine Sense",
      "text": "Action: know location of celestials, fiends, and undead within 60 ft. (not fully concealed). Uses = 1 + CHA mod per Long Rest."
    },
    {
      "lvl": 1,
      "name": "Lay on Hands",
      "text": "Pool of HP equal to paladin level × 5. Action to heal or cure disease/poison (5 HP cost)."
    },
    {
      "lvl": 2,
      "name": "Fighting Style",
      "text": "Choose a Fighting Style."
    },
    {
      "lvl": 2,
      "name": "Spellcasting",
      "text": "CHA half-caster. Prepare from the paladin list."
    },
    {
      "lvl": 2,
      "name": "Divine Smite",
      "text": "When you hit with a melee weapon attack, expend a spell slot for +2d8 radiant (+1d8 per slot level above 1st; extra vs undead/fiends)."
    },
    {
      "lvl": 3,
      "name": "Sacred Oath",
      "text": "Choose an oath. Divine Health: immunity to disease."
    },
    {
      "lvl": 5,
      "name": "Extra Attack",
      "text": "Attack twice with the Attack action."
    },
    {
      "lvl": 6,
      "name": "Aura of Protection",
      "text": "You and friendly creatures within 10 ft. (30 ft. at 18th) add your CHA mod to saving throws."
    },
    {
      "lvl": 11,
      "name": "Improved Divine Smite",
      "text": "+1d8 radiant on all melee weapon hits."
    }
  ],
  "Ranger": [
    {
      "lvl": 1,
      "name": "Favored Enemy / Favored Foe",
      "text": "Bonuses when hunting chosen enemy types or marked foes (per rules used at your table)."
    },
    {
      "lvl": 1,
      "name": "Natural Explorer / Deft Explorer",
      "text": "Expertise and travel benefits in favored terrain or general exploration features."
    },
    {
      "lvl": 2,
      "name": "Fighting Style",
      "text": "Choose a Fighting Style."
    },
    {
      "lvl": 2,
      "name": "Spellcasting",
      "text": "WIS half-caster. Known spells from the ranger list."
    },
    {
      "lvl": 3,
      "name": "Ranger Archetype",
      "text": "Choose a subclass (Hunter, Beast Master, Gloom Stalker, etc.)."
    },
    {
      "lvl": 5,
      "name": "Extra Attack",
      "text": "Attack twice with the Attack action."
    },
    {
      "lvl": 8,
      "name": "Land’s Stride",
      "text": "Move through nonmagical difficult terrain without extra cost; advantage vs plants that impede."
    },
    {
      "lvl": 14,
      "name": "Vanish",
      "text": "Hide as a Bonus Action; can’t be tracked by nonmagical means unless you choose."
    },
    {
      "lvl": 20,
      "name": "Foe Slayer",
      "text": "Add WIS mod to attack or damage vs favored/marked foe once per turn."
    }
  ],
  "Rogue": [
    {
      "lvl": 1,
      "name": "Expertise",
      "text": "Double PB on two skill (or thieves’ tools) proficiencies; two more at 6th."
    },
    {
      "lvl": 1,
      "name": "Sneak Attack",
      "text": "Once per turn, extra damage with finesse/ranged weapon if you have advantage, or an ally is within 5 ft. of the target and you don’t have disadvantage. Dice scale with level."
    },
    {
      "lvl": 1,
      "name": "Thieves’ Cant",
      "text": "Secret mix of dialect, jargon, and codes."
    },
    {
      "lvl": 2,
      "name": "Cunning Action",
      "text": "Bonus Action: Dash, Disengage, or Hide."
    },
    {
      "lvl": 3,
      "name": "Roguish Archetype",
      "text": "Choose a subclass (Thief, Assassin, Arcane Trickster, etc.)."
    },
    {
      "lvl": 5,
      "name": "Uncanny Dodge",
      "text": "Reaction: when hit by an attacker you can see, halve the attack’s damage."
    },
    {
      "lvl": 7,
      "name": "Evasion",
      "text": "DEX saves for half: success = 0, failure = half."
    },
    {
      "lvl": 11,
      "name": "Reliable Talent",
      "text": "Ability checks that use PB treat d20 rolls of 9 or lower as 10."
    },
    {
      "lvl": 20,
      "name": "Stroke of Luck",
      "text": "Turn a miss into a hit, or a failed ability check into a 20. 1/Short or Long Rest."
    }
  ],
  "Sorcerer": [
    {
      "lvl": 1,
      "name": "Spellcasting",
      "text": "CHA full caster. Known spells. Spell save DC = 8 + PB + CHA mod."
    },
    {
      "lvl": 1,
      "name": "Sorcerous Origin",
      "text": "Choose an origin (Draconic, Wild Magic, etc.) for features and sometimes spells."
    },
    {
      "lvl": 2,
      "name": "Font of Magic",
      "text": "Sorcery points = sorcerer level. Convert points ↔ spell slots (see tables)."
    },
    {
      "lvl": 3,
      "name": "Metamagic",
      "text": "Spend sorcery points to alter spells (Careful, Distant, Empowered, Extended, Heightened, Quickened, Subtle, Twinned, etc.). Learn more with level."
    },
    {
      "lvl": 20,
      "name": "Sorcerous Restoration",
      "text": "Regain 4 expended sorcery points on a short rest (1/Long Rest)."
    }
  ],
  "Warlock": [
    {
      "lvl": 1,
      "name": "Otherworldly Patron",
      "text": "Choose a patron. Gain expanded spell list and patron features."
    },
    {
      "lvl": 1,
      "name": "Pact Magic",
      "text": "CHA caster with fewer slots that recover on short rest; slots are all of one level (scale with warlock level)."
    },
    {
      "lvl": 2,
      "name": "Eldritch Invocations",
      "text": "Choose invocations (e.g. Agonizing Blast, Armor of Shadows, Devil’s Sight). Gain more with level."
    },
    {
      "lvl": 3,
      "name": "Pact Boon",
      "text": "Pact of the Blade, Chain, Tome, or Talisman."
    },
    {
      "lvl": 11,
      "name": "Mystic Arcanum",
      "text": "Cast a 6th-level (then 7th/8th/9th) warlock spell once per Long Rest without a slot."
    },
    {
      "lvl": 20,
      "name": "Eldritch Master",
      "text": "Spend 1 minute to regain all expended Pact Magic slots. 1/Long Rest."
    }
  ],
  "Wizard": [
    {
      "lvl": 1,
      "name": "Spellcasting",
      "text": "INT full caster. Spellbook. Prepare INT mod + wizard level spells. Ritual casting from book."
    },
    {
      "lvl": 1,
      "name": "Arcane Recovery",
      "text": "Once per day after a short rest, recover expended spell slots with combined level ≤ half wizard level (rounded up), none of 6th or higher."
    },
    {
      "lvl": 2,
      "name": "Arcane Tradition",
      "text": "Choose a school or tradition (including Celestial Omens in this setting)."
    },
    {
      "lvl": 18,
      "name": "Spell Mastery",
      "text": "Choose a 1st-level and a 2nd-level spell from your book; cast them at will at their lowest level."
    },
    {
      "lvl": 20,
      "name": "Signature Spells",
      "text": "Choose two 3rd-level spells; always prepared; cast each once at 3rd level without a slot per Short or Long Rest."
    }
  ],
  "Moon Guardian": [
    {
      "lvl": 1,
      "name": "Moon Channel",
      "text": "Channel celestial energy through body and weapon; foundation for Lunar Charges and Infusions."
    },
    {
      "lvl": 1,
      "name": "Lunar Attunement",
      "text": "After each Long Rest, attune to lunar resonance. Sets Lunar Charge pool and Moon Path readiness."
    },
    {
      "lvl": 2,
      "name": "Spellcasting",
      "text": "WIS half-caster. Spell save DC = 8 + PB + WIS mod. Prepares Moon Guardian spells; Path spells don’t count against prepared number."
    },
    {
      "lvl": 2,
      "name": "Lunar Charges",
      "text": "Pool by Moon Guardian level: L2–4: 2; L5–8: 3; L9–12: 4; L13–16: 5; L17+: 6. Improved Lunar Charges (L10+) and Lunar Mastery (L17+) each add +1. Spend for Moonlight Infusion, Celestial Form, and Path features. Regain all on Long Rest. Lunar Recovery (L7): once per Long Rest, when you finish a Short Rest, regain Lunar Charges equal to half your maximum (rounded up)."
    },
    {
      "lvl": 2,
      "name": "Moonlight Infusion",
      "text": "Once per turn, spend 1 Lunar Charge when you hit with a weapon attack or cast a Moon Guardian spell to apply one Lunar Aspect: Full Moon — +1d8 radiant (scales at higher levels); Waning Moon — move up to 10 ft without provoking opportunity attacks; New Moon — advantage on Stealth until the end of your next turn in dim light or darkness. You can change Aspects after a Short Rest. Some Path features alter or empower Infusions."
    },
    {
      "lvl": 3,
      "name": "Moon Path",
      "text": "Choose a Path (Luminaris, Umbraria, Eternum, Solara, Aetheria, Harmonia, Celestia). Gain Path Spells and Path features at 3rd, 7th, 11th, 15th."
    },
    {
      "lvl": 5,
      "name": "Extra Attack",
      "text": "Attack twice when you take the Attack action."
    },
    {
      "lvl": 6,
      "name": "Lunar Resilience",
      "text": "Your bond with Luna hardens mind and spirit (advantage or resistance vs relevant effects—see PHB)."
    },
    {
      "lvl": 7,
      "name": "Lunar Recovery",
      "text": "Once per Long Rest when you finish a Short Rest, recover some Lunar Charges."
    },
    {
      "lvl": 9,
      "name": "Celestial Form",
      "text": "Bonus Action: spend 2 Lunar Charges to enter Celestial Form for 1 minute (concentration optional per table). Gain benefits based on Moon Path (e.g. light aura, umbral stealth, flight). Ends early if you are incapacitated or have 0 Lunar Charges. You can dismiss it early (no action). Path features at 11th+ enhance the Form."
    },
    {
      "lvl": 13,
      "name": "Lunar Empowerment",
      "text": "When you activate Celestial Form, gain enhanced benefits."
    },
    {
      "lvl": 17,
      "name": "Lunar Mastery",
      "text": "Improved Lunar Charge recovery and Form duration/power."
    },
    {
      "lvl": 18,
      "name": "Infusion Mastery",
      "text": "Once on each of your turns, enhance an Infusion without spending an extra charge (per PHB)."
    },
    {
      "lvl": 20,
      "name": "Moon Guardian’s Resurgence",
      "text": "Once per Long Rest, recover Lunar Charges and reassert Celestial Form under dire conditions."
    },
    {
      "lvl": 3,
      "name": "Path Feature (examples)",
      "text": "Luminaris: Radiant Conduit / Radiant Burst / Luminous Form / Radiant Ascendance. Umbraria: Shadow Veil / Shadow Step / Umbral Form / Shadow Mastery. Other worlds grant conflict, solar, storm, harmony, or celestial path features."
    }
  ],
  "Bloodhunter": [
    {
      "lvl": 1,
      "name": "Hunter’s Bane",
      "text": "Training against monstrosities and the unnatural; skill and lore benefits vs marked quarry (per PHB)."
    },
    {
      "lvl": 1,
      "name": "Blood Maledict",
      "text": "Curse a creature using your own vitality. Amplify by taking damage (Blood Die). Save DC uses CON or key bloodhunter ability."
    },
    {
      "lvl": 1,
      "name": "Blood Rite",
      "text": "Bonus Action: expend one Blood Die to empower a weapon for 1 minute. Once per turn on a hit, deal extra necrotic or radiant damage equal to one Blood Die. Ends if Incapacitated or you rite another weapon."
    },
    {
      "lvl": 2,
      "name": "Fighting Style",
      "text": "Choose a Fighting Style."
    },
    {
      "lvl": 3,
      "name": "Bloodhunter Path",
      "text": "Choose Order, Vitality, or Ruin (or table’s paths). Path features at 3rd, 7th, 11th, 15th/18th, 20th."
    },
    {
      "lvl": 5,
      "name": "Extra Attack",
      "text": "Attack twice with the Attack action."
    },
    {
      "lvl": 6,
      "name": "Brand of Castigation",
      "text": "Brand a creature you damage; track and punish the branded foe (damage/teleport denial per PHB)."
    },
    {
      "lvl": 10,
      "name": "Dark Augmentation",
      "text": "Bonus to speed, saves, or self-control as hemomancy hardens body and will."
    },
    {
      "lvl": 14,
      "name": "Hardened Soul",
      "text": "Advantage or immunity vs common mental controls (charmed/frightened) as path defines."
    },
    {
      "lvl": 20,
      "name": "Crimson Apotheosis / Path Capstone",
      "text": "Path-defining transformation (e.g. Ruin Incarnate maximizes Blood Rite dice vs bloodied foes)."
    }
  ],
  "Ghostblade": [
    {
      "lvl": 1,
      "name": "Spectral Armament",
      "text": "Manifest spectral weapons (finesse melee). Count as magical for resistance/immunity. May shift between forms per PHB."
    },
    {
      "lvl": 1,
      "name": "Ethereal Sense",
      "text": "Sense undead, spectral, or ethereal presence within a short range; advantage on related checks."
    },
    {
      "lvl": 2,
      "name": "Spirit Step",
      "text": "Briefly phase through space or lightly ethereal movement (distance and uses per PHB/PB)."
    },
    {
      "lvl": 3,
      "name": "Ghostblade Discipline",
      "text": "Choose a discipline. Gain discipline features at 3rd, 6th, 11th, 17th."
    },
    {
      "lvl": 5,
      "name": "Extra Attack",
      "text": "Attack twice with the Attack action."
    },
    {
      "lvl": 6,
      "name": "Phase Strike",
      "text": "Attacks ignore cover or phase through armor (partial force/psychic component per PHB)."
    },
    {
      "lvl": 9,
      "name": "Spirit Ward",
      "text": "Reaction or aura that reduces necrotic/psychic damage for you or an ally."
    },
    {
      "lvl": 14,
      "name": "Ghostwalk",
      "text": "Limited ethereal jaunt or insubstantial movement for a turn."
    },
    {
      "lvl": 20,
      "name": "Spectral Mastery",
      "text": "Peak control of spectral armaments and ethereal movement."
    }
  ],
  "Shadowblade": [
    {
      "lvl": 1,
      "name": "Expertise",
      "text": "Double PB on two skill or tool proficiencies (more at 6th)."
    },
    {
      "lvl": 1,
      "name": "Sneak Attack",
      "text": "Once per turn, extra damage with finesse/ranged weapon if you have advantage, or an ally is within 5 ft. of the target and you don’t have disadvantage. Dice scale on the Shadowblade table."
    },
    {
      "lvl": 1,
      "name": "Umbral Veil",
      "text": "Living-shadow techniques of concealment and misdirection (foundation for Shadow Points features)."
    },
    {
      "lvl": 2,
      "name": "Cunning Action",
      "text": "Bonus Action: Dash, Disengage, or Hide."
    },
    {
      "lvl": 2,
      "name": "Shadow Points",
      "text": "Unique resource for Shadow Arts. Regain on Long Rest; when you roll Initiative at 0 points, regain 2."
    },
    {
      "lvl": 3,
      "name": "Shadow Tradition / Discipline",
      "text": "Choose e.g. Shadow Assassin or other disciplines. Assassinate (3rd): advantage vs creatures that haven’t acted; extra PB damage on Sneak Attack vs them."
    },
    {
      "lvl": 5,
      "name": "Uncanny Dodge",
      "text": "Reaction: halve damage from an attack you can see."
    },
    {
      "lvl": 6,
      "name": "Shadow Blend (Discipline)",
      "text": "When you Hide in Dim Light or Darkness, spend 1 Shadow Point to become Invisible until the start of your next turn (ends early if you attack, deal damage, or force a save)."
    },
    {
      "lvl": 7,
      "name": "Evasion",
      "text": "DEX saves for half: success = 0, failure = half."
    },
    {
      "lvl": 9,
      "name": "Shadow Step (Class)",
      "text": "Teleport through shadow (Shadow Point cost; dim/dark requirements per PHB)."
    },
    {
      "lvl": 11,
      "name": "Reliable Talent",
      "text": "PB checks treat d20 rolls of 9 or lower as 10."
    },
    {
      "lvl": 13,
      "name": "Deathmark / Veil of Doubt",
      "text": "Discipline features: mark for ally advantage, or spend Shadow Points to frighten via Veil of Doubt."
    },
    {
      "lvl": 14,
      "name": "Shadow Form",
      "text": "Limited transformation into living shadow for defense and movement."
    },
    {
      "lvl": 17,
      "name": "Perfect Impostor",
      "text": "Cast Mislead 1/Long Rest; hide after certain failed enemy saves."
    },
    {
      "lvl": 20,
      "name": "Living Night",
      "text": "Capstone control of Shadow Points and umbral strikes."
    }
  ]
};

window.MOON_PATHS = [
{
  "id": "luna",
  "name": "Path of Luna",
  "world": "Luna",
  "summary": "The rarest path: channel Luna without resonance to a single world. Requires Game Master approval; carries religious and narrative significance.",
  "features": [
    {
      "lvl": 3,
      "name": "Lunar Infusion",
      "text": "When you hit with a melee weapon attack, expend one Moon Guardian spell slot to deal 2d8 extra Radiant or Necrotic damage (your choice), plus 1d8 per slot level above 1st (max 5d8). Cannot combine with Lunar Edge on the same hit. You can change your Lunar Aspect whenever you finish a Short Rest."
    },
    {
      "lvl": 7,
      "name": "Moonlit Veil",
      "text": "Bonus Action: spend 2 Lunar Charges to cloak yourself in shifting moonlight for 1 minute. Opportunity Attacks against you have Disadvantage, and the first attack roll against you each round has Disadvantage. Ends early if you are Incapacitated."
    },
    {
      "lvl": 11,
      "name": "Lunar Empowerment",
      "text": "When you cast a Moon Guardian spell that restores Hit Points or deals Radiant or Necrotic damage, spend 1 Lunar Charge to reroll a number of that spell’s healing or damage dice up to your Wisdom modifier (use the new rolls)."
    },
    {
      "lvl": 15,
      "name": "Lunar Radiance",
      "text": "While Celestial Form is active, you and chosen allies within 30 feet have Advantage on saving throws against spells and magical effects. Once on each of their turns, when such a creature hits with a weapon attack, the attack deals an extra 1d8 Radiant damage."
    }
  ]
},

  {
    "id": "luminaris",
    "name": "Path of Luminaris",
    "world": "Luminaris",
    "summary": "Express Luna through radiant corroboration and accountable illumination.",
    "features": [
      {
        "lvl": 3,
        "name": "Radiant Conduit",
        "text": "You learn the Light cantrip (or another Moon Guardian cantrip if you already know it). Once on each of your turns when you deal radiant damage, one creature damaged by that effect glows until the start of your next turn: it cannot benefit from being Invisible, and the next attack against it before the glow ends gains +1d4."
      },
      {
        "lvl": 7,
        "name": "Radiant Burst",
        "text": "Action: spend 2 Lunar Charges to emit light in a 15-foot radius. Chosen creatures make a CON save vs your spell save DC. Fail: 3d8 radiant (4d8 at 11th, 5d8 at 17th) and Blinded until the start of your next turn; success: half damage."
      },
      {
        "lvl": 11,
        "name": "Luminous Form",
        "text": "While Celestial Form is active: bright light 30 ft. / dim 30 ft. beyond; Fly speed equal to Speed (Hover). When you restore HP or deal radiant damage, you may move 10 feet without provoking opportunity attacks (once per turn)."
      },
      {
        "lvl": 15,
        "name": "Radiant Ascendance",
        "text": "While Celestial Form is active, once per turn when you deal radiant damage, the target makes a CON save or is Blinded until the end of its next turn (success: immune until your next turn). Your radiant damage ignores Resistance (not Immunity)."
      }
    ]
  },
  {
    "id": "umbraria",
    "name": "Path of Umbraria",
    "world": "Umbraria",
    "summary": "Express Luna through protective shadow, stealth, and chosen revelation.",
    "features": [
      {
        "lvl": 3,
        "name": "Shadow Veil",
        "text": "You learn Minor Illusion. Advantage on Dexterity (Stealth) checks in Dim Light or Darkness. You can see normally through magical Darkness created by your Moon Guardian spells and features out to 30 feet."
      },
      {
        "lvl": 7,
        "name": "Shadow Step",
        "text": "Bonus Action while in Dim Light or Darkness: teleport up to 30 feet to an unoccupied space you can see that is in Dim Light or Darkness. Uses scale with Lunar Charges / path rules in the PHB."
      },
      {
        "lvl": 11,
        "name": "Umbral Form",
        "text": "While Celestial Form is active, you are lightly obscured in Dim Light or Darkness, and opportunity attacks against you are made with disadvantage."
      },
      {
        "lvl": 15,
        "name": "Shadow Mastery",
        "text": "When you roll damage for necrotic or umbral Moon Guardian effects, treat any 1 on a damage die as a 2. Enhanced stealth and darkness control while in Celestial Form."
      }
    ]
  },
  {
    "id": "eternum",
    "name": "Path of Eternum",
    "world": "Eternum",
    "summary": "Express Luna through endurance, conflict-hardened resolve, and recovery after ruin.",
    "features": [
      {
        "lvl": 3,
        "name": "Battle Focus",
        "text": "When you roll Initiative, you can gain temporary HP equal to your Moon Guardian level + WIS modifier (minimum 1)."
      },
      {
        "lvl": 7,
        "name": "Unbroken Advance",
        "text": "Advantage on ability checks and saving throws against being Frightened or having your speed reduced. Move through difficult terrain caused by rubble or ruins without extra cost."
      },
      {
        "lvl": 11,
        "name": "Aura of Conflict",
        "text": "While Celestial Form is active, enemies within 10 feet of you have disadvantage on death saving throws, and you gain resistance to one damage type chosen when you enter the Form."
      },
      {
        "lvl": 15,
        "name": "Eternal Champion",
        "text": "Once per Long Rest when you are reduced to 0 HP but not killed outright, you can drop to 1 HP instead and immediately enter Celestial Form if you have Lunar Charges remaining."
      }
    ]
  },
  {
    "id": "solara",
    "name": "Path of Solara",
    "world": "Solara",
    "summary": "Express Luna through solar vitality, living light, and cleansing fire of remembrance.",
    "features": [
      {
        "lvl": 3,
        "name": "Solar Conduit",
        "text": "You gain Resistance to Fire damage. Once per turn when you deal radiant damage, add your WIS modifier to one damage roll."
      },
      {
        "lvl": 7,
        "name": "Solar Flare",
        "text": "Action: spend Lunar Charges to unleash a cone or line of solar radiance (CON save; radiant/fire damage; fail also illuminated). Exact dice scale with level per PHB."
      },
      {
        "lvl": 11,
        "name": "Solar Fury",
        "text": "While Celestial Form is active, your weapon attacks deal extra radiant damage equal to your WIS modifier, and you shed bright sunlight in a 20-foot radius."
      },
      {
        "lvl": 15,
        "name": "Solar Ascendance",
        "text": "While Celestial Form is active, undead and fiends have disadvantage on saves against your Moon Guardian spells and features; your radiant damage ignores Resistance."
      }
    ]
  },
  {
    "id": "aetheria",
    "name": "Path of Aetheria",
    "world": "Aetheria",
    "summary": "Express Luna through freedom of motion, storm-paths, and maintained connection.",
    "features": [
      {
        "lvl": 3,
        "name": "Cosmic Attunement",
        "text": "When you roll Initiative, you can move up to half your speed without provoking opportunity attacks."
      },
      {
        "lvl": 7,
        "name": "Astral Wings",
        "text": "Bonus Action: spend Lunar Charges to gain a Fly speed equal to your Speed until the end of your next turn (Hover optional per PHB)."
      },
      {
        "lvl": 11,
        "name": "Astral Burst",
        "text": "While Celestial Form is active, once per turn when you hit with a weapon attack, deal extra force or thunder damage and push the target 10 feet."
      },
      {
        "lvl": 15,
        "name": "Aetherial Ascendance",
        "text": "While Celestial Form is active, you have a permanent Fly speed equal to your Speed (Hover) and ignore difficult terrain of wind or unstable platforms."
      }
    ]
  },
  {
    "id": "harmonia",
    "name": "Path of Harmonia",
    "world": "Harmonia",
    "summary": "Express Luna through balance, mediation, and cooperative strength.",
    "features": [
      {
        "lvl": 3,
        "name": "Serene Aura",
        "text": "Allies within 10 feet of you gain a +1 bonus to saving throws against being Charmed or Frightened."
      },
      {
        "lvl": 7,
        "name": "Tranquil Resilience",
        "text": "As a Bonus Action, spend a Lunar Charge to grant an ally within 30 feet temporary HP equal to your Moon Guardian level + WIS mod."
      },
      {
        "lvl": 11,
        "name": "Enchanted Harmony",
        "text": "While Celestial Form is active, when you restore HP to an ally, another ally within 15 feet regains HP equal to your WIS modifier."
      },
      {
        "lvl": 15,
        "name": "Harmony’s Embrace",
        "text": "While Celestial Form is active, you and allies within 15 feet have advantage on saves against being Charmed or Frightened; once per turn you can grant the Help action as a free interaction within that aura."
      }
    ]
  },
  {
    "id": "celestia",
    "name": "Path of Celestia",
    "world": "Celestia",
    "summary": "Express Luna through sacred thresholds, identity, and celestial authority.",
    "features": [
      {
        "lvl": 3,
        "name": "Celestial Presence",
        "text": "You learn Sacred Flame if you don’t already know it. Advantage on Insight or Religion checks related to planar/celestial matters."
      },
      {
        "lvl": 7,
        "name": "Celestial Wings",
        "text": "Bonus Action: spend Lunar Charges to gain spectral wings — Fly speed equal to Speed until the end of your next turn."
      },
      {
        "lvl": 11,
        "name": "Celestial Burst",
        "text": "While Celestial Form is active, once per turn deal extra radiant damage on a weapon hit and force a WIS save or the target cannot willingly move closer to you until the end of its next turn."
      },
      {
        "lvl": 15,
        "name": "Celestial Ascendance",
        "text": "While Celestial Form is active, you have resistance to necrotic and radiant damage, and your weapon attacks count as magical celestial for overcoming resistance."
      }
    ]
  }
];
window.CLASS_ATTACKS = {
  "Barbarian": {
    "style": "str_melee",
    "weapons": [
      [
        "Greataxe",
        "1d12",
        "slashing"
      ],
      [
        "Handaxe",
        "1d6",
        "slashing"
      ]
    ]
  },
  "Bard": {
    "style": "cha_spell",
    "weapons": [
      [
        "Rapier",
        "1d8",
        "piercing"
      ],
      [
        "Dagger",
        "1d4",
        "piercing"
      ]
    ],
    "cantrip": "Vicious Mockery (WIS save, 1d4 psychic)"
  },
  "Cleric": {
    "style": "wis_spell",
    "weapons": [
      [
        "Mace",
        "1d6",
        "bludgeoning"
      ],
      [
        "Light Crossbow",
        "1d8",
        "piercing"
      ]
    ],
    "cantrip": "Sacred Flame (DEX save, 1d8 radiant)"
  },
  "Druid": {
    "style": "wis_spell",
    "weapons": [
      [
        "Quarterstaff",
        "1d6",
        "bludgeoning"
      ],
      [
        "Scimitar",
        "1d6",
        "slashing"
      ]
    ],
    "cantrip": "Produce Flame (1d8 fire)"
  },
  "Fighter": {
    "style": "str_melee",
    "weapons": [
      [
        "Longsword",
        "1d8",
        "slashing"
      ],
      [
        "Longbow",
        "1d8",
        "piercing"
      ]
    ]
  },
  "Monk": {
    "style": "dex_melee",
    "weapons": [
      [
        "Unarmed Strike",
        "1d6",
        "bludgeoning"
      ],
      [
        "Shortsword",
        "1d6",
        "piercing"
      ]
    ]
  },
  "Paladin": {
    "style": "str_melee",
    "weapons": [
      [
        "Longsword",
        "1d8",
        "slashing"
      ],
      [
        "Javelin",
        "1d6",
        "piercing"
      ]
    ],
    "note": "Divine Smite on melee hit (expend spell slot)"
  },
  "Ranger": {
    "style": "dex_ranged",
    "weapons": [
      [
        "Longbow",
        "1d8",
        "piercing"
      ],
      [
        "Shortsword",
        "1d6",
        "piercing"
      ]
    ]
  },
  "Rogue": {
    "style": "dex_melee",
    "weapons": [
      [
        "Shortsword",
        "1d6",
        "piercing"
      ],
      [
        "Shortbow",
        "1d6",
        "piercing"
      ]
    ],
    "note": "Sneak Attack when eligible"
  },
  "Sorcerer": {
    "style": "cha_spell",
    "weapons": [
      [
        "Dagger",
        "1d4",
        "piercing"
      ],
      [
        "Light Crossbow",
        "1d8",
        "piercing"
      ]
    ],
    "cantrip": "Fire Bolt (1d10 fire)"
  },
  "Warlock": {
    "style": "cha_spell",
    "weapons": [
      [
        "Dagger",
        "1d4",
        "piercing"
      ]
    ],
    "cantrip": "Eldritch Blast (1d10 force)"
  },
  "Wizard": {
    "style": "int_spell",
    "weapons": [
      [
        "Quarterstaff",
        "1d6",
        "bludgeoning"
      ],
      [
        "Dagger",
        "1d4",
        "piercing"
      ]
    ],
    "cantrip": "Fire Bolt (1d10 fire)"
  },
  "Moon Guardian": {
    "style": "wis_hybrid",
    "weapons": [
      [
        "Longsword",
        "1d8",
        "slashing"
      ],
      [
        "Javelin",
        "1d6",
        "piercing"
      ]
    ],
    "cantrip": "Moonlight Infusion (spend Lunar Charges)",
    "note": "Spell attack / save DC from Wisdom"
  },
  "Bloodhunter": {
    "style": "str_melee",
    "weapons": [
      [
        "Longsword",
        "1d8",
        "slashing"
      ],
      [
        "Hand Crossbow",
        "1d6",
        "piercing"
      ]
    ],
    "note": "Blood Rite: extra necrotic/radiant = Blood Die"
  },
  "Ghostblade": {
    "style": "dex_melee",
    "weapons": [
      [
        "Spectral Blade",
        "1d8",
        "force"
      ],
      [
        "Spectral Blade (offhand)",
        "1d6",
        "force"
      ]
    ],
    "note": "Spectral weapons count as magical"
  },
  "Shadowblade": {
    "style": "dex_melee",
    "weapons": [
      [
        "Shortsword",
        "1d6",
        "piercing"
      ],
      [
        "Hand Crossbow",
        "1d6",
        "piercing"
      ]
    ],
    "note": "Sneak Attack / Shadow Strike when eligible"
  }
};
window.UMBRARIANS = {
  "name": "Umbrarians",
  "subtitle": "Hosts of the Dark Shards",
  "criticalDistinction": "An Umbralite is a native people of Umbraria (Player’s Handbook). An Umbrarian is the mortal host of a Dark Shard (Dungeon Master’s Guide). Any ancestry can be an Umbrarian. The two words are historically confused—sometimes with disastrous consequences.",
  "definition": "An Umbrarian is the mortal host of a Dark Shard. It is not a race, nation, or ordinary inherited condition. The term arose from incomplete histories linking early Shard activity to Umbraria. Shadowmourne, for example, originated beneath Luminaris; later movement through Umbraria caused historians to call it “the Umbrarian Shard.”",
  "boundAtBirth": "Each Shard is normally bound to one host at birth. Bloodline, celestial alignment, proximity to ancient sites, future potential, and cult designs may all play a role—or the Sword may simply be testing possibilities. The infant usually shows no overt corruption; a subtle birthmark represents the Sword. True sight, another Umbrarian, or a revealing ritual perceives its deeper form. When the Shard awakens, the mark glows with dark energy and may branch across the body.",
  "sleepingShard": "A dormant Shard is not inactive. It observes through the host, learning language, attachment, fear, and desire. It may influence dreams or intensify impulses without revealing itself. Many hosts live for years without knowing what they carry.",
  "commonTraits": [
    {
      "name": "Shard Mark",
      "text": "The host bears the Shard’s identifying mark. While using an Awakened or Ascendant Gift, the mark is visible through mundane disguises."
    },
    {
      "name": "Resonant Sense",
      "text": "As an action, concentrate on a creature, object, or location within 30 feet. The GM reveals whether it carries a true Shard, a Shard echo, Sword influence, or a Primordial Guardian ward. Does not identify which influence. Blocked by Guardian or Ascendant protections. Once per long rest."
    },
    {
      "name": "Dark Bargain",
      "text": "The host can accept Dark Bargains (see rules below)."
    },
    {
      "name": "Shard Save DC",
      "text": "Choose Intelligence, Wisdom, or Charisma when the Shard awakens. Shard save DC = 8 + proficiency bonus + chosen ability modifier. Shard attack modifier = proficiency bonus + chosen ability modifier. Choice cannot normally be changed."
    }
  ],
  "stages": [
    {
      "id": "dormant",
      "name": "Dormant",
      "text": "Shard bound but largely silent. Host may live a full life with only subtle marks, dreams, or instincts. NPC: add Shard Mark, Resonant Sense, and one mannerism or recurring dream—no supernatural combat abilities required."
    },
    {
      "id": "awakened",
      "name": "Awakened",
      "text": "Host is aware of the Shard’s voice and can accept Dark Bargains. On first becoming Awakened, choose one Awakened Gift from the Shard’s profile. At a later major milestone, the GM may grant a second. NPC: add two Awakened Gifts, resistance to one Shard-associated damage type, and one already-accepted Dark Bargain."
    },
    {
      "id": "ascendant",
      "name": "Ascendant",
      "text": "Deep alignment with the Sword’s will. Choose one Ascendant Gift. A second Ascendant Gift belongs only in mythic campaigns and should be matched by national- or world-scale consequences. NPC: add one Ascendant Gift, a visible regional effect, and a personal vulnerability rooted in the host’s identity."
    }
  ],
  "gainingGifts": "Unless a gift says otherwise, it can be used once and is regained after a long rest. A host may overchannel a spent gift by accepting a Dark Bargain before resolving its effect.",
  "corruptionTrack": [
    {
      "score": 0,
      "state": "Clear",
      "effect": "The Shard can observe but has no established leverage."
    },
    {
      "score": 1,
      "state": "Murmur",
      "effect": "Recurring dreams and impulses begin. No mechanical penalty."
    },
    {
      "score": 2,
      "state": "Resonance",
      "effect": "The Shard learns a Bond, Ideal, fear, or secret and speaks through it."
    },
    {
      "score": 3,
      "state": "Stain",
      "effect": "The mark manifests more readily. Disadvantage on attempts to conceal Shard influence from an informed observer."
    },
    {
      "score": 4,
      "state": "Dominion",
      "effect": "The Shard can issue a Demand after a Dark Bargain or major failure. Refusal never forces an action, but imposes the Dominion consequence."
    },
    {
      "score": 5,
      "state": "Eclipse",
      "effect": "Bargains become spectacular and catastrophic. The host’s shadow, reflection, or voice may act independently."
    },
    {
      "score": 6,
      "state": "Transformation",
      "effect": "Identity and body face permanent change. For a PC, requires prior agreement or a clearly communicated, avoidable consequence."
    }
  ],
  "darkBargains": "Once per long rest, after an Umbrarian fails a d20 test, the Shard may offer a Dark Bargain. If accepted, the player rerolls and must use the new result; Corruption increases by 1. At Corruption 3+, the reroll is made with advantage. At Corruption 5, the GM may instead offer automatic success, an extraordinary manifestation, or survival against an otherwise fatal consequence—plus a severe Shard-appropriate complication. Always state the benefit, immediate price, and that Corruption will increase.",
  "shardDemands": "At Dominion (Corruption 4+), the Shard may attach a Demand to a bargain or major use of power. Demands must be concrete (spare an enemy, destroy a ward, conceal evidence, isolate an ally, carry an object, open a path). Refusing never transfers PC control to the GM. Instead the host takes psychic damage equal to twice character level and cannot accept another Dark Bargain until finishing a long rest.",
  "shards": [
    {
      "id": "shadowmourne",
      "name": "Shadowmourne",
      "world": "Luminaris",
      "awakens": "Devastating loss, grief, betrayal, or the desire to disappear from pain.",
      "theme": "Concealment, erasure, isolation of witnesses."
    },
    {
      "id": "ashbringer",
      "name": "Ashbringer",
      "world": "Umbraria",
      "awakens": "Trial by fire, consuming rage, reckless bravery, or the desire to burn away an intolerable past.",
      "theme": "Consuming exposure, privacy violated by fire."
    },
    {
      "id": "plaguebringer",
      "name": "Plaguebringer",
      "world": "Eternum",
      "awakens": "Surviving deadly illness or desperately seeking power to heal what ordinary medicine cannot.",
      "theme": "Decay, adaptive corruption, false recovery."
    },
    {
      "id": "scourgeborne",
      "name": "Scourgeborne",
      "world": "Solara",
      "awakens": "Confronting death and surviving, especially when the host cannot accept another’s passing.",
      "theme": "Mortality, hollowed remembrance, stolen vitality."
    },
    {
      "id": "thundersoul",
      "name": "Thundersoul",
      "world": "Aetheria",
      "awakens": "Survival of a great storm or lightning strike, or a moment of demanding absolute control.",
      "theme": "Command, forced routes, obedience of motion."
    },
    {
      "id": "chaosbringer",
      "name": "Chaosbringer",
      "world": "Harmonia",
      "awakens": "Severe trauma, collapsing certainty, or choosing to destroy an order the host believes has failed.",
      "theme": "Forced sameness, broken cooperation, false consensus."
    },
    {
      "id": "felmourne",
      "name": "Felmourne",
      "world": "Celestia",
      "awakens": "Contact with corrupting outsiders, a forbidden pact, or the belief that no price is too great for necessary power.",
      "theme": "Annexed identity, coerced thresholds, spiritual tithe."
    }
  ],
  "npcGuidance": "Begin with an existing stat block and add only what the scene needs. Give the Shard a goal and the host a goal—they may overlap without being identical. An Ascendant Umbrarian should be a story problem as much as a combat encounter.",
  "pcGuidance": "Player-character Umbrarians require Game Master approval and experienced players prepared for shared narrative responsibility. Power is never free: every Gift and Bargain should cost something the table can feel. Corruption never falls from a routine rest—only costly resistance, restoration, or story milestones.",
  "umbrariaContext": "Umbraria is the twilight world of Ashbringer (privacy, shelter, chosen revelation). Its dominant people are Umbralites. Ghostblade and living-shadow traditions are cultural contributions of Umbraria—not the same as bearing a Dark Shard.",
    "awakenedGiftsGeneric": [
    {
      "name": "Veil of the Mark",
      "text": "Bonus Action: until the start of your next turn, you have advantage on Stealth checks and the mark is harder for untrained observers to notice (Corruption 3+ still imposes Stain penalties vs informed observers)."
    },
    {
      "name": "Shard-Hardened Flesh",
      "text": "Reaction when hit: reduce the damage by 1d8 + PB. 1/Long Rest (or overchannel via Dark Bargain)."
    },
    {
      "name": "Whisper Lash",
      "text": "Action: one creature within 30 ft. makes a Wisdom save vs Shard DC or takes 2d8 psychic damage and has disadvantage on its next attack before your next turn."
    },
    {
      "name": "Borrow Resolve",
      "text": "When you fail a save, spend this gift to add your Shard ability modifier to the result (after the roll). 1/Long Rest."
    }
  ],
  "ascendantGiftsGeneric": [
    {
      "name": "Regional Shadow",
      "text": "Your presence warps a wide area in a way that matches your Sword (false lights, ash-edged shelters, failing roads, etc.). Narrative + mechanical hazard defined with the GM."
    },
    {
      "name": "Sword’s Demand",
      "text": "Once per Long Rest, issue a supernatural Demand as an action (Shard DC). Failure means the target is compelled toward a concrete act for 1 minute or until damaged by you."
    },
    {
      "name": "Apotheosis Spark",
      "text": "For 1 minute, once per Long Rest, your Awakened Gifts do not expend their daily use (Dark Bargains still raise Corruption)."
    }
  ],
  "sources": "PHB Ch. 5 (Umbralites / Umbraria) · DMG Ch. 3 (Shards, Umbrarians & Corruption)"
};

