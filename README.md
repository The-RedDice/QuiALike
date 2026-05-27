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
# Optionnel : changer le port (3000 par défaut)
PORT=3000
# Optionnel : changer le nom d'hôte affiché dans l'application (localhost par défaut).
# Sur votre VPS Oracle, mettez votre nom de domaine ou IP publique pour l'affichage (ex: SERVER_IP=141.145.200.136).
# IMPORTANT: Ne JAMAIS utiliser les variables `HOSTNAME` ou `HOST` avec votre IP publique sur un VPS Oracle. Cela cause l'erreur `EADDRNOTAVAIL` car Next.js tentera de s'attacher à cette adresse externe. Le code efface désormais ces variables s'il les détecte, garantissant une liaison sur 0.0.0.0.
SERVER_IP=localhost
```

### 3. Local Development

Install dependencies and start the development server:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser.

## Deploying on an Oracle VM

Oracle Cloud VPS uses a NAT network. Your server does not directly know its public IP address (`141.145.200.136`).
If you try to bind Node.js directly to the public IP, it will crash with an `EADDRNOTAVAIL` error.

The code is already configured to automatically bind to `0.0.0.0` (all interfaces) to bypass this issue, but you still need to open the ports on Oracle's firewall and run the application in the background.

### Prerequisites on your Server

1. SSH into your Oracle server.
2. Install Node.js (v18+) and npm.
3. Install `pm2` globally to keep the app running forever:
   ```bash
   sudo npm install -g pm2
   ```

### 1. Open Ports in Oracle Cloud
By default, Oracle Cloud blocks inbound traffic. You need to open your chosen port (e.g., `8443` or `3000`):
1. Go to your Oracle Cloud Dashboard.
2. Navigate to **Networking > Virtual Cloud Networks**.
3. Select your VCN, then your Subnet.
4. Click on your **Security List**.
5. Add an Ingress Rule:
   - Source CIDR: `0.0.0.0/0`
   - Destination Port Range: `8443` (or whatever port you are using).

You may also need to open it in Ubuntu's internal firewall (iptables/ufw):
```bash
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 8443 -j ACCEPT
sudo netfilter-persistent save
# OR if using UFW:
sudo ufw allow 8443
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
