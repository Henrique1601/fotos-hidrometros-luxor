import Dexie, { Table } from 'dexie';
import { CondoStructure, PhotoCampaign, PhotoRecord, MeterTarget } from '../types';
import { LUXOR_LUTECIA_CONDO } from '../data/luxorLutecia';

export class FotoHidroDatabase extends Dexie {
  condos!: Table<CondoStructure, string>;
  campaigns!: Table<PhotoCampaign, string>;
  records!: Table<PhotoRecord, string>;

  constructor() {
    super('FotoHidroLuxorDB');
    this.version(1).stores({
      condos: 'id, name, updatedAt',
      campaigns: 'id, condoId, createdAt, updatedAt',
      records: 'id, campaignId, condoId, targetId, unitId, sector, capturedAt',
    });
  }
}

export const db = new FotoHidroDatabase();

export async function ensureDefaultCondo(): Promise<CondoStructure> {
  const existing = await db.condos.get(LUXOR_LUTECIA_CONDO.id);
  if (!existing) {
    await db.condos.put(LUXOR_LUTECIA_CONDO);
    return LUXOR_LUTECIA_CONDO;
  }
  return existing;
}

export async function createCampaign(params: {
  condoId: string;
  condoName: string;
  name: string;
  month: number;
  year: number;
}): Promise<PhotoCampaign> {
  const now = Date.now();
  const campaign: PhotoCampaign = {
    id: `camp-${now}-${Math.random().toString(36).slice(2, 7)}`,
    condoId: params.condoId,
    condoName: params.condoName,
    name: params.name.trim() || `Medição ${String(params.month).padStart(2, '0')}/${params.year}`,
    month: params.month,
    year: params.year,
    createdAt: now,
    updatedAt: now,
  };
  await db.campaigns.add(campaign);
  return campaign;
}

export async function deleteCampaign(campaignId: string): Promise<void> {
  await db.transaction('rw', db.campaigns, db.records, async () => {
    await db.records.where('campaignId').equals(campaignId).delete();
    await db.campaigns.delete(campaignId);
  });
}

export async function savePhotoRecord(
  campaignId: string,
  condoId: string,
  target: MeterTarget,
  photoBlob?: Blob,
  dimensions?: { width: number; height: number },
  issueNote?: string
): Promise<PhotoRecord> {
  const now = Date.now();
  const existing = await db.records.get(`${campaignId}:${target.targetId}`);

  const record: PhotoRecord = {
    id: `${campaignId}:${target.targetId}`,
    campaignId,
    condoId,
    targetId: target.targetId,
    unitId: target.unitId,
    unitLabel: target.unitLabel,
    sector: target.sector,
    meterIndex: target.meterIndex,
    totalMeters: target.totalMeters,
    fileName: target.fileName,
    photoBlob: photoBlob ?? existing?.photoBlob,
    issueNote: issueNote !== undefined ? issueNote : existing?.issueNote,
    capturedAt: now,
    width: dimensions?.width ?? existing?.width,
    height: dimensions?.height ?? existing?.height,
  };

  await db.transaction('rw', db.records, db.campaigns, async () => {
    await db.records.put(record);
    await db.campaigns.update(campaignId, { updatedAt: now });
  });

  return record;
}

export async function deletePhotoRecord(campaignId: string, targetId: string): Promise<void> {
  await db.records.delete(`${campaignId}:${targetId}`);
}
