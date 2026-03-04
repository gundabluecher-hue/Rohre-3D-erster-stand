import * as THREE from 'three';
import { ProjectileSystem } from '../systems/ProjectileSystem.js';
import { PlayerInputSystem } from '../systems/PlayerInputSystem.js';
import { PlayerLifecycleSystem } from '../systems/PlayerLifecycleSystem.js';
import { TrailSpatialIndex } from '../systems/TrailSpatialIndex.js';
import { SpawnPlacementSystem } from '../systems/SpawnPlacementSystem.js';
import { CollisionResponseSystem } from '../systems/CollisionResponseSystem.js';
import { HuntCombatSystem } from '../systems/HuntCombatSystem.js';
import { RoundOutcomeSystem } from '../systems/RoundOutcomeSystem.js';
import { EntityRuntimeContext } from './EntityRuntimeContext.js';
import { EntityEventBus } from './EntityEventBus.js';
import { OverheatGunSystem } from '../../hunt/OverheatGunSystem.js';
import { RespawnSystem } from '../../hunt/RespawnSystem.js';
import { HuntScoring } from '../../hunt/HuntScoring.js';

export class EntityRuntimeAssembler {
    constructor(entityManager) {
        this.entityManager = entityManager || null;
    }

    assemble() {
        const owner = this.entityManager;
        let eventBus = null;
        const projectileSystem = new ProjectileSystem({
            renderer: owner.renderer,
            getArena: () => owner.arena,
            getPlayers: () => owner.players,
            takeInventoryItem: (player, preferredIndex) => owner._takeInventoryItem(player, preferredIndex),
            resolveLockOn: (player) => owner._checkLockOn(player),
            getTrailSpatialIndex: () => owner._trailSpatialIndex,
            onShoot: () => {
                if (owner.audio) owner.audio.play('SHOOT');
            },
            onProjectileHit: (position, color, projectileOwner) => {
                if (owner.particles) owner.particles.spawnHit(position, color);
                if (owner.audio && !projectileOwner?.isBot) owner.audio.play('HIT');
            },
            onTrailSegmentHit: (position, projectileOwner, projectile, trailHit) => {
                const isDestroyed = !!trailHit?.destroyed;
                const color = isDestroyed ? 0x66ddff : 0x3388ff;
                if (owner.particles) owner.particles.spawnHit(position, color);
                if (owner.audio && !projectileOwner?.isBot) owner.audio.play('HIT');
            },
            onProjectilePowerup: (target) => {
                if (owner.particles) owner.particles.spawnExplosion(target.position, 0xff0000);
                if (owner.audio) owner.audio.play('POWERUP');
            },
            onProjectileDamage: (target, projectileOwner, type, damageResult) => {
                owner._emitHuntDamageEvent({
                    target,
                    sourcePlayer: projectileOwner || null,
                    cause: type || 'PROJECTILE',
                    damageResult,
                    projectileType: type || null,
                });
                if (damageResult?.isDead) {
                    owner._killPlayer(target, 'PROJECTILE', { killer: projectileOwner || null });
                }
                if (damageResult?.isDead && projectileOwner) {
                    const attackerLabel = projectileOwner.isBot ? `Bot ${projectileOwner.index + 1}` : `P${projectileOwner.index + 1}`;
                    const targetLabel = target.isBot ? `Bot ${target.index + 1}` : `P${target.index + 1}`;
                    eventBus?.emitHuntFeed(`${attackerLabel} -> ${targetLabel}: ELIMINATED`);
                }
                if (!damageResult?.isDead && projectileOwner) {
                    const attackerLabel = projectileOwner.isBot ? `Bot ${projectileOwner.index + 1}` : `P${projectileOwner.index + 1}`;
                    const targetLabel = target.isBot ? `Bot ${target.index + 1}` : `P${target.index + 1}`;
                    eventBus?.emitHuntFeed(`${attackerLabel} -> ${targetLabel}: -${Math.round(damageResult?.applied || 0)} HP`);
                }
            },
        });

        const huntScoring = new HuntScoring();
        eventBus = new EntityEventBus({
            onPlayerFeedback: (player, message) => {
                if (typeof owner.onPlayerFeedback === 'function') owner.onPlayerFeedback(player, message);
            },
            onHuntDamageEvent: (event) => {
                if (typeof owner.onHuntDamageEvent === 'function') owner.onHuntDamageEvent(event || null);
            },
            onHuntFeedEvent: (message) => {
                if (typeof owner.onHuntFeedEvent === 'function') owner.onHuntFeedEvent(message);
            },
            onPlayerDied: (player, cause) => {
                if (typeof owner.onPlayerDied === 'function') owner.onPlayerDied(player, cause);
            },
            onRoundEnd: (winner) => {
                if (typeof owner.onRoundEnd === 'function') owner.onRoundEnd(winner);
            },
        });

        const tmpVec = new THREE.Vector3();
        const tmpVec2 = new THREE.Vector3();
        const tmpDir = new THREE.Vector3();
        const tmpDir2 = new THREE.Vector3();
        const tmpCamAnchor = new THREE.Vector3();
        const tmpCollisionNormal = new THREE.Vector3();
        const tmpPrevPlayerPosition = new THREE.Vector3();
        const fallbackArenaCollision = { hit: true, kind: 'wall', isWall: true, normal: null };
        const lockOnCache = new Map();
        const trailSpatialIndex = new TrailSpatialIndex({
            getPlayers: () => owner.players,
            gridSize: 10,
        });

        let collisionResponseSystem = null;
        const spawnPlacementSystem = new SpawnPlacementSystem(owner, {
            isBotPositionSafe: (player, position) => (
                collisionResponseSystem
                    ? collisionResponseSystem.isBotPositionSafe(player, position)
                    : true
            ),
        });
        collisionResponseSystem = new CollisionResponseSystem(owner, spawnPlacementSystem);

        const runtimeContext = new EntityRuntimeContext({
            players: owner.players,
            arena: owner.arena,
            tempVectors: {
                primary: tmpVec,
                secondary: tmpVec2,
                direction: tmpDir,
                previousPlayerPosition: tmpPrevPlayerPosition,
            },
            cache: {
                lockOn: lockOnCache,
            },
            services: {
                particles: owner.particles,
                audio: owner.audio,
                recorder: owner.recorder,
            },
            callbacks: {
                combat: {
                    shootItemProjectile: (player, preferredIndex = -1) => projectileSystem.shootItemProjectile(player, preferredIndex),
                    shootHuntGun: (player) => owner._overheatGunSystem.tryFire(player),
                },
                spawn: {
                    getPlanarSpawnLevel: () => owner._getPlanarSpawnLevel(),
                    findSpawnPosition: (minDistance = 12, margin = 12, planarLevel = null) => owner._findSpawnPosition(minDistance, margin, planarLevel),
                    findSafeSpawnDirection: (position, radius = 0.8) => owner._findSafeSpawnDirection(position, radius),
                },
                lifecycle: {
                    killPlayer: (player, cause = 'UNKNOWN', options = {}) => owner._killPlayer(player, cause, options),
                },
                trails: {
                    getTrailSpatialIndex: () => trailSpatialIndex,
                },
            },
            events: eventBus,
        });

        const playerInputSystem = new PlayerInputSystem(owner);
        const playerLifecycleSystem = new PlayerLifecycleSystem(owner);
        const overheatGunSystem = new OverheatGunSystem(owner, runtimeContext);
        const respawnSystem = new RespawnSystem(runtimeContext);
        const huntCombatSystem = new HuntCombatSystem(runtimeContext);
        const roundOutcomeSystem = new RoundOutcomeSystem({
            getHumanPlayers: () => owner.humanPlayers,
            getBots: () => owner.bots,
            getPendingHumanRespawns: (players) => owner._getPendingHumanRespawns(players),
        });

        return {
            _projectileSystem: projectileSystem,
            _huntScoring: huntScoring,
            _eventBus: eventBus,
            _tmpVec: tmpVec,
            _tmpVec2: tmpVec2,
            _tmpDir: tmpDir,
            _tmpDir2: tmpDir2,
            _tmpCamAnchor: tmpCamAnchor,
            _tmpCollisionNormal: tmpCollisionNormal,
            _tmpPrevPlayerPosition: tmpPrevPlayerPosition,
            _fallbackArenaCollision: fallbackArenaCollision,
            _lockOnCache: lockOnCache,
            _trailSpatialIndex: trailSpatialIndex,
            _spawnPlacementSystem: spawnPlacementSystem,
            _collisionResponseSystem: collisionResponseSystem,
            _runtimeContext: runtimeContext,
            _playerInputSystem: playerInputSystem,
            _playerLifecycleSystem: playerLifecycleSystem,
            _overheatGunSystem: overheatGunSystem,
            _respawnSystem: respawnSystem,
            _huntCombatSystem: huntCombatSystem,
            _roundOutcomeSystem: roundOutcomeSystem,
        };
    }
}

export function assembleEntityRuntime(entityManager) {
    return new EntityRuntimeAssembler(entityManager).assemble();
}
