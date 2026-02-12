import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'BNBrew — AI Onchain App Builder for BNB Chain';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          background: '#0c0c0e',
          fontFamily: 'system-ui, sans-serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Decorative shapes */}
        <div
          style={{
            position: 'absolute',
            top: -80,
            right: -60,
            width: 400,
            height: 400,
            borderRadius: 48,
            background: 'rgba(240, 185, 11, 0.06)',
            transform: 'rotate(12deg)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: -100,
            left: -40,
            width: 350,
            height: 350,
            borderRadius: 48,
            background: 'rgba(240, 185, 11, 0.04)',
            transform: 'rotate(-15deg)',
          }}
        />

        {/* Logo mark */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            marginBottom: 32,
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              background: '#F0B90B',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 28,
              fontWeight: 800,
              color: '#0c0c0e',
            }}
          >
            B
          </div>
          <span
            style={{
              fontSize: 44,
              fontWeight: 700,
              color: '#fafafa',
              letterSpacing: -1,
            }}
          >
            BNBrew
          </span>
        </div>

        {/* Headline */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span
            style={{
              fontSize: 52,
              fontWeight: 700,
              color: '#F0B90B',
              letterSpacing: -1,
            }}
          >
            Build Onchain. Ship with AI.
          </span>
          <span
            style={{
              fontSize: 24,
              color: '#71717a',
              marginTop: 8,
            }}
          >
            Describe your app. We generate contracts, build the frontend, deploy to BNB Chain.
          </span>
        </div>

        {/* Tech badges */}
        <div
          style={{
            display: 'flex',
            gap: 16,
            marginTop: 40,
          }}
        >
          {['opBNB', 'Greenfield', 'UUPS Proxies', 'Claude AI'].map((tag) => (
            <div
              key={tag}
              style={{
                padding: '8px 20px',
                borderRadius: 100,
                border: '1px solid rgba(240, 185, 11, 0.2)',
                background: 'rgba(240, 185, 11, 0.06)',
                color: '#F0B90B',
                fontSize: 16,
                fontWeight: 500,
              }}
            >
              {tag}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size },
  );
}
