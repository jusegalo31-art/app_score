export type SpanishPitch = 'DO' | 'RE' | 'MI' | 'FA' | 'SOL' | 'LA' | 'SI';

export type Accidental = '' | '#' | 'b' | '♮';

export type NoteOrientation = 'horizontal' | 'diagonal';

export interface NoteAnnotation {
  id: string;
  pageNumber: number; // 1-indexed
  x: number; // Percentage (0 - 100) from left edge of page
  y: number; // Percentage (0 - 100) from top edge of page
  pitch: SpanishPitch;
  accidental: Accidental;
  octave: number; // Reference octave: 4 = DO base, 5 = DO' (agudo), 6 = DO'' (muy agudo), 3 = DO, (grave)
  customText?: string; // Optional chord or lyric (e.g. "G7", "C")
  color?: string; // Hex color for note text (default: #111827 or custom)
  fontSize?: number; // In px relative to standard view (default: 15)
  fontWeight?: 'normal' | 'bold';
  orientation?: NoteOrientation; // 'horizontal' or 'diagonal' (-55deg)
  selected?: boolean;
}

export interface KeySignatureInfo {
  name: string; // e.g. "Do Mayor", "Sol Mayor", "Fa Mayor"
  shortName: string; // e.g. "C", "G", "F"
  mode: 'major' | 'minor';
  semitoneOffset: number; // 0 for C, 7 for G, etc.
  sharpsCount: number;
  flatsCount: number;
  alteredPitches: Partial<Record<SpanishPitch, Accidental>>;
}

export interface ScoreProject {
  id: string;
  title: string;
  author?: string;
  createdAt: number;
  updatedAt: number;
  sourceType: 'pdf' | 'image' | 'sample';
  fileName: string;
  fileData: string; // Base64 data URL for PDF or image
  numPages: number;
  thumbnail?: string; // Base64 thumbnail preview of page 1
  notes: NoteAnnotation[];
  originalKey: string; // e.g. "Do Mayor", "Sol Mayor", "Fa Mayor"
  transposeHistory: number; // Net semitones transposed so far (e.g. +2 = 1 tono arriba)
  baseFontSize?: number; // Global note font size (default: 16)
  noteOrientation?: NoteOrientation; // 'horizontal' or 'diagonal'
  isPartituraFile?: boolean; // True if loaded from partituras/ folder
  partituraFilename?: string; // e.g. 'himno_001_santo_santo_santo.pdf'
  tags?: string[];
  instrument?: string;
}

export type EditorTool = 'select' | 'place' | 'erase';

export interface TransposeOptions {
  semitones: number;
  preferFlats: boolean;
  targetScope: 'all' | 'selected' | 'current_page';
}

export interface PartituraHymnItem {
  filename: string;
  number: string;
  title: string;
  sizeBytes: number;
  hasSavedNotes: boolean;
  savedNotesCount?: number;
  savedOriginalKey?: string;
}

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId: string;
}
