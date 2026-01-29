import React, { useEffect, useState } from 'react';
import { Plus, LogOut, User, Hash, Moon, Sun, Clock, Loader2, Search, Copy, Check, ArrowRight } from 'lucide-react';
import { Logo } from './Logo';
import { supabase } from '../lib/supabase';
import { Campaign } from '../types';
import { useAuth } from '../contexts/AuthContext';

interface DashboardProps {
  onJoinSession: (campaignId: string) => void;
  onLogout: () => void;
  onCreateSession: () => void;
  onOpenSettings: () => void;
}

const DashboardSkeleton = () => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
    {[1, 2, 3].map((i) => (
      <div key={i} className="bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 overflow-hidden h-[300px]">
        <div className="h-32 bg-slate-200 dark:bg-zinc-800"></div>
        <div className="p-5 space-y-4">
          <div className="h-6 bg-slate-200 dark:bg-zinc-800 rounded w-3/4"></div>
          <div className="h-4 bg-slate-200 dark:bg-zinc-800 rounded w-1/2"></div>
          <div className="pt-4 flex justify-between">
             <div className="h-4 bg-slate-200 dark:bg-zinc-800 rounded w-1/4"></div>
             <div className="h-4 bg-slate-200 dark:bg-zinc-800 rounded w-1/4"></div>
          </div>
        </div>
      </div>
    ))}
  </div>
);

const Dashboard: React.FC<DashboardProps> = ({ onJoinSession, onLogout, onCreateSession, onOpenSettings }) => {
  const { session } = useAuth();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteCodeInput, setInviteCodeInput] = useState('');
  const [joining, setJoining] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  const formatLastUpdate = (isoString: string) => {
    if (!isoString) return 'New';
    const date = new Date(isoString);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    if (isToday) {
      return `오늘, ${new Intl.DateTimeFormat('ko-KR', { hour: 'numeric', minute: 'numeric', hour12: true }).format(date)}`;
    } else {
      return new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' }).format(date);
    }
  };

  const fetchCampaigns = async () => {
    if (!session?.user) return;
    try {
      setLoading(true);
      // Fetch only campaigns where the user is a participant
      // And fetch all participants of those campaigns to display names
      const { data, error } = await supabase
        .from('participants')
        .select(`
          campaign_id,
          campaigns (
            *,
            profiles:gm_id (nickname),
            participants (
              user_id,
              profiles (nickname)
            )
          )
        `)
        .eq('user_id', session.user.id);

      if (error) throw error;

      // Extract campaigns from the joined result
      const myCampaigns = data
        .map((item: any) => item.campaigns)
        .filter((c: any) => c !== null) as Campaign[];
      
      // Sort by last_active_at descending (fallback to updated_at or created_at)
      myCampaigns.sort((a, b) => {
        const timeA = new Date(a.last_active_at || a.updated_at || a.created_at).getTime();
        const timeB = new Date(b.last_active_at || b.updated_at || b.created_at).getTime();
        return timeB - timeA;
      });

      setCampaigns(myCampaigns);
    } catch (error) {
      console.error('Error fetching campaigns:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
  }, [session]);

  const handleJoinByCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCodeInput.trim() || !session?.user) return;

    setJoining(true);
    try {
      // 1. Find Campaign by Invite Code
      const { data: campaign, error: findError } = await supabase
        .from('campaigns')
        .select('id, title')
        .eq('invite_code', inviteCodeInput.trim())
        .single();

      if (findError || !campaign) {
        alert("해당 코드를 가진 캠페인을 찾을 수 없습니다.");
        setJoining(false);
        return;
      }

      // 2. Check if already participated
      const { data: existing, error: checkError } = await supabase
        .from('participants')
        .select('id')
        .eq('campaign_id', campaign.id)
        .eq('user_id', session.user.id)
        .single();

      if (existing) {
        alert("이미 참여 중인 캠페인입니다.");
        setInviteCodeInput('');
        setJoining(false);
        return;
      }

      // 3. Insert into participants
      const { error: joinError } = await supabase
        .from('participants')
        .insert({
          user_id: session.user.id,
          campaign_id: campaign.id
        });

      if (joinError) throw joinError;

      alert(`'${campaign.title}' 캠페인에 입장했습니다.`);
      setInviteCodeInput('');
      fetchCampaigns(); // Refresh list

    } catch (err: any) {
      console.error("Join failed:", err);
      alert("입장 중 오류가 발생했습니다.");
    } finally {
      setJoining(false);
    }
  };

  const handleCopyCode = (e: React.MouseEvent, code: string) => {
    e.stopPropagation(); // Prevent card click
    navigator.clipboard.writeText(code);
    setCopiedId(code);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-b border-slate-200 dark:border-zinc-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 text-slate-900 dark:text-white">
            <Logo className="w-8 h-8" />
            <span className="text-xl font-bold tracking-tight">SLOW ORPG</span>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                 document.documentElement.classList.toggle('dark');
              }}
              className="p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
            >
              <Sun className="hidden dark:block" size={20} />
              <Moon className="dark:hidden" size={20} />
            </button>
            <button 
              onClick={onOpenSettings}
              className="w-8 h-8 rounded-full bg-slate-200 dark:bg-zinc-700 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:ring-2 hover:ring-brand-500 hover:ring-offset-2 dark:hover:ring-offset-zinc-950 hover:bg-slate-300 dark:hover:bg-zinc-600 transition-all cursor-pointer"
              title="My Page"
            >
              <User size={18} />
            </button>
            <button
              onClick={onLogout}
              className="text-sm text-slate-500 hover:text-red-500 dark:text-slate-400 dark:hover:text-red-400 transition-colors"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 py-8">
        
        {/* Action Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-end gap-4 mb-8">
          <div className="flex gap-3 w-full md:w-auto">
             <form onSubmit={handleJoinByCode} className="relative flex-1 md:flex-initial group flex items-center gap-2">
                <div className="relative flex-1">
                  <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-brand-500 transition-colors" size={16} />
                  <input 
                      type="text" 
                      value={inviteCodeInput}
                      onChange={(e) => setInviteCodeInput(e.target.value)}
                      placeholder="초대 코드 입력" 
                      className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm focus:ring-2 focus:ring-brand-600 outline-none md:w-48 transition-all uppercase"
                      maxLength={6}
                  />
                </div>
                <button 
                  type="submit"
                  disabled={joining || !inviteCodeInput.trim()}
                  className="px-4 py-2.5 bg-slate-200 dark:bg-zinc-800 hover:bg-slate-300 dark:hover:bg-zinc-700 text-slate-700 dark:text-slate-200 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {joining ? <Loader2 size={16} className="animate-spin" /> : '입장'}
                </button>
             </form>
          </div>
        </div>

        {/* Session List */}
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
           <Search size={18} /> 참여 중인 캠페인
        </h2>
        
        {loading ? (
           <DashboardSkeleton />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Create New Card (Always visible) */}
            <button 
              onClick={onCreateSession}
              className="border-2 border-dashed border-slate-200 dark:border-zinc-800 rounded-xl flex flex-col items-center justify-center h-full min-h-[300px] text-slate-400 hover:text-brand-600 hover:border-brand-300 dark:hover:border-brand-800 hover:bg-slate-50 dark:hover:bg-zinc-900/50 transition-all gap-3 group"
            >
               <div className="w-14 h-14 rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <Plus size={28} />
               </div>
               <span className="font-medium">새로운 캠페인 만들기</span>
            </button>

            {campaigns.map((campaign) => {
              // Extract Members (Excluding GM)
              const members = campaign.participants
                ?.filter(p => p.user_id !== campaign.gm_id)
                .map(p => p.profiles?.nickname || 'Unknown') || [];
              
              let memberString = "";
              if (members.length > 0) {
                 if (members.length <= 2) {
                    memberString = members.join(', ');
                 } else {
                    memberString = `${members.slice(0, 2).join(', ')} 외 ${members.length - 2}명`;
                 }
              }

              // Determine display time: prefer last_active_at, fallback to updated_at or created_at
              const displayTime = campaign.last_active_at || campaign.updated_at || campaign.created_at;

              return (
                <div 
                    key={campaign.id}
                    onClick={() => onJoinSession(campaign.id)}
                    className="group bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 overflow-hidden hover:shadow-xl hover:border-brand-300 dark:hover:border-brand-900 transition-all cursor-pointer flex flex-col h-full animate-fadeIn"
                >
                    <div className="h-40 bg-slate-200 dark:bg-zinc-800 relative overflow-hidden">
                        {campaign.cover_image ? (
                          <img src={campaign.cover_image} alt={campaign.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 dark:from-zinc-800 dark:to-zinc-900">
                             <Logo className="w-16 h-16 text-slate-300 dark:text-zinc-700 opacity-50" />
                          </div>
                        )}
                        <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md text-white text-[10px] font-bold px-2 py-1 rounded border border-white/10 uppercase tracking-wide">
                            {campaign.system}
                        </div>
                    </div>
                    <div className="p-5 flex-1 flex flex-col">
                        <div className="flex justify-between items-start mb-1">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors line-clamp-1 flex-1">
                                {campaign.title}
                            </h3>
                            <button 
                               onClick={(e) => handleCopyCode(e, campaign.invite_code)}
                               className={`ml-2 p-1.5 rounded-md text-xs font-mono border transition-all flex items-center gap-1 ${copiedId === campaign.invite_code ? 'bg-green-50 text-green-600 border-green-200' : 'bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-500 hover:text-brand-600'}`}
                               title="초대 코드 복사"
                            >
                               {copiedId === campaign.invite_code ? <Check size={12} /> : <Copy size={12} />}
                               {campaign.invite_code}
                            </button>
                        </div>
                        
                        <div className="text-xs text-slate-500 dark:text-slate-400 mb-4 leading-relaxed">
                           <span className="font-bold text-brand-600 dark:text-brand-400">GM:</span> {campaign.profiles?.nickname || 'Unknown'}
                           {memberString && (
                              <>
                                 <span className="mx-1.5 opacity-50">·</span>
                                 <span className="font-bold text-slate-700 dark:text-slate-300">멤버:</span> {memberString}
                              </>
                           )}
                        </div>
                        
                        {campaign.description && (
                           <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2 mb-4 flex-1">
                              {campaign.description}
                           </p>
                        )}
                        
                        <div className="mt-auto flex items-center justify-between text-xs text-slate-400 dark:text-slate-500 border-t border-slate-100 dark:border-zinc-800 pt-3">
                            <span className="flex items-center gap-1.5" title={`Last active: ${new Date(displayTime).toLocaleString()}`}>
                                 <Clock size={14} />
                                 {formatLastUpdate(displayTime)}
                            </span>
                        </div>
                    </div>
                </div>
              );
            })}
          </div>
        )}

      </main>
    </div>
  );
};

export default Dashboard;