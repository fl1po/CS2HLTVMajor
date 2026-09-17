# Domain glossary

Shared vocabulary for the CS2 HLTV Major Enhancer. Use these terms when
discussing the code so reviews and refactors share one language.

## Terms

**Major**
A CS2 tournament event on HLTV, identified by its `title` (the event-hub
title text). Picks are persisted in `localStorage` keyed by this title.

**Pick'Ems**
The user's predictions for a Major. Stored per Major and overlaid onto the
HLTV event page by this extension.

**Group stage**
The Swiss stage of a Major. It is either the **Challengers** stage or the
**Legends** stage. Group picks are made via a `<select>` next to each team.

**Playoff stage** / **Champions**
The bracket. The playoff stage key is always `champions`. Playoff picks are
made via a checkbox on each bracket team.

A Major draws one single-elimination bracket. Other events draw a double
elimination bracket — two tiers (upper/lower), padded with empty spacer rounds
so the tiers line up — and an event with group playoffs draws one bracket per
group, so there can be several on a page. Three consequences the selectors have
to respect:

- A bracket team's `innerText` is **not** its name. HLTV hides `.team-name`
  while a round is collapsed (`display: none`) and floats the score next to it,
  so `innerText` reads `""` or `"MOUZ\n1"`. The name is only in `.team-name`.
- A round header shows the round's **short** name while collapsed and its full
  name while expanded, and the header is the click target that toggles it — so
  the visible text is not a stable key. The canonical name comes from the
  `data-slotted-bracket-json` model on the placeholder.
- Round ids run across every bracket on the page and count the spacer rounds,
  so a pick's key stays unique and stable no matter how the tiers are drawn.

**Group pick value** — one of:
- `advance` — predicted to advance (3-1 or 3-2)
- `3-0` — predicted to go 3-0
- `0-3` — predicted to go 0-3

Limits per Major group stage: at most **6** `advance`, **2** `3-0`, **2**
`0-3`. Once a limit is reached, that option disappears from the other teams'
`<select>`s.

**Result state**
A team's actual Swiss record string (e.g. `3-0`, `2-3`, `0-3`), scraped from
the standings. Compared against the group pick value to decide the outcome.

**Pick outcome** — derived by comparing pick value to result state:
- **won** — the pick matched the actual result
- **lost** — the pick is contradicted by the actual result
- pending — not yet decided

**Overview tab** vs **Matches tab**
HLTV event-hub tabs. The **Overview** tab shows the standings + bracket (where
picks are made); the **Matches** tab shows live/upcoming matches (where playoff
picks are highlighted only). `activeTab()` distinguishes them.

## Modules (architecture)

- **PickemsStore** — the persistence seam; the only place `localStorage`/`JSON`
  are touched. Hides the on-disk `{ [title]: { [stage]: { ...picks } } }` shape
  behind per-Major intent-level operations.
- **HltvPage** — the selector seam; the only place HLTV's DOM classes are read.
  Returns handles carrying the live nodes the orchestrator mutates.
- **setData** — the orchestrator: reads the page via HltvPage, reads/writes
  picks via PickemsStore, dispatches to the group flow or playoff flow, then
  applies the styling pass.
