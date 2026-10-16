import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { PhotoCampaign, PhotoRecord } from '../types';
import { sanitizeUnitForFileName } from '../data/luxorLutecia';

export interface ExportZipOptions {
  organizeBySector: boolean;
  onProgress?: (percent: number) => void;
}

/**
 * Gera um arquivo .ZIP com todas as fotos capturadas na campanha.
 * Usa compressão STORE (nível 0) para arquivos JPEG de alta definição,
 * evitando travamento de CPU/memória no celular e gerando o ZIP quase instantaneamente.
 */
export async function exportCampaignPhotosZip(
  campaign: PhotoCampaign,
  records: PhotoRecord[],
  options: ExportZipOptions = { organizeBySector: true }
): Promise<Blob> {
  const zip = new JSZip();

  for (const rec of records) {
    const cleanFileName = rec.fileName.endsWith('.jpg') ? rec.fileName : `${rec.fileName}.jpg`;

    if (options.organizeBySector) {
      const folderName = sanitizeUnitForFileName(rec.sector || 'Geral');
      zip.folder(folderName)?.file(cleanFileName, rec.photoBlob, { binary: true, compression: 'STORE' });
    } else {
      zip.file(cleanFileName, rec.photoBlob, { binary: true, compression: 'STORE' });
    }
  }

  const zipBlob = await zip.generateAsync(
    {
      type: 'blob',
      compression: 'STORE',
    },
    (meta) => {
      if (options.onProgress) {
        options.onProgress(Math.round(meta.percent));
      }
    }
  );

  const safeCampaign = sanitizeUnitForFileName(`${campaign.condoName}_${campaign.name}`);
  saveAs(zipBlob, `${safeCampaign}_FOTOS.zip`);
  return zipBlob;
}
