import { expect, test, describe } from 'vitest'
import { packWarpIntoAccessList } from './packWarp.js'
import { hexToBytes } from 'viem/utils';

describe('packWarpIntoAccessList', () => {
    test('empty input', () => {
        const result = packWarpIntoAccessList(new Uint8Array([]));
        expect(result).toEqual([{
            address: "0x0200000000000000000000000000000000000005",
            storageKeys: [
                "0xff00000000000000000000000000000000000000000000000000000000000000"
            ]
        }]);
    });

    test('single chunk', () => {
        const input = new TextEncoder().encode("hello world");
        const result = packWarpIntoAccessList(input);
        expect(result).toEqual([{
            address: "0x0200000000000000000000000000000000000005",
            storageKeys: [
                "0x68656c6c6f20776f726c64ff0000000000000000000000000000000000000000"
            ]
        }]);
    });

    test('multiple chunks', () => {
        const input = new TextEncoder().encode(
            "this is a longer string that should be split into multiple 32-byte chunks for testing purposes"
        );
        const result = packWarpIntoAccessList(input);
        expect(result).toEqual([{
            address: "0x0200000000000000000000000000000000000005",
            storageKeys: [
                "0x746869732069732061206c6f6e67657220737472696e6720746861742073686f",
                "0x756c642062652073706c697420696e746f206d756c7469706c652033322d6279",
                "0x7465206368756e6b7320666f722074657374696e6720707572706f736573ff00"
            ]
        }]);
    });

    test('data ending with FF', () => {
        const input = new Uint8Array([0x68, 0x65, 0x6c, 0x6c, 0x6f, 0xFF]); // "hello" followed by 0xFF
        const result = packWarpIntoAccessList(input);
        expect(result).toEqual([{
            address: "0x0200000000000000000000000000000000000005",
            storageKeys: [
                "0x68656c6c6fffff00000000000000000000000000000000000000000000000000"
            ]
        }]);
    });

    test('long hex string', () => {
        const inputHex = "00000000000500000000000000000000000000000000000000000000000000000000000000000000003400000000000100000000000000260000000000008520219c6582f738a64ad0409f384388a19abc051b53de7770c1f102dd6574e900000000000000010189b71d120657a8d5d2b80ff9b58e3a38577a949280295f10c0edfd10ebc20dfb105acf54dbcf7ba5b498c18e3571b9cb1795fdeffa70eb7146eab74b9e07c90feaece45f9291ff242347dd16e58dbd549cf83a53b54a3fa956c4190e842ae2b0"
        const input = hexToBytes(`0x${inputHex}`);
        const result = packWarpIntoAccessList(input);
        expect(result).toEqual([{
            address: "0x0200000000000000000000000000000000000005",
            storageKeys: [
                "0x0000000000050000000000000000000000000000000000000000000000000000",
                "0x0000000000000000003400000000000100000000000000260000000000008520",
                "0x219c6582f738a64ad0409f384388a19abc051b53de7770c1f102dd6574e90000",
                "0x0000000000010189b71d120657a8d5d2b80ff9b58e3a38577a949280295f10c0",
                "0xedfd10ebc20dfb105acf54dbcf7ba5b498c18e3571b9cb1795fdeffa70eb7146",
                "0xeab74b9e07c90feaece45f9291ff242347dd16e58dbd549cf83a53b54a3fa956",
                "0xc4190e842ae2b0ff000000000000000000000000000000000000000000000000"
            ]
        }]);
    });
});
