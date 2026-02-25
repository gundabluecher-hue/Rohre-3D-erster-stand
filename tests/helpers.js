import { expect } from '@playwright/test';

/** Seite laden und auf Hauptmenü warten */
export async function loadGame(page) {
    await page.goto('/');
    await page.waitForSelector('#main-menu', { state: 'visible', timeout: 10000 });
}

/** Spiel starten (Standardkonfiguration) */
export async function startGame(page) {
    await loadGame(page);
    await page.click('[data-submenu="submenu-game"]');
    await page.waitForSelector('#submenu-game:not(.hidden)', { timeout: 3000 });
    await page.click('#btn-start');
    await page.waitForFunction(() => {
        const hud = document.getElementById('hud');
        return hud && !hud.classList.contains('hidden');
    }, { timeout: 15000 });
    await page.waitForFunction(() => {
        const g = window.GAME_INSTANCE;
        return g && g.entityManager && g.entityManager.players && g.entityManager.players.length > 0;
    }, { timeout: 8000 });
}

/** Spiel mit N Bots starten */
export async function startGameWithBots(page, botCount = 1) {
    await loadGame(page);
    await page.click('[data-submenu="submenu-game"]');
    await page.waitForSelector('#submenu-game:not(.hidden)', { timeout: 3000 });
    await page.evaluate((count) => {
        const slider = document.getElementById('bot-count');
        slider.value = String(count);
        slider.dispatchEvent(new Event('input', { bubbles: true }));
    }, botCount);
    await page.click('#btn-start');
    await page.waitForFunction(() => {
        const hud = document.getElementById('hud');
        return hud && !hud.classList.contains('hidden');
    }, { timeout: 15000 });
    await page.waitForFunction(() => {
        const g = window.GAME_INSTANCE;
        return g && g.entityManager && g.entityManager.players && g.entityManager.players.length > 0;
    }, { timeout: 8000 });
}

/** ESC drücken und auf Hauptmenü warten */
export async function returnToMenu(page) {
    await page.keyboard.press('Escape');
    await page.waitForSelector('#main-menu', { state: 'visible', timeout: 8000 });
}

/** Fehler-Listener registrieren (gibt Array zurück) */
export function collectErrors(page) {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));
    return errors;
}
