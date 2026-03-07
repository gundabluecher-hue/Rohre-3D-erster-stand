// Load page and wait for visible main menu.
export async function loadGame(page) {
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForSelector('#main-menu', { state: 'visible', timeout: 10000 });
}

export async function selectSessionType(page, sessionType = 'single') {
    const sessionButton = page.locator(`#menu-nav [data-session-type="${sessionType}"]`).first();
    await sessionButton.click({ force: true });
    await page.waitForSelector('#submenu-custom:not(.hidden)', { timeout: 4000 });
}

async function openViaNavigationRuntime(page, submenuId) {
    const opened = await page.evaluate((panelId) => {
        const runtime = window.GAME_INSTANCE?.uiManager?.menuNavigationRuntime;
        if (!runtime?.showPanel) return false;
        return !!runtime.showPanel(panelId, { trigger: 'test_helper' });
    }, submenuId);
    if (!opened) {
        throw new Error(`Panel konnte nicht geoeffnet werden: ${submenuId}`);
    }
}

export async function openSubmenu(page, submenuId, options = {}) {
    if (submenuId === 'submenu-custom') {
        await selectSessionType(page, options.sessionType || 'single');
        return;
    }

    if (submenuId === 'submenu-game') {
        await selectSessionType(page, options.sessionType || 'single');
        const modePathButton = page.locator('#submenu-custom:not(.hidden) [data-mode-path="normal"]').first();
        if (await modePathButton.count()) {
            await modePathButton.click({ force: true });
        } else {
            await page.locator('#submenu-custom:not(.hidden) [data-menu-step-target="submenu-game"]').click({ force: true });
        }
        await page.waitForSelector('#submenu-game:not(.hidden)', { timeout: 5000 });
        return;
    }

    const navButton = page.locator(`#menu-nav [data-submenu="${submenuId}"]`).first();
    if (await navButton.count()) {
        await navButton.click({ force: true });
    } else {
        await openViaNavigationRuntime(page, submenuId);
    }
    await page.waitForSelector(`#${submenuId}:not(.hidden)`, { timeout: 4000 });
}

export async function openGameSubmenu(page, options = {}) {
    await openSubmenu(page, 'submenu-game', options);
}

export async function openCustomSubmenu(page) {
    await openSubmenu(page, 'submenu-custom');
}

export async function openMultiplayerSubmenu(page) {
    await openSubmenu(page, 'submenu-game', { sessionType: 'multiplayer' });
}

export async function openLevel4Drawer(page, options = {}) {
    const gamePanelVisible = await page.locator('#submenu-game:not(.hidden)').count();
    if (!gamePanelVisible) {
        await openGameSubmenu(page, options);
    }
    await page.click('#btn-open-level4');
    await page.waitForSelector('#submenu-level4:not(.hidden)', { timeout: 4000 });
    if (options.section) {
        const sectionId = String(options.section).trim();
        await page.click(`#submenu-level4 [data-level4-section-target="${sectionId}"]`);
        await page.waitForSelector(`#submenu-level4 [data-level4-section="${sectionId}"].is-active`, { timeout: 4000 });
    }
}

export async function openDeveloperSubmenu(page) {
    await openLevel4Drawer(page, { section: 'tools' });
    await page.click('#btn-open-developer');
    await page.waitForSelector('#submenu-developer:not(.hidden)', { timeout: 4000 });
}

export async function openDebugSubmenu(page) {
    await openDeveloperSubmenu(page);
    await page.click('#btn-open-debug');
    await page.waitForSelector('#submenu-debug:not(.hidden)', { timeout: 4000 });
}

const BENIGN_ERROR_PATTERNS = [
    /wasm streaming compile failed/i,
    /falling back to ArrayBuffer instantiation/i,
    /\[AiBot\] Failed to load model:/i,
    /\[MediaRecorderSystem\] VideoEncoder error/i,
    /Encoder creation error/i,
    /Failed to load resource: net::ERR_INTERNET_DISCONNECTED/i,
];

function isBenignErrorMessage(message) {
    return BENIGN_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}

// Start game with default configuration.
export async function startGame(page) {
    await loadGame(page);
    await openGameSubmenu(page);
    await page.click('#submenu-game:not(.hidden) #btn-start');
    await page.waitForFunction(() => {
        const hud = document.getElementById('hud');
        return hud && !hud.classList.contains('hidden');
    }, { timeout: 15000 });
    await page.waitForFunction(() => {
        const g = window.GAME_INSTANCE;
        return g && g.entityManager && g.entityManager.players && g.entityManager.players.length > 0;
    }, { timeout: 8000 });
}

// Start game with N bots.
export async function startGameWithBots(page, botCount = 1) {
    await loadGame(page);
    await openGameSubmenu(page);
    await page.evaluate((count) => {
        const slider = document.getElementById('bot-count');
        slider.value = String(count);
        slider.dispatchEvent(new Event('input', { bubbles: true }));
    }, botCount);
    await page.click('#submenu-game:not(.hidden) #btn-start');
    await page.waitForFunction(() => {
        const hud = document.getElementById('hud');
        return hud && !hud.classList.contains('hidden');
    }, { timeout: 15000 });
    await page.waitForFunction(() => {
        const g = window.GAME_INSTANCE;
        return g && g.entityManager && g.entityManager.players && g.entityManager.players.length > 0;
    }, { timeout: 8000 });
}

// Start hunt mode with default bot count.
export async function startHuntGame(page) {
    await loadGame(page);
    await openCustomSubmenu(page);
    await page.click('#submenu-custom:not(.hidden) [data-mode-path="fight"]');
    await page.waitForSelector('#submenu-game:not(.hidden)', { timeout: 5000 });
    await page.click('#submenu-game:not(.hidden) #btn-start');
    await page.waitForFunction(() => {
        const hud = document.getElementById('hud');
        const huntHud = document.getElementById('hunt-hud');
        const game = window.GAME_INSTANCE;
        return !!(
            hud && !hud.classList.contains('hidden')
            && huntHud && !huntHud.classList.contains('hidden')
            && game?.entityManager?.players?.length > 0
        );
    }, { timeout: 15000 });
}

// Start hunt mode with configurable bot count.
export async function startHuntGameWithBots(page, botCount = 1) {
    await loadGame(page);
    await openCustomSubmenu(page);
    await page.click('#submenu-custom:not(.hidden) [data-mode-path="fight"]');
    await page.waitForSelector('#submenu-game:not(.hidden)', { timeout: 5000 });
    await page.evaluate((count) => {
        const slider = document.getElementById('bot-count');
        slider.value = String(count);
        slider.dispatchEvent(new Event('input', { bubbles: true }));
    }, botCount);
    await page.click('#submenu-game:not(.hidden) #btn-start');
    await page.waitForFunction(() => {
        const hud = document.getElementById('hud');
        const huntHud = document.getElementById('hunt-hud');
        const game = window.GAME_INSTANCE;
        return !!(
            hud && !hud.classList.contains('hidden')
            && huntHud && !huntHud.classList.contains('hidden')
            && game?.entityManager?.players?.length > 1
        );
    }, { timeout: 15000 });
}

// Press ESC and wait for main menu.
export async function returnToMenu(page) {
    await page.keyboard.press('Escape');
    await page.waitForSelector('#main-menu', { state: 'visible', timeout: 8000 });
}

// Register error listeners and return captured error list.
export function collectErrors(page) {
    const errors = [];
    page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
    page.on('console', (msg) => {
        if (msg.type() === 'error') {
            const message = msg.text();
            if (isBenignErrorMessage(message)) return;
            errors.push(`console.error: ${message}`);
        }
    });
    return errors;
}
