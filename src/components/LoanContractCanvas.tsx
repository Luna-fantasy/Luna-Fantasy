'use client';

import { useRef, useEffect, useState } from 'react';

interface LoanContractCanvasProps {
  avatarUrl?: string | null;
  userName?: string | null;
  loanAmount?: number;
  width?: number;
  height?: number;
  onClick?: () => void;
}

const AMOUNT_TEXT: Record<number, string> = {
  5000: 'Five Thousand Lunari Only',
  10000: 'Ten Thousand Lunari Only',
  15000: 'Fifteen Thousand Lunari Only',
  20000: 'Twenty Thousand Lunari Only',
  25000: 'Twenty Five Thousand Lunari Only',
  30000: 'Thirty Thousand Lunari Only',
  40000: 'Forty Thousand Lunari Only',
  50000: 'Fifty Thousand Lunari Only',
  75000: 'Seventy Five Thousand Lunari Only',
  100000: 'One Hundred Thousand Lunari Only',
};

// Positions matching the grid layout (928x1239 base image)
const POS = {
  avatar: { x: 148.5, y: 944, size: 55 },
  amount: { x: 250, y: 930, fontSize: 18 },
  amountText: { x: 250, y: 977, fontSize: 16 },
  name: { x: 300, y: 1049, fontSize: 20 },
};

const TEXT_COLOR = '#1a1a2e';
const FONT_FAMILY = 'Cinzel, serif';

export function LoanContractCanvas({
  avatarUrl,
  userName,
  loanAmount,
  width = 320,
  height = 440,
  onClick,
}: LoanContractCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const base = new Image();
    base.src = '/images/loan_base.png';

    base.onload = () => {
      canvas.width = base.width;
      canvas.height = base.height;
      ctx.drawImage(base, 0, 0);

      // Draw text overlays
      const hasData = loanAmount && loanAmount > 0;

      if (hasData) {
        // Amount as number
        ctx.font = `bold ${POS.amount.fontSize}px ${FONT_FAMILY}`;
        ctx.fillStyle = TEXT_COLOR;
        ctx.textAlign = 'left';
        ctx.fillText(
          `${loanAmount.toLocaleString()} Lunari`,
          POS.amount.x,
          POS.amount.y,
        );

        // Amount as text
        const text =
          AMOUNT_TEXT[loanAmount] || `${loanAmount.toLocaleString()} Lunari Only`;
        ctx.font = `bold ${POS.amountText.fontSize}px ${FONT_FAMILY}`;
        ctx.fillText(text, POS.amountText.x, POS.amountText.y);
      }

      if (userName) {
        ctx.font = `bold ${POS.name.fontSize}px ${FONT_FAMILY}`;
        ctx.fillStyle = TEXT_COLOR;
        ctx.textAlign = 'left';
        ctx.fillText(userName, POS.name.x, POS.name.y);
      }

      // Draw avatar last (async)
      if (avatarUrl) {
        const avatar = new Image();
        avatar.crossOrigin = 'anonymous';
        avatar.src = avatarUrl;
        avatar.onload = () => {
          ctx.save();
          ctx.beginPath();
          ctx.arc(POS.avatar.x, POS.avatar.y, POS.avatar.size, 0, Math.PI * 2);
          ctx.closePath();
          ctx.clip();
          ctx.drawImage(
            avatar,
            POS.avatar.x - POS.avatar.size,
            POS.avatar.y - POS.avatar.size,
            POS.avatar.size * 2,
            POS.avatar.size * 2,
          );
          ctx.restore();
          setReady(true);
        };
        avatar.onerror = () => setReady(true);
      } else {
        setReady(true);
      }
    };
  }, [avatarUrl, userName, loanAmount]);

  return (
    <canvas
      ref={canvasRef}
      className="loan-contract-image"
      style={{
        width,
        height,
        objectFit: 'contain',
        cursor: onClick ? 'pointer' : undefined,
        opacity: ready ? 1 : 0,
        transition: 'opacity 0.3s ease',
      }}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
    />
  );
}
