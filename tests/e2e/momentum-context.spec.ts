import { test, expect } from "@playwright/test";
for (const path of [
  "/players/demo_0_00?window=3",
  "/players/demo_0_10?role=starter&window=5",
  "/rankings",
]) {
  test(`score interpretation and provenance ${path}`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByText(/기세 0–100은/)).toBeVisible();
    await expect(
      page.getByText(/타자·선발·불펜 점수는 직접 비교하지 않습니다/),
    ).toBeVisible();
    if (path.includes("role=starter"))
      await expect(
        page.getByText("최근 20등판 N/A · 상세 API 미지원"),
      ).toBeVisible();
  });
}
