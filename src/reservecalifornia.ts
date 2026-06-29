// ReserveCalifornia (CA State Parks) availability provider.
//
// Endpoint (unofficial but stable):
//   POST https://calirdr.usedirect.com/RDR/rdr/search/grid
//   Body JSON: { FacilityId, StartDate "MM-DD-YYYY", Nights, ... }
//
// Two-step fetch required:
//   1. GET https://www.reservecalifornia.com/ to obtain session cookies
//   2. POST the search with those cookies, plus realistic browser headers

export interface RCAvailabilityResult {
  facilityId: string;
  startDate: string; // YYYY-MM-DD
  nights: number;
  availableUnits: RCAvailableUnit[];
  totalUnitsChecked: number;
  source: "reservecalifornia";
}

export interface RCAvailableUnit {
  unitId: string;
  unitName: string;
  unitTypeId?: number;
  isAda?: boolean;
}

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 " +
  "(KHTML, like Gecko) Version/17.5 Safari/605.1.15";

function toMMDDYYYY(yyyy_mm_dd: string): string {
  const [y, m, d] = yyyy_mm_dd.split("-");
  return `${m}-${d}-${y}`;
}

// Extract cookies from a Response's Set-Cookie header(s) into a single
// "name=value; name2=value2" string suitable for a Cookie request header.
function extractCookies(res: Response): string {
  // Workers may return multiple Set-Cookie headers; the standard getter
  // concatenates them with commas. We split conservatively.
  const raw = res.headers.get("set-cookie");
  if (!raw) return "";
  // Split on ", " that precedes a cookie name (avoids splitting Expires=)
  const parts = raw.split(/,(?=[^;]+?=)/);
  const pairs = parts
    .map((p) => p.split(";")[0].trim())
    .filter((p) => p.includes("="));
  return pairs.join("; ");
}

async function getSessionCookie(): Promise<string> {
  const res = await fetch("https://www.reservecalifornia.com/", {
    method: "GET",
    headers: {
      "User-Agent": UA,
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      "Cache-Control": "no-cache",
    },
  });
  return extractCookies(res);
}

export async function checkReserveCalifornia(
  facilityId: string,
  startDate: string,
  nights: number
): Promise<RCAvailabilityResult> {
  const cookieHeader = await getSessionCookie();

  const body = {
    FacilityId: Number(facilityId),
    StartDate: toMMDDYYYY(startDate),
    Nights: nights,
    InSeasonOnly: false,
    UnitCategoryId: 0,
    UnitTypesGroupIds: [],
    MinVehicleLength: 0,
    UnitSort: "orderby",
    InventoryCategoryId: 0,
    SleepingUnitId: 0,
  };

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json, text/plain, */*",
    "User-Agent": UA,
    Origin: "https://www.reservecalifornia.com",
    Referer: "https://www.reservecalifornia.com/",
    "Accept-Language": "en-US,en;q=0.9",
  };
  if (cookieHeader) headers["Cookie"] = cookieHeader;

  const res = await fetch(
    "https://calirdr.usedirect.com/RDR/rdr/search/grid",
    {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
    throw new Error(
      `ReserveCalifornia returned ${res.status} for facility ${facilityId}`
    );
  }

  const data = (await res.json()) as {
    Facility?: {
      Units?: Record<
        string,
        {
          UnitId: number;
          Name: string;
          UnitTypeId?: number;
          IsAda?: boolean;
          IsWebViewable?: boolean;
          Slices?: Record<
            string,
            { IsFree?: boolean; IsAvailable?: boolean }
          >;
        }
      >;
    };
  };

  const units = data.Facility?.Units ?? {};
  const available: RCAvailableUnit[] = [];
  let totalChecked = 0;

  for (const u of Object.values(units)) {
    if (u.IsWebViewable === false) continue;
    totalChecked++;
    const slices = Object.values(u.Slices ?? {});
    if (slices.length === 0) continue;
    const allOpen = slices.every(
      (s) => s.IsFree === true || s.IsAvailable === true
    );
    if (allOpen) {
      available.push({
        unitId: String(u.UnitId),
        unitName: u.Name,
        unitTypeId: u.UnitTypeId,
        isAda: u.IsAda,
      });
    }
  }

  return {
    facilityId,
    startDate,
    nights,
    availableUnits: available,
    totalUnitsChecked: totalChecked,
    source: "reservecalifornia",
  };
}
