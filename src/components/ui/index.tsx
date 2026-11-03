"use client";
import { formatKst } from "@/ui/format";
import { useId, useState, type ReactNode } from "react";
import { Tabs as RT, Tooltip, Popover } from "radix-ui";
export type Provenance = {
  source: string;
  asOf: string;
  season: string;
  competition: string;
  sample: number;
  unit: string;
};
export function SourceAttribution({ data: d }: { data: Provenance }) {
  return (
    <p className="ds-meta">
      출처: {d.source} · {d.season} · {d.competition} · 표본 {d.sample}
      {d.unit} · 기준일 <time dateTime={d.asOf}>{formatKst(d.asOf)}</time>
    </p>
  );
}
export function DemoNotice() {
  return (
    <aside className="ds-notice">
      <span className="badge">DEMO</span> 자체 제작 UI fixture · 실제 선수
      기록이 아닙니다.
    </aside>
  );
}
export function DataFreshness({ asOf }: { asOf: string }) {
  return (
    <p className="ds-meta">
      기준일 <time dateTime={asOf}>{formatKst(asOf)}</time> · 자동 갱신 없음
    </p>
  );
}
export function SampleReliability({
  count,
  unit,
  minimum,
}: {
  count: number;
  unit: string;
  minimum: number | null;
}) {
  return (
    <span className="ds-meta">
      표본 {count}
      {unit} ·{" "}
      {minimum === null
        ? "신뢰도 기준 미정"
        : count < minimum
          ? "표본 부족"
          : "최소 표본 충족"}
    </span>
  );
}
export function DeltaBadge({
  value,
  unit,
}: {
  value: number | null;
  unit: string;
}) {
  return (
    <span className="ds-delta">
      {value === null
        ? "변화 산정 대기"
        : (value > 0 ? "↑ +" : value < 0 ? "↓ " : "→ ") + value + unit}
    </span>
  );
}
export function StatCard({
  label,
  value,
  unit,
  children,
  data,
}: {
  label: string;
  value: string;
  unit: string;
  children?: ReactNode;
  data: Provenance;
}) {
  return (
    <article className="panel ds-card">
      <h3>{label}</h3>
      <p className="ds-value">
        {value} <span>{unit}</span>
      </p>
      {children}
      <SourceAttribution data={data} />
    </article>
  );
}
export function PlayerAvatarFallback({ label }: { label: string }) {
  return (
    <span
      className="ds-avatar"
      role="img"
      aria-label={label + " 중립 플레이스홀더"}
    >
      ◇
    </span>
  );
}
export function TeamLabel({ name }: { name: string }) {
  return <span>◇ {name}</span>;
}
export function MetricTooltip({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <Tooltip.Provider>
      <Tooltip.Root>
        <Tooltip.Trigger className="ds-help">{label} ⓘ</Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content className="ds-tooltip" sideOffset={8}>
            {children}
            <Tooltip.Arrow />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
export function SkeletonCard() {
  return (
    <div className="panel ds-card" role="status" aria-label="지표 불러오는 중">
      <div className="ds-skeleton" />
      <div className="ds-skeleton" />
      <span className="ds-meta">지표를 불러오는 중입니다.</span>
    </div>
  );
}
export function MomentumGauge({ role }: { role: "타자" | "선발" | "불펜" }) {
  return (
    <article className="panel ds-card">
      <h3>{role} 기세</h3>
      <p className="ds-value">—</p>
      <p className="ds-meta">산정 대기 · 모델 미확정</p>
      <p className="ds-meta">
        역할별 산식·최소 표본 확정 후 표시합니다. 휴식·결장 사유는 추정하지
        않습니다.
      </p>
    </article>
  );
}
export function TrendSparkline({
  values,
  label,
  unit,
  description,
  data,
}: {
  values: readonly number[];
  label: string;
  unit: string;
  description: string;
  data: Provenance;
}) {
  const id = useId();
  if (
    values.length < 2 ||
    values.some((v) => !Number.isFinite(v)) ||
    !label.trim() ||
    !unit.trim() ||
    !description.trim() ||
    !data.source.trim() ||
    data.sample <= 0
  )
    return <p role="status">차트 표시 조건이 부족합니다.</p>;
  const min = Math.min(0, ...values),
    max = Math.max(1, ...values);
  const points = values
    .map(
      (v, i) =>
        40 +
        (i * 260) / (values.length - 1) +
        "," +
        (100 - ((v - min) / (max - min)) * 80),
    )
    .join(" ");
  return (
    <figure className="ds-chart">
      <figcaption id={id}>
        {label} · {unit}
      </figcaption>
      <svg
        viewBox="0 0 320 135"
        role="img"
        aria-labelledby={id}
        aria-describedby={id + "-desc"}
      >
        <path d="M40 15V100H305" fill="none" stroke="currentColor" />
        <text x="2" y="24">
          {max}
        </text>
        <text x="2" y="104">
          {min}
        </text>
        <polyline
          points={points}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="3"
        />
        <text x="40" y="125">
          1회
        </text>
        <text x="265" y="125">
          {values.length}회
        </text>
      </svg>
      <p id={id + "-desc"} className="ds-meta">
        {description} 값: {values.join(", ")}
        {unit}. 가로축: 관측 순서, 세로축: {unit}.
      </p>
      <SourceAttribution data={data} />
    </figure>
  );
}
export function Tabs({
  items,
}: {
  items: { value: string; label: string; content: ReactNode }[];
}) {
  return (
    <RT.Root defaultValue={items[0]?.value}>
      <RT.List className="ds-tabs" aria-label="디자인 시스템 영역">
        {items.map((i) => (
          <RT.Trigger key={i.value} value={i.value}>
            {i.label}
          </RT.Trigger>
        ))}
      </RT.List>
      {items.map((i) => (
        <RT.Content className="ds-tabpanel" key={i.value} value={i.value}>
          {i.content}
        </RT.Content>
      ))}
    </RT.Root>
  );
}
export function SegmentedFilter({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly string[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <fieldset className="ds-segment">
      <legend>{label}</legend>
      <div>
        {options.map((o) => (
          <button
            key={o}
            aria-pressed={value === o}
            onClick={() => onChange(o)}
          >
            {o}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
export function SearchableCombobox({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false),
    [query, setQuery] = useState("");
  const id = useId();
  const filtered = options.filter((o) => o.label.includes(query));
  function select(v: string) {
    onChange(v);
    setOpen(false);
  }
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger className="ds-select">
        {label}: {options.find((o) => o.value === value)?.label ?? "선택"} ▾
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="ds-popover"
          sideOffset={6}
          aria-label={label + " 선택"}
        >
          <label htmlFor={id}>{label} 검색</label>
          <input
            id={id}
            role="combobox"
            aria-expanded={open}
            aria-controls={id + "-list"}
            aria-autocomplete="list"
            maxLength={100}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                document.getElementById(id + "-0")?.focus();
              }
              if (e.key === "Enter" && filtered.length === 1)
                select(filtered[0].value);
            }}
          />
          <div id={id + "-list"} role="listbox" aria-label={label}>
            {filtered.map((o, i) => (
              <div
                key={o.value}
                id={id + "-" + i}
                role="option"
                aria-selected={value === o.value}
                tabIndex={0}
                onClick={() => select(o.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    select(o.value);
                  }
                  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                    e.preventDefault();
                    document
                      .getElementById(
                        id +
                          "-" +
                          ((i +
                            (e.key === "ArrowDown" ? 1 : -1) +
                            filtered.length) %
                            filtered.length),
                      )
                      ?.focus();
                  }
                }}
              >
                {o.label}
              </div>
            ))}
          </div>
          {!filtered.length && <p role="status">검색 결과가 없습니다.</p>}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
export function DataTable<T extends { id: string }>({
  caption,
  rows,
  columns,
}: {
  caption: string;
  rows: readonly T[];
  columns: readonly {
    key: string;
    label: string;
    render: (row: T) => ReactNode;
  }[];
}) {
  return (
    <div
      className="ds-table-wrap"
      role="region"
      aria-label={caption}
      // Scrollable table region must be keyboard reachable.
      // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
      tabIndex={0}
    >
      <table className="ds-table">
        <caption>
          {caption}
          <span className="scroll-hint">
            가로로 밀거나 표에 포커스한 뒤 ← → 키로 더 볼 수 있습니다.
          </span>
        </caption>
        <thead>
          <tr>
            {columns.map((c) => (
              <th scope="col" key={c.key}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((r) => (
              <tr key={r.id}>
                {columns.map((c) => (
                  <td key={c.key}>{c.render(r)}</td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={columns.length}>조건에 맞는 데이터가 없습니다.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
