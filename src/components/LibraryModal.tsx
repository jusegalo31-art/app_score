import React, { useState, useMemo, useRef, useEffect } from 'react';
import type { ScoreProject, ScoreFolder, CloudScoreItem } from '../types';
import {
  Search,
  X,
  FileMusic,
  Trash2,
  Download,
  FolderOpen,
  FolderPlus,
  UploadCloud,
  CheckCircle2,
  FileText,
  Loader2,
  RefreshCw,
  Zap,
} from 'lucide-react';
import {
  getFirebaseFolders,
  createFirebaseFolder,
  deleteFirebaseFolder,
  getScoresByFolder,
  loadScoreWithCache,
  deleteScoreFromFirebase,
  uploadBatchScores,
} from '../services/firebase';
import { isScoreCachedLocally } from '../services/storage';

interface LibraryModalProps {
  isOpen: boolean;
  currentProjectId: string;
  onClose: () => void;
  onSelectProject: (project: ScoreProject) => void;
  onImportJson: (jsonData: string) => void;
  onExportFullBackup?: () => void;
}

export const LibraryModal: React.FC<LibraryModalProps> = ({
  isOpen,
  currentProjectId,
  onClose,
  onSelectProject,
  onImportJson,
  onExportFullBackup,
}) => {
  const [folders, setFolders] = useState<ScoreFolder[]>([]);
  const [activeFolderId, setActiveFolderId] = useState<string>('himnos');
  const [scores, setScores] = useState<CloudScoreItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [cachedIds, setCachedIds] = useState<Set<string>>(new Set());

  const [isLoadingFolders, setIsLoadingFolders] = useState(false);
  const [isLoadingScores, setIsLoadingScores] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [openingScoreId, setOpeningScoreId] = useState<string | null>(null);

  // New folder creation state
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  // Bulk upload progress state
  const [uploadProgress, setUploadProgress] = useState<{
    active: boolean;
    current: number;
    total: number;
    currentFileName: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const jsonBackupInputRef = useRef<HTMLInputElement>(null);

  // Load folders on open
  useEffect(() => {
    if (isOpen) {
      loadFolders();
    }
  }, [isOpen]);

  const loadFolders = async () => {
    setIsLoadingFolders(true);
    try {
      const list = await getFirebaseFolders();
      setFolders(list);
      if (list.length > 0 && !list.find((f) => f.id === activeFolderId)) {
        setActiveFolderId(list[0].id);
      }
    } catch (err) {
      console.error('Error loading folders:', err);
    } finally {
      setIsLoadingFolders(false);
    }
  };

  // Load scores whenever active folder changes (cached in IndexedDB first, 0 Firebase reads)
  useEffect(() => {
    if (isOpen && activeFolderId) {
      loadScores(activeFolderId);
    }
  }, [isOpen, activeFolderId]);

  const loadScores = async (folderId: string, forceRefresh = false) => {
    setIsLoadingScores(true);
    try {
      const items = await getScoresByFolder(folderId, forceRefresh);
      setScores(items);
    } catch (err) {
      console.error('Error loading scores for folder:', err);
    } finally {
      setIsLoadingScores(false);
    }
  };

  // Check which scores already have their full PDF cached in IndexedDB
  useEffect(() => {
    let isMounted = true;
    async function checkCachedScores() {
      if (scores.length === 0) {
        setCachedIds(new Set());
        return;
      }
      const set = new Set<string>();
      for (const s of scores) {
        if (await isScoreCachedLocally(s.id)) {
          set.add(s.id);
        }
      }
      if (isMounted) {
        setCachedIds(set);
      }
    }
    checkCachedScores();
    return () => {
      isMounted = false;
    };
  }, [scores]);

  // Handle manual sync/refresh with Firebase cloud
  const handleSyncRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await loadScores(activeFolderId, true);
      await loadFolders();
    } catch (err) {
      console.error('Error synchronizing with Firebase:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Handle create new folder
  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;

    try {
      const created = await createFirebaseFolder(newFolderName.trim());
      setFolders((prev) => [...prev, created]);
      setActiveFolderId(created.id);
      setNewFolderName('');
      setIsCreatingFolder(false);
    } catch (err) {
      alert('Error al crear carpeta: ' + String(err));
    }
  };

  // Handle delete folder
  const handleDeleteFolder = async (folder: ScoreFolder, e: React.MouseEvent) => {
    e.stopPropagation();
    if (folder.id === 'himnos') {
      alert('La carpeta principal Himnos no puede ser eliminada.');
      return;
    }

    const confirmDelete = window.confirm(
      `¿Estás seguro de eliminar la carpeta "${folder.name}" y todas las partituras contenidas en ella? Esta acción no se puede deshacer.`
    );
    if (!confirmDelete) return;

    try {
      await deleteFirebaseFolder(folder.id);
      setFolders((prev) => prev.filter((f) => f.id !== folder.id));
      setActiveFolderId('himnos');
    } catch (err) {
      alert('Error al eliminar carpeta: ' + String(err));
    }
  };

  // Handle bulk PDF upload
  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileList = Array.from(files).filter((f) => f.name.toLowerCase().endsWith('.pdf'));
    if (fileList.length === 0) {
      alert('Por favor selecciona archivos con formato PDF.');
      return;
    }

    setUploadProgress({
      active: true,
      current: 0,
      total: fileList.length,
      currentFileName: fileList[0].name,
    });

    try {
      const result = await uploadBatchScores(fileList, activeFolderId, (done, total, currentName) => {
        setUploadProgress({
          active: true,
          current: done,
          total,
          currentFileName: currentName,
        });
      });

      // Reload scores in active folder
      await loadScores(activeFolderId);
      // Reload folders to update count
      await loadFolders();

      alert(`¡Carga finalizada con éxito!\n✓ ${result.successful} partituras subidas a Firebase.${result.failed > 0 ? `\n⚠ ${result.failed} no se pudieron subir.` : ''}`);
    } catch (err) {
      alert('Error durante la subida: ' + String(err));
    } finally {
      setUploadProgress(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Handle opening a score (IndexedDB local cache checked first: 0 Firebase reads)
  const handleOpenScore = async (scoreItem: CloudScoreItem) => {
    setOpeningScoreId(scoreItem.id);
    try {
      const fullProject = await loadScoreWithCache(scoreItem.id);
      if (fullProject) {
        setCachedIds((prev) => new Set(prev).add(scoreItem.id));
        onSelectProject(fullProject);
        onClose();
      } else {
        alert('No se pudo descargar la partitura desde Firebase. Verifica tu conexión.');
      }
    } catch (err) {
      alert('Error al abrir la partitura: ' + String(err));
    } finally {
      setOpeningScoreId(null);
    }
  };

  // Handle delete score
  const handleDeleteScore = async (scoreItem: CloudScoreItem, e: React.MouseEvent) => {
    e.stopPropagation();
    const ok = window.confirm(`¿Eliminar "${scoreItem.title}" de Firebase?`);
    if (!ok) return;

    try {
      await deleteScoreFromFirebase(scoreItem.id);
      setScores((prev) => prev.filter((s) => s.id !== scoreItem.id));
    } catch (err) {
      alert('Error al eliminar partitura: ' + String(err));
    }
  };

  // Filtered scores in active folder
  const filteredScores = useMemo(() => {
    if (!searchQuery.trim()) return scores;
    const q = searchQuery.toLowerCase().trim();
    return scores.filter((s) => {
      const matchNum = s.number ? s.number.toLowerCase().includes(q) : false;
      const matchTitle = s.title.toLowerCase().includes(q);
      const matchFile = s.fileName.toLowerCase().includes(q);
      return matchNum || matchTitle || matchFile;
    });
  }, [scores, searchQuery]);

  if (!isOpen) return null;

  const activeFolder = folders.find((f) => f.id === activeFolderId) || folders[0];

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-container library-modal" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="modal-header">
          <div className="modal-title-group">
            <FolderOpen className="modal-title-icon" size={24} />
            <div>
              <h2 className="modal-title">Biblioteca de Partituras en Firebase</h2>
              <p className="modal-subtitle">
                Organiza tus partituras por carpetas y edítalas sincronizadas en la nube
              </p>
            </div>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose} title="Cerrar ventana">
            <X size={20} />
          </button>
        </div>

        {/* Carpetas (Folders Tab Row) */}
        <div className="library-tabs-row folders-tabs-row">
          {isLoadingFolders ? (
            <div className="loading-folders-hint">
              <Loader2 size={16} className="spin-icon" />
              <span>Cargando carpetas...</span>
            </div>
          ) : (
            <>
              {folders.map((folder) => {
                const isActive = activeFolderId === folder.id;
                return (
                  <button
                    key={folder.id}
                    type="button"
                    className={`library-tab-btn folder-tab-btn ${isActive ? 'active' : ''}`}
                    onClick={() => setActiveFolderId(folder.id)}
                  >
                    <FolderOpen size={16} />
                    <span className="btn-text-full">{folder.name}</span>
                    <span className="btn-text-compact">{folder.name}</span>
                    {isActive && (
                      <span className="tab-counter-badge">{scores.length}</span>
                    )}
                    {folder.id !== 'himnos' && (
                      <span
                        className="delete-folder-mini-btn"
                        onClick={(e) => handleDeleteFolder(folder, e)}
                        title="Eliminar esta carpeta"
                      >
                        ✕
                      </span>
                    )}
                  </button>
                );
              })}

              {/* Botón "+ Nueva Carpeta" */}
              {isCreatingFolder ? (
                <form className="new-folder-inline-form" onSubmit={handleCreateFolder}>
                  <input
                    type="text"
                    placeholder="Nombre de carpeta..."
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    className="new-folder-input"
                    autoFocus
                  />
                  <button type="submit" className="new-folder-submit-btn">
                    Crear
                  </button>
                  <button
                    type="button"
                    className="new-folder-cancel-btn"
                    onClick={() => {
                      setIsCreatingFolder(false);
                      setNewFolderName('');
                    }}
                  >
                    ✕
                  </button>
                </form>
              ) : (
                <button
                  type="button"
                  className="library-tab-btn add-folder-btn"
                  onClick={() => setIsCreatingFolder(true)}
                  title="Crear una nueva carpeta de partituras (ej. Himnos Jóvenes, Especiales)"
                >
                  <FolderPlus size={16} />
                  <span>+ Nueva Carpeta</span>
                </button>
              )}
            </>
          )}
        </div>

        {/* Toolbar: Search & Action Buttons */}
        <div className="library-toolbar">
          <div className="library-search-box">
            <Search size={18} className="search-icon" />
            <input
              type="text"
              placeholder={`Buscar en "${activeFolder?.name || 'carpeta'}" por número o título...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="library-search-input"
              autoFocus
            />
            {searchQuery && (
              <button
                type="button"
                className="clear-search-btn"
                onClick={() => setSearchQuery('')}
              >
                <X size={15} />
              </button>
            )}
          </div>

          <div className="library-actions-group">
            {/* Botón Sincronizar con Firebase (fuerza actualización de metadatos) */}
            <button
              type="button"
              className={`lib-action-btn secondary sync-btn ${isRefreshing ? 'syncing' : ''}`}
              onClick={handleSyncRefresh}
              disabled={isRefreshing}
              title="Sincronizar y actualizar lista con Firebase en la nube"
            >
              <RefreshCw size={15} className={isRefreshing ? 'spin-icon' : ''} />
              <span className="btn-text-full">{isRefreshing ? 'Sincronizando...' : 'Sincronizar'}</span>
              <span className="btn-text-compact">Sincronizar</span>
            </button>

            {/* Input para subida masiva de PDFs */}
            <input
              type="file"
              ref={fileInputRef}
              multiple
              accept=".pdf"
              onChange={handleFilesSelected}
              style={{ display: 'none' }}
            />

            <button
              type="button"
              className="lib-action-btn primary"
              onClick={() => fileInputRef.current?.click()}
              title={`Cargar uno o múltiples archivos PDF a la carpeta "${activeFolder?.name}"`}
            >
              <UploadCloud size={16} />
              <span className="btn-text-full">Subir Partituras (PDF)</span>
              <span className="btn-text-compact">Subir PDFs</span>
            </button>

            <button
              type="button"
              className="lib-action-btn secondary"
              onClick={() => jsonBackupInputRef.current?.click()}
              title="Restaurar notas desde un archivo de respaldo JSON"
            >
              <UploadCloud size={15} />
              <span className="btn-text-full">Restaurar</span>
              <span className="btn-text-compact">Restaurar</span>
            </button>
            <input
              type="file"
              ref={jsonBackupInputRef}
              accept=".json"
              style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onload = (ev) => {
                    const content = ev.target?.result as string;
                    if (content) onImportJson(content);
                  };
                  reader.readAsText(file);
                }
                e.target.value = '';
              }}
            />

            {onExportFullBackup && (
              <button
                type="button"
                className="lib-action-btn secondary"
                onClick={onExportFullBackup}
                title="Descargar una copia de seguridad JSON con todas tus notas"
              >
                <Download size={15} />
                <span className="btn-text-full">Descargar Respaldo</span>
                <span className="btn-text-compact">Respaldo</span>
              </button>
            )}
          </div>
        </div>

        {/* Upload Progress Modal Banner */}
        {uploadProgress && (
          <div className="upload-progress-banner">
            <div className="upload-progress-header">
              <div className="upload-progress-title">
                <Loader2 size={16} className="spin-icon" />
                <span>Subiendo a Firebase Firestore...</span>
              </div>
              <span className="upload-progress-pct">
                {uploadProgress.current} de {uploadProgress.total} ({Math.round((uploadProgress.current / uploadProgress.total) * 100)}%)
              </span>
            </div>
            <div className="upload-progress-bar-track">
              <div
                className="upload-progress-bar-fill"
                style={{
                  width: `${Math.round((uploadProgress.current / uploadProgress.total) * 100)}%`,
                }}
              />
            </div>
            <p className="upload-current-file">Procesando: {uploadProgress.currentFileName}</p>
          </div>
        )}

        {/* Content Area: Scores Grid in Active Folder */}
        <div className="projects-grid-area hymns-grid-area">
          {isLoadingScores ? (
            <div className="library-empty-state">
              <Loader2 size={36} className="spin-icon empty-icon" />
              <h3>Cargando partituras de Firebase...</h3>
              <p>Consultando la base de datos de tu proyecto</p>
            </div>
          ) : filteredScores.length === 0 ? (
            <div className="library-empty-state">
              <FileMusic size={44} className="empty-icon" />
              {searchQuery ? (
                <>
                  <h3>No se encontraron partituras</h3>
                  <p>No hay coincidencias con "{searchQuery}" en la carpeta {activeFolder?.name}.</p>
                </>
              ) : (
                <>
                  <h3>No hay partituras en la carpeta "{activeFolder?.name}"</h3>
                  <p>
                    Haz clic en <strong>"Subir Partituras (PDF)"</strong> para seleccionar tus archivos PDF (puedes subir de 1 hasta cientos de partituras a la vez). Todo quedará guardado automáticamente en Firebase.
                  </p>
                  <button
                    type="button"
                    className="lib-action-btn primary empty-upload-btn"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <UploadCloud size={16} />
                    <span>Seleccionar y Subir PDFs a Firebase</span>
                  </button>
                </>
              )}
            </div>
          ) : (
            <div className="hymns-grid">
              {filteredScores.map((score) => {
                const isOpening = openingScoreId === score.id;
                const isCurrent = currentProjectId === score.id;
                return (
                  <div
                    key={score.id}
                    className={`hymn-card ${isOpening ? 'opening-card' : ''} ${isCurrent ? 'has-notes' : ''}`}
                    onClick={() => !isOpening && handleOpenScore(score)}
                  >
                    <div className="hymn-card-top">
                      {score.number && (
                        <span className="hymn-card-number">#{parseInt(score.number, 10)}</span>
                      )}
                      <div className="hymn-badges-group">
                        {cachedIds.has(score.id) && (
                          <span className="hymn-cached-badge" title="PDF guardado en el navegador (abre instantáneo sin consumir lecturas de Firebase)">
                            <Zap size={11} />
                            <span>En caché</span>
                          </span>
                        )}
                        {score.hasSavedNotes ? (
                          <span className="hymn-notes-badge active">
                            <CheckCircle2 size={12} />
                            <span>{score.savedNotesCount} notas</span>
                          </span>
                        ) : (
                          <span className="hymn-notes-badge">
                            <span>Sin notas</span>
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="hymn-card-body">
                      <h4 className="hymn-card-title">{score.title}</h4>
                      <div className="hymn-card-meta">
                        {score.savedOriginalKey && (
                          <span className="hymn-meta-key">{score.savedOriginalKey}</span>
                        )}
                        {score.numPages && score.numPages > 1 && (
                          <span className="hymn-meta-pages">{score.numPages} págs</span>
                        )}
                      </div>
                    </div>

                    <div className="hymn-card-footer">
                      <span className="hymn-file-label">
                        <FileText size={12} />
                        <span className="hymn-file-name">{score.fileName}</span>
                      </span>
                      <button
                        type="button"
                        className="hymn-delete-btn"
                        onClick={(e) => handleDeleteScore(score, e)}
                        title="Eliminar esta partitura de Firebase"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>

                    {isOpening && (
                      <div className="card-opening-overlay">
                        <Loader2 size={18} className="spin-icon" />
                        <span>Descargando...</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
