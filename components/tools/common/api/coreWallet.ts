function checkCoreWallet(): Promise<boolean> {
  try {
    if (!window.avalanche) {
      throw new Error("Core wallet is not installed.");
    }
    return Promise.resolve(true);
  } catch (error) {
    console.error("Core wallet check failed:", error);
    throw error;
  }
}

export { checkCoreWallet };

// Returns the P-Chain address of the active account ex: 'P-fuji1...' or 'P-avax1...'
const fetchPChainAddressForActiveAccount = async (): Promise<string> => {
  try {
    if (!window.avalanche) throw new Error("Core wallet not found");

    const response = await window.avalanche.request<{ addressPVM: string }[]>({
      method: "avalanche_getAccounts",
      params: [],
    });
    const activeAccountIndex = response.findIndex((account: any) => account.active === true);
    const pChainAddress = response[activeAccountIndex].addressPVM;
    return pChainAddress as string;
  } catch (error) {
    console.error("Error fetching avalanche accounts, is Core wallet installed?:", error);
    throw error;
  }
};

export { fetchPChainAddressForActiveAccount };
