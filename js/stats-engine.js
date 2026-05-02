// js/stats-engine.js

// 1. LE BARÈME OFFICIEL (Cahier des charges)
export const POINT_RULES = {
    victoire: 5,
    nul: 1,
    defaite: -2,
    but: 5,
    assist: 3,
    eclat: 10,
    antijeu: -10,
    mvp_1er: 10,
    mvp_2eme: 5,
    mvp_3eme: 3
};

// 2. CONFIGURATION DES POSTES
export const POSTE_CFG = {
    "Gardien":   { color: "#f59e0b", icon: "🧤" },
    "Défenseur": { color: "#10b981", icon: "🛡️" },
    "Milieu":    { color: "#3b82f6", icon: "⚙️" },
    "Attaquant": { color: "#ef4444", icon: "⚽" }
};

// 3. LE CALCULATEUR (Moteur de calcul)
export function calculerPoints(u) {
    let total = 0;
    total += (u.total_buts || 0) * POINT_RULES.but;
    total += (u.total_assists || 0) * POINT_RULES.assist;
    total += (u.eclat || 0) * POINT_RULES.eclat;
    total += (u.antijeu || 0) * POINT_RULES.antijeu;
    // Ajoute ici les autres règles (victoires, votes...)
    return total;
}