// ============================================
// BotPolicyTypes.js - shared bot policy contracts and identifiers
// ============================================

export const BOT_POLICY_TYPES = Object.freeze({
    RULE_BASED: 'rule-based',
    HUNT: 'hunt',
});

export const DEFAULT_BOT_POLICY_TYPE = BOT_POLICY_TYPES.RULE_BASED;
const OPTIONAL_BOT_POLICY_METHODS = Object.freeze(['getObservation', 'reset']);

export function normalizeBotPolicyType(type) {
    const normalized = typeof type === 'string' ? type.trim().toLowerCase() : '';
    return normalized || DEFAULT_BOT_POLICY_TYPE;
}

export function assertBotPolicyContract(policy, type = DEFAULT_BOT_POLICY_TYPE) {
    if (!policy || typeof policy.update !== 'function') {
        throw new Error(`[BotPolicyRegistry] Invalid bot policy "${type}": missing update(dt, player, arena, allPlayers, projectiles)`);
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
