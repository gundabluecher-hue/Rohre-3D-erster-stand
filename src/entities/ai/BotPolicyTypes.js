// ============================================
// BotPolicyTypes.js - shared bot policy contracts and identifiers
// ============================================

export const BOT_POLICY_TYPES = Object.freeze({
    RULE_BASED: 'rule-based',
    HUNT: 'hunt',
    CLASSIC_BRIDGE: 'classic-bridge',
    HUNT_BRIDGE: 'hunt-bridge',
});

export const DEFAULT_BOT_POLICY_TYPE = BOT_POLICY_TYPES.RULE_BASED;
const OPTIONAL_BOT_POLICY_METHODS = Object.freeze(['getObservation', 'reset']);
const BOT_POLICY_TYPE_ALIASES = Object.freeze({
    bridge: BOT_POLICY_TYPES.CLASSIC_BRIDGE,
});

export function normalizeBotPolicyType(type) {
    const raw = typeof type === 'string' ? type.trim().toLowerCase() : '';
    if (!raw) return DEFAULT_BOT_POLICY_TYPE;
    return BOT_POLICY_TYPE_ALIASES[raw] || raw;
}

export function isBridgeBotPolicyType(type) {
    const normalized = normalizeBotPolicyType(type);
    return normalized === BOT_POLICY_TYPES.CLASSIC_BRIDGE || normalized === BOT_POLICY_TYPES.HUNT_BRIDGE;
}

export function assertBotPolicyContract(policy, type = DEFAULT_BOT_POLICY_TYPE) {
    if (!policy || typeof policy.update !== 'function') {
        throw new Error(`[BotPolicyRegistry] Invalid bot policy "${type}": missing update(dt, player, context|arena, allPlayers, projectiles)`);
    }
    for (let i = 0; i < OPTIONAL_BOT_POLICY_METHODS.length; i++) {
        const methodName = OPTIONAL_BOT_POLICY_METHODS[i];
        const member = policy[methodName];
        if (member != null && typeof member !== 'function') {
            throw new Error(`[BotPolicyRegistry] Invalid bot policy "${type}": optional "${methodName}" must be a function`);
        }
    }
    return policy;
}
