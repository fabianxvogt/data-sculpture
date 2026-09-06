# Data Sculpture docs

- `../README.md` — audience, quickstart, supported workflow, and honest bounds.
- `../ROADMAP.md` — v1 status, acceptance-oriented roadmap, and release record.
- `../../docs/projects/GAMES_VISUALS_CREATIVE.md` §63 — owner brief.

The implementation is intentionally local-first: `src/core.js` contains bounded parsing, profiles, deterministic mesh construction, and GLB/OBJ serialization; `src/main.js` contains the editor workflow.

## Publication status

The reviewed source and documentation are public at `fabianxvogt/data-sculpture`. The [public Site](https://data-sculpture.fabian523417.chatgpt.site) deploys historical Site version 1 from product source `1054244c830d083de083339f6f5a1dfdd31662a9`.

Fresh isolated browser evidence used a CSS viewport of `390×844` (not a physical-device claim). Data Sculpture loaded the synthetic example, kept the stacked source/canvas/mapping/export controls reachable, and passed immediate Fit with a `356×487.515625` canvas at `left=17`, `right=373`; Plotter Garden and Impossible Type public explicit Reopen behavior was intentional and observed. Native import/project reopen, broader device coverage, performance, and full-v1 limits remain open. HTTP asset correspondence is recorded separately from browser acceptance.
