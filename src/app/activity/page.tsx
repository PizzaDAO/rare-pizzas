"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import EventTypeToggle from "@/components/activity/EventTypeToggle";
import ActivityList from "@/components/activity/ActivityList";
import type { ActivityEvent } from "@/components/activity/ActivityEventRow";

const PAGE_SIZE = 50;
const POLL_INTERVAL_MS = 30_000;

const COLLECTION_TABS = [
  { value: "", label: "All" },
  { value: "rare-pizzas-box", label: "Box" },
  { value: "rare-pizzas", label: "Pizza" },
  { value: "neo-bambinos-pizza-sticks-and-sauce", label: "Sticks" },
];

function ActivityPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [activeTypes, setActiveTypes] = useState<string[]>(() =>
    (searchParams.get("types") || "mint,sale").split(",").filter(Boolean)
  );
  const [collection, setCollection] = useState(
    () => searchParams.get("collection") || ""
  );
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(
    () => Number(searchParams.get("page") || 1) * PAGE_SIZE - PAGE_SIZE
  );

  const fetchActivity = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("types", activeTypes.join(","));
      if (collection) params.set("collection", collection);
      params.set("limit", String(PAGE_SIZE));
      params.set("offset", String(offset));

      const res = await fetch(`/api/activity?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch");

      const data = await res.json();
      setEvents(data.events || []);
      setTotal(data.total || 0);
    } catch {
      if (!silent) {
        setEvents([]);
        setTotal(0);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [activeTypes, collection, offset]);

  useEffect(() => {
    fetchActivity();
  }, [fetchActivity]);

  // Auto-refresh every 30s on page 1
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (offset === 0) {
      pollRef.current = setInterval(() => fetchActivity(true), POLL_INTERVAL_MS);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchActivity, offset]);

  // Reset offset when filters change
  useEffect(() => {
    setOffset(0);
  }, [activeTypes, collection]);

  // Update URL params
  useEffect(() => {
    const params = new URLSearchParams();
    params.set("types", activeTypes.join(","));
    if (collection) params.set("collection", collection);
    const page = Math.floor(offset / PAGE_SIZE) + 1;
    if (page > 1) params.set("page", String(page));
    router.replace(`/activity?${params.toString()}`, { scroll: false });
  }, [activeTypes, collection, offset, router]);

  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div>
      {/* Header */}
      <section className="mb-8 text-center">
        <h1 className="mb-4 text-4xl font-bold tracking-tight text-white sm:text-5xl">
          Activity
        </h1>
        <p className="mx-auto max-w-2xl text-lg text-[#7DD3E8]">
          Recent mints, sales, and transfers across all Rare Pizzas collections.
        </p>
      </section>

      {/* Event type toggles */}
      <div className="mb-4 flex justify-center">
        <EventTypeToggle activeTypes={activeTypes} onChange={setActiveTypes} />
      </div>

      {/* Collection tabs */}
      <div className="mb-6 flex justify-center gap-2">
        {COLLECTION_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setCollection(tab.value)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              collection === tab.value
                ? "bg-[#FFE135] text-black"
                : "border border-[#333] text-[#7DD3E8] hover:border-[#FFE135]/50"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Results count */}
      {!loading && total > 0 && (
        <p className="mb-4 flex items-center gap-2 text-sm text-[#7DD3E8]">
          <span>
            Showing {events.length} of {total.toLocaleString()} event
            {total !== 1 ? "s" : ""}
          </span>
          {offset === 0 && (
            <span className="flex items-center gap-1 text-xs text-[#555]">
              <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-green-400" />
              Live
            </span>
          )}
        </p>
      )}

      {/* Activity list */}
      <ActivityList events={events} loading={loading} />

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-4">
          <button
            onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            disabled={offset === 0}
            className="rounded-lg border border-[#333] bg-[#111] px-4 py-2 text-sm text-[#7DD3E8] transition-colors hover:border-[#FFE135]/50 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
          >
            Previous
          </button>
          <span className="text-sm text-[#555]">
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() =>
              setOffset(
                Math.min((totalPages - 1) * PAGE_SIZE, offset + PAGE_SIZE)
              )
            }
            disabled={currentPage >= totalPages}
            className="rounded-lg border border-[#333] bg-[#111] px-4 py-2 text-sm text-[#7DD3E8] transition-colors hover:border-[#FFE135]/50 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

export default function ActivityPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#FFE135] border-t-transparent" />
        </div>
      }
    >
      <ActivityPageInner />
    </Suspense>
  );
}
