import { ImageResponse } from 'next/og';
import { GENERIC_CARD, SHAPE_LABEL, askedOf, shapeOf, shareCard, titleLines, type ShareShape } from '@/lib/explorer-query/share';
import { sharedAnswer } from '@/lib/explorer-query/share-answer';
import { loadNodeFonts } from '@/utils/og/node-fonts';
import { QueryShape } from '@/utils/og/query-shape';
import { LedgerFooter, Logomark, OG_HEIGHT, OG_INK, OG_PAD_X, OG_WIDTH, SectionLabel, SheetFrame, clampText } from '@/utils/og/sheet';

// The share image of a Query answer link: /api/og/query/mainnet/<chain slug>?q=<question>.
// It shows the chain, the answer's title and a drawing of the answer's shape, and no figure:
// the card is cached for a day and a figure in it would be stale. Node runtime: the kept
// recipe is one Redis read (lib/explorer-query/share-answer.ts).

const CACHE_DAY = 'public, max-age=0, s-maxage=86400';

// the title's box: the sheet less its side padding, the drawing and the gap between them
const TITLE_WIDTH = OG_WIDTH - 2 * OG_PAD_X - 304 - 56;

type Card = { chain: string | null; title: string; shape: ShareShape };

const GENERIC: Card = { chain: null, title: GENERIC_CARD.description, shape: 'ask' };

/** what the card shows; the generic card for a link with no question, on Fuji, or of a chain Query cannot ask */
async function cardOf(network: string, slug: string, q: string | null): Promise<Card> {
  try {
    const question = askedOf(q);
    const answer = question ? await sharedAnswer(network, slug, question) : null;
    if (!question || !answer) return GENERIC;
    return { chain: answer.chain.name, title: shareCard(answer.chain, question, answer.recipe).title, shape: shapeOf(answer.recipe) };
  } catch {
    return GENERIC;
  }
}

export async function GET(request: Request, { params }: { params: Promise<{ network: string; chain: string }> }): Promise<ImageResponse> {
  const { network, chain } = await params;
  const card = await cardOf(network, chain, new URL(request.url).searchParams.get('q'));
  const { size, lines } = titleLines(card.title, TITLE_WIDTH);
  const chainName = card.chain ? clampText(card.chain.toUpperCase(), 34) : null;

  return new ImageResponse(
    <SheetFrame>
      <div style={{ display: 'flex', alignItems: 'center', gap: 18, padding: `44px ${OG_PAD_X}px 0 ${OG_PAD_X}px` }}>
        <Logomark />
        <div style={{ display: 'flex', fontFamily: 'Geist-Mono', fontSize: 18, letterSpacing: 5, color: '#3f3f46' }}>EXPLORER · QUERY</div>
      </div>
      <div style={{ display: 'flex', flexGrow: 1, alignItems: 'center', justifyContent: 'space-between', padding: `0 ${OG_PAD_X}px` }}>
        <div style={{ display: 'flex', flexDirection: 'column', width: TITLE_WIDTH }}>
          <SectionLabel text={chainName ?? 'AVALANCHE'} />
          <div style={{ display: 'flex', flexDirection: 'column', marginTop: 20 }}>
            {lines.map((line, i) => (
              <div
                key={i}
                style={{ display: 'flex', fontFamily: 'Geist-Medium', fontSize: size, lineHeight: 1.12, letterSpacing: -size / 40, color: OG_INK, whiteSpace: 'nowrap' }}
              >
                {line}
              </div>
            ))}
          </div>
        </div>
        <QueryShape shape={card.shape} label={SHAPE_LABEL[card.shape]} />
      </div>
      <LedgerFooter left="BUILD.AVAX.NETWORK/EXPLORER" right={card.chain ? clampText(`${card.chain.toUpperCase()} · QUERY`, 34) : 'QUERY'} />
    </SheetFrame>,
    { width: OG_WIDTH, height: OG_HEIGHT, fonts: await loadNodeFonts(), headers: { 'cache-control': CACHE_DAY } },
  );
}
