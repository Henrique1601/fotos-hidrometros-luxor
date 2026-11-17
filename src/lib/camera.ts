export interface CapturedPhotoResult {
  blob: Blob;
  width: number;
  height: number;
}

export interface PhotoStampInfo {
  condoName: string;
  unitLabel: string;
  sector: string;
  meterIndex: number;
  totalMeters: number;
  fileName: string;
  issueNote?: string;
}

const WATERMARK_PREF_KEY = 'fotohidro_watermark_enabled';
const TAP_SHUTTER_PREF_KEY = 'fotohidro_tap_shutter_enabled';

export function getWatermarkPreference(): boolean {
  try {
    const raw = localStorage.getItem(WATERMARK_PREF_KEY);
    if (raw === null) return true;
    return raw === 'true';
  } catch {
    return true;
  }
}

export function setWatermarkPreference(enabled: boolean): void {
  try {
    localStorage.setItem(WATERMARK_PREF_KEY, String(enabled));
  } catch {
    // ignore
  }
}

export function getTapShutterPreference(): boolean {
  try {
    const raw = localStorage.getItem(TAP_SHUTTER_PREF_KEY);
    if (raw === null) return false;
    return raw === 'true';
  } catch {
    return false;
  }
}

export function setTapShutterPreference(enabled: boolean): void {
  try {
    localStorage.setItem(TAP_SHUTTER_PREF_KEY, String(enabled));
  } catch {
    // ignore
  }
}

/**
 * Solicita acesso à câmera traseira em Full HD (1920x1080) a 24 FPS.
 * Evita superaquecimento, lentidão no toque e drenagem excessiva de bateria
 * que ocorrem quando o stream ao vivo roda em 4K 60fps.
 */
export async function openHighResCameraStream(): Promise<MediaStream> {
  const constraints: MediaStreamConstraints = {
    audio: false,
    video: {
      facingMode: { ideal: 'environment' },
      width: { ideal: 1920, min: 1280 },
      height: { ideal: 1080, min: 720 },
      frameRate: { ideal: 24, max: 30 },
    },
  };

  try {
    return await navigator.mediaDevices.getUserMedia(constraints);
  } catch {
    return await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: 'environment' },
    });
  }
}

/**
 * Ajusta automaticamente o tamanho da fonte para garantir que o texto caiba
 * perfeitamente dentro de `maxWidth` sem nunca cortar nem sobrepor.
 */
function fitFontSize(
  ctx: CanvasRenderingContext2D,
  text: string,
  initialSize: number,
  minSize: number,
  maxWidth: number,
  weight = 'bold'
): number {
  let size = initialSize;
  while (size > minSize) {
    ctx.font = `${weight} ${size}px sans-serif`;
    if (ctx.measureText(text).width <= maxWidth) {
      return size;
    }
    size -= 1;
  }
  return minSize;
}

/**
 * Desenha um rodapé em 2 linhas separadas (nunca sobrepõe textos, mesmo em fotos verticais estreitas).
 * Linha 1 (Destaque): Sala + Medidor + Condomínio
 * Linha 2 (Metadados): Nome do Arquivo + Data/Hora
 */
export function drawWatermarkOnCanvas(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  stamp: PhotoStampInfo
): void {
  const padX = Math.max(16, Math.round(width * 0.03));
  const maxTextWidth = Math.max(100, width - padX * 2);

  const meterLabel =
    stamp.totalMeters === 1
      ? '1 Medidor'
      : `Medidor ${stamp.meterIndex} de ${stamp.totalMeters}`;

  const line1Text = `Sala ${stamp.unitLabel} (${meterLabel}) • ${stamp.condoName}${
    stamp.issueNote ? ` [⚠️ ${stamp.issueNote}]` : ''
  }`;
  const line2Text = `Arquivo: ${stamp.fileName}  |  ${new Date().toLocaleString('pt-BR')}`;

  // Calcula fontes proporcionais à menor dimensão e garante que caibam na largura
  const baseDim = Math.min(width, height);
  const initialTitleSize = Math.max(16, Math.min(38, Math.round(baseDim * 0.032)));
  const titleFontSize = fitFontSize(ctx, line1Text, initialTitleSize, 12, maxTextWidth, 'bold');

  const initialSubSize = Math.max(13, Math.round(titleFontSize * 0.82));
  const subFontSize = fitFontSize(ctx, line2Text, initialSubSize, 11, maxTextWidth, '600');

  const lineGap = Math.max(6, Math.round(titleFontSize * 0.38));
  const padY = Math.max(10, Math.round(titleFontSize * 0.55));
  const accentHeight = Math.max(4, Math.round(titleFontSize * 0.15));

  const barHeight = accentHeight + padY + titleFontSize + lineGap + subFontSize + padY;
  const yTop = height - barHeight;

  ctx.save();

  // Fundo escuro sólido-translúcido de alto contraste no rodapé
  ctx.fillStyle = 'rgba(7, 24, 34, 0.9)';
  ctx.fillRect(0, yTop, width, barHeight);

  // Faixa superior colorida conforme quantidade de medidores
  const accentColor =
    stamp.totalMeters === 2 ? '#facc15' : stamp.totalMeters >= 4 ? '#38bdf8' : '#5eead4';
  ctx.fillStyle = accentColor;
  ctx.fillRect(0, yTop, width, accentHeight);

  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  // Sombra sutil para leitura cristalina
  ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
  ctx.shadowBlur = 4;
  ctx.shadowOffsetX = 1;
  ctx.shadowOffsetY = 1;

  // Linha 1 (Topo do rodapé)
  const line1Y = yTop + accentHeight + padY;
  ctx.font = `bold ${titleFontSize}px sans-serif`;
  ctx.fillStyle = accentColor;
  ctx.fillText(line1Text, padX, line1Y, maxTextWidth);

  // Linha 2 (Abaixo da Linha 1 — impossível sobrepor)
  const line2Y = line1Y + titleFontSize + lineGap;
  ctx.font = `600 ${subFontSize}px sans-serif`;
  ctx.fillStyle = '#f1f5f9';
  ctx.fillText(line2Text, padX, line2Y, maxTextWidth);

  ctx.restore();
}

/**
 * Captura o frame atual do elemento <video> na resolução máxima real do stream,
 * aplicando opcionalmente o carimbo em 2 linhas e gerando um JPEG de altíssima nitidez (0.96).
 */
export async function captureHighResFrame(
  video: HTMLVideoElement,
  quality = 0.9,
  stamp?: PhotoStampInfo
): Promise<CapturedPhotoResult> {
  const width = video.videoWidth || 1920;
  const height = video.videoHeight || 1080;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) {
    throw new Error('Não foi possível inicializar o contexto 2D da imagem.');
  }

  ctx.drawImage(video, 0, 0, width, height);

  if (stamp) {
    drawWatermarkOnCanvas(ctx, width, height, stamp);
  }

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else reject(new Error('Falha ao converter imagem da câmera.'));
      },
      'image/jpeg',
      quality
    );
  });

  return { blob, width, height };
}

/**
 * Aplica o carimbo de 2 linhas também quando a foto vem da câmera nativa do sistema (<input type="file">).
 */
export async function processUploadedPhotoFile(
  file: Blob,
  quality = 0.96,
  stamp?: PhotoStampInfo
): Promise<CapturedPhotoResult> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const width = img.naturalWidth || img.width || 1920;
      const height = img.naturalHeight || img.height || 1080;

      if (!stamp) {
        URL.revokeObjectURL(url);
        resolve({ blob: file, width, height });
        return;
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        resolve({ blob: file, width, height });
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      drawWatermarkOnCanvas(ctx, width, height, stamp);

      canvas.toBlob(
        (b) => {
          URL.revokeObjectURL(url);
          if (b) resolve({ blob: b, width, height });
          else resolve({ blob: file, width, height });
        },
        'image/jpeg',
        quality
      );
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(err);
    };
    img.src = url;
  });
}

/**
 * Verifica capacidades de hardware da trilha de vídeo (Lanterna / Torch e Zoom).
 */
export function getTrackCapabilities(stream: MediaStream | null): {
  hasTorch: boolean;
  minZoom: number;
  maxZoom: number;
  stepZoom: number;
} {
  if (!stream) return { hasTorch: false, minZoom: 1, maxZoom: 1, stepZoom: 0.1 };
  const track = stream.getVideoTracks()[0];
  if (!track || typeof track.getCapabilities !== 'function') {
    return { hasTorch: false, minZoom: 1, maxZoom: 1, stepZoom: 0.1 };
  }

  const caps = track.getCapabilities() as Record<string, unknown>;
  const hasTorch = Boolean(caps.torch);

  let minZoom = 1;
  let maxZoom = 1;
  let stepZoom = 0.1;

  if (caps.zoom && typeof caps.zoom === 'object') {
    const z = caps.zoom as { min?: number; max?: number; step?: number };
    minZoom = z.min ?? 1;
    maxZoom = z.max ?? 1;
    stepZoom = z.step ?? 0.1;
  }

  return { hasTorch, minZoom, maxZoom, stepZoom };
}

export async function setCameraTorch(stream: MediaStream | null, enabled: boolean): Promise<boolean> {
  if (!stream) return false;
  const track = stream.getVideoTracks()[0];
  if (!track) return false;
  try {
    await track.applyConstraints({
      advanced: [{ torch: enabled } as MediaTrackConstraintSet],
    });
    return enabled;
  } catch {
    return false;
  }
}

export async function setCameraZoom(stream: MediaStream | null, zoom: number): Promise<void> {
  if (!stream) return;
  const track = stream.getVideoTracks()[0];
  if (!track) return;
  try {
    await track.applyConstraints({
      advanced: [{ zoom } as MediaTrackConstraintSet],
    });
  } catch {
    // ignore if unsupported
  }
}

export function triggerHapticFeedback(durationMs = 45): void {
  try {
    if ('vibrate' in navigator) {
      navigator.vibrate(durationMs);
    }
  } catch {
    // ignore
  }
}
