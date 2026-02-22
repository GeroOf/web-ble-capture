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

1. **トップページ (/)**
   - ヘッダー: アプリタイトル
   - メインエリア:
     - 「スキャンして接続」ボタン (CTA)
     - 注意書き (Web Bluetooth API 対応ブラウザが必要である旨)
   - ステータス表示エリア (未接続/接続中など)

2. **キャプチャ画面 (接続後)**
   - デバイス基本情報 (Name, ID, RSSI等)
   - サービス/キャラクタリスティック ツリービュー
   - ログコンソール (受信パケットの時系列表示)
   - 切断ボタン

## データフロー

1. **Connect**: ユーザーが「スキャン」ボタン押下 -> `navigator.bluetooth.requestDevice()` -> ユーザーがデバイス選択 -> `GATT Server` 接続。
2. **Explore**: 接続後、`getPrimaryServices()` -> `getCharacteristics()` で構造を解析。
3. **Subscribe**: 通知可能なキャラクタリスティックに対して `startNotifications()` を実行。
4. **Receive**: `characteristicvaluechanged` イベントハンドラでデータを受信。
5. **Store**: アプリケーション内のステート (Preact Signals または State) にパケットデータを追加。
6. **Render**: UI コンポーネントがステート変更を検知してログを描画。

**制約事項**:

- サーバー通信なし。
- データはページリロードで消失する (永続化要件なし)。

## 分析と SEO (Analytics & SEO)

- **Google Analytics**: `PUBLIC_GA_ID` 環境変数が設定されている場合のみ、トラッキングコードを出力する。
  - 基本操作のアクションを送信する（`scan_device`, `connect_device`, `disconnect_device`, `subscribe_characteristic`, `unsubscribe_characteristic`）。
  - GAが遮断された場合でもエラーによる主要処理の中断を防ぐ実装とする。
- **Google Search Console**: `PUBLIC_GSC_VERIFICATION` 環境変数が設定されている場合のみ、所有権確認用の meta タグを出力する。
- **基本メタ情報**:
  - Title: `Web BLE Capture | ブラウザ完結の簡易BLEパケットキャプチャ`
  - Description: ブラウザだけで動作するインストール不要の軽量BLE通信キャプチャツール。Web Bluetooth APIを利用してPeripheralデバイスのGATT通信を解析します。
  - Keywords: `Web Bluetooth, BLEキャプチャ, ネットワークキャプチャ, ブラウザ完結, Web BLE Capture, GATT`
- **クローラビリティ**:
  - `public/robots.txt` および `public/sitemap.xml` を静的配置し、クローラーへのインデックス登録をサポートする。
- **構造化データ**:
  - JSON-LD を用いて `WebApplication` として構造化データを定義し、検索エンジンでの表示を最適化する。
