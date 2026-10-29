// Why a request can't start a harvest, or null when it can. Spaces around
// the secret are ignored, since they easily come along when pasting it.
export function refusal(rawSecret, header) {
  const secret = rawSecret?.trim();
  if (!secret) return "CRON_SECRET isn't set for this deployment. Add it, then redeploy.";
  if (!header) return "the request had no Authorization header, so it didn't come from Vercel Cron.";
  if (header.trim() !== `Bearer ${secret}`) return "the Authorization header doesn't match CRON_SECRET. Redeploy after changing it.";
  return null;
}
