// pages/AuthCallbackPage.tsx
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Loader2, Sparkles, CheckCircle2 } from 'lucide-react';

export function AuthCallbackPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Exchange session and check if user logged in
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          throw error;
        }

        if (session?.user) {
          // Success: Wait a second for dynamic transition, then route to dashboard
          setTimeout(() => {
            navigate('/dashboard', { replace: true });
          }, 1500);
        } else {
          // If no session after short delay, fall back to login
          setTimeout(() => {
            navigate('/login', { replace: true });
          }, 2000);
        }
      } catch (err) {
        console.error('Error in auth callback:', err);
        setTimeout(() => {
          navigate('/login', { replace: true });
        }, 2000);
      }
    };

    handleAuthCallback();
  }, [navigate]);

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-radial from-gray-900 via-gray-950 to-black text-white relative overflow-hidden select-none">
      {/* Decorative gradient glowing spheres */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-brand-500/10 rounded-full blur-[120px] animate-pulse pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-[120px] animate-pulse pointer-events-none" style={{ animationDelay: '2s' }} />

      <div className="relative max-w-md w-full mx-4 p-8 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl shadow-2xl flex flex-col items-center justify-center text-center space-y-6 animate-in fade-in zoom-in duration-500">
        
        {/* Animated Icon Container */}
        <div className="relative">
          <div className="absolute -inset-1.5 rounded-full bg-gradient-to-r from-brand-500 to-blue-500 blur opacity-40 animate-spin-slow" />
          <div className="relative w-16 h-16 rounded-full bg-gray-900 border border-white/10 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-brand-400 animate-spin" />
          </div>
          <div className="absolute -bottom-1 -right-1 bg-brand-500 rounded-full p-1 border border-gray-900">
            <Sparkles className="w-3 h-3 text-white animate-pulse" />
          </div>
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-bold tracking-tight text-white flex items-center justify-center gap-2">
            Confirming Connection
          </h2>
          <p className="text-sm text-gray-400 max-w-xs mx-auto leading-relaxed">
            Securing your session credentials and logging you in...
          </p>
        </div>

        {/* Loading progress bar indicator */}
        <div className="w-48 h-1 bg-white/10 rounded-full overflow-hidden relative">
          <div className="absolute top-0 left-0 h-full w-1/2 bg-gradient-to-r from-brand-400 to-blue-500 rounded-full animate-shimmer" />
        </div>
      </div>
    </div>
  );
}

export default AuthCallbackPage;