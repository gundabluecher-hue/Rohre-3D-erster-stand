import * as THREE from 'three';

export class DemoPlayer {
    constructor(scene) {
        this.scene = scene;
        this.group = new THREE.Group();
        this.scene.add(this.group);

        this.position = new THREE.Vector3();
        this.previousPosition = new THREE.Vector3();
        this.quaternion = new THREE.Quaternion();
        this.forward = new THREE.Vector3(0, 0, -1);
        this.velocity = new THREE.Vector3();
        this.impulseVelocity = new THREE.Vector3();

        this.baseCruiseSpeed = 24;
        this.speed = this.baseCruiseSpeed;
        this.maxCruiseSpeed = 120;
        this.energyCollected = 0;

        this.boostPortalTimer = 0;
        this.boostPortalBonusSpeed = 0;
        this.blinkTimer = 0;
        this.magnetTimer = 0;
        this.magnetRadius = 0;
        this.magnetStrength = 0;
        this.slingshotTimer = 0;
        this.slingshotAssistStrength = 0;
        this.slingshotTurnBonus = 1;
        this.resonanceTimer = 0;
        this.resonanceMultiplier = 1;
        this.apexTimer = 0;
        this.apexTurnBonus = 1;
        this.apexSpeedPenalty = 0;
        this.apexImpulseDampingMultiplier = 1;
        this.chronoTimer = 0;
        this.chronoWorldTimeScale = 1;
        this._slingshotDirection = new THREE.Vector3(0, 0, -1);

        this.particleSystem = null;

        this.shakeTimer = 0;
        this.shakeIntensity = 0;

        this._tmpQuat = new THREE.Quaternion();
        this._tmpQuat2 = new THREE.Quaternion();
        this._tmpVec = new THREE.Vector3();
        this._tmpVec2 = new THREE.Vector3();
        this._tmpDir = new THREE.Vector3();
        this._tmpDir2 = new THREE.Vector3();

        this._buildMesh();
        this.reset();
    }

    _buildMesh() {
        const hullMat = new THREE.MeshStandardMaterial({
            color: 0x9fe8ff,
            emissive: 0x1b6f8d,
            emissiveIntensity: 0.75,
            roughness: 0.35,
            metalness: 0.65,
        });
        const wingMat = new THREE.MeshStandardMaterial({
            color: 0xcee8ff,
            emissive: 0x224b73,
            emissiveIntensity: 0.5,
            roughness: 0.45,
            metalness: 0.35,
        });
        const glassMat = new THREE.MeshStandardMaterial({
            color: 0x87d4ff,
            emissive: 0x2ccfff,
            emissiveIntensity: 0.6,
            transparent: true,
            opacity: 0.9,
            roughness: 0.1,
            metalness: 0.15,
        });

        const body = new THREE.Mesh(new THREE.ConeGeometry(0.42, 2.3, 10), hullMat);
        body.rotation.x = Math.PI / 2;
        body.position.z = -0.2;
        this.group.add(body);

        const cockpit = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 10), glassMat);
        cockpit.scale.set(1.1, 0.75, 1.35);
        cockpit.position.set(0, 0.15, -0.35);
        this.group.add(cockpit);

        const wings = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.08, 0.7), wingMat);
        wings.position.set(0, -0.02, 0.15);
        this.group.add(wings);

        const fin = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.65, 0.55), wingMat);
        fin.position.set(0, 0.33, 0.38);
        this.group.add(fin);

        this.exhaust = new THREE.Mesh(
            new THREE.ConeGeometry(0.18, 0.9, 8),
            new THREE.MeshBasicMaterial({
                color: 0xffb34d,
                transparent: true,
                opacity: 0.85,
            }),
        );
        this.exhaust.rotation.x = -Math.PI / 2;
        this.exhaust.position.z = 0.95;
        this.group.add(this.exhaust);

        this.effectAura = new THREE.Mesh(
            new THREE.TorusGeometry(1.1, 0.03, 8, 32),
            new THREE.MeshBasicMaterial({
                color: 0x5ce0ff,
                transparent: true,
                opacity: 0,
            }),
        );
        this.effectAura.rotation.x = Math.PI / 2;
        this.group.add(this.effectAura);
    }

    reset() {
        this.position.set(0, 4, 22);
        this.previousPosition.copy(this.position);
        this.quaternion.identity();
        this.speed = this.baseCruiseSpeed;
        this.impulseVelocity.set(0, 0, 0);
        this.boostPortalTimer = 0;
        this.boostPortalBonusSpeed = 0;
        this.blinkTimer = 0;
        this.magnetTimer = 0;
        this.magnetRadius = 0;
        this.magnetStrength = 0;
        this.slingshotTimer = 0;
        this.slingshotAssistStrength = 0;
        this.slingshotTurnBonus = 1;
        this.resonanceTimer = 0;
        this.resonanceMultiplier = 1;
        this.apexTimer = 0;
        this.apexTurnBonus = 1;
        this.apexSpeedPenalty = 0;
        this.apexImpulseDampingMultiplier = 1;
        this.chronoTimer = 0;
        this.chronoWorldTimeScale = 1;
        this.energyCollected = 0;
        this._slingshotDirection.set(0, 0, -1);

        this.shakeTimer = 0;
        this.shakeIntensity = 0;

        this._syncTransform();
    }

    setParticleSystem(ps) {
        this.particleSystem = ps;
    }

    update(dt, input, time = 0) {
        this.previousPosition.copy(this.position);

        this.boostPortalTimer = Math.max(0, this.boostPortalTimer - dt);
        this.blinkTimer = Math.max(0, this.blinkTimer - dt);
        this.magnetTimer = Math.max(0, this.magnetTimer - dt);
        this.slingshotTimer = Math.max(0, this.slingshotTimer - dt);
        this.resonanceTimer = Math.max(0, this.resonanceTimer - dt);
        this.apexTimer = Math.max(0, this.apexTimer - dt);
        this.chronoTimer = Math.max(0, this.chronoTimer - dt);

        if (this.shakeTimer > 0) {
            this.shakeTimer -= dt;
            if (this.shakeTimer <= 0) this.shakeIntensity = 0;
        }

        if (this.slingshotTimer <= 0) {
            this.slingshotAssistStrength = 0;
            this.slingshotTurnBonus = 1;
        }
        if (this.magnetTimer <= 0) {
            this.magnetRadius = 0;
            this.magnetStrength = 0;
        }
        if (this.resonanceTimer <= 0) {
            this.resonanceMultiplier = 1;
        }
        if (this.apexTimer <= 0) {
            this.apexTurnBonus = 1;
            this.apexSpeedPenalty = 0;
            this.apexImpulseDampingMultiplier = 1;
        }
        if (this.chronoTimer <= 0) {
            this.chronoWorldTimeScale = 1;
        }

        const yawInput = input.getAxis(['KeyA', 'ArrowLeft'], ['KeyD', 'ArrowRight']);
        const pitchInput = input.getAxis(['KeyS', 'ArrowDown'], ['KeyW', 'ArrowUp']);
        const rollInput = input.getAxis(['KeyQ'], ['KeyE']);
        const manualBoost = input.isDown('Space');

        const turnMultiplier = (this.slingshotTurnBonus || 1) * (this.apexTurnBonus || 1);
        if (yawInput !== 0) {
            // Positive Y rotation turns left in Three.js, so invert the input sign.
            this._tmpQuat.setFromAxisAngle(this._tmpVec.set(0, 1, 0), -yawInput * 1.95 * turnMultiplier * dt);
            this.quaternion.multiply(this._tmpQuat);
        }
        if (pitchInput !== 0) {
            this._tmpQuat.setFromAxisAngle(this._tmpVec.set(1, 0, 0), pitchInput * 1.55 * turnMultiplier * dt);
            this.quaternion.multiply(this._tmpQuat);
        }
        if (rollInput !== 0) {
            this._tmpQuat.setFromAxisAngle(this._tmpVec.set(0, 0, -1), rollInput * 2.25 * dt);
            this.quaternion.multiply(this._tmpQuat);
        }

        if (this.slingshotTimer > 0 && this.slingshotAssistStrength > 0) {
            this._tmpDir.copy(this._getForward()).normalize();
            this._tmpDir2.copy(this._tmpDir)
                .lerp(this._slingshotDirection, Math.min(1, dt * this.slingshotAssistStrength))
                .normalize();
            this._tmpQuat2.setFromUnitVectors(this._tmpDir, this._tmpDir2);
            this.quaternion.premultiply(this._tmpQuat2);
        }

        this.quaternion.normalize();

        let targetSpeed = this.baseCruiseSpeed;
        if (manualBoost) targetSpeed += 12;
        if (this.boostPortalTimer > 0) targetSpeed += this.boostPortalBonusSpeed;
        if (this.slingshotTimer > 0) targetSpeed += 8;
        if (this.resonanceTimer > 0) targetSpeed += 3;
        if (this.apexTimer > 0) targetSpeed -= this.apexSpeedPenalty;
        if (this.chronoTimer > 0) targetSpeed += 5;
        targetSpeed = Math.min(this.maxCruiseSpeed, targetSpeed);
        targetSpeed = Math.max(8, targetSpeed);

        const response = 1 - Math.exp(-6.5 * dt);
        this.speed += (targetSpeed - this.speed) * response;

        let impulseDamping = this.slingshotTimer > 0 ? 0.9 : 1.8;
        impulseDamping *= this.apexImpulseDampingMultiplier || 1;
        this.impulseVelocity.multiplyScalar(Math.exp(-impulseDamping * dt));

        this._getForward(this.forward).normalize();
        this.velocity.copy(this.forward).multiplyScalar(this.speed).add(this.impulseVelocity);
        this.position.addScaledVector(this.velocity, dt);

        this._clampPlayableSpace();
        this._updateVisuals(time);
        this._syncTransform();
    }

    _clampPlayableSpace() {
        if (Math.abs(this.position.x) > 48) {
            this.position.x = THREE.MathUtils.clamp(this.position.x, -48, 48);
            this.impulseVelocity.x *= -0.35;
        }
        if (Math.abs(this.position.y) > 26) {
            this.position.y = THREE.MathUtils.clamp(this.position.y, -26, 26);
            this.impulseVelocity.y *= -0.35;
        }
    }

    _updateVisuals(time) {
        const baseScale = 0.65 + (this.speed / this.maxCruiseSpeed) * 0.9 + (this.boostPortalTimer > 0 ? 1.1 : 0);
        this.exhaust.scale.set(1, 1, baseScale);
        this.exhaust.material.opacity = 0.7 + Math.sin(time * 30) * 0.15 + (this.boostPortalTimer > 0 ? 0.15 : 0);
        this.exhaust.material.color.setHex(this.boostPortalTimer > 0 ? 0xfff18a : 0xffb34d);

        let auraOpacity = 0;
        let auraColor = 0x5ce0ff;
        let auraScale = 1;
        if (this.magnetTimer > 0) {
            auraOpacity = Math.max(auraOpacity, 0.28);
            auraColor = 0x59c8ff;
            auraScale = 1 + Math.sin(time * 6) * 0.08;
        }
        if (this.resonanceTimer > 0) {
            auraOpacity = Math.max(auraOpacity, 0.3);
            auraColor = 0x7affc4;
            auraScale = 1.06 + Math.sin(time * 8) * 0.07;
        }
        if (this.apexTimer > 0) {
            auraOpacity = Math.max(auraOpacity, 0.3);
            auraColor = 0xc6ff6b;
            auraScale = 1.02 + Math.sin(time * 5.4) * 0.04;
        }
        if (this.chronoTimer > 0) {
            auraOpacity = Math.max(auraOpacity, 0.35);
            auraColor = 0xb48dff;
            auraScale = 1.15 + Math.sin(time * 3.5) * 0.06;
        }
        if (this.boostPortalTimer > 0) {
            auraOpacity = Math.max(auraOpacity, 0.4);
            auraColor = 0xffb34d;
            auraScale = 1.1 + Math.sin(time * 10) * 0.05;
        }
        if (this.blinkTimer > 0) {
            auraOpacity = Math.max(auraOpacity, 0.48);
            auraColor = 0xffffff;
            auraScale = 1.2 + Math.sin(time * 16) * 0.1;
        }

        this.effectAura.material.opacity = auraOpacity;
        this.effectAura.material.color.setHex(auraColor);
        this.effectAura.scale.setScalar(auraScale);
        this.effectAura.rotation.z += 0.02;
    }

    _syncTransform() {
        this.group.position.copy(this.position);
        this.group.quaternion.copy(this.quaternion);
    }

    _getForward(out = null) {
        const target = out || this._tmpVec;
        return target.set(0, 0, -1).applyQuaternion(this.quaternion);
    }

    activateBoostPortal(config = {}, gateDirection = null) {
        const dir = this._resolveDirection(gateDirection);
        this.impulseVelocity.addScaledVector(dir, config.forwardImpulse ?? 40);
        this.boostPortalTimer = Math.max(this.boostPortalTimer, config.duration ?? 1.35);
        this.boostPortalBonusSpeed = Math.max(this.boostPortalBonusSpeed, config.bonusSpeed ?? 46);

        this.shake(0.4, 0.25);
        this._emitParticles(dir, 0xffb34d, 15);
    }

    activateBlink(config = {}, gateDirection = null) {
        const dir = this._resolveDirection(gateDirection);
        const distance = Math.max(6, config.distance ?? 24);
        const exitImpulse = Math.max(0, config.exitImpulse ?? 18);
        const lift = config.lift ?? 0;

        this.position.addScaledVector(dir, distance);
        if (lift !== 0) {
            this.position.addScaledVector(this._tmpVec2.set(0, 1, 0), lift);
        }
        if (exitImpulse > 0) {
            this.impulseVelocity.addScaledVector(dir, exitImpulse);
        }
        this._clampPlayableSpace();
        // Prevent accidental multi-gate trigger sweeps caused by the teleport jump.
        this.previousPosition.copy(this.position);
        this.blinkTimer = Math.max(this.blinkTimer, config.visualDuration ?? 0.9);
        this._syncTransform();

        this.shake(0.2, 0.4);
        this._emitParticles(dir, 0xffffff, 20);
    }

    activateSlingshot(config = {}, gateDirection = null, gateUp = null) {
        const dir = this._resolveDirection(gateDirection);
        const up = gateUp ? this._tmpVec2.copy(gateUp).normalize() : this._tmpVec2.set(0, 1, 0);
        this.impulseVelocity.addScaledVector(dir, config.forwardImpulse ?? 26);
        this.impulseVelocity.addScaledVector(up, config.liftImpulse ?? 6);
        this.slingshotTimer = Math.max(this.slingshotTimer, config.duration ?? 2.1);
        this.slingshotAssistStrength = Math.max(this.slingshotAssistStrength, config.assistStrength ?? 4.5);
        this.slingshotTurnBonus = Math.max(this.slingshotTurnBonus, config.turnBonus ?? 1.35);
        this._slingshotDirection.copy(dir);
    }

    activateMagnet(config = {}) {
        this.magnetTimer = Math.max(this.magnetTimer, config.duration ?? 8);
        this.magnetRadius = Math.max(this.magnetRadius, config.radius ?? 18);
        this.magnetStrength = Math.max(this.magnetStrength, config.strength ?? 48);
    }

    activateResonance(config = {}) {
        this.resonanceTimer = Math.max(this.resonanceTimer, config.duration ?? 7);
        this.resonanceMultiplier = Math.max(this.resonanceMultiplier, config.multiplier ?? 2);
    }

    activateApex(config = {}) {
        this.apexTimer = Math.max(this.apexTimer, config.duration ?? 3.2);
        this.apexTurnBonus = Math.max(this.apexTurnBonus, config.turnBonus ?? 1.6);
        this.apexSpeedPenalty = Math.max(this.apexSpeedPenalty, config.speedPenalty ?? 10);
        this.apexImpulseDampingMultiplier = Math.max(this.apexImpulseDampingMultiplier, config.impulseDampingMultiplier ?? 2.1);
    }

    activateChrono(config = {}) {
        this.chronoTimer = Math.max(this.chronoTimer, config.duration ?? 4.2);
        this.chronoWorldTimeScale = Math.min(this.chronoWorldTimeScale, config.worldTimeScale ?? 0.4);
    }

    addEnergy(amount = 1) {
        this.energyCollected += amount;
    }

    collectShard(baseAmount = 1) {
        const multiplier = this.resonanceTimer > 0 ? this.resonanceMultiplier : 1;
        const amount = Math.max(1, Math.round(baseAmount * multiplier));
        this.energyCollected += amount;
        return amount;
    }

    getWorldTimeScale() {
        return this.chronoTimer > 0 ? this.chronoWorldTimeScale : 1;
    }

    getMagnetState() {
        if (this.magnetTimer <= 0) return null;
        return { radius: this.magnetRadius, strength: this.magnetStrength, timeLeft: this.magnetTimer };
    }

    getHudState() {
        const activeEffects = [];
        const add = (name, timeLeft, maxTime, type) => {
            if (timeLeft > 0) activeEffects.push({ name, timeLeft, maxTime, type });
        };

        add('Boost Surge', this.boostPortalTimer, 1.6, 'warm');
        add('Blink Wake', this.blinkTimer, 0.9, 'cool');
        add('Slingshot Assist', this.slingshotTimer, 2.1, 'cool');
        add('Magnet Aura', this.magnetTimer, 8.0, 'cool');
        add('Resonance', this.resonanceTimer, 7.0, 'cool');
        add('Apex Handling', this.apexTimer, 3.2, 'cool');
        add('Chrono Shift', this.chronoTimer, 4.8, 'chrono');

        return {
            speed: this.velocity.length(),
            worldTimeScale: this.getWorldTimeScale(),
            energy: this.energyCollected,
            position: this.position,
            activeEffects,
        };
    }

        return this._getForward(this._tmpDir).normalize();
    }

shake(intensity, duration) {
    this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
    this.shakeTimer = Math.max(this.shakeTimer, duration);
}

getShakeOffset(out = new THREE.Vector3()) {
    if (this.shakeTimer <= 0) return out.set(0, 0, 0);
    const s = this.shakeIntensity * (this.shakeTimer / 0.5); // Fade out
    return out.set(
        (Math.random() - 0.5) * s,
        (Math.random() - 0.5) * s,
        (Math.random() - 0.5) * s
    );
}

_emitParticles(direction, colorHex, count) {
    if (!this.particleSystem) return;
    const col = new THREE.Color(colorHex);
    const vel = direction.clone().multiplyScalar(15);
    this.particleSystem.emit({
        count,
        position: this.position,
        velocity: vel,
        color: col,
        spread: 0.8,
        life: 0.8,
        size: 0.4
    });
}

_resolveDirection(direction) {
    if (direction && direction.lengthSq() > 0.0001) {
        return this._tmpDir.copy(direction).normalize();
    }
    return this._getForward(this._tmpDir).normalize();
}

dispose() {
    this.scene.remove(this.group);
    this.group.traverse((node) => {
        if (node.geometry) node.geometry.dispose();
        if (node.material) {
            if (Array.isArray(node.material)) node.material.forEach((m) => m.dispose());
            else node.material.dispose();
        }
    });
}
}
