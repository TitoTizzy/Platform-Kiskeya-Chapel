// js/nav.js
// Sidebar dynamique + notifications temps réel.
// À utiliser sur toutes les pages protégées (après requireAuth).

import { db, auth } from './firebase-config.js';
import { ROLES, logout } from './auth-guard.js';
import {
    collection, query, where, onSnapshot, getDocs
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

/**
 * Catalogue des liens de navigation, avec rôle minimum requis.
 * notifKey = identifie le type de notif (compteur dynamique).
 */
const NAV_LINKS = [
    {
        id: 'dashboard',
        href: 'dashboard.html',
        title: 'Dashboard',
        minRole: 'joueur',
        order: 10,
        svg: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline>'
    },
    {
        id: 'classement',
        href: 'classement.html',
        title: 'Classements',
        minRole: 'joueur',
        order: 20,
        svg: '<line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line>'
    },
    {
        id: 'communaute',
        href: 'communaute.html',
        title: 'Communauté',
        minRole: 'joueur',
        order: 30,
        svg: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path>'
    },
    {
        id: 'vote',
        href: 'vote.html',
        title: 'Vote',
        minRole: 'joueur',
        notifKey: 'voteOuvert',
        order: 40,
        svg: '<polyline points="9 11 12 14 22 4"></polyline><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>'
    },
    {
        id: 'admin-match',
        href: 'admin-match.html',
        title: 'Saisie Match',
        minRole: 'admin',
        notifKey: 'matchsAValider',
        order: 100,
        svg: '<path d="M12 2v6M12 22v-2M5 12H3M21 12h-2M7 7l-1.5-1.5M16.5 16.5L18 18M7 17l-1.5 1.5M16.5 7.5L18 6"></path><circle cx="12" cy="12" r="5"></circle>'
    },
    {
        id: 'admin-finance',
        href: 'admin-finance.html',
        title: 'Trésorerie',
        minRole: 'tresorier',
        notifKey: 'retards',
        order: 110,
        svg: '<line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>'
    },
    {
        id: 'admin-players',
        href: 'admin-players.html',
        title: 'Joueurs',
        minRole: 'admin',
        notifKey: 'pendingSignups',
        order: 120,
        svg: '<path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><line x1="20" y1="8" x2="20" y2="14"></line><line x1="23" y1="11" x2="17" y2="11"></line>'
    }
];

/**
 * Met à jour le contenu et la couleur d'un badge de notification.
 * @param {string} notifKey - clé du badge
 * @param {number|string} count - valeur (0 = caché)
 * @param {string} level - 'alert' (rouge) | 'warn' (orange) | 'info' (bleu)
 * @param {string} tooltip - texte au survol
 */
function updateBadge(notifKey, count, level = 'alert', tooltip = '') {
    const badges = document.querySelectorAll(`[data-notif="${notifKey}"]`);
    badges.forEach(b => {
        const num = (typeof count === 'number') ? count : 0;
        const show = (typeof count === 'string' && count) || num > 0;
        if (show) {
            b.textContent = String(count);
            b.dataset.level = level || 'alert';
            if (tooltip) b.title = tooltip;
            b.hidden = false;
        } else {
            b.hidden = true;
        }
    });
}

let activeWatchers = [];

/**
 * Démarre le bon watcher selon la clé.
 */
function startWatcher(notifKey, session) {
    switch (notifKey) {
        case 'pendingSignups': return watchPendingSignups();
        case 'matchsAValider': return watchMatchsAValider();
        case 'retards':        return watchRetards();
        case 'voteOuvert':     return watchVoteOuvert(session);
    }
}

/**
 * Surveille en temps réel le nombre d'inscriptions pending.
 */
function watchPendingSignups() {
    try {
        const q = query(collection(db, "pending_signups"), where("status", "==", "pending"));
        const unsub = onSnapshot(q, (snap) => {
            const count = snap.size;
            updateBadge('pendingSignups', count, 'alert',
                count === 1 ? '1 inscription en attente' : `${count} inscriptions en attente`);

            // Maj du titre du document
            if (location.pathname.endsWith('admin-players.html')) {
                document.title = (count > 0 ? `(${count}) ` : '') + 'Gestion des Joueurs | Passion Football';
            }
        }, err => console.warn("pending_signups:", err.message));
        activeWatchers.push(unsub);
    } catch (e) { console.warn(e); }
}

/**
 * Matchs avec vote fermé mais pas encore validés (à saisir par admin).
 */
function watchMatchsAValider() {
    try {
        const q = query(collection(db, "matchs"), where("statut", "==", "vote_ferme"));
        const unsub = onSnapshot(q, (snap) => {
            const count = snap.size;
            updateBadge('matchsAValider', count, 'warn',
                count === 1 ? '1 match à valider' : `${count} matchs à valider`);
        }, err => console.warn("matchs:", err.message));
        activeWatchers.push(unsub);
    } catch (e) { console.warn(e); }
}

/**
 * Joueurs en retard de paiement (mois_retard >= 1).
 * Niveau alert si au moins un joueur >= 3 mois (sanction niveau 2),
 * sinon warn (orange).
 */
function watchRetards() {
    try {
        const q = query(collection(db, "users"), where("mois_retard", ">=", 1));
        const unsub = onSnapshot(q, (snap) => {
            let maxRetard = 0, count3plus = 0;
            snap.forEach(d => {
                const r = d.data().mois_retard || 0;
                if (r > maxRetard) maxRetard = r;
                if (r >= 3) count3plus++;
            });
            const level = maxRetard >= 3 ? 'alert' : 'warn';
            const tooltip = snap.size === 0
                ? ''
                : `${snap.size} joueur(s) en retard${count3plus > 0 ? ` — dont ${count3plus} avec accès restreint` : ''}`;
            updateBadge('retards', snap.size, level, tooltip);
        }, err => console.warn("retards:", err.message));
        activeWatchers.push(unsub);
    } catch (e) { console.warn(e); }
}

/**
 * Vote ouvert : indicateur "!" pour le joueur s'il n'a pas encore voté.
 * Pour les admins/superadmin : aussi le compteur de votes reçus.
 */
function watchVoteOuvert(session) {
    try {
        const q = query(collection(db, "matchs"), where("statut", "==", "vote_ouvert"));
        const unsub = onSnapshot(q, async (snap) => {
            if (snap.empty) { updateBadge('voteOuvert', 0); return; }

            // Trouve le match avec vote actif (close_at > now)
            const now = Date.now();
            let active = null;
            snap.forEach(d => {
                const data = d.data();
                const close = data.vote_close_at?.toMillis ? data.vote_close_at.toMillis() : 0;
                if (close > now) active = { id: d.id, ...data };
            });
            if (!active) { updateBadge('voteOuvert', 0); return; }

            // Le joueur a-t-il déjà voté ?
            try {
                const vQ = query(collection(db, "votes"),
                    where("match_date", "==", active.id),
                    where("voter_id", "==", session.profileId));
                const vSnap = await getDocs(vQ);
                if (vSnap.empty) {
                    // PAS voté → badge "!" en jaune
                    updateBadge('voteOuvert', '!', 'warn',
                        `Vote ouvert pour le ${active.id} — clique pour voter`);
                } else {
                    // Déjà voté
                    updateBadge('voteOuvert', 0);
                }
            } catch (e) {
                // Fallback : juste indiquer qu'un vote est ouvert
                updateBadge('voteOuvert', '!', 'warn', `Vote ouvert pour le ${active.id}`);
            }
        }, err => console.warn("votes:", err.message));
        activeWatchers.push(unsub);
    } catch (e) { console.warn(e); }
}

/**
 * Injecte la sidebar dans <nav class="side-nav" id="sideNav"> selon le rôle.
 * @param {Object} session - retour de requireAuth
 */
export function injectSidebar(session) {
    const nav = document.getElementById('sideNav');
    if (!nav) {
        console.warn('Aucun #sideNav trouvé sur la page.');
        return;
    }

    const roleLevel = ROLES[session.role] ?? 0;
    const currentPage = (location.pathname.split('/').pop() || 'dashboard.html');

    // Filtrer les liens selon le rôle, trier
    const links = NAV_LINKS
        .filter(l => roleLevel >= (ROLES[l.minRole] ?? 0))
        .sort((a, b) => a.order - b.order);

    const linksHtml = links.map(l => {
        const isActive = currentPage === l.href;
        const notifSpan = l.notifKey ? `<span class="nav-notif" data-notif="${l.notifKey}" data-level="alert" hidden>0</span>` : '';
        return `
            <a href="${l.href}" class="${isActive ? 'active' : ''}" title="${l.title}" data-nav-id="${l.id}">
                <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">${l.svg}</svg>
                ${notifSpan}
            </a>`;
    }).join('');

    nav.innerHTML = `
        <a href="dashboard.html" class="nav-logo" title="Accueil">P<span>F</span></a>
        <div class="nav-links">${linksHtml}</div>
        <a href="#" class="logout" title="Déconnexion">
            <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16 17 21 12 16 7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
        </a>`;

    // Câbler le logout
    nav.querySelector('.logout').addEventListener('click', (e) => {
        e.preventDefault();
        logout();
    });

    // Démarrer les watchers de notifications visibles
    const visibleNotifKeys = links.filter(l => l.notifKey).map(l => l.notifKey);
    visibleNotifKeys.forEach(key => startWatcher(key, session));
}
