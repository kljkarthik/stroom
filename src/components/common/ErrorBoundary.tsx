import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, ChevronDown, ChevronUp } from 'lucide-react';
import { StroomLogo } from './StroomLogo';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
  onReset?: () => void;
  dark?: boolean;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });
    console.error('[STROOM ErrorBoundary] Caught render exception:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null, showDetails: false });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  handleGoHome = () => {
    this.handleReset();
    window.location.hash = '';
    // If the parent provided an onReset, trigger it; otherwise reload page
    window.location.assign('/');
  };

  render(): ReactNode {
    if (this.state.hasError) {
      const isDark = this.props.dark ?? false;

      return (
        <div
          className={`min-h-[480px] p-6 sm:p-10 flex items-center justify-center ${
            isDark ? 'bg-stroom-black text-white' : 'bg-stroom-ivory text-stroom-black'
          }`}
        >
          <div
            className={`w-full max-w-xl rounded-3xl p-6 sm:p-8 border shadow-2xl relative overflow-hidden text-center ${
              isDark
                ? 'bg-stroom-cardDark border-stroom-borderDark'
                : 'bg-white border-stroom-borderLight'
            }`}
          >
            {/* Top Brand Accent */}
            <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-stroom-orange via-stroom-gold to-stroom-deep" />

            <div className="flex justify-center mb-4">
              <StroomLogo variant={isDark ? 'light' : 'dark'} size="sm" showSubtitle={false} />
            </div>

            <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center bg-stroom-orange/15 border border-stroom-orange/30 text-stroom-orange">
              <AlertTriangle className="w-7 h-7" />
            </div>

            <h2 className="text-xl sm:text-2xl font-black tracking-tight mb-2">
              {this.props.fallbackTitle || 'Something interrupted this screen'}
            </h2>

            <p className={`text-xs sm:text-sm font-medium mb-6 max-w-md mx-auto ${
              isDark ? 'text-stone-300' : 'text-stroom-charcoal/80'
            }`}>
              {this.props.fallbackMessage ||
                'STROOM encountered an unexpected display issue while rendering this section. Your account, wallet balances, and registered tickets remain completely safe.'}
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-6">
              <button
                onClick={this.handleReset}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-stroom-orange to-stroom-deep text-white font-extrabold text-xs uppercase tracking-wider shadow-brand hover:brightness-105 active:scale-98 transition-all flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reload Screen</span>
              </button>

              <button
                onClick={this.handleGoHome}
                className={`w-full sm:w-auto px-5 py-2.5 rounded-xl border font-extrabold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
                  isDark
                    ? 'bg-white/5 border-white/10 text-stone-300 hover:bg-white/10 hover:text-white'
                    : 'bg-stroom-cream border-stroom-borderLight text-stroom-black hover:bg-stroom-cream/80'
                }`}
              >
                <Home className="w-3.5 h-3.5 text-stroom-orange" />
                <span>STROOM Home</span>
              </button>
            </div>

            {/* Collapsible Technical Details for Debugging */}
            {this.state.error && (
              <div className="pt-4 border-t border-stroom-borderDark/20 text-left">
                <button
                  onClick={() => this.setState({ showDetails: !this.state.showDetails })}
                  className="w-full flex items-center justify-between text-[11px] font-mono text-stone-400 hover:text-stroom-orange py-1"
                >
                  <span>Technical Diagnostic Details</span>
                  {this.state.showDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>

                {this.state.showDetails && (
                  <div className="mt-2 p-3 rounded-xl bg-black/60 border border-white/10 text-stone-300 font-mono text-[10px] overflow-x-auto max-h-48 leading-relaxed">
                    <p className="text-red-400 font-bold mb-1">{this.state.error.toString()}</p>
                    {this.state.errorInfo?.componentStack && (
                      <pre className="text-stone-400 whitespace-pre-wrap">{this.state.errorInfo.componentStack}</pre>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
