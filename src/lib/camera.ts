export interface CapturedPhotoResult {
  blob: Blob;
  width: number;
  height: number;
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
    // Fallback caso o aparelho não aceite constraints ideais altas
    return await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: 'environment' },
    });
  }
}

/**
 * Captura o frame atual do elemento <video> na resolução máxima real do stream,
 * gerando um JPEG de altíssima nitidez (qualidade 0.96) para leitura perfeita dos dígitos do hidrômetro.
 */
export async function captureHighResFrame(
  video: HTMLVideoElement,
  quality = 0.96
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
