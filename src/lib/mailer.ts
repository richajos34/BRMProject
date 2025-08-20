import nodemailer from "nodemailer";

const host = process.env.MAILTRAP_HOST!;
const port = Number(process.env.MAILTRAP_PORT || 2525);
const user = process.env.MAILTRAP_USER!;
const pass = process.env.MAILTRAP_PASS!;
const from = process.env.EMAIL_FROM!;

export const mailer = nodemailer.createTransport({
  host,
  port,
  auth: { user, pass },
});

export async function sendEmail(opts: {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
}) {
  const info = await mailer.sendMail({
    from,
    to: opts.to,
    subject: opts.subject,
    text: opts.text ?? "",
    html: opts.html ?? undefined,
  });
  return info; // includes messageId etc.
}