# Route 24 — AGENTS.md

Browser-based realistic bus simulator. Frontend on GitHub Pages, backend (future) on Render.

## Commands

| Task             | Command                                      |
| ---------------- | -------------------------------------------- |
| Dev server       | `npm run dev`                                |
| Production build | `npm run build` (output: `dist/`)            |
| Type check       | `npm run typecheck`                          |
| Lint             | `npm run lint`                               |
| Tests            | `npm run test` (watch: `npm run test:watch`) |
| Format           | `npm run format` / `npm run format:check`    |

## Conventions

- **TypeScript strict** (`tsconfig.json`): `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax` — use `import type` for type-only imports; never assign `undefined` to optional fields.
- **ESLint** uses `typescript-eslint` strict + stylistic type-checked configs plus Prettier. `npm run lint` must pass in CI.
- **Tests**: Vitest, `node` environment. Files are colocated as `*.test.ts` next to the module they test. Core logic (settings, presets, event bus, drivetrain math later) must have tests; DOM and render code is kept out of unit tests.
- **No comments unless they explain a non-obvious decision.** Prefer expressive names.
- **Data-driven over hardcoded**: system configs live in `src/data/` as typed records with schema tests (`qualityPresets.ts` is the pattern; bus configs will follow).

## Architecture

```
src/
  core/     engine-agnostic logic: settings, events, input, loop, game
  render/   engine factory, quality pipeline (post-fx/shadows/fog), scene factory
  data/     data-driven configuration tables
  ui/       DOM overlays: loading screen, HUD, settings panel
  main.ts   bootstrap entry
```

Systems are decoupled: `RenderPipeline` owns all quality-dependent visuals;
`GameLoop` runs a fixed-timestep simulation (physics plugs into `simulate`);
the `SettingsManager` is the single source of truth for user preferences.

## Deployment

- GitHub Pages: `https://hellenicdev.github.io/route24/` — Vite `base: '/route24/'`.
- CI (`.github/workflows/ci.yml`): lint → typecheck → test → build → validate base path → deploy (main only).
- Renderer: WebGPU first (`WebGPUEngine.CreateAsync`), falls back to WebGL2.
- Babylon.js is imported via deep module paths (tree-shaken), never the full package.
