import { test, expect } from '@playwright/test';
import { loadGame, startGame, returnToMenu, collectErrors } from './helpers.js';

test.describe('T61-125: Stress, I/O & Sicherheit', () => {

    test('T61: Keine JS-Fehler nach 5s Spielzeit', async ({ page }) => {
        test.setTimeout(30000);
        const errors = collectErrors(page);
        await startGame(page);
        await page.waitForTimeout(5000);
        expect(errors).toHaveLength(0);
    });

    test('T62: DOM-Knoten-Anzahl stabil nach 5s', async ({ page }) => {
        test.setTimeout(60000);
        await startGame(page);
        const before = await page.evaluate(() => document.querySelectorAll('*').length);
        await page.waitForTimeout(5000);
        const after = await page.evaluate(() => document.querySelectorAll('*').length);
        expect(after - before).toBeLessThan(100);
    });

    test('T63: ESC während Spiel öffnet Menü', async ({ page }) => {
        test.setTimeout(60000);
        await startGame(page);
        await page.waitForTimeout(1000);
        await returnToMenu(page);
        await expect(page.locator('#main-menu')).toBeVisible();
    });

    test('T64: Korrupte localStorage-Daten → kein Crash', async ({ page }) => {
        test.setTimeout(60000);
        await loadGame(page);
        await page.evaluate(() => {
            localStorage.setItem('aero-arena-3d.settings.v1', 'NICHT_JSON{{{');
        });
        const errors = collectErrors(page);
        await page.reload();
        await page.waitForSelector('#main-menu', { state: 'visible', timeout: 15000 });
        expect(errors).toHaveLength(0);
        await page.evaluate(() => localStorage.removeItem('aero-arena-3d.settings.v1'));
    });

    test('T65: XSS in Profilname wird nicht ausgeführt', async ({ page }) => {
        await loadGame(page);
        const dialogs = [];
        page.on('dialog', d => { dialogs.push(d.message()); d.dismiss(); });
        await page.click('[data-submenu="submenu-profiles"]');
        await page.waitForSelector('#submenu-profiles:not(.hidden)', { timeout: 5000 });
        await page.fill('#profile-name', '<img src=x onerror=alert(1)>');
        const isDisabled = await page.isDisabled('#btn-profile-save');
        if (!isDisabled) {
            await page.click('#btn-profile-save');
        }
        await page.waitForTimeout(1000);
        expect(dialogs).toHaveLength(0);
        await page.evaluate(() => localStorage.removeItem('aero-arena-3d.settings-profiles.v1'));
    });

    test('T66: Ungültige Settings-Werte → kein Crash', async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.setItem('aero-arena-3d.settings.v1', JSON.stringify({
                speed: -999,
                turnSpeed: 'abc',
                botCount: null,
            }));
        });
        const errors = collectErrors(page);
        await page.reload();
        await page.waitForSelector('#main-menu', { state: 'visible', timeout: 10000 });
        expect(errors).toHaveLength(0);
        await page.evaluate(() => localStorage.removeItem('aero-arena-3d.settings.v1'));
    });

    test('T67: 3x Spiel starten/stoppen ohne Fehler', async ({ page }) => {
        test.setTimeout(120000);
        const errors = collectErrors(page);
        await loadGame(page);
        for (let i = 0; i < 3; i++) {
            await page.click('[data-submenu="submenu-game"]');
            await page.waitForSelector('#submenu-game:not(.hidden)', { timeout: 5000 });
            await page.click('#btn-start');
            await page.waitForFunction(() => {
                const hud = document.getElementById('hud');
                return hud && !hud.classList.contains('hidden');
            }, { timeout: 15000 });
            await page.waitForTimeout(1000);
            await returnToMenu(page);
        }
        expect(errors).toHaveLength(0);
    });

    test('T68: visibilitychange verursacht keinen Crash', async ({ page }) => {
        const errors = collectErrors(page);
        await startGame(page);
        await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
        await page.waitForTimeout(1000);
        expect(errors).toHaveLength(0);
    });

    test('T69: p1-hud Element vorhanden nach Start', async ({ page }) => {
        await startGame(page);
        const exists = await page.evaluate(() => document.getElementById('p1-hud') !== null);
        expect(exists).toBeTruthy();
    });

    test('T70: Keine Memory-Warnungen in Console', async ({ page }) => {
        const warnings = [];
        page.on('console', msg => {
            if (msg.type() === 'warning' && msg.text().toLowerCase().includes('memory')) {
                warnings.push(msg.text());
            }
        });
        await startGame(page);
        await page.waitForTimeout(5000);
        expect(warnings).toHaveLength(0);
    });

    test('T71: Schnelles Starten und Beenden verursacht keine Fehler', async ({ page }) => {
        test.setTimeout(60000);
        const errors = collectErrors(page);
        await loadGame(page);
        for (let i = 0; i < 10; i++) {
            await page.locator('[data-submenu="submenu-game"]').click({ force: true });
            await page.waitForSelector('#submenu-game:not(.hidden)', { timeout: 5000 });
            await page.locator('#submenu-game:not(.hidden) #btn-start').click({ force: true });
            await page.waitForFunction(() => {
                const hud = document.getElementById('hud');
                return hud && !hud.classList.contains('hidden');
            }, { timeout: 15000 });
            await page.waitForTimeout(200); // Sehr kurz warten
            await returnToMenu(page);
            await page.waitForTimeout(200);
        }
        expect(errors).toHaveLength(0);
    });

    test('T72: Resize-Spam im Menü verursacht keinen Absturz', async ({ page }) => {
        test.setTimeout(30000);
        const errors = collectErrors(page);
        await loadGame(page);
        for (let i = 0; i < 20; i++) {
            await page.setViewportSize({
                width: Math.floor(800 + (Math.random() * 400)),
                height: Math.floor(600 + (Math.random() * 400))
            });
            await page.waitForTimeout(50);
        }
        expect(errors).toHaveLength(0);
    });

    test('T73: Extreme Settings (100 Bots) stürzen nicht direkt ab', async ({ page }) => {
        test.setTimeout(60000);
        await loadGame(page);
        await page.evaluate(() => {
            const s = JSON.parse(localStorage.getItem('aero-arena-3d.settings.v1') || '{}');
            s.botCount = 100;
            localStorage.setItem('aero-arena-3d.settings.v1', JSON.stringify(s));
        });
        const errors = collectErrors(page);
        await page.reload();
        await page.waitForSelector('#main-menu', { state: 'visible', timeout: 15000 });
        await page.click('[data-submenu="submenu-game"]');
        await page.click('#btn-start');
        await page.waitForTimeout(3000); // 3 Sekunden laufen lassen mit 100 Bots
        expect(errors).toHaveLength(0);
        await page.evaluate(() => localStorage.removeItem('aero-arena-3d.settings.v1'));
    });
});
