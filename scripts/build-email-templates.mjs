// Builds the Supabase Auth email templates (paste each file into Supabase: Authentication > Emails > Templates).
// Run: node scripts/build-email-templates.mjs   Output: supabase/email-templates/*.html and subjects.json
import fs from "node:fs";

const LINK = (type, next = "") => `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&amp;type=${type}${next ? `&amp;next=${next}` : ""}`;

const shell = ({ preheader, title, lines, button, href, after }) => `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${title}</title></head>
<body style="margin:0;padding:0;background:#faf6f0;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#faf6f0;">${preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf6f0;padding:32px 16px;">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;">
      <tr><td style="padding:0 4px 20px 4px;">
        <table role="presentation" cellpadding="0" cellspacing="0"><tr>
          <td style="vertical-align:middle;"><img src="https://tableready.sulosystems.com/icons/icon-192.png" width="36" height="36" alt="" style="display:block;border-radius:9px;border:0;"></td>
          <td style="vertical-align:middle;padding-left:10px;font-family:Georgia,'Times New Roman',serif;font-size:20px;font-weight:bold;color:#2a211c;">Table Ready</td>
        </tr></table>
      </td></tr>
      <tr><td style="background:#ffffff;border-radius:20px;padding:36px 32px;">
        <h1 style="margin:0 0 14px 0;font-family:Georgia,'Times New Roman',serif;font-size:26px;line-height:1.2;color:#2a211c;font-weight:bold;">${title}</h1>
${lines.map((l) => `        <p style="margin:0 0 14px 0;font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;font-size:16px;line-height:1.55;color:#5a4a3f;">${l}</p>`).join("\n")}
${button ? `        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0 8px 0;"><tr><td style="background:#b4491f;border-radius:999px;">
          <a href="${href}" style="display:inline-block;padding:14px 28px;font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;font-size:16px;font-weight:bold;color:#ffffff;text-decoration:none;">${button}</a>
        </td></tr></table>
        <p style="margin:18px 0 0 0;font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;font-size:13px;line-height:1.5;color:#8a7a6e;">Button not working? Copy this link into your browser:<br><a href="${href}" style="color:#a8431f;word-break:break-all;">${href}</a></p>` : ""}
${after ? `        <p style="margin:22px 0 0 0;padding-top:18px;border-top:1px solid #efe6da;font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;font-size:13px;line-height:1.5;color:#8a7a6e;">${after}</p>` : ""}
      </td></tr>
      <tr><td style="padding:20px 8px 0 8px;font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;font-size:12px;line-height:1.5;color:#8a7a6e;text-align:center;">
        Table Ready &middot; Reservations, waitlist and walk-ins for restaurants<br>Sent by Sulo Systems &middot; <a href="mailto:info@sulosystems.com" style="color:#8a7a6e;">info@sulosystems.com</a>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>
`;

const ignore = "If you didn't ask for this, you can safely ignore this email. Nothing will change.";

const templates = {
  confirmation: {
    subject: "Confirm your Table Ready account",
    html: shell({
      preheader: "One tap to finish setting up your restaurant.",
      title: "Welcome to Table Ready",
      lines: ["Thanks for signing up. Confirm your email address and you can set up your restaurant: add your tables, choose your opening hours, and start taking reservations online.", "It only takes a minute."],
      button: "Confirm my email", href: LINK("signup"), after: `${ignore} This link works once and expires in 24 hours.`,
    }),
  },
  invite: {
    subject: "You're invited to join a restaurant on Table Ready",
    html: shell({
      preheader: "Accept your invitation to help run the floor.",
      title: "You've been invited",
      lines: ["Someone has invited you to join their restaurant on Table Ready, where the team manages reservations, the waitlist and the walk-in line together.", "Accept the invitation to create your password and get started."],
      button: "Accept the invitation", href: LINK("invite"), after: "If you weren't expecting this invitation, you can ignore this email.",
    }),
  },
  magic_link: {
    subject: "Your Table Ready sign-in link",
    html: shell({
      preheader: "Tap to sign in. The link works once.",
      title: "Sign in to Table Ready",
      lines: ["Use the button below to sign in. You won't need a password."],
      button: "Sign in", href: LINK("magiclink", "/app"), after: `${ignore} This link works once and expires soon.`,
    }),
  },
  email_change: {
    subject: "Confirm your new email address for Table Ready",
    html: shell({
      preheader: "Confirm the change to your account email.",
      title: "Confirm your new email",
      lines: ["You asked to change the email address on your Table Ready account to <strong style=\"color:#2a211c;\">{{ .NewEmail }}</strong>.", "Confirm below to make the change. Your alerts and sign-in will use this address from then on."],
      button: "Confirm new email", href: LINK("email_change", "/app"), after: "If you didn't request this, please ignore this email and your address will stay the same.",
    }),
  },
  recovery: {
    subject: "Reset your Table Ready password",
    html: shell({
      preheader: "Choose a new password for your account.",
      title: "Reset your password",
      lines: ["We got a request to reset the password for your Table Ready account. Choose a new one with the button below."],
      button: "Choose a new password", href: LINK("recovery", "/reset"), after: `${ignore} Your current password keeps working until you pick a new one. The link works once and expires in an hour.`,
    }),
  },
  reauthentication: {
    subject: "Your Table Ready verification code",
    html: shell({
      preheader: "Your code is {{ .Token }}.",
      title: "Your verification code",
      lines: ["Enter this code to confirm it's you:", "<span style=\"display:inline-block;margin:6px 0;padding:12px 20px;background:#faf6f0;border-radius:12px;font-family:'SF Mono',Menlo,Consolas,monospace;font-size:28px;letter-spacing:6px;font-weight:bold;color:#2a211c;\">{{ .Token }}</span>"],
      after: "The code expires in a few minutes. If you didn't ask for it, ignore this email and consider changing your password.",
    }),
  },
};

fs.mkdirSync("supabase/email-templates", { recursive: true });
const subjects = {};
for (const [name, t] of Object.entries(templates)) {
  fs.writeFileSync(`supabase/email-templates/${name}.html`, t.html);
  subjects[name] = t.subject;
}
fs.writeFileSync("supabase/email-templates/subjects.json", JSON.stringify(subjects, null, 2) + "\n");
console.log("wrote", Object.keys(templates).join(", "));
