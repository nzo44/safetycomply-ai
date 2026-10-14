'use client';

import { useId, useRef, useState } from 'react';
import { Link2, Loader2, Paperclip, Upload, X } from 'lucide-react';
import { createEvidenceUpload } from '@/actions/evidence/upload';
import { inputCls } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import {
  EVIDENCE_ACCEPT, EVIDENCE_BUCKET, EVIDENCE_TYPES, MAX_EVIDENCE_BYTES, evidenceLabel, isHttpUrl, parseStorageRef,
} from '@/lib/evidence';
import { createClient } from '@/lib/supabase/client';

export interface EvidenceFieldProps {
  /** Form field name. Omit when the parent reads `value` itself. */
  name?: string;
  label?: string;
  hint?: string;
  error?: string;
  /** Newline-separated references. Pass with `onChange` to control the field. */
  value?: string;
  onChange?: (value: string) => void;
  max?: number;
}

const toList = (v: string) => v.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);

async function uploadFile(file: File): Promise<string> {
  const ticket = await createEvidenceUpload({ fileName: file.name, size: file.size, type: file.type });
  if (!ticket.ok) throw new Error(ticket.error);
  const { error } = await createClient().storage.from(EVIDENCE_BUCKET).uploadToSignedUrl(ticket.path, ticket.token, file, { contentType: file.type });
  if (error) throw new Error('The upload failed. Check your connection and try again.');
  return ticket.ref;
}

export function EvidenceField({ name, label = 'Evidence', hint, error, value, onChange, max = 10 }: EvidenceFieldProps) {
  const uid = useId();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [inner, setInner] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [link, setLink] = useState('');
  const [linkError, setLinkError] = useState<string | null>(null);

  const list = toList(value ?? inner);
  const full = list.length >= max;
  const commit = (next: string[]) => {
    const v = next.join('\n');
    if (value === undefined) setInner(v);
    onChange?.(v);
  };

  async function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    let acc = [...list];
    for (const file of Array.from(files)) {
      if (acc.length >= max) { toast.push('error', `Attach ${max} items or fewer.`); break; }
      if (!Object.hasOwn(EVIDENCE_TYPES, file.type)) {
        toast.push('error', `${file.name}: this file type is not allowed. Use a PDF, image, text, CSV, Word or Excel file.`);
        continue;
      }
      if (file.size > MAX_EVIDENCE_BYTES) { toast.push('error', `${file.name}: files can be up to 10 MB.`); continue; }
      setBusy(file.name);
      try {
        acc = [...acc, await uploadFile(file)];
        commit(acc);
      } catch (e) {
        toast.push('error', `${file.name}: ${e instanceof Error ? e.message : 'the upload failed.'}`);
      }
    }
    setBusy(null);
    if (fileRef.current) fileRef.current.value = '';
  }

  function addLink() {
    const v = link.trim();
    if (!isHttpUrl(v)) { setLinkError('Enter a full link starting with http:// or https://'); return; }
    if (list.includes(v)) { setLinkError('That link is already attached.'); return; }
    if (full) { setLinkError(`Attach ${max} items or fewer.`); return; }
    commit([...list, v]);
    setLink('');
    setLinkError(null);
  }

  return (
    <div>
      <p id={`${uid}-label`} className="mb-1 text-sm font-medium">{label}</p>
      {name && <input type="hidden" name={name} value={list.join('\n')} />}

      <div className="space-y-3 rounded border border-line bg-white p-3">
        {list.length > 0 && (
          <ul aria-labelledby={`${uid}-label`} className="space-y-1.5">
            {list.map((ref) => (
              <li key={ref} className="flex items-center gap-2 rounded border border-line bg-canvas px-2 py-1 text-xs">
                {parseStorageRef(ref) ? <Paperclip size={13} aria-hidden className="shrink-0 text-steel" /> : <Link2 size={13} aria-hidden className="shrink-0 text-steel" />}
                <span className="min-w-0 flex-1 truncate" title={ref}>{evidenceLabel(ref)}</span>
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => commit(list.filter((x) => x !== ref))}
                  aria-label={`Remove ${evidenceLabel(ref)}`}
                  className="shrink-0 rounded p-0.5 text-steel hover:text-noncompliant focus-visible:outline focus-visible:outline-2 focus-visible:outline-plant disabled:opacity-40"
                >
                  <X size={14} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={fileRef}
            id={`${uid}-file`}
            type="file"
            multiple
            accept={EVIDENCE_ACCEPT}
            disabled={busy !== null || full}
            onChange={(e) => void onFiles(e.target.files)}
            className="peer sr-only"
          />
          <label
            htmlFor={`${uid}-file`}
            className={`inline-flex min-h-10 items-center gap-1.5 rounded border border-plant px-3 text-sm font-semibold text-plant peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-plant ${
              busy !== null || full ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:bg-plant/5'
            }`}
          >
            {busy !== null ? <Loader2 size={15} aria-hidden className="animate-spin" /> : <Upload size={15} aria-hidden />}
            Attach files
          </label>
          <span role="status" className="min-w-0 truncate text-xs text-steel">
            {busy !== null ? `Uploading ${busy}…` : `PDF, image, text, CSV, Word or Excel, up to 10 MB each`}
          </span>
        </div>

        <div>
          <label htmlFor={`${uid}-link`} className="mb-1 block text-xs font-medium">Or add a link</label>
          <div className="flex gap-2">
            <input
              id={`${uid}-link`}
              type="url"
              value={link}
              disabled={full}
              placeholder="https://…"
              onChange={(e) => { setLink(e.target.value); setLinkError(null); }}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addLink(); } }}
              className={inputCls}
            />
            <button type="button" onClick={addLink} disabled={full || link.trim() === ''}
              className="shrink-0 rounded border border-line px-3 text-sm font-medium hover:bg-canvas disabled:opacity-50">
              Add
            </button>
          </div>
          {linkError && <p role="alert" className="mt-1 text-xs font-medium text-noncompliant">{linkError}</p>}
        </div>
      </div>

      {hint && <p className="mt-1 text-xs text-steel">{hint}</p>}
      {error && <p role="alert" className="mt-1 text-xs font-medium text-noncompliant">{error}</p>}
    </div>
  );
}
