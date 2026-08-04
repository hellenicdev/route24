import './styles.css';
import { SettingsManager } from './core/settings';
import { createEngine } from './render/engineFactory';
import { createM0Scene } from './render/sceneFactory';
import { Game } from './core/game';
import { LoadingScreen } from './ui/loading';
import { Hud } from './ui/hud';
import { SettingsPanel } from './ui/settingsPanel';
import { byId } from './ui/dom';
import { InputManager } from './core/input';
import { DrivableBus } from './entities/drivableBus';
import { DEFAULT_BUS_ID, getBusConfig } from './data/busConfig';

async function main(): Promise<void> {
  const canvas = byId<HTMLCanvasElement>('game-canvas');
  const loading = new LoadingScreen(
    byId<HTMLDivElement>('loading-screen'),
    byId<HTMLDivElement>('loading-bar-fill'),
    byId<HTMLDivElement>('loading-status'),
  );

  loading.setProgress(0.05);
  loading.setStatus('Loading settings…');
  const settings = new SettingsManager();

  loading.setProgress(0.15);
  loading.setStatus('Starting graphics engine…');
  const { engine, kind } = await createEngine(canvas, settings.settings.renderer);

  loading.setProgress(0.45);
  loading.setStatus('Building scene…');
  const sceneHandle = createM0Scene(engine, { canvas });

  const hud = new Hud(
    {
      root: byId<HTMLDivElement>('hud'),
      fps: byId<HTMLSpanElement>('hud-fps'),
      ms: byId<HTMLSpanElement>('hud-ms'),
      speed: byId<HTMLDivElement>('hud-speed'),
      speedValue: byId<HTMLSpanElement>('hud-speed-value'),
      speedNeedle: byId<HTMLDivElement>('hud-speed-needle'),
      renderer: byId<HTMLSpanElement>('hud-renderer'),
      quality: byId<HTMLSpanElement>('hud-quality'),
    },
    engine,
  );

  loading.setProgress(0.7);
  loading.setStatus('Compiling render pipeline…');

  // Spawn the bus on the track ring, facing along the loop.
  const bus = new DrivableBus(sceneHandle.scene, getBusConfig(DEFAULT_BUS_ID), 150, 0, 0);
  const input = new InputManager();
  input.attach();
  input.attachPointer(canvas);

  const game = new Game({
    engine,
    rendererKind: kind,
    sceneHandle,
    settings,
    loading,
    hud,
    input,
    bus,
    onQualityChange: () => game.applySettings(),
  });
  hud.setRenderer(kind);

  new SettingsPanel({ settings, onChanged: () => game.applySettings() });
  window.addEventListener('beforeunload', () => {
    input.detach();
    input.detachPointer(canvas);
    game.dispose();
  });

  loading.setProgress(1);
  game.start();
}

main().catch((error: unknown) => {
  console.error('[route24] failed to start:', error);
  const errorScreen = document.getElementById('error-screen');
  const message = document.getElementById('error-message');
  if (errorScreen) errorScreen.classList.remove('hidden');
  if (message) message.textContent = error instanceof Error ? error.message : String(error);
  const loading = document.getElementById('loading-screen');
  if (loading) loading.classList.add('hidden');
});
