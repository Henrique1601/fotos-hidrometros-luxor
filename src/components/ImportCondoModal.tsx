import React, { useRef, useState } from 'react';
import { Download, FileSpreadsheet, Upload, X } from 'lucide-react';
import { CondoStructure } from '../types';
import { downloadCondoExcelTemplate, parseCondoExcelBuffer } from '../lib/excelImport';

interface ImportCondoModalProps {
  onImported: (condo: CondoStructure) => Promise<void>;
  onClose: () => void;
}

export const ImportCondoModal: React.FC<ImportCondoModalProps> = ({ onImported, onClose }) => {
  const [condoName, setCondoName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setLoading(true);
    try {
      const buffer = await file.arrayBuffer();
      const defaultName = condoName.trim() || file.name.replace(/\.(xlsx|xls|csv)$/i, '');
      const parsed = parseCondoExcelBuffer(buffer, defaultName);
      await onImported(parsed);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao processar planilha.');
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3 className="modal-title">Importar Novo Condomínio / Prédio</h3>
            <p className="modal-subtitle">
              Carregue uma planilha Excel (.xlsx ou .csv) com as salas/apartamentos e quantidade de medidores
            </p>
          </div>
          <button className="icon-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="form-group">
          <label>Nome do Condomínio / Prédio</label>
          <input
            type="text"
            className="input-field"
            placeholder="Ex: Edifício Comercial Paulista"
            value={condoName}
            onChange={(e) => setCondoName(e.target.value)}
          />
        </div>

        <div className="import-box" onClick={() => fileRef.current?.click()}>
          <FileSpreadsheet size={36} className="cyan-icon" />
          <p className="import-box-title">
            {loading ? 'Processando planilha...' : 'Toque para selecionar a planilha (.xlsx / .csv)'}
          </p>
          <span className="import-box-hint">
            Colunas aceitas: <strong>Sala / Unidade</strong>, <strong>Medidores</strong> (1, 2, 4...) e{' '}
            <strong>Setor / Andar</strong>
          </span>
        </div>

        {error && <div className="error-alert">{error}</div>}

        <div className="modal-footer-between">
          <button className="btn-secondary" onClick={downloadCondoExcelTemplate}>
            <Download size={16} /> Baixar Planilha Modelo (.xlsx)
          </button>

          <button className="btn-primary" onClick={() => fileRef.current?.click()}>
            <Upload size={16} /> Escolher Arquivo
          </button>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
      </div>
    </div>
  );
};
