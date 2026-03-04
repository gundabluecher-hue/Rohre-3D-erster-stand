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
            player.setLookAtWorld?.(0, 50, -120);

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
            player.setLookAtWorld?.(0, 50, -120);
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
            shooter.setLookAtWorld?.(0, 50, -120);
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

    test('T83: Hunt-MG priorisiert gegnerische Spur vor eigener Spur auf Schusslinie', async ({ page }) => {
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
            shooter.setLookAtWorld?.(0, 50, -120);
            enemy.position.set(16, 50, -24);

            const aim = shooter.position.clone().set(0, 0, 0);
            shooter.getAimDirection(aim).normalize();

            const ownFrom = shooter.position.clone().addScaledVector(aim, 12);
            const ownTo = shooter.position.clone().addScaledVector(aim, 14);
            const enemyFrom = shooter.position.clone().addScaledVector(aim, 20);
            const enemyTo = shooter.position.clone().addScaledVector(aim, 22);

            const ownWriteIndex = Math.max(0, Number(shooter?.trail?.writeIndex) || 0);
            const ownMaxSegments = Math.max(1, Number(shooter?.trail?.maxSegments) || 5000);
            const ownSegmentIdx = (ownWriteIndex + Math.floor(ownMaxSegments * 0.45)) % ownMaxSegments;
            const ownRadius = Math.max(0.15, (Number(shooter?.trail?.width) || 0.6) * 0.5);

            const enemyWriteIndex = Math.max(0, Number(enemy?.trail?.writeIndex) || 0);
            const enemyMaxSegments = Math.max(1, Number(enemy?.trail?.maxSegments) || 5000);
            const enemySegmentIdx = (enemyWriteIndex + Math.floor(enemyMaxSegments * 0.45)) % enemyMaxSegments;
            const enemyRadius = Math.max(0.15, (Number(enemy?.trail?.width) || 0.6) * 0.5);

            const ownRef = entityManager.registerTrailSegment(shooter.index, ownSegmentIdx, {
                fromX: ownFrom.x,
                fromY: ownFrom.y,
                fromZ: ownFrom.z,
                toX: ownTo.x,
                toY: ownTo.y,
                toZ: ownTo.z,
                midX: (ownFrom.x + ownTo.x) * 0.5,
                midZ: (ownFrom.z + ownTo.z) * 0.5,
                radius: ownRadius,
                hp: 3,
                maxHp: 3,
                ownerTrail: null,
            });

            const enemyRef = entityManager.registerTrailSegment(enemy.index, enemySegmentIdx, {
                fromX: enemyFrom.x,
                fromY: enemyFrom.y,
                fromZ: enemyFrom.z,
                toX: enemyTo.x,
                toY: enemyTo.y,
                toZ: enemyTo.z,
                midX: (enemyFrom.x + enemyTo.x) * 0.5,
                midZ: (enemyFrom.z + enemyTo.z) * 0.5,
                radius: enemyRadius,
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

            const fireResult = entityManager._shootHuntGun(shooter);
            const ownDestroyed = !!ownRef?.entry?.destroyed;
            const enemyDestroyed = !!enemyRef?.entry?.destroyed;

            if (!ownDestroyed && ownRef?.key && ownRef?.entry) {
                entityManager.unregisterTrailSegment(ownRef.key, ownRef.entry);
            }
            if (!enemyDestroyed && enemyRef?.key && enemyRef?.entry) {
                entityManager.unregisterTrailSegment(enemyRef.key, enemyRef.entry);
            }

            return {
                error: null,
                fireOk: !!fireResult?.ok,
                trailHit: !!fireResult?.trailHit,
                ownDestroyed,
                enemyDestroyed,
            };
        });

        expect(result.error).toBeNull();
        expect(result.fireOk).toBeTruthy();
        expect(result.trailHit).toBeTruthy();
        expect(result.enemyDestroyed).toBeTruthy();
        expect(result.ownDestroyed).toBeFalsy();
    });

    test('T84: Hunt-Trail-Kollision trifft gegnerische Spur auch bei grossem Frame-Schritt', async ({ page }) => {
        await startHuntGameWithBots(page, 1);
        const result = await page.evaluate(() => {
            const game = window.GAME_INSTANCE;
            const entityManager = game?.entityManager;
            const player = entityManager?.players?.[0];
            const enemy = entityManager?.players?.find((entry, index) => index !== 0 && entry?.alive);
            if (!game || !entityManager || !player || !enemy) {
                return { error: 'missing-state' };
            }
            if (String(game?.activeGameMode || '').toUpperCase() !== 'HUNT') {
                return { error: 'hunt-not-active' };
            }

            player.trail?.clear?.();
            enemy.trail?.clear?.();

            player.position.set(0, 50, 6);
            player.setLookAtWorld?.(0, 50, -120);
            player.spawnProtectionTimer = 0;
            player.hp = Math.max(100, Number(player.maxHp) || 100);
            player.lastDamageTimestamp = -Infinity;

            enemy.position.set(30, 50, -40);

            const writeIndex = Math.max(0, Number(enemy?.trail?.writeIndex) || 0);
            const maxSegments = Math.max(1, Number(enemy?.trail?.maxSegments) || 5000);
            const segmentIdx = (writeIndex + Math.floor(maxSegments * 0.6)) % maxSegments;
            const radius = Math.max(0.25, (Number(enemy?.trail?.width) || 0.6) * 0.5);

            const trailRef = entityManager.registerTrailSegment(enemy.index, segmentIdx, {
                fromX: -8,
                fromY: 50,
                fromZ: 0,
                toX: 8,
                toY: 50,
                toZ: 0,
                midX: 0,
                midZ: 0,
                radius,
                hp: 3,
                maxHp: 3,
                ownerTrail: null,
            });

            const hpBefore = Number(player.hp || 0);
            entityManager._playerLifecycleSystem.updatePlayer(player, 0.55, {
                nextItem: false,
                dropItem: false,
                useItem: -1,
                shootItem: false,
                shootItemIndex: -1,
                shootMG: false,
                pitchUp: false,
                pitchDown: false,
                yawLeft: false,
                yawRight: false,
                rollLeft: false,
                rollRight: false,
                boost: false,
                cameraSwitch: false,
            });
            const hpAfter = Number(player.hp || 0);

            if (trailRef?.key && trailRef?.entry && !trailRef.entry.destroyed) {
                entityManager.unregisterTrailSegment(trailRef.key, trailRef.entry);
            }

            return {
                error: null,
                hpBefore,
                hpAfter,
                damageApplied: hpBefore - hpAfter,
                alive: !!player.alive,
            };
        });

        expect(result.error).toBeNull();
        expect(result.damageApplied).toBeGreaterThan(0);
        expect(result.hpAfter).toBeLessThan(result.hpBefore);
        expect(result.alive).toBeTruthy();
    });

    test('T85: Hunt-Trail-Kollision trifft gegnerische Spur auch bei kleinen Frames (Enemy-Offset)', async ({ page }) => {
        await startHuntGameWithBots(page, 1);
        const result = await page.evaluate(() => {
            const game = window.GAME_INSTANCE;
            const entityManager = game?.entityManager;
            const player = entityManager?.players?.[0];
            const enemy = entityManager?.players?.find((entry, index) => index !== 0 && entry?.alive);
            if (!game || !entityManager || !player || !enemy) {
                return { error: 'missing-state' };
            }
            if (String(game?.activeGameMode || '').toUpperCase() !== 'HUNT') {
                return { error: 'hunt-not-active' };
            }

            player.trail?.clear?.();
            enemy.trail?.clear?.();
            player.trail?.forceGap?.(3.0);

            player.position.set(1.45, 50, 6);
            player.setLookAtWorld?.(1.45, 50, -120);
            player.spawnProtectionTimer = 0;
            player.hp = Math.max(100, Number(player.maxHp) || 100);
            player.lastDamageTimestamp = -Infinity;

            enemy.position.set(30, 50, -30);

            const writeIndex = Math.max(0, Number(enemy?.trail?.writeIndex) || 0);
            const maxSegments = Math.max(1, Number(enemy?.trail?.maxSegments) || 5000);
            const segmentIdx = (writeIndex + Math.floor(maxSegments * 0.52)) % maxSegments;
            const radius = Math.max(0.25, (Number(enemy?.trail?.width) || 0.6) * 0.5);

            const trailRef = entityManager.registerTrailSegment(enemy.index, segmentIdx, {
                fromX: 0,
                fromY: 50,
                fromZ: -8,
                toX: 0,
                toY: 50,
                toZ: 8,
                midX: 0,
                midZ: 0,
                radius,
                hp: 3,
                maxHp: 3,
                ownerTrail: null,
            });

            const neutralInput = {
                nextItem: false,
                dropItem: false,
                useItem: -1,
                shootItem: false,
                shootItemIndex: -1,
                shootMG: false,
                pitchUp: false,
                pitchDown: false,
                yawLeft: false,
                yawRight: false,
                rollLeft: false,
                rollRight: false,
                boost: false,
                cameraSwitch: false,
            };

            const hpBefore = Number(player.hp || 0);
            for (let i = 0; i < 60; i++) {
                entityManager._playerLifecycleSystem.updatePlayer(player, 1 / 60, neutralInput);
                if (Number(player.hp || 0) < hpBefore || !player.alive) break;
            }
            const hpAfter = Number(player.hp || 0);

            if (trailRef?.key && trailRef?.entry && !trailRef.entry.destroyed) {
                entityManager.unregisterTrailSegment(trailRef.key, trailRef.entry);
            }

            return {
                error: null,
                hpBefore,
                hpAfter,
                damageApplied: hpBefore - hpAfter,
                alive: !!player.alive,
                finalX: Number(player.position.x || 0),
                finalZ: Number(player.position.z || 0),
            };
        });

        expect(result.error).toBeNull();
        expect(result.damageApplied).toBeGreaterThan(0);
        expect(result.hpAfter).toBeLessThan(result.hpBefore);
        expect(result.alive).toBeTruthy();
    });

    test('T86: Hunt-MG zerstoert gegnerisches echtes Trail-Segment (ownerTrail) sofort', async ({ page }) => {
        await startHuntGameWithBots(page, 1);
        const result = await page.evaluate(() => {
            const game = window.GAME_INSTANCE;
            const entityManager = game?.entityManager;
            const shooter = entityManager?.players?.[0];
            const enemy = entityManager?.players?.find((entry, index) => index !== 0 && entry?.alive);
            if (!game || !entityManager || !shooter || !enemy) {
                return { error: 'missing-state' };
            }
            if (String(game?.activeGameMode || '').toUpperCase() !== 'HUNT') {
                return { error: 'hunt-not-active' };
            }

            shooter.trail?.clear?.();
            enemy.trail?.clear?.();
            shooter.position.set(0, 50, 0);
            shooter.setLookAtWorld?.(0, 50, -120);
            enemy.position.set(20, 50, -20);

            enemy.trail._addSegment(0, 50, -18, 0, 50, -16);
            const maxSegments = Math.max(1, Number(enemy?.trail?.maxSegments) || 5000);
            const segmentIdx = (Math.max(0, Number(enemy.trail.writeIndex) || 0) - 1 + maxSegments) % maxSegments;
            const refBefore = enemy?.trail?.segmentRefs?.[segmentIdx] || null;
            if (!refBefore?.entry) {
                return { error: 'missing-owner-trail-segment' };
            }

            shooter.shootCooldown = 0;
            if (entityManager._overheatGunSystem?._overheatByPlayer) {
                entityManager._overheatGunSystem._overheatByPlayer[shooter.index] = 0;
            }
            if (entityManager._overheatGunSystem?._lockoutByPlayer) {
                entityManager._overheatGunSystem._lockoutByPlayer[shooter.index] = 0;
            }

            const fireResult = entityManager._shootHuntGun(shooter);
            const entry = refBefore.entry;
            const destroyed = !!entry?.destroyed;
            const refAfter = enemy?.trail?.segmentRefs?.[segmentIdx] || null;

            if (refAfter?.key && refAfter?.entry) {
                entityManager.unregisterTrailSegment(refAfter.key, refAfter.entry);
                enemy.trail.segmentRefs[segmentIdx] = null;
            }

            return {
                error: null,
                fireOk: !!fireResult?.ok,
                trailHit: !!fireResult?.trailHit,
                destroyed,
                visualCleared: refAfter === null,
            };
        });

        expect(result.error).toBeNull();
        expect(result.fireOk).toBeTruthy();
        expect(result.trailHit).toBeTruthy();
        expect(result.destroyed).toBeTruthy();
        expect(result.visualCleared).toBeTruthy();
    });

    test('T87: Hunt-MG entfernt Trail-Visual auch bei totem Gegner sofort', async ({ page }) => {
        await startHuntGameWithBots(page, 1);
        const result = await page.evaluate(() => {
            const game = window.GAME_INSTANCE;
            const entityManager = game?.entityManager;
            const shooter = entityManager?.players?.[0];
            const enemy = entityManager?.players?.find((entry, index) => index !== 0 && entry?.alive);
            if (!game || !entityManager || !shooter || !enemy) {
                return { error: 'missing-state' };
            }
            if (String(game?.activeGameMode || '').toUpperCase() !== 'HUNT') {
                return { error: 'hunt-not-active' };
            }

            shooter.trail?.clear?.();
            enemy.trail?.clear?.();
            shooter.position.set(0, 50, 0);
            shooter.setLookAtWorld?.(0, 50, -120);
            enemy.position.set(22, 50, -20);

            enemy.trail._addSegment(0, 50, -18, 0, 50, -16);
            const maxSegments = Math.max(1, Number(enemy?.trail?.maxSegments) || 5000);
            const segmentIdx = (Math.max(0, Number(enemy.trail.writeIndex) || 0) - 1 + maxSegments) % maxSegments;
            const refBefore = enemy?.trail?.segmentRefs?.[segmentIdx] || null;
            if (!refBefore?.entry) {
                return { error: 'missing-owner-trail-segment' };
            }

            enemy.kill();
            if (enemy.trail?.mesh?.instanceMatrix) {
                enemy.trail.mesh.instanceMatrix.needsUpdate = false;
            }

            shooter.shootCooldown = 0;
            if (entityManager._overheatGunSystem?._overheatByPlayer) {
                entityManager._overheatGunSystem._overheatByPlayer[shooter.index] = 0;
            }
            if (entityManager._overheatGunSystem?._lockoutByPlayer) {
                entityManager._overheatGunSystem._lockoutByPlayer[shooter.index] = 0;
            }

            const fireResult = entityManager._shootHuntGun(shooter);
            const entry = refBefore.entry;
            const destroyed = !!entry?.destroyed;
            const refAfter = enemy?.trail?.segmentRefs?.[segmentIdx] || null;
            const matrixArray = enemy?.trail?.mesh?.instanceMatrix?.array || null;
            const matrixOffset = segmentIdx * 16;
            const m0 = Number(matrixArray?.[matrixOffset] || 0);
            const m5 = Number(matrixArray?.[matrixOffset + 5] || 0);
            const m10 = Number(matrixArray?.[matrixOffset + 10] || 0);
            const scaleCollapsed = Math.abs(m0) < 1e-6 && Math.abs(m5) < 1e-6 && Math.abs(m10) < 1e-6;

            if (refAfter?.key && refAfter?.entry) {
                entityManager.unregisterTrailSegment(refAfter.key, refAfter.entry);
                enemy.trail.segmentRefs[segmentIdx] = null;
            }

            return {
                error: null,
                fireOk: !!fireResult?.ok,
                trailHit: !!fireResult?.trailHit,
                destroyed,
                visualCleared: refAfter === null,
                scaleCollapsed,
            };
        });

        expect(result.error).toBeNull();
        expect(result.fireOk).toBeTruthy();
        expect(result.trailHit).toBeTruthy();
        expect(result.destroyed).toBeTruthy();
        expect(result.visualCleared).toBeTruthy();
        expect(result.scaleCollapsed).toBeTruthy();
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

    test('T67: Item-Slot-Encoding erzeugt stabiles 20-Slot-One-Hot-Array', async ({ page }) => {
        await loadGame(page);
        const result = await page.evaluate(async () => {
            const mod = await import('/src/entities/ai/observation/ItemSlotEncoder.js');
            const encoded = new Array(mod.ITEM_SLOT_COUNT).fill(-1);
            mod.encodeItemSlots(['SPEED_UP', 'ROCKET_MEDIUM', 'UNKNOWN_ITEM', 'ROCKET_MEDIUM'], encoded);
            return {
                encoded,
                slotCount: mod.ITEM_SLOT_COUNT,
                speedUpSlot: mod.ITEM_SLOT_BY_TYPE.SPEED_UP,
                rocketMediumSlot: mod.ITEM_SLOT_BY_TYPE.ROCKET_MEDIUM,
                unknownSlot: mod.ITEM_SLOT_UNKNOWN_INDEX,
            };
        });

        expect(result.encoded.length).toBe(result.slotCount);
        expect(result.encoded[result.speedUpSlot]).toBe(1);
        expect(result.encoded[result.rocketMediumSlot]).toBe(1);
        expect(result.encoded[result.unknownSlot]).toBe(1);
        expect(result.encoded.every((value) => value === 0 || value === 1)).toBeTruthy();
    });

    test('T68: Mode-Feature-Encoding mappt classic/hunt deterministisch', async ({ page }) => {
        await loadGame(page);
        const result = await page.evaluate(async () => {
            const mod = await import('/src/entities/ai/observation/ModeFeatureEncoder.js');
            const classic = mod.writeModeFeatures('classic', [0, 0, 0]);
            const hunt = mod.writeModeFeatures('HUNT', [0, 0, 0]);
            const fallback = mod.writeModeFeatures('unknown-mode', [0, 0, 0]);
            return { classic, hunt, fallback };
        });

        expect(result.classic).toEqual([0, 1, 0]);
        expect(result.hunt).toEqual([1, 0, 1]);
        expect(result.fallback).toEqual([0, 1, 0]);
    });

    test('T69: Observation-Schema V1 hat feste Laenge und eindeutige Indizes', async ({ page }) => {
        await loadGame(page);
        const result = await page.evaluate(async () => {
            const schema = await import('/src/entities/ai/observation/ObservationSchemaV1.js');
            const semantics = await import('/src/entities/ai/observation/ObservationSemantics.js');
            const indexValues = Object.values(schema.OBSERVATION_INDEX)
                .filter((value) => Number.isInteger(value))
                .sort((a, b) => a - b);
            const uniqueIndices = new Set(indexValues);
            const semanticsIndices = semantics.OBSERVATION_SEMANTICS_V1.map((entry) => entry.index);
            const uniqueSemanticIndices = new Set(semanticsIndices);

            return {
                version: schema.OBSERVATION_SCHEMA_VERSION,
                length: schema.OBSERVATION_LENGTH_V1,
                indexCount: indexValues.length,
                uniqueIndexCount: uniqueIndices.size,
                minIndex: indexValues[0],
                maxIndex: indexValues[indexValues.length - 1],
                itemSlot00: schema.ITEM_SLOT_00,
                itemSlot19: schema.ITEM_SLOT_19,
                semanticsLength: semantics.OBSERVATION_SEMANTICS_V1.length,
                uniqueSemanticsIndexCount: uniqueSemanticIndices.size,
                hasUniqueSemanticsIndices: semantics.hasUniqueObservationSemanticIndices(),
                hasExpectedSemanticsLength: semantics.hasExpectedObservationSemanticLength(schema.OBSERVATION_LENGTH_V1),
            };
        });

        expect(result.version).toBe('v1');
        expect(result.length).toBe(40);
        expect(result.indexCount).toBe(40);
        expect(result.uniqueIndexCount).toBe(40);
        expect(result.minIndex).toBe(0);
        expect(result.maxIndex).toBe(39);
        expect(result.itemSlot00).toBe(20);
        expect(result.itemSlot19).toBe(39);
        expect(result.semanticsLength).toBe(40);
        expect(result.uniqueSemanticsIndexCount).toBe(40);
        expect(result.hasUniqueSemanticsIndices).toBeTruthy();
        expect(result.hasExpectedSemanticsLength).toBeTruthy();
    });

    test('T70: Observation-System extrahiert normalisierte Runtime-Features', async ({ page }) => {
        await startGameWithBots(page, 1);
        const result = await page.evaluate(async () => {
            const schema = await import('/src/entities/ai/observation/ObservationSchemaV1.js');
            const observation = await import('/src/entities/ai/observation/ObservationSystem.js');

            const game = window.GAME_INSTANCE;
            const entityManager = game?.entityManager;
            const bot = entityManager?.players?.find((player) => player?.isBot);
            if (!entityManager || !bot) {
                return { error: 'missing-bot' };
            }

            const context = observation.createObservationContext({
                arena: entityManager.arena,
                players: entityManager.players,
                projectiles: entityManager.projectiles,
                mode: game?.activeGameMode || 'classic',
                planarMode: !!game?.config?.GAMEPLAY?.PLANAR_MODE,
            });
            const vector = observation.buildObservation(bot, context);
            const itemSlots = vector.slice(schema.ITEM_SLOT_00, schema.ITEM_SLOT_19 + 1);
            const ratioIndices = [
                schema.SPEED_RATIO,
                schema.HEALTH_RATIO,
                schema.SHIELD_RATIO,
                schema.WALL_DISTANCE_FRONT,
                schema.WALL_DISTANCE_LEFT,
                schema.WALL_DISTANCE_RIGHT,
                schema.WALL_DISTANCE_UP,
                schema.WALL_DISTANCE_DOWN,
                schema.TARGET_DISTANCE_RATIO,
                schema.PRESSURE_LEVEL,
                schema.LOCAL_OPENNESS_RATIO,
                schema.INVENTORY_COUNT_RATIO,
            ];
            const ratiosInRange = ratioIndices.every((index) => {
                const value = Number(vector[index]);
                return Number.isFinite(value) && value >= 0 && value <= 1;
            });
            const signedAlignment = Number(vector[schema.TARGET_ALIGNMENT]);
            const selectedSlot = Number(vector[schema.SELECTED_ITEM_SLOT]);

            return {
                error: null,
                length: vector.length,
                ratiosInRange,
                signedAlignmentInRange: Number.isFinite(signedAlignment) && signedAlignment >= -1 && signedAlignment <= 1,
                selectedSlotInRange: selectedSlot >= -1 && selectedSlot <= 19,
                itemSlotCount: itemSlots.length,
                itemSlotsValid: itemSlots.every((value) => value === 0 || value === 1),
            };
        });

        expect(result.error).toBeNull();
        expect(result.length).toBe(40);
        expect(result.ratiosInRange).toBeTruthy();
        expect(result.signedAlignmentInRange).toBeTruthy();
        expect(result.selectedSlotInRange).toBeTruthy();
        expect(result.itemSlotCount).toBe(20);
        expect(result.itemSlotsValid).toBeTruthy();
    });

    test('T71: Runtime-Context-Signatur uebergibt Kontext inkl. Observation an Policies', async ({ page }) => {
        await startGameWithBots(page, 1);
        const result = await page.evaluate(() => {
            const game = window.GAME_INSTANCE;
            const entityManager = game?.entityManager;
            const bot = entityManager?.players?.find((player) => player?.isBot);
            if (!entityManager || !bot) {
                return { error: 'missing-bot' };
            }

            const policy = entityManager.botByPlayer.get(bot);
            if (!policy) {
                return { error: 'missing-policy' };
            }

            const originalUpdate = policy.update;
            const originalFlag = policy.usesRuntimeContext;
            let observed = null;
            try {
                policy.usesRuntimeContext = true;
                policy.update = function runtimeContextUpdate(dt, player, context) {
                    observed = {
                        argCount: arguments.length,
                        hasArena: !!context?.arena,
                        hasPlayers: Array.isArray(context?.players),
                        hasProjectiles: Array.isArray(context?.projectiles),
                        hasRules: !!context?.rules,
                        hasObservation: Number(context?.observation?.length) === 40,
                        modeType: typeof context?.mode,
                    };
                    return { yawLeft: true };
                };
                const action = entityManager._playerInputSystem.resolvePlayerInput(bot, 1 / 60, null);
                return { error: null, observed, actionYawLeft: !!action?.yawLeft };
            } finally {
                policy.update = originalUpdate;
                policy.usesRuntimeContext = originalFlag;
            }
        });

        expect(result.error).toBeNull();
        expect(result.observed.argCount).toBe(3);
        expect(result.observed.hasArena).toBeTruthy();
        expect(result.observed.hasPlayers).toBeTruthy();
        expect(result.observed.hasProjectiles).toBeTruthy();
        expect(result.observed.hasRules).toBeTruthy();
        expect(result.observed.hasObservation).toBeTruthy();
        expect(result.observed.modeType).toBe('string');
        expect(result.actionYawLeft).toBeTruthy();
    });

    test('T72: Legacy-Policy-Signatur bleibt kompatibel', async ({ page }) => {
        await startGameWithBots(page, 1);
        const result = await page.evaluate(() => {
            const game = window.GAME_INSTANCE;
            const entityManager = game?.entityManager;
            const bot = entityManager?.players?.find((player) => player?.isBot);
            if (!entityManager || !bot) {
                return { error: 'missing-bot' };
            }

            const policy = entityManager.botByPlayer.get(bot);
            if (!policy) {
                return { error: 'missing-policy' };
            }

            const originalUpdate = policy.update;
            const originalFlag = policy.usesRuntimeContext;
            let observed = null;
            try {
                policy.usesRuntimeContext = false;
                policy.update = function legacyUpdate(dt, player, arena, allPlayers, projectiles) {
                    observed = {
                        argCount: arguments.length,
                        hasArena: !!arena?.checkCollision,
                        playersLength: Array.isArray(allPlayers) ? allPlayers.length : -1,
                        hasProjectileArray: Array.isArray(projectiles),
                    };
                    return { yawRight: true };
                };
                const action = entityManager._playerInputSystem.resolvePlayerInput(bot, 1 / 60, null);
                return { error: null, observed, actionYawRight: !!action?.yawRight };
            } finally {
                policy.update = originalUpdate;
                policy.usesRuntimeContext = originalFlag;
            }
        });

        expect(result.error).toBeNull();
        expect(result.observed.argCount).toBe(5);
        expect(result.observed.hasArena).toBeTruthy();
        expect(result.observed.playersLength).toBeGreaterThan(0);
        expect(result.observed.hasProjectileArray).toBeTruthy();
        expect(result.actionYawRight).toBeTruthy();
    });

    test('T73: BotPolicyRegistry registriert modulare Bridge-Policy-Typen', async ({ page }) => {
        await loadGame(page);
        const result = await page.evaluate(async () => {
            const { BotPolicyRegistry } = await import('/src/entities/ai/BotPolicyRegistry.js');
            const { BOT_POLICY_TYPES } = await import('/src/entities/ai/BotPolicyTypes.js');

            const registry = new BotPolicyRegistry();
            const classicBridge = registry.create(BOT_POLICY_TYPES.CLASSIC_BRIDGE);
            const huntBridge = registry.create(BOT_POLICY_TYPES.HUNT_BRIDGE);

            return {
                classicType: classicBridge?.type,
                huntType: huntBridge?.type,
                classicUsesRuntimeContext: classicBridge?.usesRuntimeContext === true,
                huntUsesRuntimeContext: huntBridge?.usesRuntimeContext === true,
                classicHasUpdate: typeof classicBridge?.update === 'function',
                huntHasUpdate: typeof huntBridge?.update === 'function',
            };
        });

        expect(result.classicType).toBe('classic-bridge');
        expect(result.huntType).toBe('hunt-bridge');
        expect(result.classicUsesRuntimeContext).toBeTruthy();
        expect(result.huntUsesRuntimeContext).toBeTruthy();
        expect(result.classicHasUpdate).toBeTruthy();
        expect(result.huntHasUpdate).toBeTruthy();
    });

    test('T74: BotPolicyRegistry faellt bei Fehlkonfiguration kontrolliert auf rule-based zurueck', async ({ page }) => {
        await loadGame(page);
        const result = await page.evaluate(async () => {
            const { BotPolicyRegistry } = await import('/src/entities/ai/BotPolicyRegistry.js');
            const { BOT_POLICY_TYPES } = await import('/src/entities/ai/BotPolicyTypes.js');

            const registry = new BotPolicyRegistry();
            registry.register('broken-bridge', () => {
                throw new Error('simulated-registry-factory-error');
            });

            const unknown = registry.create('unknown-policy-type');
            const broken = registry.create('broken-bridge');
            const disabledBridge = registry.create(BOT_POLICY_TYPES.CLASSIC_BRIDGE, { bridgeEnabled: false });

            return {
                unknownType: unknown?.type,
                brokenType: broken?.type,
                disabledBridgeType: disabledBridge?.type,
                unknownHasUpdate: typeof unknown?.update === 'function',
                brokenHasUpdate: typeof broken?.update === 'function',
            };
        });

        expect(result.unknownType).toBe('rule-based');
        expect(result.brokenType).toBe('rule-based');
        expect(result.disabledBridgeType).toBe('rule-based');
        expect(result.unknownHasUpdate).toBeTruthy();
        expect(result.brokenHasUpdate).toBeTruthy();
    });

    test('T75: ClassicBridgePolicy leitet Kern-Action aus Observation-Vektor ab', async ({ page }) => {
        await loadGame(page);
        const result = await page.evaluate(async () => {
            const { ClassicBridgePolicy } = await import('/src/entities/ai/ClassicBridgePolicy.js');
            const schema = await import('/src/entities/ai/observation/ObservationSchemaV1.js');
            const bot = {
                index: 0,
                inventory: ['SHIELD'],
                selectedItemIndex: 0,
            };
            const context = {
                players: [],
                projectiles: [],
                observation: null,
            };
            context.observation = new Array(schema.OBSERVATION_LENGTH_V1).fill(0);
            context.observation[schema.WALL_DISTANCE_FRONT] = 0.18;
            context.observation[schema.WALL_DISTANCE_LEFT] = 0.14;
            context.observation[schema.WALL_DISTANCE_RIGHT] = 0.9;
            context.observation[schema.TARGET_DISTANCE_RATIO] = 0.2;
            context.observation[schema.TARGET_ALIGNMENT] = 0.94;
            context.observation[schema.TARGET_IN_FRONT] = 1;
            context.observation[schema.PRESSURE_LEVEL] = 0.84;
            context.observation[schema.PROJECTILE_THREAT] = 1;
            context.observation[schema.LOCAL_OPENNESS_RATIO] = 0.7;
            context.observation[schema.INVENTORY_COUNT_RATIO] = 0.1;
            context.observation[schema.SELECTED_ITEM_SLOT] = 0;

            const policy = new ClassicBridgePolicy();
            const action = policy.update(1 / 60, bot, context);

            return {
                error: null,
                type: policy.type,
                yawRight: !!action?.yawRight,
                shootMG: !!action?.shootMG,
                shootItem: !!action?.shootItem,
                shootItemIndex: Number(action?.shootItemIndex),
                boost: !!action?.boost,
            };
        });

        expect(result.error).toBeNull();
        expect(result.type).toBe('classic-bridge');
        expect(result.yawRight).toBeTruthy();
        expect(result.shootMG).toBeTruthy();
        expect(result.shootItem).toBeTruthy();
        expect(result.shootItemIndex).toBe(0);
        expect(result.boost).toBeTruthy();
    });

    test('T76: ClassicBridgePolicy routed Action-Failures kontrolliert auf RuleBased-Fallback', async ({ page }) => {
        await loadGame(page);
        const result = await page.evaluate(async () => {
            const { ClassicBridgePolicy } = await import('/src/entities/ai/ClassicBridgePolicy.js');
            const schema = await import('/src/entities/ai/observation/ObservationSchemaV1.js');
            const bot = {
                index: 0,
                inventory: [],
                selectedItemIndex: 0,
            };
            const context = {
                players: [],
                projectiles: [],
                observation: null,
            };
            context.observation = new Array(schema.OBSERVATION_LENGTH_V1).fill(0);
            context.observation[schema.WALL_DISTANCE_FRONT] = 0.65;

            const policy = new ClassicBridgePolicy({
                resolveAction: () => {
                    throw new Error('simulated-classic-bridge-action-failure');
                },
            });

            const fallbackType = policy._fallbackPolicy?.type;
            const originalFallbackUpdate = policy._fallbackPolicy?.update;
            let fallbackCalled = false;
            let action = null;
            try {
                policy._fallbackPolicy.update = function fallbackUpdate() {
                    fallbackCalled = true;
                    return { yawLeft: true };
                };
                action = policy.update(1 / 60, bot, context);
            } finally {
                policy._fallbackPolicy.update = originalFallbackUpdate;
            }

            return {
                error: null,
                fallbackType,
                fallbackCalled,
                yawLeft: !!action?.yawLeft,
            };
        });

        expect(result.error).toBeNull();
        expect(result.fallbackType).toBe('rule-based');
        expect(result.fallbackCalled).toBeTruthy();
        expect(result.yawLeft).toBeTruthy();
    });

    test('T77: HuntBridgePolicy setzt MG-Druck auf Basis von Observation + Gegnernaehe', async ({ page }) => {
        await startHuntGameWithBots(page, 1);
        const result = await page.evaluate(async () => {
            const { HuntBridgePolicy } = await import('/src/entities/ai/HuntBridgePolicy.js');
            const schema = await import('/src/entities/ai/observation/ObservationSchemaV1.js');
            const game = window.GAME_INSTANCE;
            const entityManager = game?.entityManager;
            const bot = entityManager?.players?.find((player) => player?.isBot);
            const enemy = entityManager?.players?.find((player) => !player?.isBot);
            if (!entityManager || !bot || !enemy) {
                return { error: 'missing-hunt-state' };
            }

            bot.hp = Math.max(1, bot.maxHp || 1);
            bot.inventory = [];
            bot.position.set(0, 50, 0);
            bot.setLookAtWorld?.(0, 50, -100);
            enemy.position.set(0, 50, -18);

            const context = entityManager.createBotRuntimeContext(bot, 1 / 60);
            context.observation = new Array(schema.OBSERVATION_LENGTH_V1).fill(0);
            context.observation[schema.TARGET_DISTANCE_RATIO] = 0.12;
            context.observation[schema.TARGET_IN_FRONT] = 1;
            context.observation[schema.PRESSURE_LEVEL] = 0.35;
            context.observation[schema.PROJECTILE_THREAT] = 0;

            const policy = new HuntBridgePolicy();
            const action = policy.update(1 / 60, bot, context);
            return {
                error: null,
                type: policy.type,
                shootMG: !!action?.shootMG,
                shootItem: !!action?.shootItem,
                shootItemIndex: Number(action?.shootItemIndex),
            };
        });

        expect(result.error).toBeNull();
        expect(result.type).toBe('hunt-bridge');
        expect(result.shootMG).toBeTruthy();
        expect(result.shootItem).toBeFalsy();
        expect(result.shootItemIndex).toBe(-1);
    });

    test('T78: HuntBridgePolicy priorisiert Rocket + Boost bei niedrigem HP-Druck', async ({ page }) => {
        await startHuntGameWithBots(page, 1);
        const result = await page.evaluate(async () => {
            const { HuntBridgePolicy } = await import('/src/entities/ai/HuntBridgePolicy.js');
            const schema = await import('/src/entities/ai/observation/ObservationSchemaV1.js');
            const game = window.GAME_INSTANCE;
            const entityManager = game?.entityManager;
            const bot = entityManager?.players?.find((player) => player?.isBot);
            const enemy = entityManager?.players?.find((player) => !player?.isBot);
            if (!entityManager || !bot || !enemy) {
                return { error: 'missing-hunt-state' };
            }

            bot.maxHp = Math.max(1, Number(bot.maxHp) || 1);
            bot.hp = Math.max(1, bot.maxHp * 0.2);
            bot.inventory = ['ROCKET_WEAK', 'ROCKET_STRONG'];
            bot.selectedItemIndex = 0;
            bot.position.set(0, 50, 0);
            bot.setLookAtWorld?.(0, 50, -100);
            enemy.position.set(2, 50, -14);

            const context = entityManager.createBotRuntimeContext(bot, 1 / 60);
            context.observation = new Array(schema.OBSERVATION_LENGTH_V1).fill(0);
            context.observation[schema.TARGET_DISTANCE_RATIO] = 0.55;
            context.observation[schema.TARGET_IN_FRONT] = 1;
            context.observation[schema.PRESSURE_LEVEL] = 0.92;
            context.observation[schema.PROJECTILE_THREAT] = 1;

            const policy = new HuntBridgePolicy();
            const action = policy.update(1 / 60, bot, context);
            return {
                error: null,
                shootItem: !!action?.shootItem,
                shootItemIndex: Number(action?.shootItemIndex),
                boost: !!action?.boost,
                yawCommand: !!action?.yawLeft || !!action?.yawRight,
                pitchCommand: !!action?.pitchUp || !!action?.pitchDown,
            };
        });

        expect(result.error).toBeNull();
        expect(result.shootItem).toBeTruthy();
        expect(result.shootItemIndex).toBe(1);
        expect(result.boost).toBeTruthy();
        expect(result.yawCommand || result.pitchCommand).toBeTruthy();
    });

    test('T79: RuntimeConfig setzt Trainer-WebSocket-Flag standardmaessig auf false', async ({ page }) => {
        await loadGame(page);
        const result = await page.evaluate(async () => {
            const { createRuntimeConfigSnapshot } = await import('/src/core/RuntimeConfig.js');
            const snapshot = createRuntimeConfigSnapshot({});
            return {
                policyStrategy: String(snapshot?.bot?.policyStrategy || ''),
                policyType: String(snapshot?.bot?.policyType || ''),
                trainerBridgeEnabled: !!snapshot?.bot?.trainerBridgeEnabled,
                trainerBridgeUrl: String(snapshot?.bot?.trainerBridgeUrl || ''),
                trainerBridgeTimeoutMs: Number(snapshot?.bot?.trainerBridgeTimeoutMs || 0),
            };
        });

        expect(result.policyStrategy).toBe('auto');
        expect(result.policyType).toBe('rule-based');
        expect(result.trainerBridgeEnabled).toBeFalsy();
        expect(result.trainerBridgeUrl.startsWith('ws://')).toBeTruthy();
        expect(result.trainerBridgeTimeoutMs).toBeGreaterThanOrEqual(20);
    });

    test('T80: ObservationBridgePolicy faellt bei Trainer-Timeout auf lokale Policy zurueck', async ({ page }) => {
        await loadGame(page);
        const result = await page.evaluate(async () => {
            const { ObservationBridgePolicy } = await import('/src/entities/ai/ObservationBridgePolicy.js');
            const originalWebSocket = globalThis.WebSocket;
            let fallbackCalls = 0;

            class MockWebSocket {
                static CONNECTING = 0;
                static OPEN = 1;
                static CLOSING = 2;
                static CLOSED = 3;

                constructor() {
                    this.readyState = MockWebSocket.OPEN;
                    this._listeners = new Map();
                    setTimeout(() => this._emit('open', {}), 0);
                }

                addEventListener(type, handler) {
                    if (!this._listeners.has(type)) {
                        this._listeners.set(type, []);
                    }
                    this._listeners.get(type).push(handler);
                }

                removeEventListener(type, handler) {
                    const handlers = this._listeners.get(type) || [];
                    this._listeners.set(type, handlers.filter((entry) => entry !== handler));
                }

                _emit(type, event) {
                    const handlers = this._listeners.get(type) || [];
                    handlers.forEach((handler) => handler(event));
                }

                send() {
                    // intentionally no response to trigger timeout path
                }

                close() {
                    this.readyState = MockWebSocket.CLOSED;
                    this._emit('close', {});
                }
            }

            globalThis.WebSocket = MockWebSocket;
            try {
                const fallbackPolicy = {
                    type: 'rule-based',
                    update() {
                        fallbackCalls++;
                        return { yawLeft: true };
                    },
                };
                const policy = new ObservationBridgePolicy({
                    type: 'classic-bridge',
                    fallbackPolicy,
                    trainerBridgeEnabled: true,
                    trainerBridgeTimeoutMs: 8,
                    trainerBridgeUrl: 'ws://127.0.0.1:8765',
                });
                const bot = { index: 0, inventory: [] };
                const context = {
                    mode: 'classic',
                    dt: 1 / 60,
                    players: [],
                    projectiles: [],
                    observation: new Array(40).fill(0),
                };

                const firstAction = policy.update(1 / 60, bot, context);
                await new Promise((resolve) => setTimeout(resolve, 20));
                const secondAction = policy.update(1 / 60, bot, context);

                policy.reset();
                return {
                    firstYawLeft: !!firstAction?.yawLeft,
                    secondYawLeft: !!secondAction?.yawLeft,
                    fallbackCalls,
                };
            } finally {
                globalThis.WebSocket = originalWebSocket;
            }
        });

        expect(result.firstYawLeft).toBeTruthy();
        expect(result.secondYawLeft).toBeTruthy();
        expect(result.fallbackCalls).toBeGreaterThanOrEqual(2);
    });

    test('T81: RuntimeConfig loest Bot-Policy-Strategie reproduzierbar nach Modus auf', async ({ page }) => {
        await loadGame(page);
        const result = await page.evaluate(async () => {
            const { createRuntimeConfigSnapshot } = await import('/src/core/RuntimeConfig.js');

            const classicAuto = createRuntimeConfigSnapshot({
                gameMode: 'CLASSIC',
                botPolicyStrategy: 'auto',
            });
            const huntAuto = createRuntimeConfigSnapshot({
                gameMode: 'HUNT',
                botPolicyStrategy: 'auto',
            });
            const classicBridge = createRuntimeConfigSnapshot({
                gameMode: 'CLASSIC',
                botPolicyStrategy: 'bridge',
            });
            const huntBridge = createRuntimeConfigSnapshot({
                gameMode: 'HUNT',
                botPolicyStrategy: 'bridge',
            });
            const forcedRuleBased = createRuntimeConfigSnapshot({
                gameMode: 'HUNT',
                botPolicyStrategy: 'rule-based',
            });
            const invalidStrategy = createRuntimeConfigSnapshot({
                gameMode: 'CLASSIC',
                botPolicyStrategy: 'unknown',
            });

            return {
                classicAuto: classicAuto?.bot?.policyType,
                huntAuto: huntAuto?.bot?.policyType,
                classicBridge: classicBridge?.bot?.policyType,
                huntBridge: huntBridge?.bot?.policyType,
                forcedRuleBased: forcedRuleBased?.bot?.policyType,
                invalidStrategyName: invalidStrategy?.bot?.policyStrategy,
                invalidStrategyPolicy: invalidStrategy?.bot?.policyType,
            };
        });

        expect(result.classicAuto).toBe('rule-based');
        expect(result.huntAuto).toBe('hunt');
        expect(result.classicBridge).toBe('classic-bridge');
        expect(result.huntBridge).toBe('hunt-bridge');
        expect(result.forcedRuleBased).toBe('rule-based');
        expect(result.invalidStrategyName).toBe('auto');
        expect(result.invalidStrategyPolicy).toBe('rule-based');
    });

    test('T82: Session-Wiring uebergibt aufgeloeste Bot-Policy an EntityManager', async ({ page }) => {
        await loadGame(page);
        const result = await page.evaluate(() => {
            const game = window.GAME_INSTANCE;
            if (!game?.startMatch || !game?._returnToMenu) {
                return { error: 'missing-game-hooks' };
            }

            game.settings.mode = '1p';
            game.settings.numBots = 1;

            const runScenario = (gameMode, strategy) => {
                game.settings.gameMode = gameMode;
                game.settings.botPolicyStrategy = strategy;
                game._onSettingsChanged();
                game.startMatch();

                const entityManager = game.entityManager;
                const botPlayer = entityManager?.players?.find((player) => player?.isBot) || null;
                const botPolicy = botPlayer ? entityManager?.botByPlayer?.get(botPlayer) : null;
                const snapshot = {
                    mode: String(game.runtimeConfig?.session?.activeGameMode || ''),
                    strategy: String(game.runtimeConfig?.bot?.policyStrategy || ''),
                    runtimePolicyType: String(game.runtimeConfig?.bot?.policyType || ''),
                    entityPolicyType: String(entityManager?.botPolicyType || ''),
                    botPolicyType: String(botPolicy?.type || ''),
                };
                game._returnToMenu();
                return snapshot;
            };

            return {
                error: null,
                classicBridge: runScenario('CLASSIC', 'bridge'),
                huntBridge: runScenario('HUNT', 'bridge'),
                huntAuto: runScenario('HUNT', 'auto'),
            };
        });

        expect(result.error).toBeNull();
        expect(result.classicBridge.runtimePolicyType).toBe('classic-bridge');
        expect(result.classicBridge.entityPolicyType).toBe('classic-bridge');
        expect(result.classicBridge.botPolicyType).toBe('classic-bridge');
        expect(result.huntBridge.runtimePolicyType).toBe('hunt-bridge');
        expect(result.huntBridge.entityPolicyType).toBe('hunt-bridge');
        expect(result.huntBridge.botPolicyType).toBe('hunt-bridge');
        expect(result.huntAuto.runtimePolicyType).toBe('hunt');
        expect(result.huntAuto.entityPolicyType).toBe('hunt');
        expect(result.huntAuto.botPolicyType).toBe('hunt');
    });
});
