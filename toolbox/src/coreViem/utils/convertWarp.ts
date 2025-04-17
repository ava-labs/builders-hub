// FIXME: this is a quick hack solution untill AvalancheJS supports this
// Please don't copy this code to other projects!
import { sha256 } from '@noble/hashes/sha256';
import { utils } from '@avalabs/avalanchejs';
// Assuming Buffer is available via avalanchejs or node polyfill

// Helper function to convert Uint8Array to Buffer for hex encoding if needed
// Or rely on a library that does this directly if available in the environment.
// For simplicity, assuming utils.hexToBuffer and Buffer.from(bytes).toString('hex') work.
const bytesToHexPrefixed = (bytes: Uint8Array): `0x${string}` => `0x${Buffer.from(bytes).toString('hex')}`;


// --- Interfaces mirroring Solidity structs ---

// Existing interface from original TS file
export interface PackL1ConversionMessageArgs {
    subnetId: string;
    managerChainID: string;
    managerAddress: string;
    validators: SubnetToL1ConversionValidatorData[];
}

// Existing interface from original TS file
export interface SubnetToL1ConversionValidatorData {
    nodeID: string;
    nodePOP: {
        publicKey: string;
        proofOfPossession: string;
    };
    weight: number; // Note: Solidity uses uint64 (bigint)
}

// Existing interface from original TS file (modified slightly by user before?)
export interface PChainOwner {
    threshold: number; // Note: Solidity uses uint32
    addresses: `0x${string}`[];
}

// Existing interface from original TS file (modified slightly by user before?)
export interface ValidationPeriod {
    subnetId: string; // Note: Solidity uses bytes32 (Uint8Array)
    nodeID: string; // Note: Solidity uses bytes (Uint8Array)
    blsPublicKey: `0x${string}`; // Note: Solidity uses bytes (Uint8Array, 48 len)
    registrationExpiry: bigint; // uint64
    remainingBalanceOwner: PChainOwner;
    disableOwner: PChainOwner;
    weight: bigint; // uint64
}

// --- New interfaces mirroring Solidity structs more closely ---

// Mirrors Solidity's ValidationPeriod struct
export interface SolidityValidationPeriod {
    subnetID: Uint8Array; // bytes32
    nodeID: Uint8Array; // bytes
    blsPublicKey: Uint8Array; // bytes (expected length 48)
    registrationExpiry: bigint; // uint64
    remainingBalanceOwner: PChainOwner; // Uses existing PChainOwner, ensure threshold is handled as uint32 if needed
    disableOwner: PChainOwner; // Uses existing PChainOwner, ensure threshold is handled as uint32 if needed
    weight: bigint; // uint64
}

// Mirrors Solidity's ValidatorData struct used within ConversionData
export interface SolidityValidatorData {
    nodeID: Uint8Array; // bytes
    blsPublicKey: Uint8Array; // bytes (expected length 48)
    weight: bigint; // uint64
}

// Mirrors Solidity's ConversionData struct
export interface SolidityConversionData {
    subnetID: Uint8Array; // bytes32
    validatorManagerBlockchainID: Uint8Array; // bytes32
    validatorManagerAddress: `0x${string}`; // address (20 bytes)
    initialValidators: SolidityValidatorData[];
}


// Mirrors Solidity's L1ValidatorRegistrationMessage data
// (already somewhat represented by existing L1ValidatorRegistration interface)
// Existing interface from original TS file:
export interface L1ValidatorRegistration {
    validationID: Uint8Array; // bytes32
    registered: boolean;
}

// For L1ValidatorWeightMessage
export interface L1ValidatorWeight {
    validationID: Uint8Array; // bytes32
    nonce: bigint; // uint64
    weight: bigint; // uint64
}

// For ValidationUptimeMessage
export interface ValidationUptime {
    validationID: Uint8Array; // bytes32
    uptime: bigint; // uint64
}


// --- Constants ---
const CODEC_ID = 0; // uint16 internal constant CODEC_ID = 0; (replaces codecVersion variable)
// const codecVersion = 0; // Replaced by CODEC_ID

const SUBNET_TO_L1_CONVERSION_MESSAGE_TYPE_ID = 0; // uint32
const REGISTER_L1_VALIDATOR_MESSAGE_TYPE_ID = 1; // uint32 (already defined in original file)
const L1_VALIDATOR_REGISTRATION_MESSAGE_TYPE_ID = 2; // uint32 (already defined in original file)
const L1_VALIDATOR_WEIGHT_MESSAGE_TYPE_ID = 3; // uint32
const VALIDATION_UPTIME_MESSAGE_TYPE_ID = 0; // uint32 (Note: same as SUBNET_TO_L1_CONVERSION_MESSAGE_TYPE_ID)


// --- Existing Helper functions ---
// ... existing code ...
const encodeUint16 = (num: number): Uint8Array => encodeNumber(num, 2);
const encodeUint32 = (num: number): Uint8Array => encodeNumber(num, 4);
const encodeUint64 = (num: bigint): Uint8Array => encodeNumber(num, 8);


function encodeNumber(num: number | bigint, numberBytes: number): Uint8Array {
    const arr = new Uint8Array(numberBytes);
    const isBigInt = typeof num === 'bigint';
    let value = isBigInt ? num : BigInt(num);

    for (let i = numberBytes - 1; i >= 0; i--) {
        arr[i] = Number(value & 0xffn);
        value = value >> 8n;
    }
    return arr;
}

function encodeVarBytes(bytes: Uint8Array): Uint8Array {
    const lengthBytes = encodeUint32(bytes.length);
    const result = new Uint8Array(lengthBytes.length + bytes.length);
    result.set(lengthBytes);
    result.set(bytes, lengthBytes.length);
    return result;
}

function concatenateUint8Arrays(...arrays: Uint8Array[]): Uint8Array {
    const totalLength = arrays.reduce((acc, arr) => acc + arr.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const arr of arrays) {
        result.set(arr, offset);
        offset += arr.length;
    }
    return result;
}

// Helper functions for parsing numbers (already exist at end of file, moved up for clarity)
function parseUint16(input: Uint8Array, offset: number): number {
    if (offset + 2 > input.length) throw new Error("parseUint16: Offset out of bounds");
    let result = 0;
    for (let i = 0; i < 2; i++) {
        result = (result << 8) | input[offset + i];
    }
    return result;
}

function parseUint32(input: Uint8Array, offset: number): number {
     if (offset + 4 > input.length) throw new Error("parseUint32: Offset out of bounds");
    let result = 0;
    for (let i = 0; i < 4; i++) {
        result = (result << 8) | input[offset + i];
    }
    // Return as unsigned integer
    return result >>> 0;
}

function parseUint64(input: Uint8Array, offset: number): bigint {
     if (offset + 8 > input.length) throw new Error("parseUint64: Offset out of bounds");
    let result = 0n;
    for (let i = 0; i < 8; i++) {
        result = (result << 8n) | BigInt(input[offset + i]);
    }
    return result;
}

function parseBytes(input: Uint8Array, offset: number, length: number): Uint8Array {
    if (offset + length > input.length) throw new Error("parseBytes: Offset/length out of bounds");
    return input.slice(offset, offset + length);
}

function parseVarBytes(input: Uint8Array, offset: number): { bytes: Uint8Array; newOffset: number } {
    const length = parseUint32(input, offset);
    const newOffset = offset + 4;
    const bytes = parseBytes(input, newOffset, length);
    return { bytes, newOffset: newOffset + length };
}


// --- Ported Solidity Functions ---

/**
 * Packs a SubnetToL1ConversionMessage message into a byte array.
 * Format: codecID (uint16), typeID (uint32), conversionID (bytes32)
 * Total Length: 2 + 4 + 32 = 38 bytes
 */
export function packSubnetToL1ConversionMessage(conversionID: Uint8Array): Uint8Array {
    if (conversionID.length !== 32) {
        throw new Error('ConversionID must be exactly 32 bytes');
    }
    return concatenateUint8Arrays(
        encodeUint16(CODEC_ID),
        encodeUint32(SUBNET_TO_L1_CONVERSION_MESSAGE_TYPE_ID),
        conversionID
    );
}

/**
 * Unpacks a byte array as a SubnetToL1ConversionMessage message.
 * Format: codecID (uint16), typeID (uint32), conversionID (bytes32)
 */
export function unpackSubnetToL1ConversionMessage(input: Uint8Array): Uint8Array {
    const EXPECTED_LENGTH = 38;
    if (input.length !== EXPECTED_LENGTH) {
        throw new Error(`Invalid message length. Expected ${EXPECTED_LENGTH} bytes, got ${input.length}`);
    }

    const codecID = parseUint16(input, 0);
    if (codecID !== CODEC_ID) {
        throw new Error(`Invalid codec ID: ${codecID}, expected ${CODEC_ID}`);
    }

    const typeID = parseUint32(input, 2);
    if (typeID !== SUBNET_TO_L1_CONVERSION_MESSAGE_TYPE_ID) {
        throw new Error(`Invalid message type: ${typeID}, expected ${SUBNET_TO_L1_CONVERSION_MESSAGE_TYPE_ID}`);
    }

    const conversionID = parseBytes(input, 6, 32); // 32 bytes
    return conversionID;
}


/**
 * Packs ConversionData into a byte array (pre-image for conversionID hash).
 * Mirrors Solidity's packConversionData logic using SolidityConversionData interface.
 */
export function packConversionData(conversionData: SolidityConversionData): Uint8Array {
    const parts: Uint8Array[] = [];

    parts.push(encodeUint16(CODEC_ID)); // 2 bytes

    if (conversionData.subnetID.length !== 32) throw new Error("subnetID must be 32 bytes");
    parts.push(conversionData.subnetID); // 32 bytes

    if (conversionData.validatorManagerBlockchainID.length !== 32) throw new Error("validatorManagerBlockchainID must be 32 bytes");
    parts.push(conversionData.validatorManagerBlockchainID); // 32 bytes

    const managerAddressBytes = utils.hexToBuffer(conversionData.validatorManagerAddress);
    if (managerAddressBytes.length !== 20) throw new Error("validatorManagerAddress must be 20 bytes hex string");
    parts.push(encodeUint32(managerAddressBytes.length)); // 4 bytes (length prefix, always 20)
    parts.push(managerAddressBytes); // 20 bytes

    parts.push(encodeUint32(conversionData.initialValidators.length)); // 4 bytes (array length)

    // Sort validators by nodeID before packing.
    // Note: Solidity version doesn't explicitly sort. Kept sorting for consistency with original TS marshal function.
    // If strict adherence to Solidity is needed, remove sorting.
    const sortedValidators = [...conversionData.initialValidators].sort((a, b) => {
         // Simple lexicographical comparison for byte arrays
         const aBytes = a.nodeID;
         const bBytes = b.nodeID;
         const minLen = Math.min(aBytes.length, bBytes.length);
         for (let i = 0; i < minLen; i++) {
             if (aBytes[i] !== bBytes[i]) {
                 return aBytes[i] < bBytes[i] ? -1 : 1;
             }
         }
         return aBytes.length - bBytes.length;
    });


    for (const validator of sortedValidators) {
        if (validator.blsPublicKey.length !== 48) throw new Error("Validator blsPublicKey must be 48 bytes");

        parts.push(encodeVarBytes(validator.nodeID)); // 4 bytes length + nodeID bytes
        parts.push(validator.blsPublicKey); // 48 bytes
        parts.push(encodeUint64(validator.weight)); // 8 bytes
    }

    return concatenateUint8Arrays(...parts);
}

// Function to calculate the conversionID hash using the Solidity-like structure
export function calculateConversionID(conversionData: SolidityConversionData): Uint8Array {
    const packedData = packConversionData(conversionData);
    return sha256(packedData);
}

// --- Existing marshalSubnetToL1ConversionData ---
// This function uses the original TS interfaces (PackL1ConversionMessageArgs)
// and handles string inputs (base58 nodeIDs etc.)
// Keep it separate from the strictly ported packConversionData.
// ... existing code ...
export function marshalSubnetToL1ConversionData(args: PackL1ConversionMessageArgs): Uint8Array {
    const parts: Uint8Array[] = [];

    parts.push(encodeUint16(CODEC_ID)); // Use constant CODEC_ID
    parts.push(utils.base58check.decode(args.subnetId));
    parts.push(utils.base58check.decode(args.managerChainID));
    parts.push(encodeVarBytes(utils.hexToBuffer(args.managerAddress)));
    parts.push(encodeUint32(args.validators.length));

    // Sort validators by nodeID (using existing compareNodeIDs)
    let sortedValidators;
    try {
        sortedValidators = [...args.validators].sort((a, b) => compareNodeIDs(a.nodeID, b.nodeID));
    } catch (error: any) {
        console.warn("Error sorting validators, using original order:", error);
        sortedValidators = args.validators;
    }

    for (const validator of sortedValidators) {
        if (!validator.nodeID || !validator.nodePOP || !validator.nodePOP.publicKey) { // Check publicKey existence
            throw new Error(`Invalid validator data: ${JSON.stringify(validator)}`);
        }

        let nodeIDBytes;
        try {
            nodeIDBytes = validator.nodeID.startsWith("NodeID-")
                ? utils.base58check.decode(validator.nodeID.split("-")[1])
                : utils.hexToBuffer(validator.nodeID);
        } catch (error: any) {
            throw new Error(`Failed to parse nodeID '${validator.nodeID}': ${error.message}`);
        }

        // NOTE: This uses nodePOP.publicKey, whereas the Solidity port uses blsPublicKey.
        // Ensure this publicKey corresponds to the expected BLS key if used for similar purposes.
        // Assuming nodePOP.publicKey is the BLS key here based on context.
        const blsPublicKeyBytes = utils.hexToBuffer(validator.nodePOP.publicKey);
         if (blsPublicKeyBytes.length !== 48) {
             console.warn(`Expected BLS public key (nodePOP.publicKey) to be 48 bytes, got ${blsPublicKeyBytes.length}`);
             // Decide whether to throw or allow based on requirements
             // throw new Error(`Invalid BLS public key length from nodePOP.publicKey: ${blsPublicKeyBytes.length}`);
         }

        parts.push(encodeVarBytes(nodeIDBytes));
        parts.push(blsPublicKeyBytes); // Packing the publicKey as if it's the BLS key
        // Note: Solidity uses uint64 (bigint), TS interface uses number. Convert.
        parts.push(encodeUint64(BigInt(validator.weight)));
    }

    const result = concatenateUint8Arrays(...parts);
    return result;
}

// Existing subnetToL1ConversionID uses marshalSubnetToL1ConversionData
// It calculates the hash based on the original TS interfaces/logic.
// ... existing code ...
export function subnetToL1ConversionID(args: PackL1ConversionMessageArgs): Uint8Array {
    const data = marshalSubnetToL1ConversionData(args);
    return sha256(data);
}

// --- RegisterL1ValidatorMessage ---

// Function to pack *only* the payload using the SolidityValidationPeriod interface.
function packRegisterL1ValidatorPayload(validationPeriod: SolidityValidationPeriod): Uint8Array {
     if (validationPeriod.blsPublicKey.length !== 48) {
        throw new Error('Invalid BLS public key length, expected 48 bytes');
    }

    const parts: Uint8Array[] = [];
    parts.push(encodeUint16(CODEC_ID));
    parts.push(encodeUint32(REGISTER_L1_VALIDATOR_MESSAGE_TYPE_ID));

    if (validationPeriod.subnetID.length !== 32) throw new Error("subnetID must be 32 bytes");
    parts.push(validationPeriod.subnetID);

    parts.push(encodeVarBytes(validationPeriod.nodeID)); // Includes length prefix

    parts.push(validationPeriod.blsPublicKey);
    parts.push(encodeUint64(validationPeriod.registrationExpiry));

    // remainingBalanceOwner
    parts.push(encodeUint32(validationPeriod.remainingBalanceOwner.threshold));
    parts.push(encodeUint32(validationPeriod.remainingBalanceOwner.addresses.length));
    for (const address of validationPeriod.remainingBalanceOwner.addresses) {
        const addrBytes = utils.hexToBuffer(address);
        if (addrBytes.length !== 20) throw new Error("Owner address must be 20 bytes hex string");
        parts.push(addrBytes);
    }

    // disableOwner
    parts.push(encodeUint32(validationPeriod.disableOwner.threshold));
    parts.push(encodeUint32(validationPeriod.disableOwner.addresses.length));
    for (const address of validationPeriod.disableOwner.addresses) {
        const addrBytes = utils.hexToBuffer(address);
         if (addrBytes.length !== 20) throw new Error("Owner address must be 20 bytes hex string");
        parts.push(addrBytes);
    }

    parts.push(encodeUint64(validationPeriod.weight));

    return concatenateUint8Arrays(...parts);
}

/**
 * Calculates the validationID hash for a RegisterL1ValidatorMessage payload.
 * Uses the SolidityValidationPeriod interface.
 */
export function calculateValidationID(validationPeriod: SolidityValidationPeriod): Uint8Array {
    const payload = packRegisterL1ValidatorPayload(validationPeriod);
    return sha256(payload);
}


/**
 * Packs a RegisterL1ValidatorMessage for sending (wrapped in unsigned message structure).
 * Uses the existing TS ValidationPeriod interface for convenience with current usage.
 * Bridges the TS interface (string IDs, hex keys) to the required byte format for the payload.
 */
// ... existing packRegisterL1ValidatorMessage function ...
// Modify it to use CODEC_ID and ensure consistency
export function packRegisterL1ValidatorMessage(
    validationPeriod: ValidationPeriod, // Using existing TS interface
    networkID: number,
    sourceChainID: string
): Uint8Array {
    // Convert TS ValidationPeriod to bytes for payload packing
    const blsPublicKeyBytes = utils.hexToBuffer(validationPeriod.blsPublicKey);
    if (blsPublicKeyBytes.length !== 48) {
        throw new Error('Invalid BLS public key length, expected 48 bytes');
    }
    const subnetIDBytes = utils.base58check.decode(validationPeriod.subnetId);
    if (subnetIDBytes.length !== 32) throw new Error("Decoded subnetId must be 32 bytes");

    const nodeIDBytes = validationPeriod.nodeID.startsWith("NodeID-")
        ? utils.base58check.decode(validationPeriod.nodeID.split("-")[1])
        : utils.hexToBuffer(validationPeriod.nodeID);


    const payloadParts: Uint8Array[] = [];
    payloadParts.push(encodeUint16(CODEC_ID)); // Use constant
    payloadParts.push(encodeUint32(REGISTER_L1_VALIDATOR_MESSAGE_TYPE_ID));
    payloadParts.push(subnetIDBytes);
    payloadParts.push(encodeVarBytes(nodeIDBytes));
    payloadParts.push(blsPublicKeyBytes);
    payloadParts.push(encodeUint64(validationPeriod.registrationExpiry));

    // remainingBalanceOwner
    payloadParts.push(encodeUint32(validationPeriod.remainingBalanceOwner.threshold));
    payloadParts.push(encodeUint32(validationPeriod.remainingBalanceOwner.addresses.length));
    for (const address of validationPeriod.remainingBalanceOwner.addresses) {
        const addrBytes = utils.hexToBuffer(address);
        if (addrBytes.length !== 20) throw new Error("Owner address must be 20 bytes hex string");
        payloadParts.push(addrBytes);
    }

    // disableOwner
    payloadParts.push(encodeUint32(validationPeriod.disableOwner.threshold));
    payloadParts.push(encodeUint32(validationPeriod.disableOwner.addresses.length));
    for (const address of validationPeriod.disableOwner.addresses) {
         const addrBytes = utils.hexToBuffer(address);
         if (addrBytes.length !== 20) throw new Error("Owner address must be 20 bytes hex string");
         payloadParts.push(addrBytes);
    }
    payloadParts.push(encodeUint64(validationPeriod.weight));

    const payload = concatenateUint8Arrays(...payloadParts);

    // Create addressed call with empty source address
    const addressedCall = newAddressedCall(new Uint8Array([]), payload);

    // Create unsigned message
    const unsignedMessage = newUnsignedMessage(networkID, sourceChainID, addressedCall);

    return unsignedMessage;
}


/**
 * Parses the payload of a RegisterL1ValidatorMessage into the SolidityValidationPeriod structure.
 * Mirrors Solidity's unpackRegisterL1ValidatorMessage.
 */
export function unpackRegisterL1ValidatorPayload(input: Uint8Array): SolidityValidationPeriod {
    let index = 0;
    const validation: Partial<SolidityValidationPeriod> = {
        remainingBalanceOwner: { threshold: 0, addresses: [] },
        disableOwner: { threshold: 0, addresses: [] },
    };

    // Unpack codec ID
    const codecID = parseUint16(input, index);
    if (codecID !== CODEC_ID) {
        throw new Error(`Invalid codec ID: ${codecID}`);
    }
    index += 2;

    // Unpack type ID
    const typeID = parseUint32(input, index);
    if (typeID !== REGISTER_L1_VALIDATOR_MESSAGE_TYPE_ID) {
        throw new Error(`Invalid message type: ${typeID}`);
    }
    index += 4;

    // Unpack subnetID
    validation.subnetID = parseBytes(input, index, 32);
    index += 32;

    // Unpack nodeID (var bytes)
    const { bytes: nodeIDBytes, newOffset: nodeIDEndOffset } = parseVarBytes(input, index);
    validation.nodeID = nodeIDBytes;
    index = nodeIDEndOffset;


    // Unpack BLS public key
    validation.blsPublicKey = parseBytes(input, index, 48);
    index += 48;

    // Unpack registration expiry
    validation.registrationExpiry = parseUint64(input, index);
    index += 8;

    // Unpack remainingBalanceOwner threshold
    validation.remainingBalanceOwner!.threshold = parseUint32(input, index);
    index += 4;
    // Unpack remainingBalanceOwner addresses length
    const remainingBalanceOwnerAddressesLength = parseUint32(input, index);
    index += 4;
    // Unpack remainingBalanceOwner addresses
    validation.remainingBalanceOwner!.addresses = [];
    for (let i = 0; i < remainingBalanceOwnerAddressesLength; i++) {
        const addrBytes = parseBytes(input, index, 20);
        validation.remainingBalanceOwner!.addresses.push(bytesToHexPrefixed(addrBytes));
        index += 20;
    }

    // Unpack disableOwner threshold
    validation.disableOwner!.threshold = parseUint32(input, index);
    index += 4;
    // Unpack disableOwner addresses length
    const disableOwnerAddressesLength = parseUint32(input, index);
    index += 4;
    // Unpack disableOwner addresses
    validation.disableOwner!.addresses = [];
    for (let i = 0; i < disableOwnerAddressesLength; i++) {
        const addrBytes = parseBytes(input, index, 20);
        validation.disableOwner!.addresses.push(bytesToHexPrefixed(addrBytes));
        index += 20;
    }

    // Unpack weight
    validation.weight = parseUint64(input, index);
    index += 8;

    // Validate total length by comparing the final index with input length
    if (index !== input.length) {
         // Calculate expected length based on parsed variable fields for better error message
         const expectedLength = 2 + 4 + 32 + (4 + validation.nodeID.length) + 48 + 8 +
                               (4 + 4 + remainingBalanceOwnerAddressesLength * 20) +
                               (4 + 4 + disableOwnerAddressesLength * 20) + 8;
         throw new Error(`Invalid message length: parsed ${index} bytes, expected ${expectedLength}, total length ${input.length}`);
    }

    return validation as SolidityValidationPeriod;
}


// Existing parseRegisterL1ValidatorMessage returns the TS ValidationPeriod interface.
// Let's update it to use the new unpack function and convert the result.
// ... existing parseRegisterL1ValidatorMessage ...
export function parseRegisterL1ValidatorMessage(input: Uint8Array): ValidationPeriod {
    const parsedPayload = unpackRegisterL1ValidatorPayload(input);

    // Convert SolidityValidationPeriod back to ValidationPeriod (bytes to strings/hex)
    const validation: ValidationPeriod = {
        subnetId: utils.base58check.encode(parsedPayload.subnetID),
        // Convert nodeID bytes back to NodeID- format if possible, otherwise hex
        // This requires assuming the original format or storing it somehow if needed.
        // For simplicity, let's use base58check encoding which is common for NodeIDs.
        nodeID: `NodeID-${utils.base58check.encode(parsedPayload.nodeID)}`,
        blsPublicKey: bytesToHexPrefixed(parsedPayload.blsPublicKey),
        registrationExpiry: parsedPayload.registrationExpiry,
        remainingBalanceOwner: parsedPayload.remainingBalanceOwner, // Assumes structure matches
        disableOwner: parsedPayload.disableOwner, // Assumes structure matches
        weight: parsedPayload.weight
    };
    return validation;
}


// --- L1ValidatorRegistrationMessage ---

// Function to pack *only* the payload:
function packL1ValidatorRegistrationPayload(validationID: Uint8Array, registered: boolean): Uint8Array {
    if (validationID.length !== 32) {
        throw new Error('ValidationID must be exactly 32 bytes');
    }
    return concatenateUint8Arrays(
        encodeUint16(CODEC_ID),
        encodeUint32(L1_VALIDATOR_REGISTRATION_MESSAGE_TYPE_ID),
        validationID,
        new Uint8Array([registered ? 1 : 0]) // bool (1 byte)
    );
}

/**
 * Packs a L1ValidatorRegistration message for sending (wrapped).
 * Uses the existing L1ValidatorRegistration interface.
 */
// ... existing packL1ValidatorRegistration ...
// Update to use constants and the payload function
export function packL1ValidatorRegistration(
    validationID: Uint8Array,
    registered: boolean,
    networkID: number,
    sourceChainID: string
): Uint8Array {
    const messagePayload = packL1ValidatorRegistrationPayload(validationID, registered);

    // Create addressed call with empty source address
    const addressedCall = newAddressedCall(new Uint8Array([]), messagePayload);

    // Create unsigned message
    return newUnsignedMessage(networkID, sourceChainID, addressedCall);
}


/**
 * Parses the payload of a L1ValidatorRegistrationMessage.
 * Format: codecID (uint16), typeID (uint32), validationID (bytes32), valid (bool)
 * Returns the L1ValidatorRegistration interface fields.
 */
export function unpackL1ValidatorRegistrationPayload(payload: Uint8Array): L1ValidatorRegistration {
    const EXPECTED_LENGTH = 39; // 2 + 4 + 32 + 1 bytes
    if (payload.length !== EXPECTED_LENGTH) {
        throw new Error(`Invalid L1ValidatorRegistration payload length. Expected ${EXPECTED_LENGTH} bytes, got ${payload.length}`);
    }

    const codecID = parseUint16(payload, 0);
    if (codecID !== CODEC_ID) {
        throw new Error(`Invalid codec ID: ${codecID}`);
    }

    const typeID = parseUint32(payload, 2);
    if (typeID !== L1_VALIDATOR_REGISTRATION_MESSAGE_TYPE_ID) {
        throw new Error(`Invalid message type: ${typeID}`);
    }

    const validationID = parseBytes(payload, 6, 32); // 32 bytes
    const registered = payload[38] === 1; // Last byte (bool)

    return {
        validationID,
        registered,
    };
}


// Existing parseL1ValidatorRegistration - Update to use the unpack function
// ... existing parseL1ValidatorRegistration ...
export function parseL1ValidatorRegistration(bytes: Uint8Array): L1ValidatorRegistration {
    // This function already expected the payload bytes based on its original implementation.
    return unpackL1ValidatorRegistrationPayload(bytes);
}


// --- L1ValidatorWeightMessage --- NEW ---

/**
 * Packs the payload for a L1ValidatorWeightMessage.
 * Format: codecID (uint16), typeID (uint32), validationID (bytes32), nonce (uint64), weight (uint64)
 * Total Length: 54 bytes
 */
function packL1ValidatorWeightPayload(args: L1ValidatorWeight): Uint8Array {
     if (args.validationID.length !== 32) {
        throw new Error('ValidationID must be exactly 32 bytes');
    }
    return concatenateUint8Arrays(
        encodeUint16(CODEC_ID),
        encodeUint32(L1_VALIDATOR_WEIGHT_MESSAGE_TYPE_ID),
        args.validationID,
        encodeUint64(args.nonce),
        encodeUint64(args.weight)
    );
}

/**
 * Packs a L1ValidatorWeightMessage for sending (wrapped in unsigned message structure).
 */
export function packL1ValidatorWeightMessage(
    args: L1ValidatorWeight,
    networkID: number,
    sourceChainID: string
): Uint8Array {
    const payload = packL1ValidatorWeightPayload(args);
    const addressedCall = newAddressedCall(new Uint8Array([]), payload);
    return newUnsignedMessage(networkID, sourceChainID, addressedCall);
}

/**
 * Unpacks the payload of a L1ValidatorWeightMessage.
 * Returns the L1ValidatorWeight interface fields.
 */
export function unpackL1ValidatorWeightPayload(payload: Uint8Array): L1ValidatorWeight {
    const EXPECTED_LENGTH = 54; // 2 + 4 + 32 + 8 + 8
    if (payload.length !== EXPECTED_LENGTH) {
        throw new Error(`Invalid L1ValidatorWeight payload length. Expected ${EXPECTED_LENGTH} bytes, got ${payload.length}`);
    }

    let offset = 0;
    const codecID = parseUint16(payload, offset); offset += 2;
    if (codecID !== CODEC_ID) {
        throw new Error(`Invalid codec ID: ${codecID}`);
    }

    const typeID = parseUint32(payload, offset); offset += 4;
    if (typeID !== L1_VALIDATOR_WEIGHT_MESSAGE_TYPE_ID) {
        throw new Error(`Invalid message type: ${typeID}`);
    }

    const validationID = parseBytes(payload, offset, 32); offset += 32;
    const nonce = parseUint64(payload, offset); offset += 8;
    const weight = parseUint64(payload, offset); offset += 8;

     if (offset !== payload.length) {
         throw new Error("Did not consume entire payload buffer during L1ValidatorWeight unpack");
     }

    return { validationID, nonce, weight };
}


// --- ValidationUptimeMessage --- NEW ---

/**
 * Packs the payload for a ValidationUptimeMessage.
 * Format: codecID (uint16), typeID (uint32), validationID (bytes32), uptime (uint64)
 * Total Length: 46 bytes
 */
function packValidationUptimePayload(args: ValidationUptime): Uint8Array {
     if (args.validationID.length !== 32) {
        throw new Error('ValidationID must be exactly 32 bytes');
    }
    return concatenateUint8Arrays(
        encodeUint16(CODEC_ID),
        encodeUint32(VALIDATION_UPTIME_MESSAGE_TYPE_ID),
        args.validationID,
        encodeUint64(args.uptime)
    );
}

/**
 * Packs a ValidationUptimeMessage for sending (wrapped in unsigned message structure).
 */
export function packValidationUptimeMessage(
    args: ValidationUptime,
    networkID: number,
    sourceChainID: string
): Uint8Array {
    const payload = packValidationUptimePayload(args);
    // Assuming uptime messages also use the addressed call structure like others
    const addressedCall = newAddressedCall(new Uint8Array([]), payload);
    return newUnsignedMessage(networkID, sourceChainID, addressedCall);
}

/**
 * Unpacks the payload of a ValidationUptimeMessage.
 * Returns the ValidationUptime interface fields.
 */
export function unpackValidationUptimePayload(payload: Uint8Array): ValidationUptime {
    const EXPECTED_LENGTH = 46; // 2 + 4 + 32 + 8
    if (payload.length !== EXPECTED_LENGTH) {
        throw new Error(`Invalid ValidationUptime payload length. Expected ${EXPECTED_LENGTH} bytes, got ${payload.length}`);
    }

    let offset = 0;
    const codecID = parseUint16(payload, offset); offset += 2;
    if (codecID !== CODEC_ID) {
        throw new Error(`Invalid codec ID: ${codecID}`);
    }

    const typeID = parseUint32(payload, offset); offset += 4;
     // Note: typeID 0 is reused. Ensure context distinguishes this from SubnetToL1Conversion
    if (typeID !== VALIDATION_UPTIME_MESSAGE_TYPE_ID) {
       throw new Error(`Invalid message type: ${typeID}, expected ${VALIDATION_UPTIME_MESSAGE_TYPE_ID}`);
       // Or potentially allow SUBNET_TO_L1_CONVERSION_MESSAGE_TYPE_ID if context is ambiguous?
    }

    const validationID = parseBytes(payload, offset, 32); offset += 32;
    const uptime = parseUint64(payload, offset); offset += 8;

    if (offset !== payload.length) {
         throw new Error("Did not consume entire payload buffer during ValidationUptime unpack");
     }

    return { validationID, uptime };
}


// --- Remaining existing functions ---
// ... (newAddressedCall, newSubnetToL1Conversion, newUnsignedMessage, compareNodeIDs, packL1ConversionMessage) ...
// Ensure they use CODEC_ID constant where applicable
export function newAddressedCall(sourceAddress: Uint8Array, payload: Uint8Array): Uint8Array {
    const parts: Uint8Array[] = [];

    parts.push(encodeUint16(CODEC_ID)); // Use constant
    parts.push(encodeUint32(1));//FIXME: I have zero idea what this is, but every time it is "00000001" -> This looks like a Type ID for AddressedCall itself?
    parts.push(encodeVarBytes(sourceAddress));
    parts.push(encodeVarBytes(payload));

    return concatenateUint8Arrays(...parts);
}

export function newSubnetToL1Conversion(subnetConversionID: Uint8Array): Uint8Array {
     if (subnetConversionID.length !== 32) {
        throw new Error('subnetConversionID must be exactly 32 bytes');
    }
    const parts: Uint8Array[] = [];

    // Add codec version (uint16)
    parts.push(encodeUint16(CODEC_ID)); // Use constant

    // Add empty source address length (uint32) -> This seems to deviate from Solidity's packSubnetToL1ConversionMessage
    // Solidity packs TypeID=0 here. This packs length=0.
    // Keeping original TS logic here, as it's used internally by packL1ConversionMessage.
    parts.push(encodeUint32(0));

    // Add subnetConversionID
    parts.push(subnetConversionID);

    return concatenateUint8Arrays(...parts);
}


export function newUnsignedMessage(networkID: number, sourceChainID: string, message: Uint8Array): Uint8Array {
    const parts: Uint8Array[] = [];

    // Add codec version (uint16)
    parts.push(encodeUint16(CODEC_ID)); // Use constant

    // Add networkID (uint32)
    parts.push(encodeUint32(networkID));

    // Add sourceChainID
    parts.push(utils.base58check.decode(sourceChainID));

    // Add message length and message
    parts.push(encodeUint32(message.length));
    parts.push(message);

    return concatenateUint8Arrays(...parts);
}

export const compareNodeIDs = (a: string, b: string) => {
    // console.log(a, b); // Removed console log
    let aNodeID: Uint8Array;
    let bNodeID: Uint8Array;

    try {
        // Try to parse as NodeID-{base58check} or hex
        aNodeID = a.startsWith("NodeID-") ? utils.base58check.decode(a.split("-")[1]) : utils.hexToBuffer(a);
        bNodeID = b.startsWith("NodeID-") ? utils.base58check.decode(b.split("-")[1]) : utils.hexToBuffer(b);
    } catch (error: any) {
        // Fallback to string comparison if parsing fails (e.g., invalid format)
        console.warn(`Failed to parse NodeIDs for comparison ('${a}', '${b}'), falling back to string compare: ${error.message}`);
        return a.localeCompare(b);
    }

    // Compare byte arrays lexicographically
    const minLength = Math.min(aNodeID.length, bNodeID.length);
    for (let i = 0; i < minLength; i++) {
        if (aNodeID[i] !== bNodeID[i]) {
            return aNodeID[i] < bNodeID[i] ? -1 : 1;
        }
    }
    // If one is a prefix of the other, the shorter one comes first
    return aNodeID.length - bNodeID.length;
}


export function packL1ConversionMessage(args: PackL1ConversionMessageArgs, networkID: number, sourceChainID: string): [Uint8Array, Uint8Array] {
    // Uses subnetToL1ConversionID -> marshalSubnetToL1ConversionData (based on TS interfaces)
    const subnetConversionID = subnetToL1ConversionID(args);

    // Uses newSubnetToL1Conversion (which packs codec, len=0, id)
    const addressedCallPayload = newSubnetToL1Conversion(subnetConversionID);

    // Uses newAddressedCall (which packs codec, type=1, sourceAddr, payload)
    const subnetConversionAddressedCall = newAddressedCall(new Uint8Array([]), addressedCallPayload);

    // Uses newUnsignedMessage (which packs codec, network, sourceChain, message)
    const unsignedMessage = newUnsignedMessage(networkID, sourceChainID, subnetConversionAddressedCall);
    return [unsignedMessage, utils.base58check.decode(args.subnetId)];
}

// Removed duplicate parsing helpers from the end of the file as they were moved up