'use client';

import { useRef, useEffect, useState } from 'react';
import type { CanvasTypeDef } from '@/lib/admin/canvas-definitions';

interface FakePreviewProps {
  definition: CanvasTypeDef;
  layout: Record<string, any>;
  colors: Record<string, string>;
  customBackgroundUrl?: string;
}

// Fake data for preview
const FAKE_NAMES = ['LunarKnight', 'ShadowMoon', 'CrimsonStar', 'FrostBlade', 'NovaFlare',
  'StormEye', 'DarkVeil', 'SilverFang', 'AzureDawn', 'BladeWolf'];
const FAKE_VALUES = [125_340, 98_200, 76_540, 61_000, 52_800, 44_100, 38_900, 31_200, 25_700, 19_400];
const FAKE_LEVELS = [87, 72, 65, 58, 51, 44, 39, 33, 28, 22];
const FAKE_WINS = [342, 287, 231, 198, 165, 142, 118, 95, 78, 61];

function getNestedValue(obj: Record<string, any>, path: string): Record<string, number> {
  const parts = path.split('.');
  let cur: any = obj;
  for (const p of parts) {
    if (!cur || typeof cur !== 'object') return {};
    cur = cur[p];
  }
  if (!cur || typeof cur !== 'object') return {};
  const result: Record<string, number> = {};
  for (const [k, v] of Object.entries(cur)) {
    if (typeof v === 'number') result[k] = v;
  }
  return result;
}

function formatNumber(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return String(n);
}

// Draw a circular/elliptical avatar placeholder
function drawAvatar(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, color: string, label: string) {
  ctx.save();
  ctx.beginPath();
  if (rx === ry) {
    ctx.arc(x, y, rx, 0, Math.PI * 2);
  } else {
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.font = `bold ${Math.max(Math.min(rx, ry) * 0.8, 10)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label.charAt(0).toUpperCase(), x, y);
  ctx.restore();
}

// Helper: read radii from layout object with backward compat
function getRadii(av: Record<string, any>, fallback: number): [number, number] {
  const rx = av.radiusX ?? av.size ?? fallback;
  const ry = av.radiusY ?? av.size ?? fallback;
  return [rx, ry];
}

// Draw centered text
function drawText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, fontSize: number, color: string, align: CanvasTextAlign = 'center') {
  ctx.save();
  ctx.fillStyle = color;
  ctx.font = `${fontSize}px sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
  ctx.restore();
}

// Draw progress bar
function drawProgressBar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, pct: number, bgColor: string, fillColor: string, borderColor: string) {
  const r = Math.min(h / 2, 8);
  // Background
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fillStyle = bgColor;
  ctx.fill();
  // Fill
  const fillW = Math.max(w * pct, r * 2);
  ctx.beginPath();
  ctx.roundRect(x, y, fillW, h, r);
  ctx.fillStyle = fillColor;
  ctx.fill();
  // Border
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
}

// ─── Render functions per canvas type ────────────────────────────

function renderLeaderboard(
  ctx: CanvasRenderingContext2D,
  layout: Record<string, any>,
  colors: Record<string, string>,
  valueKey: string,
  values: number[],
) {
  const nameColor = colors.name || '#F5E6CC';
  const valueColor = colors[valueKey] || '#ccffc2';
  const avatarColors = ['#FFD700', '#C0C0C0', '#CD7F32', '#58a6ff', '#58a6ff', '#58a6ff', '#58a6ff', '#58a6ff', '#58a6ff', '#58a6ff'];

  // Top 3
  for (let rank = 1; rank <= 3; rank++) {
    const pos = layout.top3?.[rank];
    if (!pos) continue;
    const av = pos.avatar || {};
    const nm = pos.name || {};
    const val = pos.value || pos[valueKey] || {};
    const [rx, ry] = getRadii(av, 50);
    drawAvatar(ctx, av.x || 0, av.y || 0, rx, ry, avatarColors[rank - 1], FAKE_NAMES[rank - 1]);
    drawText(ctx, FAKE_NAMES[rank - 1], nm.x || 0, nm.y || 0, nm.fontSize || 20, nameColor);
    drawText(ctx, formatNumber(values[rank - 1]), val.x || 0, val.y || 0, val.fontSize || 22, valueColor);
  }

  // List 4-10
  for (let rank = 4; rank <= 10; rank++) {
    const pos = layout.list?.[rank];
    if (!pos) continue;
    const av = pos.avatar || {};
    const nm = pos.name || {};
    const val = pos.value || pos[valueKey] || {};
    const [lrx, lry] = getRadii(av, 25);
    drawAvatar(ctx, av.x || 0, av.y || 0, lrx, lry, '#4a5568', FAKE_NAMES[rank - 1]);
    drawText(ctx, `#${rank}  ${FAKE_NAMES[rank - 1]}`, nm.x || 0, nm.y || 0, nm.fontSize || 18, nameColor, 'left');
    drawText(ctx, formatNumber(values[rank - 1]), val.x || 0, val.y || 0, val.fontSize || 22, valueColor, 'right');
  }
}

function renderRankCard(ctx: CanvasRenderingContext2D, layout: Record<string, any>, colors: Record<string, string>) {
  const av = layout.avatar || {};
  const un = layout.username || {};
  const lv = layout.level || {};
  const xp = layout.xpText || {};
  const bar = layout.progressBar || {};
  const rk = layout.rank || {};
  const rl = layout.rankLabel || {};

  const [rkRx, rkRy] = getRadii(av, 80);
  drawAvatar(ctx, av.x || 0, av.y || 0, rkRx, rkRy, '#58a6ff', 'L');
  drawText(ctx, 'LunarKnight', un.x || 0, un.y || 0, un.fontSize || 36, colors.username || '#FFFFFF', 'left');
  drawText(ctx, 'Level 42', lv.x || 0, lv.y || 0, lv.fontSize || 24, colors.level || '#D0D4D8', 'left');
  drawText(ctx, '12,450 / 18,000 XP', xp.x || 0, xp.y || 0, xp.fontSize || 20, colors.xp || '#D0D4D8', 'right');
  drawProgressBar(ctx, bar.x || 0, bar.y || 0, bar.width || 640, bar.height || 30, 0.69,
    colors.barBg || '#40444B', colors.barFill || '#D0D0D0', colors.barBorder || '#B0B0B0');
  drawText(ctx, '#3', rk.x || 0, rk.y || 0, rk.fontSize || 28, colors.rank || '#FFFFFF', 'left');
  drawText(ctx, 'Rank', rl.x || 0, rl.y || 0, rl.fontSize || 20, colors.rank || '#FFFFFF', 'left');
}

function renderProfileCard(ctx: CanvasRenderingContext2D, layout: Record<string, any>, colors: Record<string, string>) {
  const av = layout.avatar || {};
  const dn = layout.displayName || {};
  const un = layout.username || {};
  const lp = layout.levelPill || {};
  const xb = layout.xpBar || {};
  const xl = layout.xpLabel || {};
  const sep = layout.separator || {};

  const [pfRx, pfRy] = getRadii(av, 100);
  drawAvatar(ctx, av.x || 512, av.y || 180, pfRx, pfRy, colors.accent || '#58a6ff', 'L');
  drawText(ctx, 'LunarKnight', dn.x || 512, dn.y || 325, dn.fontSize || 36, colors.text || '#e6edf3');
  drawText(ctx, '@lunarknight', un.x || 512, un.y || 358, un.fontSize || 18, colors.textDim || '#8b949e');

  // Level pill
  const px = lp.x || 512;
  const py = lp.y || 388;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(px - 30, py - 10, 60, 20, 10);
  ctx.fillStyle = 'rgba(88, 166, 255, 0.2)';
  ctx.fill();
  ctx.restore();
  drawText(ctx, 'Lv. 42', px, py, lp.fontSize || 18, colors.accent || '#58a6ff');

  // XP bar
  drawProgressBar(ctx, xb.x || 362, xb.y || 430, xb.width || 300, xb.height || 12, 0.69,
    colors.xpBarBg || '#21262d', colors.xpBar || '#238636', 'transparent');
  drawText(ctx, '12,450 / 18,000 XP', xl.x || 512, xl.y || 472, xl.fontSize || 14, colors.textDim || '#8b949e');

  // Separator
  if (sep.x !== undefined) {
    ctx.save();
    ctx.fillStyle = 'rgba(48, 54, 61, 0.5)';
    ctx.fillRect(sep.x, sep.y || 490, sep.width || 924, sep.height || 2);
    ctx.restore();
  }

  // Stat cards (fake)
  const startY = (sep.y || 490) + 20;
  const stats = [
    { label: 'Cards', value: '47', color: colors.accent || '#58a6ff' },
    { label: 'Stones', value: '12', color: colors.purple || '#bc8cff' },
    { label: 'Messages', value: '3.2K', color: colors.green || '#3fb950' },
    { label: 'Voice', value: '24h', color: colors.accent || '#58a6ff' },
  ];
  const cardW = 210;
  const cardH = 100;
  const gap = 18;
  const totalW = cardW * 2 + gap;
  const offsetX = 512 - totalW / 2;
  stats.forEach((s, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const cx = offsetX + col * (cardW + gap) + cardW / 2;
    const cy = startY + row * (cardH + gap) + cardH / 2;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(cx - cardW / 2, cy - cardH / 2, cardW, cardH, 14);
    ctx.fillStyle = 'rgba(13, 17, 23, 0.55)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(48, 54, 61, 0.5)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
    drawText(ctx, s.value, cx, cy - 10, 36, s.color);
    drawText(ctx, s.label, cx, cy + 22, 14, colors.textDim || '#8b949e');
  });
}

function renderLevelUp(ctx: CanvasRenderingContext2D, layout: Record<string, any>) {
  const av = layout.avatar || {};
  const [luRx, luRy] = getRadii(av, 218);
  drawAvatar(ctx, av.x || 394, av.y || 334, luRx, luRy, '#58a6ff', 'L');
}

function renderLuna21(ctx: CanvasRenderingContext2D, layout: Record<string, any>, colors: Record<string, string>) {
  // Player side
  const pa = layout.playerAvatar || {};
  const pn = layout.playerName || {};
  const pl = layout.playerLabel || {};
  const pt = layout.playerTotal || {};
  const [paRx, paRy] = getRadii(pa, 55);
  drawAvatar(ctx, pa.x || 180, pa.y || 100, paRx, paRy, '#58a6ff', 'P');
  drawText(ctx, 'LunarKnight', pn.x || 180, pn.y || 230, pn.fontSize || 26, colors.name || '#6FB3E0');
  drawText(ctx, 'Player', pl.x || 180, pl.y || 258, pl.fontSize || 19, colors.label || '#8AB4D5');

  // Player cards placeholder
  const pc = layout.playerCards || {};
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 2; i++) {
    ctx.strokeRect((pc.x || 70) + i * 95, pc.y || 295, 85, 130);
  }
  ctx.restore();
  // Total
  ctx.save();
  ctx.beginPath();
  ctx.roundRect((pt.x || 180) - 40, (pt.y || 545) - 25, 80, 50, 12);
  ctx.fillStyle = 'rgba(10, 30, 50, 0.85)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
  drawText(ctx, '19', pt.x || 180, pt.y || 545, pt.fontSize || 50, colors.total || '#6FB3E0');

  // Dealer side
  const da = layout.dealerAvatar || {};
  const dn = layout.dealerName || {};
  const dl = layout.dealerLabel || {};
  const dt = layout.dealerTotal || {};
  const [daRx, daRy] = getRadii(da, 55);
  drawAvatar(ctx, da.x || 844, da.y || 100, daRx, daRy, '#f0883e', 'D');
  drawText(ctx, 'Butler', dn.x || 844, dn.y || 230, dn.fontSize || 26, colors.name || '#6FB3E0');
  drawText(ctx, 'Dealer', dl.x || 844, dl.y || 258, dl.fontSize || 19, colors.label || '#8AB4D5');
  const dc = layout.dealerCards || {};
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 2; i++) {
    ctx.strokeRect((dc.x || 734) + i * 95, dc.y || 295, 85, 130);
  }
  ctx.restore();
  ctx.save();
  ctx.beginPath();
  ctx.roundRect((dt.x || 844) - 40, (dt.y || 545) - 25, 80, 50, 12);
  ctx.fillStyle = 'rgba(10, 30, 50, 0.85)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
  drawText(ctx, '17', dt.x || 844, dt.y || 545, dt.fontSize || 50, colors.total || '#6FB3E0');

  // Result
  const res = layout.result || {};
  drawText(ctx, 'WIN', res.x || 512, res.y || 400, res.fontSize || 43, colors.win || '#6FB3E0');
}

function renderWinner(ctx: CanvasRenderingContext2D, layout: Record<string, any>) {
  const av = layout.avatar || {};
  const [wRx, wRy] = getRadii(av, 138);
  drawAvatar(ctx, av.x || 569, av.y || 420, wRx, wRy, '#FFD700', 'W');
}

function renderBook(ctx: CanvasRenderingContext2D, layout: Record<string, any>) {
  const left = layout.leftArea || { x: 82, y: 98, width: 930, height: 1327 };
  const right = layout.rightArea || { x: 1305, y: 98, width: 893, height: 1327 };

  // Draw page areas
  [left, right].forEach(area => {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    ctx.strokeRect(area.x, area.y, area.width, area.height);
    // 3x3 card grid
    const cols = 3, rows = 3;
    const gapX = 12, gapY = 12;
    const cw = (area.width - gapX * (cols + 1)) / cols;
    const ch = cw * 1.53; // card aspect ratio
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cx = area.x + gapX + c * (cw + gapX);
        const cy = area.y + gapY + r * (ch + gapY);
        ctx.beginPath();
        ctx.roundRect(cx, cy, cw, ch, 6);
        ctx.fillStyle = 'rgba(88, 166, 255, 0.06)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(88, 166, 255, 0.15)';
        ctx.stroke();
      }
    }
    ctx.restore();
  });
}

function renderChest(ctx: CanvasRenderingContext2D, layout: Record<string, any>) {
  const stoneColors = ['#a855f7', '#3b82f6', '#fbbf24'];
  for (let i = 1; i <= 3; i++) {
    const s = layout[`stone${i}`] || {};
    const [sRx, sRy] = getRadii(s, 100);
    drawAvatar(ctx, s.x || (250 + (i - 1) * 360), s.y || 530, sRx, sRy, stoneColors[i - 1], `S${i}`);
  }
}

// ─── Main component ──────────────────────────────────────────────

export default function FakePreview({ definition, layout, colors, customBackgroundUrl }: FakePreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [bgLoaded, setBgLoaded] = useState(false);
  const bgRef = useRef<HTMLImageElement | null>(null);

  const bgUrl = customBackgroundUrl || layout.backgroundUrl || definition.backgroundUrl;

  // Load background image
  useEffect(() => {
    setBgLoaded(false);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => { bgRef.current = img; setBgLoaded(true); };
    img.onerror = () => { bgRef.current = null; setBgLoaded(true); };
    img.src = bgUrl;
  }, [bgUrl]);

  // Draw preview when layout/colors/bg change
  useEffect(() => {
    if (!bgLoaded) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = definition.width;
    const h = definition.height;
    canvas.width = w;
    canvas.height = h;

    // Background
    ctx.clearRect(0, 0, w, h);
    if (bgRef.current) {
      ctx.drawImage(bgRef.current, 0, 0, w, h);
    } else {
      ctx.fillStyle = '#0d1117';
      ctx.fillRect(0, 0, w, h);
    }

    // Build color map from defaults + overrides
    const colorMap: Record<string, string> = {};
    for (const ck of definition.colorKeys) colorMap[ck.key] = ck.default;
    Object.assign(colorMap, colors);

    // Render based on canvas type
    switch (definition.id) {
      case 'leaderboard_lunari':
        renderLeaderboard(ctx, layout, colorMap, 'lunari', FAKE_VALUES);
        break;
      case 'leaderboard_levels':
        renderLeaderboard(ctx, layout, colorMap, 'levels', FAKE_LEVELS);
        break;
      case 'fantasy_leaderboard':
        renderLeaderboard(ctx, layout, colorMap, 'wins', FAKE_WINS);
        break;
      case 'rank_card':
        renderRankCard(ctx, layout, colorMap);
        break;
      case 'profile_card':
        renderProfileCard(ctx, layout, colorMap);
        break;
      case 'level_up_card':
        renderLevelUp(ctx, layout);
        break;
      case 'luna21_card':
        renderLuna21(ctx, layout, colorMap);
        break;
      case 'winner_image':
        renderWinner(ctx, layout);
        break;
      case 'book_image':
        renderBook(ctx, layout);
        break;
      case 'chest_image':
        renderChest(ctx, layout);
        break;
    }
  }, [bgLoaded, definition, layout, colors]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: 'auto', borderRadius: 8, display: 'block' }}
    />
  );
}
