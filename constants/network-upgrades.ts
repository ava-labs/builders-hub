/* Mainnet activation times of Avalanche's network upgrades.

   Source: AvalancheGo's mainnet config, upgrade/upgrade.go (the Mainnet Config), at
   ava-labs/avalanchego@4d91d6458c40081636a01f1dd3f75fdb0dd519d7 (2026-10-15); the v1.15.1 tag holds the same times.
   The ACPs come from AvalancheGo's RELEASES.md (v1.11.0, v1.12.0, v1.13.0, v1.14.0 and v1.15.0), which lists none for
   the Apricot phases, Banff and Cortina. Igloo has no mainnet time yet (UnscheduledActivationTime, upgrade.go:42). */

export interface NetworkUpgrade {
  /** the name people use */
  name: string;
  /** mainnet activation, epoch ms */
  at: number;
  /** the ACPs it activates, as RELEASES.md lists them */
  acps: readonly number[];
}

export const MAINNET_UPGRADES: readonly NetworkUpgrade[] = [
  { name: "Apricot Phase 1", at: Date.UTC(2021, 2, 31, 14), acps: [] }, // upgrade.go:20
  { name: "Apricot Phase 2", at: Date.UTC(2021, 4, 10, 11), acps: [] }, // upgrade.go:21
  { name: "Apricot Phase 3", at: Date.UTC(2021, 7, 24, 14), acps: [] }, // upgrade.go:22
  { name: "Apricot Phase 4", at: Date.UTC(2021, 8, 22, 21), acps: [] }, // upgrade.go:23
  { name: "Apricot Phase 5", at: Date.UTC(2021, 11, 2, 18), acps: [] }, // upgrade.go:25
  { name: "Apricot Phase 6", at: Date.UTC(2022, 8, 6, 20), acps: [] }, // upgrade.go:27
  { name: "Banff", at: Date.UTC(2022, 9, 18, 16), acps: [] }, // upgrade.go:29
  { name: "Cortina", at: Date.UTC(2023, 3, 25, 15), acps: [] }, // upgrade.go:30
  { name: "Durango", at: Date.UTC(2024, 2, 6, 16), acps: [23, 24, 25, 30, 31, 41, 62] }, // upgrade.go:36
  { name: "Etna", at: Date.UTC(2024, 11, 16, 17), acps: [77, 103, 118, 125, 131, 151] }, // upgrade.go:37
  { name: "Fortuna", at: Date.UTC(2025, 3, 8, 15), acps: [176] }, // upgrade.go:38
  { name: "Granite", at: Date.UTC(2025, 10, 19, 16), acps: [181, 204, 226] }, // upgrade.go:39
  { name: "Helicon", at: Date.UTC(2026, 8, 22, 15), acps: [194, 236, 267, 273, 283, 285] }, // upgrade.go:41
];

/** upgrades AvalancheGo names with no mainnet time yet */
export const UNSCHEDULED_UPGRADES: readonly string[] = ["Igloo"];
