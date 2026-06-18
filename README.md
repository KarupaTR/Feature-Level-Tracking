# ADO Feature Dashboard

A Next.js dashboard for Product Managers to track Azure DevOps features and user stories — with **pinned features** that stay visible across sessions.

## Features

- 📌 **Pin any feature** to keep it always visible at the top (persists across page reloads via localStorage)
- 🔄 Refresh pinned features independently
- 📋 View user stories per feature with Area Path, Iteration Path, Release Date, State, and Assignee
- 🔍 Filter by state and assignee
- 📊 Summary stats (total features, active, resolved, closed)
- 🗂️ Pre-loaded with all ADO projects from your organization

---

## Deploy to Vercel via GitHub

### 1. Create a GitHub repository

```bash
git init
git add .
git commit -m "Initial commit"
gh repo create ado-feature-dashboard --public --source=. --push
# or manually push to your GitHub org
```

### 2. Import into Vercel

1. Go to [vercel.com/new](https://vercel.com/new)
2. Click **Import Git Repository**
3. Select your `ado-feature-dashboard` repo
4. Framework will auto-detect as **Next.js**
5. Click **Deploy**

No environment variables are required — the app calls the Anthropic API client-side using the MCP connector already authenticated in your Claude session.

### 3. Deploy via V0 (Vercel's AI platform)

1. Go to [v0.dev](https://v0.dev)
2. Click **Deploy** → **Import from GitHub**
3. Select this repo and deploy

---

## Local Development

```bash
npm install
npm run dev
# open http://localhost:3000
```

---

## How Pinning Works

- Click the **pin icon** (📌) on any feature card to pin it
- Pinned features appear in a dedicated **"Pinned features"** section at the top of every page load
- Pins are stored in `localStorage` — they persist across sessions in the same browser
- Click the **X** on a pinned card to unpin it
- Click **↻** to refresh the stories for a pinned feature

---

## Project Structure

```
ado-dashboard/
├── app/
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── Avatar.tsx          # Initials avatar
│   ├── Dashboard.tsx       # Main dashboard shell
│   ├── FeatureCard.tsx     # Expandable feature row with pin button
│   ├── PinnedSection.tsx   # Always-visible pinned features panel
│   ├── StateBadge.tsx      # Colored state pill
│   └── StoriesTable.tsx    # User stories table
├── lib/
│   ├── ado.ts              # ADO API helpers
│   └── projects.ts         # Pre-loaded project list
├── vercel.json
└── README.md
```

---

## Customisation

**Add more projects**: Edit `lib/projects.ts` and add entries to the `ADO_PROJECTS` array.

**Change default project**: In `components/Dashboard.tsx`, set the initial state:
```ts
const [project, setProject] = useState("TaxProf");
```

**Persist pins server-side**: Replace the `localStorage` calls in `Dashboard.tsx` with a fetch to a `/api/pins` route backed by a database (e.g. Vercel KV or PlanetScale).
