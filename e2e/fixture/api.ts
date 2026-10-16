import type { IchigoCrateError, IchigoCrateHandle } from "../../src";

/** フィクスチャへマウントする 1 インスタンスの設定。 */
export interface InstanceConfig {
  id: string;
  defaultProgram?: string;
  autoRun?: boolean;
  storagePrefix?: string;
  persist?: boolean;
  wasmUrl?: string;
  scale?: number;
  className?: string;
  /** true なら ref ではなく useIchigoCrate フック経由でハンドルを公開する。 */
  viaHook?: boolean;
}

/** インスタンスごとに記録されるコールバック履歴。 */
export interface InstanceEvents {
  printed: string;
  errors: IchigoCrateError[];
  readyCount: number;
}

/** テストが page.evaluate から操作するフィクスチャの公開面。 */
export interface FixtureApi {
  mount(instances: InstanceConfig[]): void;
  unmount(): void;
  /** マウント時点のハンドル。アンマウント後も保持し、no-op 化を確認できる。 */
  handle(id: string): IchigoCrateHandle;
  events(id: string): InstanceEvents;
}

declare global {
  interface Window {
    fixture: FixtureApi;
  }
}
