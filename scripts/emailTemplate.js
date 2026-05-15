/**
 * emailTemplate.js — 產生精美的 HTML 信件
 */

const rankEmojis = ['🥇', '🥈', '🥉'];

function generateEmailHTML(allData, dateStr) {
    const sections = allData.map(({ source, items }) => {
        if (!items || items.length === 0) {
            return `<tr><td style="padding:16px 24px;color:#94a3b8;font-size:14px;">⚠ ${source.name}：今日暫無資料</td></tr>`;
        }

        const cards = items.map(item => `
            <tr><td style="padding:8px 24px;">
                <table width="100%" cellpadding="0" cellspacing="0" style="background:#1e293b;border-radius:12px;overflow:hidden;margin-bottom:4px;">
                    ${item.imageUrl ? `<tr><td>
                        <a href="${item.link || '#'}" target="_blank" style="text-decoration:none;">
                            <img src="${item.imageUrl}" alt="AI Art" style="width:100%;max-height:280px;object-fit:cover;display:block;border-radius:12px 12px 0 0;" />
                        </a>
                    </td></tr>` : ''}
                    <tr><td style="padding:16px 20px;">
                        <div style="margin-bottom:6px;">
                            <span style="font-size:18px;margin-right:6px;">${rankEmojis[item.rank - 1] || '🏅'}</span>
                            <span style="font-size:11px;color:#94a3b8;font-family:monospace;text-transform:uppercase;letter-spacing:1px;">${item.model}</span>
                        </div>
                        <p style="font-size:14px;color:#e2e8f0;line-height:1.6;margin:8px 0 12px;word-break:break-word;">${item.prompt}</p>
                        ${item.link ? `<a href="${item.link}" target="_blank" style="font-size:12px;color:#a855f7;text-decoration:none;">查看原圖 →</a>` : ''}
                    </td></tr>
                </table>
            </td></tr>
        `).join('');

        return `
            <tr><td style="padding:24px 24px 8px;">
                <table width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,rgba(139,92,246,0.12),rgba(236,72,153,0.08));border-radius:10px;padding:14px 18px;">
                    <tr><td>
                        <span style="font-size:18px;margin-right:8px;">${source.icon}</span>
                        <span style="font-size:16px;font-weight:700;color:#f1f5f9;">${source.name}</span>
                    </td></tr>
                </table>
            </td></tr>
            ${cards}
        `;
    }).join('');

    return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>PromptDaily｜${dateStr} 今日 Top 9</title>
</head>
<body style="margin:0;padding:0;background:#0f172a;font-family:'Segoe UI','Noto Sans TC',Arial,sans-serif;">

<table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:20px 0;">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#0f172a;">

    <!-- Header -->
    <tr><td style="padding:32px 24px 16px;text-align:center;">
        <div style="font-size:22px;font-weight:700;color:#f8fafc;margin-bottom:4px;">
            ✨ Studio0808_Prompt<span style="color:#a855f7;">Daily</span>
        </div>
        <div style="font-size:12px;color:#64748b;">${dateStr} — 每日 AI 提示詞精選</div>
    </td></tr>

    <!-- Divider -->
    <tr><td style="padding:0 24px;">
        <div style="height:1px;background:linear-gradient(to right,transparent,rgba(168,85,247,0.4),transparent);"></div>
    </td></tr>

    <!-- Intro -->
    <tr><td style="padding:20px 24px 8px;text-align:center;">
        <p style="font-size:15px;color:#cbd5e1;line-height:1.6;margin:0;">
            早安！☀ 以下是今天從 3 個來源精選的 Top 9 AI 繪圖提示詞：
        </p>
    </td></tr>

    <!-- Content Sections -->
    ${sections}

    <!-- Footer Divider -->
    <tr><td style="padding:24px 24px 0;">
        <div style="height:1px;background:linear-gradient(to right,transparent,rgba(168,85,247,0.4),transparent);"></div>
    </td></tr>

    <!-- Footer -->
    <tr><td style="padding:20px 24px 32px;text-align:center;">
        <p style="font-size:11px;color:#64748b;margin:0 0 8px;">
            此信件由 Studio0808_PromptDaily 自動發送<br>
            資料來源：PromptHero · ChatGPT · Midjourney
        </p>
        <p style="font-size:11px;color:#475569;margin:0;">
            不想再收到？<a href="https://begin0808.github.io/images_PromptDaily/" style="color:#a855f7;text-decoration:underline;">至首頁取消訂閱</a>
        </p>
    </td></tr>

</table>
</td></tr>
</table>

</body></html>`;
}

module.exports = { generateEmailHTML };
