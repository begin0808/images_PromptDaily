/**
 * lexicaScraper.js — 透過 PromptHero 搜尋取得多樣化的 AI 圖片 + 提示詞
 *
 * 原計畫使用 Lexica API，但該 API 目前不穩定（回傳 500 錯誤），
 * 改用 PromptHero 搜尋功能（透過 Puppeteer）取得隨機主題的圖片。
 *
 * 策略：每天隨機選取不同的搜尋關鍵字，確保內容多樣性
 */

/**
 * 搜尋關鍵字池（每天隨機挑選，確保多樣性）
 * 分為多個類別以保持內容平衡
 */
const SEARCH_TOPICS = [
    // 奇幻 / 科幻
    'fantasy landscape painting',
    'sci-fi spaceship concept art',
    'dragon illustration digital art',
    'futuristic city cyberpunk',
    'magical forest ethereal',
    'steampunk clockwork machinery',
    'underwater ancient ruins',
    'crystal cave glowing',

    // 建築 / 室內
    'modern architecture minimal',
    'japanese zen garden architecture',
    'gothic cathedral interior',
    'futuristic skyscraper city',
    'cozy cabin winter snow',
    'art deco building design',

    // 自然 / 風景
    'aurora borealis night sky',
    'cherry blossom spring Japan',
    'mountain lake reflection sunset',
    'desert dunes golden hour',
    'tropical island paradise',
    'autumn forest foggy morning',

    // 人物 / 角色
    'character design warrior armor',
    'portrait cinematic lighting',
    'astronaut space exploration',
    'samurai traditional Japanese art',
    'cyberpunk character neon',
    'wizard magic fantasy portrait',

    // 物件 / 產品
    'vintage car classic automobile',
    'mechanical watch gears closeup',
    'potion bottles magical alchemy',
    'robot companion cute',
    'ancient map treasure',
    'crystal gemstone macro photography',

    // 藝術風格
    'oil painting impressionist style',
    'watercolor botanical illustration',
    'pixel art retro gaming',
    'art nouveau poster design',
    'surrealism Salvador Dali style',
    'ukiyo-e Japanese woodblock print',
    'low poly 3D render geometric',
    'isometric diorama miniature',

    // 氛圍 / 場景
    'rainy street night neon reflections',
    'library ancient books candles',
    'floating islands sky',
    'post-apocalyptic overgrown city',
    'enchanted garden butterflies',
    'space station interior sci-fi',
];

/**
 * 取得今日的隨機搜尋關鍵字
 * 基於日期的確定性隨機（同一天同樣結果），避免重複觸發
 */
function getTodayTopics(count = 3) {
    const today = new Date();
    // 使用日期作為 seed，確保同一天結果一致
    const seed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();

    // 簡單的確定性洗牌
    const shuffled = [...SEARCH_TOPICS];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.abs((seed * (i + 1) * 31 + i * 17) % (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    return shuffled.slice(0, count);
}

/**
 * 從 PromptHero 搜尋取得隨機主題的圖片
 * @param {object} page - Puppeteer page（共用主爬蟲的瀏覽器）
 * @param {number} count - 要取得的圖片數量
 * @param {Set} previousLinks - 歷史連結集合，用於去重
 * @returns {Array} - 圖片資料陣列
 */
async function scrapeLexicaTopics(page, count = 2, previousLinks = new Set()) {
    console.log(`\n🔍 PromptHero 主題搜尋中...`);

    // 每個主題取 1 張，多選幾個主題確保有足夠候選
    const topics = getTodayTopics(count * 4);
    console.log(`  📋 今日主題: ${topics.slice(0, count * 2).join(', ')}`);

    const enriched = [];
    let rankCounter = 1;

    for (const topic of topics) {
        if (enriched.length >= count) break;

        try {
            const searchUrl = `https://prompthero.com/search?q=${encodeURIComponent(topic)}`;
            console.log(`  → 搜尋: "${topic}"`);

            await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 30000 });
            await page.waitForSelector('img', { timeout: 10000 }).catch(() => {});
            await new Promise(r => setTimeout(r, 2000));

            // 從搜尋結果頁面抓取卡片
            const results = await page.evaluate(() => {
                const items = [];
                const seenLinks = new Set();
                const cards = document.querySelectorAll('a[href*="/prompt/"]');

                for (let i = 0; i < Math.min(cards.length, 10); i++) {
                    const card = cards[i];
                    const img = card.querySelector('img');
                    const link = card.href || '';

                    if (seenLinks.has(link)) continue;
                    seenLinks.add(link);

                    if (!img || !img.src) continue;
                    const imgSrc = img.src || '';
                    if (imgSrc.includes('icon') || imgSrc.includes('logo') || imgSrc.includes('avatar')) continue;
                    if (imgSrc.includes('video') || imgSrc.endsWith('.webm') || imgSrc.endsWith('.mp4')) continue;

                    items.push({ imageUrl: imgSrc, link: link, alt: img.alt || '' });
                    if (items.length >= 5) break;
                }
                return items;
            });

            if (results.length === 0) {
                console.log(`    ⚠ "${topic}" 無搜尋結果`);
                continue;
            }

            // 隨機選一張（基於日期 seed）
            const today = new Date();
            const daySeed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();

            let found = false;
            for (let attempt = 0; attempt < results.length && !found; attempt++) {
                const idx = (daySeed + attempt * 7 + rankCounter * 13) % results.length;
                const item = results[idx];

                // 去重
                if (previousLinks.has(item.link)) {
                    continue;
                }

                // 進入詳細頁抓取 prompt
                try {
                    await page.goto(item.link, { waitUntil: 'networkidle2', timeout: 20000 });
                    await new Promise(r => setTimeout(r, 1500));

                    const detail = await page.evaluate(() => {
                        let promptText = '';
                        let modelName = '';

                        // 策略 1：搜尋連結容器
                        const searchLink = document.querySelector('a[href^="/search?q="]');
                        if (searchLink) {
                            const container = searchLink.closest('div');
                            if (container) promptText = container.textContent.trim();
                        }

                        // 策略 2：select-all class
                        if (!promptText || promptText.length < 15) {
                            const selectAll = document.querySelector('.select-all');
                            if (selectAll) promptText = selectAll.textContent.trim();
                        }

                        // 策略 3：pre 標籤
                        if (!promptText || promptText.length < 15) {
                            const preEl = document.querySelector('pre');
                            if (preEl && preEl.textContent.trim().length > 20) {
                                promptText = preEl.textContent.trim();
                            }
                        }

                        // 模型名稱
                        const allElements = document.querySelectorAll('div, span, p');
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

                        // 清理
                        if (promptText) {
                            promptText = promptText
                                .replace(/try this prompt/gi, '')
                                .replace(/\bcopy\b/g, '')
                                .replace(/\bshare\b/g, '')
                                .replace(/\bdownload\b/g, '')
                                .replace(/\s{2,}/g, ' ')
                                .trim();
                        }

                        return { prompt: promptText, model: modelName };
                    });

                    const prompt = detail.prompt || '';
                    const model = detail.model || 'AI Model';

                    if (prompt.length < 15) {
                        continue;
                    }

                    // NSFW 過濾
                    const nsfwKeywords = ['sexy', 'nude', 'naked', 'nsfw', 'explicit', 'topless', 'erotic', 'hentai', 'bikini'];
                    const lower = prompt.toLowerCase() + ' ' + item.link.toLowerCase();
                    if (nsfwKeywords.some(kw => lower.includes(kw))) {
                        continue;
                    }

                    enriched.push({
                        rank: rankCounter++,
                        imageUrl: item.imageUrl,
                        prompt: prompt,
                        model: model,
                        link: item.link,
                        searchTopic: topic,
                    });

                    console.log(`    ✅ #${rankCounter - 1} [${model}] — ${prompt.substring(0, 60)}...`);
                    found = true;

                } catch (e) {
                    console.log(`    ⚠ 無法取得詳細頁: ${e.message}`);
                }
            }

            if (!found) {
                console.log(`    ⏩ "${topic}" 找不到適合的圖片`);
            }

        } catch (e) {
            console.log(`    ⚠ 搜尋失敗 ("${topic}"): ${e.message}`);
        }
    }

    console.log(`  🏁 主題搜尋完成！取得 ${enriched.length} 筆\n`);
    return enriched;
}

module.exports = { scrapeLexicaTopics, SEARCH_TOPICS, getTodayTopics };
