/**
 * scraper.js — 從 PromptHero 與 OpenArt 爬取熱門 AI 提示詞
 * 
 * 資料來源：
 * 1. PromptHero Top     → prompthero.com/top
 * 2. OpenArt Discovery  → openart.ai/discovery
 * 3. PromptHero MJ      → prompthero.com/midjourney-prompts
 */

const puppeteer = require('puppeteer');
const cheerio = require('cheerio');

const SOURCES = [
    {
        name: 'PromptHero 熱門榜',
        url: 'https://prompthero.com/top',
        icon: '🔥',
    },
    {
        name: 'OpenArt 探索',
        url: 'https://openart.ai/discovery',
        icon: '🎨',
    },
    {
        name: 'Midjourney 精選',
        url: 'https://prompthero.com/midjourney-prompts',
        icon: '✨',
    },
];

/**
 * 從 URL slug 還原 prompt 文字
 * 例如: /prompt/abc123-midjourney-6-a-woman-with-long-hair → "midjourney 6 a woman with long hair"
 */
function extractPromptFromSlug(url) {
    try {
        const slug = url.split('/prompt/')[1] || '';
        // 移除前面的 hash ID（通常是 hex 字串）
        const parts = slug.split('-');
        const hashPattern = /^[0-9a-f]{8,}$/;
        const startIdx = parts.findIndex(p => !hashPattern.test(p));
        if (startIdx < 0) return '';
        return parts.slice(startIdx).join(' ').replace(/\s+/g, ' ').trim();
    } catch {
        return '';
    }
}

/**
 * 從 PromptHero 頁面抓取前 N 筆提示詞
 */
async function scrapePromptHero(page, url, count = 3) {
    console.log(`  → 正在抓取: ${url}`);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

    // 等待圖片卡片載入
    await page.waitForSelector('img', { timeout: 15000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 3000));

    const results = await page.evaluate((count) => {
        const items = [];
        const cards = document.querySelectorAll(
            'a[href*="/prompt/"]'
        );

        for (let i = 0; i < Math.min(cards.length, count * 3); i++) {
            const card = cards[i];
            const img = card.querySelector('img');
            const link = card.closest('a')?.href || card.querySelector('a')?.href || '';

            if (!img || !img.src) continue;
            const imgSrc = img.src || img.dataset?.src || '';
            if (imgSrc.includes('icon') || imgSrc.includes('logo') || imgSrc.includes('avatar')) continue;

            items.push({ imageUrl: imgSrc, link: link, alt: img.alt || '' });
            if (items.length >= count) break;
        }
        return items;
    }, count);

    // 嘗試進入詳細頁面抓取 prompt，失敗時從 URL slug 還原
    const enriched = [];
    for (let i = 0; i < results.length; i++) {
        const item = results[i];
        let prompt = '';
        let model = 'AI Model';

        if (item.link && item.link.includes('/prompt/')) {
            try {
                await page.goto(item.link, { waitUntil: 'networkidle2', timeout: 30000 });
                await new Promise(r => setTimeout(r, 2000));

                const detail = await page.evaluate(() => {
                    // 嘗試多種 prompt 文字選擇器
                    const selectors = ['pre', '.whitespace-pre-wrap', '[class*="prompt"]', 'code', '[data-prompt]'];
                    let promptText = '';
                    for (const sel of selectors) {
                        const el = document.querySelector(sel);
                        const text = el?.textContent?.trim() || '';
                        if (text.length > 20) { promptText = text; break; }
                    }
                    // 模型名稱
                    const modelEl = document.querySelector('[class*="badge"], [class*="model"], [class*="Model"]');
                    return { prompt: promptText, model: modelEl?.textContent?.trim() || '' };
                });

                if (detail.prompt && detail.prompt.length > 20) prompt = detail.prompt;
                if (detail.model) model = detail.model;
            } catch (e) {
                console.log(`    ⚠ 無法取得詳細頁: ${item.link}`);
            }

            // 如果詳細頁沒抓到，從 URL slug 還原
            if (!prompt || prompt.length < 15) {
                prompt = extractPromptFromSlug(item.link);
                console.log(`    📎 從 URL slug 還原 prompt`);
            }
        }

        // 從 slug 提取模型名稱
        if (model === 'AI Model' && item.link) {
            const slug = extractPromptFromSlug(item.link);
            const modelPatterns = ['midjourney', 'stable diffusion', 'flux', 'dall e', 'nano banana', 'chatgpt'];
            for (const mp of modelPatterns) {
                if (slug.toLowerCase().includes(mp)) {
                    model = mp.split(' ').map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
                    break;
                }
            }
        }

        enriched.push({
            rank: i + 1,
            imageUrl: item.imageUrl,
            prompt: prompt || `AI Generated Art #${i + 1}`,
            model: model,
            link: item.link,
        });
    }

    return enriched;
}

/**
 * 從 OpenArt Discovery 頁面抓取前 N 筆
 */
async function scrapeOpenArt(page, count = 3) {
    const url = 'https://openart.ai/discovery';
    console.log(`  → 正在抓取: ${url}`);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

    // OpenArt 是 React SPA，需要等待內容渲染
    await new Promise(r => setTimeout(r, 5000));

    // 嘗試滾動載入更多
    await page.evaluate(() => window.scrollBy(0, 500));
    await new Promise(r => setTimeout(r, 2000));

    const results = await page.evaluate((count) => {
        const items = [];
        // OpenArt 的圖片通常在 discovery grid 中
        const images = document.querySelectorAll('img[src*="cdn"], img[src*="openart"]');

        for (const img of images) {
            const src = img.src || '';
            // 過濾掉 icon、logo 等
            if (src.includes('logo') || src.includes('icon') || src.includes('avatar')) continue;
            if (img.width < 100 || img.height < 100) continue;

            const card = img.closest('a') || img.closest('div[class*="card"]') || img.parentElement;
            const link = card?.closest('a')?.href || card?.querySelector('a')?.href || '';

            items.push({
                imageUrl: src,
                link: link,
                alt: img.alt || '',
            });

            if (items.length >= count) break;
        }
        return items;
    }, count);

    return results.map((item, i) => ({
        rank: i + 1,
        imageUrl: item.imageUrl,
        prompt: item.alt || `OpenArt Discovery #${i + 1}`,
        model: 'OpenArt',
        link: item.link || 'https://openart.ai/discovery',
    }));
}

/**
 * 主爬蟲函式 — 回傳 3 個來源各 3 筆資料
 */
async function scrapeAll() {
    console.log('\n🤖 PromptDaily 爬蟲啟動...\n');
    console.log(`📅 時間: ${new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}\n`);

    const browser = await puppeteer.launch({
        headless: 'new',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--window-size=1280,900',
        ],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
    );

    const allData = [];

    try {
        // 來源 1: PromptHero Top
        console.log(`📦 [1/3] ${SOURCES[0].name}`);
        const phTop = await scrapePromptHero(page, SOURCES[0].url, 3);
        allData.push({ source: SOURCES[0], items: phTop });
        console.log(`  ✅ 取得 ${phTop.length} 筆\n`);

        // 來源 2: OpenArt
        console.log(`📦 [2/3] ${SOURCES[1].name}`);
        const openart = await scrapeOpenArt(page, 3);
        allData.push({ source: SOURCES[1], items: openart });
        console.log(`  ✅ 取得 ${openart.length} 筆\n`);

        // 來源 3: PromptHero Midjourney
        console.log(`📦 [3/3] ${SOURCES[2].name}`);
        const phMj = await scrapePromptHero(page, SOURCES[2].url, 3);
        allData.push({ source: SOURCES[2], items: phMj });
        console.log(`  ✅ 取得 ${phMj.length} 筆\n`);

    } catch (error) {
        console.error('❌ 爬蟲發生錯誤:', error.message);
    } finally {
        await browser.close();
    }

    const totalItems = allData.reduce((sum, d) => sum + d.items.length, 0);
    console.log(`\n🏁 爬蟲完成！共取得 ${totalItems} 筆資料\n`);

    return allData;
}

module.exports = { scrapeAll, SOURCES };
