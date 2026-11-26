'use client';

/**
 * The last resort: something broke in the root layout itself, so the
 * shell is gone and this has to supply its own <html> and <body>.
 *
 * The styles are inline because the stylesheet may be the thing that
 * failed to load.
 */
export default function GlobalError({ error, reset }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          background: '#f5f7fb',
          color: '#0f1b33',
          fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
          padding: '24px',
        }}
      >
        <div style={{ maxWidth: '26rem', textAlign: 'center' }}>
          <h1 style={{ fontSize: '19px', margin: '0 0 8px' }}>Al Hadeed Hardware could not start</h1>
          <p style={{ margin: '0 0 18px', fontSize: '14px', lineHeight: 1.55, color: '#55637d' }}>
            The page did not load properly. Reloading usually clears it. Nothing
            has been changed.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              padding: '10px 18px',
              border: 0,
              borderRadius: '9px',
              background: '#3f7a12',
              color: '#fff',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Reload
          </button>
          <p style={{ marginTop: '18px', fontSize: '12px', color: '#9bacc0', wordBreak: 'break-word' }}>
            {String(error?.message || '')}
          </p>
        </div>
      </body>
    </html>
  );
}
