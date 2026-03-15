"use client";

type TxState =
  | { status: "idle" }
  | { status: "confirming" }
  | { status: "pending"; hash: `0x${string}` }
  | { status: "success"; hash: `0x${string}` }
  | { status: "error"; message: string };

function etherscanLink(hash: `0x${string}`) {
  return `https://etherscan.io/tx/${hash}`;
}

export default function TxStatus({ state }: { state: TxState }) {
  if (state.status === "idle") return null;

  return (
    <div className="mt-3 rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm">
      {state.status === "confirming" && (
        <p className="text-[#FFE135]">Confirm in wallet...</p>
      )}
      {state.status === "pending" && (
        <p className="text-[#7DD3E8]">
          Transaction pending...{" "}
          <a
            href={etherscanLink(state.hash)}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-white"
          >
            View on Etherscan
          </a>
        </p>
      )}
      {state.status === "success" && (
        <div className="text-green-400">
          <p>
            Transaction confirmed!{" "}
            <a
              href={etherscanLink(state.hash)}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-white"
            >
              View on Etherscan
            </a>
          </p>
          <p className="mt-1 text-white/50">
            It will take a few minutes for your box to be folded and delivered to your wallet.
          </p>
        </div>
      )}
      {state.status === "error" && (
        <p className="text-[#E85D5D]">{state.message}</p>
      )}
    </div>
  );
}

export type { TxState };
