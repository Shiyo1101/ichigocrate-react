import { expect, test } from "@playwright/test";
import { IchigoCrateButton, IchigoCrateMemory } from "../src/types";
import { exec, getVar, mount, screenText, waitForScreen } from "./helpers";

const ID = "main";

test.beforeEach(async ({ page }) => {
  await mount(page, [{ id: ID, persist: false }]);
});

test("起動直後の画面にバナーと OK が出る", async ({ page }) => {
  const text = await screenText(page, ID);
  expect(text.split("\n").slice(0, 2)).toEqual(["IchigoCrate BASIC 1.0", "OK"]);
});

test("exec は即時文を同期実行し、変数を getVar で読める", async ({ page }) => {
  await exec(page, ID, "A=12:B=A*3");
  expect(await getVar(page, ID, "A")).toBe(12);
  // 名前は先頭 1 文字・大小無視。
  expect(await getVar(page, ID, "bee")).toBe(36);
  // A-Z 以外は 0。
  expect(await getVar(page, ID, "1")).toBe(0);
  expect(await getVar(page, ID, "")).toBe(0);
});

test("type はキーボード入力と同じく REPL 行編集へ流れる", async ({ page }) => {
  await page.evaluate((id) => window.fixture.handle(id).type("?5*5\n"), ID);
  await waitForScreen(page, ID, "25");
});

test("loadProgram と run で格納済みプログラムを実行する", async ({ page }) => {
  await page.evaluate(
    (id) => window.fixture.handle(id).loadProgram("10 A=7\r\n20 PRINT A*6\n\n30 END"),
    ID,
  );
  await page.evaluate((id) => window.fixture.handle(id).run(), ID);
  await waitForScreen(page, ID, "42");
  expect(await getVar(page, ID, "A")).toBe(7);
});

test("break は無限ループを中断し、その後は exec を再び受け付ける", async ({ page }) => {
  await page.evaluate((id) => {
    const h = window.fixture.handle(id);
    h.loadProgram("10 A=A+1\n20 GOTO 10");
    h.run();
  }, ID);
  await expect.poll(() => getVar(page, ID, "A")).toBeGreaterThan(0);

  // 実行中の exec は無視される。
  await exec(page, ID, "B=1");
  expect(await getVar(page, ID, "B")).toBe(0);

  await page.evaluate((id) => window.fixture.handle(id).break(), ID);
  await waitForScreen(page, ID, "Break in 10");
  await exec(page, ID, "B=1");
  expect(await getVar(page, ID, "B")).toBe(1);
});

test("keyDown/keyUp は BTN() の押下状態に反映される", async ({ page }) => {
  await page.evaluate(([id, left]) => window.fixture.handle(id).keyDown(left), [
    ID,
    IchigoCrateButton.Left,
  ] as const);
  await exec(page, ID, "A=BTN(28):B=BTN(-1)");
  expect(await getVar(page, ID, "A")).toBe(1);
  expect(await getVar(page, ID, "B")).toBe(1);

  await page.evaluate(([id, left]) => window.fixture.handle(id).keyUp(left), [
    ID,
    IchigoCrateButton.Left,
  ] as const);
  await exec(page, ID, "A=BTN(28)");
  expect(await getVar(page, ID, "A")).toBe(0);
});

test("peek は VRAM などのメモリを読み、範囲外は 0 を返す", async ({ page }) => {
  await exec(page, ID, 'CLS:?"Z"');
  const [vram0, outOfRange] = await page.evaluate(
    ([id, vram]) => {
      const h = window.fixture.handle(id);
      return [h.peek(vram), h.peek(0x1180)];
    },
    [ID, IchigoCrateMemory.Vram] as const,
  );
  expect(vram0).toBe("Z".charCodeAt(0));
  expect(outOfRange).toBe(0);
});

test("isLed は LED 命令の状態を返す", async ({ page }) => {
  const isLed = () => page.evaluate((id) => window.fixture.handle(id).isLed(), ID);
  expect(await isLed()).toBe(false);
  await exec(page, ID, "LED 1");
  expect(await isLed()).toBe(true);
  await exec(page, ID, "LED 0");
  expect(await isLed()).toBe(false);
});

test("reset は変数・プログラム・LED を起動直後の状態へ戻す", async ({ page }) => {
  await page.evaluate((id) => window.fixture.handle(id).loadProgram("10 PRINT 1"), ID);
  await exec(page, ID, "A=5:LED 1");
  await page.evaluate((id) => window.fixture.handle(id).reset(), ID);

  expect(await getVar(page, ID, "A")).toBe(0);
  expect(await page.evaluate((id) => window.fixture.handle(id).isLed(), ID)).toBe(false);
  await exec(page, ID, "LIST");
  const text = await screenText(page, ID);
  expect(text).not.toContain("10 PRINT 1");
  expect(text.startsWith("IchigoCrate BASIC 1.0\nOK\n")).toBe(true);
});
