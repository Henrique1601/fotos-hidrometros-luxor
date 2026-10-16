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
 * Solicita acesso à câmera traseira em ALTA DEFINIÇÃO MÁXIMA do sensor.
 */
export async function openHighResCameraStream(): Promise<MediaStream> {
  const constraints: MediaStreamConstraints = {
    audio: false,
    video: {
      facingMode: { ideal: 'environment' },
      width: { ideal: 3840, min: 1280 },
      height: { ideal: 2160, min: 720 },
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
 * Desenha um rodapé discreto e nítido (carimbo/watermark) na imagem com os dados da Sala e Data/Hora.
 */
function drawWatermarkOnCanvas(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  stamp: PhotoStampInfo
): void {
  const barHeight = Math.max(48, Math.round(height * 0.065));
  const yTop = height - barHeight;

  // Fundo escuro translúcido no rodapé
  ctx.fillStyle = 'rgba(7, 24, 34, 0.82)';
  ctx.fillRect(0, yTop, width, barHeight);

  // Linha superior colorida conforme quantidade de medidores
  ctx.fillStyle =
    stamp.totalMeters === 2 ? '#facc15' : stamp.totalMeters >= 4 ? '#38bdf8' : '#5eead4';
  ctx.fillRect(0, yTop, width, Math.max(3, Math.round(barHeight * 0.07)));

  const fontSize = Math.max(16, Math.round(barHeight * 0.38));
  ctx.font = `bold ${fontSize}px sans-serif`;
  ctx.textBaseline = 'middle';

  const meterLabel =
    stamp.totalMeters === 1
      ? '1 Medidor'
      : `Medidor ${stamp.meterIndex}/${stamp.totalMeters}`;

  const leftText = `${stamp.condoName} • Sala ${stamp.unitLabel} (${meterLabel})${
    stamp.issueNote ? ` [⚠️ ${stamp.issueNote}]` : ''
  }`;
  const rightText = `${new Date().toLocaleString('pt-BR')} • ${stamp.fileName}`;

  const padX = Math.max(16, Math.round(width * 0.02));
  const centerY = yTop + barHeight / 2 + 2;

  ctx.fillStyle = '#5eead4';
  ctx.textAlign = 'left';
  ctx.fillText(leftText, padX, centerY);

  ctx.fillStyle = '#e2e8f0';
  ctx.textAlign = 'right';
  ctx.fillText(rightText, width - padX, centerY);
}

/**
 * Captura o frame atual do elemento <video> na resolução máxima real do stream,
 * aplicando opcionalmente o carimbo da sala/data e gerando um JPEG de altíssima nitidez (0.96).
 */
export async function captureHighResFrame(
  video: HTMLVideoElement,
  quality = 0.96,
  stamp?: PhotoStampInfo
): Promise<CapturedPhotoResult> {
  const width = video.videoWidth || 1920;
  const height = video.videoHeight || 1080;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
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
