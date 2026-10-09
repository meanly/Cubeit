import { useId } from 'react';

/** Unique, DOM-safe id prefix for SVG gradients (ids are global on web). */
export function useSvgId(prefix: string): string {
  return `${prefix}${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
}
