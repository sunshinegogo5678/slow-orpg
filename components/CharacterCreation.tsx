import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Save, User, Activity, BookOpen, FileText, Image as ImageIcon, Link as LinkIcon } from 'lucide-react';
import { Character } from '../types';
import { FULL_COC_SKILL_LIST } from '../constants';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface CharacterCreationProps {
  campaignId: string;
  initialData: Character | null; // null for creation, populated for edit
  onCancel: () => void;
  onSubmit: (characterData: any) => void;
}

// Helper to get base values (Simplified for demo)
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

const CharacterCreation: React.FC<CharacterCreationProps> = ({ campaignId, initialData, onCancel, onSubmit }) => {
  const { session } = useAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const isEditMode = !!initialData;
  
  // Extra state for custom skills
  const [customSkill1, setCustomSkill1] = useState({ name: '', value: 0 });
  const [customSkill2, setCustomSkill2] = useState({ name: '', value: 0 });

  // Transform initialData to form format if editing
  const getInitialState = () => {
    if (initialData) {
      // Map array stats back to object for the form
      const statsObj: any = {};
      initialData.stats.forEach(s => statsObj[s.label] = s.value);

      return {
        name: initialData.name,
        occupation: initialData.class,
        age: initialData.age, // Should be string now based on types update
        avatarUrl: initialData.avatarUrl || '',
        stats: {
          STR: statsObj.STR || 50, CON: statsObj.CON || 50, SIZ: statsObj.SIZ || 50, DEX: statsObj.DEX || 50,
          APP: statsObj.APP || 50, EDU: statsObj.EDU || 50, INT: statsObj.INT || 50, POW: statsObj.POW || 50
        },
        derived: {
          hp_max: initialData.hp.max,
          mp_max: initialData.mp.max,
          san_start: initialData.san.max, // Using max as start for simplicity
          mov: 8 // Simplified, usually recalculated
        },
        skills: initialData.skills,
        traits: '', 
        backstory: initialData.notes
      };
    }

    return {
      name: '',
      occupation: '',
      age: '', // Default empty string
      avatarUrl: '',
      stats: {
        STR: 50, CON: 50, SIZ: 50, DEX: 50,
        APP: 50, EDU: 50, INT: 50, POW: 50
      },
      derived: {
        hp_max: 0,
        mp_max: 0,
        san_start: 0,
        mov: 8
      },
      skills: {} as Record<string, number>,
      traits: '',
      backstory: ''
    };
  };

  const [formData, setFormData] = useState(getInitialState);

  // Initialize custom skills from existing data if editing
  useEffect(() => {
    if (initialData) {
       const existingSkills = Object.keys(initialData.skills);
       const customKeys = existingSkills.filter(k => !FULL_COC_SKILL_LIST.includes(k));
       if (customKeys[0]) setCustomSkill1({ name: customKeys[0], value: initialData.skills[customKeys[0]] });
       if (customKeys[1]) setCustomSkill2({ name: customKeys[1], value: initialData.skills[customKeys[1]] });
    }
  }, [initialData]);

  // Effect: Auto-calculate Derived Stats & Update Dodge Base
  useEffect(() => {
    const { STR, CON, SIZ, DEX, POW } = formData.stats;

    const hp = Math.floor((CON + SIZ) / 10);
    const mp = Math.floor(POW / 5);
    const san = POW;
    
    let mov = 8;
    if (DEX < SIZ && STR < SIZ) mov = 7;
    else if (DEX > SIZ && STR > SIZ) mov = 9;
    
    setFormData(prev => ({
      ...prev,
      derived: { hp_max: hp, mp_max: mp, san_start: san, mov }
    }));

  }, [formData.stats]);

  const handleStatChange = (stat: string, value: string) => {
    const numVal = parseInt(value) || 0;
    setFormData(prev => ({
      ...prev,
      stats: { ...prev.stats, [stat]: numVal }
    }));
  };

  const handleSkillChange = (skillName: string, value: string) => {
    const numVal = parseInt(value) || 0;
    setFormData(prev => ({
      ...prev,
      skills: { ...prev.skills, [skillName]: numVal }
    }));
  };

  const getDodgeBase = () => Math.floor(formData.stats.DEX / 2);

  const steps = [
    { number: 1, title: '기본 정보', icon: User },
    { number: 2, title: '특성치', icon: Activity },
    { number: 3, title: '기능', icon: BookOpen },
    { number: 4, title: '배경', icon: FileText },
  ];

  const handleNext = () => {
    if (step < 4) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleFinalSubmit = async () => {
    if (!session?.user) return;
    setLoading(true);

    try {
      // Merge standard skills and custom skills
      const finalSkills = { ...formData.skills };
      if (customSkill1.name.trim()) finalSkills[customSkill1.name] = customSkill1.value;
      if (customSkill2.name.trim()) finalSkills[customSkill2.name] = customSkill2.value;

      // Construct Payload matching DB Schema
      const payload = {
        campaign_id: campaignId,
        user_id: session.user.id,
        name: formData.name,
        job: formData.occupation, // Mapping Occupation to 'job' column
        age: formData.age, // Send as string, no transformation
        traits: formData.traits,
        avatar_url: formData.avatarUrl,
        stats: formData.stats,
        skills: finalSkills,
        derived: formData.derived, // Sending the derived stats object
        backstory: { full: formData.backstory }
      };

      if (isEditMode && initialData?.id) {
        // Update
        const { error } = await supabase
          .from('characters')
          .update(payload)
          .eq('id', initialData.id);
        
        if (error) throw error;
        alert("캐릭터가 수정되었습니다.");
      } else {
        // Insert
        const { error } = await supabase
          .from('characters')
          .insert(payload);

        if (error) throw error;
        alert("캐릭터가 생성되었습니다.");
      }

      // Only close/navigate on success
      onSubmit(payload); 

    } catch (err: any) {
      console.error("Character save failed:", err);
      alert(`저장 실패: ${err.message || '알 수 없는 오류가 발생했습니다.'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8">
      
      {/* Top Navigation / Progress */}
      <div className="w-full max-w-5xl mb-8">
         <div className="flex items-center justify-between mb-6">
            <button onClick={onCancel} className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white flex items-center gap-1 transition-colors">
               <ChevronLeft size={20} /> 취소
            </button>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
               {isEditMode ? '캐릭터 수정' : '캐릭터 생성 (CoC 7th)'}
            </h2>
            <div className="w-16"></div>
         </div>

         {/* Progress Bar */}
         <div className="relative">
            <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-slate-200 dark:bg-zinc-800">
               <div style={{ width: `${(step / 4) * 100}%` }} className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-brand-600 transition-all duration-500"></div>
            </div>
            <div className="flex justify-between">
               {steps.map((s) => (
                  <div key={s.number} className={`flex flex-col items-center gap-2 ${step >= s.number ? 'text-brand-600 dark:text-brand-400' : 'text-slate-400'}`}>
                     <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors ${step >= s.number ? 'border-brand-600 bg-brand-50 dark:bg-brand-900/20' : 'border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-900'}`}>
                        <s.icon size={14} />
                     </div>
                     <span className="text-xs font-medium hidden sm:block">{s.title}</span>
                  </div>
               ))}
            </div>
         </div>
      </div>

      {/* Main Content Card */}
      <div className="w-full max-w-5xl bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-slate-200 dark:border-zinc-800 overflow-hidden flex flex-col min-h-[600px]">
         
         <div className="flex-1 p-8">
            {/* Step 1: Basic Info */}
            {step === 1 && (
               <div className="space-y-6 animate-fadeIn">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                     <User size={20} /> 탐사자 기본 정보
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                     {/* Avatar Area (URL Input) */}
                     <div className="md:col-span-1">
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">프로필 이미지</label>
                        <div className="aspect-square rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-100 dark:bg-zinc-900 overflow-hidden flex items-center justify-center mb-2">
                           {formData.avatarUrl ? (
                              <img src={formData.avatarUrl} alt="Preview" className="w-full h-full object-cover" />
                           ) : (
                              <ImageIcon size={32} className="text-slate-400" />
                           )}
                        </div>
                        <div className="relative">
                           <input 
                              type="text"
                              value={formData.avatarUrl}
                              onChange={(e) => setFormData({...formData, avatarUrl: e.target.value})}
                              placeholder="Image URL"
                              className="w-full pl-8 pr-3 py-2 rounded-lg bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 focus:outline-none focus:ring-2 focus:ring-brand-600 dark:text-white text-xs"
                           />
                           <LinkIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
                        </div>
                     </div>

                     {/* Inputs */}
                     <div className="md:col-span-2 space-y-4">
                        <div>
                           <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">이름</label>
                           <input 
                              type="text" 
                              value={formData.name}
                              onChange={(e) => setFormData({...formData, name: e.target.value})}
                              className="w-full px-4 py-2.5 rounded-lg bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 focus:outline-none focus:ring-2 focus:ring-brand-600 dark:text-white"
                              placeholder="탐사자 이름"
                           />
                        </div>
                        <div>
                           <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">직업</label>
                           <input 
                              type="text" 
                              value={formData.occupation}
                              onChange={(e) => setFormData({...formData, occupation: e.target.value})}
                              className="w-full px-4 py-2.5 rounded-lg bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 focus:outline-none focus:ring-2 focus:ring-brand-600 dark:text-white"
                              placeholder="" 
                           />
                        </div>
                        <div>
                           <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">나이</label>
                           <input 
                              type="text" 
                              value={formData.age}
                              onChange={(e) => setFormData({...formData, age: e.target.value})}
                              className="w-full px-4 py-2.5 rounded-lg bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 focus:outline-none focus:ring-2 focus:ring-brand-600 dark:text-white"
                              placeholder=""
                           />
                        </div>
                     </div>
                  </div>
               </div>
            )}

            {/* Step 2: Characteristics */}
            {step === 2 && (
               <div className="space-y-8 animate-fadeIn">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                     <Activity size={20} /> 특성치 (Characteristics)
                  </h3>
                  
                  {/* Primary Stats Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                     {Object.entries(formData.stats).map(([key, value]) => (
                        <div key={key} className="bg-slate-50 dark:bg-zinc-950 p-4 rounded-xl border border-slate-200 dark:border-zinc-800">
                           <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase">{key}</label>
                           <input 
                              type="number"
                              value={value}
                              onChange={(e) => handleStatChange(key, e.target.value)}
                              className="w-full text-2xl font-bold bg-transparent border-b border-slate-300 dark:border-zinc-700 focus:border-brand-600 outline-none text-center text-slate-900 dark:text-white pb-1"
                           />
                        </div>
                     ))}
                  </div>

                  <div className="border-t border-slate-200 dark:border-zinc-800"></div>

                  {/* Derived Stats */}
                  <div>
                     <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">파생 능력치 (자동 계산됨)</h4>
                     <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-red-50 dark:bg-red-900/10 p-4 rounded-xl border border-red-100 dark:border-red-900/30 flex items-center justify-between">
                           <span className="text-sm font-medium text-red-600 dark:text-red-400">HP (체력)</span>
                           <span className="text-xl font-bold text-red-700 dark:text-red-300">{formData.derived.hp_max}</span>
                        </div>
                        <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-xl border border-blue-100 dark:border-blue-900/30 flex items-center justify-between">
                           <span className="text-sm font-medium text-blue-600 dark:text-blue-400">MP (마력)</span>
                           <span className="text-xl font-bold text-blue-700 dark:text-blue-300">{formData.derived.mp_max}</span>
                        </div>
                        <div className="bg-purple-50 dark:bg-purple-900/10 p-4 rounded-xl border border-purple-100 dark:border-purple-900/30 flex items-center justify-between">
                           <span className="text-sm font-medium text-purple-600 dark:text-purple-400">SAN (이성)</span>
                           <span className="text-xl font-bold text-purple-700 dark:text-purple-300">{formData.derived.san_start}</span>
                        </div>
                        <div className="bg-green-50 dark:bg-green-900/10 p-4 rounded-xl border border-green-100 dark:border-green-900/30 flex items-center justify-between">
                           <span className="text-sm font-medium text-green-600 dark:text-green-400">MOV (이동)</span>
                           <span className="text-xl font-bold text-green-700 dark:text-green-300">{formData.derived.mov}</span>
                        </div>
                     </div>
                  </div>
               </div>
            )}

            {/* Step 3: Skills */}
            {step === 3 && (
               <div className="space-y-6 animate-fadeIn h-full flex flex-col">
                  <div className="flex items-center justify-between">
                     <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <BookOpen size={20} /> 기능 (Skills)
                     </h3>
                     <span className="text-xs text-slate-500 bg-slate-100 dark:bg-zinc-800 px-2 py-1 rounded">
                        회피 초기치(DEX/2): {getDodgeBase()} | 모국어 초기치(EDU): {formData.stats.EDU}
                     </span>
                  </div>

                  <div className="flex-1 overflow-y-auto pr-2 max-h-[550px]">
                     <div className="columns-1 md:columns-2 lg:columns-3 gap-6 block">
                        {FULL_COC_SKILL_LIST.map((skillName) => {
                           const baseVal = getBaseSkillValue(skillName, formData.stats.DEX, formData.stats.EDU);
                           const currentVal = formData.skills[skillName];
                           
                           return (
                              <div key={skillName} className="break-inside-avoid mb-3 flex items-center justify-between p-2 rounded hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors border-b border-slate-100 dark:border-zinc-800/50">
                                 <div className="flex flex-col">
                                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{skillName}</span>
                                    <span className="text-[10px] text-slate-400">초기치: {baseVal}</span>
                                 </div>
                                 <input 
                                    type="number"
                                    placeholder={baseVal.toString()}
                                    value={currentVal || ''}
                                    onChange={(e) => handleSkillChange(skillName, e.target.value)}
                                    className="w-16 px-2 py-1 text-right rounded border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 focus:ring-1 focus:ring-brand-500 text-sm"
                                 />
                              </div>
                           );
                        })}
                     </div>
                     
                     <div className="mt-6 border-t border-slate-200 dark:border-zinc-800 pt-6">
                        <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">추가 기능 (직접 입력)</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                           {/* Custom Skill 1 */}
                           <div className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-zinc-950 rounded-lg border border-slate-200 dark:border-zinc-800">
                              <input 
                                 type="text" 
                                 placeholder="기능명 (예: 운전-자동차)"
                                 value={customSkill1.name}
                                 onChange={(e) => setCustomSkill1({...customSkill1, name: e.target.value})}
                                 className="flex-1 bg-transparent border-none focus:ring-0 text-sm p-0 text-slate-900 dark:text-white placeholder-slate-400"
                              />
                              <div className="w-px h-6 bg-slate-300 dark:bg-zinc-700 mx-1"></div>
                              <input 
                                 type="number"
                                 placeholder="0"
                                 value={customSkill1.value || ''}
                                 onChange={(e) => setCustomSkill1({...customSkill1, value: parseInt(e.target.value) || 0})}
                                 className="w-14 bg-transparent border-none focus:ring-0 text-right text-sm p-0 font-bold"
                              />
                           </div>
                           
                           {/* Custom Skill 2 */}
                           <div className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-zinc-950 rounded-lg border border-slate-200 dark:border-zinc-800">
                              <input 
                                 type="text" 
                                 placeholder="기능명 (예: 예술-노래)"
                                 value={customSkill2.name}
                                 onChange={(e) => setCustomSkill2({...customSkill2, name: e.target.value})}
                                 className="flex-1 bg-transparent border-none focus:ring-0 text-sm p-0 text-slate-900 dark:text-white placeholder-slate-400"
                              />
                              <div className="w-px h-6 bg-slate-300 dark:bg-zinc-700 mx-1"></div>
                              <input 
                                 type="number"
                                 placeholder="0"
                                 value={customSkill2.value || ''}
                                 onChange={(e) => setCustomSkill2({...customSkill2, value: parseInt(e.target.value) || 0})}
                                 className="w-14 bg-transparent border-none focus:ring-0 text-right text-sm p-0 font-bold"
                              />
                           </div>
                        </div>
                     </div>
                  </div>
               </div>
            )}

            {/* Step 4: Backstory */}
            {step === 4 && (
               <div className="space-y-6 animate-fadeIn">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                     <FileText size={20} /> 배경 이야기 (Backstory)
                  </h3>

                  <div>
                     <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                        한 줄 요약 (Traits)
                     </label>
                     <input
                        type="text"
                        value={formData.traits}
                        onChange={(e) => setFormData({...formData, traits: e.target.value})}
                        placeholder="예: 호기심이 많고 미신을 믿지 않음"
                        className="w-full px-4 py-3 rounded-lg bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 focus:outline-none focus:ring-2 focus:ring-brand-600 dark:text-white"
                     />
                  </div>

                  <div>
                     <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                        상세 배경 (Backstory)
                     </label>
                     <textarea
                        rows={8}
                        value={formData.backstory}
                        onChange={(e) => setFormData({...formData, backstory: e.target.value})}
                        placeholder="캐릭터의 과거, 트라우마, 중요한 사람 등을 자유롭게 서술하세요."
                        className="w-full px-4 py-3 rounded-lg bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 focus:outline-none focus:ring-2 focus:ring-brand-600 dark:text-white resize-none leading-relaxed"
                     />
                  </div>
               </div>
            )}
         </div>

         {/* Footer Actions */}
         <div className="p-6 border-t border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950/50 flex justify-between items-center">
            <button
               onClick={handleBack}
               disabled={step === 1}
               className={`flex items-center gap-1 px-4 py-2 rounded-lg font-medium transition-colors ${step === 1 ? 'text-slate-300 dark:text-zinc-700 cursor-not-allowed' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-zinc-800'}`}
            >
               <ChevronLeft size={18} /> 이전
            </button>

            {step < 4 ? (
               <button
                  onClick={handleNext}
                  className="flex items-center gap-1 px-6 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg font-semibold shadow-md transition-transform active:scale-95"
               >
                  다음 <ChevronRight size={18} />
               </button>
            ) : (
               <button
                  onClick={handleFinalSubmit}
                  disabled={loading}
                  className="flex items-center gap-2 px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold shadow-md transition-transform active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
               >
                  <Save size={18} /> {isEditMode ? '수정 완료' : '생성 완료'}
               </button>
            )}
         </div>
      </div>
    </div>
  );
};

export default CharacterCreation;