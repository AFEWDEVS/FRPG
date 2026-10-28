const SAVE_KEY = 'frpg_save_v1';
const SETTINGS_KEY = 'frpg_settings_v1';

export interface Settings { music: number; sfx: number; }
export const DEFAULT_SETTINGS: Settings = { music: 0.6, sfx: 0.8 };

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch { return null; }
}
function write(key: string, v: unknown): void {
  try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* storage unavailable */ }
}

export const SaveManager = {
  hasSave(): boolean { return read(SAVE_KEY) !== null; },
  load<T>(): T | null { return read<T>(SAVE_KEY); },
  save(data: unknown): void { write(SAVE_KEY, data); },
  clear(): void { try { localStorage.removeItem(SAVE_KEY); } catch { /* noop */ } },
  loadSettings(): Settings { return { ...DEFAULT_SETTINGS, ...(read<Settings>(SETTINGS_KEY) ?? {}) }; },
  saveSettings(s: Settings): void { write(SETTINGS_KEY, s); },
};
