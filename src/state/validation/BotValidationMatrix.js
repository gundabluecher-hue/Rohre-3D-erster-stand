const BOT_VALIDATION_MATRIX = Object.freeze([
    Object.freeze({ id: 'V1', mode: '1p', bots: 1, mapKey: 'standard', planarMode: false, portalCount: 0, rounds: 10 }),
    Object.freeze({ id: 'V2', mode: '1p', bots: 3, mapKey: 'maze', planarMode: false, portalCount: 0, rounds: 10 }),
    Object.freeze({ id: 'V3', mode: '1p', bots: 3, mapKey: 'complex', planarMode: true, portalCount: 4, rounds: 10 }),
    Object.freeze({ id: 'V4', mode: '2p', bots: 2, mapKey: 'standard', planarMode: true, portalCount: 6, rounds: 10 }),
]);

function cloneScenario(entry) {
    return {
        id: String(entry.id || ''),
        mode: entry.mode === '2p' ? '2p' : '1p',
        bots: Math.max(0, Math.trunc(Number(entry.bots) || 0)),
        mapKey: String(entry.mapKey || 'standard'),
        planarMode: !!entry.planarMode,
        portalCount: Math.max(0, Math.trunc(Number(entry.portalCount) || 0)),
        rounds: Math.max(1, Math.trunc(Number(entry.rounds) || 1)),
    };
}

export function getBotValidationMatrix() {
    return BOT_VALIDATION_MATRIX.map((entry) => cloneScenario(entry));
}

export function resolveBotValidationScenario(idOrIndex = 0, matrix = null) {
    const source = Array.isArray(matrix) ? matrix : getBotValidationMatrix();
    if (source.length === 0) return null;

    if (typeof idOrIndex === 'number' && Number.isFinite(idOrIndex)) {
        const idx = Math.max(0, Math.min(source.length - 1, Math.trunc(idOrIndex)));
        return cloneScenario(source[idx]);
    }

    const id = String(idOrIndex || '').trim();
    const byId = source.find((entry) => String(entry.id || '').toUpperCase() === id.toUpperCase());
    return cloneScenario(byId || source[0]);
}
