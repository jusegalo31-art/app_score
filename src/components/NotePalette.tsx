import React from 'react';
import type { Accidental, NoteAnnotation, SpanishPitch } from '../types';
import { NATURAL_PITCHES, formatNoteDisplay } from '../utils/musicTheory';
import { Volume2, Trash2, Copy, Sparkles, X } from 'lucide-react';
import { audioSynth } from '../utils/audioPlayer';

interface NotePaletteProps {
  activePitch: SpanishPitch;
  activeAccidental: Accidental;
  activeOctave: number;
  selectedNote: NoteAnnotation | null;
  onPitchSelect: (pitch: SpanishPitch) => void;
  onAccidentalSelect: (accidental: Accidental) => void;
  onOctaveSelect: (octave: number) => void;
  onUpdateSelectedNote: (updates: Partial<NoteAnnotation>) => void;
  onDeleteSelectedNote: () => void;
  onDuplicateSelectedNote?: () => void;
  toolMode: 'select' | 'place' | 'erase';
  onSetToolMode: (mode: 'select' | 'place' | 'erase') => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

const COLOR_PALETTE = [
  { name: 'Negro Clásico', hex: '#111827' },
  { name: 'Azul Intenso', hex: '#2563eb' },
  { name: 'Rojo Carmesí', hex: '#dc2626' },
  { name: 'Verde Esmeralda', hex: '#059669' },
  { name: 'Púrpura', hex: '#7c3aed' },
];

export const NotePalette: React.FC<NotePaletteProps> = ({
  activePitch,
  activeAccidental,
  activeOctave,
  selectedNote,
  onPitchSelect,
  onAccidentalSelect,
  onOctaveSelect,
  onUpdateSelectedNote,
  onDeleteSelectedNote,
  onDuplicateSelectedNote,
  toolMode,
  onSetToolMode,
  isMobileOpen = false,
  onCloseMobile,
}) => {
  const currentPitch = selectedNote ? selectedNote.pitch : activePitch;
  const currentAccidental = selectedNote ? selectedNote.accidental : activeAccidental;
  const currentOctave = selectedNote ? selectedNote.octave : activeOctave;
  const currentColor = selectedNote ? selectedNote.color || '#111827' : '#111827';
  const currentSize = selectedNote ? selectedNote.fontSize || 15 : 15;

  const handlePlayCurrent = () => {
    audioSynth.playNote({
      pitch: currentPitch,
      accidental: currentAccidental,
      octave: currentOctave,
    });
  };

  return (
    <aside className={`note-palette-dock ${isMobileOpen ? 'mobile-open' : ''}`}>
      <div className="palette-header">
        <div className="palette-title">
          <Sparkles size={16} className="sparkle-icon" />
          <span>Notas Cifrado Español</span>
        </div>
        <div className="palette-header-actions">
          <div className="preview-badge" onClick={handlePlayCurrent} title="Clic para escuchar esta nota">
            <span className="preview-text">
              {formatNoteDisplay(currentPitch, currentAccidental, currentOctave)}
            </span>
            <Volume2 size={15} />
          </div>
          {onCloseMobile && (
            <button
              type="button"
              className="palette-close-mobile-btn hide-on-desktop"
              onClick={onCloseMobile}
              title="Ocultar teclado para ver partitura"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Editor Tool Mode Selector */}
      <div className="tool-mode-selector">
        <button
          type="button"
          className={`tool-tab-btn ${toolMode === 'place' ? 'active' : ''}`}
          onClick={() => onSetToolMode('place')}
          title="Modo Colocar: Haz clic en el pentagrama para agregar notas rápidamente"
        >
          ➕ Colocar
        </button>
        <button
          type="button"
          className={`tool-tab-btn ${toolMode === 'select' ? 'active' : ''}`}
          onClick={() => onSetToolMode('select')}
          title="Modo Seleccionar: Mueve y arrastra notas ya colocadas"
        >
          ✋ Mover
        </button>
        <button
          type="button"
          className={`tool-tab-btn erase ${toolMode === 'erase' ? 'active' : ''}`}
          onClick={() => onSetToolMode('erase')}
          title="Modo Borrador: Haz clic en notas para borrarlas"
        >
          🗑️ Borrar
        </button>
      </div>

      {/* 7 Spanish Pitches Keypad */}
      <div className="palette-section">
        <label className="section-label">Nombre de Nota:</label>
        <div className="spanish-notes-grid">
          {NATURAL_PITCHES.map((p) => {
            const isSelected = currentPitch === p;
            return (
              <button
                key={p}
                type="button"
                className={`note-key-btn ${isSelected ? 'active' : ''}`}
                onClick={() => {
                  onPitchSelect(p);
                  if (selectedNote) {
                    onUpdateSelectedNote({ pitch: p });
                  }
                  audioSynth.playNote({
                    pitch: p,
                    accidental: currentAccidental,
                    octave: currentOctave,
                  });
                }}
              >
                {p}
              </button>
            );
          })}
        </div>
      </div>

      {/* Octaves & Alterations Row */}
      <div className="palette-row-dual">
        {/* Octaves */}
        <div className="palette-subgroup">
          <label className="section-label">Octava:</label>
          <div className="octave-button-group">
            <button
              type="button"
              className={`pill-btn ${currentOctave === 3 ? 'active' : ''}`}
              onClick={() => {
                onOctaveSelect(3);
                if (selectedNote) onUpdateSelectedNote({ octave: 3 });
              }}
              title="Octava Grave (,) - DO,"
            >
              Grave (,)
            </button>
            <button
              type="button"
              className={`pill-btn ${currentOctave === 4 ? 'active' : ''}`}
              onClick={() => {
                onOctaveSelect(4);
                if (selectedNote) onUpdateSelectedNote({ octave: 4 });
              }}
              title="Octava Normal - DO"
            >
              Base
            </button>
            <button
              type="button"
              className={`pill-btn ${currentOctave === 5 ? 'active' : ''}`}
              onClick={() => {
                onOctaveSelect(5);
                if (selectedNote) onUpdateSelectedNote({ octave: 5 });
              }}
              title="Octava Aguda (') - RE', DO'"
            >
              Aguda (')
            </button>
            <button
              type="button"
              className={`pill-btn ${currentOctave === 6 ? 'active' : ''}`}
              onClick={() => {
                onOctaveSelect(6);
                if (selectedNote) onUpdateSelectedNote({ octave: 6 });
              }}
              title="Doble Aguda ('') - DO''"
            >
              Muy Aguda ('')
            </button>
          </div>
        </div>

        {/* Alterations */}
        <div className="palette-subgroup">
          <label className="section-label">Alteración:</label>
          <div className="accidental-button-group">
            <button
              type="button"
              className={`pill-btn ${currentAccidental === '' ? 'active' : ''}`}
              onClick={() => {
                onAccidentalSelect('');
                if (selectedNote) onUpdateSelectedNote({ accidental: '' });
              }}
            >
              Natural (♮)
            </button>
            <button
              type="button"
              className={`pill-btn ${currentAccidental === '#' ? 'active' : ''}`}
              onClick={() => {
                onAccidentalSelect('#');
                if (selectedNote) onUpdateSelectedNote({ accidental: '#' });
              }}
              title="Sostenido (#)"
            >
              # Sostenido
            </button>
            <button
              type="button"
              className={`pill-btn ${currentAccidental === 'b' ? 'active' : ''}`}
              onClick={() => {
                onAccidentalSelect('b');
                if (selectedNote) onUpdateSelectedNote({ accidental: 'b' });
              }}
              title="Bemol (b)"
            >
              b Bemol
            </button>
          </div>
        </div>
      </div>

      {/* Selected Note Specific Properties */}
      {selectedNote && (
        <div className="selected-note-controls fade-in">
          <div className="selected-bar-title">
            <span>Nota Seleccionada</span>
            <span className="selected-note-badge">
              {formatNoteDisplay(selectedNote.pitch, selectedNote.accidental, selectedNote.octave)}
            </span>
          </div>

          {/* Custom Chord / Lyric Text */}
          <div className="custom-text-row">
            <label className="section-label">Acorde o Texto extra (opcional):</label>
            <input
              type="text"
              placeholder="Ej: G7, C, Am o letra..."
              value={selectedNote.customText || ''}
              onChange={(e) => onUpdateSelectedNote({ customText: e.target.value })}
              className="custom-text-input"
            />
          </div>

          {/* Color & Size */}
          <div className="styling-row">
            <div className="color-picker-chips">
              {COLOR_PALETTE.map((c) => (
                <button
                  key={c.hex}
                  type="button"
                  className={`color-chip ${currentColor === c.hex ? 'active' : ''}`}
                  style={{ backgroundColor: c.hex }}
                  onClick={() => onUpdateSelectedNote({ color: c.hex })}
                  title={c.name}
                />
              ))}
            </div>

            <div className="size-selector">
              <button
                type="button"
                className={`size-btn ${currentSize === 13 ? 'active' : ''}`}
                onClick={() => onUpdateSelectedNote({ fontSize: 13 })}
              >
                A-
              </button>
              <button
                type="button"
                className={`size-btn ${currentSize === 15 ? 'active' : ''}`}
                onClick={() => onUpdateSelectedNote({ fontSize: 15 })}
              >
                A
              </button>
              <button
                type="button"
                className={`size-btn ${currentSize === 18 ? 'active' : ''}`}
                onClick={() => onUpdateSelectedNote({ fontSize: 18 })}
              >
                A+
              </button>
            </div>
          </div>

          {/* Note Actions */}
          <div className="note-action-buttons">
            {onDuplicateSelectedNote && (
              <button
                type="button"
                className="action-btn duplicate"
                onClick={onDuplicateSelectedNote}
                title="Duplicar esta nota al lado"
              >
                <Copy size={14} />
                <span>Duplicar</span>
              </button>
            )}
            <button
              type="button"
              className="action-btn delete"
              onClick={onDeleteSelectedNote}
              title="Eliminar esta nota (o pulsa Supr en teclado)"
            >
              <Trash2 size={14} />
              <span>Eliminar</span>
            </button>
          </div>
        </div>
      )}

      {/* Helpful keyboard shortcuts guide */}
      <div className="palette-footer-shortcuts">
        <div className="shortcuts-title">💡 Atajos de teclado rápidos:</div>
        <div className="shortcuts-grid">
          <div><kbd>D</kbd> DO</div>
          <div><kbd>R</kbd> RE</div>
          <div><kbd>M</kbd> MI</div>
          <div><kbd>F</kbd> FA</div>
          <div><kbd>S</kbd> SOL</div>
          <div><kbd>L</kbd> LA</div>
          <div><kbd>B</kbd> SI</div>
          <div><kbd>'</kbd> Agudo</div>
          <div><kbd>#</kbd> Sost</div>
          <div><kbd>Supr</kbd> Borrar</div>
        </div>
      </div>
    </aside>
  );
};
