import { formatSubmission, type Submission } from "@/app/lib/submission";

const NOTIFY_EMAIL =
  process.env.NOTIFY_EMAIL?.trim() || "nreibelt23@gmail.com";

const NTFY_TOPIC =
  process.env.NTFY_TOPIC?.trim() || "axyon-girlfriend-nreibelt-k7m2p9";

export async function POST(request: Request) {
  let body: Submission;
  try {
    body = (await request.json()) as Submission;
  } catch {
    return Response.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return Response.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }

  const submission: Submission = {
    name: String(body.name ?? ""),
    age: String(body.age ?? ""),
    status: body.status === "rejected" ? "rejected" : "submitted",
    answers: body.answers && typeof body.answers === "object" ? body.answers : {},
  };

  const { subject, text } = formatSubmission(submission);
  const errors: string[] = [];

  const chunks = chunk(text, 3500);
  for (const [index, part] of chunks.entries()) {
    const title =
      chunks.length === 1 ? subject : `${subject} (${index + 1}/${chunks.length})`;
    const ntfyResult = await fetch(`https://ntfy.sh/${encodeURIComponent(NTFY_TOPIC)}`, {
      method: "POST",
      headers: {
        Title: title,
        Tags: submission.status === "rejected" ? "x,warning" : "heart,love_letter",
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
        text: `*${subject}*\n\`\`\`\n${text.slice(0, 3500)}\n\`\`\``,
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
      _subject: subject,
      _template: "box",
      _captcha: "false",
      name: submission.name,
      age: submission.age,
      status: submission.status,
      message: text,
    }),
  }).catch(() => null);

  return Response.json({
    ok: errors.length === 0,
    errors,
    ntfy: `https://ntfy.sh/${NTFY_TOPIC}`,
  });
}

function chunk(value: string, size: number): string[] {
  if (value.length <= size) return [value];
  const parts: string[] = [];
  for (let i = 0; i < value.length; i += size) {
    parts.push(value.slice(i, i + size));
  }
  return parts;
}
