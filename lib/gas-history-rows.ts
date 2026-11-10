import type { GasDayPoint, GasHourPoint } from "@/lib/explorer-clickhouse";

/** stats-api's base fee floor fields on a gas-history bucket, present only for
 *  blocks whose header carries a minimum price (the C-Chain since Helicon, ACP-283) */
interface RawFloor {
  floor?: number | null;
  aboveFloorP50?: number;
  aboveFloorP95?: number;
  blocksAboveFloor?: number;
  floorBlocks?: number;
}

export type RawGasHour = RawFloor & { t: string; p25: number; p50: number; p75: number; p95: number; gas: string };
export type RawGasDay = RawGasHour & { utilPct: number; blocks: number };

export interface FeeFloor {
  /** the protocol's minimum base fee in the bucket, nAVAX */
  floor: number;
  /** median and p95 base fee above the floor, percent */
  aboveP50: number;
  aboveP95: number;
  /** blocks priced above the floor, of the blocks that carry one */
  blocksAbove: number;
  blocks: number;
}

function toFloor(r: RawFloor): FeeFloor | null {
  const floor = Number(r.floor) || 0;
  const blocks = Number(r.floorBlocks) || 0;
  if (floor <= 0 || blocks <= 0) return null;
  return {
    floor,
    aboveP50: Number(r.aboveFloorP50) || 0,
    aboveP95: Number(r.aboveFloorP95) || 0,
    blocksAbove: Number(r.blocksAboveFloor) || 0,
    blocks,
  };
}

export function toHourPoint(r: RawGasHour): GasHourPoint {
  return {
    t: r.t,
    p25: Number(r.p25) || 0,
    p50: Number(r.p50) || 0,
    p75: Number(r.p75) || 0,
    p95: Number(r.p95) || 0,
    gas: Number(r.gas) || 0,
    floor: toFloor(r),
  };
}

export function toDayPoint(r: RawGasDay): GasDayPoint {
  const { t, ...rest } = toHourPoint(r);
  return { d: t, ...rest, utilPct: Number(r.utilPct) || 0, blocks: Number(r.blocks) || 0 };
}
