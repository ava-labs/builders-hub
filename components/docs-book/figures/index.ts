import { BlockLifecycleFigure } from './block-lifecycle-figure';
import { CChainVmSwitchFigure } from './cchain-vm-switch-figure';
import { StakingCycleFigure } from './staking-cycle-figure';
import { SubsamplingFigure } from './subsampling-figure';
import { WarpSignaturesFigure } from './warp-signatures-figure';
import { DiskGrowthFigure } from './disk-growth-figure';
import { ResyncTimelineFigure } from './resync-timeline-figure';
import { ResyncDiskFigure } from './resync-disk-figure';
import { MessagePathFigure } from './message-path-figure';

/** The figures that docs MDX can use without an import. Each one draws in the flow style (components/docs-book/flow). */
export const docsFigures = {
  BlockLifecycleFigure,
  CChainVmSwitchFigure,
  StakingCycleFigure,
  SubsamplingFigure,
  WarpSignaturesFigure,
  DiskGrowthFigure,
  ResyncTimelineFigure,
  ResyncDiskFigure,
  MessagePathFigure,
};
