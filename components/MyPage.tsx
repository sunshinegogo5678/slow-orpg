import React, { useState, useEffect } from 'react';
import { ChevronLeft, Save, LogOut, Key, Loader2, Link as LinkIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface MyPageProps {
  onBack: () => void;
  onLogout: () => void;
}

interface ProfileData {
  nickname: string;
  bio: string;
  avatar_url: string;
}

const MyPage: React.FC<MyPageProps> = ({ onBack, onLogout }) => {
  const { session } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // State for form data
  const [data, setData] = useState<ProfileData>({
    nickname: '',
    bio: '',
    avatar_url: ''
  });
  
  // State for comparing changes (Dirty check)
  const [initialData, setInitialData] = useState<ProfileData | null>(null);
  
  // Fetch Data from Supabase
  useEffect(() => {
    const fetchProfile = async () => {
      if (!session?.user) return;
      
      try {
        setLoading(true);
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('nickname, bio, avatar_url')
          .eq('id', session.user.id)
          .single();

        if (error) {
           console.error('Error fetching profile:', error);
           // If no profile exists (shouldn't happen due to onboarding, but just in case)
           return;
        }

        if (profile) {
          const loadedData = {
            nickname: profile.nickname || '',
            bio: profile.bio || '',
            avatar_url: profile.avatar_url || ''
          };
          setData(loadedData);
          setInitialData(loadedData);
        }
      } catch (err) {
        console.error('Unexpected error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [session]);

  const isDirty = initialData && JSON.stringify(data) !== JSON.stringify(initialData);

  const handleSave = async () => {
    if (!session?.user) return;
    setSaving(true);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          nickname: data.nickname,
          bio: data.bio,
          avatar_url: data.avatar_url,
          updated_at: new Date().toISOString(),
        })
        .eq('id', session.user.id);

      if (error) throw error;

      setInitialData(data);
      alert('프로필이 성공적으로 저장되었습니다.');
    } catch (error: any) {
      console.error('Error updating profile:', error);
      alert('저장 중 오류가 발생했습니다: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field: keyof ProfileData, value: string) => {
    setData(prev => ({ ...prev, [field]: value }));
  };

  // Default avatar if none provided and no custom URL
  const displayAvatarUrl = data.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(data.nickname || 'User')}&background=random`;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-2xl animate-pulse space-y-8">
           <div className="h-8 bg-slate-200 dark:bg-zinc-800 rounded w-1/4"></div>
           <div className="bg-white dark:bg-zinc-900 rounded-2xl h-96 p-8 border border-slate-200 dark:border-zinc-800"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8">
      
      {/* Header */}
      <div className="w-full max-w-2xl mb-6 flex items-center justify-between sticky top-0 bg-slate-50/90 dark:bg-zinc-950/90 backdrop-blur-sm z-10 py-4">
        <button 
          onClick={() => {
             if (window.history.length > 1) window.history.back();
             else onBack();
          }}
          className="flex items-center gap-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors"
        >
          <ChevronLeft size={20} />
          <span className="text-sm font-medium">설정</span>
        </button>
        
        <button
          onClick={handleSave}
          disabled={!isDirty || saving}
          className={`
            flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-sm
            ${isDirty && !saving
              ? 'bg-brand-600 hover:bg-brand-700 text-white shadow-md transform active:scale-95' 
              : 'bg-slate-200 dark:bg-zinc-800 text-slate-400 cursor-not-allowed'
            }
          `}
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {saving ? '저장 중...' : '저장'}
        </button>
      </div>

      <div className="w-full max-w-2xl space-y-6">
        
        {/* Public Profile Section */}
        <section className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-slate-200 dark:border-zinc-800 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">공개 프로필</h2>
          </div>
          <div className="p-6 space-y-6">
            
            {/* Avatar */}
            <div className="flex flex-col sm:flex-row items-start gap-6">
              <div className="shrink-0">
                <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-slate-100 dark:border-zinc-800 bg-slate-100 dark:bg-zinc-800">
                  <img src={displayAvatarUrl} alt="Profile" className="w-full h-full object-cover" />
                </div>
              </div>
              
              <div className="flex-1 w-full space-y-2">
                 <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                    프로필 이미지 주소 (URL)
                 </label>
                 <div className="relative">
                    <input
                      type="text"
                      value={data.avatar_url}
                      onChange={(e) => handleChange('avatar_url', e.target.value)}
                      placeholder="https://example.com/my-avatar.png"
                      className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 focus:outline-none focus:ring-2 focus:ring-brand-600 dark:text-white transition-all text-sm font-mono"
                    />
                    <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                 </div>
                 <p className="text-xs text-slate-500 dark:text-slate-400">
                    이미지 URL을 입력하면 자동으로 미리보기가 갱신됩니다.
                 </p>
              </div>
            </div>

            {/* Nickname */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                닉네임
              </label>
              <input
                type="text"
                value={data.nickname}
                onChange={(e) => handleChange('nickname', e.target.value)}
                placeholder="닉네임을 입력하세요"
                className="w-full px-4 py-2.5 rounded-lg bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 focus:outline-none focus:ring-2 focus:ring-brand-600 dark:text-white transition-all text-sm"
              />
            </div>

            {/* Bio */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                한줄 소개
              </label>
              <textarea
                rows={3}
                value={data.bio}
                onChange={(e) => handleChange('bio', e.target.value)}
                placeholder="자기소개가 없습니다."
                className="w-full px-4 py-2.5 rounded-lg bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 focus:outline-none focus:ring-2 focus:ring-brand-600 dark:text-white transition-all text-sm resize-none placeholder-slate-400"
              />
            </div>
          </div>
        </section>

        {/* Account Section */}
        <section className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-slate-200 dark:border-zinc-800 overflow-hidden">
           <div className="px-6 py-4 border-b border-slate-100 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">계정 정보</h2>
          </div>
          <div className="p-6 space-y-6">
             <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                이메일
              </label>
              <input
                type="email"
                value={session?.user?.email || ''}
                readOnly
                className="w-full px-4 py-2.5 rounded-lg bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-500 dark:text-slate-400 text-sm cursor-not-allowed select-none"
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-4 pt-2">
               <button className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 border border-slate-200 dark:border-zinc-700 rounded-lg hover:bg-slate-50 dark:hover:bg-zinc-800 text-slate-700 dark:text-slate-300 text-sm font-medium transition-colors">
                  <Key size={16} />
                  비밀번호 변경
               </button>
               <button 
                  onClick={onLogout}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 border border-red-200 dark:border-red-900/30 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 text-sm font-medium transition-colors"
               >
                  <LogOut size={16} />
                  로그아웃
               </button>
            </div>
          </div>
        </section>

        <div className="h-8"></div> {/* Bottom spacer */}
      </div>
    </div>
  );
};

export default MyPage;