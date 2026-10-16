export type Screen = 'home' | 'collect' | 'checklist' | 'export';

export type SortMode = 'sheet' | 'floor-asc' | 'floor-desc';

/**
 * Representa uma sala/unidade do prédio (ex: Sala 501, Sala 502, Café, Estacionamento).
 * Uma sala pode ter 1, 2 ou 4 medidores (ou qualquer quantidade configurada).
 */
export interface CondoUnit {
  id: string;            // ex: "501", "502", "Cafe", "Estacionamento"
  label: string;         // ex: "501", "502", "Café", "Banco do Brasil"
  sector: string;        // ex: "5º Andar", "6º Andar", ..., "Lojas / Térreo"
  floorOrder: number;    // ex: 5, 6, 7, 8, 9, 10, 0 (Lojas)
  metersCount: number;   // 1 (Branco), 2 (Amarelo), 4 (Azul)
  orderIndex: number;    // Ordem original da planilha / PDF
}

/**
 * Representa cada hidrômetro individual que precisa de 1 foto.
 * Se a Sala 502 tem 2 medidores, gera 2 MeterTargets:
 * - targetId: "502-1", fileName: "502-1.jpg", meterIndex: 1, totalMeters: 2
 * - targetId: "502-2", fileName: "502-2.jpg", meterIndex: 2, totalMeters: 2
 * Se a Sala 501 tem 1 medidor, gera 1 MeterTarget:
 * - targetId: "501", fileName: "501.jpg", meterIndex: 1, totalMeters: 1
 */
export interface MeterTarget {
  targetId: string;      // ex: "501", "502-1", "502-2", "Estacionamento-1"
  unitId: string;        // ex: "501", "502", "Estacionamento"
  unitLabel: string;     // ex: "501", "502", "Estacionamento"
  sector: string;        // ex: "5º Andar", "Lojas / Térreo"
  floorOrder: number;
  meterIndex: number;    // 1..totalMeters
  totalMeters: number;   // 1, 2, 4...
  fileName: string;      // ex: "501.jpg", "502-1.jpg", "Banco_do_Brasil-1.jpg"
  orderIndex: number;
}

export interface CondoStructure {
  id: string;
  name: string;
  adminName?: string;
  createdAt: number;
  updatedAt: number;
  isDefault?: boolean;
  sectors: string[];
  units: CondoUnit[];
}

export interface PhotoCampaign {
  id: string;
  condoId: string;
  condoName: string;
  name: string;
  month: number;         // 1-12
  year: number;          // ex: 2026
  createdAt: number;
  updatedAt: number;
}

export interface PhotoRecord {
  id: string;            // "${campaignId}:${targetId}"
  campaignId: string;
  condoId: string;
  targetId: string;      // ex: "501", "502-1"
  unitId: string;        // ex: "501", "502"
  unitLabel: string;     // ex: "501", "502"
  sector: string;        // ex: "5º Andar"
  meterIndex: number;    // 1, 2, 3, 4
  totalMeters: number;   // 1, 2, 4
  fileName: string;      // ex: "502-1.jpg"
  photoBlob: Blob;
  capturedAt: number;
  width?: number;
  height?: number;
}
