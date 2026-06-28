// Preloaded California coastal corridor campgrounds.
// Provider "rc" = ReserveCalifornia (state parks)
// Provider "recgov" = Recreation.gov (federal lands)
//
// VERIFY flags mean the FacilityId is a community-sourced best guess.
// Confirm by opening reservecalifornia.com, picking the park, and capturing
// the POST payload to /rdr/rdr/search/grid in browser dev tools.

export type Provider = "rc" | "recgov";

export interface KnownFacility {
  name: string;
  provider: Provider;
  facilityId: string;
  region: string;
  notes?: string;
  verified: boolean;
}

export const KNOWN_FACILITIES: KnownFacility[] = [
  // Sonoma Coast (CA State Parks - ReserveCalifornia)
  { name: "Bodega Dunes", provider: "rc", facilityId: "1075", region: "Sonoma Coast", verified: true },
  { name: "Wright's Beach", provider: "rc", facilityId: "1073", region: "Sonoma Coast", verified: true },
  { name: "Pomo Canyon (env. walk-in)", provider: "rc", facilityId: "1077", region: "Sonoma Coast", verified: false, notes: "VERIFY id" },

  // Salt Point / Mendocino (CA State Parks)
  { name: "Salt Point", provider: "rc", facilityId: "1074", region: "Sonoma/Mendocino", verified: true },
  { name: "Russian Gulch", provider: "rc", facilityId: "1066", region: "Mendocino", verified: true },
  { name: "Van Damme", provider: "rc", facilityId: "1064", region: "Mendocino", verified: true },
  { name: "Manchester", provider: "rc", facilityId: "1065", region: "Mendocino", verified: true },
  { name: "MacKerricher", provider: "rc", facilityId: "1062", region: "Mendocino", verified: true },

  // Big Sur corridor (Recreation.gov - federal)
  { name: "Plaskett Creek", provider: "recgov", facilityId: "234077", region: "Big Sur", verified: true },
  { name: "Kirk Creek", provider: "recgov", facilityId: "233116", region: "Big Sur", verified: true },
  { name: "Nadelos", provider: "recgov", facilityId: "234725", region: "Lost Coast / King Range", verified: false, notes: "VERIFY id" },
  { name: "Wailaki", provider: "recgov", facilityId: "234724", region: "Lost Coast / King Range", verified: false, notes: "VERIFY id" },
];

export function findFacilityByName(query: string): KnownFacility[] {
  const q = query.toLowerCase().trim();
  return KNOWN_FACILITIES.filter(
    (f) => f.name.toLowerCase().includes(q) || f.region.toLowerCase().includes(q)
  );
}
