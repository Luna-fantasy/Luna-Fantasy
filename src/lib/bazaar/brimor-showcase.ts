import reference from './brimor-reference.json';

export interface RoleSwatch {
  id: string;
  name: string;
  price: number;
  gradientColors?: string[];
}

export const archiveRoleSwatches: readonly RoleSwatch[] = reference;

export function sortRoleStock<T extends { price: number }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => a.price - b.price);
}

export function displayRoleColors(colors?: readonly string[]): string[] {
  return (colors ?? []).filter(color => /^#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i.test(color));
}

export function fittingRoleColors(colors?: readonly string[]): string[] {
  const verified = displayRoleColors(colors);
  return verified.length ? verified : ['#f2d4b4', '#cda094'];
}

// Measure the real dye against the selected paper. An outside keyline preserves its colour.
export function needsInkEdge(colors: readonly string[] | undefined, light: boolean): boolean {
  const paper = light ? [231, 217, 200] : [24, 23, 26];
  const luminance = (rgb: number[]) => rgb.reduce((sum, value, index) => {
    const channel = value / 255;
    const linear = channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    return sum + linear * [0.2126, 0.7152, 0.0722][index];
  }, 0);
  const surface = luminance(paper);
  return fittingRoleColors(colors).some(color => {
    let hex = color.slice(1);
    if (hex.length < 5) hex = hex.split('').map(digit => digit + digit).join('');
    const alpha = hex.length === 8 ? parseInt(hex.slice(6), 16) / 255 : 1;
    const rgb = paper.map((background, index) => background * (1 - alpha) + parseInt(hex.slice(index * 2, index * 2 + 2), 16) * alpha);
    const ink = luminance(rgb);
    return (Math.max(surface, ink) + 0.05) / (Math.min(surface, ink) + 0.05) < 4.5;
  });
}
