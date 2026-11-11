'use client';
import { useEffect, useRef } from 'react';
import type { ValixaInspection } from 'valixa-devtools';
import { mountValixaDevtools } from 'valixa-devtools/panel';
import type { DevtoolsPanel } from 'valixa-devtools/panel';

/** A borrowed view. Attachment/detachment remains the application's explicit choice. */
export function ValixaDevtools({ inspections }: { readonly inspections: readonly ValixaInspection[] }) {
  const host = useRef<HTMLDivElement>(null);
  const panel = useRef<DevtoolsPanel | undefined>(undefined), latest = useRef(inspections), shown = useRef(inspections);
  latest.current = inspections;
  useEffect(() => {
    if (!host.current) return;
    shown.current = latest.current; panel.current = mountValixaDevtools(host.current, latest.current);
    return () => { panel.current?.destroy(); panel.current = undefined; };
  }, []);
  useEffect(() => { if (shown.current !== inspections) { shown.current = inspections; panel.current?.update(inspections); } }, [inspections]);
  return <div ref={host} data-valixa-devtools-host="react" />;
}
