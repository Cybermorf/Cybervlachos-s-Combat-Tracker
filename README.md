# Cybervlachos's Combat Tracker

Standalone 5e combat tracker extracted from the Dark Sun Chronicles DM Toolkit.

## Features

- Full initiative tracker with turn structure (move, action, bonus, object interaction, reaction, legendary actions)
- Attack budget (Extra Attack), spell slots & upcasting, class resources (Ki, Lunar Charges, Rage, …)
- Smart targeting (self / ally / enemy / AoE) and Apply Effect
- Bestiary-backed creatures, villain/party import via JSON
- Tools: dice, class tables, Open5e/SRD import, CritterDB bulk helpers
- Export/import encounters and combat logs

## Use with DSC Toolkit / Player Companion

1. Export characters from the **DM Toolkit** or **Player Companion** as JSON.
2. In Combat Tracker → Tools, import JSON into the workspace roster (or add via Combat → Add from Party/Villains after importing into the workspace).
3. Data uses a separate `localStorage` key (`cybervlachos_combat_v1`) so it does not overwrite Toolkit campaigns.

## Deploy

Static site — open `index.html` locally or enable GitHub Pages on this repository.

## Related apps

- [DSCToolkt](https://github.com/Cybermorf/DSCToolkt) — full DM companion (campaign, party, DIE, …)
- [DSCPlayer-Companion](https://github.com/Cybermorf/DSCPlayer-Companion) — player character sheets
