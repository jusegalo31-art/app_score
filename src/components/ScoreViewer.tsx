import React, { useRef, useState, useEffect } from 'react';
import type { NoteAnnotation, EditorTool, NoteOrientation } from '../types';
import { formatNoteDisplay } from '../utils/musicTheory';
import { audioSynth } from '../utils/audioPlayer';
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  ChevronDown,
  ChevronUp,
  Rows,
  FileText,
} from 'lucide-react';
import { loadPdfDocument, renderPdfPage } from '../utils/pdfLoader';

interface ScoreViewerProps {
  sourceType: 'pdf' | 'image' | 'sample';
  fileData: string;
  notes: NoteAnnotation[];
  currentPage: number;
  numPages: number;
  toolMode: EditorTool;
  selectedNoteId: string | null;
  activePlayingNoteId: string | null;
  noteOrientation?: NoteOrientation;
  onToggleNoteOrientation?: () => void;
  onPageChange: (newPage: number) => void;
  onAddNote: (x: number, y: number, pageNumber?: number) => void;
  onSelectNote: (note: NoteAnnotation | null) => void;
  onUpdateNotePosition: (id: string, x: number, y: number) => void;
  onDeleteNote: (id: string) => void;
  baseFontSize?: number;
  isSoloScoreMode?: boolean;
  onToggleSoloScore?: () => void;
  onChangeBaseFontSize?: (delta: number) => void;
  onPageRendered?: (canvas: HTMLCanvasElement, pageNum: number) => void;
  onTotalPagesDetected?: (pages: number) => void;
}

// Sub-component for reliably rendering individual PDF pages
const PdfPageCanvas: React.FC<{
  pdfDocProxy: any;
  pageNum: number;
  zoomLevel: number;
  onPageRendered?: (canvas: HTMLCanvasElement, pageNum: number) => void;
}> = ({ pdfDocProxy, pageNum, zoomLevel, onPageRendered }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (pdfDocProxy && canvasRef.current) {
      let isCancelled = false;
      renderPdfPage(pdfDocProxy, pageNum, canvasRef.current, 2.0 * zoomLevel)
        .then(() => {
          if (!isCancelled && canvasRef.current && onPageRendered) {
            onPageRendered(canvasRef.current, pageNum);
          }
        })
        .catch((err) => {
          if (!isCancelled) console.error(`Error rendering PDF page ${pageNum}:`, err);
        });

      return () => {
        isCancelled = true;
      };
    }
  }, [pdfDocProxy, pageNum, zoomLevel, onPageRendered]);

  return <canvas ref={canvasRef} className="score-canvas-layer" />;
};

export const ScoreViewer: React.FC<ScoreViewerProps> = ({
  sourceType,
  fileData,
  notes,
  currentPage,
  numPages,
  toolMode,
  selectedNoteId,
  activePlayingNoteId,
  noteOrientation = 'horizontal',
  onToggleNoteOrientation,
  onPageChange,
  onAddNote,
  onSelectNote,
  onUpdateNotePosition,
  onDeleteNote,
  baseFontSize = 16,
  isSoloScoreMode = false,
  onToggleSoloScore,
  onChangeBaseFontSize,
  onPageRendered,
  onTotalPagesDetected,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const pageContainerRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const imageRef = useRef<HTMLImageElement>(null);

  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [isPdfLoading, setIsPdfLoading] = useState<boolean>(false);
  const [pdfDocProxy, setPdfDocProxy] = useState<any>(null);
  const [isBarCollapsed, setIsBarCollapsed] = useState<boolean>(false);

  // Layout mode: 'single' (one page at a time) or 'vertical' (continuous vertical scroll for all pages)
  const [pageLayoutMode, setPageLayoutMode] = useState<'single' | 'vertical'>(() => {
    try {
      const saved = localStorage.getItem('notascore_page_layout_mode');
      return saved === 'vertical' || saved === 'single' ? saved : 'single';
    } catch {
      return 'single';
    }
  });

  // Dragging state that tracks the note and its host page
  const [dragState, setDragState] = useState<{
    noteId: string;
    pageNum: number;
    startX: number;
    startY: number;
    noteX: number;
    noteY: number;
  } | null>(null);

  // Determine effective total pages (from parsed PDF doc or project)
  const effectiveNumPages = pdfDocProxy ? pdfDocProxy.numPages : (numPages || 1);

  // Pages to render depending on layout mode
  const pagesToRender =
    pageLayoutMode === 'vertical' && effectiveNumPages > 1
      ? Array.from({ length: effectiveNumPages }, (_, i) => i + 1)
      : [currentPage];

  // Load PDF when fileData changes
  useEffect(() => {
    if (sourceType === 'pdf') {
      let isCancelled = false;
      setIsPdfLoading(true);

      loadPdfDocument(fileData)
        .then((doc) => {
          if (!isCancelled) {
            setPdfDocProxy(doc);
            setIsPdfLoading(false);
            if (doc && doc.numPages && onTotalPagesDetected) {
              onTotalPagesDetected(doc.numPages);
            }
          }
        })
        .catch((err) => {
          console.error('Failed to parse PDF document:', err);
          if (!isCancelled) setIsPdfLoading(false);
        });

      return () => {
        isCancelled = true;
      };
    } else {
      setPdfDocProxy(null);
    }
  }, [fileData, sourceType, onTotalPagesDetected]);

  // Pass rendered image canvas reference for export if sample or image
  const handleImageLoad = () => {
    if (imageRef.current && onPageRendered) {
      const c = document.createElement('canvas');
      c.width = imageRef.current.naturalWidth || 900;
      c.height = imageRef.current.naturalHeight || 1200;
      const ctx = c.getContext('2d');
      if (ctx) {
        ctx.drawImage(imageRef.current, 0, 0, c.width, c.height);
        onPageRendered(c, currentPage);
      }
    }
  };

  // Zoom helpers
  const handleZoomIn = () => setZoomLevel((z) => Math.min(2.5, +(z + 0.15).toFixed(2)));
  const handleZoomOut = () => setZoomLevel((z) => Math.max(0.5, +(z - 0.15).toFixed(2)));
  const handleResetZoom = () => setZoomLevel(1);

  // Toggle layout mode between single page and vertical continuous
  const handleToggleLayoutMode = () => {
    const nextMode = pageLayoutMode === 'single' ? 'vertical' : 'single';
    setPageLayoutMode(nextMode);
    try {
      localStorage.setItem('notascore_page_layout_mode', nextMode);
    } catch {}
  };

  // Handle click on a specific page container
  const handlePageClick = (e: React.MouseEvent<HTMLDivElement>, pageNum: number) => {
    const container = pageContainerRefs.current.get(pageNum);
    if (!container) return;

    if ((e.target as HTMLElement).closest('.note-annotation-badge')) {
      return;
    }

    if (toolMode === 'place') {
      const rect = container.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      const pctX = (clickX / rect.width) * 100;
      const pctY = (clickY / rect.height) * 100;

      onAddNote(+pctX.toFixed(2), +pctY.toFixed(2), pageNum);
    } else if (toolMode === 'select') {
      onSelectNote(null);
    }
  };

  // Drag note handlers
  const handleNoteMouseDown = (e: React.MouseEvent, note: NoteAnnotation) => {
    e.stopPropagation();

    if (toolMode === 'erase') {
      onDeleteNote(note.id);
      return;
    }

    onSelectNote(note);
    audioSynth.playNote(note);

    if (toolMode === 'select') {
      const notePage = note.pageNumber || currentPage;
      setDragState({
        noteId: note.id,
        pageNum: notePage,
        startX: e.clientX,
        startY: e.clientY,
        noteX: note.x,
        noteY: note.y,
      });
    }
  };

  // Mouse move for dragging note
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragState) return;

      const container = pageContainerRefs.current.get(dragState.pageNum);
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const deltaXPct = ((e.clientX - dragState.startX) / rect.width) * 100;
      const deltaYPct = ((e.clientY - dragState.startY) / rect.height) * 100;

      let newX = Math.max(1, Math.min(99, dragState.noteX + deltaXPct));
      let newY = Math.max(1, Math.min(99, dragState.noteY + deltaYPct));

      onUpdateNotePosition(dragState.noteId, +newX.toFixed(2), +newY.toFixed(2));
    };

    const handleMouseUp = () => {
      if (dragState) {
        setDragState(null);
      }
    };

    if (dragState) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, onUpdateNotePosition]);

  // In vertical continuous scroll mode, track which page is primarily visible
  const handleScrollArea = () => {
    if (pageLayoutMode !== 'vertical' || !scrollAreaRef.current || effectiveNumPages <= 1) return;

    const scrollArea = scrollAreaRef.current;
    const scrollRect = scrollArea.getBoundingClientRect();
    const focusY = scrollRect.top + scrollRect.height * 0.35;

    for (let p = 1; p <= effectiveNumPages; p++) {
      const el = pageContainerRefs.current.get(p);
      if (el) {
        const rect = el.getBoundingClientRect();
        if (rect.top <= focusY && rect.bottom >= focusY) {
          if (currentPage !== p) {
            onPageChange(p);
          }
          break;
        }
      }
    }
  };

  // Page navigation (smooth scroll in vertical mode, page change in single mode)
  const handleNavigatePage = (targetPage: number) => {
    if (pageLayoutMode === 'vertical') {
      const targetEl = pageContainerRefs.current.get(targetPage);
      if (targetEl) {
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      onPageChange(targetPage);
    } else {
      onPageChange(targetPage);
    }
  };

  return (
    <div className={`score-viewer-wrapper ${isSoloScoreMode ? 'solo-mode-wrapper' : ''}`} ref={containerRef}>
      {/* Zoom, page and view controls floating bar */}
      {isBarCollapsed ? (
        <button
          type="button"
          className="viewer-floating-bar-minimized"
          onClick={() => setIsBarCollapsed(false)}
          title="Mostrar controles flotantes de zoom y partitura"
        >
          <ChevronUp size={15} />
          <span>Controles</span>
        </button>
      ) : (
        <div className={`viewer-floating-bar ${isSoloScoreMode ? 'solo-bar' : ''}`}>
          {/* Fullscreen / Solo score toggle button */}
          {onToggleSoloScore && (
            isSoloScoreMode ? (
              <button
                type="button"
                className="solo-exit-fullscreen-btn"
                onClick={onToggleSoloScore}
                title="Salir de pantalla completa (ESC)"
              >
                <Minimize2 size={15} />
                <span className="btn-text-full">Salir (ESC)</span>
                <span className="btn-text-compact">Salir</span>
              </button>
            ) : (
              <button
                type="button"
                className="viewer-icon-btn"
                onClick={onToggleSoloScore}
                title="Pantalla completa / Solo partitura (F)"
              >
                <Maximize2 size={16} />
              </button>
            )
          )}

          {/* Toggle between Single Page and Continuous Vertical Scroll */}
          {effectiveNumPages > 1 && (
            <button
              type="button"
              className={`viewer-icon-btn layout-toggle-btn ${pageLayoutMode === 'vertical' ? 'active-layout' : ''}`}
              onClick={handleToggleLayoutMode}
              title={
                pageLayoutMode === 'vertical'
                  ? 'Modo Continuo activo. Clic para ver 1 página por vez'
                  : 'Modo Paginado activo. Clic para ver todas las páginas en vertical continuo (Scroll)'
              }
            >
              {pageLayoutMode === 'vertical' ? <Rows size={15} /> : <FileText size={15} />}
              <span className="layout-btn-text hide-on-mobile">
                {pageLayoutMode === 'vertical' ? 'Continuo' : 'Paginado'}
              </span>
            </button>
          )}

          {/* Page controls */}
          {effectiveNumPages > 1 && (
            <div className="page-nav-group">
              <button
                type="button"
                className="viewer-icon-btn"
                onClick={() => handleNavigatePage(Math.max(1, currentPage - 1))}
                disabled={currentPage <= 1}
                title="Página anterior"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="page-indicator">
                {currentPage}/{effectiveNumPages}
              </span>
              <button
                type="button"
                className="viewer-icon-btn"
                onClick={() => handleNavigatePage(Math.min(effectiveNumPages, currentPage + 1))}
                disabled={currentPage >= effectiveNumPages}
                title="Página siguiente"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}

          {/* Zoom controls */}
          <div className="zoom-controls-group">
            <button
              type="button"
              className="viewer-icon-btn"
              onClick={handleZoomOut}
              title="Reducir zoom (-)"
            >
              <ZoomOut size={15} />
            </button>
            <span className="zoom-indicator">{Math.round(zoomLevel * 100)}%</span>
            <button
              type="button"
              className="viewer-icon-btn"
              onClick={handleZoomIn}
              title="Aumentar zoom (+)"
            >
              <ZoomIn size={15} />
            </button>
            <button
              type="button"
              className="viewer-icon-btn hide-on-mobile"
              onClick={handleResetZoom}
              title="Ajuste estándar 100%"
            >
              <RotateCcw size={14} />
            </button>
          </div>

          {/* Fast font size buttons */}
          {onChangeBaseFontSize && (
            <div className={`solo-font-controls ${!isSoloScoreMode ? 'hide-on-mobile' : ''}`}>
              <button
                type="button"
                className="solo-font-btn"
                onClick={() => onChangeBaseFontSize(-2)}
                title="Disminuir tamaño de notas"
              >
                A-
              </button>
              <span className="solo-font-display">{baseFontSize}px</span>
              <button
                type="button"
                className="solo-font-btn"
                onClick={() => onChangeBaseFontSize(2)}
                title="Aumentar tamaño de notas"
              >
                A+
              </button>
            </div>
          )}

          {/* Note Orientation toggle (Horizontal vs Diagonal) */}
          {onToggleNoteOrientation && (
            <button
              type="button"
              className={`viewer-icon-btn diag-toggle-btn ${noteOrientation === 'diagonal' ? 'active-diag' : ''} ${
                !isSoloScoreMode ? 'hide-on-mobile' : ''
              }`}
              onClick={onToggleNoteOrientation}
              title={
                noteOrientation === 'diagonal'
                  ? 'Notas diagonales activadas. Clic para cambiar a Horizontal'
                  : 'Notas horizontales. Clic para cambiar a Diagonal (-55° para que no se remonten a tamaños grandes)'
              }
            >
              <span className="diag-btn-symbol">{noteOrientation === 'diagonal' ? '↗' : '↔'}</span>
            </button>
          )}

          {/* Tool Mode Reminder Pill (only on desktop/tablets) */}
          {!isSoloScoreMode && (
            <div className={`mode-pill ${toolMode} hide-on-mobile`}>
              {toolMode === 'place' && '✍️ Clic para poner notas'}
              {toolMode === 'select' && '✋ Arrastra para mover'}
              {toolMode === 'erase' && '🗑️ Clic para borrar'}
            </div>
          )}

          {/* Minimize / Collapse floating bar */}
          <button
            type="button"
            className="viewer-icon-btn collapse-bar-btn"
            onClick={() => setIsBarCollapsed(true)}
            title="Minimizar barra flotante para despejar la partitura"
          >
            <ChevronDown size={16} />
          </button>
        </div>
      )}

      {/* Main Sheet Scroll Area */}
      <div className="score-scroll-area" ref={scrollAreaRef} onScroll={handleScrollArea}>
        <div
          className={`score-pages-stack ${pageLayoutMode === 'vertical' ? 'vertical-layout' : 'single-layout'}`}
          style={{
            transform: `scale(${zoomLevel})`,
            transformOrigin: 'top center',
          }}
        >
          {isPdfLoading && (
            <div className="sheet-loading-overlay">
              <div className="spinner" />
              <span>Procesando partitura PDF...</span>
            </div>
          )}

          {/* Render each requested page in order */}
          {pagesToRender.map((pageNum) => {
            const pageNotes = notes.filter((n) => (n.pageNumber || 1) === pageNum);
            const isCurrentInView = currentPage === pageNum;

            return (
              <div key={pageNum} className="sheet-page-wrapper">
                {/* Subtle page divider badge in vertical mode */}
                {pageLayoutMode === 'vertical' && effectiveNumPages > 1 && (
                  <div className={`sheet-page-divider-badge ${isCurrentInView ? 'active-page' : ''}`}>
                    <span>Página {pageNum} de {effectiveNumPages}</span>
                  </div>
                )}

                <div
                  className={`sheet-page-container ${toolMode}-mode`}
                  ref={(el) => {
                    if (el) pageContainerRefs.current.set(pageNum, el);
                    else pageContainerRefs.current.delete(pageNum);
                  }}
                  onClick={(e) => handlePageClick(e, pageNum)}
                >
                  {/* PDF Page Canvas or Single Image */}
                  {sourceType === 'pdf' ? (
                    <PdfPageCanvas
                      pdfDocProxy={pdfDocProxy}
                      pageNum={pageNum}
                      zoomLevel={1}
                      onPageRendered={onPageRendered}
                    />
                  ) : (
                    <img
                      ref={imageRef}
                      src={fileData}
                      alt="Partitura"
                      className="score-image-layer"
                      onLoad={handleImageLoad}
                    />
                  )}

                  {/* Interactive Note Annotations Overlay */}
                  <div className="notes-overlay-layer">
                    {pageNotes.map((note) => {
                      const isSelected = selectedNoteId === note.id;
                      const isPlaying = activePlayingNoteId === note.id;
                      const noteText = formatNoteDisplay(note.pitch, note.accidental, note.octave);
                      const isDiagonal = note.orientation === 'diagonal' || noteOrientation === 'diagonal';

                      return (
                        <div
                          key={note.id}
                          className={`note-annotation-badge ${isSelected ? 'selected' : ''} ${
                            isPlaying ? 'playing-pulse' : ''
                          } ${isDiagonal ? 'diagonal' : ''}`}
                          style={{
                            left: `${note.x}%`,
                            top: `${note.y}%`,
                            color: note.color || '#111827',
                            fontSize: `${note.fontSize || baseFontSize}px`,
                            fontWeight: note.fontWeight === 'bold' ? 700 : 500,
                          }}
                          onMouseDown={(e) => handleNoteMouseDown(e, note)}
                          title={`${noteText} - Clic para seleccionar o arrastrar`}
                        >
                          <span className="note-text-label">{noteText}</span>
                          {note.customText && (
                            <span className="note-chord-sublabel">{note.customText}</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
