import { questions, type Answers, type FieldValue, type Question } from "@/app/lib/questions";
import { formatVisitor, shortLocation, type Visitor } from "@/app/lib/visitor";

export type SubmissionStatus = "submitted" | "rejected";

export type Submission = {
  name: string;
  age: string;
  status: SubmissionStatus;
  answers: Answers;
};

export function displayAnswer(question: Question, value: FieldValue | undefined): string {
  if (value === undefined || value === "") return "—";

  if (Array.isArray(value)) {
    if (value.length === 0) return "—";
    if (question.type === "traits") return value.join(", ");
    if (question.type === "multi") {
      return value
        .map((id) => labelFor(question, id))
        .join(", ");
    }
    return value.join(", ");
  }

  if (
    question.type === "single" ||
    question.type === "yesno" ||
    question.type === "multi" ||
    question.type === "driver" ||
    question.type === "swear"
  ) {
    return labelFor(question, value);
  }

  return value;
}

function labelFor(question: Question, id: string): string {
  if (question.type === "driver" || question.type === "swear") {
    return id === "yes" ? "Yes" : id === "no" ? "No" : id;
  }
  if (
    question.type === "single" ||
    question.type === "multi" ||
    question.type === "yesno"
  ) {
    const option = question.options.find((item) => item.id === id);
    if (!option) return id;
    return option.letter ? `${option.letter}. ${option.label}` : option.label;
  }
  return id;
}

export function formatSubmission(
  input: Submission,
  visitor?: Visitor,
): {
  subject: string;
  text: string;
} {
  const first = input.name.trim() || "Unknown";
  const status = input.status === "rejected" ? "REJECTED" : "SUBMITTED";
  const place = visitor ? shortPlace(visitor) : "";
  const subject = `Girlfriend application ${status}: ${first}, ${input.age || "?"}${place}`.slice(
    0,
    180,
  );

  const lines = [
    `GIRLFRIEND APPLICATION — ${status}`,
    `Name: ${input.name.trim() || "—"}`,
    `Age: ${input.age.trim() || "—"}`,
    `When: ${new Date().toISOString()}`,
    "",
  ];

  if (visitor) {
    lines.push("VISITOR");
    lines.push(formatVisitor(visitor));
    lines.push("");
  }

  questions.forEach((question, index) => {
    const n = String(index + 1).padStart(2, "0");
    lines.push(`${n}. ${question.prompt}`);
    if (question.hint) lines.push(`    (${question.hint})`);
    lines.push(`    → ${displayAnswer(question, input.answers[question.id])}`);
    lines.push("");
  });

  return { subject, text: lines.join("\n").trim() };
}

function shortPlace(visitor: Visitor): string {
  const loc = shortLocation(visitor.geo);
  return loc && loc !== "unknown location" ? ` · ${loc}` : visitor.ip ? ` · ${visitor.ip}` : "";
}
