import { CONFIG } from '../../core/Config.js';
import { grantShield } from '../../hunt/HealthSystem.js';

export function removePlayerEffect(player, effect) {
    if (!player || !effect) return;

    switch (effect.type) {
        case 'SPEED_UP':
        case 'SLOW_DOWN':
            player.baseSpeed = CONFIG.PLAYER.SPEED;
            player.speed = player.baseSpeed;
            break;
        case 'THICK':
        case 'THIN':
            player.trail.resetWidth();
            break;
        case 'SHIELD':
            player.hasShield = false;
            player.shieldHP = 0;
            player.shieldHitFeedback = 0;
            break;
        case 'GHOST':
            player.isGhost = false;
            break;
        case 'INVERT':
            player.invertControls = false;
            break;
    }
}

export function updatePlayerEffects(player, dt) {
    if (!player) return;

    for (let i = player.activeEffects.length - 1; i >= 0; i--) {
        const effect = player.activeEffects[i];
        effect.remaining -= dt;

        if (effect.remaining <= 0) {
            removePlayerEffect(player, effect);
            player.activeEffects.splice(i, 1);
        }
    }

    if (player.boostPortalTimer > 0) {
        player.boostPortalTimer -= dt;
        if (player.boostPortalTimer <= 0) {
            player.boostPortalParams = null;
        }
    }
    if (player.slingshotTimer > 0) {
        player.slingshotTimer -= dt;
        if (player.slingshotTimer <= 0) {
            player.slingshotParams = null;
        }
    }
}

export function applyPlayerPowerup(player, type) {
    if (!player) return;

    const config = CONFIG.POWERUP.TYPES[type];
    if (!config) return;

    player.activeEffects = player.activeEffects.filter((effect) => {
        if (effect.type === type) {
            removePlayerEffect(player, effect);
            return false;
        }
        return true;
    });

    const nextEffect = { type, remaining: config.duration };
    player.activeEffects.push(nextEffect);

    switch (type) {
        case 'SPEED_UP':
        case 'SLOW_DOWN':
            player.baseSpeed = CONFIG.PLAYER.SPEED * config.multiplier;
            player.speed = player.baseSpeed;
            break;
        case 'THICK':
        case 'THIN':
            player.trail.setWidth(config.trailWidth);
            break;
        case 'SHIELD':
            grantShield(player);
            break;
        case 'GHOST':
            player.isGhost = true;
            break;
        case 'INVERT':
            player.invertControls = true;
            break;
    }
}
