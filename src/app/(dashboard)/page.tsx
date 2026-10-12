import Link from 'next/link';
import { AlertTriangle, ArrowRight, ClipboardCheck, ClipboardList, Recycle, Scale, ShieldAlert } from 'lucide-react';
import { KpiCard, Stat, StatLine } from '@/components/dashboard/KpiCard';
import { ScoreRing } from '@/components/dashboard/ScoreRing';
import { getActiveSite, requireUser } from '@/lib/auth/session';
import { getExecutiveSummary } from '@/lib/data/dashboard';
import { fmtDateTime, fmtTons } from '@/lib/utils';

export const dynamic = 'force-dynamic';

function ActionCard({
  href, icon: Icon, title, description, stat, tone,
}: {
  href: string;
  icon: typeof AlertTriangle;
  title: string;
  description: string;
  stat: string;
  tone: 'ok' | 'warn' | 'crit';
}) {
  const color = tone === 'crit' ? 'text-rose-400' : tone === 'warn' ? 'text-amber-400' : 'text-emerald-400';
  return (
    <Link
      href={href}
      className="group flex flex-col justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900 p-5 hover:border-slate-700 hover:bg-slate-800/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400"
    >
      <div className="space-y-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-800 ring-1 ring-slate-700">
          <Icon size={18} aria-hidden className="text-slate-300" />
        </span>
        <h3 className="text-base font-semibold text-white">{title}</h3>
        <p className="text-sm text-slate-400">{description}</p>
      </div>
      <p className="flex items-center justify-between gap-3 text-sm">
        <span className={`font-medium ${color}`}>{stat}</span>
        <ArrowRight size={16} aria-hidden className="text-slate-500 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-200" />
      </p>
    </Link>
  );
}

export default async function ExecutiveOverviewPage() {
  const user = await requireUser();
  const site = await getActiveSite(user);

  // Dark executive surface inside the shared shell, so the light module pages keep their own styling.
  const surface = 'space-y-6 rounded-2xl bg-slate-950 p-5 text-slate-100 ring-1 ring-slate-800 sm:p-8';

  if (!site) {
    return (
      <div className={surface}>
        <h1 className="font-display text-3xl font-semibold text-white">Executive overview</h1>
        <p className="text-sm text-slate-400">No site is assigned to your account. Ask an administrator to add you to a site.</p>
      </div>
    );
  }

  const { compliance, capa, incidents, highSeverityOpen, waste, audits, risks } = await getExecutiveSummary(site.id, site.timezone);

  const hazShare = waste.totalTons > 0 ? (waste.hazardousTons / waste.totalTons) * 100 : 0;
  const trend =
    waste.changePct === null
      ? waste.totalTons > 0 ? 'No previous quarter to compare.' : 'Nothing weighed in this quarter yet.'
      : `${waste.changePct >= 0 ? 'Up' : 'Down'} ${Math.abs(waste.changePct).toFixed(0)}% on the previous quarter (${fmtTons(waste.previousTons)} t).`;

  return (
    <div className={surface}>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold text-white">Executive overview</h1>
          <p className="mt-1 text-sm text-slate-400">
            {site.name} ({site.code}), updated {fmtDateTime(new Date(), site.timezone)}
          </p>
        </div>
        <p
          role="status"
          className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300"
        >
          <span className="relative flex h-2 w-2" aria-hidden>
            <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60 motion-safe:animate-ping" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
          </span>
          System Live
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title="Legal compliance"
          href="/compliance"
          icon={Scale}
          footer={`${compliance.total} Algerian law and ISO requirements tracked. Partial compliance counts as half.`}
        >
          <div className="flex items-center gap-4">
            <ScoreRing score={compliance.rate} label="Weighted legal and ISO compliance rate" />
            <dl className="min-w-0 flex-1 space-y-1.5">
              <StatLine label="Compliant" value={compliance.counts.COMPLIANT} tone="ok" />
              <StatLine label="Partial" value={compliance.counts.PARTIALLY_COMPLIANT} tone={compliance.counts.PARTIALLY_COMPLIANT ? 'warn' : 'neutral'} />
              <StatLine label="Non-compliant" value={compliance.counts.NON_COMPLIANT} tone={compliance.counts.NON_COMPLIANT ? 'crit' : 'neutral'} />
              <StatLine label="Reviews overdue" value={compliance.overdue} tone={compliance.overdue ? 'crit' : 'neutral'} />
            </dl>
          </div>
        </KpiCard>

        <KpiCard
          title="Corrective actions and incidents"
          href="/incidents"
          icon={AlertTriangle}
          footer={
            incidents.daysSinceLastLti === null
              ? 'No lost-time incident recorded.'
              : `${incidents.daysSinceLastLti} days without a lost-time incident.`
          }
        >
          <dl className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Stat label="Open CAPAs" value={capa.open} />
              <Stat label="High-severity incidents" value={highSeverityOpen} tone={highSeverityOpen > 0 ? 'crit' : 'ok'} hint="open, major or above" />
            </div>
            <div className="space-y-1.5">
              <StatLine label="Overdue actions" value={capa.overdue} tone={capa.overdue ? 'crit' : 'neutral'} />
              <StatLine label="Escalated" value={capa.escalated} tone={capa.escalated ? 'warn' : 'neutral'} />
              <StatLine label="Awaiting verification" value={capa.pendingVerification} tone={capa.pendingVerification ? 'warn' : 'neutral'} />
            </div>
          </dl>
        </KpiCard>

        <KpiCard title={`Industrial waste, ${waste.label}`} href="/waste" icon={Recycle} footer={trend}>
          <dl className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Stat label="Hazardous" value={<>{fmtTons(waste.hazardousTons)}<span className="ml-1 text-base font-medium text-slate-500">t</span></>} tone={waste.hazardousTons > 0 ? 'crit' : 'neutral'} />
              <Stat label="Non-hazardous" value={<>{fmtTons(waste.nonHazardousTons)}<span className="ml-1 text-base font-medium text-slate-500">t</span></>} />
            </div>
            {waste.totalTons > 0 ? (
              <div>
                <div
                  className="flex h-2.5 overflow-hidden rounded-full bg-slate-800"
                  role="img"
                  aria-label={`Hazardous ${hazShare.toFixed(0)} percent, non-hazardous ${(100 - hazShare).toFixed(0)} percent of this quarter's tonnage`}
                >
                  <div className="bg-rose-400" style={{ width: `${hazShare}%` }} />
                  <div className="bg-slate-500" style={{ width: `${100 - hazShare}%` }} />
                </div>
                <p className="mt-2 text-xs text-slate-400">{hazShare.toFixed(0)}% hazardous by net weight</p>
              </div>
            ) : (
              <p className="text-sm text-slate-500">No loads weighed in yet.</p>
            )}
          </dl>
        </KpiCard>

        <KpiCard
          title="Audit health"
          href="/audits"
          icon={ClipboardList}
          footer={`Average of ${audits.completed} completed audit${audits.completed === 1 ? '' : 's'} in the last 12 months.`}
        >
          <div className="flex items-center gap-4">
            <ScoreRing score={audits.avgScore} label="Site-wide audit compliance score" decimals={1} />
            <dl className="min-w-0 flex-1 space-y-1.5">
              <StatLine label="Open NCRs" value={audits.openNcrs} tone={audits.openNcrs ? 'warn' : 'ok'} />
              <StatLine label="Overdue inspections" value={audits.overdue} tone={audits.overdue ? 'crit' : 'neutral'} />
            </dl>
          </div>
        </KpiCard>
      </div>

      <section aria-labelledby="quick-actions" className="space-y-3">
        <h2 id="quick-actions" className="font-display text-xl font-semibold text-white">Quick actions</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <ActionCard
            href="/incidents"
            icon={ShieldAlert}
            title="Incidents and CAPA"
            description="Report an incident, run the 5-Whys analysis and track corrective actions to verified closure."
            stat={`${incidents.underInvestigation} under investigation, ${capa.overdue} overdue`}
            tone={capa.overdue > 0 ? 'crit' : incidents.underInvestigation > 0 ? 'warn' : 'ok'}
          />
          <ActionCard
            href="/risk"
            icon={ClipboardCheck}
            title="Risk matrix (HIRA)"
            description="Rate hazards on the 5x5 matrix, review controls and print approved assessments."
            stat={`${risks.inReview} awaiting review, ${risks.overdue} reviews overdue`}
            tone={risks.overdue > 0 ? 'crit' : risks.inReview > 0 ? 'warn' : 'ok'}
          />
          <ActionCard
            href="/audits"
            icon={ClipboardList}
            title="Audits and inspections"
            description="Run a checklist inspection, score it live and raise non-conformance reports from any failed item."
            stat={`${audits.overdue} overdue inspections, ${audits.openNcrs} open NCRs`}
            tone={audits.overdue > 0 ? 'crit' : audits.openNcrs > 0 ? 'warn' : 'ok'}
          />
        </div>
      </section>
    </div>
  );
}
