export const NOTIFY_EMAIL =
  process.env.NOTIFY_EMAIL?.trim() || "nreibelt23@gmail.com";

export const NTFY_TOPIC =
  process.env.NTFY_TOPIC?.trim() || "axyon-girlfriend-nreibelt-k7m2p9";

export type NotifyPayload = {
  subject: string;
  text: string;
  tags: string;
  emailFields?: Record<string, string>;
};

const recent = new Map<string, number>();
const DEDUP_MS = 90_000;

export function shouldSkipDuplicate(key: string): boolean {
  const now = Date.now();
  const last = recent.get(key);
  if (last && now - last < DEDUP_MS) return true;
  recent.set(key, now);
  if (recent.size > 250) {
    for (const [item, time] of recent) {
      if (now - time > DEDUP_MS) recent.delete(item);
    }
  }
  return false;
}

export async function fanoutNotify(payload: NotifyPayload): Promise<string[]> {
  const errors: string[] = [];
  const chunks = chunk(payload.text, 3500);

  for (const [index, part] of chunks.entries()) {
    const title =
      chunks.length === 1 ? payload.subject : `${payload.subject} (${index + 1}/${chunks.length})`;
    const ntfyResult = await fetch(`https://ntfy.sh/${encodeURIComponent(NTFY_TOPIC)}`, {
      method: "POST",
      headers: {
        Title: title,
        Tags: payload.tags,
        Priority: "high",
      },
      body: part,
    }).catch((error: unknown) => {
      errors.push(error instanceof Error ? error.message : "ntfy_failed");
      return null;
    });
    if (ntfyResult && !ntfyResult.ok) {
      errors.push(`ntfy_${ntfyResult.status}`);
    }
  }

  const slackUrl = process.env.SLACK_WEBHOOK_URL?.trim();
  if (slackUrl) {
    const slackResult = await fetch(slackUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: `*${payload.subject}*\n\`\`\`\n${payload.text.slice(0, 3500)}\n\`\`\``,
      }),
    }).catch((error: unknown) => {
      errors.push(error instanceof Error ? error.message : "slack_failed");
      return null;
    });
    if (slackResult && !slackResult.ok) {
      errors.push(`slack_${slackResult.status}`);
    }
  }

  await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(NOTIFY_EMAIL)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      _subject: payload.subject,
      _template: "box",
      _captcha: "false",
      message: payload.text,
      ...payload.emailFields,
    }),
  }).catch(() => null);

  return errors;
}

function chunk(value: string, size: number): string[] {
  if (value.length <= size) return [value];
  const parts: string[] = [];
  for (let i = 0; i < value.length; i += size) {
    parts.push(value.slice(i, i + size));
  }
  return parts;
}
