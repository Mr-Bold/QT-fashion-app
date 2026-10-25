# Supabase Backend Setup

This project keeps the React website in `frontend/` and the Supabase backend in `backend/`. The database schema is in `backend/sql/database.sql`; row-level security and authentication setup are in `backend/sql/security.sql`.

## Which files are frontend and backend?

The folders are physically separated so it is easier to find the right files.

### Frontend — the website users see

- `frontend/src/` — React screens and behavior. `App.tsx` contains the main app, `ApprenticePortal.tsx` contains the apprentice workspace, and `lib/workspace.ts` loads and saves workspace data through Supabase.
- `frontend/src/*.css` — styles for the website.
- `frontend/public/` and `frontend/src/assets/` — images and other files used by the website.
- `frontend/design-reference/` — screenshots used as visual references.
- `frontend/index.html`, `frontend/vite.config.ts`, and `frontend/tsconfig*.json` — frontend entry point and build configuration.
- `package.json` at the repository root — dependencies and commands for the frontend.
- `frontend/.env.local` — local frontend configuration. It may contain only the Supabase URL and publishable/anon key; do not commit it. Start from `frontend/.env.example`.

### Backend — data, access rules, and server-side operations

- `backend/sql/database.sql` — base database tables.
- `backend/sql/migrations/` — ordered database changes, including the multi-shop migration.
- `backend/sql/security.sql` — database access policies and signup behavior. Run it after the migrations as described below.
- `backend/supabase/functions/apprentice-access/index.ts` — server-side apprentice invitations and password reset links. This function uses Supabase server credentials and must never be bundled into the frontend.
- `backend/.env.local` — private local backend settings or existing Supabase CLI credentials. Do not commit it or copy secret keys into the frontend.
- Supabase project settings — authentication, database, storage, and deployed Edge Functions are configured in the Supabase dashboard or with the Supabase CLI; they do not live in `frontend/src/`.

**In short:** edit `frontend/` for screens and browser behavior; edit `backend/sql/` for database structure and permissions; edit `backend/supabase/functions/` for trusted server-side actions.

From the repository root, run `npm run dev` to start the website or `npm run build` to check and build it. Vite reads frontend variables from `frontend/.env.local`; keep backend-only secrets in the backend and Supabase secret manager.

## Configure Supabase

1. Create a Supabase project.
2. For a new project, run `backend/sql/database.sql`. Then, for both new and existing projects, run these migrations in order: `backend/sql/migrations/20261022_dashboard_backend.sql`, `backend/sql/migrations/20261023_customer_timeline.sql`, `backend/sql/migrations/20261023_measurement_presets.sql`, `backend/sql/migrations/20261023_measurement_history.sql`, `backend/sql/migrations/20261023_measurement_photos.sql`, `backend/sql/migrations/20261023_apprentice_management.sql`, `backend/sql/migrations/20261024_measurement_billing.sql`, `backend/sql/migrations/20261025_apprentice_portal.sql`, `backend/sql/migrations/20261026_task_page_workflow.sql`, `backend/sql/migrations/20261027_multi_shop_accounts.sql`, `backend/sql/migrations/20261028_qt_fashion_app_brand.sql`, `backend/sql/migrations/20261029_apprentice_deletion.sql`, `backend/sql/migrations/20261030_customer_history_deletion.sql`, `backend/sql/migrations/20261031_cloth_gallery.sql`, and `backend/sql/migrations/20261101_owner_account_deletion.sql`. Run `backend/sql/security.sql` last.

   Do not run `backend/sql/security.sql` before the multi-shop migration: it defines tenant-scoped policies that rely on the ownership columns and helper functions added by that migration. The multi-shop migration assigns legacy rows automatically only when there is exactly one active owner; it stops if existing rows cannot be safely attributed.
3. In Supabase Authentication settings, enable email/password sign-in. Set the Auth **Site URL** to your deployed app's exact public origin (for example, `https://your-app.vercel.app` or your Render URL), then add that origin and the local URL `http://localhost:5173/**` to the allowed redirect URLs. Sign-up confirmation and password-reset links return to the origin where the request was made. Configure email delivery for account invitations and recovery if your Supabase project requires it.
4. Copy `frontend/.env.example` to `frontend/.env.local` and fill in the project URL and publishable key from the Supabase project settings:

```powershell
Copy-Item frontend/.env.example frontend/.env.local
```

5. Restart Vite after editing `frontend/.env.local`.
6. Create an account through the app's sign-up form. Every self-registered account becomes the owner of a separate, private shop. Apprentices must be invited by a shop owner and cannot create an owner account through the apprentice invitation flow.

7. Deploy the owner-verified Edge Function and configure the app's public URL:

```powershell
supabase --workdir backend functions deploy apprentice-access
supabase --workdir backend functions deploy delete-owner-account
supabase --workdir backend secrets set APP_SITE_URL=https://your-app.example.com
```

Set `APP_SITE_URL` to the same exact deployed origin used for the Auth Site URL. This is used for apprentice invitation and reset links; it is separate from the frontend's Supabase API URL.

For local development, set `APP_SITE_URL` to `http://localhost:5173` in the Supabase CLI environment or Edge Function local env file. Use the exact origin that is allow-listed in Supabase Authentication redirect URLs. The function uses Supabase's server-provided URL and service-role environment variables; never add the service-role key to `frontend/.env.local`, a `VITE_` variable, or any browser-accessible setting.

Do not put a Supabase service-role key in the Vite app or `frontend/.env.local`. The browser uses only the publishable anon key; RLS is responsible for access control. The existing server credentials are kept in the ignored `backend/.env.local`; rotate any key that was previously committed or shared.

## Current Integration State

After an online visit, the production app caches its shell and the signed-in user's latest workspace snapshot in the browser for offline reading. The snapshot is stored in IndexedDB on a per-user basis and is not encrypted; use this only on a private device. Reconnecting refreshes the workspace from Supabase. Offline edits are not queued or synchronized yet, so workspace changes must be made while online. Cached private photo URLs may also expire while offline.

Supabase sign-in/sign-up and sign-out are enabled when both `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are present. Without them, the app runs in its local demo mode; apprentice portal logins and invitations require Supabase.

With Supabase configured, customer profiles (including private Storage photos), customer notes, measurements (including garment photos and style references) and owner-managed measurement presets (including optional default cloth prices), measurement version history, orders (including quantity and pricing breakdown), payment balances and individual payment receipts (including method, date, and optional transaction reference), tasks, apprentice profiles, logged training hours, skill progress, attendance and leave records, apprentice task progress history, and shop settings are read from and saved to Supabase. Measurement images use the existing private `customer-photos` Storage bucket.

The signed-in shop owner's fabric and style gallery is stored in the `cloth_gallery_items` table, with images in the private `cloth-gallery` Storage bucket. The migration creates the bucket and owner-only database and Storage policies. When an owner first opens an empty cloud gallery on a device that has older local gallery data, the app asks whether to import those items and photos. Customer gallery assignment history and customer garment records remain browser-local.

Shop owners can permanently delete their shop from Settings → Account & Security. This re-verifies the current password, requires typing `DELETE MY SHOP`, removes shop data and files, deletes invited apprentice accounts, then deletes the owner account. Apply `20261101_owner_account_deletion.sql` and deploy `delete-owner-account` before using this flow. If cleanup is interrupted, the pending deletion record lets the owner retry with the same signed-in account; do not manually delete that account from Supabase Auth while a deletion is pending.

Each self-registered owner account has its own tenant. Tenant ownership is enforced by row-level security and composite foreign keys across shop records, and customer photo paths are scoped to that owner. Apprentice invitations and password resets are restricted to the calling owner's apprentices; the browser never receives the service-role key. Deleting a customer permanently removes that customer's notes, measurements, orders, payments, assigned order tasks and task history, plus their stored customer and measurement photos. The customer delete confirmation warns that this cannot be undone.

Owners can add an apprentice with their name, email, phone number, and training details. The server-side `apprentice-access` function creates an invite-only apprentice account and one-time setup link; the owner can share it through WhatsApp or SMS. The apprentice sets and resets their own password. Owners can create a fresh reset link, but cannot view or set a permanent password. Owners can permanently delete an apprentice and their login; this also removes their training records, assigned tasks, and task progress history.

After login, apprentices are routed to a separate task-only workspace. Database row-level security limits task, order, and progress history reads to work assigned to that account. Apprentices can accept tasks, start work, submit it for review, resume revision requests, update their assigned task checklists, and add progress notes. Owners can review submitted work, approve it or request revisions with feedback, and see task timelines, workload summaries, and due-date filters in the Tasks board/list views. Reusable task templates include garment finishing, pattern cutting, fitting preparation, and hand embroidery; linked tasks can show the garment and style reference photos from the matching customer measurement record. Task checklists, review decisions, status changes, and progress notes are validated and saved through database functions. The admin Tasks page, Notifications activity, and apprentice profile update from Supabase Realtime; the migrations add the relevant tables to the `supabase_realtime` publication.
