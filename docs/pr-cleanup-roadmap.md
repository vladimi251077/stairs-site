# PR cleanup roadmap

This document keeps the repository workflow clean after several overlapping Codex PRs.

## Current open PR status

### Closed as duplicates

- #9: superseded by #10. Contact floating menu was already resolved in the merged expandable contact menu work.
- #52: superseded by #53 and #57. Email recipient persistence and diagnostics are already covered by newer merged work.

### Keep open only as reference

- #46: marked `[DO NOT MERGE]`. Valuable engine v2 work exists there, but it mixes geometry engine, result visualization, and page/UI changes. It must be split before merging.
- #49: marked `[REFERENCE ONLY]`. Useful Step 1 visual-first ideas, but it overlaps with already merged #48 and should be rebuilt as a clean UI-only PR.

## Correct future PR structure

### 1. Site visual system PR

Purpose: make all public pages look like one premium Tekstura website.

Scope:
- shared header/footer across public pages;
- shared buttons, cards, forms, containers, empty states;
- reduce inline CSS in `projects.html`, `project.html`, `services.html`, `request.html`;
- keep calculator-specific CSS separate.

Do not include:
- geometry engine changes;
- pricing changes;
- Supabase schema changes;
- calculator Step 1 redesign.

### 2. Calculator engine v2 minimal PR

Purpose: safely extract the useful engine improvements from #46.

Scope:
- `stair-geometry-engine.js`;
- minimal compatibility changes in `stair-configurator.js`;
- diagnostics, metrics, fit/headroom, alternatives;
- no public page redesign.

Do not include:
- `index.html` redesign;
- `projects.html` redesign;
- Step 1 visual redesign;
- marketing copy changes.

### 3. Calculator Step 1 UI PR

Purpose: rebuild Step 1 as a clean diagram-first scenario UI.

Scope:
- `calculator.html`;
- `stair-configurator.css`;
- minimal controller wiring in `stair-configurator.js`;
- separate flows for `empty_opening` and `ready_frame`;
- top/side scheme layout;
- mobile-first validation.

Do not include:
- engine algorithm changes;
- pricing changes;
- unrelated pages.

### 4. Calculator result / Step 2 PR

Purpose: make geometry results understandable to a non-engineer.

Scope:
- recommended variant card;
- alternatives cards;
- human-readable warnings;
- plan/elevation rendering improvements;
- manual engineering review CTA.

Depends on:
- engine v2 minimal PR.

### 5. Request and lead UX PR

Purpose: make the request page feel like a premium engineering handoff.

Scope:
- better calculated summary card;
- clear success state;
- upload/photo/plan field if supported;
- contact preference;
- no false email success messages.

Do not include:
- notify API refactor unless required;
- calculator geometry work.

## Merge rules from now on

1. One PR = one responsibility.
2. No mixed PRs that combine engine + UI + homepage + projects.
3. Keep risky redesigns as draft/reference until manually reviewed.
4. If a later PR supersedes an earlier one, close the earlier PR with a comment.
5. Mark experimental PRs clearly as `[REFERENCE ONLY]` or `[DO NOT MERGE]`.
