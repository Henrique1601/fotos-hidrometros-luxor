import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { CondoStructure, CondoUnit } from '../types';
import { sanitizeUnitForFileName } from '../data/luxorLutecia';

/**
 * Infere o setor / andar a partir do nome da sala se não for informado.
 * Ex: "501" -> { sector: "5º Andar", floorOrder: 5 }
 * Ex: "1023" -> { sector: "10º Andar", floorOrder: 10 }
 * Ex: "Café" -> { sector: "Lojas / Comum", floorOrder: 99 }
 */
export function inferSectorFromUnit(unitLabel: string, explicitSector?: string): {
  sector: string;
  floorOrder: number;
} {
  if (explicitSector && explicitSector.trim()) {
    const clean = explicitSector.trim();
    const numMatch = clean.match(/\d+/);
    return {
      sector: clean,
      floorOrder: numMatch ? parseInt(numMatch[0], 10) : 50,
    };
  }

  const trimmed = unitLabel.trim();
  if (/^\d{3,4}$/.test(trimmed)) {
    const num = parseInt(trimmed, 10);
    const floor = Math.floor(num / 100);
    if (floor >= 1 && floor <= 50) {
      return {
        sector: `${floor}º Andar`,
        floorOrder: floor,
      };
    }
  }

  return {
    sector: 'Lojas / Comum',
    floorOrder: 99,
  };
}

/**
 * Faz o parse de uma planilha Excel (.xlsx / .csv) e retorna uma estrutura de condomínio (CondoStructure).
 * Suporta:
 * 1) Formato em linhas: Colunas "Sala"/"Unidade"/"Apartamento", "Medidores" (opcional, padrão 1), "Andar"/"Setor"/"Torre" (opcional)
 * 2) Formato agrupado: Coluna "Torre"/"Setor"/"Andar" e Coluna "Apartamentos"/"Salas" (separados por vírgula)
 */
export function parseCondoExcelBuffer(buffer: ArrayBuffer, condoName: string): CondoStructure {
  const workbook = XLSX.read(buffer, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error('A planilha enviada está vazia.');
  }

  const sheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });

  if (rows.length === 0) {
    throw new Error('Nenhuma linha encontrada na planilha.');
  }

  const units: CondoUnit[] = [];
  const sectorsSet = new Set<string>();
  let orderIndex = 0;

  for (const row of rows) {
    // Normaliza chaves da linha
    const normEntries = Object.entries(row).map(([k, v]) => [
      k.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase(),
      String(v ?? '').trim(),
    ] as const);
    const map = Object.fromEntries(normEntries);

    const sectorVal =
      map['setor'] ||
      map['andar'] ||
      map['torre'] ||
      map['bloco'] ||
      map['pavimento'] ||
      '';

    // Caso 1: Formato agrupado (ex: coluna "apartamentos" ou "salas" com vírgulas)
    const groupedList = map['apartamentos'] || map['salas'] || map['unidades_lista'] || '';
    if (groupedList && groupedList.includes(',')) {
      const items = groupedList
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      for (const item of items) {
        const { sector, floorOrder } = inferSectorFromUnit(item, sectorVal);
        sectorsSet.add(sector);
        units.push({
          id: sanitizeUnitForFileName(item) || `unit-${orderIndex}`,
          label: item,
          sector,
          floorOrder,
          metersCount: 1,
          orderIndex: orderIndex++,
        });
      }
      continue;
    }

    // Caso 2: Formato linha por unidade
    const unitLabel =
      map['sala'] ||
      map['unidade'] ||
      map['unidades'] ||
      map['apartamento'] ||
      map['apto'] ||
      map['conjunto'] ||
      map['nome'] ||
      '';

    if (!unitLabel || unitLabel.toLowerCase() === 'total') {
      continue;
    }

    const metersRaw =
      map['medidores'] ||
      map['qtd_medidores'] ||
      map['hidrometros'] ||
      map['quantidade'] ||
      '1';
    const parsedMeters = parseInt(metersRaw, 10);
    const metersCount = !isNaN(parsedMeters) && parsedMeters >= 1 && parsedMeters <= 10 ? parsedMeters : 1;

    const { sector, floorOrder } = inferSectorFromUnit(unitLabel, sectorVal);
    sectorsSet.add(sector);

    units.push({
      id: sanitizeUnitForFileName(unitLabel) || `unit-${orderIndex}`,
      label: unitLabel,
      sector,
      floorOrder,
      metersCount,
      orderIndex: orderIndex++,
    });
  }

  if (units.length === 0) {
    throw new Error(
      'Não foi possível identificar as salas/unidades. Certifique-se de ter uma coluna chamada "Sala" ou "Unidade".'
    );
  }

  const now = Date.now();
  return {
    id: `condo-${now}-${Math.random().toString(36).slice(2, 6)}`,
    name: condoName.trim() || 'Novo Condomínio',
    createdAt: now,
    updatedAt: now,
    sectors: Array.from(sectorsSet),
    units,
  };
}

/**
 * Gera e baixa uma planilha modelo (.xlsx) pronta para o usuário preencher novos prédios.
 */
export function downloadCondoExcelTemplate(): void {
  const sampleData = [
    { Setor: '5º Andar', Sala: '501', Medidores: 1 },
    { Setor: '5º Andar', Sala: '502', Medidores: 2 },
    { Setor: '5º Andar', Sala: '503', Medidores: 1 },
    { Setor: '6º Andar', Sala: '601', Medidores: 2 },
    { Setor: '6º Andar', Sala: '603', Medidores: 1 },
    { Setor: 'Lojas / Comum', Sala: 'Café', Medidores: 1 },
    { Setor: 'Lojas / Comum', Sala: 'Estacionamento', Medidores: 4 },
  ];

  const ws = XLSX.utils.json_to_sheet(sampleData);
  ws['!cols'] = [{ wch: 18 }, { wch: 18 }, { wch: 14 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Salas_Medidores');

  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([out], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  saveAs(blob, 'modelo-importacao-salas-hidrometros.xlsx');
}
