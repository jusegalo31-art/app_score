import type { FirebaseConfig, ScoreProject } from '../types';

const STORAGE_KEY = 'notascore_firebase_config';

// Optional default configuration that can be baked into the app during build or hosting
export const DEFAULT_FIREBASE_CONFIG: FirebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
};

/**
 * Retrieves the stored Firebase configuration from localStorage or default environment
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

  // Fallback to baked-in default configuration if defined
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
    const url = `https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/(default)/documents/partituras?pageSize=1&key=${config.apiKey}`;
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

/**
 * Helper to encode project into Firestore fields format
 */
function projectToFirestoreFields(project: ScoreProject): Record<string, unknown> {
  return {
    fields: {
      id: { stringValue: project.id },
      title: { stringValue: project.title },
      fileName: { stringValue: project.fileName },
      sourceType: { stringValue: project.sourceType },
      originalKey: { stringValue: project.originalKey || 'Do Mayor' },
      transposeHistory: { integerValue: String(project.transposeHistory || 0) },
      baseFontSize: { integerValue: String(project.baseFontSize || 16) },
      noteOrientation: { stringValue: project.noteOrientation || 'horizontal' },
      numPages: { integerValue: String(project.numPages || 1) },
      updatedAt: { integerValue: String(Date.now()) },
      isPartituraFile: { booleanValue: !!project.isPartituraFile },
      partituraFilename: { stringValue: project.partituraFilename || '' },
      // Store notes as compact serialized JSON string for efficiency
      notesJson: { stringValue: JSON.stringify(project.notes || []) },
    },
  };
}

/**
 * Helper to decode Firestore document back into ScoreProject
 */
function firestoreDocToProject(doc: any): Partial<ScoreProject> | null {
  try {
    const f = doc.fields;
    if (!f) return null;

    let notes = [];
    if (f.notesJson?.stringValue) {
      notes = JSON.parse(f.notesJson.stringValue);
    }

    return {
      id: f.id?.stringValue || doc.name.split('/').pop(),
      title: f.title?.stringValue || 'Sin título',
      fileName: f.fileName?.stringValue || '',
      sourceType: f.sourceType?.stringValue || 'pdf',
      originalKey: f.originalKey?.stringValue || 'Do Mayor',
      transposeHistory: parseInt(f.transposeHistory?.integerValue || '0', 10),
      baseFontSize: parseInt(f.baseFontSize?.integerValue || '16', 10),
      noteOrientation: (f.noteOrientation?.stringValue as any) || 'horizontal',
      numPages: parseInt(f.numPages?.integerValue || '1', 10),
      updatedAt: parseInt(f.updatedAt?.integerValue || '0', 10),
      isPartituraFile: !!f.isPartituraFile?.booleanValue,
      partituraFilename: f.partituraFilename?.stringValue || '',
      notes,
    };
  } catch (err) {
    console.error('Error decoding firestore doc:', err);
    return null;
  }
}

/**
 * Saves a project to Firebase Firestore
 */
export async function saveProjectToFirebase(project: ScoreProject): Promise<boolean> {
  const config = getFirebaseConfig();
  if (!config) return false;

  try {
    const docId = encodeURIComponent(project.partituraFilename || project.id);
    const url = `https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/(default)/documents/partituras/${docId}?key=${config.apiKey}`;

    const body = projectToFirestoreFields(project);
    const res = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    return res.ok;
  } catch (err) {
    console.error('Firebase save error:', err);
    return false;
  }
}

/**
 * Fetches a single project from Firebase by filename or id
 */
export async function getProjectFromFirebase(idOrFilename: string): Promise<Partial<ScoreProject> | null> {
  const config = getFirebaseConfig();
  if (!config) return null;

  try {
    const docId = encodeURIComponent(idOrFilename);
    const url = `https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/(default)/documents/partituras/${docId}?key=${config.apiKey}`;
    const res = await fetch(url);
    if (!res.ok) return null;

    const data = await res.json();
    return firestoreDocToProject(data);
  } catch (err) {
    console.error('Firebase fetch error:', err);
    return null;
  }
}

/**
 * Fetches all saved projects from Firebase
 */
export async function getAllProjectsFromFirebase(): Promise<Partial<ScoreProject>[]> {
  const config = getFirebaseConfig();
  if (!config) return [];

  try {
    const url = `https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/(default)/documents/partituras?pageSize=300&key=${config.apiKey}`;
    const res = await fetch(url);
    if (!res.ok) return [];

    const data = await res.json();
    const docs = data.documents || [];
    return docs.map(firestoreDocToProject).filter(Boolean) as Partial<ScoreProject>[];
  } catch (err) {
    console.error('Firebase fetch all error:', err);
    return [];
  }
}
