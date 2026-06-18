"use client";
import { useState, useEffect } from "react";
import { Pin, RefreshCw, X, Loader2 } from "lucide-react";
import { ADOFeature, ADOStory, fetchStories } from "@/lib/ado";
import { PinnedFeature } from "@/lib/ado";
import { StateBadge } from "./StateBadge";
import { StoriesTable } from "./StoriesTable";
import clsx from "clsx";

interface PinnedCardProps {
  pinned: PinnedFeature;
  onRemove: (id: number) => void;
}

function PinnedCard({ pinned, onRemove }: PinnedCardProps) {
  const [open, setOpen] = useState(false);
  const [stories, setStories] = useState<ADOStory[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [featureState, setFeatureState] = useState<string>("");
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const s = await fetchStories(pinned.project, pinned.id);
      setStories(s);
    } catch { /* silently fail */ }
    setLoading(false);
    setLoaded(true);
  }

  async function refresh() {
    setRefreshing(true);
    try {
      const s = await fetchStories(pinned.project, pinned.id);
      setStories(s);
    } catch { /* silently fail */ }
    setRefreshing(false);
  }

  function handleToggle() {
    setOpen((o) => !o);
    if (!loaded) load();
  }

  return (
    <div className="rounded-xl border border-blue-200 bg-white shadow-sm ring-1 ring-blue-100 overflow-hidden">
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer bg-blue-50 hover:bg-blue-100 transition-colors"
        onClick={handleToggle}
      >
        <Pin size={13} className="text-blue-400 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-800 truncate">#{pinned.id} — {pinned.title}</p>
          <p className="text-xs text-gray-400 mt-0.5">{pinned.project}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {featureState && <StateBadge state={featureState} />}
          <button
            onClick={(e) => { e.stopPropagation(); refresh(); }}
            title="Refresh"
            className="p-1 rounded hover:bg-white text-gray-300 hover:text-gray-500 transition-colors"
          >
            <RefreshCw size={13} className={clsx(refreshing && "animate-spin")} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onRemove(pinned.id); }}
            title="Unpin"
            className="p-1 rounded hover:bg-white text-gray-300 hover:text-red-400 transition-colors"
          >
            <X size={13} />
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-blue-100">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-5 text-sm text-gray-400">
              <Loader2 size={15} className="animate-spin" /> Fetching stories…
            </div>
          ) : (
            <StoriesTable stories={stories} />
          )}
        </div>
      )}
    </div>
  );
}

interface Props {
  pinned: PinnedFeature[];
  onRemove: (id: number) => void;
}

export function PinnedSection({ pinned, onRemove }: Props) {
  if (!pinned.length) return null;

  return (
    <section className="mb-8">
      <div className="flex items-center gap-2 mb-3">
        <Pin size={14} className="text-blue-500" />
        <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">
          Pinned features ({pinned.length})
        </h2>
      </div>
      <div className="grid gap-3">
        {pinned.map((p) => (
          <PinnedCard key={p.id} pinned={p} onRemove={onRemove} />
        ))}
      </div>
    </section>
  );
}
