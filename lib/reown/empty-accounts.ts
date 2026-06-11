const missingAccountsDependency = (): never => {
  throw new Error('Tempo Wallet requires the optional "accounts" package.');
};

export const Provider = {
  create: missingAccountsDependency,
};

export const dialog = missingAccountsDependency;
export const webAuthn = missingAccountsDependency;
export const dangerous_secp256k1 = missingAccountsDependency;
