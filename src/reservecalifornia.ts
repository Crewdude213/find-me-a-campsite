// ReserveCalifornia (CA State Parks) availability provider.
//
// Endpoint (unofficial but stable):
//   POST https://calirdr.usedirect.com/RDR/rdr/search/grid
//   Body JSON: { FacilityId, StartDate "MM-DD-YYYY", Nights, ... }
//
// No auth required for this read endpoint.

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

function toMMDDYYYY(yyyy_mm_dd: string): string {
  const [y, m, d] = yyyy_mm_dd.split("-");
  return `${m}-${d}-${y}`;
}

export async function checkReserveCalifornia(
  facilityId: string,
  startDate: string,
  nights: number
): Promise<RCAvailabilityResult> {
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

  const res = await fetch("https://calirdr.usedirect.com/RDR/rdr/search/grid", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`ReserveCalifornia returned ${res.status} for facility ${facilityId}`);
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
          Slices?: Record<string, { IsFree?: boolean; IsAvailable?: boolean }>;
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
    const allOpen = slices.every((s) => s.IsFree === true || s.IsAvailable === true);
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
