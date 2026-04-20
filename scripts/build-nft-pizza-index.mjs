#!/usr/bin/env node
/**
 * Scan all 432 minted Rare Pizzas for NFT traits and build
 * pizza-index.json entries for NFT class toppings (SKU 8700-8850).
 *
 * Uses viem to read from the Rare Pizzas contract on Ethereum mainnet.
 * Fetches metadata from IPFS with multiple gateway fallbacks.
 * Saves progress to avoid re-fetching on restart.
 */
import fs from "fs";
import path from "path";
import { createPublicClient, http, parseAbi } from "viem";
import { mainnet } from "viem/chains";

const CONTRACT = "0xe6616436ff001fe827e37c7fad100f531d0935f0";
const RPC = "https://ethereum-rpc.publicnode.com";

const IPFS_GATEWAYS = [
  "https://dweb.link/ipfs/",
  "https://cloudflare-ipfs.com/ipfs/",
  "https://ipfs.io/ipfs/",
];

const NFT_NAME_TO_SKU = {
  "Pizza Pop": 8700,
  "Blazed Cats": 8710,
  "Sewer Rat Social Club": 8720,
  "Bored Ape Yacht Club": 8730,
  "DeadHeads": 8740,
  "Strawberry.wtf": 8750,
  "RUG.WTF": 8760,
  "Non-Fungible Forks": 8770,
  "Long Neckie Ladies": 8780,
  "CryptoBeasts": 8790,
  "DeFi Friends": 8800,
  "Rainbow Rolls": 8810,
  "POAP": 8820,
  "Deebies": 8830,
  "0N1 Force": 8840,
  "Rare Pizzas Box": 8850,
};

// Variant SKU ranges for each base SKU
const VARIANT_RANGES = {
  8700: [8701, 8707],
  8710: [8711, 8717],
  8720: [8721, 8727],
  8730: [8731, 8737],
  8740: [8741, 8747],
  8750: [8751, 8757],
  8760: [8761, 8767],
  8770: [8771, 8779],
  8780: [8781, 8787],
  8790: [8791, 8797],
  8800: [8801, 8807],
  8810: [8811, 8817],
  8820: [8821, 8829],
  8830: [8831, 8837],
  8840: [8841, 8847],
  8850: [8851, 8858],
};

const PROGRESS_FILE = path.resolve("scripts/nft-pizza-progress.json");
const PIZZA_INDEX_FILE = path.resolve("src/data/pizza-index.json");

const abi = parseAbi([
  "function totalSupply() view returns (uint256)",
  "function tokenByIndex(uint256 index) view returns (uint256)",
  "function tokenURI(uint256 tokenId) view returns (string)",
]);

const client = createPublicClient({
  chain: mainnet,
  transport: http(RPC),
});

function loadProgress() {
  if (fs.existsSync(PROGRESS_FILE)) {
    return JSON.parse(fs.readFileSync(PROGRESS_FILE, "utf-8"));
  }
  return { tokenMetadata: {}, tokenIds: null };
}

function saveProgress(progress) {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

async function fetchIPFS(cid, retries = 3) {
  for (let attempt = 0; attempt < retries; attempt++) {
    for (const gateway of IPFS_GATEWAYS) {
      try {
        const url = `${gateway}${cid}`;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        const resp = await fetch(url, { signal: controller.signal });
        clearTimeout(timeout);
        if (resp.ok) {
          return await resp.json();
        }
      } catch {
        // Try next gateway
      }
    }
    // Wait before retrying all gateways
    if (attempt < retries - 1) {
      await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
    }
  }
  throw new Error(`Failed to fetch IPFS: ${cid}`);
}

// Simple concurrency limiter
async function mapConcurrent(items, fn, concurrency = 5) {
  const results = [];
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const i = index++;
      results[i] = await fn(items[i], i);
    }
  }

  const workers = [];
  for (let i = 0; i < Math.min(concurrency, items.length); i++) {
    workers.push(worker());
  }
  await Promise.all(workers);
  return results;
}

async function main() {
  const progress = loadProgress();

  // Step 1: Get all token IDs
  if (!progress.tokenIds) {
    console.log("Fetching total supply...");
    const totalSupply = await client.readContract({
      address: CONTRACT,
      abi,
      functionName: "totalSupply",
    });
    console.log(`Total supply: ${totalSupply}`);

    console.log("Fetching all token IDs...");
    const tokenIds = [];
    for (let i = 0n; i < totalSupply; i++) {
      const tokenId = await client.readContract({
        address: CONTRACT,
        abi,
        functionName: "tokenByIndex",
        args: [i],
      });
      tokenIds.push(Number(tokenId));
      if ((i + 1n) % 50n === 0n) {
        process.stderr.write(`  tokenByIndex: ${i + 1n}/${totalSupply}\n`);
      }
    }
    progress.tokenIds = tokenIds;
    saveProgress(progress);
    console.log(`Got ${tokenIds.length} token IDs`);
  } else {
    console.log(`Loaded ${progress.tokenIds.length} token IDs from progress`);
  }

  // Step 2: Fetch metadata for tokens we haven't fetched yet
  const toFetch = progress.tokenIds.filter(
    (id) => !progress.tokenMetadata[id]
  );
  console.log(
    `Need to fetch metadata for ${toFetch.length} tokens (${
      progress.tokenIds.length - toFetch.length
    } already cached)`
  );

  if (toFetch.length > 0) {
    // First get all tokenURIs
    console.log("Fetching tokenURIs...");
    const tokenURIs = {};
    for (const tokenId of toFetch) {
      if (progress.tokenMetadata[tokenId]?.uri) continue;
      try {
        const uri = await client.readContract({
          address: CONTRACT,
          abi,
          functionName: "tokenURI",
          args: [BigInt(tokenId)],
        });
        tokenURIs[tokenId] = uri;
      } catch (err) {
        console.error(`  Error getting tokenURI for ${tokenId}: ${err.message}`);
      }
    }
    console.log(`Got ${Object.keys(tokenURIs).length} tokenURIs`);

    // Fetch metadata from IPFS with concurrency limit
    const entries = Object.entries(tokenURIs);
    let fetched = 0;

    await mapConcurrent(
      entries,
      async ([tokenId, uri]) => {
        try {
          // Convert ipfs:// URI to CID
          const cid = uri.replace("ipfs://", "").replace(/^\//, "");
          const metadata = await fetchIPFS(cid);
          progress.tokenMetadata[tokenId] = {
            uri,
            attributes: metadata.attributes || [],
            name: metadata.name,
          };
          fetched++;
          if (fetched % 10 === 0) {
            process.stderr.write(
              `  IPFS fetch: ${fetched}/${entries.length}\n`
            );
            saveProgress(progress);
          }
        } catch (err) {
          console.error(
            `  Error fetching metadata for token ${tokenId}: ${err.message}`
          );
        }
      },
      5
    );

    saveProgress(progress);
    console.log(`Fetched metadata for ${fetched} tokens`);
  }

  // Step 3: Build NFT SKU -> tokenId mappings
  console.log("\nBuilding NFT pizza-index mappings...");
  const nftIndex = {}; // SKU -> Set of tokenIds

  for (const [tokenId, meta] of Object.entries(progress.tokenMetadata)) {
    if (!meta.attributes) continue;
    for (const attr of meta.attributes) {
      if (attr.trait_type === "NFT") {
        const baseSku = NFT_NAME_TO_SKU[attr.value];
        if (baseSku) {
          if (!nftIndex[baseSku]) nftIndex[baseSku] = new Set();
          nftIndex[baseSku].add(Number(tokenId));

          // Also add to all variant SKUs
          const [start, end] = VARIANT_RANGES[baseSku];
          for (let v = start; v <= end; v++) {
            if (!nftIndex[v]) nftIndex[v] = new Set();
            nftIndex[v].add(Number(tokenId));
          }
        } else {
          console.warn(`  Unknown NFT value: "${attr.value}" on token ${tokenId}`);
        }
      }
    }
  }

  // Convert sets to sorted arrays
  const nftIndexArrays = {};
  for (const [sku, tokenIds] of Object.entries(nftIndex)) {
    nftIndexArrays[sku] = [...tokenIds].sort((a, b) => a - b);
  }

  // Print summary
  console.log("\nNFT Pizza Index Summary:");
  for (const [name, sku] of Object.entries(NFT_NAME_TO_SKU)) {
    const count = nftIndexArrays[sku]?.length || 0;
    console.log(`  ${name} (${sku}): ${count} pizzas`);
  }

  // Step 4: Merge into existing pizza-index.json
  console.log("\nMerging into pizza-index.json...");
  const existingIndex = JSON.parse(fs.readFileSync(PIZZA_INDEX_FILE, "utf-8"));

  let newEntries = 0;
  for (const [sku, tokenIds] of Object.entries(nftIndexArrays)) {
    if (!existingIndex[sku]) {
      existingIndex[sku] = tokenIds;
      newEntries++;
    } else {
      // Merge, avoiding duplicates
      const existing = new Set(existingIndex[sku]);
      for (const id of tokenIds) {
        existing.add(id);
      }
      existingIndex[sku] = [...existing].sort((a, b) => a - b);
    }
  }

  // Sort the keys numerically before writing
  const sorted = {};
  for (const key of Object.keys(existingIndex).sort(
    (a, b) => Number(a) - Number(b)
  )) {
    sorted[key] = existingIndex[key];
  }

  fs.writeFileSync(PIZZA_INDEX_FILE, JSON.stringify(sorted, null, 2) + "\n");
  console.log(`Added ${newEntries} new SKU entries to pizza-index.json`);
  console.log("Done!");
}

main().catch(console.error);
