import type { Accidental, KeySignatureInfo, NoteAnnotation, SpanishPitch } from '../types';

export interface ChromaticNoteInfo {
  pitch: SpanishPitch;
  accidental: Accidental;
  semitoneIndex: number; // 0 to 11 (0 = DO)
}

// 12 chromatic pitches (preferring sharps)
export const CHROMATIC_SHARPS: { pitch: SpanishPitch; accidental: Accidental }[] = [
  { pitch: 'DO', accidental: '' },
  { pitch: 'DO', accidental: '#' },
  { pitch: 'RE', accidental: '' },
  { pitch: 'RE', accidental: '#' },
  { pitch: 'MI', accidental: '' },
  { pitch: 'FA', accidental: '' },
  { pitch: 'FA', accidental: '#' },
  { pitch: 'SOL', accidental: '' },
  { pitch: 'SOL', accidental: '#' },
  { pitch: 'LA', accidental: '' },
  { pitch: 'LA', accidental: '#' },
  { pitch: 'SI', accidental: '' },
];

// 12 chromatic pitches (preferring flats)
export const CHROMATIC_FLATS: { pitch: SpanishPitch; accidental: Accidental }[] = [
  { pitch: 'DO', accidental: '' },
  { pitch: 'RE', accidental: 'b' },
  { pitch: 'RE', accidental: '' },
  { pitch: 'MI', accidental: 'b' },
  { pitch: 'MI', accidental: '' },
  { pitch: 'FA', accidental: '' },
  { pitch: 'SOL', accidental: 'b' },
  { pitch: 'SOL', accidental: '' },
  { pitch: 'LA', accidental: 'b' },
  { pitch: 'LA', accidental: '' },
  { pitch: 'SI', accidental: 'b' },
  { pitch: 'SI', accidental: '' },
];

export const NATURAL_PITCHES: SpanishPitch[] = ['DO', 'RE', 'MI', 'FA', 'SOL', 'LA', 'SI'];

/**
 * Standard Key Signatures (Armaduras de Clave)
 * Order of sharps: FA, DO, SOL, RE, LA, MI, SI
 * Order of flats: SI, MI, LA, RE, SOL, DO, FA
 */
export const KEY_SIGNATURES_LIST: KeySignatureInfo[] = [
  // 0 alterations
  {
    name: 'Do Mayor',
    shortName: 'C',
    mode: 'major',
    semitoneOffset: 0,
    sharpsCount: 0,
    flatsCount: 0,
    alteredPitches: {},
  },
  {
    name: 'La menor',
    shortName: 'Am',
    mode: 'minor',
    semitoneOffset: 9,
    sharpsCount: 0,
    flatsCount: 0,
    alteredPitches: {},
  },
  // Sharps (Sostenidos)
  {
    name: 'Sol Mayor',
    shortName: 'G',
    mode: 'major',
    semitoneOffset: 7,
    sharpsCount: 1,
    flatsCount: 0,
    alteredPitches: { FA: '#' },
  },
  {
    name: 'Mi menor',
    shortName: 'Em',
    mode: 'minor',
    semitoneOffset: 4,
    sharpsCount: 1,
    flatsCount: 0,
    alteredPitches: { FA: '#' },
  },
  {
    name: 'Re Mayor',
    shortName: 'D',
    mode: 'major',
    semitoneOffset: 2,
    sharpsCount: 2,
    flatsCount: 0,
    alteredPitches: { FA: '#', DO: '#' },
  },
  {
    name: 'Si menor',
    shortName: 'Bm',
    mode: 'minor',
    semitoneOffset: 11,
    sharpsCount: 2,
    flatsCount: 0,
    alteredPitches: { FA: '#', DO: '#' },
  },
  {
    name: 'La Mayor',
    shortName: 'A',
    mode: 'major',
    semitoneOffset: 9,
    sharpsCount: 3,
    flatsCount: 0,
    alteredPitches: { FA: '#', DO: '#', SOL: '#' },
  },
  {
    name: 'Fa# menor',
    shortName: 'F#m',
    mode: 'minor',
    semitoneOffset: 6,
    sharpsCount: 3,
    flatsCount: 0,
    alteredPitches: { FA: '#', DO: '#', SOL: '#' },
  },
  {
    name: 'Mi Mayor',
    shortName: 'E',
    mode: 'major',
    semitoneOffset: 4,
    sharpsCount: 4,
    flatsCount: 0,
    alteredPitches: { FA: '#', DO: '#', SOL: '#', RE: '#' },
  },
  {
    name: 'Do# menor',
    shortName: 'C#m',
    mode: 'minor',
    semitoneOffset: 1,
    sharpsCount: 4,
    flatsCount: 0,
    alteredPitches: { FA: '#', DO: '#', SOL: '#', RE: '#' },
  },
  {
    name: 'Si Mayor',
    shortName: 'B',
    mode: 'major',
    semitoneOffset: 11,
    sharpsCount: 5,
    flatsCount: 0,
    alteredPitches: { FA: '#', DO: '#', SOL: '#', RE: '#', LA: '#' },
  },
  {
    name: 'Fa# Mayor',
    shortName: 'F#',
    mode: 'major',
    semitoneOffset: 6,
    sharpsCount: 6,
    flatsCount: 0,
    alteredPitches: { FA: '#', DO: '#', SOL: '#', RE: '#', LA: '#', MI: '#' },
  },
  // Flats (Bemoles)
  {
    name: 'Fa Mayor',
    shortName: 'F',
    mode: 'major',
    semitoneOffset: 5,
    sharpsCount: 0,
    flatsCount: 1,
    alteredPitches: { SI: 'b' },
  },
  {
    name: 'Re menor',
    shortName: 'Dm',
    mode: 'minor',
    semitoneOffset: 2,
    sharpsCount: 0,
    flatsCount: 1,
    alteredPitches: { SI: 'b' },
  },
  {
    name: 'Si♭ Mayor',
    shortName: 'Bb',
    mode: 'major',
    semitoneOffset: 10,
    sharpsCount: 0,
    flatsCount: 2,
    alteredPitches: { SI: 'b', MI: 'b' },
  },
  {
    name: 'Sol menor',
    shortName: 'Gm',
    mode: 'minor',
    semitoneOffset: 7,
    sharpsCount: 0,
    flatsCount: 2,
    alteredPitches: { SI: 'b', MI: 'b' },
  },
  {
    name: 'Mi♭ Mayor',
    shortName: 'Eb',
    mode: 'major',
    semitoneOffset: 3,
    sharpsCount: 0,
    flatsCount: 3,
    alteredPitches: { SI: 'b', MI: 'b', LA: 'b' },
  },
  {
    name: 'Do menor',
    shortName: 'Cm',
    mode: 'minor',
    semitoneOffset: 0,
    sharpsCount: 0,
    flatsCount: 3,
    alteredPitches: { SI: 'b', MI: 'b', LA: 'b' },
  },
  {
    name: 'La♭ Mayor',
    shortName: 'Ab',
    mode: 'major',
    semitoneOffset: 8,
    sharpsCount: 0,
    flatsCount: 4,
    alteredPitches: { SI: 'b', MI: 'b', LA: 'b', RE: 'b' },
  },
  {
    name: 'Re♭ Mayor',
    shortName: 'Db',
    mode: 'major',
    semitoneOffset: 1,
    sharpsCount: 0,
    flatsCount: 5,
    alteredPitches: { SI: 'b', MI: 'b', LA: 'b', RE: 'b', SOL: 'b' },
  },
  {
    name: 'Sol♭ Mayor',
    shortName: 'Gb',
    mode: 'major',
    semitoneOffset: 6,
    sharpsCount: 0,
    flatsCount: 6,
    alteredPitches: { SI: 'b', MI: 'b', LA: 'b', RE: 'b', SOL: 'b', DO: 'b' },
  },
];

/**
 * Returns KeySignatureInfo by name or fallback to Do Mayor
 */
export function getKeySignatureInfo(keyName: string = 'Do Mayor'): KeySignatureInfo {
  const clean = keyName.trim().toLowerCase();
  const found = KEY_SIGNATURES_LIST.find(
    (k) => k.name.toLowerCase() === clean || k.shortName.toLowerCase() === clean
  );
  return found || KEY_SIGNATURES_LIST[0];
}

/**
 * Computes the resulting transposed KeySignatureInfo given original key and semitones
 */
export function calculateTransposedKey(
  originalKeyName: string = 'Do Mayor',
  semitones: number = 0,
  preferFlats: boolean = false
): KeySignatureInfo {
  const orig = getKeySignatureInfo(originalKeyName);
  const targetOffset = (((orig.semitoneOffset + semitones) % 12) + 12) % 12;

  // Filter candidates of the same mode (major or minor)
  const candidates = KEY_SIGNATURES_LIST.filter(
    (k) => k.mode === orig.mode && k.semitoneOffset === targetOffset
  );

  if (candidates.length === 0) return orig;
  if (candidates.length === 1) return candidates[0];

  // If multiple (enharmonics like Fa# Mayor vs Solb Mayor, or Do# vs Reb)
  if (preferFlats) {
    const flatCandidate = candidates.find((c) => c.flatsCount > 0);
    return flatCandidate || candidates[0];
  } else {
    const sharpCandidate = candidates.find((c) => c.sharpsCount > 0);
    return sharpCandidate || candidates[0];
  }
}

/**
 * Returns default accidental for a given pitch based on the key signature armadura!
 */
export function getKeySignatureAccidental(pitch: SpanishPitch, keySignatureName: string): Accidental {
  const keyInfo = getKeySignatureInfo(keySignatureName);
  return keyInfo.alteredPitches[pitch] || '';
}

/**
 * Automatically detects key signature from a list of note annotations or chords
 */
export function detectKeySignatureFromNotes(notes: NoteAnnotation[]): string {
  if (notes.length === 0) return 'Do Mayor';

  // Check alterations in notes: count sharps and flats
  let sharpsCount = 0;
  let flatsCount = 0;
  const alteredMap: Partial<Record<SpanishPitch, number>> = {};

  notes.forEach((n) => {
    if (n.accidental === '#') {
      sharpsCount++;
      alteredMap[n.pitch] = (alteredMap[n.pitch] || 0) + 1;
    } else if (n.accidental === 'b') {
      flatsCount++;
      alteredMap[n.pitch] = (alteredMap[n.pitch] || 0) + 1;
    }
  });

  // Check the last note (often the tonic in melodies)
  const lastNote = notes[notes.length - 1];

  // 1 sharp (specifically FA#) -> Sol Mayor
  if (alteredMap['FA'] && alteredMap['FA'] > 0 && !alteredMap['DO']) {
    if (lastNote && lastNote.pitch === 'MI') return 'Mi menor';
    return 'Sol Mayor';
  }

  // 2 sharps (FA# and DO#) -> Re Mayor
  if (alteredMap['FA'] && alteredMap['DO'] && !alteredMap['SOL']) {
    if (lastNote && lastNote.pitch === 'SI') return 'Si menor';
    return 'Re Mayor';
  }

  // 3 sharps -> La Mayor
  if (alteredMap['FA'] && alteredMap['DO'] && alteredMap['SOL']) {
    return 'La Mayor';
  }

  // 1 flat (specifically SIb) -> Fa Mayor
  if (alteredMap['SI'] && alteredMap['SI'] > 0 && !alteredMap['MI']) {
    if (lastNote && lastNote.pitch === 'RE') return 'Re menor';
    return 'Fa Mayor';
  }

  // 2 flats (SIb and MIb) -> Si♭ Mayor
  if (alteredMap['SI'] && alteredMap['MI']) {
    return 'Si♭ Mayor';
  }

  // If no alterations, check first/last note
  if (lastNote) {
    if (lastNote.pitch === 'LA') return 'La menor';
    if (lastNote.pitch === 'DO') return 'Do Mayor';
  }

  return 'Do Mayor';
}

/**
 * Returns the semitone index (0 to 11) for a given Spanish pitch and accidental
 */
export function getSemitoneOffset(pitch: SpanishPitch, accidental: Accidental = ''): number {
  let base = 0;
  switch (pitch) {
    case 'DO': base = 0; break;
    case 'RE': base = 2; break;
    case 'MI': base = 4; break;
    case 'FA': base = 5; break;
    case 'SOL': base = 7; break;
    case 'LA': base = 9; break;
    case 'SI': base = 11; break;
  }

  if (accidental === '#') return (base + 1) % 12;
  if (accidental === 'b') return (base + 11) % 12;
  return base;
}

/**
 * Formats note text for standard sheet music annotation:
 * e.g. SOL, LA, MI, RE', DO', FA#'
 */
export function formatNoteDisplay(
  pitch: SpanishPitch,
  accidental: Accidental = '',
  octave: number = 4
): string {
  let text = pitch;
  if (accidental === '#') text += '#';
  else if (accidental === 'b') text += 'b';

  // Octave indicators:
  // 4 = standard baseline (no apostrophe)
  // 5 = high octave (')
  // 6 = double high ('')
  // 3 = low octave (,)
  // 2 = double low (,,)
  if (octave >= 5) {
    text += "'".repeat(octave - 4);
  } else if (octave <= 3) {
    text += ",".repeat(4 - octave);
  }

  return text;
}

/**
 * Parses user text input like "SOL", "la", "do'", "re#", "sib'", "fa#'"
 */
export function parseSpanishNoteInput(rawInput: string): {
  pitch: SpanishPitch;
  accidental: Accidental;
  octave: number;
} | null {
  const clean = rawInput.trim().toUpperCase();
  if (!clean) return null;

  // Match pitch
  let matchedPitch: SpanishPitch | null = null;
  let remaining = clean;

  const pitchCandidates: SpanishPitch[] = ['SOL', 'DO', 'RE', 'MI', 'FA', 'LA', 'SI'];
  for (const p of pitchCandidates) {
    if (clean.startsWith(p)) {
      matchedPitch = p;
      remaining = clean.slice(p.length);
      break;
    }
  }

  if (!matchedPitch) return null;

  // Match accidental
  let accidental: Accidental = '';
  if (remaining.startsWith('#') || remaining.startsWith('♯')) {
    accidental = '#';
    remaining = remaining.slice(1);
  } else if (remaining.startsWith('B') || remaining.startsWith('♭')) {
    accidental = 'b';
    remaining = remaining.slice(1);
  }

  // Match octave indicators: count ' or , or numbers
  let octave = 4;
  if (remaining.includes("'")) {
    const apostrophes = (remaining.match(/'/g) || []).length;
    octave = 4 + apostrophes;
  } else if (remaining.includes(',')) {
    const commas = (remaining.match(/,/g) || []).length;
    octave = 4 - commas;
  } else {
    const numMatch = remaining.match(/\d+/);
    if (numMatch) {
      octave = parseInt(numMatch[0], 10);
    }
  }

  return {
    pitch: matchedPitch,
    accidental,
    octave,
  };
}

/**
 * Transposes a single note by given semitones (+1, -1, +2, -2, etc.)
 */
export function transposeNote(
  note: NoteAnnotation,
  semitones: number,
  preferFlats: boolean = false
): NoteAnnotation {
  if (semitones === 0) return note;

  const currentOffset = getSemitoneOffset(note.pitch, note.accidental);
  // Total absolute semitones from C0
  const currentTotal = note.octave * 12 + currentOffset;
  const newTotal = currentTotal + semitones;

  const newOctave = Math.floor(newTotal / 12);
  const newOffset = ((newTotal % 12) + 12) % 12;

  const lookupTable = preferFlats ? CHROMATIC_FLATS : CHROMATIC_SHARPS;
  const targetNote = lookupTable[newOffset];

  return {
    ...note,
    pitch: targetNote.pitch,
    accidental: targetNote.accidental,
    octave: newOctave,
  };
}

/**
 * Transposes an array of notes
 */
export function transposeNotes(
  notes: NoteAnnotation[],
  semitones: number,
  preferFlats: boolean = false,
  selectedOnly: boolean = false
): NoteAnnotation[] {
  return notes.map((note) => {
    if (selectedOnly && !note.selected) {
      return note;
    }
    return transposeNote(note, semitones, preferFlats);
  });
}

/**
 * Calculates MIDI note number for audio playback
 * Middle C (DO 4) is MIDI 60
 */
export function getMidiNoteNumber(pitch: SpanishPitch, accidental: Accidental, octave: number): number {
  const semitone = getSemitoneOffset(pitch, accidental);
  // MIDI 60 is C4 (octave 4, semitone 0)
  return 12 * (octave + 1) + semitone;
}

/**
 * Calculates frequency in Hz from MIDI note number (A440 tuning)
 */
export function midiToFrequency(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/**
 * Human-readable description of transposition amount
 */
export function formatTransposeDescription(semitones: number): string {
  if (semitones === 0) return 'Tono original';
  const tones = Math.abs(semitones) / 2;
  const direction = semitones > 0 ? 'Subir' : 'Bajar';
  if (Math.abs(semitones) % 2 === 0) {
    return `${direction} ${tones} ${tones === 1 ? 'tono' : 'tonos'}`;
  } else {
    const wholeTones = Math.floor(tones);
    if (wholeTones === 0) {
      return `${direction} ½ tono (1 semitono)`;
    }
    return `${direction} ${wholeTones} tono y medio (${Math.abs(semitones)} semitonos)`;
  }
}
