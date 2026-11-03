"use client";
import { useState } from "react";
import { playersResponse, type Player } from "@/contracts/api";
export function ApiPreview() {
  const [state, setState] = useState<"idle" | "loading" | "error" | "ready">(
    "idle",
  );
  const [players, setPlayers] = useState<Player[]>([]);
  async function load() {
    setState("loading");
    try {
      const response = await fetch("/api/v1/players", {
        cache: "no-store",
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) throw new Error();
      const body = playersResponse.parse(await response.json());
      if (body.error) throw new Error();
      setPlayers(body.data);
      setState("ready");
    } catch {
      setState("error");
    }
  }
  return (
    <section className="panel" aria-label="DEMO API 확인">
      <p>DEMO — 가상의 선수와 경기 기록</p>
      <button className="button" disabled={state === "loading"} onClick={load}>
        {state === "loading"
          ? "불러오는 중…"
          : state === "error"
            ? "다시 시도"
            : "DEMO API 불러오기"}
      </button>
      <div aria-live="polite">
        {state === "error" && (
          <p role="alert">
            네트워크 연결 또는 서비스 상태를 확인하고 다시 시도해 주세요.
          </p>
        )}
        {state === "ready" &&
          (players.length ? (
            <ul>
              {players.map((p) => (
                <li key={p.playerId}>{p.displayName} · DEMO</li>
              ))}
            </ul>
          ) : (
            <p>조건에 맞는 선수가 없습니다.</p>
          ))}
      </div>
    </section>
  );
}
