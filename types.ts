export type User = {
  id: string;
  name: string;
  avatarUrl: string;
};

// Matches Supabase 'campaigns' table structure
export type Campaign = {
  id: string;
  title: string;
  system: string;
  description: string;
  gm_id: string;
  cover_image: string | null;
  // Removed is_private and password
  invite_code: string; // New field for access control
  member_count: number; // calculated or fetched field
  discord_webhook_url?: string; // Added for Discord integration
  bgm_url?: string; // [추가됨] BGM URL support
  last_active_at?: string; // Added field for sorting by activity
  
  // Scene / Scenario Management Fields
  current_chapter?: string;
  current_location?: string;
  scenario_time?: string; 
  scene_description?: string;
  is_scene_visible?: boolean;

  created_at: string;
  updated_at: string;
  // Joined data from profiles table
  profiles?: {
    nickname: string;
  };
  // Joined data from participants table
  participants?: {
    user_id: string;
    profiles: {
      nickname: string;
    };
  }[];
};

// Deprecated 'Session' in favor of 'Campaign', but keeping for compatibility if needed elsewhere
export type Session = Campaign; 

// Added 'narration' (center aligned story text) and 'ooc' (out of character)
export type MessageType = 'talk' | 'narration' | 'dice' | 'ooc';

export type SuccessLevel = 'Critical Success' | 'Extreme Success' | 'Hard Success' | 'Regular Success' | 'Success' | 'Failure' | 'Fumble';

export type Message = {
  id: string;
  senderId: string;
  senderName: string;
  avatarUrl?: string;
  content: string;
  timestamp: string;
  createdAt: string; // Added for unread logic (ISO string)
  type: MessageType;
  // 'user' means the actual player (for OOC), 'character' means their persona
  senderType: 'user' | 'character' | 'gm'; 
  diceResult?: {
    formula: string;
    rolls: number[];
    total: number;
    successLevel?: SuccessLevel;
    modifier?: number; // 0: Normal, 1: Bonus1, 2: Bonus2, -1: Penalty1, -2: Penalty2
  };
  isHidden?: boolean; // New: GM hidden message
};

export type CharacterStat = {
  label: string;
  value: number;
};

export type Character = {
  id: string;
  name: string;
  class: string; // Occupation in CoC
  age: string; // Changed to string
  hp: { current: number; max: number };
  mp: { current: number; max: number };
  san: { current: number; max: number }; // Sanity
  luck: { current: number; max: number };
  stats: CharacterStat[];
  skills: Record<string, number>; // "Skill Name": Value
  notes: string;
  avatarUrl?: string;
};

export type LocationInfo = {
  chapter: string;
  location: string;
  time: string;
  description: string;
};

export type ViewState = 'login' | 'onboarding' | 'dashboard' | 'playroom' | 'create-campaign' | 'mypage' | 'create-character';