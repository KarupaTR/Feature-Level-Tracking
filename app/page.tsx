import { readFileSync } from "fs";
import { join } from "path";

export default function Home() {
  // Read the dashboard HTML and inject PATs from env vars at build time
  const dashboardPath = join(process.cwd(), "public", "dashboard.html");
  let html = readFileSync(dashboardPath, "utf-8");
  
  // Replace placeholders with actual PAT values from environment
  const patTrTax = process.env.NEXT_PUBLIC_ADO_PAT_TR_TAX || "";
  const patTrDefault = process.env.NEXT_PUBLIC_ADO_PAT_TR_TAX_DEFAULT || "";
  
  html = html.replace("__NEXT_PUBLIC_ADO_PAT_TR_TAX__", patTrTax);
  html = html.replace("__NEXT_PUBLIC_ADO_PAT_TR_TAX_DEFAULT__", patTrDefault);
  
  return (
    <div dangerouslySetInnerHTML={{ __html: html }} />
  );
}
