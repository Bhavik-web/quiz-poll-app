# Real-Time Quiz and Poll Application

A comprehensive, responsive, real-time polling and quiz platform built with React, Node.js, Express, Socket.io, and MongoDB.

## Features
- **Real-Time Synchronisation:** Instant question pushes and answers utilizing WebSockets.
- **Roles:** Dedicated Admin portal and touch-optimized participant view requiring no downloads or logins.
- **Dynamic Control:** Admins create rooms, orchestrate the session, and choose when to reveal results.
- **Scale:** Architecture natively supports hundreds of active socket connections dynamically.
- **Premium UI:** Built with Vite and Tailwind CSS.

## Getting Started

### Prerequisites
- Node.js (v18+)
- Local MongoDB instance or MongoDB Atlas URI.

### 1. Backend Setup
1. Navigate to `backend/` directory: `cd backend`
2. Install dependencies: `npm install`
3. Edit `.env` file with your `MONGODB_URI` and `JWT_SECRET`.
4. Start the server: `npm run dev` (Runs on `http://localhost:5000`)

### 2. Frontend Setup
1. Navigate to `frontend/` directory: `cd frontend`
2. Install dependencies: `npm install`
3. Verify `.env` points to the backend (by default it uses `http://localhost:5000/api`).
4. Start Vite: `npm run dev`

### 3. Usage
- Go to `http://localhost:5173/admin/login` (or the respective vite port).
- The first login uses a registration route internally or you can hit `POST /api/admin/register` via Postman with `{ email: 'admin@example.com', password: 'password123' }` to create an admin account. *(Note: You may want to add a register UI in frontend if preferred, currently it uses the REST API for first creation).*
- Once logged in, create a room, add questions, and start a session.
- Give the generated 6-digit code to participants (they go to the site root).

## Deployment

### Frontend (Vercel)
1. Push your repository to GitHub.
2. In Vercel, import the repository and select the `frontend` folder as the root directory.
3. Framework preset: **Vite**
4. Add environment variable `VITE_BACKEND_URL` pointing to your deployed backend URL.
5. The included `vercel.json` ensures React Router SPA works flawlessly.

### Backend (Render/Railway)
1. In Render, link your repo.
2. Select the `backend` folder as the Root Directory.
3. Build Command: `npm install`
4. Start Command: `npm start`
5. Inject the required Environment Variables (`MONGODB_URI`, `JWT_SECRET`, `NODE_ENV=production`).
6. Ensure your frontend domain is allowed if you modify CORS locally.
