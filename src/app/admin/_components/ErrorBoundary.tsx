'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Admin v2 error boundary caught:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '48px 32px',
          textAlign: 'center',
          color: 'var(--text-primary)',
          maxWidth: 520,
          margin: '0 auto',
        }}>
          <h2 style={{ fontSize: '1.5rem', marginBottom: 12 }}>Something went wrong</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.6 }}>
            {this.state.error?.message || 'An unexpected error occurred in this panel.'}
          </p>
          <button
            type="button"
            className="av-btn av-btn-primary"
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
