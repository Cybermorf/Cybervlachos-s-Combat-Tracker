# Custom content templates

Use these JSON packs with **Tools → Compendium → Import JSON**.

| File | Purpose |
|------|---------|
| `custom-compendium-pack.template.json` | Full pack: races, classes, subclasses, feats, equipment, spells |

## Format

`format` should be `DSCToolkt-compendium-v2` (v1 packs with only spells/equipment still work).

### Player Companion
Players can import the same pack for **spells, equipment, races, classes, subclasses, feats**.
**Creatures / bestiary** are DM-only and are ignored on the Player app.

### Tips
- Use stable `id` values (lowercase, hyphens).
- Subclasses need `parentClass` matching a class name.
- Equipment `category`: `weapon` | `armor` | `shield` | `gear` | `tool`.
- Re-importing the same `id` **updates** the entry.
