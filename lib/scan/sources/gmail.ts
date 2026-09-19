import { google, type gmail_v1 } from "googleapis";
import { parseAlertHtml } from "../alerts";
import type { ScannedOffer } from "../types";

function decodePart(data?: string | null) {
  return data ? Buffer.from(data, "base64url").toString("utf8") : "";
}

function findHtml(part?: gmail_v1.Schema$MessagePart | null): string {
  if (!part) return "";
  if (part.mimeType === "text/html" && part.body?.data) return decodePart(part.body.data);
  for (const child of part.parts ?? []) {
    const html = findHtml(child);
    if (html) return html;
  }
  return "";
}

/**
 * Reads job-alert e-mails carrying a Gmail label (default "job-alerts").
 * Needs a read-only OAuth refresh token: see docs/SCANNER.md.
 */
export async function scanGmailAlerts(
  env: Record<string, string | undefined> = process.env,
  maxAgeDays = 7,
): Promise<ScannedOffer[]> {
  const auth = new google.auth.OAuth2(env.GMAIL_CLIENT_ID, env.GMAIL_CLIENT_SECRET);
  auth.setCredentials({ refresh_token: env.GMAIL_REFRESH_TOKEN });
  const gmail = google.gmail({ version: "v1", auth });
  const label = env.GMAIL_ALERT_LABEL?.trim() || "job-alerts";

  const list = await gmail.users.messages.list({
    userId: "me",
    q: `label:${label} newer_than:${maxAgeDays}d`,
    maxResults: 60,
  });
  const offers: ScannedOffer[] = [];
  for (const { id } of list.data.messages ?? []) {
    if (!id) continue;
    const message = await gmail.users.messages.get({ userId: "me", id, format: "full" });
    const html = findHtml(message.data.payload);
    if (!html) continue;
    const received = message.data.internalDate
      ? new Date(Number(message.data.internalDate))
      : null;
    offers.push(...parseAlertHtml(html, received));
  }
  return offers;
}
