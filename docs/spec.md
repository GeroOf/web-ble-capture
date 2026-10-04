# 仕様書 (Spec)

## アプリ概要

Web Bluetooth API を利用して、BLE Peripheral として動作するデバイスからのデータをキャプチャ・表示する Web アプリケーション。
バックエンドを使用せず、全ての処理をクライアントサイド（ブラウザ）で完結させる。
Astro + Preact + Tailwind CSS を使用し、SSG としてビルドされる。

## BLE キャプチャの対象・範囲

- **対象**: ユーザーがブラウザのダイアログで選択した任意の BLE デバイス (Generic Access Profile 等)
- **範囲**:
  - GATT サービスおよびキャラクタリスティックの探索
  - Read、Write with response / without response、Notify / Indicate
  - 記述子の探索・読取・書込
  - GATT API の値と操作の記録。無線上の全パケットやRSSIの取得は対象外。

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
   - デバイス基本情報 (Name, ID。接続中のメモリ上だけ)
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
5. **Store**: 部分DataViewを複製し、Preact Signalsとタブ内のセッション履歴に最大1000件を保持。
6. **Render**: UI コンポーネントがステート変更を検知してログを描画。

**制約事項**:

- サーバー通信なし。
- BLE デバイスのペアリング情報・接続状態は永続化しない（Web Bluetooth API の制約に準拠）。

## ペリフェラル検索

名前の完全一致または前方一致と、サービスのプリセット・カスタムUUIDでブラウザの機器選択を絞り込む。サービスUUIDは16/32bitまたは128bit形式を正規化し、追加サービスは16件まで。名前は248 UTF-8バイトまで。誤った入力をインラインで示し、API呼出前に検証する。

名前やサービスを指定しない場合は全機器を表示する。追加GATTサービスは `optionalServices` に含め、選択条件とアクセス許可を区別する。機器の選択、接続、サービス探索の進行を表示し、機器選択の取消はエラーにしない。接続・探索を取り消した後に応答した機器は切断する。

## GATT操作

能力に応じたRead、応答あり／なしのWrite、Notify / Indicateの購読・停止を提供する。書込はHexまたはUTF-8、512バイトまで。記述子はユーザー操作で探索し、読み書きの失敗はその操作内で表示する。全GATT操作を直列化し、複数UIからの操作が競合しないようにする。

キャラクタリスティックはサービスとインスタンスごとに識別する。切断・取消・接続変更時は通知のイベントを解除し、旧セッションの応答を新しいセッションへ反映しない。切断後も直前のログをメモリで閲覧できる。

## パケットログ

表示形式はHex+ASCII、Hex、ASCII、UTF-8、10進数、2進数、Base64、UInt16 LE、UInt16 BE、JSON。時刻は時計、ISO、セッション開始からの経過時間を選択する。形式に合わないパケットは警告と元のHexを表示し、隠さない。コピーは選択された表示形式を使う。

最新1000件を保持し、自動スクロールの切り替えとクリアを提供する。byteOffset / byteLengthを尊重して受信値を複製し、後続の値変更で過去のログが変わらないようにする。入力やパケットはテキストとして描画する。

## BLE機器なしの確認モード

画面の接続モード設定、または `PUBLIC_BLE_DEMO=true` のビルド時の初期設定で選択する。 明示した環境変数は保存済みの初期モードに優先する。自動接続はせず、クリックで仮想ペリフェラルに接続する。実機と共通のGATT型・探索・読取・書込・記述子・通知・ログUIを使う。確認モードの機器にはBatteryサービスと固定の検証用サービスを用意する。

サンプル通知は購読中に生成し、手動生成も可能。停止・切断でタイマーとイベントを解除する。Web Bluetooth非対応の環境でも確認でき、実機API・外部通信は使わない。画面に合成データであることを示し、実機の互換性をこのモードから推定しない。

## メモリと設定

バックエンド通信を行わず、ブラウザのローカルストレージ機能のみを使用する。

### タブ内のセッション履歴

- 履歴はメモリ上だけで最大20セッション、各1000ログを保持する。
- セッションの識別には機器の名前やIDを使わない。リロードすると履歴・接続状態・ログは消える。
- IndexedDBへデバイス情報やログを書き込まない。既存のブラウザデータは読み込み・変更・削除しない。
- ユーザーはタブ内の履歴を閲覧・コピー・削除できる。

### localStorage（ユーザー設定）

- **カスタム Service UUID**: スキャン時に入力する追加 UUID をブラウザに記憶し、次回アクセス時に復元する。
- **UUID エイリアス辞書**: ユーザーが任意の UUID に人間可読な別名を設定し、デバイスエクスプローラーやログコンソールで表示に使用する。
- **表示・接続モード**: パケット表示、時刻表示、実機／確認モードの設定だけを保存する。機器名・機器ID・ペアリング・パケットは保存しない。

## 多言語化 (i18n)

- 対応言語は **日本語 (`ja`)** と **英語 (`en`)** の 2 言語とする。
- 公開 URL は **英語 `/`**、**日本語 `/ja/`** を正とする。
- 初期 HTML は各ロケールごとに静的生成し、クライアントサイドの言語自動判定は行わない。
- `<html lang>`、title、description、keywords、OGP、Twitter Card、JSON-LD、`hreflang` はロケールごとに出し分ける。
- 画面文言、noscript 文言、非対応ブラウザ向けメッセージ、モーダル文言、ボタン文言を多言語化対象とする。
- デバイス名、UUID、ユーザーが入力したエイリアス値は翻訳しない。
- 接続ログや履歴ログは保存時に言語非依存のキーとパラメータを保持し、表示時に現在のロケールで解決する。

## 分析と SEO (Analytics & SEO)

- **外部分析**: 分析コード・外部スクリプト・イベント送信を行わない。
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
- 配布元は `.npmrc` で npm 公式 registry に固定し、インストール時スクリプトは原則抑止する。必要なスクリプトだけ、内容を確認してから実行する。
- Node.js は `^22.22.2 || ^24.15.0 || >=26.0.0`、npm は9.6.5以上を必要とする。Preact は公式 Astro 連携の対応範囲内の最新10系を使い、型検査の TypeScript は公式 checker が対応する6系を使う。
- 型検査は `npm run check`、実ブラウザ E2E は `npm run test:e2e` を使う。E2E はインストール済み Google Chrome と模擬 BLE API を使い、新しい一時出力先へビルドする。実機互換性を E2E の成功から推定しない。
- 未修正版の `http-cache-semantics` に対する検出は残る。現行 SSG ではブラウザ側に含まず、Astro の利用経路はビルド時の画像キャッシュである。影響条件と仕様の検出0件維持に対する例外は `docs/agent-logs/2026-10-03_22-44-41_パッケージ最新化とセキュリティ更新.md` に記録し、未解消を検出0件とは扱わない。
