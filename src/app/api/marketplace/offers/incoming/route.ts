import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { offers } from "@/db/schema";
import { eq, and, or, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * POST /api/marketplace/offers/incoming
 *
 * Find active offers for tokens owned by the caller.
 *
 * Body: {
 *   tokens: Array<{ tokenContract: string; tokenId: string; chainId: number }>
 * }
 */
export async function POST(request: NextRequest) {
  let db;
  try {
    db = getDb();
  } catch {
    return NextResponse.json({ offers: [] });
  }

  try {
    const body = await request.json();
    const { tokens } = body;

    if (!tokens || !Array.isArray(tokens) || tokens.length === 0) {
      return NextResponse.json({ offers: [] });
    }

    // Cap at 200 tokens to prevent abuse
    const capped = tokens.slice(0, 200);

    // Build OR conditions for each token
    const tokenConditions = capped.map((t: { tokenContract: string; tokenId: string; chainId: number }) =>
      and(
        eq(offers.tokenContract, t.tokenContract.toLowerCase()),
        eq(offers.tokenId, t.tokenId),
        eq(offers.chainId, t.chainId)
      )
    );

    const results = await db
      .select()
      .from(offers)
      .where(
        and(
          eq(offers.status, "active"),
          or(...tokenConditions)
        )
      )
      .orderBy(desc(offers.createdAt))
      .limit(100);

    return NextResponse.json({ offers: results });
  } catch (error) {
    console.error("Error fetching incoming offers:", error);
    return NextResponse.json(
      { error: "Failed to fetch incoming offers" },
      { status: 500 }
    );
  }
}
