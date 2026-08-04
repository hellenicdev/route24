import type { QualityId, RendererPreference, SettingsManager } from '../core/settings';
import type { WeatherId } from '../data/weatherConfig';
import { QUALITY_PRESETS, resolveQualityId } from '../data/qualityPresets';
import { byId } from './dom';

export interface SettingsPanelDeps {
  settings: SettingsManager;
  /** Called after any setting changed; pipeline re-applies quality here. */
  onChanged: () => void;
}

/**
 * Graphics settings overlay bound to index.html controls.
 * Writes straight into the SettingsManager; quality changes are applied live
 * via onChanged(), renderer changes require a reload (noted in the UI).
 */
export class SettingsPanel {
  private readonly qualitySelect = byId<HTMLSelectElement>('setting-quality');
  private readonly rendererSelect = byId<HTMLSelectElement>('setting-renderer');
  private readonly weatherSelect = byId<HTMLSelectElement>('setting-weather');
  private readonly rescale = byId<HTMLInputElement>('setting-rescale');
  private readonly rescaleValue = byId<HTMLSpanElement>('setting-rescale-value');
  private readonly vsync = byId<HTMLInputElement>('setting-vsync');
  private readonly showFps = byId<HTMLInputElement>('setting-showfps');
  private readonly panel = byId<HTMLDivElement>('settings-panel');
  private readonly note = byId<HTMLParagraphElement>('settings-renderer-note');
  private readonly closeBtn = byId<HTMLButtonElement>('btn-settings-close');
  private readonly openBtn = byId<HTMLButtonElement>('btn-settings');

  constructor(private readonly deps: SettingsPanelDeps) {
    this.populateQualityOptions();
    this.readFromSettings();
    this.bindEvents();
  }

  private populateQualityOptions(): void {
    const options: [QualityId, string][] = [
      ['auto', 'Auto (detect)'],
      ['ultra', 'Ultra'],
      ['high', 'High'],
      ['medium', 'Medium'],
      ['low', 'Low'],
    ];
    for (const [value, label] of options) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      this.qualitySelect.appendChild(option);
    }
  }

  private readFromSettings(): void {
    const s = this.deps.settings.settings;
    this.qualitySelect.value = s.quality;
    this.rendererSelect.value = s.renderer;
    this.weatherSelect.value = s.weather;
    this.rescale.value = String(Math.round(s.resolutionScale * 100));
    this.rescaleValue.textContent = `${Math.round(s.resolutionScale * 100)}%`;
    this.vsync.checked = s.vsync;
    this.showFps.checked = s.showFrameStats;
  }

  private bindEvents(): void {
    this.qualitySelect.addEventListener('change', () => {
      this.deps.settings.update({ quality: this.qualitySelect.value as QualityId });
      this.deps.onChanged();
    });

    this.rendererSelect.addEventListener('change', () => {
      this.deps.settings.update({ renderer: this.rendererSelect.value as RendererPreference });
      this.note.classList.remove('hidden');
    });

    this.weatherSelect.addEventListener('change', () => {
      this.deps.settings.update({ weather: this.weatherSelect.value as WeatherId });
      this.deps.onChanged();
    });

    this.rescale.addEventListener('input', () => {
      const value = Number(this.rescale.value) / 100;
      this.rescaleValue.textContent = `${Math.round(value * 100)}%`;
      this.deps.settings.update({ resolutionScale: value });
      this.deps.onChanged();
    });

    this.vsync.addEventListener('change', () => {
      this.deps.settings.update({ vsync: this.vsync.checked });
      this.deps.onChanged();
    });

    this.showFps.addEventListener('change', () => {
      this.deps.settings.update({ showFrameStats: this.showFps.checked });
      this.deps.onChanged();
    });

    this.openBtn.addEventListener('click', () => this.panel.classList.remove('hidden'));
    this.closeBtn.addEventListener('click', () => this.panel.classList.add('hidden'));
    this.panel.addEventListener('click', (event) => {
      if (event.target === this.panel) this.panel.classList.add('hidden');
    });
  }

  /** Current resolved quality label for the HUD. */
  get qualityLabel(): string {
    const preset = QUALITY_PRESETS[resolveQualityId(this.deps.settings.settings.quality)];
    return preset.label;
  }
}
