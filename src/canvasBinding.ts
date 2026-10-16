import type { IchigoCrateRunner } from "./wasm/ichigocrate_web";

/** 枠線の既定色。実機 LED が消灯している状態を表す。 */
export const BORDER_COLOR_LED_OFF = "#333";
/** LED 点灯中の枠線色。実機 LED の代わりに画面枠を赤くする。 */
const BORDER_COLOR_LED_ON = "#e62828";

const FUNCTION_KEYS = Array.from({ length: 10 }, (_, i) => `F${i + 1}`);

// ブラウザ既定動作 (スクロール/リロード/フォーカス移動) と衝突するため、canvas に
// フォーカスがある間だけ抑止するキー。
const PREVENT_DEFAULT_KEYS = new Set([
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "Space",
  "Tab",
  "Enter",
  "Backspace",
  ...FUNCTION_KEYS,
]);

export interface CanvasBindingOptions {
  /**
   * Tab キーを捕捉するかを返す。毎回最新の props を参照できるよう関数で受け取る
   * (値の変化でランナーを作り直さないため)。false の間は Tab をランナーへ渡さず、
   * ブラウザのフォーカス移動に委ねる。
   */
  shouldCaptureTab: () => boolean;
}

/**
 * canvas のキー入力と rAF ループをランナーへ配線し、解除関数を返す。
 * 解除関数はリスナを外して rAF を止めるだけで、ランナーの解放は呼び出し側が行う。
 */
export function bindRunnerToCanvas(
  canvas: HTMLCanvasElement,
  runner: IchigoCrateRunner,
  { shouldCaptureTab }: CanvasBindingOptions,
): () => void {
  const isReleasedTab = (e: KeyboardEvent) => e.code === "Tab" && !shouldCaptureTab();
  const onKeyDown = (e: KeyboardEvent) => {
    // Ctrl/Cmd 併用 (コピー等) は OS/ブラウザに委ねる。
    if (e.ctrlKey || e.metaKey) return;
    if (isReleasedTab(e)) return;
    runner.on_key(e.code, e.shiftKey, e.altKey, true);
    if (PREVENT_DEFAULT_KEYS.has(e.code)) e.preventDefault();
  };
  const onKeyUp = (e: KeyboardEvent) => {
    if (isReleasedTab(e)) return;
    runner.on_key(e.code, e.shiftKey, e.altKey, false);
  };
  canvas.addEventListener("keydown", onKeyDown);
  canvas.addEventListener("keyup", onKeyUp);

  let raf = 0;
  // 変化したフレームだけ style を書き換え、毎フレームのスタイル再計算を避ける。
  let lastLed: boolean | null = null;
  const frame = (t: number) => {
    runner.tick(t);
    const led = runner.is_led();
    if (led !== lastLed) {
      canvas.style.borderColor = led ? BORDER_COLOR_LED_ON : BORDER_COLOR_LED_OFF;
      lastLed = led;
    }
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);

  return () => {
    cancelAnimationFrame(raf);
    canvas.removeEventListener("keydown", onKeyDown);
    canvas.removeEventListener("keyup", onKeyUp);
  };
}
