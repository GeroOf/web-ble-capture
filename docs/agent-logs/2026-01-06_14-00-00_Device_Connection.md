# 2026-01-06_14-00-00_Device_Connection

## 実施内容

- `@preact/signals` の導入と `src/lib/store.ts` の実装
- `src/lib/ble-client.ts` への接続・探索ロジック追加
  - `connect`, `disconnect`
  - `getServices`, `getCharacteristics`
  - `optionalServices` に主要な共通サービスを追加 (Battery, Generic Access等)
- `src/components/DeviceExplorer.tsx` 作成
  - サービス・キャラクタリスティックの階層表示
  - プロパティ (Read, Write 等) のバッジ表示
- `src/components/App.tsx` 作成
  - 接続状態 (`disconnected` <-> `connected`) の管理
  - スキャンボタンとエクスプローラーの表示切り替え
- `src/pages/index.astro` の更新
  - `App` コンポーネントのマウント
  - `noscript` および JS サポート判定の維持

## 変更ファイル一覧

- `src/lib/store.ts`
- `src/lib/ble-client.ts`
- `src/components/DeviceExplorer.tsx`
- `src/components/App.tsx`
- `src/pages/index.astro`
- `package.json` (@types/web-bluetooth, @preact/signals 追加)

## 技術的判断ポイント

- **Signals State Management**: 頻繁な更新（将来的なログ表示含む）に備え、Preact Signals を採用。
- **SPA-like Transition**: ページ遷移を行わず、`status` state に基づいてコンポーネントを切り替えることで、BLE 接続状態を維持。
- **Optional Services**: Web Bluetooth の仕様上、`acceptAllDevices: true` の場合はアクセスしたいサービスを `optionalServices` に明示する必要があるため、代表的な UUID をリストアップした。

## 残課題

- キャラクタリスティックからのデータ受信 (Notify/Indicate)
- ログ表示コンポーネントの実装
