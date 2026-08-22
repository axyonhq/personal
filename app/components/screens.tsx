"use client";

import { useEffect, useRef, useState } from "react";

export function Welcome({
  name,
  age,
  onName,
  onAge,
  onStart,
}: {
  name: string;
  age: string;
  onName: (value: string) => void;
  onAge: (value: string) => void;
  onStart: () => void;
}) {
  const ageNum = Number(age);
  const underage = age.trim() !== "" && Number.isFinite(ageNum) && ageNum < 18;
  const canStart = name.trim().length > 0 && Number.isFinite(ageNum) && ageNum >= 18;

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-1 flex-col justify-center py-10 sm:py-14">
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

        <div className="mt-10 grid max-w-[34rem] grid-cols-1 gap-6 sm:grid-cols-[1fr_7.5rem]">
          <label className="block">
            <span className="text-[0.68rem] font-medium tracking-[0.18em] text-muted uppercase">
              Full name
            </span>
            <input
              className="field-line mt-2"
              value={name}
              onChange={(event) => onName(event.target.value)}
              placeholder="As it should appear on the shortlist"
              autoComplete="name"
              autoFocus
            />
          </label>
          <label className="block">
            <span className="text-[0.68rem] font-medium tracking-[0.18em] text-muted uppercase">
              Age
            </span>
            <input
              className="field-line mt-2"
              type="number"
              inputMode="numeric"
              min={18}
              max={99}
              value={age}
              onChange={(event) => onAge(event.target.value)}
              placeholder="18+"
            />
          </label>
        </div>
        {underage ? (
          <p className="flash flash-bad mt-4">
            Eighteen and over. This is not a youth programme.
          </p>
        ) : null}

        <div className="mt-10">
          <button type="button" className="btn" onClick={onStart} disabled={!canStart}>
            Start application
            <span className="arrow" aria-hidden="true">
              →
            </span>
          </button>
        </div>
      </div>

      <dl className="mt-auto grid grid-cols-1 gap-6 border-t border-rule pt-6 text-[0.78rem] leading-relaxed sm:grid-cols-3 sm:gap-8">
        <div>
          <dt className="font-medium tracking-[0.16em] text-muted uppercase">Role</dt>
          <dd className="mt-2 text-ink/80">Girlfriend. Unpaid. Low paperwork.</dd>
        </div>
        <div>
          <dt className="font-medium tracking-[0.16em] text-muted uppercase">Process</dt>
          <dd className="mt-2 text-ink/80">One question per page. No take-backs. No “haha wait.”</dd>
        </div>
        <div>
          <dt className="font-medium tracking-[0.16em] text-muted uppercase">Prize</dt>
          <dd className="mt-2 text-ink/80">Date Number One. Or silence, which is also feedback.</dd>
        </div>
      </dl>
    </div>
  );
}

export function CountdownScreen({
  kicker,
  onDone,
}: {
  kicker: string;
  onDone: () => void;
}) {
  const [n, setN] = useState(5);
  const onDoneRef = useRef(onDone);

  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    if (n > 0) {
      const t = window.setTimeout(() => setN((v) => v - 1), 900);
      return () => window.clearTimeout(t);
    }
    onDoneRef.current();
  }, [n]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center py-16 text-center">
      <p className="text-[0.68rem] font-medium tracking-[0.22em] text-muted uppercase">
        {kicker}
      </p>
      <p key={Math.max(n, 1)} className="countdown-num mt-6">
        {Math.max(n, 1)}
      </p>
    </div>
  );
}

export function Rejected() {
  return (
    <div className="flex flex-1 flex-col justify-center py-16">
      <p className="text-[0.68rem] font-medium tracking-[0.22em] text-blood uppercase">
        Application closed
      </p>
      <h1 className="mt-5 max-w-[12ch] font-serif text-[2.7rem] leading-[0.95] tracking-[-0.03em] sm:text-[4.15rem]">
        Door’s that way.
      </h1>
      <p className="mt-8 max-w-[32rem] text-[1.05rem] leading-relaxed text-ink/80">
        There was no wrong answer. You found one anyway. Independent-woman
        energy has been forwarded to LinkedIn. Do not resubmit.
      </p>
    </div>
  );
}

export function Shortlist({
  name,
  onReveal,
}: {
  name: string;
  onReveal: () => void;
}) {
  const first = name.trim().split(/\s+/)[0] || "candidate";

  return (
    <div className="flex flex-1 flex-col py-10 sm:py-12">
      <p className="text-[0.68rem] font-medium tracking-[0.22em] text-good uppercase">
        Shortlisted
      </p>
      <h1 className="mt-5 font-serif text-[2.4rem] leading-[0.98] tracking-[-0.03em] text-pretty sm:text-[3.4rem]">
        Congratulations, {first}.
      </h1>
      <div className="mt-6 max-w-[34rem] space-y-4 text-[1.05rem] leading-relaxed text-ink/80">
        <p>You’ve been shortlisted.</p>
        <p>
          Nick is excited to move you through the application process. He has
          planned your first date for{" "}
          <span className="inline-block align-baseline blur-[7px] select-none">
            Saturday 29 August
          </span>
          .
        </p>
      </div>

      <div className="locked-card mt-10">
        <div className="locked-card-body" aria-hidden="true">
          <p className="text-[0.68rem] font-medium tracking-[0.18em] uppercase">
            Date Number One
          </p>
          <p className="mt-4 font-serif text-3xl tracking-tight">Saturday evening · 8:14pm</p>
          <p className="mt-5 text-[0.95rem] leading-relaxed">
            Somewhere expensive enough to impress your father.
            <br />
            Dress code: look ruinable.
            <br />
            Pickup: he will not be early, he will be correct.
          </p>
        </div>
        <div className="lock-overlay">
          <LockIcon />
        </div>
      </div>

      <div className="mt-8 flex flex-col items-start gap-3">
        <p className="nudge">
          Click here to unlock and find out what the date is
          <span className="ml-2 not-italic" aria-hidden="true">
            ↘
          </span>
        </p>
        <button type="button" className="btn" onClick={onReveal}>
          Reveal date
          <span className="arrow" aria-hidden="true">
            →
          </span>
        </button>
      </div>
    </div>
  );
}

export function Prank() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center py-8 text-center">
      <div className="prank-pop flex flex-col items-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/nick.jpg" alt="Nick" className="prank-photo" />
        <p className="mt-8 max-w-[28rem] font-serif text-[1.65rem] leading-[1.15] tracking-[-0.03em] text-pretty sm:text-[2.05rem]">
          Do you really think Nick would tell you about the date this far in
          advance?
        </p>
        <p className="mt-4 text-[0.8rem] font-medium tracking-[0.16em] text-blood uppercase">
          Minus three points for not knowing Nick well enough
        </p>
      </div>
    </div>
  );
}

function LockIcon() {
  return (
    <svg
      width="42"
      height="42"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <rect
        x="5"
        y="11"
        width="14"
        height="10"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path
        d="M8 11V8.2C8 5.9 9.7 4 12 4s4 1.9 4 4.2V11"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}
