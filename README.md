# QT Fashion app

The project is organized into two main folders:

- `frontend/` — the React website, styles, and design-reference screenshots.
- `backend/` — Supabase database SQL, migrations, security policies, and Edge Functions.

Project-wide Node dependencies and commands remain at the repository root. Start the website with `npm run dev` and create a production build with `npm run build`.

For Supabase setup and migration instructions, see [BACKEND_SETUP.md](./BACKEND_SETUP.md).

## Deploy to Vercel

This repository is configured as a Vite static site for Vercel. Import the repository in Vercel and keep the project root at the repository root. The Vercel configuration builds with `npm run build` and publishes `frontend/dist`.

### Deploy as a Render Web Service

For a Render Web Service, set the root directory to the repository root, build command to `npm install && npm run build`, and start command to `npm start`. The start script serves `frontend/dist` on Render's assigned `PORT` (or port `10000` locally).

Add these environment variables in the Vercel project settings for every environment you will use:

- `VITE_SUPABASE_URL` — the Supabase project URL.
- `VITE_SUPABASE_ANON_KEY` — the Supabase publishable/anon key. This is used by the browser; never use a service-role key here.

For Render, add the same two variables in the Web Service's Environment settings. Vite embeds these public Supabase values into the frontend during the build, so set them before deploying and trigger a new deploy after changing them.

After the first deployment, set the Supabase Auth Site URL to the production URL and add the production URL to the allowed redirect URLs. Set the Supabase Edge Function secret `APP_SITE_URL` to that same public URL so apprentice invitation and recovery links return to the deployed app. See [BACKEND_SETUP.md](./BACKEND_SETUP.md) for the database, RLS, storage, and Edge Function setup.

Before launch, verify that the required migrations and `security.sql` have been applied to the intended Supabase project, then test owner and apprentice sign-in, invitation/recovery links, and the main shop workflows on the deployed URL. Offline mode currently provides cached app-shell and workspace reading only: edits made offline are not queued or synchronized.
