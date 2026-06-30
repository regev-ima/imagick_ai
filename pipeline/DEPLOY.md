# Deploy the pipeline — your only two human steps

Everything is automated by a GitHub Action (`.github/workflows/deploy-pipeline.yml`).
You only do the two things a robot legally can't: create a Modal account, and
hand over keys **safely via GitHub Secrets** (never in chat).

## Step 1 — create a free Modal account
1. Go to https://modal.com → sign up (free, ~$30 starting credit).
2. Settings → **API Tokens** → New token → copy the **Token ID** and **Token Secret**.

## Step 2 — add secrets to GitHub (one time)
Repo → **Settings → Secrets and variables → Actions → New repository secret**.
Add these six:

| Secret | Where to get it |
| --- | --- |
| `MODAL_TOKEN_ID` | Modal → Settings → API Tokens |
| `MODAL_TOKEN_SECRET` | same |
| `PIPELINE_TOKEN` | invent any long random string (e.g. a UUID) |
| `SUPABASE_ACCESS_TOKEN` | supabase.com → Account → Access Tokens |
| `SUPABASE_PROJECT_ID` | Supabase project → Settings → General → Reference ID |
| `SUPABASE_DB_PASSWORD` | Supabase project → Settings → Database → password |

## Step 3 — run it (one click)
Repo → **Actions → "Deploy AI pipeline" → Run workflow**.
It deploys the Modal GPU app, runs the DB migration, wires the Modal URL into
Supabase, and deploys the `process-pipeline` function. After that, every change
to the pipeline re-deploys automatically.

## Manual fallback (if you'd rather run it locally)
```bash
pip install modal supabase
modal token new
modal secret create imagick-pipeline-secret PIPELINE_TOKEN=<random>
modal deploy pipeline/modal_app.py            # prints the URL
supabase link --project-ref <project-ref>
supabase db push
supabase secrets set MODAL_URL=<url> MODAL_TOKEN=<random>
supabase functions deploy process-pipeline
```
