import * as THREE from 'three';
import { DemoInput } from './DemoInput.js';
import { DemoPlayer } from './DemoPlayer.js';
import { EnergyShardField } from './EnergyShardField.js';
import { ParticleSystem } from './Particles.js';
import { PowerupPrototypeManager } from './PowerupPrototypeManager.js';

// Post-processing
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import {
    ApexBrakeFieldPowerup,
    BlinkGatePowerup,
    BoostPortalPowerup,
    ChronoBubblePowerup,
    MagnetTunnelPowerup,
    ResonanceBeaconPowerup,
    SlingshotGatePowerup,
} from './powerups/index.js';

export class PowerupLabApp {
    constructor(canvas) {
        if (!(canvas instanceof HTMLCanvasElement)) {
            throw new Error('Canvas fehlt oder ist ungueltig.');
        }

        this.canvas = canvas;
        this.clock = new THREE.Clock();
        this.input = new DemoInput();
        this.eventEntries = [];
        this._running = false;
        this._raf = 0;

        this.renderer = new THREE.WebGLRenderer({
            canvas,
            antialias: true,
            alpha: false,
            powerPreference: 'high-performance',
        });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        this.renderer.setSize(window.innerWidth, window.innerHeight, false);
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.08;

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x050a12);
        this.scene.fog = new THREE.FogExp2(0x07121e, 0.0085);

        this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1600);
        this.camera.position.set(0, 7, 35);

        this._tmpVec = new THREE.Vector3();
        this._tmpVec2 = new THREE.Vector3();
        this._tmpUp = new THREE.Vector3();
        this._camTargetPos = new THREE.Vector3(0, 6, 35);
        this._camLookAt = new THREE.Vector3(0, 4, 0);

        this.powerupManager = new PowerupPrototypeManager();
        this._decorations = [];
        this._droneOrbits = [];
        this._elapsed = 0;
        this._worldTimeScale = 1;

        this.particleSystem = new ParticleSystem(this.scene);

        this._setupPostProcessing();

        this._bindHud();
        this._buildEnvironment();

        this.player = new DemoPlayer(this.scene);
        this.player.setParticleSystem(this.particleSystem);
        this.shards = new EnergyShardField(this.scene, {
            count: 28,
            bounds: {
                minX: -26,
                maxX: 26,
                minY: -12,
                maxY: 14,
                minZ: -380,
                maxZ: -20,
            },
        });

        this._spawnPowerupPrototypes();

        this._onResize = () => this._resize();
        window.addEventListener('resize', this._onResize);

        this._emitEvent('Powerup Lab bereit. Fliege durch die Gates.', 'cool');
    }

    start() {
        if (this._running) return;
        this._running = true;
        this.clock.start();
        this._loop();
    }

    stop() {
        this._running = false;
        if (this._raf) cancelAnimationFrame(this._raf);
        this._raf = 0;
    }

    dispose() {
        this.stop();
        window.removeEventListener('resize', this._onResize);
        this.input?.dispose?.();
        this.shards?.dispose?.();
        this.player?.dispose?.();
        this.powerupManager?.dispose?.();
        this.particleSystem?.dispose?.();
        this.composer?.dispose?.();
        this._disposeSceneObjects();
        this.renderer?.dispose?.();
    }

    _bindHud() {
        this.hud = {
            speed: document.getElementById('speedValue'),
            timeScale: document.getElementById('timeScaleValue'),
            energy: document.getElementById('energyValue'),
            position: document.getElementById('posValue'),
            effects: document.getElementById('effectsValue'),
            eventLog: document.getElementById('eventLog'),
        };
    }

    _setupPostProcessing() {
        const renderPass = new RenderPass(this.scene, this.camera);

        const bloomPass = new UnrealBloomPass(
            new THREE.Vector2(window.innerWidth, window.innerHeight),
            0.65,  // strength
            0.4,   // radius
            0.85   // threshold
        );

        const outputPass = new OutputPass();

        this.composer = new EffectComposer(this.renderer);
        this.composer.addPass(renderPass);
        this.composer.addPass(bloomPass);
        this.composer.addPass(outputPass);
    }

    _buildEnvironment() {
        const hemi = new THREE.HemisphereLight(0x8dd2ff, 0x101922, 0.8);
        this.scene.add(hemi);

        const dir = new THREE.DirectionalLight(0xffffff, 0.85);
        dir.position.set(16, 22, 12);
        this.scene.add(dir);

        const accentA = new THREE.PointLight(0xffb34d, 12, 120, 2);
        accentA.position.set(-18, 7, -75);
        this.scene.add(accentA);

        const accentB = new THREE.PointLight(0x5ce0ff, 10, 120, 2);
        accentB.position.set(20, -4, -170);
        this.scene.add(accentB);

        this._buildStars();
        this._buildFlightCorridor();
        this._buildDecorativeSpinners();
        this._buildOrbitDrones();
    }

    _buildStars() {
        const count = 1500;
        const positions = new Float32Array(count * 3);
        const colors = new Float32Array(count * 3);
        const color = new THREE.Color();

        for (let i = 0; i < count; i++) {
            const i3 = i * 3;
            positions[i3 + 0] = (Math.random() - 0.5) * 850;
            positions[i3 + 1] = (Math.random() - 0.5) * 420;
            positions[i3 + 2] = (Math.random() - 0.5) * 1200;

            color.setHSL(0.52 + Math.random() * 0.12, 0.7, 0.72 + Math.random() * 0.2);
            colors[i3 + 0] = color.r;
            colors[i3 + 1] = color.g;
            colors[i3 + 2] = color.b;
        }

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        const mat = new THREE.PointsMaterial({
            size: 0.9,
            vertexColors: true,
            transparent: true,
            opacity: 0.9,
            depthWrite: false,
            sizeAttenuation: true,
        });

        const stars = new THREE.Points(geo, mat);
        this.scene.add(stars);
        this._decorations.push(stars);
    }

    _buildFlightCorridor() {
        const lines = [];
        const minZ = -420;
        const maxZ = 30;
        const step = 12;
        const halfWidth = 22;
        const halfHeight = 12;

        for (let z = maxZ; z >= minZ; z -= step) {
            lines.push(-halfWidth, -halfHeight, z, halfWidth, -halfHeight, z);
            lines.push(-halfWidth, halfHeight, z, halfWidth, halfHeight, z);
            lines.push(-halfWidth, -halfHeight, z, -halfWidth, halfHeight, z);
            lines.push(halfWidth, -halfHeight, z, halfWidth, halfHeight, z);
        }

        for (let z = maxZ; z >= minZ + step; z -= step) {
            lines.push(-halfWidth, -halfHeight, z, -halfWidth, -halfHeight, z - step);
            lines.push(halfWidth, -halfHeight, z, halfWidth, -halfHeight, z - step);
            lines.push(-halfWidth, halfHeight, z, -halfWidth, halfHeight, z - step);
            lines.push(halfWidth, halfHeight, z, halfWidth, halfHeight, z - step);
        }

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(lines, 3));
        const mat = new THREE.LineBasicMaterial({
            color: 0x2f506d,
            transparent: true,
            opacity: 0.46,
        });
        const frame = new THREE.LineSegments(geo, mat);
        this.scene.add(frame);
        this._decorations.push(frame);

        const laneMat = new THREE.MeshBasicMaterial({
            color: 0x15324c,
            transparent: true,
            opacity: 0.14,
            side: THREE.DoubleSide,
        });
        for (let i = 0; i < 10; i++) {
            const panel = new THREE.Mesh(new THREE.PlaneGeometry(40, 8), laneMat);
            panel.position.set(0, -10.5, -20 - i * 40);
            panel.rotation.x = -Math.PI / 2;
            this.scene.add(panel);
            this._decorations.push(panel);
        }
    }

    _buildDecorativeSpinners() {
        const spinnerGeo = new THREE.TorusGeometry(1.8, 0.08, 8, 28);
        const spinnerMat = new THREE.MeshStandardMaterial({
            color: 0x64d8ff,
            emissive: 0x214d8a,
            emissiveIntensity: 0.35,
            roughness: 0.45,
            metalness: 0.5,
        });

        const positions = [
            [-15, 9, -60],
            [16, -6, -118],
            [-18, 8, -176],
            [14, 10, -236],
            [-12, -7, -306],
        ];

        for (let i = 0; i < positions.length; i++) {
            const mesh = new THREE.Mesh(spinnerGeo, spinnerMat);
            mesh.position.set(...positions[i]);
            mesh.rotation.x = i * 0.33;
            mesh.userData.spinSpeed = 0.6 + i * 0.18;
            this.scene.add(mesh);
            this._decorations.push(mesh);
        }
    }

    _buildOrbitDrones() {
        const droneMat = new THREE.MeshStandardMaterial({
            color: 0xffcf80,
            emissive: 0xff7e29,
            emissiveIntensity: 0.6,
            roughness: 0.35,
            metalness: 0.25,
        });

        for (let i = 0; i < 8; i++) {
            const drone = new THREE.Mesh(new THREE.SphereGeometry(0.45, 10, 10), droneMat);
            const orbit = {
                mesh: drone,
                center: new THREE.Vector3(
                    (i % 2 === 0 ? -1 : 1) * (8 + (i % 3) * 5),
                    -2 + (i % 4) * 3,
                    -50 - i * 45,
                ),
                radius: 1.4 + (i % 3) * 1.2,
                speed: 0.7 + (i % 5) * 0.18,
                phase: Math.random() * Math.PI * 2,
                verticalPhase: Math.random() * Math.PI * 2,
            };
            this.scene.add(drone);
            this._droneOrbits.push(orbit);
        }
    }

    _spawnPowerupPrototypes() {
        const gateDir = (yawDeg = 0, pitchDeg = 0) => {
            const dir = new THREE.Vector3(0, 0, -1);
            const euler = new THREE.Euler(
                THREE.MathUtils.degToRad(pitchDeg),
                THREE.MathUtils.degToRad(yawDeg),
                0,
                'YXZ',
            );
            return dir.applyEuler(euler).normalize();
        };

        this.powerupManager.add(new BoostPortalPowerup(this.scene, {
            position: new THREE.Vector3(0, 4, -40),
            direction: gateDir(0, 0),
        }));

        this.powerupManager.add(new SlingshotGatePowerup(this.scene, {
            position: new THREE.Vector3(10, 6, -92),
            direction: gateDir(-12, 3),
        }));

        this.powerupManager.add(new BlinkGatePowerup(this.scene, {
            position: new THREE.Vector3(2, 5, -122),
            direction: gateDir(4, 0),
        }));

        this.powerupManager.add(new MagnetTunnelPowerup(this.scene, {
            position: new THREE.Vector3(-12, 5, -148),
            direction: gateDir(10, -2),
        }));

        this.powerupManager.add(new ResonanceBeaconPowerup(this.scene, {
            position: new THREE.Vector3(13, 3, -176),
            radius: 3.2,
        }));

        this.powerupManager.add(new ChronoBubblePowerup(this.scene, {
            position: new THREE.Vector3(2, 4, -202),
            radius: 3.8,
        }));

        this.powerupManager.add(new ApexBrakeFieldPowerup(this.scene, {
            position: new THREE.Vector3(-10, 5, -228),
            direction: gateDir(18, 2),
        }));

        this.powerupManager.add(new BoostPortalPowerup(this.scene, {
            position: new THREE.Vector3(16, 9, -252),
            direction: gateDir(-18, -4),
            cooldown: 5.2,
        }));

        this.powerupManager.add(new BlinkGatePowerup(this.scene, {
            position: new THREE.Vector3(4, 4, -284),
            direction: gateDir(-8, 1),
            cooldown: 6.8,
        }));

        this.powerupManager.add(new SlingshotGatePowerup(this.scene, {
            position: new THREE.Vector3(-14, 3, -308),
            direction: gateDir(14, 4),
            cooldown: 5.5,
        }));

        this.powerupManager.add(new ResonanceBeaconPowerup(this.scene, {
            position: new THREE.Vector3(-1, 6, -346),
            radius: 2.8,
            cooldown: 9.0,
        }));

        this.powerupManager.add(new ApexBrakeFieldPowerup(this.scene, {
            position: new THREE.Vector3(12, 2, -382),
            direction: gateDir(-16, 0),
            cooldown: 7.8,
        }));
    }

    _loop = () => {
        if (!this._running) return;
        this._raf = requestAnimationFrame(this._loop);

        const dt = Math.min(this.clock.getDelta(), 0.05);
        this._elapsed += dt;

        if (this.input.consumePressed('KeyR')) {
            this._resetDemo();
        }

        this.player.update(dt, this.input, this._elapsed);
        this._worldTimeScale = this.player.getWorldTimeScale();

        const worldDt = dt * this._worldTimeScale;
        this._updateDecorations(worldDt);
        this.shards.update(worldDt, this._elapsed, this.player, this._worldTimeScale);

        this.particleSystem.update(worldDt);

        this.powerupManager.update(worldDt, this._elapsed, {
            player: this.player,
            scene: this.scene,
            worldTimeScale: this._worldTimeScale,
            emitEvent: (text, tone) => this._emitEvent(text, tone),
        });

        this._updateCamera(dt);
        this._updateHud();

        // Use composer instead of renderer.render
        if (this.composer) {
            this.composer.render();
        } else {
            this.renderer.render(this.scene, this.camera);
        }
    };

    _updateDecorations(worldDt) {
        for (let i = 0; i < this._decorations.length; i++) {
            const obj = this._decorations[i];
            if (obj.userData?.spinSpeed) {
                obj.rotation.z += worldDt * obj.userData.spinSpeed;
                obj.rotation.x += worldDt * (obj.userData.spinSpeed * 0.25);
            }
        }

        for (let i = 0; i < this._droneOrbits.length; i++) {
            const d = this._droneOrbits[i];
            d.phase += worldDt * d.speed;
            d.mesh.position.set(
                d.center.x + Math.cos(d.phase) * d.radius,
                d.center.y + Math.sin(d.phase * 1.7 + d.verticalPhase) * 1.2,
                d.center.z + Math.sin(d.phase * 0.65) * 4.5,
            );
            d.mesh.rotation.y += worldDt * 1.3;

            if (d.mesh.position.z > this.player.position.z + 40) {
                d.center.z = this.player.position.z - (120 + Math.random() * 160);
            }
        }
    }

    _updateCamera(dt) {
        const playerPos = this.player.position;
        const playerForward = this._tmpVec.copy(this.player.forward).normalize();
        const worldUp = this._tmpUp.set(0, 1, 0);

        this._camTargetPos.copy(playerPos)
            .addScaledVector(worldUp, 3.4)
            .addScaledVector(playerForward, -11.5);

        // Shake offset
        this._tmpVec2.set(0, 0, 0);
        this.player.getShakeOffset(this._tmpVec2);
        this._camTargetPos.add(this._tmpVec2);

        this.camera.position.lerp(this._camTargetPos, 1 - Math.exp(-4.8 * dt));

        this._camLookAt.copy(playerPos)
            .addScaledVector(playerForward, 8.5)
            .addScaledVector(worldUp, 0.4);

        this.camera.lookAt(this._camLookAt);

        // Dynamic FOV
        const speedRatio = THREE.MathUtils.clamp((this.player.velocity.length() - 20) / 100, 0, 1);
        const targetFov = 70 + speedRatio * 15;
        this.camera.fov += (targetFov - this.camera.fov) * (1 - Math.exp(-3 * dt));
        this.camera.updateProjectionMatrix();
    }

    _updateHud() {
        const state = this.player.getHudState();

        if (this.hud.speed) this.hud.speed.textContent = `${state.speed.toFixed(1)}`;
        if (this.hud.timeScale) this.hud.timeScale.textContent = `${state.worldTimeScale.toFixed(2)}x`;
        if (this.hud.energy) this.hud.energy.textContent = String(state.energy);
        if (this.hud.position) {
            this.hud.position.textContent = `${state.position.x.toFixed(1)} / ${state.position.y.toFixed(1)} / ${state.position.z.toFixed(1)}`;
        }
        if (this.hud.effects) {
            this._renderEffectBars(state.activeEffects);
        }
    }

    _renderEffectBars(activeEffects) {
        const container = this.hud.effects;
        if (!container) return;

        if (activeEffects.length === 0) {
            container.textContent = 'Keine';
            return;
        }

        container.innerHTML = '';
        activeEffects.forEach(effect => {
            const div = document.createElement('div');
            div.className = 'hud__timer';

            const label = document.createElement('div');
            label.textContent = `${effect.name} (${effect.timeLeft.toFixed(1)}s)`;
            div.appendChild(label);

            const bg = document.createElement('div');
            bg.className = 'hud__progress-bg';
            const fill = document.createElement('div');
            fill.className = 'hud__progress-fill';
            if (effect.type === 'warm') fill.classList.add('is-warm');
            if (effect.type === 'chrono') fill.classList.add('is-chrono');

            fill.style.width = `${(effect.timeLeft / effect.maxTime) * 100}%`;
            bg.appendChild(fill);
            div.appendChild(bg);

            container.appendChild(div);
        });
    }

    _emitEvent(text, tone = 'cool') {
        this.eventEntries.unshift({
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            text,
            tone,
        });
        if (this.eventEntries.length > 7) {
            this.eventEntries.length = 7;
        }
        this._renderEventLog();
    }

    _renderEventLog() {
        const list = this.hud.eventLog;
        if (!list) return;

        list.innerHTML = '';
        for (let i = 0; i < this.eventEntries.length; i++) {
            const entry = this.eventEntries[i];
            const li = document.createElement('li');
            li.textContent = entry.text;
            if (entry.tone === 'warm') li.classList.add('is-warm');
            if (entry.tone === 'danger') li.classList.add('is-danger');
            list.appendChild(li);
        }
    }

    _resetDemo() {
        this.player.reset();
        this._emitEvent('Demo-Reset ausgefuehrt', 'cool');
    }

    _resize() {
        const width = window.innerWidth;
        const height = window.innerHeight;
        this.renderer.setSize(width, height, false);
        this.composer?.setSize(width, height);
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
    }

    _disposeSceneObjects() {
        const disposable = [];
        this.scene.traverse((node) => {
            if (node.isMesh || node.isPoints || node.isLineSegments || node.isLine) {
                disposable.push(node);
            }
        });
        for (let i = 0; i < disposable.length; i++) {
            const node = disposable[i];
            if (node.geometry) node.geometry.dispose();
            if (node.material) {
                if (Array.isArray(node.material)) node.material.forEach((m) => m.dispose());
                else node.material.dispose();
            }
        }
    }
}
