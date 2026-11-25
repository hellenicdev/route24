# Route 24

A browser-based realistic bus simulator, built to be playable directly from a
web browser. Rendering with Babylon.js (WebGPU first, WebGL 2 fallback),
physics with Havok, TypeScript throughout.

**Live:** <https://hellenicdev.github.io/route24/>

## Status — Milestone 0 (foundation)

- Engine bootstrap with WebGPU → WebGL2 automatic fallback
- HDR-capable render pipeline: ACES tone mapping, adaptive exposure, cascaded
  shadow maps, SSAO, bloom, SSR, TAA/FXAA/MSAA, volumetric light scattering,
  glow, reflection probes
- Quality presets (Low / Medium / High / Ultra) with auto-detection, applied
  live from the in-game settings panel
- Fixed-timestep game loop ready for physics, input manager scaffold
- Loading screen, HUD (FPS / renderer / quality), error screen
- CI/CD: lint, typecheck, tests, build and auto-deploy to GitHub Pages

## Run locally

Requires Node.js 20 or newer.

```sh
git clone https://github.com/hellenicdev/route24.git
cd route24
npm install
npm run dev
```

| Command                              | What it does                                            |
| ------------------------------------ | ------------------------------------------------------- |
| `npm run dev`                        | Start the Vite dev server                               |
| `npm run build`                      | Production build into `dist/` (served from `/route24/`) |
| `npm run preview`                    | Preview the production build                            |
| `npm run lint` / `npm run typecheck` | ESLint and TypeScript checks                            |
| `npm test`                           | Unit tests (Vitest)                                     |
| `npm run format`                     | Format with Prettier                                    |

See `AGENTS.md` for conventions.

## Tech

- [Babylon.js](https://www.babylonjs.com/) 9 (WebGPU first, WebGL 2 fallback)
- Havok physics (planned for M1)
- TypeScript, Vite, Vitest, ESLint and Prettier
- GitHub Actions CI and GitHub Pages hosting

## Roadmap

1. **M1 — Drivable bus core**: procedural PBR bus, Havok vehicle physics,
   drivetrain (auto/manual/retarder), cockpit systems, doors/lights/wipers,
   camera rig + real mirror reflections, positional audio, test track
2. M2 — World: chunked city, road graph, traffic lights, traffic AI
3. M3 — Routes: timetables, stops, passenger AI, ticketing, economy, saves
4. M4 — Weather & time of day
5. M5 — Audio world pass
6. M6 — Backend (Render + MongoDB): accounts, cloud saves, stats, leaderboards
7. M7 — Multiplayer (WebSocket)

## License

No license has been chosen yet, so all rights are reserved by the author for now.

## Credits

Made by [HellenicDev](https://hellenicdev.eu). More projects at <https://hellenicdev.eu>.
