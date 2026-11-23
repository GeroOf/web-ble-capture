# Web BLE Capture

ブラウザで BLE Peripheral の GATT 通信を確認する静的アプリ。リポジトリを変更するときは `@.agents/skills/develop-process/SKILL.md` を読む。`@path` はリポジトリルートからのパス。

## 固定制約

- Astro、Preact、strict TypeScript、Tailwind CSS、Vite、Vitest、oxc、Web Bluetooth API を使う。
- 初期 HTML は SSG で生成し、JavaScript 無効でも表示と案内を保つ。BLE は Astro Islands のクライアント側に限り、配信 JS と状態管理を小さく保つ。
- BLE 操作はユーザー操作から始める。`navigator.bluetooth` を確認し、Safari などの非対応環境を扱う。ペアリング情報、機器情報、パケットは永続化しない。
- アプリに `fetch`、WebSocket、SSE、外部 API などのバックエンド通信を導入しない。
- 自動デプロイ、既存ファイルの削除、Git 操作、npm のグローバルインストール、npm 以外でのパッケージ導入は禁止。明示的に許可された例外は、対象と根拠を作業ログに記録する。

## 判断の原則

- **YAGNI**。今回の受け入れ条件に必要な変更に絞り、対象外の既存の振る舞いを保つ。
- **KISS**。既存の実装・テスト・コマンドを使い、変更の意図を直接読める形にする。
- **t-wada のテスト駆動開発**。振る舞いの変更はテストリストから一件ずつ Red、Green、Refactor の順で進める。
- **検査の追加**。入力と実行条件を固定し、期待結果を機械的に照合できる決定論的なハーネスを優先する。
