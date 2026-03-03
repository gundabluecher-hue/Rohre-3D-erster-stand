// ============================================
// BotPolicyRegistry.js - policy factory registry for bot controllers
// ============================================

import {
    assertBotPolicyContract,
    BOT_POLICY_TYPES,
    DEFAULT_BOT_POLICY_TYPE,
    isBridgeBotPolicyType,
    normalizeBotPolicyType,
} from './BotPolicyTypes.js';
import { RuleBasedBotPolicy } from './RuleBasedBotPolicy.js';
import { HuntBotPolicy } from '../../hunt/HuntBotPolicy.js';
import { ObservationBridgePolicy } from './ObservationBridgePolicy.js';

export class BotPolicyRegistry {
    constructor() {
        this._factories = new Map();
        this._creationLogCache = new Set();
        this.register(BOT_POLICY_TYPES.RULE_BASED, (options) => new RuleBasedBotPolicy(options));
        this.register(BOT_POLICY_TYPES.HUNT, (options) => new HuntBotPolicy(options));
        this.register(
            BOT_POLICY_TYPES.CLASSIC_BRIDGE,
            (options) => new ObservationBridgePolicy({
                ...options,
                type: BOT_POLICY_TYPES.CLASSIC_BRIDGE,
                fallbackPolicy: new RuleBasedBotPolicy(options),
            })
        );
        this.register(
            BOT_POLICY_TYPES.HUNT_BRIDGE,
            (options) => new ObservationBridgePolicy({
                ...options,
                type: BOT_POLICY_TYPES.HUNT_BRIDGE,
                fallbackPolicy: new HuntBotPolicy(options),
            })
        );
    }

    register(type, factory) {
        if (typeof factory !== 'function') {
            throw new Error(`[BotPolicyRegistry] Invalid factory for policy "${type}"`);
        }
        const normalizedType = normalizeBotPolicyType(type);
        this._factories.set(normalizedType, factory);
        return this;
    }

    _logCreateResult(requestedType, resolvedType, fallbackReason = null) {
        const cacheKey = `${requestedType}|${resolvedType}|${fallbackReason || 'none'}`;
        if (this._creationLogCache.has(cacheKey)) return;
        this._creationLogCache.add(cacheKey);

        if (fallbackReason) {
            console.warn(`[BotPolicyRegistry] requested=${requestedType} resolved=${resolvedType} fallback=${fallbackReason}`);
            return;
        }
        console.info(`[BotPolicyRegistry] requested=${requestedType} resolved=${resolvedType}`);
    }

    _resolveFactory(type, options = {}) {
        const requestedType = normalizeBotPolicyType(type);
        const bridgeEnabled = options?.bridgeEnabled !== false;
        let resolvedType = requestedType;
        let fallbackReason = null;

        if (!bridgeEnabled && isBridgeBotPolicyType(requestedType)) {
            resolvedType = DEFAULT_BOT_POLICY_TYPE;
            fallbackReason = 'bridge-disabled';
        }

        let factory = this._factories.get(resolvedType);
        if (!factory) {
            resolvedType = DEFAULT_BOT_POLICY_TYPE;
            factory = this._factories.get(resolvedType);
            if (!fallbackReason) {
                fallbackReason = 'factory-missing';
            }
        }

        return {
            requestedType,
            resolvedType,
            fallbackReason,
            factory,
        };
    }

    create(type, options = {}) {
        const resolved = this._resolveFactory(type, options);
        let factory = resolved.factory;
        if (!factory) {
            throw new Error('[BotPolicyRegistry] No default bot policy registered');
        }

        let policy = null;
        let resolvedType = resolved.resolvedType;
        let fallbackReason = resolved.fallbackReason;
        try {
            policy = factory(options);
        } catch (error) {
            if (resolvedType !== DEFAULT_BOT_POLICY_TYPE) {
                resolvedType = DEFAULT_BOT_POLICY_TYPE;
                fallbackReason = fallbackReason || 'factory-error';
                factory = this._factories.get(DEFAULT_BOT_POLICY_TYPE);
                if (!factory) {
                    throw new Error('[BotPolicyRegistry] No default bot policy registered');
                }
                policy = factory(options);
            } else {
                throw error;
            }
        }

        this._logCreateResult(resolved.requestedType, resolvedType, fallbackReason);
        return assertBotPolicyContract(policy, resolvedType);
    }
}
