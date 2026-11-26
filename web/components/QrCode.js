'use client';

import { useMemo } from 'react';
import qrcode from '@/lib/vendor/qrcode-generator';

/**
 * A QR code of an order number, for the store to scan from the
 * receipt instead of typing it.
 */
export default function QrCode({ value, size = 112, label }) {
  const svg = useMemo(() => {
    if (!value) return '';
    const qr = qrcode(0, 'M');
    qr.addData(String(value));
    qr.make();
    return qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
  }, [value]);
  if (!svg) return null;
  return (
    <figure className="inline-flex flex-col items-center gap-1">
      {/* The SVG is made here from the order number alone. */}
      <span
        role="img"
        aria-label={label || `QR code for ${value}`}
        className="block bg-white p-1 [&>svg]:h-full [&>svg]:w-full"
        style={{ width: size, height: size }}
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      <figcaption className="tnum text-[11px] text-ink-muted">{value}</figcaption>
    </figure>
  );
}
