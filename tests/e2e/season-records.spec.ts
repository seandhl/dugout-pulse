import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

for (const width of [320, 1440]) {
  test(`batter tabs, season data, missing records and accessibility ${width}`, async ({
    page,
    request,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const data = await (
      await request.get("/api/v1/players/demo_0_00/batting?window=5")
    ).json();
    await page.goto("/players/demo_0_00?window=5");
    await expect(
      page.getByRole("heading", { name: "가상 A-01", exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("article", { name: "AVG 요약" })).toContainText(
      data.recent.metrics.avg.value.toFixed(3),
    );
    await page.getByRole("tab", { name: "기세 분석", exact: true }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(
      page.getByRole("tab", { name: "시즌 기록", exact: true }),
    ).toHaveAttribute("aria-selected", "true");
    await expect(page).toHaveURL(/tab=season/);
    const records = page.getByRole("region", { name: "시즌 일반 기록" });
    await expect(records).toContainText(
      data.season.metrics.avg.value.toFixed(3),
    );
    const metric = (name: string) =>
      records
        .locator("dl > div")
        .filter({ has: page.getByText(name, { exact: true }) });
    await expect(metric("RBI · 타점")).toContainText(
      String(data.seasonRecords.rbi),
    );
    for (const name of [
      "OBP · 출루율",
      "OPS",
      "wRC+ · 조정 득점 창출력",
      "SB · 도루",
    ])
      await expect(metric(name)).toContainText("데이터 없음");
    await expect(records).toContainText("100이 리그 평균");
    await expect(
      page.getByRole("combobox", { name: "기록 시즌" }).locator("option"),
    ).toHaveCount(1);
    await expect(records).toContainText("정규시즌");
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await records.screenshot({
      path: `test-results/season-batting-${width}.png`,
    });
    await page.reload();
    await expect(
      page.getByRole("tab", { name: "시즌 기록", exact: true }),
    ).toHaveAttribute("aria-selected", "true");
    await page.getByRole("tab", { name: "기세 분석", exact: true }).click();
    await page.getByRole("tab", { name: "최근 10출전", exact: true }).click();
    await expect(page).toHaveURL(/tab=momentum/);
    await expect(
      page.getByRole("tab", { name: "기세 분석", exact: true }),
    ).toHaveAttribute("aria-selected", "true");
  });
}

test("mixed pitcher season totals remain separate from selected role and missing decisions", async ({
  page,
  request,
}) => {
  await page.setViewportSize({ width: 390, height: 900 });
  const data = await (
    await request.get(
      "/api/v1/players/demo_0_12/pitching?role=starter&window=5",
    )
  ).json();
  await page.goto("/players/demo_0_12?role=starter&window=5&tab=season");
  const records = page.getByRole("region", { name: "시즌 일반 기록" });
  await expect(records).toContainText("선발·불펜 합산");
  await expect(records).toContainText(data.season.metrics.era.value.toFixed(2));
  await expect(records).toContainText(data.season.inningsDisplay);
  const starts = records
    .locator("dl > div")
    .filter({ hasText: "GS · 선발 등판" });
  await expect(starts.locator("dd").first()).toHaveText(
    String(data.seasonRecords.gamesStarted),
  );
  for (const name of ["W · 승", "L · 패", "SV · 세이브", "HLD · 홀드"])
    await expect(
      records.locator("dl > div").filter({ hasText: name }),
    ).toContainText("데이터 없음");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await records.screenshot({ path: "test-results/season-pitching-390.png" });
  await page.getByRole("tab", { name: "기세 분석", exact: true }).click();
  await page
    .getByRole("combobox", { name: "기록 역할" })
    .selectOption("reliever");
  await expect(page).toHaveURL(/role=reliever/);
  await expect(
    page.getByRole("tab", { name: "기세 분석", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await page.getByRole("tab", { name: "시즌 기록", exact: true }).click();
  await expect(starts.locator("dd").first()).toHaveText(
    String(data.seasonRecords.gamesStarted),
  );
});

test("unsupported scopes, invalid tabs, invalid players and failed API are explicit", async ({
  page,
}) => {
  await page.goto("/players/demo_0_00?season=2025&tab=season");
  await expect(
    page.getByRole("heading", { name: "제공되지 않는 기록 범위" }),
  ).toBeVisible();
  await page.goto("/players/demo_0_00?competition=postseason");
  await expect(
    page.getByRole("heading", { name: "제공되지 않는 기록 범위" }),
  ).toBeVisible();
  await page.goto("/players/demo_0_00?kind=pitching");
  await expect(
    page.getByRole("heading", { name: "선택한 역할의 기록이 없습니다" }),
  ).toBeVisible();
  await page.goto("/players/demo_0_00?tab=invalid");
  await expect(page.locator("section[role=alert]")).toContainText(
    "유효하지 않은 상세 탭",
  );
  await page.getByRole("button", { name: "기세 분석으로" }).click();
  await expect(
    page.getByRole("tab", { name: "기세 분석", exact: true }),
  ).toBeVisible();
  await page.goto("/players/missing-player");
  await expect(
    page.getByRole("heading", { name: "페이지를 찾을 수 없습니다" }),
  ).toBeVisible();
  await page.route("**/api/v1/players/*/batting*", (route) =>
    route.fulfill({ status: 503, json: { error: "테스트 연결 실패" } }),
  );
  await page.goto("/players/demo_0_00?tab=season");
  await expect(page.locator("section[role=alert]")).toContainText(
    "테스트 연결 실패",
  );
  await page.unroute("**/api/v1/players/*/batting*");
  await page.getByRole("button", { name: "다시 시도" }).click();
  await expect(
    page.getByRole("region", { name: "시즌 일반 기록" }),
  ).toBeVisible();
});

test("empty season never fills absent counts with zero", async ({
  page,
  request,
}) => {
  const data = await (
    await request.get("/api/v1/players/demo_0_00/batting?window=5")
  ).json();
  data.season.sample.appearances = 0;
  data.season.sample.pa = null;
  for (const key of Object.keys(data.season.totals))
    data.season.totals[key] = null;
  for (const metric of Object.values(data.season.metrics) as {
    value: number | null;
  }[])
    metric.value = null;
  data.seasonRecords = { rbi: null, inputRefs: [] };
  await page.route("**/api/v1/players/*/batting*", (route) =>
    route.fulfill({ json: data }),
  );
  await page.goto("/players/demo_0_00?tab=season&window=5");
  const records = page.getByRole("region", { name: "시즌 일반 기록" });
  await expect(records).toContainText("이 시즌의 출전 기록이 없습니다");
  await expect(records.locator("dl > div > dd.ds-value")).toHaveText(
    Array(11).fill("데이터 없음"),
  );
});
