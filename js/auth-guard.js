// js/auth-guard.js
// Helper réutilisable pour : vérifier la session, charger le profil joueur,
// et contrôler les rôles (joueur / admin / superadmin / tresorier).

import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { collection, query, where, getDocs, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

/**
 * Hiérarchie des rôles. Plus le nombre est élevé, plus l'accès est large.
 * - joueur: 0 (par défaut)
 * - tresorier: 1 (peut gérer admin-finance)
 * - admin: 2 (peut gérer admin-match, admin-finance)
 * - superadmin: 3 (peut gérer tout, y compris les rôles)
 */
export const ROLES = {
    joueur: 0,
    tresorier: 1,
    admin: 2,
    superadmin: 3
};

/**
 * requireAuth(options)
 *  - Attend la résolution de l'état Auth.
 *  - Si pas connecté, redirige vers index.html.
 *  - Si connecté, charge le doc Firestore correspondant (par email).
 *  - Si role minimum requis et non satisfait, redirige vers dashboard.html.
 *
 *  @param {Object} options
 *  @param {string} [options.minRole]  - Rôle minimum requis ('admin', 'tresorier', 'superadmin')
 *  @param {string} [options.redirectIfUnauth='index.html']
 *  @param {string} [options.redirectIfForbidden='dashboard.html']
 *  @returns {Promise<{user, profile, role}>} - Résolu quand l'utilisateur est valide
 */
export function requireAuth(options = {}) {
    const {
        minRole = null,
        redirectIfUnauth = 'index.html',
        redirectIfForbidden = 'dashboard.html'
    } = options;

    return new Promise((resolve) => {
        onAuthStateChanged(auth, async (user) => {
            if (!user) {
                window.location.href = redirectIfUnauth;
                return;
            }

            try {
                // 1) Si l'utilisateur est dans pending_signups → bloquer + déconnecter
                const pendingRef = doc(db, "pending_signups", user.uid);
                const pendingSnap = await getDoc(pendingRef);
                if (pendingSnap.exists() && pendingSnap.data().status === 'pending') {
                    alert("Ton inscription est en attente d'approbation par l'administrateur.\nTu seras notifié dès que ton compte sera validé.");
                    await signOut(auth);
                    window.location.href = redirectIfUnauth;
                    return;
                }

                const profile = await loadUserProfile(user);
                if (!profile) {
                    console.warn("Aucun profil Firestore trouvé pour", user.email);
                    alert("Aucun profil de joueur trouvé pour ton compte. Contacte le superadmin.");
                    await signOut(auth);
                    window.location.href = redirectIfUnauth;
                    return;
                }

                // 2) Si statut explicite 'pending' ou 'rejected' sur le doc users
                if (profile.data.status === 'pending') {
                    alert("Ton compte n'est pas encore approuvé. Patience !");
                    await signOut(auth);
                    window.location.href = redirectIfUnauth;
                    return;
                }
                if (profile.data.status === 'rejected') {
                    alert("Ta demande a été refusée par l'administrateur.");
                    await signOut(auth);
                    window.location.href = redirectIfUnauth;
                    return;
                }

                const role = profile.data.role || 'joueur';
                const roleLevel = ROLES[role] ?? 0;
                const minLevel = minRole ? (ROLES[minRole] ?? 0) : 0;

                if (roleLevel < minLevel) {
                    alert("Accès restreint : vous n'avez pas les droits pour cette page.");
                    window.location.href = redirectIfForbidden;
                    return;
                }

                resolve({ user, profile: profile.data, profileId: profile.id, role });
            } catch (e) {
                console.error("Erreur chargement profil:", e);
                window.location.href = redirectIfUnauth;
            }
        });
    });
}

/**
 * Charge le document Firestore du joueur correspondant à un user Auth.
 * Stratégie de lookup :
 *   1. Si le doc users/{auth.uid} existe → l'utiliser (modèle propre).
 *   2. Sinon, chercher par email dans la collection users.
 */
export async function loadUserProfile(user) {
    if (!user) return null;

    // 1. Lookup direct par UID
    try {
        const directRef = doc(db, "users", user.uid);
        const directSnap = await getDoc(directRef);
        if (directSnap.exists()) {
            return { id: directSnap.id, data: directSnap.data() };
        }
    } catch (e) { /* ignore */ }

    // 2. Lookup par email
    if (user.email) {
        const q = query(collection(db, "users"), where("email", "==", user.email));
        const snap = await getDocs(q);
        if (!snap.empty) {
            const d = snap.docs[0];
            return { id: d.id, data: d.data() };
        }
    }
    return null;
}

/**
 * Déconnexion + redirection.
 */
export async function logout(redirectTo = 'index.html') {
    try { await signOut(auth); } catch (e) { console.error(e); }
    window.location.href = redirectTo;
}

/**
 * Branche le bouton de déconnexion d'une page (sélecteur '.logout' par défaut).
 */
export function wireLogout(selector = '.logout') {
    document.querySelectorAll(selector).forEach(el => {
        el.addEventListener('click', (e) => {
            e.preventDefault();
            logout();
        });
    });
}
