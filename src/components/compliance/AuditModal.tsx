'use client';

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import type { MatrixRow } from '@/types/compliance';
import type { FormAction } from '@/lib/action-result';
import { AuditForm } from './audit-form';
import { StatusBadge } from './status-badge';

export interface AuditModalProps {
  open: boolean;
  requirement: MatrixRow | null;
  action: FormAction;
  onClose: () => void;
}

export function AuditModal({ open, requirement, action, onClose }: AuditModalProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby="audit-modal-title"
      onClose={onClose} // fires on Esc and after el.close()
      onClick={(e) => {
        if (e.target === ref.current) onClose(); // backdrop click
      }}
      className="fixed inset-y-0 left-auto right-0 m-0 h-full max-h-none w-full max-w-lg overflow-hidden bg-white p-0 shadow-2xl backdrop:bg-ink/40"
    >
      {open && requirement && (
        <div className="flex h-full flex-col">
          <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
            <div className="min-w-0">
              <h2 id="audit-modal-title" className="font-display text-xl font-semibold">Record audit</h2>
              <p className="mt-1 truncate text-sm font-medium">{requirement.title}</p>
              <p className="truncate text-xs text-steel">{requirement.citation}</p>
              <div className="mt-2 flex items-center gap-2 text-xs text-steel">
                Current status <StatusBadge status={requirement.currentStatus} />
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="rounded p-1.5 text-steel hover:bg-canvas hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-plant"
            >
              <X size={18} aria-hidden />
            </button>
          </header>

          <div className="flex-1 overflow-y-auto px-5 pt-5">
            <AuditForm
              key={requirement.id}
              requirementId={requirement.id}
              action={action}
              onSuccess={onClose}
              onCancel={onClose}
            />
          </div>
        </div>
      )}
    </dialog>
  );
}
