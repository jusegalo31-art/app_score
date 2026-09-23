import React, { useState, useMemo, useRef, useEffect } from 'react';
import type { PartituraHymnItem, ScoreProject } from '../types';
import {
  Search,
  X,
  FileMusic,
  Trash2,
  Copy,
  Download,
  Upload,
  Calendar,
  Sparkles,
  Music2,
  FolderOpen,
  BookOpen,
  CheckCircle,
  FileText,
} from 'lucide-react';
import { formatTransposeDescription } from '../utils/musicTheory';
import { fetchPartiturasHymnsList } from '../services/storage';

interface LibraryModalProps {
  isOpen: boolean;
  projects: ScoreProject[];
  currentProjectId: string;
  onClose: () => void;
  onSelectProject: (project: ScoreProject) => void;
  onSelectHymn: (hymn: PartituraHymnItem) => void;
  onDeleteProject: (projectId: string) => void;
  onDuplicateProject: (project: ScoreProject) => void;
  onLoadSampleProject: () => void;
  onImportJson: (jsonData: string) => void;
  onExportFullBackup?: () => void;
}

export const LibraryModal: React.FC<LibraryModalProps> = ({
  isOpen,
  projects,
  currentProjectId,
  onClose,
  onSelectProject,
  onSelectHymn,
  onDeleteProject,
  onDuplicateProject,
  onLoadSampleProject,
  onImportJson,
  onExportFullBackup,
}) => {
  const [activeTab, setActiveTab] = useState<'hymns' | 'projects'>('hymns');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [hymnsList, setHymnsList] = useState<PartituraHymnItem[]>([]);
  const [isLoadingHymns, setIsLoadingHymns] = useState(false);
  const jsonInputRef = useRef<HTMLInputElement>(null);

  // Load 732 hymns list from server when modal opens
  useEffect(() => {
    if (isOpen) {
      setIsLoadingHymns(true);
      fetchPartiturasHymnsList()
        .then((items) => {
          setHymnsList(items);
        })
        .finally(() => {
          setIsLoadingHymns(false);
        });
    }
  }, [isOpen]);

  // Extract all unique tags for custom projects
  const allTags = useMemo(() => {
    const tagsSet = new Set<string>();
    projects.forEach((p) => {
      p.tags?.forEach((t) => tagsSet.add(t));
    });
    return Array.from(tagsSet);
  }, [projects]);

  // Filter 732 hymns list
  const filteredHymns = useMemo(() => {
    if (!searchQuery.trim()) return hymnsList;
    const q = searchQuery.toLowerCase().trim();
    return hymnsList.filter((h) => {
      return (
        h.number.includes(q) ||
        h.title.toLowerCase().includes(q) ||
        h.filename.toLowerCase().includes(q)
      );
    });
  }, [hymnsList, searchQuery]);

  // Filter custom projects
  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      const matchesSearch =
        p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.author && p.author.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (p.instrument && p.instrument.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesTag = !selectedTag || (p.tags && p.tags.includes(selectedTag));
      return matchesSearch && matchesTag;
    });
  }, [projects, searchQuery, selectedTag]);

  if (!isOpen) return null;

  const handleExportJson = (project: ScoreProject, e: React.MouseEvent) => {
    e.stopPropagation();
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(project, null, 2));
    const a = document.createElement('a');
    a.href = dataStr;
    const safeTitle = project.title.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    a.download = `respaldo_${safeTitle}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        if (content) {
          try {
            onImportJson(content);
          } catch (err) {
            alert('Error al leer el archivo JSON: ' + err);
          }
        }
      };
      reader.readAsText(file);
    }
    e.target.value = '';
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-container library-modal" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="modal-header">
          <div className="modal-title-group">
            <FolderOpen className="modal-title-icon" size={24} />
            <div>
              <h2 className="modal-title">Biblioteca de Partituras</h2>
              <p className="modal-subtitle">
                Busca, abre o gestiona todas tus partituras guardadas
              </p>
            </div>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose} title="Cerrar ventana">
            <X size={20} />
          </button>
        </div>

        {/* Tabs switcher: Himnario vs Mis Partituras */}
        <div className="library-tabs-row">
          <button
            type="button"
            className={`library-tab-btn ${activeTab === 'hymns' ? 'active' : ''}`}
            onClick={() => setActiveTab('hymns')}
          >
            <BookOpen size={16} />
            <span className="btn-text-full">Himnario Completo</span>
            <span className="btn-text-compact">Himnario</span>
            <span className="tab-counter-badge">{hymnsList.length > 0 ? hymnsList.length : '732'}</span>
          </button>

          <button
            type="button"
            className={`library-tab-btn ${activeTab === 'projects' ? 'active' : ''}`}
            onClick={() => setActiveTab('projects')}
          >
            <FolderOpen size={16} />
            <span className="btn-text-full">Mis Partituras Editadas</span>
            <span className="btn-text-compact">Mis Partituras</span>
            <span className="tab-counter-badge">{projects.length}</span>
          </button>
        </div>

        {/* Search & Actions Bar */}
        <div className="library-toolbar">
          <div className="library-search-box">
            <Search size={18} className="search-icon" />
            <input
              type="text"
              placeholder={
                activeTab === 'hymns'
                  ? 'Buscar por número (ej. 001) o título (ej. Santo)...'
                  : 'Buscar partitura por título o autor...'
              }
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
            {activeTab === 'projects' && (
              <button
                type="button"
                className="lib-action-btn primary"
                onClick={onLoadSampleProject}
                title="Cargar la partitura de muestra Noche de Paz para probar"
              >
                <Sparkles size={15} />
                <span className="btn-text-full">Cargar Muestra</span>
                <span className="btn-text-compact">Muestra</span>
              </button>
            )}

            <button
              type="button"
              className="lib-action-btn secondary"
              onClick={() => jsonInputRef.current?.click()}
              title="Restaurar una copia de seguridad (.json) de notas"
            >
              <Upload size={15} />
              <span className="btn-text-full">Restaurar Respaldo</span>
              <span className="btn-text-compact">Restaurar</span>
            </button>
            <input
              type="file"
              ref={jsonInputRef}
              onChange={handleFileImport}
              accept=".json"
              style={{ display: 'none' }}
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
                <span className="btn-text-compact">Descargar</span>
              </button>
            )}
          </div>
        </div>

        {/* Content Area */}
        {activeTab === 'hymns' ? (
          /* TAB 1: 732 HIMNOS */
          <div className="projects-grid-area hymns-grid-area">
            {isLoadingHymns ? (
              <div className="empty-library-state">
                <div className="spinner" />
                <p>Cargando catálogo del Himnario...</p>
              </div>
            ) : filteredHymns.length === 0 ? (
              <div className="empty-library-state">
                <BookOpen size={48} className="empty-icon" />
                <h3>No se encontraron himnos</h3>
                <p>No hay coincidencias con "{searchQuery}". Intenta buscar por número (ej: 1, 15, 200) o parte del título.</p>
              </div>
            ) : (
              filteredHymns.slice(0, 120).map((hymn) => (
                <div
                  key={hymn.filename}
                  className={`project-card hymn-card ${hymn.hasSavedNotes ? 'has-notes' : ''}`}
                  onClick={() => {
                    onSelectHymn(hymn);
                    onClose();
                  }}
                >
                  <div className="hymn-card-badge">
                    <span className="hymn-num">#{parseInt(hymn.number, 10)}</span>
                  </div>

                  <div className="card-top">
                    <div className="card-header-info">
                      <h4 className="card-title" title={hymn.title}>
                        {hymn.title}
                      </h4>
                      <span className="card-filename">{hymn.filename}</span>
                    </div>
                  </div>

                  <div className="card-meta-row">
                    {hymn.hasSavedNotes ? (
                      <span className="hymn-saved-badge">
                        <CheckCircle size={13} />
                        <strong>{hymn.savedNotesCount || 0}</strong> notas guardadas
                      </span>
                    ) : (
                      <span className="hymn-untouched-badge">
                        <FileText size={13} /> PDF original listo
                      </span>
                    )}

                    {hymn.savedOriginalKey && (
                      <span className="hymn-key-badge">{hymn.savedOriginalKey}</span>
                    )}
                  </div>

                  <div className="hymn-card-hover-action">
                    <span>Abrir Partitura →</span>
                  </div>
                </div>
              ))
            )}
            {filteredHymns.length > 120 && (
              <div className="hymns-pagination-hint">
                Mostrando 120 de {filteredHymns.length} himnos coincidentes. Usa el buscador para refinar.
              </div>
            )}
          </div>
        ) : (
          /* TAB 2: PROYECTOS EDITADOS LOCALES */
          <div className="projects-grid-area">
            {allTags.length > 0 && (
              <div className="tags-filter-row">
                <button
                  type="button"
                  className={`tag-chip ${!selectedTag ? 'active' : ''}`}
                  onClick={() => setSelectedTag(null)}
                >
                  Todos ({projects.length})
                </button>
                {allTags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    className={`tag-chip ${selectedTag === tag ? 'active' : ''}`}
                    onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            )}

            {filteredProjects.length === 0 ? (
              <div className="empty-library-state">
                <FileMusic size={48} className="empty-icon" />
                <h3>No se encontraron partituras</h3>
                <p>
                  {searchQuery
                    ? 'Intenta con otro término de búsqueda o borra el filtro.'
                    : 'Aún no tienes partituras guardadas en tus proyectos.'}
                </p>
                {!searchQuery && (
                  <button
                    type="button"
                    className="lib-action-btn primary mt-3"
                    onClick={onLoadSampleProject}
                  >
                    <Sparkles size={16} /> Cargar Noche de Paz de Muestra
                  </button>
                )}
              </div>
            ) : (
              filteredProjects.map((proj) => {
                const isCurrent = proj.id === currentProjectId;
                const dateFormatted = new Date(proj.updatedAt).toLocaleDateString('es-ES', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                });

                return (
                  <div
                    key={proj.id}
                    className={`project-card ${isCurrent ? 'current-active' : ''}`}
                    onClick={() => {
                      onSelectProject(proj);
                      onClose();
                    }}
                  >
                    <div className="card-top">
                      <div className="card-icon-container">
                        <Music2 size={24} className="card-musical-icon" />
                      </div>
                      <div className="card-header-info">
                        <h4 className="card-title" title={proj.title}>
                          {proj.title}
                        </h4>
                        {proj.author && <span className="card-author">{proj.author}</span>}
                      </div>
                      {isCurrent && <span className="active-badge">Abierta</span>}
                    </div>

                    <div className="card-meta-row">
                      <div className="meta-item">
                        <strong>{proj.notes.length}</strong> notas digitadas
                      </div>
                      <div className="meta-item">
                        {proj.transposeHistory !== 0 ? (
                          <span className="transposed-tag">
                            {formatTransposeDescription(proj.transposeHistory)}
                          </span>
                        ) : (
                          <span>Tono original: {proj.originalKey || 'Do Mayor'}</span>
                        )}
                      </div>
                    </div>

                    <div className="card-footer">
                      <div className="card-date">
                        <Calendar size={13} />
                        <span>{dateFormatted}</span>
                      </div>

                      <div className="card-buttons">
                        <button
                          type="button"
                          className="card-mini-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDuplicateProject(proj);
                          }}
                          title="Duplicar partitura"
                        >
                          <Copy size={14} />
                        </button>
                        <button
                          type="button"
                          className="card-mini-btn"
                          onClick={(e) => handleExportJson(proj, e)}
                          title="Guardar archivo de respaldo JSON"
                        >
                          <Download size={14} />
                        </button>
                        {projects.length > 1 && (
                          <button
                            type="button"
                            className="card-mini-btn danger"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (window.confirm(`¿Seguro que deseas eliminar "${proj.title}"?`)) {
                                onDeleteProject(proj.id);
                              }
                            }}
                            title="Eliminar de la biblioteca"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
};
