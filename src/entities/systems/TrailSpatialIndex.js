// ============================================
// TrailSpatialIndex.js - trail grid registration and collision queries
// ============================================

import * as THREE from 'three';

function isTruthyFlag(value) {
    const raw = String(value || '').trim().toLowerCase();
    return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
}

function parsePositiveInt(value, fallback) {
    const parsed = Number.parseInt(String(value ?? ''), 10);
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
    return parsed;
}

function readTrailCollisionDebugConfigFromUrl() {
    if (typeof window === 'undefined' || !window.location) {
        return { enabled: false, maxLogs: 80 };
    }
    try {
        const params = new URLSearchParams(window.location.search);
        const enabled = isTruthyFlag(params.get('traildebug')) || isTruthyFlag(params.get('collisiondebug'));
        const maxLogs = parsePositiveInt(
            params.get('traildebugmax') ?? params.get('collisiondebugmax'),
            80
        );
        return { enabled, maxLogs };
    } catch {
        return { enabled: false, maxLogs: 80 };
    }
}

export class TrailSpatialIndex {
    constructor(options = {}) {
        this.getPlayers = typeof options.getPlayers === 'function'
            ? options.getPlayers
            : (() => options.players || []);
        this.gridSize = Number.isFinite(options.gridSize) && options.gridSize > 0 ? options.gridSize : 10;
        this.spatialGrid = new Map();
        this._keysBuffer = [];
        this._trailCollisionResult = { hit: false, playerIndex: -1 };
        this._tmpClosestPoint = new THREE.Vector3();
        this._projectileSeenEntries = new Set();

        const trailDebugConfig = options.debugConfig || readTrailCollisionDebugConfigFromUrl();
        this._trailCollisionDebugEnabled = !!trailDebugConfig.enabled;
        this._trailCollisionDebugLogCount = 0;
        this._trailCollisionDebugMaxLogs = parsePositiveInt(trailDebugConfig.maxLogs, 80);
        this._trailCollisionDebugSkipRecentSeen = 0;
        if (this._trailCollisionDebugEnabled) {
            console.info(`[TrailCollisionDebug] enabled via ?traildebug=1 (maxLogs=${this._trailCollisionDebugMaxLogs})`);
        }
    }

    _getGridKey(x, z) {
        const safeX = Number.isFinite(x) ? x : 0;
        const safeZ = Number.isFinite(z) ? z : 0;
        const cx = Math.floor(safeX / this.gridSize);
        const cz = Math.floor(safeZ / this.gridSize);
        return (cx + 1000) * 2000 + (cz + 1000);
    }

    _getSegmentGridKeys(data) {
        const fromX = Number(data?.fromX);
        const toX = Number(data?.toX);
        const fromZ = Number(data?.fromZ);
        const toZ = Number(data?.toZ);

        if (!Number.isFinite(fromX) || !Number.isFinite(toX) || !Number.isFinite(fromZ) || !Number.isFinite(toZ)) {
            this._keysBuffer.length = 0;
            this._keysBuffer.push(this._getGridKey(data?.midX, data?.midZ));
            return this._keysBuffer;
        }

        const radius = Math.max(0, Number(data?.radius) || 0);
        const minCellX = Math.floor((Math.min(fromX, toX) - radius) / this.gridSize);
        const maxCellX = Math.floor((Math.max(fromX, toX) + radius) / this.gridSize);
        const minCellZ = Math.floor((Math.min(fromZ, toZ) - radius) / this.gridSize);
        const maxCellZ = Math.floor((Math.max(fromZ, toZ) + radius) / this.gridSize);
        this._keysBuffer.length = 0;

        for (let cx = minCellX; cx <= maxCellX; cx++) {
            for (let cz = minCellZ; cz <= maxCellZ; cz++) {
                this._keysBuffer.push((cx + 1000) * 2000 + (cz + 1000));
            }
        }
        return this._keysBuffer;
    }

    _debugTrailCollision(tag, payload) {
        if (!this._trailCollisionDebugEnabled) return;
        if (this._trailCollisionDebugLogCount >= this._trailCollisionDebugMaxLogs) return;
        this._trailCollisionDebugLogCount++;
        console.debug(`[TrailCollisionDebug:${tag}]`, payload);
        if (this._trailCollisionDebugLogCount === this._trailCollisionDebugMaxLogs) {
            console.warn('[TrailCollisionDebug] log cap reached; suppressing further logs');
        }
    }

    _shouldLogSkipRecentCandidate(dist, skipRecent) {
        if (!this._trailCollisionDebugEnabled) return false;
        this._trailCollisionDebugSkipRecentSeen++;
        if (this._trailCollisionDebugSkipRecentSeen <= 8) return true;
        if (dist <= 1) return true;
        if (dist >= Math.max(0, skipRecent - 2)) return true;
        return (this._trailCollisionDebugSkipRecentSeen % 20) === 0;
    }

    _segmentIntersectsSphere(seg, position, radius) {
        const totalRadius = radius + seg.radius;
        const minX = Math.min(seg.fromX, seg.toX) - seg.radius;
        const maxX = Math.max(seg.fromX, seg.toX) + seg.radius;
        if (position.x < minX - radius || position.x > maxX + radius) return false;

        const minY = Math.min(seg.fromY, seg.toY) - seg.radius;
        const maxY = Math.max(seg.fromY, seg.toY) + seg.radius;
        if (position.y < minY - radius || position.y > maxY + radius) return false;

        const minZ = Math.min(seg.fromZ, seg.toZ) - seg.radius;
        const maxZ = Math.max(seg.fromZ, seg.toZ) + seg.radius;
        if (position.z < minZ - radius || position.z > maxZ + radius) return false;

        const vx = seg.toX - seg.fromX;
        const vy = seg.toY - seg.fromY;
        const vz = seg.toZ - seg.fromZ;
        const wx = position.x - seg.fromX;
        const wy = position.y - seg.fromY;
        const wz = position.z - seg.fromZ;

        const lenSq = vx * vx + vy * vy + vz * vz;
        let t = 0;
        if (lenSq > 0.000001) {
            t = Math.max(0, Math.min(1, (wx * vx + wy * vy + wz * vz) / lenSq));
        }

        const closestX = seg.fromX + t * vx;
        const closestY = seg.fromY + t * vy;
        const closestZ = seg.fromZ + t * vz;

        const dxp = position.x - closestX;
        const dyp = position.y - closestY;
        const dzp = position.z - closestZ;
        const distSq = dxp * dxp + dyp * dyp + dzp * dzp;
        if (distSq > totalRadius * totalRadius) {
            return null;
        }

        return { closestX, closestY, closestZ };
    }

    registerTrailSegment(playerIndex, segmentIdx, data, reusableRef = null) {
        const entry = reusableRef && reusableRef.entry ? reusableRef.entry : {};
        entry.playerIndex = playerIndex;
        entry.segmentIdx = segmentIdx;
        entry.fromX = data.fromX;
        entry.fromY = data.fromY;
        entry.fromZ = data.fromZ;
        entry.toX = data.toX;
        entry.toY = data.toY;
        entry.toZ = data.toZ;
        entry.radius = data.radius;
        entry.ownerTrail = data.ownerTrail || null;
        entry.maxHp = Math.max(1, Number(data.maxHp) || Number(data.hp) || 1);
        entry.hp = Math.max(0, Number(data.hp) || entry.maxHp);
        entry.destroyed = false;
        const keys = this._getSegmentGridKeys(data);

        const dx = (Number(data.toX) || 0) - (Number(data.fromX) || 0);
        const dy = (Number(data.toY) || 0) - (Number(data.fromY) || 0);
        const dz = (Number(data.toZ) || 0) - (Number(data.fromZ) || 0);
        const segmentLength = Math.sqrt(dx * dx + dy * dy + dz * dz);

        for (const key of keys) {
            if (!this.spatialGrid.has(key)) this.spatialGrid.set(key, new Set());
            this.spatialGrid.get(key).add(entry);
        }

        this._debugTrailCollision('register-segment', {
            playerIndex,
            segmentIdx,
            keyCount: keys.length,
            segmentLength,
            radius: Number(data?.radius) || 0,
        });

        let keyRef = keys.length === 1 ? keys[0] : null;
        if (keys.length > 1) {
            if (reusableRef && Array.isArray(reusableRef.key)) {
                const reusableKeys = reusableRef.key;
                reusableKeys.length = 0;
                for (let i = 0; i < keys.length; i++) {
                    reusableKeys.push(keys[i]);
                }
                keyRef = reusableKeys;
            } else {
                keyRef = keys.slice();
            }
        }

        if (reusableRef) {
            reusableRef.key = keyRef;
            reusableRef.entry = entry;
            entry._gridKeyRef = keyRef;
            return reusableRef;
        }

        entry._gridKeyRef = keyRef;
        return { key: keyRef, entry };
    }

    unregisterTrailSegment(key, entry) {
        if (Array.isArray(key)) {
            for (const singleKey of key) {
                this.unregisterTrailSegment(singleKey, entry);
            }
            return;
        }
        const cell = this.spatialGrid.get(key);
        if (cell) {
            cell.delete(entry);
            if (cell.size === 0) this.spatialGrid.delete(key);
        }
    }

    checkProjectileTrailCollision(position, radius, options = {}) {
        if (!position) return null;

        const excludePlayerIndex = Number.isInteger(options.excludePlayerIndex) ? options.excludePlayerIndex : -1;
        const skipRecent = Math.max(0, Number(options.skipRecent) || 0);
        const cellX = Math.floor(position.x / this.gridSize);
        const cellZ = Math.floor(position.z / this.gridSize);
        const players = this.getPlayers();
        const seenEntries = this._projectileSeenEntries;
        seenEntries.clear();

        for (let dx = -1; dx <= 1; dx++) {
            for (let dz = -1; dz <= 1; dz++) {
                const key = (cellX + dx + 1000) * 2000 + (cellZ + dz + 1000);
                const cell = this.spatialGrid.get(key);
                if (!cell) continue;

                for (const seg of cell) {
                    if (seenEntries.has(seg)) continue;
                    seenEntries.add(seg);
                    if (!seg || seg.destroyed) continue;

                    if (seg.playerIndex === excludePlayerIndex && skipRecent > 0) {
                        const player = players[seg.playerIndex];
                        const trail = player?.trail;
                        if (trail) {
                            const dist = (trail.writeIndex - 1 - seg.segmentIdx + trail.maxSegments) % trail.maxSegments;
                            if (dist < skipRecent) {
                                continue;
                            }
                        }
                    }

                    const hitInfo = this._segmentIntersectsSphere(seg, position, radius);
                    if (hitInfo) {
                        return {
                            entry: seg,
                            closestPoint: hitInfo,
                            cellKey: key,
                        };
                    }
                }
            }
        }

        return null;
    }

    damageTrailSegment(entry, damage = 1) {
        if (!entry || entry.destroyed) {
            return { hit: false, destroyed: false, remainingHp: 0, maxHp: 0 };
        }

        const maxHp = Math.max(1, Number(entry.maxHp) || 1);
        const currentHp = Number.isFinite(entry.hp) ? entry.hp : maxHp;
        const amount = Math.max(0, Number(damage) || 0);
        if (amount <= 0) {
            return {
                hit: true,
                destroyed: false,
                remainingHp: currentHp,
                maxHp,
            };
        }

        const nextHp = Math.max(0, currentHp - amount);
        entry.hp = nextHp;
        if (nextHp <= 0) {
            this.destroySegment(entry);
            return {
                hit: true,
                destroyed: true,
                remainingHp: 0,
                maxHp,
            };
        }

        return {
            hit: true,
            destroyed: false,
            remainingHp: nextHp,
            maxHp,
        };
    }

    destroySegment(entry) {
        if (!entry || entry.destroyed) return false;
        entry.destroyed = true;

        const keyRef = entry._gridKeyRef;
        if (keyRef !== null && keyRef !== undefined) {
            this.unregisterTrailSegment(keyRef, entry);
        } else {
            for (const cell of this.spatialGrid.values()) {
                cell.delete(entry);
            }
        }

        if (entry.ownerTrail && typeof entry.ownerTrail.destroySegmentByEntry === 'function') {
            entry.ownerTrail.destroySegmentByEntry(entry);
        }

        entry._gridKeyRef = null;
        entry.hp = 0;
        return true;
    }

    checkGlobalCollision(position, radius, excludePlayerIndex = -1, skipRecent = 0, playerRef = null) {
        const cellX = Math.floor(position.x / this.gridSize);
        const cellZ = Math.floor(position.z / this.gridSize);
        const players = this.getPlayers();

        for (let dx = -1; dx <= 1; dx++) {
            for (let dz = -1; dz <= 1; dz++) {
                const key = (cellX + dx + 1000) * 2000 + (cellZ + dz + 1000);
                const cell = this.spatialGrid.get(key);
                if (!cell) continue;

                for (const seg of cell) {
                    if (!seg || seg.destroyed) continue;
                    if (seg.playerIndex === excludePlayerIndex) {
                        const player = players[seg.playerIndex];
                        if (player && player.trail) {
                            const dist = (player.trail.writeIndex - 1 - seg.segmentIdx + player.trail.maxSegments) % player.trail.maxSegments;
                            if (dist < skipRecent) {
                                if (this._shouldLogSkipRecentCandidate(dist, skipRecent)) {
                                    this._debugTrailCollision('skip-recent', {
                                        playerIndex: seg.playerIndex,
                                        segmentIdx: seg.segmentIdx,
                                        dist,
                                        skipRecent,
                                        writeIndex: player.trail.writeIndex,
                                        maxSegments: player.trail.maxSegments,
                                        queryRadius: radius,
                                        cellX,
                                        cellZ,
                                    });
                                }
                                continue;
                            }
                        }
                    }

                    const hitInfo = this._segmentIntersectsSphere(seg, position, radius);
                    if (hitInfo) {
                        if (playerRef && playerRef.isSphereInOBB) {
                            this._tmpClosestPoint.set(hitInfo.closestX, hitInfo.closestY, hitInfo.closestZ);
                            if (playerRef.isSphereInOBB(this._tmpClosestPoint, seg.radius)) {
                                if (seg.playerIndex === excludePlayerIndex) {
                                    this._debugTrailCollision('self-hit', {
                                        playerIndex: seg.playerIndex,
                                        segmentIdx: seg.segmentIdx,
                                        skipRecent,
                                        queryRadius: radius,
                                        segmentRadius: seg.radius,
                                        cellX,
                                        cellZ,
                                    });
                                }
                                this._trailCollisionResult.hit = true;
                                this._trailCollisionResult.playerIndex = seg.playerIndex;
                                return this._trailCollisionResult;
                            }
                        } else {
                            if (seg.playerIndex === excludePlayerIndex) {
                                this._debugTrailCollision('self-hit', {
                                    playerIndex: seg.playerIndex,
                                    segmentIdx: seg.segmentIdx,
                                    skipRecent,
                                    queryRadius: radius,
                                    segmentRadius: seg.radius,
                                    cellX,
                                    cellZ,
                                });
                            }
                            this._trailCollisionResult.hit = true;
                            this._trailCollisionResult.playerIndex = seg.playerIndex;
                            return this._trailCollisionResult;
                        }
                    }
                }
            }
        }
        return null;
    }

    clear() {
        this.spatialGrid.clear();
    }
}
