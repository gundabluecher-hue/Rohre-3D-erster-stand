import * as THREE from 'three';

export class SpecialGateRuntime {
    constructor(arena) {
        this.arena = arena;
        this._tmpVecGate1 = new THREE.Vector3();
        this._tmpVecGate2 = new THREE.Vector3();
    }

    checkSpecialGates(position, previousPosition, radius, entityId) {
        if (!this.arena.specialGates || this.arena.specialGates.length === 0) return null;

        for (const gate of this.arena.specialGates) {
            if (gate.cooldowns.has(entityId) && gate.cooldowns.get(entityId) > 0) continue;

            const distSq = position.distanceToSquared(gate.pos);
            const checkDist = gate.radius + radius;
            if (distSq > checkDist * checkDist) continue;

            this._tmpVecGate1.subVectors(previousPosition, gate.pos);
            this._tmpVecGate2.subVectors(position, gate.pos);

            const dotPrev = this._tmpVecGate1.dot(gate.forward);
            const dotCurr = this._tmpVecGate2.dot(gate.forward);

            if (dotPrev <= 0 && dotCurr > 0) {
                const dynamicCooldown = gate.params.cooldown || 4.0;
                gate.cooldowns.set(entityId, dynamicCooldown);
                return { type: gate.type, forward: gate.forward, up: gate.up, params: gate.params };
            }
        }

        return null;
    }

    update(dt) {
        for (const gate of this.arena.specialGates) {
            for (const [id, t] of gate.cooldowns) {
                const newT = t - dt;
                if (newT <= 0) {
                    gate.cooldowns.delete(id);
                } else {
                    gate.cooldowns.set(id, newT);
                }
            }
        }

        const time = performance.now() * 0.001;
        for (const gate of this.arena.specialGates) {
            if (!gate.mesh) continue;
            const { spines, outerRing, innerDisk, frontRing, backRing } = gate.mesh.userData;
            if (spines) {
                for (let i = 0; i < spines.length; i++) {
                    spines[i].rotation.x = time * 2 + i * 0.5;
                }
            }
            if (outerRing) outerRing.rotation.z = time * 0.8;
            if (innerDisk) innerDisk.rotation.z = -time * 1.2;
            if (frontRing) frontRing.rotation.z = time * 0.6;
            if (backRing) backRing.rotation.z = -time * 0.9;
        }
    }
}
