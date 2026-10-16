import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { PhotoCampaign, PhotoRecord } from '../types';
import { sanitizeUnitForFileName } from '../data/luxorLutecia';

export interface ExportZipOptions {
  organizeBySector: boolean;
  sectorFilter?: string;
  onProgress?: (percent: number) => void;
}

/**
 * Gera um arquivo .ZIP com as fotos capturadas na campanha (geral ou filtrado por andar/setor).
 * Usa compressão STORE (nível 0) para arquivos JPEG de alta definição.
 */
export async function exportCampaignPhotosZip(
  campaign: PhotoCampaign,
  records: PhotoRecord[],
  options: ExportZipOptions = { organizeBySector: true }
): Promise<Blob> {
  const zip = new JSZip();

  const validRecords = records.filter((r) => {
    if (!r.photoBlob) return false;
    if (options.sectorFilter && r.sector !== options.sectorFilter) return false;
    return true;
  });

  for (const rec of validRecords) {
    if (!rec.photoBlob) continue;
    const cleanFileName = rec.fileName.endsWith('.jpg') ? rec.fileName : `${rec.fileName}.jpg`;

    if (options.organizeBySector && !options.sectorFilter) {
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

  const suffix = options.sectorFilter
    ? `_${sanitizeUnitForFileName(options.sectorFilter)}_FOTOS`
    : '_FOTOS';
  const safeCampaign = sanitizeUnitForFileName(`${campaign.condoName}_${campaign.name}`);
  saveAs(zipBlob, `${safeCampaign}${suffix}.zip`);
  return zipBlob;
}
