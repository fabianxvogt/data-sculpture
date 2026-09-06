# Roadmap

## Now

- [x] Synthetic example with immediate live sculpture
- [x] Bounded CSV/JSON import with useful parse errors
- [x] Data-health inspection for nulls and extreme values
- [x] Field-to-geometry/color mapping and camera controls
- [x] Undo checkpointing, local versioned project save/reopen
- [x] GLB, OBJ + mapping explanation, and PNG export
- [x] Exact parser/normalization/mesh/export fixtures
- [x] Strict malformed-CSV and duplicate-header rejection
- [x] Versioned project schema caps and transactional import recovery
- [x] Nonparallel mesh frames for Z-only mappings with explicit degenerate-point errors
- [x] One-file export actions with truthful PNG failure feedback and bounded URL cleanup
- [x] Responsive stacked layout and aspect-aware padded camera fit
- [x] Centered projected-bound fit for asymmetric narrow viewports
- [x] Fitted-view intent survives aspect resize without overriding manual camera edits

## Next

- [ ] Add a small independent GLB fixture viewer check to CI
- [ ] Add explicit undo button and keyboard shortcut
- [ ] Add categorical palettes and selectable mesh styles

## Later

- [ ] Optional point-cloud and surface presets
- [ ] More camera presets and annotation callouts

## Done

- [x] Initialized repository on `codex/v1`; no parent repository was touched

## Release record

- State: verification after repair; independent review still required
- Try it: local static Vite build; private Site version 1 prepared, not deployed
- Source: reviewed source and docs published at `fabianxvogt/data-sculpture`; the Site remains private, unpublished, and browser-pending
- Compute: browser-only, bounded to 1 MB / 5,000 rows / 32 fields
- Persistence/export: `.dsproj` v1, GLB 2.0 binary, OBJ + MAP, PNG
- Classification: INCREMENTAL (EMPIRICAL verification in `test/core.test.js`; no novelty claim)
