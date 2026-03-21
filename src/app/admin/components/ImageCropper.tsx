'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import AdminLightbox from './AdminLightbox';

interface ImageCropperProps {
  file: File;
  aspect: 'avatar' | 'banner';
  onCrop: (croppedFile: File) => void;
  onCancel: () => void;
}

const CONFIGS = {
  avatar: { cropW: 280, cropH: 280, containerW: 400, containerH: 400, outW: 512, outH: 512, label: 'Avatar' },
  banner: { cropW: 450, cropH: 150, containerW: 500, containerH: 260, outW: 960, outH: 320, label: 'Banner' },
};

export default function ImageCropper({ file, aspect, onCrop, onCancel }: ImageCropperProps) {
  const cfg = CONFIGS[aspect];
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [naturalSize, setNaturalSize] = useState({ w: 1, h: 1 });
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const imgRef = useRef<HTMLImageElement | null>(null);

  // Load image from file
  useEffect(() => {
    const url = URL.createObjectURL(file);
    setImgSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const onImgLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });

    // Auto-fit: scale so the image fills the crop area
    const scaleX = cfg.cropW / img.naturalWidth;
    const scaleY = cfg.cropH / img.naturalHeight;
    const fitZoom = Math.max(scaleX, scaleY);
    setZoom(fitZoom);
    setPan({ x: 0, y: 0 });
  }, [cfg.cropW, cfg.cropH]);

  // Drag handlers
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    setDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [pan]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    const displayW = naturalSize.w * zoom;
    const displayH = naturalSize.h * zoom;
    // Clamp so image always covers the crop frame
    const maxPanX = Math.max((displayW - cfg.cropW) / 2, 0);
    const maxPanY = Math.max((displayH - cfg.cropH) / 2, 0);
    setPan({
      x: Math.min(maxPanX, Math.max(-maxPanX, dragStart.current.panX + dx)),
      y: Math.min(maxPanY, Math.max(-maxPanY, dragStart.current.panY + dy)),
    });
  }, [dragging, naturalSize, zoom, cfg]);

  const handlePointerUp = useCallback(() => {
    setDragging(false);
  }, []);

  // Crop and export
  const handleCrop = useCallback(() => {
    if (!imgRef.current) return;

    const canvas = document.createElement('canvas');
    canvas.width = cfg.outW;
    canvas.height = cfg.outH;
    const ctx = canvas.getContext('2d')!;

    // Calculate what region of the original image is under the crop frame
    const displayW = naturalSize.w * zoom;
    const displayH = naturalSize.h * zoom;

    // Image center in container coords = container center + pan
    const imgCenterX = cfg.containerW / 2 + pan.x;
    const imgCenterY = cfg.containerH / 2 + pan.y;

    // Image top-left in container coords
    const imgLeft = imgCenterX - displayW / 2;
    const imgTop = imgCenterY - displayH / 2;

    // Crop frame position in container coords (centered)
    const cropLeft = (cfg.containerW - cfg.cropW) / 2;
    const cropTop = (cfg.containerH - cfg.cropH) / 2;

    // Crop region in original image coordinates
    const sx = (cropLeft - imgLeft) / zoom;
    const sy = (cropTop - imgTop) / zoom;
    const sw = cfg.cropW / zoom;
    const sh = cfg.cropH / zoom;

    ctx.drawImage(imgRef.current, sx, sy, sw, sh, 0, 0, cfg.outW, cfg.outH);

    canvas.toBlob((blob) => {
      if (!blob) {
        onCancel();
        return;
      }
      const cropped = new File([blob], `${aspect}_cropped.png`, { type: 'image/png' });
      onCrop(cropped);
    }, 'image/png');
  }, [naturalSize, zoom, pan, cfg, aspect, onCrop]);

  // Min zoom: image must fill crop area
  const minZoom = Math.max(cfg.cropW / naturalSize.w, cfg.cropH / naturalSize.h, 0.1);
  const maxZoom = 4;

  return (
    <AdminLightbox isOpen={true} onClose={onCancel} title={`✂️ Crop ${cfg.label}`} size="lg">
      <div className="image-cropper-body">
        <div
          className="image-cropper-container"
          style={{ width: cfg.containerW, height: cfg.containerH }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          {/* The actual image */}
          {imgSrc && (
            <img
              ref={imgRef}
              src={imgSrc}
              alt="Crop preview"
              onLoad={onImgLoad}
              onError={() => onCancel()}
              className="image-cropper-img"
              draggable={false}
              style={{
                width: naturalSize.w * zoom,
                height: naturalSize.h * zoom,
                left: cfg.containerW / 2 + pan.x - (naturalSize.w * zoom) / 2,
                top: cfg.containerH / 2 + pan.y - (naturalSize.h * zoom) / 2,
              }}
            />
          )}
          {/* Dark overlay with transparent crop window */}
          <svg className="image-cropper-overlay" width={cfg.containerW} height={cfg.containerH}>
            <defs>
              <mask id="crop-mask">
                <rect width="100%" height="100%" fill="white" />
                {aspect === 'avatar' ? (
                  <circle
                    cx={cfg.containerW / 2}
                    cy={cfg.containerH / 2}
                    r={cfg.cropW / 2}
                    fill="black"
                  />
                ) : (
                  <rect
                    x={(cfg.containerW - cfg.cropW) / 2}
                    y={(cfg.containerH - cfg.cropH) / 2}
                    width={cfg.cropW}
                    height={cfg.cropH}
                    rx={6}
                    fill="black"
                  />
                )}
              </mask>
            </defs>
            <rect
              width="100%"
              height="100%"
              fill="rgba(0, 0, 0, 0.6)"
              mask="url(#crop-mask)"
            />
            {/* Crop frame border */}
            {aspect === 'avatar' ? (
              <circle
                cx={cfg.containerW / 2}
                cy={cfg.containerH / 2}
                r={cfg.cropW / 2}
                fill="none"
                stroke="rgba(0, 212, 255, 0.5)"
                strokeWidth={2}
              />
            ) : (
              <rect
                x={(cfg.containerW - cfg.cropW) / 2}
                y={(cfg.containerH - cfg.cropH) / 2}
                width={cfg.cropW}
                height={cfg.cropH}
                rx={6}
                fill="none"
                stroke="rgba(0, 212, 255, 0.5)"
                strokeWidth={2}
              />
            )}
          </svg>
        </div>

        {/* Zoom slider */}
        <div className="image-cropper-controls">
          <label className="image-cropper-zoom-label">
            <span style={{ fontSize: 14 }}>-</span>
            <input
              type="range"
              min={minZoom}
              max={maxZoom}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="image-cropper-slider"
            />
            <span style={{ fontSize: 14 }}>+</span>
          </label>
          <span className="image-cropper-zoom-value">{Math.round(zoom * 100)}%</span>
        </div>

        {/* Action buttons */}
        <div className="image-cropper-actions">
          <button className="admin-btn admin-btn-ghost" onClick={onCancel} type="button">
            Cancel
          </button>
          <button className="admin-btn admin-btn-primary" onClick={handleCrop} type="button">
            ✂️ Crop & Use
          </button>
        </div>
      </div>
    </AdminLightbox>
  );
}
