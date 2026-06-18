"use client";
import { ADOStory } from "@/lib/ado";
import { StateBadge } from "./StateBadge";
import { Avatar } from "./Avatar";

function shortPath(p: string) {
  if (!p) return "—";
  const parts = p.split("\\");
  return parts.length > 2 ? `…\\${parts.slice(-2).join("\\")}` : p;
}

function fmtDate(d: string | null) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" });
  } catch { return d; }
}

export function StoriesTable({ stories }: { stories: ADOStory[] }) {
  if (!stories.length)
    return <p className="px-4 py-3 text-sm text-gray-400">No user stories found.</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="bg-white border-b border-gray-100">
            {["ID", "Title", "Area path", "Iteration path", "Release", "State", "Assigned to"].map((h) => (
              <th key={h} className="px-3 py-2 text-left font-medium text-gray-400 whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {stories.map((s, i) => (
            <tr key={s.id} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
              <td className="px-3 py-2 text-blue-600 font-medium whitespace-nowrap">#{s.id}</td>
              <td className="px-3 py-2 max-w-[200px] truncate" title={s.title}>{s.title}</td>
              <td className="px-3 py-2 max-w-[140px] truncate text-gray-500" title={s.areaPath}>{shortPath(s.areaPath)}</td>
              <td className="px-3 py-2 max-w-[140px] truncate text-gray-500" title={s.iterationPath}>{shortPath(s.iterationPath)}</td>
              <td className="px-3 py-2 whitespace-nowrap text-gray-500">{fmtDate(s.releaseDate)}</td>
              <td className="px-3 py-2"><StateBadge state={s.state} /></td>
              <td className="px-3 py-2">
                <div className="flex items-center gap-1.5">
                  {s.assignedTo && <Avatar name={s.assignedTo} />}
                  <span className="truncate max-w-[100px] text-gray-700" title={s.assignedTo}>
                    {s.assignedTo ? s.assignedTo.replace(/<[^>]+>/g, "").split(" ").slice(0, 2).join(" ") : "—"}
                  </span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
