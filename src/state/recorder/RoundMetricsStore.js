function createRoundSummary() {
    return {
        roundId: 0,
        duration: 0,
        winnerIndex: -1,
        winnerIsBot: false,
        botCount: 0,
        humanCount: 0,
        botSurvivalAverage: 0,
        selfCollisions: 0,
        stuckEvents: 0,
        bounceWallEvents: 0,
        bounceTrailEvents: 0,
        itemUseEvents: 0,
        stuckPerMinute: 0,
    };
}

function createAggregateSummary() {
    return {
        rounds: 0,
        totalDuration: 0,
        totalBotLives: 0,
        totalBotSurvival: 0,
        totalSelfCollisions: 0,
        totalStuckEvents: 0,
        totalBounceWallEvents: 0,
        totalBounceTrailEvents: 0,
        totalItemUseEvents: 0,
        botWins: 0,
    };
}

export class RoundMetricsStore {
    constructor({ maxRounds = 120, maxTrackedPlayers = 16, timeProvider = null } = {}) {
        this.maxRounds = Math.max(1, Number(maxRounds) || 120);
        this.maxTrackedPlayers = Math.max(1, Number(maxTrackedPlayers) || 16);
        this.timeProvider = typeof timeProvider === 'function' ? timeProvider : (() => 0);

        this.roundSummaries = new Array(this.maxRounds);
        for (let i = 0; i < this.maxRounds; i++) {
            this.roundSummaries[i] = createRoundSummary();
        }
        this.roundSummaryIndex = 0;
        this.roundSummaryCount = 0;
        this._roundIdCounter = 0;

        this.playerSpawnTime = new Float32Array(this.maxTrackedPlayers);
        this.playerDeathTime = new Float32Array(this.maxTrackedPlayers);
        this.playerIsBot = new Uint8Array(this.maxTrackedPlayers);
        this.playerSeen = new Uint8Array(this.maxTrackedPlayers);

        this._aggregate = createAggregateSummary();
        this._lastRoundSummary = null;
        this._resetRoundState();
    }

    _elapsedSeconds() {
        return this.timeProvider();
    }

    _resetRoundState() {
        this._roundSelfCollisions = 0;
        this._roundStuckEvents = 0;
        this._roundBounceWallEvents = 0;
        this._roundBounceTrailEvents = 0;
        this._roundItemUseEvents = 0;
        for (let i = 0; i < this.maxTrackedPlayers; i++) {
            this.playerSpawnTime[i] = -1;
            this.playerDeathTime[i] = -1;
            this.playerIsBot[i] = 0;
            this.playerSeen[i] = 0;
        }
    }

    _trackPlayer(player, resetForSpawn = false) {
        if (!player || player.index < 0 || player.index >= this.maxTrackedPlayers) return;
        const idx = player.index;
        this.playerSeen[idx] = 1;
        this.playerIsBot[idx] = player.isBot ? 1 : 0;
        if (this.playerSpawnTime[idx] < 0) {
            this.playerSpawnTime[idx] = this._elapsedSeconds();
        }
        if (resetForSpawn) {
            this.playerDeathTime[idx] = -1;
        }
    }

    startRound(players = []) {
        this._resetRoundState();
        this._lastRoundSummary = null;
        if (Array.isArray(players)) {
            for (let i = 0; i < players.length; i++) {
                this._trackPlayer(players[i], true);
            }
        }
    }

    registerEventType(type) {
        if (type === 'STUCK') this._roundStuckEvents++;
        if (type === 'BOUNCE_WALL') this._roundBounceWallEvents++;
        if (type === 'BOUNCE_TRAIL') this._roundBounceTrailEvents++;
        if (type === 'ITEM_USE') this._roundItemUseEvents++;
    }

    markPlayerSpawn(player) {
        this._trackPlayer(player, true);
    }

    markPlayerDeath(player, cause = '') {
        if (!player || player.index < 0 || player.index >= this.maxTrackedPlayers) return;
        const idx = player.index;
        if (this.playerSpawnTime[idx] < 0) {
            this.playerSpawnTime[idx] = 0;
        }
        if (this.playerDeathTime[idx] < 0) {
            this.playerDeathTime[idx] = this._elapsedSeconds();
        }
        if (cause === 'TRAIL_SELF') {
            this._roundSelfCollisions++;
        }
    }

    finalizeRound(winner, players = []) {
        const roundDuration = Math.max(0, this._elapsedSeconds());
        let botCount = 0;
        let humanCount = 0;
        let botSurvivalSum = 0;

        if (Array.isArray(players)) {
            for (let i = 0; i < players.length; i++) {
                const p = players[i];
                if (!p || p.index < 0 || p.index >= this.maxTrackedPlayers) continue;
                this._trackPlayer(p, false);
                const idx = p.index;
                if (this.playerDeathTime[idx] < 0) {
                    this.playerDeathTime[idx] = roundDuration;
                }
                const spawnTime = this.playerSpawnTime[idx] >= 0 ? this.playerSpawnTime[idx] : 0;
                const survival = Math.max(0, this.playerDeathTime[idx] - spawnTime);
                if (p.isBot) {
                    botCount++;
                    botSurvivalSum += survival;
                } else {
                    humanCount++;
                }
            }
        }

        const round = this.roundSummaries[this.roundSummaryIndex];
        this._roundIdCounter++;
        round.roundId = this._roundIdCounter;
        round.duration = roundDuration;
        round.winnerIndex = winner ? winner.index : -1;
        round.winnerIsBot = !!winner?.isBot;
        round.botCount = botCount;
        round.humanCount = humanCount;
        round.botSurvivalAverage = botCount > 0 ? botSurvivalSum / botCount : 0;
        round.selfCollisions = this._roundSelfCollisions;
        round.stuckEvents = this._roundStuckEvents;
        round.bounceWallEvents = this._roundBounceWallEvents;
        round.bounceTrailEvents = this._roundBounceTrailEvents;
        round.itemUseEvents = this._roundItemUseEvents;
        round.stuckPerMinute = roundDuration > 0 ? this._roundStuckEvents / (roundDuration / 60) : 0;

        this.roundSummaryIndex = (this.roundSummaryIndex + 1) % this.maxRounds;
        if (this.roundSummaryCount < this.maxRounds) this.roundSummaryCount++;

        this._aggregate.rounds += 1;
        this._aggregate.totalDuration += roundDuration;
        this._aggregate.totalBotLives += botCount;
        this._aggregate.totalBotSurvival += botSurvivalSum;
        this._aggregate.totalSelfCollisions += this._roundSelfCollisions;
        this._aggregate.totalStuckEvents += this._roundStuckEvents;
        this._aggregate.totalBounceWallEvents += this._roundBounceWallEvents;
        this._aggregate.totalBounceTrailEvents += this._roundBounceTrailEvents;
        this._aggregate.totalItemUseEvents += this._roundItemUseEvents;
        if (winner?.isBot) this._aggregate.botWins += 1;

        this._lastRoundSummary = {
            roundId: round.roundId,
            duration: round.duration,
            winnerIndex: round.winnerIndex,
            winnerIsBot: round.winnerIsBot,
            botCount: round.botCount,
            humanCount: round.humanCount,
            botSurvivalAverage: round.botSurvivalAverage,
            selfCollisions: round.selfCollisions,
            stuckEvents: round.stuckEvents,
            bounceWallEvents: round.bounceWallEvents,
            bounceTrailEvents: round.bounceTrailEvents,
            itemUseEvents: round.itemUseEvents,
            stuckPerMinute: round.stuckPerMinute,
        };

        return this._lastRoundSummary;
    }

    getLastRoundMetrics() {
        return this._lastRoundSummary ? { ...this._lastRoundSummary } : null;
    }

    getAggregateMetrics() {
        const rounds = this._aggregate.rounds;
        const totalDuration = this._aggregate.totalDuration;
        return {
            rounds,
            botWinRate: rounds > 0 ? this._aggregate.botWins / rounds : 0,
            averageBotSurvival: this._aggregate.totalBotLives > 0
                ? this._aggregate.totalBotSurvival / this._aggregate.totalBotLives
                : 0,
            selfCollisionsPerRound: rounds > 0 ? this._aggregate.totalSelfCollisions / rounds : 0,
            stuckEventsPerMinute: totalDuration > 0 ? this._aggregate.totalStuckEvents / (totalDuration / 60) : 0,
            bounceWallPerRound: rounds > 0 ? this._aggregate.totalBounceWallEvents / rounds : 0,
            bounceTrailPerRound: rounds > 0 ? this._aggregate.totalBounceTrailEvents / rounds : 0,
            itemUsePerRound: rounds > 0 ? this._aggregate.totalItemUseEvents / rounds : 0,
        };
    }

    getAggregateTotals() {
        return { ...this._aggregate };
    }

    getRoundSummaries(limit = null) {
        const count = this.roundSummaryCount;
        if (count <= 0) return [];

        let max = count;
        if (Number.isFinite(limit)) {
            max = Math.max(0, Math.min(count, Number(limit)));
        }

        const items = [];
        const startIdx = count >= this.maxRounds ? this.roundSummaryIndex : 0;
        const offset = count - max;
        for (let i = 0; i < max; i++) {
            const idx = (startIdx + offset + i) % this.maxRounds;
            const round = this.roundSummaries[idx];
            items.push({
                roundId: round.roundId,
                duration: round.duration,
                winnerIndex: round.winnerIndex,
                winnerIsBot: round.winnerIsBot,
                botCount: round.botCount,
                humanCount: round.humanCount,
                botSurvivalAverage: round.botSurvivalAverage,
                selfCollisions: round.selfCollisions,
                stuckEvents: round.stuckEvents,
                bounceWallEvents: round.bounceWallEvents,
                bounceTrailEvents: round.bounceTrailEvents,
                itemUseEvents: round.itemUseEvents,
                stuckPerMinute: round.stuckPerMinute,
            });
        }
        return items;
    }

    resetAggregateMetrics() {
        this._aggregate = createAggregateSummary();
        this.roundSummaryIndex = 0;
        this.roundSummaryCount = 0;
        this._roundIdCounter = 0;
        this._lastRoundSummary = null;
    }
}
