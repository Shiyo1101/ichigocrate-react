import { useRef } from "react";
import type { MutableRefObject } from "react";

/**
 * 毎レンダーの最新値を保持する ref を返す。effect 内のコールバックから最新の props を
 * 参照しつつ、その props を effect の依存に入れずに済ませる (ランナーを作り直さない) ため。
 */
export function useLatestRef<T>(value: T): MutableRefObject<T> {
  const ref = useRef(value);
  ref.current = value;
  return ref;
}
