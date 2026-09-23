import jsPDF from 'jspdf';
import type { NoteAnnotation, ScoreProject } from '../types';
import { formatNoteDisplay } from './musicTheory';

/**
 * Creates an offscreen canvas rendering the base page with all note annotations drawn crisply
 */
export async function createRenderedPageCanvas(
  baseImageOrCanvas: HTMLImageElement | HTMLCanvasElement,
  notes: NoteAnnotation[],
  pageNumber: number
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas');
  const width = baseImageOrCanvas instanceof HTMLImageElement ? baseImageOrCanvas.naturalWidth : baseImageOrCanvas.width;
  const height = baseImageOrCanvas instanceof HTMLImageElement ? baseImageOrCanvas.naturalHeight : baseImageOrCanvas.height;

  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Cannot get 2d context');

  // Draw background sheet music
  ctx.drawImage(baseImageOrCanvas, 0, 0, width, height);

  // Filter notes for this page
  const pageNotes = notes.filter((n) => n.pageNumber === pageNumber);

  // Scale factor based on canvas width vs standard 900px
  const scale = width / 900;

  // Draw each note annotation
  pageNotes.forEach((note) => {
    const px = (note.x / 100) * width;
    const py = (note.y / 100) * height;

    const noteText = formatNoteDisplay(note.pitch, note.accidental, note.octave);
    const fontSize = (note.fontSize || 15) * scale;
    const isBold = note.fontWeight === 'bold';

    ctx.font = `${isBold ? 'bold ' : ''}${Math.round(fontSize)}px 'Outfit', 'Plus Jakarta Sans', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';

    // Subtle clear backing for maximum legibility over staff lines
    const metrics = ctx.measureText(noteText);
    const bgWidth = metrics.width + 8 * scale;
    const bgHeight = fontSize * 1.15;

    ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
    ctx.fillRect(px - bgWidth / 2, py - bgHeight, bgWidth, bgHeight);

    // Note text
    ctx.fillStyle = note.color || '#111827';
    ctx.fillText(noteText, px, py);

    // If custom chord/lyric text
    if (note.customText) {
      ctx.font = `600 ${Math.round(fontSize * 0.85)}px 'Plus Jakarta Sans', sans-serif`;
      ctx.fillStyle = '#4f46e5';
      ctx.fillText(note.customText, px, py + fontSize * 1.1);
    }
  });

  return canvas;
}

/**
 * Downloads single page as PNG
 */
export async function downloadPageAsPng(
  baseImageOrCanvas: HTMLImageElement | HTMLCanvasElement,
  notes: NoteAnnotation[],
  pageNumber: number,
  fileName: string = 'partitura_anotada.png'
) {
  const canvas = await createRenderedPageCanvas(baseImageOrCanvas, notes, pageNumber);
  const dataUrl = canvas.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/**
 * Exports project as PDF with all annotations
 */
export async function exportProjectToPdf(
  pagesCanvases: HTMLCanvasElement[],
  project: ScoreProject
) {
  if (pagesCanvases.length === 0) return;

  const firstCanvas = pagesCanvases[0];
  const orientation = firstCanvas.width > firstCanvas.height ? 'landscape' : 'portrait';

  const pdf = new jsPDF({
    orientation,
    unit: 'pt',
    format: [firstCanvas.width, firstCanvas.height],
  });

  for (let i = 0; i < pagesCanvases.length; i++) {
    if (i > 0) {
      const pageCanvas = pagesCanvases[i];
      pdf.addPage([pageCanvas.width, pageCanvas.height], pageCanvas.width > pageCanvas.height ? 'landscape' : 'portrait');
    }

    const imgData = pagesCanvases[i].toDataURL('image/jpeg', 0.95);
    pdf.addImage(imgData, 'JPEG', 0, 0, pagesCanvases[i].width, pagesCanvases[i].height);
  }

  const safeTitle = project.title.toLowerCase().replace(/[^a-z0-9_-]/g, '_') || 'partitura_anotada';
  pdf.save(`${safeTitle}.pdf`);
}
