import { saveAs } from 'file-saver';
import { db } from '../db/database';
import { CondoStructure, PhotoCampaign, PhotoRecord } from '../types';

interface SerializedRecord extends Omit<PhotoRecord, 'photoBlob'> {
  photoBase64?: string;
  mimeType?: string;
}

interface BackupPayload {
  version: number;
  exportedAt: number;
  condos: CondoStructure[];
  campaigns: PhotoCampaign[];
  records: SerializedRecord[];
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const res = String(reader.result || '');
      const base64 = res.includes(',') ? res.split(',')[1] : res;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function base64ToBlob(base64: string, mimeType = 'image/jpeg'): Blob {
  const byteChars = atob(base64);
  const byteNumbers = new Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) {
    byteNumbers[i] = byteChars.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
}

export async function exportLocalBackupJson(): Promise<void> {
  const condos = await db.condos.toArray();
  const campaigns = await db.campaigns.toArray();
  const rawRecords = await db.records.toArray();

  const records: SerializedRecord[] = [];
  for (const r of rawRecords) {
    const { photoBlob, ...rest } = r;
    const photoBase64 = photoBlob ? await blobToBase64(photoBlob) : undefined;
    records.push({
      ...rest,
      photoBase64,
      mimeType: photoBlob?.type || 'image/jpeg',
    });
  }

  const payload: BackupPayload = {
    version: 1,
    exportedAt: Date.now(),
    condos,
    campaigns,
    records,
  };

  const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
  const dateStr = new Date().toISOString().slice(0, 10);
  saveAs(blob, `fotohidro-backup-${dateStr}.json`);
}

export async function restoreLocalBackupJson(file: File): Promise<{
  campaignsCount: number;
  recordsCount: number;
}> {
  const text = await file.text();
  const payload = JSON.parse(text) as BackupPayload;

  if (!payload || !Array.isArray(payload.campaigns) || !Array.isArray(payload.records)) {
    throw new Error('Arquivo de backup JSON inválido.');
  }

  const restoredRecords: PhotoRecord[] = payload.records.map((r) => {
    const { photoBase64, mimeType, ...rest } = r;
    return {
      ...rest,
      photoBlob: photoBase64 ? base64ToBlob(photoBase64, mimeType || 'image/jpeg') : undefined,
    };
  });

  await db.transaction('rw', db.condos, db.campaigns, db.records, async () => {
    if (Array.isArray(payload.condos)) {
      await db.condos.bulkPut(payload.condos);
    }
    await db.campaigns.bulkPut(payload.campaigns);
    await db.records.bulkPut(restoredRecords);
  });

  return {
    campaignsCount: payload.campaigns.length,
    recordsCount: restoredRecords.length,
  };
}
