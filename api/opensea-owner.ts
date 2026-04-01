import type { VercelRequest, VercelResponse } from "@vercel/node";

const CONTRACT = "0xe6616436ff001fe827e37c7fad100f531d0935f0";
const OPENSEA_API = "https://api.opensea.io/api/v2";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { tokenId } = req.query;
  const id = Array.isArray(tokenId) ? tokenId[0] : tokenId;

  if (!id || !/^\d+$/.test(id)) {
    return res.status(400).json({ error: "tokenId must be a positive integer" });
  }

  const apiKey = process.env.OPENSEA_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "OPENSEA_API_KEY not configured" });
  }

  const headers = { accept: "application/json", "x-api-key": apiKey };

  try {
    // Step 1: Get NFT details (includes owner address)
    const nftRes = await fetch(
      `${OPENSEA_API}/chain/ethereum/contract/${CONTRACT}/nfts/${id}`,
      { headers }
    );

    if (!nftRes.ok) {
      const status = nftRes.status;
      if (status === 404) {
        return res.status(404).json({ error: "Token not found" });
      }
      throw new Error(`OpenSea NFT endpoint returned ${status}`);
    }

    const nftData = await nftRes.json();
    const ownerAddress: string | null =
      nftData.nft?.owners?.[0]?.address ?? null;

    if (!ownerAddress) {
      res.setHeader("Cache-Control", "public, s-maxage=300");
      return res.status(200).json({
        ownerAddress: null,
        twitter: null,
        username: null,
      });
    }

    // Step 2: Get account profile (includes twitter_username)
    const accountRes = await fetch(`${OPENSEA_API}/accounts/${ownerAddress}`, {
      headers,
    });

    let twitter: string | null = null;
    let username: string | null = null;

    if (accountRes.ok) {
      const accountData = await accountRes.json();
      twitter = accountData.social_media_accounts?.find(
        (a: { platform: string; username: string }) => a.platform === "twitter"
      )?.username ?? accountData.twitter_username ?? null;
      username = accountData.username ?? null;
    }

    res.setHeader("Cache-Control", "public, s-maxage=300");
    return res.status(200).json({ ownerAddress, twitter, username });
  } catch (err) {
    console.error("OpenSea lookup failed:", err);
    return res
      .status(502)
      .json({ error: "Failed to fetch from OpenSea" });
  }
}
