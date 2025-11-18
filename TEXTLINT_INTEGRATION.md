# textlintブラウザ統合調査結果と実装計画

**作成日**: 2025年11月18日
**目的**: 本家textlintをブラウザ環境で動作させる方法を調査し、実装計画を策定する

---

## 調査概要

textlintをブラウザ環境で動作させる方法について、公式ドキュメント、GitHubリポジトリ、実装例を調査しました。以下、実装可能なアプローチと推奨実装方法をまとめます。

---

## 実装可能なアプローチ（優先順位付き）

### 【推奨】アプローチ1: @textlint/script-compiler

**概要**: textlint公式が提供する、textlint設定からWeb Workerコードを自動生成するツール

**実装手順**:

1. **依存関係の追加**
```bash
pnpm add textlint @textlint/website-generator
pnpm add textlint-rule-preset-ja-technical-writing
pnpm add @textlint-ja/textlint-rule-preset-ai-writing
pnpm add textlint-filter-rule-comments
```

2. **package.jsonにスクリプト追加**
```json
{
  "scripts": {
    "build:textlint": "textlint-website-generator --outputDir public/textlint"
  }
}
```

3. **ビルドと統合**
```bash
pnpm run build:textlint
```

**メリット**:
- ✅ 公式ツールのため、メンテナンスと互換性が保証される
- ✅ `.textlintrc`から自動的にWeb Workerコードを生成
- ✅ GitHub Pagesへのデプロイが簡単
- ✅ 実装例が存在する（textlint-rule-preset-ja-technical-writingデモ）

**デメリット**:
- ⚠️ ブラウザ対応していないルールは動作しない
- ⚠️ カスタマイズの自由度は限定的

**実装例**:
- https://textlint-ja.github.io/textlint-rule-preset-ja-technical-writing/

---

### アプローチ2: textlint-browser-runner（CDN利用）

**概要**: すでにバンドルされたtextlintをCDNから読み込む方法

**実装手順**:

```html
<script>
  window.kuromojin = {
    dicPath: "https://cdn.jsdelivr.net/npm/kuromoji@0.1.2/dict"
  };
</script>
<script src="https://cdn.jsdelivr.net/npm/textlint-browser-runner@latest/dist/textlint.bundle.min.js"></script>
```

**メリット**:
- ✅ 最も簡単に導入できる
- ✅ ビルドプロセスが不要

**デメリット**:
- ❌ カスタマイズが非常に限定的
- ❌ バンドルサイズが大きい

---

### アプローチ3: @textlint/kernel + Vite手動バンドル

**概要**: @textlint/kernelを直接使用し、Viteで手動バンドルする方法

**メリット**:
- ✅ 完全なカスタマイズが可能
- ✅ バンドルサイズの最適化が可能

**デメリット**:
- ❌ 実装が複雑で、時間がかかる（推定16-32時間）
- ❌ Node.js依存の問題を手動で解決する必要
- ❌ メンテナンスコストが高い

---

## 推奨アプローチ: アプローチ1（@textlint/script-compiler）

### 推奨理由

1. **公式サポート**: textlint公式が提供しているため、長期的なメンテナンスが期待できる
2. **実装の簡潔性**: `.textlintrc`から自動的にWeb Workerコードを生成
3. **既存の成功例**: textlint-rule-preset-ja-technical-writingの公式デモで実績がある
4. **GitHub Pages対応**: 静的サイトとして簡単にデプロイできる
5. **段階的な移行が可能**: モック実装から段階的に置き換え可能

---

## 具体的な実装計画（推定工数: 5-7日）

### フェーズ1: 基本実装（1-2日）

1. **依存関係の追加**
```bash
pnpm add textlint @textlint/website-generator
pnpm add textlint-rule-preset-ja-technical-writing
pnpm add @textlint-ja/textlint-rule-preset-ai-writing
pnpm add textlint-filter-rule-comments
```

2. **.textlintrcの更新**
```json
{
  "filters": {
    "comments": true
  },
  "rules": {
    "preset-ja-technical-writing": {
      "sentence-length": {
        "max": 100
      },
      "no-doubled-joshi": true,
      "no-mix-dearu-desumasu": true,
      "ja-no-weak-phrase": true,
      "ja-no-redundant-expression": true,
      "ja-no-successive-word": true,
      "ja-no-abusage": true,
      "max-kanji-continuous-len": {
        "max": 6
      }
    },
    "@textlint-ja/textlint-rule-preset-ai-writing": true
  }
}
```

3. **package.jsonにスクリプト追加**
```json
{
  "scripts": {
    "build:textlint": "textlint-website-generator --outputDir public/textlint"
  }
}
```

4. **Web Workerスクリプトのビルド**
```bash
pnpm run build:textlint
```

### フェーズ2: React統合（2-3日）

1. **Web Workerクライアントの作成**
```typescript
// client/src/lib/textlint-worker-client.ts
export class TextlintWorkerClient {
  private worker: Worker;
  private messageId = 0;
  private callbacks = new Map<number, (result: any) => void>();

  constructor(workerUrl: string) {
    this.worker = new Worker(workerUrl);
    this.worker.addEventListener('message', this.handleMessage.bind(this));
  }

  private handleMessage(event: MessageEvent) {
    const { id, results, error } = event.data;
    const callback = this.callbacks.get(id);
    if (callback) {
      callback(error ? { error } : { results });
      this.callbacks.delete(id);
    }
  }

  async lintText(text: string): Promise<any> {
    const id = this.messageId++;

    return new Promise((resolve, reject) => {
      this.callbacks.set(id, (result) => {
        if (result.error) {
          reject(new Error(result.error));
        } else {
          resolve(result.results);
        }
      });

      this.worker.postMessage({ id, command: 'lint', text });
    });
  }

  terminate() {
    this.worker.terminate();
  }
}
```

2. **useTextlintフックの更新**
```typescript
// client/src/hooks/useTextlint.ts
import { useState, useEffect, useRef } from 'react';
import { TextlintWorkerClient } from '../lib/textlint-worker-client';

const USE_REAL_TEXTLINT = import.meta.env.VITE_USE_REAL_TEXTLINT === 'true';

export function useTextlint() {
  const [isLoading, setIsLoading] = useState(USE_REAL_TEXTLINT);
  const workerRef = useRef<TextlintWorkerClient | null>(null);

  useEffect(() => {
    if (USE_REAL_TEXTLINT) {
      // Web Workerの初期化
      workerRef.current = new TextlintWorkerClient('/textlint/textlint.worker.js');
      setIsLoading(false);

      return () => {
        workerRef.current?.terminate();
      };
    }
  }, []);

  const lintText = async (text: string) => {
    if (USE_REAL_TEXTLINT) {
      if (!workerRef.current) {
        throw new Error('Worker not initialized');
      }
      return await workerRef.current.lintText(text);
    } else {
      // モック実装を使用
      return generateMockLintResult(text);
    }
  };

  return {
    lintText,
    isLoading
  };
}
```

### フェーズ3: テストとデバッグ（1-2日）

1. **Playwright MCPでE2Eテスト**
2. **パフォーマンス最適化**
3. **エラーハンドリングの実装**

### フェーズ4: モック実装からの置き換え（1日）

1. **環境変数の設定**
```env
VITE_USE_REAL_TEXTLINT=true
```

2. **段階的な切り替え**
3. **モック実装の削除（または保持）**

---

## 技術的な考慮事項

### 1. Kuromoji辞書の設定

日本語ルールは形態素解析にKuromojiを使用しており、辞書ファイルのロードが必要です。

```javascript
// HTMLのhead内またはスクリプト実行前に設定
window.kuromojin = {
  dicPath: "https://cdn.jsdelivr.net/npm/kuromoji@0.1.2/dict"
};
```

### 2. バンドルサイズの最適化

textlintとルールプリセット、Kuromoji辞書を含めると、バンドルサイズが大きくなる可能性があります。

**最適化手法**:
- Web Worker化（メインスレッドをブロックしない）
- 必要なルールのみ有効化
- コード分割とレイジーロード

### 3. ブラウザ互換性

**textlint-rule-preset-ja-technical-writing**: ✅ 基本的に対応
**@textlint-ja/textlint-rule-preset-ai-writing**: ✅ 基本的に対応

公式デモで動作確認済み: https://textlint-ja.github.io/textlint-rule-preset-ja-technical-writing/

---

## 実装上のリスクと対策

### リスク1: ブラウザで動作しないルールがある

**対策**:
- 公式デモと同じルールセットを使用
- 動作確認を段階的に実施

### リスク2: バンドルサイズが大きくなる

**対策**:
- Web Worker化でメインスレッドへの影響を最小化
- 必要なルールのみ有効化
- CDNからKuromoji辞書を読み込み

### リスク3: 実装に時間がかかる

**対策**:
- フェーズごとに実装を進める
- モック実装を並行して維持（フォールバック）

---

## 参考リソース

### 公式ドキュメント・リポジトリ

- **textlint公式**: https://textlint.github.io/
- **@textlint/kernel**: https://www.npmjs.com/package/@textlint/kernel
- **@textlint/script-compiler**: https://www.npmjs.com/package/@textlint/script-compiler
- **textlint/editor**: https://github.com/textlint/editor
- **textlint/editor-script-template**: https://github.com/textlint/editor-script-template

### デモ・実装例

- **textlint Playground**: https://textlint.org/playground/
- **ja-technical-writingデモ**: https://textlint-ja.github.io/textlint-rule-preset-ja-technical-writing/
- **textlint-browser-runner**: https://mobilusoss.github.io/textlint-browser-runner/

---

## まとめ

本家textlintのブラウザ統合は、**@textlint/script-compiler + @textlint/website-generator**を使用することで実現可能です。公式ツールを活用することで、メンテナンス性とブラウザ互換性を確保しながら、textlint-rule-preset-ja-technical-writingと@textlint-ja/textlint-rule-preset-ai-writingを統合できます。

**推定工数**: 5-7日
**実装難易度**: 中
**推奨開始時期**: GitHub Pagesへのデプロイ完了後

このアプローチにより、モック実装から本家textlintへの段階的な移行が可能です。
