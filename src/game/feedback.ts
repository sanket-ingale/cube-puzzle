import { useEffect } from 'react';
import { usePrefs } from '../ui/prefs';
import { useCubeStore } from './store';

/**
 * Sounds and vibration. Every sound is synthesised with the Web Audio API, so there are no
 * files to load. Browsers only allow audio after the visitor has interacted with the page, so
 * the audio context is created on the first tap, click or key press.
 */

let audio: AudioContext | null = null;
let noise: AudioBuffer | null = null;
let lastClick = 0;

function unlockAudio() {
  if (audio) return;
  try {
    audio = new AudioContext();
    // A short burst of white noise, filtered per click, sounds like plastic pieces snapping.
    noise = audio.createBuffer(1, Math.floor(audio.sampleRate * 0.05), audio.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  } catch {
    audio = null;
  }
}

function soundOn() {
  if (!usePrefs.getState().sound || !audio) return false;
  if (audio.state === 'suspended') void audio.resume();
  return true;
}

/** The click of a layer turning. Quieter when the app is turning it (scramble, replay). */
export function playTurn(byPlayer: boolean) {
  if (!soundOn() || !audio || !noise) return;
  const now = audio.currentTime;
  // Fast sequences would otherwise become a buzz.
  if (now - lastClick < 0.05) return;
  lastClick = now;

  const source = audio.createBufferSource();
  source.buffer = noise;
  const filter = audio.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 1800 + Math.random() * 400;
  filter.Q.value = 1.2;
  const gain = audio.createGain();
  gain.gain.setValueAtTime(byPlayer ? 0.5 : 0.18, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);
  source.connect(filter).connect(gain).connect(audio.destination);
  source.start(now);
  source.stop(now + 0.05);
}

/** A short rising run of notes. */
function chime(frequencies: number[], spacing: number, volume: number) {
  if (!soundOn() || !audio) return;
  const start = audio.currentTime + 0.02;
  frequencies.forEach((frequency, i) => {
    const t = start + i * spacing;
    const osc = audio!.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = frequency;
    const gain = audio!.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(volume, t + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    osc.connect(gain).connect(audio!.destination);
    osc.start(t);
    osc.stop(t + 0.55);
  });
}

/** C, E, G: the cube is solved. */
export const playSolve = () => chime([523.25, 659.25, 783.99], 0.09, 0.22);
/** A longer, higher run for a new personal best. */
export const playPersonalBest = () => chime([523.25, 659.25, 783.99, 1046.5, 1318.5], 0.08, 0.25);

/** Vibrates where the device supports it (Android browsers; not iPhones) and it's switched on. */
export function vibrate(pattern: number | number[]) {
  if (!usePrefs.getState().haptics) return;
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // Blocked, for example inside some embedded views.
  }
}

export const canVibrate = () => typeof navigator !== 'undefined' && 'vibrate' in navigator;

/** Plays feedback for turns (solves are marked by the solve recorder). Mount once, near the app root. */
export function useFeedback() {
  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener('pointerdown', unlock, { capture: true });
    window.addEventListener('keydown', unlock, { capture: true });

    const unsubscribe = useCubeStore.subscribe((state, previous) => {
      if (state.active && state.active.id !== previous.active?.id) {
        const byPlayer = state.mode === 'play';
        playTurn(byPlayer);
        if (byPlayer) vibrate(8);
      }
    });

    return () => {
      window.removeEventListener('pointerdown', unlock, { capture: true });
      window.removeEventListener('keydown', unlock, { capture: true });
      unsubscribe();
    };
  }, []);
}
