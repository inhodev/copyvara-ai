# Supabase + OpenAI 사전 연결 가이드

## 1. `.env.local`에 넣을 값
아래 템플릿을 [`.env.local`](../.env.local)에 넣으면 됩니다.

```env
# Frontend에서 사용할 공개값 Vite prefix 필요
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY

# 프론트에서 직접 사용하지 않음 참고용
SUPABASE_PROJECT_REF=YOUR_PROJECT_REF
SUPABASE_FUNCTIONS_BASE_URL=https://YOUR_PROJECT_REF.supabase.co/functions/v1

# 기존 Gemini 키는 제거 예정
# GEMINI_API_KEY=
```

주의
- 브라우저에서 읽어야 하는 값만 `VITE_` prefix 사용
- OpenAI 키는 절대 [`.env.local`](../.env.local)에 두지 않음

## 2. Supabase 연결에 필요한 값
Supabase Dashboard의 Settings API에서 확인

필수
- Project URL
  - `https://<project-ref>.supabase.co`
- Anon public key
  - 프론트에서 Supabase 호출 시 사용

Edge Functions 배포 및 호출에 필요
- Project ref
- Supabase personal access token 로컬 CLI 배포용

## 3. OpenAI 키 위치
OpenAI 키는 Supabase Edge Functions secret로 저장

```bash
supabase secrets set OPENAI_API_KEY=sk-xxxx
```

권장 추가 secret
```bash
supabase secrets set OPENAI_MODEL_PRIMARY=gpt-5-nano
supabase secrets set OPENAI_MODEL_FALLBACK=gpt-5-mini
```

## 4. 최소 연결 체크리스트
- [ ] [`.env.local`](../.env.local)에 `VITE_SUPABASE_URL` 입력
- [ ] [`.env.local`](../.env.local)에 `VITE_SUPABASE_ANON_KEY` 입력
- [ ] Supabase CLI 로그인 완료
- [ ] `supabase link --project-ref <project-ref>` 완료
- [ ] `supabase secrets set OPENAI_API_KEY=...` 완료
- [ ] Edge Functions 로컬 실행 테스트 통과

## 5. 왜 이렇게 분리하는가
- 현재 키 노출 이슈 지점은 [`vite.config.ts`](../vite.config.ts:13)
- OpenAI 키를 서버 secret로 이동하면 브라우저 번들 노출을 차단
- 프론트는 Edge Function 엔드포인트만 호출
