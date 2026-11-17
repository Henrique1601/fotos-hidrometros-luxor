import React, { useEffect, useState } from 'react';
import { AlertTriangle, Camera, Download, Trash2, X } from 'lucide-react';
import { MeterTarget, PhotoRecordMeta } from '../types';
import { getPhotoRecordById } from '../db/database';
import { triggerImmediatePhotoDownload } from '../lib/immediateDownload';

interface PhotoPreviewModalProps {
  target: MeterTarget;
  record: PhotoRecordMeta;
  onRetake: () => void;
  onDelete: () => Promise<void>;
  onClose: () => void;
}

export const PhotoPreviewModal: React.FC<PhotoPreviewModalProps> = ({
  target,
  record,
  onRetake,
  onDelete,
  onClose,
}) => {
  const [photoUrl, setPhotoUrl] = useState<string>('');
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [loading, setLoading] = useState<boolean>(record.hasPhoto);

  useEffect(() => {
    let active = true;
    let objectUrl = '';

    async function loadBlob() {
      if (!record.hasPhoto) {
        setPhotoUrl('');
        setPhotoBlob(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      const full = await getPhotoRecordById(record.id);
      if (!active) return;
      if (full?.photoBlob) {
        objectUrl = URL.createObjectURL(full.photoBlob);
        setPhotoBlob(full.photoBlob);
        setPhotoUrl(objectUrl);
      } else {
        setPhotoUrl('');
        setPhotoBlob(null);
      }
      setLoading(false);
    }

    loadBlob();

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [record.id, record.hasPhoto, record.capturedAt]);

  const handleDownloadNow = () => {
    if (photoBlob) {
      triggerImmediatePhotoDownload(photoBlob, target.fileName);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card preview-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3 className="modal-title">Sala {target.unitLabel}</h3>
            <p className="modal-subtitle">
              {target.sector} •{' '}
              {target.totalMeters === 1
                ? '1 Medidor'
                : `Medidor ${target.meterIndex} de ${target.totalMeters}`}{' '}
              • Arquivo: <strong>{target.fileName}</strong>
            </p>
          </div>
          <button className="icon-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {record.issueNote && (
          <div className="pending-Action-banner" style={{ marginTop: 0 }}>
            <span>
              <AlertTriangle size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />
              Ocorrência registrada: <strong>{record.issueNote}</strong>
            </span>
          </div>
        )}

        {loading ? (
          <div className="empty-state" style={{ padding: '28px', textAlign: 'center' }}>
            <p>Carregando imagem...</p>
          </div>
        ) : photoUrl ? (
          <div className="preview-image-container">
            <img src={photoUrl} alt={target.fileName} className="preview-image-full" />
          </div>
        ) : (
          <div className="empty-state" style={{ padding: '28px', textAlign: 'center' }}>
            <p>Nenhuma foto anexada (apenas ocorrência registrada).</p>
          </div>
        )}

        <div className="preview-meta-bar">
          <span>📅 {new Date(record.capturedAt).toLocaleString('pt-BR')}</span>
          {record.width && record.height && photoBlob && (
            <span>
              📐 {record.width}×{record.height}px (
              {(photoBlob.size / 1024 / 1024).toFixed(2)} MB)
            </span>
          )}
        </div>

        <div className="preview-actions-row">
          {photoBlob && (
            <button className="btn-secondary" onClick={handleDownloadNow}>
              <Download size={18} /> Baixar {target.fileName}
            </button>
          )}

          <button className="btn-primary" onClick={onRetake}>
            <Camera size={18} /> {record.hasPhoto ? 'Refazer Foto' : 'Tirar Foto Agora'}
          </button>

          <button className="btn-danger" onClick={onDelete} title="Excluir registro">
            <Trash2 size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};
