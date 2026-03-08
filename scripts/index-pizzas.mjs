#!/usr/bin/env node
/**
 * index-pizzas.mjs
 *
 * Fetches all Rare Pizza NFT metadata from on-chain + IPFS,
 * downloads & caches 200×200 webp thumbnails, and builds
 * a topping-SKU → tokenId[] index for the front-end.
 */

import { createPublicClient, http } from "viem";
import { mainnet } from "viem/chains";
import sharp from "sharp";
import { createRequire } from "module";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PIZZAS_DIR = path.join(ROOT, "public", "pizzas");
const INDEX_OUT = path.join(ROOT, "src", "data", "pizza-index.json");
const TOPPINGS_PATH = path.join(ROOT, "src", "data", "toppings.json");

// Ensure output dirs exist
fs.mkdirSync(PIZZAS_DIR, { recursive: true });
fs.mkdirSync(path.dirname(INDEX_OUT), { recursive: true });

// ---------------------------------------------------------------------------
// Toppings data & matching logic (mirrors src/lib/toppings.ts)
// ---------------------------------------------------------------------------

const toppingsData = JSON.parse(fs.readFileSync(TOPPINGS_PATH, "utf-8"));

const EXCLUDED_TRAIT_TYPES = new Set(["Pizza Recipe", "Box", "Paper"]);

// Build lookup map: "class:name" (lowered) → topping
const toppingLookup = new Map();
for (const t of toppingsData) {
  const key = `${t.class.toLowerCase().trim()}:${t.name.toLowerCase().trim()}`;
  toppingLookup.set(key, t);
}

function matchTopping(attribute) {
  if (EXCLUDED_TRAIT_TYPES.has(attribute.trait_type)) return null;

  const className = attribute.trait_type;
  const name = attribute.value;

  // Tier 1: exact normalized match
  const exactKey = `${className.toLowerCase().trim()}:${name.toLowerCase().trim()}`;
  const exact = toppingLookup.get(exactKey);
  if (exact) return exact;

  // Tier 2: partial / contains within same class
  const lowerName = name.toLowerCase().trim();
  for (const t of toppingsData) {
    if (t.class.toLowerCase() !== className.toLowerCase()) continue;
    const tName = t.name.toLowerCase();
    if (tName.includes(lowerName) || lowerName.includes(tName)) {
      return t;
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Contract setup
// ---------------------------------------------------------------------------

const CONTRACT = "0xe6616436ff001fe827e37c7fad100f531d0935f0";

const ABI = [
  {
    inputs: [],
    name: "totalSupply",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "index", type: "uint256" }],
    name: "tokenByIndex",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "tokenId", type: "uint256" }],
    name: "tokenURI",
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
];

const client = createPublicClient({
  chain: mainnet,
  transport: http("https://ethereum-rpc.publicnode.com"),
});

// ---------------------------------------------------------------------------
// IPFS helpers
// ---------------------------------------------------------------------------

const GATEWAYS = [
  "https://dweb.link/ipfs/",
  "https://cloudflare-ipfs.com/ipfs/",
  "https://ipfs.io/ipfs/",
];

function ipfsToHttp(ipfsUri, gateway) {
  if (ipfsUri.startsWith("ipfs://")) {
    return gateway + ipfsUri.slice(7);
  }
  if (ipfsUri.startsWith("/ipfs/")) {
    return gateway + ipfsUri.slice(6);
  }
  return ipfsUri; // already http
}

async function fetchWithRetry(ipfsUri, { json = false, maxRetries = 3 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    for (const gw of GATEWAYS) {
      const url = ipfsToHttp(ipfsUri, gw);
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30_000);
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeout);
        if (!res.ok) {
          lastErr = new Error(`HTTP ${res.status} from ${url}`);
          continue;
        }
        if (json) return await res.json();
        return Buffer.from(await res.arrayBuffer());
      } catch (err) {
        lastErr = err;
      }
    }
  }
  throw lastErr;
}

// ---------------------------------------------------------------------------
// Concurrency limiter
// ---------------------------------------------------------------------------

function pLimit(concurrency) {
  let active = 0;
  const queue = [];

  function next() {
    if (active >= concurrency || queue.length === 0) return;
    active++;
    const { fn, resolve, reject } = queue.shift();
    fn().then(resolve, reject).finally(() => {
      active--;
      next();
    });
  }

  return function run(fn) {
    return new Promise((resolve, reject) => {
      queue.push({ fn, resolve, reject });
      next();
    });
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const log = (msg) => process.stderr.write(`${msg}\n`);

  // 1. Get total supply
  log("[1/6] Fetching totalSupply...");
  const totalSupply = await client.readContract({
    address: CONTRACT,
    abi: ABI,
    functionName: "totalSupply",
  });
  const count = Number(totalSupply);
  log(`  Total supply: ${count}`);

  // 2. Get all token IDs via tokenByIndex (batched multicall)
  log("[2/6] Fetching token IDs via tokenByIndex multicall...");
  const BATCH_SIZE = 100;
  const tokenIds = [];

  for (let i = 0; i < count; i += BATCH_SIZE) {
    const batchEnd = Math.min(i + BATCH_SIZE, count);
    const calls = [];
    for (let j = i; j < batchEnd; j++) {
      calls.push({
        address: CONTRACT,
        abi: ABI,
        functionName: "tokenByIndex",
        args: [BigInt(j)],
      });
    }
    const results = await client.multicall({ contracts: calls });
    for (const r of results) {
      if (r.status === "success") {
        tokenIds.push(Number(r.result));
      } else {
        log(`  WARN: tokenByIndex failed for an index`);
      }
    }
    log(`  Fetched token IDs: ${tokenIds.length}/${count}`);
  }

  // 3. Get all tokenURIs (batched multicall)
  log("[3/6] Fetching tokenURIs via multicall...");
  const tokenURIs = new Map(); // tokenId → uri

  for (let i = 0; i < tokenIds.length; i += BATCH_SIZE) {
    const batch = tokenIds.slice(i, i + BATCH_SIZE);
    const calls = batch.map((id) => ({
      address: CONTRACT,
      abi: ABI,
      functionName: "tokenURI",
      args: [BigInt(id)],
    }));
    const results = await client.multicall({ contracts: calls });
    for (let j = 0; j < batch.length; j++) {
      const r = results[j];
      if (r.status === "success") {
        tokenURIs.set(batch[j], r.result);
      } else {
        log(`  WARN: tokenURI failed for token ${batch[j]}`);
      }
    }
    log(`  Fetched URIs: ${Math.min(i + BATCH_SIZE, tokenIds.length)}/${tokenIds.length}`);
  }

  // 4. Fetch metadata + download images from IPFS
  log("[4/6] Fetching metadata & downloading images from IPFS...");
  const limit = pLimit(5); // 5 concurrent
  const index = {}; // sku → tokenId[]
  let completed = 0;
  let failed = 0;

  const tasks = tokenIds.map((tokenId) =>
    limit(async () => {
      const uri = tokenURIs.get(tokenId);
      if (!uri) {
        completed++;
        failed++;
        return;
      }

      try {
        // Fetch metadata
        const metadata = await fetchWithRetry(uri, { json: true });

        // Match toppings from attributes
        if (metadata.attributes && Array.isArray(metadata.attributes)) {
          for (const attr of metadata.attributes) {
            const topping = matchTopping(attr);
            if (topping) {
              if (!index[topping.sku]) index[topping.sku] = [];
              if (!index[topping.sku].includes(tokenId)) {
                index[topping.sku].push(tokenId);
              }
            }
          }
        }

        // Download image (skip if already exists)
        const thumbPath = path.join(PIZZAS_DIR, `${tokenId}.webp`);
        if (!fs.existsSync(thumbPath)) {
          if (metadata.image) {
            const imgBuf = await fetchWithRetry(metadata.image);
            await sharp(imgBuf)
              .resize(200, 200, { fit: "cover" })
              .webp({ quality: 80 })
              .toFile(thumbPath);
          } else {
            log(`  WARN: No image field for token ${tokenId}`);
          }
        }
      } catch (err) {
        log(`  FAIL: token ${tokenId}: ${err.message}`);
        failed++;
      }

      completed++;
      if (completed % 20 === 0 || completed === tokenIds.length) {
        log(`  Progress: ${completed}/${tokenIds.length} (${failed} failed)`);
      }
    })
  );

  await Promise.all(tasks);

  // 5. Sort token IDs within each SKU
  log("[5/6] Sorting index...");
  for (const sku of Object.keys(index)) {
    index[sku].sort((a, b) => a - b);
  }

  // 6. Write index
  log("[6/6] Writing pizza-index.json...");
  fs.writeFileSync(INDEX_OUT, JSON.stringify(index, null, 2) + "\n");

  log(`\nDone! Indexed ${Object.keys(index).length} toppings across ${count} pizzas.`);
  log(`  Images saved to: ${PIZZAS_DIR}`);
  log(`  Index saved to:  ${INDEX_OUT}`);
  if (failed > 0) {
    log(`  ${failed} tokens had errors (logged above).`);
  }
}

main().catch((err) => {
  process.stderr.write(`Fatal error: ${err.message}\n`);
  process.exit(1);
});
