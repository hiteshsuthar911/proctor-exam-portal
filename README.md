# 🏛️ Proctor Exam Portal & Candidate Registration System

A full-stack examination and proctored registration platform built with **Node.js, Express, MongoDB Atlas, and WebRTC/Broadcast streaming**. Featuring an authentic **1990s Indian Government Portal aesthetic** for the candidate registration flow, paired with an **advanced real-time Multi-Student Admin Monitoring Dashboard**.

---

## 📸 Key Features

- **🏛️ 1990s Government Portal Aesthetic**: Windows 95 classic design language, bevelled 3D borders, formal terminology, Indian government portal banners, and responsive layout.
- **📸 Live Photo Capture Unit**: Integrated camera with an oval face viewfinder guide, live preview, capture review, retake, and acceptance flow.
- **🛡️ Anti-Cheating Telemetry**: Tracks tab switching, window blur events, and exam duration, streaming alerts in real time.
- **👥 Multi-Candidate Live Grid**: Admin can monitor all active candidates simultaneously on a responsive video grid with instant infraction indicators.
- **🔑 Student ID + PIN Credential System**: Secure candidate authorization with bcrypt hashing and JWT tokens.
- **⚡ MongoDB Atlas Integration**: Cloud storage for candidate credentials, exam profiles, and completed submissions with base64 snapshot storage.
- **🚀 One-Click Render Deployment**: Ready for GitHub deployment with `render.yaml` configuration.

---

## 📁 Project Structure

```
├── server/
│   ├── config/
│   │   └── db.js            # MongoDB Atlas connection with auto-reconnect
│   ├── models/
│   │   ├── Student.js       # Student credentials & status schema (bcrypt PIN)
│   │   └── Submission.js    # Candidate submissions & proctoring metrics
│   ├── middleware/
│   │   └── auth.js          # JWT Bearer token authentication & role guards
│   ├── routes/
│   │   ├── auth.js          # /api/auth/admin & /api/auth/student
│   │   ├── students.js      # Student CRUD (Admin protected)
│   │   └── submissions.js   # Submissions API & photo retrieval
│   └── index.js             # Express server entry point & static file server
├── public/
│   ├── index.html           # 90s Government Candidate Registration Portal
│   ├── styles.css           # 90s government styling & responsive layout
│   ├── script.js            # Candidate registration logic, camera & streaming
│   ├── admin.html           # Advanced Admin Monitoring Dashboard
│   ├── admin.css            # Dark mode admin design system
│   └── admin.js             # Live multi-grid, student CRUD & submission management
├── .env.example             # Template for environment variables
├── .env                     # Local environment configuration (do not commit)
├── render.yaml              # Render blueprint deployment file
├── package.json             # Node dependencies and scripts
└── README.md                # Documentation & deployment guide
```

---

## 🚀 Quick Start (Local Setup)

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env` (or edit the existing `.env`):
```bash
cp .env.example .env
```

Edit `.env`:
```env
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/proctordb?retryWrites=true&w=majority
JWT_SECRET=your-secure-random-secret-key-min-32-chars
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
PORT=3000
```

### 3. Start the Server
```bash
npm start
```
Or for auto-reloading development mode:
```bash
npm run dev
```

### 4. Access the Portals
- **Candidate Registration Portal (90s UI)**: [http://localhost:3000/index.html](http://localhost:3000/index.html)
- **Admin Dashboard**: [http://localhost:3000/admin.html](http://localhost:3000/admin.html)

---

## 🍃 Setting Up Free MongoDB Atlas

1. Visit [mongodb.com/atlas](https://www.mongodb.com/cloud/atlas/register) and create a free account.
2. Click **Build a Database** and select the **M0 Free** shared cluster.
3. Select your preferred cloud provider and closest region (e.g. AWS / Mumbai or Singapore).
4. Under **Security Quickstart**:
   - Create a Database User with a Username & Password (save these credentials).
   - Under **IP Access List**, select **Allow Access from Anywhere (`0.0.0.0/0`)** (essential for Render cloud deployments).
5. Click **Connect** → **Drivers (Node.js)**.
6. Copy the connection string (format: `mongodb+srv://<username>:<password>@cluster0.abcde.mongodb.net/proctordb?retryWrites=true&w=majority`).
7. Paste it into your `.env` file for local testing and into Render for cloud hosting.

---

## 🐙 Push to GitHub

Initialize git, commit all project files, and push to your GitHub repository:

```bash
# 1. Initialize Git repository
git init

# 2. Stage all files
git add .

# 3. Commit
git commit -m "feat: Full-stack exam portal with 90s govt UI, MongoDB Atlas, and Render deployment"

# 4. Link your remote repository (replace with your repo URL)
git branch -M main
git remote add origin https://github.com/<your-github-username>/<your-repo-name>.git

# 5. Push to GitHub
git push -u origin main
```

---

## ☁️ Deploying on Render

Render hosts Node.js applications with free SSL and automatic deployments from GitHub.

### Method 1: Using the Render Dashboard (Recommended)
1. Go to [render.com](https://dashboard.render.com/) and sign in with GitHub.
2. Click **New +** → **Web Service**.
3. Select **Build and deploy from a Git repository** and connect your repository.
4. Set the following settings:
   - **Name**: `proctor-exam-portal`
   - **Environment**: `Node`
   - **Region**: Closest to your users (e.g. Singapore or Frankfurt)
   - **Branch**: `main`
   - **Build Command**: `npm install`
   - **Start Command**: `node server/index.js`
   - **Plan**: Free
5. Scroll down to **Environment Variables** and add:
   | Key | Value |
   |---|---|
   | `MONGODB_URI` | `mongodb+srv://...` (your MongoDB Atlas connection string) |
   | `JWT_SECRET` | A secure random string (minimum 32 characters) |
   | `ADMIN_USERNAME` | `admin` (or your preferred admin username) |
   | `ADMIN_PASSWORD` | `admin123` (or your preferred admin password) |
6. Click **Create Web Service**. Render will automatically build and deploy your app.

### Method 2: Using `render.yaml` Blueprint
1. Go to **Blueprints** on Render.
2. Connect your repository containing `render.yaml`.
3. Provide the secret environment variables (`MONGODB_URI`, `JWT_SECRET`) when prompted.
4. Click **Apply**.

---

## 📖 User & Administrator Workflow

### Step 1: Administrator creates candidate accounts
1. Open `https://<your-render-url>/admin.html`
2. Log in with `ADMIN_USERNAME` and `ADMIN_PASSWORD`.
3. Go to **Student Management** → Click **+ Add Student**.
4. Enter Name, Candidate ID (e.g., `STU001`), Secret PIN (4-8 digits), and Exam name.
5. Click **Save Student**.
6. A printable/copyable **Credential Card** will pop up with the generated ID and PIN to share with the student.

### Step 2: Candidate takes exam
1. Open `https://<your-render-url>/index.html`
2. Enter Candidate ID and PIN to pass the gate.
3. Camera automatically initialises.
4. Candidate fills personal information, selects State/UT to unlock District & City.
5. Clicks **Capture Live Photo**, views viewfinder guide, captures, reviews preview, and accepts.
6. Submits the form.

### Step 3: Admin monitors candidates live
1. Go to **Live Monitor** in the admin dashboard.
2. View all candidates in real-time tiles:
   - Live camera stream
   - Session duration counter
   - Tab switch / unfocus infraction counter (turns yellow/red upon infraction)
   - Real-time audit log
3. Go to **Submissions** to review all completed candidate forms, timestamps, and accepted photos.

---

## 🔒 Security Best Practices

- **Bcrypt PIN Hashing**: All student PINs are securely hashed with salts before database storage and never returned in API payloads.
- **Role-Based JWT**: Administrative and candidate routes are strictly separated using Bearer tokens.
- **Environment Isolation**: Sensitive configuration is stored in `.env` and omitted via `.gitignore`.
