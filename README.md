<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# CopyVara MVP v0.3

OpenAI + Supabase Edge Functions 기반으로 지식 분석/질의 API를 사용하는 프론트엔드입니다.

## Run Locally

**Prerequisites:** Node.js, Supabase CLI

1. Install dependencies:
   `npm install`
2. Set environment values in [.env.local](.env.local)
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. Link supabase project and set secrets:
   - `supabase link --project-ref <your-project-ref>`
   - `supabase secrets set OPENAI_API_KEY=sk-...`
   - `supabase secrets set OPENAI_MODEL_PRIMARY=gpt-5-nano`
   - `supabase secrets set OPENAI_MODEL_FALLBACK=gpt-5-mini`
4. Deploy functions:
   - `supabase functions deploy analyze`
   - `supabase functions deploy qa`
5. Run app:
   - `npm run dev`

## Added serverless functions

- [`supabase/functions/analyze/index.ts`](supabase/functions/analyze/index.ts)
- [`supabase/functions/qa/index.ts`](supabase/functions/qa/index.ts)
- [`supabase/functions/_shared/cors.ts`](supabase/functions/_shared/cors.ts)

## Specs / plans

- API spec: [`plans/openai-supabase-api-spec.md`](plans/openai-supabase-api-spec.md)
- Env setup: [`plans/supabase-openai-env-setup.md`](plans/supabase-openai-env-setup.md)
