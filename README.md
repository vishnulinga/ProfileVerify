
# Profile Verify MVP

Basic end-to-end MVP for your candidate profile verification idea.

## Features

- **Candidate portal**
  - Register / login
  - Edit profile (name, DOB, experience, links, etc.)
  - Upload documents (ID, offer letter, W2, etc.)
  - See verification status / level / admin notes

- **Admin dashboard**
  - Login with seeded admin user
  - View list of all candidates
  - Open candidate detail
  - See uploaded documents
  - Set verification status, level, risk score, and notes

- **Employer dashboard (read-only)**
  - Register / login as employer
  - View list of **verified** candidates
  - Open read-only candidate profiles
  - See basic contact info (email) and profile, but not raw documents

## Tech Stack

- Node.js + Express
- SQLite (file-based, `database.sqlite` in project root)
- EJS views
- Sessions for auth
- Multer for file uploads

## Prerequisites

- Node.js (>= 18 recommended)
- npm

## How to run locally

1. **Unzip the project** and open a terminal in the project folder:

   ```bash
   cd profile-verify-mvp
   ```

2. **Install dependencies**:

   ```bash
   npm install
   ```

3. **Start the server**:

   ```bash
   npm start
   ```

4. Open your browser and go to:

   ```
   http://localhost:3000
   ```

5. **Admin account**

   A default admin user is seeded automatically on first run:

   - Email: `admin@example.com`
   - Password: `admin123`

   Use this to log in at `/login`, and you will be redirected to the admin dashboard.

> ⚠️ If you ran an older version before and already have a `database.sqlite` file, delete it once so the new schema (with `employer` role) and seed user are created cleanly.

---

## Flow to test end-to-end

### 1. Candidate flow

1. Go to `http://localhost:3000/register`
2. Register a new **candidate** account.
3. Log in as candidate at `/login`.
4. Go to **My Profile**, fill in some data, click **Save Profile**.
5. Go to **My Documents**, upload a few files:
   - Choose a document type (e.g., `passport`, `offer_letter`, etc.)
   - Choose a file from your system
   - Click **Upload**

### 2. Admin review flow

1. Log out as candidate.
2. Log in at `/login` using the admin credentials:

   - Email: `admin@example.com`
   - Password: `admin123`

3. You will be taken to `/admin/candidates`:
   - You should see the candidate you just created.
4. Click **Open** on a candidate row:
   - You’ll see profile info.
   - You’ll see the uploaded documents list (with links to open them).
5. In the Verification panel:
   - Change status to `verified` (or any other status),
   - Set a level (`silver`, `gold`, etc.),
   - Optionally set a risk score and notes.
   - Click **Save Verification**.

### 3. Employer flow

1. Log out as admin.
2. Go to `http://localhost:3000/employer/register`.
3. Register as an **employer** with a work email + password.
4. Log in at `/login` with that employer account.
5. You will be redirected to `/employer/candidates`:
   - You will see only **verified** candidates.
6. Click **Open** on any candidate:
   - You see a read-only profile view (name, headline, skills, experience, links).
   - You see their email so you can contact them (in a real product, this can be paywalled).

### 4. Candidate sees updates

1. Log out as employer.
2. Log back in as the candidate.
3. On **My Profile**, you should now see:
   - Updated verification status
   - Verification level
   - Risk score
   - Any admin notes

That’s the full MVP loop working: **candidate → admin verification → employer discovery**.

## Notes

- Uploaded files are stored in the `uploads` folder and served via `/uploads/<filename>`.
- This is a basic MVP for local testing and not hardened for production (no CSRF protection, minimal validation, etc.).
- Once you are happy with the flow, you can:
  - Move storage to S3,
  - Add more security and logging,
  - Add payments (Stripe) for employer access,
  - Build out more advanced verification flags,
  - Then wrap this in a proper LLC and domain.
