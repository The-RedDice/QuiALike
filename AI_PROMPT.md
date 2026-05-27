# TikTok Guesser - AI Reconstruction Prompt

This document contains all the necessary instructions and context for an AI (like ChatGPT, Claude, etc.) to recreate this project from scratch. You can copy and paste the contents below into an AI prompt.

---
**PROMPT STARTER:**

"I want to build a multiplayer party game called 'QuiALiké' (TikTok Guesser). Act as an expert Full-Stack Software Engineer. Your task is to build this application based on the following requirements and architecture.

### 1. Project Overview
**Game Concept:** Players join a room. They submit links to TikTok videos they have recently liked. The game mixes all submitted videos, plays them one by one, and players must guess *who* among them liked the video.
**Language:** The application's UI must be entirely in French, with a minimalist design.
**Tech Stack:**
- Frontend: Next.js 15 (App Router), React 19, Tailwind CSS.
- Backend: Express, Socket.io (for real-time multiplayer).
- Execution/Server: A custom `server.ts` file that hosts both the Express/Socket.io API and the Next.js application simultaneously using `tsx`.
- Target Environment: Oracle Cloud VPS (Ubuntu).

### 2. Core Architecture & Networking
- The project must use a unified `server.ts` file. Do not use Next.js API routes for WebSockets; bind Socket.io directly to the Express HTTP server, and use Next.js's request handler (`app.getRequestHandler()`) for all other routes.
- **Critical Oracle VPS Requirement:** The Next.js initialization `next({ hostname: "0.0.0.0" })` and the Express `server.listen(port, "0.0.0.0")` MUST explicitly bind to `0.0.0.0`.
- Before Next.js initializes, forcefully delete `process.env.HOSTNAME` and `process.env.HOST` (e.g., `delete process.env.HOSTNAME;`) to prevent Next.js from attempting to bind to the public IP, which causes fatal `EADDRNOTAVAIL` crashes on NAT networks like Oracle Cloud.

### 3. Application Flow & Features

**A. Authentication (Simulated / Scraped):**
- Do NOT use the official TikTok OAuth API.
- Create an Express API route `/api/profile/:username` that fetches the raw HTML of `https://www.tiktok.com/@username`.
- Parse the HTML (using regex or a lightweight parser) to extract the profile picture URL (look for `<meta property="og:image" content="...">`).
- If the request is blocked by TikTok or fails, provide a fallback/generic avatar URL.
- On the frontend (`TikTokLogin` component), the user simply types their username, clicks a button, and the app fetches their avatar and logs them in via React state/cookies.

**B. Multiplayer Lobby (Socket.io):**
- Players can 'Create' or 'Join' a room using a short 6-character alphanumeric code.
- Inside the lobby, before the game starts, *each* player must be presented with input fields to paste 2 or 3 TikTok video URLs.
- The Host has a 'Start Game' button that is only clickable once everyone has submitted their videos.

**C. Game Loop (Socket.io):**
- The server collects all submitted videos, shuffles them, and keeps track of which player(s) submitted which video.
- **Phase 1 (Video Playback):** The server broadcasts the first video URL. The frontend renders it (e.g., using a generic video player or an iframe).
- **Phase 2 (Voting):** Players see the avatars of everyone in the room and must click on the person they think liked the video. The server tracks the time taken to answer.
- **Phase 3 (Results):** The server calculates points based on speed for correct answers and reveals the true owner(s) of the video.
- Repeat until all videos are shown.
- **Phase 4 (Leaderboard):** The final scores are displayed.

### 4. Design & UI
- Use Tailwind CSS.
- Color Palette: Minimalist black, white, and light grays, using TikTok's signature brand colors (Cyan `#00f2fe` and Red `#fe2c55`) for accents and primary buttons.
- The UI should be heavily rounded, modern, and mobile-first.

Please generate the `package.json`, the `server.ts` file, and the core Next.js frontend pages and components to kickstart this project."