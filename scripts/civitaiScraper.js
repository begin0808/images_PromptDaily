/**
 * civitaiScraper.js — 透過 Civitai 官方 REST API 取得每日熱門 AI 圖片 + 提示詞
 *
 * API 文件: https://github.com/civitai/civitai/wiki/REST-API-Reference
 * 端點: GET https://civitai.com/api/v1/images
 *
 * 優勢：
 *  - 官方公開 API，不需 Puppeteer
 *  - 內建 NSFW 過濾（nsfw=None）
 *  - 支援 Daily/Weekly 排序，內容每天不同
 *  - 涵蓋 Stable Diffusion、FLUX、各種社群模型
 */

const path = require('path');

const CIVITAI_API_URL = 'https://civitai.com/api/v1/images';

/**
 * 從 Civitai API 取得每日最受歡迎的圖片
 * @param {number} count - 要取得的圖片數量
 * @param {Set} previousLinks - 歷史連結集合，用於去重
 * @returns {Array} - 圖片資料陣列
 */
async function scrapeCivitai(count = 3, previousLinks = new Set()) {
    console.log(`\n🎨 Civitai API 查詢中...`);

    // 多請求一些，以便過濾後仍有足夠數量
    const limit = count * 5;

    const params = new URLSearchParams({
        sort: 'Most Reactions',
        period: 'Day',
        limit: String(limit),
        nsfw: 'None',     // 只取 SFW 內容
    });

    const url = `${CIVITAI_API_URL}?${params.toString()}`;
    console.log(`  → ${url}`);

    let data;
    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'PromptDaily/1.0 (github.com/begin0808/images_PromptDaily)',
                'Accept': 'application/json',
            },
        });

        if (!response.ok) {
            // 如果 Day 沒有足夠資料，嘗試 Week
            console.log(`  ⚠ Day 回應 ${response.status}，嘗試 Week...`);
            params.set('period', 'Week');
            const retryUrl = `${CIVITAI_API_URL}?${params.toString()}`;
            const retryRes = await fetch(retryUrl, {
                headers: {
                    'User-Agent': 'PromptDaily/1.0 (github.com/begin0808/images_PromptDaily)',
                    'Accept': 'application/json',
                },
            });
            if (!retryRes.ok) {
                throw new Error(`Civitai API 錯誤: ${retryRes.status} ${retryRes.statusText}`);
            }
            data = await retryRes.json();
        } else {
            data = await response.json();
        }
    } catch (e) {
        console.error(`  ❌ Civitai API 請求失敗: ${e.message}`);
        return [];
    }

    const images = data.items || [];
    console.log(`  📦 API 回傳 ${images.length} 筆資料`);

    if (images.length === 0) {
        // Fallback: 嘗試 Week period
        console.log(`  ⚠ Day 無資料，嘗試 Week...`);
        try {
            params.set('period', 'Week');
            const fallbackUrl = `${CIVITAI_API_URL}?${params.toString()}`;
            const fallbackRes = await fetch(fallbackUrl, {
                headers: {
                    'User-Agent': 'PromptDaily/1.0 (github.com/begin0808/images_PromptDaily)',
                    'Accept': 'application/json',
                },
            });
            if (fallbackRes.ok) {
                const fallbackData = await fallbackRes.json();
                images.push(...(fallbackData.items || []));
                console.log(`  📦 Week 回傳 ${fallbackData.items?.length || 0} 筆資料`);
            }
        } catch (e) {
            console.log(`  ⚠ Week fallback 也失敗: ${e.message}`);
        }
    }

    const enriched = [];
    let rankCounter = 1;

    for (const img of images) {
        if (enriched.length >= count) break;

        // 建構 Civitai 圖片頁面連結
        const link = `https://civitai.com/images/${img.id}`;

        // 去重
        if (previousLinks.has(link)) {
            console.log(`    ⏭ 跳過重複: ${link}`);
            continue;
        }

        // 提取 prompt（在 meta 物件中）
        const meta = img.meta || {};
        const prompt = meta.prompt || '';

        // 跳過沒有 prompt 的圖片
        if (!prompt || prompt.trim().length < 10) {
            console.log(`    ⏩ 跳過：無 prompt 或過短`);
            continue;
        }

        // 提取模型名稱
        let model = meta.Model || meta.model || 'Community Model';

        // 提取圖片 URL
        const imageUrl = img.url || '';
        if (!imageUrl) {
            console.log(`    ⏩ 跳過：無圖片 URL`);
            continue;
        }

        // 基本 NSFW 文字檢查（API 已過濾，但多一層保護）
        const nsfwKeywords = ['sexy', 'nude', 'naked', 'nsfw', 'explicit', 'topless', 'erotic', 'hentai'];
        const lowerPrompt = prompt.toLowerCase();
        if (nsfwKeywords.some(kw => lowerPrompt.includes(kw))) {
            console.log(`    🚫 跳過 NSFW prompt`);
            continue;
        }

        // 統計資訊
        const stats = img.stats || {};
        const reactions = (stats.heartCount || 0) + (stats.likeCount || 0);

        enriched.push({
            rank: rankCounter++,
            imageUrl: imageUrl,
            prompt: prompt.trim(),
            model: model,
            link: link,
            reactions: reactions,
        });

        console.log(`    ✅ #${rankCounter - 1} [${model}] ❤️${reactions} — ${prompt.substring(0, 60)}...`);
    }

    console.log(`  🏁 Civitai 完成！取得 ${enriched.length} 筆\n`);
    return enriched;
}

module.exports = { scrapeCivitai };
