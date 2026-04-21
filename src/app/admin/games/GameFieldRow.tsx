'use client';

import type { GameField, GameSpec } from './game-schema';
import { defaultUnit, fieldPath, getAtPath, setAtPath } from './game-schema';
import NumberUnitInput from './fields/NumberUnitInput';
import SliderNumberInput from './fields/SliderNumberInput';
import ToggleCard from './fields/ToggleCard';
import RoleChips from '../_components/RoleChips';
import ChannelChips from '../_components/ChannelChips';
import ChannelPicker from '../_components/ChannelPicker';
import ImageUrlInput from './fields/ImageUrlInput';
import LockedNestedNotice from './fields/LockedNestedNotice';

interface Props {
  game: GameSpec;
  field: GameField;
  gameValue: any;
  onPatch: (nextGameValue: any) => void;
}

export default function GameFieldRow({ game, field, gameValue, onPatch }: Props) {
  const path = fieldPath(field);
  const current = getAtPath(gameValue, path);
  const unit = field.unit ?? defaultUnit(field.type) ?? null;

  const setValue = (next: any) => onPatch(setAtPath(gameValue, path, next));

  const isFullWidth =
    field.type === 'textarea' ||
    field.type === 'chips-role' ||
    field.type === 'chips-channel' ||
    field.type === 'image-url' ||
    field.type === 'locked-nested';

  const isInline = field.type === 'toggle';

  const isCard =
    field.type === 'number-int' ||
    field.type === 'number-coins' ||
    field.type === 'number-seconds' ||
    field.type === 'number-ms-as-seconds' ||
    field.type === 'number-percent' ||
    field.type === 'number-multiplier' ||
    field.type === 'slider-int' ||
    field.type === 'slider-percent';

  let control: React.ReactNode = null;

  switch (field.type) {
    case 'toggle':
      control = <ToggleCard value={Boolean(current)} onChange={setValue} />;
      break;

    case 'text':
      control = (
        <div className="av-games-field-control">
          <input
            className="av-games-field-input"
            value={String(current ?? '')}
            placeholder={field.placeholder}
            onChange={(e) => setValue(e.target.value)}
          />
        </div>
      );
      break;

    case 'textarea':
      control = (
        <div className="av-games-field-control">
          <textarea
            className="av-games-field-input av-games-field-textarea"
            value={String(current ?? '')}
            placeholder={field.placeholder}
            rows={3}
            onChange={(e) => setValue(e.target.value)}
          />
        </div>
      );
      break;

    case 'number-int':
    case 'number-coins':
    case 'number-seconds':
    case 'number-ms-as-seconds':
    case 'number-percent':
    case 'number-multiplier':
      control = (
        <NumberUnitInput
          type={field.type}
          value={Number(current ?? 0)}
          onChange={setValue}
          unit={unit}
          min={field.min}
          max={field.max}
          step={field.step}
          placeholder={field.placeholder}
        />
      );
      break;

    case 'slider-int':
    case 'slider-percent':
      control = (
        <SliderNumberInput
          value={Number(current ?? field.min ?? 0)}
          onChange={setValue}
          unit={unit}
          min={field.min ?? 0}
          max={field.max ?? 100}
          step={field.step ?? 1}
        />
      );
      break;

    case 'chips-role':
      control = <RoleChips value={Array.isArray(current) ? current : []} onChange={setValue} />;
      break;

    case 'chips-channel':
      control = <ChannelChips value={Array.isArray(current) ? current : []} onChange={setValue} />;
      break;

    case 'single-channel':
      control = <ChannelPicker value={String(current ?? '')} onChange={setValue} />;
      break;

    case 'image-url':
      control = (
        <ImageUrlInput
          value={String(current ?? '')}
          onChange={setValue}
          folder={game.bot}
          filenameHint={`${game.id}_${field.key.replace(/\./g, '_')}`}
        />
      );
      break;

    case 'locked-nested':
      control = (
        <LockedNestedNotice
          where={field.locked?.where ?? 'Advanced'}
          summary={field.locked?.summary ?? ''}
          href={field.locked?.href}
        />
      );
      break;
  }

  return (
    <div
      className={`av-games-field${isFullWidth ? ' av-games-field--full' : ''}${isInline ? ' av-games-field--inline' : ''}${isCard ? ' av-games-field--card' : ''}`}
    >
      <div className="av-games-field-head">
        <label className="av-games-field-label">{field.label}</label>
        {field.help && <p className="av-games-field-help">{field.help}</p>}
      </div>
      {control}
    </div>
  );
}
