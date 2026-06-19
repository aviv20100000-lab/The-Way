import React from "react";

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Error caught by boundary:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div dir="rtl" className="min-h-screen flex items-center justify-center bg-rose-50 p-4">
            <div className="rounded-2xl bg-white shadow-lg p-8 max-w-md text-center">
              <div className="text-4xl mb-4">⚠️</div>
              <h1 className="text-xl font-bold text-rose-900 mb-2">משהו השתבש</h1>
              <p className="text-rose-700 mb-6">קרתה שגיאה בלתי צפויה. בדוק את הקונסול לפרטים.</p>
              <button
                onClick={() => this.setState({ hasError: false })}
                className="rounded-lg bg-rose-600 px-6 py-2 text-white font-semibold hover:bg-rose-700 transition-all"
              >
                נסה שוב
              </button>
            </div>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
