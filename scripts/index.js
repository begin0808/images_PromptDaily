/**
 * index.js — PromptDaily 主程式
 * 
 * 用法：
 *   node index.js --now          完整執行（爬蟲 + 寄信）
 *   node index.js --test-scrape  僅測試爬蟲
 *   node index.js --test-email   僅測試寄信（使用假資料）
 */

require('dotenv').config();

const { scrapeAll, SOURCES } = require('./scraper');
const { generateEmailHTML } = require('./emailTemplate');
const { sendEmail } = require('./mailer');
const fs = require('fs');
const path = require('path');

// 環境變數（本地用 .env，GitHub Actions 用 secrets）
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const MY_EMAIL = process.env.MY_EMAIL;

function getTaipeiDate() {
    return new Date().toLocaleDateString('zh-TW', {
        timeZone: 'Asia/Taipei',
        year: 'numeric', month: '2-digit', day: '2-digit',
        weekday: 'long',
    });
}

/** 產生測試用假資料 */
function getMockData() {
    return SOURCES.map(source => ({
        source,
        items: [1, 2, 3].map(rank => ({
            rank,
            imageUrl: `https://images.unsplash.com/photo-167888512108${rank}?w=500&q=80`,
            prompt: `A beautiful test prompt for ${source.name}, rank #${rank}, cinematic lighting, 8k --ar 16:9`,
            model: 'Test Model',
            link: source.url || '#',
        })),
    }));
}

async function main() {
    const args = process.argv.slice(2);
    const mode = args[0] || '--now';

    console.log('╔════════════════════════════════════╗');
    console.log('║     ✨ PromptDaily 每日提示詞      ║');
    console.log('╚════════════════════════════════════╝\n');

    const dateStr = getTaipeiDate();
    console.log(`📅 日期: ${dateStr}`);
    console.log(`📧 模式: ${mode}\n`);

    // ── 爬蟲階段 ──
    let allData;

    if (mode === '--test-email') {
        console.log('🧪 使用測試假資料...\n');
        allData = getMockData();
    } else {
        allData = await scrapeAll();

        if (mode === '--test-scrape') {
            console.log('🧪 僅測試爬蟲，不寄信。');
            allData.forEach(({ source, items }) => {
                console.log(`\n── ${source.icon} ${source.name} ──`);
                items.forEach(item => {
                    console.log(`  ${['🥇','🥈','🥉'][item.rank-1]} [${item.model}]`);
                    console.log(`     ${item.prompt.substring(0, 80)}...`);
                    console.log(`     🖼 ${item.imageUrl.substring(0, 60)}...`);
                });
            });
            return;
        }

        // 將爬取結果存為 JSON（除錯與前端網頁即時讀取用）
        const debugPath = path.join(__dirname, 'last-scrape.json');
        fs.writeFileSync(debugPath, JSON.stringify(allData, null, 2), 'utf-8');

        const dataDir = path.join(__dirname, '..', 'data');
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        const outputPath = path.join(dataDir, 'latest.json');
        fs.writeFileSync(outputPath, JSON.stringify(allData, null, 2), 'utf-8');
        console.log(`💾 爬取結果已儲存: ${outputPath}\n`);
    }

    // ── 組裝信件 ──
    console.log('📝 正在組裝 HTML 信件...');
    const html = generateEmailHTML(allData, dateStr);

    // 儲存信件 HTML（除錯用）
    const htmlPath = path.join(__dirname, 'last-email.html');
    fs.writeFileSync(htmlPath, html, 'utf-8');
    console.log(`💾 信件 HTML 已儲存: ${htmlPath}\n`);

    // ── 寄信階段 ──
    if (!SMTP_USER || !SMTP_PASS || !MY_EMAIL) {
        console.error('❌ 缺少環境變數！請設定 SMTP_USER, SMTP_PASS, MY_EMAIL');
        console.log('   本地開發：複製 .env.example 為 .env 並填入資料');
        console.log('   GitHub Actions：在 Settings → Secrets 中設定');
        process.exit(1);
    }

    const subject = `🎨 PromptDaily｜${dateStr} 每日 AI 提示詞精選`;

    console.log(`📧 正在寄信給 ${MY_EMAIL}...`);

    let bccList = [];
    const scriptUrl = process.env.APPS_SCRIPT_URL;
    const scriptToken = process.env.APPS_SCRIPT_TOKEN;
    
    if (scriptUrl && scriptToken) {
        try {
            console.log('👥 正在從 Google Sheets 取得訂閱名單...');
            const res = await fetch(`${scriptUrl}?action=list&token=${scriptToken}`);
            const result = await res.json();
            if (result.status === 'success' && result.emails) {
                bccList = result.emails.filter(e => e !== MY_EMAIL);
                console.log(`✅ 成功取得 ${bccList.length} 位額外訂閱者`);
            } else {
                console.log('⚠️ 取得訂閱名單失敗:', result.message);
            }
        } catch (err) {
            console.log('⚠️ 網路錯誤，無法取得訂閱名單:', err.message);
        }
    } else {
        console.log('⚠️ 未設定 APPS_SCRIPT_URL 或 APPS_SCRIPT_TOKEN，跳過讀取訂閱者');
    }

    await sendEmail({
        smtpUser: SMTP_USER,
        smtpPass: SMTP_PASS,
        to: MY_EMAIL,
        ...(bccList.length > 0 && { bcc: bccList.join(',') }),
        subject,
        html,
    });

    console.log('\n🎉 全部完成！明天見 👋\n');
}

main().catch(err => {
    console.error('\n💥 執行失敗:', err);
    process.exit(1);
});
