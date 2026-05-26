# REPRISE DE PROJET : TikTok Guesser

Ce projet est une application web de jeu multijoueur en temps réel.

## Concept
Les joueurs se connectent via une simulation d'OAuth TikTok. Un "Host" crée une salle et les autres rejoignent avec un code. Le but est de deviner lequel des joueurs présents a "liké" une vidéo TikTok affichée à l'écran.

## Stack Technique
- **Frontend** : Next.js 15 (App Router), Tailwind CSS, Lucide React, Socket.io-client.
- **Backend** : Serveur Express personnalisé (`server.ts`) gérant à la fois Next.js et Socket.io.
- **Temps Réel** : Socket.io pour la gestion des salles, des votes et de la synchronisation des résultats.

## État Actuel
- Création/Rejoint de salle fonctionnel.
- Login TikTok simulé fonctionnel.
- Mécanique de jeu (Vidéo -> Vote -> Révélation -> Next) fonctionnelle.
- Les résultats sont synchronisés : ils ne s'affichent que lorsque tout le monde a voté ou que le temps est écoulé.
- Build de production validé.

## Comment continuer ?
1. **API TikTok Réelle** : Remplacer la simulation dans `src/components/TikTokLogin.tsx` et `server.ts` par les vrais flux OAuth TikTok si vous obtenez les clés API.
2. **Vraies Vidéos** : Actuellement, le jeu utilise 3 vidéos de test en boucle. Il faudrait implémenter une récupération dynamique de vidéos TikTok.
3. **Persistance** : Les scores et les salles sont stockés en mémoire sur le serveur. Pour une mise en production réelle, prévoir une base de données (Redis ou PostgreSQL).

## Commandes
- `npm run dev` : Lance le serveur de développement (Next.js + Socket.io).
- `npm run build` : Compile l'application.
- `npm run start` : Lance l'application compilée.
