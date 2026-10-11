'use client';

import { Printer } from 'lucide-react';

export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()}
      className="inline-flex items-center gap-2 rounded bg-plant px-4 py-2 text-sm font-semibold text-white hover:bg-plant/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plant">
      <Printer size={16} aria-hidden /> Print or save as PDF
    </button>
  );
}
