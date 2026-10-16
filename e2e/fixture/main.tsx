import { StrictMode, useEffect, useMemo } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { IchigoCrate, useIchigoCrate } from "../../src";
import type { IchigoCrateHandle } from "../../src";
import type { InstanceConfig, InstanceEvents } from "./api";

// E2E 専用ページ。StrictMode の二重マウント下でもライブラリが正しく振る舞うことを
// 検証するため、実利用と同じく StrictMode で包んで描画する。

const handles = new Map<string, IchigoCrateHandle>();
const events = new Map<string, InstanceEvents>();

function eventsOf(id: string): InstanceEvents {
  let e = events.get(id);
  if (!e) {
    e = { printed: "", errors: [], readyCount: 0 };
    events.set(id, e);
  }
  return e;
}

function useCallbacks(id: string) {
  return useMemo(() => {
    const e = eventsOf(id);
    return {
      onPrint: (chunk: string) => {
        e.printed += chunk;
      },
      onError: (error: { code: number; message: string }) => {
        e.errors.push(error);
      },
      onReady: (handle: IchigoCrateHandle) => {
        e.readyCount += 1;
        handles.set(id, handle);
      },
    };
  }, [id]);
}

function RefInstance({ config }: { config: InstanceConfig }) {
  const callbacks = useCallbacks(config.id);
  const { id, viaHook: _viaHook, ...props } = config;
  return (
    <div data-testid={id}>
      <IchigoCrate {...props} {...callbacks} />
    </div>
  );
}

function HookInstance({ config }: { config: InstanceConfig }) {
  const callbacks = useCallbacks(config.id);
  const { ref, ij } = useIchigoCrate();
  const { id, viaHook: _viaHook, ...props } = config;
  // onReady より前 (マウント直後) から ij を公開し、未接続時の no-op も検証できるようにする。
  useEffect(() => {
    handles.set(id, ij);
  }, [id, ij]);
  return (
    <div data-testid={id}>
      <IchigoCrate ref={ref} {...props} onPrint={callbacks.onPrint} onError={callbacks.onError} />
    </div>
  );
}

let root: Root | null = null;

window.fixture = {
  mount(instances) {
    root?.unmount();
    root = createRoot(document.getElementById("root") as HTMLElement);
    root.render(
      <StrictMode>
        {instances.map((config) =>
          config.viaHook ? (
            <HookInstance key={config.id} config={config} />
          ) : (
            <RefInstance key={config.id} config={config} />
          ),
        )}
      </StrictMode>,
    );
  },
  unmount() {
    root?.unmount();
    root = null;
  },
  handle(id) {
    const h = handles.get(id);
    if (!h) throw new Error(`instance "${id}" is not ready`);
    return h;
  },
  events: eventsOf,
};
