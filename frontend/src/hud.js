function setMetric(id, value, suffix = '') {
    const node = document.getElementById(id);
    if (!node) {
        return;
    }

    const numeric = typeof value === 'number' ? value : Number(value);
    node.textContent = Number.isFinite(numeric) ? `${numeric}${suffix}` : '—';
    node.classList.remove('positive', 'negative');

    if (Number.isFinite(numeric)) {
        if (numeric > 0) {
            node.classList.add('positive');
        } else if (numeric < 0) {
            node.classList.add('negative');
        }
    }
}

export function initHUD() {
    const achievements = document.getElementById('achievements');
    if (achievements) {
        achievements.innerHTML = '';
    }
}

export function updateHUD(result) {
    setMetric('val-sharpe', result.sharpe);
    setMetric('val-return', result.total_return, '%');
    setMetric('val-drawdown', result.max_drawdown, '%');
    setMetric('val-winrate', result.win_rate, '%');
    setMetric('val-trades', result.total_trades);

    const achievements = document.getElementById('achievements');
    if (!achievements) {
        return;
    }

    const badges = [];
    if (result.total_return > 0) badges.push('PROFITABLE');
    if (result.sharpe >= 1) badges.push('SHARPE 1+');
    if (result.win_rate >= 50) badges.push('WINNER');
    if (result.max_drawdown <= 10) badges.push('LOW DD');

    achievements.innerHTML = '';
    badges.forEach((label) => {
        const node = document.createElement('div');
        node.className = 'achievement-badge';
        node.textContent = label;
        achievements.appendChild(node);
    });
}
