"use client";

import { useMemo, useState, type KeyboardEvent } from "react";
import { questions } from "@/app/lib/questions";

type Step = "welcome" | number | "complete";

export function Application() {
  const [step, setStep] = useState<Step>("welcome");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [animKey, setAnimKey] = useState(0);

  const question = typeof step === "number" ? questions[step] : null;
  const progressLabel = useMemo(() => {
    if (step === "welcome") return "Intake";
    if (step === "complete") return "Submitted";
    return `Question ${String(step + 1).padStart(2, "0")}`;
  }, [step]);

  function go(next: Step) {
    setStep(next);
    setAnimKey((n) => n + 1);
  }

  return (
    <div className="relative mx-auto flex min-h-dvh w-full max-w-[46rem] flex-col border-rule px-6 py-7 sm:border-x sm:px-12 sm:py-10">
      <header className="flex items-end justify-between gap-6 border-b border-rule pb-4">
        <div>
          <p className="text-[0.64rem] font-medium tracking-[0.22em] text-muted uppercase">
            Confidential
          </p>
          <p className="mt-1 font-serif text-[1.35rem] leading-none tracking-tight">
            Girlfriend search
          </p>
        </div>
        <p className="pb-0.5 text-[0.64rem] font-medium tracking-[0.18em] text-muted uppercase">
          {progressLabel}
        </p>
      </header>

      <main className="flex flex-1 flex-col">
        <div key={animKey} className="step-enter flex flex-1 flex-col">
          {step === "welcome" ? (
            <Welcome onStart={() => go(0)} />
          ) : step === "complete" ? (
            <Complete />
          ) : question ? (
            <QuestionStep
              index={step}
              total={questions.length}
              prompt={question.prompt}
              hint={question.hint}
              placeholder={question.placeholder}
              value={answers[question.id] ?? ""}
              onChange={(value) =>
                setAnswers((prev) => ({ ...prev, [question.id]: value }))
              }
              onBack={() => go(step === 0 ? "welcome" : step - 1)}
              onNext={() =>
                go(step + 1 < questions.length ? step + 1 : "complete")
              }
            />
          ) : null}
        </div>
      </main>
    </div>
  );
}

function Welcome({ onStart }: { onStart: () => void }) {
  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-1 flex-col justify-center py-12 sm:py-16">
        <p className="text-[0.68rem] font-medium tracking-[0.22em] text-blood uppercase">
          Pre-qualification · Cycle 2026
        </p>
        <h1 className="mt-5 font-serif text-[2.7rem] leading-[0.95] tracking-[-0.03em] text-pretty sm:text-[4.15rem]">
          Welcome.
        </h1>
        <div className="mt-8 max-w-[34rem] space-y-5 text-[1.05rem] leading-relaxed text-ink/80 sm:text-[1.12rem]">
          <p>
            Thank you for your interest in pre-qualification for the{" "}
            <em className="font-serif text-[1.18em] text-ink">
              next girlfriend position
            </em>
            .
          </p>
          <p>
            You will be asked a series of questions — one at a time, like a
            civilized person — to determine whether you will be shortlisted and
            permitted to move forward in the application process toward{" "}
            <em className="font-serif text-[1.18em] text-ink">Date Number One</em>
            .
          </p>
          <p className="text-[0.98rem] text-muted">
            This is not a meet-cute. This is a hiring process. There is no
            salary, no dental, and absolutely no “sorry I&apos;m just so bad at
            texting.” There is a shortlist. You are not on it yet.
          </p>
        </div>

        <div className="mt-10">
          <button type="button" className="btn" onClick={onStart}>
            Start application
            <span className="arrow" aria-hidden="true">
              →
            </span>
          </button>
        </div>
      </div>

      <dl className="mt-auto grid grid-cols-1 gap-6 border-t border-rule pt-6 text-[0.78rem] leading-relaxed sm:grid-cols-3 sm:gap-8">
        <div>
          <dt className="font-medium tracking-[0.16em] text-muted uppercase">
            Role
          </dt>
          <dd className="mt-2 text-ink/80">Girlfriend. Unpaid. High drama, low paperwork.</dd>
        </div>
        <div>
          <dt className="font-medium tracking-[0.16em] text-muted uppercase">
            Process
          </dt>
          <dd className="mt-2 text-ink/80">One question per page. No take-backs. No “haha wait.”</dd>
        </div>
        <div>
          <dt className="font-medium tracking-[0.16em] text-muted uppercase">
            Prize
          </dt>
          <dd className="mt-2 text-ink/80">Date Number One. Or silence, which is also feedback.</dd>
        </div>
      </dl>
    </div>
  );
}

function QuestionStep({
  index,
  total,
  prompt,
  hint,
  placeholder,
  value,
  onChange,
  onBack,
  onNext,
}: {
  index: number;
  total: number;
  prompt: string;
  hint: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const canContinue = value.trim().length > 0;

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter" && canContinue) {
      event.preventDefault();
      onNext();
    }
  }

  return (
    <div className="flex flex-1 flex-col py-12 sm:py-16">
      <p className="text-[0.68rem] font-medium tracking-[0.22em] text-muted uppercase">
        {String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
      </p>
      <h1 className="mt-5 max-w-[22ch] font-serif text-[2.15rem] leading-[1.08] tracking-[-0.03em] text-pretty sm:text-[3.05rem]">
        {prompt}
      </h1>
      <p className="mt-4 max-w-[36rem] text-[0.98rem] leading-relaxed text-muted">
        {hint}
      </p>

      <label className="mt-10 block">
        <span className="sr-only">{prompt}</span>
        <textarea
          className="field"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoFocus
          rows={5}
        />
      </label>

      <div className="mt-10 flex flex-wrap items-center gap-3">
        <button type="button" className="btn btn-ghost" onClick={onBack}>
          Back
        </button>
        <button type="button" className="btn" onClick={onNext} disabled={!canContinue}>
          Next
          <span className="arrow" aria-hidden="true">
            →
          </span>
        </button>
      </div>
    </div>
  );
}

function Complete() {
  return (
    <div className="flex flex-1 flex-col justify-center py-12 sm:py-16">
      <p className="text-[0.68rem] font-medium tracking-[0.22em] text-blood uppercase">
        Application received
      </p>
      <h1 className="mt-5 max-w-[12ch] font-serif text-[2.7rem] leading-[0.95] tracking-[-0.03em] sm:text-[4.15rem]">
        Sit tight.
      </h1>
      <div className="mt-8 max-w-[34rem] space-y-5 text-[1.05rem] leading-relaxed text-ink/80 sm:text-[1.12rem]">
        <p>
          Your answers are in. If you are shortlisted, you will be contacted
          regarding Date Number One.
        </p>
        <p className="text-[0.98rem] text-muted">
          If you are not, you will hear nothing, which is also an answer. Do not
          follow up. Following up is a personality, and not a good one.
        </p>
      </div>
    </div>
  );
}
