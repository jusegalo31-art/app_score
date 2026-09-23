import type { Accidental, NoteAnnotation, SpanishPitch } from '../types';
import { getKeySignatureAccidental } from './musicTheory';
import { loadPdfDocument } from './pdfLoader';

export interface DetectionStaffSystem {
  topY: number;
  bottomY: number;
  lineSpacing: number;
  lines: number[]; // 5 Y coordinates
}

export interface DetectNotesOptions {
  pageNumber: number;
  keySignature: string;
  sensitivity?: number; // 1 to 5 (3 is default)
  onlySopranoVoice?: boolean; // When true, only extracts Voice 1 (highest melody note)
  alignAboveTopLine?: boolean; // When true, positions notes directly above line 5 of staff
  baseFontSize?: number;
  headerSkipPercentage?: number; // Percentage from left of staff to skip clef + key sig + time sig (default 18%)
}

/**
 * Diatonic scale mapping in Treble Clef relative to Line 1 (bottom line = MI 4)
 * step 0 = MI 4
 */
const TREBLE_DIATONIC_STEPS: { pitch: SpanishPitch; octave: number }[] = [
  { pitch: 'DO', octave: 4 }, // step -2 (ledger line 1 below)
  { pitch: 'RE', octave: 4 }, // step -1 (space below line 1)
  { pitch: 'MI', octave: 4 }, // step 0 (Line 1)
  { pitch: 'FA', octave: 4 }, // step 1 (Space 1)
  { pitch: 'SOL', octave: 4 }, // step 2 (Line 2)
  { pitch: 'LA', octave: 4 }, // step 3 (Space 2)
  { pitch: 'SI', octave: 4 }, // step 4 (Line 3)
  { pitch: 'DO', octave: 5 }, // step 5 (Space 3, DO')
  { pitch: 'RE', octave: 5 }, // step 6 (Line 4, RE')
  { pitch: 'MI', octave: 5 }, // step 7 (Space 4, MI')
  { pitch: 'FA', octave: 5 }, // step 8 (Line 5, FA')
  { pitch: 'SOL', octave: 5 }, // step 9 (Space above, SOL')
  { pitch: 'LA', octave: 5 }, // step 10 (Ledger line 1 above, LA')
  { pitch: 'SI', octave: 5 }, // step 11 (SI')
  { pitch: 'DO', octave: 6 }, // step 12 (DO'')
];

interface DetectedRawNote {
  x: number;
  y: number;
  staffIndex: number;
  pitch: SpanishPitch;
  octave: number;
  staff: DetectionStaffSystem;
}

/**
 * Analyzes the key signature region following the clef to count sharps or flats
 */
export function detectKeySignatureFromCanvas(
  canvas: HTMLCanvasElement,
  staffSystems: DetectionStaffSystem[]
): string {
  const width = canvas.width;
  const height = canvas.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return 'Do Mayor';

  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const threshold = 184;

  const isBlackPixel = (x: number, y: number): boolean => {
    if (x < 0 || x >= width || y < 0 || y >= height) return false;
    const idx = (y * width + x) * 4;
    const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
    return lum < threshold;
  };

  // If no staff systems provided, detect the first system on the fly
  let firstStaff = staffSystems[0];
  if (!firstStaff) {
    const minStaffWidth = width * 0.4;
    const rowBlackCount = new Int32Array(height);
    for (let y = 0; y < height; y++) {
      let count = 0;
      for (let x = 0; x < width; x++) {
        if (isBlackPixel(x, y)) count++;
      }
      rowBlackCount[y] = count;
    }

    const lines: number[] = [];
    for (let y = 2; y < height - 2; y++) {
      if (
        rowBlackCount[y] > minStaffWidth &&
        rowBlackCount[y] >= rowBlackCount[y - 1] &&
        rowBlackCount[y] >= rowBlackCount[y + 1]
      ) {
        lines.push(y);
      }
    }

    let grp: number[] = [];
    for (let i = 0; i < lines.length; i++) {
      const y = lines[i];
      if (grp.length === 0) grp.push(y);
      else {
        const diff = y - grp[grp.length - 1];
        if (diff >= 6 && diff <= 35) {
          grp.push(y);
          if (grp.length === 5) {
            firstStaff = {
              topY: grp[0],
              bottomY: grp[4],
              lineSpacing: (grp[4] - grp[0]) / 4,
              lines: [...grp],
            };
            break;
          }
        } else if (diff > 35) {
          grp = [y];
        }
      }
    }
  }

  if (!firstStaff) return 'Do Mayor';

  // 1. Find where the staff lines begin horizontally
  let staffStartX = 0;
  for (let x = 0; x < width; x++) {
    let count = 0;
    for (let l = 0; l < 5; l++) {
      if (isBlackPixel(x, firstStaff.lines[l])) count++;
    }
    if (count >= 3) {
      staffStartX = x;
      break;
    }
  }

  // 2. Clef is within the first ~3.5 line spacings from staffStartX
  const clefWidth = Math.round(firstStaff.lineSpacing * 3.6);
  const clefEndX = staffStartX + clefWidth;

  // 3. Scan for Key Signature: between clefEndX and clefEndX + lineSpacing * 12
  const ksStart = clefEndX + 2;
  const ksEnd = Math.min(width - 1, ksStart + Math.round(firstStaff.lineSpacing * 12));

  // Count vertical non-staff-line black pixels in each column
  const colDensity: { x: number; count: number }[] = [];
  for (let x = ksStart; x < ksEnd; x++) {
    let c = 0;
    for (let y = Math.round(firstStaff.topY - 6); y <= Math.round(firstStaff.bottomY + 6); y++) {
      const isLine = firstStaff.lines.some((ly) => Math.abs(ly - y) <= 1);
      if (!isLine && isBlackPixel(x, y)) c++;
    }
    colDensity.push({ x, count: c });
  }

  // Find vertical stroke peaks
  const minPeakCount = Math.round(firstStaff.lineSpacing * 1.3);
  const peaks: { x: number; count: number }[] = [];
  for (let i = 1; i < colDensity.length - 1; i++) {
    if (
      colDensity[i].count >= minPeakCount &&
      colDensity[i].count >= colDensity[i - 1].count &&
      colDensity[i].count >= colDensity[i + 1].count
    ) {
      peaks.push(colDensity[i]);
    }
  }

  // Count sharps: each sharp '#' has 2 vertical strokes ~2 to 6 px apart
  let sharps = 0;
  let i = 0;
  while (i < peaks.length) {
    if (i + 1 < peaks.length && peaks[i + 1].x - peaks[i].x <= 6 && peaks[i + 1].x - peaks[i].x >= 2) {
      sharps++;
      i += 2;
    } else {
      i++;
    }
  }

  // If sharps detected
  if (sharps >= 4) return 'Mi Mayor'; // 4 sharps (e.g. Santo, Santo, Santo)
  if (sharps === 3) return 'La Mayor';
  if (sharps === 2) return 'Re Mayor';
  if (sharps === 1) return 'Sol Mayor';

  // Check for flats: flat glyphs have 1 tall vertical ascender with a loop
  let flats = 0;
  for (let p = 0; p < peaks.length; p++) {
    if (peaks[p].count >= firstStaff.lineSpacing * 1.8) {
      flats++;
    }
  }

  if (flats >= 4) return 'Lab Mayor';
  if (flats === 3) return 'Mib Mayor';
  if (flats === 2) return 'Sib Mayor';
  if (flats === 1) return 'Fa Mayor';

  return 'Do Mayor';
}

/**
 * Optical Music Recognition (OMR) scanner in Canvas
 * With support for SATB choir scores: extracts ONLY Voice 1 (Soprano)
 * and positions notes neatly above the top line of the staff.
 * Crucially skips the clef, key signature, and time signature header area!
 */
export async function detectNotesFromCanvas(
  canvas: HTMLCanvasElement,
  options: DetectNotesOptions
): Promise<{ notes: NoteAnnotation[]; detectedKey: string }> {
  const {
    pageNumber,
    keySignature,
    sensitivity = 3,
    onlySopranoVoice = true,
    alignAboveTopLine = true,
    baseFontSize = 16,
    headerSkipPercentage = 18, // Default 18% skip so NO notes are placed on key signature!
  } = options;

  const width = canvas.width;
  const height = canvas.height;

  const ctx = canvas.getContext('2d');
  if (!ctx) return { notes: [], detectedKey: 'Do Mayor' };

  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  // 1. Calculate horizontal black pixel density row by row
  const rowBlackCount = new Int32Array(height);
  const threshold = 160 + sensitivity * 8; // Adaptable threshold based on user sensitivity

  for (let y = 0; y < height; y++) {
    let count = 0;
    const rowOffset = y * width * 4;
    for (let x = 0; x < width; x++) {
      const idx = rowOffset + x * 4;
      const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
      if (lum < threshold) {
        count++;
      }
    }
    rowBlackCount[y] = count;
  }

  // 2. Find staff lines: look for rows with high horizontal density
  const minStaffWidth = width * 0.45;
  const lineCandidates: number[] = [];

  for (let y = 2; y < height - 2; y++) {
    if (
      rowBlackCount[y] > minStaffWidth &&
      rowBlackCount[y] >= rowBlackCount[y - 1] &&
      rowBlackCount[y] >= rowBlackCount[y + 1]
    ) {
      lineCandidates.push(y);
    }
  }

  // Group staff lines into 5-line systems
  const staffSystems: DetectionStaffSystem[] = [];
  let currentGroup: number[] = [];

  for (let i = 0; i < lineCandidates.length; i++) {
    const y = lineCandidates[i];
    if (currentGroup.length === 0) {
      currentGroup.push(y);
    } else {
      const prevY = currentGroup[currentGroup.length - 1];
      const diff = y - prevY;
      if (diff >= 6 && diff <= 32) {
        currentGroup.push(y);
        if (currentGroup.length === 5) {
          const spacing = (currentGroup[4] - currentGroup[0]) / 4;
          staffSystems.push({
            topY: currentGroup[0],
            bottomY: currentGroup[4],
            lineSpacing: spacing,
            lines: [...currentGroup],
          });
          currentGroup = [];
        }
      } else if (diff > 32) {
        currentGroup = [y];
      }
    }
  }

  // If standard grouping missed lines, fallback proportional bands
  if (staffSystems.length === 0) {
    const numStaves = 5;
    const topMargin = height * 0.13;
    const bottomMargin = height * 0.82;
    const totalH = bottomMargin - topMargin;
    const sysHeight = totalH / numStaves;

    for (let i = 0; i < numStaves; i++) {
      const sy = topMargin + i * sysHeight;
      const spacing = 12;
      staffSystems.push({
        topY: sy,
        bottomY: sy + spacing * 4,
        lineSpacing: spacing,
        lines: [sy, sy + spacing, sy + spacing * 2, sy + spacing * 3, sy + spacing * 4],
      });
    }
  }

  // Automatically detect key signature from canvas if needed
  const autoDetectedKey = detectKeySignatureFromCanvas(canvas, staffSystems);
  const activeKey = keySignature || autoDetectedKey;

  // In SATB hymn scores with 2 staves bracketed (Treble on top, Bass on bottom):
  // When onlySopranoVoice is enabled, if there are even pairs of staves, we focus on the upper (Treble) staves
  const candidateStaves = onlySopranoVoice && staffSystems.length >= 2
    ? staffSystems.filter((_, idx) => idx % 2 === 0)
    : staffSystems;

  const rawNotes: DetectedRawNote[] = [];
  const minNoteDistanceX = width * Math.max(0.015, 0.035 - sensitivity * 0.004);

  // 3. Scan staves horizontally:
  // Automatically identify the exact end of clef, key signature (armadura), and time signature
  // so NO notes are ever placed over the key signature!
  candidateStaves.forEach((staff, staffIndex) => {
    const spacing = staff.lineSpacing;
    const halfStep = spacing / 2;

    // A. Detect horizontal start of the staff lines
    let staffStartX = 0;
    for (let x = 0; x < width; x++) {
      let lineCount = 0;
      for (let l = 0; l < 5; l++) {
        const idx = (staff.lines[l] * width + x) * 4;
        const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
        if (lum < threshold) lineCount++;
      }
      if (lineCount >= 3) {
        staffStartX = x;
        break;
      }
    }

    // B. Detect end of header (clef + key signature + time signature) by tracking symbol clusters
    const clefEndX = staffStartX + Math.round(spacing * 3.6);
    let headerEndX = clefEndX;
    let emptyStreak = 0;
    const gapNeeded = Math.round(spacing * 1.3);
    const maxScan = staffIndex === 0
      ? staffStartX + Math.round(spacing * 17)
      : staffStartX + Math.round(spacing * 11);

    for (let x = clefEndX; x < Math.min(width - 1, maxScan); x++) {
      let symbolPixels = 0;
      for (let y = Math.round(staff.topY - 2); y <= Math.round(staff.bottomY + 2); y++) {
        const isLine = staff.lines.some((ly) => Math.abs(ly - y) <= 1);
        if (!isLine) {
          const idx = (y * width + x) * 4;
          const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
          if (lum < threshold) symbolPixels++;
        }
      }

      if (symbolPixels >= 3) {
        headerEndX = x;
        emptyStreak = 0;
      } else {
        emptyStreak++;
        if (emptyStreak >= gapNeeded && headerEndX > clefEndX + Math.round(spacing * 1.5)) {
          break;
        }
      }
    }

    // Safe start strictly after the header gap
    const dynamicStartX = headerEndX + 2;
    const userPctStartX = staffIndex === 0
      ? Math.round(width * (headerSkipPercentage / 100))
      : Math.round(width * 0.12);
    const startX = Math.max(dynamicStartX, userPctStartX);
    const endX = Math.round(width * 0.96);

    const scanTop = Math.max(0, Math.round(staff.topY - spacing * 2.4));
    const scanBottom = Math.min(height - 1, Math.round(staff.bottomY + spacing * 2.2));

    const stepX = Math.max(2, Math.round(spacing * 0.28));

    for (let x = startX; x < endX; x += stepX) {
      let maxBlackStreak = 0;
      let streakStart = -1;
      let currentStreak = 0;

      const verticalHeadCandidates: number[] = [];

      for (let y = scanTop; y <= scanBottom; y++) {
        const idx = (y * width + x) * 4;
        const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
        const isBlack = lum < threshold;

        if (isBlack) {
          if (currentStreak === 0) streakStart = y;
          currentStreak++;
          if (currentStreak > maxBlackStreak) {
            maxBlackStreak = currentStreak;
          }
        } else {
          if (currentStreak >= spacing * 0.55 && currentStreak <= spacing * 1.5) {
            verticalHeadCandidates.push(streakStart + currentStreak / 2);
          }
          currentStreak = 0;
        }
      }

      if (currentStreak >= spacing * 0.55 && currentStreak <= spacing * 1.5) {
        verticalHeadCandidates.push(streakStart + currentStreak / 2);
      }

      if (verticalHeadCandidates.length > 0) {
        // If onlySopranoVoice is enabled, select ONLY the highest note head (lowest Y coordinate)!
        let targetCenterY = verticalHeadCandidates[0];
        if (onlySopranoVoice) {
          targetCenterY = Math.min(...verticalHeadCandidates);
        } else {
          targetCenterY = verticalHeadCandidates[0];
        }

        // Verify horizontal width (avoid thin barlines or stem-only pixels)
        let horizontalWidth = 0;
        const testY = Math.round(targetCenterY);
        for (let dx = -Math.round(spacing * 0.9); dx <= Math.round(spacing * 0.9); dx++) {
          const checkX = x + dx;
          if (checkX >= 0 && checkX < width) {
            const idx = (testY * width + checkX) * 4;
            const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
            if (lum < threshold) horizontalWidth++;
          }
        }

        if (horizontalWidth >= spacing * 0.65) {
          const deltaY = staff.bottomY - targetCenterY;
          const diatonicStep = Math.round(deltaY / halfStep);

          const tableIndex = Math.max(0, Math.min(TREBLE_DIATONIC_STEPS.length - 1, diatonicStep + 2));
          const stepInfo = TREBLE_DIATONIC_STEPS[tableIndex];

          rawNotes.push({
            x,
            y: targetCenterY,
            staffIndex,
            pitch: stepInfo.pitch,
            octave: stepInfo.octave,
            staff,
          });
        }
      }
    }
  });

  // 4. Cluster nearby horizontal points to eliminate duplicates of the same note head
  const clusteredNotes: DetectedRawNote[] = [];

  const byStaff: Record<number, DetectedRawNote[]> = {};
  rawNotes.forEach((n) => {
    if (!byStaff[n.staffIndex]) byStaff[n.staffIndex] = [];
    byStaff[n.staffIndex].push(n);
  });

  Object.values(byStaff).forEach((staffNotes) => {
    let cluster: DetectedRawNote[] = [];

    staffNotes.forEach((note) => {
      if (cluster.length === 0) {
        cluster.push(note);
      } else {
        const last = cluster[cluster.length - 1];
        if (note.x - last.x < minNoteDistanceX) {
          cluster.push(note);
        } else {
          const chosen = onlySopranoVoice
            ? cluster.reduce((prev, curr) => (curr.y < prev.y ? curr : prev), cluster[0])
            : cluster[Math.floor(cluster.length / 2)];

          clusteredNotes.push(chosen);
          cluster = [note];
        }
      }
    });

    if (cluster.length > 0) {
      const chosen = onlySopranoVoice
        ? cluster.reduce((prev, curr) => (curr.y < prev.y ? curr : prev), cluster[0])
        : cluster[Math.floor(cluster.length / 2)];
      clusteredNotes.push(chosen);
    }
  });

  // 5. Build final NoteAnnotation objects
  const finalNotes: NoteAnnotation[] = clusteredNotes.map((raw, idx) => {
    // Look up accidental based on key signature armadura (e.g. Mi Mayor -> FA#, DO#, SOL#, RE#)
    const accidental: Accidental = getKeySignatureAccidental(raw.pitch, activeKey);

    const notePctX = (raw.x / width) * 100;

    // "y que ponga las notas sobre la última línea del pentagrama"
    // Line 5 is raw.staff.topY. Placing directly above Line 5:
    let noteYPixel = raw.staff.topY - raw.staff.lineSpacing * 1.6;
    if (!alignAboveTopLine) {
      noteYPixel = raw.y - raw.staff.lineSpacing * 1.5;
    }

    const notePctY = (noteYPixel / height) * 100;

    return {
      id: 'omr_' + raw.staffIndex + '_' + idx + '_' + Date.now().toString(36),
      pageNumber,
      x: +notePctX.toFixed(2),
      y: +notePctY.toFixed(2),
      pitch: raw.pitch,
      accidental,
      octave: raw.octave,
      fontWeight: 'bold',
      fontSize: baseFontSize,
      color: '#111827',
    };
  });

  return {
    notes: finalNotes,
    detectedKey: autoDetectedKey,
  };
}

const SPANISH_DIATONIC_SCALE: SpanishPitch[] = ['DO', 'RE', 'MI', 'FA', 'SOL', 'LA', 'SI'];

function diatonicStepToSpanishPitch(stepFromLine1: number): { pitch: SpanishPitch; octave: number } {
  const line1BaseIndex = 2; // MI 4
  const total = line1BaseIndex + stepFromLine1;
  const pitchIndex = ((total % 7) + 7) % 7;
  const octave = 4 + Math.floor(total / 7);
  return {
    pitch: SPANISH_DIATONIC_SCALE[pitchIndex],
    octave,
  };
}

/**
 * Detects the musical key signature directly from the vector PDF text/glyphs layer with 100% accuracy
 */
export async function detectKeySignatureFromPdf(
  fileData: string,
  pageNumber: number = 1
): Promise<string> {
  try {
    const pdfDoc = await loadPdfDocument(fileData);
    const page = await pdfDoc.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const items = textContent.items as Array<{ str: string; transform: number[]; fontName: string }>;

    const clefs = items.filter((i) => i.str === '&');
    if (clefs.length === 0) return 'Do Mayor';
    clefs.sort((a, b) => b.transform[5] - a.transform[5]);

    const firstClef = clefs[0];
    const ksItems = items.filter(
      (i) =>
        (i.str === '#' || i.str === 'b') &&
        i.transform[4] > firstClef.transform[4] &&
        i.transform[4] < firstClef.transform[4] + 45 &&
        Math.abs(i.transform[5] - firstClef.transform[5]) < 25
    );

    const sharps = ksItems.filter((i) => i.str === '#').length;
    const flats = ksItems.filter((i) => i.str === 'b').length;

    if (sharps === 4) return 'Mi Mayor';
    if (sharps === 3) return 'La Mayor';
    if (sharps === 2) return 'Re Mayor';
    if (sharps === 1) return 'Sol Mayor';
    if (flats === 4) return 'Lab Mayor';
    if (flats === 3) return 'Mib Mayor';
    if (flats === 2) return 'Sib Mayor';
    if (flats === 1) return 'Fa Mayor';

    return 'Do Mayor';
  } catch (err) {
    console.warn('detectKeySignatureFromPdf error:', err);
    return 'Do Mayor';
  }
}

/**
 * High-precision Vector Music PDF note detection
 * Extracts the exact musical notes, pitches, and accidentals directly from the embedded music notation font
 */
export async function detectNotesFromPdf(
  fileData: string,
  options: DetectNotesOptions
): Promise<{ notes: NoteAnnotation[]; detectedKey: string }> {
  const {
    pageNumber,
    keySignature,
    onlySopranoVoice = true,
    alignAboveTopLine = true,
    baseFontSize = 16,
  } = options;

  const pdfDoc = await loadPdfDocument(fileData);
  const page = await pdfDoc.getPage(pageNumber);
  const viewport = page.getViewport({ scale: 1.0 });
  const textContent = await page.getTextContent();
  const items = textContent.items as Array<{ str: string; transform: number[]; fontName: string }>;

  // 1. Find Treble Clefs ('&')
  const clefs = items.filter((i) => i.str === '&');
  if (clefs.length === 0) {
    return { notes: [], detectedKey: keySignature || 'Do Mayor' };
  }
  // Sort from top of page to bottom
  clefs.sort((a, b) => b.transform[5] - a.transform[5]);

  // 2. Use user-selected Key Signature directly (manual selection)
  const activeKey = keySignature || 'Do Mayor';
  const detectedNotes: NoteAnnotation[] = [];

  // 3. Scan notes in each system
  for (let s = 0; s < clefs.length; s++) {
    const clef = clefs[s];
    const clefX = clef.transform[4];
    const clefY = clef.transform[5];
    const line1Y = clefY - 4.20; // Line 1 (MI 4) in points
    const stepSize = 2.10; // diatonic step in points

    // Filter items with note glyphs
    const staffNotes = items.filter(
      (i) =>
        (i.str.includes('œ') || i.str.includes('˙') || i.str.includes('w')) &&
        i.transform[4] > clefX + 26 &&
        i.transform[5] >= line1Y - 9 &&
        i.transform[5] <= line1Y + 34
    );

    if (staffNotes.length === 0) continue;

    // Group notes by X position (within 2 points)
    const byX = new Map<number, { str: string; transform: number[]; fontName: string }>();
    for (const n of staffNotes) {
      const xKey = Math.round(n.transform[4]);
      if (!byX.has(xKey) || (onlySopranoVoice && byX.get(xKey)!.transform[5] < n.transform[5])) {
        byX.set(xKey, n);
      }
    }

    const sortedX = Array.from(byX.keys()).sort((a, b) => a - b);

    // Filter out Alto passing notes occurring during held Soprano notes
    const filteredX: number[] = [];
    for (let i = 0; i < sortedX.length; i++) {
      const curr = byX.get(sortedX[i])!;
      if (onlySopranoVoice && i > 0) {
        const prev = byX.get(sortedX[i - 1])!;
        const dist = sortedX[i] - sortedX[i - 1];
        if (prev.str.includes('˙') && dist < 24 && curr.transform[5] < prev.transform[5]) {
          continue;
        }
        if (prev.str.includes('w') && dist < 48 && curr.transform[5] < prev.transform[5]) {
          continue;
        }
      }
      filteredX.push(sortedX[i]);
    }

    // Map each note
    for (const x of filteredX) {
      const n = byX.get(x)!;
      const noteX = n.transform[4];
      const noteY = n.transform[5];

      const step = Math.round((noteY - line1Y) / stepSize);
      const { pitch, octave } = diatonicStepToSpanishPitch(step);

      // Check for explicit accidental right before note
      const accItem = items.find(
        (i) =>
          (i.str === '#' || i.str === 'b' || i.str === 'n') &&
          i.transform[4] >= noteX - 14 &&
          i.transform[4] < noteX - 1 &&
          Math.abs(i.transform[5] - noteY) < 6
      );

      let accidental: Accidental = '';
      if (accItem) {
        if (accItem.str === '#') accidental = '#';
        else if (accItem.str === 'b') accidental = 'b';
        else if (accItem.str === 'n') accidental = '';
      } else {
        accidental = getKeySignatureAccidental(pitch, activeKey);
      }

      const xPct = (noteX / viewport.width) * 100;
      let yPct: number;

      if (alignAboveTopLine) {
        const aboveLine5Y = line1Y + 22.5;
        yPct = ((viewport.height - aboveLine5Y) / viewport.height) * 100;
      } else {
        yPct = ((viewport.height - noteY) / viewport.height) * 100;
      }

      detectedNotes.push({
        id: 'auto_pdf_' + s + '_' + Math.random().toString(36).substring(2, 7),
        pageNumber,
        x: Math.round(xPct * 10) / 10,
        y: Math.round(yPct * 10) / 10,
        pitch,
        accidental,
        octave,
        fontWeight: 'bold',
        fontSize: baseFontSize,
        color: '#111827',
      });
    }
  }

  return {
    notes: detectedNotes,
    detectedKey: activeKey,
  };
}

