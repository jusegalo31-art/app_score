import { useState, useEffect, useCallback, useRef } from 'react';
import type { EditorTool, NoteAnnotation, ScoreProject, SpanishPitch, Accidental, NoteOrientation, PartituraHymnItem } from './types';
import {
  createDefaultSampleProject,
  deleteProject,
  getAllProjects,
  saveProject,
  loadPartituraHymn,
  exportAllProjectsBackup,
} from './services/storage';
import {
  transposeNotes,
  getKeySignatureAccidental
} from './utils/musicTheory';
import { audioSynth } from './utils/audioPlayer';
import { loadPdfDocument } from './utils/pdfLoader';
import { Header } from './components/Header';
import { TransposeBar } from './components/TransposeBar';
import { ScoreViewer } from './components/ScoreViewer';
import { NotePalette } from './components/NotePalette';
import { LibraryModal } from './components/LibraryModal';
import { ExportModal } from './components/ExportModal';
import { AutoDetectModal } from './components/AutoDetectModal';
import { FirebaseModal } from './components/FirebaseModal';
import { Music } from 'lucide-react';
import './App.css';

export function App() {
  // Current active project
  const [project, setProject] = useState<ScoreProject>(createDefaultSampleProject);
  const [allProjects, setAllProjects] = useState<ScoreProject[]>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);

  // Viewer state
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [toolMode, setToolMode] = useState<EditorTool>('place');
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [activePlayingNoteId, setActivePlayingNoteId] = useState<string | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState<boolean>(false);
  const [isSoloScoreMode, setIsSoloScoreMode] = useState<boolean>(false);

  // Active palette configuration (for newly placed notes)
  const [activePitch, setActivePitch] = useState<SpanishPitch>('SOL');
  const [activeAccidental, setActiveAccidental] = useState<Accidental>('');
  const [activeOctave, setActiveOctave] = useState<number>(4);

  // Transpose settings
  const [preferFlats, setPreferFlats] = useState<boolean>(false);
  const [applyToSelectedOnly, setApplyToSelectedOnly] = useState<boolean>(false);

  // Modals
  const [isLibraryOpen, setIsLibraryOpen] = useState<boolean>(false);
  const [isExportOpen, setIsExportOpen] = useState<boolean>(false);
  const [isAutoDetectOpen, setIsAutoDetectOpen] = useState<boolean>(false);
  const [isFirebaseOpen, setIsFirebaseOpen] = useState<boolean>(false);

  // Note Orientation ('horizontal' or 'diagonal' ~55deg)
  const [noteOrientation, setNoteOrientation] = useState<NoteOrientation>(project.noteOrientation || 'horizontal');

  // Mobile drawer state for note palette
  const [isMobilePaletteOpen, setIsMobilePaletteOpen] = useState<boolean>(false);

  // Canvas cache for exporting & auto-detection
  const renderedCanvases = useRef<Map<number, HTMLCanvasElement>>(new Map());

  // Base font size for all notes (default: 16)
  const currentBaseFontSize = project.baseFontSize || 16;

  // Load projects from IndexedDB on startup
  useEffect(() => {
    async function initDB() {
      const list = await getAllProjects();
      if (list.length === 0) {
        const demo = createDefaultSampleProject();
        await saveProject(demo);
        setAllProjects([demo]);
        setProject(demo);
      } else {
        setAllProjects(list);
        setProject(list[0]);
      }
    }
    initDB();
  }, []);

  // Sync fullscreen change with isSoloScoreMode and handle Escape/F keyboard shortcuts
  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setIsSoloScoreMode(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts if user is typing in an input
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
        return;
      }

      if (e.key === 'Escape' && isSoloScoreMode) {
        if (document.exitFullscreen && document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        }
        setIsSoloScoreMode(false);
      } else if ((e.key === 'f' || e.key === 'F') && !e.ctrlKey && !e.metaKey) {
        handleToggleSoloScore();
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isSoloScoreMode]);

  // Update canvas cache when rendered
  const handlePageRendered = useCallback((canvas: HTMLCanvasElement, pageNum: number) => {
    renderedCanvases.current.set(pageNum, canvas);
  }, []);

  // Find currently selected note object
  const selectedNote = project.notes.find((n) => n.id === selectedNoteId) || null;

  // Selected notes count
  const selectedNotesCount = selectedNoteId ? 1 : 0;

  // Save current project
  const handleSaveProject = async () => {
    try {
      await saveProject(project);
      setHasUnsavedChanges(false);
      const updatedList = await getAllProjects();
      setAllProjects(updatedList);
    } catch (err) {
      console.error('Error saving project:', err);
      alert('Error al guardar en la biblioteca local: ' + err);
    }
  };

  // Toggle Solo Score / Fullscreen mode
  const handleToggleSoloScore = () => {
    if (!isSoloScoreMode) {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
      setIsSoloScoreMode(true);
    } else {
      if (document.exitFullscreen && document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
      setIsSoloScoreMode(false);
    }
  };

  // Change font size globally for notes
  const handleChangeBaseFontSize = (delta: number) => {
    const newSize = Math.max(10, Math.min(32, currentBaseFontSize + delta));
    setProject((prev) => ({
      ...prev,
      baseFontSize: newSize,
      notes: prev.notes.map((n) => ({
        ...n,
        fontSize: newSize,
      })),
    }));
    setHasUnsavedChanges(true);
  };

  // Add new note annotation at percentage coordinates
  const handleAddNote = (x: number, y: number, targetPage?: number) => {
    const newNoteId = 'n_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 5);

    // If no explicit accidental is active, pick accidental from key signature armadura!
    const keyArmaduraAccidental = getKeySignatureAccidental(activePitch, project.originalKey || 'Do Mayor');
    const noteAccidental = activeAccidental !== '' ? activeAccidental : keyArmaduraAccidental;

    const newNote: NoteAnnotation = {
      id: newNoteId,
      pageNumber: targetPage || currentPage,
      x,
      y,
      pitch: activePitch,
      accidental: noteAccidental,
      octave: activeOctave,
      fontWeight: 'bold',
      fontSize: currentBaseFontSize,
      orientation: noteOrientation,
      color: '#111827',
    };

    audioSynth.playNote(newNote);

    setProject((prev) => ({
      ...prev,
      notes: [...prev.notes, newNote],
    }));
    setSelectedNoteId(newNoteId);
    setHasUnsavedChanges(true);
  };

  // Update selected note properties
  const handleUpdateSelectedNote = (updates: Partial<NoteAnnotation>) => {
    if (!selectedNoteId) return;

    setProject((prev) => ({
      ...prev,
      notes: prev.notes.map((n) => (n.id === selectedNoteId ? { ...n, ...updates } : n)),
    }));
    setHasUnsavedChanges(true);
  };

  // Update note position when dragged
  const handleUpdateNotePosition = (id: string, x: number, y: number) => {
    setProject((prev) => ({
      ...prev,
      notes: prev.notes.map((n) => (n.id === id ? { ...n, x, y } : n)),
    }));
    setHasUnsavedChanges(true);
  };

  // Delete note
  const handleDeleteNote = (id: string) => {
    setProject((prev) => ({
      ...prev,
      notes: prev.notes.filter((n) => n.id !== id),
    }));
    if (selectedNoteId === id) {
      setSelectedNoteId(null);
    }
    setHasUnsavedChanges(true);
  };

  // Duplicate selected note
  const handleDuplicateSelectedNote = () => {
    if (!selectedNote) return;
    const dupId = 'n_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 5);
    const duplicated: NoteAnnotation = {
      ...selectedNote,
      id: dupId,
      x: Math.min(98, selectedNote.x + 4),
      y: selectedNote.y,
    };
    audioSynth.playNote(duplicated);

    setProject((prev) => ({
      ...prev,
      notes: [...prev.notes, duplicated],
    }));
    setSelectedNoteId(dupId);
    setHasUnsavedChanges(true);
  };

  // Transpose notes by given semitones (+2 for 1 tone, -2 for -1 tone, +1 for half tone, -1 for -half tone)
  const handleTransposeChange = (semitones: number) => {
    setProject((prev) => {
      const updatedNotes = prev.notes.map((n) => {
        if (applyToSelectedOnly && n.id !== selectedNoteId) {
          return n;
        }
        return transposeNotes([n], semitones, preferFlats, false)[0];
      });

      return {
        ...prev,
        notes: updatedNotes,
        transposeHistory: prev.transposeHistory + semitones,
      };
    });

    setHasUnsavedChanges(true);

    if (selectedNote) {
      const transposed = transposeNotes([selectedNote], semitones, preferFlats, false)[0];
      audioSynth.playNote(transposed);
    } else if (project.notes.length > 0) {
      const firstTransposed = transposeNotes([project.notes[0]], semitones, preferFlats, false)[0];
      audioSynth.playNote(firstTransposed);
    }
  };

  // Reset transposition to original notes (0 semitones)
  const handleResetTranspose = () => {
    if (project.transposeHistory === 0) return;
    const diff = -project.transposeHistory;
    handleTransposeChange(diff);
  };

  // Change Original Key
  const handleOriginalKeyChange = (newKey: string) => {
    setProject((prev) => ({
      ...prev,
      originalKey: newKey,
    }));
    setHasUnsavedChanges(true);
  };

  // Apply notes detected automatically by OMR engine
  const handleApplyDetectedNotes = (
    detectedNotes: NoteAnnotation[],
    replaceExisting: boolean,
    keySignature: string
  ) => {
    setProject((prev) => {
      let filtered = prev.notes;
      if (replaceExisting) {
        filtered = prev.notes.filter((n) => n.pageNumber !== currentPage);
      }
      return {
        ...prev,
        originalKey: keySignature,
        notes: [...filtered, ...detectedNotes],
      };
    });

    setHasUnsavedChanges(true);

    if (detectedNotes.length > 0) {
      audioSynth.playNote(detectedNotes[0]);
    }
  };

  // Upload PDF or Image file
  const handleUploadFile = async (file: File) => {
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    const reader = new FileReader();

    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string;
      let pagesCount = 1;

      if (isPdf) {
        try {
          const pdfDoc = await loadPdfDocument(dataUrl);
          pagesCount = pdfDoc.numPages;
        } catch (err) {
          console.error('Error loading PDF page count:', err);
        }
      }

      const cleanTitle = file.name.replace(/\.[^/.]+$/, '').replace(/_/g, ' ');

      const newProject: ScoreProject = {
        id: 'proj_' + Date.now().toString(36),
        title: cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        sourceType: isPdf ? 'pdf' : 'image',
        fileName: file.name,
        fileData: dataUrl,
        numPages: pagesCount,
        notes: [],
        originalKey: 'Do Mayor',
        transposeHistory: 0,
        baseFontSize: 16,
        tags: [isPdf ? 'PDF' : 'Imagen'],
      };

      await saveProject(newProject);
      setProject(newProject);
      setCurrentPage(1);
      setSelectedNoteId(null);
      setHasUnsavedChanges(false);

      const list = await getAllProjects();
      setAllProjects(list);
    };

    reader.readAsDataURL(file);
  };

  // Toggle Audio Playback
  const handleTogglePlayAudio = () => {
    if (isPlayingAudio) {
      audioSynth.stopSequence();
      setIsPlayingAudio(false);
      setActivePlayingNoteId(null);
    } else {
      if (project.notes.length === 0) {
        alert('Digita o auto-detecta primero algunas notas en la partitura para escucharlas.');
        return;
      }
      setIsPlayingAudio(true);
      audioSynth.playSequence(
        project.notes,
        105,
        (noteId) => {
          setActivePlayingNoteId(noteId);
        },
        () => {
          setIsPlayingAudio(false);
          setActivePlayingNoteId(null);
        }
      );
    }
  };

  // Delete project from library
  const handleDeleteProject = async (id: string) => {
    await deleteProject(id);
    const list = await getAllProjects();
    setAllProjects(list);
    if (project.id === id && list.length > 0) {
      setProject(list[0]);
    }
  };

  // Duplicate project
  const handleDuplicateProject = async (proj: ScoreProject) => {
    const duplicated: ScoreProject = {
      ...proj,
      id: 'proj_' + Date.now().toString(36),
      title: `${proj.title} (Copia)`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await saveProject(duplicated);
    const list = await getAllProjects();
    setAllProjects(list);
    setProject(duplicated);
  };

  // Load default demo project
  const handleLoadSampleProject = async () => {
    const demo = createDefaultSampleProject();
    demo.id = 'demo_' + Date.now().toString(36);
    await saveProject(demo);
    const list = await getAllProjects();
    setAllProjects(list);
    setProject(demo);
    setCurrentPage(1);
    setSelectedNoteId(null);
    setHasUnsavedChanges(false);
  };

  // Import project JSON
  const handleImportJson = async (jsonString: string) => {
    const parsed = JSON.parse(jsonString);
    if (!parsed.title || !parsed.fileData) {
      throw new Error('El archivo no tiene el formato válido de proyecto NotaScore.');
    }
    const imported: ScoreProject = {
      ...parsed,
      id: 'proj_' + Date.now().toString(36),
      originalKey: parsed.originalKey || 'Do Mayor',
      updatedAt: Date.now(),
    };
    await saveProject(imported);
    const list = await getAllProjects();
    setAllProjects(list);
    setProject(imported);
    setNoteOrientation(imported.noteOrientation || 'horizontal');
    alert(`¡Partitura "${imported.title}" importada con éxito!`);
  };

  // Toggle Note Orientation (Horizontal vs Diagonal)
  const handleToggleNoteOrientation = () => {
    const nextOrientation: NoteOrientation = noteOrientation === 'horizontal' ? 'diagonal' : 'horizontal';
    setNoteOrientation(nextOrientation);
    setProject((prev) => ({
      ...prev,
      noteOrientation: nextOrientation,
      notes: prev.notes.map((n) => ({
        ...n,
        orientation: nextOrientation,
      })),
    }));
    setHasUnsavedChanges(true);
  };

  // Select Hymn from 732 Hymns collection
  const handleSelectHymn = async (hymn: PartituraHymnItem) => {
    try {
      const loaded = await loadPartituraHymn(hymn);
      setProject(loaded);
      setCurrentPage(1);
      setSelectedNoteId(null);
      setHasUnsavedChanges(false);
      setNoteOrientation(loaded.noteOrientation || 'horizontal');
      setIsLibraryOpen(false);
    } catch (err) {
      console.error('Error cargando himno:', err);
      alert('Error al cargar himno: ' + err);
    }
  };

  // Export full backup of all projects as JSON
  const handleExportFullBackup = async () => {
    try {
      const json = await exportAllProjectsBackup();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup_notascore_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error al exportar respaldo:', err);
      alert('Error al exportar respaldo: ' + err);
    }
  };

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) {
        return;
      }

      const key = e.key.toUpperCase();

      const pitchMap: Record<string, SpanishPitch> = {
        D: 'DO',
        R: 'RE',
        M: 'MI',
        F: 'FA',
        S: 'SOL',
        L: 'LA',
        B: 'SI',
      };

      if (pitchMap[key]) {
        const p = pitchMap[key];
        setActivePitch(p);
        if (selectedNoteId) {
          handleUpdateSelectedNote({ pitch: p });
        }
        audioSynth.playNote({
          pitch: p,
          accidental: activeAccidental,
          octave: activeOctave,
        });
      } else if (e.key === "'") {
        setActiveOctave((o) => (o === 5 ? 4 : 5));
        if (selectedNoteId) {
          handleUpdateSelectedNote({ octave: activeOctave === 5 ? 4 : 5 });
        }
      } else if (e.key === '#') {
        const acc: Accidental = activeAccidental === '#' ? '' : '#';
        setActiveAccidental(acc);
        if (selectedNoteId) {
          handleUpdateSelectedNote({ accidental: acc });
        }
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedNoteId) {
          handleDeleteNote(selectedNoteId);
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSaveProject();
      } else if (e.code === 'Space') {
        e.preventDefault();
        handleTogglePlayAudio();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    activeAccidental,
    activeOctave,
    selectedNoteId,
    selectedNote,
    project.notes,
    isPlayingAudio,
  ]);

  return (
    <div className={`app-root ${isSoloScoreMode ? 'solo-score-active' : ''}`}>
      {/* Header */}
      {/* Header Bar (hidden in fullscreen solo score mode) */}
      {!isSoloScoreMode && (
        <Header
          project={project}
          hasUnsavedChanges={hasUnsavedChanges}
          isPlayingAudio={isPlayingAudio}
          isSoloScoreMode={isSoloScoreMode}
          onToggleSoloScore={handleToggleSoloScore}
          onUpdateTitle={(title) => {
            setProject((p) => ({ ...p, title }));
            setHasUnsavedChanges(true);
          }}
          onUploadFile={handleUploadFile}
          onOpenLibrary={() => setIsLibraryOpen(true)}
          onOpenAutoDetect={() => setIsAutoDetectOpen(true)}
          onSaveProject={handleSaveProject}
          onTogglePlayAudio={handleTogglePlayAudio}
          onOpenExport={() => setIsExportOpen(true)}
          onOpenFirebase={() => setIsFirebaseOpen(true)}
          onExportBackup={handleExportFullBackup}
        />
      )}

      {/* Transpose Toolbar with Dynamic Key Tracking (hidden in fullscreen solo score mode) */}
      {!isSoloScoreMode && (
        <TransposeBar
          originalKey={project.originalKey || 'Do Mayor'}
          onOriginalKeyChange={handleOriginalKeyChange}
          currentTranspose={project.transposeHistory}
          preferFlats={preferFlats}
          onTransposeChange={handleTransposeChange}
          onResetTranspose={handleResetTranspose}
          onTogglePreferFlats={() => setPreferFlats((f) => !f)}
          selectedCount={selectedNotesCount}
          totalNotes={project.notes.length}
          applyToSelectedOnly={applyToSelectedOnly}
          onToggleApplyToSelectedOnly={() => setApplyToSelectedOnly((v) => !v)}
          baseFontSize={currentBaseFontSize}
          onChangeBaseFontSize={handleChangeBaseFontSize}
          noteOrientation={noteOrientation}
          onToggleNoteOrientation={handleToggleNoteOrientation}
        />
      )}

      {/* Main Workspace: Score Canvas + Right Note Palette */}
      <main className={`workspace-layout ${isSoloScoreMode ? 'solo-score-active' : ''}`}>
        <ScoreViewer
          sourceType={project.sourceType}
          fileData={project.fileData}
          notes={project.notes}
          currentPage={currentPage}
          numPages={project.numPages}
          toolMode={toolMode}
          selectedNoteId={selectedNoteId}
          activePlayingNoteId={activePlayingNoteId}
          onPageChange={setCurrentPage}
          onAddNote={handleAddNote}
          onSelectNote={(n) => setSelectedNoteId(n ? n.id : null)}
          onUpdateNotePosition={handleUpdateNotePosition}
          onDeleteNote={handleDeleteNote}
          baseFontSize={currentBaseFontSize}
          noteOrientation={noteOrientation}
          onToggleNoteOrientation={handleToggleNoteOrientation}
          isSoloScoreMode={isSoloScoreMode}
          onToggleSoloScore={handleToggleSoloScore}
          onChangeBaseFontSize={handleChangeBaseFontSize}
          onPageRendered={handlePageRendered}
          onTotalPagesDetected={(pages) => {
            setProject((p) => (p.numPages !== pages ? { ...p, numPages: pages } : p));
          }}
        />

        {!isSoloScoreMode && (
          <>
            {/* Mobile floating button to open/close note palette drawer */}
            <button
              type="button"
              className={`mobile-palette-toggle-btn hide-on-desktop ${isMobilePaletteOpen ? 'palette-active' : ''}`}
              onClick={() => setIsMobilePaletteOpen((prev) => !prev)}
              title="Abrir o cerrar teclado de notas para digitar en la partitura"
            >
              <Music size={16} />
              <span>{isMobilePaletteOpen ? '▼ Ocultar Teclado' : '🎹 Digitar Notas (Cifrado)'}</span>
            </button>

            <NotePalette
              activePitch={activePitch}
              activeAccidental={activeAccidental}
              activeOctave={activeOctave}
              selectedNote={selectedNote}
              onPitchSelect={(p) => setActivePitch(p)}
              onAccidentalSelect={(acc) => setActiveAccidental(acc)}
              onOctaveSelect={(oct) => setActiveOctave(oct)}
              onUpdateSelectedNote={handleUpdateSelectedNote}
              onDeleteSelectedNote={() => selectedNoteId && handleDeleteNote(selectedNoteId)}
              onDuplicateSelectedNote={handleDuplicateSelectedNote}
              toolMode={toolMode}
              onSetToolMode={setToolMode}
              isMobileOpen={isMobilePaletteOpen}
              onCloseMobile={() => setIsMobilePaletteOpen(false)}
            />
          </>
        )}
      </main>

      {/* Auto-Detect Notes (OMR) Modal */}
      <AutoDetectModal
        isOpen={isAutoDetectOpen}
        currentPage={currentPage}
        canvas={renderedCanvases.current.get(currentPage) || null}
        fileData={project.fileData}
        sourceType={project.sourceType}
        currentKeySignature={project.originalKey || 'Do Mayor'}
        baseFontSize={currentBaseFontSize}
        onClose={() => setIsAutoDetectOpen(false)}
        onApplyDetectedNotes={handleApplyDetectedNotes}
      />

      {/* Library Modal */}
      <LibraryModal
        isOpen={isLibraryOpen}
        projects={allProjects}
        currentProjectId={project.id}
        onClose={() => setIsLibraryOpen(false)}
        onSelectProject={(p) => {
          setProject(p);
          setCurrentPage(1);
          setSelectedNoteId(null);
          setHasUnsavedChanges(false);
          setNoteOrientation(p.noteOrientation || 'horizontal');
        }}
        onSelectHymn={handleSelectHymn}
        onDeleteProject={handleDeleteProject}
        onDuplicateProject={handleDuplicateProject}
        onLoadSampleProject={handleLoadSampleProject}
        onImportJson={handleImportJson}
        onExportFullBackup={handleExportFullBackup}
      />

      {/* Export Modal */}
      <ExportModal
        isOpen={isExportOpen}
        project={project}
        currentPage={currentPage}
        renderedCanvases={renderedCanvases.current}
        onClose={() => setIsExportOpen(false)}
      />

      {/* Firebase Cloud Firestore Modal */}
      <FirebaseModal
        isOpen={isFirebaseOpen}
        onClose={() => setIsFirebaseOpen(false)}
      />
    </div>
  );
}

export default App;
