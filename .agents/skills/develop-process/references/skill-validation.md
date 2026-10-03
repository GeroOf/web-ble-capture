# スキルの検証

スキルと補助スクリプトを変更したときに使う。

```sh
npm run skills:check
npm run skills:test
```

`skills:check` は `@.agents/skills/develop-process/scripts/check-skills.mjs` を実行する。Node.js の標準モジュールだけで、単一行で書いた名前・説明の形式、名前の一意性、ルート基準の参照先、参照文書の読み込み経路、npm コマンドの存在を検査する。YAML 全体、文書の工程・言い回し・指示の妥当性は判定しない。

`skills:test` は `@.agents/skills/develop-process/scripts/vitest.config.mjs` を使い、`@.agents/skills/develop-process/scripts/check-skills.test.ts` を Vitest で実行する。正常な構成と、不正なメタデータ、参照切れ、範囲外の参照などの失敗を一時ディレクトリで検証する。

実行環境の Codex が利用できる場合は、App Server の `skills/list` を `forceReload: true` で実行し、対象スキルと読み込みエラーを確認する。利用できない場合は未実施と記録する。

GPT-6.1 Sol に、最終スキルと必要な生の入力だけを渡して、機能修正、依存更新、文書だけの変更、対象外の依頼を評価する。実装者の期待する回答や修正案は渡さない。利用できる独立した評価者を使い、実行・成果物から適用範囲、工程、合否判断を確認する。

構造検査と内容レビューは分ける。要求工程、指示の矛盾、不要な重複、造語・スラング、過去の経緯の記述を内容レビューで確認し、指摘を直して再評価する。
