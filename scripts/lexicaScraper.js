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
 * 從 Lexica.art 搜尋取得隨機主題的圖片
 * @param {object} page - Puppeteer page（共用主爬蟲的瀏覽器）
 * @param {number} count - 要取得的圖片數量
 * @param {Set} previousLinks - 歷史連結集合，用於去重
 * @returns {Array} - 圖片資料陣列
 */
let civitaiFallbackPool = null;

async function getCivitaiFallbackPool() {
    if (civitaiFallbackPool) return civitaiFallbackPool;
    
    console.log(`  → 正在初始化 Civitai 備份圖片庫 (100 筆)...`);
    const params = new URLSearchParams({
        sort: 'Most Reactions',
        period: 'Week',
        limit: '100',
        nsfw: 'None',
    });
    const url = `https://civitai.com/api/v1/images?${params.toString()}`;
    const response = await fetch(url, {
        headers: {
            'User-Agent': 'PromptDaily/1.0 (github.com/begin0808/images_PromptDaily)',
            'Accept': 'application/json',
        },
    });
    if (!response.ok) {
        throw new Error(`Civitai API fallback error: ${response.status}`);
    }
    const data = await response.json();
    civitaiFallbackPool = data.items || [];
    return civitaiFallbackPool;
}

async function searchInCivitaiPool(topic, previousLinks, localSelectedLinks) {
    const pool = await getCivitaiFallbackPool();
    const topicWords = topic.toLowerCase().split(/\W+/).filter(w => w.length > 2);
    
    const candidates = [];
    for (const img of pool) {
        const link = `https://civitai.com/images/${img.id}`;
        if (previousLinks.has(link) || localSelectedLinks.has(link)) continue;
        
        const meta = img.meta || {};
        const prompt = meta.prompt || '';
        if (!prompt || prompt.trim().length < 15) continue;
        
        // NSFW check
        const nsfwKeywords = ['sexy', 'nude', 'naked', 'nsfw', 'explicit', 'topless', 'erotic', 'hentai', 'bikini'];
        const lowerPrompt = prompt.toLowerCase();
        if (nsfwKeywords.some(kw => lowerPrompt.includes(kw))) continue;
        
        // Calculate relevance
        const promptWords = lowerPrompt.split(/\W+/);
        let relevance = 0;
        for (const tw of topicWords) {
            if (promptWords.includes(tw)) relevance++;
        }
        
        const stats = img.stats || {};
        const reactions = (stats.heartCount || 0) + (stats.likeCount || 0);
        const model = meta.Model || meta.model || img.baseModel || 'Community Model';
        
        candidates.push({
            imageUrl: img.url || '',
            link: link,
            prompt: prompt.trim(),
            model: model,
            relevance: relevance,
            reactions: reactions,
        });
    }
    
    if (candidates.length === 0) return [];
    
    // Sort by relevance (descending), then by reactions (descending)
    candidates.sort((a, b) => {
        if (b.relevance !== a.relevance) {
            return b.relevance - a.relevance;
        }
        return b.reactions - a.reactions;
    });
    
    return candidates;
}

async function scrapeLexicaTopics(page, count = 2, previousLinks = new Set()) {
    console.log(`\n🔍 Lexica.art 主題搜尋中...`);

    // 每個主題取 1 張，多選幾個主題確保有足夠候選
    const topics = getTodayTopics(count * 4);
    console.log(`  📋 今日主題: ${topics.slice(0, count * 2).join(', ')}`);

    const enriched = [];
    let rankCounter = 1;
    let useCivitaiFallback = false;
    const localSelectedLinks = new Set(); // 記錄本輪已選取的連結，防止重複

    for (const topic of topics) {
        if (enriched.length >= count) break;

        let results = [];
        let isFallback = useCivitaiFallback;

        if (!isFallback) {
            try {
                const searchUrl = `https://lexica.art/?q=${encodeURIComponent(topic)}`;
                console.log(`  → 搜尋: "${topic}"`);

                await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 30000 });
                await page.waitForSelector('a[href^="/prompt/"]', { timeout: 10000 });
                await new Promise(r => setTimeout(r, 2000));

                // 從搜尋結果頁面抓取卡片與 prompt
                results = await page.evaluate(() => {
                    const items = [];
                    const cards = Array.from(document.querySelectorAll('a[href^="/prompt/"]'));
                    
                    for (const a of cards) {
                        const p = a.querySelector('p');
                        const parent = a.parentElement;
                        const img = parent ? parent.querySelector('img') : null;
                        const link = a.href || '';
                        
                        if (img && img.src && p && p.textContent.trim().length > 10) {
                            items.push({
                                imageUrl: img.src,
                                link: link,
                                prompt: p.textContent.trim()
                            });
                        }
                        if (items.length >= 10) break;
                    }
                    return items;
                });
            } catch (e) {
                console.log(`    ⚠ Lexica 搜尋失敗，切換至 Civitai API 備份方案 ("${topic}"): ${e.message}`);
                useCivitaiFallback = true;
                isFallback = true;
            }
        }

        if (isFallback) {
            try {
                console.log(`  → 備份搜尋: "${topic}" (Civitai API)`);
                results = await searchInCivitaiPool(topic, previousLinks, localSelectedLinks);
            } catch (err) {
                console.log(`    ⚠ Civitai 備份搜尋失敗 ("${topic}"): ${err.message}`);
                continue;
            }
        }

        if (!results || results.length === 0) {
            console.log(`    ⚠ "${topic}" 無搜尋結果`);
            continue;
        }

        // 如果是 fallback 模式，結果已經按照相關性及熱度排好序，直接取第一筆
        if (isFallback) {
            const item = results[0];
            enriched.push({
                rank: rankCounter++,
                imageUrl: item.imageUrl,
                prompt: item.prompt,
                model: item.model,
                link: item.link,
                searchTopic: topic,
            });
            localSelectedLinks.add(item.link);
            console.log(`    ✅ #${rankCounter - 1} [${item.model}] — ${item.prompt.substring(0, 60)}...`);
            continue;
        }

        // Lexica 原始流程：隨機選一張（基於日期 seed）
        const today = new Date();
        const daySeed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();

        let found = false;
        for (let attempt = 0; attempt < results.length && !found; attempt++) {
            const idx = (daySeed + attempt * 7 + rankCounter * 13) % results.length;
            const item = results[idx];

            // 去重
            if (previousLinks.has(item.link) || localSelectedLinks.has(item.link)) {
                continue;
            }

            const prompt = item.prompt;
            const model = 'Stable Diffusion';

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

            localSelectedLinks.add(item.link);
            console.log(`    ✅ #${rankCounter - 1} [${model}] — ${prompt.substring(0, 60)}...`);
            found = true;
            break;
        }

        if (!found) {
            console.log(`    ⏩ "${topic}" 找不到適合的圖片`);
        }
    }

    console.log(`  🏁 主題搜尋完成！取得 ${enriched.length} 筆\n`);
    return enriched;
}

module.exports = { scrapeLexicaTopics, SEARCH_TOPICS, getTodayTopics };
