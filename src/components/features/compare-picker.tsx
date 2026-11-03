"use client";

import Link from "@/components/release-provider";
import { useRef, useState } from "react";

type Candidate = {
  id: string;
  name: string;
  team: string;
  roles: string;
  hrefs: [string, string];
};

export function ComparePicker({
  candidates,
  selected,
  initialSearch,
}: {
  candidates: Candidate[];
  selected: string[];
  initialSearch: string;
}) {
  const [search, setSearch] = useState(initialSearch);
  const [page, setPage] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const matches = candidates.filter((p) =>
    `${p.name} ${p.id} ${p.team} ${p.roles}`
      .toLowerCase()
      .includes(search.trim().toLowerCase()),
  );
  const size = 15;
  function move(next: number) {
    setPage(next);
    heading.current?.focus();
  }
  return (
    <section className="panel compare-picker" aria-label="선수 선택기">
      <h2>선수 찾기 · DEMO</h2>
      <label>
        선수 검색
        <input
          type="search"
          name="q"
          form="compare-conditions"
          value={search}
          maxLength={100}
          placeholder="선수명·ID·팀·타자·선발·불펜"
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
        />
      </label>
      <h3 ref={heading} tabIndex={-1}>
        검색 결과
      </h3>
      <p role="status">
        {matches.length}명 · {matches.length ? page * size + 1 : 0}–
        {Math.min((page + 1) * size, matches.length)} 표시 · 한 번에 최대 15명
      </p>
      {!matches.length && (
        <p>검색 결과 없음 · 이름, 팀 또는 역할을 바꿔 보세요.</p>
      )}
      <ul aria-label="선수 후보">
        {matches.slice(page * size, (page + 1) * size).map((p) => (
          <li key={p.id} data-selected={selected.includes(p.id)}>
            <strong>{p.name}</strong> · {p.team} · {p.roles}
            {selected.includes(p.id) && (
              <span> · 선택됨 (선수 {selected.indexOf(p.id) + 1})</span>
            )}
            <div className="detail-actions">
              {[0, 1].map((slot) => {
                const params = new URL(p.hrefs[slot], "http://local");
                params.searchParams.set("q", search.trim());
                return (
                  <Link
                    key={slot}
                    prefetch={false}
                    aria-current={selected[slot] === p.id ? "true" : undefined}
                    href={`${params.pathname}?${params.searchParams}`}
                  >
                    선수 {slot + 1}로 {p.name} 선택
                  </Link>
                );
              })}
            </div>
          </li>
        ))}
      </ul>
      <nav aria-label="검색 결과 페이지" className="detail-actions">
        <button disabled={page === 0} onClick={() => move(page - 1)}>
          이전 15명
        </button>
        <button
          disabled={(page + 1) * size >= matches.length}
          onClick={() => move(page + 1)}
        >
          다음 15명 더 보기
        </button>
      </nav>
    </section>
  );
}
