// FIXME: this is a quick hack solution untill AvalancheJS supports this
// Please don't copy this code to other projects!
import { sha256 } from '@noble/hashes/sha256';
import { utils } from '@avalabs/avalanchejs';


export interface PackL1ConversionMessageArgs {
    subnetId: string;
    managerChainID: string;
    managerAddress: string;
    validators: SubnetToL1ConversionValidatorData[];
}

export interface SubnetToL1ConversionValidatorData {
    nodeID: string;
    nodePOP: {
        publicKey: string;
        proofOfPossession: string;
    };
    weight: number;
}

const codecVersion = 0;

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

export function marshalSubnetToL1ConversionData(args: PackL1ConversionMessageArgs): Uint8Array {
    const parts: Uint8Array[] = [];

    parts.push(encodeUint16(codecVersion));
    parts.push(utils.base58check.decode(args.subnetId));
    parts.push(utils.base58check.decode(args.managerChainID));
    parts.push(encodeVarBytes(utils.hexToBuffer(args.managerAddress)));
    parts.push(encodeUint32(args.validators.length));

    // Sort validators by nodeID
    let sortedValidators;
    try {
        sortedValidators = [...args.validators].sort((a, b) => compareNodeIDs(a.nodeID, b.nodeID));
    } catch (error: any) {
        console.warn("Error sorting validators, using original order:", error);
        sortedValidators = args.validators;
    }

    for (const validator of sortedValidators) {
        if (!validator.nodeID || !validator.nodePOP) {
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
        
        parts.push(encodeVarBytes(nodeIDBytes));
        parts.push(utils.hexToBuffer(validator.nodePOP.publicKey));
        parts.push(encodeUint64(BigInt(validator.weight)));
    }

    const result = concatenateUint8Arrays(...parts);
    return result;
}

export function subnetToL1ConversionID(args: PackL1ConversionMessageArgs): Uint8Array {
    const data = marshalSubnetToL1ConversionData(args);
    return sha256(data);
}

export function newAddressedCall(sourceAddress: Uint8Array, payload: Uint8Array): Uint8Array {
    const parts: Uint8Array[] = [];

    parts.push(encodeUint16(codecVersion));
    parts.push(encodeUint32(1));//FIXME: I have zero idea what this is, but every time it is "00000001"
    parts.push(encodeVarBytes(sourceAddress));
    parts.push(encodeVarBytes(payload));

    return concatenateUint8Arrays(...parts);
}

export function newSubnetToL1Conversion(subnetConversionID: Uint8Array): Uint8Array {
    const parts: Uint8Array[] = [];

    // Add codec version (uint16)
    parts.push(encodeUint16(codecVersion));

    // Add empty source address length (uint32)
    parts.push(encodeUint32(0));

    // Add subnetConversionID
    parts.push(subnetConversionID);

    return concatenateUint8Arrays(...parts);
}

export function newUnsignedMessage(networkID: number, sourceChainID: string, message: Uint8Array): Uint8Array {
    const parts: Uint8Array[] = [];

    // Add codec version (uint16)
    parts.push(encodeUint16(codecVersion));

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
    console.log(a, b);
    let aNodeID: Uint8Array;
    let bNodeID: Uint8Array;
    
    try {
        // Try to parse as NodeID-{base58check}
        aNodeID = a.startsWith("NodeID-") ? utils.base58check.decode(a.split("-")[1]) : utils.hexToBuffer(a);
        bNodeID = b.startsWith("NodeID-") ? utils.base58check.decode(b.split("-")[1]) : utils.hexToBuffer(b);
    } catch (error: any) {
        // If parsing fails, convert to hex strings for comparison
        const aHex = a.startsWith("0x") ? a : `0x${a}`;
        const bHex = b.startsWith("0x") ? b : `0x${b}`;
        return aHex.localeCompare(bHex);
    }

    // Compare all bytes
    const minLength = Math.min(aNodeID.length, bNodeID.length);
    for (let i = 0; i < minLength; i++) {
        if (aNodeID[i] !== bNodeID[i]) {
            return aNodeID[i] < bNodeID[i] ? -1 : 1;
        }
    }

    // If all bytes match up to the minimum length, the shorter one is considered less
    if (aNodeID.length < bNodeID.length) return -1;
    if (aNodeID.length > bNodeID.length) return 1;
    return 0;
}


export function packL1ConversionMessage(args: PackL1ConversionMessageArgs, networkID: number, sourceChainID: string): [Uint8Array, Uint8Array] {
    const subnetConversionID = subnetToL1ConversionID(args);

    const addressedCallPayload = newSubnetToL1Conversion(subnetConversionID)

    const subnetConversionAddressedCall = newAddressedCall(new Uint8Array([]), addressedCallPayload)

    const unsignedMessage = newUnsignedMessage(networkID, sourceChainID, subnetConversionAddressedCall);
    return [unsignedMessage, utils.base58check.decode(args.subnetId)];
}

export interface PChainOwner {
    threshold: number;
    addresses: `0x${string}`[];
}

export interface ValidationPeriod {
    subnetId: string;
    nodeID: string;
    blsPublicKey: `0x${string}`;
    registrationExpiry: bigint;
    remainingBalanceOwner: PChainOwner;
    disableOwner: PChainOwner;
    weight: bigint;
}

const REGISTER_L1_VALIDATOR_MESSAGE_TYPE_ID = 1;

export function packRegisterL1ValidatorMessage(
    validationPeriod: ValidationPeriod,
    networkID: number,
    sourceChainID: string
): Uint8Array {
    const parts: Uint8Array[] = [];

    // Validate BLS public key length
    const blsPublicKeyBytes = utils.hexToBuffer(validationPeriod.blsPublicKey);
    if (blsPublicKeyBytes.length !== 48) {
        throw new Error('Invalid BLS public key length');
    }

    // Add codec version (uint16)
    parts.push(encodeUint16(codecVersion));

    // Add type ID (uint32)
    parts.push(encodeUint32(REGISTER_L1_VALIDATOR_MESSAGE_TYPE_ID));

    // Add subnetId
    parts.push(utils.base58check.decode(validationPeriod.subnetId));

    // Add nodeID
    const nodeIDBytes = validationPeriod.nodeID.startsWith("NodeID-") ? utils.base58check.decode(validationPeriod.nodeID.split("-")[1]) : utils.hexToBuffer(validationPeriod.nodeID);
    parts.push(encodeVarBytes(nodeIDBytes));

    // Add BLS public key
    parts.push(blsPublicKeyBytes);

    // Add registration expiry
    parts.push(encodeUint64(validationPeriod.registrationExpiry));

    // Add remaining balance owner
    parts.push(encodeUint32(validationPeriod.remainingBalanceOwner.threshold));
    parts.push(encodeUint32(validationPeriod.remainingBalanceOwner.addresses.length));
    for (const address of validationPeriod.remainingBalanceOwner.addresses) {
        parts.push(utils.hexToBuffer(address));
    }

    // Add disable owner
    parts.push(encodeUint32(validationPeriod.disableOwner.threshold));
    parts.push(encodeUint32(validationPeriod.disableOwner.addresses.length));
    for (const address of validationPeriod.disableOwner.addresses) {
        parts.push(utils.hexToBuffer(address));
    }

    // Add weight
    parts.push(encodeUint64(validationPeriod.weight));

    const payload = concatenateUint8Arrays(...parts);

    // Create addressed call with empty source address
    const addressedCall = newAddressedCall(new Uint8Array([]), payload);

    // Create unsigned message
    const unsignedMessage = newUnsignedMessage(networkID, sourceChainID, addressedCall);

    return unsignedMessage;
}

export interface L1ValidatorRegistration {
    validationID: Uint8Array;
    registered: boolean;
}

const L1_VALIDATOR_REGISTRATION_MESSAGE_TYPE_ID = 2; // You may need to verify this constant value

/**
 * Packs a L1ValidatorRegistrationMessage into a byte array.
 * The message format specification is:
 * +--------------+----------+----------+
 * |      codecID :   uint16 |  2 bytes |
 * +--------------+----------+----------+
 * |       typeID :   uint32 |  4 bytes |
 * +--------------+----------+----------+
 * | validationID : [32]byte | 32 bytes |
 * +--------------+----------+----------+
 * |        valid :     bool |  1 byte  |
 * +--------------+----------+----------+
 *                           | 39 bytes |
 *                           +----------+
 */
export function packL1ValidatorRegistration(
    validationID: Uint8Array,
    registered: boolean,
    networkID: number,
    sourceChainID: string
): Uint8Array {
    // Validate validationID length
    if (validationID.length !== 32) {
        throw new Error('ValidationID must be exactly 32 bytes');
    }

    const messagePayload = concatenateUint8Arrays(
        encodeUint16(codecVersion),
        encodeUint32(L1_VALIDATOR_REGISTRATION_MESSAGE_TYPE_ID),
        validationID,
        new Uint8Array([registered ? 1 : 0])
    );

    // Create addressed call with empty source address
    const addressedCall = newAddressedCall(new Uint8Array([]), messagePayload);

    // Create unsigned message
    return newUnsignedMessage(networkID, sourceChainID, addressedCall);
}

export function parseL1ValidatorRegistration(bytes: Uint8Array): L1ValidatorRegistration {
    const EXPECTED_LENGTH = 39; // 2 + 4 + 32 + 1 bytes

    if (bytes.length !== EXPECTED_LENGTH) {
        throw new Error(`Invalid message length. Expected ${EXPECTED_LENGTH} bytes, got ${bytes.length}`);
    }

    // Skip first 6 bytes (2 bytes codecID + 4 bytes typeID)
    const validationID = bytes.slice(6, 38); // 32 bytes
    const registered = bytes[38] === 1; // Last byte

    return {
        validationID,
        registered,
    };
}

/**
 * Parses a RegisterL1ValidatorMessage from a byte array.
 * The message format specification is:
 *
 * RegisterL1ValidatorMessage:
 * +-----------------------+-------------+--------------------------------------------------------------------+
 * |               codecID :      uint16 |                                                            2 bytes |
 * +-----------------------+-------------+--------------------------------------------------------------------+
 * |                typeID :      uint32 |                                                            4 bytes |
 * +-----------------------+-------------+-------------------------------------------------------------------+
 * |              subnetID :    [32]byte |                                                           32 bytes |
 * +-----------------------+-------------+--------------------------------------------------------------------+
 * |                nodeID :      []byte |                                              4 + len(nodeID) bytes |
 * +-----------------------+-------------+--------------------------------------------------------------------+
 * |          blsPublicKey :    [48]byte |                                                           48 bytes |
 * +-----------------------+-------------+--------------------------------------------------------------------+
 * |                expiry :      uint64 |                                                            8 bytes |
 * +-----------------------+-------------+--------------------------------------------------------------------+
 * | remainingBalanceOwner : PChainOwner |                                      8 + len(addresses) * 20 bytes |
 * +-----------------------+-------------+--------------------------------------------------------------------+
 * |          disableOwner : PChainOwner |                                      8 + len(addresses) * 20 bytes |
 * +-----------------------+-------------+--------------------------------------------------------------------+
 * |                weight :      uint64 |                                                            8 bytes |
 * +-----------------------+-------------+--------------------------------------------------------------------+
 *                                       | 122 + len(nodeID) + (len(addresses1) + len(addresses2)) * 20 bytes |
 *                                       +--------------------------------------------------------------------+
 *
 * PChainOwner:
 * +-----------+------------+-------------------------------+
 * | threshold :     uint32 |                       4 bytes |
 * +-----------+------------+-------------------------------+
 * | addresses : [][20]byte | 4 + len(addresses) * 20 bytes |
 * +-----------+------------+-------------------------------+
 *                          | 8 + len(addresses) * 20 bytes |
 *                          +-------------------------------+
 */
export function parseRegisterL1ValidatorMessage(input: Uint8Array): ValidationPeriod {
    let index = 0;
    const validation: ValidationPeriod = {
        subnetId: '',
        nodeID: '',
        blsPublicKey: '0x',
        registrationExpiry: 0n,
        remainingBalanceOwner: { threshold: 0, addresses: [] },
        disableOwner: { threshold: 0, addresses: [] },
        weight: 0n
    };

    // Parse codec ID
    const codecID = parseUint16(input, index);
    if (codecID !== codecVersion) {
        throw new Error(`Invalid codec ID: ${codecID}`);
    }
    index += 2;

    // Parse type ID
    const typeID = parseUint32(input, index);
    if (typeID !== REGISTER_L1_VALIDATOR_MESSAGE_TYPE_ID) {
        throw new Error(`Invalid message type: ${typeID}`);
    }
    index += 4;

    // Parse subnetID
    const subnetIDBytes = input.slice(index, index + 32);
    validation.subnetId = utils.base58check.encode(subnetIDBytes);
    index += 32;

    // Parse nodeID length
    const nodeIDLength = parseUint32(input, index);
    index += 4;

    // Parse nodeID
    const nodeIDBytes = input.slice(index, index + nodeIDLength);
    validation.nodeID = `NodeID-${utils.base58check.encode(nodeIDBytes)}`;
    index += nodeIDLength;

    // Parse BLS public key
    const blsPublicKeyBytes = input.slice(index, index + 48);
    validation.blsPublicKey = `0x${Buffer.from(blsPublicKeyBytes).toString('hex')}`;
    index += 48;

    // Parse registration expiry
    validation.registrationExpiry = parseUint64(input, index);
    index += 8;

    // Parse remainingBalanceOwner threshold
    validation.remainingBalanceOwner.threshold = parseUint32(input, index);
    index += 4;

    // Parse remainingBalanceOwner addresses length
    const remainingBalanceOwnerAddressesLength = parseUint32(input, index);
    index += 4;

    // Parse remainingBalanceOwner addresses
    validation.remainingBalanceOwner.addresses = [];
    for (let i = 0; i < remainingBalanceOwnerAddressesLength; i++) {
        const addrBytes = input.slice(index, index + 20);
        const addr = `0x${Buffer.from(addrBytes).toString('hex')}`;
        validation.remainingBalanceOwner.addresses.push(addr as `0x${string}`);
        index += 20;
    }

    // Parse disableOwner threshold
    validation.disableOwner.threshold = parseUint32(input, index);
    index += 4;

    // Parse disableOwner addresses length
    const disableOwnerAddressesLength = parseUint32(input, index);
    index += 4;

    // Parse disableOwner addresses
    validation.disableOwner.addresses = [];
    for (let i = 0; i < disableOwnerAddressesLength; i++) {
        const addrBytes = input.slice(index, index + 20);
        const addr = `0x${Buffer.from(addrBytes).toString('hex')}`;
        validation.disableOwner.addresses.push(addr as `0x${string}`);
        index += 20;
    }

    // Validate input length
    const expectedLength = 122 + nodeIDLength + (remainingBalanceOwnerAddressesLength + disableOwnerAddressesLength) * 20;
    if (input.length !== expectedLength) {
        throw new Error(`Invalid message length: got ${input.length}, expected ${expectedLength}`);
    }

    // Parse weight
    validation.weight = parseUint64(input, index);

    return validation;
}

// Helper functions for parsing numbers
function parseUint16(input: Uint8Array, offset: number): number {
    let result = 0;
    for (let i = 0; i < 2; i++) {
        result = (result << 8) | input[offset + i];
    }
    return result;
}

function parseUint32(input: Uint8Array, offset: number): number {
    let result = 0;
    for (let i = 0; i < 4; i++) {
        result = (result << 8) | input[offset + i];
    }
    return result;
}

function parseUint64(input: Uint8Array, offset: number): bigint {
    let result = 0n;
    for (let i = 0; i < 8; i++) {
        result = (result << 8n) | BigInt(input[offset + i]);
    }
    return result;
}