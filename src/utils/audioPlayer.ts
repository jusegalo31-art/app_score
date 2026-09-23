import type { NoteAnnotation } from '../types';
import { getMidiNoteNumber, midiToFrequency } from './musicTheory';

class AudioSynthesizer {
  private ctx: AudioContext | null = null;
  private isPlayingSequence = false;
  private currentTimeout: number | null = null;

  private initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  /**
   * Plays a single note with pleasant flute / bell / marimba timbre
   */
  public playNote(note: Pick<NoteAnnotation, 'pitch' | 'accidental' | 'octave'>, duration: number = 0.5) {
    try {
      this.initContext();
      if (!this.ctx) return;

      const midi = getMidiNoteNumber(note.pitch, note.accidental, note.octave);
      const freq = midiToFrequency(midi);

      const now = this.ctx.currentTime;

      // Master gain node with envelope
      const gainNode = this.ctx.createGain();
      gainNode.gain.setValueAtTime(0.0001, now);
      // Attack
      gainNode.gain.linearRampToValueAtTime(0.28, now + 0.04);
      // Decay & Sustain
      gainNode.gain.exponentialRampToValueAtTime(0.18, now + 0.15);
      // Release
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      // Lowpass filter to warm the timbre
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1400, now);
      filter.frequency.exponentialRampToValueAtTime(800, now + duration);

      // Oscillator 1: fundamental sine
      const osc1 = this.ctx.createOscillator();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(freq, now);

      // Oscillator 2: harmonic triangle for warmth
      const osc2 = this.ctx.createOscillator();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(freq, now);

      const osc2Gain = this.ctx.createGain();
      osc2Gain.gain.setValueAtTime(0.35, now);

      osc1.connect(gainNode);
      osc2.connect(osc2Gain);
      osc2Gain.connect(gainNode);
      gainNode.connect(filter);
      filter.connect(this.ctx.destination);

      osc1.start(now);
      osc2.start(now);

      osc1.stop(now + duration);
      osc2.stop(now + duration);
    } catch (e) {
      console.warn('Audio playback error:', e);
    }
  }

  /**
   * Plays sequence of notes sorted by reading position (top-to-bottom, left-to-right)
   */
  public playSequence(
    notes: NoteAnnotation[],
    bpm: number = 100,
    onNoteStart?: (noteId: string) => void,
    onFinish?: () => void
  ) {
    this.stopSequence();
    if (!notes.length) {
      if (onFinish) onFinish();
      return;
    }

    // Sort notes naturally by line (y coordinate grouped roughly within 5%) then by x
    const sorted = [...notes].sort((a, b) => {
      if (a.pageNumber !== b.pageNumber) return a.pageNumber - b.pageNumber;
      const yDiff = Math.abs(a.y - b.y);
      if (yDiff > 4.5) {
        return a.y - b.y;
      }
      return a.x - b.x;
    });

    this.isPlayingSequence = true;
    const intervalMs = (60 / bpm) * 1000 * 0.75;
    let index = 0;

    const step = () => {
      if (!this.isPlayingSequence || index >= sorted.length) {
        this.isPlayingSequence = false;
        if (onFinish) onFinish();
        return;
      }

      const note = sorted[index];
      this.playNote(note, 0.45);
      if (onNoteStart) {
        onNoteStart(note.id);
      }

      index++;
      this.currentTimeout = window.setTimeout(step, intervalMs);
    };

    step();
  }

  public stopSequence() {
    this.isPlayingSequence = false;
    if (this.currentTimeout !== null) {
      clearTimeout(this.currentTimeout);
      this.currentTimeout = null;
    }
  }

  public isRunning(): boolean {
    return this.isPlayingSequence;
  }
}

export const audioSynth = new AudioSynthesizer();
