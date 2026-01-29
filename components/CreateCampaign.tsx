import React, { useState, useEffect } from 'react';
import { ChevronLeft, Image as ImageIcon, Users, Loader2, AlertCircle, Link as LinkIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface CreateCampaignProps {
  onCancel: () => void;
  onCreate: () => void;
}

const CreateCampaign: React.FC<CreateCampaignProps> = ({ onCancel, onCreate }) => {
  const { session } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imgError, setImgError] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    system: 'CoC 7e',
    players: 4,
    description: '',
    coverImage: '', 
  });

  // Reset image error state when URL changes
  useEffect(() => {
    setImgError(false);
  }, [formData.coverImage]);

  const generateInviteCode = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user) return;

    if (formData.players < 1) {
        setError("최대 참여 인원은 1명 이상이어야 합니다.");
        return;
    }

    setLoading(true);
    setError(null);

    try {
      const inviteCode = generateInviteCode();

      // 1. Insert Campaign
      const { data: campaign, error: insertError } = await supabase
        .from('campaigns')
        .insert({
          title: formData.title,
          system: formData.system,
          description: formData.description,
          gm_id: session.user.id,
          max_players: formData.players,
          cover_image: formData.coverImage || null,
          invite_code: inviteCode
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // 2. Add Creator (GM) as Participant automatically
      if (campaign) {
         const { error: participantError } = await supabase
            .from('participants')
            .insert({
               user_id: session.user.id,
               campaign_id: campaign.id
            });
         
         if (participantError) throw participantError;
      }

      alert('캠페인이 생성되었습니다.');
      onCreate();
    } catch (err: any) {
      console.error('Error creating campaign:', err);
      setError(err.message || '캠페인 생성 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8">
      {/* Header / Nav */}
      <div className="w-full max-w-2xl mb-8 flex items-center justify-between">
        <button 
          onClick={onCancel}
          className="flex items-center gap-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors"
        >
          <ChevronLeft size={20} />
          <span className="text-sm font-medium">돌아가기</span>
        </button>
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">새 캠페인 생성</h2>
        <div className="w-16"></div> {/* Spacer for centering */}
      </div>

      {/* Main Card */}
      <div className="w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-slate-200 dark:border-zinc-800 overflow-hidden">
        <div className="p-8">
          
          <form className="space-y-6" onSubmit={handleSubmit}>
            
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                캠페인 제목 <span className="text-brand-600">*</span>
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({...formData, title: e.target.value})}
                placeholder="예: 깊은 밤의 저택"
                className="w-full px-4 py-3 rounded-lg bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 focus:outline-none focus:ring-2 focus:ring-brand-600 dark:text-white transition-all placeholder-slate-400"
                required
              />
            </div>

            {/* System & Players Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  룰 시스템 (System)
                </label>
                <div className="relative">
                  <select
                    value={formData.system}
                    onChange={(e) => setFormData({...formData, system: e.target.value})}
                    className="w-full px-4 py-3 rounded-lg bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 focus:outline-none focus:ring-2 focus:ring-brand-600 dark:text-white transition-all appearance-none cursor-pointer"
                  >
                    <option value="CoC 7e">Call of Cthulhu (7th Edition)</option>
                    <option value="Custom">기타 (Custom System)</option>
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  최대 참여 인원
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={formData.players}
                    onChange={(e) => setFormData({...formData, players: parseInt(e.target.value) || 0})}
                    className="w-full pl-10 pr-4 py-3 rounded-lg bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 focus:outline-none focus:ring-2 focus:ring-brand-600 dark:text-white transition-all"
                  />
                  <Users className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
                </div>
              </div>
            </div>

            {/* Cover Image Input (URL) */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                커버 이미지 (Optional)
              </label>
              <div className="flex gap-4 items-start">
                 {/* Preview Box */}
                 <div className="shrink-0 w-24 h-24 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-100 dark:bg-zinc-900 overflow-hidden flex items-center justify-center relative">
                    {formData.coverImage && !imgError ? (
                       <img 
                          src={formData.coverImage} 
                          alt="Cover Preview" 
                          className="w-full h-full object-cover"
                          onError={() => setImgError(true)}
                       />
                    ) : (
                       <ImageIcon className="text-slate-400" size={24} />
                    )}
                 </div>
                 
                 {/* Input Field */}
                 <div className="flex-1">
                    <div className="relative">
                        <input
                           type="text"
                           value={formData.coverImage}
                           onChange={(e) => setFormData({...formData, coverImage: e.target.value})}
                           placeholder="https://example.com/image.png"
                           className="w-full pl-10 pr-4 py-3 rounded-lg bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 focus:outline-none focus:ring-2 focus:ring-brand-600 dark:text-white transition-all text-sm"
                        />
                        <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                       이미지 주소(URL)를 입력하면 미리보기가 표시됩니다.
                    </p>
                 </div>
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                캠페인 설명
              </label>
              <textarea
                rows={4}
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                placeholder="시나리오 개요나 플레이어들이 알아야 할 주의사항을 적어주세요."
                className="w-full px-4 py-3 rounded-lg bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 focus:outline-none focus:ring-2 focus:ring-brand-600 dark:text-white transition-all resize-none placeholder-slate-400"
              />
            </div>

            <div className="p-4 bg-blue-50 dark:bg-blue-900/10 rounded-lg text-sm text-blue-700 dark:text-blue-300 flex items-start gap-2">
               <AlertCircle size={18} className="shrink-0 mt-0.5" />
               <p>
                  캠페인 생성 후 <strong>초대 코드</strong>가 자동 발급됩니다. 이 코드를 공유하여 플레이어를 초대할 수 있습니다.
               </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 text-sm rounded-lg flex items-center gap-2">
                <AlertCircle size={16} /> {error}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-4 pt-4">
              <button
                type="button"
                onClick={onCancel}
                disabled={loading}
                className="flex-1 py-3 px-4 rounded-lg border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-3 px-4 rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-semibold shadow-md hover:shadow-lg transition-all transform active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : '방 만들기'}
              </button>
            </div>

          </form>
        </div>
      </div>
    </div>
  );
};

export default CreateCampaign;