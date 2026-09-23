import React, { useRef, useState, useEffect } from 'react';
import type { ScoreProject } from '../types';
import {
  Music,
  Save,
  Download,
  Play,
  Square,
  Upload,
  CheckCircle2,
  Sparkles,
  Maximize2,
  Minimize2,
  Cloud,
  MoreVertical,
  BookOpen,
} from 'lucide-react';

interface HeaderProps {
  project: ScoreProject;
  hasUnsavedChanges: boolean;
  isPlayingAudio: boolean;
  isSoloScoreMode: boolean;
  onToggleSoloScore: () => void;
  onUpdateTitle: (newTitle: string) => void;
  onUploadFile: (file: File) => void;
  onOpenLibrary: () => void;
  onOpenAutoDetect: () => void;
  onSaveProject: () => void;
  onTogglePlayAudio: () => void;
  onOpenExport: () => void;
  onOpenFirebase: () => void;
  onExportBackup?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  project,
  hasUnsavedChanges,
  isPlayingAudio,
  isSoloScoreMode,
  onToggleSoloScore,
  onUpdateTitle,
  onUploadFile,
  onOpenLibrary,
  onOpenAutoDetect,
  onSaveProject,
  onTogglePlayAudio,
  onOpenExport,
  onOpenFirebase,
  onExportBackup,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUploadFile(file);
    }
    e.target.value = '';
  };

  // Close more menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMoreMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="app-header">
      {/* 1. Left: Brand & Title */}
      <div className="header-left-cluster">
        <div className="header-brand" onClick={onOpenLibrary} title="Abrir biblioteca de partituras e himnario">
          <div className="logo-badge">
            <Music size={20} className="logo-icon" />
          </div>
          <div className="brand-titles">
            <span className="brand-name">NotaScore</span>
            <span className="brand-subtitle">Cifrado Español</span>
          </div>
        </div>

        {/* Editable Title */}
        <div className="project-title-box">
          <input
            type="text"
            value={project.title}
            onChange={(e) => onUpdateTitle(e.target.value)}
            placeholder="Nombre de la partitura..."
            className="project-title-input"
            title="Haz clic para editar el nombre de la partitura"
          />
          <div className="save-status-indicator">
            {hasUnsavedChanges ? (
              <span className="status-badge unsaved" title="Hay cambios pendientes por guardar">
                <span className="status-dot orange" />
                <span className="status-text-compact">Pendiente</span>
              </span>
            ) : (
              <span className="status-badge saved" title="Guardado correctamente en la biblioteca">
                <CheckCircle2 size={13} />
                <span className="status-text-compact">Guardado</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="application/pdf,image/png,image/jpeg,image/webp"
        style={{ display: 'none' }}
      />

      {/* 2. Center: Core Music Actions */}
      <div className="header-center-actions">
        {/* Himnario / Mis Partituras */}
        <button
          type="button"
          className="header-btn library-btn"
          onClick={onOpenLibrary}
          title="Ver los 732 himnos y tus partituras guardadas"
        >
          <BookOpen size={16} />
          <span className="btn-text-responsive">Himnario</span>
          <span className="hymn-badge">732</span>
        </button>

        {/* Auto Detect Notes (OMR) */}
        <button
          type="button"
          className="header-btn auto-detect-btn hide-on-mobile"
          onClick={onOpenAutoDetect}
          title="Detectar automáticamente las notas de la melodía con su armadura"
        >
          <Sparkles size={16} className="sparkle-gold" />
          <span className="btn-text-responsive">Auto-Detectar</span>
        </button>

        {/* Audio Synth Player */}
        <button
          type="button"
          className={`header-btn audio-btn ${isPlayingAudio ? 'playing' : ''}`}
          onClick={onTogglePlayAudio}
          title={isPlayingAudio ? 'Detener reproducción' : 'Escuchar notas de la melodía'}
        >
          {isPlayingAudio ? (
            <>
              <Square size={15} fill="currentColor" />
              <span className="btn-text-responsive">Detener</span>
            </>
          ) : (
            <>
              <Play size={15} fill="currentColor" />
              <span className="btn-text-responsive">Escuchar ({project.notes.length})</span>
            </>
          )}
        </button>

        {/* Fullscreen / Solo Score Button */}
        <button
          type="button"
          className={`header-btn fullscreen-btn hide-on-mobile ${isSoloScoreMode ? 'active' : ''}`}
          onClick={onToggleSoloScore}
          title={isSoloScoreMode ? 'Salir de pantalla completa' : 'Pantalla completa / Solo partitura (F)'}
        >
          {isSoloScoreMode ? (
            <>
              <Minimize2 size={16} />
              <span className="btn-text-responsive">Salir</span>
            </>
          ) : (
            <>
              <Maximize2 size={16} />
              <span className="btn-text-responsive">Solo Partitura</span>
            </>
          )}
        </button>
      </div>

      {/* 3. Right: Save, Upload and Overflow Menu */}
      <div className="header-right-actions">
        {/* Save Button (Highlighted when unsaved) */}
        <button
          type="button"
          className={`header-btn save-btn ${hasUnsavedChanges ? 'primary-save' : ''}`}
          onClick={onSaveProject}
          title="Guardar notas en servidor y memoria local"
        >
          <Save size={16} />
          <span className="save-btn-text">Guardar</span>
        </button>

        {/* Upload Button */}
        <button
          type="button"
          className="header-btn upload-btn hide-on-mobile"
          onClick={() => fileInputRef.current?.click()}
          title="Subir PDF o imagen desde tu equipo"
        >
          <Upload size={16} />
          <span className="btn-text-responsive">Subir</span>
        </button>

        {/* Export Button (Direct on desktop) */}
        <button
          type="button"
          className="header-btn export-btn hide-on-tablet"
          onClick={onOpenExport}
          title="Descargar partitura en PDF o Imagen"
        >
          <Download size={16} />
          <span className="btn-text-responsive">Exportar</span>
        </button>

        {/* More Options Dropdown (•••) */}
        <div className="more-menu-container" ref={menuRef}>
          <button
            type="button"
            className={`header-btn more-btn ${showMoreMenu ? 'active' : ''}`}
            onClick={() => setShowMoreMenu((prev) => !prev)}
            title="Más opciones de sincronización y respaldo"
          >
            <MoreVertical size={18} />
          </button>

          {showMoreMenu && (
            <div className="more-dropdown-panel fade-in">
              <button
                type="button"
                className="dropdown-item"
                onClick={() => {
                  setShowMoreMenu(false);
                  onOpenAutoDetect();
                }}
              >
                <Sparkles size={16} className="text-amber" />
                <div>
                  <strong>Auto-Detectar Melodía (IA)</strong>
                  <p>Escanear notas del pentagrama con armadura</p>
                </div>
              </button>

              <button
                type="button"
                className="dropdown-item"
                onClick={() => {
                  setShowMoreMenu(false);
                  onToggleSoloScore();
                }}
              >
                {isSoloScoreMode ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                <div>
                  <strong>{isSoloScoreMode ? 'Salir de Pantalla Completa' : 'Solo Partitura (Pantalla Completa)'}</strong>
                  <p>Ocultar barras para ver solo la partitura</p>
                </div>
              </button>

              <button
                type="button"
                className="dropdown-item"
                onClick={() => {
                  setShowMoreMenu(false);
                  onOpenFirebase();
                }}
              >
                <Cloud size={16} className="text-amber" />
                <div>
                  <strong>Sincronización Firebase</strong>
                  <p>Guarda en la nube para ver en tu celular y web</p>
                </div>
              </button>

              <button
                type="button"
                className="dropdown-item"
                onClick={() => {
                  setShowMoreMenu(false);
                  onOpenExport();
                }}
              >
                <Download size={16} />
                <div>
                  <strong>Exportar Partitura</strong>
                  <p>Descargar en PDF o Imagen con notas</p>
                </div>
              </button>

              <button
                type="button"
                className="dropdown-item"
                onClick={() => {
                  setShowMoreMenu(false);
                  fileInputRef.current?.click();
                }}
              >
                <Upload size={16} />
                <div>
                  <strong>Subir PDF / Imagen</strong>
                  <p>Cargar partitura externa desde el equipo</p>
                </div>
              </button>

              {onExportBackup && (
                <button
                  type="button"
                  className="dropdown-item"
                  onClick={() => {
                    setShowMoreMenu(false);
                    onExportBackup();
                  }}
                >
                  <Save size={16} />
                  <div>
                    <strong>Descargar Copia de Seguridad JSON</strong>
                    <p>Respaldo completo de todas tus notas</p>
                  </div>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
