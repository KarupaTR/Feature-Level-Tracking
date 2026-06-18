"use client";
import { useState } from "react";
import { ChevronDown, Pin, PinOff, Loader2 } from "lucide-react";
import clsx from "clsx";
import { ADOFeature, ADOStory, fetchStories } from "@/lib/ado";
import { StateBadge } from "./StateBadge";
import { StoriesTable } from "./StoriesTable";

interface Props {
  feature: ADOFeature;
  project: string;
  isPinned: boolean;
  onTogglePin: (f: ADOFeature) => void;
}

export function FeatureCard({ feature, project, isPinned, onTogglePin }: Props) {
  const [open, setOpen] = useState(false);
  const [stories, setStories] = useState<ADOStory[]>(feature.stories ?? []);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(!!feature.stories);

  async function handleToggle() {
    setOpen((o) => !o);
    if (!loaded) {
      setLoading(true);
      try {
        const s = await fetchStories(project, feature.id);
        setStories(s);
      } catch { /* silently fail */ }
      setLoading(false);
      setLoaded(true);
    }
  }

  return (
    <div className={clsx(
      "rounded-xl border bg-white overflow-hidden shadow-sm",
      isPinned ? "border-blue-300 ring-1 ring-blue-200" : "border-gray-200"
    )}>
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors"
        onClick={handleToggle}
      >
        <ChevronDown
          size={16}
          className={clsx("text-gray-400 flex-shrink-0 transition-transform", open && "rotate-180")}
        />
        <span className="text-sm font-medium text-gray-700 flex-1 truncate min-w-0">
          #{feature.id} — {feature.title}
        </span>
        <div className="flex items-center gap-2 flex-shrink-0">
          <StateBadge state={feature.state} />
          <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">
            {stories.length} {stories.length === 1 ? "story" : "stories"}
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); onTogglePin(feature); }}
            title={isPinned ? "Unpin feature" : "Pin feature"}
            className={clsx(
              "p-1 rounded hover:bg-white transition-colors",
              isPinned ? "text-blue-500" : "text-gray-300 hover:text-gray-500"
            )}
          >
            {isPinned ? <PinOff size={14} /> : <Pin size={14} />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-gray-100">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-6 text-sm text-gray-400">
              <Loader2 size={16} className="animate-spin" /> Loading stories…
            </div>
          ) : (
            <StoriesTable stories={stories} />
          )}
        </div>
      )}
    </div>
  );
}
