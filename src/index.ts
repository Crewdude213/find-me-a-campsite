// find-me-a-campsite MCP server (Cloudflare Worker)
//
// Exposes 4 tools to Claude:
//   1. find_campsite_recreation_gov     — federal lands availability
//   2. find_campsite_reserve_california — CA State Parks availability
//   3. lookup_facility_id               — search preloaded corridor by name
//   4. list_known_facilities            — dump the preloaded corridor table
//
// Endpoints:
//   /mcp  — streamable HTTP (Claude.ai custom connector URL)
//   /sse  — SSE fallback

import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { checkRecreationGov } from "./recreationgov";
import { checkReserveCalifornia } from "./reservecalifornia";
import { KNOWN_FACILITIES, findFacilityByName } from "./known-facilities";

export class FindMeACampsiteMCP extends McpAgent {
  server = new McpServer({
    name: "find-me-a-campsite",
    version: "1.0.0",
  });

  async init() {
    // --- Tool 1: Recreation.gov availability -------------------------------
    this.server.tool(
      "find_campsite_recreation_gov",
      "Check Recreation.gov (federal lands) availability for a specific campground facility ID, start date, and number of nights. Returns a list of sites available for the entire stay.",
      {
        facility_id: z.string().describe("Recreation.gov facility ID, e.g. '234077' for Plaskett Creek"),
        start_date: z.string().describe("Check-in date in YYYY-MM-DD format"),
        nights: z.number().int().min(1).max(30).describe("Number of nights"),
      },
      async ({ facility_id, start_date, nights }) => {
        try {
          const result = await checkRecreationGov(facility_id, start_date, nights);
          return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          };
        } catch (err) {
          return {
            content: [
              { type: "text", text: `Error: ${(err as Error).message}` },
            ],
            isError: true,
          };
        }
      }
    );

    // --- Tool 2: ReserveCalifornia availability ----------------------------
    this.server.tool(
      "find_campsite_reserve_california",
      "Check ReserveCalifornia (CA State Parks) availability for a specific facility ID, start date, and number of nights. Returns a list of units available for the entire stay.",
      {
        facility_id: z.string().describe("ReserveCalifornia FacilityId, e.g. '1075' for Bodega Dunes"),
        start_date: z.string().describe("Check-in date in YYYY-MM-DD format"),
        nights: z.number().int().min(1).max(30).describe("Number of nights"),
      },
      async ({ facility_id, start_date, nights }) => {
        try {
          const result = await checkReserveCalifornia(facility_id, start_date, nights);
          return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          };
        } catch (err) {
          return {
            content: [
              { type: "text", text: `Error: ${(err as Error).message}` },
            ],
            isError: true,
          };
        }
      }
    );

    // --- Tool 3: lookup_facility_id ---------------------------------------
    this.server.tool(
      "lookup_facility_id",
      "Search the preloaded California coastal corridor table by park name or region. Returns matching facilities with their provider and facility ID so they can be passed to the availability tools.",
      {
        query: z.string().describe("Park name or region, e.g. 'Bodega', 'Big Sur', 'MacKerricher'"),
      },
      async ({ query }) => {
        const matches = findFacilityByName(query);
        return {
          content: [{ type: "text", text: JSON.stringify(matches, null, 2) }],
        };
      }
    );

    // --- Tool 4: list_known_facilities ------------------------------------
    this.server.tool(
      "list_known_facilities",
      "Return the full preloaded California coastal corridor table — every known campground with its provider, facility ID, and region.",
      {},
      async () => ({
        content: [{ type: "text", text: JSON.stringify(KNOWN_FACILITIES, null, 2) }],
      })
    );
  }
}

// --- Worker entry: route /mcp and /sse to the Durable Object --------------
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/mcp" || url.pathname.startsWith("/mcp/")) {
      return FindMeACampsiteMCP.serve("/mcp").fetch(request, env, ctx);
    }

    if (url.pathname === "/sse" || url.pathname.startsWith("/sse/")) {
      return FindMeACampsiteMCP.serveSSE("/sse").fetch(request, env, ctx);
    }

    if (url.pathname === "/" || url.pathname === "/health") {
      return new Response(
        JSON.stringify({
          name: "find-me-a-campsite",
          status: "ok",
          endpoints: ["/mcp", "/sse"],
        }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response("Not found", { status: 404 });
  },
};

interface Env {
  MCP_OBJECT: DurableObjectNamespace;
}
