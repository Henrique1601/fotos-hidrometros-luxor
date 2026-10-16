import React, { useEffect, useRef, useState } from 'react';
import {
  Camera,
  ChevronLeft,
  ChevronRight,
  Download,
  Flashlight,
  RefreshCw,
  Upload,
  X,
  CheckCircle2,
} from 'lucide-react';
import { MeterTarget, PhotoRecord } from '../types';
import {
  captureHighResFrame,
  getTrackCapabilities,
  openHighResCameraStream,
  setCameraTorch,
  setCameraZoom,
  triggerHapticFeedback,
} from '../lib/camera';
import {
  getAutoDownloadPreference,
  setAutoDownloadPreference,
  triggerImmediatePhotoDownload,
} from '../lib/immediateDownload';

interface CameraModalProps {
  targets: MeterTarget[];
  currentIndex: number;
  recordsMap: Map<string, PhotoRecord>;
  onSelectIndex: (idx: number) => void;
  onCapturePhoto: (target: MeterTarget, blob: Blob, dims?: { width: number; height: number }) => Promise<void>;
  onClose: () => void;
  onNotify: (msg: string) => void;
}

export const CameraModal: React.FC<CameraModalProps> = ({
  targets,
  currentIndex,
  recordsMap,
  onSelectIndex,
  onCapturePhoto,
  onClose,
  onNotify,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [zoomRange, setZoomRange] = useState({ min: 1, max: 1, step: 0.1 });
  const [autoDownload, setAutoDownload] = useState<boolean>(() => getAutoDownloadPreference());
  const [autoAdvance, setAutoAdvance] = useState<boolean>(true);
  const [isShooting, setIsShooting] = useState(false);
  const [flashEffect, setFlashEffect] = useState(false);
  const [lastShotTargetIndex, setLastShotTargetIndex] = useState<number | null>(null);

  const currentTarget = targets[currentIndex] || targets[0];
  const isAlreadyCaptured = currentTarget ? recordsMap.has(currentTarget.targetId) : false;

  useEffect(() => {
    let mounted = true;

    async function initCamera() {
      setCameraError(null);
      try {
        const stream = await openHighResCameraStream();
        if (!mounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        const caps = getTrackCapabilities(stream);
        setHasTorch(caps.hasTorch);
        setZoomRange({ min: caps.minZoom, max: caps.maxZoom, step: caps.stepZoom });
        setZoom(caps.minZoom);
        setCameraReady(true);
      } catch {
        if (mounted) {
          setCameraError(
            'Câmera ao vivo indisponível neste navegador/permissão. Use o botão "Câmera do Sistema" abaixo.'
          );
        }
      }
    }

    initCamera();

    return () => {
      mounted = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, []);

  const handleToggleTorch = async () => {
    const next = !torchOn;
    const ok = await setCameraTorch(streamRef.current, next);
    setTorchOn(ok ? next : false);
  };

  const handleZoomChange = async (val: number) => {
    setZoom(val);
    await setCameraZoom(streamRef.current, val);
  };

  const handleToggleAutoDownload = () => {
    const next = !autoDownload;
    setAutoDownload(next);
    setAutoDownloadPreference(next);
    onNotify(
      next
        ? 'Download imediato ATIVADO (baixa .jpg na hora da foto)'
        : 'Download imediato PAUSADO (salva apenas no app)'
    );
  };

  const processCapturedBlob = async (blob: Blob, dims?: { width: number; height: number }) => {
    if (!currentTarget) return;

    triggerHapticFeedback(50);
    setFlashEffect(true);
    setTimeout(() => setFlashEffect(false), 180);

    // 1. Salva no IndexedDB local
    await onCapturePhoto(currentTarget, blob, dims);

    // 2. Se Auto-Download estiver ativo, baixa imediatamente com o nome exato da sala/medidor!
    if (autoDownload) {
      triggerImmediatePhotoDownload(blob, currentTarget.fileName);
    }

    setLastShotTargetIndex(currentIndex);
    onNotify(
      autoDownload
        ? `📸 Salva e baixada: ${currentTarget.fileName}`
        : `📸 Foto salva: ${currentTarget.fileName}`
    );

    // 3. Auto-avança para o próximo medidor/sala
    if (autoAdvance && currentIndex < targets.length - 1) {
      onSelectIndex(currentIndex + 1);
    }
  };

  const handleShutterClick = async () => {
    if (!currentTarget || isShooting) return;
    if (!videoRef.current || !cameraReady) {
      fileInputRef.current?.click();
      return;
    }

    setIsShooting(true);
    try {
      const { blob, width, height } = await captureHighResFrame(videoRef.current, 0.96);
      await processCapturedBlob(blob, { width, height });
    } catch {
      onNotify('Erro ao capturar foto. Tente novamente.');
    } finally {
      setIsShooting(false);
    }
  };

  const handleFallbackFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentTarget) return;
    setIsShooting(true);
    try {
      await processCapturedBlob(file);
    } finally {
      setIsShooting(false);
      e.target.value = '';
    }
  };

  if (!currentTarget) return null;

  // Define cor de destaque conforme PDF (1 medidor = Ciano, 2 medidores = Amarelo, 4 medidores = Azul)
  const meterBadgeClass =
    currentTarget.totalMeters === 2
      ? 'meter-badge-yellow'
      : currentTarget.totalMeters >= 4
      ? 'meter-badge-blue'
      : 'meter-badge-cyan';

  return (
    <div className="camera-overlay-fullscreen">
      {flashEffect && <div className="camera-flash-layer" />}

      {/* Barra Superior */}
      <div className="camera-top-bar">
        <button className="icon-btn" onClick={onClose} title="Fechar câmera">
          <X size={22} />
        </button>

        <div className="camera-top-Controls">
          <button
            className={`pill-toggle ${autoDownload ? 'active-cyan' : ''}`}
            onClick={handleToggleAutoDownload}
            title="Baixar foto automaticamente ao disparar"
          >
            <Download size={15} />
            <span>Auto-Baixar: {autoDownload ? 'ON' : 'OFF'}</span>
          </button>

          <button
            className={`pill-toggle ${autoAdvance ? 'active-cyan' : ''}`}
            onClick={() => setAutoAdvance(!autoAdvance)}
            title="Avançar automaticamente para a próxima sala"
          >
            <span>Auto-Avanço: {autoAdvance ? 'ON' : 'OFF'}</span>
          </button>

          {hasTorch && (
            <button
              className={`icon-btn ${torchOn ? 'torch-active' : ''}`}
              onClick={handleToggleTorch}
              title="Lanterna (Flash)"
            >
              <Flashlight size={20} />
            </button>
          )}
        </div>
      </div>

      {/* Card de Identificação da Sala e Medidor */}
      <div className="camera-unit-hud">
        <div className="hud-sector-row">
          <span className="hud-sector-tag">{currentTarget.sector}</span>
          <span className="hud-progress-counter">
            {currentIndex + 1} / {targets.length}
          </span>
        </div>

        <div className="hud-main-row">
          <button
            className="hud-nav-btn"
            disabled={currentIndex <= 0}
            onClick={() => onSelectIndex(currentIndex - 1)}
          >
            <ChevronLeft size={26} />
          </button>

          <div className="hud-center-info">
            <div className="hud-unit-title">
              Sala {currentTarget.unitLabel}
              {isAlreadyCaptured && (
                <CheckCircle2 size={20} className="captured-check-icon" />
              )}
            </div>
            <div className={`hud-meter-pill ${meterBadgeClass}`}>
              {currentTarget.totalMeters === 1
                ? '1 MEDIDOR (ÚNICO)'
                : `${currentTarget.totalMeters} MEDIDORES • FOTO ${currentTarget.meterIndex} DE ${currentTarget.totalMeters}`}
            </div>
            <div className="hud-filename-tag">
              📥 Arquivo: <strong>{currentTarget.fileName}</strong>
            </div>
          </div>

          <button
            className="hud-nav-btn"
            disabled={currentIndex >= targets.length - 1}
            onClick={() => onSelectIndex(currentIndex + 1)}
          >
            <ChevronRight size={26} />
          </button>
        </div>
      </div>

      {/* Visor de Vídeo */}
      <div className="camera-video-Viewport">
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className="camera-video-element"
        />

        {/* Guia de enquadramento do hidrômetro */}
        <div className="camera-aim-frame">
          <div className="aim-corner tl" />
          <div className="aim-corner tr" />
          <div className="aim-corner bl" />
          <div className="aim-corner br" />
        </div>

        {cameraError && (
          <div className="camera-fallback-banner">
            <p>{cameraError}</p>
            <button
              className="btn-primary"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={18} /> Abrir Câmera do Celular / Enviar Foto
            </button>
          </div>
        )}
      </div>

      {/* Controle de Zoom (se suportado pelo hardware) */}
      {zoomRange.max > zoomRange.min && (
        <div className="camera-zoom-bar">
          <span>Zoom {zoom.toFixed(1)}x</span>
          <input
            type="range"
            min={zoomRange.min}
            max={zoomRange.max}
            step={zoomRange.step}
            value={zoom}
            onChange={(e) => handleZoomChange(parseFloat(e.target.value))}
          />
        </div>
      )}

      {/* Barra Inferior de Disparo */}
      <div className="camera-bottom-bar">
        <div className="bottom-side-slot">
          {lastShotTargetIndex !== null && lastShotTargetIndex !== currentIndex && (
            <button
              className="retake-last-btn"
              onClick={() => onSelectIndex(lastShotTargetIndex)}
              title="Voltar para refazer a última foto batida"
            >
              <RefreshCw size={16} />
              <span>Refazer {targets[lastShotTargetIndex]?.targetId}</span>
            </button>
          )}
        </div>

        <button
          className="shutter-button"
          onClick={handleShutterClick}
          disabled={isShooting}
          aria-label="Disparar foto"
        >
          <div className="shutter-inner">
            <Camera size={28} />
          </div>
        </button>

        <div className="bottom-side-slot right">
          <button
            className="fallback-trigger-btn"
            onClick={() => fileInputRef.current?.click()}
            title="Usar câmera nativa do sistema ou galeria"
          >
            <Upload size={16} />
            <span>Nativa</span>
          </button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={handleFallbackFile}
      />
    </div>
  );
};
