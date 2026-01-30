import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import ReactPlayer from 'react-player'; // BGM 플레이어
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { FULL_COC_SKILL_LIST } from '../constants';
import { Message, Character, SuccessLevel, LocationInfo, Campaign } from '../types';
import { 
  ChevronDown, Send, Dices, Menu, X, MapPin, Clock, 
  Shield, Heart, ChevronLeft, Eye, EyeOff, Edit2, Brain, User,
  Lock, PenTool, Plus, Settings, Download, Copy, Check, HelpCircle,
  AlertCircle, Info, Trash2, ExternalLink,
  Music, Volume2, VolumeX, Play, Pause // [추가] 재생/일시정지 아이콘
} from 'lucide-react';

interface PlayroomProps {
  campaignId: string;
  onExit: () => void;
  onCreateCharacter: () => void;
  onEditCharacter: (char: Character) => void;
  onOpenSettings: () => void;
}

type SpeakerType = 'character' | 'gm' | 'user' | 'custom';
type ChatTab = 'story' | 'ooc';
type RightTab = 'stats' | 'skills';
type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

const DEFAULT_LOCATION: LocationInfo = {
    chapter: '제 1장',
    location: '알 수 없음',
    time: '시간 미상',
    description: '아직 설정된 장면이 없습니다.',
};

// --- Helper Functions ---

const calculateCoC7eRoll = (target: number, modifier: number = 0) => {
  const units = Math.floor(Math.random() * 10);
  const tensMain = Math.floor(Math.random() * 10);
  
  const rolls = [tensMain * 10 + units]; 
  
  let finalTens = tensMain;
  const extraDiceCount = Math.abs(modifier);
  const extraTens: number[] = [];
  
  for (let i = 0; i < extraDiceCount; i++) {
    extraTens.push(Math.floor(Math.random() * 10));
  }
  
  if (modifier > 0) {
    const allTens = [tensMain, ...extraTens];
    finalTens = Math.min(...allTens);
  } else if (modifier < 0) {
    const allTens = [tensMain, ...extraTens];
    finalTens = Math.max(...allTens);
  }
  
  let total = (finalTens * 10) + units;
  if (total === 0) total = 100;
  
  const successLevel = getCoCSuccessLevel(total, target);
  
  return {
    total,
    rolls: [tensMain * 10 + units, ...extraTens.map(t => t * 10 + units)],
    successLevel,
    modifier
  };
};

const getCoCSuccessLevel = (roll: number, target: number): SuccessLevel => {
  if (roll === 1) return 'Critical Success';
  if (target < 50 && roll >= 96) return 'Fumble';
  if (roll === 100) return 'Fumble';
  if (roll <= Math.floor(target / 5)) return 'Extreme Success';
  if (roll <= Math.floor(target / 2)) return 'Hard Success';
  if (roll <= target) return 'Regular Success';
  return 'Failure';
};

const getSuccessLevelLabel = (level: string) => {
  switch(level) {
    case 'Critical Success': return '대성공';
    case 'Extreme Success': return '극단적 성공';
    case 'Hard Success': return '어려운 성공';
    case 'Regular Success': return '보통 성공';
    case 'Fumble': return '대실패';
    case 'Failure': return '실패';
    default: return level;
  }
};

const getBaseSkillValue = (skillName: string, dex: number = 50, edu: number = 50) => {
  if (skillName === '회피') return Math.floor(dex / 2);
  if (skillName === '언어(모국어)') return edu;
  const bases: Record<string, number> = {
    '감정': 5, '고고학': 1, '관찰력': 25, '근접전(격투)': 25, '기계수리': 10, '도약': 20,
    '듣기': 20, '말재주': 5, '매혹': 15, '법률': 5, '변장': 5, '사격(권총)': 20,
    '사격(라이플/산탄총)': 25, '설득': 10, '손놀림': 10, '수영': 20, '승마': 5, '심리학': 10,
    '역사': 5, '열쇠공': 1, '오르기': 20, '오컬트': 5, '위협': 15, '은밀행동': 20,
    '응급처치': 30, '의료': 1, '인류학': 1, '자동차 운전': 20, '자료조사': 20, '자연': 10,
    '재력': 0, '전기수리': 10, '정신분석': 1, '중장비 조작': 1, '추적': 10, '크툴루 신화': 0,
    '투척': 20, '항법': 10, '회계': 5
  };
  return bases[skillName] || 0; 
};

// --- Sub-components ---

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

const SkeletonLoader = () => (
  <div className="animate-pulse space-y-6 p-4">
    {[1, 2, 3, 4].map((i) => (
      <div key={i} className="flex gap-4">
        <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-zinc-800"></div>
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-slate-200 dark:bg-zinc-800 rounded w-1/4"></div>
          <div className="h-12 bg-slate-200 dark:bg-zinc-800 rounded w-3/4"></div>
        </div>
      </div>
    ))}
  </div>
);

const RightSidebarSkeleton = () => (
  <div className="animate-pulse p-4 space-y-6">
    <div className="flex items-center gap-3 mb-6">
      <div className="w-12 h-12 rounded-full bg-slate-200 dark:bg-zinc-800"></div>
      <div className="flex-1 space-y-2">
        <div className="h-4 bg-slate-200 dark:bg-zinc-800 rounded w-full"></div>
        <div className="h-3 bg-slate-200 dark:bg-zinc-800 rounded w-2/3"></div>
      </div>
    </div>
    <div className="space-y-4">
       {[1, 2, 3, 4, 5, 6].map(i => (
         <div key={i} className="h-10 bg-slate-200 dark:bg-zinc-800 rounded-lg"></div>
       ))}
    </div>
  </div>
);

const RichMessage = ({ content }: { content: string }) => {
  const processedContent = content.replace(
    /(^|\s)(https?:\/\/\S+\.(?:png|jpg|jpeg|gif|webp)(?:\?\S*)?)(?=\s|$)/gi, 
    '$1![]($2)'
  );

  return (
    <div className="markdown-content">
      <ReactMarkdown 
        rehypePlugins={[rehypeRaw]} 
        remarkPlugins={[remarkGfm, remarkBreaks]}
        components={{
           a: ({node, ...props}) => <a {...props} className="text-brand-600 underline hover:text-brand-700" target="_blank" rel="noopener noreferrer" />,
        }}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
};

const DiceResultCard = ({ result }: { result: NonNullable<Message['diceResult']> }) => {
  let borderColor = 'border-slate-200 dark:border-zinc-700';
  let footerBg = 'bg-slate-100 dark:bg-zinc-800';
  let footerText = 'text-slate-600 dark:text-slate-300';

  const level = result.successLevel || 'Failure';

  if (level.includes('Critical')) {
    borderColor = 'border-yellow-400 dark:border-yellow-600';
    footerBg = 'bg-yellow-100 dark:bg-yellow-900/40';
    footerText = 'text-yellow-700 dark:text-yellow-400';
  } else if (level.includes('Extreme')) {
    borderColor = 'border-emerald-600 dark:border-emerald-700';
    footerBg = 'bg-emerald-200 dark:bg-emerald-900/60';
    footerText = 'text-emerald-800 dark:text-emerald-300';
  } else if (level.includes('Hard')) {
    borderColor = 'border-green-500 dark:border-green-600';
    footerBg = 'bg-green-100 dark:bg-green-900/40';
    footerText = 'text-green-700 dark:text-green-400';
  } else if (level.includes('Regular') || level.includes('Success')) {
    borderColor = 'border-green-300 dark:border-green-800';
    footerBg = 'bg-green-50 dark:bg-green-900/20';
    footerText = 'text-green-600 dark:text-green-400';
  } else if (level.includes('Fumble')) {
    borderColor = 'border-rose-600 dark:border-rose-800';
    footerBg = 'bg-rose-100 dark:bg-rose-900/40';
    footerText = 'text-rose-700 dark:text-rose-400';
  } else if (level.includes('Failure')) {
    borderColor = 'border-slate-300 dark:border-zinc-600';
    footerBg = 'bg-slate-100 dark:bg-zinc-800';
    footerText = 'text-slate-500 dark:text-slate-400';
  }

  let modifierText = '';
  if (result.modifier === 1) modifierText = '(보너스 +1)';
  if (result.modifier === 2) modifierText = '(보너스 +2)';
  if (result.modifier === -1) modifierText = '(패널티 -1)';
  if (result.modifier === -2) modifierText = '(패널티 -2)';

  return (
    <div className={`mt-2 w-full max-w-xs rounded-lg border ${borderColor} overflow-hidden shadow-sm bg-white dark:bg-zinc-900 transition-all`}>
       <div className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-center flex justify-between items-center ${level.includes('Success') ? 'bg-slate-800 text-white' : 'bg-slate-200 dark:bg-zinc-800 text-slate-600 dark:text-slate-400'}`}>
          <span>{result.formula.includes('1d100') ? result.formula.split('<=')[0].replace('1d100', '판정') : 'Roll'}</span>
          {modifierText && <span className="opacity-75 text-[10px]">{modifierText}</span>}
       </div>
       <div className="p-3 flex items-center justify-between">
          <div className="flex flex-col items-center">
             <span className="text-[10px] text-slate-400 uppercase">Target</span>
             <span className="font-mono font-medium text-slate-600 dark:text-slate-400">
                {result.formula.includes('<=') ? result.formula.split('<=')[1].trim() : '-'}
             </span>
          </div>
          <div className="flex flex-col items-center">
             <Dices size={24} className={level.includes('Fumble') || level.includes('Failure') ? "text-slate-300 dark:text-slate-600" : "text-brand-600 dark:text-brand-400"} />
          </div>
          <div className="flex flex-col items-center">
             <span className="text-[10px] text-slate-400 uppercase">Result</span>
             <span className={`font-mono text-2xl font-bold ${level.includes('Critical') ? 'text-yellow-500' : (level.includes('Fumble') ? 'text-rose-600' : 'text-slate-900 dark:text-white')}`}>
                {result.total}
             </span>
          </div>
       </div>
       {result.successLevel && (
          <div className={`${footerBg} px-3 py-1.5 text-center text-xs font-bold uppercase tracking-wide ${footerText}`}>
             {getSuccessLevelLabel(result.successLevel)}
          </div>
       )}
    </div>
  );
};

const CharacterModal = ({ 
  character, 
  isOpen, 
  onClose, 
  onUpdate 
}: { 
  character: Character; 
  isOpen: boolean; 
  onClose: () => void; 
  onUpdate: (updated: Character) => void;
}) => {
  if (!isOpen) return null;
  const [editChar, setEditChar] = useState(character);

  const handleStatChange = (stat: 'hp' | 'mp' | 'san' | 'luck', field: 'current' | 'max', delta: number) => {
    setEditChar(prev => ({
      ...prev,
      [stat]: { ...prev[stat], [field]: Math.max(0, prev[stat][field] + delta) }
    }));
  };

  const handleSave = () => {
    onUpdate(editChar);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-zinc-900 w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-4 border-b border-slate-200 dark:border-zinc-800 flex justify-between items-center bg-slate-50 dark:bg-zinc-950">
           <div>
              <h3 className="font-bold text-lg dark:text-white">상태 간편 수정</h3>
              <p className="text-xs text-slate-500">HP, MP, SAN, LUCK 수치를 조정합니다.</p>
           </div>
          <button onClick={onClose}><X size={20} className="text-slate-500" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="grid grid-cols-2 gap-4">
             {[
               { label: 'HP (체력)', key: 'hp', color: 'text-red-600' },
               { label: 'MP (마력)', key: 'mp', color: 'text-blue-600' },
               { label: 'SAN (이성)', key: 'san', color: 'text-brand-600' }, 
               { label: 'LUCK (운)', key: 'luck', color: 'text-brand-600' }
             ].map((stat: any) => (
               <div key={stat.key} className="bg-slate-50 dark:bg-zinc-800 p-3 rounded-xl border border-slate-100 dark:border-zinc-700">
                  <div className={`text-xs font-bold ${stat.color} mb-2`}>{stat.label}</div>
                  <div className="flex items-center justify-between">
                     <div className="flex flex-col items-center">
                        <span className="text-xs text-slate-400">Current</span>
                        <div className="flex items-center gap-2">
                           <button onClick={() => handleStatChange(stat.key, 'current', -1)} className="w-6 h-6 rounded bg-slate-200 dark:bg-zinc-700 hover:bg-slate-300 dark:text-white">-</button>
                           <span className="font-mono font-bold text-lg w-8 text-center dark:text-white">{editChar[stat.key as 'hp'].current}</span>
                           <button onClick={() => handleStatChange(stat.key, 'current', 1)} className="w-6 h-6 rounded bg-slate-200 dark:bg-zinc-700 hover:bg-slate-300 dark:text-white">+</button>
                        </div>
                     </div>
                     <div className="h-8 w-px bg-slate-200 dark:bg-zinc-600 mx-2"></div>
                     <div className="flex flex-col items-center">
                        <span className="text-xs text-slate-400">Max</span>
                        <div className="flex items-center gap-2">
                           <button onClick={() => handleStatChange(stat.key, 'max', -1)} className="w-6 h-6 rounded bg-slate-100 dark:bg-zinc-900 hover:bg-slate-200 dark:text-slate-400 text-xs">-</button>
                           <span className="font-mono text-slate-500 dark:text-slate-400">{editChar[stat.key as 'hp'].max}</span>
                           <button onClick={() => handleStatChange(stat.key, 'max', 1)} className="w-6 h-6 rounded bg-slate-100 dark:bg-zinc-900 hover:bg-slate-200 dark:text-slate-400 text-xs">+</button>
                        </div>
                     </div>
                  </div>
               </div>
             ))}
          </div>
        </div>
        <div className="p-4 border-t border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-zinc-800">취소</button>
          <button onClick={handleSave} className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-medium">저장하기</button>
        </div>
      </div>
    </div>
  );
};

const EditCampaignModal = ({ 
  isOpen, 
  onClose, 
  campaignId,
  initialData,
  onUpdate,
  addToast
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  campaignId: string;
  initialData: { title: string; description: string; cover_image: string; max_players: number; discord_webhook_url?: string };
  onUpdate: (updated: any) => void;
  addToast: (msg: string, type: ToastType) => void;
}) => {
  if (!isOpen) return null;
  const [formData, setFormData] = useState(initialData);
  const [loading, setLoading] = useState(false);
  const [imgError, setImgError] = useState(false);

  useEffect(() => { setImgError(false); }, [formData.cover_image]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.from('campaigns').update(formData).eq('id', campaignId);
      if (error) throw error;
      onUpdate(formData);
      addToast('캠페인 정보가 수정되었습니다.', 'success');
      onClose();
    } catch (err: any) {
      addToast(err.message || '수정 실패', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-zinc-900 w-full max-w-lg rounded-2xl shadow-xl border border-slate-200 dark:border-zinc-800 overflow-hidden max-h-[90vh] flex flex-col">
        <div className="p-4 border-b border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 flex justify-between items-center flex-shrink-0">
           <h3 className="font-bold text-lg dark:text-white">캠페인 설정 수정</h3>
           <button onClick={onClose}><X size={20} className="text-slate-500" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
           <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">제목</label>
              <input 
                value={formData.title} 
                onChange={e => setFormData({...formData, title: e.target.value})}
                className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 focus:ring-2 focus:ring-brand-600 outline-none dark:text-white"
                required
              />
           </div>
           <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">설명</label>
              <textarea 
                value={formData.description} 
                onChange={e => setFormData({...formData, description: e.target.value})}
                className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 focus:ring-2 focus:ring-brand-600 outline-none dark:text-white resize-none"
                rows={3}
              />
           </div>
           <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">커버 이미지 URL</label>
              <div className="flex gap-3">
                 <div className="w-16 h-16 rounded-lg bg-slate-100 dark:bg-zinc-800 overflow-hidden flex-shrink-0 border border-slate-200 dark:border-zinc-800">
                    {formData.cover_image && !imgError && <img src={formData.cover_image} alt="Preview" className="w-full h-full object-cover" onError={() => setImgError(true)} />}
                 </div>
                 <input 
                   value={formData.cover_image || ''} 
                   onChange={e => setFormData({...formData, cover_image: e.target.value})}
                   className="flex-1 px-3 py-2 rounded-lg bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 focus:ring-2 focus:ring-brand-600 outline-none dark:text-white text-sm"
                   placeholder="https://..."
                 />
              </div>
           </div>
           <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">최대 인원</label>
              <input 
                type="number" 
                min="1"
                value={formData.max_players} 
                onChange={e => setFormData({...formData, max_players: parseInt(e.target.value) || 1})}
                className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 focus:ring-2 focus:ring-brand-600 outline-none dark:text-white"
              />
           </div>
           
           <div className="border-t border-slate-100 dark:border-zinc-800 pt-4 mt-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-2">
                 <ExternalLink size={14} /> 디스코드 웹훅 URL
              </label>
              <input 
                value={formData.discord_webhook_url || ''} 
                onChange={e => setFormData({...formData, discord_webhook_url: e.target.value})}
                className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 focus:ring-2 focus:ring-brand-600 outline-none dark:text-white text-xs font-mono"
                placeholder="https://discord.com/api/webhooks/..."
              />
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                 디스코드 채널 설정 → 연동 → 웹훅에서 URL을 복사해 붙여넣으세요. 채팅 로그가 실시간 전송됩니다.
              </p>
           </div>

           <div className="pt-4 flex justify-end gap-3 flex-shrink-0">
              <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-zinc-800">취소</button>
              <button type="submit" disabled={loading} className="px-4 py-2 rounded-lg bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50">저장</button>
           </div>
        </form>
      </div>
    </div>
  );
}

const LockedScenarioView = () => (
  <div className="flex flex-col items-center justify-center h-full p-6 text-center text-slate-400 dark:text-slate-500 animate-fadeIn">
    <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center mb-4">
      <Lock size={24} />
    </div>
    <h3 className="font-semibold text-slate-600 dark:text-slate-400 mb-1">비공개 시나리오</h3>
    <p className="text-xs leading-relaxed">
      현재 시나리오 정보가<br/>비공개 상태입니다.
    </p>
  </div>
);

const ExportModal = ({ 
  isOpen, 
  onClose, 
  messages,
  locationInfo,
  addToast
}: { 
  isOpen: boolean; 
  onClose: () => void;
  messages: Message[];
  locationInfo: any;
  addToast: (msg: string, type: ToastType) => void;
}) => {
  if (!isOpen) return null;
  const [includeOOC, setIncludeOOC] = useState(false);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied'>('idle');

  const getFilteredMessages = () => {
    return messages.filter(m => {
      if (m.isHidden) return false;
      if (!includeOOC && m.type === 'ooc') return false;
      return true;
    });
  };

  const generateHTML = (forDownload: boolean) => {
    const filtered = getFilteredMessages();

    const messagesHTML = filtered.map(msg => {
      const containerStyle = "display:flex; margin-bottom: 16px; gap: 16px; font-family: sans-serif;";
      const avatarStyle = "width: 40px; height: 40px; border-radius: 50%; overflow: hidden; background-color: #e2e8f0; flex-shrink: 0;";
      const nameStyle = "font-weight: bold; font-size: 14px; color: #0f172a; margin-bottom: 4px;";
      const timeStyle = "font-size: 10px; color: #94a3b8; margin-left: 8px; font-weight: normal;";
      const textStyle = "color: #334155; line-height: 1.6; font-size: 15px;";
      
      const isNarration = msg.type === 'narration';
      const isOOC = msg.type === 'ooc';
      
      if (isNarration) {
        return `
          <div style="text-align: center; margin: 32px 0; padding: 0 16px;">
            <div style="font-family: serif; font-size: 18px; font-style: italic; color: #1e293b; line-height: 2;">
              ${msg.content}
            </div>
          </div>
        `;
      }

      const avatarImg = msg.avatarUrl 
        ? `<img src="${msg.avatarUrl}" style="width: 100%; height: 100%; object-fit: cover;" />`
        : '';
        
      const contentHTML = isOOC 
        ? `<div style="font-size: 13px; color: #475569; background: #eff6ff; padding: 8px 12px; border-radius: 8px; border: 1px solid #dbeafe;">${msg.content}</div>`
        : (msg.diceResult 
            ? `<div style="border:1px solid #cbd5e1; border-radius: 8px; padding: 12px; background: #fff; width: 200px;">
                <div style="text-align:center; font-size: 12px; font-weight:bold; color: #475569; background: #f1f5f9; padding: 4px; margin-bottom: 8px; border-radius: 4px;">ROLL</div>
                <div style="display:flex; justify-content:space-between; align-items:center;">
                   <span style="color:#64748b; font-size: 12px;">Result</span>
                   <span style="font-size: 20px; font-weight:bold; color: #0f172a;">${msg.diceResult.total}</span>
                </div>
                <div style="text-align:center; font-size: 11px; margin-top: 8px; color: #64748b;">${msg.diceResult.formula}</div>
               </div>`
            : `<div style="${textStyle}">${msg.content}</div>`
          );

      return `
        <div style="${containerStyle}">
          <div style="${avatarStyle}">
             ${avatarImg}
          </div>
          <div style="flex: 1;">
            <div style="${nameStyle}">
              ${msg.senderName} <span style="${timeStyle}">${msg.timestamp}</span>
            </div>
            ${contentHTML}
          </div>
        </div>
      `;
    }).join('');

    if (forDownload) {
      return `
        <!DOCTYPE html>
        <html lang="ko">
        <head>
          <meta charset="UTF-8">
          <title>Chat Log</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
             body { font-family: 'Inter', sans-serif; background-color: #f8fafc; }
             .chat-container { max-width: 800px; margin: 0 auto; padding: 40px 20px; background: white; min-height: 100vh; box-shadow: 0 0 20px rgba(0,0,0,0.05); }
             strong { font-weight: 700; }
             em { font-style: italic; }
             img { max-width: 100%; border-radius: 8px; }
          </style>
        </head>
        <body>
          <div class="chat-container">
             <div class="space-y-6">
                ${messagesHTML}
             </div>
          </div>
        </body>
        </html>
      `;
    } else {
      return `
        <div style="font-family: sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; background: #fff;">
          ${messagesHTML}
        </div>
      `;
    }
  };

  const handleDownload = () => {
    const html = generateHTML(true);
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `log_${new Date().toISOString().slice(0,10)}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    addToast('로그가 다운로드되었습니다.', 'success');
    onClose();
  };

  const handleCopy = async () => {
    const html = generateHTML(false);
    try {
      await navigator.clipboard.writeText(html);
      setCopyStatus('copied');
      addToast('클립보드에 복사되었습니다.', 'success');
      setTimeout(() => setCopyStatus('idle'), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
      addToast('복사에 실패했습니다.', 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-zinc-800 flex justify-between items-center bg-slate-50 dark:bg-zinc-950">
           <h3 className="font-bold text-lg dark:text-white flex items-center gap-2"><Download size={20}/> 로그 내보내기</h3>
           <button onClick={onClose}><X size={20} className="text-slate-500" /></button>
        </div>
        
        <div className="p-6 space-y-6">
           <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-zinc-800 rounded-xl border border-slate-100 dark:border-zinc-700">
              <input 
                type="checkbox" 
                id="includeOOC" 
                checked={includeOOC} 
                onChange={(e) => setIncludeOOC(e.target.checked)}
                className="w-5 h-5 rounded text-brand-600 focus:ring-brand-500 border-gray-300"
              />
              <label htmlFor="includeOOC" className="text-sm font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                 사담(OOC) 탭 내용 포함하기
                 <p className="text-xs text-slate-400 font-normal mt-0.5">체크 시 사담 메시지도 로그에 함께 저장됩니다.</p>
              </label>
           </div>

           <div className="grid grid-cols-2 gap-4">
              <button 
                onClick={handleDownload}
                className="flex flex-col items-center justify-center p-4 border border-slate-200 dark:border-zinc-700 rounded-xl hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors gap-2 group"
              >
                 <div className="w-10 h-10 rounded-full bg-brand-50 dark:bg-brand-900/20 flex items-center justify-center text-brand-600 dark:text-brand-400 group-hover:scale-110 transition-transform">
                    <Download size={20} />
                 </div>
                 <span className="text-sm font-bold text-slate-700 dark:text-slate-200">HTML 다운로드</span>
              </button>

              <button 
                onClick={handleCopy}
                className="flex flex-col items-center justify-center p-4 border border-slate-200 dark:border-zinc-700 rounded-xl hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors gap-2 group"
              >
                 <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${copyStatus === 'copied' ? 'bg-green-100 text-green-600' : 'bg-slate-100 dark:bg-zinc-700 text-slate-600 dark:text-slate-300'}`}>
                    {copyStatus === 'copied' ? <Check size={20} /> : <Copy size={20} />}
                 </div>
                 <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                    {copyStatus === 'copied' ? '복사 완료!' : 'HTML 코드 복사'}
                 </span>
              </button>
           </div>
        </div>
      </div>
    </div>
  );
};

const SyntaxHelp = () => (
  <div className="absolute bottom-full right-0 mb-3 w-64 p-4 bg-zinc-900/95 backdrop-blur-md text-slate-100 text-xs rounded-lg shadow-xl border border-zinc-700 z-50 animate-fadeIn">
    <h4 className="font-bold mb-2 text-brand-400">Chat Syntax Guide</h4>
    <div className="space-y-2">
      <div className="grid grid-cols-[80px_1fr] gap-2 items-center">
        <code className="bg-zinc-800 px-1 py-0.5 rounded text-yellow-400">**굵게**</code>
        <span><strong>Bold</strong> Text</span>
      </div>
      <div className="grid grid-cols-[80px_1fr] gap-2 items-center">
        <code className="bg-zinc-800 px-1 py-0.5 rounded text-yellow-400">*기울임*</code>
        <span><em>Italic</em> Text</span>
      </div>
      <div className="grid grid-cols-[80px_1fr] gap-2 items-center">
        <code className="bg-zinc-800 px-1 py-0.5 rounded text-yellow-400">***강조***</code>
        <span><strong><em>BoldItalic</em></strong></span>
      </div>
      <div className="grid grid-cols-[80px_1fr] gap-2 items-center">
        <code className="bg-zinc-800 px-1 py-0.5 rounded text-yellow-400">~~취소~~</code>
        <span><del>Strike</del> Text</span>
      </div>
      <div className="mt-2 pt-2 border-t border-zinc-700">
        <div className="mb-1 text-slate-400 font-semibold">이미지 (Image)</div>
        <div className="text-[10px] text-slate-400 mb-1">이미지 주소 붙여넣기 (디스코드 링크 가능)</div>
      </div>
    </div>
  </div>
);

const Playroom: React.FC<PlayroomProps> = ({ campaignId, onExit, onCreateCharacter, onEditCharacter, onOpenSettings }) => {
  const { session } = useAuth();
  
  // --- Global State ---
  const [activeTab, setActiveTab] = useState<ChatTab>('story');
  const [rightTab, setRightTab] = useState<RightTab>('stats');
  
  // Sidebar States
  const [isScenarioVisible, setIsScenarioVisible] = useState(true); // Global Visibility
  const [isGM, setIsGM] = useState(false); 
  const [campaignTitle, setCampaignTitle] = useState("Loading...");
  const [campaignData, setCampaignData] = useState<Campaign | null>(null); // Full campaign data for editing

  // --- Data State ---
  // Initial state is EMPTY, no dummy data
  const [myCharacters, setMyCharacters] = useState<Character[]>([]);
  const [selectedCharId, setSelectedCharId] = useState<string | null>(null);
  
  const character = myCharacters.find(c => c.id === selectedCharId) || null;

  const [messages, setMessages] = useState<Message[]>([]);
  const [locationInfo, setLocationInfo] = useState(DEFAULT_LOCATION);
  const [isLoading, setIsLoading] = useState(true);
  
  // User Profile Data for Defaults
  const [userNickname, setUserNickname] = useState<string>('');
  
  // --- UI State ---
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [rightSidebarOpen, setRightSidebarOpen] = useState(true);
  const [speakerDropdownOpen, setSpeakerDropdownOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [editCampaignOpen, setEditCampaignOpen] = useState(false);
  const [showSyntaxHelp, setShowSyntaxHelp] = useState(false);
  
  // Dice Logic State
  const [diceModifier, setDiceModifier] = useState<number>(0); // 0: Normal, 1/2: Bonus, -1/-2: Penalty

  // Speaker Logic
  const [speakerType, setSpeakerType] = useState<SpeakerType>('custom'); 
  const [customSpeakerName, setCustomSpeakerName] = useState(""); 

  const [inputValue, setInputValue] = useState("");
  const [editingField, setEditingField] = useState<string | null>(null);
  const [showCharModal, setShowCharModal] = useState(false);
  
  // --- Unread Indicators ---
  // Store the timestamp of when the user last "read" a tab
  // Initialized to mount time (new Date()) so old messages don't trigger unread
  const [lastReadStory, setLastReadStory] = useState<Date>(new Date());
  const [lastReadOOC, setLastReadOOC] = useState<Date>(new Date());
  
  const [unreadOOC, setUnreadOOC] = useState(false);
  const [unreadStory, setUnreadStory] = useState(false);

  // --- Toasts ---
  const [toasts, setToasts] = useState<Toast[]>([]);

  // BGM State
  const [bgmUrl, setBgmUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false); // [추가] 재생 여부
  const [volume, setVolume] = useState(0.5);
  const [isMuted, setIsMuted] = useState(false);
  const [showVolume, setShowVolume] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const addToast = (message: string, type: ToastType = 'info') => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  };

  const copyInviteCode = () => {
    if (campaignData?.invite_code) {
      navigator.clipboard.writeText(campaignData.invite_code);
      addToast(`초대 코드(${campaignData.invite_code})가 복사되었습니다.`, 'success');
      setSettingsOpen(false);
    }
  };

  // --- Discord Integration ---
  const sendToDiscord = async (webhookUrl: string, username: string, content: string, avatarUrl?: string) => {
    if (!webhookUrl) return;
    try {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username,
          content: content,
          avatar_url: avatarUrl
        })
      });
    } catch (e) {
      console.error("Discord webhook failed", e);
      // Intentionally swallowing error so game flow isn't interrupted
    }
  };

  const handleCharacterSave = async (updated: Character) => {
    // 1. Get Old Data for Comparison (Current state before update)
    const oldChar = myCharacters.find(c => c.id === updated.id);

    // Optimistic UI Update
    setMyCharacters(prev => prev.map(c => c.id === updated.id ? updated : c));

    try {
        // 2. Fetch current derived data to preserve other fields
        const { data: currentData, error: fetchError } = await supabase
            .from('characters')
            .select('derived')
            .eq('id', updated.id)
            .single();

        if (fetchError) throw fetchError;

        const oldDerived = currentData.derived || {};

        // 3. Merge new values
        const newDerived = {
            ...oldDerived,
            hp_current: updated.hp.current,
            hp_max: updated.hp.max,
            mp_current: updated.mp.current,
            mp_max: updated.mp.max,
            san_current: updated.san.current,
            san_start: updated.san.max, // Sync max to start/max in derived
            luck_current: updated.luck.current
        };

        // 4. Update DB
        const { error: updateError } = await supabase
            .from('characters')
            .update({ derived: newDerived })
            .eq('id', updated.id);

        if (updateError) throw updateError;

        // 5. Compare and Log Changes
        if (oldChar && session?.user) {
            const changes: string[] = [];
            if (oldChar.hp.current !== updated.hp.current) changes.push(`체력 ${oldChar.hp.current} -> ${updated.hp.current}`);
            if (oldChar.mp.current !== updated.mp.current) changes.push(`마력 ${oldChar.mp.current} -> ${updated.mp.current}`);
            if (oldChar.san.current !== updated.san.current) changes.push(`이성 ${oldChar.san.current} -> ${updated.san.current}`);
            if (oldChar.luck.current !== updated.luck.current) changes.push(`운 ${oldChar.luck.current} -> ${updated.luck.current}`);

            if (changes.length > 0) {
                const content = changes.join(', ');
                
                // Send to Discord
                if (campaignData?.discord_webhook_url) {
                    sendToDiscord(campaignData.discord_webhook_url, `${updated.name} (System)`, content, updated.avatarUrl);
                }

                // Insert into Supabase (Chat Log)
                const { error: msgError } = await supabase.from('messages').insert({
                    campaign_id: campaignId,
                    user_id: session.user.id,
                    content: content,
                    type: 'talk', // Changed from 'ooc' to 'talk' to appear in Main Story
                    speaker_name: updated.name,
                    avatar_url: updated.avatarUrl // Insert Avatar URL
                });

                if (msgError) {
                    console.error("채팅 로그 저장 실패:", msgError);
                }
            }
        }

        addToast('캐릭터 상태가 저장되었습니다.', 'success');
    } catch (err: any) {
        console.error("Failed to save character stats:", err);
        addToast(`저장 실패: ${err.message}`, 'error');
    }
  };

  const updateBgmUrl = async (url: string) => {
    // 1. 화면 먼저 갱신
    setBgmUrl(url);
    setEditingField(null);

    // 2. DB 업데이트
    try {
      await supabase.from('campaigns').update({ bgm_url: url }).eq('id', campaignId);
    } catch (err) {
      console.error("BGM Update failed:", err);
      addToast("BGM 변경 실패", "error");
    }
  };

  // 1. Fetch Campaign Info & User Profile & Characters
  useEffect(() => {
    const fetchCampaignData = async () => {
      if (!campaignId || !session?.user) return;
      try {
        const [campaignRes, profileRes] = await Promise.all([
           supabase.from('campaigns').select('*').eq('id', campaignId).single(),
           supabase.from('profiles').select('nickname, avatar_url').eq('id', session.user.id).single()
        ]);

        if (campaignRes.data) {
           const cData = campaignRes.data as Campaign;
           setCampaignData(cData);
           setCampaignTitle(cData.title);
           setIsGM(cData.gm_id === session.user.id);
           
           // Initialize Scene Data
           setLocationInfo({
             chapter: cData.current_chapter || '제 1장',
             location: cData.current_location || '알 수 없음',
             time: cData.scenario_time || '시간 미상',
             description: cData.scene_description || '아직 설정된 장면이 없습니다.',
           });
           setIsScenarioVisible(cData.is_scene_visible ?? true);
           // [BGM] 초기 로드
           setBgmUrl((cData as any).bgm_url || null);
        }
        
        if (profileRes.data) {
           setUserNickname(profileRes.data.nickname);
           if (!customSpeakerName) setCustomSpeakerName(profileRes.data.nickname);
           // userAvatarUrl could be stored if we want OOC to have avatar
        }

        // Fetch User's Characters for this Campaign
        const { data: charData, error: charError } = await supabase
          .from('characters')
          .select('*')
          .eq('campaign_id', campaignId)
          .eq('user_id', session.user.id);
        
        if (charError) throw charError;

        if (charData && charData.length > 0) {
            // Map DB snake_case JSON to Character type
            const mappedChars: Character[] = charData.map((c: any) => ({
                id: c.id,
                name: c.name,
                class: c.occupation,
                age: c.age,
                // Assuming stats/skills are JSONB in DB
                hp: { current: c.derived?.hp_current ?? c.derived?.hp_max, max: c.derived?.hp_max },
                mp: { current: c.derived?.mp_current ?? c.derived?.mp_max, max: c.derived?.mp_max },
                san: { current: c.derived?.san_current ?? c.derived?.san_start, max: c.derived?.san_start },
                luck: { current: c.derived?.luck_current ?? 50, max: 99 }, 
                stats: Object.entries(c.stats).map(([k, v]) => ({ label: k, value: v as number })),
                skills: c.skills,
                notes: c.backstory?.full || '',
                avatarUrl: c.avatar_url
            }));
            setMyCharacters(mappedChars);
            setSelectedCharId(mappedChars[0].id);
            setSpeakerType('character'); // Default to character if exists
        } else {
            setMyCharacters([]);
            setSelectedCharId(null);
            setSpeakerType('custom'); // Default to custom if no characters
        }

      } catch (err) {
        console.error("Error fetching initial data:", err);
      }
    };
    fetchCampaignData();
  }, [campaignId, session]);

  // 2. Fetch Initial Messages & Subscribe to Realtime
  useEffect(() => {
    if (!campaignId) return;

    const fetchMessages = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('messages')
          .select('*')
          .eq('campaign_id', campaignId)
          .order('created_at', { ascending: true });

        if (error) throw error;

        // Map DB snake_case to Client CamelCase
        const mappedMessages: Message[] = (data || []).map((msg: any) => ({
           id: msg.id,
           senderId: msg.user_id,
           senderName: msg.speaker_name,
           content: msg.content,
           timestamp: new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
           createdAt: msg.created_at, // Map for unread logic
           type: msg.type,
           senderType: msg.type === 'narration' ? 'gm' : 'user', // Simplified
           diceResult: msg.dice_result,
           isHidden: msg.is_hidden,
           avatarUrl: msg.avatar_url // if exists
        }));

        setMessages(mappedMessages);
      } catch (err) {
        console.error("Error fetching messages:", err);
        addToast("메시지를 불러오는데 실패했습니다.", "error");
      } finally {
        setIsLoading(false);
      }
    };

    fetchMessages();

    // Subscribe to Messages
    const messageChannel = supabase.channel(`campaign:${campaignId}`)
      .on('postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `campaign_id=eq.${campaignId}` }, 
        (payload) => {
           const msg = payload.new as any;
           const newMsg: Message = {
             id: msg.id,
             senderId: msg.user_id,
             senderName: msg.speaker_name,
             content: msg.content,
             timestamp: new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
             createdAt: msg.created_at, // Map for unread logic
             type: msg.type,
             senderType: msg.type === 'narration' ? 'gm' : 'user',
             diceResult: msg.dice_result,
             isHidden: msg.is_hidden,
             avatarUrl: msg.avatar_url
           };
           setMessages(prev => [...prev, newMsg]);
        }
      )
      .subscribe();

    // Subscribe to Campaign Updates (Scene Sync)
    const campaignChannel = supabase.channel(`campaign_sync:${campaignId}`)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'campaigns', filter: `id=eq.${campaignId}` }, 
        (payload) => {
           const newC = payload.new as any;
           // Update state based on DB changes
           setLocationInfo({
             chapter: newC.current_chapter || '제 1장',
             location: newC.current_location || '알 수 없음',
             time: newC.scenario_time || '시간 미상',
             description: newC.scene_description || '...',
           });
           setIsScenarioVisible(newC.is_scene_visible ?? true);
           // Also update local campaign data if needed (e.g. webhook url changed by another GM)
           setCampaignData(prev => prev ? ({...prev, ...newC}) : newC);
           // [BGM] 실시간 업데이트
           if (newC.bgm_url !== undefined) setBgmUrl(newC.bgm_url);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messageChannel);
      supabase.removeChannel(campaignChannel);
    };
  }, [campaignId]);

  // [추가] BGM URL이 변경되면 자동으로 재생 시도 (브라우저 정책에 따라 실패할 수 있음)
  useEffect(() => {
    if (bgmUrl) {
        setIsPlaying(true);
    }
  }, [bgmUrl]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, activeTab, isLoading]);

  // Effect: Handle Unread Dots (Refined Logic)
  useEffect(() => {
    if (messages.length === 0) return;
    const lastMsg = messages[messages.length - 1];
    if (!lastMsg.createdAt) return;

    const msgTime = new Date(lastMsg.createdAt);

    if (lastMsg.type === 'ooc') {
      if (activeTab !== 'ooc') {
         // Only mark unread if the message is newer than the last time we viewed this tab
         if (msgTime > lastReadOOC) {
             setUnreadOOC(true);
         }
      } else {
         // If we are currently on the tab, update read time so we don't get notifications for these messages later
         if (msgTime > lastReadOOC) setLastReadOOC(new Date());
      }
    } else {
      if (activeTab !== 'story') {
         if (msgTime > lastReadStory) {
             setUnreadStory(true);
         }
      } else {
         if (msgTime > lastReadStory) setLastReadStory(new Date());
      }
    }
  }, [messages, activeTab, lastReadOOC, lastReadStory]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setSpeakerDropdownOpen(false);
      }
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setSettingsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // --- Handlers ---

  const handleBack = () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      onExit();
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || !session?.user || !campaignId) return;

    const isOOC = activeTab === 'ooc';
    let msgType: Message['type'] = isOOC ? 'ooc' : 'talk';
    let finalSenderName = customSpeakerName || userNickname || 'Unknown';
    let finalAvatarUrl: string | null = null;

    let discordUsername = "";

    // Determine Sender Name & Avatar
    if (isOOC) {
      finalSenderName = userNickname || 'User';
      discordUsername = `${userNickname} (OOC)`;
      // Could fetch user avatar here if desired
    } else if (speakerType === 'gm') {
      finalSenderName = 'Narrator';
      msgType = 'narration';
      discordUsername = `Narrator (GM)`;
    } else if (speakerType === 'custom') {
      finalSenderName = customSpeakerName || 'Unknown';
      discordUsername = `${customSpeakerName} (${userNickname})`;
    } else if (speakerType === 'character' && character) {
      finalSenderName = character.name;
      discordUsername = `${character.name} (${userNickname})`;
      finalAvatarUrl = character.avatarUrl || null;
    }

    try {
       await supabase.from('messages').insert({
          campaign_id: campaignId,
          user_id: session.user.id,
          content: inputValue,
          type: msgType,
          speaker_name: finalSenderName,
          avatar_url: finalAvatarUrl
       });
       
       // Send to Discord (Fire & Forget)
       if (campaignData?.discord_webhook_url) {
          sendToDiscord(campaignData.discord_webhook_url, discordUsername, inputValue, finalAvatarUrl || undefined);
       }

       setInputValue("");
    } catch (err) {
       console.error("Failed to send message:", err);
       addToast("메시지 전송 실패", "error");
    }
  };

  const handleStatCheck = async (statName: string, labelKR: string) => {
    if (!character) return;
    let target = 0;

    if (statName === 'SAN') target = character.san.current;
    else if (statName === 'LUCK') target = character.luck.current;
    else {
       const stat = character.stats.find(s => s.label === statName);
       target = stat ? stat.value : 0;
    }

    const diceResult = calculateCoC7eRoll(target, diceModifier);
    const content = `${labelKR} 판정`;

    try {
       await supabase.from('messages').insert({
          campaign_id: campaignId,
          user_id: session?.user?.id,
          content: content,
          type: 'dice',
          speaker_name: character.name,
          avatar_url: character.avatarUrl,
          dice_result: {
            formula: `${labelKR}(${statName}) 1d100 <= ${target}`,
            ...diceResult
          }
       });

       // Send to Discord
       if (campaignData?.discord_webhook_url) {
          const discordContent = `🎲 **[${labelKR} 판정]** 결과: ${getSuccessLevelLabel(diceResult.successLevel || 'Failure')} (${diceResult.total} / ${target})`;
          sendToDiscord(campaignData.discord_webhook_url, `${character.name} (${userNickname})`, discordContent, character.avatarUrl || undefined);
       }

       setDiceModifier(0);
    } catch (err) {
       console.error("Dice roll failed:", err);
       addToast("판정 실패", "error");
    }
  };

  const handleSkillCheck = async (skillName: string, skillValue: number) => {
    if (!character) return;
    const diceResult = calculateCoC7eRoll(skillValue, diceModifier);
    const content = `기능 판정: ${skillName}`;

    try {
        await supabase.from('messages').insert({
          campaign_id: campaignId,
          user_id: session?.user?.id,
          content: content,
          type: 'dice',
          speaker_name: character.name,
          avatar_url: character.avatarUrl,
          dice_result: {
            formula: `${skillName} 1d100 <= ${skillValue}`,
            ...diceResult
          }
       });

       // Send to Discord
       if (campaignData?.discord_webhook_url) {
          const discordContent = `🎲 **[${skillName} 판정]** 결과: ${getSuccessLevelLabel(diceResult.successLevel || 'Failure')} (${diceResult.total} / ${skillValue})`;
          sendToDiscord(campaignData.discord_webhook_url, `${character.name} (${userNickname})`, discordContent, character.avatarUrl || undefined);
       }

       setDiceModifier(0);
    } catch (err) {
       console.error("Skill roll failed:", err);
       addToast("판정 실패", "error");
    }
  };

  const toggleHideMessage = async (id: string) => {
    if (!isGM) return;
    const msg = messages.find(m => m.id === id);
    if (!msg) return;

    setMessages(prev => prev.map(m => 
      m.id === id ? { ...m, isHidden: !m.isHidden } : m
    ));

    const { error } = await supabase
      .from('messages')
      .update({ is_hidden: !msg.isHidden })
      .eq('id', id);

    if (error) {
       setMessages(prev => prev.map(m => 
         m.id === id ? { ...m, isHidden: msg.isHidden } : m
       ));
       addToast("상태 변경 실패", "error");
    }
  };

  const updateLocationInfo = (field: keyof typeof locationInfo, value: string) => {
    // Optimistic UI Update
    setLocationInfo(prev => ({ ...prev, [field]: value }));
    setEditingField(null);

    // Debounce DB Update
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
       try {
          const updates: any = {};
          if (field === 'chapter') updates.current_chapter = value;
          if (field === 'location') updates.current_location = value;
          if (field === 'time') updates.scenario_time = value;
          if (field === 'description') updates.scene_description = value;

          const { error } = await supabase.from('campaigns').update(updates).eq('id', campaignId);
          if (error) throw error;
       } catch (err) {
          console.error("Failed to sync scene:", err);
          addToast("장면 동기화 실패", "error");
       }
    }, 1000); // 1s Debounce
  };

  const toggleScenarioVisibility = async () => {
     const newValue = !isScenarioVisible;
     setIsScenarioVisible(newValue); // Optimistic
     try {
        await supabase.from('campaigns').update({ is_scene_visible: newValue }).eq('id', campaignId);
     } catch (err) {
        console.error("Failed to toggle visibility:", err);
        setIsScenarioVisible(!newValue); // Revert
     }
  };

  const handleDeleteCampaign = async () => {
    if (!isGM) return;
    if (confirm("정말 삭제하시겠습니까? 모든 채팅과 캐릭터 데이터가 사라집니다.\n이 작업은 되돌릴 수 없습니다.")) {
       try {
          const { error } = await supabase.from('campaigns').delete().eq('id', campaignId);
          if (error) throw error;
          addToast("캠페인이 삭제되었습니다.", "success");
          onExit();
       } catch (err: any) {
          addToast(err.message || "삭제 실패", "error");
       }
    }
  };

  const visibleMessages = messages.filter(m => {
    if (activeTab === 'story') return ['talk', 'narration', 'dice'].includes(m.type);
    if (activeTab === 'ooc') return m.type === 'ooc';
    return false;
  });

  const showContent = isGM || isScenarioVisible;

  const STAT_BUTTONS = [
    { code: 'STR', label: '근력' }, { code: 'CON', label: '건강' },
    { code: 'SIZ', label: '크기' }, { code: 'DEX', label: '민첩' },
    { code: 'APP', label: '외모' }, { code: 'INT', label: '지능' },
    { code: 'POW', label: '정신' }, { code: 'EDU', label: '교육' },
    { code: 'SAN', label: '이성', isSpecial: true }, { code: 'LUCK', label: '행운', isSpecial: true },
  ];

  const getSpeakerLabel = () => {
    if (speakerType === 'user') return 'User (OOC)';
    if (speakerType === 'gm') return 'Narrator (GM)';
    if (speakerType === 'custom') return '직접 입력';
    return character ? character.name : '캐릭터 없음';
  };

  const getCombinedSkillList = () => {
     if (!character) return [];
     const charSkillKeys = Object.keys(character.skills);
     const customSkills = charSkillKeys.filter(k => !FULL_COC_SKILL_LIST.includes(k));
     return [...FULL_COC_SKILL_LIST, ...customSkills];
  };

  return (
    <div className="flex flex-col h-[100dvh] w-screen overflow-hidden bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-slate-100 font-sans">
      
      <ToastContainer toasts={toasts} removeToast={(id) => setToasts(prev => prev.filter(t => t.id !== id))} />

      {character && (
        <CharacterModal 
          character={character} 
          isOpen={showCharModal} 
          onClose={() => setShowCharModal(false)}
          onUpdate={handleCharacterSave}
        />
      )}

      <ExportModal 
        isOpen={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        messages={messages}
        locationInfo={locationInfo}
        addToast={addToast}
      />

      {campaignData && (
        <EditCampaignModal
            isOpen={editCampaignOpen}
            onClose={() => setEditCampaignOpen(false)}
            campaignId={campaignId}
            initialData={{
               title: campaignData.title,
               description: campaignData.description,
               cover_image: campaignData.cover_image,
               max_players: campaignData.max_players,
               discord_webhook_url: campaignData.discord_webhook_url
            }}
            onUpdate={(updated) => {
                setCampaignTitle(updated.title);
                setCampaignData({...campaignData, ...updated});
            }}
            addToast={addToast}
        />
      )}

      {/* Global Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 h-14 bg-white dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 z-50">
          <button 
             onClick={handleBack} 
             className="flex items-center gap-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors text-sm font-medium z-50 cursor-pointer py-2 px-1"
          >
             <ChevronLeft size={20} /> Dashboard
          </button>
          <div className="flex flex-col items-center">
             <h1 className="font-bold text-slate-900 dark:text-white text-sm md:text-base leading-tight">{campaignTitle}</h1>
          </div>
          <div className="flex items-center gap-3">
             <div className="relative" ref={settingsRef}>
                <button 
                  onClick={() => setSettingsOpen(!settingsOpen)}
                  className="w-8 h-8 rounded-full bg-slate-50 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 flex items-center justify-center text-slate-500 dark:text-slate-400 transition-colors"
                >
                  <Settings size={16} />
                </button>
                {settingsOpen && (
                  <div className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-zinc-800 rounded-lg shadow-xl border border-slate-200 dark:border-zinc-700 overflow-hidden z-50">
                     <button 
                       className="w-full text-left px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-zinc-700 text-sm flex items-center gap-2 text-slate-700 dark:text-slate-200"
                       onClick={copyInviteCode}
                     >
                        <Copy size={14} /> 초대 코드 복사
                     </button>
                     <button 
                       className="w-full text-left px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-zinc-700 text-sm flex items-center gap-2 text-slate-700 dark:text-slate-200"
                       onClick={() => {
                          setSettingsOpen(false);
                          setExportModalOpen(true);
                       }}
                     >
                        <Download size={14} /> 로그 내보내기 (Export)
                     </button>
                     
                     {isGM && (
                        <>
                           <div className="border-t border-slate-100 dark:border-zinc-700 my-1"></div>
                           <button 
                              className="w-full text-left px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-zinc-700 text-sm flex items-center gap-2 text-slate-700 dark:text-slate-200"
                              onClick={() => {
                                 setSettingsOpen(false);
                                 setEditCampaignOpen(true);
                              }}
                           >
                              <Edit2 size={14} /> 캠페인 설정 수정
                           </button>
                           <button 
                              className="w-full text-left px-4 py-2.5 hover:bg-rose-50 dark:hover:bg-rose-900/20 text-sm flex items-center gap-2 text-rose-600 dark:text-rose-400"
                              onClick={() => {
                                 setSettingsOpen(false);
                                 handleDeleteCampaign();
                              }}
                           >
                              <Trash2 size={14} /> 캠페인 삭제
                           </button>
                        </>
                     )}
                  </div>
                )}
             </div>

             <button 
                onClick={onOpenSettings}
                className="w-8 h-8 rounded-full bg-slate-200 dark:bg-zinc-700 flex items-center justify-center text-slate-500 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-zinc-600 transition-colors"
             >
                <User size={16} />
             </button>
             <button onClick={() => setMobileMenuOpen(true)} className="md:hidden p-1 text-slate-500">
               <Menu size={20} />
             </button>
          </div>
      </div>

      <div className="flex-1 flex flex-row overflow-hidden relative">
      
        {/* 1. LEFT SIDEBAR */}
        <aside 
          className={`
            w-80 flex-shrink-0 flex flex-col border-r border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 z-30
            absolute inset-y-0 left-0 md:relative md:translate-x-0 transition-transform duration-300
            ${mobileMenuOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}
          `}
        >
          <div className="h-12 flex-shrink-0 flex items-center justify-between px-4 border-b border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950/50">
            {isGM ? (
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 dark:text-white text-xs uppercase tracking-wider">GM Controls</span>
                <button 
                  onClick={toggleScenarioVisibility}
                  className={`text-xs p-1.5 rounded hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors ${!isScenarioVisible ? 'text-slate-400' : 'text-brand-600'}`}
                  title={isScenarioVisible ? "Players can see this" : "Hidden from players"}
                >
                  {isScenarioVisible ? <Eye size={16}/> : <EyeOff size={16}/>}
                </button>
              </div>
            ) : (
              <span className="font-bold text-slate-900 dark:text-white text-xs uppercase tracking-wider">Campaign Info</span>
            )}
            <button onClick={() => setMobileMenuOpen(false)} className="md:hidden"><X size={20} /></button>
          </div>

          <div className="flex-1 overflow-y-auto relative">
            {showContent ? (
              <div className="p-5 space-y-6 animate-fadeIn">
                
                {/* BGM Control Section (Revised) */}
                <div className="p-4 bg-slate-100 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 shadow-sm transition-all hover:shadow-md">
                   
                   {/* 상단: 상태 표시 및 URL 입력 */}
                   <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2 overflow-hidden">
                         <div className={`p-1.5 rounded-full ${isPlaying ? 'bg-brand-100 text-brand-600 animate-pulse' : 'bg-slate-200 text-slate-400'}`}>
                            <Music size={14} />
                         </div>
                         <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Background Music</p>
                            {/* GM: URL 입력 / Player: 상태 텍스트 */}
                            {isGM && editingField === 'bgm' ? (
                               <input 
                                  autoFocus
                                  className="w-full bg-white dark:bg-zinc-900 border border-brand-500 rounded px-1.5 py-0.5 text-xs text-slate-700 dark:text-slate-300 outline-none"
                                  placeholder="YouTube / MP3 URL..."
                                  defaultValue={bgmUrl || ''}
                                  onBlur={(e) => updateBgmUrl(e.target.value)}
                                  onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                               />
                            ) : (
                               <div className="flex items-center gap-1 group cursor-pointer" onClick={() => isGM && setEditingField('bgm')}>
                                  <p className={`text-xs font-medium truncate max-w-[140px] ${isPlaying ? 'text-brand-600 dark:text-brand-400' : 'text-slate-500'}`}>
                                     {bgmUrl ? (isPlaying ? 'Now Playing ♪' : 'Paused') : 'No Music Selected'}
                                  </p>
                                  {isGM && <Edit2 size={10} className="opacity-0 group-hover:opacity-100 text-slate-400" />}
                               </div>
                            )}
                         </div>
                      </div>
                   </div>

                   {/* 하단: 컨트롤러 (재생/정지 + 볼륨) */}
                   <div className="flex items-center gap-2 bg-white dark:bg-zinc-900/50 p-2 rounded-lg border border-slate-100 dark:border-zinc-700/50">
                      
                      {/* 1. 재생/일시정지 버튼 */}
                      <button 
                        onClick={() => setIsPlaying(!isPlaying)}
                        disabled={!bgmUrl}
                        className={`p-2 rounded-full transition-all ${
                           !bgmUrl ? 'text-slate-300 cursor-not-allowed' : 
                           isPlaying 
                             ? 'bg-brand-50 text-brand-600 hover:bg-brand-100' 
                             : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-zinc-800 dark:text-slate-300'
                        }`}
                        title={isPlaying ? "일시정지" : "재생"}
                      >
                         {isPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" className="ml-0.5" />}
                      </button>

                      {/* 구분선 */}
                      <div className="w-px h-6 bg-slate-200 dark:bg-zinc-700 mx-1"></div>

                      {/* 2. 볼륨 아이콘 */}
                      <button 
                        onClick={() => setIsMuted(!isMuted)} 
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1"
                      >
                         {isMuted || volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
                      </button>

                      {/* 3. 볼륨 슬라이더 */}
                      <input 
                        type="range" 
                        min="0" max="1" step="0.05" 
                        value={isMuted ? 0 : volume}
                        onChange={(e) => { setVolume(parseFloat(e.target.value)); setIsMuted(false); }}
                        className="flex-1 h-1.5 bg-slate-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-brand-600 hover:accent-brand-500"
                      />
                   </div>

                   {/* 숨겨진 플레이어 (유튜브 정책 준수를 위해 크기 0으로 설정하되 display:none은 지양) */}
                   <div className="fixed top-0 left-0 w-px h-px opacity-0 pointer-events-none overflow-hidden">
                      <ReactPlayer 
                         url={bgmUrl || undefined}
                         playing={isPlaying}
                         loop={true}
                         volume={isMuted ? 0 : volume}
                         width="100%"
                         height="100%"
                         playsinline={true} // 모바일 재생 지원
                         config={{ 
                            youtube: { playerVars: { playsinline: 1, showinfo: 0, controls: 0, disablekb: 1 } },
                            file: { forceAudio: true } 
                         }}
                         onError={(e) => {
                            console.error("Playback Error:", e);
                            setIsPlaying(false); // 에러 시 정지 상태로 변경
                            addToast("재생할 수 없는 소스입니다.", "error");
                         }}
                      />
                   </div>
                </div>

                <div className="space-y-4">
                  <div className="group relative">
                    <h2 className="text-xs uppercase tracking-wider font-bold text-brand-600 dark:text-brand-400 mb-1">Current Chapter</h2>
                    {isGM && editingField === 'chapter' ? (
                      <input 
                        autoFocus
                        className="w-full bg-slate-100 dark:bg-zinc-800 p-1 rounded font-serif text-lg font-medium"
                        defaultValue={locationInfo.chapter}
                        onBlur={(e) => updateLocationInfo('chapter', e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                      />
                    ) : (
                      <div className="flex items-center gap-2">
                        <p className="font-serif text-xl font-medium leading-tight text-slate-900 dark:text-white">{locationInfo.chapter}</p>
                        {isGM && <Edit2 size={12} className="opacity-0 group-hover:opacity-100 cursor-pointer text-slate-400" onClick={() => setEditingField('chapter')} />}
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                      <div className="group relative">
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-slate-400" />
                          <span className="text-xs font-semibold text-slate-500">Location</span>
                          {isGM && editingField !== 'location' && <Edit2 size={10} className="opacity-0 group-hover:opacity-100 cursor-pointer text-slate-400" onClick={() => setEditingField('location')} />}
                        </div>
                        {isGM && editingField === 'location' ? (
                          <input 
                              autoFocus
                              className="w-full mt-1 bg-slate-100 dark:bg-zinc-800 p-1 rounded text-sm"
                              defaultValue={locationInfo.location}
                              onBlur={(e) => updateLocationInfo('location', e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                          />
                        ) : (
                          <p className="text-sm text-slate-700 dark:text-slate-300 mt-0.5">{locationInfo.location}</p>
                        )}
                      </div>

                      <div className="group relative">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-slate-400" />
                          <span className="text-xs font-semibold text-slate-500">Time</span>
                          {isGM && editingField !== 'time' && <Edit2 size={10} className="opacity-0 group-hover:opacity-100 cursor-pointer text-slate-400" onClick={() => setEditingField('time')} />}
                        </div>
                        {isGM && editingField === 'time' ? (
                          <input 
                              autoFocus
                              className="w-full mt-1 bg-slate-100 dark:bg-zinc-800 p-1 rounded text-sm"
                              defaultValue={locationInfo.time}
                              onBlur={(e) => updateLocationInfo('time', e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                          />
                        ) : (
                          <p className="text-sm text-slate-700 dark:text-slate-300 mt-0.5">{locationInfo.time}</p>
                        )}
                      </div>
                  </div>
                </div>

                <div className="relative group">
                  <p className="text-xs font-medium text-slate-400 mb-2 uppercase">Scene Description</p>
                  {isGM && editingField === 'description' ? (
                    <textarea 
                        autoFocus
                        className="w-full h-48 bg-white dark:bg-zinc-900 p-2 rounded text-sm leading-relaxed border border-brand-500 focus:outline-none"
                        defaultValue={locationInfo.description}
                        onBlur={(e) => updateLocationInfo('description', e.target.value)}
                    />
                  ) : (
                    <>
                      <p className="text-sm italic text-slate-600 dark:text-slate-300 leading-relaxed font-serif whitespace-pre-wrap">
                        "{locationInfo.description}"
                      </p>
                      {isGM && <button onClick={() => setEditingField('description')} className="absolute top-0 right-0 p-1 text-slate-400 hover:text-brand-600 opacity-0 group-hover:opacity-100 transition-opacity"><Edit2 size={12} /></button>}
                    </>
                  )}
                </div>
              </div>
            ) : (
              <LockedScenarioView />
            )}
          </div>
        </aside>

        {/* 2. CENTER CHAT AREA */}
        <main className="flex-1 min-w-0 flex flex-col relative bg-white dark:bg-zinc-950">
          <header className="h-12 flex-shrink-0 flex items-end px-4 border-b border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950">
            <button 
              onClick={() => {
                setActiveTab('story');
                setUnreadStory(false);
                setLastReadStory(new Date());
              }}
              className={`px-6 py-2.5 text-sm font-medium relative transition-colors ${activeTab === 'story' ? 'text-slate-900 dark:text-white border-b-2 border-brand-600 dark:border-brand-400' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
            >
              Main Story
              {unreadStory && <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full"></span>}
            </button>
            <button 
              onClick={() => {
                setActiveTab('ooc');
                setUnreadOOC(false);
                setLastReadOOC(new Date());
              }}
              className={`px-6 py-2.5 text-sm font-medium relative transition-colors ${activeTab === 'ooc' ? 'text-slate-900 dark:text-white border-b-2 border-brand-600 dark:border-brand-400' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
            >
              💬 사담
              {unreadOOC && <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full"></span>}
            </button>
            <div className="ml-auto flex items-center mb-2 lg:hidden">
              <button onClick={() => setRightSidebarOpen(!rightSidebarOpen)} className={`p-1.5 rounded-lg transition-colors ${rightSidebarOpen ? 'bg-brand-50 text-brand-600' : 'text-slate-500'}`}>
                  <Shield size={18} />
              </button>
            </div>
          </header>

          <div className={`flex-1 overflow-y-auto p-4 md:p-6 space-y-6 ${activeTab === 'ooc' ? 'bg-slate-50/50 dark:bg-zinc-900/50' : 'bg-white dark:bg-zinc-950'}`}>
            {isLoading ? (
              <SkeletonLoader />
            ) : (
              visibleMessages.map((msg) => (
                <div key={msg.id} className={`flex gap-4 group ${msg.type === 'narration' ? 'justify-center my-6' : ''}`}>
                  {msg.type === 'narration' && (
                    <div className="max-w-2xl w-full text-center px-4 relative">
                        {isGM && (
                           <button 
                             onClick={() => toggleHideMessage(msg.id)}
                             className="absolute -right-8 top-0 p-1 text-slate-400 hover:text-brand-600 opacity-0 group-hover:opacity-100 transition-opacity"
                             title={msg.isHidden ? "Reveal Message" : "Hide Message"}
                           >
                              {msg.isHidden ? <Eye size={14} /> : <EyeOff size={14} />}
                           </button>
                        )}
                        <div className={`text-lg font-serif italic text-slate-800 dark:text-slate-300 leading-loose opacity-90 ${msg.isHidden ? 'blur-[2px] select-none text-slate-400' : ''}`}>
                          {msg.isHidden ? "관리자에 의해 가려진 메시지입니다." : <RichMessage content={msg.content} />}
                        </div>
                    </div>
                  )}
                  {(msg.type === 'talk' || msg.type === 'dice') && (
                    <>
                      <div className="flex-shrink-0 mt-1 w-10">
                        {msg.avatarUrl ? (
                          <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-200 ring-2 ring-transparent group-hover:ring-slate-100 dark:group-hover:ring-zinc-800 transition-all">
                              <img src={msg.avatarUrl} alt={msg.senderName} className="w-full h-full object-cover" />
                          </div>
                        ) : (
                          // 투명한 스페이서 (이미지 없을 때)
                          <div className="w-10 h-10 rounded-full flex-shrink-0" /> 
                        )}
                      </div>
                      <div className="flex-1 max-w-3xl min-w-0">
                        <div className="flex items-baseline gap-2">
                            <span className={`font-bold text-sm text-slate-900 dark:text-slate-100`}>
                                {msg.senderName}
                            </span>
                            <span className="text-[10px] text-slate-400">{msg.timestamp}</span>
                            {isGM && (
                               <button 
                                  onClick={() => toggleHideMessage(msg.id)}
                                  className="ml-2 p-0.5 text-slate-300 hover:text-brand-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                  title={msg.isHidden ? "Reveal" : "Hide"}
                               >
                                  {msg.isHidden ? <Eye size={12} /> : <EyeOff size={12} />}
                               </button>
                            )}
                        </div>
                        
                        {msg.isHidden ? (
                           <div className="text-slate-400 italic text-sm mt-1">
                              관리자에 의해 가려진 메시지입니다.
                           </div>
                        ) : (
                           <>
                              {msg.type === 'talk' && (
                                  <div className="text-slate-700 dark:text-slate-300 leading-relaxed mt-0.5 break-words">
                                      <RichMessage content={msg.content} />
                                  </div>
                              )}
                              {msg.type === 'dice' && msg.diceResult && (
                                  <div>
                                      <DiceResultCard result={msg.diceResult} />
                                  </div>
                              )}
                           </>
                        )}
                      </div>
                    </>
                  )}
                  {msg.type === 'ooc' && (
                      <>
                        <div className="flex-shrink-0 mt-1">
                            <div className="w-8 h-8 rounded-full overflow-hidden bg-indigo-100 dark:bg-indigo-900/30 ring-2 ring-indigo-50 dark:ring-indigo-900/50 flex items-center justify-center">
                              {msg.avatarUrl ? (
                                <img src={msg.avatarUrl} alt={msg.senderName} className="w-full h-full object-cover opacity-80" />
                              ) : (
                                <span className="text-xs font-bold text-indigo-500">{msg.senderName?.slice(0,1)}</span>
                              )}
                            </div>
                        </div>
                        <div className="flex-1 max-w-3xl min-w-0">
                            <div className="flex items-baseline gap-2">
                              <span className="font-medium text-xs text-indigo-600 dark:text-indigo-400">
                                  {msg.senderName} (User)
                              </span>
                              <span className="text-[10px] text-slate-400">{msg.timestamp}</span>
                            </div>
                            <div className="bg-white dark:bg-zinc-800 p-2.5 rounded-tr-xl rounded-b-xl rounded-tl-sm border border-slate-100 dark:border-zinc-700/50 mt-1 shadow-sm inline-block">
                              <div className="text-slate-600 dark:text-slate-400 text-sm break-words">
                                  <RichMessage content={msg.content} />
                              </div>
                            </div>
                        </div>
                      </>
                  )}
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="flex-shrink-0 p-4 bg-white dark:bg-zinc-900 border-t border-slate-200 dark:border-zinc-800 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <form onSubmit={handleSendMessage} className="max-w-5xl mx-auto flex flex-col gap-2">
                <div className="flex items-center gap-2 relative">
                  <div className="relative flex items-center gap-2" ref={dropdownRef}>
                      <button 
                        type="button" 
                        onClick={() => activeTab === 'story' && setSpeakerDropdownOpen(!speakerDropdownOpen)}
                        disabled={activeTab === 'ooc'}
                        className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors border border-transparent 
                          ${activeTab === 'ooc' 
                              ? 'bg-slate-100 dark:bg-zinc-800 text-slate-500 cursor-not-allowed' 
                              : 'bg-slate-100 dark:bg-zinc-900 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-zinc-700 focus:ring-2 focus:ring-brand-600/20 cursor-pointer'
                          }`}
                      >
                          <span className={speakerType === 'gm' ? 'text-brand-600 dark:text-brand-400' : ''}>
                            {activeTab === 'ooc' ? 'User (OOC)' : getSpeakerLabel()}
                          </span>
                          {activeTab === 'story' && <ChevronDown size={12} />}
                      </button>

                      {speakerType === 'custom' && activeTab === 'story' && (
                         <div className="flex items-center animate-fadeIn">
                            <PenTool size={14} className="text-slate-400 mr-2" />
                            <input 
                               type="text"
                               placeholder="이름 입력"
                               value={customSpeakerName}
                               onChange={(e) => setCustomSpeakerName(e.target.value)}
                               className="px-2 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 focus:ring-1 focus:ring-brand-500 outline-none w-32"
                               autoFocus
                            />
                         </div>
                      )}

                      {speakerDropdownOpen && activeTab === 'story' && (
                          <div className="absolute bottom-full left-0 mb-2 w-48 bg-white dark:bg-zinc-800 rounded-lg shadow-xl border border-slate-200 dark:border-zinc-700 z-50 overflow-hidden">
                              <div className="py-1">
                                  {/* Character selection */}
                                  {myCharacters.map((c) => (
                                     <button 
                                        key={c.id}
                                        type="button"
                                        onClick={() => { 
                                           setSpeakerType('character'); 
                                           setSelectedCharId(c.id);
                                           setSpeakerDropdownOpen(false); 
                                        }}
                                        className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-zinc-700 text-sm flex flex-col"
                                     >
                                        <span className="font-semibold text-slate-800 dark:text-slate-200">{c.name}</span>
                                        <span className="text-[10px] text-slate-400">{c.class}</span>
                                     </button>
                                  ))}
                                  
                                  {isGM && (
                                    <button 
                                        type="button"
                                        onClick={() => { setSpeakerType('gm'); setSpeakerDropdownOpen(false); }}
                                        className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-zinc-700 text-sm flex items-center gap-2 text-brand-600 dark:text-brand-400 font-medium"
                                    >
                                        Narrator (GM)
                                    </button>
                                  )}

                                  <div className="border-t border-slate-100 dark:border-zinc-700/50 my-1"></div>
                                  
                                  <button 
                                      type="button"
                                      onClick={() => { setSpeakerType('custom'); setSpeakerDropdownOpen(false); }}
                                      className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-zinc-700 text-sm flex items-center gap-2 text-slate-600 dark:text-slate-300"
                                  >
                                      직접 입력 (Custom)
                                  </button>
                              </div>
                          </div>
                      )}
                  </div>
                </div>

                <div className={`relative flex items-end gap-2 border rounded-xl p-2 transition-all shadow-sm ${activeTab === 'ooc' ? 'bg-indigo-50/30 dark:bg-indigo-900/10 border-indigo-200 dark:border-indigo-900/30 focus-within:border-indigo-500' : 'bg-slate-50 dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 focus-within:border-brand-600'}`}>
                  <textarea
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              handleSendMessage(e);
                          }
                      }}
                      placeholder={activeTab === 'ooc' ? "사담을 입력하세요..." : (speakerType === 'gm' ? "상황을 묘사하세요..." : (speakerType === 'custom' ? `${customSpeakerName || '누군가'}(으)로 말하기...` : `${character ? character.name : '캐릭터'}(으)로 대화하기...`))}
                      className="w-full bg-transparent border-none focus:ring-0 resize-none min-h-[44px] max-h-32 py-2.5 px-2 text-sm text-slate-900 dark:text-white placeholder-slate-400"
                      rows={1}
                  />
                  <div className="flex flex-col items-center gap-1 mb-1">
                      <div className="relative">
                          <button
                            type="button"
                            onClick={() => setShowSyntaxHelp(!showSyntaxHelp)}
                            className="p-1.5 text-slate-400 hover:text-brand-600 transition-colors"
                          >
                            <HelpCircle size={16} />
                          </button>
                          {showSyntaxHelp && <SyntaxHelp />}
                      </div>

                      <button 
                          type="submit" 
                          className={`p-2 rounded-lg transition-colors ${inputValue.trim() ? 'bg-brand-600 text-white hover:bg-brand-700' : 'bg-slate-200 dark:bg-zinc-800 text-slate-400 cursor-not-allowed'}`}
                          disabled={!inputValue.trim()}
                      >
                          <Send size={18} />
                      </button>
                  </div>
                </div>
            </form>
          </div>
        </main>

        {/* 3. RIGHT SIDEBAR */}
        <aside 
          className={`
            w-80 flex-shrink-0 flex flex-col border-l border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900
            ${rightSidebarOpen ? 'hidden lg:flex' : 'hidden'}
          `}
        >
          {isLoading ? <RightSidebarSkeleton /> : (
            <>
              {character ? (
                  <>
                  {/* Character Header */}
                  <div className="p-5 border-b border-slate-200 dark:border-zinc-800">
                      <div className="flex items-center gap-3 mb-4">
                        <div 
                            className="w-12 h-12 rounded-full bg-slate-200 overflow-hidden border-2 border-brand-100 dark:border-brand-900 cursor-pointer hover:border-brand-400 transition-colors flex-shrink-0"
                            onClick={() => onEditCharacter(character)}
                        >
                            {character.avatarUrl ? (
                                <img src={character.avatarUrl} alt="Character" className="w-full h-full object-cover"/>
                            ) : (
                                <div className="w-full h-full flex items-center justify-center bg-slate-100 dark:bg-zinc-800 text-slate-400">
                                    <User size={20}/>
                                </div>
                            )}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="relative group">
                              <select 
                                value={selectedCharId || ''}
                                onChange={(e) => setSelectedCharId(e.target.value)}
                                className="w-full bg-transparent font-bold text-slate-900 dark:text-white truncate pr-6 cursor-pointer appearance-none outline-none focus:ring-0 py-1"
                              >
                                {myCharacters.map(c => (
                                    <option key={c.id} value={c.id} className="text-slate-900 dark:text-slate-100 bg-white dark:bg-zinc-900">{c.name}</option>
                                ))}
                              </select>
                              <ChevronDown size={14} className="absolute right-0 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                          </div>
                          <p className="text-xs text-slate-500 truncate cursor-pointer hover:underline" onClick={() => onEditCharacter(character)}>
                              {character.class} {character.age && `(Age: ${character.age})`}
                          </p>
                        </div>
                        
                        <button 
                          onClick={onCreateCharacter} 
                          className="p-2 rounded-lg text-slate-400 hover:text-brand-600 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
                          title="Create New Character"
                        >
                            <Plus size={18} />
                        </button>
                      </div>
                      
                      {/* Vitals */}
                      <div className="space-y-3 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => setShowCharModal(true)}>
                        <div className="space-y-1">
                            <div className="flex justify-between text-[10px] font-bold uppercase text-slate-500">
                                <span className="flex items-center gap-1"><Heart size={10} className="text-red-500 fill-current"/> HP</span>
                                <span>{character.hp.current} / {character.hp.max}</span>
                            </div>
                            <div className="h-1.5 w-full bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                                <div className="h-full bg-red-500 rounded-full" style={{ width: `${(character.hp.current / character.hp.max) * 100}%`}}></div>
                            </div>
                        </div>
                        <div className="space-y-1">
                            <div className="flex justify-between text-[10px] font-bold uppercase text-slate-500">
                                <span className="flex items-center gap-1"><Brain size={10} className="text-brand-500 fill-current"/> SAN</span>
                                <span>{character.san.current} / {character.san.max}</span>
                            </div>
                            <div className="h-1.5 w-full bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                                <div className="h-full bg-brand-500 rounded-full" style={{ width: `${(character.san.current / character.san.max) * 100}%`}}></div>
                            </div>
                        </div>
                    </div>
                  </div>

                  {/* Tabs */}
                  <div className="flex border-b border-slate-200 dark:border-zinc-800">
                      <button 
                        onClick={() => setRightTab('stats')}
                        className={`flex-1 py-3 text-sm font-medium text-center transition-colors ${rightTab === 'stats' ? 'text-brand-600 dark:text-brand-400 border-b-2 border-brand-600 dark:border-brand-400' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                      >
                        특성치 (Stats)
                      </button>
                      <button 
                        onClick={() => setRightTab('skills')}
                        className={`flex-1 py-3 text-sm font-medium text-center transition-colors ${rightTab === 'skills' ? 'text-brand-600 dark:text-brand-400 border-b-2 border-brand-600 dark:border-brand-400' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                      >
                        기능 (Skills)
                      </button>
                  </div>

                  {/* Dice Modifier Control */}
                  <div className="p-3 bg-slate-50/50 dark:bg-zinc-950/30 border-b border-slate-200 dark:border-zinc-800">
                    <div className="flex rounded-lg overflow-hidden border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
                      <button onClick={() => setDiceModifier(2)} className={`flex-1 py-1 text-[10px] font-bold border-r border-slate-200 dark:border-zinc-700 transition-colors ${diceModifier === 2 ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-zinc-800'}`}>B2</button>
                      <button onClick={() => setDiceModifier(1)} className={`flex-1 py-1 text-[10px] font-bold border-r border-slate-200 dark:border-zinc-700 transition-colors ${diceModifier === 1 ? 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-500' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-zinc-800'}`}>B1</button>
                      <button onClick={() => setDiceModifier(0)} className={`flex-1 py-1 text-[10px] font-bold border-r border-slate-200 dark:border-zinc-700 transition-colors ${diceModifier === 0 ? 'bg-slate-100 text-slate-900 dark:bg-zinc-700 dark:text-white' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-zinc-800'}`}>Normal</button>
                      <button onClick={() => setDiceModifier(-1)} className={`flex-1 py-1 text-[10px] font-bold border-r border-slate-200 dark:border-zinc-700 transition-colors ${diceModifier === -1 ? 'bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-500' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-zinc-800'}`}>P1</button>
                      <button onClick={() => setDiceModifier(-2)} className={`flex-1 py-1 text-[10px] font-bold transition-colors ${diceModifier === -2 ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-zinc-800'}`}>P2</button>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 overflow-y-auto p-4 bg-slate-50/50 dark:bg-zinc-950/30">
                      {rightTab === 'stats' && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-2 gap-3">
                                {STAT_BUTTONS.map((stat) => {
                                  let val = 0;
                                  if (stat.isSpecial) {
                                    val = stat.code === 'SAN' ? character.san.current : character.luck.current;
                                  } else {
                                    const found = character.stats.find(s => s.label === stat.code);
                                    val = found ? found.value : 0;
                                  }

                                  return (
                                    <button 
                                        key={stat.code}
                                        onClick={() => handleStatCheck(stat.code, stat.label)}
                                        className={`flex flex-col items-center justify-center p-3 rounded-xl border hover:shadow-sm transition-all active:scale-95 bg-white dark:bg-zinc-800 dark:border-zinc-700 ${stat.isSpecial ? 'border-brand-100 dark:border-brand-900/30 hover:border-brand-300' : 'border-slate-200 hover:border-brand-300'}`}
                                    >
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{stat.code}</span>
                                        <div className="flex items-baseline gap-1">
                                          <span className={`text-lg font-bold ${stat.isSpecial ? 'text-brand-600 dark:text-brand-400' : 'text-slate-700 dark:text-slate-200'}`}>{stat.label}</span>
                                          <span className="text-xs font-mono text-slate-400 bg-slate-100 dark:bg-zinc-900 px-1.5 rounded">{val}</span>
                                        </div>
                                    </button>
                                  )
                                })}
                            </div>
                        </div>
                      )}
                      {rightTab === 'skills' && (
                        <div className="space-y-2">
                            {getCombinedSkillList().map((name) => {
                              const value = character.skills[name] || getBaseSkillValue(name); 
                              return (
                                <button 
                                    key={name}
                                    onClick={() => handleSkillCheck(name, value)}
                                    className="w-full flex items-center justify-between p-3 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl hover:border-brand-300 hover:shadow-sm transition-all group active:scale-[0.98]"
                                >
                                    <span className="font-medium text-slate-700 dark:text-slate-200 group-hover:text-brand-400">{name}</span>
                                    <span className="font-mono font-bold text-slate-500 bg-slate-100 dark:bg-zinc-900 px-2 py-0.5 rounded text-xs">{value}</span>
                                </button>
                              );
                            })}
                        </div>
                      )}
                  </div>
                  </>
              ) : (
                  <div className="flex flex-col items-center justify-center h-full p-6 text-center text-slate-500 dark:text-slate-400">
                      <User size={48} className="mb-4 text-slate-300 dark:text-zinc-700" />
                      <h3 className="font-bold text-lg mb-2">캐릭터 없음</h3>
                      <p className="text-sm mb-6">이 캠페인에서 사용할 캐릭터가 없습니다. 새 캐릭터를 생성해주세요.</p>
                      <button 
                          onClick={onCreateCharacter}
                          className="px-6 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg font-medium shadow-sm"
                      >
                          캐릭터 생성하기
                      </button>
                  </div>
              )}
            </>
          )}
        </aside>
      </div>
      
      {/* Mobile Overlay */}
      {mobileMenuOpen && (
        <div 
            className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
        ></div>
      )}
    </div>
  );
};

export default Playroom;