// ============================================
// RoundRecorder.js - Lightweight debug logger + KPI recorder
// ============================================

import { RoundEventStore } from './recorder/RoundEventStore.js';
import { RoundMetricsStore } from './recorder/RoundMetricsStore.js';
import { RoundSnapshotStore } from './recorder/RoundSnapshotStore.js';

const MAX_EVENTS = 800;
const MAX_SNAPSHOTS = 900;
const MAX_ROUNDS = 120;
const MAX_TRACKED_PLAYERS = 16;

function normalizeRingValue(value, max) {
    if (!Number.isFinite(value)) return 0;
    const normalized = Math.max(0, Math.trunc(value));
    return normalized % Math.max(1, max);
}

function normalizeCountValue(value, max) {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.min(Math.trunc(value), Math.max(1, max)));
}

export class RoundRecorder {
    constructor() {
        this.roundStartTime = 0;
        this._enabled = true;
        this._frameCaptureEnabled = false;
        this._frameCounter = 0;
        this._snapshotInterval = 10;

        this._eventStore = new RoundEventStore({
            maxEvents: MAX_EVENTS,
            timeProvider: () => this._elapsedSeconds(),
        });
        this._snapshotStore = new RoundSnapshotStore({
            maxSnapshots: MAX_SNAPSHOTS,
            timeProvider: () => this._elapsedSeconds(),
        });
        this._metricsStore = new RoundMetricsStore({
            maxRounds: MAX_ROUNDS,
            maxTrackedPlayers: MAX_TRACKED_PLAYERS,
            timeProvider: () => this._elapsedSeconds(),
        });

        this._bindCompatibilityAliases();
    }

    _bindCompatibilityAliases() {
        const bindAlias = (name, getter, setter) => {
            Object.defineProperty(this, name, {
                configurable: true,
                enumerable: true,
                get: getter,
                set: setter,
            });
        };

        bindAlias(
            'events',
            () => this._eventStore.events,
            (value) => {
                if (Array.isArray(value)) this._eventStore.events = value;
            }
        );
        bindAlias(
            'eventIndex',
            () => this._eventStore.eventIndex,
            (value) => { this._eventStore.eventIndex = normalizeRingValue(value, MAX_EVENTS); }
        );
        bindAlias(
            'eventCount',
            () => this._eventStore.eventCount,
            (value) => { this._eventStore.eventCount = normalizeCountValue(value, MAX_EVENTS); }
        );

        bindAlias(
            'snapshots',
            () => this._snapshotStore.snapshots,
            (value) => {
                if (Array.isArray(value)) this._snapshotStore.snapshots = value;
            }
        );
        bindAlias(
            'snapshotIndex',
            () => this._snapshotStore.snapshotIndex,
            (value) => { this._snapshotStore.snapshotIndex = normalizeRingValue(value, MAX_SNAPSHOTS); }
        );
        bindAlias(
            'snapshotCount',
            () => this._snapshotStore.snapshotCount,
            (value) => { this._snapshotStore.snapshotCount = normalizeCountValue(value, MAX_SNAPSHOTS); }
        );

        bindAlias(
            'roundSummaries',
            () => this._metricsStore.roundSummaries,
            (value) => {
                if (Array.isArray(value)) this._metricsStore.roundSummaries = value;
            }
        );
        bindAlias(
            'roundSummaryIndex',
            () => this._metricsStore.roundSummaryIndex,
            (value) => { this._metricsStore.roundSummaryIndex = normalizeRingValue(value, MAX_ROUNDS); }
        );
        bindAlias(
            'roundSummaryCount',
            () => this._metricsStore.roundSummaryCount,
            (value) => { this._metricsStore.roundSummaryCount = normalizeCountValue(value, MAX_ROUNDS); }
        );
    }

    _elapsedSeconds() {
        return this.roundStartTime > 0 ? (performance.now() - this.roundStartTime) / 1000 : 0;
    }

    startRound(players = []) {
        this._eventStore.reset();
        this._snapshotStore.reset();
        this._frameCounter = 0;
        this.roundStartTime = performance.now();
        this._metricsStore.startRound(players);
    }

    logEvent(type, playerIndex, data = '') {
        if (!this._enabled) return;
        this._eventStore.append(type, playerIndex, data);
        this._metricsStore.registerEventType(type);
    }

    markPlayerSpawn(player) {
        if (!this._enabled) return;
        this._metricsStore.markPlayerSpawn(player);
    }

    markPlayerDeath(player, cause = '') {
        if (!this._enabled) return;
        this._metricsStore.markPlayerDeath(player, cause);
    }

    finalizeRound(winner, players = []) {
        if (!this._enabled) return null;
        const roundSummary = this._metricsStore.finalizeRound(winner, players);
        this.logEvent('ROUND_END', roundSummary.winnerIndex, `duration=${roundSummary.duration.toFixed(2)}`);
        return roundSummary;
    }

    getLastRoundMetrics() {
        return this._metricsStore.getLastRoundMetrics();
    }

    getAggregateMetrics() {
        return this._metricsStore.getAggregateMetrics();
    }

    getAggregateTotals() {
        return this._metricsStore.getAggregateTotals();
    }

    getRoundSummaries(limit = null) {
        return this._metricsStore.getRoundSummaries(limit);
    }

    resetAggregateMetrics() {
        this._metricsStore.resetAggregateMetrics();
    }

    setFrameCaptureEnabled(enabled) {
        this._frameCaptureEnabled = !!enabled;
    }

    isFrameCaptureEnabled() {
        return this._frameCaptureEnabled;
    }

    recordFrame(players) {
        if (!this._enabled || !this._frameCaptureEnabled || !Array.isArray(players)) return;
        this._frameCounter++;
        if (this._frameCounter % this._snapshotInterval !== 0) return;
        this._snapshotStore.capture(players);
    }

    dump() {
        const eventList = this._eventStore.toLogLines();
        const lastRound = this.getLastRoundMetrics();
        const aggregate = this.getAggregateMetrics();

        console.group('%cROUND LOG', 'color: #0af; font-size: 14px; font-weight: bold;');
        console.log(`Duration: ${this._elapsedSeconds().toFixed(1)}s`);
        console.log(`Events: ${this._eventStore.eventCount}`);
        console.table(eventList.map((e) => ({ log: e })));
        if (lastRound) {
            console.log('Round KPI:', lastRound);
        }
        console.log('Aggregate KPI:', aggregate);

        const snapList = this._snapshotStore.getRecentSnapshotTable(20);
        if (snapList.length > 0) {
            console.log('Recent positions:');
            console.table(snapList);
        }
        console.groupEnd();

        return {
            events: eventList,
            snapshots: snapList,
            lastRound,
            aggregate,
            baselineDelta: null,
        };
    }
}
