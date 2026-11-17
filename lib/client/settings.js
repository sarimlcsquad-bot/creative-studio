'use client';
// Per-browser preferences: who is creating (owner/agency) and their name.
const KEY = 'cs.settings';

export function getSettings() {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { /* storage blocked */ }
  return { role: saved.role || 'owner', userName: saved.userName || '' };
}

export function saveSettings(patch) {
  const next = { ...getSettings(), ...patch };
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* storage blocked */ }
  return next;
}
