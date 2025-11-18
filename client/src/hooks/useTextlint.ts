import { useState, useCallback } from 'react';

export interface TextlintMessage {
  type: string;
  ruleId: string;
  message: string;
  line: number;
  column: number;
  severity: number;
}

export interface LintResult {
  messages: TextlintMessage[];
  errorCount: number;
  warningCount: number;
}

// モックデータ生成関数
function generateMockLintResult(text: string): LintResult {
  const messages: TextlintMessage[] = [];
  let line = 1;
  let column = 1;

  // テキストを行に分割
  const lines = text.split('\n');

  lines.forEach((lineText, lineIndex) => {
    const currentLine = lineIndex + 1;

    // 1. 感嘆符・疑問符のチェック
    const exclamationPattern = /[\uff01!\uff1f?]+/g;
    let exclamationMatch;
    while ((exclamationMatch = exclamationPattern.exec(lineText)) !== null) {
      const match = exclamationMatch;
      messages.push({
        type: 'lint',
        ruleId: 'no-exclamation-question-mark',
        message: '文末に感嘆符や疑問符を使用しないでください',
        line: currentLine,
        column: (match.index || 0) + 1,
        severity: 2
      });
    }

    // 2. 文の長さチェック（100文字以上）- 句点で文を分割してチェック
    const sentences = lineText.split(/[。．]/);
    let currentColumn = 1;
    sentences.forEach((sentence) => {
      if (sentence.length > 100) {
        messages.push({
          type: 'lint',
          ruleId: 'sentence-length',
          message: `文が長すぎます。100文字以内にしてください。現在の文字数: ${sentence.length}`,
          line: currentLine,
          column: currentColumn,
          severity: 2
        });
      }
      currentColumn += sentence.length + 1; // +1 は句点の分
    });

    // 3. 冗長な表現のチェック
    const redundantPhrases = [
      { pattern: /まず最初に/g, suggestion: '「まず」または「最初に」' },
      { pattern: /することができる/g, suggestion: '「できる」' },
      { pattern: /することが可能/g, suggestion: '「可能」' }
    ];

    redundantPhrases.forEach(({ pattern, suggestion }) => {
      let match;
      while ((match = pattern.exec(lineText)) !== null) {
        messages.push({
          type: 'lint',
          ruleId: 'ja-no-redundant-expression',
          message: `冗長な表現です。${suggestion}を使用してください`,
          line: currentLine,
          column: (match.index || 0) + 1,
          severity: 1
        });
      }
    });

    // 4. 弱い表現のチェック
    const weakPhrases = [
      /かもしれない/g,
      /思う/g,
      /だろう/g
    ];

    weakPhrases.forEach(pattern => {
      let match;
      while ((match = pattern.exec(lineText)) !== null) {
        messages.push({
          type: 'lint',
          ruleId: 'ja-no-weak-phrase',
          message: '弱い表現を使用しています。より明確な表現を検討してください',
          line: currentLine,
          column: (match.index || 0) + 1,
          severity: 1
        });
      }
    });

    // 5. 二重助詞のチェック - すべてのマッチを検出
    const doubleJoshiPattern = /([はがをに])[^はがをに]{0,10}\1/g;
    let doubleJoshiMatch;
    while ((doubleJoshiMatch = doubleJoshiPattern.exec(lineText)) !== null) {
      const match = doubleJoshiMatch;
      messages.push({
        type: 'lint',
        ruleId: 'no-doubled-joshi',
        message: `助詞「${match[1]}」が連続して使用されています`,
        line: currentLine,
        column: (match.index || 0) + 1,
        severity: 1
      });
    }

    // 6. 連続する単語のチェック - 日本語単語と英単語を区別して検出
    // 日本語の単語（ひらがな、カタカナ、漢字の2文字以上）
    const japaneseWordPattern = /([\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]{2,})\1/g;
    let japaneseMatch;
    while ((japaneseMatch = japaneseWordPattern.exec(lineText)) !== null) {
      const match = japaneseMatch;
      messages.push({
        type: 'lint',
        ruleId: 'ja-no-successive-word',
        message: `「${match[1]}」が連続しています`,
        line: currentLine,
        column: (match.index || 0) + 1,
        severity: 2
      });
    }

    // 英単語（アルファベット3文字以上）
    // パターン1: 完全に連続（testtest）
    const englishWordPattern = /([a-zA-Z]{3,})\1/g;
    let englishMatch;
    while ((englishMatch = englishWordPattern.exec(lineText)) !== null) {
      const match = englishMatch;
      messages.push({
        type: 'lint',
        ruleId: 'ja-no-successive-word',
        message: `「${match[1]}」が連続しています`,
        line: currentLine,
        column: (match.index || 0) + 1,
        severity: 2
      });
    }

    // パターン2: スペース区切り（test test）
    const englishWordPatternWithSpace = /\b([a-zA-Z]{2,})\s+\1\b/g;
    let englishMatchWithSpace;
    while ((englishMatchWithSpace = englishWordPatternWithSpace.exec(lineText)) !== null) {
      const match = englishMatchWithSpace;
      messages.push({
        type: 'lint',
        ruleId: 'ja-no-successive-word',
        message: `「${match[1]}」が連続しています（スペース区切り）`,
        line: currentLine,
        column: (match.index || 0) + 1,
        severity: 2
      });
    }

    // 7. ら抜き言葉のチェック
    const ranukiPatterns = [
      /食べれる/g,
      /見れる/g,
      /着れる/g,
      /考えれる/g
    ];

    ranukiPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(lineText)) !== null) {
        messages.push({
          type: 'lint',
          ruleId: 'ja-no-abusage',
          message: 'ら抜き言葉を使用しています',
          line: currentLine,
          column: (match.index || 0) + 1,
          severity: 1
        });
      }
    });

    // 8. 連続する漢字のチェック（7文字以上）
    const kanjiSequence = lineText.match(/[\u4e00-\u9faf]{7,}/);
    if (kanjiSequence) {
      messages.push({
        type: 'lint',
        ruleId: 'max-kanji-continuous-len',
        message: `連続する漢字が長すぎます（${kanjiSequence[0].length}文字）。6文字以内にしてください`,
        line: currentLine,
        column: lineText.indexOf(kanjiSequence[0]) + 1,
        severity: 1
      });
    }

    // 9. AI的な表現のチェック
    const aiPatterns = [
      { pattern: /革命的な/g, ruleId: 'no-ai-hype-expressions' },
      { pattern: /画期的な/g, ruleId: 'no-ai-hype-expressions' },
      { pattern: /✅/g, ruleId: 'no-ai-list-formatting' },
      { pattern: /\*\*[^*]+\*\*:/g, ruleId: 'no-ai-emphasis-patterns' }
    ];

    aiPatterns.forEach(({ pattern, ruleId }) => {
      let match;
      while ((match = pattern.exec(lineText)) !== null) {
        messages.push({
          type: 'lint',
          ruleId,
          message: 'AI生成文書に見られる表現パターンです',
          line: currentLine,
          column: (match.index || 0) + 1,
          severity: 1
        });
      }
    });

    // 10. コロンの使用チェック
    if (lineText.includes(':') || lineText.includes('：')) {
      const colonIndex = Math.max(lineText.indexOf(':'), lineText.indexOf('：'));
      messages.push({
        type: 'lint',
        ruleId: 'no-ai-colon-continuation',
        message: 'コロンの使用は避けてください',
        line: currentLine,
        column: colonIndex + 1,
        severity: 1
      });
    }
  });

  const errorCount = messages.filter(m => m.severity === 2).length;
  const warningCount = messages.filter(m => m.severity === 1).length;

  return {
    messages,
    errorCount,
    warningCount
  };
}

export function useTextlint() {
  const [isLoading] = useState(false);
  const [error] = useState<string | null>(null);

  const lintText = useCallback(
    async (text: string): Promise<LintResult> => {
      // 実際のtextlintの代わりにモックデータを返す
      return new Promise((resolve) => {
        setTimeout(() => {
          const result = generateMockLintResult(text);
          console.log('Mock lint result:', result);
          resolve(result);
        }, 100); // 100msの遅延でリアルな動作を模擬
      });
    },
    []
  );

  return {
    lintText,
    isLoading,
    error
  };
}
