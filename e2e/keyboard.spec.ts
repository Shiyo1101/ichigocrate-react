import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { canvas, exec, getVar, mount, waitForScreen } from "./helpers";

const ID = "main";

// keyboard.type は記号を送るとき shiftKey を立てず、実際の打鍵と異なるため、
// Shift が要る記号はキーの組み合わせとして明示的に押す。
async function pressAll(page: Page, keys: string[]): Promise<void> {
  for (const key of keys) {
    // oxlint-disable-next-line no-await-in-loop -- 打鍵順を保つため逐次で押す。
    await page.keyboard.press(key);
  }
}

test.beforeEach(async ({ page }) => {
  await mount(page, [{ id: ID, persist: false }]);
  // Playwright のキーボードは US 配列の物理キー (code) を送るので、記号の位置を合わせる。
  await exec(page, ID, "KBD 0");
  await canvas(page, ID).focus();
});

test("物理キー入力が REPL へ届き、英字は大文字で入力される", async ({ page }) => {
  await page.keyboard.type("a=6");
  await pressAll(page, ["Shift+Digit8", "7", "Enter"]);
  expect(await getVar(page, ID, "A")).toBe(42);
  await waitForScreen(page, ID, "A=6*7");
});

test("Backspace と矢印キーで行を編集できる", async ({ page }) => {
  await page.keyboard.type("a=19");
  await page.keyboard.press("Backspace");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.type("2");
  await page.keyboard.press("Enter");
  // "A=1" の 1 の前に 2 を挿入して "A=21"。
  expect(await getVar(page, ID, "A")).toBe(21);
});

test("Shift で記号を入力できる", async ({ page }) => {
  // US 配列 (KBD 0) では Shift+9/0 が括弧。
  await page.keyboard.type("a=");
  await pressAll(page, ["Shift+Digit9", "2", "Shift+Equal", "3", "Shift+Digit0"]);
  await pressAll(page, ["Shift+Digit8", "4", "Enter"]);
  expect(await getVar(page, ID, "A")).toBe(20);
});

test("物理キーの押下状態が BTN() に反映される", async ({ page }) => {
  await page.keyboard.down("ArrowUp");
  await exec(page, ID, "A=BTN(30)");
  await page.keyboard.up("ArrowUp");
  await exec(page, ID, "B=BTN(30)");
  expect(await getVar(page, ID, "A")).toBe(1);
  expect(await getVar(page, ID, "B")).toBe(0);
});

test("実行中のキー入力は INKEY() へ届く", async ({ page }) => {
  await page.evaluate((id) => {
    const h = window.fixture.handle(id);
    h.loadProgram("10 K=INKEY()\n20 IF K=0 GOTO 10\n30 A=K");
    h.run();
  }, ID);
  await page.keyboard.press("q");
  await expect.poll(() => getVar(page, ID, "A")).toBe("Q".charCodeAt(0));
});

test("Escape で実行中のプログラムを中断する", async ({ page }) => {
  await page.evaluate((id) => {
    const h = window.fixture.handle(id);
    h.loadProgram("10 GOTO 10");
    h.run();
  }, ID);
  await page.keyboard.press("Escape");
  await waitForScreen(page, ID, "Break in 10");
});

test("F10 でカナ入力モードを切り替える", async ({ page }) => {
  const isKana = () => page.evaluate((id) => window.fixture.handle(id).isKana(), ID);
  expect(await isKana()).toBe(false);
  await page.keyboard.press("F10");
  expect(await isKana()).toBe(true);
  await page.keyboard.press("F10");
  expect(await isKana()).toBe(false);
});

test("F1 は CLS を実行し、OK を出さずに画面を空にする", async ({ page }) => {
  await page.keyboard.press("F1");
  await expect
    .poll(() => page.evaluate((id) => window.fixture.handle(id).getScreenText(), ID))
    .toBe("\n".repeat(23));
});

test("ブラウザ既定動作と衝突するキーだけ preventDefault する", async ({ page }) => {
  const prevented = await canvas(page, ID).evaluate((el) => {
    const fire = (init: KeyboardEventInit) => {
      const e = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init });
      el.dispatchEvent(e);
      return e.defaultPrevented;
    };
    return {
      tab: fire({ code: "Tab" }),
      space: fire({ code: "Space" }),
      f5: fire({ code: "F5" }),
      letter: fire({ code: "KeyA" }),
      ctrlTab: fire({ code: "Tab", ctrlKey: true }),
    };
  });
  expect(prevented).toEqual({ tab: true, space: true, f5: true, letter: false, ctrlTab: false });
});

test("Ctrl/Cmd 併用のキーはランナーへ渡さない", async ({ page }) => {
  const screen = () => page.evaluate((id) => window.fixture.handle(id).getScreenText(), ID);
  const before = await screen();
  await page.keyboard.press("Control+a");
  await page.keyboard.press("Meta+a");
  expect(await screen()).toBe(before);
});
