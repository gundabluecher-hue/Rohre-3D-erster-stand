const PRESET_CREATED_AT = '2026-03-05T00:00:00.000Z';

function freezePreset(preset) {
    return Object.freeze({
        ...preset,
        metadata: Object.freeze({ ...preset.metadata }),
        values: Object.freeze({ ...preset.values }),
    });
}

function createFixedPreset({ id, name, description, lockedFields, values }) {
    return freezePreset({
        id,
        name,
        description,
        metadata: {
            id,
            kind: 'fixed',
            ownerId: 'owner',
            lockedFields: Array.isArray(lockedFields) ? lockedFields.slice() : [],
            sourcePresetId: '',
            createdAt: PRESET_CREATED_AT,
            updatedAt: PRESET_CREATED_AT,
        },
        values: { ...values },
    });
}

const FIXED_PRESET_CATALOG = Object.freeze([
    createFixedPreset({
        id: 'arcade',
        name: 'Arcade',
        description: 'Schnelles Setup fuer direkten Einstieg.',
        lockedFields: ['mode', 'gameMode', 'numBots', 'winsNeeded'],
        values: {
            mode: '1p',
            gameMode: 'CLASSIC',
            mapKey: 'standard',
            numBots: 2,
            botDifficulty: 'NORMAL',
            winsNeeded: 5,
            'gameplay.speed': 18,
            'gameplay.turnSensitivity': 2.2,
            'gameplay.trailWidth': 0.6,
            'gameplay.fireRate': 0.45,
            'gameplay.itemAmount': 8,
        },
    }),
    createFixedPreset({
        id: 'competitive',
        name: 'Competitive',
        description: 'Turniernahes Regelset mit engeren Limits.',
        lockedFields: ['mode', 'numBots', 'winsNeeded', 'gameplay.speed', 'gameplay.turnSensitivity', 'gameplay.itemAmount'],
        values: {
            mode: '2p',
            gameMode: 'CLASSIC',
            mapKey: 'maze',
            numBots: 0,
            winsNeeded: 7,
            botDifficulty: 'HARD',
            'gameplay.speed': 20,
            'gameplay.turnSensitivity': 2.6,
            'gameplay.trailWidth': 0.55,
            'gameplay.fireRate': 0.5,
            'gameplay.itemAmount': 6,
        },
    }),
    createFixedPreset({
        id: 'chaos',
        name: 'Chaos',
        description: 'Mehr Bots, mehr Items, aggressiveres Tempo.',
        lockedFields: ['numBots', 'gameplay.itemAmount'],
        values: {
            mode: '1p',
            gameMode: 'HUNT',
            mapKey: 'complex',
            numBots: 6,
            botDifficulty: 'HARD',
            winsNeeded: 5,
            'hunt.respawnEnabled': true,
            'gameplay.speed': 24,
            'gameplay.turnSensitivity': 2.8,
            'gameplay.trailWidth': 0.72,
            'gameplay.fireRate': 0.25,
            'gameplay.itemAmount': 14,
            'gameplay.lockOnAngle': 18,
        },
    }),
    createFixedPreset({
        id: 'fight-standard',
        name: 'Fight Standard',
        description: 'Empfohlene Fight-Kombination fuer den 4-Ebenen-Flow.',
        lockedFields: ['gameMode', 'hunt.respawnEnabled'],
        values: {
            mode: '1p',
            gameMode: 'HUNT',
            mapKey: 'maze',
            numBots: 3,
            botDifficulty: 'NORMAL',
            winsNeeded: 5,
            'hunt.respawnEnabled': true,
            'gameplay.speed': 20,
            'gameplay.turnSensitivity': 2.4,
            'gameplay.fireRate': 0.35,
            'gameplay.itemAmount': 10,
        },
    }),
    createFixedPreset({
        id: 'normal-standard',
        name: 'Normal Standard',
        description: 'Empfohlene Normal-Kombination fuer Classic-Sessions.',
        lockedFields: ['gameMode'],
        values: {
            mode: '1p',
            gameMode: 'CLASSIC',
            mapKey: 'standard',
            numBots: 2,
            botDifficulty: 'NORMAL',
            winsNeeded: 5,
            'hunt.respawnEnabled': false,
            'gameplay.speed': 18,
            'gameplay.turnSensitivity': 2.2,
            'gameplay.fireRate': 0.45,
            'gameplay.itemAmount': 8,
        },
    }),
]);

export function getFixedMenuPresetCatalog() {
    return FIXED_PRESET_CATALOG.map((preset) => ({
        ...preset,
        metadata: { ...preset.metadata, lockedFields: preset.metadata.lockedFields.slice() },
        values: { ...preset.values },
    }));
}

export function findFixedMenuPresetById(presetId) {
    const normalizedPresetId = typeof presetId === 'string' ? presetId.trim() : '';
    if (!normalizedPresetId) return null;
    const preset = FIXED_PRESET_CATALOG.find((entry) => entry.id === normalizedPresetId);
    if (!preset) return null;
    return {
        ...preset,
        metadata: { ...preset.metadata, lockedFields: preset.metadata.lockedFields.slice() },
        values: { ...preset.values },
    };
}
