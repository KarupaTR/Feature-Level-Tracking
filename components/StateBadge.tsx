import clsx from "clsx";

const STATE_STYLES: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  resolved: "bg-amber-100 text-amber-800",
  closed: "bg-gray-100 text-gray-600",
  new: "bg-blue-100 text-blue-800",
};

export function StateBadge({ state }: { state: string }) {
  const key = (state || "new").toLowerCase();
  return (
    <span
      className={clsx(
        "inline-block px-2 py-0.5 rounded-full text-xs font-medium",
        STATE_STYLES[key] ?? STATE_STYLES.new
      )}
    >
      {state || "New"}
    </span>
  );
}
