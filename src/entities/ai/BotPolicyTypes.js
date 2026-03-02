// ============================================
// BotPolicyTypes.js - shared bot policy contracts and identifiers
// ============================================

export const BOT_POLICY_TYPES = Object.freeze({
    RULE_BASED: 'rule-based',
    HUNT: 'hunt',
});

export const DEFAULT_BOT_POLICY_TYPE = BOT_POLICY_TYPES.RULE_BASED;

export function normalizeBotPolicyType(type) {
    const normalized = typeof type === 'string' ? type.trim().toLowerCase() : '';
    return normalized || DEFAULT_BOT_POLICY_TYPE;
}

export function assertBotPolicyContract(policy, type = DEFAULT_BOT_POLICY_TYPE) {
    if (!policy || typeof policy.update !== 'function') {
        throw new Error(`[BotPolicyRegistry] Invalid bot policy "${type}": missing update(dt, player, arena, allPlayers, projectiles)`);
    }
    return policy;
}
