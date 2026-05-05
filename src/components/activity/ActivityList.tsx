"use client";

import ActivityEventRow, { type ActivityEvent } from "./ActivityEventRow";

interface ActivityListProps {
  events: ActivityEvent[];
  loading: boolean;
}

export default function ActivityList({ events, loading }: ActivityListProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#FFE135] border-t-transparent" />
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="rounded-lg border border-[#222] bg-[#111] px-6 py-16 text-center">
        <p className="text-[#555]">
          No activity found for the selected filters.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {events.map((event) => (
        <ActivityEventRow key={event.id} event={event} />
      ))}
    </div>
  );
}
