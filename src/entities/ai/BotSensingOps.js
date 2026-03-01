// ============================================
// BotSensingOps.js - sensing operations for BotAI
// ============================================

import { CONFIG } from '../../core/Config.js';

export function senseEnvironment(bot, player, arena, allPlayers, _projectiles) {
    const mapBehavior = bot._mapBehavior(arena);
    bot.sense.mapCaution = mapBehavior.caution;
    bot.sense.mapPortalBias = mapBehavior.portalBias;
    bot.sense.mapAggressionBias = mapBehavior.aggressionBias;

    bot.sense.lookAhead = bot._computeDynamicLookAhead(player);

    player.getDirection(bot._tmpForward).normalize();
    bot._buildBasis(bot._tmpForward);

    // Time-Slicing der Probes: Vollstaendiger Scan nur im zugewiesenen Frame
    const maxProbes = bot._probes.length;
    const isFullScanFrame = (bot._sensePhaseCounter === bot._sensePhase);

    // Adaptive Sensing: Reduce probes in open space or non-assigned frames
    const useFewProbes = !isFullScanFrame || (!bot.sense.immediateDanger && (bot.sense.forwardRisk || 0) < 0.25 && (bot.sense.localOpenness || 0) > bot.sense.lookAhead * 0.7);
    // In non-scan frames, only evaluate the most critical probes (forward, up, down, backwards)
    const probesToProcess = useFewProbes ? Math.min(5, maxProbes) : maxProbes;

    let opennessSum = 0;
    let opennessCount = 0;
    let bestRisk = Infinity;
    let bestProbe = null;
    let forwardProbe = null;

    for (let i = 0; i < maxProbes; i++) {
        if (i >= probesToProcess) break;

        const probe = bot._probes[i];
        const isVertical = Math.abs(probe.pitch) > 0.001;

        if (CONFIG.GAMEPLAY.PLANAR_MODE && isVertical) {
            continue;
        }

        bot._composeProbeDirection(bot._tmpForward, bot._tmpRight, bot._tmpUp, probe);
        bot._scoreProbe(player, arena, allPlayers, probe, bot.sense.lookAhead);

        opennessSum += probe.clearance;
        opennessCount++;

        if (probe.name === 'forward') {
            forwardProbe = probe;
        }

        if (probe.risk < bestRisk) {
            bestRisk = probe.risk;
            bestProbe = probe;
        }
    }

    bot.sense.bestProbe = bestProbe;
    bot.sense.forwardRisk = forwardProbe ? forwardProbe.risk : 1;
    bot.sense.immediateDanger = !!(forwardProbe && forwardProbe.immediateDanger);
    bot.sense.localOpenness = opennessCount > 0 ? opennessSum / opennessCount : bot.sense.lookAhead * 0.4;

    const nearestEnemyPressure = bot._estimateEnemyPressure(player.position, player, allPlayers);
    const tightSpacePressure = 1 - Math.min(1, bot.sense.localOpenness / bot.sense.lookAhead);
    bot.sense.pressure = Math.min(1.6, nearestEnemyPressure * 0.8 + tightSpacePressure * 0.9 + bot._recentBouncePressure * 0.2);

    if (bot.state.targetRefreshTimer <= 0 || !bot.state.targetPlayer || !bot.state.targetPlayer.alive) {
        bot._selectTarget(player, allPlayers);
        bot.state.targetRefreshTimer = bot.profile.targetRefreshInterval;
    }
}

export function runPerception(bot, player, arena, allPlayers, projectiles) {
    // Time-Slicing auf Frame-Ebene
    bot._sensePhaseCounter = (bot._sensePhaseCounter + 1) % 4;
    // Collision memo is valid only for one perception tick.
    bot._collisionCache.clear();

    senseEnvironment(bot, player, arena, allPlayers, projectiles);
    bot._senseProjectiles(player, projectiles);
    bot._senseHeight(player, arena);
    bot._senseBotSpacing(player, allPlayers);
    bot._evaluatePursuit(player);
    bot._evaluatePortalIntent(player, arena, allPlayers);
}
