export const getRPCEndpoint = (isTestnet: boolean) => {
  return isTestnet ? "https://api.avax-test.network" : "https://api.avax.network";
};
