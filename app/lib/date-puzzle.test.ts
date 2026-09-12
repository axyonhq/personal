import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyDecision,
  applyUnlock,
  baliWallTime,
  creditAvailable,
  dateCreditAvailable,
  emptyState,
  formatDateTitle,
  formatStartTime,
  instructionParagraphs,
  instructionsUnlockAt,
  instructionsUnlockTimeZone,
  instructionsUnlocked,
  MELBOURNE_TIME_ZONE,
  pendingDate,
  puzzleDayId,
  nextCreditAt,
  readyCreditCount,
  remainingUntil,
  usesSharedDailyCredit,
  DATES,
  BALI_TIME_ZONE,
} from "./date-puzzle";

const SATURDAY_ID = "2026-09-19";

describe("puzzleDayId (Bali 6am boundary)", () => {
  it("is still the previous calendar day at 05:59 Bali", () => {
    const now = baliWallTime(2026, 9, 3, 5, 59, 0);
    assert.equal(puzzleDayId(now), "2026-09-02");
  });

  it("rolls at 06:00 Bali", () => {
    const now = baliWallTime(2026, 9, 3, 6, 0, 0);
    assert.equal(puzzleDayId(now), "2026-09-03");
  });

  it("stays on the same puzzle day at 21:00 Bali", () => {
    const now = baliWallTime(2026, 9, 7, 21, 0, 0);
    assert.equal(puzzleDayId(now), "2026-09-07");
  });
});

describe("nextCreditAt", () => {
  it("points at today's 6am when it is still before 6am", () => {
    const now = baliWallTime(2026, 9, 3, 5, 0, 0);
    assert.equal(nextCreditAt(now).toISOString(), baliWallTime(2026, 9, 3, 6).toISOString());
  });

  it("points at tomorrow's 6am once 6am has passed", () => {
    const now = baliWallTime(2026, 9, 3, 6, 0, 0);
    assert.equal(nextCreditAt(now).toISOString(), baliWallTime(2026, 9, 4, 6).toISOString());
  });
});

function acceptSaturday(now = baliWallTime(2026, 9, 12, 10)) {
  const accepted = applyDecision(emptyState(), SATURDAY_ID, "accepted");
  assert.equal(accepted.ok, true);
  if (!accepted.ok) throw new Error("accept saturday");
  return { now, state: accepted.state };
}

describe("RSVP and daily credits", () => {
  it("blocks hints until the date is accepted", () => {
    const now = baliWallTime(2026, 9, 12, 10);
    const state = emptyState();
    assert.equal(pendingDate(state)?.id, SATURDAY_ID);
    assert.equal(creditAvailable(state, now), false);
    const unlocked = applyUnlock(state, "d3-pisa", now);
    assert.equal(unlocked.ok, false);
    if (!unlocked.ok) assert.equal(unlocked.error, "not_accepted");
  });

  it("from 6:00 AM Bali on 4 Sep, one unlock is shared across the board", () => {
    const now = baliWallTime(2026, 9, 12, 10);
    assert.equal(usesSharedDailyCredit(now), true);
    const { state } = acceptSaturday(now);
    assert.equal(readyCreditCount(state, now), 1);
    assert.equal(creditAvailable(state, now), true);

    const first = applyUnlock(state, "d3-pisa", now);
    assert.equal(first.ok, true);
    if (!first.ok) return;
    assert.equal(first.state.lastUnlockDay, "2026-09-12");
    assert.equal(creditAvailable(first.state, now), false);
    assert.equal(dateCreditAvailable(first.state, SATURDAY_ID, now), false);

    const second = applyUnlock(first.state, "d3-compass", now);
    assert.equal(second.ok, false);
    if (!second.ok) assert.equal(second.error, "no_credit");
  });

  it("grants a fresh shared credit at 6:00 AM the next day", () => {
    const yesterday = baliWallTime(2026, 9, 12, 10);
    const { state } = acceptSaturday(yesterday);
    const a = applyUnlock(state, "d3-pisa", yesterday);
    assert.equal(a.ok, true);
    if (!a.ok) return;
    assert.equal(creditAvailable(a.state, yesterday), false);

    const morning = baliWallTime(2026, 9, 13, 6, 0, 0);
    assert.equal(creditAvailable(a.state, morning), true);
    const next = applyUnlock(a.state, "d3-compass", morning);
    assert.equal(next.ok, true);
    if (!next.ok) return;
    const extra = applyUnlock(next.state, "d3-gelato", morning);
    assert.equal(extra.ok, false);
    if (!extra.ok) assert.equal(extra.error, "no_credit");
  });

  it("does not stack unused days — only today's credit exists", () => {
    const { state } = acceptSaturday();
    const later = baliWallTime(2026, 9, 15, 10);
    assert.equal(creditAvailable(state, later), true);
    const first = applyUnlock(state, "d3-pisa", later);
    assert.equal(first.ok, true);
    if (!first.ok) return;
    assert.equal(creditAvailable(first.state, later), false);
  });

  it("rejects a declined date's hints forever", () => {
    const now = baliWallTime(2026, 9, 12, 10);
    const rejected = applyDecision(emptyState(), SATURDAY_ID, "rejected");
    assert.equal(rejected.ok, true);
    if (!rejected.ok) return;
    const unlocked = applyUnlock(rejected.state, "d3-pisa", now);
    assert.equal(unlocked.ok, false);
    if (!unlocked.ok) assert.equal(unlocked.error, "not_accepted");
  });

  it("refuses a second decision on the same date", () => {
    const accepted = applyDecision(emptyState(), SATURDAY_ID, "accepted");
    assert.equal(accepted.ok, true);
    if (!accepted.ok) return;
    const again = applyDecision(accepted.state, SATURDAY_ID, "rejected");
    assert.equal(again.ok, false);
    if (!again.ok) assert.equal(again.error, "already_decided");
  });
});

describe("copy", () => {
  it("titles the Saturday date the way a person would say it", () => {
    assert.equal(DATES.length, 1);
    assert.equal(formatDateTitle(DATES[0]!.startsAt), "Saturday, 19th September");
    assert.equal(formatStartTime(DATES[0]!.startsAt), "5:30 PM");
  });

  it("ships the four Saturday clues", () => {
    const hints = DATES[0]!.hints;
    assert.equal(hints.length, 4);
    assert.equal(hints[0]!.kind, "image");
    if (hints[0]!.kind === "image") {
      assert.equal(hints[0].src, "/discovery/pisa-not-yet.png");
    }
    assert.equal(hints[1]!.kind, "image");
    if (hints[1]!.kind === "image") {
      assert.equal(hints[1].src, "/discovery/compass-east-20km.png");
    }
    assert.equal(hints[2]!.kind, "image");
    if (hints[2]!.kind === "image") {
      assert.equal(hints[2].src, "/discovery/gelato-cup.png");
    }
    assert.equal(hints[3]!.kind, "text");
    if (hints[3]!.kind === "text") {
      assert.equal(hints[3].text, "13-1-19-19-9-13-15");
    }
  });
});

describe("remainingUntil", () => {
  it("counts down and clamps at zero", () => {
    const start = baliWallTime(2026, 9, 18, 17, 30);
    const target = new Date(DATES[0]!.startsAt);
    const left = remainingUntil(start, target);
    assert.equal(left.days, 1);
    assert.equal(left.hours, 0);
    assert.equal(left.done, false);
    const after = remainingUntil(new Date(target.getTime() + 1000), target);
    assert.equal(after.done, true);
    assert.equal(after.days + after.hours + after.minutes + after.seconds, 0);
  });
});

describe("date instructions", () => {
  it("defaults to a 24-hour lead when no explicit unlock is set", () => {
    const saturday = DATES[0]!;
    assert.equal(saturday.instructions, undefined);
    const unlockAt = instructionsUnlockAt(saturday);
    assert.equal(unlockAt.toISOString(), baliWallTime(2026, 9, 18, 17, 30).toISOString());
    assert.equal(instructionsUnlockTimeZone(saturday), BALI_TIME_ZONE);
    assert.equal(instructionsUnlocked(saturday, baliWallTime(2026, 9, 18, 17, 29)), false);
    assert.equal(instructionsUnlocked(saturday, baliWallTime(2026, 9, 18, 17, 30)), true);
  });

  it("never unseals a declined date", () => {
    const duringWindow = baliWallTime(2026, 9, 18, 18);
    assert.equal(instructionsUnlocked(DATES[0]!, duringWindow, "rejected"), false);
    assert.equal(instructionsUnlocked(DATES[0]!, duringWindow, "accepted"), true);
  });

  it("keeps instructionParagraphs stable for letter-shaped copy", () => {
    const parts = instructionParagraphs("Hello.\n\nSecond paragraph.");
    assert.deepEqual(parts, ["Hello.", "Second paragraph."]);
    void MELBOURNE_TIME_ZONE;
  });
});
