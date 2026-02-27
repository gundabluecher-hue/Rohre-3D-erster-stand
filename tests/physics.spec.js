import { test, expect } from '@playwright/test';
import { loadGame, startGame, startGameWithBots, returnToMenu } from './helpers.js';

test.describe('T41-60: Physik & AI', () => {

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

    // -- Skipped: nicht implementierte Features --
    test.skip('T51: Raycast Precision bei High-Speed', () => { });
    test.skip('T52: Spherecast Penetration Detection', () => { });
    test.skip('T53: CCD Fast Actors', () => { });
    test.skip('T54: Rigidbody Sleep State', () => { });
    test.skip('T55: Physics Step Interpolation', () => { });
    test.skip('T56: Pathfinding A* CPU-Spikes', () => { });
    test.skip('T57: NavMesh Dynamic Obstacle', () => { });
    test.skip('T58: FSM Deadlocks', () => { });
    test.skip('T59: Behavior Tree Fallback Nodes', () => { });
    test.skip('T60: LoS Ray Queries', () => { });
});
