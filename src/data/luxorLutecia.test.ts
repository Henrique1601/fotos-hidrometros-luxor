import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import {
  LUXOR_LUTECIA_CONDO,
  LUXOR_LUTECIA_TARGETS,
  buildMeterFileName,
} from './luxorLutecia';
import { parseCondoExcelBuffer } from '../lib/excelImport';
import {
  getAutoDownloadPreference,
  setAutoDownloadPreference,
} from '../lib/immediateDownload';

describe('Luxor e Lutécia — Mapeamento Oficial de Salas e Medidores', () => {
  it('possui exatamente 140 unidades e 205 medidores conforme o PDF da HydroJEXE', () => {
    expect(LUXOR_LUTECIA_CONDO.units.length).toBe(140);
    expect(LUXOR_LUTECIA_TARGETS.length).toBe(205);
  });

  it('valida a contagem de medidores por pavimento do PDF', () => {
    const bySector = (sector: string) =>
      LUXOR_LUTECIA_TARGETS.filter((t) => t.sector === sector).length;

    expect(bySector('5º Andar')).toBe(30);
    expect(bySector('6º Andar')).toBe(34);
    expect(bySector('7º Andar')).toBe(32);
    expect(bySector('8º Andar')).toBe(33);
    expect(bySector('9º Andar')).toBe(34);
    expect(bySector('10º Andar')).toBe(34);
    expect(bySector('Lojas / Comum')).toBe(8);
  });

  it('gera a nomenclatura exata de download imediato (.jpg) para 1, 2 e 4 medidores', () => {
    expect(buildMeterFileName('501', 1, 1)).toBe('501.jpg');
    expect(buildMeterFileName('502', 1, 2)).toBe('502-1.jpg');
    expect(buildMeterFileName('502', 2, 2)).toBe('502-2.jpg');
    expect(buildMeterFileName('Café', 1, 1)).toBe('Cafe.jpg');
    expect(buildMeterFileName('Bem Barato', 1, 1)).toBe('Bem_Barato.jpg');
    expect(buildMeterFileName('Banco do Brasil', 1, 2)).toBe('Banco_do_Brasil-1.jpg');
    expect(buildMeterFileName('Banco do Brasil', 2, 2)).toBe('Banco_do_Brasil-2.jpg');
    expect(buildMeterFileName('Estacionamento', 4, 4)).toBe('Estacionamento-4.jpg');
  });

  it('importa corretamente planilha Excel de novo prédio com múltiplos medidores', () => {
    const rows = [
      { Setor: '1º Andar', Sala: '101', Medidores: 1 },
      { Setor: '1º Andar', Sala: '102', Medidores: 2 },
      { Setor: 'Térreo', Sala: 'Loja A', Medidores: 4 },
    ];
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Plan1');
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });

    const condo = parseCondoExcelBuffer(buf, 'Edifício Teste');
    expect(condo.name).toBe('Edifício Teste');
    expect(condo.units.length).toBe(3);
    expect(condo.units[1].metersCount).toBe(2);
    expect(condo.units[2].metersCount).toBe(4);
  });

  it('persiste a preferência de download imediato automático', () => {
    expect(getAutoDownloadPreference()).toBe(true);
    setAutoDownloadPreference(false);
    expect(getAutoDownloadPreference()).toBe(false);
    setAutoDownloadPreference(true);
    expect(getAutoDownloadPreference()).toBe(true);
  });
});
