export const metadata = { alternates: { canonical: "/compare" } };
import Link from "next/link";
import { readDemo } from "@/server/db/demo";
import { compareQuery, selectComparison } from "@/server/reads/compare";
import { DetailFooter } from "@/components/features/detail-shared";
export const dynamic = "force-dynamic";
const labels: Record<string, string> = {
  batter: "타자",
  starter: "선발",
  reliever: "불펜",
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const parsed = compareQuery.safeParse(await searchParams);
  if (!parsed.success)
    return (
      <>
        <h1>선수 비교</h1>
        <p role="alert">비교 조건이 올바르지 않습니다.</p>
        <Link href="/compare">조건 초기화</Link>
      </>
    );
  const q = parsed.data;
  const f = readDemo();
  const view = selectComparison(f, q);
  const ids = q.players.split(",").slice(0, 2);
  const href = (slot: number, id: string) => {
    const next = [ids[0] ?? "", ids[1] ?? ""];
    next[slot] = id;
    const params = new URLSearchParams({
      players: next.join(","),
      window: q.window,
      season: String(q.season ?? f.season),
      competition: q.competition,
      q: q.q,
    });
    for (const [i, r] of [q.role1, q.role2].entries())
      if (r && i !== slot) params.set(`role${i + 1}`, r);
    return `/compare?${params}`;
  };
  const matches = f.players.filter(
    (p) =>
      !q.q ||
      `${p.displayName} ${p.playerId} ${f.teams.find((t) => t.teamId === p.teamId)?.name}`
        .toLowerCase()
        .includes(q.q.toLowerCase()),
  );
  return (
    <>
      <header className="page-heading">
        <h1>선수 비교</h1>
        <p>DEMO · 합성 기록 · 공식 선수 기록이 아닙니다.</p>
      </header>
      <form
        action="/compare"
        key={`${q.players}/${q.window}/${q.q}/${q.role1}/${q.role2}`}
      >
        <input type="hidden" name="players" value={q.players} />
        <label>
          시즌{" "}
          <select name="season" defaultValue={q.season ?? f.season}>
            <option value={f.season}>{f.season}</option>
          </select>
        </label>{" "}
        <label>
          대회{" "}
          <select name="competition" defaultValue={q.competition}>
            <option value="regular">정규시즌</option>
            <option value="postseason">포스트시즌 (기록 없음)</option>
          </select>
        </label>{" "}
        <label>
          기간{" "}
          <select name="window" defaultValue={q.window}>
            <option value="5">최근 5출전</option>
            <option value="10">최근 10출전</option>
            <option value="season">시즌 전체</option>
          </select>
        </label>
        {[0, 1].map((i) => {
          const p = f.players.find((p) => p.playerId === ids[i]);
          return (
            p && (
              <label key={i}>
                {" "}
                선수 {i + 1} 역할{" "}
                <select
                  name={`role${i + 1}`}
                  defaultValue={
                    (i === 0 ? q.role1 : q.role2) ?? p.listedRoles[0]
                  }
                >
                  {p.listedRoles.map((r) => (
                    <option key={r} value={r}>
                      {labels[r]}
                    </option>
                  ))}
                </select>
              </label>
            )
          );
        })}
        <label>
          선수 검색{" "}
          <input
            name="q"
            type="search"
            defaultValue={q.q}
            maxLength={100}
            placeholder="선수명·ID·팀"
          />
        </label>{" "}
        <button type="submit">검색·조건 적용</button>
      </form>
      <p>
        동일 시즌·대회·최근 출전 수를 적용합니다. 실제 출전 날짜는 다를 수
        있습니다. 휴식·결장과 엔트리는 미확인입니다.
      </p>
      {!view.available && (
        <p role="status">해당 시즌·대회 기록 없음 · 비교 제외</p>
      )}
      {view.asOfMismatch && (
        <p role="alert">
          서로 다른 데이터 시점(as-of)입니다. 직접 비교에 주의하세요.
        </p>
      )}
      {view.slots.filter(Boolean).length === 2 && ids[0] === ids[1] && (
        <p role="status">동일 선수입니다. 다른 선수를 선택하세요 · 비교 제외</p>
      )}
      {view.slots.filter(Boolean).length === 2 &&
        ids[0] !== ids[1] &&
        !view.comparable && (
          <p role="alert">
            서로 다른 역할: 점수/능력의 우열 비교 불가. 각자의 데이터만 분리
            표시합니다.
          </p>
        )}
      <div className="compare-grid">
        {[0, 1].map((i) => {
          const s = view.slots[i];
          return (
            <section className="panel" key={i} aria-label={`선수 ${i + 1}`}>
              <h2>
                선수 {i + 1}: {s?.d.player.displayName ?? "선택 필요"}
              </h2>
              <Link href={href(i, "")}>선수 {i + 1} 선택 해제</Link>
              {ids[i] && !s && view.available && (
                <p role="status">
                  선수를 찾을 수 없거나 역할이 맞지 않습니다 · 비교 제외
                </p>
              )}
              {s && (
                <>
                  <p>
                    {labels[s.role]} · {s.d.seasonYear} {s.d.competition} ·{" "}
                    {q.window === "season"
                      ? "시즌 전체"
                      : `최근 ${q.window}출전`}
                  </p>
                  <p>
                    sample count: {s.d.recent.sample.appearances}출전 ·{" "}
                    {"pa" in s.d.recent.sample
                      ? `${s.d.recent.sample.pa ?? "미확인"} PA`
                      : `${s.d.recent.sample.bf ?? "미확인"} BF · ${s.d.recent.sample.outsRecorded ?? "미확인"} outs`}
                  </p>
                  {q.window !== "season" &&
                    s.d.recent.sample.appearances < Number(q.window) && (
                      <p>요청 출전 수 미달 · 기록 부족, 직접 비교 제외</p>
                    )}
                  <p>
                    최근 출전 {s.d.lastAppearance ?? "없음"} · 신뢰도{" "}
                    {s.d.momentum?.confidence ?? "산정 불가"} · 모델 상태{" "}
                    {s.d.momentum?.status ?? "시즌 기세 미제공"}
                  </p>
                  <p>
                    IP의 .1/.2는 1/2아웃입니다. 비율은 outs/3으로 계산합니다.
                    IP는 투구량입니다.
                  </p>
                  <dl>
                    {s.metrics.map((m) => {
                      const other = view.slots[1 - i]?.metrics.find(
                        (x) => x.label === m.label,
                      );
                      const eligible =
                        view.comparable &&
                        m.value !== null &&
                        other?.value != null &&
                        (q.window === "season" ||
                          view.slots.every(
                            (x) =>
                              x &&
                              x.d.recent.sample.appearances >= Number(q.window),
                          ));
                      const max = Math.max(
                        Math.abs(m.value ?? 0),
                        Math.abs(other?.value ?? 0),
                        0.001,
                      );
                      return (
                        <div key={m.label}>
                          <dt>
                            {m.label}
                            {m.lower ? " (낮을수록 좋음)" : ""}
                          </dt>
                          <dd>
                            {m.text}
                            {m.value === null
                              ? " · 결측/기록 부족 · 비교 제외"
                              : ""}
                            {m.denominator !== null &&
                              ` · 분모 ${m.denominator}`}
                            {eligible && (
                              <div
                                className="compare-track"
                                role="img"
                                aria-label={`${m.label} ${m.text} 절댓값 상대 크기`}
                              >
                                <span
                                  style={{
                                    width: `${(Math.abs(m.value!) / max) * 100}%`,
                                  }}
                                />
                              </div>
                            )}
                          </dd>
                        </div>
                      );
                    })}
                  </dl>
                  <DetailFooter d={s.d} />
                </>
              )}
            </section>
          );
        })}
      </div>
      <section className="panel">
        <h2>검색 결과</h2>
        <p>{matches.length}명 · 각 선수의 선택·교체 링크를 사용하세요.</p>
        {!matches.length && <p>검색 결과 없음</p>}
        <ul>
          {matches.map((p) => (
            <li key={p.playerId}>
              {p.displayName} · {p.listedRoles.map((r) => labels[r]).join("/")}{" "}
              ·{" "}
              <Link href={href(0, p.playerId)}>
                선수 1로 {p.displayName} 선택
              </Link>
              {" · "}
              <Link href={href(1, p.playerId)}>
                선수 2로 {p.displayName} 선택
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <Link href="/compare">선택 초기화</Link>
    </>
  );
}
