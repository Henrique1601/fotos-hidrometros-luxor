import { saveAs } from 'file-saver';

const AUTO_DOWNLOAD_STORAGE_KEY = 'fotohidro_auto_download_enabled';

/**
 * Lê a preferência de download automático imediato ao bater a foto (Ativo por padrão = true).
 */
export function getAutoDownloadPreference(): boolean {
  try {
    const raw = localStorage.getItem(AUTO_DOWNLOAD_STORAGE_KEY);
    if (raw === null) return true;
    return raw === 'true';
  } catch {
    return true;
  }
}

export function setAutoDownloadPreference(enabled: boolean): void {
  try {
    localStorage.setItem(AUTO_DOWNLOAD_STORAGE_KEY, String(enabled));
  } catch {
    // ignore storage errors
  }
}

/**
 * Dispara o download imediato do arquivo de foto (.jpg) no dispositivo do usuário
 * usando exatamente a nomenclatura da sala/medidor (ex: "501.jpg", "502-1.jpg", "Estacionamento-1.jpg").
 */
export function triggerImmediatePhotoDownload(blob: Blob, fileName: string): void {
  try {
    const cleanName = fileName.endsWith('.jpg') || fileName.endsWith('.jpeg')
      ? fileName
      : `${fileName}.jpg`;

    // Usa elemento <a> nativo para download silencioso e imediato sem bloqueio no mobile
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = cleanName;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 3000);
  } catch {
    // Fallback com file-saver caso ocorra erro no DOM
    saveAs(blob, fileName);
  }
}
