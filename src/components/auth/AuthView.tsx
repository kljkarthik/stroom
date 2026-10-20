import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Sparkles, Shield, User, ArrowRight, Lock, Mail, AlertCircle } from 'lucide-react';

export const AuthView: React.FC = () => {
  const { login, register, loginAsDemoUser } = useAuth();
  const [isRegistering, setIsRegistering] = useState<boolean>(false);
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [fullName, setFullName] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsLoading(true);

    try {
      if (isRegistering) {
        if (!fullName.trim()) {
          setErrorMessage('Please enter your full name');
          setIsLoading(false);
          return;
        }
        await register(email, password, fullName);
      } else {
        await login(email, password);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-950 relative overflow-hidden">
      {/* Ambient background glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-md w-full relative z-10 animate-fade-in text-left">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-3xl vibe-gradient-bg flex items-center justify-center text-white mx-auto mb-4 shadow-xl shadow-indigo-500/25">
            <Sparkles className="w-8 h-8 fill-white" />
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">stroom</h1>
          <p className="text-sm text-slate-400 mt-1">
            Discover communities, meet like-minded people, find your vibe.
          </p>
        </div>

        {/* Demo Fast-Login Cards */}
        <div className="mb-6 space-y-2.5">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider text-center">
            One-Click Instant Testing Access
          </p>

          <button
            type="button"
            onClick={() => loginAsDemoUser('newUser')}
            className="w-full p-3.5 rounded-2xl bg-gradient-to-r from-indigo-950/70 to-slate-900 border border-indigo-500/40 hover:border-indigo-500 text-left transition-all active:scale-[0.98] flex items-center justify-between group shadow-lg"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold">
                <User className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-white group-hover:text-indigo-300 transition-colors">
                  Login as Sam Taylor (New User)
                </p>
                <p className="text-[11px] text-slate-400">Triggers Post-Login Vibe Quiz Flow</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-indigo-400 group-hover:translate-x-1 transition-transform" />
          </button>

          <button
            type="button"
            onClick={() => loginAsDemoUser('admin')}
            className="w-full p-3.5 rounded-2xl bg-gradient-to-r from-amber-950/50 to-slate-900 border border-amber-500/40 hover:border-amber-500 text-left transition-all active:scale-[0.98] flex items-center justify-between group shadow-lg"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-white group-hover:text-amber-300 transition-colors">
                  Login as Alex Rivera (Administrator)
                </p>
                <p className="text-[11px] text-slate-400">Opens Quiz CMS & Question Editor</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-amber-400 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3 my-6">
          <div className="h-px bg-slate-800 flex-1" />
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Or sign in with email
          </span>
          <div className="h-px bg-slate-800 flex-1" />
        </div>

        {/* Auth Form Card */}
        <div className="p-6 rounded-3xl bg-slate-900/80 border border-white/10 shadow-2xl backdrop-blur-md">
          {errorMessage && (
            <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2 animate-shake">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegistering && (
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Full Name</label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Jordan Lee"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 rounded-xl vibe-gradient-bg text-white font-bold text-xs shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {isLoading ? (
                <span>Authenticating...</span>
              ) : isRegistering ? (
                <>
                  <span>Create Account & Start Vibe Quiz</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-4 pt-4 border-t border-slate-800 text-center">
            <button
              type="button"
              onClick={() => {
                setIsRegistering(!isRegistering);
                setErrorMessage(null);
              }}
              className="text-xs text-slate-400 hover:text-indigo-400 transition-colors"
            >
              {isRegistering
                ? 'Already have an account? Sign in here'
                : "Don't have an account? Sign up for Stroom"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
