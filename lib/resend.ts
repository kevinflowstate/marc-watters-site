import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendCheckinReplyEmail(
  to: string,
  clientName: string,
  replyText: string
) {
  const firstName = clientName.split(" ")[0];

  return resend.emails.send({
    from: "Marc Watters <marc@marcwatters.com>",
    to,
    subject: `Marc replied to your check-in`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px;">
        <h2 style="margin: 0 0 8px; font-size: 20px; color: #111;">Hey ${firstName},</h2>
        <p style="color: #555; font-size: 15px; line-height: 1.6; margin: 0 0 24px;">
          Marc has replied to your latest check-in.
        </p>
        <div style="background: #f8f9fa; border-left: 3px solid #2272de; border-radius: 0 8px 8px 0; padding: 16px 20px; margin: 0 0 24px;">
          <p style="margin: 0; color: #333; font-size: 15px; line-height: 1.6; white-space: pre-wrap;">${replyText}</p>
        </div>
        <a href="https://marc-watters-site.vercel.app/portal" style="display: inline-block; background: #2272de; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 600;">
          View in Portal
        </a>
        <p style="color: #999; font-size: 12px; margin: 32px 0 0;">
          Construction Business Blueprint - Client Portal
        </p>
      </div>
    `,
  });
}
