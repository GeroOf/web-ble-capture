# AGENTS.md

本ドキュメントは Web アプリケーション(`BLE Network Capture`)向け AGENTS.md である

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

## ディレクトリ／ドキュメント運用ルール

### 初期構築プロセス

- プロジェクト初期化時に必ず以下を作成する
  - `docs/`
  - `docs/adr/`
  - `docs/agent-logs/`

---

### 設計・プランニング

#### 設計ドキュメント

- 保存先: `docs/spec.md`
- 内容:
  - アプリ概要
  - BLE キャプチャの対象・範囲
  - 画面構成
  - データフロー（※バックエンドなし前提）

#### ADR（Architecture Decision Record）

- 保存先: `docs/adr/`
- 命名規則: `YYYY-MM-DD_HH-MM-SS_adr.md`
- 各 ADR には以下を必ず含める
  - Context
  - Decision
  - Consequences

---

### 開発・実装プロセス

実装時は以下の順序を守ること。

1. 設計ドキュメント更新
2. ADR 作成（設計判断が発生した場合）
3. 実装
4. oxc による lint チェック
5. oxc による format
6. Vitest によるテスト実行
7. 作業ログ作成

---

### 作業ログ（Agent Logs）

- 保存先: `docs/agent-logs/`
- 命名規則: `YYYY-MM-DD_HH-MM-SS_作業内容表題.md`
- 内容:
  - 実施内容
  - 変更ファイル一覧
  - 技術的判断ポイント
  - 残課題（あれば）

---

## レビュー基準（Review Criteria）

以下を **すべて満たす必要がある**。

### 1. フロントエンド開発のベストプラクティス 2025 準拠

特に重視する項目:

- TypeScript strict 前提の型安全性
- Core Web Vitals を意識した設計
- Tailwind CSS のユーティリティファースト設計
- Vitest によるテスト容易性
- Progressive Enhancement の実践

※ RSC / サーバー依存設計は **本プロジェクトでは採用しない**

---

### 2. セキュリティ

- XSS を誘発する実装を行わない
- `innerHTML` の使用禁止
- CSP を破壊する設計を行わない
- BLE デバイス情報を外部に送信しない
- ログに個体識別可能な情報を残さない

---

## エージェント行動原則（For Coding Agents）

- **推測で実装しない**
- **設計判断は必ず文書化**
- **最小変更・最小依存**
- **「動く」より「壊れない」**
- 人間が後から読んで理解できるコードを書くこと

---

## 最終原則

> この AGENTS.md に反する判断を行う場合、
> **必ず ADR を作成し、明示的に例外として記録すること。**
