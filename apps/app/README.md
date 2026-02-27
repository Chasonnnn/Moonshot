# Moonshot Frontend App

## Local Setup
1. Install dependencies:
   - `pnpm install`
2. Copy env template:
   - `cp .env.example .env.local`
3. Ensure backend is running on `MOONSHOT_API_BASE_URL`.
4. Start frontend:
   - `pnpm dev`

## Integration Route
- Open `http://localhost:3000/pilots`.
- Use **Run JDA Flow** to execute:
  - case create
  - generate async job + polling
  - session runtime + coach call
  - score async job + report summary
  - export async job + export fetch

## Required Env Vars
- `MOONSHOT_API_BASE_URL`
- `MOONSHOT_BOOTSTRAP_TOKEN`
- `MOONSHOT_DEV_TENANT_ID`
- `MOONSHOT_DEV_ADMIN_USER_ID`
- `MOONSHOT_DEV_REVIEWER_USER_ID`
- `MOONSHOT_DEV_CANDIDATE_USER_ID`
