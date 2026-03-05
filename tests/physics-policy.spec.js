import { test, expect } from '@playwright/test';
import { loadGame, startGameWithBots, startHuntGameWithBots, returnToMenu } from './helpers.js';

test.describe('Physics Policy (T65-T82)', () => {

    test('T65: Bot-Action-Contract sanitizt invalide Payloads robust', async ({ page }) => {
        await loadGame(page);
        const result = await page.evaluate(async () => {
            const { sanitizeBotAction } = await import('/src/entities/ai/actions/BotActionContract.js');
            const warnings = [];
            const sanitized = sanitizeBotAction({
                yawLeft: 'true',
                boost: 1,
                shootItem: 'yes',
                shootItemIndex: 99,
                useItem: -5,
            }, {
                inventoryLength: 3,
                onInvalid: (message) => warnings.push(String(message || '')),
            });
            const invalidPayload = sanitizeBotAction(null, {
                inventoryLength: 3,
                onInvalid: (message) => warnings.push(String(message || '')),
            });
            return { sanitized, invalidPayload, warnings };
        });

        expect(result.sanitized.yawLeft).toBeTruthy();
        expect(result.sanitized.boost).toBeTruthy();
        expect(result.sanitized.shootItem).toBeTruthy();
        expect(result.sanitized.shootItemIndex).toBe(2);
        expect(result.sanitized.useItem).toBe(-1);
        expect(result.invalidPayload.shootItem).toBeFalsy();
        expect(result.invalidPayload.shootItemIndex).toBe(-1);
        expect(result.warnings.length).toBeGreaterThan(0);
    });

    test('T66: Bot-Input bleibt stabil wenn Policy-Update abstuerzt', async ({ page }) => {
        await startGameWithBots(page, 1);
        const result = await page.evaluate(() => {
            const game = window.GAME_INSTANCE;
            const entityManager = game?.entityManager;
            const bot = entityManager?.players?.find((p) => p?.isBot);
            if (!entityManager || !bot) {
                return { error: 'missing-bot' };
            }

            const policy = entityManager.botByPlayer.get(bot);
            if (!policy) {
                return { error: 'missing-policy' };
            }

            const originalUpdate = policy.update;
            let crashed = false;
            let action = null;
            try {
                policy.update = () => {
                    throw new Error('simulated-bot-failure');
                };
                action = entityManager._playerInputSystem.resolvePlayerInput(bot, 1 / 60, null);
            } catch (error) {
                crashed = true;
            } finally {
                policy.update = originalUpdate;
            }

            return { error: null, crashed, action };
        });

        expect(result.error).toBeNull();
        expect(result.crashed).toBeFalsy();
        expect(result.action.shootItem).toBeFalsy();
        expect(result.action.shootMG).toBeFalsy();
        expect(result.action.shootItemIndex).toBe(-1);
        expect(result.action.useItem).toBe(-1);
    });

    test('T67: Item-Slot-Encoding erzeugt stabiles 20-Slot-One-Hot-Array', async ({ page }) => {
        await loadGame(page);
        const result = await page.evaluate(async () => {
            const mod = await import('/src/entities/ai/observation/ItemSlotEncoder.js');
            const encoded = new Array(mod.ITEM_SLOT_COUNT).fill(-1);
            mod.encodeItemSlots(['SPEED_UP', 'ROCKET_MEDIUM', 'UNKNOWN_ITEM', 'ROCKET_MEDIUM'], encoded);
            return {
                encoded,
                slotCount: mod.ITEM_SLOT_COUNT,
                speedUpSlot: mod.ITEM_SLOT_BY_TYPE.SPEED_UP,
                rocketMediumSlot: mod.ITEM_SLOT_BY_TYPE.ROCKET_MEDIUM,
                unknownSlot: mod.ITEM_SLOT_UNKNOWN_INDEX,
            };
        });

        expect(result.encoded.length).toBe(result.slotCount);
        expect(result.encoded[result.speedUpSlot]).toBe(1);
        expect(result.encoded[result.rocketMediumSlot]).toBe(1);
        expect(result.encoded[result.unknownSlot]).toBe(1);
        expect(result.encoded.every((value) => value === 0 || value === 1)).toBeTruthy();
    });

    test('T68: Mode-Feature-Encoding mappt classic/hunt deterministisch', async ({ page }) => {
        await loadGame(page);
        const result = await page.evaluate(async () => {
            const mod = await import('/src/entities/ai/observation/ModeFeatureEncoder.js');
            const classic = mod.writeModeFeatures('classic', [0, 0, 0]);
            const hunt = mod.writeModeFeatures('HUNT', [0, 0, 0]);
            const fallback = mod.writeModeFeatures('unknown-mode', [0, 0, 0]);
            return { classic, hunt, fallback };
        });

        expect(result.classic).toEqual([0, 1, 0]);
        expect(result.hunt).toEqual([1, 0, 1]);
        expect(result.fallback).toEqual([0, 1, 0]);
    });

    test('T69: Observation-Schema V1 hat feste Laenge und eindeutige Indizes', async ({ page }) => {
        await loadGame(page);
        const result = await page.evaluate(async () => {
            const schema = await import('/src/entities/ai/observation/ObservationSchemaV1.js');
            const semantics = await import('/src/entities/ai/observation/ObservationSemantics.js');
            const indexValues = Object.values(schema.OBSERVATION_INDEX)
                .filter((value) => Number.isInteger(value))
                .sort((a, b) => a - b);
            const uniqueIndices = new Set(indexValues);
            const semanticsIndices = semantics.OBSERVATION_SEMANTICS_V1.map((entry) => entry.index);
            const uniqueSemanticIndices = new Set(semanticsIndices);

            return {
                version: schema.OBSERVATION_SCHEMA_VERSION,
                length: schema.OBSERVATION_LENGTH_V1,
                indexCount: indexValues.length,
                uniqueIndexCount: uniqueIndices.size,
                minIndex: indexValues[0],
                maxIndex: indexValues[indexValues.length - 1],
                itemSlot00: schema.ITEM_SLOT_00,
                itemSlot19: schema.ITEM_SLOT_19,
                semanticsLength: semantics.OBSERVATION_SEMANTICS_V1.length,
                uniqueSemanticsIndexCount: uniqueSemanticIndices.size,
                hasUniqueSemanticsIndices: semantics.hasUniqueObservationSemanticIndices(),
                hasExpectedSemanticsLength: semantics.hasExpectedObservationSemanticLength(schema.OBSERVATION_LENGTH_V1),
            };
        });

        expect(result.version).toBe('v1');
        expect(result.length).toBe(40);
        expect(result.indexCount).toBe(40);
        expect(result.uniqueIndexCount).toBe(40);
        expect(result.minIndex).toBe(0);
        expect(result.maxIndex).toBe(39);
        expect(result.itemSlot00).toBe(20);
        expect(result.itemSlot19).toBe(39);
        expect(result.semanticsLength).toBe(40);
        expect(result.uniqueSemanticsIndexCount).toBe(40);
        expect(result.hasUniqueSemanticsIndices).toBeTruthy();
        expect(result.hasExpectedSemanticsLength).toBeTruthy();
    });

    test('T70: Observation-System extrahiert normalisierte Runtime-Features', async ({ page }) => {
        await startGameWithBots(page, 1);
        const result = await page.evaluate(async () => {
            const schema = await import('/src/entities/ai/observation/ObservationSchemaV1.js');
            const observation = await import('/src/entities/ai/observation/ObservationSystem.js');

            const game = window.GAME_INSTANCE;
            const entityManager = game?.entityManager;
            const bot = entityManager?.players?.find((player) => player?.isBot);
            if (!entityManager || !bot) {
                return { error: 'missing-bot' };
            }

            const context = observation.createObservationContext({
                arena: entityManager.arena,
                players: entityManager.players,
                projectiles: entityManager.projectiles,
                mode: game?.activeGameMode || 'classic',
                planarMode: !!game?.config?.GAMEPLAY?.PLANAR_MODE,
            });
            const vector = observation.buildObservation(bot, context);
            const itemSlots = vector.slice(schema.ITEM_SLOT_00, schema.ITEM_SLOT_19 + 1);
            const ratioIndices = [
                schema.SPEED_RATIO,
                schema.HEALTH_RATIO,
                schema.SHIELD_RATIO,
                schema.WALL_DISTANCE_FRONT,
                schema.WALL_DISTANCE_LEFT,
                schema.WALL_DISTANCE_RIGHT,
                schema.WALL_DISTANCE_UP,
                schema.WALL_DISTANCE_DOWN,
                schema.TARGET_DISTANCE_RATIO,
                schema.PRESSURE_LEVEL,
                schema.LOCAL_OPENNESS_RATIO,
                schema.INVENTORY_COUNT_RATIO,
            ];
            const ratiosInRange = ratioIndices.every((index) => {
                const value = Number(vector[index]);
                return Number.isFinite(value) && value >= 0 && value <= 1;
            });
            const signedAlignment = Number(vector[schema.TARGET_ALIGNMENT]);
            const selectedSlot = Number(vector[schema.SELECTED_ITEM_SLOT]);

            return {
                error: null,
                length: vector.length,
                ratiosInRange,
                signedAlignmentInRange: Number.isFinite(signedAlignment) && signedAlignment >= -1 && signedAlignment <= 1,
                selectedSlotInRange: selectedSlot >= -1 && selectedSlot <= 19,
                itemSlotCount: itemSlots.length,
                itemSlotsValid: itemSlots.every((value) => value === 0 || value === 1),
            };
        });

        expect(result.error).toBeNull();
        expect(result.length).toBe(40);
        expect(result.ratiosInRange).toBeTruthy();
        expect(result.signedAlignmentInRange).toBeTruthy();
        expect(result.selectedSlotInRange).toBeTruthy();
        expect(result.itemSlotCount).toBe(20);
        expect(result.itemSlotsValid).toBeTruthy();
    });

    test('T71: Runtime-Context-Signatur uebergibt Kontext inkl. Observation an Policies', async ({ page }) => {
        await startGameWithBots(page, 1);
        const result = await page.evaluate(() => {
            const game = window.GAME_INSTANCE;
            const entityManager = game?.entityManager;
            const bot = entityManager?.players?.find((player) => player?.isBot);
            if (!entityManager || !bot) {
                return { error: 'missing-bot' };
            }

            const policy = entityManager.botByPlayer.get(bot);
            if (!policy) {
                return { error: 'missing-policy' };
            }

            const originalUpdate = policy.update;
            const originalFlag = policy.usesRuntimeContext;
            let observed = null;
            try {
                policy.usesRuntimeContext = true;
                policy.update = function runtimeContextUpdate(dt, player, context) {
                    observed = {
                        argCount: arguments.length,
                        hasArena: !!context?.arena,
                        hasPlayers: Array.isArray(context?.players),
                        hasProjectiles: Array.isArray(context?.projectiles),
                        hasRules: !!context?.rules,
                        hasObservation: Number(context?.observation?.length) === 40,
                        modeType: typeof context?.mode,
                    };
                    return { yawLeft: true };
                };
                const action = entityManager._playerInputSystem.resolvePlayerInput(bot, 1 / 60, null);
                return { error: null, observed, actionYawLeft: !!action?.yawLeft };
            } finally {
                policy.update = originalUpdate;
                policy.usesRuntimeContext = originalFlag;
            }
        });

        expect(result.error).toBeNull();
        expect(result.observed.argCount).toBe(3);
        expect(result.observed.hasArena).toBeTruthy();
        expect(result.observed.hasPlayers).toBeTruthy();
        expect(result.observed.hasProjectiles).toBeTruthy();
        expect(result.observed.hasRules).toBeTruthy();
        expect(result.observed.hasObservation).toBeTruthy();
        expect(result.observed.modeType).toBe('string');
        expect(result.actionYawLeft).toBeTruthy();
    });

    test('T72: Legacy-Policy-Signatur bleibt kompatibel', async ({ page }) => {
        await startGameWithBots(page, 1);
        const result = await page.evaluate(() => {
            const game = window.GAME_INSTANCE;
            const entityManager = game?.entityManager;
            const bot = entityManager?.players?.find((player) => player?.isBot);
            if (!entityManager || !bot) {
                return { error: 'missing-bot' };
            }

            const policy = entityManager.botByPlayer.get(bot);
            if (!policy) {
                return { error: 'missing-policy' };
            }

            const originalUpdate = policy.update;
            const originalFlag = policy.usesRuntimeContext;
            let observed = null;
            try {
                policy.usesRuntimeContext = false;
                policy.update = function legacyUpdate(dt, player, arena, allPlayers, projectiles) {
                    observed = {
                        argCount: arguments.length,
                        hasArena: !!arena?.checkCollision,
                        playersLength: Array.isArray(allPlayers) ? allPlayers.length : -1,
                        hasProjectileArray: Array.isArray(projectiles),
                    };
                    return { yawRight: true };
                };
                const action = entityManager._playerInputSystem.resolvePlayerInput(bot, 1 / 60, null);
                return { error: null, observed, actionYawRight: !!action?.yawRight };
            } finally {
                policy.update = originalUpdate;
                policy.usesRuntimeContext = originalFlag;
            }
        });

        expect(result.error).toBeNull();
        expect(result.observed.argCount).toBe(5);
        expect(result.observed.hasArena).toBeTruthy();
        expect(result.observed.playersLength).toBeGreaterThan(0);
        expect(result.observed.hasProjectileArray).toBeTruthy();
        expect(result.actionYawRight).toBeTruthy();
    });

    test('T73: BotPolicyRegistry registriert modulare Bridge-Policy-Typen', async ({ page }) => {
        await loadGame(page);
        const result = await page.evaluate(async () => {
            const { BotPolicyRegistry } = await import('/src/entities/ai/BotPolicyRegistry.js');
            const { BOT_POLICY_TYPES } = await import('/src/entities/ai/BotPolicyTypes.js');

            const registry = new BotPolicyRegistry();
            const classicBridge = registry.create(BOT_POLICY_TYPES.CLASSIC_BRIDGE);
            const huntBridge = registry.create(BOT_POLICY_TYPES.HUNT_BRIDGE);

            return {
                classicType: classicBridge?.type,
                huntType: huntBridge?.type,
                classicUsesRuntimeContext: classicBridge?.usesRuntimeContext === true,
                huntUsesRuntimeContext: huntBridge?.usesRuntimeContext === true,
                classicHasUpdate: typeof classicBridge?.update === 'function',
                huntHasUpdate: typeof huntBridge?.update === 'function',
            };
        });

        expect(result.classicType).toBe('classic-bridge');
        expect(result.huntType).toBe('hunt-bridge');
        expect(result.classicUsesRuntimeContext).toBeTruthy();
        expect(result.huntUsesRuntimeContext).toBeTruthy();
        expect(result.classicHasUpdate).toBeTruthy();
        expect(result.huntHasUpdate).toBeTruthy();
    });

    test('T74: BotPolicyRegistry faellt bei Fehlkonfiguration kontrolliert auf rule-based zurueck', async ({ page }) => {
        await loadGame(page);
        const result = await page.evaluate(async () => {
            const { BotPolicyRegistry } = await import('/src/entities/ai/BotPolicyRegistry.js');
            const { BOT_POLICY_TYPES } = await import('/src/entities/ai/BotPolicyTypes.js');

            const registry = new BotPolicyRegistry();
            registry.register('broken-bridge', () => {
                throw new Error('simulated-registry-factory-error');
            });

            const unknown = registry.create('unknown-policy-type');
            const broken = registry.create('broken-bridge');
            const disabledBridge = registry.create(BOT_POLICY_TYPES.CLASSIC_BRIDGE, { bridgeEnabled: false });

            return {
                unknownType: unknown?.type,
                brokenType: broken?.type,
                disabledBridgeType: disabledBridge?.type,
                unknownHasUpdate: typeof unknown?.update === 'function',
                brokenHasUpdate: typeof broken?.update === 'function',
            };
        });

        expect(result.unknownType).toBe('rule-based');
        expect(result.brokenType).toBe('rule-based');
        expect(result.disabledBridgeType).toBe('rule-based');
        expect(result.unknownHasUpdate).toBeTruthy();
        expect(result.brokenHasUpdate).toBeTruthy();
    });

    test('T75: ClassicBridgePolicy leitet Kern-Action aus Observation-Vektor ab', async ({ page }) => {
        await loadGame(page);
        const result = await page.evaluate(async () => {
            const { ClassicBridgePolicy } = await import('/src/entities/ai/ClassicBridgePolicy.js');
            const schema = await import('/src/entities/ai/observation/ObservationSchemaV1.js');
            const bot = {
                index: 0,
                inventory: ['SHIELD'],
                selectedItemIndex: 0,
            };
            const context = {
                players: [],
                projectiles: [],
                observation: null,
            };
            context.observation = new Array(schema.OBSERVATION_LENGTH_V1).fill(0);
            context.observation[schema.WALL_DISTANCE_FRONT] = 0.18;
            context.observation[schema.WALL_DISTANCE_LEFT] = 0.14;
            context.observation[schema.WALL_DISTANCE_RIGHT] = 0.9;
            context.observation[schema.TARGET_DISTANCE_RATIO] = 0.2;
            context.observation[schema.TARGET_ALIGNMENT] = 0.94;
            context.observation[schema.TARGET_IN_FRONT] = 1;
            context.observation[schema.PRESSURE_LEVEL] = 0.84;
            context.observation[schema.PROJECTILE_THREAT] = 1;
            context.observation[schema.LOCAL_OPENNESS_RATIO] = 0.7;
            context.observation[schema.INVENTORY_COUNT_RATIO] = 0.1;
            context.observation[schema.SELECTED_ITEM_SLOT] = 0;

            const policy = new ClassicBridgePolicy();
            const action = policy.update(1 / 60, bot, context);

            return {
                error: null,
                type: policy.type,
                yawRight: !!action?.yawRight,
                shootMG: !!action?.shootMG,
                shootItem: !!action?.shootItem,
                shootItemIndex: Number(action?.shootItemIndex),
                boost: !!action?.boost,
            };
        });

        expect(result.error).toBeNull();
        expect(result.type).toBe('classic-bridge');
        expect(result.yawRight).toBeTruthy();
        expect(result.shootMG).toBeTruthy();
        expect(result.shootItem).toBeTruthy();
        expect(result.shootItemIndex).toBe(0);
        expect(result.boost).toBeTruthy();
    });

    test('T76: ClassicBridgePolicy routed Action-Failures kontrolliert auf RuleBased-Fallback', async ({ page }) => {
        await loadGame(page);
        const result = await page.evaluate(async () => {
            const { ClassicBridgePolicy } = await import('/src/entities/ai/ClassicBridgePolicy.js');
            const schema = await import('/src/entities/ai/observation/ObservationSchemaV1.js');
            const bot = {
                index: 0,
                inventory: [],
                selectedItemIndex: 0,
            };
            const context = {
                players: [],
                projectiles: [],
                observation: null,
            };
            context.observation = new Array(schema.OBSERVATION_LENGTH_V1).fill(0);
            context.observation[schema.WALL_DISTANCE_FRONT] = 0.65;

            const policy = new ClassicBridgePolicy({
                resolveAction: () => {
                    throw new Error('simulated-classic-bridge-action-failure');
                },
            });

            const fallbackType = policy._fallbackPolicy?.type;
            const originalFallbackUpdate = policy._fallbackPolicy?.update;
            let fallbackCalled = false;
            let action = null;
            try {
                policy._fallbackPolicy.update = function fallbackUpdate() {
                    fallbackCalled = true;
                    return { yawLeft: true };
                };
                action = policy.update(1 / 60, bot, context);
            } finally {
                policy._fallbackPolicy.update = originalFallbackUpdate;
            }

            return {
                error: null,
                fallbackType,
                fallbackCalled,
                yawLeft: !!action?.yawLeft,
            };
        });

        expect(result.error).toBeNull();
        expect(result.fallbackType).toBe('rule-based');
        expect(result.fallbackCalled).toBeTruthy();
        expect(result.yawLeft).toBeTruthy();
    });

    test('T77: HuntBridgePolicy setzt MG-Druck auf Basis von Observation + Gegnernaehe', async ({ page }) => {
        await startHuntGameWithBots(page, 1);
        const result = await page.evaluate(async () => {
            const { HuntBridgePolicy } = await import('/src/entities/ai/HuntBridgePolicy.js');
            const schema = await import('/src/entities/ai/observation/ObservationSchemaV1.js');
            const game = window.GAME_INSTANCE;
            const entityManager = game?.entityManager;
            const bot = entityManager?.players?.find((player) => player?.isBot);
            const enemy = entityManager?.players?.find((player) => !player?.isBot);
            if (!entityManager || !bot || !enemy) {
                return { error: 'missing-hunt-state' };
            }

            bot.hp = Math.max(1, bot.maxHp || 1);
            bot.inventory = [];
            bot.position.set(0, 50, 0);
            bot.setLookAtWorld?.(0, 50, -100);
            enemy.position.set(0, 50, -18);

            const context = entityManager.createBotRuntimeContext(bot, 1 / 60);
            context.observation = new Array(schema.OBSERVATION_LENGTH_V1).fill(0);
            context.observation[schema.TARGET_DISTANCE_RATIO] = 0.12;
            context.observation[schema.TARGET_IN_FRONT] = 1;
            context.observation[schema.PRESSURE_LEVEL] = 0.35;
            context.observation[schema.PROJECTILE_THREAT] = 0;

            const policy = new HuntBridgePolicy();
            const action = policy.update(1 / 60, bot, context);
            return {
                error: null,
                type: policy.type,
                shootMG: !!action?.shootMG,
                shootItem: !!action?.shootItem,
                shootItemIndex: Number(action?.shootItemIndex),
            };
        });

        expect(result.error).toBeNull();
        expect(result.type).toBe('hunt-bridge');
        expect(result.shootMG).toBeTruthy();
        expect(result.shootItem).toBeFalsy();
        expect(result.shootItemIndex).toBe(-1);
    });

    test('T78: HuntBridgePolicy priorisiert Rocket + Boost bei niedrigem HP-Druck', async ({ page }) => {
        await startHuntGameWithBots(page, 1);
        const result = await page.evaluate(async () => {
            const { HuntBridgePolicy } = await import('/src/entities/ai/HuntBridgePolicy.js');
            const schema = await import('/src/entities/ai/observation/ObservationSchemaV1.js');
            const game = window.GAME_INSTANCE;
            const entityManager = game?.entityManager;
            const bot = entityManager?.players?.find((player) => player?.isBot);
            const enemy = entityManager?.players?.find((player) => !player?.isBot);
            if (!entityManager || !bot || !enemy) {
                return { error: 'missing-hunt-state' };
            }

            bot.maxHp = Math.max(1, Number(bot.maxHp) || 1);
            bot.hp = Math.max(1, bot.maxHp * 0.2);
            bot.inventory = ['ROCKET_WEAK', 'ROCKET_STRONG'];
            bot.selectedItemIndex = 0;
            bot.position.set(0, 50, 0);
            bot.setLookAtWorld?.(0, 50, -100);
            enemy.position.set(2, 50, -14);

            const context = entityManager.createBotRuntimeContext(bot, 1 / 60);
            context.observation = new Array(schema.OBSERVATION_LENGTH_V1).fill(0);
            context.observation[schema.TARGET_DISTANCE_RATIO] = 0.55;
            context.observation[schema.TARGET_IN_FRONT] = 1;
            context.observation[schema.PRESSURE_LEVEL] = 0.92;
            context.observation[schema.PROJECTILE_THREAT] = 1;

            const policy = new HuntBridgePolicy();
            const action = policy.update(1 / 60, bot, context);
            return {
                error: null,
                shootItem: !!action?.shootItem,
                shootItemIndex: Number(action?.shootItemIndex),
                boost: !!action?.boost,
                yawCommand: !!action?.yawLeft || !!action?.yawRight,
                pitchCommand: !!action?.pitchUp || !!action?.pitchDown,
            };
        });

        expect(result.error).toBeNull();
        expect(result.shootItem).toBeTruthy();
        expect(result.shootItemIndex).toBe(1);
        expect(result.boost).toBeTruthy();
        expect(result.yawCommand || result.pitchCommand).toBeTruthy();
    });

    test('T79: RuntimeConfig setzt Trainer-WebSocket-Flag standardmaessig auf false', async ({ page }) => {
        await loadGame(page);
        const result = await page.evaluate(async () => {
            const { createRuntimeConfigSnapshot } = await import('/src/core/RuntimeConfig.js');
            const snapshot = createRuntimeConfigSnapshot({});
            return {
                policyStrategy: String(snapshot?.bot?.policyStrategy || ''),
                policyType: String(snapshot?.bot?.policyType || ''),
                trainerBridgeEnabled: !!snapshot?.bot?.trainerBridgeEnabled,
                trainerBridgeUrl: String(snapshot?.bot?.trainerBridgeUrl || ''),
                trainerBridgeTimeoutMs: Number(snapshot?.bot?.trainerBridgeTimeoutMs || 0),
            };
        });

        expect(result.policyStrategy).toBe('auto');
        expect(result.policyType).toBe('rule-based');
        expect(result.trainerBridgeEnabled).toBeFalsy();
        expect(result.trainerBridgeUrl.startsWith('ws://')).toBeTruthy();
        expect(result.trainerBridgeTimeoutMs).toBeGreaterThanOrEqual(20);
    });

    test('T80: ObservationBridgePolicy faellt bei Trainer-Timeout auf lokale Policy zurueck', async ({ page }) => {
        await loadGame(page);
        const result = await page.evaluate(async () => {
            const { ObservationBridgePolicy } = await import('/src/entities/ai/ObservationBridgePolicy.js');
            const originalWebSocket = globalThis.WebSocket;
            let fallbackCalls = 0;

            class MockWebSocket {
                static CONNECTING = 0;
                static OPEN = 1;
                static CLOSING = 2;
                static CLOSED = 3;

                constructor() {
                    this.readyState = MockWebSocket.OPEN;
                    this._listeners = new Map();
                    setTimeout(() => this._emit('open', {}), 0);
                }

                addEventListener(type, handler) {
                    if (!this._listeners.has(type)) {
                        this._listeners.set(type, []);
                    }
                    this._listeners.get(type).push(handler);
                }

                removeEventListener(type, handler) {
                    const handlers = this._listeners.get(type) || [];
                    this._listeners.set(type, handlers.filter((entry) => entry !== handler));
                }

                _emit(type, event) {
                    const handlers = this._listeners.get(type) || [];
                    handlers.forEach((handler) => handler(event));
                }

                send() {
                    // intentionally no response to trigger timeout path
                }

                close() {
                    this.readyState = MockWebSocket.CLOSED;
                    this._emit('close', {});
                }
            }

            globalThis.WebSocket = MockWebSocket;
            try {
                const fallbackPolicy = {
                    type: 'rule-based',
                    update() {
                        fallbackCalls++;
                        return { yawLeft: true };
                    },
                };
                const policy = new ObservationBridgePolicy({
                    type: 'classic-bridge',
                    fallbackPolicy,
                    trainerBridgeEnabled: true,
                    trainerBridgeTimeoutMs: 8,
                    trainerBridgeUrl: 'ws://127.0.0.1:8765',
                });
                const bot = { index: 0, inventory: [] };
                const context = {
                    mode: 'classic',
                    dt: 1 / 60,
                    players: [],
                    projectiles: [],
                    observation: new Array(40).fill(0),
                };

                const firstAction = policy.update(1 / 60, bot, context);
                await new Promise((resolve) => setTimeout(resolve, 20));
                const secondAction = policy.update(1 / 60, bot, context);

                policy.reset();
                return {
                    firstYawLeft: !!firstAction?.yawLeft,
                    secondYawLeft: !!secondAction?.yawLeft,
                    fallbackCalls,
                };
            } finally {
                globalThis.WebSocket = originalWebSocket;
            }
        });

        expect(result.firstYawLeft).toBeTruthy();
        expect(result.secondYawLeft).toBeTruthy();
        expect(result.fallbackCalls).toBeGreaterThanOrEqual(2);
    });

    test('T81: RuntimeConfig loest Bot-Policy-Strategie reproduzierbar nach Modus auf', async ({ page }) => {
        await loadGame(page);
        const result = await page.evaluate(async () => {
            const { createRuntimeConfigSnapshot } = await import('/src/core/RuntimeConfig.js');

            const classicAuto = createRuntimeConfigSnapshot({
                gameMode: 'CLASSIC',
                botPolicyStrategy: 'auto',
            });
            const huntAuto = createRuntimeConfigSnapshot({
                gameMode: 'HUNT',
                botPolicyStrategy: 'auto',
            });
            const classicBridge = createRuntimeConfigSnapshot({
                gameMode: 'CLASSIC',
                botPolicyStrategy: 'bridge',
            });
            const huntBridge = createRuntimeConfigSnapshot({
                gameMode: 'HUNT',
                botPolicyStrategy: 'bridge',
            });
            const forcedRuleBased = createRuntimeConfigSnapshot({
                gameMode: 'HUNT',
                botPolicyStrategy: 'rule-based',
            });
            const invalidStrategy = createRuntimeConfigSnapshot({
                gameMode: 'CLASSIC',
                botPolicyStrategy: 'unknown',
            });

            return {
                classicAuto: classicAuto?.bot?.policyType,
                huntAuto: huntAuto?.bot?.policyType,
                classicBridge: classicBridge?.bot?.policyType,
                huntBridge: huntBridge?.bot?.policyType,
                forcedRuleBased: forcedRuleBased?.bot?.policyType,
                invalidStrategyName: invalidStrategy?.bot?.policyStrategy,
                invalidStrategyPolicy: invalidStrategy?.bot?.policyType,
            };
        });

        expect(result.classicAuto).toBe('rule-based');
        expect(result.huntAuto).toBe('hunt');
        expect(result.classicBridge).toBe('classic-bridge');
        expect(result.huntBridge).toBe('hunt-bridge');
        expect(result.forcedRuleBased).toBe('rule-based');
        expect(result.invalidStrategyName).toBe('auto');
        expect(result.invalidStrategyPolicy).toBe('rule-based');
    });

    test('T82: Session-Wiring uebergibt aufgeloeste Bot-Policy an EntityManager', async ({ page }) => {
        await loadGame(page);
        const result = await page.evaluate(() => {
            const game = window.GAME_INSTANCE;
            if (!game?.startMatch || !game?._returnToMenu) {
                return { error: 'missing-game-hooks' };
            }

            game.settings.mode = '1p';
            game.settings.numBots = 1;

            const runScenario = (gameMode, strategy) => {
                game.settings.gameMode = gameMode;
                game.settings.botPolicyStrategy = strategy;
                game._onSettingsChanged();
                game.startMatch();

                const entityManager = game.entityManager;
                const botPlayer = entityManager?.players?.find((player) => player?.isBot) || null;
                const botPolicy = botPlayer ? entityManager?.botByPlayer?.get(botPlayer) : null;
                const snapshot = {
                    mode: String(game.runtimeConfig?.session?.activeGameMode || ''),
                    strategy: String(game.runtimeConfig?.bot?.policyStrategy || ''),
                    runtimePolicyType: String(game.runtimeConfig?.bot?.policyType || ''),
                    entityPolicyType: String(entityManager?.botPolicyType || ''),
                    botPolicyType: String(botPolicy?.type || ''),
                };
                game._returnToMenu();
                return snapshot;
            };

            return {
                error: null,
                classicBridge: runScenario('CLASSIC', 'bridge'),
                huntBridge: runScenario('HUNT', 'bridge'),
                huntAuto: runScenario('HUNT', 'auto'),
            };
        });

        expect(result.error).toBeNull();
        expect(result.classicBridge.runtimePolicyType).toBe('classic-bridge');
        expect(result.classicBridge.entityPolicyType).toBe('classic-bridge');
        expect(result.classicBridge.botPolicyType).toBe('classic-bridge');
        expect(result.huntBridge.runtimePolicyType).toBe('hunt-bridge');
        expect(result.huntBridge.entityPolicyType).toBe('hunt-bridge');
        expect(result.huntBridge.botPolicyType).toBe('hunt-bridge');
        expect(result.huntAuto.runtimePolicyType).toBe('hunt');
        expect(result.huntAuto.entityPolicyType).toBe('hunt');
        expect(result.huntAuto.botPolicyType).toBe('hunt');
    });

});
