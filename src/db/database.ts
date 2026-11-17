import Dexie, { Table } from 'dexie';
import {
  CondoStructure,
  MeterTarget,
  PhotoCampaign,
  PhotoRecord,
  PhotoRecordMeta,
} from '../types';
import { LUXOR_LUTECIA_CONDO } from '../data/luxorLutecia';

export function toRecordMeta(record: PhotoRecord): PhotoRecordMeta {
  return {
    id: record.id,
    campaignId: record.campaignId,
    condoId: record.condoId,
    targetId: record.targetId,
    unitId: record.unitId,
    unitLabel: record.unitLabel,
    sector: record.sector,
    meterIndex: record.meterIndex,
    totalMeters: record.totalMeters,
    fileName: record.fileName,
    hasPhoto: Boolean(record.photoBlob),
    issueNote: record.issueNote,
    capturedAt: record.capturedAt,
    width: record.width,
    height: record.height,
  };
}

export class FotoHidroDatabase extends Dexie {
  condos!: Table<CondoStructure, string>;
  campaigns!: Table<PhotoCampaign, string>;
  records!: Table<PhotoRecord, string>;
  recordMetas!: Table<PhotoRecordMeta, string>;

  constructor() {
    super('FotoHidroLuxorDB');
    this.version(1).stores({
      condos: 'id, name, updatedAt',
      campaigns: 'id, condoId, createdAt, updatedAt',
      records: 'id, campaignId, condoId, targetId, unitId, sector, capturedAt',
    });

    this.version(2)
      .stores({
        condos: 'id, name, updatedAt',
        campaigns: 'id, condoId, createdAt, updatedAt',
        records: 'id, campaignId, condoId, targetId, unitId, sector, capturedAt',
        recordMetas: 'id, campaignId, condoId, targetId, unitId, sector, capturedAt',
      })
      .upgrade(async (tx) => {
        const allRecords = await tx.table<PhotoRecord>('records').toArray();
        if (allRecords.length > 0) {
          await tx.table<PhotoRecordMeta>('recordMetas').bulkPut(allRecords.map(toRecordMeta));
        }
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
  await db.transaction('rw', db.campaigns, db.records, db.recordMetas, async () => {
    await db.records.where('campaignId').equals(campaignId).delete();
    await db.recordMetas.where('campaignId').equals(campaignId).delete();
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
  const id = `${campaignId}:${target.targetId}`;
  const existing = await db.records.get(id);

  const record: PhotoRecord = {
    id,
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

  await db.transaction('rw', db.records, db.recordMetas, db.campaigns, async () => {
    await db.records.put(record);
    await db.recordMetas.put(toRecordMeta(record));
    await db.campaigns.update(campaignId, { updatedAt: now });
  });

  return record;
}

export async function deletePhotoRecord(campaignId: string, targetId: string): Promise<void> {
  const id = `${campaignId}:${targetId}`;
  await db.transaction('rw', db.records, db.recordMetas, async () => {
    await db.records.delete(id);
    await db.recordMetas.delete(id);
  });
}

export async function getPhotoRecordById(id: string): Promise<PhotoRecord | undefined> {
  return db.records.get(id);
}

export async function getCampaignPhotoRecords(campaignId: string): Promise<PhotoRecord[]> {
  return db.records.where('campaignId').equals(campaignId).toArray();
}
