import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { User, Check, ArrowRight, Loader2, Link as LinkIcon } from 'lucide-react';
import { Logo } from './Logo';

interface OnboardingProps {
  onComplete: () => void;
}

const Onboarding: React.FC<OnboardingProps> = ({ onComplete }) => {
  const { session } = useAuth();
  const [nickname, setNickname] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user) return;
    
    setLoading(true);
    setError(null);

    try {
      // Upsert profile data
      const { error: upsertError } = await supabase
        .from('profiles')
        .upsert({
          id: session.user.id,
          nickname: nickname,
          bio: bio,
          avatar_url: avatarUrl || null,
        });

      if (upsertError) throw upsertError;

      onComplete();
    } catch (err: any) {
      console.error('Error updating profile:', err);
      setError(err.message || '프로필 설정 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl shadow-xl p-8 border border-slate-200 dark:border-zinc-800 animate-fadeIn">
        
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-900/20">
            <User size={24} />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight text-center">
            환영합니다!
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 text-center">
            모험을 떠나기 전, 당신의 프로필을 설정해주세요.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Avatar Preview & URL */}
          <div className="flex flex-col items-center gap-4">
             <div className="w-24 h-24 rounded-full bg-slate-100 dark:bg-zinc-800 overflow-hidden border-2 border-slate-100 dark:border-zinc-700">
               {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar Preview" className="w-full h-full object-cover" />
               ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-300 dark:text-zinc-600">
                     <User size={40} />
                  </div>
               )}
             </div>
             <div className="w-full relative">
                <input
                   type="text"
                   value={avatarUrl}
                   onChange={(e) => setAvatarUrl(e.target.value)}
                   placeholder="프로필 이미지 URL (Optional)"
                   className="w-full pl-10 pr-4 py-2 rounded-lg bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 focus:outline-none focus:ring-2 focus:ring-brand-600 dark:text-white transition-all text-sm"
                />
                <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
             </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              닉네임 <span className="text-brand-600">*</span>
            </label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder=""
              required
              minLength={2}
              maxLength={20}
              className="w-full px-4 py-3 rounded-lg bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 focus:outline-none focus:ring-2 focus:ring-brand-600 dark:text-white transition-all placeholder-slate-400"
            />
            <p className="text-xs text-slate-400 mt-1">2자 이상, 20자 이내로 입력해주세요.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              한 줄 소개 (선택)
            </label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="당신을 간단히 소개해주세요."
              rows={3}
              maxLength={100}
              className="w-full px-4 py-3 rounded-lg bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 focus:outline-none focus:ring-2 focus:ring-brand-600 dark:text-white transition-all resize-none placeholder-slate-400"
            />
          </div>

          {error && (
            <div className="p-3 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 text-sm rounded-lg flex items-center gap-2">
               <span>⚠️</span> {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !nickname.trim()}
            className="w-full py-3 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-lg shadow-md hover:shadow-lg transition-all transform active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <>시작하기 <ArrowRight size={18} /></>}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Onboarding;