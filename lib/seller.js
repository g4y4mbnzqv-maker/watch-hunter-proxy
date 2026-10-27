// Below these a seller is risky whatever the settings say
const RISKY_FEEDBACK = 10;
const RISKY_POSITIVE = 95;

// Rates a seller as "trusted", "caution" or "risky" from their eBay feedback.
// settings.sellerMinFeedback and settings.sellerMinPositive set where caution
// starts. Returns { level, reasons }.
export function assessSeller(seller, settings) {
  if (!seller || seller.feedbackScore === null) {
    return { level: "caution", reasons: ["eBay didn't share this seller's feedback"] };
  }

  const reasons = [];
  let level = "trusted";

  const raise = (next, reason) => {
    if (next === "risky" || level === "trusted") level = next;
    reasons.push(reason);
  };

  const { feedbackScore, feedbackPercentage } = seller;

  if (feedbackScore < RISKY_FEEDBACK) {
    raise("risky", `Only ${feedbackScore} feedback`);
  } else if (feedbackScore < settings.sellerMinFeedback) {
    raise("caution", `Only ${feedbackScore} feedback`);
  }

  if (feedbackPercentage !== null) {
    if (feedbackPercentage < RISKY_POSITIVE) {
      raise("risky", `${feedbackPercentage}% positive`);
    } else if (feedbackPercentage < settings.sellerMinPositive) {
      raise("caution", `${feedbackPercentage}% positive`);
    }
  }

  return { level, reasons };
}
