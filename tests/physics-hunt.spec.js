import { test, expect } from '@playwright/test';
import { loadGame, startHuntGame, startHuntGameWithBots } from './helpers.js';

test.describe('Physics Hunt (T61-T64, T83-T87)', () => {

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

});
