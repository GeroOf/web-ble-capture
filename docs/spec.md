# 仕様書 (Spec)

## アプリ概要

Web Bluetooth API を利用して、BLE Peripheral として動作するデバイスからのデータをキャプチャ・表示する Web アプリケーション。
バックエンドを使用せず、全ての処理をクライアントサイド（ブラウザ）で完結させる。
Astro + Preact + Tailwind CSS を使用し、SSG としてビルドされる。

## BLE キャプチャの対象・範囲

- **対象**: ユーザーがブラウザのダイアログで選択した任意の BLE デバイス (Generic Access Profile 等)
- **範囲**:
  - AD (Advertising Data) の一部（取得可能な場合）
  - GATT サービスおよびキャラクタリスティックの探索
  - Read / Notify / Indicate 可能なキャラクタリスティックからのデータ受信と表示
  - バイナリデータの Hex ダンプおよび ASCII 表示

## 画面構成

1. **英語トップページ (`/`)**
   - 英語版の正規 URL
   - ヘッダー: アプリタイトル、GitHub リンク、言語切り替え
   - メインエリア:
     - 「Scan & Connect」CTA
     - Web Bluetooth API 対応ブラウザに関する注意書き

2. **日本語トップページ (`/ja/`)**
   - ヘッダー: アプリタイトル、GitHub リンク、言語切り替え
   - メインエリア:
     - 「スキャンして接続」相当の CTA
     - 注意書き (Web Bluetooth API 対応ブラウザが必要である旨)
   - ステータス表示エリア (未接続/接続中など)

3. **キャプチャ画面 (接続後)**
   - デバイス基本情報 (Name, ID, RSSI等)
   - サービス/キャラクタリスティック ツリービュー
   - ログコンソール (受信パケットの時系列表示)
   - 切断ボタン
   - セッション履歴モーダル
   - UUID エイリアス管理モーダル

## データフロー

1. **Connect**: ユーザーが「スキャン」ボタン押下 -> `navigator.bluetooth.requestDevice()` -> ユーザーがデバイス選択 -> `GATT Server` 接続。
2. **Explore**: 接続後、`getPrimaryServices()` -> `getCharacteristics()` で構造を解析。
3. **Subscribe**: 通知可能なキャラクタリスティックに対して `startNotifications()` を実行。
4. **Receive**: `characteristicvaluechanged` イベントハンドラでデータを受信。
5. **Store**: アプリケーション内のステート (Preact Signals または State) にパケットデータを追加。
6. **Render**: UI コンポーネントがステート変更を検知してログを描画。

**制約事項**:

- サーバー通信なし。
- BLE デバイスのペアリング情報・接続状態は永続化しない（Web Bluetooth API の制約に準拠）。

## ローカル永続化

バックエンド通信を行わず、ブラウザのローカルストレージ機能のみを使用する。

### IndexedDB（セッションログ保存）

- デバイス接続ごとの通信ログを「セッション」単位で `IndexedDB` に自動保存する。
- セッションは `sessions` ストア、ログは `logs` ストアに格納し、`sessionId` インデックスで紐付ける。
- `DataView` は `Uint8Array` に変換して保存し、読み出し時に逆変換する。
- ユーザーは過去のセッション履歴を閲覧・テキストコピー・削除できる。

### localStorage（ユーザー設定）

- **カスタム Service UUID**: スキャン時に入力する追加 UUID をブラウザに記憶し、次回アクセス時に復元する。
- **UUID エイリアス辞書**: ユーザーが任意の UUID に人間可読な別名を設定し、デバイスエクスプローラーやログコンソールで表示に使用する。

## 多言語化 (i18n)

- 対応言語は **日本語 (`ja`)** と **英語 (`en`)** の 2 言語とする。
- 公開 URL は **英語 `/`**、**日本語 `/ja/`** を正とする。
- 初期 HTML は各ロケールごとに静的生成し、クライアントサイドの言語自動判定は行わない。
- `<html lang>`、title、description、keywords、OGP、Twitter Card、JSON-LD、`hreflang` はロケールごとに出し分ける。
- 画面文言、noscript 文言、非対応ブラウザ向けメッセージ、モーダル文言、ボタン文言を多言語化対象とする。
- デバイス名、UUID、ユーザーが入力したエイリアス値は翻訳しない。
- 接続ログや履歴ログは保存時に言語非依存のキーとパラメータを保持し、表示時に現在のロケールで解決する。
- 既存の IndexedDB ログは後方互換を維持し、旧形式の文字列ログも表示できるようにする。

## 分析と SEO (Analytics & SEO)

- **Google Analytics**: `PUBLIC_GA_ID` 環境変数が設定されている場合のみ、トラッキングコードを出力する。
  - 基本操作のアクションを送信する（`scan_device`, `connect_device`, `disconnect_device`, `subscribe_characteristic`, `unsubscribe_characteristic`）。
  - GAが遮断された場合でもエラーによる主要処理の中断を防ぐ実装とする。
- **Google Search Console**: `PUBLIC_GSC_VERIFICATION` 環境変数が設定されている場合のみ、所有権確認用の meta タグを出力する。
- **基本メタ情報**:
  - 日本語 Title: `Web BLE Capture | ブラウザ完結の簡易BLEパケットキャプチャ`
  - 日本語 Description: ブラウザだけで動作するインストール不要の軽量BLE通信キャプチャツール。Web Bluetooth APIを利用してPeripheralデバイスのGATT通信を解析します。
  - 英語 Title: `Web BLE Capture | Browser-based BLE packet capture`
  - 英語 Description: Lightweight BLE traffic capture running entirely in the browser with Web Bluetooth API support and no backend communication.
  - Keywords: `Web Bluetooth, BLE capture, BLEキャプチャ, network capture, browser-based, Web BLE Capture, GATT`
- **クローラビリティ**:
  - `public/robots.txt` および `public/sitemap.xml` を静的配置し、`/` と `/ja/` のインデックス登録をサポートする。
- **構造化データ**:
  - JSON-LD を用いて `WebApplication` として構造化データを定義し、検索エンジンでの表示を最適化する。

## 依存関係とセキュリティ更新

- npm パッケージの脆弱性診断は `npm audit --audit-level=low` を基準とし、検出 0 件を維持する。
- パッケージ更新は npm registry の安定版を対象とし、canary / beta / alpha / next などのプレリリース版は使用しない。
- Astro / Vite / Preact / Tailwind CSS / Vitest / oxc は本プロジェクトの固定技術スタックとして維持し、メジャー更新時も SSG、Progressive Enhancement、バックエンド通信なしの制約を壊さない。
- 依存更新後は `npm run format`、`npm run lint`、`npm test -- --run`、`npm run build` を実行し、静的生成とテストが通ることを確認する。
