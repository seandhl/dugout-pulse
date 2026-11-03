"use client";
import { useState } from "react";
import {
  DataFreshness,
  DataTable,
  DeltaBadge,
  DemoNotice,
  MetricTooltip,
  MomentumGauge,
  PlayerAvatarFallback,
  SampleReliability,
  SearchableCombobox,
  SegmentedFilter,
  SkeletonCard,
  SourceAttribution,
  StatCard,
  Tabs,
  TeamLabel,
  TrendSparkline,
  type Provenance,
} from "@/components/ui";
const data: Provenance = {
  source: "자체 제작 UI fixture v1",
  asOf: "2026-11-03T12:00:00+09:00",
  season: "2026",
  competition: "정규시즌 (가상)",
  sample: 6,
  unit: "회",
};
const rows = [
  {
    id: "demo-01",
    name: "가상 선수 A",
    team: "중립 팀 A",
    role: "타자",
    sample: 6,
  },
  {
    id: "demo-02",
    name: "가상 선수 B",
    team: "중립 팀 B",
    role: "선발",
    sample: 2,
  },
  {
    id: "demo-03",
    name: "가상 선수 C",
    team: "중립 팀 A",
    role: "불펜",
    sample: 3,
  },
];
export default function DesignPreview() {
  const [role, setRole] = useState("전체"),
    [team, setTeam] = useState("all");
  return (
    <div className="ds-preview">
      <header className="ds-page-heading">
        <p className="eyebrow">DESIGN SYSTEM / 01</p>
        <h1>흐름을 읽는 인터페이스</h1>
        <p className="muted">
          DUGOUT PULSE · UI v1 · 개발용 컴포넌트 라이브러리
        </p>
      </header>
      <DemoNotice />
      <Tabs
        items={[
          {
            value: "components",
            label: "컴포넌트",
            content: (
              <>
                <section aria-labelledby="metrics">
                  <div className="section-heading">
                    <h2 id="metrics">01 지표와 맥락</h2>
                    <MetricTooltip label="지표 해석">
                      가상 예시입니다. 변화는 같은 단위의 이전 관측과
                      비교합니다.
                    </MetricTooltip>
                  </div>
                  <div className="ds-grid">
                    <StatCard
                      label="관측 합계 · DEMO"
                      value="18"
                      unit="건"
                      data={data}
                    >
                      <DeltaBadge value={2} unit="건" />
                      <p>
                        <SampleReliability count={6} unit="회" minimum={null} />
                      </p>
                    </StatCard>
                    <article className="panel ds-card">
                      <h3>관측 추이 · DEMO</h3>
                      <TrendSparkline
                        label="가상 이벤트 수"
                        unit="건"
                        values={[2, 3, 1, 4, 3, 5]}
                        description="6회 관측의 가상 이벤트 발생 건수입니다."
                        data={data}
                      />
                    </article>
                  </div>
                  <div className="ds-grid ds-three">
                    {(["타자", "선발", "불펜"] as const).map((r) => (
                      <MomentumGauge key={r} role={r} />
                    ))}
                  </div>
                </section>
                <section aria-labelledby="explore">
                  <h2 id="explore">02 탐색과 비교</h2>
                  <div className="ds-toolbar">
                    <SegmentedFilter
                      label="역할"
                      options={["전체", "타자", "선발", "불펜"]}
                      value={role}
                      onChange={setRole}
                    />
                    <SearchableCombobox
                      label="팀"
                      options={[
                        { value: "all", label: "전체 팀" },
                        { value: "중립 팀 A", label: "중립 팀 A" },
                        { value: "중립 팀 B", label: "중립 팀 B" },
                      ]}
                      value={team}
                      onChange={setTeam}
                    />
                  </div>
                  <DataTable
                    caption="DEMO 선수 목록 · 기세 산정 대기"
                    rows={rows.filter(
                      (r) =>
                        (role === "전체" || r.role === role) &&
                        (team === "all" || r.team === team),
                    )}
                    columns={[
                      {
                        key: "name",
                        label: "선수",
                        render: (r) => (
                          <span className="ds-player">
                            <PlayerAvatarFallback label={r.name} />
                            {r.name}
                          </span>
                        ),
                      },
                      {
                        key: "team",
                        label: "팀",
                        render: (r) => <TeamLabel name={r.team} />,
                      },
                      { key: "role", label: "역할", render: (r) => r.role },
                      {
                        key: "sample",
                        label: "표본 / 상태",
                        render: (r) => (
                          <SampleReliability
                            count={r.sample}
                            unit="회"
                            minimum={null}
                          />
                        ),
                      },
                    ]}
                  />
                  <SourceAttribution data={{ ...data, sample: 11 }} />
                </section>
                <section aria-labelledby="states">
                  <h2 id="states">03 상태와 출처</h2>
                  <DataFreshness asOf={data.asOf} />
                  <div className="ds-grid">
                    <SkeletonCard />
                    <article className="panel ds-card">
                      <h3>게시된 데이터가 없습니다</h3>
                      <p className="ds-meta">
                        승인된 입력을 기다리고 있습니다.
                      </p>
                      <DeltaBadge value={null} unit="점" />
                      <p className="ds-meta">
                        오프라인 안내는 AppShell에서 제공합니다.
                      </p>
                    </article>
                  </div>
                </section>
              </>
            ),
          },
          {
            value: "foundations",
            label: "기반 규칙",
            content: (
              <section>
                <h2>색상 · 글꼴 · 상호작용</h2>
                <div className="ds-swatches">
                  {["bg", "surface", "ink", "muted", "accent", "line"].map(
                    (t) => (
                      <div key={t}>
                        <span style={{ background: "var(--" + t + ")" }} />
                        {t}
                      </div>
                    ),
                  )}
                </div>
                <p>
                  한국어 시스템 글꼴: Apple SD Gothic Neo / Malgun Gothic /
                  sans-serif. 폰트 파일과 외부 요청을 추가하지 않습니다. 실제
                  글꼴과 굵기는 운영체제에 따라 달라집니다.
                </p>
                <p>
                  간격 4 / 8 / 12 / 16 / 24 / 32px · 숫자 tabular-nums · 포커스
                  3px · 터치 영역 최소 44px.
                </p>
                <p>
                  Tab으로 이동, 탭 목록은 방향키로 전환합니다. 팀 검색은 입력 후
                  ↓로 결과에 진입하고 Enter로 선택, Escape로 닫습니다. 모션 감소
                  설정에서는 애니메이션을 끕니다.
                </p>
              </section>
            ),
          },
        ]}
      />
    </div>
  );
}
