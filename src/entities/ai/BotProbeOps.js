// ============================================
// BotProbeOps.js - probe direction/ray/score helpers
// ============================================
//
// Contract:
// - Inputs: bot runtime + probe + arena/player snapshots
// - Outputs: normalized probe.dir and scored risk/clearance on probe object
// - Side effects: writes to bot temp vectors and mutable probe records
// - Hotpath guardrail: no new vectors/arrays in sensing loop

import { CONFIG } from '../../core/Config.js';

const BOT_PROBE_LATERAL_SCAN_CLEAR_RATIO = 0.92;

export function composeProbeDirection(bot, forward, right, up, probe) {
    const yawFactor = probe.yaw * bot.profile.probeSpread;
    const pitchFactor = probe.pitch * bot.profile.probeSpread;

    probe.dir.copy(forward);
    if (yawFactor !== 0) probe.dir.addScaledVector(right, yawFactor);
    if (!CONFIG.GAMEPLAY.PLANAR_MODE && pitchFactor !== 0) probe.dir.addScaledVector(up, pitchFactor);
    probe.dir.normalize();
}

export function scanProbeRay(bot, player, arena, allPlayers, direction, lookAhead, step, out) {
    out.wallDist = lookAhead;
    out.trailDist = lookAhead;
    out.immediateDanger = false;

    const radius = player.hitboxRadius * 1.6;
    const skipRecent = 20;
    const stepX = direction.x * step;
    const stepY = direction.y * step;
    const stepZ = direction.z * step;

    bot._tmpVec.set(
        player.position.x + stepX,
        player.position.y + stepY,
        player.position.z + stepZ
    );

    for (let d = step; d <= lookAhead; d += step) {
        if (arena.checkCollisionFast(bot._tmpVec, radius)) {
            out.wallDist = d;
            if (d <= step * 1.5) out.immediateDanger = true;
            break;
        }

        if (bot._checkTrailHit(bot._tmpVec, player, allPlayers, radius, skipRecent)) {
            out.trailDist = d;
            if (d <= step * 1.5) out.immediateDanger = true;
            break;
        }

        bot._tmpVec.x += stepX;
        bot._tmpVec.y += stepY;
        bot._tmpVec.z += stepZ;
    }
}

export function scoreProbe(bot, player, arena, allPlayers, probe, lookAhead) {
    const step = bot.profile.probeStep;

    let probeLookAhead = lookAhead;
    const absYaw = Math.abs(probe.yaw);
    if (absYaw > 2.5) {
        probeLookAhead = lookAhead * 0.4;
    } else if (absYaw > 1.2) {
        probeLookAhead = lookAhead * 0.7;
    }

    scanProbeRay(bot, player, arena, allPlayers, probe.dir, probeLookAhead, step, bot._probeRayCenter);

    const lateralStrength = CONFIG.GAMEPLAY.PLANAR_MODE ? 0.2 : 0.24;
    const lateralLookAhead = probeLookAhead * 0.9;
    const centerClearance = Math.min(bot._probeRayCenter.wallDist, bot._probeRayCenter.trailDist);
    const shouldScanLaterals = bot._probeRayCenter.immediateDanger
        || centerClearance < probeLookAhead * BOT_PROBE_LATERAL_SCAN_CLEAR_RATIO;

    if (shouldScanLaterals) {
        bot._tmpVec2.copy(probe.dir).addScaledVector(bot._tmpRight, lateralStrength).normalize();
        scanProbeRay(bot, player, arena, allPlayers, bot._tmpVec2, lateralLookAhead, step, bot._probeRayLeft);

        bot._tmpVec3.copy(probe.dir).addScaledVector(bot._tmpRight, -lateralStrength).normalize();
        scanProbeRay(bot, player, arena, allPlayers, bot._tmpVec3, lateralLookAhead, step, bot._probeRayRight);
    } else {
        bot._probeRayLeft.wallDist = bot._probeRayCenter.wallDist;
        bot._probeRayLeft.trailDist = bot._probeRayCenter.trailDist;
        bot._probeRayLeft.immediateDanger = bot._probeRayCenter.immediateDanger;
        bot._probeRayRight.wallDist = bot._probeRayCenter.wallDist;
        bot._probeRayRight.trailDist = bot._probeRayCenter.trailDist;
        bot._probeRayRight.immediateDanger = bot._probeRayCenter.immediateDanger;
    }

    const wallDist = Math.min(bot._probeRayCenter.wallDist, bot._probeRayLeft.wallDist, bot._probeRayRight.wallDist);
    const trailDist = Math.min(bot._probeRayCenter.trailDist, bot._probeRayLeft.trailDist, bot._probeRayRight.trailDist);
    const immediateDanger = bot._probeRayCenter.immediateDanger
        || bot._probeRayLeft.immediateDanger
        || bot._probeRayRight.immediateDanger;

    const speedRatio = player.baseSpeed > 0 ? player.speed / player.baseSpeed : 1;
    const speedFactor = Math.max(0, speedRatio - 1) * 0.3;

    const wallRisk = 1 - Math.min(1, wallDist / probeLookAhead);
    const trailRisk = 1 - Math.min(1, trailDist / probeLookAhead);
    let risk = wallRisk * (1.1 + bot.sense.mapCaution + speedFactor)
        + trailRisk * (1.45 + bot.sense.mapCaution * 0.5 + speedFactor * 0.7);

    let lateralBlocks = 0;
    if (bot._probeRayLeft.wallDist < lateralLookAhead * 0.5 || bot._probeRayLeft.trailDist < lateralLookAhead * 0.5) lateralBlocks++;
    if (bot._probeRayRight.wallDist < lateralLookAhead * 0.5 || bot._probeRayRight.trailDist < lateralLookAhead * 0.5) lateralBlocks++;

    risk += probe.weight;
    risk += lateralBlocks * 0.28;
    if (immediateDanger) risk += 2.2;

    if (bot.profile.errorRate > 0 && Math.random() < bot.profile.errorRate) {
        risk += (Math.random() - 0.2) * 0.65;
    }

    probe.wallDist = wallDist;
    probe.trailDist = trailDist;
    probe.clearance = Math.min(wallDist, trailDist);
    probe.immediateDanger = immediateDanger;
    probe.risk = risk;
}
