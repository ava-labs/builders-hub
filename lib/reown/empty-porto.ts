const missingPortoDependency = (): never => {
  throw new Error('Porto requires the optional "porto" package.');
};

export const Porto = {
  create: missingPortoDependency,
};

export const RpcSchema = {
  wallet_connect: {
    Capabilities: {},
  },
};

export const z = {
  encode: missingPortoDependency,
};
