import type { VercelRequest, VercelResponse } from "@vercel/node";
import { kv } from "@vercel/kv";

interface RecentEntry {
  tokenId: number;
  tweetedAt: string;
}

const KV_KEY = "recently-tweeted";
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Validate body
  const { tokenId } = req.body ?? {};
  if (typeof tokenId !== "number" || !Number.isFinite(tokenId) || tokenId < 0) {
    return res.status(400).json({ error: "Invalid or missing tokenId" });
  }

  try {
    // Read current list from KV
    let entries: RecentEntry[] = (await kv.get<RecentEntry[]>(KV_KEY)) ?? [];

    // Prune entries older than 30 days
    const cutoff = Date.now() - THIRTY_DAYS_MS;
    entries = entries.filter(
      (e) => new Date(e.tweetedAt).getTime() > cutoff
    );

    // Append new entry
    entries.push({ tokenId, tweetedAt: new Date().toISOString() });

    // Write back
    await kv.set(KV_KEY, entries);

    return res.status(200).json({
      success: true,
      message: `Pizza #${tokenId} marked as posted`,
    });
  } catch (err) {
    // If KV is not configured, return a graceful error
    const message =
      err instanceof Error ? err.message : "Unknown error";
    if (
      message.includes("REDIS") ||
      message.includes("KV") ||
      message.includes("ERR_ENV") ||
      message.includes("missing") ||
      message.includes("undefined")
    ) {
      return res.status(503).json({
        error: "KV store not configured. Set KV_REST_API_URL and KV_REST_API_TOKEN.",
      });
    }
    return res.status(500).json({ error: message });
  }
}
