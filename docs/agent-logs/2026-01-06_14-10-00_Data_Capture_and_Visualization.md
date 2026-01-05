# 2026-01-06_14-10-00_Data_Capture_and_Visualization

## 実施内容

- `src/lib/ble-client.ts`
  - `startNotifications`, `stopNotifications` 実装
  - イベントリスナーベースのコールバック処理
- `src/lib/store.ts`
  - `LogEntry` 型定義
  - ログ保存 (`logs`) と購読状態 (`activeSubscriptions`) の管理
  - `addLog` アクション (最大1000件制限付)
- `src/components/LogConsole.tsx` 作成
  - ログのリスト表示
  - バイナリデータ (`DataView`) の Hex / ASCII 変換表示
  - 自動スクロール機能
- `src/components/DeviceExplorer.tsx` 更新
  - Notify / Indicate プロパティを持つキャラクタリスティックへの購読ボタン追加
  - 購読状態の視覚的フィードバック
- `src/components/App.tsx` 更新
  - 接続時レイアウトを左右分割 (PC時) または上下分割 (SP時) に変更

## 変更ファイル一覧

- `src/lib/ble-client.ts`
- `src/lib/store.ts`
- `src/components/LogConsole.tsx`
- `src/components/DeviceExplorer.tsx`
- `src/components/App.tsx`

## 技術的判断ポイント

- **Data Visualization**: ネットワークキャプチャとしての用をなすため、Raw Hex と ASCII の両方を併記するデザインとした。
- **Memory Management**: ブラウザメモリ圧迫を防ぐため、ログ保持数を1000件に制限。
- **Component Separation**: ログ表示ロジックを独立させ、将来的なフィルタリング機能追加などに備えた。

## 残課題

- 特になし (主要機能実装完了)
- 細かなUI調整、エラーハンドリングの強化 (Polish phase)
