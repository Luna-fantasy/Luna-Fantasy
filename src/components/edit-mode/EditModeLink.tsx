'use client';

import { type ComponentProps } from 'react';
import { Link } from '@/i18n/routing';
import { useEditMode } from '@/lib/edit-mode/context';

type LinkProps = ComponentProps<typeof Link>;

/**
 * Wraps next-intl Link to preserve editMode=1 during navigation.
 * In normal mode, renders a standard Link.
 */
export function EditModeLink(props: LinkProps) {
  const { editMode } = useEditMode();

  if (!editMode) {
    return <Link {...props} />;
  }

  // Append editMode=1 to the href
  const href = props.href;
  let editHref: string;

  if (typeof href === 'string') {
    const separator = href.includes('?') ? '&' : '?';
    editHref = `${href}${separator}editMode=1`;
  } else {
    // PathObject with params
    editHref = String(href);
  }

  return <Link {...props} href={editHref as any} />;
}
