import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  Camera,
  FileSpreadsheet,
  FileText,
  FolderArchive,
  Share2,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { CondoStructure, PhotoCampaign, PhotoRecord } from '../types';
import { expandUnitsToMeterTargets } from '../data/luxorLutecia';
import { exportCampaignPhotosZip } from '../lib/exportZip';
import { exportCampaignChecklistExcel } from '../lib/exportExcel';
import { exportCampaignReportPdf } from '../lib/exportPdf';

interface ExportScreenProps {
  condo: CondoStructure;
  campaign: PhotoCampaign;
  records: PhotoRecord[];
  onBackToCollect: () => void;
  onBackHome: () => void;
  onNotify: (msg: string) => void;
}

export const ExportScreen: React.FC<ExportScreenProps> = ({
  condo,
  campaign,
  records,
  onBackToCollect,
  onBackHome,
  onNotify,
}) => {
  const [organizeBySector, setOrganizeBySector] = useState<boolean>(false);
  const [includePdfPhotos, setIncludePdfPhotos] = useState<boolean>(true);
  const [busyTask, setBusyTask] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(0);

  const targets = useMemo(() => expandUnitsToMeterTargets(condo.units), [condo.units]);
  const recordsMap = useMemo(() => {
    const map = new Map<string, PhotoRecord>();
    for (const r of records) map.set(r.targetId, r);
    return map;
  }, [records]);

  const capturedCount = recordsMap.size;
  const pendingCount = targets.length - capturedCount;

  const handleDownloadZip = async () => {
    if (records.length === 0) {
      onNotify('Nenhuma foto capturada ainda para gerar o ZIP.');
      return;
    }
    setBusyTask('Gerando pacote ZIP em alta definição...');
    setProgress(0);
    try {
      await exportCampaignPhotosZip(campaign, records, {
        organizeBySector,
        onProgress: setProgress,
      });
      onNotify('Arquivo ZIP baixado com sucesso!');
    } catch {
      onNotify('Erro ao gerar o arquivo ZIP.');
    } finally {
      setBusyTask(null);
    }
  };

  const handleShareZip = async () => {
    if (records.length === 0) {
      onNotify('Nenhuma foto para compartilhar.');
      return;
    }
    setBusyTask('Preparando ZIP para compartilhamento...');
    setProgress(0);
    try {
      const blob = await exportCampaignPhotosZip(campaign, records, {
        organizeBySector,
        onProgress: setProgress,
      });
      const file = new File([blob], `${campaign.condoName}_${campaign.name}.zip`, {
        type: 'application/zip',
      });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: `Fotos Hidrômetros — ${campaign.condoName}`,
          text: `${capturedCount} fotos capturadas (${campaign.name})`,
          files: [file],
        });
      } else {
        onNotify('O arquivo ZIP já foi baixado no seu aparelho!');
      }
    } catch {
      // user cancelled share or unsupported
    } finally {
      setBusyTask(null);
    }
  };

  const handleDownloadPdf = async () => {
    setBusyTask('Montando relatório PDF...');
    setProgress(0);
    try {
      await exportCampaignReportPdf(campaign, targets, recordsMap, includePdfPhotos, setProgress);
      onNotify('Relatório PDF baixado com sucesso!');
    } catch {
      onNotify('Erro ao gerar relatório PDF.');
    } finally {
      setBusyTask(null);
    }
  };

  const handleDownloadExcel = () => {
    try {
      exportCampaignChecklistExcel(campaign, targets, recordsMap);
      onNotify('Planilha Excel de conferência baixada!');
    } catch {
      onNotify('Erro ao gerar planilha Excel.');
    }
  };

  return (
    <div className="screen-container">
      <div className="top-nav-bar">
        <button className="btn-secondary btn-sm" onClick={onBackToCollect}>
          <ArrowLeft size={16} /> Voltar às Salas
        </button>

        <div className="top-nav-center">
          <span className="top-nav-condo">{condo.name}</span>
          <h2 className="top-nav-title">Central de Exportação</h2>
        </div>

        <button className="btn-secondary btn-sm" onClick={onBackHome}>
          Início
        </button>
      </div>

      {/* Resumo da Coleta */}
      <section className="glass-card">
        <h2>Resumo da Medição — {campaign.name}</h2>
        <div className="condo-stats-chips" style={{ marginTop: '14px' }}>
          <div className="stat-chip highlight-cyan">
            <CheckCircle2 size={20} className="emerald-icon" />
            <span className="stat-value">{capturedCount}</span>
            <span className="stat-label">Fotos Capturadas</span>
          </div>
          <div className="stat-chip">
            <AlertCircle size={20} className="amber-icon" />
            <span className="stat-value">{pendingCount}</span>
            <span className="stat-label">Pendentes</span>
          </div>
          <div className="stat-chip">
            <span className="stat-value">{targets.length}</span>
            <span className="stat-label">Total de Medidores</span>
          </div>
        </div>

        {pendingCount > 0 && (
          <div className="pending-Action-banner">
            <span>Ainda restam {pendingCount} medidores sem foto.</span>
            <button className="btn-primary btn-sm" onClick={onBackToCollect}>
              <Camera size={15} /> Continuar Fotografando
            </button>
          </div>
        )}
      </section>

      {busyTask && (
        <section className="glass-card busy-progress-card">
          <p>{busyTask}</p>
          <div className="progress-bar-track">
            <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
          </div>
          <span>{progress}%</span>
        </section>
      )}

      {/* Pacote ZIP das Fotos */}
      <section className="glass-card export-option-card">
        <div className="export-option-header">
          <FolderArchive size={28} className="cyan-icon" />
          <div>
            <h3>Pacote ZIP com Todas as Fotos (.JPG)</h3>
            <p>
              Todas as fotos já nomeadas perfeitamente (ex: <code>501.jpg</code>,{' '}
              <code>502-1.jpg</code>, <code>502-2.jpg</code>, <code>Estacionamento-1.jpg</code>).
            </p>
          </div>
        </div>

        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={organizeBySector}
            onChange={(e) => setOrganizeBySector(e.target.checked)}
          />
          <span>
            Separar em subpastas por andar (ex: <code>5o_Andar/501.jpg</code>). Se desmarcado,
            salva todas direto na raiz do ZIP.
          </span>
        </label>

        <div className="export-buttons-row">
          <button
            className="btn-primary"
            disabled={ Boolean(busyTask) }
            onClick={handleDownloadZip}
          >
            <FolderArchive size={18} /> Baixar ZIP de Todas as Fotos
          </button>

          <button
            className="btn-secondary"
            disabled={ Boolean(busyTask) }
            onClick={handleShareZip}
          >
            <Share2 size={18} /> Compartilhar ZIP (WhatsApp / Drive)
          </button>
        </div>
      </section>

      {/* Relatório PDF */}
      <section className="glass-card export-option-card">
        <div className="export-option-header">
          <FileText size={28} className="cyan-icon" />
          <div>
            <h3>Relatório Fotográfico em PDF</h3>
            <p>
              Documento formatado com tabela de status e galeria visual das fotos com data e hora.
            </p>
          </div>
        </div>

        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={includePdfPhotos}
            onChange={(e) => setIncludePdfPhotos(e.target.checked)}
          />
          <span>Incluir galeria de fotos no PDF</span>
        </label>

        <button
          className="btn-primary"
          disabled={ Boolean(busyTask) }
          onClick={handleDownloadPdf}
        >
          <FileText size={18} /> Baixar Relatório PDF
        </button>
      </section>

      {/* Planilha de Conferência Excel */}
      <section className="glass-card export-option-card">
        <div className="export-option-header">
          <FileSpreadsheet size={28} className="cyan-icon" />
          <div>
            <h3>Planilha Excel de Conferência (.XLSX)</h3>
            <p>
              Checklist completo das {targets.length} fotos (Setor, Sala, Medidor, Nome do Arquivo,
              Status e Horário da Foto).
            </p>
          </div>
        </div>

        <button
          className="btn-secondary"
          disabled={ Boolean(busyTask) }
          onClick={handleDownloadExcel}
        >
          <FileSpreadsheet size={18} /> Baixar Planilha de Conferência (.xlsx)
        </button>
      </section>
    </div>
  );
};
