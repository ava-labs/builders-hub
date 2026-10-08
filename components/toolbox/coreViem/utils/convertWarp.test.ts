import { describe, it, expect } from 'vitest';
import {
  newAddressedCall,
  marshalSubnetToL1ConversionData,
  PackL1ConversionMessageArgs,
  packL1ConversionMessage,
  subnetToL1ConversionID,
  newUnsignedMessage,
  newSubnetToL1Conversion,
  compareNodeIDs,
} from './convertWarp';
import { utils } from '@avalabs/avalanchejs';
const { hexToBuffer, bufferToHex } = utils;

const node1Validator = {
  nodeID: 'NodeID-FTbzbUVtjSpKC4nFFFM9Gb8iAqJKZpzMQ',
  nodePOP: {
    publicKey:
      '0xa2ea5071b185225223ceb743fe265b47905fff03c64d6517733b9f79bde4937bfab0a7b903e697e2b4b5b90a7aa74427' as `0x${string}`,
    proofOfPossession:
      '0x98b52bcfbbb9425f14ca97aedcfc318e00f92daaac711cb0b6a7da4af9c9aac20f4ce986f45165747c4f5ece93860c250640e060a0ac6af89c95f2aadff1eb2515bb9fdd05dbdfa12bf63ba7e07dc53b94f37c31a3ecc680fdb76cc300821b8c' as `0x${string}`,
  },
  weight: 100,
};

const node2Validator = {
  nodeID: 'NodeID-5o3bfUMfJhxfKYSKu3VyiAq7APVZNyX19',
  nodePOP: {
    publicKey:
      '0xa09e63e32ce3b24205455bc470b54d6260bc826821857458b67adcab63ea842b392407b9dff0564ce520f6337ac2b5ca' as `0x${string}`,
    proofOfPossession:
      '0x83fdae9dc276b17c8fe21f2800b6794466102d17d59ff914e667ed2ba4fecd948ad226b7d3aec6e5c813a303ef58429919ee029472646c582e636b07051fc495ae4c12f3b624f87945a489d5902472e53239a9a1417be83ecd6c9cd987f32663' as `0x${string}`,
  },
  weight: 100,
};

const defaultArgs: PackL1ConversionMessageArgs = {
  subnetId: 'PFWYqXhRtrKGRvnSwCpxMXKa9d1pHmY8ASzu8mRCCBCb25p17',
  managerChainID: 'QchxtYKkzHYB6qxLUfvpi95hgDYvMVVKh39YEdaGBZ7Lo6XKN',
  managerAddress: '0xc0dd1cdd60bd82a4c48fa06ddbd927da5443c58a',
  validators: [node1Validator, node2Validator],
};

describe('L1 Conversion Tests', () => {
  it('should correctly marshal subnet to L1 conversion data', () => {
    // The P-Chain accepts a conversion only with validators sorted by NodeID bytes,
    // and it hashes them in that order. node2 (0x3495...) sorts before node1 (0x9e99...).
    const marshaledData = marshalSubnetToL1ConversionData(defaultArgs);
    expect(bufferToHex(marshaledData)).toBe(
      '0x000032858f45b192eeb190e643f6915d45f832def5d2021b77b151867ec29843af18359f4649f7d828a1ea590ae669509ac86fa9fc0cd7cd83f048323a73a1d315ad00000014c0dd1cdd60bd82a4c48fa06ddbd927da5443c58a00000002000000143495ce47a5968640acd0cbf613c050fd0a5b30cea09e63e32ce3b24205455bc470b54d6260bc826821857458b67adcab63ea842b392407b9dff0564ce520f6337ac2b5ca0000000000000064000000149e99c96338c2ae4131ba1d4fb1a9dd146e06d16ca2ea5071b185225223ceb743fe265b47905fff03c64d6517733b9f79bde4937bfab0a7b903e697e2b4b5b90a7aa744270000000000000064',
    );

    const conversionID = subnetToL1ConversionID(defaultArgs);
    expect(bufferToHex(conversionID)).toBe('0x2df2b6d72ff53488cdbae244f47f89826a0943cb5032a9b248ec0187b0d11a24');
  });

  it('matches the conversionID the P-Chain recorded for a Fuji L1', () => {
    // Fuji ConvertSubnetToL1Tx 2N6tzZQv338eazcQKiJAJ8sFzcJf5eYwEn1AdpjivTRxd6UKKA, validators in reverse order.
    const args: PackL1ConversionMessageArgs = {
      subnetId: '2JTusgMZNJUkrMX4iyk2ZUMVs26R2JxgHjUfJNePxpDcRoqS12',
      managerChainID: 'RE6UavxW2LZJJdtahKDUdPTUhzdg5HQU36JvRdiPhXPFCHMbq',
      managerAddress: '0x0feedc0de0000000000000000000000000000000',
      validators: [
        {
          nodeID: '0x87faefe9f6699b1c5308cda2c92d102ae10635a0',
          nodePOP: {
            publicKey:
              '0xa589cf54da93293ead602cea7ee65a8bb13557a230f04a9610ed4d8f7511d58045c9eccdd4437eba65f9f4753994bebb',
            proofOfPossession: '0x',
          },
          weight: 100,
        },
        {
          nodeID: '0x69a40ea2df933ca0ec830e6aa610f55b4e703e39',
          nodePOP: {
            publicKey:
              '0xb42ee4de052229f296f9cc5d295709810eb5078e24f7fd30ae41047e64237ab3ba5662ac6c9f5854aaab58b9505f2de5',
            proofOfPossession: '0x',
          },
          weight: 100,
        },
      ],
    };

    // platform.getSubnet conversionID of the subnet.
    const onChainConversionID = utils.base58check.decode('2eSKRF2wapCWveTJaxaEVP5Y27wAS7k6cNEARrgSY1Hky2wnjg');
    expect(bufferToHex(subnetToL1ConversionID(args))).toBe(bufferToHex(onChainConversionID));
  });

  describe('AddressedCall', () => {
    const cases = [
      {
        name: 'subnet conversion with empty sourceAddress',
        sourceAddress: hexToBuffer('0x'),
        payload: hexToBuffer('0x11223344'),
        expected: '0x' + '0000' + '00000001' + '00000000' + '' + '00000004' + '11223344',
      },
      {
        name: 'subnet conversion with non-empty sourceAddress',
        sourceAddress: hexToBuffer('0x77777777'),
        payload: hexToBuffer('0x111111'),
        expected: '0x' + '0000' + '00000001' + '00000004' + '77777777' + '00000003' + '111111',
      },
    ];

    cases.forEach(({ name, sourceAddress, payload, expected }) => {
      it(name, () => {
        const result = newAddressedCall(sourceAddress, payload);
        expect(bufferToHex(result)).toBe(expected);
      });
    });
  });

  it('should pack L1 conversion message', () => {
    const expectedMessage =
      '0x000000000005' + //fuji ID
      '0000000000000000000000000000000000000000000000000000000000000000' + //platform chain id
      '00000034' + // ?
      '00000000000100000000000000260000000000002df2b6d72ff53488cdbae244f47f89826a0943cb5032a9b248ec0187b0d11a24'; //subnetConversionAddressedCall

    const [message, justification] = packL1ConversionMessage(defaultArgs, 5, '11111111111111111111111111111111LpoYY');
    expect(bufferToHex(message)).toBe(expectedMessage);
    expect(bufferToHex(justification)).toBe('0x32858f45b192eeb190e643f6915d45f832def5d2021b77b151867ec29843af18');
  });

  it('should create new unsigned message', () => {
    const networkID = 12345;
    const sourceChainID = 'PFWYqXhRtrKGRvnSwCpxMXKa9d1pHmY8ASzu8mRCCBCb25p17';
    const message = hexToBuffer('0x11223344');

    const result = newUnsignedMessage(networkID, sourceChainID, message);

    expect(bufferToHex(result)).toBe(
      '0x' +
        '0000' + // codec version
        '00003039' + // networkID (12345 in hex)
        '32858f45b192eeb190e643f6915d45f832def5d2021b77b151867ec29843af18' + // sourceChainID bytes
        '00000004' + // message length
        '11223344', // message
    );
  });

  it('should create new subnet to L1 conversion', () => {
    const subnetConversionID = utils.base58check.decode('PFWYqXhRtrKGRvnSwCpxMXKa9d1pHmY8ASzu8mRCCBCb25p17');
    const result = newSubnetToL1Conversion(subnetConversionID);

    expect(bufferToHex(result)).toBe(
      '0x' +
        '0000' + // codec version
        '00000000' + // empty source address length
        '32858f45b192eeb190e643f6915d45f832def5d2021b77b151867ec29843af18', // subnetConversionID bytes
    );
  });
});

describe('compareNodeIDs', () => {
  const testCases = [
    {
      name: 'first node ID is less than second',
      a: 'NodeID-5o3bfUMfJhxfKYSKu3VyiAq7APVZNyX19',
      b: 'NodeID-FTbzbUVtjSpKC4nFFFM9Gb8iAqJKZpzMQ',
      expected: -1,
    },
    {
      name: 'first node ID is greater than second',
      a: 'NodeID-MFrZFVCXPv5iCn6M9K6XduxGTYp891xXZ',
      b: 'NodeID-7Xhw2mDxuDS44j42TCB6U5579esbSt3Lg',
      expected: 1,
    },
    {
      name: 'node IDs are equal',
      a: 'NodeID-NFBbbJ4qCmNaCzeW7sxErhvWqvEQMnYcN',
      b: 'NodeID-NFBbbJ4qCmNaCzeW7sxErhvWqvEQMnYcN',
      expected: 0,
    },
    {
      name: 'node IDs with very different values',
      a: 'NodeID-1111111111111111111111111111111111',
      b: 'NodeID-9999999999999999999999999999999999',
      expected: -1,
    },
    {
      name: 'node IDs with different lengths',
      a: 'NodeID-1111111111111111111111111111111111',
      b: 'NodeID-11111111111111111111111111111111111',
      expected: -1,
    },
  ];

  testCases.forEach(({ name, a, b, expected }) => {
    it(name, () => {
      expect(compareNodeIDs(a, b)).toBe(expected);
    });
  });
});
