import { describe, expect, it } from "vitest";
import { assessSeller } from "@/lib/seller";

const settings = { sellerMinFeedback: 50, sellerMinPositive: 98 };
const rate = (feedbackScore, feedbackPercentage) =>
  assessSeller({ feedbackScore, feedbackPercentage }, settings);

describe("assessSeller", () => {
  it("trusts established sellers", () => {
    expect(rate(2400, 99.8)).toEqual({ level: "trusted", reasons: [] });
  });

  it("flags thin or slightly poor feedback for caution", () => {
    expect(rate(23, 100)).toEqual({ level: "caution", reasons: ["Only 23 feedback"] });
    expect(rate(800, 96.5).level).toBe("caution");
  });

  it("marks very new or poorly rated sellers as risky", () => {
    expect(rate(4, 100).level).toBe("risky");
    expect(rate(30, 93)).toEqual({ level: "risky", reasons: ["Only 30 feedback", "93% positive"] });
  });

  it("is cautious when eBay shares no feedback", () => {
    expect(assessSeller(null, settings).level).toBe("caution");
    expect(rate(null, null).level).toBe("caution");
  });
});
