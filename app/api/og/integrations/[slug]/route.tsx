import { ImageResponse } from 'next/og';
import type { NextRequest } from 'next/server';

export const runtime = 'edge';

const medium = fetch(new URL('../../Geist-Medium.ttf', import.meta.url)).then((res) =>
  res.arrayBuffer(),
);

const light = fetch(new URL('../../Geist-Light.ttf', import.meta.url)).then((res) =>
  res.arrayBuffer(),
);

const regular = fetch(new URL('../../GeistMono-Light.ttf', import.meta.url)).then((res) =>
  res.arrayBuffer(),
);

export async function GET(
  request: NextRequest,
): Promise<ImageResponse> {
  const { searchParams } = request.nextUrl;
  const title = searchParams.get('title'),
    description = searchParams.get('description');

  return new ImageResponse(
    OG({
      title: title ?? 'Integrations with Avalanche',
      description: description ?? 'Discover best-in-class integrations for your Avalanche L1 and learn how to use them.',
    }),
    {
      width: 1280,
      height: 720,
      fonts: [{ name: 'Geist-Medium', data: await medium, weight: 600 }, { name: 'Geist-Mono', data: await regular, weight: 500 }, { name: 'Geist-Light', data: await light, weight: 300 }],
    },
  );
}

function OG({
  title,
  description
}: {
  title: string;
  description: string;
}): React.ReactElement {
  return (
    <div
      style={{
        display: 'flex',
        height: '100%',
        width: '100%',
        position: 'relative',
        backgroundColor: '#fafafa',
        overflow: 'hidden',
        alignItems: 'center',
        backgroundImage: "url('https://build.avax.network/og.png')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
    >
      <div
        style={{
          maxWidth: '56rem',
          display: 'flex',
          flexDirection: 'column',
          padding: '0 70px',
          width: '100%',
        }}
      >
        <h1
          style={{
            fontSize: '5.35rem',
            fontFamily: "Geist-Medium",
            lineHeight: '1.3',
            letterSpacing: '-0.015em',
            margin: '0 0 30px 0',
            color: 'black',
          }}
        >
          {title}
        </h1>
        
        <p
          style={{
            fontSize: '2.35rem',
            color: '#4b5563',
            maxWidth: '110%',
            margin: '0 0 30px 0',
            lineHeight: 1.4,
            letterSpacing: '-0.01em',
            fontFamily: "Geist-Light" 
          }}
        >
          {description}
        </p>
        
        <div
          style={{
            marginTop: '4.5rem',
            display: 'flex',
            alignItems: 'center'
          }}
        >
          <div
            style={{
              borderRadius: '0.375rem',
              fontSize: '2rem',
              border: '1.25px solid #71dbff',
              backgroundColor: 'white',
              fontFamily: "Geist-Mono",
              color: 'black',
              padding: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="329.2092783505155 0 271.6216494845361 229.44"
              width="26"
              height="24"
            >
              <g>
                <path
                  fill="red"
                  d="M532.763 137.242C536.794 130.375 546.806 130.375 550.793 137.242L593.631 210.426C597.662 217.292 592.612 225.842 584.594 225.842H498.917C490.899 225.842 485.893 217.292 489.88 210.426L532.718 137.242H532.763Z"
                />
                <path
                  fill="red"
                  d="M506.887 88.5117C510.785 81.6895 510.785 73.2724 506.887 66.4059L471.757 5.09425C467.814 -1.7723 457.979 -1.7723 454.037 5.09425L336.464 210.338C332.521 217.204 337.438 225.798 345.324 225.798H415.54C423.381 225.798 430.602 221.59 434.5 214.768L506.843 88.4674L506.887 88.5117Z"
                />
              </g>
            </svg>
            <span style={{paddingLeft: "10px"}}>build.avax.network/<span style={{color: "red"}}>integrations</span></span>
          </div>
        </div>
      </div>
    </div>
  );
}