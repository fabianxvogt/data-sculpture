<!-- portfolio
{
  "title": "Data Sculpture",
  "topic": "Creative tools/Generative art",
  "type": "product",
  "description": "Turn datasets into sculptural 3D forms.",
  "demo": "https://data-sculpture.fabian523417.chatgpt.site"
}
-->

# Data Sculpture

Catalog 63 · a local-first editor for turning understandable data mappings into expressive three-dimensional forms.

**Status:** verification-ready v1. The first interaction opens the synthetic Tidal Archive example, showing a live mesh immediately. Change any mapping and the sculpture responds. Import bounded CSV/JSON, inspect retained rows and missing/extreme values, save a versioned `.dsproj`, reopen it, and export GLB, OBJ + MAP, or PNG.

**Source and public preview:** the reviewed source and documentation are published at [fabianxvogt/data-sculpture](https://github.com/fabianxvogt/data-sculpture). The [public Site](https://data-sculpture.fabian523417.chatgpt.site) runs historical Site version 1 from product source `1054244c830d083de083339f6f5a1dfdd31662a9`. A fresh isolated CSS viewport check at `390×844` loaded the synthetic example and passed immediate Fit: the `356×487.515625` canvas sat at `left=17`, `right=373` with the complete mesh inside. Plotter Garden and Impossible Type public explicit Reopen behavior was intentional and observed. Native import/project reopen, broader device coverage, performance, and full-v1 limits remain open.

## Run

```sh
npm install
npm test
npm run build
npm run dev -- --port 48113
```

Open the printed local URL. Everything is computed in the browser; files are never uploaded. Input is capped at 1 MB, 5,000 rows, and 32 fields. Missing coordinate values are retained at the midpoint and colored amber. GLB is the primary validated mesh format; OBJ is provided with a human-readable mapping sidecar.

## Supported workflow

1. Open the Tidal Archive example or import a local CSV/JSON.
2. Read the data-health table, then choose fields for length, lift, depth, volume, and hue.
3. Drag the canvas to orbit, scroll to zoom, and use the camera buttons for composition.
4. Save a `.dsproj` to reopen or reattach a local source later; export one GLB, OBJ, MAP, or PNG file per button action.

The editor is intentionally static and dependency-light. It uses a small custom canvas renderer and generates triangle meshes directly, so no GPU library or server is required.

The layout stacks source, canvas, mapping, and export controls below 780px. Fit uses the current viewport aspect, centers the projected bounds, and keeps a padding margin; a fitted view refits on resize, while manual camera edits remain manual. Downloads report when the browser action starts and clean up object URLs after a bounded delay.
