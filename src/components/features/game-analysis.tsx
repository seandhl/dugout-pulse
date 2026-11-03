"use client";
import { useId, useState } from "react";
import { gameTimeline } from "@/ui/game-timeline";
const definitions: Record<string, string> = {
  avg: "AVG = H/AB",
  obp: "OBP = (H+BB+HBP)/(AB+BB+HBP+SF)",
  slg: "SLG = 총루타/AB",
  ops: "OPS = OBP+SLG",
  iso: "ISO = SLG−AVG",
  kPct: "K% = SO/PA (타자), SO/BF (투수)",
  bbPct: "BB% = BB/PA (타자), BB/BF (투수)",
  era: "ERA = 27×ER/아웃",
  whip: "WHIP = 3×(H+BB)/아웃",
  kPer9: "K/9 = 27×SO/아웃",
  bbPer9: "BB/9 = 27×BB/아웃",
  kMinusBbPct: "K-BB% = (SO−BB)/BF",
};

type Value = { value: number | null; unit?: string; reason?: string | null };
type Stats = { metrics: Record<string, Value> };
type Game = {
  id: string;
  date: string;
  order: number;
  opponent: string;
  counts: Record<string, number | null | undefined>;
  stats: Stats;
  cumulative: Stats;
  moving: Stats;
  source: string;
  inputRef: string;
  ip?: string;
  result?: string;
  role?: string;
};
const labels: Record<string, string> = {
  avg: "AVG",
  ops: "OPS",
  obp: "OBP",
  slg: "SLG",
  iso: "ISO",
  kPct: "K%",
  bbPct: "BB%",
  era: "ERA",
  whip: "WHIP",
  kPer9: "K/9",
  bbPer9: "BB/9",
  kMinusBbPct: "K-BB%",
};
const finite = (m?: Value) =>
  m?.value != null && Number.isFinite(m.value) ? m.value : null;
const display = (m?: Value) => {
  const v = finite(m);
  return v === null
    ? "N/A"
    : m?.unit === "percent"
      ? `${(v * 100).toFixed(1)}%`
      : v.toFixed(3);
};
const cell = (v: unknown) =>
  `"${String(v ?? "N/A")
    .replace(/^[=+@\-\t\r]/, "'$&")
    .replaceAll('"', '""')}"`;
export function GameAnalysis({
  games,
  kind,
  asOf,
  season,
  competition,
  exportPolicy,
}: {
  games: Game[];
  kind: "batting" | "pitching";
  asOf: string;
  season: number;
  competition: string;
  exportPolicy: { demo: boolean; exportAllowed: boolean; licenseId: string };
}) {
  const uid = useId();
  const [metric, setMetric] = useState(kind === "batting" ? "avg" : "era");
  const [opponent, setOpponent] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [validOnly, setValidOnly] = useState(false);
  const [selected, setSelected] = useState("");
  const [hovered, setHovered] = useState<string | null>(null);
  const keys =
    kind === "batting"
      ? ["avg", "ops", "obp", "slg", "iso", "kPct", "bbPct"]
      : ["era", "whip", "kPct", "bbPct", "kPer9", "bbPer9", "kMinusBbPct"];
  const rawKeys =
    kind === "batting"
      ? ["pa", "ab", "h", "doubles", "triples", "hr", "bb", "hbp", "sf", "so"]
      : ["bf", "outsRecorded", "h", "r", "er", "bb", "so", "hr", "pitches"];
  const timeline = gameTimeline(games);
  const positions = new Map(timeline.map((g, i) => [g.id, i]));
  const rows = timeline.filter(
    (g) =>
      (!opponent || g.opponent === opponent) &&
      (!from || g.date >= from) &&
      (!to || g.date <= to) &&
      (!validOnly || finite(g.stats.metrics[metric]) !== null),
  );
  const values = rows
    .flatMap((g) =>
      [g.stats, g.cumulative, g.moving].map((s) => finite(s.metrics[metric])),
    )
    .filter((v): v is number => v !== null);
  // Geometry only: all statistical values arrive from the server engine.
  const min = Math.min(0, ...values),
    max = Math.max(1, ...values);
  const chartWidth = Math.max(640, rows.length * 48 + 110);
  const x = (i: number) =>
    55 + (i * (chartWidth - 120)) / Math.max(1, rows.length - 1);
  const y = (v: number) => 175 - ((v - min) / (max - min)) * 145;
  const active = rows.find((g) => g.id === hovered);
  const focusRow = (g: Game) => {
    setSelected(g.id);
    document.getElementById(`${uid}-${g.id}`)?.focus({ preventScroll: true });
    document
      .getElementById(`${uid}-${g.id}`)
      ?.scrollIntoView({ block: "nearest", inline: "nearest" });
  };
  const raw = (g: Game) =>
    rawKeys
      .map(
        (k) =>
          `${k === "outsRecorded" ? "outs" : k.toUpperCase()} ${g.counts[k] ?? "N/A"}`,
      )
      .join(" · ");
  const tooltip = (g: Game) =>
    `${g.date} / DH ${g.order} · ${g.opponent} · ${labels[metric]} 경기 ${display(g.stats.metrics[metric])} / 누적 ${display(g.cumulative.metrics[metric])} / 이동 ${display(g.moving.metrics[metric])} · ${raw(g)}`;
  function download() {
    if (!(exportPolicy.demo || exportPolicy.exportAllowed === true)) return;
    const header = [
      "gameId",
      "date",
      "DH",
      "opponent",
      ...(kind === "pitching" ? ["역할", "IP", "결과 (개인 W/L)"] : []),
      ...rawKeys,
      ...keys,
      `누적 ${labels[metric]}`,
      `5출전 이동 ${labels[metric]}`,
      "source",
      "inputRef",
      "asOf",
      "season",
      "competition",
      "license",
    ];
    const lines = rows.map((g) => [
      g.id,
      g.date,
      g.order,
      g.opponent,
      ...(kind === "pitching"
        ? [g.role === "starter" ? "선발" : "불펜", g.ip, g.result]
        : []),
      ...rawKeys.map((k) => g.counts[k]),
      ...keys.map((k) => display(g.stats.metrics[k])),
      display(g.cumulative.metrics[metric]),
      display(g.moving.metrics[metric]),
      g.source,
      g.inputRef,
      asOf,
      season,
      competition,
      exportPolicy.licenseId,
    ]);
    const url = URL.createObjectURL(
      new Blob(
        [
          "\uFEFF" +
            [header, ...lines].map((r) => r.map(cell).join(",")).join("\r\n"),
        ],
        { type: "text/csv;charset=utf-8" },
      ),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `${kind}-${season}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }
  return (
    <section className="panel game-analysis" aria-label="경기 분석">
      <h2>경기별 누적·이동 추이와 상세 로그</h2>
      {exportPolicy.demo && (
        <span className="badge">DEMO · 자체 제작 fixture</span>
      )}
      <p>
        {season}{" "}
        {competition === "regular"
          ? "정규시즌"
          : competition === "postseason"
            ? "포스트시즌"
            : competition}{" "}
        · 데이터 기준일 (asOf) {asOf} · 출처{" "}
        {Array.from(new Set(games.map((g) => g.source))).join(", ") || "N/A"}
      </p>
      <p>
        {definitions[metric]} · 원시 기록의 분자·분모 합산 후 계산하며 경기별
        비율을 평균하지 않습니다. %는 비율×100입니다.
      </p>
      <p>
        출전 사이 기록 없는 날짜:{" "}
        {timeline
          .filter((g) => (g.gapDays ?? 0) > 0)
          .map((g) => `${g.date} 직전 ${g.gapDays}일`)
          .join(" · ") || "없음"}
        . 팀 경기 일정·결장 사유는 미확인입니다. X축 간격은 달력 일수가 아닌
        출전 순서입니다.
      </p>
      <div className="analysis-controls">
        <label>
          차트 지표{" "}
          <select value={metric} onChange={(e) => setMetric(e.target.value)}>
            {keys.map((k) => (
              <option key={k} value={k}>
                {labels[k]}
              </option>
            ))}
          </select>
        </label>
        <label>
          상대팀 필터{" "}
          <select
            value={opponent}
            onChange={(e) => setOpponent(e.target.value)}
          >
            <option value="">전체</option>
            {[...new Set(games.map((g) => g.opponent))].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <label>
          시작일{" "}
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label>
          종료일{" "}
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
        <label>
          <input
            type="checkbox"
            checked={validOnly}
            onChange={(e) => setValidOnly(e.target.checked)}
          />{" "}
          경기 지표 N/A 제외
        </label>
        <button
          onClick={() => {
            setOpponent("");
            setFrom("");
            setTo("");
            setValidOnly(false);
          }}
        >
          필터 초기화
        </button>
      </div>
      <p>
        실선·원: 선택 기간 누적 / 점선·사각: 최대 5출전 이동 / 삼각: 경기 값.
        X축은 날짜·DH 순서, Y축은 {labels[metric]}
        {metric.includes("Pct") ? " (%)" : ""}입니다. 필터는 표시만 변경하며
        누적·이동의 계산 기간은 유지합니다.
      </p>
      <p>
        초기 이동 구간은 1–4출전입니다. 적은 PA/BF/outs에서는 변동이 큽니다.
        N/A는 결측·분모 0이며 선을 연결하지 않습니다. 기록 공백과 필터로 숨긴
        경기 사이도 연결하지 않습니다. 휴식·결장 사유는 미확인입니다.
      </p>
      <p role="status">
        표시 {rows.length}경기 / 선택 기간 {games.length}경기
        {from && to && from > to ? " · 시작일이 종료일보다 늦습니다." : ""}
      </p>
      {!rows.length ? (
        <p>선택 조건에 해당하는 경기가 없습니다.</p>
      ) : !values.length ? (
        <p>
          차트 산출 불가: 선택 지표의 필수 기록이 없거나 분모가 0입니다. 원시
          기록은 표에서 확인하세요.
        </p>
      ) : (
        <div
          className="analysis-chart-scroll"
          role="region"
          aria-label="경기별 추이 가로 스크롤 영역"
          // Scrollable chart must be keyboard reachable.
          // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
          tabIndex={0}
        >
          <p className="scroll-hint">
            차트는 가로로 밀거나 영역에 포커스한 뒤 ← → 키로 볼 수 있습니다.
          </p>
          <svg
            viewBox={`0 0 ${chartWidth} 220`}
            style={{ minWidth: chartWidth }}
            className="analysis-chart"
            role="group"
            aria-label={`${labels[metric]} 경기별 추이. 각 점에서 Enter로 상세 행 이동`}
          >
            <path
              d={`M55 25V175H${chartWidth - 50}`}
              fill="none"
              stroke="currentColor"
            />
            <text x="0" y="25">
              {display({
                value: max,
                unit: rows[0]?.stats.metrics[metric]?.unit,
              })}
            </text>
            <text x="0" y="175">
              {display({
                value: min,
                unit: rows[0]?.stats.metrics[metric]?.unit,
              })}
            </text>
            {(["cumulative", "moving", "stats"] as const).map((series, si) => (
              <g
                key={series}
                fill={
                  si === 0 ? "var(--chart-primary)" : "var(--chart-secondary)"
                }
                stroke={
                  si === 0 ? "var(--chart-primary)" : "var(--chart-secondary)"
                }
              >
                {rows.map((g, i) => {
                  const v = finite(g[series].metrics[metric]),
                    prev =
                      i > 0 &&
                      positions.get(g.id) ===
                        positions.get(rows[i - 1].id)! + 1 &&
                      g.gapDays === 0
                        ? finite(rows[i - 1][series].metrics[metric])
                        : null;
                  if (v === null) return null;
                  return (
                    <g key={g.id}>
                      {si < 2 && prev !== null && (
                        <line
                          x1={x(i - 1)}
                          y1={y(prev)}
                          x2={x(i)}
                          y2={y(v)}
                          strokeWidth="2"
                          strokeDasharray={si === 1 ? "5 4" : undefined}
                        />
                      )}
                      <g
                        role="button"
                        tabIndex={0}
                        aria-label={`${g.date} DH ${g.order} ${g.opponent} ${["누적", "이동", "경기"][si]} ${display(g[series].metrics[metric])} 상세 행 이동`}
                        onClick={() => focusRow(g)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            focusRow(g);
                          }
                        }}
                        onFocus={() => setHovered(g.id)}
                        onBlur={() => setHovered(null)}
                        onMouseEnter={() => setHovered(g.id)}
                        onMouseLeave={() => setHovered(null)}
                      >
                        <title>{tooltip(g)}</title>
                        <circle
                          cx={x(i)}
                          cy={y(v)}
                          r="23"
                          fill="transparent"
                          stroke="none"
                        />
                        {si === 0 ? (
                          <circle cx={x(i)} cy={y(v)} r="4" />
                        ) : si === 1 ? (
                          <rect
                            x={x(i) - 4}
                            y={y(v) - 4}
                            width="8"
                            height="8"
                          />
                        ) : (
                          <path d={`M${x(i)} ${y(v) - 5}l5 9h-10z`} />
                        )}
                      </g>
                    </g>
                  );
                })}
              </g>
            ))}
            {[
              ...new Set([
                0,
                Math.floor((rows.length - 1) / 2),
                rows.length - 1,
              ]),
            ].map((i) => (
              <text key={i} x={x(i)} y="204" textAnchor="middle">
                {rows[i].date.slice(5)} / DH{rows[i].order}
              </text>
            ))}
          </svg>
        </div>
      )}
      <div className="analysis-tooltip" role="status" aria-live="polite">
        {active
          ? tooltip(active)
          : "점에 마우스를 올리거나 키보드로 포커스하면 경기별 원시 기록을 표시합니다."}
      </div>
      {exportPolicy.demo || exportPolicy.exportAllowed === true ? (
        <button onClick={download} disabled={!rows.length}>
          표 CSV 내보내기{exportPolicy.demo ? " (DEMO)" : ""}
        </button>
      ) : (
        <p>출처 라이선스의 내보내기 승인이 없어 CSV를 제공하지 않습니다.</p>
      )}
      <p className="scroll-hint">
        표를 가로로 밀거나 포커스한 뒤 ← → 키로 더 볼 수 있습니다.
      </p>
      {/* Keyboard access is required for horizontal table scrolling. */}
      <div
        className="ds-table-wrap"
        role="region"
        aria-label="차트 대체 상세 표 가로 스크롤"
        // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- Enables keyboard scrolling of the table region.
        tabIndex={0}
      >
        <table className="ds-table">
          <caption>
            차트 대체 표 · 경기별 원시 기록과 서버 통계 · {season} {competition}{" "}
            · as-of {asOf}
          </caption>
          <thead>
            <tr>
              {[
                "날짜 / DH",
                "직전 출전 이후 기록 공백",
                "상대팀",
                ...(kind === "pitching"
                  ? ["역할", "IP", "결과 (개인 W/L)"]
                  : []),
                ...rawKeys.map((k) =>
                  k === "outsRecorded" ? "outs" : k.toUpperCase(),
                ),
                ...keys.map((k) => labels[k]),
                `누적 ${labels[metric]}`,
                `5출전 이동 ${labels[metric]}`,
                "원천",
              ].map((k) => (
                <th key={k} scope="col">
                  {k}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((g) => (
              <tr
                key={g.id}
                id={`${uid}-${g.id}`}
                tabIndex={-1}
                className={selected === g.id ? "analysis-selected" : undefined}
              >
                <th scope="row">
                  {g.date} / DH {g.order}
                  {selected === g.id && <span> · 선택됨</span>}
                </th>
                <td>
                  {g.gapDays === null ? (
                    <span className="metric-na">N/A · 선택 창 첫 출전</span>
                  ) : (
                    `${g.gapDays}일`
                  )}
                </td>
                <td>{g.opponent}</td>
                {kind === "pitching" && (
                  <>
                    <td>{g.role === "starter" ? "선발" : "불펜"}</td>
                    <td>{g.ip ?? "N/A"}</td>
                    <td>{g.result ?? "미제공"}</td>
                  </>
                )}
                {rawKeys.map((k) => (
                  <td key={k}>{g.counts[k] ?? "N/A"}</td>
                ))}
                {keys.map((k) => (
                  <td
                    key={k}
                    className={
                      finite(g.stats.metrics[k]) === null
                        ? "metric-na"
                        : undefined
                    }
                  >
                    {display(g.stats.metrics[k])}
                  </td>
                ))}
                <td>{display(g.cumulative.metrics[metric])}</td>
                <td>{display(g.moving.metrics[metric])}</td>
                <td>
                  {g.source} · {g.inputRef}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
