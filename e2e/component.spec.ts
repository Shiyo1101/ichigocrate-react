import { expect, test } from "@playwright/test";
import { canvas, events, exec, getVar, mount, screenText } from "./helpers";

const LED_OFF = "rgb(51, 51, 51)";
const LED_ON = "rgb(230, 40, 40)";

test("canvas は論理 256x192 を scale 倍で表示する", async ({ page }) => {
  await mount(page, [
    { id: "default", persist: false },
    { id: "scaled", persist: false, scale: 2, className: "custom" },
  ]);
  const size = (id: string) =>
    canvas(page, id).evaluate((el: HTMLCanvasElement) => ({
      width: el.width,
      height: el.height,
      cssWidth: el.getBoundingClientRect().width - 16,
      cssHeight: el.getBoundingClientRect().height - 16,
    }));
  // 8px の枠線ぶんを引いた表示サイズ。
  expect(await size("default")).toEqual({ width: 256, height: 192, cssWidth: 768, cssHeight: 576 });
  expect(await size("scaled")).toEqual({ width: 256, height: 192, cssWidth: 512, cssHeight: 384 });
  await expect(canvas(page, "scaled")).toHaveClass("custom");
});

test("canvas へ HTML 属性を渡せ、aria-label は既定値を持つ", async ({ page }) => {
  await mount(page, [
    { id: "default", persist: false },
    {
      id: "labeled",
      persist: false,
      "aria-label": "サンプルプログラムの実行画面",
      "aria-describedby": "description",
    },
  ]);
  await expect(canvas(page, "default")).toHaveAccessibleName("IchigoCrate");
  await expect(canvas(page, "labeled")).toHaveAccessibleName("サンプルプログラムの実行画面");
  await expect(canvas(page, "labeled")).toHaveAttribute("aria-describedby", "description");
  // コンポーネントが管理する属性は維持される。
  await expect(canvas(page, "labeled")).toHaveAttribute("tabindex", "0");
});

test("wasm の初期化で非推奨 API の警告を出さない", async ({ page }) => {
  const warnings: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "warning") warnings.push(message.text());
  });
  await mount(page, [{ id: "main", persist: false }]);
  expect(warnings.filter((text) => text.includes("deprecated"))).toEqual([]);
});

test("VRAM の内容が canvas に描画される", async ({ page }) => {
  await mount(page, [{ id: "main", persist: false }]);
  const litPixels = () =>
    canvas(page, "main").evaluate((el: HTMLCanvasElement) => {
      const ctx = el.getContext("2d");
      if (!ctx) return -1;
      const { data } = ctx.getImageData(0, 0, el.width, el.height);
      let lit = 0;
      for (let i = 0; i < data.length; i += 4) if (data[i] > 0) lit++;
      return lit;
    });
  await expect.poll(litPixels).toBeGreaterThan(0);
  // VIDEO 0 で映像を消すと全消灯する。
  await exec(page, "main", "VIDEO 0");
  await expect.poll(litPixels).toBe(0);
});

test("LED の状態が枠線の色に反映される", async ({ page }) => {
  await mount(page, [{ id: "main", persist: false }]);
  const border = canvas(page, "main");
  await expect(border).toHaveCSS("border-top-color", LED_OFF);
  await exec(page, "main", "LED 1");
  await expect(border).toHaveCSS("border-top-color", LED_ON);
  await exec(page, "main", "LED 0");
  await expect(border).toHaveCSS("border-top-color", LED_OFF);
});

test("複数インスタンスは状態を共有しない", async ({ page }) => {
  await mount(page, [
    { id: "a", persist: false },
    { id: "b", persist: false },
  ]);
  await exec(page, "a", "A=1:LED 1");
  await exec(page, "b", "A=2");
  expect(await getVar(page, "a", "A")).toBe(1);
  expect(await getVar(page, "b", "A")).toBe(2);
  expect(await page.evaluate(() => window.fixture.handle("b").isLed())).toBe(false);
  await expect.poll(() => events(page, "b").then((e) => e.printed)).toBe("OK\n");
});

test("useIchigoCrate の ij で ref なしに操作できる", async ({ page }) => {
  await mount(page, [{ id: "hook", persist: false, viaHook: true }]);
  await exec(page, "hook", "A=3*3");
  expect(await getVar(page, "hook", "A")).toBe(9);
});

test("アンマウント後のハンドルは既定値を返す no-op になる", async ({ page }) => {
  await mount(page, [
    { id: "ref", persist: false },
    { id: "hook", persist: false, viaHook: true },
  ]);
  await exec(page, "ref", "A=1:LED 1");
  await page.evaluate(() => window.fixture.unmount());

  const results = await Promise.all(
    ["ref", "hook"].map((id) =>
      page.evaluate((target) => {
        const h = window.fixture.handle(target);
        h.exec("A=2");
        h.run();
        h.keyDown(28);
        return {
          text: h.getScreenText(),
          a: h.getVar("A"),
          peek: h.peek(0x900),
          led: h.isLed(),
          kana: h.isKana(),
        };
      }, id),
    ),
  );
  for (const after of results) {
    expect(after).toEqual({ text: "", a: 0, peek: 0, led: false, kana: false });
  }
  await expect(page.locator("canvas")).toHaveCount(0);
});

test("wasm の読込に失敗しても次のマウントでリトライできる", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  await page.goto("");
  await page.waitForFunction(() => "fixture" in window);
  await page.evaluate(() =>
    window.fixture.mount([{ id: "broken", wasmUrl: "/does-not-exist.wasm", persist: false }]),
  );
  await expect.poll(() => errors.some((e) => e.includes("failed to load wasm module"))).toBe(true);

  await mount(page, [{ id: "retry", persist: false }]);
  expect(await screenText(page, "retry")).toContain("OK");
});
