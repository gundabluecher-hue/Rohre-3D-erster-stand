import {
    MENU_LIFECYCLE_EVENT_CONTRACT_VERSION,
    buildMenuLifecycleEventPayload,
} from './MenuStateContracts.js';

export const MENU_MULTIPLAYER_EVENT_TYPES = Object.freeze({
    HOST: 'multiplayer_host',
    JOIN: 'multiplayer_join',
    READY_TOGGLE: 'multiplayer_ready_toggle',
    READY_INVALIDATED: 'multiplayer_ready_invalidated',
});

function normalizeString(value, fallback = '') {
    const normalized = typeof value === 'string' ? value.trim() : '';
    return normalized || fallback;
}

export class MenuMultiplayerBridge {
    constructor(options = {}) {
        this.contractVersion = normalizeString(options.contractVersion, MENU_LIFECYCLE_EVENT_CONTRACT_VERSION);
        this.onEvent = typeof options.onEvent === 'function' ? options.onEvent : null;
        this.onStatus = typeof options.onStatus === 'function' ? options.onStatus : null;
        this._events = [];
        this._readyByActor = new Map();
    }

    _emit(eventType, payload = null) {
        const event = buildMenuLifecycleEventPayload(eventType, {
            contractVersion: this.contractVersion,
            channel: 'multiplayer',
            payload: payload && typeof payload === 'object' ? { ...payload } : {},
        });
        event.timestampMs = Date.now();
        this._events.push(event);
        if (this._events.length > 40) {
            this._events.shift();
        }

        this.onEvent?.(event);
        return event;
    }

    _setStatus(message) {
        if (!message) return;
        this.onStatus?.(String(message));
    }

    host(options = {}) {
        const actorId = normalizeString(options.actorId, 'owner');
        const lobbyCode = normalizeString(options.lobbyCode, 'local-lobby');
        this._readyByActor.clear();
        this._setStatus(`Host erstellt Lobby: ${lobbyCode}`);
        return this._emit(MENU_MULTIPLAYER_EVENT_TYPES.HOST, {
            actorId,
            lobbyCode,
            mode: 'host',
        });
    }

    join(options = {}) {
        const actorId = normalizeString(options.actorId, 'player');
        const lobbyCode = normalizeString(options.lobbyCode, 'local-lobby');
        this._readyByActor.set(actorId, false);
        this._setStatus(`Join angefragt: ${lobbyCode}`);
        return this._emit(MENU_MULTIPLAYER_EVENT_TYPES.JOIN, {
            actorId,
            lobbyCode,
            mode: 'join',
        });
    }

    toggleReady(options = {}) {
        const actorId = normalizeString(options.actorId, 'player');
        const current = this._readyByActor.get(actorId) === true;
        const ready = typeof options.ready === 'boolean' ? options.ready : !current;
        this._readyByActor.set(actorId, ready);
        this._setStatus(ready ? 'Ready gesetzt' : 'Ready entfernt');
        return this._emit(MENU_MULTIPLAYER_EVENT_TYPES.READY_TOGGLE, {
            actorId,
            ready,
        });
    }

    invalidateReadyForAll(reason = 'host_settings_changed') {
        let hadReady = false;
        for (const [actorId, ready] of this._readyByActor.entries()) {
            if (!ready) continue;
            hadReady = true;
            this._readyByActor.set(actorId, false);
        }
        if (!hadReady) return null;
        this._setStatus('Ready-Status zurueckgesetzt (Host-Aenderung)');
        return this._emit(MENU_MULTIPLAYER_EVENT_TYPES.READY_INVALIDATED, {
            reason: normalizeString(reason, 'host_settings_changed'),
        });
    }

    getEvents() {
        return this._events.slice();
    }
}
