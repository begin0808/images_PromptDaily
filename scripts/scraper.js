/**
 * scraper.js — 從 PromptHero 各頁面爬取每日最熱門 AI 提示詞
 *
 * 資料來源（每日更新）：
 * 1. Hot (今日熱門)        → prompthero.com/hot           × 2 張
 * 2. Featured (官方精選)   → prompthero.com/featured      × 2 張
 * 3. Architecture          → prompthero.com/architecture-prompts × 1 張
 * 4. Interior Design       → prompthero.com/interior-design-prompts × 1 張
 * 5. 3D / Renders          → prompthero.com/3d-renders-prompts × 1 張
 *
 * 去重機制：滾動 14 天歷史記錄（data/history.json）
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const HISTORY_FILE = path.join(__dirname, '..', 'data', 'history.json');
const HISTORY_DAYS = 14; // 保留多少天的歷史

const SOURCES = [
    {
        id: 'hot',
        name: '🔥 今日熱門',
        url: 'https://prompthero.com/hot',
        icon: '🔥',
        count: 2,
    },
    {
        id: 'featured',
        name: '✨ 官方精選',
        url: 'https://prompthero.com/featured',
        icon: '✨',
        count: 2,
    },
    {
        id: 'architecture',
        name: '🏛 Architecture',
        url: 'https://prompthero.com/architecture-prompts',
        icon: '🏛',
        count: 1,
    },
    {
        id: 'interior-design',
        name: '🏠 Interior Design',
        url: 'https://prompthero.com/interior-design-prompts',
        icon: '🏠',
        count: 1,
    },
    {
        id: '3d-renders',
        name: '🧊 3D / Renders',
        url: 'https://prompthero.com/3d-renders-prompts',
        icon: '🧊',
        count: 1,
    },
];

// ════════════════════════════════════════
//  歷史管理 — 滾動 14 天去重
// ════════════════════════════════════════

/**
 * 載入滾動歷史（14 天內所有已出現的連結）
 * history.json 格式: { "links": { "<url>": "<YYYY-MM-DD>", ... } }
 */
function loadHistory() {
    try {
        if (fs.existsSync(HISTORY_FILE)) {
            const raw = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8'));
            const links = raw.links || {};
            const today = new Date();
            const cutoff = new Date(today);
            cutoff.setDate(cutoff.getDate() - HISTORY_DAYS);

            // 過濾掉超過 14 天的舊記錄
            const filtered = {};
            let removed = 0;
            for (const [url, dateStr] of Object.entries(links)) {
                const d = new Date(dateStr);
                if (d >= cutoff) {
                    filtered[url] = dateStr;
                } else {
                    removed++;
                }
            }

            console.log(`  📋 載入 ${Object.keys(filtered).length} 筆歷史連結（移除 ${removed} 筆過期記錄）`);
            return filtered;
        }
    } catch (e) {
        console.log(`  ⚠ 無法載入歷史資料: ${e.message}`);
    }
    return {};
}

/**
 * 將新爬取的連結加入歷史並儲存
 */
function saveHistory(historyLinks, newLinks) {
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const updated = { ...historyLinks };

    for (const url of newLinks) {
        updated[url] = today;
    }

    const dataDir = path.dirname(HISTORY_FILE);
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }

    fs.writeFileSync(HISTORY_FILE, JSON.stringify({ links: updated }, null, 2), 'utf-8');
    console.log(`💾 歷史記錄已更新: ${Object.keys(updated).length} 筆連結`);
}

/**
 * 從 URL slug 還原 prompt 文字（最後手段 fallback）
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
 * 判斷文字是否為留言（而非 prompt）
 */
function isLikelyComment(text) {
    if (!text || text.length < 10) return true;
    
    // 留言特徵關鍵字
    const commentPatterns = [
        /^(this is|that is|very|so|wow|omg|amazing|beautiful|incredible|love|great|nice|cool|awesome)/i,
        /\b(thank|thanks|congrats|congratulations|well done|good job|keep it up)\b/i,
        /\b(how to|where can|can you|would like|i wish|i want|please)\b/i,
        /\b(contact you|your talent|your work|follow you)\b/i,
        /\b(blessed|shepherd|charlie|willed|commits)\b/i,
        /^(yo |hey |hi |hello )/i,
        /\?$/,  // 以問號結尾的通常是留言
    ];

    for (const pattern of commentPatterns) {
        if (pattern.test(text.trim())) return true;
    }

    // prompt 通常包含技術關鍵字
    const promptKeywords = [
        'style', 'realistic', 'cinematic', 'portrait', 'photo', 'lighting',
        'detailed', 'resolution', 'render', 'illustration', 'painting',
        'concept art', 'digital', '--ar', '--v', '--stylize', '--quality',
        'ultra', 'hd', '4k', '8k', 'masterpiece', 'sharp focus',
        'trending', 'artstation', 'unreal engine', 'octane',
    ];

    const lowerText = text.toLowerCase();
    const hasPromptKeywords = promptKeywords.some(kw => lowerText.includes(kw));
    
    // 如果文字夠長（>50 chars）且不含留言特徵，很可能是 prompt
    if (text.length > 50 && !hasPromptKeywords) {
        // 額外檢查：prompt 通常不會有太多句號或感嘆號（口語化特徵）
        const sentenceEnders = (text.match(/[.!?。！？]/g) || []).length;
        if (sentenceEnders > 3) return true;
    }

    return false;
}

const NSFW_KEYWORDS = [
    'sexy', 'nude', 'naked', 'nsfw', 'explicit', 'topless', 'erotic',
    'pornographic', 'lingerie', 'adult content', 'adult woman', 'adult female',
    'bra', 'panties', 'underwear', 'bikini',
    'nipple', 'genitalia', 'uncensored', 'hentai',
    'subject type adult',   // JSON-prompt slug pattern: subject-type-adult-woman
    'seductive', 'alluring pose', 'provocative',
];

/**
 * 判斷 prompt 或連結是否含成人內容
 */
function isNSFW(prompt = '', url = '') {
    const combined = `${prompt} ${url}`.toLowerCase();
    return NSFW_KEYWORDS.some(kw => {
        if (kw === 'bra') {
            return /\bbra\b/i.test(combined);
        }
        return combined.includes(kw);
    });
}

/**
 * 判斷 prompt 是否為 JSON 物件（不適合展示）
 */
function isJsonPrompt(text) {
    const trimmed = text.trim();
    return trimmed.startsWith('{') || trimmed.startsWith('[');
}

/**
 * 從 PromptHero 頁面抓取前 N 筆提示詞
 */
async function scrapePromptHero(page, url, count = 3, previousLinks = new Set()) {
    console.log(`  → 正在抓取: ${url}`);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

    // 等待圖片卡片載入
    await page.waitForSelector('img', { timeout: 15000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 3000));

    // 多抓一些候選，以便去重、NSFW 過濾後仍有足夠數量
    const candidateCount = count * 10;

    const results = await page.evaluate((candidateCount) => {
        const items = [];
        const seenLinks = new Set();
        const cards = document.querySelectorAll('a[href*="/prompt/"]');

        for (let i = 0; i < Math.min(cards.length, candidateCount * 2); i++) {
            const card = cards[i];
            const img = card.querySelector('img');
            const link = card.href || '';

            // 避免同頁面內重複
            if (seenLinks.has(link)) continue;
            seenLinks.add(link);

            if (!img || !img.src) continue;
            const imgSrc = img.src || img.dataset?.src || '';
            if (imgSrc.includes('icon') || imgSrc.includes('logo') || imgSrc.includes('avatar')) continue;
            // 過濾影片縮圖
            if (imgSrc.includes('video') || imgSrc.endsWith('.webm') || imgSrc.endsWith('.mp4')) continue;

            // 從卡片容器抓點閱數（眼睛圖示旁的數字）
            let cardViews = 0;
            const container = card.closest('div') || card.parentElement;
            if (container) {
                const nums = (container.innerText.match(/\b(\d[\d,]*)\b/g) || [])
                    .map(n => parseInt(n.replace(/,/g, '')))
                    .filter(n => n >= 50 && n < 10000000);  // 50+ 才算點閱數（排除 likes 的小數字）
                if (nums.length > 0) cardViews = Math.max(...nums);
            }

            items.push({ imageUrl: imgSrc, link: link, alt: img.alt || '', views: cardViews });
            if (items.length >= candidateCount) break;
        }

        // 按點閱數由高到低排序，優先處理熱門內容
        items.sort((a, b) => b.views - a.views);
        return items;
    }, candidateCount);

    // 進入詳細頁面抓取真正的 prompt
    const enriched = [];
    let rankCounter = 1;

    for (let i = 0; i < results.length && enriched.length < count; i++) {
        const item = results[i];

        // 去重：跳過歷史中已出現的連結
        if (previousLinks.has(item.link)) {
            console.log(`    ⏭ 跳過重複: ${item.link.substring(0, 60)}...`);
            continue;
        }

        let prompt = '';
        let model = 'AI Model';

        if (item.link && item.link.includes('/prompt/')) {
            try {
                await page.goto(item.link, { waitUntil: 'networkidle2', timeout: 30000 });
                await new Promise(r => setTimeout(r, 2000));

                const detail = await page.evaluate(() => {
                    let promptText = '';
                    let modelName = '';

                    const MODEL_LABEL_PATTERN = /^(chatgpt image|chatgpt|midjourney|stable diffusion|flux|dall[\-\s]e|gpt[\-\s]image[\-\s\d]*)\s*$/i;

                    // ═══ 策略 1：找包含搜尋連結的容器（PromptHero 特有結構） ═══
                    const searchLink = document.querySelector('a[href^="/search?q="]');
                    if (searchLink) {
                        const container = searchLink.closest('div');
                        if (container) {
                            const text = container.textContent.trim();
                            if (!MODEL_LABEL_PATTERN.test(text)) promptText = text;
                        }
                    }

                    // ═══ 策略 2：找帶有 select-all class 的容器 ═══
                    if (!promptText || promptText.length < 15) {
                        const selectAll = document.querySelector('.select-all');
                        if (selectAll) {
                            const text = selectAll.textContent.trim();
                            if (!MODEL_LABEL_PATTERN.test(text)) promptText = text;
                        }
                    }

                    // ═══ 策略 3：找 pre 或 code 標籤（傳統方式） ═══
                    if (!promptText || promptText.length < 15) {
                        const preEl = document.querySelector('pre');
                        if (preEl && preEl.textContent.trim().length > 20) {
                            promptText = preEl.textContent.trim();
                        }
                    }

                    // ═══ 策略 4：找「PROMPT」標籤後的文字（ChatGPT Image 頁面結構） ═══
                    if (!promptText || promptText.length < 10) {
                        const allLeaves = document.querySelectorAll('span, p, div, h2, h3, h4, h5');
                        for (const el of allLeaves) {
                            if (el.children.length === 0 && el.textContent.trim().toUpperCase() === 'PROMPT') {
                                const candidates = [
                                    el.nextElementSibling,
                                    el.parentElement?.nextElementSibling,
                                    el.parentElement?.parentElement?.nextElementSibling,
                                ];
                                for (const c of candidates) {
                                    if (c && c.textContent.trim().length > 8) {
                                        const text = c.textContent.trim();
                                        if (!MODEL_LABEL_PATTERN.test(text)) {
                                            promptText = text;
                                            break;
                                        }
                                    }
                                }
                                if (promptText) break;
                            }
                        }
                    }

                    // ═══ 模型名稱提取 ═══
                    // 策略 A：找 "Model used" 標籤
                    const allElements = document.querySelectorAll('div, span, p, h3, h4, h5');
                    for (const el of allElements) {
                        const txt = el.textContent.trim().toLowerCase();
                        if (txt === 'model used' || txt === 'model') {
                            const parent = el.parentElement;
                            if (parent) {
                                const link = parent.querySelector('a');
                                if (link && link.textContent.trim().length > 1) {
                                    modelName = link.textContent.trim();
                                    break;
                                }
                            }
                        }
                    }

                    // 策略 B：找模型相關 badge
                    if (!modelName) {
                        const badge = document.querySelector('[class*="badge"], [class*="model"], [class*="Model"]');
                        if (badge) modelName = badge.textContent.trim();
                    }

                    // ═══ 互動量提取（views / favorites）═══
                    let viewCount = 0;
                    let favCount = 0;
                    const bodyText = document.body.innerText;
                    const viewMatch = bodyText.match(/\b(\d[\d,]*)\s+views?\b/i);
                    if (viewMatch) viewCount = parseInt(viewMatch[1].replace(/,/g, ''));
                    const favMatch = bodyText.match(/\b(\d[\d,]*)\s+favou?rites?\b/i);
                    if (favMatch) favCount = parseInt(favMatch[1].replace(/,/g, ''));

                    // ═══ PromptHero 頁面 NSFW 標籤偵測 ═══
                    const lowerBody = bodyText.toLowerCase();
                    const isNSFWPage =
                        lowerBody.includes('nsfw') ||
                        lowerBody.includes('mature content') ||
                        lowerBody.includes('not safe for work') ||
                        !!document.querySelector('[class*="nsfw"],[class*="mature"],[data-nsfw],[data-mature]');

                    // ═══ 清理 UI 按鈕文字（Try this prompt / Copy 等） ═══
                    if (promptText) {
                        promptText = promptText
                            .replace(/try this prompt/gi, '')
                            .replace(/\bcopy\b/g, '')
                            .replace(/\bshare\b/g, '')
                            .replace(/\bdownload\b/g, '')
                            .replace(/\s{2,}/g, ' ')
                            .trim();
                        if (promptText.length < 10) promptText = '';
                    }

                    return { prompt: promptText, model: modelName, views: viewCount, favorites: favCount, isNSFWPage };
                });

                if (detail.prompt && detail.prompt.length > 15
                    && !isLikelyComment(detail.prompt)
                    && !isJsonPrompt(detail.prompt)) {
                    prompt = detail.prompt;
                }
                if (detail.model) model = detail.model;

                // 頁面 NSFW 標籤過濾
                if (detail.isNSFWPage) {
                    console.log(`    🔞 頁面有 NSFW 標籤，跳過: ${item.link.substring(0, 50)}...`);
                    continue;
                }

                // 互動量過濾：views < 50 且 favorites < 3 → 太冷門，跳過
                // 對 Hot/Featured 頁面放寬，因為它們本身就是精選
                const MIN_VIEWS = 50;
                const MIN_FAV = 3;
                if (detail.views < MIN_VIEWS && detail.favorites < MIN_FAV) {
                    console.log(`    📉 跳過低互動 (${detail.views} views / ${detail.favorites} ❤️): ${item.link.substring(0, 50)}...`);
                    continue;
                }
            } catch (e) {
                console.log(`    ⚠ 無法取得詳細頁: ${item.link.substring(0, 60)}`);
            }

            // Fallback：從 URL slug 還原（僅接受非模型名稱開頭、且長度足夠的結果）
            if (!prompt || prompt.length < 15) {
                const slugText = extractPromptFromSlug(item.link);
                const MODEL_PREFIX = /^(chatgpt|midjourney|stable[\s-]?diffusion|flux|dall[\s-]?e|dreamshaper|majicmix|seedream|hero[\s-]?10|nano[\s-]?banana|animagine|realvisxl|juggernaut|unstable|anything|veo|sora|hunyuan|leonardo)/i;
                if (slugText && slugText.length >= 20 && !MODEL_PREFIX.test(slugText)) {
                    prompt = slugText;
                    console.log(`    📎 從 URL slug 還原 prompt`);
                } else {
                    console.log(`    ⏩ 跳過：prompt 品質不足（slug 僅含模型名稱或過短）`);
                    continue;
                }
            }
        }

        // 從 slug 提取模型名稱
        if (model === 'AI Model' && item.link) {
            const slug = extractPromptFromSlug(item.link);
            const modelPatterns = [
                'chatgpt image', 'chatgpt', 'midjourney', 'stable diffusion',
                'flux', 'dall e', 'nano banana', 'veo', 'sora',
            ];
            for (const mp of modelPatterns) {
                if (slug.toLowerCase().includes(mp)) {
                    model = mp.split(' ').map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
                    break;
                }
            }
        }

        // 過濾 NSFW：同時檢查 prompt 文字與 URL slug
        if (isNSFW(prompt, item.link)) {
            console.log(`    🚫 跳過 NSFW: ${item.link.substring(0, 60)}...`);
            continue;
        }

        enriched.push({
            rank: rankCounter++,
            imageUrl: item.imageUrl,
            prompt: prompt || `AI Generated Art #${rankCounter - 1}`,
            model: model,
            link: item.link,
        });
    }

    return enriched;
}

/**
 * 主爬蟲函式 — 回傳各來源的最熱門資料
 */
async function scrapeAll() {
    console.log('\n🤖 PromptDaily 爬蟲啟動...\n');
    console.log(`📅 時間: ${new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}\n`);

    // 載入滾動歷史用於去重（14 天）
    const historyLinks = loadHistory();
    const previousLinks = new Set(Object.keys(historyLinks));

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
    const newLinks = [];

    try {
        for (let i = 0; i < SOURCES.length; i++) {
            const src = SOURCES[i];
            console.log(`📦 [${i + 1}/${SOURCES.length}] ${src.name}`);
            const items = await scrapePromptHero(page, src.url, src.count || 1, previousLinks);
            allData.push({ source: src, items });
            console.log(`  ✅ 取得 ${items.length} 筆\n`);

            // 將本批連結加入 previousLinks，讓後續來源不重複選取
            for (const item of items) {
                if (item.link) {
                    previousLinks.add(item.link);
                    newLinks.push(item.link);
                }
            }
        }
    } catch (error) {
        console.error('❌ 爬蟲發生錯誤:', error.message);
    }
    // 注意：不在此處關閉 browser，讓呼叫者決定（主題搜尋可能需要復用）

    const totalItems = allData.reduce((sum, d) => sum + d.items.length, 0);
    console.log(`\n🏁 PromptHero 爬蟲完成！共取得 ${totalItems} 筆資料\n`);

    return { allData, browser, page, historyLinks, newLinks, previousLinks };
}

module.exports = { scrapeAll, SOURCES, loadHistory, saveHistory };
