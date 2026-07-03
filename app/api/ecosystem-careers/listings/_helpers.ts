import { NextResponse } from 'next/server';

export function incompleteProfileResponse(
  hasX: boolean,
  hasLinkedIn: boolean,
  verb: 'posting' | 'editing',
) {
  return NextResponse.json(
    {
      error: 'IncompleteProfile',
      message: `Connect both your X and LinkedIn profiles before ${verb} an ecosystem careers listing.`,
      missing: [...(hasX ? [] : ['x']), ...(hasLinkedIn ? [] : ['linkedin'])],
    },
    { status: 403 },
  );
}
