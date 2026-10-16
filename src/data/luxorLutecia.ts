import { CondoStructure, CondoUnit, MeterTarget } from '../types';

/**
 * Sanitiza o identificador da sala para gerar um nome de arquivo limpo e seguro.
 * Ex: "501" -> "501"
 * Ex: "Café" -> "Cafe"
 * Ex: "Bem Barato" -> "Bem_Barato"
 * Ex: "Banco do Brasil" -> "Banco_do_Brasil"
 * Ex: "Estacionamento" -> "Estacionamento"
 */
export function sanitizeUnitForFileName(label: string): string {
  return label
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_-]/g, '');
}

/**
 * Gera o nome exato do arquivo .jpg para download imediato e ZIP.
 * - Se a unidade tem 1 medidor: "501.jpg", "Cafe.jpg", "Bem_Barato.jpg"
 * - Se a unidade tem 2+ medidores: "502-1.jpg", "502-2.jpg", "Banco_do_Brasil-1.jpg", "Estacionamento-4.jpg"
 */
export function buildMeterFileName(unitLabel: string, meterIndex: number, totalMeters: number): string {
  const base = sanitizeUnitForFileName(unitLabel);
  if (totalMeters <= 1) {
    return `${base}.jpg`;
  }
  return `${base}-${meterIndex}.jpg`;
}

/**
 * Gera o identificador único do medidor (targetId).
 * Ex: "501", "502-1", "502-2", "Banco_do_Brasil-1"
 */
export function buildMeterTargetId(unitLabel: string, meterIndex: number, totalMeters: number): string {
  const base = sanitizeUnitForFileName(unitLabel);
  if (totalMeters <= 1) {
    return base;
  }
  return `${base}-${meterIndex}`;
}

/**
 * Expande a lista de unidades (CondoUnit[]) na sequência exata de medidores (MeterTarget[])
 */
export function expandUnitsToMeterTargets(units: CondoUnit[]): MeterTarget[] {
  const targets: MeterTarget[] = [];
  let globalIndex = 0;

  for (const unit of units) {
    const count = Math.max(1, unit.metersCount || 1);
    for (let m = 1; m <= count; m++) {
      targets.push({
        targetId: buildMeterTargetId(unit.label, m, count),
        unitId: unit.id,
        unitLabel: unit.label,
        sector: unit.sector,
        floorOrder: unit.floorOrder,
        meterIndex: m,
        totalMeters: count,
        fileName: buildMeterFileName(unit.label, m, count),
        orderIndex: globalIndex++,
      });
    }
  }

  return targets;
}

/**
 * Definição oficial extraída das 5 páginas do PDF:
 * "Extrato de Consumo Individualizado de Água - Condomínio Luxor e Lutécia - HydroJEXE"
 */
interface RawFloorSpec {
  floor: number;
  sectorLabel: string;
  maxUnit: number;
  twoMetersSet: Set<number>;
}

const LUXOR_FLOORS: RawFloorSpec[] = [
  {
    floor: 5,
    sectorLabel: '5º Andar',
    maxUnit: 21, // 501 a 521
    twoMetersSet: new Set([502, 504, 505, 509, 510, 513, 516, 517, 521]),
  },
  {
    floor: 6,
    sectorLabel: '6º Andar',
    maxUnit: 23, // 601 a 623
    twoMetersSet: new Set([601, 602, 610, 611, 612, 613, 614, 616, 618, 620, 622]),
  },
  {
    floor: 7,
    sectorLabel: '7º Andar',
    maxUnit: 23, // 701 a 723
    twoMetersSet: new Set([701, 702, 710, 711, 712, 713, 714, 720, 722]),
  },
  {
    floor: 8,
    sectorLabel: '8º Andar',
    maxUnit: 23, // 801 a 823
    twoMetersSet: new Set([802, 810, 811, 812, 813, 814, 816, 818, 820, 822]),
  },
  {
    floor: 9,
    sectorLabel: '9º Andar',
    maxUnit: 23, // 901 a 923
    twoMetersSet: new Set([901, 902, 910, 911, 912, 913, 914, 916, 918, 920, 922]),
  },
  {
    floor: 10,
    sectorLabel: '10º Andar',
    maxUnit: 23, // 1001 a 1023
    twoMetersSet: new Set([1001, 1002, 1010, 1011, 1012, 1013, 1014, 1016, 1018, 1020, 1022]),
  },
];

export function buildLuxorLuteciaUnits(): CondoUnit[] {
  const units: CondoUnit[] = [];
  let orderIndex = 0;

  for (const spec of LUXOR_FLOORS) {
    for (let u = 1; u <= spec.maxUnit; u++) {
      const num = spec.floor * 100 + u;
      const label = String(num);
      const metersCount = spec.twoMetersSet.has(num) ? 2 : 1;
      units.push({
        id: label,
        label,
        sector: spec.sectorLabel,
        floorOrder: spec.floor,
        metersCount,
        orderIndex: orderIndex++,
      });
    }
  }

  // Unidades especiais / Lojas / Áreas Comuns (final da pág. 4 e pág. 5 do PDF)
  const specialUnits: Array<{ id: string; label: string; metersCount: number }> = [
    { id: 'Cafe', label: 'Café', metersCount: 1 },
    { id: 'Bem_Barato', label: 'Bem Barato', metersCount: 1 },
    { id: 'Banco_do_Brasil', label: 'Banco do Brasil', metersCount: 2 },
    { id: 'Estacionamento', label: 'Estacionamento', metersCount: 4 },
  ];

  for (const sp of specialUnits) {
    units.push({
      id: sp.id,
      label: sp.label,
      sector: 'Lojas / Comum',
      floorOrder: 11,
      metersCount: sp.metersCount,
      orderIndex: orderIndex++,
    });
  }

  return units;
}

export const LUXOR_LUTECIA_CONDO_ID = 'condo-luxor-lutecia';

export const LUXOR_LUTECIA_CONDO: CondoStructure = {
  id: LUXOR_LUTECIA_CONDO_ID,
  name: 'Luxor e Lutécia',
  adminName: 'NP Administração • HydroJEXE',
  createdAt: 1760000000000,
  updatedAt: 1760000000000,
  isDefault: true,
  sectors: ['5º Andar', '6º Andar', '7º Andar', '8º Andar', '9º Andar', '10º Andar', 'Lojas / Comum'],
  units: buildLuxorLuteciaUnits(),
};

export const LUXOR_LUTECIA_TARGETS: MeterTarget[] = expandUnitsToMeterTargets(LUXOR_LUTECIA_CONDO.units);
