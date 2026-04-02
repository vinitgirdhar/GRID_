type TooltipValue = string | number | undefined;

type TooltipItem = {
  color?: string;
  dataKey?: string;
  name?: string;
  payload?: Record<string, unknown>;
  value?: TooltipValue;
};

export type InsightTooltipConfig = {
  accentColor?: string;
  contextLabel: string;
  description: string;
  details: string[];
  insightFormatter?: (item: TooltipItem, label: string | number | undefined) => string;
  labelFormatter?: (label: string | number | undefined, item: TooltipItem) => string;
  metricLabel: string;
  title: string;
  valueFormatter?: (value: TooltipValue, item: TooltipItem) => string;
};

interface InsightTooltipProps {
  active?: boolean;
  config: InsightTooltipConfig;
  label?: string | number;
  payload?: TooltipItem[];
}

function pickText(candidate: unknown) {
  return typeof candidate === 'string' || typeof candidate === 'number' ? String(candidate) : null;
}

function defaultLabelFormatter(label: string | number | undefined, item: TooltipItem) {
  return (
    pickText(label)
    ?? pickText(item.payload?.name)
    ?? pickText(item.payload?.label)
    ?? pickText(item.name)
    ?? 'Current point'
  );
}

function defaultValueFormatter(value: TooltipValue) {
  if (typeof value === 'number') {
    return Number.isInteger(value) ? value.toLocaleString() : value.toFixed(3);
  }

  return typeof value === 'string' ? value : '--';
}

export function InsightTooltip({ active, config, label, payload }: InsightTooltipProps) {
  if (!active || !payload?.length) {
    return null;
  }

  const item = payload[0];
  const accentColor = item.color || config.accentColor || 'var(--primary)';
  const resolvedLabel = (config.labelFormatter || defaultLabelFormatter)(label, item);
  const resolvedValue = (config.valueFormatter || defaultValueFormatter)(item.value, item);
  const insight = config.insightFormatter?.(item, label);

  return (
    <div
      className="min-w-[280px] max-w-[340px] rounded-2xl border px-4 py-4 shadow-[0_18px_48px_rgba(15,23,42,0.18)] backdrop-blur-xl"
      style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[var(--text-muted)]">
        {config.title}
      </p>

      <div
        className="mt-3 rounded-xl border px-3 py-3"
        style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">
              {config.contextLabel}
            </p>
            <p className="mt-1 text-sm font-semibold text-[var(--text-primary)] break-words">
              {resolvedLabel}
            </p>
          </div>

          <div className="text-right">
            <div className="flex items-center justify-end gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: accentColor }} />
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                {config.metricLabel}
              </p>
            </div>
            <p className="mt-1 text-base font-bold" style={{ color: accentColor }}>
              {resolvedValue}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        {config.details.map((detail) => (
          <p key={detail} className="text-[11px] leading-relaxed text-[var(--text-secondary)]">
            {detail}
          </p>
        ))}

        <p className="text-[11px] leading-relaxed text-[var(--text-secondary)]">
          {config.description}
        </p>

        {insight && (
          <p className="text-[11px] font-medium leading-relaxed" style={{ color: accentColor }}>
            {insight}
          </p>
        )}
      </div>
    </div>
  );
}
