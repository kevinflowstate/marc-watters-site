import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = "Marc Watters <marc@marcwatters.com>";
const PORTAL_URL = "https://marc-watters-site.vercel.app";

function wrap(content: string): string {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px;">
      ${content}
      <p style="color: #999; font-size: 12px; margin: 32px 0 0;">
        Construction Business Blueprint - Client Portal
      </p>
    </div>
  `;
}

function button(href: string, label: string): string {
  return `<a href="${href}" style="display: inline-block; background: #2272de; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 600;">${label}</a>`;
}

export async function sendWelcomeEmail(to: string, name: string, setupUrl: string) {
  const firstName = name.split(" ")[0];
  return resend.emails.send({
    from: FROM,
    to,
    subject: "Your Construction Business Blueprint portal is ready",
    html: wrap(`
      <h2 style="margin: 0 0 8px; font-size: 20px; color: #111;">Welcome ${firstName},</h2>
      <p style="color: #555; font-size: 15px; line-height: 1.6; margin: 0 0 24px;">
        Your client portal is set up and ready to go. Click below to set your password and access your training, business plan, and check-ins.
      </p>
      ${button(setupUrl, "Set Up Your Account")}
    `),
  });
}

export async function sendCheckinReplyEmail(to: string, clientName: string, replyText: string) {
  const firstName = clientName.split(" ")[0];
  return resend.emails.send({
    from: FROM,
    to,
    subject: "Marc replied to your check-in",
    html: wrap(`
      <h2 style="margin: 0 0 8px; font-size: 20px; color: #111;">Hey ${firstName},</h2>
      <p style="color: #555; font-size: 15px; line-height: 1.6; margin: 0 0 24px;">
        Marc has replied to your latest check-in.
      </p>
      <div style="background: #f8f9fa; border-left: 3px solid #2272de; border-radius: 0 8px 8px 0; padding: 16px 20px; margin: 0 0 24px;">
        <p style="margin: 0; color: #333; font-size: 15px; line-height: 1.6; white-space: pre-wrap;">${replyText}</p>
      </div>
      ${button(`${PORTAL_URL}/portal`, "View in Portal")}
    `),
  });
}

export async function sendCheckinReminderEmail(to: string, clientName: string, weekNumber: number) {
  const firstName = clientName.split(" ")[0];
  return resend.emails.send({
    from: FROM,
    to,
    subject: `Week ${weekNumber} check-in reminder`,
    html: wrap(`
      <h2 style="margin: 0 0 8px; font-size: 20px; color: #111;">Hey ${firstName},</h2>
      <p style="color: #555; font-size: 15px; line-height: 1.6; margin: 0 0 24px;">
        Your Week ${weekNumber} check-in is due. It takes 2 minutes and helps Marc stay on top of your progress.
      </p>
      ${button(`${PORTAL_URL}/portal/checkin`, "Submit Check-In")}
    `),
  });
}

export async function sendWeeklySummaryEmail(to: string, summary: {
  totalClients: number;
  checkedIn: string[];
  missed: string[];
  redClients: string[];
  planCompletions: string[];
}) {
  const checkedInList = summary.checkedIn.length > 0
    ? summary.checkedIn.map(n => `<li style="color:#333;font-size:14px;margin:4px 0;">${n}</li>`).join("")
    : '<li style="color:#999;font-size:14px;">None this week</li>';

  const missedList = summary.missed.length > 0
    ? summary.missed.map(n => `<li style="color:#e74c3c;font-size:14px;margin:4px 0;">${n}</li>`).join("")
    : '<li style="color:#999;font-size:14px;">Everyone checked in</li>';

  const redList = summary.redClients.length > 0
    ? summary.redClients.map(n => `<li style="color:#e74c3c;font-size:14px;margin:4px 0;">${n}</li>`).join("")
    : '<li style="color:#27ae60;font-size:14px;">All clients on track</li>';

  return resend.emails.send({
    from: FROM,
    to,
    subject: `Weekly Summary - ${summary.totalClients} clients`,
    html: wrap(`
      <h2 style="margin: 0 0 16px; font-size: 20px; color: #111;">Weekly Client Summary</h2>

      <h3 style="margin: 16px 0 8px; font-size: 14px; color: #2272de; text-transform: uppercase; letter-spacing: 1px;">Checked In This Week</h3>
      <ul style="margin: 0 0 16px; padding-left: 20px;">${checkedInList}</ul>

      <h3 style="margin: 16px 0 8px; font-size: 14px; color: #e74c3c; text-transform: uppercase; letter-spacing: 1px;">Missed Check-In</h3>
      <ul style="margin: 0 0 16px; padding-left: 20px;">${missedList}</ul>

      <h3 style="margin: 16px 0 8px; font-size: 14px; color: #e74c3c; text-transform: uppercase; letter-spacing: 1px;">Needs Attention</h3>
      <ul style="margin: 0 0 16px; padding-left: 20px;">${redList}</ul>

      ${summary.planCompletions.length > 0 ? `
        <h3 style="margin: 16px 0 8px; font-size: 14px; color: #27ae60; text-transform: uppercase; letter-spacing: 1px;">Plan Items Completed</h3>
        <ul style="margin: 0 0 16px; padding-left: 20px;">
          ${summary.planCompletions.map(n => `<li style="color:#333;font-size:14px;margin:4px 0;">${n}</li>`).join("")}
        </ul>
      ` : ""}

      ${button(`${PORTAL_URL}/admin`, "Open Admin Dashboard")}
    `),
  });
}
