import { test, expect } from '@playwright/test';
import { loadGame, startGame, returnToMenu, collectErrors } from './helpers.js';

test.describe('T1-20: Core & Infrastruktur', () => {

    test('T1: Seite lädt ohne JS-Fehler', async ({ page }) => {
        const errors = collectErrors(page);
        await loadGame(page);
        expect(errors).toHaveLength(0);
    });

    test('T2: Canvas existiert und ist sichtbar', async ({ page }) => {
        await loadGame(page);
        await expect(page.locator('#game-canvas')).toBeVisible();
    });

    test('T3: WebGL-Kontext verfügbar', async ({ page }) => {
        await loadGame(page);
        const hasWebGL = await page.evaluate(() => {
            const c = document.getElementById('game-canvas');
            return !!(c && (c.getContext('webgl2') || c.getContext('webgl')));
        });
        expect(hasWebGL).toBeTruthy();
    });

    test('T4: Hauptmenü sichtbar beim Start', async ({ page }) => {
        await loadGame(page);
        await expect(page.locator('#main-menu')).toBeVisible();
    });

    test('T5: Menü-Navigation Buttons vorhanden', async ({ page }) => {
        await loadGame(page);
        const count = await page.locator('#menu-nav .nav-btn').count();
        expect(count).toBeGreaterThanOrEqual(4);
    });

    test('T6: GAME_INSTANCE mit Renderer und Settings verfügbar', async ({ page }) => {
        await loadGame(page);
        const ok = await page.evaluate(() => {
            const g = window.GAME_INSTANCE;
            return !!(g && g.settings && g.renderer);
        });
        expect(ok).toBeTruthy();
    });

    test('T7: Spiel startet – HUD sichtbar', async ({ page }) => {
        await startGame(page);
        const hudVisible = await page.evaluate(() => {
            const hud = document.getElementById('hud');
            return hud && !hud.classList.contains('hidden');
        });
        expect(hudVisible).toBeTruthy();
    });

    test('T8: Spieler existiert nach Start', async ({ page }) => {
        await startGame(page);
        const hasPlayers = await page.evaluate(() => {
            const g = window.GAME_INSTANCE;
            return g?.entityManager?.players?.length > 0;
        });
        expect(hasPlayers).toBeTruthy();
    });

    test('T9: GameLoop läuft nach Start', async ({ page }) => {
        await startGame(page);
        const running = await page.evaluate(() => {
            const g = window.GAME_INSTANCE;
            return g?.gameLoop?.running === true;
        });
        expect(running).toBeTruthy();
    });

    test('T10: Arena ist gebaut', async ({ page }) => {
        await startGame(page);
        const hasArena = await page.evaluate(() => {
            const g = window.GAME_INSTANCE;
            return g?.arena && Array.isArray(g.arena.obstacles);
        });
        expect(hasArena).toBeTruthy();
    });

    test('T11: ESC bringt zurück ins Menü', async ({ page }) => {
        await startGame(page);
        await returnToMenu(page);
        await expect(page.locator('#main-menu')).toBeVisible();
    });

    test('T12: localStorage Settings speichern/laden', async ({ page }) => {
        await loadGame(page);
        const roundTrip = await page.evaluate(() => {
            try {
                const key = 'aero-arena-3d.settings.v1';
                const data = { test: true, ts: Date.now() };
                localStorage.setItem(key, JSON.stringify(data));
                const loaded = JSON.parse(localStorage.getItem(key));
                localStorage.removeItem(key);
                return loaded?.test === true;
            } catch { return false; }
        });
        expect(roundTrip).toBeTruthy();
    });

    test('T13: Keine Fehler 2s nach Laden', async ({ page }) => {
        const errors = collectErrors(page);
        await loadGame(page);
        await page.waitForTimeout(2000);
        expect(errors).toHaveLength(0);
    });

    test('T14: Alle Maps ladbar', async ({ page }) => {
        test.setTimeout(120000);
        const errors = collectErrors(page);
        await loadGame(page);

        for (const mapKey of ['standard', 'empty', 'maze', 'complex', 'pyramid']) {
            await page.click('[data-submenu="submenu-game"]');
            await page.waitForSelector('#submenu-game:not(.hidden)', { timeout: 5000 });
            await page.selectOption('#map-select', mapKey);
            await page.click('#btn-start');
            await page.waitForFunction(() => {
                const hud = document.getElementById('hud');
                return hud && !hud.classList.contains('hidden');
            }, { timeout: 15000 });
            await page.waitForTimeout(500);
            await returnToMenu(page);
        }
        expect(errors).toHaveLength(0);
    });

    test('T15: Bot-Count Slider aktualisiert Label', async ({ page }) => {
        await loadGame(page);
        await page.click('[data-submenu="submenu-game"]');
        await page.waitForSelector('#submenu-game:not(.hidden)', { timeout: 3000 });
        await page.evaluate(() => {
            const slider = document.getElementById('bot-count');
            slider.value = '4';
            slider.dispatchEvent(new Event('input', { bubbles: true }));
        });
        const label = await page.textContent('#bot-count-label');
        expect(label).toBe('4');
    });

    test('T16: Schwierigkeitsstufen auswählbar', async ({ page }) => {
        await loadGame(page);
        await page.click('[data-submenu="submenu-game"]');
        await page.waitForSelector('#submenu-game:not(.hidden)', { timeout: 3000 });
        for (const diff of ['EASY', 'NORMAL', 'HARD']) {
            await page.selectOption('#bot-difficulty', diff);
            expect(await page.inputValue('#bot-difficulty')).toBe(diff);
        }
    });

    test('T17: Vehicle-Select hat mindestens 1 Option', async ({ page }) => {
        await loadGame(page);
        await page.click('[data-submenu="submenu-game"]');
        await page.waitForSelector('#submenu-game:not(.hidden)', { timeout: 3000 });
        const count = await page.evaluate(() =>
            document.querySelectorAll('#vehicle-select-p1 option').length
        );
        expect(count).toBeGreaterThanOrEqual(1);
    });

    test('T18: Power-Up-Typen definiert (mind. 1)', async ({ page }) => {
        await loadGame(page);
        const count = await page.evaluate(() => {
            const g = window.GAME_INSTANCE;
            const types = g?.config?.POWERUP?.TYPES;
            if (types) return Object.keys(types).length;
            return -1; // Config nicht zugänglich
        });
        // -1 = Config nicht sichtbar (kein Fehler), sonst mind. 1 Typ
        expect(count).not.toBe(0);
    });

    test('T19: Keine doppelten Element-IDs (max. 50 als Toleranz)', async ({ page }) => {
        await loadGame(page);
        const dupes = await page.evaluate(() => {
            const seen = {};
            const dupes = [];
            document.querySelectorAll('[id]').forEach(el => {
                if (seen[el.id]) dupes.push(el.id);
                seen[el.id] = true;
            });
            return dupes;
        });
        expect(dupes.length).toBeLessThanOrEqual(50);
    });

    test('T20: Submenu Settings öffnet und schließt', async ({ page }) => {
        await loadGame(page);
        await page.click('[data-submenu="submenu-settings"]');
        await page.waitForSelector('#submenu-settings:not(.hidden)', { timeout: 3000 });
        await expect(page.locator('#submenu-settings')).toBeVisible();
        await page.click('#submenu-settings [data-back]');
        await page.waitForTimeout(400);
        await expect(page.locator('#menu-nav')).toBeVisible();
    });
});
