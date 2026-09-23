import React from 'react';
import { ArrowDown, ArrowUp, RotateCcw, Music, ArrowRight, ZoomIn, ZoomOut } from 'lucide-react';
import {
  KEY_SIGNATURES_LIST,
  calculateTransposedKey,
  formatTransposeDescription
} from '../utils/musicTheory';

import type { NoteOrientation } from '../types';

interface TransposeBarProps {
  originalKey: string;
  onOriginalKeyChange: (newKey: string) => void;
  currentTranspose: number;
  preferFlats: boolean;
  onTransposeChange: (semitones: number) => void;
  onResetTranspose: () => void;
  onTogglePreferFlats: () => void;
  selectedCount: number;
  totalNotes: number;
  applyToSelectedOnly: boolean;
  onToggleApplyToSelectedOnly: () => void;
  baseFontSize: number;
  onChangeBaseFontSize: (delta: number) => void;
  noteOrientation?: NoteOrientation;
  onToggleNoteOrientation?: () => void;
}

export const TransposeBar: React.FC<TransposeBarProps> = ({
  originalKey,
  onOriginalKeyChange,
  currentTranspose,
  preferFlats,
  onTransposeChange,
  onResetTranspose,
  onTogglePreferFlats,
  selectedCount,
  totalNotes,
  applyToSelectedOnly,
  onToggleApplyToSelectedOnly,
  baseFontSize,
  onChangeBaseFontSize,
  noteOrientation = 'horizontal',
  onToggleNoteOrientation,
}) => {
  // Compute resulting key in real time based on original key and semitones
  const currentKeyInfo = calculateTransposedKey(originalKey, currentTranspose, preferFlats);

  // Alterations description of the resulting key
  const altEntries = Object.entries(currentKeyInfo.alteredPitches);
  const altSummary =
    altEntries.length === 0
      ? 'Natural'
      : altEntries.map(([p, a]) => `${p}${a}`).join(', ');

  return (
    <div className="transpose-toolbar">
      {/* Key & Dynamic Resulting Key Display */}
      <div className="key-tracking-group">
        <div className="key-origin-box">
          <span className="key-tiny-label">Tono Original:</span>
          <select
            value={originalKey}
            onChange={(e) => onOriginalKeyChange(e.target.value)}
            className="original-key-dropdown"
            title="Selecciona o cambia el tono original de la partitura"
          >
            {KEY_SIGNATURES_LIST.map((k) => (
              <option key={k.name} value={k.name}>
                {k.name} ({k.shortName})
              </option>
            ))}
          </select>
        </div>

        <ArrowRight size={15} className="key-flow-arrow" />

        {/* Current Resulting Key */}
        <div className="key-result-box" title={`Tonalidad actual: ${currentKeyInfo.name} (${altSummary})`}>
          <span className="key-tiny-label">Tono Resultante:</span>
          <div className="resulting-key-badge">
            <Music size={14} className="music-key-icon" />
            <span className="resulting-key-name">{currentKeyInfo.name}</span>
            {altEntries.length > 0 && (
              <span className="resulting-alt-pill">{altSummary}</span>
            )}
          </div>
        </div>

        {/* Transposition offset pill */}
        <div className={`transpose-badge ${currentTranspose !== 0 ? 'active' : ''}`}>
          {formatTransposeDescription(currentTranspose)}
          {currentTranspose !== 0 && (
            <span className="transpose-diff">
              ({currentTranspose > 0 ? `+${currentTranspose}` : currentTranspose} semitonos)
            </span>
          )}
        </div>
      </div>

      {/* Transpose buttons (+/- 1 Tono, +/- 1/2 Tono) */}
      <div className="transpose-controls-cluster">
        <div className="transpose-buttons-group">
          <div className="btn-label-sub hide-on-mobile">Subir / Bajar:</div>

          <button
            type="button"
            className="btn-transpose"
            onClick={() => onTransposeChange(2)}
            title="Subir 1 tono completo (2 semitonos). Ej: Do Mayor pasa a Re Mayor"
          >
            <ArrowUp size={14} />
            <span className="btn-text-full">+1 Tono</span>
            <span className="btn-text-compact">+1</span>
          </button>

          <button
            type="button"
            className="btn-transpose"
            onClick={() => onTransposeChange(-2)}
            title="Bajar 1 tono completo (2 semitonos). Ej: Do Mayor pasa a Si♭ Mayor"
          >
            <ArrowDown size={14} />
            <span className="btn-text-full">-1 Tono</span>
            <span className="btn-text-compact">-1</span>
          </button>

          <button
            type="button"
            className="btn-transpose secondary"
            onClick={() => onTransposeChange(1)}
            title="Subir medio tono (1 semitono). Ej: Do Mayor pasa a Do# Mayor"
          >
            <ArrowUp size={13} />
            <span className="btn-text-full">+½ Tono</span>
            <span className="btn-text-compact">+½</span>
          </button>

          <button
            type="button"
            className="btn-transpose secondary"
            onClick={() => onTransposeChange(-1)}
            title="Bajar medio tono (1 semitono). Ej: Mi pasa a Re#"
          >
            <ArrowDown size={13} />
            <span className="btn-text-full">-½ Tono</span>
            <span className="btn-text-compact">-½</span>
          </button>

          {currentTranspose !== 0 && (
            <button
              type="button"
              className="btn-transpose reset"
              onClick={onResetTranspose}
              title="Volver a la tonalidad original"
            >
              <RotateCcw size={13} />
              <span className="btn-text-full">Restablecer</span>
              <span className="btn-text-compact">0</span>
            </button>
          )}
        </div>

        {/* Font Size Controls for Note Text (Agrandar / Disminuir) */}
        <div className="font-size-toolbar-group">
          <span className="btn-label-sub hide-on-mobile">Tamaño:</span>
          <button
            type="button"
            className="btn-font-size"
            onClick={() => onChangeBaseFontSize(-2)}
            disabled={baseFontSize <= 10}
            title="Disminuir tamaño de la fuente de las notas"
          >
            <ZoomOut size={12} />
            <span>A-</span>
          </button>
          <span className="font-size-display">{baseFontSize}px</span>
          <button
            type="button"
            className="btn-font-size"
            onClick={() => onChangeBaseFontSize(2)}
            disabled={baseFontSize >= 32}
            title="Agrandar tamaño de la fuente de las notas"
          >
            <ZoomIn size={12} />
            <span>A+</span>
          </button>
        </div>

        {/* Note Orientation: Horizontal vs Diagonal */}
        {onToggleNoteOrientation && (
          <div className="orientation-toolbar-group">
            <span className="btn-label-sub hide-on-mobile">Inclinación:</span>
            <button
              type="button"
              className={`btn-orientation-toggle ${noteOrientation === 'diagonal' ? 'active-diag' : ''}`}
              onClick={onToggleNoteOrientation}
              title={
                noteOrientation === 'diagonal'
                  ? 'Modo Inclinado (-55°): Las notas no chocan ni se remontan. Clic para cambiar a Horizontal.'
                  : 'Modo Horizontal: Clic para inclinar en diagonal (-55°, casi vertical para que no se remonten a tamaños grandes).'
              }
            >
              <span className="orientation-icon">{noteOrientation === 'diagonal' ? '↗' : '↔'}</span>
              <span className="btn-text-full">{noteOrientation === 'diagonal' ? 'Inclinada (-55°)' : 'Horizontal'}</span>
            </button>
          </div>
        )}

        {/* Options: scope and accidentals */}
        <div className="transpose-options">
          <label className="toggle-switch-label hide-on-mobile" title="Alternar entre mostrar alteraciones como sostenidos (#) o bemoles (b)">
            <input
              type="checkbox"
              checked={preferFlats}
              onChange={onTogglePreferFlats}
            />
            <span className="toggle-switch-text">
              Alteraciones: <strong>{preferFlats ? 'Bemoles (b)' : 'Sostenidos (#)'}</strong>
            </span>
          </label>

          {/* Compact mobile toggle button for flats/sharps */}
          <button
            type="button"
            className="mobile-alt-toggle-btn hide-on-desktop"
            onClick={onTogglePreferFlats}
            title="Alternar sostenidos (#) o bemoles (b)"
          >
            {preferFlats ? '♭ Bemol' : '♯ Sost.'}
          </button>

          {selectedCount > 0 && (
            <label className="toggle-switch-label highlight" title="Aplicar transposición solo a las notas seleccionadas o a todas">
              <input
                type="checkbox"
                checked={applyToSelectedOnly}
                onChange={onToggleApplyToSelectedOnly}
              />
              <span className="toggle-switch-text">
                <span className="btn-text-full">Solo seleccionadas ({selectedCount} de {totalNotes})</span>
                <span className="btn-text-compact">Sel. ({selectedCount})</span>
              </span>
            </label>
          )}
        </div>
      </div>
    </div>
  );
};
