"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import {
  Search, Pin, X, RefreshCw, Plus, ExternalLink, ChevronDown,
  ChevronUp, AlertCircle, Loader2, BookOpen, Filter,
  Layers, GitBranch, ChevronRight, CheckCircle2, Map, List,
} from "lucide-react";
import {
  InitiativeDetail, FeatureDetail, UserStory,
  fetchInitiative, buildAreaPathSummaries, AreaPathSummary, IterationStats,
  classifyState, isIncludedType, STATE_COLORS, TYPE_PILL,
} from "@/lib/ado";

// ─── Connectors ───────────────────────────────────────────────────────────────
const CONNECTORS = [
  { id: "tr-tax",         label: "TR-Tax · TaxProf",          org: "tr-tax",         project: "TaxProf",         accent: "#123015" },
  { id: "tr-tax-default", label: "TR-Tax-Default · SurePrep", org: "tr-tax-default", project: "SurePrep Support", accent: "#1e40af" },
];

// ─── Persistence ──────────────────────────────────────────────────────────────
interface Pinned { id: number; label?: string; connectorId: string; }
interface Store  { activeConnectorId: string; pinned: Pinned[]; }
const KEY = "ado_db_v4";
const loadStore = (): Store => { try { const r = localStorage.getItem(KEY); if (r) return JSON.parse(r); } catch {} return { activeConnectorId: "tr-tax", pinned: [] }; };
const saveStore = (s: Store) => localStorage.setItem(KEY, JSON.stringify(s));

// ─── Tiny helpers ─────────────────────────────────────────────────────────────
const leafPath = (p: string) => p.split("\\").pop() || p;
const fmtDate  = (d?: string) => d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : null;

// All counts use classifyState — single source of truth
// Only User Stories and Investigation Tasks are counted.
// New and Ready are tracked separately; total = closed+active+new+ready+other
function countStories(stories: UserStory[]) {
  let closed = 0, active = 0, newCount = 0, readyCount = 0, other = 0;
  for (const s of stories) {
    if (!isIncludedType(s.workItemType, s.title)) continue; // skip bugs etc.
    const c = classifyState(s.state);
    if      (c === "closed") closed++;
    else if (c === "active") active++;
    else if (c === "ready")  readyCount++;
    else if (c === "new")    newCount++;
    else                     other++;
  }
  const includedTotal = stories.filter(s => isIncludedType(s.workItemType, s.title)).length;
  return { total: includedTotal, closed, active, newCount, readyCount, other };
}

// ─── UI atoms ────────────────────────────────────────────────────────────────
function StatChip({ value, label, color }: { value: number | string; label: string; color: string }) {
  return (
    <div className={`flex flex-col items-center px-3 py-2 rounded-lg border ${color} min-w-[56px]`}>
      <span className="text-base font-bold leading-none">{value}</span>
      <span className="text-[10px] mt-1 opacity-60 whitespace-nowrap">{label}</span>
    </div>
  );
}

function MiniBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(pct, 100)}%`, background: color }} />
      </div>
      <span className="text-[10px] text-slate-400 w-7 text-right">{pct}%</span>
    </div>
  );
}

function StatePill({ state }: { state: string }) {
  const c = STATE_COLORS[state] || { bg: "bg-gray-100", text: "text-gray-500", dot: "bg-gray-400" };
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full ${c.bg} ${c.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {state}
    </span>
  );
}

// ─── Inline story drawer (used in area path expand) ──────────────────────────
function StoryDrawer({ stories, onClose, title }: { stories: UserStory[]; onClose: () => void; title: string }) {
  const [stateFilter, setStateFilter] = useState("All");
  const [search, setSearch] = useState("");
  const states = ["All", ...Array.from(new Set(stories.map((s) => s.state))).sort()];
  const filtered = stories.filter((s) => {
    const ms = !search || s.title.toLowerCase().includes(search.toLowerCase()) || String(s.id).includes(search);
    return ms && (stateFilter === "All" || s.state === stateFilter);
  });

  return (
    <div className="border border-blue-200 rounded-xl bg-blue-50/40 overflow-hidden mt-2">
      {/* Drawer header */}
      <div className="flex items-center gap-3 px-4 py-2.5 bg-white border-b border-blue-100">
        <span className="text-xs font-semibold text-slate-700 flex-1">{title}</span>
        <div className="relative">
          <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-300" />
          <input placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)}
            className="pl-7 pr-3 py-1 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 w-36" />
        </div>
        <Filter size={11} className="text-slate-300" />
        <select value={stateFilter} onChange={(e) => setStateFilter(e.target.value)}
          className="text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400">
          {states.map((s) => <option key={s}>{s}</option>)}
        </select>
        <span className="text-[10px] text-slate-400">{filtered.length}/{stories.length}</span>
        <button onClick={onClose} className="ml-1 text-slate-300 hover:text-slate-600"><X size={13} /></button>
      </div>
      {/* Story rows */}
      <div className="overflow-x-auto max-h-72 overflow-y-auto">
        <table className="w-full min-w-[700px] text-xs">
          <thead className="sticky top-0">
            <tr className="bg-slate-50 border-b border-slate-100">
              {["ID", "Title", "Type", "State", "Iteration", "Assigned To", "PI Release Date", "Pts"].map((h) => (
                <th key={h} className="px-3 py-2 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={8} className="px-3 py-4 text-center text-slate-400">No stories match.</td></tr>
            ) : filtered.map((story) => {
              const tp = TYPE_PILL[story.workItemType] || "bg-gray-50 text-gray-500 border border-gray-100";
              return (
                <tr key={story.id} className="border-b border-slate-50 hover:bg-white transition-colors group">
                  <td className="px-3 py-2 w-14">
                    <a href={story.url} target="_blank" rel="noopener noreferrer"
                      className="font-mono text-blue-500 hover:underline flex items-center gap-0.5">
                      #{story.id}<ExternalLink size={8} className="opacity-0 group-hover:opacity-60" />
                    </a>
                  </td>
                  <td className="px-3 py-2 max-w-[220px]"><span className="text-slate-700 line-clamp-1">{story.title}</span></td>
                  <td className="px-3 py-2"><span className={`inline-block text-[10px] font-medium px-1.5 py-0.5 rounded-full ${tp}`}>{story.workItemType}</span></td>
                  <td className="px-3 py-2"><StatePill state={story.state} /></td>
                  <td className="px-3 py-2 text-slate-400 max-w-[110px] truncate">{leafPath(story.iterationPath)}</td>
                  <td className="px-3 py-2 text-slate-500 max-w-[120px] truncate">
                    {story.assignedTo === "Unassigned" ? <span className="text-slate-300">—</span> : story.assignedTo}
                  </td>
                  <td className="px-3 py-2 text-slate-400 whitespace-nowrap">
                    {fmtDate(story.piReleaseDate) ?? <span className="text-slate-200">—</span>}
                  </td>
                  <td className="px-3 py-2 text-center text-slate-400">
                    {story.storyPoints ?? <span className="text-slate-200">—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Area Path Breakdown ──────────────────────────────────────────────────────
function AreaPathBreakdown({ summaries, accent }: { summaries: AreaPathSummary[]; accent: string }) {
  const [expandedAP, setExpandedAP] = useState<string | null>(null);
  // drawer: key = "ap:iter" or "ap:ALL", value = stories[]
  const [drawer, setDrawer] = useState<{ key: string; stories: UserStory[]; title: string } | null>(null);

  if (summaries.length === 0) return (
    <p className="text-xs text-slate-400 text-center py-6">No area path data available.</p>
  );

  const openDrawer = (key: string, stories: UserStory[], title: string) => {
    setDrawer((prev) => prev?.key === key ? null : { key, stories, title });
  };

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
      <div className="flex items-center gap-2 px-4 py-3 bg-slate-50 border-b border-slate-100">
        <Map size={14} className="text-slate-400" />
        <span className="text-xs font-semibold text-slate-600">Area Path Breakdown</span>
        <span className="text-[10px] text-slate-400 ml-1">— story level · click any count to view tickets</span>
        <span className="ml-auto text-[10px] font-semibold text-slate-500">
          Total: {summaries.reduce((a, s) => a + s.total, 0)} stories
        </span>
      </div>

      <div className="divide-y divide-slate-50">
        {summaries.map((s) => {
          // Recompute from stories array to guarantee accuracy
          const counts = countStories(s.stories);
          const pct = counts.total ? Math.round((counts.closed / counts.total) * 100) : 0;
          const isOpen = expandedAP === s.areaPath;
          const iterKeys = Object.keys(s.iterations).sort();
          const apDrawerKey = `${s.areaPath}:ALL`;

          return (
            <div key={s.areaPath}>
              {/* Area path row */}
              <div className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors cursor-pointer"
                onClick={() => setExpandedAP(isOpen ? null : s.areaPath)}>
                <div className="flex items-center gap-1 text-slate-400 shrink-0">
                  {isOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                </div>
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: accent }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-xs font-semibold text-slate-700">{s.leafName}</span>
                    <span className="text-[10px] text-slate-400 truncate hidden sm:inline">{s.areaPath}</span>
                  </div>
                  <MiniBar pct={pct} color={accent} />
                </div>
                {/* Clickable count chips */}
                <div className="flex items-center gap-1.5 shrink-0 ml-3" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => openDrawer(apDrawerKey, s.stories, `All stories — ${s.leafName}`)}
                    className="text-[10px] font-semibold px-2 py-1 rounded-md bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors border border-slate-200">
                    {counts.total} total
                  </button>
                  <button onClick={() => openDrawer(`${apDrawerKey}:closed`, s.stories.filter(x => classifyState(x.state) === "closed"), `Closed — ${s.leafName}`)}
                    className="text-[10px] font-semibold px-2 py-1 rounded-md bg-green-50 text-green-700 hover:bg-green-100 transition-colors border border-green-200">
                    {counts.closed} closed
                  </button>
                  <button onClick={() => openDrawer(`${apDrawerKey}:active`, s.stories.filter(x => classifyState(x.state) === "active"), `Active — ${s.leafName}`)}
                    className="text-[10px] font-semibold px-2 py-1 rounded-md bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors border border-blue-200">
                    {counts.active} active
                  </button>
                  <button onClick={() => openDrawer(`${apDrawerKey}:new`, s.stories.filter(x => classifyState(x.state) === "new"), `New — ${s.leafName}`)}
                    className="text-[10px] font-semibold px-2 py-1 rounded-md bg-slate-50 text-slate-500 hover:bg-slate-100 transition-colors border border-slate-200">
                    {counts.newCount} new
                  </button>
                  <button onClick={() => openDrawer(`${apDrawerKey}:ready`, s.stories.filter(x => classifyState(x.state) === "ready"), `Ready — ${s.leafName}`)}
                    className="text-[10px] font-semibold px-2 py-1 rounded-md bg-violet-50 text-violet-600 hover:bg-violet-100 transition-colors border border-violet-200">
                    {counts.readyCount} ready
                  </button>
                  {counts.other > 0 && (
                    <button onClick={() => openDrawer(`${apDrawerKey}:other`, s.stories.filter(x => classifyState(x.state) === "other"), `Other states — ${s.leafName}`)}
                      className="text-[10px] font-semibold px-2 py-1 rounded-md bg-orange-50 text-orange-600 hover:bg-orange-100 transition-colors border border-orange-200">
                      {counts.other} other
                    </button>
                  )}
                </div>
              </div>

              {/* Area-level drawer */}
              {drawer && drawer.key.startsWith(apDrawerKey) && !isOpen && (
                <div className="px-4 pb-3">
                  <StoryDrawer stories={drawer.stories} title={drawer.title} onClose={() => setDrawer(null)} />
                </div>
              )}

              {/* Iteration breakdown */}
              {isOpen && (
                <div className="px-4 pb-3 bg-slate-50/60">
                  <div className="rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-slate-100 border-b border-slate-200">
                          <th className="px-3 py-2 text-left font-semibold text-slate-500">Iteration</th>
                          <th className="px-3 py-2 text-center font-semibold text-slate-500">Total</th>
                          <th className="px-3 py-2 text-center font-semibold text-green-600">Closed</th>
                          <th className="px-3 py-2 text-center font-semibold text-blue-500">Active</th>
                          <th className="px-3 py-2 text-center font-semibold text-slate-500">New</th>
                          <th className="px-3 py-2 text-center font-semibold text-violet-600">Ready</th>
                          {iterKeys.some(k => s.iterations[k].other > 0) && (
                            <th className="px-3 py-2 text-center font-semibold text-orange-500">Other</th>
                          )}
                          <th className="px-3 py-2 font-semibold text-slate-500">Progress</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {iterKeys.map((iter) => {
                          const it: IterationStats = s.iterations[iter];
                          // Recompute from stories for accuracy
                          const ic = countStories(it.stories);
                          const ip = ic.total ? Math.round((ic.closed / ic.total) * 100) : 0;
                          const iterKey = `${s.areaPath}:${iter}`;
                          const hasOther = iterKeys.some(k => s.iterations[k].other > 0);
                          return (
                            <>
                              <tr key={iter} className="bg-white hover:bg-slate-50 transition-colors">
                                <td className="px-3 py-2.5 font-medium text-slate-700">{iter}</td>
                                {/* Clickable total */}
                                <td className="px-3 py-2.5 text-center">
                                  <button onClick={() => openDrawer(iterKey, it.stories, `${iter} · All — ${s.leafName}`)}
                                    className="font-semibold text-slate-600 hover:text-blue-600 hover:underline transition-colors px-1.5 py-0.5 rounded hover:bg-blue-50">
                                    {ic.total}
                                  </button>
                                </td>
                                {/* Clickable closed */}
                                <td className="px-3 py-2.5 text-center">
                                  <button onClick={() => ic.closed > 0 && openDrawer(`${iterKey}:closed`, it.stories.filter(x => classifyState(x.state) === "closed"), `${iter} · Closed — ${s.leafName}`)}
                                    className={`font-semibold transition-colors px-1.5 py-0.5 rounded ${ic.closed > 0 ? "text-green-600 hover:text-green-800 hover:bg-green-50 hover:underline cursor-pointer" : "text-slate-300 cursor-default"}`}>
                                    {ic.closed}
                                  </button>
                                </td>
                                {/* Clickable active */}
                                <td className="px-3 py-2.5 text-center">
                                  <button onClick={() => ic.active > 0 && openDrawer(`${iterKey}:active`, it.stories.filter(x => classifyState(x.state) === "active"), `${iter} · Active — ${s.leafName}`)}
                                    className={`font-semibold transition-colors px-1.5 py-0.5 rounded ${ic.active > 0 ? "text-blue-500 hover:text-blue-700 hover:bg-blue-50 hover:underline cursor-pointer" : "text-slate-300 cursor-default"}`}>
                                    {ic.active}
                                  </button>
                                </td>
                                {/* Clickable new */}
                                <td className="px-3 py-2.5 text-center">
                                  <button onClick={() => ic.newCount > 0 && openDrawer(`${iterKey}:new`, it.stories.filter(x => classifyState(x.state) === "new"), `${iter} · New — ${s.leafName}`)}
                                    className={`font-semibold transition-colors px-1.5 py-0.5 rounded ${ic.newCount > 0 ? "text-slate-500 hover:text-slate-700 hover:bg-slate-100 hover:underline cursor-pointer" : "text-slate-300 cursor-default"}`}>
                                    {ic.newCount}
                                  </button>
                                </td>
                                {/* Clickable ready */}
                                <td className="px-3 py-2.5 text-center">
                                  <button onClick={() => ic.readyCount > 0 && openDrawer(`${iterKey}:ready`, it.stories.filter(x => classifyState(x.state) === "ready"), `${iter} · Ready — ${s.leafName}`)}
                                    className={`font-semibold transition-colors px-1.5 py-0.5 rounded ${ic.readyCount > 0 ? "text-violet-600 hover:text-violet-800 hover:bg-violet-50 hover:underline cursor-pointer" : "text-slate-300 cursor-default"}`}>
                                    {ic.readyCount}
                                  </button>
                                </td>
                                {hasOther && (
                                  <td className="px-3 py-2.5 text-center">
                                    <button onClick={() => ic.other > 0 && openDrawer(`${iterKey}:other`, it.stories.filter(x => classifyState(x.state) === "other"), `${iter} · Other — ${s.leafName}`)}
                                      className={`font-semibold transition-colors px-1.5 py-0.5 rounded ${ic.other > 0 ? "text-orange-500 hover:text-orange-700 hover:bg-orange-50 hover:underline cursor-pointer" : "text-slate-300 cursor-default"}`}>
                                      {ic.other}
                                    </button>
                                  </td>
                                )}
                                <td className="px-3 py-2.5 w-32"><MiniBar pct={ip} color={accent} /></td>
                              </tr>
                              {/* Iteration-level story drawer */}
                              {drawer && drawer.key.startsWith(iterKey) && (
                                <tr key={`${iter}-drawer`}>
                                  <td colSpan={hasOther ? 7 : 6} className="px-3 pb-3">
                                    <StoryDrawer stories={drawer.stories} title={drawer.title} onClose={() => setDrawer(null)} />
                                  </td>
                                </tr>
                              )}
                            </>
                          );
                        })}
                        {/* Totals row */}
                        <tr className="bg-slate-50 font-semibold border-t border-slate-200">
                          <td className="px-3 py-2.5 text-slate-600">Total</td>
                          <td className="px-3 py-2.5 text-center text-slate-700">{counts.total}</td>
                          <td className="px-3 py-2.5 text-center text-green-700">{counts.closed}</td>
                          <td className="px-3 py-2.5 text-center text-blue-600">{counts.active}</td>
                          <td className="px-3 py-2.5 text-center text-slate-500">{counts.newCount}</td>
                          <td className="px-3 py-2.5 text-center text-violet-600">{counts.readyCount}</td>
                          {iterKeys.some(k => s.iterations[k].other > 0) && (
                            <td className="px-3 py-2.5 text-center text-orange-500">{counts.other}</td>
                          )}
                          <td className="px-3 py-2.5"><MiniBar pct={pct} color={accent} /></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Area drawer when iteration is expanded */}
              {drawer && drawer.key.startsWith(apDrawerKey) && isOpen && (
                <div className="px-4 pb-3 bg-slate-50/60">
                  <StoryDrawer stories={drawer.stories} title={drawer.title} onClose={() => setDrawer(null)} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Grand total verification row */}
      <div className="flex items-center gap-3 px-4 py-2.5 bg-slate-50 border-t border-slate-200 text-[10px] text-slate-500">
        <span className="font-semibold">Verification:</span>
        {(() => {
          const total   = summaries.reduce((a, s) => a + s.total, 0);
          const closed  = summaries.reduce((a, s) => a + countStories(s.stories).closed, 0);
          const active  = summaries.reduce((a, s) => a + countStories(s.stories).active, 0);
          const newC    = summaries.reduce((a, s) => a + countStories(s.stories).newCount, 0);
          const readyC  = summaries.reduce((a, s) => a + countStories(s.stories).readyCount, 0);
          const other   = summaries.reduce((a, s) => a + countStories(s.stories).other, 0);
          const sum     = closed + active + newC + readyC + other;
          const ok      = total === sum;
          return (
            <>
              <span>{total} total = {closed} closed + {active} active + {newC} new + {readyC} ready{other > 0 ? ` + ${other} other` : ""}</span>
              <span className={`ml-auto font-semibold flex items-center gap-1 ${ok ? "text-green-600" : "text-red-600"}`}>
                {ok ? <CheckCircle2 size={11} /> : <AlertCircle size={11} />}
                {ok ? "Counts verified ✓" : "Count mismatch!"}
              </span>
            </>
          );
        })()}
      </div>
    </div>
  );
}

// ─── Story Row (feature table) ────────────────────────────────────────────────
function StoryRow({ story }: { story: UserStory }) {
  const tp = TYPE_PILL[story.workItemType] || "bg-gray-50 text-gray-500 border border-gray-100";
  return (
    <tr className="border-b border-green-50 hover:bg-green-50 transition-colors group text-xs bg-white">
      <td className="px-3 py-2 w-14 pl-8">
        <a href={story.url} target="_blank" rel="noopener noreferrer"
          className="font-mono text-blue-500 hover:underline flex items-center gap-0.5">
          #{story.id}<ExternalLink size={8} className="opacity-0 group-hover:opacity-60" />
        </a>
      </td>
      <td className="px-3 py-2 min-w-[200px] max-w-[300px]">
        <span className="text-slate-700 leading-snug line-clamp-2">{story.title}</span>
      </td>
      <td className="px-3 py-2 w-24">
        <span className={`inline-block text-[10px] font-medium px-1.5 py-0.5 rounded-full ${tp}`}>{story.workItemType}</span>
      </td>
      <td className="px-3 py-2 w-24"><StatePill state={story.state} /></td>
      <td className="px-3 py-2 text-slate-400 max-w-[140px] truncate" title={story.areaPath}>{leafPath(story.areaPath)}</td>
      <td className="px-3 py-2 text-slate-400 max-w-[110px] truncate" title={story.iterationPath}>{leafPath(story.iterationPath)}</td>
      <td className="px-3 py-2 text-slate-500 max-w-[120px] truncate">
        {story.assignedTo === "Unassigned" ? <span className="text-slate-300">—</span> : story.assignedTo}
      </td>
      <td className="px-3 py-2 text-slate-400 whitespace-nowrap">
        {fmtDate(story.piReleaseDate) ?? <span className="text-slate-200">—</span>}
      </td>

    </tr>
  );
}

// ─── Feature Card ─────────────────────────────────────────────────────────────
function FeatureCard({ feature, accent }: { feature: FeatureDetail; accent: string }) {
  const [expanded, setExpanded] = useState(false);
  const [search, setSearch] = useState("");
  const [stateFilter, setStateFilter] = useState("All");

  const counts = countStories(feature.userStories);
  const pct = counts.total ? Math.round((counts.closed / counts.total) * 100) : 0;
  const includedStories = feature.userStories.filter(s => isIncludedType(s.workItemType, s.title));
  const states = ["All", ...Array.from(new Set(includedStories.map((s) => s.state))).sort()];
  const filtered = feature.userStories.filter((s) => {
    if (!isIncludedType(s.workItemType, s.title)) return false; // only User Stories + Investigation Tasks
    const ms = !search || s.title.toLowerCase().includes(search.toLowerCase()) || String(s.id).includes(search);
    return ms && (stateFilter === "All" || s.state === stateFilter);
  });

  return (
    <div className="border border-green-200 rounded-xl overflow-hidden bg-white shadow-sm border-l-[3px] border-l-green-500">
      <div className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-green-50/50 transition-colors select-none"
        onClick={() => setExpanded((e) => !e)}>
        <div className="w-0.5 h-8 rounded-full shrink-0" style={{ background: accent }} />
        <GitBranch size={13} style={{ color: accent }} className="shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <a href={feature.url} target="_blank" rel="noopener noreferrer"
              className="text-[10px] font-mono text-green-600 hover:underline shrink-0"
              onClick={(e) => e.stopPropagation()}>#{feature.id}</a>
            <span className="text-[12px] font-semibold text-green-800 truncate">{feature.title}</span>
            <StatePill state={feature.state} />
          </div>
          <div className="flex items-center gap-3">
            <div className="w-32"><MiniBar pct={pct} color={accent} /></div>
            <span className="text-[10px] text-slate-400">{counts.closed}/{counts.total} closed</span>
            {counts.active > 0 && <span className="text-[10px] text-blue-500 font-medium">{counts.active} active</span>}
            {feature.piReleaseDate && <span className="text-[10px] text-orange-500">📅 {fmtDate(feature.piReleaseDate)}</span>}
            {leafPath(feature.iterationPath) && <span className="text-[10px] text-slate-400">🔄 {leafPath(feature.iterationPath)}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-medium">{counts.total}</span>
          {expanded ? <ChevronUp size={13} className="text-slate-300" /> : <ChevronDown size={13} className="text-slate-300" />}
        </div>
      </div>

      {expanded && (
        <>
          <div className="flex items-center gap-2 px-4 py-2 bg-green-50 border-t border-green-100">
            <div className="relative">
              <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-300" />
              <input placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)}
                className="pl-7 pr-3 py-1 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 w-40" />
            </div>
            <Filter size={11} className="text-slate-300" />
            <select value={stateFilter} onChange={(e) => setStateFilter(e.target.value)}
              className="text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400">
              {states.map((s) => <option key={s}>{s}</option>)}
            </select>
            <span className="text-[10px] text-slate-400 ml-auto">{filtered.length} / {counts.total}</span>
          </div>
          {filtered.length === 0 ? (
            <p className="text-xs text-slate-400 px-4 py-5 text-center">No stories match.</p>
          ) : (
            <div className="overflow-x-auto bg-green-50/30">
              <table className="w-full min-w-[820px]">
                <thead>
                  <tr className="bg-green-100/60 border-t border-b border-green-100">
                    {["ID","Title","Type","State","Area Path","Iteration","Assigned To","PI Release Date"].map((h) => (
                      <th key={h} className="px-3 py-2 text-left text-[9px] font-bold text-green-700 uppercase tracking-wide first:pl-8">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>{filtered.map((s) => <StoryRow key={s.id} story={s} />)}</tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Initiative Panel ─────────────────────────────────────────────────────────
type PanelMode = "search" | "pinned";
type ActiveTab = "features" | "areapaths";

function InitiativePanel({ initiative, accent, mode, onPin, onRemove, isPinned }: {
  initiative: InitiativeDetail; accent: string; mode: PanelMode;
  onPin?: () => void; onRemove: () => void; isPinned: boolean;
}) {
  const [tab, setTab] = useState<ActiveTab>("features");
  const [collapsed, setCollapsed] = useState(false);
  const [featureSearch, setFeatureSearch] = useState("");

  const allStories = initiative.features.flatMap((f) => f.userStories);
  const counts = countStories(allStories);
  const pct = counts.total ? Math.round((counts.closed / counts.total) * 100) : 0;
  const areaSummaries = buildAreaPathSummaries(initiative.features);
  const filteredFeatures = initiative.features.filter((f) =>
    !featureSearch || f.title.toLowerCase().includes(featureSearch.toLowerCase()) || String(f.id).includes(featureSearch)
  );

  return (
    <div className={`rounded-2xl border shadow-sm overflow-hidden mb-5 ${mode === "search" ? "border-amber-200 bg-amber-50/20 border-l-4 border-l-amber-400" : "border-slate-200 bg-white border-l-4 border-l-[#123015]"}`}>
      <div className="px-5 py-4 border-b border-slate-100 bg-white hover:bg-slate-50/50 transition-colors" style={{cursor:'pointer'}}>
        <div className="flex items-start gap-3" onClick={() => setCollapsed((c) => !c)} style={{cursor:'pointer'}}>
          <Layers size={16} className="mt-0.5 shrink-0" style={{ color: accent }} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              {mode === "search" && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-600 border border-amber-200">🔍 Search Result</span>}
              {mode === "pinned" && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-50 text-green-600 border border-green-200">📌 Pinned</span>}
              <a href={initiative.url} target="_blank" rel="noopener noreferrer" className="text-xs font-mono text-blue-400 hover:underline">#{initiative.id}</a>
              <StatePill state={initiative.state} />
              <span className="text-[10px] text-slate-400">INITIATIVE</span>
            </div>
            <h2 className="text-[15px] font-bold text-slate-900 leading-snug">{initiative.title}</h2>
            <div className="flex flex-wrap items-center gap-4 mt-2">
              <div className="w-48"><MiniBar pct={pct} color={accent} /></div>
              {initiative.assignedTo !== "Unassigned" && <span className="text-xs text-slate-500">👤 {initiative.assignedTo}</span>}
              {initiative.piReleaseDate && <span className="text-xs text-orange-500 font-medium">📅 PI: {fmtDate(initiative.piReleaseDate)}</span>}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-2" onClick={(e) => e.stopPropagation()}>
            {mode === "search" && !isPinned && onPin && (
              <button onClick={onPin} className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 font-medium transition-colors">
                <Pin size={12} />Pin
              </button>
            )}
            {mode === "search" && isPinned && <span className="text-[10px] text-green-600 bg-green-50 px-2 py-1 rounded-full border border-green-200 font-medium">✓ Pinned</span>}
            <button onClick={() => setCollapsed((c) => !c)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100">
              {collapsed ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
            </button>
            <button onClick={onRemove} className="p-1.5 text-slate-300 hover:text-red-400 rounded-lg hover:bg-red-50 transition-colors">
              <X size={15} />
            </button>
          </div>
        </div>

        {!collapsed && (
          <div className="flex flex-wrap gap-2 mt-4">
            <StatChip value={initiative.features.length} label="Features"    color="border-slate-200 text-slate-700 bg-slate-50" />
            <StatChip value={counts.total}               label="Stories"     color="border-blue-100 text-blue-700 bg-blue-50" />
            <StatChip value={counts.closed}              label="Closed"      color="border-green-100 text-green-700 bg-green-50" />
            <StatChip value={counts.active}              label="Active"      color="border-indigo-100 text-indigo-700 bg-indigo-50" />
            <StatChip value={counts.newCount}            label="New"    color="border-slate-200 text-slate-500 bg-slate-50" />
            <StatChip value={counts.readyCount}          label="Ready"  color="border-violet-100 text-violet-600 bg-violet-50" />
            {counts.other > 0 && <StatChip value={counts.other} label="Other" color="border-orange-100 text-orange-600 bg-orange-50" />}

          </div>
        )}
      </div>

      {!collapsed && (
        <>
          <div className="flex gap-0 border-b border-slate-100 bg-slate-50">
            {([
              { id: "features",  icon: <List size={12} />, label: `Features (${initiative.features.length})` },
              { id: "areapaths", icon: <Map size={12} />,  label: `Area Paths (${areaSummaries.length})` },
            ] as { id: ActiveTab; icon: React.ReactNode; label: string }[]).map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${tab === t.id ? "border-blue-500 text-blue-600 bg-white" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
                {t.icon}{t.label}
              </button>
            ))}
          </div>

          {tab === "features" && (
            <>
              {initiative.features.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">No features found under this initiative.</p>
              ) : (
                <div className="bg-green-50 border-t border-green-100">
                  <div className="flex items-center gap-2 px-5 py-3 border-b border-green-100">
                    <div className="relative">
                      <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-300" />
                      <input placeholder="Filter features…" value={featureSearch} onChange={(e) => setFeatureSearch(e.target.value)}
                        className="pl-7 pr-3 py-1.5 text-xs border border-green-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-green-400 w-52" />
                    </div>
                    {featureSearch && <span className="text-[10px] text-slate-400">{filteredFeatures.length} / {initiative.features.length}</span>}
                    <span className="ml-auto text-[10px] text-green-600 font-medium">{initiative.features.length} features</span>
                  </div>
                  <div className="px-4 py-3 space-y-2">
                    {filteredFeatures.map((f) => <FeatureCard key={f.id} feature={f} accent={accent} />)}
                  </div>
                </div>
              )}
            </>
          )}
          {tab === "areapaths" && (
            <div className="px-5 py-4">
              <AreaPathBreakdown summaries={areaSummaries} accent={accent} />
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function ADODashboard() {
  const [store, setStore]           = useState<Store>({ activeConnectorId: "tr-tax", pinned: [] });
  const [pinnedData, setPinnedData] = useState<Record<string, InitiativeDetail>>({});
  const [searchData, setSearchData] = useState<Record<string, InitiativeDetail>>({});
  const [loadingKeys, setLoadingKeys] = useState<Record<string, boolean>>({});
  const [errorKeys, setErrorKeys]     = useState<Record<string, string>>({});
  const [searchInput, setSearchInput] = useState("");
  const [refreshing, setRefreshing]   = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setStore(loadStore()); }, []);

  const activeConn = CONNECTORS.find((c) => c.id === store.activeConnectorId) || CONNECTORS[0];

  const getPat = useCallback((connId: string) =>
    connId === "tr-tax"
      ? (process.env.NEXT_PUBLIC_ADO_PAT_TR_TAX || null)
      : (process.env.NEXT_PUBLIC_ADO_PAT_TR_TAX_DEFAULT || null), []);

  const loadOne = useCallback(async (connId: string, id: number, target: "pinned" | "search") => {
    const conn = CONNECTORS.find((c) => c.id === connId);
    if (!conn) return;
    const pat = getPat(connId);
    if (!pat) { alert(`PAT not set for ${conn.label}`); return; }
    const key = `${connId}:${id}`;
    setLoadingKeys((p) => ({ ...p, [key]: true }));
    setErrorKeys((p) => { const n = { ...p }; delete n[key]; return n; });
    try {
      const detail = await fetchInitiative({ org: conn.org, project: conn.project, pat }, id);
      if (target === "pinned") setPinnedData((p) => ({ ...p, [key]: detail }));
      else                      setSearchData((p) => ({ ...p, [key]: detail }));
    } catch (err) {
      setErrorKeys((p) => ({ ...p, [key]: err instanceof Error ? err.message : "Failed to load" }));
    } finally {
      setLoadingKeys((p) => { const n = { ...p }; delete n[key]; return n; });
    }
  }, [getPat]);

  useEffect(() => {
    store.pinned.filter((p) => p.connectorId === activeConn.id)
      .forEach((p) => { const key = `${p.connectorId}:${p.id}`; if (!pinnedData[key]) loadOne(p.connectorId, p.id, "pinned"); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.activeConnectorId]);

  const switchConn = (id: string) => {
    const updated = { ...store, activeConnectorId: id };
    saveStore(updated); setStore(updated); setSearchData({}); setSearchInput("");
  };

  const handleSearch = () => {
    const id = parseInt(searchInput.replace("#", "").trim());
    if (isNaN(id)) return;
    setSearchData({});
    loadOne(activeConn.id, id, "search");
  };

  const pinInitiative = (id: number, connId: string) => {
    if (store.pinned.find((p) => p.id === id && p.connectorId === connId)) return;
    const updated = { ...store, pinned: [...store.pinned, { id, connectorId: connId }] };
    saveStore(updated); setStore(updated);
    const key = `${connId}:${id}`;
    if (searchData[key]) setPinnedData((p) => ({ ...p, [key]: searchData[key] }));
    else loadOne(connId, id, "pinned");
  };

  const removeSearch = (key: string) => {
    setSearchData((p) => { const n = { ...p }; delete n[key]; return n; });
    setErrorKeys((p) => { const n = { ...p }; delete n[key]; return n; });
  };

  const removePinned = (connId: string, id: number) => {
    const updated = { ...store, pinned: store.pinned.filter((p) => !(p.id === id && p.connectorId === connId)) };
    saveStore(updated); setStore(updated);
    const key = `${connId}:${id}`;
    setPinnedData((p) => { const n = { ...p }; delete n[key]; return n; });
  };

  const refreshAll = async () => {
    setRefreshing(true); setPinnedData({});
    await Promise.all(store.pinned.filter((p) => p.connectorId === activeConn.id).map((p) => loadOne(p.connectorId, p.id, "pinned")));
    setRefreshing(false);
  };

  const activePinned = store.pinned.filter((p) => p.connectorId === activeConn.id);
  const searchKeys   = Object.keys(searchData);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Nav */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
          <BookOpen size={18} className="text-orange-500 shrink-0" />
          <span className="font-bold text-slate-800 text-sm tracking-tight">ADO Feature Dashboard</span>
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">PM</span>
          <div className="flex-1 max-w-sm mx-4">
            <div className="flex items-center border border-slate-200 rounded-lg bg-slate-50 hover:border-slate-300 overflow-hidden">
              <Search size={13} className="ml-3 text-slate-400 shrink-0" />
              <input ref={searchRef} type="text" placeholder="Search Initiative ID… (session only)"
                value={searchInput} onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="flex-1 px-2 py-2 text-xs bg-transparent focus:outline-none text-slate-700 placeholder-slate-400" />
              {searchInput && (
                <button onClick={() => { setSearchInput(""); setSearchData({}); }} className="px-2 text-slate-300 hover:text-slate-500"><X size={12} /></button>
              )}
              <button onClick={handleSearch} className="px-3 py-2 text-xs font-medium text-white shrink-0" style={{ background: activeConn.accent }}>Go</button>
            </div>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            {activePinned.length > 0 && (
              <button onClick={refreshAll} disabled={refreshing}
                className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 border border-slate-200">
                <RefreshCw size={12} className={refreshing ? "animate-spin" : ""} />
                <span className="hidden sm:inline">Refresh</span>
              </button>
            )}
          </div>
        </div>
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 flex border-t border-slate-100">
          {CONNECTORS.map((c) => {
            const cnt = store.pinned.filter((p) => p.connectorId === c.id).length;
            const isAct = store.activeConnectorId === c.id;
            return (
              <button key={c.id} onClick={() => switchConn(c.id)}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${isAct ? "border-blue-500 text-blue-700" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
                <span className="w-2 h-2 rounded-full" style={{ background: c.accent }} />
                {c.label}
                {cnt > 0 && <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${isAct ? "bg-blue-100 text-blue-600" : "bg-slate-100 text-slate-500"}`}>{cnt} pinned</span>}
                {isAct && <ChevronRight size={11} className="text-slate-300" />}
              </button>
            );
          })}
        </div>
      </header>

      <main className="max-w-screen-xl mx-auto px-4 sm:px-6 py-6">
        {/* Search results */}
        {(searchKeys.length > 0 || (Object.keys(loadingKeys).length > 0 && searchInput)) && (
          <section className="mb-8">
            <div className="flex items-center gap-2 mb-3">
              <Search size={14} className="text-amber-500" />
              <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">Search Results</span>
              <span className="text-[10px] text-slate-400">— cleared on refresh / new session</span>
            </div>
            {Object.keys(loadingKeys).filter((k) => k.startsWith(activeConn.id) && !searchData[k] && !pinnedData[k]).map((key) => (
              <div key={key} className="bg-amber-50 border border-amber-200 rounded-2xl p-6 mb-4 flex items-center gap-3">
                <Loader2 size={16} className="animate-spin text-amber-500" />
                <span className="text-sm text-amber-700">Loading initiative #{key.split(":")[1]}…</span>
              </div>
            ))}
            {searchKeys.map((key) => {
              const [connId, idStr] = key.split(":");
              const id = parseInt(idStr);
              const isPinned = store.pinned.some((p) => p.id === id && p.connectorId === connId);
              return (
                <InitiativePanel key={key} initiative={searchData[key]}
                  accent={activeConn.accent} mode="search" isPinned={isPinned}
                  onPin={() => pinInitiative(id, connId)} onRemove={() => removeSearch(key)} />
              );
            })}
            {Object.entries(errorKeys).filter(([k]) => !pinnedData[k]).map(([key, msg]) => (
              <div key={key} className="bg-red-50 border border-red-200 rounded-xl p-4 mb-3 flex items-start gap-3">
                <AlertCircle size={15} className="text-red-400 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-red-700">Failed to load #{key.split(":")[1]}</p>
                  <p className="text-xs text-red-500 mt-0.5">{msg}</p>
                </div>
                <button onClick={() => setErrorKeys((p) => { const n = { ...p }; delete n[key]; return n; })} className="ml-auto text-red-300 hover:text-red-500"><X size={13} /></button>
              </div>
            ))}
          </section>
        )}

        {/* Pinned */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Pin size={14} className="text-slate-500" />
              <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">Pinned Initiatives</span>
              <span className="text-[10px] text-slate-400">— always visible across sessions</span>
            </div>
            <button onClick={() => {
                const idStr = prompt("Enter Initiative ID to pin:");
                if (!idStr) return;
                const id = parseInt(idStr.replace("#","").trim());
                if (isNaN(id)) return;
                if (!store.pinned.find((p) => p.id === id && p.connectorId === activeConn.id)) {
                  const updated = { ...store, pinned: [...store.pinned, { id, connectorId: activeConn.id }] };
                  saveStore(updated); setStore(updated); loadOne(activeConn.id, id, "pinned");
                }
              }}
              className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg text-white shadow-sm"
              style={{ background: activeConn.accent }}>
              <Plus size={12} />Pin Initiative
            </button>
          </div>

          {activePinned.length === 0 ? (
            <div className="flex flex-col items-center py-16 gap-3 border-2 border-dashed border-slate-200 rounded-2xl">
              <Pin size={24} className="text-slate-300" />
              <p className="text-sm font-semibold text-slate-400">No pinned initiatives yet</p>
              <p className="text-xs text-slate-400 text-center max-w-xs">Search by Initiative ID above, then pin it — or click Pin Initiative to add directly.</p>
            </div>
          ) : (
            activePinned.map((pi) => {
              const key = `${pi.connectorId}:${pi.id}`;
              if (loadingKeys[key]) return (
                <div key={key} className="bg-white border border-slate-200 rounded-2xl p-6 mb-4 shadow-sm">
                  <div className="flex items-center gap-3">
                    <Loader2 size={16} className="animate-spin" style={{ color: activeConn.accent }} />
                    <span className="text-sm font-semibold text-slate-600">Loading Initiative #{pi.id}…</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1 ml-7">Fetching all features and stories…</p>
                </div>
              );
              if (errorKeys[key]) return (
                <div key={key} className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4 flex items-start gap-3">
                  <AlertCircle size={15} className="text-red-400 mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-red-700">Failed #{pi.id}</p>
                    <p className="text-xs text-red-500 mt-0.5">{errorKeys[key]}</p>
                    <div className="flex gap-2 mt-2">
                      <button onClick={() => loadOne(pi.connectorId, pi.id, "pinned")} className="text-xs px-2.5 py-1 bg-red-100 text-red-700 rounded-lg border border-red-200 hover:bg-red-200">Retry</button>
                      <button onClick={() => removePinned(pi.connectorId, pi.id)} className="text-xs px-2.5 py-1 text-slate-500 rounded-lg border border-slate-200 hover:bg-slate-100">Unpin</button>
                    </div>
                  </div>
                </div>
              );
              if (!pinnedData[key]) return null;
              return (
                <InitiativePanel key={key} initiative={pinnedData[key]}
                  accent={activeConn.accent} mode="pinned" isPinned={true}
                  onRemove={() => removePinned(pi.connectorId, pi.id)} />
              );
            })
          )}
        </section>
      </main>

      <footer className="max-w-screen-xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between text-[10px] text-slate-400">
        <span>ADO Feature Dashboard · Thomson Reuters TaxProf</span>
        <div className="flex items-center gap-1"><CheckCircle2 size={10} className="text-green-500" /><span>Pinned saved locally · Search is session-only</span></div>
      </footer>
    </div>
  );
}
