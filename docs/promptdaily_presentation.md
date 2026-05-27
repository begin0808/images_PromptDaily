# ✨ Studio0808_PromptDaily
## 每日 AI 繪圖提示詞自動訂閱服務 — 完整簡報

---

<!-- 📄 第 1 頁：封面 -->

## 🎨 PromptDaily — 每天為您蒐集全球最火熱的 AI 繪圖提示詞

> **開發者**：Studio 0808  
> **版本**：v1.0  
> **發佈日期**：2026 年 5 月  
> **網站**：[https://begin0808.github.io/images_PromptDaily/](https://begin0808.github.io/images_PromptDaily/)

**核心理念**：不用再到處爬文找靈感！我們每天從全球知名 AI 藝術社群嚴選最熱門的圖片與 Prompt，直接送達您的信箱。

- ☀ 每天早上 05:00 準時發送
- 🆓 完全免費
- 🚫 無廣告干擾
- 🔓 隨時可取消訂閱

---

<!-- 📄 第 2 頁：解決的痛點 -->

## 🔥 為什麼需要 PromptDaily？

### AI 繪圖創作者的日常困擾

在 AI 繪圖的世界裡，**提示詞（Prompt）** 就是一切的起點。然而，每天要手動瀏覽多個平台尋找靈感，是一件耗時又低效的事情。

| 痛點 | 說明 |
|------|------|
| ⏰ **花大量時間瀏覽** | 每天需要分別打開 PromptHero、OpenArt 等平台，逐一瀏覽 |
| 🔍 **資訊分散** | 好的 Prompt 分佈在不同平台、不同分類中 |
| 📉 **容易錯過趨勢** | 無法掌握當日最熱門的風格與技巧 |
| 🧠 **靈感來源單一** | 習慣只看某一個平台，限制了創作視野 |

### PromptDaily 的解法

> 🎯 **一封信，三大來源，九組精選** — 每天早上打開信箱就能獲得最新靈感。

PromptDaily 每天凌晨自動從 3 個 AI 藝術社群平台爬取各 Top 3 最熱門作品，附上完整圖片與提示詞，組裝成精美的 HTML 電子報，在早上 05:00 準時送達您的信箱。

---

<!-- 📄 第 3 頁：系統架構總覽 -->

## 🏗️ 系統架構總覽

PromptDaily 是一個 **完全無伺服器（Serverless）** 的自動化系統，完全依賴 GitHub 生態系免費運作。

### 架構圖

```
┌─────────────────────────────────────────────────────────┐
│                    GitHub Repository                     │
├──────────────────┬──────────────────────────────────────┤
│   前端（Pages）    │         後端（Actions + Scripts）       │
│                  │                                      │
│  index.html      │  .github/workflows/daily-prompt.yml  │
│  (訂閱首頁)       │  (每日排程：UTC 21:00 = 台灣 05:00)    │
│                  │         │                             │
│  unsubscribe.html│         ▼                             │
│  (取消訂閱)       │  scripts/scraper.js                   │
│                  │  (Puppeteer 爬蟲)                      │
│  plan.html       │         │                             │
│  (開發計畫)       │         ▼                             │
│                  │  scripts/emailTemplate.js             │
│  data/           │  (HTML 信件模板產生器)                   │
│  └ latest.json   │         │                             │
│  (爬取結果快取)   │         ▼                              │
│                  │  scripts/mailer.js                    │
│                  │  (Nodemailer Gmail SMTP 寄信)          │
├──────────────────┴──────────────────────────────────────┤
│              外部服務                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │ Google Sheets │  │  Gmail SMTP  │  │  PromptHero   │  │
│  │ (訂閱名單)    │  │ (信件寄送)    │  │  (資料來源)    │  │
│  └──────────────┘  └──────────────┘  └───────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### 關鍵設計決策

- ✅ **個人使用優先** — 不使用 Firebase，Email 以環境變數管理
- ✅ **Gmail SMTP** — 使用 Nodemailer + Gmail App Password 寄信
- ✅ **GitHub 全托管** — 前端 GitHub Pages ＋ 後端 GitHub Actions Cron
- ✅ **免費運作** — 不需要租用任何伺服器或資料庫
- ✅ **Google Sheets 訂閱** — 透過 Apps Script 管理訂閱者名單（上限 50 人）

---

<!-- 📄 第 4 頁：技術棧 -->

## ⚙️ 技術棧 (Tech Stack)

### 前端技術

| 技術 | 用途 |
|------|------|
| 🌐 **HTML5** | 頁面結構與語義化標籤 |
| 🎨 **Tailwind CSS** | 快速建構深色主題 UI、響應式佈局 |
| ⚡ **Vanilla JavaScript** | 動態載入數據、訂閱互動、複製提示詞 |
| 🔤 **Font Awesome 6** | 圖示系統 |
| 📝 **Noto Sans TC** | Google Fonts 中文字體 |

### 後端 / CI 技術

| 技術 | 用途 |
|------|------|
| 🟢 **Node.js 20** | 執行爬蟲與寄信腳本的 Runtime |
| 🤖 **Puppeteer** | Headless Chrome 瀏覽器自動化，用於爬取動態渲染頁面 |
| 📧 **Nodemailer** | SMTP 信件發送模組 |
| ⚙️ **GitHub Actions** | CI/CD 排程平台，執行每日自動化任務 |
| 📬 **Gmail SMTP** | 使用 Gmail 應用程式密碼發送電子報 |
| 📊 **Google Apps Script** | 管理訂閱者名單的輕量後端 |
| 📋 **Google Sheets** | 儲存訂閱者 Email 的輕量資料庫 |

### 設計語言

- **色調**：深色背景 `#0f172a` + 紫粉漸層 `#a855f7 → #ec4899 → #f43f5e`
- **效果**：Glassmorphism 毛玻璃卡片、浮動動畫、滾動淡入
- **排版**：卡片式佈局、排名徽章（🥇🥈🥉）

---

<!-- 📄 第 5 頁：自動化工作流程 -->

## 🔄 每日自動化工作流程

### 運作原理 — 四步驟完成全自動靈感快遞

```
Step 1                Step 2                Step 3                Step 4
┌──────────┐      ┌──────────┐      ┌──────────┐      ┌──────────┐
│ 📧        │      │ 🤖        │      │ ✨        │      │ 🚀        │
│ 輸入信箱   │  →   │ 自動爬取   │  →   │ 精心排版   │  →   │ 準時送達   │
│           │      │           │      │           │      │           │
│ 填入 Email │      │ 從 3 個來源 │      │ 組裝精美的 │      │ 每天 05:00│
│ 即完成訂閱 │      │ 蒐集熱門    │      │ HTML 信件  │      │ 自動寄出  │
│           │      │ 提示詞     │      │           │      │           │
└──────────┘      └──────────┘      └──────────┘      └──────────┘
```

### GitHub Actions 排程細節

| 設定項 | 值 | 說明 |
|--------|-----|------|
| Cron 表達式 | `0 21 * * *` | UTC 21:00 = 台灣時間每天早上 05:00 |
| 執行環境 | `ubuntu-latest` | GitHub 提供的免費 Linux Runner |
| 超時限制 | `15 分鐘` | 防止爬蟲卡住浪費資源 |
| 權限 | `contents: write` | 允許將爬取結果推送回 Repository |

### 執行步驟

1. **Checkout 程式碼** — 從 Repository 下載最新程式碼
2. **安裝 Node.js 20** — 設定 Runtime 環境
3. **安裝依賴** — `npm install`（Puppeteer、Nodemailer、Cheerio 等）
4. **執行爬蟲 + 寄信** — `node index.js --now`
5. **發布最新資料** — 將 `data/latest.json` 推送至 Repository，前端網頁即時更新
6. **保存爬取記錄** — 上傳 Artifact 供除錯使用（保留 7 天）

---

<!-- 📄 第 6 頁：爬取資料來源 -->

## 📡 爬取資料來源

### 三大 AI 藝術社群精選

PromptDaily 每天從以下 3 個來源各爬取前 3 名最熱門的作品：

| # | 來源 | 網址 | 抓取數量 | 爬取策略 |
|---|------|------|----------|----------|
| 1 | 🔥 **PromptHero 熱門榜** | `prompthero.com/top` | Top 3 | Puppeteer 抓取卡片圖 + 進入詳細頁面取得完整 Prompt |
| 2 | 🤖 **ChatGPT 精選** | `prompthero.com/chatgpt-prompts` | Top 3 | Puppeteer 抓取 ChatGPT 分類最佳作品 |
| 3 | ✨ **Midjourney 精選** | `prompthero.com/midjourney-prompts` | Top 3 | Puppeteer 抓取 MJ 分類前 3 名 |

### 爬蟲技術細節

- **引擎**：Puppeteer（Headless Chrome）— 可執行 JavaScript 渲染的 SPA 頁面
- **輔助**：Cheerio — 用於 HTML 解析
- **策略**：先從列表頁取得圖片與連結，再逐一進入詳細頁面抓取完整的 Prompt 文字
- **容錯**：若詳細頁面取得失敗，會從 URL slug 自動還原 Prompt 文字
- **模型辨識**：自動從 URL 或頁面中識別使用的 AI 模型（Midjourney、Stable Diffusion、FLUX 等）

### 資料輸出格式

每筆資料包含以下欄位：

```json
{
  "rank": 1,
  "imageUrl": "https://...",
  "prompt": "A beautiful landscape with...",
  "model": "Midjourney",
  "link": "https://prompthero.com/prompt/..."
}
```

---

<!-- 📄 第 7 頁：訂閱機制 -->

## 📬 訂閱與取消訂閱機制

### 訂閱流程

```
使用者 ──→ 首頁輸入 Email ──→ Google Apps Script API
                                      │
                                      ▼
                               Google Sheets
                             (儲存訂閱者名單)
                                      │
                                      ▼
                            每日 GitHub Actions
                           讀取名單 → BCC 寄信
```

1. 使用者在首頁 (`index.html`) 輸入 Email 並點擊「立即免費訂閱」
2. 前端透過 `fetch()` 呼叫 Google Apps Script Web App API
3. Apps Script 將 Email 寫入 Google Sheets
4. 系統回傳成功 / 名額已滿 / 已訂閱等狀態訊息
5. 每日排程執行時，從 Google Sheets 取得所有訂閱者 Email
6. 使用 Nodemailer 以 BCC（密件副本）方式同時寄送給所有訂閱者

### 取消訂閱

- 使用者可透過**首頁的取消訂閱按鈕**或獨立的 **`unsubscribe.html`** 頁面取消
- 呼叫同一個 Apps Script API，`action=unsubscribe`
- 從 Google Sheets 中移除該 Email

### 訂閱限制

| 項目 | 說明 |
|------|------|
| 訂閱上限 | 50 人 |
| 費用 | 完全免費 |
| 隱私 | 使用 BCC 寄送，訂閱者之間看不到彼此的 Email |
| 退訂 | 隨時可透過網頁一鍵取消 |

---

<!-- 📄 第 8 頁：信件內容預覽 -->

## 📨 電子報信件預覽

### 信件設計風格

電子報延續網頁的深色高質感設計語言：

- **背景色**：`#0f172a`（深海藍黑色）
- **標題**：`✨ Studio0808_PromptDaily` + 紫色漸層品牌色
- **日期標語**：自動生成當日日期（台灣時區）
- **分隔線**：紫色漸層 `→ transparent, #a855f7, transparent`

### 信件結構

```
┌────────────────────────────────────────┐
│     ✨ Studio0808_PromptDaily          │
│     2026/05/17 星期六 — 每日精選        │
│────────────────────────────────────────│
│     ☀ 早安！以下是今天的 Top 9：        │
│                                        │
│  🔥 PromptHero 熱門榜                  │
│  ┌──────────────────────────┐          │
│  │ [圖片]                    │          │
│  │ 🥇 Midjourney             │          │
│  │ A beautiful landscape...  │          │
│  │ 查看原圖 →                │          │
│  └──────────────────────────┘          │
│  ┌──────────────────────────┐          │
│  │ [圖片]                    │          │
│  │ 🥈 Stable Diffusion       │          │
│  │ Cinematic portrait...     │          │
│  │ 查看原圖 →                │          │
│  └──────────────────────────┘          │
│           ... (共 9 組)                 │
│────────────────────────────────────────│
│  此信件由 PromptDaily 自動發送          │
│  不想再收到？至首頁取消訂閱             │
└────────────────────────────────────────┘
```

### 信件主旨格式

```
🎨 PromptDaily｜2026/05/17（六）Top 9 AI 提示詞
```

---

<!-- 📄 第 9 頁：使用者操作說明 -->

## 📖 使用者操作說明

### 👤 一般使用者（訂閱者）

#### 如何訂閱？

1. 前往 PromptDaily 首頁：[https://begin0808.github.io/images_PromptDaily/](https://begin0808.github.io/images_PromptDaily/)
2. 在頁面中央的輸入框中填入您的 Email 地址
3. 點擊 **「立即免費訂閱」** 紫色按鈕
4. 看到 ✅ 綠色成功訊息即代表訂閱完成
5. 隔天早上 05:00 就會收到第一封每日靈感信！

#### 如何在首頁預覽今日報？

- 點擊導覽列的 **「預覽今日報」** 連結
- 頁面會自動滾動至預覽區域
- 可以看到三大來源各 3 組精選作品（共 9 張圖片 + Prompt）
- 點擊 **「點擊複製提示詞」** 可一鍵複製到剪貼簿
- 點擊 **「查看原圖 →」** 可前往原始來源頁面

#### 如何取消訂閱？

- **方法 A**：在首頁底部的輸入框填入 Email，點擊「取消訂閱」
- **方法 B**：前往獨立的取消訂閱頁面 `unsubscribe.html`

---

### 🛠️ 開發者（自行部署）

#### 前置條件

1. 擁有 GitHub 帳號
2. 擁有 Gmail 帳號並已開啟「兩步驟驗證」
3. 已建立 Gmail 「應用程式密碼」（16 碼）

#### 部署步驟

```
Step 1: Fork 專案
────────────────
前往 GitHub → Fork 此 Repository

Step 2: 設定 Secrets
────────────────────
Settings → Secrets and variables → Actions
新增以下三個 Repository Secrets：
  • SMTP_USER      → 你的 Gmail 帳號
  • SMTP_PASS      → Gmail 應用程式密碼（16 碼）
  • MY_EMAIL       → 接收報表的 Email

Step 3: 啟用 GitHub Pages（選用）
────────────────────────────────
Settings → Pages → 選擇 main 分支

Step 4: 設定訂閱功能（選用）
──────────────────────────
新增額外 Secrets：
  • APPS_SCRIPT_URL    → Google Apps Script Web App URL
  • APPS_SCRIPT_TOKEN  → 安全驗證 Token
```

#### 本地開發測試

```bash
# 安裝依賴
cd scripts && npm install

# 複製環境變數設定檔
cp .env.example .env
# 編輯 .env 填入 Gmail 與密碼

# 僅測試爬蟲（不寄信）
npm run test-scrape

# 使用假資料測試寄信排版
npm run test-email

# 完整執行（爬取 + 寄信）
npm run now
```

---

<!-- 📄 第 10 頁：未來展望 -->

## 🚀 未來展望與總結

### 潛在擴充方向

| 方向 | 說明 |
|------|------|
| 🌍 **多來源擴充** | 加入更多 AI 藝術平台（如 Civitai、Lexica 等） |
| 🏷️ **分類篩選** | 讓訂閱者選擇感興趣的 AI 模型類別 |
| 📊 **統計分析** | 追蹤每日熱門趨勢，建立 Prompt 風格資料庫 |
| 🌙 **深色/淺色模式** | 讓使用者切換網頁主題風格 |
| 📱 **PWA 支援** | 加入離線快取，支援手機「加到桌面」功能 |
| 🤖 **AI 摘要** | 使用 LLM 自動生成每日提示詞趨勢摘要 |

### 專案亮點回顧

- 💰 **零成本** — 完全使用 GitHub 免費額度運作
- 🏗️ **零伺服器** — Serverless 架構，無需維護主機
- ⏰ **全自動** — 設定完成後無需任何手動操作
- 🎨 **高質感** — 深色毛玻璃 UI、漸層品牌色、微動畫效果
- 🔒 **隱私安全** — BCC 寄送、Secrets 管理敏感資訊
- 📧 **一鍵訂閱** — 填入 Email 即完成，無需註冊帳號

### 感謝

> 此專案由 **Studio 0808** 打造，旨在為 AI 繪圖愛好者提供最便捷的每日靈感來源。
>
> 🌐 訂閱首頁：[https://begin0808.github.io/images_PromptDaily/](https://begin0808.github.io/images_PromptDaily/)  
> 📂 GitHub Repo：[https://github.com/begin0808/images_PromptDaily](https://github.com/begin0808/images_PromptDaily)

---

*© 2026 Studio 0808. All rights reserved.*
