/**
 * Theme store: Device / Light / Dark preference, persisted to localStorage and applied as
 * `data-theme` on <html>. index.html's inline head script does the same resolution
 * synchronously pre-paint (to avoid a flash of the wrong theme); this store takes over once
 * React boots, and additionally reacts live to OS theme changes when the pref is "device".
 */
import { create } from 'zustand';

const STORAGE_KEY = 'theme-pref';
const VALID = ['device', 'light', 'dark'];

function resolve(pref) {
  if (pref === 'dark') return 'dark';
  if (pref === 'light') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function apply(pref) {
  document.documentElement.setAttribute('data-theme', resolve(pref));
}

function readStored() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return VALID.includes(v) ? v : 'device';
  } catch {
    return 'device';
  }
}

export const useThemeStore = create((set) => ({
  pref: readStored(),

  setPref: (pref) => {
    if (!VALID.includes(pref)) return;
    try {
      localStorage.setItem(STORAGE_KEY, pref);
    } catch {
      /* best-effort persistence */
    }
    apply(pref);
    set({ pref });
  },
}));

// Apply once on module load (React may boot after the inline script's pref changed via the OS).
apply(useThemeStore.getState().pref);

// Live-follow OS changes while the pref is "device".
if (typeof window !== 'undefined' && window.matchMedia) {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (useThemeStore.getState().pref === 'device') apply('device');
  });
}
