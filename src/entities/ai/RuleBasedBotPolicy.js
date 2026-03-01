// ============================================
// RuleBasedBotPolicy.js - adapter for legacy BotAI
// ============================================

import { BotAI } from '../Bot.js';
import { BOT_POLICY_TYPES } from './BotPolicyTypes.js';

export class RuleBasedBotPolicy {
    constructor(options = {}) {
        this.type = BOT_POLICY_TYPES.RULE_BASED;
        this._botAI = new BotAI(options);
    }

    update(dt, player, arena, allPlayers, projectiles) {
        return this._botAI.update(dt, player, arena, allPlayers, projectiles);
    }

    setDifficulty(profileName) {
        if (typeof this._botAI.setDifficulty === 'function') {
            this._botAI.setDifficulty(profileName);
        }
    }

    onBounce(type, normal = null) {
        if (typeof this._botAI.onBounce === 'function') {
            this._botAI.onBounce(type, normal);
        }
    }

    setSensePhase(phase) {
        const normalized = Number.isFinite(phase) ? Math.max(0, Math.floor(phase)) % 4 : 0;
        this._botAI._sensePhase = normalized;
    }
}
