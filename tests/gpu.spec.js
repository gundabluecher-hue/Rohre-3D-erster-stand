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

    test('T29: Schatten-Maps sind für das Hauptlicht aktiviert', async ({ page }) => {
        await startGame(page);
        const lightProps = await page.evaluate(() => {
            const g = window.GAME_INSTANCE;
            if (!g?.renderer?.scene) return null;
            let dirLightCastShadow = false;
            let dirLightMapSize = 0;
            g.renderer.scene.traverse(child => {
                if (child.isDirectionalLight && child.castShadow) {
                    dirLightCastShadow = true;
                    if (child.shadow && child.shadow.mapSize) {
                        dirLightMapSize = child.shadow.mapSize.width;
                    }
                }
            });
            return { castShadow: dirLightCastShadow, mapSize: dirLightMapSize };
        });
        expect(lightProps).not.toBeNull();
        expect(lightProps.castShadow).toBeTruthy();
        expect(lightProps.mapSize).toBeGreaterThanOrEqual(512); // DEFAULT_SHADOW_MAP_SIZE in Config is usually 512
    });

    test('T30: Render-Qualität LOW reduziert Features', async ({ page }) => {
        await startGame(page);
        const lowSettings = await page.evaluate(() => {
            const g = window.GAME_INSTANCE;
            g.renderer.setQuality('LOW');
            return {
                shadows: g.renderer.renderer.shadowMap.enabled,
                toneMapping: g.renderer.renderer.toneMapping,
                pixelRatio: g.renderer.renderer.getPixelRatio()
            };
        });
        expect(lowSettings.shadows).toBeFalsy();
        expect(lowSettings.toneMapping).toBe(0); // THREE.NoToneMapping
        expect(lowSettings.pixelRatio).toBeLessThanOrEqual(0.8);
    });

    test('T31: Render-Qualität HIGH aktiviert Features', async ({ page }) => {
        await startGame(page);
        const highSettings = await page.evaluate(() => {
            const g = window.GAME_INSTANCE;
            g.renderer.setQuality('HIGH');
            return {
                shadows: g.renderer.renderer.shadowMap.enabled,
                toneMapping: g.renderer.renderer.toneMapping,
                pixelRatio: g.renderer.renderer.getPixelRatio()
            };
        });
        expect(highSettings.shadows).toBeTruthy();
        expect(highSettings.toneMapping).not.toBe(0); // THREE.ACESFilmicToneMapping is 4
        expect(highSettings.pixelRatio).toBeGreaterThan(0.8);
    });

    test('T32: Szene nutzt definierte Scene-Roots', async ({ page }) => {
        await startGame(page);
        const hasRoots = await page.evaluate(() => {
            const g = window.GAME_INSTANCE;
            const scene = g?.renderer?.scene;
            if (!scene) return false;

            let pRoot = false, mRoot = false, dRoot = false;
            scene.children.forEach(child => {
                if (child.name === 'persistentRoot') pRoot = true;
                if (child.name === 'matchRoot') mRoot = true;
                if (child.name === 'debugRoot') dRoot = true;
            });
            return pRoot && mRoot && dRoot;
        });
        expect(hasRoots).toBeTruthy();
    });

    test('T33: Cinematic Camera blend reagiert auf Camera-Mode-Wechsel', async ({ page }) => {
        await startGame(page);
        const probe = await page.evaluate(() => {
            const g = window.GAME_INSTANCE;
            const rig = g?.renderer?.cameraRigSystem;
            const cinematic = rig?.cinematicCameraSystem;
            if (!g || !rig || !cinematic || !g.entityManager) return null;

            const tickCameras = (steps) => {
                for (let i = 0; i < steps; i++) {
                    g.entityManager.updateCameras(1 / 60);
                }
            };

            const initialBlend = cinematic.getPlayerBlend?.(0) || 0;
            tickCameras(36);
            const thirdPersonBlend = cinematic.getPlayerBlend?.(0) || 0;

            g.renderer.cycleCamera(0);
            tickCameras(36);
            const firstPersonBlend = cinematic.getPlayerBlend?.(0) || 0;

            return {
                enabled: cinematic.isEnabled?.() === true,
                initialBlend,
                thirdPersonBlend,
                firstPersonBlend,
                activeMode: g.renderer.getCameraMode(0),
            };
        });

        expect(probe).not.toBeNull();
        expect(probe.enabled).toBeTruthy();
        expect(probe.thirdPersonBlend).toBeGreaterThan(probe.initialBlend);
        expect(probe.firstPersonBlend).toBeLessThanOrEqual(probe.thirdPersonBlend);
        expect(probe.activeMode).toBe('FIRST_PERSON');
    });

    test('T33b: Cinematic Camera bleibt in Third-Person mit Cockpit aktiv', async ({ page }) => {
        await startGame(page);
        const probe = await page.evaluate(() => {
            const g = window.GAME_INSTANCE;
            const rig = g?.renderer?.cameraRigSystem;
            const cinematic = rig?.cinematicCameraSystem;
            const player = g?.entityManager?.players?.[0];
            if (!g || !rig || !cinematic || !player || !g.entityManager) return null;

            const tickCameras = (steps) => {
                for (let i = 0; i < steps; i++) {
                    g.entityManager.updateCameras(1 / 60);
                }
            };

            cinematic.reset?.();
            g.renderer.setCinematicEnabled(true);
            rig.cameraModes[0] = 0; // THIRD_PERSON
            player.cockpitCamera = true;
            tickCameras(36);

            return {
                mode: g.renderer.getCameraMode(0),
                cockpit: !!player.cockpitCamera,
                blend: cinematic.getPlayerBlend?.(0) || 0,
            };
        });

        expect(probe).not.toBeNull();
        expect(probe.mode).toBe('THIRD_PERSON');
        expect(probe.cockpit).toBeTruthy();
        expect(probe.blend).toBeGreaterThan(0);
    });
});
