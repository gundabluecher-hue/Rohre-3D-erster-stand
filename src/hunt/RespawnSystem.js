import { CONFIG } from '../core/Config.js';
import { isHuntHealthActive } from './HealthSystem.js';

function getLabel(player) {
    if (!player) return 'Spieler';
    return player.isBot ? `Bot ${player.index + 1}` : `P${player.index + 1}`;
}

export class RespawnSystem {
    constructor(runtimeContext) {
        this.runtime = runtimeContext || null;
        this.pendingByPlayer = new Map();
    }

    isEnabled() {
        return isHuntHealthActive() && !!CONFIG?.HUNT?.RESPAWN_ENABLED;
    }

    reset() {
        this.pendingByPlayer.clear();
    }

    onPlayerDied(player) {
        if (!this.isEnabled() || !player) return false;
        const delaySeconds = Math.max(0.1, Number(CONFIG?.HUNT?.RESPAWN?.DELAY_SECONDS || 3));
        this.pendingByPlayer.set(player.index, {
            player,
            remaining: delaySeconds,
        });
        return true;
    }

    isRespawnPending(player) {
        if (!player) return false;
        return this.pendingByPlayer.has(player.index);
    }

    getPendingCountForPlayers(players) {
        if (!Array.isArray(players) || players.length === 0) return 0;
        let count = 0;
        for (const player of players) {
            if (player && this.pendingByPlayer.has(player.index)) count++;
        }
        return count;
    }

    update(dt) {
        if (!this.isEnabled()) {
            this.pendingByPlayer.clear();
            return;
        }

        const safeDt = Math.max(0, Number(dt) || 0);
        for (const [playerIndex, pending] of this.pendingByPlayer.entries()) {
            const player = pending?.player;
            if (!player || player.alive) {
                this.pendingByPlayer.delete(playerIndex);
                continue;
            }

            pending.remaining -= safeDt;
            if (pending.remaining > 0) continue;

            const planarSpawnLevel = CONFIG.GAMEPLAY.PLANAR_MODE && this.runtime?.spawn?.getPlanarSpawnLevel
                ? this.runtime.spawn.getPlanarSpawnLevel()
                : null;
            const spawnPos = this.runtime.spawn.findSpawnPosition(12, 12, planarSpawnLevel);
            const spawnDir = this.runtime.spawn.findSafeSpawnDirection(spawnPos, player.hitboxRadius);
            player.spawn(spawnPos, spawnDir);

            const invulnerability = Math.max(0, Number(CONFIG?.HUNT?.RESPAWN?.INVULNERABILITY_SECONDS || 1));
            player.spawnProtectionTimer = Math.max(player.spawnProtectionTimer || 0, invulnerability);
            player.shootCooldown = 0;

            const recorder = this.runtime?.services?.recorder;
            if (recorder) {
                recorder.markPlayerSpawn(player);
                recorder.logEvent('RESPAWN', player.index, `delay=${Math.max(0, Number(CONFIG?.HUNT?.RESPAWN?.DELAY_SECONDS || 3)).toFixed(2)}`);
            }
            this.runtime?.events?.emitHuntFeed(`${getLabel(player)} respawned`);

            this.pendingByPlayer.delete(playerIndex);
        }
    }
}
