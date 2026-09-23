import React, { useState, useEffect } from 'react';
import type { NoteAnnotation } from '../types';
import { KEY_SIGNATURES_LIST, getKeySignatureInfo, formatNoteDisplay } from '../utils/musicTheory';
import {
  detectNotesFromCanvas,
  detectNotesFromPdf,
} from '../utils/noteDetector';
import { Sparkles, X, Check, Music, Sliders, RefreshCw, AlertCircle, Layers } from 'lucide-react';

interface AutoDetectModalProps {
  isOpen: boolean;
  currentPage: number;
  canvas: HTMLCanvasElement | null;
  fileData?: string;
  sourceType?: 'pdf' | 'image' | 'sample';
  currentKeySignature: string;
  baseFontSize: number;
  onClose: () => void;
  onApplyDetectedNotes: (detectedNotes: NoteAnnotation[], replaceExisting: boolean, keySignature: string) => void;
}

export const AutoDetectModal: React.FC<AutoDetectModalProps> = ({
  isOpen,
  currentPage,
  canvas,
  fileData,
  sourceType = 'pdf',
  currentKeySignature,
  baseFontSize,
  onClose,
  onApplyDetectedNotes,
}) => {
  const [selectedKey, setSelectedKey] = useState<string>(currentKeySignature || 'Do Mayor');
  const [sensitivity, setSensitivity] = useState<number>(3);
  const [headerSkipPercentage, setHeaderSkipPercentage] = useState<number>(18);
  const [onlySopranoVoice, setOnlySopranoVoice] = useState<boolean>(true);
  const [alignAboveTopLine, setAlignAboveTopLine] = useState<boolean>(true);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [detectedNotes, setDetectedNotes] = useState<NoteAnnotation[]>([]);
  const [hasScanned, setHasScanned] = useState<boolean>(false);
  const [replaceExisting, setReplaceExisting] = useState<boolean>(true);

  // Sync selected key with current project key whenever modal is opened
  useEffect(() => {
    if (isOpen) {
      setSelectedKey(currentKeySignature || 'Do Mayor');
    }
  }, [isOpen, currentKeySignature]);

  if (!isOpen) return null;

  const keyInfo = getKeySignatureInfo(selectedKey);

  const handleStartScan = async () => {
    setIsScanning(true);
    setHasScanned(false);

    try {
      await new Promise((r) => setTimeout(r, 100));

      let result: { notes: NoteAnnotation[]; detectedKey: string };
      if (sourceType === 'pdf' && fileData) {
        result = await detectNotesFromPdf(fileData, {
          pageNumber: currentPage,
          keySignature: selectedKey,
          onlySopranoVoice,
          alignAboveTopLine,
          baseFontSize,
        });
      } else if (canvas) {
        result = await detectNotesFromCanvas(canvas, {
          pageNumber: currentPage,
          keySignature: selectedKey,
          sensitivity,
          onlySopranoVoice,
          alignAboveTopLine,
          baseFontSize,
          headerSkipPercentage,
        });
      } else {
        alert('Cargando la partitura, por favor espera un momento.');
        return;
      }

      setDetectedNotes(result.notes);
      setHasScanned(true);
    } catch (err) {
      console.error('Error during auto-detection:', err);
      alert('Error al escanear la partitura: ' + err);
    } finally {
      setIsScanning(false);
    }
  };

  const handleApply = () => {
    if (detectedNotes.length === 0) return;
    onApplyDetectedNotes(detectedNotes, replaceExisting, selectedKey);
    onClose();
  };

  // Alterations description
  const alterationsEntries = Object.entries(keyInfo.alteredPitches);
  const alterationsText = alterationsEntries.length === 0
    ? 'Sin alteraciones (todas las notas naturales)'
    : alterationsEntries.map(([pitch, acc]) => `${pitch}${acc}`).join(', ');

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-container auto-detect-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div className="modal-title-group">
            <Sparkles className="modal-title-icon" size={24} />
            <div>
              <h2 className="modal-title">Detección Automática de Notas (IA / OMR)</h2>
              <p className="modal-subtitle">
                Escanea el pentagrama para identificar las notas y aplicar sus alteraciones según la armadura
              </p>
            </div>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="detect-modal-content">
          {/* Key Signature (Armadura) Selector */}
          <div className="detect-config-card">
            <div className="config-header">
              <Music size={18} className="config-icon" />
              <div>
                <div className="title-with-badge">
                  <h4 className="config-title">Armadura y Tono de la Partitura (Selección Manual)</h4>
                </div>
                <p className="config-desc">
                  Selecciona el tono original de la partitura para que las notas detectadas reciban sus sostenidos (#) o bemoles (b) correspondientes.
                </p>
              </div>
            </div>

            <div className="key-selector-row">
              <label className="key-label">Tono / Armadura:</label>
              <select
                value={selectedKey}
                onChange={(e) => setSelectedKey(e.target.value)}
                className="key-select-input"
              >
                {KEY_SIGNATURES_LIST.map((k) => (
                  <option key={k.name} value={k.name}>
                    {k.name} ({k.shortName}) {k.sharpsCount > 0 ? `— ${k.sharpsCount} #` : ''} {k.flatsCount > 0 ? `— ${k.flatsCount} b` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="key-alterations-badge">
              <span className="alt-label">Alteraciones activas en el pentagrama:</span>
              <strong className="alt-value">{alterationsText}</strong>
            </div>
          </div>

          {/* Voice Filtering and Alignment Options */}
          <div className="detect-config-card">
            <div className="config-header">
              <Layers size={18} className="config-icon" />
              <div>
                <h4 className="config-title">Voces y Posicionamiento</h4>
                <p className="config-desc">
                  Configurado para no agregar notas falsas sobre la clave ni sobre la armadura de sostenidos.
                </p>
              </div>
            </div>

            <div className="options-toggles-list">
              <label className="checkbox-toggle-card">
                <input
                  type="checkbox"
                  checked={onlySopranoVoice}
                  onChange={(e) => setOnlySopranoVoice(e.target.checked)}
                />
                <div>
                  <strong>Solo Voz 1 (Soprano / Melodía Superior)</strong>
                  <p>Ignora las demás voces (Contralto, Tenor, Bajo) y toma solo la nota más aguda de cada compás.</p>
                </div>
              </label>

              <label className="checkbox-toggle-card">
                <input
                  type="checkbox"
                  checked={alignAboveTopLine}
                  onChange={(e) => setAlignAboveTopLine(e.target.checked)}
                />
                <div>
                  <strong>Poner las notas sobre la última línea del pentagrama</strong>
                  <p>Alinea ordenadamente el nombre de las notas en una fila horizontal sobre la 5ª línea superior.</p>
                </div>
              </label>
            </div>

            <div className="header-skip-box">
              <div className="skip-label-row">
                <span className="skip-label">Zona de armadura excluida (evita notas sobre los sostenidos/bemoles iniciales):</span>
                <span className="skip-pct">{headerSkipPercentage}%</span>
              </div>
              <input
                type="range"
                min="12"
                max="26"
                value={headerSkipPercentage}
                onChange={(e) => setHeaderSkipPercentage(Number(e.target.value))}
                className="sensitivity-slider"
                title="Aumenta este valor si tu partitura tiene muchos sostenidos iniciales o compás ancho"
              />
            </div>
          </div>

          {/* Scan Controls Row */}
          <div className="scan-controls-row">
            <div className="sensitivity-box">
              <label className="slider-label">
                <Sliders size={15} />
                <span>Sensibilidad de detección:</span>
              </label>
              <input
                type="range"
                min="1"
                max="5"
                value={sensitivity}
                onChange={(e) => setSensitivity(Number(e.target.value))}
                className="sensitivity-slider"
              />
              <span className="slider-value">
                {sensitivity === 1 && 'Baja'}
                {sensitivity === 2 && 'Media-Baja'}
                {sensitivity === 3 && 'Normal (Recomendada)'}
                {sensitivity === 4 && 'Alta'}
                {sensitivity === 5 && 'Muy Alta'}
              </span>
            </div>

            <button
              type="button"
              className={`scan-action-btn ${isScanning ? 'scanning' : ''}`}
              onClick={handleStartScan}
              disabled={isScanning}
            >
              <RefreshCw size={17} className={isScanning ? 'spin-icon' : ''} />
              <span>{isScanning ? 'Analizando pentagramas...' : 'Escanear Página Actual'}</span>
            </button>
          </div>

          {/* Results Area */}
          {hasScanned && (
            <div className="scan-results-box fade-in">
              <div className="results-header">
                <Check size={20} className="check-icon" />
                <div className="results-text">
                  <h4>¡Análisis completado!</h4>
                  <p>
                    Se detectaron <strong>{detectedNotes.length} notas</strong> {onlySopranoVoice ? '(Solo Voz 1 Soprano)' : ''} en la página {currentPage}.
                  </p>
                </div>
              </div>

              {detectedNotes.length > 0 ? (
                <>
                  <div className="detected-notes-preview">
                    {detectedNotes.slice(0, 24).map((n, i) => (
                      <span key={i} className="detected-note-chip">
                        {formatNoteDisplay(n.pitch, n.accidental, n.octave)}
                      </span>
                    ))}
                    {detectedNotes.length > 24 && (
                      <span className="detected-more">+{detectedNotes.length - 24} más...</span>
                    )}
                  </div>

                  <div className="replace-toggle-row">
                    <label className="replace-label">
                      <input
                        type="checkbox"
                        checked={replaceExisting}
                        onChange={(e) => setReplaceExisting(e.target.checked)}
                      />
                      <span>Reemplazar notas existentes de esta página</span>
                    </label>
                  </div>
                </>
              ) : (
                <div className="no-notes-alert">
                  <AlertCircle size={18} />
                  <span>No se encontraron notas claras. Prueba aumentando la sensibilidad de detección.</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="modal-footer">
          <button type="button" className="btn-cancel" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn-apply-notes"
            onClick={handleApply}
            disabled={detectedNotes.length === 0}
          >
            <Sparkles size={16} />
            <span>Colocar {detectedNotes.length} Notas en la Partitura</span>
          </button>
        </div>
      </div>
    </div>
  );
};
