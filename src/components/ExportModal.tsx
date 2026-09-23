import React, { useState } from 'react';
import type { ScoreProject } from '../types';
import { FileText, Image, Printer, X, Download, Check } from 'lucide-react';
import { downloadPageAsPng, exportProjectToPdf } from '../utils/exportScore';
import { formatTransposeDescription } from '../utils/musicTheory';

interface ExportModalProps {
  isOpen: boolean;
  project: ScoreProject;
  currentPage: number;
  renderedCanvases: Map<number, HTMLCanvasElement>;
  onClose: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  project,
  currentPage,
  renderedCanvases,
  onClose,
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentCanvas = renderedCanvases.get(currentPage);

  const handleExportPng = async () => {
    if (!currentCanvas) {
      alert('La página aún se está procesando. Por favor espera un segundo.');
      return;
    }
    try {
      setIsExporting(true);
      await downloadPageAsPng(
        currentCanvas,
        project.notes,
        currentPage,
        `${project.title}_pag_${currentPage}.png`
      );
      setSuccessMsg('¡Imagen PNG descargada con éxito!');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      console.error(err);
      alert('Error al exportar imagen: ' + err);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportPdf = async () => {
    try {
      setIsExporting(true);
      // Collect canvases in page order
      const canvases: HTMLCanvasElement[] = [];
      for (let p = 1; p <= project.numPages; p++) {
        const c = renderedCanvases.get(p);
        if (c) canvases.push(c);
      }

      if (canvases.length === 0 && currentCanvas) {
        canvases.push(currentCanvas);
      }

      if (canvases.length === 0) {
        alert('Cargando la partitura para exportar...');
        return;
      }

      await exportProjectToPdf(canvases, project);
      setSuccessMsg('¡Documento PDF exportado correctamente!');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      console.error(err);
      alert('Error al exportar PDF: ' + err);
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-container export-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <Download className="modal-title-icon" size={24} />
            <div>
              <h2 className="modal-title">Exportar e Imprimir Partitura</h2>
              <p className="modal-subtitle">
                Descarga tu partitura con todas las notas en cifrado español incrustadas
              </p>
            </div>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Score Summary Box */}
        <div className="export-summary-box">
          <div className="summary-col">
            <span className="summary-label">Partitura:</span>
            <span className="summary-value">{project.title}</span>
          </div>
          <div className="summary-col">
            <span className="summary-label">Notas Anotadas:</span>
            <span className="summary-value">{project.notes.length} notas</span>
          </div>
          <div className="summary-col">
            <span className="summary-label">Tonalidad:</span>
            <span className="summary-value highlight">
              {formatTransposeDescription(project.transposeHistory)}
            </span>
          </div>
        </div>

        {successMsg && (
          <div className="export-success-alert fade-in">
            <Check size={18} />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Options list */}
        <div className="export-options-grid">
          {/* PDF Option */}
          <div className="export-card" onClick={handleExportPdf}>
            <div className="export-card-icon pdf">
              <FileText size={32} />
            </div>
            <div className="export-card-info">
              <h4>Descargar Documento PDF</h4>
              <p>Ideal para imprimir, archivar o compartir en partituras multipágina.</p>
            </div>
            <button type="button" className="export-action-btn primary" disabled={isExporting}>
              Descargar PDF
            </button>
          </div>

          {/* PNG Image Option */}
          <div className="export-card" onClick={handleExportPng}>
            <div className="export-card-icon img">
              <Image size={32} />
            </div>
            <div className="export-card-info">
              <h4>Descargar Imagen PNG (Página {currentPage})</h4>
              <p>Alta nitidez para ver en celulares, tablets o enviar por WhatsApp.</p>
            </div>
            <button type="button" className="export-action-btn secondary" disabled={isExporting}>
              Descargar PNG
            </button>
          </div>

          {/* Print Option */}
          <div className="export-card" onClick={handlePrint}>
            <div className="export-card-icon print">
              <Printer size={32} />
            </div>
            <div className="export-card-info">
              <h4>Imprimir Partitura</h4>
              <p>Abre el cuadro de diálogo de impresión de tu navegador.</p>
            </div>
            <button type="button" className="export-action-btn neutral">
              Imprimir
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
