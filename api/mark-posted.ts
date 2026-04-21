import type { VercelRequest, VercelResponse } from "@vercel/node";
import { put, list } from "@vercel/blob";

interface RecentEntry {
  tokenId: number;
  tweetedAt: string;
}

const BLOB_PATH = "recently-tweeted.json";
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

async function readEntries(): Promise<RecentEntry[]> {
  const { blobs } = await list({ prefix: "recently-tweeted" });
  const existing = blobs.find((b) => b.pathname === BLOB_PATH);
  if (!existing) return [];
  const res = await fetch(existing.url);
  return (await res.json()) as RecentEntry[];
}

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
    // Read current list from Blob storage
    let entries = await readEntries();

    // Prune entries older than 30 days
    const cutoff = Date.now() - THIRTY_DAYS_MS;
    entries = entries.filter(
      (e) => new Date(e.tweetedAt).getTime() > cutoff
    );

    // Append new entry
    entries.push({ tokenId, tweetedAt: new Date().toISOString() });

    // Write back
    await put(BLOB_PATH, JSON.stringify(entries), {
      access: "public",
      addRandomSuffix: false,
    });

    return res.status(200).json({
      success: true,
      message: `Pizza #${tokenId} marked as posted`,
    });
  } catch (err) {
    // If Blob store is not configured, return a graceful error
    const message =
      err instanceof Error ? err.message : "Unknown error";
    if (
      message.includes("BLOB") ||
      message.includes("token") ||
      message.includes("missing") ||
      message.includes("undefined") ||
      message.includes("unauthorized")
    ) {
      return res.status(503).json({
        error: "Blob store not configured. Set BLOB_READ_WRITE_TOKEN env var.",
      });
    }
    return res.status(500).json({ error: message });
  }
}
