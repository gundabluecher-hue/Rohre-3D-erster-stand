// ============================================
// BotPolicyRegistry.js - policy factory registry for bot controllers
// ============================================

import {
    assertBotPolicyContract,
    BOT_POLICY_TYPES,
    DEFAULT_BOT_POLICY_TYPE,
    normalizeBotPolicyType,
} from './BotPolicyTypes.js';
import { RuleBasedBotPolicy } from './RuleBasedBotPolicy.js';
import { HuntBotPolicy } from '../../hunt/HuntBotPolicy.js';

export class BotPolicyRegistry {
    constructor() {
        this._factories = new Map();
        this.register(BOT_POLICY_TYPES.RULE_BASED, (options) => new RuleBasedBotPolicy(options));
        this.register(BOT_POLICY_TYPES.HUNT, (options) => new HuntBotPolicy(options));
    }

    register(type, factory) {
        if (typeof factory !== 'function') {
            throw new Error(`[BotPolicyRegistry] Invalid factory for policy "${type}"`);
        }
        const normalizedType = normalizeBotPolicyType(type);
        this._factories.set(normalizedType, factory);
    }

    create(type, options = {}) {
        const requestedType = normalizeBotPolicyType(type);
        const factory = this._factories.get(requestedType) || this._factories.get(DEFAULT_BOT_POLICY_TYPE);
        if (!factory) {
            throw new Error('[BotPolicyRegistry] No default bot policy registered');
        }
        const policy = factory(options);
        return assertBotPolicyContract(policy, requestedType);
    }
}
