import { test, expect } from '@playwright/test';
import { loadGame, startGame, startGameWithBots, returnToMenu } from './helpers.js';

async function startHuntGame(page) {
    await loadGame(page);
    await page.locator('#menu-nav [data-submenu="submenu-game"]').click({ force: true });
    await page.waitForSelector('#submenu-game:not(.hidden)', { timeout: 3000 });
    await page.click('#btn-mode-hunt');
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

async function startHuntGameWithBots(page, botCount = 1) {
    await loadGame(page);
    await page.locator('#menu-nav [data-submenu="submenu-game"]').click({ force: true });
    await page.waitForSelector('#submenu-game:not(.hidden)', { timeout: 3000 });
    await page.evaluate((count) => {
        const slider = document.getElementById('bot-count');
        slider.value = String(count);
        slider.dispatchEvent(new Event('input', { bubbles: true }));
    }, botCount);
    await page.click('#btn-mode-hunt');
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
    // -- Echte Tests: AI Subsysteme --
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

    test('T61: Hunt-MG entfernt getroffenes Spursegment sofort', async ({ page }) => {
        await startHuntGame(page);
        const result = await page.evaluate(() => {
            const game = window.GAME_INSTANCE;
            const entityManager = game?.entityManager;
            const player = entityManager?.players?.[0];
            if (!entityManager || !player) {
                return { error: 'missing-entity-state' };
            }
            if (String(game?.activeGameMode || '').toUpperCase() !== 'HUNT') {
                return { error: 'hunt-not-active' };
            }

            player.shootCooldown = 0;
            if (entityManager._overheatGunSystem?._overheatByPlayer) {
                entityManager._overheatGunSystem._overheatByPlayer[player.index] = 0;
            }
            if (entityManager._overheatGunSystem?._lockoutByPlayer) {
                entityManager._overheatGunSystem._lockoutByPlayer[player.index] = 0;
            }

            const aim = player.position.clone().set(0, 0, 0);
            player.getAimDirection(aim).normalize();
            const from = player.position.clone().addScaledVector(aim, 14);
            const to = player.position.clone().addScaledVector(aim, 16);
            const writeIndex = Math.max(0, Number(player?.trail?.writeIndex) || 0);
            const maxSegments = Math.max(1, Number(player?.trail?.maxSegments) || 5000);
            const segmentIdx = (writeIndex + Math.floor(maxSegments * 0.5)) % maxSegments;
            const radius = Math.max(0.15, (Number(player?.trail?.width) || 0.6) * 0.5);

            const trailRef = entityManager.registerTrailSegment(player.index, segmentIdx, {
                fromX: from.x,
                fromY: from.y,
                fromZ: from.z,
                toX: to.x,
                toY: to.y,
                toZ: to.z,
                midX: (from.x + to.x) * 0.5,
                midZ: (from.z + to.z) * 0.5,
                radius,
                hp: 3,
                maxHp: 3,
                ownerTrail: null,
            });

            const fireResult = entityManager._shootHuntGun(player);
            const entry = trailRef?.entry || null;
            const destroyed = !!entry?.destroyed;

            if (!destroyed && trailRef?.key && entry) {
                entityManager.unregisterTrailSegment(trailRef.key, entry);
            }

            return {
                error: null,
                fireOk: !!fireResult?.ok,
                trailHit: !!fireResult?.trailHit,
                destroyed,
            };
        });

        expect(result.error).toBeNull();
        expect(result.fireOk).toBeTruthy();
        expect(result.trailHit).toBeTruthy();
        expect(result.destroyed).toBeTruthy();
    });

    test('T62: Hunt-Rakete ist groesser und sucht Ziele nach', async ({ page }) => {
        await startHuntGameWithBots(page, 1);
        const result = await page.evaluate(() => {
            const game = window.GAME_INSTANCE;
            const entityManager = game?.entityManager;
            const player = entityManager?.players?.[0];
            const target = entityManager?.players?.find((p, idx) => idx !== 0 && p?.alive);
            if (!entityManager || !player || !target) {
                return { error: 'missing-players' };
            }
            if (String(game?.activeGameMode || '').toUpperCase() !== 'HUNT') {
                return { error: 'hunt-not-active' };
            }

            entityManager._projectileSystem?.clear?.();
            player.trail?.clear?.();
            target.trail?.clear?.();
            player.shootCooldown = 0;
            player.inventory = ['ROCKET_STRONG'];
            player.selectedItemIndex = 0;

            player.position.set(0, 50, 0);
            target.position.set(30, 50, -36);
            player.group?.lookAt(0, 50, -120);

            const targetHpBefore = Number(target.hp || 0);
            const shot = entityManager._shootItemProjectile(player, 0);
            if (!shot?.ok) {
                return { error: 'shot-failed', reason: shot?.reason || null };
            }

            const projectile = entityManager.projectiles[entityManager.projectiles.length - 1];
            if (!projectile) {
                return { error: 'projectile-missing' };
            }

            const baseRadius = Number(game?.config?.PROJECTILE?.RADIUS || 0);
            const visualScale = Number(projectile.mesh?.scale?.x || 0);
            const projectileRadius = Number(projectile.radius || 0);
            let acquiredDuringFlight = !!projectile.target;

            const toTargetStart = target.position.clone().sub(projectile.position).normalize();
            const velocityStart = projectile.velocity.clone().normalize();
            const initialDot = velocityStart.dot(toTargetStart);
            let finalDot = initialDot;

            for (let i = 0; i < 45; i++) {
                entityManager._projectileSystem.update(1 / 60);
                const stillActive = entityManager.projectiles.includes(projectile);
                if (!stillActive) break;
                if (projectile.target === target) acquiredDuringFlight = true;
                const toTarget = target.position.clone().sub(projectile.position);
                if (toTarget.lengthSq() > 0.0001) {
                    toTarget.normalize();
                    finalDot = projectile.velocity.clone().normalize().dot(toTarget);
                }
            }

            const targetHpAfter = Number(target.hp || 0);
            entityManager._projectileSystem?.clear?.();
            return {
                error: null,
                visualScale,
                projectileRadius,
                baseRadius,
                acquiredDuringFlight,
                guided: finalDot > initialDot + 0.04,
                hitApplied: targetHpAfter < targetHpBefore,
            };
        });

        expect(result.error).toBeNull();
        expect(result.visualScale).toBeGreaterThan(1.2);
        expect(result.projectileRadius).toBeGreaterThan(result.baseRadius);
        expect(result.acquiredDuringFlight).toBeTruthy();
        expect(result.guided || result.hitApplied).toBeTruthy();
    });

    test('T63: MG Trail-Zielsuchradius ist konfigurierbar und wirkt auf Treffer', async ({ page }) => {
        await startHuntGame(page);
        const result = await page.evaluate(() => {
            const game = window.GAME_INSTANCE;
            const entityManager = game?.entityManager;
            const player = entityManager?.players?.[0];
            if (!game || !entityManager || !player) {
                return { error: 'missing-state' };
            }
            if (String(game?.activeGameMode || '').toUpperCase() !== 'HUNT') {
                return { error: 'hunt-not-active' };
            }

            player.position.set(0, 50, 0);
            player.group?.lookAt(0, 50, -120);
            player.trail?.clear?.();

            const aim = player.position.clone().set(0, 0, 0);
            player.getAimDirection(aim).normalize();
            const up = player.position.clone().set(0, 1, 0);
            let right = aim.clone().cross(up);
            if (right.lengthSq() < 0.0001) {
                up.set(1, 0, 0);
                right = aim.clone().cross(up);
            }
            right.normalize();
            const base = player.position.clone().addScaledVector(aim, 18);
            const writeIndex = Math.max(0, Number(player?.trail?.writeIndex) || 0);
            const maxSegments = Math.max(1, Number(player?.trail?.maxSegments) || 5000);
            const radius = Math.max(0.15, (Number(player?.trail?.width) || 0.6) * 0.5);

            const registerOffsetSegment = (segmentIdx, offset) => {
                const from = base.clone().addScaledVector(right, offset - 0.5);
                const to = base.clone().addScaledVector(right, offset + 0.5);
                return entityManager.registerTrailSegment(player.index, segmentIdx, {
                    fromX: from.x,
                    fromY: from.y,
                    fromZ: from.z,
                    toX: to.x,
                    toY: to.y,
                    toZ: to.z,
                    midX: (from.x + to.x) * 0.5,
                    midZ: (from.z + to.z) * 0.5,
                    radius,
                    hp: 3,
                    maxHp: 3,
                    ownerTrail: null,
                });
            };

            const resetShotState = () => {
                player.shootCooldown = 0;
                if (entityManager._overheatGunSystem?._overheatByPlayer) {
                    entityManager._overheatGunSystem._overheatByPlayer[player.index] = 0;
                }
                if (entityManager._overheatGunSystem?._lockoutByPlayer) {
                    entityManager._overheatGunSystem._lockoutByPlayer[player.index] = 0;
                }
            };

            game.settings.gameplay.mgTrailAimRadius = 0.25;
            game._applySettingsToRuntime();
            const lowRef = registerOffsetSegment((writeIndex + Math.floor(maxSegments * 0.35)) % maxSegments, 1.1);
            resetShotState();
            const lowShot = entityManager._shootHuntGun(player);
            if (!lowRef?.entry?.destroyed && lowRef?.key && lowRef?.entry) {
                entityManager.unregisterTrailSegment(lowRef.key, lowRef.entry);
            }

            game.settings.gameplay.mgTrailAimRadius = 1.6;
            game._applySettingsToRuntime();
            const highRef = registerOffsetSegment((writeIndex + Math.floor(maxSegments * 0.55)) % maxSegments, 1.1);
            resetShotState();
            const highShot = entityManager._shootHuntGun(player);
            const highDestroyed = !!highRef?.entry?.destroyed;
            if (!highDestroyed && highRef?.key && highRef?.entry) {
                entityManager.unregisterTrailSegment(highRef.key, highRef.entry);
            }

            return {
                error: null,
                lowHit: !!lowShot?.trailHit,
                highHit: !!highShot?.trailHit,
                highDestroyed,
                appliedRadius: Number(game?.config?.HUNT?.MG?.TRAIL_HIT_RADIUS || 0),
            };
        });

        expect(result.error).toBeNull();
        expect(result.lowHit).toBeFalsy();
        expect(result.highHit).toBeTruthy();
        expect(result.highDestroyed).toBeTruthy();
        expect(result.appliedRadius).toBeGreaterThan(1.4);
    });

    test('T64: Hunt-MG priorisiert gegnerische Spur auf Schusslinie vor Off-Axis Spieler', async ({ page }) => {
        await startHuntGameWithBots(page, 1);
        const result = await page.evaluate(() => {
            const game = window.GAME_INSTANCE;
            const entityManager = game?.entityManager;
            const shooter = entityManager?.players?.[0];
            const enemy = entityManager?.players?.find((player, index) => index !== 0 && player?.alive);
            if (!game || !entityManager || !shooter || !enemy) {
                return { error: 'missing-state' };
            }
            if (String(game?.activeGameMode || '').toUpperCase() !== 'HUNT') {
                return { error: 'hunt-not-active' };
            }

            shooter.trail?.clear?.();
            enemy.trail?.clear?.();
            shooter.position.set(0, 50, 0);
            shooter.group?.lookAt(0, 50, -120);
            enemy.position.set(4.0, 50, -20);

            const aim = shooter.position.clone().set(0, 0, 0);
            shooter.getAimDirection(aim).normalize();
            const from = shooter.position.clone().addScaledVector(aim, 30);
            const to = shooter.position.clone().addScaledVector(aim, 32);
            const writeIndex = Math.max(0, Number(enemy?.trail?.writeIndex) || 0);
            const maxSegments = Math.max(1, Number(enemy?.trail?.maxSegments) || 5000);
            const segmentIdx = (writeIndex + Math.floor(maxSegments * 0.5)) % maxSegments;
            const radius = Math.max(0.15, (Number(enemy?.trail?.width) || 0.6) * 0.5);

            const trailRef = entityManager.registerTrailSegment(enemy.index, segmentIdx, {
                fromX: from.x,
                fromY: from.y,
                fromZ: from.z,
                toX: to.x,
                toY: to.y,
                toZ: to.z,
                midX: (from.x + to.x) * 0.5,
                midZ: (from.z + to.z) * 0.5,
                radius,
                hp: 3,
                maxHp: 3,
                ownerTrail: null,
            });

            shooter.shootCooldown = 0;
            if (entityManager._overheatGunSystem?._overheatByPlayer) {
                entityManager._overheatGunSystem._overheatByPlayer[shooter.index] = 0;
            }
            if (entityManager._overheatGunSystem?._lockoutByPlayer) {
                entityManager._overheatGunSystem._lockoutByPlayer[shooter.index] = 0;
            }

            const enemyHpBefore = Number(enemy.hp || 0);
            const fireResult = entityManager._shootHuntGun(shooter);
            const enemyHpAfter = Number(enemy.hp || 0);
            const destroyed = !!trailRef?.entry?.destroyed;
            if (!destroyed && trailRef?.key && trailRef?.entry) {
                entityManager.unregisterTrailSegment(trailRef.key, trailRef.entry);
            }

            return {
                error: null,
                fireOk: !!fireResult?.ok,
                playerHit: !!fireResult?.hit,
                trailHit: !!fireResult?.trailHit,
                destroyed,
                enemyHpBefore,
                enemyHpAfter,
            };
        });

        expect(result.error).toBeNull();
        expect(result.fireOk).toBeTruthy();
        expect(result.playerHit).toBeFalsy();
        expect(result.trailHit).toBeTruthy();
        expect(result.destroyed).toBeTruthy();
        expect(result.enemyHpAfter).toBe(result.enemyHpBefore);
    });

    test('T65: Bot-Action-Contract sanitizt invalide Payloads robust', async ({ page }) => {
        await loadGame(page);
        const result = await page.evaluate(async () => {
            const { sanitizeBotAction } = await import('/src/entities/ai/actions/BotActionContract.js');
            const warnings = [];
            const sanitized = sanitizeBotAction({
                yawLeft: 'true',
                boost: 1,
                shootItem: 'yes',
                shootItemIndex: 99,
                useItem: -5,
            }, {
                inventoryLength: 3,
                onInvalid: (message) => warnings.push(String(message || '')),
            });
            const invalidPayload = sanitizeBotAction(null, {
                inventoryLength: 3,
                onInvalid: (message) => warnings.push(String(message || '')),
            });
            return { sanitized, invalidPayload, warnings };
        });

        expect(result.sanitized.yawLeft).toBeTruthy();
        expect(result.sanitized.boost).toBeTruthy();
        expect(result.sanitized.shootItem).toBeTruthy();
        expect(result.sanitized.shootItemIndex).toBe(2);
        expect(result.sanitized.useItem).toBe(-1);
        expect(result.invalidPayload.shootItem).toBeFalsy();
        expect(result.invalidPayload.shootItemIndex).toBe(-1);
        expect(result.warnings.length).toBeGreaterThan(0);
    });

    test('T66: Bot-Input bleibt stabil wenn Policy-Update abstuerzt', async ({ page }) => {
        await startGameWithBots(page, 1);
        const result = await page.evaluate(() => {
            const game = window.GAME_INSTANCE;
            const entityManager = game?.entityManager;
            const bot = entityManager?.players?.find((p) => p?.isBot);
            if (!entityManager || !bot) {
                return { error: 'missing-bot' };
            }

            const policy = entityManager.botByPlayer.get(bot);
            if (!policy) {
                return { error: 'missing-policy' };
            }

            const originalUpdate = policy.update;
            let crashed = false;
            let action = null;
            try {
                policy.update = () => {
                    throw new Error('simulated-bot-failure');
                };
                action = entityManager._playerInputSystem.resolvePlayerInput(bot, 1 / 60, null);
            } catch (error) {
                crashed = true;
            } finally {
                policy.update = originalUpdate;
            }

            return { error: null, crashed, action };
        });

        expect(result.error).toBeNull();
        expect(result.crashed).toBeFalsy();
        expect(result.action.shootItem).toBeFalsy();
        expect(result.action.shootMG).toBeFalsy();
        expect(result.action.shootItemIndex).toBe(-1);
        expect(result.action.useItem).toBe(-1);
    });
});
