import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/protectedRoute';
import { keccak_256 } from '@noble/hashes/sha3';
import { bytesToHex } from '@noble/hashes/utils';
import { AVATAR_OPTIONS } from '@/components/profile/components/DiceBearAvatar';

interface AvatarSeed {
  backgroundColor: string;
  hair: string;
  eyes: string;
  eyebrows: string;
  nose: string;
  mouth: string;
  glasses: string;
  earrings: string;
  beard: string;
  hairAccessories: string;
  freckles: string;
}

/**
 * Generate a random or deterministic Avatar seed
 */
function generateAvatarSeed(identifier: string, random: boolean = false): AvatarSeed {
  if (random) {
    // Generate random seed
    return {
      backgroundColor: AVATAR_OPTIONS.backgroundColor[
        Math.floor(Math.random() * AVATAR_OPTIONS.backgroundColor.length)
      ],
      hair: AVATAR_OPTIONS.hair[
        Math.floor(Math.random() * AVATAR_OPTIONS.hair.length)
      ],
      eyes: AVATAR_OPTIONS.eyes[
        Math.floor(Math.random() * AVATAR_OPTIONS.eyes.length)
      ],
      eyebrows: AVATAR_OPTIONS.eyebrows[
        Math.floor(Math.random() * AVATAR_OPTIONS.eyebrows.length)
      ],
      nose: AVATAR_OPTIONS.nose[
        Math.floor(Math.random() * AVATAR_OPTIONS.nose.length)
      ],
      mouth: AVATAR_OPTIONS.mouth[
        Math.floor(Math.random() * AVATAR_OPTIONS.mouth.length)
      ],
      glasses: AVATAR_OPTIONS.glasses[
        Math.floor(Math.random() * AVATAR_OPTIONS.glasses.length)
      ],
      earrings: AVATAR_OPTIONS.earrings[
        Math.floor(Math.random() * AVATAR_OPTIONS.earrings.length)
      ],
      beard: AVATAR_OPTIONS.beard[
        Math.floor(Math.random() * AVATAR_OPTIONS.beard.length)
      ],
      hairAccessories: AVATAR_OPTIONS.hairAccessories[
        Math.floor(Math.random() * AVATAR_OPTIONS.hairAccessories.length)
      ],
      freckles: AVATAR_OPTIONS.freckles[
        Math.floor(Math.random() * AVATAR_OPTIONS.freckles.length)
      ],
    };
  } else {
    // Generate deterministic seed from identifier
    const encoder = new TextEncoder();
    const hash = keccak_256(encoder.encode(identifier));
    const hashHex = bytesToHex(hash);
    
    // Use different parts of the hash for each trait
    const backgroundColor = AVATAR_OPTIONS.backgroundColor[
      parseInt(hashHex.slice(0, 2), 16) % AVATAR_OPTIONS.backgroundColor.length
    ];
    const hair = AVATAR_OPTIONS.hair[
      parseInt(hashHex.slice(2, 4), 16) % AVATAR_OPTIONS.hair.length
    ];
    const eyes = AVATAR_OPTIONS.eyes[
      parseInt(hashHex.slice(4, 6), 16) % AVATAR_OPTIONS.eyes.length
    ];
    const eyebrows = AVATAR_OPTIONS.eyebrows[
      parseInt(hashHex.slice(6, 8), 16) % AVATAR_OPTIONS.eyebrows.length
    ];
    const nose = AVATAR_OPTIONS.nose[
      parseInt(hashHex.slice(8, 10), 16) % AVATAR_OPTIONS.nose.length
    ];
    const mouth = AVATAR_OPTIONS.mouth[
      parseInt(hashHex.slice(10, 12), 16) % AVATAR_OPTIONS.mouth.length
    ];
    const glasses = AVATAR_OPTIONS.glasses[
      parseInt(hashHex.slice(12, 14), 16) % AVATAR_OPTIONS.glasses.length
    ];
    const earrings = AVATAR_OPTIONS.earrings[
      parseInt(hashHex.slice(14, 16), 16) % AVATAR_OPTIONS.earrings.length
    ];
    const beard = AVATAR_OPTIONS.beard[
      parseInt(hashHex.slice(16, 18), 16) % AVATAR_OPTIONS.beard.length
    ];
    const hairAccessories = AVATAR_OPTIONS.hairAccessories[
      parseInt(hashHex.slice(18, 20), 16) % AVATAR_OPTIONS.hairAccessories.length
    ];
    const freckles = AVATAR_OPTIONS.freckles[
      parseInt(hashHex.slice(20, 22), 16) % AVATAR_OPTIONS.freckles.length
    ];

    return {
      backgroundColor,
      hair,
      eyes,
      eyebrows,
      nose,
      mouth,
      glasses,
      earrings,
      beard,
      hairAccessories,
      freckles,
    };
  }
}

export const GET = withAuth(async (
  req: NextRequest,
  context: any,
  session: any
) => {
  try {
    const { searchParams } = new URL(req.url);
    const deterministic = searchParams.get('deterministic') === 'true';
    
    const userId = session.user.id;
    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Generate seed (random or deterministic based on user ID)
    const seed = generateAvatarSeed(userId, !deterministic);

    return NextResponse.json({ seed });
  } catch (error) {
    console.error('Error generating Noun seed:', error);
    return NextResponse.json(
      { 
        error: 'Failed to generate seed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
});

