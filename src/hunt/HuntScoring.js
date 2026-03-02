const ASSIST_WINDOW_SECONDS = 8;

function getNowSeconds() {
    if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
        return performance.now() * 0.001;
    }
    return Date.now() * 0.001;
}

function getPlayerLabel(player) {
    if (!player) return 'Unknown';
    return player.isBot ? `Bot ${player.index + 1}` : `P${player.index + 1}`;
}

export class HuntScoring {
    constructor() {
        this._statsByPlayer = new Map();
        this._damageHistoryByTarget = new Map();
    }

    reset() {
        this._statsByPlayer.clear();
        this._damageHistoryByTarget.clear();
    }

    _ensureStats(playerIndex) {
        if (!this._statsByPlayer.has(playerIndex)) {
            this._statsByPlayer.set(playerIndex, {
                kills: 0,
                assists: 0,
                deaths: 0,
                damage: 0,
            });
        }
        return this._statsByPlayer.get(playerIndex);
    }

    registerDamage(sourcePlayer, targetPlayer, damageResult, nowSeconds = getNowSeconds()) {
        const sourceIndex = sourcePlayer?.index;
        const targetIndex = targetPlayer?.index;
        if (!Number.isInteger(sourceIndex) || !Number.isInteger(targetIndex) || sourceIndex === targetIndex) {
            return;
        }

        const applied = Math.max(0, Number(damageResult?.applied) || 0);
        if (applied <= 0) return;

        const sourceStats = this._ensureStats(sourceIndex);
        sourceStats.damage += applied;

        if (!this._damageHistoryByTarget.has(targetIndex)) {
            this._damageHistoryByTarget.set(targetIndex, new Map());
        }
        const byAttacker = this._damageHistoryByTarget.get(targetIndex);
        const existing = byAttacker.get(sourceIndex) || { damage: 0, lastHitAt: nowSeconds };
        existing.damage += applied;
        existing.lastHitAt = nowSeconds;
        byAttacker.set(sourceIndex, existing);
    }

    registerElimination(targetPlayer, options = {}) {
        const targetIndex = targetPlayer?.index;
        if (!Number.isInteger(targetIndex)) return;

        const nowSeconds = Number.isFinite(options.nowSeconds) ? options.nowSeconds : getNowSeconds();
        const killerIndex = Number.isInteger(options?.killer?.index) ? options.killer.index : -1;

        const targetStats = this._ensureStats(targetIndex);
        targetStats.deaths += 1;

        if (killerIndex >= 0 && killerIndex !== targetIndex) {
            const killerStats = this._ensureStats(killerIndex);
            killerStats.kills += 1;
        }

        const damageHistory = this._damageHistoryByTarget.get(targetIndex);
        if (damageHistory) {
            for (const [attackerIndex, entry] of damageHistory.entries()) {
                if (!Number.isInteger(attackerIndex) || attackerIndex === killerIndex || attackerIndex === targetIndex) {
                    continue;
                }
                const lastHitAt = Number(entry?.lastHitAt) || 0;
                if ((nowSeconds - lastHitAt) > ASSIST_WINDOW_SECONDS) {
                    continue;
                }
                const assistStats = this._ensureStats(attackerIndex);
                assistStats.assists += 1;
            }
        }

        this._damageHistoryByTarget.delete(targetIndex);
    }

    getScoreboard(players = []) {
        const rows = [];
        for (const player of players) {
            if (!player || !Number.isInteger(player.index)) continue;
            const stats = this._ensureStats(player.index);
            rows.push({
                playerIndex: player.index,
                label: getPlayerLabel(player),
                kills: stats.kills,
                assists: stats.assists,
                deaths: stats.deaths,
                damage: Math.round(stats.damage),
            });
        }

        rows.sort((a, b) => (
            b.kills - a.kills ||
            b.assists - a.assists ||
            b.damage - a.damage ||
            a.playerIndex - b.playerIndex
        ));
        return rows;
    }

    formatSummary(players = [], options = {}) {
        const maxEntries = Math.max(1, Number(options.maxEntries) || 3);
        const rows = this.getScoreboard(players).slice(0, maxEntries);
        if (rows.length === 0) return '';
        return rows
            .map((entry) => `${entry.label} K${entry.kills}/A${entry.assists}/Dmg${entry.damage}`)
            .join(' | ');
    }
}
