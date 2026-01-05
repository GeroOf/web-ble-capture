# 2026-01-06_00-00-00_Initial_UI_and_Scanning

## 実施内容

- `src/layouts/Layout.astro` 作成
  - 共通ヘッダー、メタタグ設定
- `src/styles/global.css` 作成
  - Tailwind CSS v4 設定
  - カラーパレット定義 (`brand-*`)
- `src/lib/ble-client.ts` 作成
  - `BluetoothManager` クラス
  - `isSupported` 判定
  - `scanning` メソッド (acceptAllDevices: true)
- `src/pages/index.astro` 作成
  - Progressive Enhancement 実装 (JS/WebBluetooth 非対応時の表示)
  - UI 実装 (Scan ボタン)

## 変更ファイル一覧

- `src/layouts/Layout.astro`
- `src/styles/global.css`
- `src/lib/ble-client.ts`
- `src/pages/index.astro`
- `task.md` (進捗更新)

## 技術的判断ポイント

- **Tailwind v4**: `@theme` ブロックを使用した CSS 変数定義を採用。
- **Progressive Enhancement**: `noscript` タグと JS によるクラス切り替え (`hidden`) を併用し、JS 無効時・Web Bluetooth 非対応時の両方をカバー。
- **Accept All Devices**: まずは全デバイススキャン (`acceptAllDevices: true`) で実装。サービスフィルタは後工程で検討。

## 残課題

- 接続後の画面遷移 (現在はコンソールログ出力のみ)
- 受信データの可視化
