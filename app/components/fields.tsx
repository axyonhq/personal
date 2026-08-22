"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import {
  isComplete,
  toggleExclusiveMulti,
  type FieldValue,
  type Question,
} from "@/app/lib/questions";

export function QuestionFields({
  question,
  value,
  onChange,
  onReject,
}: {
  question: Question;
  value: FieldValue | undefined;
  onChange: (value: FieldValue) => void;
  onReject?: () => void;
}) {
  switch (question.type) {
    case "textarea":
      return (
        <TextArea
          prompt={question.prompt}
          placeholder={question.placeholder}
          value={typeof value === "string" ? value : ""}
          onChange={onChange}
        />
      );
    case "text":
      return (
        <input
          className="field-line"
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onChange(event.target.value)}
          placeholder={question.placeholder}
          autoFocus
          aria-label={question.prompt}
        />
      );
    case "number":
      return (
        <input
          className="field-number"
          type="number"
          inputMode="numeric"
          min={question.min}
          max={question.max}
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onChange(event.target.value)}
          placeholder="0"
          autoFocus
          aria-label={question.prompt}
        />
      );
    case "single":
      return (
        <ChoiceList
          options={question.options}
          selected={typeof value === "string" ? value : ""}
          onSelect={onChange}
        />
      );
    case "multi":
      return (
        <ChoiceList
          options={question.options}
          selected={Array.isArray(value) ? value : []}
          onSelect={(id) =>
            onChange(
              toggleExclusiveMulti(
                Array.isArray(value) ? value : [],
                id,
                question.options,
              ),
            )
          }
        />
      );
    case "yesno":
      return (
        <YesNo
          value={typeof value === "string" ? value : ""}
          onChange={onChange}
        />
      );
    case "traits":
      return (
        <TraitPicker
          options={question.options}
          max={question.max}
          value={Array.isArray(value) ? value : []}
          onChange={onChange}
        />
      );
    case "driver":
      return (
        <Driver
          value={typeof value === "string" ? value : ""}
          onChange={onChange}
        />
      );
    case "swear":
      return (
        <Swear
          value={typeof value === "string" ? value : ""}
          onChange={onChange}
          onReject={onReject}
        />
      );
  }
}

function TextArea({
  prompt,
  placeholder,
  value,
  onChange,
}: {
  prompt: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <textarea
      className="field"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      autoFocus
      rows={5}
      aria-label={prompt}
    />
  );
}

function ChoiceList({
  options,
  selected,
  onSelect,
}: {
  options: { id: string; letter?: string; label: string }[];
  selected: string | string[];
  onSelect: (id: string) => void;
}) {
  const isOn = (id: string) =>
    Array.isArray(selected) ? selected.includes(id) : selected === id;

  return (
    <div className="flex flex-col gap-2">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          className="choice"
          data-selected={isOn(option.id)}
          onClick={() => onSelect(option.id)}
        >
          {option.letter ? (
            <span className="choice-letter">{option.letter}</span>
          ) : null}
          <span className="choice-label">{option.label}</span>
        </button>
      ))}
    </div>
  );
}

function YesNo({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="choice-grid">
      <button
        type="button"
        className="choice"
        data-selected={value === "yes"}
        onClick={() => onChange("yes")}
      >
        <span className="choice-label">Yes</span>
      </button>
      <button
        type="button"
        className="choice"
        data-selected={value === "no"}
        onClick={() => onChange("no")}
      >
        <span className="choice-label">No</span>
      </button>
    </div>
  );
}

function Driver({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [flash, setFlash] = useState<"bad" | "good" | null>(null);

  function pick(next: "yes" | "no") {
    onChange(next);
    setFlash(next === "yes" ? "bad" : "good");
  }

  return (
    <div>
      <div className="choice-grid">
        <button
          type="button"
          className="choice"
          data-selected={value === "yes"}
          onClick={() => pick("yes")}
        >
          <span className="choice-label">Yes</span>
        </button>
        <button
          type="button"
          className="choice"
          data-selected={value === "no"}
          onClick={() => pick("no")}
        >
          <span className="choice-label">No</span>
        </button>
      </div>
      {flash === "bad" ? (
        <p key="bad" className="flash flash-bad mt-5">
          Try again.
        </p>
      ) : null}
      {flash === "good" ? (
        <p key="good" className="flash flash-good mt-5">
          Good job. You’re right.
        </p>
      ) : null}
    </div>
  );
}

function Swear({
  value,
  onChange,
  onReject,
}: {
  value: string;
  onChange: (value: string) => void;
  onReject?: () => void;
}) {
  return (
    <div className="choice-grid">
      <button
        type="button"
        className="choice"
        data-selected={value === "yes"}
        onClick={() => onChange("yes")}
      >
        <span className="choice-label">Yes</span>
      </button>
      <button
        type="button"
        className="choice"
        data-selected={value === "no"}
        onClick={() => {
          onChange("no");
          onReject?.();
        }}
      >
        <span className="choice-label">No</span>
      </button>
    </div>
  );
}

function TraitPicker({
  options,
  max,
  value,
  onChange,
}: {
  options: string[];
  max: number;
  value: string[];
  onChange: (value: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return options.filter((trait) => !q || trait.toLowerCase().includes(q));
  }, [options, query]);

  useEffect(() => {
    function onDoc(event: MouseEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function add(trait: string) {
    if (value.includes(trait) || value.length >= max) return;
    onChange([...value, trait]);
    setQuery("");
    setActive(0);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActive((n) => Math.min(n + 1, filtered.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((n) => Math.max(n - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const trait = filtered[active];
      if (trait) add(trait);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={wrapRef}>
      {value.length > 0 ? (
        <div className="chips mb-4">
          {value.map((trait) => (
            <span key={trait} className="chip">
              {trait}
              <button
                type="button"
                aria-label={`Remove ${trait}`}
                onClick={() => onChange(value.filter((item) => item !== trait))}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      ) : null}

      <p className="mb-3 text-[0.72rem] tracking-[0.16em] text-muted uppercase">
        {value.length} / {max} selected
      </p>

      <input
        className="field-line"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder={
          value.length >= max
            ? "That’s five. Remove one to swap."
            : "Search traits, then add from the list"
        }
        disabled={value.length >= max}
        autoFocus
      />

      {open && value.length < max ? (
        <div className="menu" role="listbox">
          {filtered.length === 0 ? (
            <p className="px-3 py-3 text-sm text-muted">No matches. Try softer.</p>
          ) : (
            filtered.map((trait, index) => {
              const taken = value.includes(trait);
              return (
                <button
                  key={trait}
                  type="button"
                  role="option"
                  aria-selected={index === active}
                  disabled={taken}
                  data-active={index === active}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => add(trait)}
                >
                  {trait}
                </button>
              );
            })
          )}
        </div>
      ) : null}
    </div>
  );
}

export function canProceed(question: Question, value: FieldValue | undefined) {
  return isComplete(question, value);
}
