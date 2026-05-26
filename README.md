# TikTok Guesser

TikTok Guesser is a multiplayer party game where you and your friends guess who among you liked which TikTok videos. Built with Next.js, Express, Socket.io, and Tailwind CSS.

## How to Play

1. **Go to the site**: Visit the deployed application URL.
2. **Log in with TikTok**: Click the "Se connecter avec TikTok" button. This redirects you to TikTok to authorize the app. Once authorized, it retrieves your actual TikTok username and profile picture.
3. **Create or Join a Room**:
   - **Host**: Click "Créer une partie" to generate a unique room code.
   - **Player**: Enter the room code provided by the host and click "Rejoindre".
4. **Play**: Once all players have joined, the host can start the game!

## Setup Instructions

### 1. TikTok Developer App Setup

To enable real TikTok authentication, you need to create an application on the TikTok Developer Portal:

1. Go to [TikTok for Developers](https://developers.tiktok.com/) and log in.
2. Navigate to "My Apps" and click "Create an App".
3. Choose "Web" as your platform.
4. Fill in the required details (App Name, Icon, Description).
5. In the **Redirect Domain** and **Redirect URI** sections, add your application's URLs:
   - For local development: `http://localhost:3000/api/auth/tiktok/callback`
   - For production: `https://your-domain.com/api/auth/tiktok/callback`
6. Make sure to request the `user.info.basic` scope.
7. Once your app is created, copy the **Client Key** and **Client Secret**.

### 2. Environment Variables

Create a `.env` file in the root of your project and add the following:

```env
TIKTOK_CLIENT_KEY=your_tiktok_client_key
TIKTOK_CLIENT_SECRET=your_tiktok_client_secret
# Use your production domain when deploying, e.g., https://my-game.com/api/auth/tiktok/callback
TIKTOK_REDIRECT_URI=http://localhost:3000/api/auth/tiktok/callback
```

### 3. Local Development

Install dependencies and start the development server:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser.

## Deploying on an Oracle VM (or any Linux VPS)

To deploy the game on your Oracle server and ensure it keeps running after you close your SSH session (console), we use `pm2`.

### Prerequisites on your Server

1. SSH into your Oracle server.
2. Install Node.js and npm (if not already installed).
3. Install `pm2` globally:
   ```bash
   sudo npm install -g pm2
   ```

### Deployment Steps

1. **Clone the repository**:
   ```bash
   git clone <your-repository-url>
   cd tiktok-guesser
   ```

2. **Configure environment variables**:
   Create a `.env` file and add your TikTok credentials and production callback URL:
   ```bash
   nano .env
   ```
   *(Paste your env variables, then save and exit)*

3. **Install dependencies and build the project**:
   ```bash
   npm install
   npm run build
   ```

4. **Start the application with PM2**:
   This runs your custom `server.ts` file in production mode.
   ```bash
   pm2 start npm --name "tiktok-guesser" -- run start
   ```

5. **Ensure PM2 restarts on server reboot**:
   ```bash
   pm2 startup
   ```
   *(Run the command that PM2 outputs, then save the current process list)*:
   ```bash
   pm2 save
   ```

Now, your application is running in the background and will stay alive even if you close the terminal!

### Reverse Proxy (Optional but recommended)
Usually, apps run on port `3000`. To access it via standard HTTP/HTTPS ports (80/443) without typing `:3000` in the URL, set up **Nginx** or **Caddy** as a reverse proxy.
