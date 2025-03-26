import { networkIDs } from "@avalabs/avalanchejs";

//FIXME: REMOVE THIS
export const getRPCEndpoint = (networkID: number) => {
    if (networkID === networkIDs.FujiID) {
        return "https://api.avax-test.network";
    } else if (networkID === networkIDs.MainnetID) {
        return "https://api.avax.network";
    } else {
        throw new Error("Invalid network ID");
    }
}
