import { test, expect } from '@playwright/test';
import { loadGame, startGame, startGameWithBots, returnToMenu, collectErrors } from './helpers.js';

test.describe('T61-70: Stress, I/O & Sicherheit', () => {

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
        await page.click('#btn-profile-save');
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

    // -- Skipped: nicht implementierte / nicht relevante Features --
    test.skip('T71: Websocket Connection Drop', () => { });
    test.skip('T72: Websocket Reconnection Backoff', () => { });
    test.skip('T73: WebRTC Datachannel Fallback', () => { });
    test.skip('T74: Packet Loss Sim', () => { });
    test.skip('T75: High Latency Sim', () => { });
    test.skip('T76: Jitter Buffer', () => { });
    test.skip('T77: Client-Side Prediction', () => { });
    test.skip('T78: Server Reconciliation', () => { });
    test.skip('T79: Entity Interpolation Buffer', () => { });
    test.skip('T80: Bandwidth Chunking', () => { });
    test.skip('T81: CPU Bound vs GPU Bound', () => { });
    test.skip('T82: CSS Reflows', () => { });
    test.skip('T83: WebWorker Message Cloning', () => { });
    test.skip('T84: IndexedDB Bulk Write', () => { });
    test.skip('T85: SharedArrayBuffer Fallbacks', () => { });
    test.skip('T86: Positional Audio Panning', () => { });
    test.skip('T87: Audio Buffer Concurrent Decodes', () => { });
    test.skip('T88: Output Device Hot-Plug', () => { });
    test.skip('T89: Gamepad Axis Deadzone', () => { });
    test.skip('T90: Gamepad Button Mapping', () => { });
    test.skip('T91: Keyboard Ghosting', () => { });
    test.skip('T92: Mouse Delta Smoothing', () => { });
    test.skip('T93: Touch Multi-Pinch', () => { });
    test.skip('T94: Background Throttling', () => { });
    test.skip('T95: Power Saving Mode', () => { });
    test.skip('T96: Device Pixel Ratio Hot-Swap', () => { });
    test.skip('T97: Savegame Checksum Tampering', () => { });
    test.skip('T98: Savegame Version Schema', () => { });
    test.skip('T99: Corrupt Savegame Recovery', () => { });
    test.skip('T100: Binary Serialization Endianness', () => { });
    test.skip('T101: Entity ID Collisions', () => { });
    test.skip('T102: Event Bus Infinite Loop', () => { });
    test.skip('T103: Event Listener Unmount Leaks', () => { });
    test.skip('T104: Promise Rejection Handler', () => { });
    test.skip('T105: Rate Limiting Command Spam', () => { });
    test.skip('T106: Analytics Opt-Out', () => { });
    test.skip('T107: Error Reporting Payload', () => { });
    test.skip('T108: Dependency Version Resolving', () => { });
    test.skip('T109: Minification Variable Mangling', () => { });
    test.skip('T110: Source Map Resolving', () => { });
    test.skip('T111: HMR Status', () => { });
    test.skip('T112: Localization Missing Keys', () => { });
    test.skip('T113: Font Load Timeout', () => { });
    test.skip('T114: Texture Fallback 404', () => { });
    test.skip('T115: CSS Variable Scope', () => { });
    test.skip('T116: CSS Animation GPU', () => { });
    test.skip('T117: Arithmetic Robustness NaN Guard', () => { });
    test.skip('T118: State Transition Validation', () => { });
    test.skip('T119: Component Lifecycle', () => { });
    test.skip('T120: Data Transform Integrity', () => { });
    test.skip('T121: Global Registry Sync', () => { });
    test.skip('T122-125: Weitere Stress-Tests', () => { });
});
