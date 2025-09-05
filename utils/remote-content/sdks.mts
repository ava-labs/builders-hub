import { FileConfig } from './shared.mts';
import { getAllSDKConfigs } from './fetch-sdk-docs.mts';

export async function getSDKSConfigs(): Promise<FileConfig[]> {
  // Use the dynamic fetching approach to get all SDK documentation
  return await getAllSDKConfigs();
} 