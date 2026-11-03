import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("admin form blocks unauthorized sample upload and is accessible on mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/admin");
  await expect(page.getByText("관리자 접근이 차단되었습니다.")).toBeVisible();
  expect(
    (
      await page.request.get("/api/admin/ingest/templates?kind=players")
    ).status(),
  ).toBe(403);
  await page.goto("/admin/login");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("authorized sample upload shows report and stays unpublished", async ({
  page,
}) => {
  const token = process.env.TEST_INGEST_ADMIN_TOKEN;
  test.skip(
    !token,
    "전용 playwright.ingest.config.ts에서 임시 관리자 권한으로 실행",
  );
  await page.goto("/admin/login");
  await page.getByLabel("관리자 토큰").fill(token!);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "기록 가져오기" }),
  ).toBeVisible();
  const download = await page.request.get(
    "/api/admin/ingest/templates?kind=players&format=csv",
  );
  await expect(page.getByLabel("샘플 파일", { exact: false })).toBeEnabled();
  await page.getByLabel("샘플 파일", { exact: false }).setInputFiles({
    name: "players.csv",
    mimeType: "text/csv",
    buffer: await download.body(),
  });
  const response = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/admin/ingest") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "업로드 및 dry-run 검증" }).click();
  const result = await response;
  expect(result.status(), await result.text()).toBe(200);
  const report = await result.json();
  try {
    await expect(
      page.getByRole("heading", { name: "검증 리포트 · 아직 미공개" }),
    ).toBeVisible();
    await expect(page.getByText("상태: VALIDATED · 게시 불가")).toBeVisible();
    expect(report.published).toBe(false);
    expect(report.counts.new).toBe(2);
    await expect(page.getByLabel("수집권", { exact: false })).not.toBeChecked();
  } finally {
    const { rm } = await import("node:fs/promises");
    if (/^[a-f0-9-]{36}$/.test(report.importBatchId))
      await rm(`.demo/ingest/${report.importBatchId}.json`, { force: true });
  }
});

test("sample upload requires explicit admin publish and correction changes aggregate without duplicates", async ({
  page,
}) => {
  const token = process.env.TEST_INGEST_ADMIN_TOKEN;
  test.skip(!token, "전용 ingest E2E 실행 필요");
  const { rm } = await import("node:fs/promises");
  await rm(".demo/pipeline-e2e", { recursive: true, force: true });
  await page.goto("/admin/login");
  await page.getByLabel("관리자 토큰").fill(token!);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "기록 가져오기" }),
  ).toBeVisible();
  const authorization = { Origin: "http://127.0.0.1:3101" };
  async function upload(kind: string, variant = "example") {
    const sample = await page.request.get(
      `/api/admin/ingest/templates?kind=${kind}&format=json&variant=${variant}`,
    );
    expect(sample.status()).toBe(200);
    const response = await page.request.post("/api/admin/ingest", {
      headers: {
        ...authorization,
        "Content-Type": "application/json",
        "X-Ingest-Kind": kind,
        "X-File-Name": `${kind}.json`,
      },
      data: await sample.body(),
    });
    expect(response.status()).toBe(200);
    return response.json();
  }
  async function publish(batchId: string) {
    const response = await page.request.post("/api/admin/ingest/publish", {
      headers: authorization,
      data: {
        batchId,
        approve: true,
        checklist: {
          collect: true,
          store: true,
          display: true,
          transform: true,
          export: true,
        },
      },
    });
    expect(response.status(), await response.text()).toBe(200);
  }
  try {
    const first = await upload("players");
    expect(
      (await (await page.request.get("/api/v1/published")).json()).records,
    ).toHaveLength(0);
    expect(
      (
        await page.request.post("/api/admin/ingest/publish", {
          data: { batchId: first.importBatchId, approve: true },
        })
      ).status(),
    ).toBe(403);
    expect(
      (
        await page.request.post("/api/admin/ingest/publish", {
          headers: authorization,
          data: { batchId: first.importBatchId },
        })
      ).status(),
    ).toBe(400);
    await publish(first.importBatchId);
    for (const kind of ["games", "rosters", "batting_game_logs"])
      await publish((await upload(kind)).importBatchId);
    const before = await (await page.request.get("/api/v1/published")).json();
    expect(
      Object.values(before.aggregates).map((v) => (v as { h: number }).h),
    ).toEqual([2]);
    for (let i = 0; i < 2; i++)
      await publish((await upload("batting_game_logs")).importBatchId);
    await publish(
      (await upload("batting_game_logs", "correction")).importBatchId,
    );
    const after = await (await page.request.get("/api/v1/published")).json();
    expect(after.records).toHaveLength(before.records.length);
    expect(
      Object.values(after.aggregates).map((v) => (v as { h: number }).h),
    ).toEqual([3]);
    await page.goto("/published?season=2026&date=2026-10-31&search=appeared");
    await expect(
      page.getByRole("heading", { name: "날짜별 1군 기록 · DEMO" }),
    ).toBeVisible();
    await expect(page.getByText(/마지막 출전일 2026-10-31/)).toBeVisible();
    const scope = await page.request.get(
      "/api/v1/scope?season=2026&date=2026-11-03&search=registered",
    );
    expect((await scope.json()).rosterMessage).toBe("엔트리 정보 없음");
    expect(
      (
        await page.request.get("/api/v1/scope?season=2026&date=2026-02-30")
      ).status(),
    ).toBe(400);
    await expect(page.getByText(/안타 3/)).toBeVisible();
  } finally {
    await rm(".demo/pipeline-e2e", { recursive: true, force: true });
  }
});
