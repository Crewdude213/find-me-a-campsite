# find-me-a-campsite — Claude Code Project Brief

A Cloudflare Worker MCP server that lets Claude check real-time campsite
availability on **Recreation.gov** (federal) and **ReserveCalifornia** (state).
Preloaded with the California coastal corridor from Bodega Bay to Big Sur.

In Brent's architecture this is also the **canonical reference pattern** for
Cloudflare Worker MCPs — new MCP projects start from this layout.

## Stack
- **Language:** TypeScript
- **Runtime:** Cloudflare Worker
- **MCP transport:** Durable Object (`MCP_OBJECT` binding, `FindMeACampsiteMCP` class)
- **Endpoints:** `/mcp` (streamable HTTP) + `/sse` (SSE fallback)
- **Deps:** `agents/mcp` (the `McpAgent` base), `@modelcontextprotocol/sdk`, `zod`
- **Deploy:** `npm run deploy` → `wrangler deploy`

## Layout
```
src/
  index.ts              # MCP server class + tool registrations
  recreationgov.ts      # Recreation.gov API client
  reservecalifornia.ts  # ReserveCalifornia API client
  known-facilities.ts   # Preloaded facility lookup table (Bodega → Big Sur)
wrangler.toml           # Worker config + DO binding + SQLite migration
package.json            # Scripts: dev / deploy / typecheck
README.md               # End-user deployment walkthrough (Brent reads this)
```

## Current tools (4)
1. `find_campsite_recreation_gov` — federal lands availability for facility ID + dates
2. `find_campsite_reserve_california` — CA State Parks availability
3. `lookup_facility_id` — search preloaded corridor by name
4. `list_known_facilities` — dump the corridor table

## Rules

### Adding a new tool
- Register inside `init()` in `src/index.ts` via `this.server.tool(name, description, schema, handler)`.
- The **description string is for Claude to read** — be specific about when to call it. Bad: "Check campsites." Good: "Check Recreation.gov availability for a specific facility ID, start date, and number of nights."
- Input schemas always use `zod`. Include `.describe()` on each field — it surfaces in tool docs.
- Return the SDK-standard `{ content: [{ type: 'text', text: ... }] }` shape.

### Adding a new data source
- One file per source under `src/` (mirror `recreationgov.ts` / `reservecalifornia.ts`).
- Export a single async function the tool handler can call. Don't leak fetch internals.
- Throw on hard failures; return structured `{ ok: false, reason }` on soft failures.
- API keys go in `wrangler secret put`, never in code.

### Adding a new known facility
- Edit `known-facilities.ts`. Add to the `KNOWN_FACILITIES` array.
- Each entry needs: name, source (`recreation_gov` | `reserve_california`), facility id, lat/lng, notes.
- `findFacilityByName` does a fuzzy lookup — keep names canonical so it works.

### Preserving the canonical pattern
- This repo is the reference. Other MCPs (weather, brief data fetchers, etc.) start by copying this structure.
- Structural changes (file layout, McpAgent pattern, endpoint shape) should be made deliberately — they ripple to downstream repos that were scaffolded from this.
- If a real-world MCP needs a different pattern, fork the pattern there — don't bend this one to fit a one-off case.

### Endpoints — don't break either
- Claude.ai custom connectors expect `/mcp`. Some clients fall back to `/sse`. Keep both wired.
- `compatibility_flags = ["nodejs_compat"]` in `wrangler.toml` is required for the SDK to load — don't remove.

## Test before deploy
- `npm run typecheck` — TS errors block deploy.
- `npm run dev` → hit it from Claude Desktop's custom connector with the local URL.
- `npm run deploy` — only after the above is clean. Wrangler will print the worker URL.

## Don't
- Don't hand-roll MCP transport — use `McpAgent` from `agents/mcp`.
- Don't add a framework (Hono, etc.) — template stays minimal so it's copyable.
- Don't store API keys or facility tokens in code. `wrangler secret put` only.
- Don't change the Durable Object class name (`FindMeACampsiteMCP`) without a migration — `wrangler.toml` migrations track the class.

## When changing the template itself
1. Bump the version in `package.json` and `index.ts` `McpServer` constructor.
2. Note breaking changes in README.
3. List downstream MCP repos that should adopt the pattern change.
