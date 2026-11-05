import type { PlayerDetail } from "@/server/reads/player-detail";
import type { PitcherDetail } from "@/server/reads/pitcher-detail";
import { formatKst } from "@/ui/format";

type RecordItem = {
  label: string;
  value: number | string | null;
  description: string;
};
export function RecordGrid({ items }: { items: RecordItem[] }) {
  return (
    <dl className="season-record-grid">
      {items.map((item) => (
        <div className="panel" key={item.label}>
          <dt>{item.label}</dt>
          <dd className="ds-value">{item.value ?? "데이터 없음"}</dd>
          <dd className="ds-meta">{item.description}</dd>
        </div>
      ))}
    </dl>
  );
}
const ratio = (value: number | null, digits: number) =>
  value === null ? null : value.toFixed(digits);
export function SeasonRecords({ d }: { d: PlayerDetail | PitcherDetail }) {
  const s = d.season;
  const items: RecordItem[] =
    "roleSeason" in d
      ? [
          {
            label: "ERA · 평균자책점",
            value: ratio(d.season.metrics.era.value, 2),
            description: "9이닝당 자책점. 합산 아웃 수로 계산합니다.",
          },
          {
            label: "WHIP",
            value: ratio(d.season.metrics.whip.value, 2),
            description: "이닝당 피안타와 볼넷 허용 수입니다.",
          },
          {
            label: "IP · 이닝",
            value:
              d.season.totals.outsRecorded === null
                ? null
                : d.season.inningsDisplay,
            description: "소수점 뒤는 아웃 수: 5.2는 5⅔이닝입니다.",
          },
          {
            label: "SO · 탈삼진",
            value: s.totals.so,
            description: "삼진으로 잡은 상대 타자 수입니다.",
          },
          {
            label: "BB · 볼넷",
            value: s.totals.bb,
            description: "고의사구를 포함한 볼넷 수입니다.",
          },
          {
            label: "G · 경기 수",
            value: s.sample.appearances || null,
            description: "모든 투구 역할의 시즌 등판 경기 수입니다.",
          },
          {
            label: "GS · 선발 등판",
            value: d.seasonRecords.gamesStarted,
            description: "선발 역할로 등판한 경기 수입니다.",
          },
          {
            label: "W · 승",
            value: null,
            description: "승리 투수 기록은 제공되지 않습니다.",
          },
          {
            label: "L · 패",
            value: null,
            description: "패전 투수 기록은 제공되지 않습니다.",
          },
          {
            label: "SV · 세이브",
            value: d.season.totals.sv,
            description: "세이브로 기록된 횟수. 현재 데모 기록에는 없습니다.",
          },
          {
            label: "HLD · 홀드",
            value: d.season.totals.hld,
            description: "홀드로 기록된 횟수. 현재 데모 기록에는 없습니다.",
          },
        ]
      : [
          {
            label: "AVG · 타율",
            value: ratio(d.season.metrics.avg.value, 3),
            description: "안타 ÷ 타수입니다.",
          },
          {
            label: "OBP · 출루율",
            value: ratio(d.season.metrics.obp.value, 3),
            description:
              "(안타+볼넷+사구) ÷ (타수+볼넷+사구+희생플라이). 사구·희생플라이 누락 시 데이터 없음입니다.",
          },
          {
            label: "SLG · 장타율",
            value: ratio(d.season.metrics.slg.value, 3),
            description: "총루타 ÷ 타수입니다.",
          },
          {
            label: "OPS",
            value: ratio(d.season.metrics.ops.value, 3),
            description: "출루율+장타율. 필수 기록 누락 시 계산하지 않습니다.",
          },
          {
            label: "wRC+ · 조정 득점 창출력",
            value: null,
            description:
              "리그·구장 환경을 보정한 타격 생산성 지표로 100이 리그 평균입니다. 120은 평균보다 20% 높은 생산성을 뜻합니다. 공급값과 검증된 보정 데이터가 없어 계산하지 않습니다.",
          },
          {
            label: "G · 경기 수",
            value: s.sample.appearances || null,
            description: "시즌 타격 출전 경기 수입니다.",
          },
          {
            label: "PA · 타석",
            value: d.season.sample.pa,
            description: "타격을 위해 들어선 타석 수입니다.",
          },
          {
            label: "H · 안타",
            value: s.totals.h,
            description: "단타와 모든 장타를 포함한 안타 수입니다.",
          },
          {
            label: "HR · 홈런",
            value: s.totals.hr,
            description: "홈런 수입니다.",
          },
          {
            label: "RBI · 타점",
            value: d.seasonRecords.rbi,
            description: "원시 타점 기록을 합산한 값입니다.",
          },
          {
            label: "SB · 도루",
            value: d.season.totals.sb,
            description: "도루 성공 수. 현재 데모 기록에는 없습니다.",
          },
        ];
  return (
    <section aria-label="시즌 일반 기록">
      <h2>{"roleSeason" in d ? "투수" : "타자"} 시즌 기록</h2>
      <label>
        기록 시즌{" "}
        <select defaultValue={String(d.seasonYear)}>
          <option value={d.seasonYear}>{d.seasonYear} DEMO</option>
        </select>
      </label>
      <p className="ds-notice">
        {d.seasonYear} {d.competition} · 시즌 전체 {s.sample.appearances}
        {"roleSeason" in d ? "등판 (선발·불펜 합산)" : "타격 출전"}.
        포스트시즌은 포함하지 않습니다. 일반 야구 기록이며 기세 점수와
        별개입니다.
      </p>
      {s.sample.appearances === 0 && (
        <p role="status">
          이 시즌의 출전 기록이 없습니다. 누락된 기록을 0으로 채우지 않습니다.
        </p>
      )}
      <RecordGrid items={items} />
      <p className="ds-meta">
        출처 {d.source} · DEMO · {d.seasonYear} {d.competition} · 표본{" "}
        {s.sample.appearances}경기
        {"roleSeason" in d
          ? ` / ${d.season.sample.bf ?? "데이터 없음"} BF`
          : ` / ${d.season.sample.pa ?? "데이터 없음"} PA`}{" "}
        · 기준 {formatKst(d.asOf)} · 업데이트 {formatKst(d.updatedAt)}
      </p>
      <details>
        <summary>시즌 전체 기록 원천 참조</summary>
        <ul>
          {d.seasonRecords.inputRefs.map((ref) => (
            <li key={ref}>{ref}</li>
          ))}
        </ul>
      </details>
      <p className="ds-meta">
        타격 비율은 소수 셋째 자리, ERA·WHIP은 둘째 자리, 누적 기록은 정수로
        표시합니다. 비율은 원시 기록 합산 후 계산합니다.
      </p>
    </section>
  );
}
