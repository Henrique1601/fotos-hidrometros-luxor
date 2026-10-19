import React, { useRef, useState } from 'react';
import { Upload, X, CheckCircle, AlertTriangle, Images } from 'lucide-react';
import { CondoStructure, PhotoCampaign } from '../types';
import { expandUnitsToMeterTargets } from '../data/luxorLutecia';
import { db, savePhotoRecord } from '../db/database';

interface ImportBatchPhotosModalProps {
  condo: CondoStructure;
  campaigns: PhotoCampaign[];
  onSuccess: (msg: string) => void;
  onClose: () => void;
}

export function normalizeBatchFileName(name: string): string {
  let base = name.trim().toLowerCase();
  // remove extension
  const lastDot = base.lastIndexOf('.');
  if (lastDot > 0) {
    base = base.substring(0, lastDot);
  }
  base = base.replace(/\s*-\s*/g, '-').replace(/\s+/g, '_');

  if (base === 'cafe') return 'Cafe';
  if (base === 'bem_barato') return 'Bem_Barato';
  if (base === 'estacionamento') return 'Estacionamento-1';
  if (base.startsWith('estacio') && base.includes('2')) return 'Estacionamento-2';
  if (base.startsWith('estacionamento') && base.includes('3')) return 'Estacionamento-3';
  if (base.startsWith('estacionamento') && base.includes('4')) return 'Estacionamento-4';
  if (base === 'bb-1') return 'Banco_do_Brasil-1';
  if (base === 'bb-2') return 'Banco_do_Brasil-2';

  return base;
}

export const ImportBatchPhotosModal: React.FC<ImportBatchPhotosModalProps> = ({
  condo,
  campaigns,
  onSuccess,
  onClose,
}) => {
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>(
    campaigns[0]?.id || 'new'
  );
  const [newCampaignName, setNewCampaignName] = useState('Medição 10/2026');
  const [newMonth, setNewMonth] = useState(10);
  const [newYear, setNewYear] = useState(2026);
  const [progress, setProgress] = useState<{ current: number; total: number; status: string } | null>(
    null
  );
  const [logs, setLogs] = useState<string[]>([]);
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const filesInputRef = useRef<HTMLInputElement | null>(null);

  const targets = expandUnitsToMeterTargets(condo.units);
  const targetsMap = new Map(targets.map((t) => [t.targetId.toLowerCase(), t]));

  const processFileList = async (files: FileList | File[]) => {
    if (!files || files.length === 0) return;

    setProgress({ current: 0, total: files.length, status: 'Iniciando importação...' });
    const logList: string[] = [];

    try {
      let targetCampaignId = selectedCampaignId;

      if (targetCampaignId === 'new') {
        const now = Date.now();
        const camp: PhotoCampaign = {
          id: `camp-${now}-${Math.random().toString(36).slice(2, 7)}`,
          condoId: condo.id,
          condoName: condo.name,
          name: newCampaignName.trim() || `Medição ${String(newMonth).padStart(2, '0')}/${newYear}`,
          month: newMonth,
          year: newYear,
          createdAt: now,
          updatedAt: now,
        };
        await db.campaigns.add(camp);
        targetCampaignId = camp.id;
        logList.push(`Campanha "${camp.name}" criada com sucesso.`);
      }

      const fileArray = Array.from(files).filter(
        (f) => !f.name.endsWith('Thumbs.db') && !f.name.startsWith('.')
      );

      // Prioritize .jpg over older .jpeg if duplicates
      const targetToFileMap = new Map<string, File>();
      for (const file of fileArray) {
        const norm = normalizeBatchFileName(file.name).toLowerCase();
        if (!targetToFileMap.has(norm)) {
          targetToFileMap.set(norm, file);
        } else {
          const prev = targetToFileMap.get(norm)!;
          if (file.lastModified > prev.lastModified || file.size > prev.size) {
            targetToFileMap.set(norm, file);
          }
        }
      }

      let importedCount = 0;
      let skippedCount = 0;
      const totalToProcess = targetToFileMap.size;
      let idx = 0;

      for (const [normKey, file] of targetToFileMap.entries()) {
        idx++;
        const target = targetsMap.get(normKey);

        if (!target) {
          skippedCount++;
          logList.push(`Ignorado: "${file.name}" (não corresponde a nenhum hidrômetro do condomínio).`);
          continue;
        }

        setProgress({
          current: idx,
          total: totalToProcess,
          status: `Gravando hidrômetro ${target.targetId} (${idx}/${totalToProcess})...`,
        });

        await savePhotoRecord(targetCampaignId, condo.id, target, file);
        importedCount++;
      }

      logList.push(`Finalizado! ${importedCount} fotos vinculadas com sucesso aos medidores.`);
      setLogs(logList);
      setProgress(null);
      onSuccess(`Sucesso! ${importedCount} fotos do mês ${newMonth}/${newYear} foram importadas para o app.`);
      onClose();
    } catch (err) {
      setProgress(null);
      const msg = err instanceof Error ? err.message : 'Erro ao importar fotos.';
      logList.push(`ERRO: ${msg}`);
      setLogs(logList);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" style={{ maxWidth: '600px' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3 className="modal-title">Subir Fotos da Medição</h3>
            <p className="modal-subtitle">
              Importe as fotos já tiradas (ex: pasta de rede ou dispositivo) e associe aos hidrômetros automaticamente
            </p>
          </div>
          <button className="icon-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', margin: '14px 0' }}>
          <div className="form-group">
            <label>Destino da Medição</label>
            <select
              className="select-field"
              value={selectedCampaignId}
              onChange={(e) => setSelectedCampaignId(e.target.value)}
              disabled={!!progress}
            >
              <option value="new">+ Criar Nova Campanha de Medição</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({String(c.month).padStart(2, '0')}/{c.year})
                </option>
              ))}
            </select>
          </div>

          {selectedCampaignId === 'new' && (
            <div className="form-row-grid">
              <div className="form-group">
                <label>Mês</label>
                <input
                  type="number"
                  className="input-field"
                  min={1}
                  max={12}
                  value={newMonth}
                  onChange={(e) => setNewMonth(Number(e.target.value))}
                  disabled={!!progress}
                />
              </div>
              <div className="form-group">
                <label>Ano</label>
                <input
                  type="number"
                  className="input-field"
                  value={newYear}
                  onChange={(e) => setNewYear(Number(e.target.value))}
                  disabled={!!progress}
                />
              </div>
              <div className="form-group">
                <label>Nome</label>
                <input
                  type="text"
                  className="input-field"
                  value={newCampaignName}
                  onChange={(e) => setNewCampaignName(e.target.value)}
                  disabled={!!progress}
                />
              </div>
            </div>
          )}

          <div
            className="import-box"
            style={{ padding: '24px', cursor: progress ? 'not-allowed' : 'pointer' }}
            onClick={() => !progress && filesInputRef.current?.click()}
          >
            <Images size={40} className="cyan-icon" />
            <p className="import-box-title" style={{ marginTop: '10px' }}>
              {progress ? progress.status : 'Clique para selecionar as fotos'}
            </p>
            <span className="import-box-hint">
              Reconhece automaticamente: 501.jpg, 502-1.jpg, bb - 1.jpg, cafe.jpg, estacionamento...
            </span>

            {progress && (
              <div style={{ width: '100%', marginTop: '14px' }}>
                <div className="progress-bar-track">
                  <div
                    className="progress-bar-fill"
                    style={{
                      width: `${Math.round((progress.current / Math.max(1, progress.total)) * 100)}%`,
                    }}
                  />
                </div>
                <div style={{ textAlign: 'center', marginTop: '6px', fontSize: '0.85rem', color: '#94a3b8' }}>
                  {progress.current} de {progress.total} arquivos processados
                </div>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn-primary btn-sm"
              style={{ backgroundColor: '#0284c7', borderColor: '#38bdf8' }}
              disabled={!!progress}
              onClick={async () => {
                setProgress({ current: 0, total: 200, status: 'Carregando medição 10/2026 local...' });
                try {
                  const resp = await fetch('/fotos-10-2026/manifest.json');
                  if (!resp.ok) throw new Error('Pasta local /fotos-10-2026 não encontrada.');
                  const items = (await resp.json()) as Array<{ targetId: string; file: string }>;

                  let targetCampaignId = selectedCampaignId;
                  if (targetCampaignId === 'new') {
                    const now = Date.now();
                    const camp: PhotoCampaign = {
                      id: `camp-luxor-10-2026`,
                      condoId: condo.id,
                      condoName: condo.name,
                      name: newCampaignName.trim() || `Medição 10/2026 (Outubro)`,
                      month: 10,
                      year: 2026,
                      createdAt: now,
                      updatedAt: now,
                    };
                    await db.campaigns.put(camp);
                    targetCampaignId = camp.id;
                  }

                  let count = 0;
                  for (let i = 0; i < items.length; i++) {
                    const it = items[i];
                    const target = targetsMap.get(it.targetId.toLowerCase());
                    if (!target) continue;

                    setProgress({
                      current: i + 1,
                      total: items.length,
                      status: `Importando hidrômetro ${target.targetId} (${i + 1}/${items.length})...`,
                    });

                    const imgResp = await fetch(`/fotos-10-2026/${it.file}`);
                    const blob = await imgResp.blob();
                    await savePhotoRecord(targetCampaignId, condo.id, target, blob);
                    count++;
                  }

                  setProgress(null);
                  onSuccess(`Sucesso! ${count} fotos da Medição 10/2026 carregadas no app!`);
                  onClose();
                } catch (e) {
                  setProgress(null);
                  alert(e instanceof Error ? e.message : 'Erro ao carregar medição local');
                }
              }}
            >
              ⚡ Carregar Medição 10/2026 (200 Fotos Prontas)
            </button>
            <button
              type="button"
              className="btn-secondary btn-sm"
              disabled={!!progress}
              onClick={() => folderInputRef.current?.click()}
            >
              📁 Selecionar Outra Pasta
            </button>
            <button
              type="button"
              className="btn-secondary btn-sm"
              disabled={!!progress}
              onClick={() => filesInputRef.current?.click()}
            >
              📸 Selecionar Arquivos
            </button>
          </div>

          {/* Hidden folder input */}
          <input
            ref={folderInputRef}
            type="file"
            // @ts-expect-error webkitdirectory is standard in browsers
            webkitdirectory="true"
            directory="true"
            multiple
            style={{ display: 'none' }}
            onChange={(e) => e.target.files && processFileList(e.target.files)}
          />

          {/* Hidden multiple files input */}
          <input
            ref={filesInputRef}
            type="file"
            accept="image/*,.jpg,.jpeg,.png,.webp"
            multiple
            style={{ display: 'none' }}
            onChange={(e) => e.target.files && processFileList(e.target.files)}
          />

          {logs.length > 0 && (
            <div
              style={{
                maxHeight: '130px',
                overflowY: 'auto',
                fontSize: '0.78rem',
                backgroundColor: 'rgba(0,0,0,0.3)',
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid #334155',
                color: '#cbd5e1',
              }}
            >
              {logs.map((l, i) => (
                <div key={i}>{l}</div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
