# PromptDaily ✨

PromptDaily 是一個個人的每日 AI 提示詞自動化訂閱服務。每天早上，它會自動從全球知名的 AI 藝術社群爬取最熱門的提示詞與圖片，並將精美的報表寄送到您的信箱。

## 🌟 核心功能

- **自動化爬蟲**：每天從 [PromptHero](https://prompthero.com/top)、[OpenArt](https://openart.ai/discovery) 等平台抓取當日最熱門的 AI 繪圖提示詞（支援 Midjourney, Stable Diffusion, FLUX 等模型）。
- **精美電子報**：將爬取的提示詞與圖片組合成深色高質感的 HTML 電子報。
- **準時派送**：透過 GitHub Actions 搭配 Gmail SMTP，每天早上準時自動寄出。
- **免伺服器**：完全依賴 GitHub 提供的免費環境與 GitHub Pages 運作，無需租用伺服器或資料庫。

## 📂 專案架構

```text
├── index.html              # 訂閱首頁 (GitHub Pages)
├── plan.html               # 專案開發計畫與系統架構圖
├── unsubscribe.html        # 取消訂閱頁面
├── scripts/
│   ├── scraper.js          # Puppeteer 爬蟲邏輯
│   ├── emailTemplate.js    # HTML 信件模板產生器
│   ├── mailer.js           # Nodemailer 寄信模組
│   └── index.js            # 主程式入口
└── .github/workflows/
    └── daily-prompt.yml    # GitHub Actions 自動排程設定
```

## 🚀 如何部署與使用

1. **取得 Google 應用程式密碼**
   - 前往 [Google 帳戶安全性設定](https://myaccount.google.com/security)。
   - 確認已開啟「兩步驟驗證」。
   - 搜尋「應用程式密碼 (App passwords)」，建立一組新的密碼並複製。

2. **設定 GitHub Secrets**
   - 在您的 GitHub 專案中，前往 **Settings -> Secrets and variables -> Actions**。
   - 新增以下三個 Repository Secrets：
     - `SMTP_USER`：用來寄信的 Gmail 帳號
     - `SMTP_PASS`：剛剛取得的 Google 應用程式密碼（16 碼）
     - `MY_EMAIL`：用來接收報表的 Email

3. **啟用 GitHub Pages (選項)**
   - 前往 **Settings -> Pages**。
   - 選擇從 `main` 分支部署，即可讓 `index.html` 首頁上線。

## 🛠️ 本地端開發測試

如果您想在本地端測試爬蟲或修改信件版型：

```bash
# 安裝依賴
cd scripts
npm install

# 複製環境變數設定檔並填入您的 Gmail 與密碼
cp .env.example .env

# 僅測試爬蟲 (不寄信)
npm run test-scrape

# 使用假資料測試寄信排版
npm run test-email

# 完整執行 (爬取真實資料並寄出)
npm run now
```

---
*此專案僅供個人自動化學習與靈感收集使用。*
