import type { NoteAnnotation, PartituraHymnItem, ScoreProject } from '../types';
import { saveScoreToFirebase, getScoreById } from './firebase';
import { loadPdfDocument } from '../utils/pdfLoader';

const DB_NAME = 'NotaScoreDB';
const DB_VERSION = 1;
const STORE_PROJECTS = 'projects';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_PROJECTS)) {
        const store = db.createObjectStore(STORE_PROJECTS, { keyPath: 'id' });
        store.createIndex('updatedAt', 'updatedAt', { unique: false });
        store.createIndex('title', 'title', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getAllProjects(): Promise<ScoreProject[]> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_PROJECTS, 'readonly');
      const store = tx.objectStore(STORE_PROJECTS);
      const request = store.getAll();

      request.onsuccess = () => {
        const list = (request.result as ScoreProject[]) || [];
        list.sort((a, b) => b.updatedAt - a.updatedAt);
        resolve(list);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error('Error fetching projects from IndexedDB:', err);
    return [];
  }
}

export async function getProject(id: string): Promise<ScoreProject | null> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_PROJECTS, 'readonly');
      const store = tx.objectStore(STORE_PROJECTS);
      const request = store.get(id);

      request.onsuccess = () => resolve((request.result as ScoreProject) || null);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error('Error fetching project:', err);
    return null;
  }
}

/**
 * Centralized Save:
 * 1. Syncs to Firebase Firestore cloud database (primary cloud source of truth)
 * 2. Caches to local IndexedDB (guaranteeing offline resilience and zero-delay reloads)
 */
export async function saveProject(project: ScoreProject): Promise<void> {
  const updated: ScoreProject = {
    ...project,
    updatedAt: Date.now(),
  };

  // 1. Firebase Cloud Firestore sync (primary)
  try {
    await saveScoreToFirebase(updated).catch(() => {});
  } catch (err) {
    console.warn('Firebase save warning:', err);
  }

  // 2. Local IndexedDB Cache
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_PROJECTS, 'readwrite');
      const store = tx.objectStore(STORE_PROJECTS);
      const request = store.put(updated);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('IndexedDB save warning:', err);
  }
}

export async function deleteProject(id: string): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PROJECTS, 'readwrite');
    const store = tx.objectStore(STORE_PROJECTS);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Fetches the list of all hymns in the partituras/ folder (supports Vercel CDN and local dev)
 */
export async function fetchPartiturasHymnsList(): Promise<PartituraHymnItem[]> {
  // 1. Try static manifest (fastest, CDN-cached, works on Vercel and production)
  try {
    const res = await fetch('/partituras-manifest.json');
    if (res.ok) {
      const items = (await res.json()) as PartituraHymnItem[];
      if (Array.isArray(items) && items.length > 0) return items;
    }
  } catch {
    // fallback to api
  }

  // 2. Try dev server API endpoint
  try {
    const res = await fetch('/api/partituras');
    if (res.ok) {
      const items = (await res.json()) as PartituraHymnItem[];
      if (Array.isArray(items) && items.length > 0) return items;
    }
  } catch (err) {
    console.warn('Cannot fetch hymns list:', err);
  }

  return [];
}

/**
 * Loads a hymn PDF from partituras/ folder and checks for saved notes from server or Firebase
 */
export async function loadPartituraHymn(hymn: PartituraHymnItem): Promise<ScoreProject> {
  // 1. Fetch PDF as Blob and convert to Base64 (try static CDN first, fallback to dev API)
  let pdfRes = await fetch(`/partituras/${encodeURIComponent(hymn.filename)}`);
  if (!pdfRes.ok) {
    pdfRes = await fetch(`/api/partituras/file/${encodeURIComponent(hymn.filename)}`);
  }

  if (!pdfRes.ok) {
    throw new Error(`No se pudo cargar el archivo PDF: ${hymn.filename}`);
  }
  const blob = await pdfRes.blob();
  const fileData = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

  // 2. Check for saved notes: first from server API, then from Firebase, then from IndexedDB
  let savedNotes: NoteAnnotation[] = [];
  let savedOriginalKey = 'Do Mayor';
  let savedTranspose = 0;
  let savedBaseFontSize = 16;
  let savedNoteOrientation: 'horizontal' | 'diagonal' = 'horizontal';

  try {
    const dataRes = await fetch(`/api/partituras/data/${encodeURIComponent(hymn.filename)}`);
    if (dataRes.ok) {
      const parsed = await dataRes.json();
      if (Array.isArray(parsed.notes)) savedNotes = parsed.notes;
      if (parsed.originalKey) savedOriginalKey = parsed.originalKey;
      if (typeof parsed.transposeHistory === 'number') savedTranspose = parsed.transposeHistory;
      if (typeof parsed.baseFontSize === 'number') savedBaseFontSize = parsed.baseFontSize;
      if (parsed.noteOrientation) savedNoteOrientation = parsed.noteOrientation;
    }
  } catch {
    // try next
  }

  // If server had no notes, check Firebase Cloud
  if (savedNotes.length === 0) {
    try {
      const fbProject = await getScoreById(hymn.filename);
      if (fbProject && Array.isArray(fbProject.notes) && fbProject.notes.length > 0) {
        savedNotes = fbProject.notes;
        if (fbProject.originalKey) savedOriginalKey = fbProject.originalKey;
        if (typeof fbProject.transposeHistory === 'number') savedTranspose = fbProject.transposeHistory;
        if (typeof fbProject.baseFontSize === 'number') savedBaseFontSize = fbProject.baseFontSize;
        if (fbProject.noteOrientation) savedNoteOrientation = fbProject.noteOrientation;
      }
    } catch {
      // ignore
    }
  }

  // If still empty, check local IndexedDB
  if (savedNotes.length === 0) {
    const local = await getProject(`hymn_${hymn.filename}`);
    if (local && local.notes.length > 0) {
      savedNotes = local.notes;
      savedOriginalKey = local.originalKey || savedOriginalKey;
      savedTranspose = local.transposeHistory || savedTranspose;
      savedBaseFontSize = local.baseFontSize || savedBaseFontSize;
      savedNoteOrientation = local.noteOrientation || savedNoteOrientation;
    }
  }

  let numPages = 1;
  try {
    const pdfDoc = await loadPdfDocument(fileData);
    if (pdfDoc && pdfDoc.numPages) {
      numPages = pdfDoc.numPages;
    }
  } catch (e) {
    console.warn('Could not determine PDF page count for hymn:', e);
  }

  const project: ScoreProject = {
    id: `hymn_${hymn.filename}`,
    title: hymn.title,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    sourceType: 'pdf',
    fileName: hymn.filename,
    fileData,
    numPages,
    notes: savedNotes,
    originalKey: savedOriginalKey,
    transposeHistory: savedTranspose,
    baseFontSize: savedBaseFontSize,
    noteOrientation: savedNoteOrientation,
    isPartituraFile: true,
    partituraFilename: hymn.filename,
    tags: ['Himnario', `Himno ${hymn.number}`],
  };

  // Cache in local IndexedDB
  await saveProject(project).catch(() => {});

  return project;
}

/**
 * Exports all local projects as a single backup JSON file
 */
export async function exportAllProjectsBackup(): Promise<string> {
  const projects = await getAllProjects();
  const exportData = {
    app: 'NotaScore',
    version: '2.0',
    exportedAt: Date.now(),
    totalProjects: projects.length,
    projects,
  };
  return JSON.stringify(exportData, null, 2);
}

/**
 * Restores projects from an uploaded backup JSON string
 */
export async function restoreProjectsBackup(jsonString: string): Promise<{ success: boolean; count: number }> {
  try {
    const parsed = JSON.parse(jsonString);
    const projectsList: ScoreProject[] = Array.isArray(parsed.projects) ? parsed.projects : [];

    if (projectsList.length === 0) {
      return { success: false, count: 0 };
    }

    for (const proj of projectsList) {
      if (proj.id) {
        await saveProject(proj);
      }
    }

    return { success: true, count: projectsList.length };
  } catch (err) {
    console.error('Error restoring backup:', err);
    return { success: false, count: 0 };
  }
}

/**
 * Creates a beautiful SVG demo score for "Noche de Paz" matching the user's reference image
 */
export function generateSampleScoreSvg(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 1200" width="900" height="1200" style="background:#ffffff; font-family:'Times New Roman', serif;">
    <rect width="900" height="1200" fill="#ffffff" />
    
    <!-- Title -->
    <text x="450" y="70" font-size="32" font-weight="bold" text-anchor="middle" fill="#111827">Noche de Paz</text>
    <text x="450" y="100" font-size="16" font-style="italic" text-anchor="middle" fill="#4b5563">Flauta dulce / Melodía en Do Mayor</text>

    <!-- System 1 -->
    <g transform="translate(60, 160)">
      <!-- 5 Staff Lines -->
      <line x1="0" y1="0" x2="780" y2="0" stroke="#000" stroke-width="1.6"/>
      <line x1="0" y1="12" x2="780" y2="12" stroke="#000" stroke-width="1.6"/>
      <line x1="0" y1="24" x2="780" y2="24" stroke="#000" stroke-width="1.6"/>
      <line x1="0" y1="36" x2="780" y2="36" stroke="#000" stroke-width="1.6"/>
      <line x1="0" y1="48" x2="780" y2="48" stroke="#000" stroke-width="1.6"/>
      <!-- Treble Clef -->
      <text x="5" y="44" font-size="52" fill="#000" font-family="'Plus Jakarta Sans', serif">𝄞</text>
      <!-- Time signature 3/4 -->
      <text x="45" y="22" font-size="24" font-weight="bold" fill="#000">3</text>
      <text x="45" y="44" font-size="24" font-weight="bold" fill="#000">4</text>
      <!-- Bar lines -->
      <line x1="245" y1="0" x2="245" y2="48" stroke="#000" stroke-width="1.6"/>
      <line x1="430" y1="0" x2="430" y2="48" stroke="#000" stroke-width="1.6"/>
      <line x1="615" y1="0" x2="615" y2="48" stroke="#000" stroke-width="1.6"/>
      <line x1="780" y1="0" x2="780" y2="48" stroke="#000" stroke-width="1.6"/>

      <!-- Notes System 1 -->
      <!-- Measure 1: SOL (dotted quarter), LA (eighth), SOL (quarter) -->
      <ellipse cx="95" cy="24" rx="6" ry="4.5" fill="#000" transform="rotate(-15 95 24)" />
      <line x1="100" y1="23" x2="100" y2="-5" stroke="#000" stroke-width="1.8" />
      <circle cx="106" cy="24" r="2.2" fill="#000" />

      <ellipse cx="155" cy="18" rx="6" ry="4.5" fill="#000" transform="rotate(-15 155 18)" />
      <line x1="160" y1="17" x2="160" y2="-10" stroke="#000" stroke-width="1.8" />
      <path d="M160 -10 Q168 -2 169 5" stroke="#000" stroke-width="2" fill="none" />

      <ellipse cx="205" cy="24" rx="6" ry="4.5" fill="#000" transform="rotate(-15 205 24)" />
      <line x1="210" y1="23" x2="210" y2="-5" stroke="#000" stroke-width="1.8" />

      <!-- Measure 2: MI (dotted half) -->
      <ellipse cx="330" cy="36" rx="6.5" ry="5" fill="none" stroke="#000" stroke-width="2" transform="rotate(-15 330 36)" />
      <line x1="336" y1="34" x2="336" y2="4" stroke="#000" stroke-width="1.8" />
      <circle cx="344" cy="36" r="2.2" fill="#000" />

      <!-- Measure 3: SOL (dotted quarter), LA (eighth), SOL (quarter) -->
      <ellipse cx="480" cy="24" rx="6" ry="4.5" fill="#000" transform="rotate(-15 480 24)" />
      <line x1="485" y1="23" x2="485" y2="-5" stroke="#000" stroke-width="1.8" />
      <circle cx="491" cy="24" r="2.2" fill="#000" />

      <ellipse cx="540" cy="18" rx="6" ry="4.5" fill="#000" transform="rotate(-15 540 18)" />
      <line x1="545" y1="17" x2="545" y2="-10" stroke="#000" stroke-width="1.8" />
      <path d="M545 -10 Q553 -2 554 5" stroke="#000" stroke-width="2" fill="none" />

      <ellipse cx="585" cy="24" rx="6" ry="4.5" fill="#000" transform="rotate(-15 585 24)" />
      <line x1="590" y1="23" x2="590" y2="-5" stroke="#000" stroke-width="1.8" />

      <!-- Measure 4: MI (dotted half) -->
      <ellipse cx="700" cy="36" rx="6.5" ry="5" fill="none" stroke="#000" stroke-width="2" transform="rotate(-15 700 36)" />
      <line x1="706" y1="34" x2="706" y2="4" stroke="#000" stroke-width="1.8" />
      <circle cx="714" cy="36" r="2.2" fill="#000" />
      
      <!-- Chords -->
      <text x="95" y="70" font-size="16" font-family="'Plus Jakarta Sans', sans-serif" font-weight="bold">C</text>
    </g>

    <!-- System 2 -->
    <g transform="translate(60, 310)">
      <line x1="0" y1="0" x2="780" y2="0" stroke="#000" stroke-width="1.6"/>
      <line x1="0" y1="12" x2="780" y2="12" stroke="#000" stroke-width="1.6"/>
      <line x1="0" y1="24" x2="780" y2="24" stroke="#000" stroke-width="1.6"/>
      <line x1="0" y1="36" x2="780" y2="36" stroke="#000" stroke-width="1.6"/>
      <line x1="0" y1="48" x2="780" y2="48" stroke="#000" stroke-width="1.6"/>
      <text x="5" y="44" font-size="52" fill="#000">𝄞</text>
      <line x1="245" y1="0" x2="245" y2="48" stroke="#000" stroke-width="1.6"/>
      <line x1="430" y1="0" x2="430" y2="48" stroke="#000" stroke-width="1.6"/>
      <line x1="615" y1="0" x2="615" y2="48" stroke="#000" stroke-width="1.6"/>
      <line x1="780" y1="0" x2="780" y2="48" stroke="#000" stroke-width="1.6"/>

      <!-- Measure 5: RE' (half), RE' (quarter) -->
      <ellipse cx="115" cy="-6" rx="6.5" ry="5" fill="none" stroke="#000" stroke-width="2" transform="rotate(-15 115 -6)" />
      <line x1="110" y1="-6" x2="110" y2="26" stroke="#000" stroke-width="1.8" />
      <ellipse cx="195" cy="-6" rx="6" ry="4.5" fill="#000" transform="rotate(-15 195 -6)" />
      <line x1="190" y1="-6" x2="190" y2="26" stroke="#000" stroke-width="1.8" />

      <!-- Measure 6: SI (dotted half) -->
      <ellipse cx="330" cy="12" rx="6.5" ry="5" fill="none" stroke="#000" stroke-width="2" transform="rotate(-15 330 12)" />
      <line x1="324" y1="12" x2="324" y2="42" stroke="#000" stroke-width="1.8" />
      <circle cx="344" cy="12" r="2.2" fill="#000" />

      <!-- Measure 7: DO' (half), DO' (quarter) -->
      <ellipse cx="490" cy="0" rx="6.5" ry="5" fill="none" stroke="#000" stroke-width="2" transform="rotate(-15 490 0)" />
      <line x1="484" y1="0" x2="484" y2="30" stroke="#000" stroke-width="1.8" />
      <ellipse cx="580" cy="0" rx="6" ry="4.5" fill="#000" transform="rotate(-15 580 0)" />
      <line x1="574" y1="0" x2="574" y2="30" stroke="#000" stroke-width="1.8" />

      <!-- Measure 8: SOL (dotted half) -->
      <ellipse cx="700" cy="24" rx="6.5" ry="5" fill="none" stroke="#000" stroke-width="2" transform="rotate(-15 700 24)" />
      <line x1="706" y1="24" x2="706" y2="-6" stroke="#000" stroke-width="1.8" />
      <circle cx="714" cy="24" r="2.2" fill="#000" />

      <!-- Chords -->
      <text x="115" y="70" font-size="16" font-family="'Plus Jakarta Sans', sans-serif" font-weight="bold">G7</text>
      <text x="490" y="70" font-size="16" font-family="'Plus Jakarta Sans', sans-serif" font-weight="bold">C</text>
    </g>

    <!-- System 3 -->
    <g transform="translate(60, 460)">
      <line x1="0" y1="0" x2="780" y2="0" stroke="#000" stroke-width="1.6"/>
      <line x1="0" y1="12" x2="780" y2="12" stroke="#000" stroke-width="1.6"/>
      <line x1="0" y1="24" x2="780" y2="24" stroke="#000" stroke-width="1.6"/>
      <line x1="0" y1="36" x2="780" y2="36" stroke="#000" stroke-width="1.6"/>
      <line x1="0" y1="48" x2="780" y2="48" stroke="#000" stroke-width="1.6"/>
      <text x="5" y="44" font-size="52" fill="#000">𝄞</text>
      <line x1="245" y1="0" x2="245" y2="48" stroke="#000" stroke-width="1.6"/>
      <line x1="430" y1="0" x2="430" y2="48" stroke="#000" stroke-width="1.6"/>
      <line x1="615" y1="0" x2="615" y2="48" stroke="#000" stroke-width="1.6"/>
      <line x1="780" y1="0" x2="780" y2="48" stroke="#000" stroke-width="1.6"/>

      <!-- Measure 9: LA (half), LA (quarter) -->
      <ellipse cx="115" cy="18" rx="6.5" ry="5" fill="none" stroke="#000" stroke-width="2" transform="rotate(-15 115 18)" />
      <line x1="121" y1="18" x2="121" y2="-12" stroke="#000" stroke-width="1.8" />
      <ellipse cx="195" cy="18" rx="6" ry="4.5" fill="#000" transform="rotate(-15 195 18)" />
      <line x1="201" y1="18" x2="201" y2="-12" stroke="#000" stroke-width="1.8" />

      <!-- Measure 10: DO' (dotted quarter), SI (eighth), LA (quarter) -->
      <ellipse cx="295" cy="0" rx="6" ry="4.5" fill="#000" transform="rotate(-15 295 0)" />
      <line x1="289" y1="0" x2="289" y2="30" stroke="#000" stroke-width="1.8" />
      <circle cx="304" cy="0" r="2.2" fill="#000" />

      <ellipse cx="355" cy="12" rx="6" ry="4.5" fill="#000" transform="rotate(-15 355 12)" />
      <line x1="349" y1="12" x2="349" y2="42" stroke="#000" stroke-width="1.8" />
      <path d="M349 42 Q357 34 358 27" stroke="#000" stroke-width="2" fill="none" />

      <ellipse cx="395" cy="18" rx="6" ry="4.5" fill="#000" transform="rotate(-15 395 18)" />
      <line x1="401" y1="18" x2="401" y2="-12" stroke="#000" stroke-width="1.8" />

      <!-- Measure 11: SOL (dotted quarter), LA (eighth), SOL (quarter) -->
      <ellipse cx="480" cy="24" rx="6" ry="4.5" fill="#000" transform="rotate(-15 480 24)" />
      <line x1="485" y1="23" x2="485" y2="-5" stroke="#000" stroke-width="1.8" />
      <circle cx="491" cy="24" r="2.2" fill="#000" />
      <ellipse cx="540" cy="18" rx="6" ry="4.5" fill="#000" transform="rotate(-15 540 18)" />
      <line x1="545" y1="17" x2="545" y2="-10" stroke="#000" stroke-width="1.8" />
      <path d="M545 -10 Q553 -2 554 5" stroke="#000" stroke-width="2" fill="none" />
      <ellipse cx="585" cy="24" rx="6" ry="4.5" fill="#000" transform="rotate(-15 585 24)" />
      <line x1="590" y1="23" x2="590" y2="-5" stroke="#000" stroke-width="1.8" />

      <!-- Measure 12: MI (dotted half) -->
      <ellipse cx="700" cy="36" rx="6.5" ry="5" fill="none" stroke="#000" stroke-width="2" transform="rotate(-15 700 36)" />
      <line x1="706" y1="34" x2="706" y2="4" stroke="#000" stroke-width="1.8" />
      <circle cx="714" cy="36" r="2.2" fill="#000" />

      <!-- Chords -->
      <text x="115" y="70" font-size="16" font-family="'Plus Jakarta Sans', sans-serif" font-weight="bold">F</text>
      <text x="480" y="70" font-size="16" font-family="'Plus Jakarta Sans', sans-serif" font-weight="bold">C</text>
    </g>

    <!-- System 4 -->
    <g transform="translate(60, 610)">
      <line x1="0" y1="0" x2="780" y2="0" stroke="#000" stroke-width="1.6"/>
      <line x1="0" y1="12" x2="780" y2="12" stroke="#000" stroke-width="1.6"/>
      <line x1="0" y1="24" x2="780" y2="24" stroke="#000" stroke-width="1.6"/>
      <line x1="0" y1="36" x2="780" y2="36" stroke="#000" stroke-width="1.6"/>
      <line x1="0" y1="48" x2="780" y2="48" stroke="#000" stroke-width="1.6"/>
      <text x="5" y="44" font-size="52" fill="#000">𝄞</text>
      <line x1="245" y1="0" x2="245" y2="48" stroke="#000" stroke-width="1.6"/>
      <line x1="430" y1="0" x2="430" y2="48" stroke="#000" stroke-width="1.6"/>
      <line x1="615" y1="0" x2="615" y2="48" stroke="#000" stroke-width="1.6"/>
      <line x1="780" y1="0" x2="780" y2="48" stroke="#000" stroke-width="1.6"/>

      <!-- Measure 13: RE' (half), RE' (quarter) -->
      <ellipse cx="115" cy="-6" rx="6.5" ry="5" fill="none" stroke="#000" stroke-width="2" transform="rotate(-15 115 -6)" />
      <line x1="110" y1="-6" x2="110" y2="26" stroke="#000" stroke-width="1.8" />
      <ellipse cx="195" cy="-6" rx="6" ry="4.5" fill="#000" transform="rotate(-15 195 -6)" />
      <line x1="190" y1="-6" x2="190" y2="26" stroke="#000" stroke-width="1.8" />

      <!-- Measure 14: FA' (dotted quarter), RE' (eighth), SI (quarter) -->
      <ellipse cx="295" cy="-18" rx="6" ry="4.5" fill="#000" transform="rotate(-15 295 -18)" />
      <line x1="289" y1="-18" x2="289" y2="15" stroke="#000" stroke-width="1.8" />
      <circle cx="304" cy="-18" r="2.2" fill="#000" />
      <ellipse cx="355" cy="-6" rx="6" ry="4.5" fill="#000" transform="rotate(-15 355 -6)" />
      <line x1="349" y1="-6" x2="349" y2="26" stroke="#000" stroke-width="1.8" />
      <path d="M349 26 Q357 18 358 11" stroke="#000" stroke-width="2" fill="none" />
      <ellipse cx="395" cy="12" rx="6" ry="4.5" fill="#000" transform="rotate(-15 395 12)" />
      <line x1="389" y1="12" x2="389" y2="42" stroke="#000" stroke-width="1.8" />

      <!-- Measure 15: DO' (dotted half) -->
      <ellipse cx="490" cy="0" rx="6.5" ry="5" fill="none" stroke="#000" stroke-width="2" transform="rotate(-15 490 0)" />
      <line x1="484" y1="0" x2="484" y2="30" stroke="#000" stroke-width="1.8" />
      <circle cx="504" cy="0" r="2.2" fill="#000" />

      <!-- Measure 16: MI' (half), DO' (quarter) -->
      <ellipse cx="660" cy="-12" rx="6.5" ry="5" fill="none" stroke="#000" stroke-width="2" transform="rotate(-15 660 -12)" />
      <line x1="654" y1="-12" x2="654" y2="20" stroke="#000" stroke-width="1.8" />
      <ellipse cx="730" cy="0" rx="6" ry="4.5" fill="#000" transform="rotate(-15 730 0)" />
      <line x1="724" y1="0" x2="724" y2="30" stroke="#000" stroke-width="1.8" />

      <!-- Chords -->
      <text x="115" y="70" font-size="16" font-family="'Plus Jakarta Sans', sans-serif" font-weight="bold">G7</text>
      <text x="490" y="70" font-size="16" font-family="'Plus Jakarta Sans', sans-serif" font-weight="bold">C</text>
    </g>

    <!-- System 5 -->
    <g transform="translate(60, 760)">
      <line x1="0" y1="0" x2="780" y2="0" stroke="#000" stroke-width="1.6"/>
      <line x1="0" y1="12" x2="780" y2="12" stroke="#000" stroke-width="1.6"/>
      <line x1="0" y1="24" x2="780" y2="24" stroke="#000" stroke-width="1.6"/>
      <line x1="0" y1="36" x2="780" y2="36" stroke="#000" stroke-width="1.6"/>
      <line x1="0" y1="48" x2="780" y2="48" stroke="#000" stroke-width="1.6"/>
      <text x="5" y="44" font-size="52" fill="#000">𝄞</text>
      <line x1="245" y1="0" x2="245" y2="48" stroke="#000" stroke-width="1.6"/>
      <line x1="430" y1="0" x2="430" y2="48" stroke="#000" stroke-width="1.6"/>
      <line x1="615" y1="0" x2="615" y2="48" stroke="#000" stroke-width="1.6"/>
      <!-- Final double bar line -->
      <line x1="774" y1="0" x2="774" y2="48" stroke="#000" stroke-width="1.6"/>
      <line x1="780" y1="0" x2="780" y2="48" stroke="#000" stroke-width="3.8"/>

      <!-- Measure 17: SOL (dotted quarter), MI (eighth), SOL (quarter) -->
      <ellipse cx="115" cy="24" rx="6" ry="4.5" fill="#000" transform="rotate(-15 115 24)" />
      <line x1="120" y1="23" x2="120" y2="-5" stroke="#000" stroke-width="1.8" />
      <circle cx="126" cy="24" r="2.2" fill="#000" />
      <ellipse cx="170" cy="36" rx="6" ry="4.5" fill="#000" transform="rotate(-15 170 36)" />
      <line x1="175" y1="35" x2="175" y2="5" stroke="#000" stroke-width="1.8" />
      <path d="M175 5 Q183 13 184 20" stroke="#000" stroke-width="2" fill="none" />
      <ellipse cx="215" cy="24" rx="6" ry="4.5" fill="#000" transform="rotate(-15 215 24)" />
      <line x1="220" y1="23" x2="220" y2="-5" stroke="#000" stroke-width="1.8" />

      <!-- Measure 18: FA (half), RE (quarter) -->
      <ellipse cx="330" cy="30" rx="6.5" ry="5" fill="none" stroke="#000" stroke-width="2" transform="rotate(-15 330 30)" />
      <line x1="336" y1="30" x2="336" y2="0" stroke="#000" stroke-width="1.8" />
      <ellipse cx="395" cy="42" rx="6" ry="4.5" fill="#000" transform="rotate(-15 395 42)" />
      <line x1="401" y1="41" x2="401" y2="12" stroke="#000" stroke-width="1.8" />

      <!-- Measure 19: DO (dotted half) -->
      <line x1="495" y1="54" x2="525" y2="54" stroke="#000" stroke-width="1.6" />
      <ellipse cx="510" cy="54" rx="6.5" ry="5" fill="none" stroke="#000" stroke-width="2" transform="rotate(-15 510 54)" />
      <line x1="516" y1="54" x2="516" y2="24" stroke="#000" stroke-width="1.8" />
      <circle cx="524" cy="54" r="2.2" fill="#000" />

      <text x="510" y="75" font-size="16" font-family="'Plus Jakarta Sans', sans-serif" font-weight="bold">C</text>
    </g>

    <!-- Footer -->
    <text x="450" y="1150" font-size="13" font-style="italic" text-anchor="middle" fill="#9ca3af">NotaScore - Editor y Transpositor de Partituras</text>
  </svg>`;

  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

/**
 * Creates the initial demo project with notes matching the user's reference picture!
 */
export function createDefaultSampleProject(): ScoreProject {
  const sampleSvg = generateSampleScoreSvg();

  // Annotations corresponding exactly to the first systems of the user's picture!
  const initialNotes: NoteAnnotation[] = [
    // System 1
    { id: 'n1', pageNumber: 1, x: 17.2, y: 11.2, pitch: 'SOL', accidental: '', octave: 4, fontWeight: 'bold' },
    { id: 'n2', pageNumber: 1, x: 23.8, y: 11.2, pitch: 'LA', accidental: '', octave: 4, fontWeight: 'bold' },
    { id: 'n3', pageNumber: 1, x: 29.4, y: 11.2, pitch: 'SOL', accidental: '', octave: 4, fontWeight: 'bold' },
    { id: 'n4', pageNumber: 1, x: 43.3, y: 11.2, pitch: 'MI', accidental: '', octave: 4, fontWeight: 'bold' },
    { id: 'n5', pageNumber: 1, x: 60.0, y: 11.2, pitch: 'SOL', accidental: '', octave: 4, fontWeight: 'bold' },
    { id: 'n6', pageNumber: 1, x: 66.6, y: 11.2, pitch: 'LA', accidental: '', octave: 4, fontWeight: 'bold' },
    { id: 'n7', pageNumber: 1, x: 71.7, y: 11.2, pitch: 'SOL', accidental: '', octave: 4, fontWeight: 'bold' },
    { id: 'n8', pageNumber: 1, x: 84.4, y: 11.2, pitch: 'MI', accidental: '', octave: 4, fontWeight: 'bold' },

    // System 2
    { id: 'n9', pageNumber: 1, x: 19.4, y: 23.7, pitch: 'RE', accidental: '', octave: 5, fontWeight: 'bold' }, // RE'
    { id: 'n10', pageNumber: 1, x: 28.3, y: 23.7, pitch: 'RE', accidental: '', octave: 5, fontWeight: 'bold' }, // RE'
    { id: 'n11', pageNumber: 1, x: 43.3, y: 23.7, pitch: 'SI', accidental: '', octave: 4, fontWeight: 'bold' }, // SI
    { id: 'n12', pageNumber: 1, x: 61.1, y: 23.7, pitch: 'DO', accidental: '', octave: 5, fontWeight: 'bold' }, // DO'
    { id: 'n13', pageNumber: 1, x: 71.1, y: 23.7, pitch: 'DO', accidental: '', octave: 5, fontWeight: 'bold' }, // DO'
    { id: 'n14', pageNumber: 1, x: 84.4, y: 23.7, pitch: 'SOL', accidental: '', octave: 4, fontWeight: 'bold' }, // SOL

    // System 3
    { id: 'n15', pageNumber: 1, x: 19.4, y: 36.2, pitch: 'LA', accidental: '', octave: 4, fontWeight: 'bold' },
    { id: 'n16', pageNumber: 1, x: 28.3, y: 36.2, pitch: 'LA', accidental: '', octave: 4, fontWeight: 'bold' },
    { id: 'n17', pageNumber: 1, x: 39.4, y: 36.2, pitch: 'DO', accidental: '', octave: 5, fontWeight: 'bold' }, // DO'
    { id: 'n18', pageNumber: 1, x: 46.1, y: 36.2, pitch: 'SI', accidental: '', octave: 4, fontWeight: 'bold' }, // SI
    { id: 'n19', pageNumber: 1, x: 50.5, y: 36.2, pitch: 'LA', accidental: '', octave: 4, fontWeight: 'bold' }, // LA
    { id: 'n20', pageNumber: 1, x: 60.0, y: 36.2, pitch: 'SOL', accidental: '', octave: 4, fontWeight: 'bold' },
    { id: 'n21', pageNumber: 1, x: 66.6, y: 36.2, pitch: 'LA', accidental: '', octave: 4, fontWeight: 'bold' },
    { id: 'n22', pageNumber: 1, x: 71.7, y: 36.2, pitch: 'SOL', accidental: '', octave: 4, fontWeight: 'bold' },
    { id: 'n23', pageNumber: 1, x: 84.4, y: 36.2, pitch: 'MI', accidental: '', octave: 4, fontWeight: 'bold' },
  ];

  return {
    id: 'demo-noche-de-paz',
    title: 'Noche de Paz (Demostración)',
    author: 'Franz Xaver Gruber',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    sourceType: 'sample',
    fileName: 'noche_de_paz_flauta.pdf',
    fileData: sampleSvg,
    numPages: 1,
    notes: initialNotes,
    originalKey: 'Do Mayor',
    transposeHistory: 0,
    tags: ['Navidad', 'Flauta', 'Do Mayor'],
    instrument: 'Flauta / Melodía',
  };
}
