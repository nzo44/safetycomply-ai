import { describeActivity } from '@/lib/incidents-meta';
import { fmtDateTime } from '@/lib/utils';
import type { TimelineEntry } from '@/types/incidents';

export function IncidentTimeline({
  entries, names, capaRefs, timeZone,
}: { entries: TimelineEntry[]; names: Record<string, string>; capaRefs: Record<string, string>; timeZone: string }) {
  if (entries.length === 0) return <p className="text-sm text-steel">No activity yet.</p>;
  const who = (id: unknown) => (typeof id === 'string' ? (names[id] ?? 'a former user') : 'unknown');

  return (
    <ol className="relative space-y-4 border-l border-line pl-5">
      {entries.map((e) => (
        <li key={e.id} className="relative">
          <span aria-hidden className="absolute -left-[25px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-plant" />
          <p className="text-sm">
            {e.entityType === 'CAPA' && capaRefs[e.entityId] && <span className="font-semibold">{capaRefs[e.entityId]}: </span>}
            {describeActivity(e.action, e.metadata, who)}
          </p>
          <p className="text-xs text-steel">{e.actorName ?? 'System'}, {fmtDateTime(e.createdAt, timeZone)}</p>
        </li>
      ))}
    </ol>
  );
}
