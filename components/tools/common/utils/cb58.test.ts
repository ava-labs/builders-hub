import { cb58ToHex } from './cb58';
import { describe, it, expect } from 'vitest';

describe('CB58', () => {
    const testCases = [
        {
            cb58: 'Ce9vzobei1Acw5UYUSnmBVHsfhQBxzeZrZxR5W5VNzft76bG1',
            hex: '0x1a6e6e8c244d53292e4e45c9bc43aea9d467ea7c739f5aa2822e51ab7246edc3'
        },
        {
            cb58: 'o773eoEnCqucyzAzscK4yYg74n3p8zmRjn1eF4UxgW9gYfPHz',
            hex: '0x68b0068dd1576233476113246eca44edd5cc05ed5425d7b65e9cf255c235e686'
        },
        {
            cb58: '2wZQYpzuACt7a7neb3oVunM8MnoryUj3xsFmU2Foqbq8fyvd7H',
            hex: '0xff940ef674551df11671933a94e28785f01f2848c0b9a03cb93742a4e22b26c7'
        }
    ];

    describe('cb58ToHex', () => {
        it('should convert CB58 to hex correctly', () => {
            for (const { cb58, hex } of testCases) {
                expect(cb58ToHex(cb58)).toBe(hex);
            }
        });

        // it('should throw on invalid checksum', () => {
        //     const invalidCb58 = testCases[0].cb58.slice(0, -1) + '2';
        //     expect(() => cb58ToHex(invalidCb58)).toThrow('Invalid checksum');
        // });

        // it('should throw on input too short', () => {
        //     expect(() => cb58ToHex('aaa')).toThrow('Input string is smaller than the checksum size');
        // });
    });
});
