import { createParser, defaultPipeline, primaryNetworkPipeline, crossChainPipeline, sdksPipeline, acpsPipeline, avalancheL1sPipeline } from './pipelines.mts';
import type { SectionParser } from '../shared.mts';

export const primaryNetworkParser: SectionParser = createParser(primaryNetworkPipeline);
export const apisParser: SectionParser = createParser(defaultPipeline);
export const sdksParser: SectionParser = createParser(sdksPipeline);
export const acpsParser: SectionParser = createParser(acpsPipeline);
export const toolingParser: SectionParser = createParser(defaultPipeline);
export const crossChainParser: SectionParser = createParser(crossChainPipeline);
export const avalancheL1sParser: SectionParser = createParser(avalancheL1sPipeline);

export type ParserMap = Record<string, SectionParser>;

export const parsers: ParserMap = {
  'Primary Network': primaryNetworkParser,
  'APIs': apisParser,
  'SDKS': sdksParser,
  'ACPs': acpsParser,
  'Tooling': toolingParser,
  'Cross-Chain': crossChainParser,
  'Avalanche L1s': avalancheL1sParser,
};
