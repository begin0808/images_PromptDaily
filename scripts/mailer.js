/**
 * mailer.js — Gmail SMTP 寄信模組
 */

const nodemailer = require('nodemailer');

/**
 * 建立 Nodemailer transporter（Gmail SMTP）
 */
function createTransporter(smtpUser, smtpPass) {
    return nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: smtpUser,
            pass: smtpPass,  // Gmail App Password
        },
    });
}

/**
 * 發送 HTML 信件
 * @param {object} opts
 * @param {string} opts.smtpUser  - Gmail 帳號
 * @param {string} opts.smtpPass  - Gmail App Password
 * @param {string} opts.to        - 收件人
 * @param {string} opts.subject   - 主旨
 * @param {string} opts.html      - HTML 內容
 */
async function sendEmail({ smtpUser, smtpPass, to, subject, html }) {
    const transporter = createTransporter(smtpUser, smtpPass);

    const info = await transporter.sendMail({
        from: `"PromptDaily ✨" <${smtpUser}>`,
        to,
        subject,
        html,
    });

    console.log(`📧 信件已寄出！Message ID: ${info.messageId}`);
    return info;
}

module.exports = { sendEmail };
