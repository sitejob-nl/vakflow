import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-6">
          <div className="max-w-md w-full bg-card border border-border rounded-lg shadow-card p-8 text-center space-y-5">
            <div className="mx-auto w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="h-7 w-7 text-destructive" />
            </div>
            <div>
              <h2 className="text-lg font-bold mb-1">Er ging iets mis</h2>
              <p className="text-sm text-muted-foreground">
                Er is een onverwachte fout opgetreden. Probeer de pagina opnieuw te laden.
              </p>
            </div>
            {this.state.error && (
              <details className="text-left text-xs bg-muted rounded-md p-3">
                <summary className="cursor-pointer font-semibold text-muted-foreground mb-1">
                  Technische details
                </summary>
                <pre className="whitespace-pre-wrap break-words text-destructive mt-1">
                  {this.state.error.message}
                </pre>
              </details>
            )}
            <div className="flex gap-3 justify-center">
              <button
                onClick={this.handleReset}
                className="px-4 py-2 bg-card border border-border rounded-lg text-sm font-bold hover:bg-accent/10 transition-colors"
              >
                Probeer opnieuw
              </button>
              <button
                onClick={this.handleReload}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-bold hover:opacity-90 transition-colors flex items-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Herlaad pagina
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
