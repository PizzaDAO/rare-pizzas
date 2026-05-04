import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Batch-fetch NFT metadata via Alchemy (up to 100 tokens per call).
 * Replaces unreliable direct IPFS fetches from the client.
 *
 * POST /api/nft-metadata
 * Body: { tokens: [{ contractAddress, tokenId }] }
 * Returns: { results: [{ tokenId, metadata, image }] }
 */
export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.ALCHEMY_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "ALCHEMY_API_KEY not configured" },
        { status: 500 }
      );
    }

    const body = await request.json();
    const tokens: { contractAddress: string; tokenId: string }[] =
      body.tokens || [];

    if (tokens.length === 0) {
      return NextResponse.json({ results: [] });
    }

    if (tokens.length > 100) {
      return NextResponse.json(
        { error: "Maximum 100 tokens per request" },
        { status: 400 }
      );
    }

    const base = `https://eth-mainnet.g.alchemy.com/nft/v3/${apiKey}`;
    const res = await fetch(`${base}/getNFTMetadataBatch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tokens }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("[nft-metadata] Alchemy error:", res.status, text);
      return NextResponse.json(
        { error: "Alchemy API error" },
        { status: 502 }
      );
    }

    const data = await res.json();
    const nfts = data.nfts || data;

    const results = nfts.map(
      (nft: {
        tokenId: string;
        image?: { cachedUrl?: string; originalUrl?: string };
        raw?: {
          metadata?: {
            name?: string;
            description?: string;
            image?: string;
            attributes?: { trait_type: string; value: string }[];
          };
        };
      }) => ({
        tokenId: nft.tokenId,
        metadata: {
          name: nft.raw?.metadata?.name || null,
          description: nft.raw?.metadata?.description || null,
          image:
            nft.image?.cachedUrl ||
            nft.image?.originalUrl ||
            nft.raw?.metadata?.image ||
            null,
          attributes: nft.raw?.metadata?.attributes || [],
        },
      })
    );

    return NextResponse.json(
      { results },
      {
        headers: {
          "Cache-Control": "public, s-maxage=3600",
        },
      }
    );
  } catch (error) {
    console.error("[nft-metadata] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch metadata" },
      { status: 500 }
    );
  }
}
