import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
for (const [id, role] of [
  ["demo_0_10", "starter"],
  ["demo_0_14", "reliever"],
  ["demo_0_12", "starter"],
]) {
  test(`${id} role windows reconcile outs, IP and counts end to end`, async ({
    page,
    request,
  }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    for (const activeRole of id === "demo_0_12"
      ? ["starter", "reliever"]
      : [role]) {
      for (const window of activeRole === "starter"
        ? ["3", "5", "10", "season"]
        : ["5", "10", "20", "season"]) {
        const response = await request.get(
          `/api/v1/players/${id}/pitching?role=${activeRole}&window=${window}`,
        );
        expect(response.ok()).toBe(true);
        const d = await response.json();
        const outs = d.games.reduce(
          (s: number, g: { counts: { outsRecorded: number } }) =>
            s + g.counts.outsRecorded,
          0,
        );
        expect(d.recent.totals.outsRecorded).toBe(outs);
        expect(d.recent.inningsDisplay).toBe(
          `${Math.floor(outs / 3)}.${outs % 3}`,
        );
        for (const k of ["r", "er", "h", "bb", "so", "hr"])
          expect(d.recent.totals[k]).toBe(
            d.games.reduce(
              (s: number, g: { counts: Record<string, number> }) =>
                s + g.counts[k],
              0,
            ),
          );
        const er = d.recent.totals.er;
        expect(d.recent.metrics.era.value).toBeCloseTo((er * 27) / outs, 12);
        await page.goto(`/players/${id}?role=${activeRole}&window=${window}`);
        await expect(
          page.getByRole("article", { name: "ERA 요약" }),
        ).toContainText(d.recent.metrics.era.value.toFixed(3));
        await expect(
          page.getByRole("heading", {
            name:
              "선택 " + (activeRole === "starter" ? "선발" : "불펜") + " 기록",
          }),
        ).toBeVisible();
        await expect(
          page.getByRole("heading", { name: "투구수", exact: true }),
        ).toHaveCount(0);
        await expect(page.getByRole("table")).toContainText(
          d.games.at(-1).opponent,
        );
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
      }
    }
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.screenshot({
      path: `test-results/${id}-pitching-mobile.png`,
      fullPage: true,
    });
    if (id === "demo_0_12") {
      await page.getByLabel("기록 역할").selectOption("starter");
      await expect(page).toHaveURL(/role=starter&window=5/);
    }
  });
}
test("pitching rejects incompatible periods and supports retry", async ({
  page,
  request,
}) => {
  expect(
    (
      await request.get(
        "/api/v1/players/demo_0_10/pitching?role=starter&window=20",
      )
    ).status(),
  ).toBe(400);
  await page.route("**/api/v1/players/*/pitching*", (r) =>
    r.fulfill({ status: 503, json: { error: "연결 실패" } }),
  );
  await page.goto("/players/demo_0_10");
  await expect(page.locator("section[role=alert]")).toContainText("연결 실패");
  await page.unroute("**/api/v1/players/*/pitching*");
  await page.getByRole("button", { name: "다시 시도" }).click();
  await expect(page.getByRole("article", { name: "ERA 요약" })).toBeVisible();
});
