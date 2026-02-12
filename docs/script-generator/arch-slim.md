EventBridge (毎日定時)
       │
       ▼
Step Functions
       │
       └─► Script Generator Agent [Lambda]
              │
              ├─► 1. Topic Selection Agent
              │      • Tavilyで今日の主要ニュース取得
              │      • クエリ拡張でバリエーション生成
              │      • RRFで複数ソースを統合
              │      • 政治経済カテゴリにスコアリング
              │      → Top 3 Topics
              │
              ├─► 2. Topic Deep Dive Agent (各トピック並列実行)
              │      • Grok (X API) でX上の意見収集
              │      • Tavilyで詳細情報・背景取得
              │      • 固有名詞保持を重視したチャンク化
              │      • リランキングで示唆に富んだ投稿を優先
              │      → Enriched Topic Context
              │
              ├─► 3. Fact Check Agent
              │      • 複数ソース間でクロスチェック
              │      • 信頼性スコアリング
              │      • 矛盾検出とアラート
              │      → Verified Facts
              │
              └─► 4. Dialogue Script Generator
                     • 解説役 vs 質問役のペルソナ設定
                     • 自然な対話フロー生成
                     • 固有名詞・専門用語の保持検証
                     → S3 (JSON)
