import React, { useState, useEffect } from 'react';
import type { FirebaseConfig } from '../types';
import { getFirebaseConfig, saveFirebaseConfig, testFirebaseConnection } from '../services/firebase';
import { Cloud, X, Check, Key, ShieldCheck, AlertCircle, RefreshCw, ExternalLink } from 'lucide-react';

interface FirebaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigSaved?: () => void;
}

export const FirebaseModal: React.FC<FirebaseModalProps> = ({
  isOpen,
  onClose,
  onConfigSaved,
}) => {
  const [apiKey, setApiKey] = useState('');
  const [projectId, setProjectId] = useState('');
  const [authDomain, setAuthDomain] = useState('');
  const [appId, setAppId] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      const cfg = getFirebaseConfig();
      if (cfg) {
        setApiKey(cfg.apiKey || '');
        setProjectId(cfg.projectId || '');
        setAuthDomain(cfg.authDomain || '');
        setAppId(cfg.appId || '');
      }
      setTestResult(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTestConnection = async () => {
    if (!apiKey.trim() || !projectId.trim()) {
      setTestResult({ success: false, message: 'Por favor ingresa al menos la API Key y el Project ID.' });
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    const res = await testFirebaseConnection({
      apiKey: apiKey.trim(),
      projectId: projectId.trim(),
      authDomain: authDomain.trim() || `${projectId.trim()}.firebaseapp.com`,
      appId: appId.trim(),
    });

    setIsTesting(false);
    setTestResult(res);
  };

  const handleSave = () => {
    if (!apiKey.trim() || !projectId.trim()) {
      alert('Debes ingresar al menos el Project ID y la API Key de tu proyecto de Firebase.');
      return;
    }

    const cfg: FirebaseConfig = {
      apiKey: apiKey.trim(),
      projectId: projectId.trim(),
      authDomain: authDomain.trim() || `${projectId.trim()}.firebaseapp.com`,
      appId: appId.trim(),
    };

    saveFirebaseConfig(cfg);
    if (onConfigSaved) onConfigSaved();
    onClose();
  };

  const handleClear = () => {
    if (window.confirm('¿Deseas desvincular Firebase de este dispositivo?')) {
      saveFirebaseConfig(null);
      setApiKey('');
      setProjectId('');
      setAuthDomain('');
      setAppId('');
      setTestResult(null);
      if (onConfigSaved) onConfigSaved();
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-container firebase-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div className="modal-title-group">
            <Cloud size={24} className="modal-title-icon text-amber" />
            <div>
              <h2 className="modal-title">Sincronización en la Nube con Firebase</h2>
              <p className="modal-subtitle">
                Guarda tus notas en Firestore para que se sincronicen en tu celular y cualquier equipo con enlace web gratuito.
              </p>
            </div>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="firebase-modal-body">
          <div className="firebase-info-card">
            <div className="info-header">
              <ShieldCheck size={18} className="info-icon" />
              <strong>¿Para qué sirve?</strong>
            </div>
            <p>
              Si vas a subir NotaScore a un hosting estático gratuito (como Vercel, Netlify, GitHub Pages o Firebase Hosting), 
              conectar tu proyecto gratuito de Firebase permite que todas las notas y transposiciones que hagas en tu celular 
              queden guardadas en la nube y se sincronicen automáticamente en todos tus dispositivos.
            </p>
            <a
              href="https://console.firebase.google.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="firebase-link-btn"
            >
              <span>Abrir Firebase Console (Gratis)</span>
              <ExternalLink size={14} />
            </a>
          </div>

          <div className="firebase-form-grid">
            <div className="form-field">
              <label className="field-label">
                <Key size={14} />
                <span>Project ID *:</span>
              </label>
              <input
                type="text"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                placeholder="ej. notascore-app-12345"
                className="firebase-input"
              />
            </div>

            <div className="form-field">
              <label className="field-label">
                <Key size={14} />
                <span>API Key *:</span>
              </label>
              <input
                type="text"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="AIzaSyB..."
                className="firebase-input"
              />
            </div>

            <div className="form-field">
              <label className="field-label">
                <span>Auth Domain (opcional):</span>
              </label>
              <input
                type="text"
                value={authDomain}
                onChange={(e) => setAuthDomain(e.target.value)}
                placeholder="tu-proyecto.firebaseapp.com"
                className="firebase-input"
              />
            </div>

            <div className="form-field">
              <label className="field-label">
                <span>App ID (opcional):</span>
              </label>
              <input
                type="text"
                value={appId}
                onChange={(e) => setAppId(e.target.value)}
                placeholder="1:123456789:web:abcdef"
                className="firebase-input"
              />
            </div>
          </div>

          {/* Test connection result */}
          {testResult && (
            <div className={`firebase-test-alert ${testResult.success ? 'success' : 'error'}`}>
              {testResult.success ? <Check size={18} /> : <AlertCircle size={18} />}
              <span>{testResult.message}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer">
          {getFirebaseConfig() && (
            <button type="button" className="btn-danger-outline" onClick={handleClear}>
              Desvincular
            </button>
          )}

          <div className="footer-right-actions">
            <button
              type="button"
              className="btn-test-conn"
              onClick={handleTestConnection}
              disabled={isTesting}
            >
              <RefreshCw size={15} className={isTesting ? 'spin-icon' : ''} />
              <span>{isTesting ? 'Comprobando...' : 'Probar Conexión'}</span>
            </button>

            <button type="button" className="btn-cancel" onClick={onClose}>
              Cancelar
            </button>

            <button type="button" className="btn-save-firebase" onClick={handleSave}>
              <Cloud size={16} />
              <span>Guardar Configuración</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
