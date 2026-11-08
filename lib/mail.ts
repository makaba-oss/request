import nodemailer from 'nodemailer';

let transport: nodemailer.Transporter | null = null;

function getTransport() {
  const url = process.env.SMTP_URL;
  if (!url) return null;
  transport ??= nodemailer.createTransport(url);
  return transport;
}

/** Отправляет письмо. Без SMTP_URL (локальная разработка) печатает письмо в журнал сервера. */
export async function sendMail(to: string, subject: string, text: string, html?: string) {
  const t = getTransport();
  if (!t) {
    console.log(`\n[почта не настроена] Письмо для ${to}\nТема: ${subject}\n${text}\n`);
    return;
  }
  await t.sendMail({ from: process.env.MAIL_FROM || 'ReQuest <no-reply@localhost>', to, subject, text, html });
}

export function codeEmail(code: string) {
  const text = `Ваш код для входа в ReQuest: ${code}\n\nКод действует 10 минут. Если вы не запрашивали вход, просто проигнорируйте это письмо.`;
  const html = `<div style="font-family:Arial,sans-serif;color:#141A33;max-width:440px">
  <p style="font-size:15px">Ваш код для входа в <b>ReQuest</b>:</p>
  <p style="font-size:34px;font-weight:700;letter-spacing:6px;color:#2F3FE0;margin:16px 0">${code}</p>
  <p style="font-size:13px;color:#5B6480">Код действует 10 минут. Если вы не запрашивали вход, просто проигнорируйте это письмо.</p>
</div>`;
  return { subject: `Код для входа: ${code}`, text, html };
}
