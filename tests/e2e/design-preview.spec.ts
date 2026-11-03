import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("design system: responsive contrast, keyboard controls and empty results", async ({
  page,
}) => {
  await page.goto("/design-preview");
  await page.keyboard.press("Tab");
  await expect(page.getByText("본문으로 건너뛰기")).toBeFocused();
  for (const width of [320, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    for (const dark of [false, true]) {
      const toggle = page.getByRole("switch", { name: "다크 모드" });
      if ((await toggle.getAttribute("aria-checked")) !== String(dark))
        await toggle.click();
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
  }
  await page.getByRole("tab", { name: "컴포넌트", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "기반 규칙" })).toBeFocused();
  await expect(
    page.getByRole("heading", { name: "색상 · 글꼴 · 상호작용" }),
  ).toBeVisible();
  await page.keyboard.press("ArrowLeft");
  await page.getByRole("button", { name: "타자", exact: true }).click();
  await page.getByRole("button", { name: "팀: 전체 팀" }).click();
  await page.getByRole("combobox").fill("중립 팀 B");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("cell", { name: "조건에 맞는 데이터가 없습니다." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "팀: 중립 팀 B" }).click();
  await page.getByRole("combobox").fill("없는 팀");
  await expect(
    page.getByRole("status").filter({ hasText: "검색 결과가 없습니다." }),
  ).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "팀: 중립 팀 B" }),
  ).toBeFocused();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator(".ds-skeleton").first()).toHaveCSS(
    "animation-name",
    "none",
  );
});
