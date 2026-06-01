# 🛶 Co-Tripper — Planificateur de Voyage Coordonné

Ce projet est une application web collaborative et innovante conçue pour simplifier la planification et la coordination de voyages en groupe. Grâce à des outils interactifs en temps réel et une approche axée sur l'expérience utilisateur, l'organisation collective devient fluide, démocratique et visuelle.

---

## 🎯 But du Projet

L'organisation d'un voyage à plusieurs est souvent un casse-tête (disponibilités divergentes, désaccords sur le budget ou les destinations, éparpillement des idées, etc.).

**Co-Tripper** résout ce problème en centralisant toutes les étapes de la préparation au même endroit :
1. **Trouver les meilleures dates** en superposant visuellement les disponibilités de chacun.
2. **Décider ensemble de la destination** grâce à un système démocratique de vote.
3. **Maîtriser le budget individuel** de manière transparente, interactive et en temps réel.
4. **Co-construire l'itinéraire** et les activités au programme.
5. **Centraliser les échanges et documents** (chat d'équipe, photos, billets, réservations).

Le tout avec une interface moderne, fluide, animée, et compatible avec un usage **hors-ligne (offline-first)**.

---

## 🚀 Fonctionnalités Réalisées jusqu'à présent

### 1. 👥 Simulation Multi-Utilisateur & Profils Intuitifs
* **Création de profil à la volée** : Formulaire permettant de créer son profil voyageur en choisissant un avatar emoji personnalisé ou un avatar généré selon son prénom.
* **Simulateur d'identité contextuel** : Module interactif permettant d'alterner instantanément entre différents voyageurs simulés du groupe (Adrien, Chloé, Emma, etc.) pour tester l'overlay des dates et cumuler des votes en direct.
* **Partage et simulation d'invitation** : Génération de liens de partage instantanés et invitations par e-mail fictives. La validation d'une invitation simule automatiquement l'arrivée d'un nouvel ami actif avec ses propres disponibilités et un message de bienvenue personnalisé dans le chat.

### 2. 🗓️ Optimisation des Dates (Calendrier de Disponibilités)
* **Saisie intuitive** : Chaque voyageur peut renseigner son intervalle de départ préféré.
* **Visualisation par superposition** : Un calendrier met en surbrillance automatique les **jours d'intersection commune optimaux** où le maximum d'amis sont disponibles simultanément.

### 3. 💰 Budget Interactif par Participant
* **Calculateur en temps réel** : Débrayage d'un menu déroulant de budget estimé par voyageur prenant en compte :
  * Les coûts d'hébergement ajustés sur la durée du séjour.
  * Les coûts de transports locaux journaliers.
  * La somme des prix des activités d'ores et déjà votées et prévues au programme.
* **Ajusteur de Transport Principal (A/R)** : Curseur interactif permettant à chaque voyageur de simuler et mettre à jour immédiatement le coût estimé de ses billets d'avion ou de train.

### 4. 🗳️ Démocratie de Groupe : Vote de Destinations & Activités
* **Vote de destinations** : Liste de propositions avec indicateurs de niveau de vie (Économique, Standard, Premium) et vote à un clic par les participants.
* **Suggestion de programme** : Ajout d'activités qualifiées par type (Culture, Nature, Détente, Sport) et soumises aux avis de l'équipe pour être planifiées dans l'itinéraire.

### 5. 💬 Messagerie Intégrée & Journal de Bord
* **Chat de groupe interactif** : Envoi de messages enrichis et d'émojis.
* **Automation relationnelle** : Messages émis dynamiquement par les amis simulés lorsqu'ils rejoignent le projet pour saluer le groupe de voyageurs.

### 6. 📂 Partage de Médias & Documents
* Un espace sécurisé pour stocker les pièces jointes importantes (cartes d'embarquement, réservations d'hôtel) et un carrousel d'inspiration de jolies photos partagées pour le brainstorming visuel.

### 7. 🔌 Mode Hors-Ligne (Offline Space)
* **Indicateur d'état réseau** : Un interrupteur dynamique permettant de passer l'application en mode déconnecté.
* **Persistance Locale** : L'ensemble des données (voyages, membres, votes, messages) est synchronisé et stocké de manière robuste dans le `localStorage` de l'utilisateur pour préserver toutes ses modifications même sans accès Internet.

---

## 🛠️ Architecture Technique

* **Front-end** : [React 18+](https://react.dev/) avec configuration d'applications modernes rapides en [Vite](https://vitejs.dev/).
* **Styling** : [Tailwind CSS v4](https://tailwindcss.com/) pour un design fluide, élégant et entièrement responsive (Mobile / Tablette / Desktop).
* **Icônes** : [Lucide React](https://lucide.dev/) pour une sémiologie visuelle cohérente et épurée.
* **State Management** : Hooks d'états réactifs synchronisés en temps réel avec persistance locale (`localStorage`).
* **Type Safety** : Intégration stricte de [TypeScript](https://www.typescriptlang.org/) garantissant la robustesse logicielle et l'absence totale de bugs à la compilation.
