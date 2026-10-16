import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Camera,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileText,
  FolderArchive,
  Layers,
  Share2,
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

  const photoRecords = useMemo(() => records.filter((r) => Boolean(r.photoBlob)), [records]);
  const capturedCount = photoRecords.length;
  const issueCount = useMemo(
    () => records.filter((r) => Boolean(r.issueNote)).length,
    [records]
  );
  const pendingCount = targets.length - recordsMap.size;

  const handleDownloadZip = async (sectorFilter?: string) => {
    const valid = sectorFilter
      ? photoRecords.filter((r) => r.sector === sectorFilter)
      : photoRecords;

    if (valid.length === 0) {
      onNotify(
        sectorFilter
          ? `Nenhuma foto capturada no setor "${sectorFilter}" ainda.`
          : 'Nenhuma foto capturada ainda para gerar o ZIP.'
      );
      return;
    }

    setBusyTask(
      sectorFilter
        ? `Gerando ZIP de ${sectorFilter}...`
        : 'Gerando pacote ZIP geral em alta definição...'
    );
    setProgress(0);
    try {
      await exportCampaignPhotosZip(campaign, photoRecords, {
        organizeBySector,
        sectorFilter,
        onProgress: setProgress,
      });
      onNotify(
        sectorFilter
          ? `ZIP de ${sectorFilter} baixado com sucesso!`
          : 'Arquivo ZIP geral baixado com sucesso!'
      );
    } catch {
      onNotify('Erro ao gerar o arquivo ZIP.');
    } finally {
      setBusyTask(null);
    }
  };

  const handleShareZip = async () => {
    if (photoRecords.length === 0) {
      onNotify('Nenhuma foto para compartilhar.');
      return;
    }
    setBusyTask('Preparando ZIP para compartilhamento...');
    setProgress(0);
    try {
      const blob = await exportCampaignPhotosZip(campaign, photoRecords, {
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
      // ignore cancel
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
          {issueCount > 0 && (
            <div className="stat-chip highlight-yellow">
              <AlertTriangle size={20} className="amber-icon" />
              <span className="stat-value">{issueCount}</span>
              <span className="stat-label">Ocorrências</span>
            </div>
          )}
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
            <span>Ainda restam {pendingCount} medidores pendentes.</span>
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

      {/* NOVO: Pacote ZIP Separado por Andar (Ideal para WhatsApp) */}
      <section className="glass-card export-option-card">
        <div className="export-option-header">
          <Layers size={28} className="cyan-icon" />
          <div>
            <h3>Baixar ZIP Separado por Andar (Ideal p/ WhatsApp)</h3>
            <p>
              Gere arquivos ZIP menores apenas do pavimento desejado para enviar rápido pelo celular:
            </p>
          </div>
        </div>

        <div className="sector-zip-grid">
          {condo.sectors.map((sec) => {
            const secTotal = targets.filter((t) => t.sector === sec).length;
            const secPhotos = photoRecords.filter((r) => r.sector === sec).length;
            return (
              <button
                key={sec}
                className="sector-zip-btn"
                disabled={Boolean(busyTask) || secPhotos === 0}
                onClick={() => handleDownloadZip(sec)}
              >
                <div className="sector-zip-top">
                  <strong>{sec}</strong>
                  <Download size={15} />
                </div>
                <span className="sector-zip-count">
                  {secPhotos} / {secTotal} fotos
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Pacote ZIP Geral */}
      <section className="glass-card export-option-card">
        <div className="export-option-header">
          <FolderArchive size={28} className="cyan-icon" />
          <div>
            <h3>Pacote ZIP Completo ({capturedCount} Fotos)</h3>
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
            disabled={Boolean(busyTask)}
            onClick={() => handleDownloadZip()}
          >
            <FolderArchive size={18} /> Baixar ZIP Geral Completo
          </button>

          <button
            className="btn-secondary"
            disabled={Boolean(busyTask)}
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
              Documento formatado com tabela de status, ocorrências registradas e galeria visual das
              fotos com data e hora.
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
          disabled={Boolean(busyTask)}
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
              Checklist completo das {targets.length} unidades (Setor, Sala, Medidor, Arquivo,
              Status, Ocorrências e Horário).
            </p>
          </div>
        </div>

        <button
          className="btn-secondary"
          disabled={Boolean(busyTask)}
          onClick={handleDownloadExcel}
        >
          <FileSpreadsheet size={18} /> Baixar Planilha de Conferência (.xlsx)
        </button>
      </section>
    </div>
  );
};
