// Contract addresses
export const CONTRACTS = {
	EERC_STANDALONE: "0x5E9c6F952fB9615583182e70eDDC4e6E4E0aC0e0",
	EERC_CONVERTER: "0x1b469d99c8EB6D3b44fF329701559938A5e3BDe7",
	ERC20: "0xDa99049360ad594Ec1d8f680b83cb4dDA07e7fbd",
} as const;

// Get the base URL for circuit files
const getBaseUrl = () => {
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return 'http://localhost:3000'; // Default for development
};

// Circuit configuration
export const CIRCUIT_CONFIG = {
	register: {
		wasm: `${getBaseUrl()}/circuits/RegistrationCircuit.wasm`,
		zkey: `${getBaseUrl()}/circuits/RegistrationCircuit.groth16.zkey`,
	},
	mint: {
		wasm: `${getBaseUrl()}/circuits/MintCircuit.wasm`,
		zkey: `${getBaseUrl()}/circuits/MintCircuit.groth16.zkey`,
	},
	transfer: {
		wasm: `${getBaseUrl()}/circuits/TransferCircuit.wasm`,
		zkey: `${getBaseUrl()}/circuits/TransferCircuit.groth16.zkey`,
	},
	withdraw: {
		wasm: `${getBaseUrl()}/circuits/WithdrawCircuit.wasm`,
		zkey: `${getBaseUrl()}/circuits/WithdrawCircuit.groth16.zkey`,
	},
	burn: {
		wasm: `${getBaseUrl()}/circuits/BurnCircuit.wasm`,
		zkey: `${getBaseUrl()}/circuits/BurnCircuit.groth16.zkey`,
	},
} as const;

// Explorer URL
export const EXPLORER_BASE_URL = "https://testnet.snowtrace.io/address/";
export const EXPLORER_BASE_URL_TX = "https://testnet.snowtrace.io/tx/";

// Mode types
export type EERCMode = "standalone" | "converter";
