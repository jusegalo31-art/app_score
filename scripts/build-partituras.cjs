const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const partiturasDir = path.join(rootDir, 'partituras');
const distDir = path.join(rootDir, 'dist');
const distPartiturasDir = path.join(distDir, 'partituras');
const publicDir = path.join(rootDir, 'public');

console.log('[build-partituras] Scanning partituras directory...');

if (!fs.existsSync(partiturasDir)) {
  console.warn('[build-partituras] Warning: partituras directory not found at', partiturasDir);
  process.exit(0);
}

const files = fs.readdirSync(partiturasDir);
const pdfFiles = files.filter((f) => f.toLowerCase().endsWith('.pdf'));
console.log(`[build-partituras] Found ${pdfFiles.length} hymn PDF files.`);

const items = pdfFiles.map((file) => {
  const match = file.match(/^himno_(\d+)_(.+)\.pdf$/i);
  let number = '';
  let title = file.replace(/\.pdf$/i, '').replace(/_/g, ' ');

  if (match) {
    number = match[1];
    title = match[2]
      .split('_')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }

  const fullPath = path.join(partiturasDir, file);
  const stats = fs.statSync(fullPath);

  // Check if .notes.json exists
  const notesJsonPath = path.join(partiturasDir, `${file}.notes.json`);
  let hasSavedNotes = false;
  let savedNotesCount = 0;
  let savedOriginalKey = '';

  if (fs.existsSync(notesJsonPath)) {
    try {
      const raw = fs.readFileSync(notesJsonPath, 'utf-8');
      const parsed = JSON.parse(raw);
      hasSavedNotes = true;
      savedNotesCount = Array.isArray(parsed.notes) ? parsed.notes.length : 0;
      savedOriginalKey = parsed.originalKey || '';
    } catch {
      // ignore
    }
  }

  return {
    filename: file,
    number: number || '0',
    title: number ? `Himno ${parseInt(number, 10)} - ${title}` : title,
    sizeBytes: stats.size,
    hasSavedNotes,
    savedNotesCount,
    savedOriginalKey,
  };
});

items.sort((a, b) => parseInt(a.number, 10) - parseInt(b.number, 10));

const manifestJson = JSON.stringify(items);

// 1. Write to public/ for local dev and future builds
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}
fs.writeFileSync(path.join(publicDir, 'partituras-manifest.json'), manifestJson, 'utf-8');
console.log('[build-partituras] Wrote public/partituras-manifest.json');

// 2. If dist/ exists, write manifest and copy PDFs to dist/partituras
if (fs.existsSync(distDir)) {
  fs.writeFileSync(path.join(distDir, 'partituras-manifest.json'), manifestJson, 'utf-8');
  console.log('[build-partituras] Wrote dist/partituras-manifest.json');

  if (!fs.existsSync(distPartiturasDir)) {
    fs.mkdirSync(distPartiturasDir, { recursive: true });
  }

  console.log('[build-partituras] Copying PDF files to dist/partituras...');
  fs.cpSync(partiturasDir, distPartiturasDir, { recursive: true });
  console.log(`[build-partituras] Successfully copied all partituras to dist/partituras!`);
}
