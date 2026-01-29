import React, { useState } from 'react';
import { Logo } from './Logo';
import { supabase } from '../lib/supabase';
import { Check, AlertCircle, Info, Loader2 } from 'lucide-react';

// --- Local Toast Component (Simplified for Login) ---
type ToastType = 'success' | 'error' | 'info';
interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

const ToastContainer = ({ toasts, removeToast }: { toasts: Toast[]; removeToast: (id: string) => void }) => {
  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <div 
          key={toast.id} 
          className={`
            pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border animate-slideInRight backdrop-blur-md transition-all
            ${toast.type === 'success' ? 'bg-white/95 dark:bg-zinc-800/95 border-brand-500 text-slate-800 dark:text-white' : ''}
            ${toast.type === 'error' ? 'bg-white/95 dark:bg-zinc-800/95 border-rose-500 text-slate-800 dark:text-white' : ''}
            ${toast.type === 'info' ? 'bg-white/95 dark:bg-zinc-800/95 border-slate-300 dark:border-zinc-600 text-slate-800 dark:text-white' : ''}
          `}
        >
          {toast.type === 'success' && <Check size={18} className="text-brand-600 dark:text-brand-400" />}
          {toast.type === 'error' && <AlertCircle size={18} className="text-rose-600 dark:text-rose-400" />}
          {toast.type === 'info' && <Info size={18} className="text-slate-500 dark:text-slate-400" />}
          <span className="text-sm font-medium">{toast.message}</span>
        </div>
      ))}
    </div>
  );
};

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = (message: string, type: ToastType = 'info') => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isSignUp) {
        // Sign Up Logic
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        addToast('가입 인증 메일을 발송했습니다. 메일을 확인해주세요.', 'success');
      } else {
        // Sign In Logic
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        addToast('로그인 성공!', 'success');
      }
    } catch (error: any) {
      console.error(error);
      let msg = error.message;
      if (msg === 'Invalid login credentials') msg = '이메일 또는 비밀번호가 올바르지 않습니다.';
      addToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 dark:bg-zinc-950 p-4">
      <ToastContainer toasts={toasts} removeToast={(id) => setToasts(prev => prev.filter(t => t.id !== id))} />
      
      <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl shadow-xl p-8 border border-slate-200 dark:border-zinc-800">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 text-slate-900 dark:text-white">
            <Logo className="w-12 h-12" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">SLOW ORPG</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
            {isSignUp ? '새로운 여정을 시작하세요' : ''}
          </p>
        </div>

        <form className="space-y-4" onSubmit={handleAuth}>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="wanderer@example.com"
              required
              className="w-full px-4 py-3 rounded-lg bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 focus:outline-none focus:ring-2 focus:ring-brand-600 dark:text-white transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
              className="w-full px-4 py-3 rounded-lg bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 focus:outline-none focus:ring-2 focus:ring-brand-600 dark:text-white transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-lg shadow-md hover:shadow-lg transition-all transform active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading && <Loader2 size={18} className="animate-spin" />}
            {isSignUp ? 'Sign Up' : 'Sign In'}
          </button>
        </form>

        <div className="mt-4 text-center">
          <button 
            onClick={() => { setIsSignUp(!isSignUp); setEmail(''); setPassword(''); }}
            className="text-sm text-brand-600 dark:text-brand-400 hover:underline"
          >
            {isSignUp ? '이미 계정이 있으신가요? 로그인' : '계정이 없으신가요? 회원가입'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login;