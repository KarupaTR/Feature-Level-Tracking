"use client";
import { useState, useEffect, useCallback } from "react";
import { Search, RefreshCw, LayoutDashboard, Loader2, Filter } from "lucide-react";
import clsx from "clsx";
import { ADO_PROJECTS } from "@/lib/projects";
import { ADOFeature, PinnedFeature, fetchFeatures } from "@/lib/ado";
import { FeatureCard } from "./FeatureCard";
import { PinnedSection } from "./PinnedSection";

const PINNED_KEY = "ado_pinned_features";

function usePinned() {
  const [pinned, setPinned] = useState<PinnedFeature[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(PINNED_KEY);
      if (raw) setPinned(JSON.parse(raw));
    } catch { /* ignore */ }
  }, []);

  function save(next: PinnedFeature[]) {
    setPinned(next);
    try { localStorage.setItem(PINNED_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  }

  function toggle(feature: ADOFeature, project: string) {
    const exists = pinned.find((p) => p.id === feature.id);
    if (exists) {
      save(pinned.filter((p) => p.id !== feature.id));
    } else {
      save([...pinned, { id: feature.id, title: feature.title, project, pinnedAt: new Date().toISOString() }]);
    }
  }

  function remove(id: number) {
    save(pinned.filter((p) => p.id !== id));
  }

  return { pinned, toggle, remove };
}

export function Dashboard() {
  const [project, setProject] = useState("");
  const [featureHint, setFeatureHint] = useState("");
  const [features, setFeatures] = useState<ADOFeature[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState("");
  const { pinned, toggle, remove } = usePinned();

  const load = useCallback(async () => {
    if (!project) { setError("Please select a project."); return; }
    setError("");
    setLoading(true);
    setFeatures([]);
    try {
      const data = await fetchFeatures(project, featureHint || undefined);
      setFeatures(data);
      if (!data.length) setError("No features found. Try a different project or filter.");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load features.");
    }
    setLoading(false);
  }, [project, featureHint]);

  const filtered = features.filter((f) => {
    if (stateFilter && f.state !== stateFilter) return false;
    if (assigneeFilter && !f.assignedTo?.includes(assigneeFilter)) return false;
    return true;
  });

  const allAssignees = Array.from(new Set(features.map((f) => f.assignedTo).filter(Boolean)));

  const stats = {
    total: features.length,
    active: features.filter((f) => f.state === "Active").length,
    resolved: features.filter((f) => f.state === "Resolved").length,
    closed: features.filter((f) => f.state === "Closed").length,
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3 flex-wrap">
          <LayoutDashboard size={20} className="text-blue-600 flex-shrink-0" />
          <h1 className="text-lg font-semibold text-gray-900 flex-shrink-0">ADO Feature Dashboard</h1>

          <div className="flex items-center gap-2 flex-1 flex-wrap">
            {/* Project dropdown */}
            <select
              value={project}
              onChange={(e) => setProject(e.target.value)}
              className="h-9 px-3 text-sm border border-gray-200 rounded-lg bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[200px] flex-1 max-w-xs"
            >
              <option value="">— Select project —</option>
              {ADO_PROJECTS.map((p) => (
                <option key={p.name} value={p.name}>{p.name}</option>
              ))}
            </select>

            {/* Feature filter */}
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-300" />
              <input
                type="text"
                placeholder="Feature name or ID…"
                value={featureHint}
                onChange={(e) => setFeatureHint(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && load()}
                className="h-9 pl-7 pr-3 text-sm border border-gray-200 rounded-lg bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 w-48"
              />
            </div>

            <button
              onClick={load}
              disabled={loading}
              className="h-9 px-4 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5 flex-shrink-0 transition-colors"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              Load
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* Pinned section — always visible */}
        <PinnedSection pinned={pinned} onRemove={remove} />

        {/* Error */}
        {error && (
          <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
            {error}
          </div>
        )}

        {/* Stats */}
        {features.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {[
              { label: "Features", val: stats.total, color: "text-gray-900" },
              { label: "Active", val: stats.active, color: "text-green-700" },
              { label: "Resolved", val: stats.resolved, color: "text-amber-700" },
              { label: "Closed", val: stats.closed, color: "text-gray-500" },
            ].map((s) => (
              <div key={s.label} className="bg-white rounded-xl border border-gray-200 px-4 py-3 shadow-sm">
                <p className="text-xs text-gray-400 mb-1">{s.label}</p>
                <p className={clsx("text-2xl font-semibold", s.color)}>{s.val}</p>
              </div>
            ))}
          </div>
        )}

        {/* Filters */}
        {features.length > 0 && (
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <Filter size={13} className="text-gray-400" />
            <select
              value={stateFilter}
              onChange={(e) => setStateFilter(e.target.value)}
              className="h-8 px-2 text-xs border border-gray-200 rounded-lg bg-white text-gray-600 focus:outline-none"
            >
              <option value="">All states</option>
              {["New", "Active", "Resolved", "Closed"].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            {allAssignees.length > 0 && (
              <select
                value={assigneeFilter}
                onChange={(e) => setAssigneeFilter(e.target.value)}
                className="h-8 px-2 text-xs border border-gray-200 rounded-lg bg-white text-gray-600 focus:outline-none"
              >
                <option value="">All assignees</option>
                {allAssignees.map((a) => (
                  <option key={a} value={a}>
                    {a.replace(/<[^>]+>/g, "").split(" ").slice(0, 2).join(" ")}
                  </option>
                ))}
              </select>
            )}
            {(stateFilter || assigneeFilter) && (
              <button
                onClick={() => { setStateFilter(""); setAssigneeFilter(""); }}
                className="text-xs text-blue-500 hover:underline"
              >
                Clear filters
              </button>
            )}
            <span className="text-xs text-gray-400 ml-auto">
              {filtered.length} of {features.length} features
            </span>
          </div>
        )}

        {/* Feature list */}
        {loading && (
          <div className="flex items-center justify-center gap-2 py-16 text-gray-400">
            <Loader2 size={20} className="animate-spin" />
            <span className="text-sm">Fetching features from ADO…</span>
          </div>
        )}

        {!loading && features.length === 0 && !error && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <LayoutDashboard size={36} className="text-gray-200 mb-3" />
            <p className="text-gray-400 text-sm">Select a project and click Load to get started.</p>
            <p className="text-gray-300 text-xs mt-1">Pin features to keep them always visible at the top.</p>
          </div>
        )}

        <div className="grid gap-3">
          {filtered.map((f) => (
            <FeatureCard
              key={f.id}
              feature={f}
              project={project}
              isPinned={pinned.some((p) => p.id === f.id)}
              onTogglePin={(feat) => toggle(feat, project)}
            />
          ))}
        </div>
      </main>
    </div>
  );
}
