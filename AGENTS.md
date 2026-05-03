# AGENTS.md

本ドキュメントは Web アプリケーション(`Web BLE Capture`)向け AGENTS.md である

## 目的（Purpose）

本プロジェクトは **Web アプリとして動作する BLE Peripheral 向け簡易ネットワークキャプチャ** を開発することを目的とする。
本ファイルは、**コーディングエージェント（AI 含む）が遵守すべき設計・実装・運用ルールを定義する唯一の指針**である。

---

## プロジェクト制約（Hard Constraints）

### 技術スタック（固定）

以下は **変更不可** とする。

- フレームワーク: **Astro**
- UI: **Preact（宣言的 UI）**
- 言語: **TypeScript（strict 前提）**
- スタイリング: **Tailwind CSS**
- ビルドツール: **Vite**
- テスト: **Vitest**
- Linter / Formatter: **oxc**
- Web API: **Web Bluetooth API**
- ページ種別: **SSG（Static Site Generation）**
- 通信制約: **バックエンドとの通信を一切行わない**
  - `fetch`
  - WebSocket
  - SSE
  - 外部 API 呼び出し
    → **すべて禁止**

---

## 禁止事項（Must Not）

コーディングエージェントは以下を **絶対に行ってはならない**。

- クラウドへの自動デプロイ
- 既存ファイルの削除
- Git 操作（commit / push / branch / tag 等）
- npm の **グローバルインストール**
- npm 以外のパッケージインストール手段の使用
  - yarn / pnpm / bun / curl install 等は禁止

---

## 基本設計原則（Design Principles）

### 1. SSG + Progressive Enhancement

- 初期 HTML は **完全に静的**
- Web Bluetooth 機能は **クライアントサイドのみで段階的に有効化**
- JavaScript 非対応環境でも **壊れない HTML 構造**を維持する

### 2. Web Bluetooth API の扱い

- 必ず **ユーザー操作（click / tap）をトリガー**に使用
- `navigator.bluetooth` の存在チェックを行う
- Safari 非対応を前提とした **ガード実装**を行う
- ペアリング情報・デバイス情報を永続化しない

### 3. パフォーマンスと軽量性

- Astro Islands を利用し、JS 配信は最小化
- 不要な状態管理ライブラリは導入しない
- バンドルサイズを常に意識する

---

## エージェント・スキル（Agent Skills）への委譲

開発手順、ドキュメント運用ルール、レビュー基準（フロントエンドベストプラクティス2026、セキュリティ等）、およびエージェントの行動原則については、以下のスキル定義を参照し、遵守すること。

- **`develop-process` Skill**: `.agent/skills/develop-process/SKILL.md`

> この AGENTS.md や Agent Skills に反する判断を行う場合、**必ず作業ログへ明示的に例外として記録すること。**
