import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  Download,
  Search,
  SlidersHorizontal,
  Eye,
} from 'lucide-react';
import { CondoStructure, MeterTarget, PhotoCampaign, PhotoRecord, SortMode } from '../types';
import { expandUnitsToMeterTargets } from '../data/luxorLutecia';
import { CameraModal } from '../components/CameraModal';
import { PhotoPreviewModal } from '../components/PhotoPreviewModal';
import {
  getAutoDownloadPreference,
  setAutoDownloadPreference,
  triggerImmediatePhotoDownload,
} from '../lib/immediateDownload';

interface CollectScreenProps {
  condo: CondoStructure;
  campaign: PhotoCampaign;
  records: PhotoRecord[];
  onSavePhoto: (target: MeterTarget, blob: Blob, dims?: { width: number; height: number }) => Promise<void>;
  onDeletePhoto: (targetId: string) => Promise<void>;
  onBackHome: () => void;
  onGoToExport: () => void;
  onNotify: (msg: string) => void;
}

export const CollectScreen: React.FC<CollectScreenProps> = ({
  condo,
  campaign,
  records,
  onSavePhoto,
  onDeletePhoto,
  onBackHome,
  onGoToExport,
  onNotify,
}) => {
  const [selectedSector, setSelectedSector] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'done'>('all');
  const [sortMode, setSortMode] = useState<SortMode>('sheet');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [cameraTargetIndex, setCameraTargetIndex] = useState<number | null>(null);
  const [previewTarget, setPreviewTarget] = useState<MeterTarget | null>(null);
  const [autoDownload, setAutoDownload] = useState<boolean>(() => getAutoDownloadPreference());

  const recordsMap = useMemo(() => {
    const map = new Map<string, PhotoRecord>();
    for (const r of records) {
      map.set(r.targetId, r);
    }
    return map;
  }, [records]);

  const allTargets = useMemo(() => {
    const base = expandUnitsToMeterTargets(condo.units);
    if (sortMode === 'sheet') return base;

    return [...base].sort((a, b) => {
      if (a.floorOrder !== b.floorOrder) {
        return sortMode === 'floor-asc'
          ? a.floorOrder - b.floorOrder
          : b.floorOrder - a.floorOrder;
      }
      return a.orderIndex - b.orderIndex;
    });
  }, [condo.units, sortMode]);

  const filteredTargets = useMemo(() => {
    return allTargets.filter((t) => {
      if (selectedSector !== 'ALL' && t.sector !== selectedSector) return false;
      const hasPhoto = recordsMap.has(t.targetId);
      if (statusFilter === 'pending' && hasPhoto) return false;
      if (statusFilter === 'done' && !hasPhoto) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        return (
          t.unitLabel.toLowerCase().includes(q) ||
          t.targetId.toLowerCase().includes(q) ||
          t.fileName.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [allTargets, selectedSector, statusFilter, searchQuery, recordsMap]);

  const capturedCount = recordsMap.size;
  const totalCount = allTargets.length;
  const progressPercent = totalCount > 0 ? Math.round((capturedCount / totalCount) * 100) : 0;

  const handleOpenNextPendingCamera = () => {
    const nextIdx = filteredTargets.findIndex((t) => !recordsMap.has(t.targetId));
    if (nextIdx >= 0) {
      setCameraTargetIndex(nextIdx);
    } else if (filteredTargets.length > 0) {
      setCameraTargetIndex(0);
    }
  };

  const handleToggleAutoDownload = () => {
    const next = !autoDownload;
    setAutoDownload(next);
    setAutoDownloadPreference(next);
    onNotify(
      next
        ? 'Download automático ATIVADO: toda foto tirada já baixa o .jpg nomeado!'
        : 'Download automático DESATIVADO: salvando apenas na memória do app.'
    );
  };

  return (
    <div className="screen-container">
      {/* Barra de Topo */}
      <div className="top-nav-bar">
        <button className="btn-secondary btn-sm" onClick={onBackHome}>
          <ArrowLeft size={16} /> Voltar
        </button>

        <div className="top-nav-center">
          <span className="top-nav-condo">{condo.name}</span>
          <h2 className="top-nav-title">{campaign.name}</h2>
        </div>

        <button className="btn-secondary btn-sm" onClick={onGoToExport}>
          <Download size={16} /> Exportar
        </button>
      </div>

      {/* Painel Principal de Ação & Progresso */}
      <section className="glass-card collect-hero-card">
        <div className="collect-hero-top">
          <div>
            <div className="collect-counter-big">
              <span>{capturedCount}</span>
              <small> / {totalCount} medidores</small>
            </div>
            <p className="collect-Status-sub">
              {totalCount - capturedCount === 0
                ? '🎉 Todas as fotos foram concluídas!'
                : `Faltam ${totalCount - capturedCount} fotos para completar o prédio`}
            </p>
          </div>

          <button
            className={`pill-toggle ${autoDownload ? 'active-cyan' : ''}`}
            onClick={handleToggleAutoDownload}
          >
            <Download size={15} />
            <span>Baixar foto na hora: {autoDownload ? 'SIM' : 'NÃO'}</span>
          </button>
        </div>

        <div className="progress-bar-track" style={{ margin: '12px 0 16px' }}>
          <div className="progress-bar-fill" style={{ width: `${progressPercent}%` }} />
        </div>

        <button className="btn-primary btn-full btn-lg" onClick={handleOpenNextPendingCamera}>
          <Camera size={22} /> Abrir Câmera no Próximo Medidor Pendente
        </button>

        {/* Legenda de Cores igual ao PDF Oficial */}
        <div className="meter-legend-bar">
          <div className="legend-item">
            <span className="legend-dot dot-cyan" />
            <span>1 Medidor (ex: 501.jpg)</span>
          </div>
          <div className="legend-item">
            <span className="legend-dot dot-yellow" />
            <span>2 Medidores (ex: 502-1.jpg / 502-2.jpg)</span>
          </div>
          <div className="legend-item">
            <span className="legend-dot dot-blue" />
            <span>4 Medidores (Estacionamento 1 a 4)</span>
          </div>
        </div>
      </section>

      {/* Filtros por Andar / Setor, Busca e Ordenação */}
      <section className="glass-card filters-card">
        <div className="sector-pills-scroll">
          <button
            className={`sector-pill ${selectedSector === 'ALL' ? 'active' : ''}`}
            onClick={() => setSelectedSector('ALL')}
          >
            Todos ({allTargets.length})
          </button>
          {condo.sectors.map((sec) => {
            const secTargets = allTargets.filter((t) => t.sector === sec);
            const secDone = secTargets.filter((t) => recordsMap.has(t.targetId)).length;
            return (
              <button
                key={sec}
                className={`sector-pill ${selectedSector === sec ? 'active' : ''}`}
                onClick={() => setSelectedSector(sec)}
              >
                {sec} ({secDone}/{secTargets.length})
              </button>
            );
          })}
        </div>

        <div className="filter-controls-row">
          <div className="search-input-wrapper">
            <Search size={16} className="search-icon" />
            <input
              type="text"
              className="input-field search-field"
              placeholder="Buscar sala (ex: 502, 1010, Café)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="status-tabs">
            <button
              className={`status-tab ${statusFilter === 'all' ? 'active' : ''}`}
              onClick={() => setStatusFilter('all')}
            >
              Todos
            </button>
            <button
              className={`status-tab ${statusFilter === 'pending' ? 'active' : ''}`}
              onClick={() => setStatusFilter('pending')}
            >
              Pendentes
            </button>
            <button
              className={`status-tab ${statusFilter === 'done' ? 'active' : ''}`}
              onClick={() => setStatusFilter('done')}
            >
              Fotografados
            </button>
          </div>

          <div className="sort-selector">
            <SlidersHorizontal size={15} />
            <select
              className="select-field select-sm"
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as SortMode)}
            >
              <option value="sheet">Ordem do PDF / Planilha</option>
              <option value="floor-asc">Andar Crescente (5º → 10º)</option>
              <option value="floor-desc">Andar Decrescente (10º → 5º)</option>
            </select>
          </div>
        </div>
      </section>

      {/* Grade de Salas e Medidores */}
      <div className="meters-grid">
        {filteredTargets.map((target, idx) => {
          const rec = recordsMap.get(target.targetId);
          const isCaptured = Boolean(rec);

          const colorClass =
            target.totalMeters === 2
              ? 'card-meters-2'
              : target.totalMeters >= 4
              ? 'card-meters-4'
              : 'card-meters-1';

          return (
            <div
              key={target.targetId}
              className={`meter-unit-card ${colorClass} ${isCaptured ? 'is-captured' : ''}`}
              onClick={() => {
                if (isCaptured && rec) {
                  setPreviewTarget(target);
                } else {
                  setCameraTargetIndex(idx);
                }
              }}
            >
              <div className="meter-card-header">
                <span className="meter-card-sector">{target.sector}</span>
                {isCaptured ? (
                  <CheckCircle2 size={18} className="emerald-icon" />
                ) : (
                  <Camera size={16} className="muted-icon" />
                )}
              </div>

              <div className="meter-card-title">Sala {target.unitLabel}</div>

              <div className="meter-card-badge-row">
                <span className="meter-sub-badge">
                  {target.totalMeters === 1
                    ? '1 Medidor'
                    : `Medidor ${target.meterIndex}/${target.totalMeters}`}
                </span>
              </div>

              <div className="meter-card-filename">{target.fileName}</div>

              {isCaptured && rec && (
                <div className="meter-card-actions" onClick={(e) => e.stopPropagation()}>
                  <button
                    className="mini-action-btn"
                    onClick={() => setPreviewTarget(target)}
                    title="Ver foto"
                  >
                    <Eye size={13} /> Ver
                  </button>
                  <button
                    className="mini-action-btn"
                    onClick={() => triggerImmediatePhotoDownload(rec.photoBlob, target.fileName)}
                    title="Baixar .jpg novamente"
                  >
                    <Download size={13} /> .JPG
                  </button>
                  <button
                    className="mini-action-btn"
                    onClick={() => setCameraTargetIndex(idx)}
                    title="Refazer foto"
                  >
                    <Camera size={13} />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Modal de Câmera Fullscreen */}
      {cameraTargetIndex !== null && filteredTargets.length > 0 && (
        <CameraModal
          targets={filteredTargets}
          currentIndex={cameraTargetIndex}
          recordsMap={recordsMap}
          onSelectIndex={(newIdx) => setCameraTargetIndex(newIdx)}
          onCapturePhoto={onSavePhoto}
          onClose={() => setCameraTargetIndex(null)}
          onNotify={onNotify}
        />
      )}

      {/* Modal de Visualização de Foto */}
      {previewTarget && recordsMap.get(previewTarget.targetId) && (
        <PhotoPreviewModal
          target={previewTarget}
          record={recordsMap.get(previewTarget.targetId)!}
          onRetake={() => {
            const idx = filteredTargets.findIndex((t) => t.targetId === previewTarget.targetId);
            setPreviewTarget(null);
            if (idx >= 0) setCameraTargetIndex(idx);
          }}
          onDelete={async () => {
            await onDeletePhoto(previewTarget.targetId);
            setPreviewTarget(null);
            onNotify(`Foto ${previewTarget.fileName} removida.`);
          }}
          onClose={() => setPreviewTarget(null)}
        />
      )}
    </div>
  );
};
