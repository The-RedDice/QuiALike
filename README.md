# TikTok Guesser

TikTok Guesser is a multiplayer party game where you and your friends guess who among you liked which TikTok videos. Built with Next.js, Express, Socket.io, and Tailwind CSS.

## How to Play

1. **Go to the site**: Visit the deployed application URL.
2. **Log in**: Enter your TikTok username. The game will attempt to fetch your profile picture automatically!
3. **Submit Videos**: Once in a lobby, submit the URLs of TikTok videos you've recently liked.
4. **Create or Join a Room**:
   - **Host**: Click "Créer une partie" to generate a unique room code.
   - **Player**: Enter the room code provided by the host and click "Rejoindre".
5. **Play**: Once all players have joined and submitted their videos, the host can start the game!

## Setup Instructions

### Environment Variables

Create a `.env` file in the root of your project and add the following:

```env
# Optionnel : changer le port (3000 par défaut)
PORT=3000
# Optionnel : changer le nom d'hôte affiché dans l'application (localhost par défaut).
# Sur votre VPS Oracle, mettez votre nom de domaine ou IP publique pour l'affichage (ex: SERVER_IP=141.145.200.136).
# IMPORTANT: Ne JAMAIS utiliser les variables `HOSTNAME` ou `HOST` avec votre IP publique sur un VPS Oracle. Cela cause l'erreur `EADDRNOTAVAIL` car Next.js tentera de s'attacher à cette adresse externe. Le code efface désormais ces variables s'il les détecte, garantissant une liaison sur 0.0.0.0.
SERVER_IP=localhost
```

### Local Development

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
   Create a `.env` file and set your configuration (see Environment Variables section):
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

### Setup Automatic HTTPS with Caddy (Required for TikTok API)

TikTok requires your application to be served over a secure **HTTPS** connection for URL verification and API callbacks. Since Node.js runs over standard HTTP, the easiest way to secure it is to install **Caddy**, which will automatically provision SSL certificates for your `nip.io` domain and route traffic to your Node app.

**1. Open standard web ports (80 & 443) on Oracle:**
Follow the steps in "1. Open Ports in Oracle Cloud" above, but change the Destination Port Range to `80,443`.
Open these ports in Ubuntu as well:
```bash
sudo iptables -I INPUT 6 -m state --state NEW -p tcp -m multiport --dports 80,443 -j ACCEPT
sudo netfilter-persistent save
```

**2. Install Caddy on Ubuntu:**
```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install caddy
```

**3. Configure Caddy:**
Open the Caddy configuration file:
```bash
sudo nano /etc/caddy/Caddyfile
```
Delete everything in the file and replace it with this (replace `141.145.200.136` with your actual IP, and `8443` with the port your PM2 app is running on):
```text
141.145.200.136.nip.io {
    reverse_proxy localhost:8443
}
```
Save the file (`Ctrl+O`, `Enter`, `Ctrl+X`).

**4. Restart Caddy:**
```bash
sudo systemctl restart caddy
```

**5. Update TikTok Developer Portal:**
Now, go back to the TikTok developer portal and verify your URL without any port numbers:
`https://141.145.200.136.nip.io`
*(Note: TikTok might take a moment to verify it now that it is successfully served over HTTPS!)*
