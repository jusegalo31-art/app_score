import type { FirebaseConfig, ScoreProject, ScoreFolder, CloudScoreItem } from '../types';
import { loadPdfDocument } from '../utils/pdfLoader';
import {
  getCachedFolderScores,
  saveCachedFolderScores,
  getCachedFolders,
  saveCachedFolders,
  getLocalProjectsByFolder,
  getProject,
  saveProjectLocallyOnly,
} from './storage';

const STORAGE_KEY = 'notascore_firebase_config';

// Optional default configuration from environment
export const DEFAULT_FIREBASE_CONFIG: FirebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
};

/**
 * Retrieves the stored Firebase configuration from localStorage or environment
 */
export function getFirebaseConfig(): FirebaseConfig | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.projectId && parsed.apiKey) {
        return parsed;
      }
    }
  } catch {
    // fallback
  }

  if (DEFAULT_FIREBASE_CONFIG.projectId && DEFAULT_FIREBASE_CONFIG.apiKey) {
    return DEFAULT_FIREBASE_CONFIG;
  }

  return null;
}

/**
 * Saves or clears the Firebase configuration in localStorage
 */
export function saveFirebaseConfig(config: FirebaseConfig | null): void {
  if (!config) {
    localStorage.removeItem(STORAGE_KEY);
  } else {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  }
}

/**
 * Tests connection to Firestore with provided config
 */
export async function testFirebaseConnection(config: FirebaseConfig): Promise<{ success: boolean; message: string }> {
  try {
    const url = `https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/(default)/documents/carpetas?pageSize=1&key=${config.apiKey}`;
    const res = await fetch(url);
    if (res.ok || res.status === 404) {
      return { success: true, message: '¡Conexión con Firebase Firestore exitosa!' };
    } else {
      const err = await res.json().catch(() => ({}));
      const msg = err.error?.message || `Error HTTP ${res.status}: ${res.statusText}`;
      return { success: false, message: msg };
    }
  } catch (err) {
    return { success: false, message: 'Error de red al conectar con Firebase: ' + String(err) };
  }
}

// ============================================================================
// CARPETAS (FOLDERS) MANAGEMENT IN FIRESTORE
// ============================================================================

/**
 * Retrieves all folders from Firestore
 */
export async function getFirebaseFolders(): Promise<ScoreFolder[]> {
  const config = getFirebaseConfig();
  if (!config) {
    const cached = await getCachedFolders();
    if (cached && cached.length > 0) return cached;
    return [{
      id: 'himnos',
      name: 'Himnos',
      createdAt: Date.now(),
      description: 'Himnario y partituras generales',
    }];
  }

  try {
    const url = `https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/(default)/documents/carpetas?pageSize=100&key=${config.apiKey}`;
    const res = await fetch(url);
    if (!res.ok) {
      const cached = await getCachedFolders();
      if (cached && cached.length > 0) return cached;
      // If collection doesn't exist yet, create default 'himnos' folder
      const defaultFolder: ScoreFolder = {
        id: 'himnos',
        name: 'Himnos',
        createdAt: Date.now(),
        description: 'Himnario y partituras generales',
      };
      await createFirebaseFolder('Himnos', 'himnos').catch(() => {});
      return [defaultFolder];
    }

    const data = await res.json();
    if (!data.documents || !Array.isArray(data.documents) || data.documents.length === 0) {
      const cached = await getCachedFolders();
      if (cached && cached.length > 0) return cached;
      // Create initial folder if empty
      const defaultFolder = await createFirebaseFolder('Himnos', 'himnos');
      return [defaultFolder];
    }

    const folders: ScoreFolder[] = data.documents.map((doc: any) => {
      const f = doc.fields || {};
      const id = doc.name.split('/').pop() || '';
      return {
        id: f.id?.stringValue || id,
        name: f.name?.stringValue || 'Sin nombre',
        description: f.description?.stringValue || '',
        createdAt: parseInt(f.createdAt?.integerValue || '0', 10) || Date.now(),
        count: parseInt(f.count?.integerValue || '0', 10),
      };
    });

    folders.sort((a, b) => a.createdAt - b.createdAt);
    await saveCachedFolders(folders);
    return folders;
  } catch (err) {
    console.error('Error fetching folders from Firebase (falling back to cache):', err);
    const cached = await getCachedFolders();
    if (cached && cached.length > 0) return cached;
    return [{
      id: 'himnos',
      name: 'Himnos',
      createdAt: Date.now(),
      description: 'Himnario y partituras generales',
    }];
  }
}

/**
 * Creates a new folder in Firestore
 */
export async function createFirebaseFolder(name: string, customId?: string): Promise<ScoreFolder> {
  const config = getFirebaseConfig();
  if (!config) throw new Error('Firebase no está configurado');

  const slug = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_-]/g, '_');
  const folderId = customId || (slug ? `${slug}_${Date.now().toString(36)}` : `f_${Date.now()}`);

  const folder: ScoreFolder = {
    id: folderId,
    name: name.trim(),
    createdAt: Date.now(),
    count: 0,
  };

  const url = `https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/(default)/documents/carpetas/${folderId}?key=${config.apiKey}`;
  const body = {
    fields: {
      id: { stringValue: folder.id },
      name: { stringValue: folder.name },
      createdAt: { integerValue: String(folder.createdAt) },
      count: { integerValue: '0' },
    },
  };

  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Error al crear carpeta: HTTP ${res.status}`);
  }

  return folder;
}

/**
 * Deletes a folder and all scores inside it
 */
export async function deleteFirebaseFolder(folderId: string): Promise<void> {
  const config = getFirebaseConfig();
  if (!config) return;

  // 1. Delete folder doc
  const folderUrl = `https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/(default)/documents/carpetas/${folderId}?key=${config.apiKey}`;
  await fetch(folderUrl, { method: 'DELETE' }).catch(() => {});

  // 2. Fetch scores in this folder and delete them
  try {
    const scores = await getScoresByFolder(folderId);
    for (const score of scores) {
      await deleteScoreFromFirebase(score.id);
    }
  } catch (err) {
    console.warn('Error deleting scores in folder:', err);
  }
}

// ============================================================================
// PARTITURAS (SCORES) MANAGEMENT IN FIRESTORE
// ============================================================================

/**
 * Retrieves the lightweight list of scores inside a folder (without downloading heavy PDF base64).
 * Checks IndexedDB cache first to avoid Firebase reads unless forceRefresh is true.
 */
export async function getScoresByFolder(folderId: string, forceRefresh = false): Promise<CloudScoreItem[]> {
  // 1. Check local IndexedDB cache first (0 Firebase reads)
  if (!forceRefresh) {
    const cached = await getCachedFolderScores(folderId);
    if (cached && cached.length > 0) {
      return cached;
    }
  }

  const config = getFirebaseConfig();
  if (!config) {
    const cached = await getCachedFolderScores(folderId);
    return cached || [];
  }

  try {
    const url = `https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/(default)/documents:runQuery?key=${config.apiKey}`;
    const queryBody = {
      structuredQuery: {
        from: [{ collectionId: 'partituras' }],
        where: {
          fieldFilter: {
            field: { fieldPath: 'folderId' },
            op: 'EQUAL',
            value: { stringValue: folderId },
          },
        },
        select: {
          fields: [
            { fieldPath: 'id' },
            { fieldPath: 'folderId' },
            { fieldPath: 'number' },
            { fieldPath: 'title' },
            { fieldPath: 'fileName' },
            { fieldPath: 'hasSavedNotes' },
            { fieldPath: 'savedNotesCount' },
            { fieldPath: 'savedOriginalKey' },
            { fieldPath: 'numPages' },
            { fieldPath: 'sizeBytes' },
            { fieldPath: 'updatedAt' },
          ],
        },
      },
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(queryBody),
    });

    if (!res.ok) {
      console.warn('Query scores by folder failed, trying document list fallback');
      return getScoresByFolderFallback(folderId);
    }

    const list = await res.json();
    if (!Array.isArray(list)) return [];

    const items: CloudScoreItem[] = [];
    for (const item of list) {
      if (item.document && item.document.fields) {
        const f = item.document.fields;
        const id = item.document.name.split('/').pop() || '';
        items.push({
          id: f.id?.stringValue || id,
          folderId: f.folderId?.stringValue || folderId,
          number: f.number?.stringValue || '',
          title: f.title?.stringValue || 'Sin título',
          fileName: f.fileName?.stringValue || '',
          sizeBytes: parseInt(f.sizeBytes?.integerValue || '0', 10),
          numPages: parseInt(f.numPages?.integerValue || '1', 10),
          hasSavedNotes: !!f.hasSavedNotes?.booleanValue,
          savedNotesCount: parseInt(f.savedNotesCount?.integerValue || '0', 10),
          savedOriginalKey: f.savedOriginalKey?.stringValue || '',
          updatedAt: parseInt(f.updatedAt?.integerValue || '0', 10),
        });
      }
    }

    // Sort by hymn number or title
    items.sort((a, b) => {
      const numA = parseInt(a.number || '0', 10);
      const numB = parseInt(b.number || '0', 10);
      if (numA && numB) return numA - numB;
      return a.title.localeCompare(b.title);
    });

    // Save to local cache in IndexedDB
    await saveCachedFolderScores(folderId, items);

    return items;
  } catch (err) {
    console.error('Error in getScoresByFolder:', err);
    return getScoresByFolderFallback(folderId);
  }
}

/**
 * Fallback list method if runQuery is not supported or indexed
 */
async function getScoresByFolderFallback(folderId: string): Promise<CloudScoreItem[]> {
  const config = getFirebaseConfig();
  if (!config) {
    const cached = await getCachedFolderScores(folderId);
    if (cached && cached.length > 0) return cached;
    return await getLocalProjectsByFolder(folderId);
  }

  try {
    const url = `https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/(default)/documents/partituras?pageSize=300&key=${config.apiKey}`;
    const res = await fetch(url);
    if (!res.ok) {
      const cached = await getCachedFolderScores(folderId);
      if (cached && cached.length > 0) return cached;
      return await getLocalProjectsByFolder(folderId);
    }

    const data = await res.json();
    if (!data.documents || !Array.isArray(data.documents)) {
      const cached = await getCachedFolderScores(folderId);
      if (cached && cached.length > 0) return cached;
      return await getLocalProjectsByFolder(folderId);
    }

    const items: CloudScoreItem[] = [];
    for (const doc of data.documents) {
      const f = doc.fields || {};
      const docFolderId = f.folderId?.stringValue || 'himnos';
      if (docFolderId === folderId) {
        const id = doc.name.split('/').pop() || '';
        items.push({
          id: f.id?.stringValue || id,
          folderId: docFolderId,
          number: f.number?.stringValue || '',
          title: f.title?.stringValue || 'Sin título',
          fileName: f.fileName?.stringValue || '',
          sizeBytes: parseInt(f.sizeBytes?.integerValue || '0', 10),
          numPages: parseInt(f.numPages?.integerValue || '1', 10),
          hasSavedNotes: !!f.hasSavedNotes?.booleanValue,
          savedNotesCount: parseInt(f.savedNotesCount?.integerValue || '0', 10),
          savedOriginalKey: f.savedOriginalKey?.stringValue || '',
          updatedAt: parseInt(f.updatedAt?.integerValue || '0', 10),
        });
      }
    }

    items.sort((a, b) => {
      const numA = parseInt(a.number || '0', 10);
      const numB = parseInt(b.number || '0', 10);
      if (numA && numB) return numA - numB;
      return a.title.localeCompare(b.title);
    });

    // Save to local cache in IndexedDB
    await saveCachedFolderScores(folderId, items);

    return items;
  } catch (err) {
    console.error('Fallback list error (falling back to cache):', err);
    const cached = await getCachedFolderScores(folderId);
    if (cached && cached.length > 0) return cached;
    return await getLocalProjectsByFolder(folderId);
  }
}

/**
 * Loads a score by checking local IndexedDB first (0 Firebase reads).
 * If not in local cache, downloads from Firebase (1 read) and immediately
 * stores it in IndexedDB for subsequent instant offline opens.
 */
export async function loadScoreWithCache(scoreId: string): Promise<ScoreProject | null> {
  // 1. Check local IndexedDB cache first
  try {
    const local = await getProject(scoreId);
    if (local && local.fileData && local.fileData.length > 50) {
      return local;
    }
  } catch (err) {
    console.warn('Error reading project from local IndexedDB:', err);
  }

  // 2. Cache miss: Fetch from Firebase (exactly 1 read)
  const remote = await getScoreById(scoreId);
  if (remote) {
    // 3. Immediately store locally in IndexedDB so next time it's 0 reads
    await saveProjectLocallyOnly(remote);
    return remote;
  }

  return null;
}

/**
 * Retrieves a single score with its full PDF data and notes from Firestore
 */
export async function getScoreById(scoreId: string): Promise<ScoreProject | null> {
  const config = getFirebaseConfig();
  if (!config) return null;

  try {
    const docId = encodeURIComponent(scoreId);
    const url = `https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/(default)/documents/partituras/${docId}?key=${config.apiKey}`;
    const res = await fetch(url);
    if (!res.ok) return null;

    const doc = await res.json();
    const f = doc.fields;
    if (!f) return null;

    let notes = [];
    if (f.notesJson?.stringValue) {
      try {
        notes = JSON.parse(f.notesJson.stringValue);
      } catch {
        notes = [];
      }
    }

    return {
      id: f.id?.stringValue || scoreId,
      folderId: f.folderId?.stringValue || 'himnos',
      title: f.title?.stringValue || 'Sin título',
      number: f.number?.stringValue || '',
      fileName: f.fileName?.stringValue || '',
      fileData: f.fileData?.stringValue || '',
      sourceType: 'pdf',
      numPages: parseInt(f.numPages?.integerValue || '1', 10),
      notes,
      originalKey: f.originalKey?.stringValue || 'Do Mayor',
      transposeHistory: parseInt(f.transposeHistory?.integerValue || '0', 10),
      baseFontSize: parseInt(f.baseFontSize?.integerValue || '16', 10),
      noteOrientation: (f.noteOrientation?.stringValue as any) || 'horizontal',
      createdAt: parseInt(f.createdAt?.integerValue || '0', 10) || Date.now(),
      updatedAt: parseInt(f.updatedAt?.integerValue || '0', 10) || Date.now(),
    };
  } catch (err) {
    console.error('Error fetching score by id from Firebase:', err);
    return null;
  }
}

/**
 * Saves a score (with PDF and notes) to Firebase Firestore
 */
export async function saveScoreToFirebase(score: ScoreProject): Promise<boolean> {
  const config = getFirebaseConfig();
  if (!config) return false;

  try {
    const docId = encodeURIComponent(score.id);
    const url = `https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/(default)/documents/partituras/${docId}?key=${config.apiKey}`;

    const hasSavedNotes = Array.isArray(score.notes) && score.notes.length > 0;
    const savedNotesCount = hasSavedNotes ? score.notes.length : 0;

    const fields: Record<string, any> = {
      id: { stringValue: score.id },
      folderId: { stringValue: score.folderId || 'himnos' },
      title: { stringValue: score.title },
      fileName: { stringValue: score.fileName },
      sourceType: { stringValue: score.sourceType || 'pdf' },
      numPages: { integerValue: String(score.numPages || 1) },
      notesJson: { stringValue: JSON.stringify(score.notes || []) },
      hasSavedNotes: { booleanValue: hasSavedNotes },
      savedNotesCount: { integerValue: String(savedNotesCount) },
      savedOriginalKey: { stringValue: score.originalKey || 'Do Mayor' },
      originalKey: { stringValue: score.originalKey || 'Do Mayor' },
      transposeHistory: { integerValue: String(score.transposeHistory || 0) },
      baseFontSize: { integerValue: String(score.baseFontSize || 16) },
      noteOrientation: { stringValue: score.noteOrientation || 'horizontal' },
      updatedAt: { integerValue: String(Date.now()) },
      createdAt: { integerValue: String(score.createdAt || Date.now()) },
    };

    if (score.number) {
      fields.number = { stringValue: score.number };
    }

    // Only include fileData if provided (to avoid clearing existing PDF on note edits)
    if (score.fileData) {
      fields.fileData = { stringValue: score.fileData };
      fields.sizeBytes = { integerValue: String(Math.round(score.fileData.length * 0.75)) };
    }

    const res = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields }),
    });

    return res.ok;
  } catch (err) {
    console.error('Firebase saveScore error:', err);
    return false;
  }
}

/**
 * Deletes a single score from Firebase Firestore
 */
export async function deleteScoreFromFirebase(scoreId: string): Promise<boolean> {
  const config = getFirebaseConfig();
  if (!config) return false;

  try {
    const docId = encodeURIComponent(scoreId);
    const url = `https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/(default)/documents/partituras/${docId}?key=${config.apiKey}`;
    const res = await fetch(url, { method: 'DELETE' });
    return res.ok;
  } catch (err) {
    console.error('Firebase deleteScore error:', err);
    return false;
  }
}

// ============================================================================
// CARGA INDIVIDUAL Y MASIVA (BATCH UPLOAD)
// ============================================================================

/**
 * Converts a file to base64 Data URL
 */
export function fileToBase64(file: File | Blob): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Parses title and number from file name
 * e.g. "himno_001_santo_santo.pdf" -> number: "001", title: "Himno 1 - Santo Santo"
 */
export function parseHymnInfoFromFileName(fileName: string): { number: string; title: string } {
  const base = fileName.replace(/\.pdf$/i, '');
  const match = base.match(/^(?:himno_?)?(\d+)[-_ ]*(.+)$/i);

  if (match) {
    const num = match[1];
    const rawTitle = match[2]
      .split(/[-_ ]+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
    return {
      number: num,
      title: `Himno ${parseInt(num, 10)} - ${rawTitle}`,
    };
  }

  // Fallback: format snake_case or dash to Title Case
  const cleanTitle = base
    .split(/[-_ ]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');

  return {
    number: '',
    title: cleanTitle,
  };
}

/**
 * Uploads a batch of PDF files into a specific folder in Firebase Firestore
 */
export async function uploadBatchScores(
  files: File[],
  folderId: string,
  onProgress: (done: number, total: number, currentName: string) => void
): Promise<{ successful: number; failed: number }> {
  let successful = 0;
  let failed = 0;
  const total = files.length;

  for (let i = 0; i < total; i++) {
    const file = files[i];
    onProgress(i, total, file.name);

    try {
      // 1. Check size limit (< 950KB for Firestore document safety)
      if (file.size > 950 * 1024) {
        console.warn(`File ${file.name} is larger than 950KB (${Math.round(file.size / 1024)}KB)`);
      }

      // 2. Convert to Base64
      const fileData = await fileToBase64(file);

      // 3. Parse info
      const { number, title } = parseHymnInfoFromFileName(file.name);
      const safeId = file.name
        .toLowerCase()
        .replace(/\.pdf$/i, '')
        .replace(/[^a-z0-9_-]/g, '_');
      const docId = `${folderId}_${safeId}`;

      // 4. Try to get page count from PDF
      let numPages = 1;
      try {
        const doc = await loadPdfDocument(fileData);
        if (doc?.numPages) numPages = doc.numPages;
      } catch {
        numPages = 1;
      }

      const score: ScoreProject = {
        id: docId,
        folderId,
        number,
        title,
        fileName: file.name,
        fileData,
        sourceType: 'pdf',
        numPages,
        notes: [],
        originalKey: 'Do Mayor',
        transposeHistory: 0,
        baseFontSize: 16,
        noteOrientation: 'horizontal',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const saved = await saveScoreToFirebase(score);
      if (saved) {
        successful++;
      } else {
        failed++;
      }
    } catch (err) {
      console.error(`Error uploading ${file.name}:`, err);
      failed++;
    }

    onProgress(i + 1, total, file.name);
  }

  return { successful, failed };
}

// ============================================================================
// DESCARGA Y CACHÉ LOCAL PARA MODO OFFLINE (SIN INTERNET)
// ============================================================================

export interface CacheFolderProgress {
  current: number;
  total: number;
  currentScoreTitle: string;
  downloadedCount: number;
  alreadyCachedCount: number;
  failedCount: number;
  lastCachedId?: string;
}

/**
 * Downloads and caches all scores and their annotations/digitaciones in the given folder
 * into IndexedDB for 100% offline access.
 */
export async function cacheFolderScoresLocally(
  folderId: string,
  scores: CloudScoreItem[],
  onProgress: (progress: CacheFolderProgress) => void,
  signal?: { aborted: boolean }
): Promise<{ downloaded: number; alreadyCached: number; failed: number }> {
  // 1. Ensure folder score list metadata is cached in IndexedDB
  await saveCachedFolderScores(folderId, scores);

  let downloaded = 0;
  let alreadyCached = 0;
  let failed = 0;
  const total = scores.length;

  if (total === 0) {
    return { downloaded: 0, alreadyCached: 0, failed: 0 };
  }

  const CONCURRENCY = 4;
  let currentIndex = 0;

  const updateProgress = (title: string, lastCachedId?: string) => {
    onProgress({
      current: downloaded + alreadyCached + failed,
      total,
      currentScoreTitle: title,
      downloadedCount: downloaded,
      alreadyCachedCount: alreadyCached,
      failedCount: failed,
      lastCachedId,
    });
  };

  const processScore = async (score: CloudScoreItem) => {
    if (signal?.aborted) return;

    try {
      const local = await getProject(score.id);
      const hasValidPdf = !!(local && local.fileData && local.fileData.length > 50);

      // Check if local is already present and matching cloud version
      const localNotesCount = Array.isArray(local?.notes) ? local.notes.length : 0;
      const isUpToDate =
        hasValidPdf &&
        (!score.updatedAt || (local!.updatedAt && local!.updatedAt >= score.updatedAt)) &&
        localNotesCount === (score.savedNotesCount || 0);

      if (isUpToDate) {
        alreadyCached++;
        updateProgress(score.title, score.id);
        return;
      }

      // Download from Firebase (includes fileData PDF, notes/digitaciones, etc.)
      updateProgress(score.title);
      const remote = await getScoreById(score.id);
      if (remote && remote.fileData && remote.fileData.length > 50) {
        if (!remote.folderId) remote.folderId = folderId;
        await saveProjectLocallyOnly(remote);
        downloaded++;
        updateProgress(score.title, score.id);
      } else if (hasValidPdf && local) {
        alreadyCached++;
        updateProgress(score.title, score.id);
      } else {
        failed++;
        updateProgress(score.title);
      }
    } catch (err) {
      console.warn(`Error caching score ${score.title} (${score.id}):`, err);
      failed++;
      updateProgress(score.title);
    }
  };

  const workers = Array.from({ length: Math.min(CONCURRENCY, total) }, async () => {
    while (currentIndex < total) {
      if (signal?.aborted) break;
      const idx = currentIndex++;
      await processScore(scores[idx]);
    }
  });

  await Promise.all(workers);

  return { downloaded, alreadyCached, failed };
}
