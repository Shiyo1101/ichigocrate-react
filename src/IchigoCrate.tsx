import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import type { IchigoCrateRunner } from "./wasm/ichigocrate_web";
import type { IchigoCrateError, IchigoCrateHandle, IchigoCrateProps } from "./types";
import { BORDER_COLOR_LED_OFF, bindRunnerToCanvas } from "./canvasBinding";
import { createHandle } from "./handle";
import { useLatestRef } from "./useLatestRef";
import { loadIchigoCrate } from "./wasmLoader";

// 論理画面サイズ (wasm 側の IMG_W/IMG_H と一致)。
const SCREEN_W = 256;
const SCREEN_H = 192;

const DEFAULT_SCALE = 3;

/** aria-label 未指定時の canvas のアクセシブルな名前。 */
const DEFAULT_ARIA_LABEL = "IchigoCrate";

/**
 * IchigoJam BASIC を 1 枚の canvas として描画する React コンポーネント。
 *
 * wasm の instantiate はページで一度だけ行われる (loadIchigoCrate)。各インスタンスは
 * ランナーのみ生成するので 1 ページに複数貼れる。ref から命令ハンドル
 * (IchigoCrateHandle) で外部制御できる。アンマウント時には rAF 停止・リスナ解除・
 * ランナー解放を行い、React StrictMode の二重マウントでもランナーが二重起動
 * しないようガードする。
 */
export const IchigoCrate = forwardRef<IchigoCrateHandle, IchigoCrateProps>(function IchigoCrate(
  {
    defaultProgram,
    autoRun,
    onPrint,
    onError,
    onReady,
    storagePrefix,
    persist,
    wasmUrl,
    scale = DEFAULT_SCALE,
    className,
    style,
    "aria-label": ariaLabel = DEFAULT_ARIA_LABEL,
    ...canvasAttributes
  },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const runnerRef = useRef<IchigoCrateRunner | null>(null);
  const onPrintRef = useLatestRef(onPrint);
  const onErrorRef = useLatestRef(onError);
  const onReadyRef = useLatestRef(onReady);

  // ランナーへ委譲する安定ハンドル。useImperativeHandle と onReady で共有する。
  const [handle] = useState(() => createHandle(() => runnerRef.current));
  // defaultProgram/autoRun はコンポーネントの生涯で一度だけ適用する。effect の
  // 依存 (storagePrefix 等) 変化でランナーが作り直されても再適用しないためのガード。
  const appliedInitialRef = useRef(false);

  useImperativeHandle(ref, () => handle, [handle]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let cancelled = false;
    let runner: IchigoCrateRunner | null = null;
    let unbind: (() => void) | null = null;

    loadIchigoCrate(wasmUrl)
      .then((Runner) => {
        if (cancelled) return;

        runner = new Runner(canvas, storagePrefix, persist);
        runnerRef.current = runner;
        runner.onPrint((chunk: string) => onPrintRef.current?.(chunk));
        runner.onError((error: IchigoCrateError) => onErrorRef.current?.(error));

        if (!appliedInitialRef.current) {
          appliedInitialRef.current = true;
          if (defaultProgram) runner.loadProgram(defaultProgram);
          if (autoRun) runner.run();
        }

        onReadyRef.current?.(handle);
        unbind = bindRunnerToCanvas(canvas, runner);
      })
      .catch((error) => {
        if (cancelled) return;
        console.error("[IchigoCrate] failed to load wasm module", error);
      });

    return () => {
      cancelled = true;
      unbind?.();
      runnerRef.current = null;
      runner?.free();
    };
    // defaultProgram/autoRun はマウント時のみ反映する (動的更新は ref ハンドルで)。
    // 再生成が必要なのはストレージ構成と wasm の取得元が変わったときだけ。
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [storagePrefix, persist, wasmUrl]);

  const canvasStyle = useMemo(
    () => ({
      imageRendering: "pixelated" as const,
      width: SCREEN_W * scale,
      height: SCREEN_H * scale,
      background: "#000",
      border: `8px solid ${BORDER_COLOR_LED_OFF}`,
      outline: "none",
      ...style,
    }),
    [scale, style],
  );

  return (
    <canvas
      {...canvasAttributes}
      ref={canvasRef}
      tabIndex={0}
      aria-label={ariaLabel}
      className={className}
      style={canvasStyle}
    />
  );
});
