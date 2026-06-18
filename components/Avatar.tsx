export function Avatar({ name }: { name: string }) {
  const clean = name.replace(/<[^>]+>/g, "").trim();
  const parts = clean.split(/\s+/);
  const initials = parts
    .slice(0, 2)
    .map((p) => p[0] ?? "")
    .join("")
    .toUpperCase();

  return (
    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-medium flex-shrink-0">
      {initials || "?"}
    </span>
  );
}
