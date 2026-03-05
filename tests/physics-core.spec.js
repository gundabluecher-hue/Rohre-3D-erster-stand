import { test, expect } from '@playwright/test';
import { loadGame, startGame, startGameWithBots } from './helpers.js';

test.describe('Physics Core (T41-T60)', () => {

    test('T41: Arena-Kollision erkennt Wand (außerhalb)', async ({ page }) => {
        await startGame(page);
        const hit = await page.evaluate(() => {
            const g = window.GAME_INSTANCE;
            if (!g?.arena?.checkCollision) return null;
            return g.arena.checkCollision({ x: 999, y: 999, z: 999 }, 0.5);
        });
        expect(hit).toBeTruthy();
    });

    test('T42: Arena-Kollision frei in Mitte', async ({ page }) => {
        await startGame(page);
        const hit = await page.evaluate(() => {
            const g = window.GAME_INSTANCE;
            if (!g?.arena?.checkCollision) return null;
            return g.arena.checkCollision({ x: 0, y: 50, z: 0 }, 0.3);
        });
        expect(!hit).toBeTruthy();
    });

    test('T43: Standard-Map hat Hindernisse', async ({ page }) => {
        await startGame(page);
        const count = await page.evaluate(() =>
            window.GAME_INSTANCE?.arena?.obstacles?.length ?? 0
        );
        expect(count).toBeGreaterThan(0);
    });

    test('T44: Spieler-Position ändert sich nach 1s', async ({ page }) => {
        await startGame(page);
        const moved = await page.evaluate(() =>
            new Promise(resolve => {
                const p = window.GAME_INSTANCE?.entityManager?.players?.[0];
                if (!p) return resolve(false);
                const start = { x: p.position.x, y: p.position.y, z: p.position.z };
                setTimeout(() => {
                    const dx = p.position.x - start.x;
                    const dy = p.position.y - start.y;
                    const dz = p.position.z - start.z;
                    resolve(Math.sqrt(dx * dx + dy * dy + dz * dz) > 0.01);
                }, 1000);
            })
        );
        expect(moved).toBeTruthy();
    });

    test('T45: Spieler hat Trail-Mesh nach 2s', async ({ page }) => {
        await startGame(page);
        await page.waitForTimeout(2000);
        const hasTrail = await page.evaluate(() => {
            const p = window.GAME_INSTANCE?.entityManager?.players?.[0];
            return (p?.trail?.mesh?.geometry?.attributes?.position?.count ?? 0) > 0;
        });
        expect(hasTrail).toBeTruthy();
    });

    test('T46: 1 Bot spawnt korrekt', async ({ page }) => {
        test.setTimeout(60000);
        await startGameWithBots(page, 1);
        const bots = await page.evaluate(() =>
            window.GAME_INSTANCE?.entityManager?.players?.filter(p => p.isBot).length ?? 0
        );
        expect(bots).toBe(1);
    });

    test('T47: EASY bot hat höhere reactionTime als HARD', async ({ page }) => {
        await loadGame(page);
        const result = await page.evaluate(() => {
            const cfg = window.GAME_INSTANCE?.config || window.GAME_INSTANCE?.CONFIG;
            const profiles = cfg?.BOT?.DIFFICULTY_PROFILES;
            if (!profiles) return null;
            return {
                easy: profiles.EASY?.reactionTime,
                hard: profiles.HARD?.reactionTime,
            };
        });
        expect(result).not.toBeNull();
        expect(result.easy).toBeGreaterThan(result.hard);
    });

    test('T48: 4 Bots spawnen korrekt (5 Spieler gesamt)', async ({ page }) => {
        await startGameWithBots(page, 4);
        const total = await page.evaluate(() =>
            window.GAME_INSTANCE?.entityManager?.players?.length ?? 0
        );
        expect(total).toBe(5); // 1 Human + 4 Bots
    });

    test('T49: Spieler ist initial lebendig', async ({ page }) => {
        await startGame(page);
        const alive = await page.evaluate(() =>
            window.GAME_INSTANCE?.entityManager?.players?.[0]?.alive === true
        );
        expect(alive).toBeTruthy();
    });

    test('T50: Spieler beginnt mit Score 0', async ({ page }) => {
        await startGame(page);
        const score = await page.evaluate(() =>
            window.GAME_INSTANCE?.entityManager?.players?.[0]?.score
        );
        expect(score).toBe(0);
    });

    test('T51: Bot erkennt Hindernis via Raycast (_scanProbeRay)', async ({ page }) => {
        await startGameWithBots(page, 1);
        const wallDetected = await page.evaluate(() => {
            const botData = window.GAME_INSTANCE?.entityManager?.bots?.[0];
            if (!botData || !botData.ai || !botData.ai._botAI) return false;
            const bot = botData.player;
            const botAI = botData.ai._botAI;

            const arena = window.GAME_INSTANCE.arena;
            const allPlayers = window.GAME_INSTANCE.entityManager.players;
            const probe = botAI._probes[0]; // Forward

            bot.position.set(0, arena.bounds.maxY - 1, 0);
            botAI._scoreProbe(bot, arena, allPlayers, probe, 10);
            return probe.wallDist < 10 && probe.immediateDanger === true;
        });
        expect(wallDetected).toBeTruthy();
    });

    test('T52: Bot Target Selection wählt nächsten Gegner', async ({ page }) => {
        await startGameWithBots(page, 2);
        const targetSelected = await page.evaluate(() => {
            const botData = window.GAME_INSTANCE?.entityManager?.bots?.[0];
            if (!botData || !botData.ai || !botData.ai._botAI) return false;
            const bot = botData.player;
            const botAI = botData.ai._botAI;

            botAI._selectTarget(bot, window.GAME_INSTANCE.entityManager.players);
            return botAI.state.targetPlayer !== null && botAI.state.targetPlayer !== bot;
        });
        expect(targetSelected).toBeTruthy();
    });

    test('T53: Bot StuckScore steigt bei Blockade', async ({ page }) => {
        await startGameWithBots(page, 1);
        const stuckDetected = await page.evaluate(() => {
            const botData = window.GAME_INSTANCE?.entityManager?.bots?.[0];
            if (!botData || !botData.ai || !botData.ai._botAI) return false;
            const bot = botData.player;
            const botAI = botData.ai._botAI;

            const arena = window.GAME_INSTANCE.arena;
            const allPlayers = window.GAME_INSTANCE.entityManager.players;

            botAI._checkStuckTimer = 0;
            botAI._updateStuckState(bot, arena, allPlayers);
            botAI._checkStuckTimer = 0;
            botAI._updateStuckState(bot, arena, allPlayers);

            return botAI._stuckScore > 0;
        });
        expect(stuckDetected).toBeTruthy();
    });

    test('T54: Bot MapBehavior liest korrektes Profil', async ({ page }) => {
        await startGameWithBots(page, 1);
        const hasBehavior = await page.evaluate(() => {
            const botData = window.GAME_INSTANCE?.entityManager?.bots?.[0];
            if (!botData || !botData.ai || !botData.ai._botAI) return false;
            const botAI = botData.ai._botAI;

            const beh = botAI._mapBehavior(window.GAME_INSTANCE.arena);
            return typeof beh.caution === 'number' && typeof beh.aggressionBias === 'number';
        });
        expect(hasBehavior).toBeTruthy();
    });

    test('T55: Bot Direction updates correctly via steering inputs', async ({ page }) => {
        await startGameWithBots(page, 1);
        const moved = await page.evaluate(() => {
            const botData = window.GAME_INSTANCE?.entityManager?.bots?.[0];
            if (!botData) return false;
            const p = botData.player;
            const initialDir = p.position.clone().set(0, 0, 0);
            p.getDirection(initialDir);
            p.update(0.16, { yawRight: true }); // Apply steering
            const newDir = p.position.clone().set(0, 0, 0);
            p.getDirection(newDir);
            return initialDir.distanceTo(newDir) > 0.01;
        });
        expect(moved).toBeTruthy();
    });

    test('T56: Bot Probes scale correctly (12 probes pro AI)', async ({ page }) => {
        await startGameWithBots(page, 1);
        const probeCount = await page.evaluate(() => {
            const botData = window.GAME_INSTANCE?.entityManager?.bots?.[0];
            return botData?.ai?._botAI?._probes?.length ?? 0;
        });
        expect(probeCount).toBe(12);
    });

    test('T57: Bot _estimateEnemyPressure detects nearby players', async ({ page }) => {
        await startGameWithBots(page, 1);
        const pressure = await page.evaluate(() => {
            const botData = window.GAME_INSTANCE?.entityManager?.bots?.[0];
            if (!botData || !botData.ai || !botData.ai._botAI) return 0;
            const botAI = botData.ai._botAI;
            const bot = botData.player;
            const allPlayers = window.GAME_INSTANCE.entityManager.players;

            // Move human player close to bot
            allPlayers[0].position.copy(bot.position);
            allPlayers[0].position.x += 5;

            return botAI._estimateEnemyPressure(bot.position, bot, allPlayers);
        });
        expect(pressure).toBeGreaterThan(0.5);
    });

    test('T58: Bot FSM Transition to Recovery State', async ({ page }) => {
        await startGameWithBots(page, 1);
        const inRecovery = await page.evaluate(() => {
            const botData = window.GAME_INSTANCE?.entityManager?.bots?.[0];
            if (!botData || !botData.ai || !botData.ai._botAI) return false;
            const botAI = botData.ai._botAI;
            const bot = botData.player;
            const arena = window.GAME_INSTANCE.arena;
            const allPlayers = window.GAME_INSTANCE.entityManager.players;

            botAI._enterRecovery(bot, arena, allPlayers, 'test');
            return botAI.state.recoveryActive && botAI.state.recoveryTimer > 0;
        });
        expect(inRecovery).toBeTruthy();
    });

    test('T59: Bot Recovery Switch Fallback', async ({ page }) => {
        await startGameWithBots(page, 1);
        const switchUsed = await page.evaluate(() => {
            const botData = window.GAME_INSTANCE?.entityManager?.bots?.[0];
            if (!botData || !botData.ai || !botData.ai._botAI) return false;
            const botAI = botData.ai._botAI;
            const bot = botData.player;
            const arena = window.GAME_INSTANCE.arena;
            const allPlayers = window.GAME_INSTANCE.entityManager.players;

            botAI._enterRecovery(bot, arena, allPlayers, 'test');
            botAI.sense.forwardRisk = 1.0;
            botAI.state.recoveryTimer = 0.1; // Simulate close to ending
            botAI._updateRecovery(0.016, bot, arena, allPlayers);
            return botAI.state.recoverySwitchUsed;
        });
        expect(switchUsed).toBeTruthy();
    });

    test('T60: Bot Target InFront Query (LoS)', async ({ page }) => {
        await startGameWithBots(page, 1);
        const targetInFront = await page.evaluate(() => {
            const botData = window.GAME_INSTANCE?.entityManager?.bots?.[0];
            if (!botData || !botData.ai || !botData.ai._botAI) return false;
            const botAI = botData.ai._botAI;
            const bot = botData.player;
            const human = window.GAME_INSTANCE.entityManager.players[0];
            if (!human) return false;

            // Set human directly in front of bot
            const forward = bot.position.clone().set(0, 0, 0);
            bot.getDirection(forward);
            human.position.copy(bot.position).addScaledVector(forward, 10);

            botAI._selectTarget(bot, window.GAME_INSTANCE.entityManager.players);
            return botAI.sense.targetInFront;
        });
        expect(targetInFront).toBeTruthy();
    });

});
