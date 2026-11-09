export const SAGE_IMAGE_MODELS = [
  { value: 'gpt-image-2.6-sunburst', label: 'Sunburst · detailed visuals' },
  { value: 'gpt-image-2.6-flare', label: 'Flare · faster iteration' },
] as const;

export const SAGE_IMAGE_QUALITIES = [
  { value: 'auto', label: 'Auto' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'xhigh', label: 'XHigh' },
  { value: 'max', label: 'Max' },
] as const;

export type SageImageQuality = typeof SAGE_IMAGE_QUALITIES[number]['value'];

export function isSageImageQuality(value: unknown): value is SageImageQuality {
  return typeof value === 'string' && SAGE_IMAGE_QUALITIES.some(option => option.value === value);
}
