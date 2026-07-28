import { Component } from 'react';

// Without this a failed lazy chunk unmounts the tree and renders white, which
// looks identical to a routing mistake and wastes an hour.
export class AppError extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('App failed to mount', error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;

    const message = String(this.state.error?.message ?? this.state.error);
    const envProblem = /env vars missing/i.test(message);

    return (
      <div style={S.page}>
        <div style={S.card}>
          <h1 style={S.title}>{envProblem ? 'Configuration missing' : 'Something broke'}</h1>
          <pre style={S.pre}>{message}</pre>
          {envProblem && (
            <p style={S.hint}>
              Create <code>.env.local</code> in the project root from{' '}
              <code>.env.example</code>, then restart the dev server. Vite reads
              env files only at startup.
            </p>
          )}
          <button style={S.button} onClick={() => window.location.reload()}>
            Reload
          </button>
        </div>
      </div>
    );
  }
}

const S = {
  page: {
    minHeight: '100dvh',
    display: 'grid',
    placeItems: 'center',
    padding: '1rem',
    background: '#faf6ef',
    color: '#2a2723',
    fontFamily: 'ui-sans-serif, system-ui, sans-serif',
  },
  card: { maxWidth: '460px', display: 'flex', flexDirection: 'column', gap: '0.75rem' },
  title: { fontSize: '1.3125rem', margin: 0 },
  pre: {
    margin: 0,
    padding: '0.75rem',
    background: '#f4efe6',
    border: '1px solid #e4dccf',
    borderRadius: '8px',
    fontSize: '0.8125rem',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
  hint: { fontSize: '0.8125rem', color: '#6b6459', margin: 0, lineHeight: 1.6 },
  button: {
    minHeight: '44px',
    alignSelf: 'flex-start',
    padding: '0 1.5rem',
    borderRadius: '8px',
    border: '1px solid #a69272',
    background: 'transparent',
    cursor: 'pointer',
  },
};
