import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { MeterTarget, PhotoCampaign, PhotoRecord } from '../types';
import { sanitizeUnitForFileName } from '../data/luxorLutecia';

async function blobToCompressedDataUrl(blob: Blob, maxWidth = 600, quality = 0.72): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const ratio = Math.min(1, maxWidth / (img.width || maxWidth));
      const w = Math.round((img.width || maxWidth) * ratio);
      const h = Math.round((img.height || maxWidth) * ratio);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error('Canvas context error'));
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      URL.revokeObjectURL(url);
      resolve(dataUrl);
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(err);
    };
    img.src = url;
  });
}

export async function exportCampaignReportPdf(
  campaign: PhotoCampaign,
  targets: MeterTarget[],
  recordsMap: Map<string, PhotoRecord>,
  includePhotos = true,
  onProgress?: (percent: number) => void
): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const capturedCount = Array.from(recordsMap.values()).filter((r) => Boolean(r.photoBlob)).length;
  const issueCount = Array.from(recordsMap.values()).filter((r) => Boolean(r.issueNote)).length;
  const totalCount = targets.length;

  doc.setFillColor(7, 24, 34);
  doc.rect(0, 0, 210, 34, 'F');

  doc.setTextColor(94, 234, 212);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(`Relatório Fotográfico — ${campaign.condoName}`, 14, 14);

  doc.setTextColor(226, 232, 240);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `Campanha: ${campaign.name}  |  Fotos: ${capturedCount}/${totalCount}  |  Ocorrências: ${issueCount}`,
    14,
    22
  );
  doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 14, 28);

  const tableBody = targets.map((t) => {
    const rec = recordsMap.get(t.targetId);
    const meterBadge =
      t.totalMeters === 1 ? '1 Medidor' : `Medidor ${t.meterIndex}/${t.totalMeters}`;
    const statusText = rec?.photoBlob
      ? 'OK (Fotografado)'
      : rec?.issueNote
      ? `OCORRÊNCIA: ${rec.issueNote}`
      : 'PENDENTE';
    return [
      t.sector,
      t.unitLabel,
      meterBadge,
      t.fileName,
      statusText,
      rec?.issueNote || '—',
      rec ? new Date(rec.capturedAt).toLocaleString('pt-BR') : '—',
    ];
  });

  autoTable(doc, {
    startY: 40,
    head: [['Setor', 'Sala', 'Medidor', 'Arquivo', 'Status', 'Ocorrência', 'Data/Hora']],
    body: tableBody,
    styles: { fontSize: 7.5, cellPadding: 1.8 },
    headStyles: { fillColor: [15, 118, 110], textColor: 255, fontStyle: 'bold' },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 4) {
        const val = String(data.cell.raw);
        if (val.startsWith('OK')) {
          data.cell.styles.textColor = [16, 185, 129];
          data.cell.styles.fontStyle = 'bold';
        } else if (val.startsWith('OCORRÊNCIA')) {
          data.cell.styles.textColor = [217, 119, 6];
          data.cell.styles.fontStyle = 'bold';
        } else {
          data.cell.styles.textColor = [239, 68, 68];
        }
      }
    },
  });

  const capturedTargets = targets.filter((t) => recordsMap.get(t.targetId)?.photoBlob);

  if (includePhotos && capturedTargets.length > 0) {
    const cardsPerPage = 4;

    for (let i = 0; i < capturedTargets.length; i++) {
      if (onProgress) {
        onProgress(Math.round(((i + 1) / capturedTargets.length) * 100));
      }

      const slotIndex = i % cardsPerPage;
      if (slotIndex === 0) {
        doc.addPage();
        doc.setFillColor(7, 24, 34);
        doc.rect(0, 0, 210, 18, 'F');
        doc.setTextColor(94, 234, 212);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text(`${campaign.condoName} — Galeria de Hidrômetros (${campaign.name})`, 14, 12);
      }

      const col = slotIndex % 2;
      const row = Math.floor(slotIndex / 2);
      const x = 14 + col * 94;
      const y = 26 + row * 124;

      const t = capturedTargets[i];
      const rec = recordsMap.get(t.targetId)!;

      doc.setDrawColor(203, 213, 225);
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(x, y, 88, 116, 3, 3, 'FD');

      if (t.totalMeters === 2) {
        doc.setFillColor(234, 179, 8);
        doc.setTextColor(20, 20, 20);
      } else if (t.totalMeters >= 4) {
        doc.setFillColor(2, 132, 199);
        doc.setTextColor(255, 255, 255);
      } else {
        doc.setFillColor(15, 118, 110);
        doc.setTextColor(255, 255, 255);
      }
      doc.roundedRect(x, y, 88, 14, 3, 3, 'F');

      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      const titleText =
        t.totalMeters > 1
          ? `Sala ${t.unitLabel} • Medidor ${t.meterIndex}/${t.totalMeters}`
          : `Sala ${t.unitLabel} • 1 Medidor`;
      doc.text(titleText, x + 4, y + 9);

      try {
        if (rec.photoBlob) {
          const dataUrl = await blobToCompressedDataUrl(rec.photoBlob, 600, 0.75);
          doc.addImage(dataUrl, 'JPEG', x + 4, y + 17, 80, 82);
        }
      } catch {
        doc.setTextColor(150, 150, 150);
        doc.text('Imagem indisponível', x + 20, y + 60);
      }

      doc.setTextColor(71, 85, 105);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(
        `Arquivo: ${t.fileName}${rec.issueNote ? ` (${rec.issueNote})` : ''}`,
        x + 4,
        y + 105
      );
      doc.text(`Capturada: ${new Date(rec.capturedAt).toLocaleString('pt-BR')}`, x + 4, y + 111);
    }
  }

  const safeCampaign = sanitizeUnitForFileName(`${campaign.condoName}_${campaign.name}`);
  doc.save(`${safeCampaign}_RELATORIO.pdf`);
}
