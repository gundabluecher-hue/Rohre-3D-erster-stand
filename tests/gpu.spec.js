import { test, expect } from '@playwright/test';
import { loadGame, startGame, startGameWithBots, returnToMenu } from './helpers.js';

test.describe('T21-40: Rendering & GPU', () => {

    test('T21: WebGL Renderer initialisiert', async ({ page }) => {
        await startGame(page);
        const ok = await page.evaluate(() => {
            const g = window.GAME_INSTANCE;
            return g?.renderer?.renderer?.domElement instanceof HTMLCanvasElement;
        });
        expect(ok).toBeTruthy();
    });

    test('T22: Szene hat Lichter', async ({ page }) => {
        await startGame(page);
        const hasLights = await page.evaluate(() => {
            const g = window.GAME_INSTANCE;
            if (!g?.renderer?.scene) return false;
            let found = false;
            g.renderer.scene.traverse(child => { if (child.isLight) found = true; });
            return found;
        });
        expect(hasLights).toBeTruthy();
    });

    test('T23: Kamera existiert und ist PerspectiveCamera', async ({ page }) => {
        await startGame(page);
        const ok = await page.evaluate(() => {
            return window.GAME_INSTANCE?.renderer?.cameras?.[0]?.isPerspectiveCamera === true;
        });
        expect(ok).toBeTruthy();
    });

    test('T24: Kamera-FOV im gültigen Bereich (1–120)', async ({ page }) => {
        await startGame(page);
        const fov = await page.evaluate(() =>
            window.GAME_INSTANCE?.renderer?.cameras?.[0]?.fov
        );
        expect(fov).toBeGreaterThan(0);
        expect(fov).toBeLessThanOrEqual(120);
    });

    test('T25: Canvas-Größe > 0', async ({ page }) => {
        await loadGame(page);
        const size = await page.evaluate(() => {
            const c = document.getElementById('game-canvas');
            return { w: c.width, h: c.height };
        });
        expect(size.w).toBeGreaterThan(0);
        expect(size.h).toBeGreaterThan(0);
    });

    test('T26: Renderer Pixel-Ratio im Bereich (0–3)', async ({ page }) => {
        await startGame(page);
        const ratio = await page.evaluate(() =>
            window.GAME_INSTANCE?.renderer?.renderer?.getPixelRatio()
        );
        expect(ratio).toBeGreaterThan(0);
        expect(ratio).toBeLessThanOrEqual(3);
    });

    test('T27: Szene hat mehr als 5 Kinder nach Spielstart', async ({ page }) => {
        await startGame(page);
        const count = await page.evaluate(() => {
            const g = window.GAME_INSTANCE;
            if (!g?.renderer?.scene) return 0;
            let n = 0;
            g.renderer.scene.traverse(() => n++);
            return n;
        });
        expect(count).toBeGreaterThan(5);
    });

    test('T28: Kein WebGL-Kontextverlust beim Start', async ({ page }) => {
        const lost = [];
        await page.exposeFunction('__reportContextLost', () => lost.push(true));
        await page.addInitScript(() => {
            window.addEventListener('webglcontextlost', () => window.__reportContextLost());
        });
        await startGame(page);
        await page.waitForTimeout(2000);
        expect(lost).toHaveLength(0);
    });

    // -- Skipped: nicht implementierte Features --
    test.skip('T29: Frustum Culling Edge Cases', () => { });
    test.skip('T30: Occlusion Culling', () => { });
    test.skip('T31: Shadow Map Cascades', () => { });
    test.skip('T32: Bloom Thresholds', () => { });
    test.skip('T33: Chromatic Aberration', () => { });
    test.skip('T34: Anti-Aliasing Glitches', () => { });
    test.skip('T35: Texture Filtering', () => { });
    test.skip('T36: Mipmap Transitions', () => { });
    test.skip('T37: Decal Projection', () => { });
    test.skip('T38: Instanced Mesh Z-Fighting', () => { });
    test.skip('T39: LOD Transitions', () => { });
    test.skip('T40: GPU VRAM Monitoring', () => { });
});
