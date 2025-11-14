import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, AlertTriangle, CheckCircle, Copy, Download, Loader2, Settings, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useTextlint } from "@/hooks/useTextlint";
import { APP_TITLE } from "@/const";
import { useTheme } from "@/contexts/ThemeContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

type FilterType = 'all' | 'error' | 'warning';

interface Rule {
  id: string;
  name: string;
  enabled: boolean;
  category: string;
}

// Helper function to get text context around an error
function getErrorContext(text: string, line: number, column: number, contextLength: number = 20): {
  before: string;
  error: string;
  after: string;
} {
  const lines = text.split('\n');
  if (line < 1 || line > lines.length) {
    return { before: '', error: '', after: '' };
  }

  const lineText = lines[line - 1];
  const errorStart = Math.max(0, column - 1);
  
  // Find the end of the error word (until space or punctuation)
  const restOfLine = lineText.substring(errorStart);
  const wordMatch = restOfLine.match(/^[^\s、。，．！？!?,.　]+/);
  const errorLength = wordMatch ? wordMatch[0].length : 1;
  
  const errorEnd = errorStart + errorLength;
  
  // Get context before error
  const beforeStart = Math.max(0, errorStart - contextLength);
  const before = (beforeStart > 0 ? '...' : '') + lineText.substring(beforeStart, errorStart);
  
  // Get error text
  const error = lineText.substring(errorStart, errorEnd);
  
  // Get context after error
  const afterEnd = Math.min(lineText.length, errorEnd + contextLength);
  const after = lineText.substring(errorEnd, afterEnd) + (afterEnd < lineText.length ? '...' : '');
  
  return { before, error, after };
}

export default function Home() {
  const [text, setText] = useState(() => {
    const saved = localStorage.getItem('textlint-text');
    return saved || '';
  });
  const [filter, setFilter] = useState<FilterType>('all');
  const [rules, setRules] = useState<Rule[]>([
    // ja-technical-writing rules
    { id: 'no-exclamation-question-mark', name: '感嘆符・疑問符の禁止', enabled: true, category: 'technical' },
    { id: 'ja-no-successive-word', name: '連続する単語', enabled: true, category: 'technical' },
    { id: 'ja-no-redundant-expression', name: '冗長な表現', enabled: true, category: 'technical' },
    { id: 'ja-no-weak-phrase', name: '弱い表現', enabled: true, category: 'technical' },
    { id: 'no-doubled-joshi', name: '二重助詞', enabled: true, category: 'technical' },
    { id: 'ja-no-abusage', name: 'ら抜き言葉', enabled: true, category: 'technical' },
    // AI writing rules
    { id: 'no-ai-hype-expressions', name: 'AI的な誇張表現', enabled: true, category: 'ai' },
    { id: 'no-ai-list-formatting', name: 'AI的なリスト書式', enabled: true, category: 'ai' },
    { id: 'no-ai-emphasis-patterns', name: 'AI的な強調パターン', enabled: true, category: 'ai' },
    { id: 'no-ai-colon-continuation', name: 'コロンの使用', enabled: true, category: 'ai' },
  ]);
  const [selectedErrorIndex, setSelectedErrorIndex] = useState<number | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { lintText, isLoading: isTextlintLoading } = useTextlint();
  const { theme, toggleTheme } = useTheme();

  // Save text to localStorage
  useEffect(() => {
    localStorage.setItem('textlint-text', text);
  }, [text]);

  // Lint text with debounce
  const [lintResult, setLintResult] = useState<any>(null);
  
  useEffect(() => {
    if (!text.trim() || isTextlintLoading) {
      setLintResult(null);
      return;
    }

    const timer = setTimeout(async () => {
      const result = await lintText(text);
      setLintResult(result);
    }, 300);

    return () => clearTimeout(timer);
  }, [text, lintText, isTextlintLoading]);

  const scrollToError = useCallback((line: number, column: number, errorIndex: number) => {
    if (!textareaRef.current) return;

    // Highlight the clicked error
    setSelectedErrorIndex(errorIndex);
    setTimeout(() => setSelectedErrorIndex(null), 2000); // Remove highlight after 2 seconds

    // Calculate character index from line and column
    const lines = text.split('\n');
    let charIndex = 0;
    for (let i = 0; i < line - 1 && i < lines.length; i++) {
      charIndex += lines[i].length + 1; // +1 for newline
    }
    charIndex += column - 1;

    // Find the end of the word to select
    const restOfLine = lines[line - 1]?.substring(column - 1) || '';
    const wordMatch = restOfLine.match(/^[^\s、。，．！？!?,.　]+/);
    const selectionLength = wordMatch ? wordMatch[0].length : 1;
    
    // Get selected text
    const selectedText = text.substring(charIndex, charIndex + selectionLength);
    
    // Focus and select the text
    textareaRef.current.focus();
    textareaRef.current.setSelectionRange(charIndex, charIndex + selectionLength);
    
    // Scroll to position
    const lineHeight = 24;
    const scrollPosition = Math.max(0, (line - 3) * lineHeight);
    textareaRef.current.scrollTop = scrollPosition;
    
    // Show toast with selected text
    const displayText = selectedText.length > 20 ? selectedText.substring(0, 20) + '...' : selectedText;
    toast.info(`行 ${line}, 列 ${column}: "${displayText}" を選択しました`);
  }, [text]);

  const toggleRule = useCallback((ruleId: string) => {
    setRules(prev => prev.map(rule => 
      rule.id === ruleId ? { ...rule, enabled: !rule.enabled } : rule
    ));
  }, []);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text);
    toast.success('テキストをコピーしました');
  }, [text]);

  const handleClear = useCallback(() => {
    setText('');
    setLintResult(null);
    toast.info('テキストをクリアしました');
  }, []);

  const handleExportJSON = useCallback(() => {
    if (!lintResult) return;
    
    const json = JSON.stringify(lintResult, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `textlint-result-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('JSON形式でエクスポートしました');
  }, [lintResult]);

  const filteredMessages = useMemo(() => {
    if (!lintResult?.messages) return [];
    
    const messages = lintResult.messages;
    
    // Filter by enabled rules
    const ruleFiltered = messages.filter((msg: any) => {
      const rule = rules.find(r => r.id === msg.ruleId);
      return !rule || rule.enabled;
    });
    
    // Filter by severity
    if (filter === 'error') {
      return ruleFiltered.filter((msg: any) => msg.severity === 2);
    } else if (filter === 'warning') {
      return ruleFiltered.filter((msg: any) => msg.severity === 1);
    }
    
    return ruleFiltered;
  }, [lintResult, filter, rules]);

  const errorCount = useMemo(() => 
    filteredMessages.filter((msg: any) => msg.severity === 2).length,
    [filteredMessages]
  );

  const warningCount = useMemo(() => 
    filteredMessages.filter((msg: any) => msg.severity === 1).length,
    [filteredMessages]
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">{APP_TITLE}</h1>
              <p className="text-sm text-muted-foreground">日本語文書チェッカー</p>
            </div>
            <div className="flex items-center gap-2">
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" size="icon" aria-label="ルール設定">
                    <Settings className="h-5 w-5" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>ルール設定</DialogTitle>
                    <DialogDescription>
                      個別のルールを有効化/無効化できます
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-6 py-4">
                    <div>
                      <h3 className="text-sm font-semibold mb-3">技術文書ルール</h3>
                      <div className="space-y-3">
                        {rules.filter(r => r.category === 'technical').map(rule => (
                          <div key={rule.id} className="flex items-center justify-between">
                            <Label htmlFor={rule.id} className="text-sm cursor-pointer">
                              {rule.name}
                            </Label>
                            <Switch
                              id={rule.id}
                              checked={rule.enabled}
                              onCheckedChange={() => toggleRule(rule.id)}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold mb-3">AI文書ルール</h3>
                      <div className="space-y-3">
                        {rules.filter(r => r.category === 'ai').map(rule => (
                          <div key={rule.id} className="flex items-center justify-between">
                            <Label htmlFor={rule.id} className="text-sm cursor-pointer">
                              {rule.name}
                            </Label>
                            <Switch
                              id={rule.id}
                              checked={rule.enabled}
                              onCheckedChange={() => toggleRule(rule.id)}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
              <Button 
                variant="outline" 
                size="icon"
                onClick={toggleTheme}
                aria-label="テーマ切り替え"
              >
                {theme === 'dark' ? '🌙' : '☀️'}
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Text Input Area */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>テキスト入力</CardTitle>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCopy}
                      disabled={!text}
                    >
                      <Copy className="h-4 w-4 mr-1" />
                      コピー
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleClear}
                      disabled={!text}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      クリア
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Textarea
                  ref={textareaRef}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="ここに文章を入力してください..."
                  className="min-h-[400px] text-base font-sans resize-none"
                  disabled={isTextlintLoading}
                />
                {isTextlintLoading && (
                  <div className="mt-4 flex items-center justify-center text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    <span>Textlintを初期化中...</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Results Panel */}
          <div className="lg:col-span-1">
            <Card className="sticky top-6">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>チェック結果</CardTitle>
                  {lintResult && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleExportJSON}
                    >
                      <Download className="h-4 w-4 mr-1" />
                      JSON
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {!text ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <CheckCircle className="h-12 w-12 mb-3 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      テキストを入力すると自動的にチェックが開始されます
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Filter Buttons */}
                    <div className="flex gap-2">
                      <Button
                        variant={filter === 'all' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setFilter('all')}
                        className="flex-1"
                      >
                        すべて表示
                      </Button>
                      <Button
                        variant={filter === 'error' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setFilter('error')}
                        className="flex-1"
                      >
                        エラーのみ
                      </Button>
                      <Button
                        variant={filter === 'warning' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setFilter('warning')}
                        className="flex-1"
                      >
                        警告のみ
                      </Button>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-destructive/10 rounded-lg p-4 text-center">
                        <div className="text-3xl font-bold text-destructive">{errorCount}</div>
                        <div className="text-sm text-muted-foreground">エラー</div>
                      </div>
                      <div className="bg-yellow-500/10 rounded-lg p-4 text-center">
                        <div className="text-3xl font-bold text-yellow-600 dark:text-yellow-500">{warningCount}</div>
                        <div className="text-sm text-muted-foreground">警告</div>
                      </div>
                    </div>

                    {/* Messages List */}
                    {filteredMessages.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-8 text-center">
                        <CheckCircle className="h-12 w-12 mb-3 text-green-500" />
                        <p className="font-medium text-foreground">
                          {filter === 'all' ? '問題は見つかりませんでした' : `${filter === 'error' ? 'エラー' : '警告'}は見つかりませんでした`}
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                          文章は適切に書かれています
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-[500px] overflow-y-auto">
                        {filteredMessages.map((message: any, index: number) => {
                          const context = getErrorContext(text, message.line, message.column);
                          const isSelected = selectedErrorIndex === index;
                          
                          return (
                            <div
                              key={index}
                              className={`border rounded-lg p-3 cursor-pointer transition-all ${
                                isSelected 
                                  ? 'border-primary bg-primary/10 shadow-md' 
                                  : 'border-border hover:bg-accent/50'
                              }`}
                              onClick={() => scrollToError(message.line, message.column, index)}
                            >
                              <div className="flex items-start gap-2">
                                {message.severity === 2 ? (
                                  <AlertCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                                ) : (
                                  <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-500 mt-0.5 flex-shrink-0" />
                                )}
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-foreground break-words">
                                    {message.message}
                                  </p>
                                  
                                  {/* Error Context */}
                                  {context.error && (
                                    <div className="mt-2 p-2 bg-muted/50 rounded text-xs font-mono break-all">
                                      <span className="text-muted-foreground">{context.before}</span>
                                      <span className="bg-destructive/20 text-destructive font-bold px-1 rounded">
                                        {context.error}
                                      </span>
                                      <span className="text-muted-foreground">{context.after}</span>
                                    </div>
                                  )}
                                  
                                  <div className="flex items-center gap-2 mt-2">
                                    <Badge variant="outline" className="text-xs">
                                      {message.line}:{message.column}
                                    </Badge>
                                    {message.ruleId && (
                                      <span className="text-xs text-muted-foreground truncate">
                                        {message.ruleId}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Footer Info */}
        <div className="mt-8 text-center text-sm text-muted-foreground">
          <p>
            このツールは
            <a
              href="https://textlint.github.io/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline mx-1"
            >
              textlint
            </a>
            を使用しています
          </p>
          <p className="mt-1">
            preset-ja-technical-writing（23ルール）と preset-ai-writing（5ルール）を適用
          </p>
        </div>
      </main>
    </div>
  );
}
