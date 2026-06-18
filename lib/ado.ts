export interface ADOProject {
  id: string;
  name: string;
  description?: string;
}

export interface ADOFeature {
  id: number;
  title: string;
  state: string;
  assignedTo: string;
  areaPath: string;
  iterationPath: string;
  releaseDate: string | null;
  stories?: ADOStory[];
}

export interface ADOStory {
  id: number;
  title: string;
  state: string;
  assignedTo: string;
  areaPath: string;
  iterationPath: string;
  releaseDate: string | null;
}

export interface PinnedFeature {
  id: number;
  title: string;
  project: string;
  pinnedAt: string;
}

function parseWorkItems(data: Record<string, unknown>): ADOFeature[] | ADOStory[] {
  const content = (data.content as Array<{ type: string; text?: string; content?: Array<{ text: string }> }>) || [];

  // Try text blocks first
  for (const block of content) {
    if (block.type === "text" && block.text) {
      try {
        const clean = block.text.replace(/```json|```/g, "").trim();
        const parsed = JSON.parse(clean);
        if (parsed.features) return parsed.features;
        if (parsed.stories) return parsed.stories;
      } catch { /* fall through */ }
    }
  }

  // Try mcp_tool_result blocks
  for (const block of content) {
    if (block.type === "mcp_tool_result" && block.content?.[0]?.text) {
      try {
        const parsed = JSON.parse(block.content[0].text);
        const wis: Array<Record<string, unknown>> = parsed.workItems || parsed.value || [];
        return wis.map((w) => ({
          id: (w.id || w.fields?.["System.Id"]) as number,
          title: (w.fields?.["System.Title"] || String(w.id)) as string,
          state: (w.fields?.["System.State"] || "") as string,
          assignedTo: (
            (w.fields?.["System.AssignedTo"] as Record<string, string>)?.displayName ||
            (w.fields?.["System.AssignedTo"] as string) || ""
          ),
          areaPath: (w.fields?.["System.AreaPath"] || "") as string,
          iterationPath: (w.fields?.["System.IterationPath"] || "") as string,
          releaseDate: (w.fields?.["Microsoft.VSTS.Scheduling.TargetDate"] || null) as string | null,
        }));
      } catch { /* fall through */ }
    }
  }
  return [];
}

export async function fetchFeatures(project: string, featureHint?: string): Promise<ADOFeature[]> {
  const where = featureHint
    ? isNaN(Number(featureHint))
      ? `AND [System.Title] CONTAINS '${featureHint.replace(/'/g, "''")}'`
      : `AND [System.Id] = ${featureHint}`
    : "";

  const wiql = `SELECT [System.Id],[System.Title],[System.State],[System.AssignedTo],[System.AreaPath],[System.IterationPath],[Microsoft.VSTS.Scheduling.TargetDate] FROM WorkItems WHERE [System.TeamProject] = '${project}' AND [System.WorkItemType] = 'Feature' ${where} ORDER BY [System.ChangedDate] DESC`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      system: `You are an Azure DevOps assistant. Execute the WIQL using ado-tr-tax MCP. Return ONLY JSON: {"features": [{"id": number, "title": string, "state": string, "assignedTo": string, "areaPath": string, "iterationPath": string, "releaseDate": string|null}]}`,
      messages: [{ role: "user", content: `Project: '${project}'. WIQL: ${wiql}` }],
      mcp_servers: [{ type: "url", url: "https://dev.azure.com", name: "ado-tr-tax" }],
    }),
  });
  const data = await res.json();
  return parseWorkItems(data) as ADOFeature[];
}

export async function fetchStories(project: string, featureId: number): Promise<ADOStory[]> {
  const wiql = `SELECT [System.Id],[System.Title],[System.State],[System.AssignedTo],[System.AreaPath],[System.IterationPath],[Microsoft.VSTS.Scheduling.TargetDate] FROM WorkItemLinks WHERE [Source].[System.Id] = ${featureId} AND [System.Links.LinkType] = 'System.LinkTypes.Hierarchy-Forward' AND [Target].[System.WorkItemType] = 'User Story' MODE (MustContain)`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      system: `You are an Azure DevOps assistant. Execute the WIQL using ado-tr-tax MCP. Return ONLY JSON: {"stories": [{"id": number, "title": string, "state": string, "assignedTo": string, "areaPath": string, "iterationPath": string, "releaseDate": string|null}]}`,
      messages: [{ role: "user", content: `Project: '${project}'. WIQL: ${wiql}` }],
      mcp_servers: [{ type: "url", url: "https://dev.azure.com", name: "ado-tr-tax" }],
    }),
  });
  const data = await res.json();
  return parseWorkItems(data) as ADOStory[];
}
