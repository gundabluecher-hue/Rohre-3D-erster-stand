import { CONFIG } from './Config.js';
import { Arena } from './Arena.js';
import { EntityManager } from './EntityManager.js';
import { PowerupManager } from './Powerup.js';
import { ParticleSystem } from './Particles.js';
import { CUSTOM_MAP_KEY } from './MapSchema.js';
import { resolveArenaMapSelection } from './CustomMapLoader.js';

export function disposeMatchSessionSystems(renderer, currentSession) {
    if (currentSession?.entityManager) {
        currentSession.entityManager.dispose();
    }
    if (currentSession?.powerupManager) {
        currentSession.powerupManager.dispose();
    }
    if (currentSession?.particles?.dispose) {
        currentSession.particles.dispose();
    }
    renderer.clearMatchScene();
}

function buildHumanConfigs(settings) {
    return [
        {
            invertPitch: !!settings?.invertPitch?.PLAYER_1,
            cockpitCamera: !!settings?.cockpitCamera?.PLAYER_1,
            vehicleId: settings?.vehicles?.PLAYER_1,
        },
        {
            invertPitch: !!settings?.invertPitch?.PLAYER_2,
            cockpitCamera: !!settings?.cockpitCamera?.PLAYER_2,
            vehicleId: settings?.vehicles?.PLAYER_2,
        },
    ];
}

function buildEntityManagerSetupOptions(settings) {
    return {
        modelScale: settings?.gameplay?.planeScale,
        botDifficulty: settings?.botDifficulty || 'NORMAL',
        humanConfigs: buildHumanConfigs(settings),
    };
}

export function createMatchSession({
    renderer,
    audio,
    recorder,
    settings,
    requestedMapKey,
    currentSession = null,
}) {
    disposeMatchSessionSystems(renderer, currentSession);

    const particles = new ParticleSystem(renderer);
    const arena = new Arena(renderer);
    arena.portalsEnabled = !!settings?.portalsEnabled;

    const mapResolution = resolveArenaMapSelection(requestedMapKey);
    if (mapResolution.isCustom && mapResolution.mapDefinition) {
        CONFIG.MAPS[CUSTOM_MAP_KEY] = mapResolution.mapDefinition;
    }
    const effectiveMapKey = mapResolution.effectiveMapKey;
    arena.build(effectiveMapKey);

    const powerupManager = new PowerupManager(renderer, arena);
    const entityManager = new EntityManager(renderer, arena, powerupManager, particles, audio, recorder);

    const numHumans = settings?.mode === '2p' ? 2 : 1;
    const numBots = Number(settings?.numBots) || 0;
    const winsNeeded = Number(settings?.winsNeeded) || 5;

    entityManager.setup(numHumans, numBots, buildEntityManagerSetupOptions(settings));

    return {
        particles,
        arena,
        powerupManager,
        entityManager,
        mapResolution,
        effectiveMapKey,
        numHumans,
        numBots,
        winsNeeded,
    };
}

export function deriveMapResolutionFeedbackPlan({ mapResolution, portalsEnabled }) {
    const consoleEntries = [];
    const toasts = [];

    if (!mapResolution) {
        return { consoleEntries, toasts };
    }

    if (mapResolution.error) {
        consoleEntries.push({
            level: 'warn',
            args: ['[Game] Map loading fallback:', mapResolution.error],
        });
    }
    if (Array.isArray(mapResolution.warnings) && mapResolution.warnings.length > 0) {
        consoleEntries.push({
            level: 'warn',
            args: ['[Game] Map loading warnings:', mapResolution.warnings],
        });
    }

    if (mapResolution.isFallback && mapResolution.requestedMapKey === CUSTOM_MAP_KEY) {
        toasts.push({
            message: 'Custom-Map ungueltig, Standard-Map geladen',
            durationMs: 2600,
            tone: 'error',
        });
    } else if (mapResolution.isFallback) {
        toasts.push({
            message: `Map-Fallback aktiv: ${mapResolution.effectiveMapKey}`,
            durationMs: 2200,
            tone: 'error',
        });
    } else if (mapResolution.isCustom && Array.isArray(mapResolution.warnings) && mapResolution.warnings.length > 0) {
        const extraCount = Math.max(0, mapResolution.warnings.length - 1);
        const suffix = extraCount > 0 ? ` (+${extraCount} Hinweis(e) in Konsole)` : '';
        toasts.push({
            message: `Custom-Map Hinweis: ${mapResolution.warnings[0]}${suffix}`,
            durationMs: 3600,
            tone: 'info',
        });
    }

    if (mapResolution.isCustom && mapResolution.mapDocument && mapResolution.mapDefinition) {
        const doc = mapResolution.mapDocument;
        const runtimeObstacleCount = Array.isArray(mapResolution.mapDefinition.obstacles)
            ? mapResolution.mapDefinition.obstacles.length
            : 0;
        const runtimePortalCount = Array.isArray(mapResolution.mapDefinition.portals)
            ? mapResolution.mapDefinition.portals.length
            : 0;
        const ignoredCount = (
            (Array.isArray(doc.tunnels) ? doc.tunnels.length : 0) +
            (Array.isArray(doc.items) ? doc.items.length : 0) +
            (Array.isArray(doc.aircraft) ? doc.aircraft.length : 0) +
            (Array.isArray(doc.botSpawns) ? doc.botSpawns.length : 0)
        );

        if (runtimeObstacleCount === 0 && runtimePortalCount === 0 && ignoredCount > 0) {
            toasts.push({
                message: 'Custom-Map enthaelt nur aktuell nicht unterstuetzte Editor-Objekte (Tunnel/Items/Aircraft/Spawns).',
                durationMs: 4200,
                tone: 'error',
            });
        } else if (runtimeObstacleCount === 0 && runtimePortalCount > 0 && !portalsEnabled) {
            toasts.push({
                message: 'Custom-Map hat nur Portale, aber Portale sind im Menue deaktiviert.',
                durationMs: 3400,
                tone: 'error',
            });
        }
    }

    return { consoleEntries, toasts };
}

export function wireMatchSessionRuntime({
    renderer,
    entityManager,
    numHumans,
    onPlayerFeedback = null,
    onPlayerDied = null,
    onRoundEnd = null,
    resetScores = true,
}) {
    if (!renderer || !entityManager) {
        throw new Error('wireMatchSessionRuntime requires renderer and entityManager');
    }

    entityManager.onPlayerFeedback = typeof onPlayerFeedback === 'function' ? onPlayerFeedback : null;
    entityManager.onPlayerDied = typeof onPlayerDied === 'function' ? onPlayerDied : null;
    entityManager.onRoundEnd = typeof onRoundEnd === 'function' ? onRoundEnd : null;

    const cameraCount = Math.max(0, Number(numHumans) || 0);
    for (let i = 0; i < cameraCount; i++) {
        renderer.createCamera(i);
    }

    if (resetScores) {
        for (const player of entityManager.players) {
            player.score = 0;
        }
    }

    return {
        cameraCount,
        playerCount: Array.isArray(entityManager.players) ? entityManager.players.length : 0,
    };
}

export function initializeMatchSession({
    renderer,
    audio,
    recorder,
    settings,
    requestedMapKey,
    currentSession = null,
    onPlayerFeedback = null,
    onPlayerDied = null,
    onRoundEnd = null,
    resetScores = true,
}) {
    const session = createMatchSession({
        renderer,
        audio,
        recorder,
        settings,
        requestedMapKey,
        currentSession,
    });

    const runtime = wireMatchSessionRuntime({
        renderer,
        entityManager: session.entityManager,
        numHumans: session.numHumans,
        onPlayerFeedback,
        onPlayerDied,
        onRoundEnd,
        resetScores,
    });

    const feedbackPlan = deriveMapResolutionFeedbackPlan({
        mapResolution: session.mapResolution,
        portalsEnabled: !!settings?.portalsEnabled,
    });

    return {
        session,
        runtime,
        feedbackPlan,
    };
}
