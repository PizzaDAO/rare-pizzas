import type { VercelRequest, VercelResponse } from "@vercel/node";

const CONTRACT = "0xe6616436ff001fe827e37c7fad100f531d0935f0";
const OPENSEA_API = "https://api.opensea.io/api/v2";
const MAX_TOKEN_ID = 9999;
const MAX_ATTEMPTS = 10;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.OPENSEA_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "OPENSEA_API_KEY not configured" });
  }

  const headers = { accept: "application/json", "x-api-key": apiKey };

  let lastResult = { tokenId: 0, ownerAddress: null as string | null, twitter: null as string | null, username: null as string | null };

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const tokenId = Math.floor(Math.random() * (MAX_TOKEN_ID + 1));
    lastResult.tokenId = tokenId;

    try {
      // Get NFT owner
      const nftRes = await fetch(
        `${OPENSEA_API}/chain/ethereum/contract/${CONTRACT}/nfts/${tokenId}`,
        { headers }
      );

      if (!nftRes.ok) continue;

      const nftData = await nftRes.json();
      const ownerAddress: string | null = nftData.nft?.owners?.[0]?.address ?? null;
      lastResult.ownerAddress = ownerAddress;

      if (!ownerAddress) continue;

      // Get account profile
      const accountRes = await fetch(`${OPENSEA_API}/accounts/${ownerAddress}`, { headers });

      if (!accountRes.ok) continue;

      const accountData = await accountRes.json();
      const twitter = accountData.social_media_accounts?.find(
        (a: { platform: string; username: string }) => a.platform === "twitter"
      )?.username ?? accountData.twitter_username ?? null;
      const username = accountData.username ?? null;

      lastResult.twitter = twitter;
      lastResult.username = username;

      if (twitter) {
        // Found one with X linked - return immediately
        res.setHeader("Cache-Control", "public, s-maxage=0");
        return res.status(200).json({ tokenId, ownerAddress, twitter, username });
      }
    } catch {
      // OpenSea error on this attempt, try next
      continue;
    }
  }

  // All attempts exhausted - return last result anyway
  res.setHeader("Cache-Control", "public, s-maxage=0");
  return res.status(200).json(lastResult);
}
