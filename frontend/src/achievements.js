/* ────────────────────────────────────────────────────────────────────
   Achievements — localStorage-based Achievement System
   Tracks milestones across sessions. Unlocks badges with toasts.
   Boss battle survival, metric thresholds, trade count milestones.
   ──────────────────────────────────────────────────────────────────── */

const STORAGE_KEY = 'cartridgelab_achievements';

const ACHIEVEMENT_DEFS = {
    sharpe_ace: { title: 'Sharpe Ace', icon: '🎯', desc: 'Sharpe Ratio > 1.5' },
    sharpe_legend: { title: 'Sharpe Legend', icon: '👑', desc: 'Sharpe Ratio > 2.5' },
    iron_stomach: { title: 'Iron Stomach', icon: '🛡️', desc: 'Max Drawdown < 10%' },
    trade_machine: { title: 'Trade Machine', icon: '⚡', desc: '100+ trades in a single run' },
    first_blood: { title: 'First Blood', icon: '🩸', desc: 'Complete your first backtest' },
    boss_black_mon: { title: 'Black Monday Vet', icon: '🏴', desc: 'Survived Black Monday 1987' },
    boss_dotcom: { title: 'Dot-Com Survivor', icon: '💻', desc: 'Survived the Dot-Com Burst' },
    boss_gfc: { title: 'GFC Ironclad', icon: '🏦', desc: 'Survived the 2008 Crisis' },
    boss_covid: { title: 'COVID Immune', icon: '🦠', desc: 'Survived the COVID Crash' },
    boss_volmaged: { title: 'Vol Tamer', icon: '🌪️', desc: 'Survived Volmageddon' },
    profit_machine: { title: 'Profit Machine', icon: '💰', desc: 'Profit Factor > 2.0' },
    cartridge_vet: { title: 'Cartridge Veteran', icon: '🎮', desc: '10+ backtests completed' },
    golden_patina: { title: 'Golden Patina', icon: '✨', desc: '25+ backtests completed' },
    fusion_master: { title: 'Fusion Master', icon: '🧬', desc: 'Created your first hybrid strategy' },
};

function loadAchievements() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch {
        return {};
    }
}

function saveAchievements(achievements) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(achievements));
    } catch {
        /* localStorage full or private browsing */
    }
}

export function getUnlockedAchievements() {
    return loadAchievements();
}

export function isUnlocked(achievementId) {
    const achievements = loadAchievements();
    return Boolean(achievements[achievementId]);
}

export function unlockAchievement(achievementId) {
    if (isUnlocked(achievementId)) {
        return false; // already unlocked
    }

    const def = ACHIEVEMENT_DEFS[achievementId];
    if (!def) {
        return false;
    }

    const achievements = loadAchievements();
    achievements[achievementId] = {
        unlockedAt: Date.now(),
        title: def.title,
    };
    saveAchievements(achievements);

    showAchievementToast(def);
    return true;
}

export function checkAchievements(results, bossId = null) {
    const unlocked = [];

    /* first blood */
    if (unlockAchievement('first_blood')) {
        unlocked.push('first_blood');
    }

    const sharpe = Number(results?.sharpe ?? 0);
    const maxDD = Math.abs(Number(results?.max_drawdown ?? 0));
    const tradeCount = (results?.trades || []).length;
    const profitFactor = Number(results?.profit_factor ?? 0);

    if (sharpe > 1.5 && unlockAchievement('sharpe_ace')) {
        unlocked.push('sharpe_ace');
    }
    if (sharpe > 2.5 && unlockAchievement('sharpe_legend')) {
        unlocked.push('sharpe_legend');
    }
    if (maxDD < 10 && maxDD > 0 && unlockAchievement('iron_stomach')) {
        unlocked.push('iron_stomach');
    }
    if (tradeCount >= 100 && unlockAchievement('trade_machine')) {
        unlocked.push('trade_machine');
    }
    if (profitFactor > 2.0 && unlockAchievement('profit_machine')) {
        unlocked.push('profit_machine');
    }

    /* boss battles */
    const bossMap = {
        black_monday: 'boss_black_mon',
        dotcom: 'boss_dotcom',
        gfc_2008: 'boss_gfc',
        covid_crash: 'boss_covid',
        volmageddon: 'boss_volmaged',
    };

    if (bossId && bossMap[bossId]) {
        const totalReturn = Number(results?.total_return ?? -100);
        if (totalReturn > -25) { // survived if didn't lose more than 25%
            if (unlockAchievement(bossMap[bossId])) {
                unlocked.push(bossMap[bossId]);
            }
        }
    }

    /* run count milestones */
    const runCount = incrementRunCount();
    if (runCount >= 10 && unlockAchievement('cartridge_vet')) {
        unlocked.push('cartridge_vet');
    }
    if (runCount >= 25 && unlockAchievement('golden_patina')) {
        unlocked.push('golden_patina');
    }

    return unlocked;
}

function incrementRunCount() {
    try {
        const count = Number(localStorage.getItem('cartridgelab_run_count') || 0) + 1;
        localStorage.setItem('cartridgelab_run_count', String(count));
        return count;
    } catch {
        return 1;
    }
}

/* ────────────────────────────────────────────────────────────────────
   Achievement Toast — animated popup
   ──────────────────────────────────────────────────────────────────── */
function showAchievementToast(def) {
    const toast = document.createElement('div');
    toast.className = 'achievement-toast';
    toast.innerHTML = `
        <div class="achievement-toast-icon">${def.icon}</div>
        <div class="achievement-toast-body">
            <div class="achievement-toast-title">ACHIEVEMENT UNLOCKED</div>
            <div class="achievement-toast-name">${def.title}</div>
            <div class="achievement-toast-desc">${def.desc}</div>
        </div>
    `;

    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('is-visible'));

    setTimeout(() => {
        toast.classList.remove('is-visible');
        setTimeout(() => toast.remove(), 500);
    }, 4000);
}

export function getAchievementDefs() {
    return ACHIEVEMENT_DEFS;
}
