import { Session, Message, Character, LocationInfo } from './types';

// Helper to generate dates relative to "now" for realistic testing
const now = new Date();
const timeToday = new Date(now.getTime() - 1000 * 60 * 45); // 45 mins ago
const timeYesterday = new Date(now.getTime() - 1000 * 60 * 60 * 26); // 26 hours ago

export const DUMMY_SESSIONS: Session[] = [
  {
    id: '1',
    title: 'The Whispering Shadows',
    system: 'CoC 7e',
    description: 'A dark mystery unfolds in the old mansion.',
    gm_id: 'gm1',
    created_at: timeToday.toISOString(),
    updated_at: timeToday.toISOString(),
    member_count: 5,
    cover_image: 'https://picsum.photos/400/200?random=1',
    invite_code: 'A1B2C3',
    profiles: {
      nickname: 'DungeonMaster_K'
    }
  },
  {
    id: '2',
    title: 'Cyberpunk: Neon Rain',
    system: 'Cyberpunk Red',
    description: 'Surviving in the neon-lit streets.',
    gm_id: 'gm2',
    created_at: timeYesterday.toISOString(),
    updated_at: timeYesterday.toISOString(),
    member_count: 4,
    cover_image: 'https://picsum.photos/400/200?random=2',
    invite_code: 'X9Y8Z7',
    profiles: {
      nickname: 'NetRunner01'
    }
  },
];

export const DUMMY_MESSAGES: Message[] = [
  {
    id: '1',
    senderId: 'gm',
    senderName: 'Narrator',
    avatarUrl: '',
    content: '비가 쏟아지는 밤, 당신들은 낡은 저택의 문 앞에 서 있습니다. 문틈 사이로 희미한 불빛이 새어 나오고, 안에서는 낡은 축음기 소리가 들려옵니다.',
    timestamp: '20:02',
    createdAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    type: 'narration',
    senderType: 'gm',
  },
  {
    id: '2',
    senderId: 'p1',
    senderName: '하비 월터스',
    avatarUrl: 'https://picsum.photos/50/50?random=11',
    content: '침을 꼴깍 삼키며 문을 두드립니다. "계... 계십니까?"',
    timestamp: '20:03',
    createdAt: new Date(Date.now() - 1000 * 60 * 4).toISOString(),
    type: 'talk',
    senderType: 'character',
  },
  {
    id: '3',
    senderId: 'user1',
    senderName: 'Player_K',
    avatarUrl: 'https://picsum.photos/50/50?random=99',
    content: '오늘 분위기 진짜 무섭네요 ㅋㅋ 브금 뭐 쓰시는 거예요?',
    timestamp: '20:04',
    createdAt: new Date(Date.now() - 1000 * 60 * 3).toISOString(),
    type: 'ooc',
    senderType: 'user',
  },
  {
    id: '4',
    senderId: 'system',
    senderName: 'System',
    content: '하비 월터스 rolls for 듣기',
    timestamp: '20:04',
    createdAt: new Date(Date.now() - 1000 * 60 * 2).toISOString(),
    type: 'dice',
    senderType: 'character',
    diceResult: {
      formula: '1d100 <= 50',
      rolls: [32],
      total: 32,
      successLevel: 'Success',
      modifier: 0
    }
  },
];

export const MY_CHARACTER: Character = {
  id: 'c1',
  name: '하비 월터스',
  class: '기자',
  age: '34',
  hp: { current: 10, max: 12 },
  mp: { current: 12, max: 12 },
  san: { current: 45, max: 60 },
  luck: { current: 50, max: 99 },
  stats: [
    { label: 'STR', value: 40 },
    { label: 'CON', value: 60 },
    { label: 'SIZ', value: 50 },
    { label: 'DEX', value: 55 },
    { label: 'APP', value: 45 },
    { label: 'INT', value: 70 },
    { label: 'POW', value: 60 },
    { label: 'EDU', value: 75 },
  ],
  skills: {
    "관찰력": 50,
    "듣기": 45,
    "자료조사": 60,
    "설득": 40,
    "심리학": 30,
    "은밀행동": 20,
    "근접전(격투)": 25,
    "사격(권총)": 20,
    "회피": 27,
  },
  notes: '특이사항: 폐쇄공포증이 있음. 항상 수첩을 휴대함.',
};

export const CURRENT_LOCATION: LocationInfo = {
  chapter: '제 2장: 초대받지 않은 손님',
  location: '블랙우드 저택, 응접실',
  time: '1924년 10월 31일, 밤 10시',
  description: '먼지가 자욱한 응접실입니다. 벽난로에는 불이 꺼진 지 오래된 듯 재만 남아있고, 벽에는 기괴한 초상화가 걸려있습니다.',
};