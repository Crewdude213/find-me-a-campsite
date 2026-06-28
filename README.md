# find-me-a-campsite

A Cloudflare Worker that lets Claude check real-time campsite availability on **Recreation.gov** (federal lands) and **ReserveCalifornia** (state parks). Comes preloaded with the California coastal corridor from Bodega Bay down to Big Sur.

---

## What you need before you start

1. **Node.js** installed on your computer. Open Terminal and type `node -v`. If you get a version number (like `v20.10.0`), you're good. If you get "command not found," install it from https://nodejs.org (pick the LTS button).
2. **A free Cloudflare account.** Sign up at https://dash.cloudflare.com/sign-up if you don't have one.
3. **A free GitHub account** (optional, only if you want to put this in a repo). Sign up at https://github.com.

That's it. No credit card, no paid plans.

---

## Step-by-step deploy (10 minutes)

### 1. Open the project folder in Terminal

Unzip `find-me-a-campsite.zip` somewhere you'll remember (Documents is fine). Then in Terminal:

```bash
cd ~/Documents/find-me-a-campsite
```

(Change the path to wherever you put it.)

### 2. Install the project's dependencies

```bash
npm install
```

This downloads the tools the worker needs. It'll take a minute. When it's done, you'll see a new `node_modules` folder — that's normal, ignore it.

### 3. Log in to Cloudflare

```bash
npx wrangler login
```

A browser tab opens. Click **Allow**. Close the tab when it says success.

### 4. Deploy

```bash
npm run deploy
```

When this finishes, you'll see a line like:

```
Published find-me-a-campsite (X.XX sec)
  https://find-me-a-campsite.YOUR-SUBDOMAIN.workers.dev
```

**Copy that URL.** That's your worker.

---

## Connect it to Claude (2 minutes)

1. Go to **Claude.ai → Settings → Connectors → Add custom connector**
2. **Name:** `find-me-a-campsite`
3. **URL:** the URL you copied, with `/mcp` added to the end. Like this:
   ```
   https://find-me-a-campsite.YOUR-SUBDOMAIN.workers.dev/mcp
   ```
4. Click **Save**.

Done. Ask Claude something like:

> "Find me a Bodega Dunes site for July 10–12."

Claude will call `lookup_facility_id` to find the right ID, then `find_campsite_reserve_california` to check availability.

---

## What's inside

```
find-me-a-campsite/
├── src/
│   ├── index.ts              ← MCP server, 4 tools, worker entry
│   ├── recreationgov.ts      ← Federal lands availability check
│   ├── reservecalifornia.ts  ← CA State Parks availability check
│   └── known-facilities.ts   ← Preloaded coastal corridor
├── package.json              ← Project dependencies
├── wrangler.toml             ← Cloudflare worker config
├── tsconfig.json             ← TypeScript config
├── .gitignore
└── README.md                 ← You are here
```

**Four tools exposed to Claude:**

1. `find_campsite_recreation_gov` — check a federal campground
2. `find_campsite_reserve_california` — check a CA state park
3. `lookup_facility_id` — find the right ID by park name
4. `list_known_facilities` — dump the whole preloaded corridor

**Preloaded corridor:** Bodega Dunes, Wright's Beach, Pomo Canyon, Salt Point, Russian Gulch, Van Damme, Manchester, MacKerricher, Plaskett Creek, Kirk Creek, Nadelos, Wailaki.

---

## If you want to put this on GitHub

After deploying (or before — doesn't matter), in the project folder:

```bash
git init
git add .
git commit -m "Initial commit"
```

Then go to https://github.com/new, create an empty repo called `find-me-a-campsite`, **don't** check any of the "initialize with" boxes. GitHub shows you two lines like:

```bash
git remote add origin https://github.com/YOUR-USERNAME/find-me-a-campsite.git
git branch -M main
git push -u origin main
```

Paste those into Terminal. Done.

---

## Updating the worker later

After any code change:

```bash
npm run deploy
```

The URL stays the same — Claude keeps working without changes.

---

## Known limitations

- **Both provider endpoints are unofficial.** They've been stable for years (the same calls power the official websites) but aren't contractually guaranteed.
- **A few `VERIFY` flags** in `known-facilities.ts` mark IDs that were community-sourced best guesses. To confirm, open the park's page on reservecalifornia.com or recreation.gov, open browser dev tools (F12) → Network tab, click a date, and watch which `FacilityId` or facility number is sent.
- **Sonoma County Regional Parks** (Doran, Stillwater Cove) use a separate booking system and aren't covered.

---

## Troubleshooting

**`wrangler: command not found`** → You skipped `npm install`. Run it.

**`Authentication error` during deploy** → Run `npx wrangler login` again.

**Claude says the connector isn't responding** → Visit your worker URL with `/health` on the end (e.g. `https://find-me-a-campsite.YOUR-SUBDOMAIN.workers.dev/health`). You should see a small JSON message. If you don't, the deploy didn't finish — run `npm run deploy` again.

**Recreation.gov returns 403** → The User-Agent header got stripped somewhere. The code already sets one; if you edited `recreationgov.ts`, double-check it's still there.
