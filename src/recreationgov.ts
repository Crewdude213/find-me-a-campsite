// Recreation.gov availability provider.
//
// Endpoint (unofficial but stable for years):
//   GET https://www.recreation.gov/api/camps/availability/campground/{id}/month
//   ?start_date=YYYY-MM-01T00:00:00.000Z
//
// A realistic User-Agent header is required — the API rejects requests
// without one. No API key needed for this read endpoint.

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 " +
  "(KHTML, like Gecko) Version/17.5 Safari/605.1.15";

export interface AvailabilityResult {
  facilityId: string;
  startDate: string; // YYYY-MM-DD
  nights: number;
  availableSites: AvailableSite[];
  totalSitesChecked: number;
  source: "recreation.gov";
}

export interface AvailableSite {
  siteId: string;
  siteName: string;
  loop?: string;
  allNightsAvailable: boolean;
}

function firstOfMonthISO(date: string): string {
  // date is YYYY-MM-DD; we need YYYY-MM-01T00:00:00.000Z
  const [y, m] = date.split("-");
  return `${y}-${m}-01T00:00:00.000Z`;
}

function dateRangeKeys(startDate: string, nights: number): string[] {
  // Recreation.gov keys availability by ISO timestamp at midnight UTC
  // for each night of the stay. e.g. "2026-07-10T00:00:00Z"
  const keys: string[] = [];
  const start = new Date(`${startDate}T00:00:00Z`);
  for (let i = 0; i < nights; i++) {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    keys.push(`${y}-${m}-${day}T00:00:00Z`);
  }
  return keys;
}

export async function checkRecreationGov(
  facilityId: string,
  startDate: string,
  nights: number
): Promise<AvailabilityResult> {
  const url =
    `https://www.recreation.gov/api/camps/availability/campground/${facilityId}/month` +
    `?start_date=${encodeURIComponent(firstOfMonthISO(startDate))}`;

  const res = await fetch(url, {
    headers: {
      "User-Agent": UA,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(`Recreation.gov returned ${res.status} for facility ${facilityId}`);
  }

  const data = (await res.json()) as {
    campsites?: Record<
      string,
      {
        site: string;
        loop?: string;
        availabilities?: Record<string, string>;
      }
    >;
  };

  const wantedKeys = dateRangeKeys(startDate, nights);
  const sites = data.campsites ?? {};
  const available: AvailableSite[] = [];

  for (const [siteId, site] of Object.entries(sites)) {
    const av = site.availabilities ?? {};
    const allOpen = wantedKeys.every((k) => av[k] === "Available");
    if (allOpen) {
      available.push({
        siteId,
        siteName: site.site,
        loop: site.loop,
        allNightsAvailable: true,
      });
    }
  }

  return {
    facilityId,
    startDate,
    nights,
    availableSites: available,
    totalSitesChecked: Object.keys(sites).length,
    source: "recreation.gov",
  };
}
