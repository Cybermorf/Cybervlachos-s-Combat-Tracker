// Class / subclass random tables (official 5e where noted)
window.CLASS_TABLES = [
  {
    id: 'barbarian-wild-magic',
    name: 'Path of Wild Magic — Wild Magic Table',
    className: 'Barbarian',
    subclass: 'Path of Wild Magic',
    source: "Tasha's Cauldron of Everything",
    dice: 'd8',
    note: 'When you enter a rage, roll on this table.',
    dcAbility: 'con',
    rows: [
      { roll: '1', effect: 'Each creature of your choice within 30 feet must succeed on a Constitution save or take 1d12 necrotic; you gain 1d12 temp HP.' },
      { roll: '2', effect: 'Teleport up to 30 feet; repeat as BA until rage ends.' },
      { roll: '3', effect: 'Spirit appears and explodes for 1d6 force (DEX save).' },
      { roll: '4', effect: 'Weapon becomes force damage with light and thrown until rage ends.' },
      { roll: '5', effect: 'Attackers take 1d6 force when they hit you until rage ends.' },
      { roll: '6', effect: '+1 AC for you and allies within 10 feet until rage ends.' },
      { roll: '7', effect: 'Ground within 15 feet is difficult terrain for enemies until rage ends.' },
      { roll: '8', effect: 'Bolt of light: CON save or 1d6 radiant and blinded until your next turn.' }
    ]
  },
  {
    id: 'sorcerer-wild-magic-surge',
    name: 'Wild Magic Sorcerer — Wild Magic Surge',
    className: 'Sorcerer',
    subclass: 'Wild Magic',
    source: "Player's Handbook",
    dice: 'd100',
    note: 'After casting a sorcerer spell of 1st level+, DM may have you roll d20; on 1, roll this table.',
    rows: [
      { roll: '01–02', effect: 'Roll on this table at the start of each of your turns for the next minute.' },
      { roll: '99–00', effect: 'You regain all expended sorcery points.' }
    ]
  },
  {
    id: 'cleric-divine-intervention',
    name: 'Divine Intervention (success check)',
    className: 'Cleric',
    subclass: '',
    source: "Player's Handbook",
    dice: 'd100',
    note: 'At 10th level+: as an action, roll d100. If result ≤ cleric level, deity intervenes.',
    rows: [
      { roll: 'Success', effect: 'Roll ≤ cleric level on d100. DM chooses intervention.' },
      { roll: 'Failure', effect: 'No intervention. Retry after long rest (or 7 days after a success).' }
    ]
  }
];
