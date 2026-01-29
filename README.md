# Slow ORPG 🎲
CoC 7판을 위한 웹 기반 ORPG 툴입니다.
설치 없이 브라우저에서 바로 플레이하세요.

## ✨ 주요 기능
- 실시간 채팅 및 주사위 판정 (1d100 자동 계산)
- 캐릭터 시트 연동 (클릭하여 판정)
- HP / SAN / MP 실시간 관리 및 로그 기록
- GM 전용 장면(BGM, 배경) 제어
- 디스코드 알림 연동

## 🚀 내 전용 서버 만들기 (3분 컷)

남의 눈치 볼 필요 없이, 클릭 몇 번으로 **나만의 무료 서버**를 만드세요.

### 1단계: 배포 버튼 클릭
아래 버튼을 눌러 Vercel에 이 프로젝트를 복제합니다.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=[https://github.com/sunshinegogo5678/slow-orpg]&env=VITE_SUPABASE_URL,VITE_SUPABASE_ANON_KEY)

> **참고:** Vercel 설정 중 `Environment Variables` 입력칸이 나오면 일단 비워두거나 아무거나 적고 넘어가셔도 됩니다. (3단계에서 넣을 예정)

### 2단계: 데이터베이스(Supabase) 만들기
1. [Supabase](https://supabase.com/)에 가입하고 **New Project**를 만듭니다.
2. 프로젝트가 생성되면 왼쪽 메뉴 **SQL Editor**로 이동합니다.
3. 이 저장소에 있는 `setup.sql` 파일의 내용을 전부 복사해서 붙여넣고 **Run**을 누릅니다.

### 3단계: 연결하기
1. Supabase 왼쪽 메뉴 **Settings (톱니바퀴) > API**로 이동합니다.
2. `Project URL`과 `anon public key`를 복사합니다.
3. 아까 만든 Vercel 프로젝트의 **Settings > Environment Variables**로 이동합니다.
4. 다음 두 가지 변수를 추가합니다.
   - `VITE_SUPABASE_URL` : (복사한 Project URL)
   - `VITE_SUPABASE_ANON_KEY` : (복사한 anon public key)
5. Vercel 상단 **Deployments** 탭으로 가서 **Redeploy**를 한 번 해주면 끝!

---
**즐거운 세션 되세요!** 🐙