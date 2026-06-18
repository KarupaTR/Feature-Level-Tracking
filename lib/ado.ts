export interface ADOConfig {
  org: string;
  project: string;
  pat: string;
}

export interface UserStory {
  id: number;
  title: string;
  state: string;
  areaPath: string;       // story's OWN area path — never inherited from feature
  iterationPath: string;  // story's OWN iteration path
  assignedTo: string;
  storyPoints?: number;
  tags?: string;
  workItemType: string;
  piReleaseDate?: string;
  createdDate: string;
  changedDate: string;
  url: string;
}

export interface FeatureDetail {
  id: number;
  title: string;
  state: string;
  areaPath: string;
  iterationPath: string;
  assignedTo: string;
  piReleaseDate?: string;
  tags?: string;
  priority?: number;
  userStories: UserStory[];
  url: string;
}

export interface InitiativeDetail {
  id: number;
  title: string;
  state: string;
  areaPath: string;
  iterationPath: string;
  assignedTo: string;
  piReleaseDate?: string;
  tags?: string;
  description?: string;
  features: FeatureDetail[];
  url: string;
}

export interface IterationStats {
  total: number;
  closed: number;    // Closed + Resolved + Done + Removed
  active: number;    // Active + In Progress
  newCount: number;  // New + To Do (not Ready)
  readyCount: number;// Ready only
  other: number;     // anything else
  stories: UserStory[];
}

export interface AreaPathSummary {
  areaPath: string;     // full exact path from story's System.AreaPath
  leafName: string;     // last segment only
  total: number;
  closed: number;
  active: number;
  newCount: number;
  readyCount: number;
  other: number;
  stories: UserStory[];
  iterations: Record<string, IterationStats>;
}

// ── Work item type filter ────────────────────────────────────────────────────
// Only User Stories and Investigation Tasks are shown in the dashboard.
// "Investigation" tasks are Task work items whose title starts with "Investigation"
// (case-insensitive) — matching ADO convention.
export function isIncludedType(workItemType: string, title: string): boolean {
  if (workItemType === "User Story") return true;
  if (workItemType === "Task" && title.toLowerCase().startsWith("investigation")) return true;
  return false;
}

// ── State classifier — single source of truth ─────────────────────────────────
// Removed counts as Closed per product requirement.
// New and Ready are tracked separately for the stat bifurcation.
export function classifyState(state: string): "closed" | "active" | "new" | "ready" | "other" {
  if (["Closed", "Resolved", "Done", "Removed"].includes(state)) return "closed";
  if (["Active", "In Progress"].includes(state))                  return "active";
  if (state === "Ready")                                           return "ready";
  if (["New", "To Do"].includes(state))                           return "new";
  return "other";
}

// ── ADO helpers ───────────────────────────────────────────────────────────────
function b64(pat: string) { return btoa(`:${pat}`); }

function extractName(val: unknown): string {
  if (!val) return "Unassigned";
  if (typeof val === "string") return val;
  if (typeof val === "object" && val !== null && "displayName" in val)
    return (val as { displayName: string }).displayName;
  return String(val);
}

async function fetchWorkItemsBatch(
  config: ADOConfig,
  ids: number[]
): Promise<Record<string, unknown>[]> {
  if (ids.length === 0) return [];
  const headers = {
    Authorization: `Basic ${b64(config.pat)}`,
    "Content-Type": "application/json",
  };
  const base = `https://dev.azure.com/${config.org}/${config.project}/_apis`;
  const results: Record<string, unknown>[] = [];
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200);
    const res = await fetch(
      `${base}/wit/workitems?ids=${chunk.join(",")}&$expand=fields&api-version=7.1`,
      { headers }
    );
    if (!res.ok) continue;
    const data = await res.json();
    results.push(...(data.value || []));
  }
  return results;
}

async function fetchChildIds(
  config: ADOConfig,
  parentId: number,
  childTypes: string[]
): Promise<number[]> {
  const headers = {
    Authorization: `Basic ${b64(config.pat)}`,
    "Content-Type": "application/json",
  };
  const base = `https://dev.azure.com/${config.org}/${config.project}/_apis`;
  const typeList = childTypes.map((t) => `'${t}'`).join(",");
  const res = await fetch(`${base}/wit/wiql?api-version=7.1`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      query: `SELECT [System.Id] FROM WorkItemLinks
        WHERE [Source].[System.Id] = ${parentId}
          AND [System.Links.LinkType] = 'System.LinkTypes.Hierarchy-Forward'
          AND [Target].[System.WorkItemType] IN (${typeList})
        MODE (MustContain)`,
    }),
  });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.workItemRelations || [])
    .filter((r: { target?: { id?: number } }) => r.target?.id)
    .map((r: { target: { id: number } }) => r.target.id);
}

// IMPORTANT: We read System.AreaPath and System.IterationPath from the story's
// OWN fields — NOT from its parent feature. This ensures Maple stories that live
// under isquad features but have their own area path appear in their correct group.
function mapToUserStory(item: Record<string, unknown>, config: ADOConfig): UserStory {
  const f = item.fields as Record<string, unknown>;
  return {
    id: item.id as number,
    title: (f["System.Title"] as string) || "",
    state: (f["System.State"] as string) || "",
    areaPath: (f["System.AreaPath"] as string) || "",          // story's own area path
    iterationPath: (f["System.IterationPath"] as string) || "", // story's own iteration
    assignedTo: extractName(f["System.AssignedTo"]),
    storyPoints: f["Microsoft.VSTS.Scheduling.StoryPoints"] as number | undefined,
    tags: f["System.Tags"] as string | undefined,
    workItemType: (f["System.WorkItemType"] as string) || "User Story",
    piReleaseDate: (f["Custom.PI_ReleaseDate"] || f["Custom.PIReleaseDate"]) as string | undefined,
    createdDate: (f["System.CreatedDate"] as string) || "",
    changedDate: (f["System.ChangedDate"] as string) || "",
    url: `https://dev.azure.com/${config.org}/${config.project}/_workitems/edit/${item.id}`,
  };
}

// ── Main fetch: Initiative → Features → Stories ───────────────────────────────
export async function fetchInitiative(
  config: ADOConfig,
  initiativeId: number
): Promise<InitiativeDetail> {
  const headers = {
    Authorization: `Basic ${b64(config.pat)}`,
    "Content-Type": "application/json",
  };
  const base = `https://dev.azure.com/${config.org}/${config.project}/_apis`;

  const initRes = await fetch(
    `${base}/wit/workitems/${initiativeId}?$expand=all&api-version=7.1`,
    { headers }
  );
  if (!initRes.ok)
    throw new Error(`Initiative #${initiativeId} not found (${initRes.status})`);
  const initWi = await initRes.json();
  const initF = initWi.fields;

  const featureIds = await fetchChildIds(config, initiativeId, ["Feature"]);
  const featureItems = await fetchWorkItemsBatch(config, featureIds);

  const features: FeatureDetail[] = await Promise.all(
    featureItems.map(async (fi) => {
      const fFields = fi.fields as Record<string, unknown>;
      const storyIds = await fetchChildIds(config, fi.id as number, [
        "User Story", "Task", "Bug",
      ]);
      const storyItems = await fetchWorkItemsBatch(config, storyIds);
      return {
        id: fi.id as number,
        title: (fFields["System.Title"] as string) || "",
        state: (fFields["System.State"] as string) || "",
        areaPath: (fFields["System.AreaPath"] as string) || "",
        iterationPath: (fFields["System.IterationPath"] as string) || "",
        assignedTo: extractName(fFields["System.AssignedTo"]),
        piReleaseDate: (fFields["Custom.PI_ReleaseDate"] ||
          fFields["Custom.PIReleaseDate"]) as string | undefined,
        tags: fFields["System.Tags"] as string | undefined,
        priority: fFields["Microsoft.VSTS.Common.Priority"] as number | undefined,
        // Each story mapped using its OWN System.AreaPath and System.IterationPath
        userStories: storyItems.map((si) => mapToUserStory(si, config)),
        url: `https://dev.azure.com/${config.org}/${config.project}/_workitems/edit/${fi.id}`,
      };
    })
  );

  return {
    id: initiativeId,
    title: initF["System.Title"] || "",
    state: initF["System.State"] || "",
    areaPath: initF["System.AreaPath"] || "",
    iterationPath: initF["System.IterationPath"] || "",
    assignedTo: extractName(initF["System.AssignedTo"]),
    piReleaseDate: initF["Custom.PI_ReleaseDate"] || initF["Custom.PIReleaseDate"],
    tags: initF["System.Tags"],
    description: initF["System.Description"],
    features,
    url: `https://dev.azure.com/${config.org}/${config.project}/_workitems/edit/${initiativeId}`,
  };
}

// ── Area path summary ─────────────────────────────────────────────────────────
// Each story is bucketed by its OWN area path (System.AreaPath on the story
// work item itself). A Maple story under an isquad feature will appear under
// its own Maple area path, NOT under isquad.
export function buildAreaPathSummaries(features: FeatureDetail[]): AreaPathSummary[] {
  const map = new Map<string, AreaPathSummary>();

  for (const feature of features) {
    for (const story of feature.userStories) {
      // Only include User Stories and Investigation Tasks
      if (!isIncludedType(story.workItemType, story.title)) continue;

      // Use the story's own area path — this is the key fix for Maple/isquad mixing
      const ap   = story.areaPath || "Unknown";
      const leaf = ap.split("\\").pop() || ap;
      const iter = story.iterationPath.split("\\").pop() || story.iterationPath || "No Iteration";
      const cls  = classifyState(story.state);

      if (!map.has(ap)) {
        map.set(ap, {
          areaPath: ap, leafName: leaf,
          total: 0, closed: 0, active: 0, newCount: 0, readyCount: 0, other: 0,
          stories: [], iterations: {},
        });
      }
      const entry = map.get(ap)!;
      entry.total++;
      entry.stories.push(story);
      if      (cls === "closed") entry.closed++;
      else if (cls === "active") entry.active++;
      else if (cls === "ready")  entry.readyCount++;
      else if (cls === "new")    entry.newCount++;
      else                       entry.other++;

      if (!entry.iterations[iter]) {
        entry.iterations[iter] = {
          total: 0, closed: 0, active: 0, newCount: 0, readyCount: 0, other: 0, stories: [],
        };
      }
      const it = entry.iterations[iter];
      it.total++;
      it.stories.push(story);
      if      (cls === "closed") it.closed++;
      else if (cls === "active") it.active++;
      else if (cls === "ready")  it.readyCount++;
      else if (cls === "new")    it.newCount++;
      else                       it.other++;
    }
  }

  return Array.from(map.values()).sort((a, b) => b.total - a.total);
}

// ── State display ─────────────────────────────────────────────────────────────
export const STATE_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  New:           { bg: "bg-slate-100",  text: "text-slate-600",  dot: "bg-slate-400"  },
  Active:        { bg: "bg-blue-50",    text: "text-blue-700",   dot: "bg-blue-500"   },
  "In Progress": { bg: "bg-blue-50",    text: "text-blue-700",   dot: "bg-blue-500"   },
  Resolved:      { bg: "bg-green-50",   text: "text-green-700",  dot: "bg-green-500"  },
  Closed:        { bg: "bg-gray-100",   text: "text-gray-500",   dot: "bg-gray-400"   },
  Done:          { bg: "bg-green-50",   text: "text-green-700",  dot: "bg-green-500"  },
  Removed:       { bg: "bg-gray-100",   text: "text-gray-400",   dot: "bg-gray-300"   },
  Ready:         { bg: "bg-violet-50",  text: "text-violet-700", dot: "bg-violet-400" },
  "To Do":       { bg: "bg-slate-100",  text: "text-slate-600",  dot: "bg-slate-400"  },
};

export const TYPE_PILL: Record<string, string> = {
  "User Story": "bg-indigo-50 text-indigo-600 border border-indigo-100",
  Task:         "bg-amber-50  text-amber-600  border border-amber-100",
  Bug:          "bg-red-50    text-red-600    border border-red-100",
  Feature:      "bg-orange-50 text-orange-600 border border-orange-100",
};
