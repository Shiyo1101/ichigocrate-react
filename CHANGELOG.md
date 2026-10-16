# ichigocrate-react

## 0.2.1

### Patch Changes

- 1896d7b: wasm の初期化関数へ引数をオブジェクト形式で渡し、wasm-bindgen の非推奨 API の警告がコンソールに出ないようにした。

## 0.2.0

### Minor Changes

- 9384a5b: canvas へ `aria-label` / `aria-describedby` / `id` などの HTML 属性を渡せるようにし、`aria-label` の既定値 (`"IchigoCrate"`) を設定した。
- 6481fa5: Tab キーを捕捉せずブラウザのフォーカス移動に使う `captureTab` オプションを追加した (既定は従来どおり捕捉する)。
