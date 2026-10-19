import React, { useRef, useState } from 'react';
import {
  Building2,
  Camera,
  Download,
  FileSpreadsheet,
  FolderArchive,
  Plus,
  Trash2,
  Upload,
  Droplets,
  CheckCircle2,
  Images,
} from 'lucide-react';
import { CondoStructure, PhotoCampaign, PhotoRecord } from '../types';
import { expandUnitsToMeterTargets } from '../data/luxorLutecia';
import { exportLocalBackupJson, restoreLocalBackupJson } from '../lib/backup';
import { ImportCondoModal } from '../components/ImportCondoModal';
import { ImportBatchPhotosModal } from '../components/ImportBatchPhotosModal';

interface HomeScreenProps {
  condos: CondoStructure[];
  selectedCondo: CondoStructure;
  campaigns: PhotoCampaign[];
  allRecords: PhotoRecord[];
  onSelectCondo: (condo: CondoStructure) => void;
  onImportCondo: (condo: CondoStructure) => Promise<void>;
  onCreateCampaign: (name: string, month: number, year: number) => Promise<void>;
  onOpenCampaignCollect: (campaign: PhotoCampaign) => void;
  onOpenCampaignExport: (campaign: PhotoCampaign) => void;
  onDeleteCampaign: (campaignId: string) => Promise<void>;
  onNotify: (msg: string) => void;
}

const MONTH_NAMES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

export const HomeScreen: React.FC<HomeScreenProps> = ({
  condos,
  selectedCondo,
  campaigns,
  allRecords,
  onSelectCondo,
  onImportCondo,
  onCreateCampaign,
  onOpenCampaignCollect,
  onOpenCampaignExport,
  onDeleteCampaign,
  onNotify,
}) => {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [customName, setCustomName] = useState('');
  const [showImportModal, setShowImportModal] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const backupInputRef = useRef<HTMLInputElement | null>(null);

  const totalMetersInCondo = expandUnitsToMeterTargets(selectedCondo.units).length;
  const twoMetersCount = selectedCondo.units.filter((u) => u.metersCount === 2).length;
  const fourMetersCount = selectedCondo.units.filter((u) => u.metersCount >= 4).length;

  const handleStartCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    const label =
      customName.trim() || `${MONTH_NAMES[month - 1]}/${year}`;
    await onCreateCampaign(label, month, year);
    setCustomName('');
  };

  const handleRestoreBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const res = await restoreLocalBackupJson(file);
      onNotify(`Backup restaurado: ${res.campaignsCount} campanhas e ${res.recordsCount} fotos!`);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Falha ao restaurar backup.');
    } finally {
      e.target.value = '';
    }
  };

  return (
    <div className="screen-container">
      {/* Hero Header */}
      <header className="app-hero-header">
        <div className="brand-row">
          <div className="brand-logo-badge">
            <Droplets size={26} />
          </div>
          <div>
            <h1 className="brand-title">FotoHidro</h1>
            <p className="brand-subtitle">
              Coleta de Fotos em Alta Definição • Download Imediato por Sala
            </p>
          </div>
        </div>
        <span className="offline-pill">100% Offline Ready</span>
      </header>

      {/* Card Condomínio Selecionado */}
      <section className="glass-card">
        <div className="section-header-row">
          <div className="section-title-group">
            <Building2 size={20} className="cyan-icon" />
            <h2>Condomínio / Edifício Ativo</h2>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button className="btn-primary btn-sm" onClick={() => setShowBatchModal(true)}>
              <Images size={15} /> Subir Fotos da Medição
            </button>
            <button className="btn-secondary btn-sm" onClick={() => setShowImportModal(true)}>
              <FileSpreadsheet size={15} /> Importar Planilha
            </button>
          </div>
        </div>

        <div className="condo-selector-bar">
          <select
            className="select-field"
            value={selectedCondo.id}
            onChange={(e) => {
              const found = condos.find((c) => c.id === e.target.value);
              if (found) onSelectCondo(found);
            }}
          >
            {condos.map((c) => {
              const mCount = expandUnitsToMeterTargets(c.units).length;
              return (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.units.length} salas • {mCount} medidores)
                </option>
              );
            })}
          </select>
        </div>

        <div className="condo-stats-chips">
          <div className="stat-chip">
            <span className="stat-value">{selectedCondo.units.length}</span>
            <span className="stat-label">Salas / Unidades</span>
          </div>
          <div className="stat-chip highlight-cyan">
            <span className="stat-value">{totalMetersInCondo}</span>
            <span className="stat-label">Total de Fotos (Medidores)</span>
          </div>
          {twoMetersCount > 0 && (
            <div className="stat-chip highlight-yellow">
              <span className="stat-value">{twoMetersCount}</span>
              <span className="stat-label">Salas c/ 2 Medidores</span>
            </div>
          )}
          {fourMetersCount > 0 && (
            <div className="stat-chip highlight-blue">
              <span className="stat-value">{fourMetersCount}</span>
              <span className="stat-label">Unid. c/ 4 Medidores</span>
            </div>
          )}
        </div>
      </section>

      {/* Nova Campanha Mensal */}
      <section className="glass-card">
        <div className="section-title-group" style={{ marginBottom: '12px' }}>
          <Plus size={20} className="cyan-icon" />
          <h2>Nova Coleta de Fotos ({selectedCondo.name})</h2>
        </div>

        <form onSubmit={handleStartCampaign} className="new-campaign-form">
          <div className="form-row-grid">
            <div className="form-group">
              <label>Mês de Referência</label>
              <select
                className="select-field"
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
              >
                {MONTH_NAMES.map((m, idx) => (
                  <option key={m} value={idx + 1}>
                    {String(idx + 1).padStart(2, '0')} - {m}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Ano</label>
              <input
                type="number"
                className="input-field"
                value={year}
                min={2024}
                max={2035}
                onChange={(e) => setYear(Number(e.target.value))}
              />
            </div>

            <div className="form-group">
              <label>Identificação (Opcional)</label>
              <input
                type="text"
                className="input-field"
                placeholder={`Ex: ${MONTH_NAMES[month - 1]}/${year}`}
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
              />
            </div>
          </div>

          <button type="submit" className="btn-primary btn-full">
            <Camera size={19} /> Iniciar Sessão de Fotos Agora
          </button>
        </form>
      </section>

      {/* Lista de Campanhas Salvas */}
      <section className="glass-card">
        <div className="section-title-group" style={{ marginBottom: '14px' }}>
          <FolderArchive size={20} className="cyan-icon" />
          <h2>Medições Salvas no Aparelho</h2>
        </div>

        {campaigns.length === 0 ? (
          <div className="empty-state">
            <p>Nenhuma medição criada ainda. Clique em "Iniciar Sessão de Fotos Agora" acima para começar!</p>
          </div>
        ) : (
          <div className="campaigns-list">
            {campaigns.map((camp) => {
              const condo = condos.find((c) => c.id === camp.condoId) || selectedCondo;
              const totalTargets = expandUnitsToMeterTargets(condo.units).length;
              const captured = allRecords.filter((r) => r.campaignId === camp.id).length;
              const percent = totalTargets > 0 ? Math.round((captured / totalTargets) * 100) : 0;

              return (
                <div key={camp.id} className="campaign-item-card">
                  <div className="campaign-item-top">
                    <div>
                      <span className="campaign-condo-tag">{camp.condoName}</span>
                      <h3 className="campaign-item-title">{camp.name}</h3>
                      <span className="campaign-item-date">
                        Atualizado em {new Date(camp.updatedAt).toLocaleString('pt-BR')}
                      </span>
                    </div>

                    <div className="campaign-progress-badge">
                      {percent === 100 && <CheckCircle2 size={16} className="emerald-icon" />}
                      <strong>
                        {captured} / {totalTargets}
                      </strong>
                      <span>({percent}%)</span>
                    </div>
                  </div>

                  <div className="progress-bar-track">
                    <div className="progress-bar-fill" style={{ width: `${percent}%` }} />
                  </div>

                  <div className="campaign-actions-row">
                    <button
                      className="btn-primary"
                      onClick={() => onOpenCampaignCollect(camp)}
                    >
                      <Camera size={17} /> Fotografar Salas
                    </button>

                    <button
                      className="btn-secondary"
                      onClick={() => onOpenCampaignExport(camp)}
                    >
                      <Download size={17} /> Exportar ZIP / PDF / Excel
                    </button>

                    <button
                      className="btn-danger-outline"
                      onClick={() => {
                        if (window.confirm(`Excluir a campanha "${camp.name}" e suas fotos?`)) {
                          onDeleteCampaign(camp.id);
                        }
                      }}
                      title="Excluir campanha"
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Card Backup Local */}
      <section className="glass-card">
        <div className="section-header-row">
          <div>
            <h2>Backup de Segurança dos Dados</h2>
            <p className="card-helper-text">
              Salve ou restaure todas as campanhas e fotos em arquivo JSON.
            </p>
          </div>
          <div className="backup-buttons-row">
            <button
              className="btn-secondary btn-sm"
              onClick={async () => {
                await exportLocalBackupJson();
                onNotify('Backup JSON gerado com sucesso!');
              }}
            >
              <Download size={15} /> Baixar Backup
            </button>
            <button
              className="btn-secondary btn-sm"
              onClick={() => backupInputRef.current?.click()}
            >
              <Upload size={15} /> Restaurar JSON
            </button>
          </div>
        </div>
        <input
          ref={backupInputRef}
          type="file"
          accept=".json"
          style={{ display: 'none' }}
          onChange={handleRestoreBackup}
        />
      </section>

      {showImportModal && (
        <ImportCondoModal
          onImported={onImportCondo}
          onClose={() => setShowImportModal(false)}
        />
      )}

      {showBatchModal && (
        <ImportBatchPhotosModal
          condo={selectedCondo}
          campaigns={campaigns}
          onSuccess={onNotify}
          onClose={() => setShowBatchModal(false)}
        />
      )}
    </div>
  );
};
