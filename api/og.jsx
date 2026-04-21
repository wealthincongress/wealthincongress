import { ImageResponse } from '@vercel/og';

export const config = { runtime: 'edge' };

const fmt = (n) => {
  if (n == null || isNaN(n)) return '--';
  const neg = n < 0, a = Math.abs(n);
  if (a >= 1e9) return (neg ? '-' : '') + '$' + (a / 1e9).toFixed(1) + 'B';
  if (a >= 1e6) return (neg ? '-' : '') + '$' + (a / 1e6).toFixed(1) + 'M';
  if (a >= 1e3) return (neg ? '-' : '') + '$' + (a / 1e3).toFixed(0) + 'K';
  return (neg ? '-' : '') + '$' + a;
};

const SN = { AL:'Alabama',AK:'Alaska',AZ:'Arizona',AR:'Arkansas',CA:'California',CO:'Colorado',CT:'Connecticut',DE:'Delaware',FL:'Florida',GA:'Georgia',HI:'Hawaii',ID:'Idaho',IL:'Illinois',IN:'Indiana',IA:'Iowa',KS:'Kansas',KY:'Kentucky',LA:'Louisiana',ME:'Maine',MD:'Maryland',MA:'Massachusetts',MI:'Michigan',MN:'Minnesota',MS:'Mississippi',MO:'Missouri',MT:'Montana',NE:'Nebraska',NV:'Nevada',NH:'New Hampshire',NJ:'New Jersey',NM:'New Mexico',NY:'New York',NC:'North Carolina',ND:'North Dakota',OH:'Ohio',OK:'Oklahoma',OR:'Oregon',PA:'Pennsylvania',RI:'Rhode Island',SC:'South Carolina',SD:'South Dakota',TN:'Tennessee',TX:'Texas',UT:'Utah',VT:'Vermont',VA:'Virginia',WA:'Washington',WV:'West Virginia',WI:'Wisconsin',WY:'Wyoming' };

export default async function handler(req) {
  try {
    const { searchParams } = new URL(req.url);
    const name = searchParams.get('name') || 'Member of Congress';
    const party = searchParams.get('party') || 'I';
    const state = searchParams.get('state') || '';
    const chamber = searchParams.get('chamber') || 'H';
    const ew = parseInt(searchParams.get('ew') || '0');
    const cw = parseInt(searchParams.get('cw') || '0');
    const yrs = parseInt(searchParams.get('yrs') || '0');
    const pct = searchParams.get('pct');
    const ann = searchParams.get('ann');
    const bench = searchParams.get('bench');

    const partyColor = party === 'D' ? '#2563eb' : party === 'R' ? '#dc2626' : '#7c3aed';
    const partyName = party === 'D' ? 'Democrat' : party === 'R' ? 'Republican' : 'Independent';
    const role = chamber === 'S' ? 'Sen.' : 'Rep.';
    const stateName = SN[state] || state;
    const gain = cw - ew;
    const showPct = ew > 0 && pct !== null;
    const showAnn = ann !== null && bench !== null && yrs >= 2;
    const annNum = showAnn ? parseFloat(ann) : 0;
    const benchNum = showAnn ? parseFloat(bench) : 0;
    const beatMarket = showAnn && annNum > benchNum;

    return new ImageResponse(
      (
        <div style={{
          width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
          backgroundColor: '#faf6f0',
          padding: '60px 70px',
          fontFamily: 'system-ui, sans-serif',
          position: 'relative'
        }}>
          {/* Top brand line */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            fontSize: 22, color: '#78716c', letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 700
          }}>
            <div style={{ display: 'flex' }}>Wealth in Congress</div>
            <div style={{ display: 'flex', fontSize: 18 }}>wealthincongress.com</div>
          </div>

          {/* Party color bar under brand */}
          <div style={{ display: 'flex', height: 4, backgroundColor: partyColor, marginTop: 14, marginBottom: 36, borderRadius: 2, width: '100%' }} />

          {/* Member name */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 18, marginBottom: 8
          }}>
            <div style={{
              fontSize: 64, fontWeight: 900, color: '#1a1714',
              fontFamily: 'Georgia, serif', lineHeight: 1, display: 'flex'
            }}>{role} {name}</div>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '6px 16px', border: `3px solid ${partyColor}`, color: partyColor,
              fontSize: 28, fontWeight: 900, borderRadius: 8, letterSpacing: '0.05em'
            }}>{party}</div>
          </div>
          <div style={{
            fontSize: 28, color: '#57534e', marginBottom: 44, display: 'flex'
          }}>{partyName} · {stateName} · {yrs} year{yrs === 1 ? '' : 's'} in office</div>

          {/* Stats grid */}
          <div style={{ display: 'flex', gap: 40, marginBottom: 30 }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: 18, color: '#78716c', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, marginBottom: 6, display: 'flex' }}>Net worth at entry</div>
              <div style={{ fontSize: 52, fontWeight: 900, color: '#1a1714', lineHeight: 1, display: 'flex', fontFamily: 'monospace' }}>{fmt(ew)}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 8 }}>
              <div style={{ fontSize: 44, color: '#a8a29e', display: 'flex' }}>→</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: 18, color: '#78716c', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, marginBottom: 6, display: 'flex' }}>Current</div>
              <div style={{ fontSize: 52, fontWeight: 900, color: '#1a1714', lineHeight: 1, display: 'flex', fontFamily: 'monospace' }}>{fmt(cw)}</div>
            </div>
          </div>

          {/* Headline stat */}
          {showPct ? (
            <div style={{
              display: 'flex', flexDirection: 'column',
              padding: '20px 26px',
              backgroundColor: gain >= 0 ? '#ecfdf5' : '#fef2f2',
              border: `2px solid ${gain >= 0 ? '#10b981' : '#dc2626'}`,
              borderRadius: 10
            }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
                <div style={{ fontSize: 56, fontWeight: 900, color: gain >= 0 ? '#047857' : '#991b1b', display: 'flex', fontFamily: 'monospace', lineHeight: 1 }}>
                  {gain >= 0 ? '+' : ''}{parseFloat(pct).toFixed(0)}%
                </div>
                <div style={{ fontSize: 24, color: '#44403c', display: 'flex' }}>over {yrs} years</div>
              </div>
              {showAnn && (
                <div style={{ display: 'flex', fontSize: 22, color: '#57534e', marginTop: 8 }}>
                  S&P 500 same period: {benchNum.toFixed(1)}%/yr · {role} {name.split(' ').slice(-1)[0]}: {annNum.toFixed(1)}%/yr {beatMarket ? '(beat market)' : '(below market)'}
                </div>
              )}
            </div>
          ) : (
            <div style={{
              display: 'flex', flexDirection: 'column',
              padding: '20px 26px', backgroundColor: '#f5f5f4', border: '2px solid #d6d3d1', borderRadius: 10
            }}>
              <div style={{ fontSize: 36, fontWeight: 900, color: '#1a1714', display: 'flex', fontFamily: 'monospace' }}>
                Gain: {fmt(gain)}
              </div>
              <div style={{ display: 'flex', fontSize: 22, color: '#57534e', marginTop: 6 }}>
                Over {yrs} year{yrs === 1 ? '' : 's'} in office
              </div>
            </div>
          )}
        </div>
      ),
      {
        width: 1200,
        height: 630
      }
    );
  } catch (err) {
    return new Response(`OG generation error: ${err.message}`, { status: 500 });
  }
}
