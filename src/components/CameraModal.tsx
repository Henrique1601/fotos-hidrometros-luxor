import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  Flashlight,
  Hand,
  RefreshCw,
  Stamp,
  Upload,
  X,
} from 'lucide-react';
import { MeterTarget, PhotoRecord } from '../types';
import {
  captureHighResFrame,
  getTapShutterPreference,
  getTrackCapabilities,
  getWatermarkPreference,
  openHighResCameraStream,
  setCameraTorch,
  setCameraZoom,
  setTapShutterPreference,
  setWatermarkPreference,
  triggerHapticFeedback,
} from '../lib/camera';
import {
  getAutoDownloadPreference,
  setAutoDownloadPreference,
  triggerImmediatePhotoDownload,
} from '../lib/immediateDownload';

interface CameraModalProps {
  condoName: string;
  targets: MeterTarget[];
  currentIndex: number;
  recordsMap: Map<string, PhotoRecord>;
  onSelectIndex: (idx: number) => void;
  onCapturePhoto: (
    target: MeterTarget,
    blob?: Blob,
    dims?: { width: number; height: number },
    issueNote?: string
  ) => Promise<void>;
  onClose: () => void;
  onNotify: (msg: string) => void;
}

const QUICK_ISSUES = [
  'Sala Fechada / Trancada',
  'Visor Embaçado / Ilegível',
  'Sem Acesso ao Registro',
  'Hidrômetro Danificado',
];

export const CameraModal: React.FC<CameraModalProps> = ({
  condoName,
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
  const [watermarkOn, setWatermarkOn] = useState<boolean>(() => getWatermarkPreference());
  const [tapShutterOn, setTapShutterOn] = useState<boolean>(() => getTapShutterPreference());
  const [autoAdvance, setAutoAdvance] = useState<boolean>(true);
  const [isShooting, setIsShooting] = useState(false);
  const [flashEffect, setFlashEffect] = useState(false);
  const [lastShotTargetIndex, setLastShotTargetIndex] = useState<number | null>(null);
  const [showIssueMenu, setShowIssueMenu] = useState(false);

  const currentTarget = targets[currentIndex] || targets[0];
  const existingRecord = currentTarget ? recordsMap.get(currentTarget.targetId) : undefined;
  const isAlreadyCaptured = Boolean(existingRecord?.photoBlob);

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
    onNotify(next ? 'Auto-Baixar ATIVADO (.jpg na hora)' : 'Auto-Baixar PAUSADO');
  };

  const handleToggleWatermark = () => {
    const next = !watermarkOn;
    setWatermarkOn(next);
    setWatermarkPreference(next);
    onNotify(
      next
        ? 'Carimbo na foto ATIVADO (grava Sala + Data/Hora no rodapé do .jpg)'
        : 'Carimbo na foto DESATIVADO (imagem limpa)'
    );
  };

  const handleToggleTapShutter = () => {
    const next = !tapShutterOn;
    setTapShutterOn(next);
    setTapShutterPreference(next);
    onNotify(
      next
        ? 'Toque na tela ATIVADO: toque em qualquer lugar do vídeo para bater a foto!'
        : 'Toque na tela DESATIVADO: use o botão central para fotografar.'
    );
  };

  const processCapturedBlob = useCallback(
    async (blob: Blob, dims?: { width: number; height: number }, issueNote?: string) => {
      if (!currentTarget) return;

      triggerHapticFeedback(50);
      setFlashEffect(true);
      setTimeout(() => setFlashEffect(false), 180);

      await onCapturePhoto(currentTarget, blob, dims, issueNote);

      if (autoDownload) {
        triggerImmediatePhotoDownload(blob, currentTarget.fileName);
      }

      setLastShotTargetIndex(currentIndex);
      onNotify(
        autoDownload
          ? `📸 Salva e baixada: ${currentTarget.fileName}`
          : `📸 Foto salva: ${currentTarget.fileName}`
      );

      if (autoAdvance && currentIndex < targets.length - 1) {
        onSelectIndex(currentIndex + 1);
      }
    },
    [autoAdvance, autoDownload, currentIndex, currentTarget, onCapturePhoto, onNotify, onSelectIndex, targets.length]
  );

  const handleShutterClick = useCallback(async () => {
    if (!currentTarget || isShooting) return;
    if (!videoRef.current || !cameraReady) {
      fileInputRef.current?.click();
      return;
    }

    setIsShooting(true);
    try {
      const stampInfo = watermarkOn
        ? {
            condoName,
            unitLabel: currentTarget.unitLabel,
            sector: currentTarget.sector,
            meterIndex: currentTarget.meterIndex,
            totalMeters: currentTarget.totalMeters,
            fileName: currentTarget.fileName,
          }
        : undefined;

      const { blob, width, height } = await captureHighResFrame(videoRef.current, 0.96, stampInfo);
      await processCapturedBlob(blob, { width, height });
    } catch {
      onNotify('Erro ao capturar foto. Tente novamente.');
    } finally {
      setIsShooting(false);
    }
  }, [cameraReady, condoName, currentTarget, isShooting, onNotify, processCapturedBlob, watermarkOn]);

  // Suporte a disparo por Tecla de Volume / Espaço / Enter (gatilhos Bluetooth ou uma mão só)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter' || e.key === 'AudioVolumeUp' || e.key === 'AudioVolumeDown') {
        e.preventDefault();
        handleShutterClick();
      } else if (e.key === 'ArrowRight' && currentIndex < targets.length - 1) {
        onSelectIndex(currentIndex + 1);
      } else if (e.key === 'ArrowLeft' && currentIndex > 0) {
        onSelectIndex(currentIndex - 1);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [currentIndex, handleShutterClick, onSelectIndex, targets.length]);

  const handleRegisterIssue = async (reason: string) => {
    if (!currentTarget) return;
    triggerHapticFeedback(35);
    await onCapturePhoto(currentTarget, undefined, undefined, reason);
    setShowIssueMenu(false);
    onNotify(`⚠️ Ocorrência registrada em Sala ${currentTarget.unitLabel}: ${reason}`);
    if (autoAdvance && currentIndex < targets.length - 1) {
      onSelectIndex(currentIndex + 1);
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
            <Download size={14} />
            <span>Auto-Baixar: {autoDownload ? 'ON' : 'OFF'}</span>
          </button>

          <button
            className={`pill-toggle ${watermarkOn ? 'active-cyan' : ''}`}
            onClick={handleToggleWatermark}
            title="Gravar Sala e Data/Hora no rodapé da imagem .jpg"
          >
            <Stamp size={14} />
            <span>Carimbo: {watermarkOn ? 'ON' : 'OFF'}</span>
          </button>

          <button
            className={`pill-toggle ${tapShutterOn ? 'active-cyan' : ''}`}
            onClick={handleToggleTapShutter}
            title="Tocar no vídeo para disparar a foto com uma mão só"
          >
            <Hand size={14} />
            <span>Toque p/ Foto: {tapShutterOn ? 'ON' : 'OFF'}</span>
          </button>

          {hasTorch && (
            <button
              className={`icon-btn ${torchOn ? 'torch-active' : ''}`}
              onClick={handleToggleTorch}
              title="Lanterna (Flash)"
            >
              <Flashlight size={19} />
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
              {isAlreadyCaptured && <CheckCircle2 size={20} className="captured-check-icon" />}
            </div>
            <div className={`hud-meter-pill ${meterBadgeClass}`}>
              {currentTarget.totalMeters === 1
                ? '1 MEDIDOR (ÚNICO)'
                : `${currentTarget.totalMeters} MEDIDORES • FOTO ${currentTarget.meterIndex} DE ${currentTarget.totalMeters}`}
            </div>
            <div className="hud-filename-tag">
              📥 Arquivo: <strong>{currentTarget.fileName}</strong>
              {existingRecord?.issueNote && (
                <span className="hud-issue-tag"> • ⚠️ {existingRecord.issueNote}</span>
              )}
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
      <div
        className="camera-video-Viewport"
        onClick={() => {
          if (tapShutterOn && cameraReady) {
            handleShutterClick();
          }
        }}
      >
        <video ref={videoRef} playsInline muted autoPlay className="camera-video-element" />

        <div className="camera-aim-frame">
          <div className="aim-corner tl" />
          <div className="aim-corner tr" />
          <div className="aim-corner bl" />
          <div className="aim-corner br" />
          {tapShutterOn && (
            <span className="tap-anywhere-hint">Toque no visor para fotografar</span>
          )}
        </div>

        {/* Menu rápido de Ocorrência / Sala Fechada */}
        {showIssueMenu && (
          <div className="camera-issue-popup" onClick={(e) => e.stopPropagation()}>
            <div className="issue-popup-header">
              <span>⚠️ Registrar Ocorrência — Sala {currentTarget.unitLabel}</span>
              <button className="icon-btn" onClick={() => setShowIssueMenu(false)}>
                <X size={16} />
              </button>
            </div>
            <div className="issue-options-grid">
              {QUICK_ISSUES.map((reason) => (
                <button
                  key={reason}
                  className="issue-option-btn"
                  onClick={() => handleRegisterIssue(reason)}
                >
                  {reason}
                </button>
              ))}
            </div>
          </div>
        )}

        {cameraError && (
          <div className="camera-fallback-banner" onClick={(e) => e.stopPropagation()}>
            <p>{cameraError}</p>
            <button className="btn-primary" onClick={() => fileInputRef.current?.click()}>
              <Upload size={18} /> Abrir Câmera do Celular / Enviar Foto
            </button>
          </div>
        )}
      </div>

      {/* Controle de Zoom */}
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
          {lastShotTargetIndex !== null && lastShotTargetIndex !== currentIndex ? (
            <button
              className="retake-last-btn"
              onClick={() => onSelectIndex(lastShotTargetIndex)}
              title="Voltar para refazer a última foto batida"
            >
              <RefreshCw size={15} />
              <span>Refazer {targets[lastShotTargetIndex]?.targetId}</span>
            </button>
          ) : (
            <button
              className="retake-last-btn issue-trigger-btn"
              onClick={() => setShowIssueMenu(!showIssueMenu)}
              title="Registrar Sala Fechada ou Ocorrência"
            >
              <AlertTriangle size={15} />
              <span>Ocorrência</span>
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

        <div className="bottom-side-slot right" style={{ gap: '6px' }}>
          <button
            className="fallback-trigger-btn issue-trigger-btn"
            onClick={() => setShowIssueMenu(!showIssueMenu)}
            title="Marcar Sala Fechada / Sem Acesso"
          >
            <AlertTriangle size={15} />
          </button>
          <button
            className="fallback-trigger-btn"
            onClick={() => fileInputRef.current?.click()}
            title="Usar câmera nativa do sistema ou galeria"
          >
            <Upload size={15} />
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
