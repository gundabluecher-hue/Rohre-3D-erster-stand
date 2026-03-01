// ============================================
// BotDecisionOps.js - decision operations for BotAI
// ============================================

import { CONFIG } from '../../core/Config.js';

export function applyPortalSteering(bot, player) {
    if (!bot.state.portalIntentActive || !bot._portalTarget) return false;

    bot._tmpVec.subVectors(bot._portalTarget, player.position);
    const distSq = bot._tmpVec.lengthSq();

    if (distSq < 9) {
        bot.state.portalIntentActive = false;
        bot._portalTarget = null;
        return false;
    }

    bot._tmpVec.normalize();
    player.getDirection(bot._tmpForward).normalize();
    bot._buildBasis(bot._tmpForward);

    const yawSignal = bot._tmpRight.dot(bot._tmpVec);
    const pitchSignal = bot._tmpUp.dot(bot._tmpVec);

    bot._decision.yaw = Math.abs(yawSignal) > 0.08 ? (yawSignal > 0 ? 1 : -1) : 0;
    if (!CONFIG.GAMEPLAY.PLANAR_MODE) {
        bot._decision.pitch = Math.abs(pitchSignal) > 0.08 ? (pitchSignal > 0 ? 1 : -1) : 0;
    }

    if (distSq < 196 && bot.sense.forwardRisk < 0.75) {
        bot._decision.boost = true;
    }

    return true;
}

export function decideSteering(bot, player) {
    const best = bot.sense.bestProbe;
    if (!best) {
        bot._decision.yaw = Math.random() > 0.5 ? 1 : -1;
        bot._decision.pitch = 0;
        return;
    }

    player.getDirection(bot._tmpForward).normalize();
    bot._buildBasis(bot._tmpForward);

    const yawSignal = bot._tmpRight.dot(best.dir);
    const pitchSignal = bot._tmpUp.dot(best.dir);

    let desiredYaw = Math.abs(yawSignal) > 0.06 ? (yawSignal > 0 ? 1 : -1) : 0;
    let desiredPitch = 0;
    if (!CONFIG.GAMEPLAY.PLANAR_MODE && Math.abs(pitchSignal) > 0.08) {
        desiredPitch = pitchSignal > 0 ? 1 : -1;
    }

    if (!CONFIG.GAMEPLAY.PLANAR_MODE && desiredPitch === 0 && Math.abs(bot.sense.heightBias) > 0.15) {
        desiredPitch = bot.sense.heightBias > 0 ? 1 : -1;
    }

    if (desiredYaw === 0 && bot.sense.botRepulsionYaw !== 0) {
        desiredYaw = bot.sense.botRepulsionYaw;
    }
    if (!CONFIG.GAMEPLAY.PLANAR_MODE && desiredPitch === 0 && bot.sense.botRepulsionPitch !== 0) {
        desiredPitch = bot.sense.botRepulsionPitch;
    }

    const opennessRatio = bot.sense.lookAhead > 0
        ? bot.sense.localOpenness / bot.sense.lookAhead
        : 0.5;
    const commitScale = bot.sense.immediateDanger
        ? 0.45
        : ((bot.sense.forwardRisk > 0.72 || opennessRatio < 0.55 || bot._recentBouncePressure > 1.2) ? 0.65 : 1);
    const commitDuration = Math.max(0.08, bot.profile.turnCommitTime * commitScale);

    if (bot.state.turnCommitTimer <= 0 || bot.sense.immediateDanger) {
        bot.state.committedYaw = desiredYaw;
        bot.state.committedPitch = desiredPitch;
        if (desiredYaw !== 0 || desiredPitch !== 0) {
            bot.state.turnCommitTimer = commitDuration;
        }
    }

    if (bot.state.turnCommitTimer > 0) {
        desiredYaw = bot.state.committedYaw;
        desiredPitch = bot.state.committedPitch;
    }

    bot._decision.yaw = desiredYaw;
    bot._decision.pitch = desiredPitch;

    const aggression = bot.profile.aggression + bot.sense.mapAggressionBias;
    if (!bot.sense.immediateDanger && bot.sense.forwardRisk < 0.45) {
        if (Math.random() < bot.profile.boostChance * (0.8 + Math.max(0, aggression))) {
            bot._decision.boost = true;
        }
    }

    // Hard bots correct less randomly; easy bots keep subtle random drift.
    if (bot._profileName === 'EASY' && Math.random() < 0.08) {
        bot._decision.yaw = Math.random() > 0.5 ? 1 : -1;
    }
}

export function decideItemUsage(bot, player, itemRules) {
    if (!player.inventory || player.inventory.length === 0) return;

    let bestUseScore = -Infinity;
    let bestUseIndex = -1;
    let bestShootScore = -Infinity;
    let bestShootIndex = -1;

    const pressure = bot.sense.pressure;
    const aggression = Math.max(0, bot.profile.aggression + bot.sense.mapAggressionBias);
    const targetBonus = bot.sense.targetInFront ? 1.1 : 0.5;

    // Phase 3: Kontextvariablen
    const crashRisk = bot.sense.immediateDanger ? 1.0 : (bot.sense.forwardRisk > 0.6 ? 0.5 : 0);
    const enemyClose = bot.sense.targetDistanceSq < 100; // < 10 Einheiten
    const contextWeight = bot.profile.itemContextWeight || 0.5;

    for (let i = 0; i < player.inventory.length; i++) {
        const type = player.inventory[i];
        const rule = itemRules[type] || { self: 0, offense: 0, defensiveScale: 0, emergencyScale: 0, combatSelf: 0 };

        // Phase 3: Erweitertes Self-Scoring mit Kontext
        const selfScore = rule.self
            + pressure * rule.defensiveScale
            + crashRisk * (rule.emergencyScale || 0) * contextWeight
            + (enemyClose ? (rule.combatSelf || 0) * contextWeight : 0);
        const shootScore = rule.offense * (0.55 + aggression) * targetBonus;

        if (selfScore > bestUseScore) {
            bestUseScore = selfScore;
            bestUseIndex = i;
        }
        if (shootScore > bestShootScore) {
            bestShootScore = shootScore;
            bestShootIndex = i;
        }
    }

    if (bestUseIndex >= 0 && bestUseScore > 0.72 && bot.state.itemUseCooldown <= 0) {
        bot._decision.useItem = bestUseIndex;
        bot.state.itemUseCooldown = bot.profile.itemUseCooldown;
        return;
    }

    if (bestShootIndex >= 0 && bestShootScore > 0.45 && bot.state.itemShootCooldown <= 0) {
        bot._decision.shootItem = true;
        bot._decision.shootItemIndex = bestShootIndex;
        bot.state.itemShootCooldown = bot.profile.itemShootCooldown;
    }
}

export function runDecision(bot, dt, player, arena, allPlayers, itemRules) {
    if (bot.sense.immediateDanger && bot.state.recoveryCooldown <= 0 && bot._recentBouncePressure > 2.3) {
        bot._enterRecovery(player, arena, allPlayers, 'collision-pressure');
        if (bot._updateRecovery(dt, player, arena, allPlayers)) {
            return true;
        }
    }

    if (bot.sense.projectileThreat && bot.sense.forwardRisk < 0.6) {
        bot._decision.yaw = bot.sense.projectileEvadeYaw;
        bot._decision.pitch = bot.sense.projectileEvadePitch;
        bot._decision.boost = true;
    } else {
        const portalDriven = applyPortalSteering(bot, player);
        if (!portalDriven) {
            if (bot.sense.pursuitActive) {
                bot._decision.yaw = bot.sense.pursuitYaw;
                bot._decision.pitch = bot.sense.pursuitPitch;
                if (bot.sense.targetDistanceSq > 400) {
                    bot._decision.boost = true;
                }
                const aimTolerance = bot.profile.pursuitAimTolerance || 0.85;
                if (bot.sense.pursuitAimDot > aimTolerance && player.inventory && player.inventory.length > 0) {
                    bot._decision.shootItem = true;
                    bot._decision.shootItemIndex = 0;
                    bot.state.itemShootCooldown = bot.profile.itemShootCooldown;
                }
            } else {
                decideSteering(bot, player);
            }
        }
    }

    decideItemUsage(bot, player, itemRules);
    return false;
}
