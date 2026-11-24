import type { TodoDashboardMetrics as Metrics } from '@/lib/dashboard';

const METRIC_COPY = [
  { key: 'total', label: 'Total', description: 'Top-level Todos' },
  { key: 'active', label: 'Active', description: 'Incomplete Todos' },
  { key: 'completed', label: 'Completed', description: 'Completed occurrences' },
  { key: 'overdue', label: 'Overdue', description: 'Active · before today' },
  { key: 'dueToday', label: 'Due Today', description: 'Active · due today' },
  { key: 'upcoming', label: 'Upcoming', description: 'Active · after today' },
] as const;

export default function TodoDashboardMetrics({ metrics }: { metrics: Metrics }) {
  return (
    <section aria-label="Todo dashboard metrics" className="space-y-3">
      <h2 className="text-lg font-semibold tracking-tight">Overview</h2>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
        {METRIC_COPY.map(({ key, label, description }) => (
          <div key={key} className="min-w-0 rounded-xl border bg-card p-3 shadow-sm">
            <dt className="text-sm font-medium text-muted-foreground">{label}</dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums">{metrics[key]}</dd>
            <p className="mt-1 text-xs text-muted-foreground">{description}</p>
          </div>
        ))}
        <div className="min-w-0 rounded-xl border bg-card p-3 shadow-sm">
          <dt className="text-sm font-medium text-muted-foreground">Completion Rate</dt>
          <dd className="mt-1 text-2xl font-semibold tabular-nums">{metrics.completionRate}%</dd>
          <p className="mt-1 text-xs text-muted-foreground">Completed of total</p>
        </div>
      </dl>
      {metrics.total === 0 && <p className="text-sm text-muted-foreground">No Todos yet. Add a Todo to start tracking your progress.</p>}
    </section>
  );
}
