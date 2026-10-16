import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { MeterTarget, PhotoCampaign, PhotoRecord } from '../types';
import { sanitizeUnitForFileName } from '../data/luxorLutecia';

export function exportCampaignChecklistExcel(
  campaign: PhotoCampaign,
  targets: MeterTarget[],
  recordsMap: Map<string, PhotoRecord>
): void {
  const rows = targets.map((t) => {
    const rec = recordsMap.get(t.targetId);
    const meterDesc =
      t.totalMeters === 1 ? '1 Medidor ( Único )' : `Medidor ${t.meterIndex} de ${t.totalMeters}`;

    const status = rec?.photoBlob
      ? 'FOTOGRAFADO'
      : rec?.issueNote
      ? `OCORRÊNCIA (${rec.issueNote})`
      : 'PENDENTE';

    return {
      Setor: t.sector,
      Unidade: t.unitLabel,
      Medidor: meterDesc,
      'Total Medidores na Sala': t.totalMeters,
      'Arquivo da Foto': t.fileName,
      Status: status,
      'Ocorrência / Observação': rec?.issueNote || '—',
      'Data/Hora': rec ? new Date(rec.capturedAt).toLocaleString('pt-BR') : '—',
      Resolução: rec?.width && rec?.height ? `${rec.width}x${rec.height}` : '—',
    };
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [
    { wch: 16 },
    { wch: 18 },
    { wch: 22 },
    { wch: 24 },
    { wch: 24 },
    { wch: 22 },
    { wch: 26 },
    { wch: 22 },
    { wch: 14 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Conferencia_Fotos');

  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([out], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  const safeCampaign = sanitizeUnitForFileName(`${campaign.condoName}_${campaign.name}`);
  saveAs(blob, `${safeCampaign}_CONFERENCIA.xlsx`);
}
