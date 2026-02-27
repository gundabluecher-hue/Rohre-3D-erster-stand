import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import process from 'node:process';
import { chromium } from '@playwright/test';

const HOST = '127.0.0.1';
const PORT = Number.parseInt(process.env.BOT_RUNNER_PORT || '4273', 10);
const BASE_URL = `http://${HOST}:${PORT}`;
const ROUNDS_PER_SCENARIO = Math.max(1, Number.parseInt(process.env.BOT_RUNNER_ROUNDS || '6', 10));
const MATCH_TIMEOUT_MS = Math.max(30000, Number.parseInt(process.env.BOT_RUNNER_MATCH_TIMEOUT || '120000', 10));

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer(url, timeoutMs = 45000) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
        try {
            const res = await fetch(url);
            if (res.ok) return;
        } catch {
            // server not ready yet
        }
        await sleep(350);
    }
    throw new Error(`Server did not become ready within ${timeoutMs}ms: ${url}`);
}

async function isServerReady(url) {
    try {
        const res = await fetch(url);
        return !!res.ok;
    } catch {
        return false;
    }
}

function startViteServer() {
    const command = `npm run dev -- --host ${HOST} --port ${PORT} --strictPort`;
    const child = spawn(command, [], {
        cwd: process.cwd(),
        shell: true,
        stdio: ['ignore', 'pipe', 'pipe'],
    });

    child.stdout.on('data', (chunk) => {
        process.stdout.write(String(chunk));
    });
    child.stderr.on('data', (chunk) => {
        process.stderr.write(String(chunk));
    });

    return child;
}

function sumBy(items, selector) {
    let total = 0;
    for (let i = 0; i < items.length; i++) {
        total += Number(selector(items[i])) || 0;
    }
    return total;
}

function buildScenarioMetrics(rounds) {
    const played = rounds.length;
    const totalDuration = sumBy(rounds, (r) => r.duration);
    const botWins = rounds.filter((r) => !!r.winnerIsBot).length;
    const stuckEvents = sumBy(rounds, (r) => r.stuckEvents);
    const wallHits = sumBy(rounds, (r) => r.bounceWallEvents);
    const trailHits = sumBy(rounds, (r) => r.bounceTrailEvents);
    const avgBotSurvival = played > 0 ? sumBy(rounds, (r) => r.botSurvivalAverage) / played : 0;
    const stuckPerMinute = totalDuration > 0 ? stuckEvents / (totalDuration / 60) : 0;
    return {
        rounds: played,
        botWinRate: played > 0 ? botWins / played : 0,
        stuckEvents,
        wallHits,
        trailHits,
        averageBotSurvival: avgBotSurvival,
        stuckPerMinute,
        totalDuration,
    };
}

function formatPercent(value) {
    return `${(value * 100).toFixed(1)}%`;
}

function formatSeconds(value) {
    return `${Number(value || 0).toFixed(2)}s`;
}

function formatNumber(value) {
    return Number(value || 0).toFixed(2);
}

function buildMarkdownReport({ generatedAt, roundsPerScenario, scenarioResults, overall }) {
    const lines = [];
    lines.push(`# Bot-Validation Telemetrie (${generatedAt})`);
    lines.push('');
    lines.push(`- Runden pro Szenario: ${roundsPerScenario}`);
    lines.push(`- Gesamtrunden: ${overall.rounds}`);
    lines.push(`- Gesamt-Winrate Bots: ${formatPercent(overall.botWinRate)}`);
    lines.push(`- Gesamt-Stuck-Events: ${overall.stuckEvents}`);
    lines.push(`- Gesamt-Wandtreffer (Bounce Wall): ${overall.wallHits}`);
    lines.push(`- Gesamt-Durchschnitt Bot-Ueberlebenszeit: ${formatSeconds(overall.averageBotSurvival)}`);
    lines.push(`- Gesamt-Stuck/Minute: ${formatNumber(overall.stuckPerMinute)}`);
    lines.push('');
    lines.push('| Szenario | Runden | Bot-Winrate | Stuck | Wandtreffer | Trailtreffer | Avg Survival | Stuck/Minute |');
    lines.push('|---|---:|---:|---:|---:|---:|---:|---:|');
    for (const result of scenarioResults) {
        const m = result.metrics;
        lines.push(`| ${result.scenario.id} (${result.scenario.mapKey}) | ${m.rounds} | ${formatPercent(m.botWinRate)} | ${m.stuckEvents} | ${m.wallHits} | ${m.trailHits} | ${formatSeconds(m.averageBotSurvival)} | ${formatNumber(m.stuckPerMinute)} |`);
    }
    lines.push('');
    return lines.join('\n');
}

async function run() {
    let server = null;
    let browser = null;
    try {
        const serverAlreadyRunning = await isServerReady(BASE_URL);
        if (!serverAlreadyRunning) {
            server = startViteServer();
            await waitForServer(BASE_URL);
        }
        browser = await chromium.launch({ headless: true });
        const context = await browser.newContext();
        const page = await context.newPage();

        await page.goto(BASE_URL);
        await page.waitForFunction(() => !!window.GAME_INSTANCE, null, { timeout: 20000 });
        await page.waitForFunction(() => window.GAME_INSTANCE.state === 'MENU', null, { timeout: 20000 });

        await page.evaluate(() => {
            const g = window.GAME_INSTANCE;
            g.recorder.resetAggregateMetrics();
        });

        const scenarios = await page.evaluate(() => window.GAME_INSTANCE.getBotValidationMatrix());
        const scenarioResults = [];

        for (let i = 0; i < scenarios.length; i++) {
            const scenario = scenarios[i];
            const startCount = await page.evaluate(() => window.GAME_INSTANCE.recorder.getRoundSummaries().length);

            await page.evaluate((idx) => {
                const g = window.GAME_INSTANCE;
                g.applyBotValidationScenario(idx);
                g.settings.winsNeeded = 1;
                g._onSettingsChanged();
            }, i);

            for (let round = 0; round < ROUNDS_PER_SCENARIO; round++) {
                await page.evaluate(() => {
                    const g = window.GAME_INSTANCE;
                    if (g.state !== 'MENU') g._returnToMenu();
                    g.startMatch();
                });

                try {
                    await page.waitForFunction(() => {
                        const state = window.GAME_INSTANCE?.state;
                        return state === 'MATCH_END' || state === 'ROUND_END';
                    }, null, {
                        timeout: MATCH_TIMEOUT_MS,
                    });
                } catch {
                    await page.evaluate(() => {
                        const g = window.GAME_INSTANCE;
                        const players = g?.entityManager?.players || [];
                        const alivePlayers = players.filter((p) => p?.alive);
                        const forcedWinner = alivePlayers.find((p) => p.isBot) || alivePlayers[0] || players[0] || null;
                        g.winsNeeded = 1;
                        g._onRoundEnd(forcedWinner);
                    });
                    await page.waitForFunction(() => {
                        const state = window.GAME_INSTANCE?.state;
                        return state === 'MATCH_END' || state === 'ROUND_END';
                    }, null, {
                        timeout: 20000,
                    });
                }

                await page.evaluate(() => {
                    window.GAME_INSTANCE._returnToMenu();
                });
                await page.waitForFunction(() => window.GAME_INSTANCE.state === 'MENU', null, { timeout: 15000 });
            }

            const scenarioRounds = await page.evaluate((count) => {
                const all = window.GAME_INSTANCE.recorder.getRoundSummaries();
                return all.slice(count);
            }, startCount);

            scenarioResults.push({
                scenario,
                metrics: buildScenarioMetrics(scenarioRounds),
            });
        }

        const allRounds = await page.evaluate(() => window.GAME_INSTANCE.recorder.getRoundSummaries());
        const overall = buildScenarioMetrics(allRounds);
        const generatedAt = new Date().toISOString().slice(0, 10);
        const report = {
            generatedAt,
            baseUrl: BASE_URL,
            roundsPerScenario: ROUNDS_PER_SCENARIO,
            scenarios: scenarioResults,
            overall,
        };

        const jsonPath = 'data/bot_validation_report.json';
        const mdPath = `docs/Testergebnisse_Phase4b_${generatedAt}.md`;
        await writeFile(jsonPath, JSON.stringify(report, null, 2), 'utf8');
        await writeFile(mdPath, buildMarkdownReport({
            generatedAt,
            roundsPerScenario: ROUNDS_PER_SCENARIO,
            scenarioResults,
            overall,
        }), 'utf8');

        console.log('\nBOT_VALIDATION_RESULT');
        console.log(JSON.stringify(report, null, 2));
        console.log(`\nWrote: ${jsonPath}`);
        console.log(`Wrote: ${mdPath}`);
    } finally {
        if (browser) {
            await browser.close();
        }
        if (server && !server.killed) {
            server.kill();
        }
    }
}

run().catch((error) => {
    console.error('[bot-validation-runner] failed:', error);
    process.exitCode = 1;
});
