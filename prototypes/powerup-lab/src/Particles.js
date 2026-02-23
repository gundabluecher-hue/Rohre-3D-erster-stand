import * as THREE from 'three';

/**
 * A lightweight Particle System for the Powerup Lab.
 */
export class ParticleSystem {
    constructor(scene) {
        this.scene = scene;
        this.particles = [];
        this.maxParticles = 500;

        const geometry = new THREE.BufferGeometry();
        this.positions = new Float32Array(this.maxParticles * 3);
        this.colors = new Float32Array(this.maxParticles * 3);
        this.sizes = new Float32Array(this.maxParticles);

        geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
        geometry.setAttribute('size', new THREE.BufferAttribute(this.sizes, 1));

        const material = new THREE.PointsMaterial({
            size: 0.5,
            vertexColors: true,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            sizeAttenuation: true
        });

        this.points = new THREE.Points(geometry, material);
        this.scene.add(this.points);

        this._activeCount = 0;
    }

    emit(config = {}) {
        const count = config.count || 10;
        const position = config.position || new THREE.Vector3();
        const color = config.color || new THREE.Color(0xffffff);
        const velocity = config.velocity || new THREE.Vector3();
        const spread = config.spread || 0.5;
        const life = config.life || 1.0;
        const size = config.size || 0.5;

        for (let i = 0; i < count; i++) {
            if (this.particles.length >= this.maxParticles) {
                // Reuse oldest particle
                const p = this.particles.shift();
                this._initParticle(p, position, color, velocity, spread, life, size);
                this.particles.push(p);
            } else {
                const p = {};
                this._initParticle(p, position, color, velocity, spread, life, size);
                this.particles.push(p);
            }
        }
    }

    _initParticle(p, pos, col, vel, spread, life, size) {
        p.position = pos.clone().add(new THREE.Vector3(
            (Math.random() - 0.5) * spread,
            (Math.random() - 0.5) * spread,
            (Math.random() - 0.5) * spread
        ));
        p.velocity = vel.clone().add(new THREE.Vector3(
            (Math.random() - 0.5) * spread * 2,
            (Math.random() - 0.5) * spread * 2,
            (Math.random() - 0.5) * spread * 2
        ));
        p.color = col.clone();
        p.life = life + Math.random() * life * 0.5;
        p.maxLife = p.life;
        p.size = size * (0.8 + Math.random() * 0.4);
    }

    update(dt) {
        let aliveIdx = 0;
        for (let i = 0; i < this.particles.length; i++) {
            const p = this.particles[i];
            p.life -= dt;

            if (p.life > 0) {
                p.position.addScaledVector(p.velocity, dt);

                const i3 = aliveIdx * 3;
                this.positions[i3] = p.position.x;
                this.positions[i3 + 1] = p.position.y;
                this.positions[i3 + 2] = p.position.z;

                const alpha = Math.min(1, p.life / (p.maxLife * 0.3));
                this.colors[i3] = p.color.r * alpha;
                this.colors[i3 + 1] = p.color.g * alpha;
                this.colors[i3 + 2] = p.color.b * alpha;

                this.sizes[aliveIdx] = p.size * alpha;

                aliveIdx++;
            }
        }

        // Hide unused particles
        for (let i = aliveIdx; i < this.maxParticles; i++) {
            this.sizes[i] = 0;
        }

        this.points.geometry.attributes.position.needsUpdate = true;
        this.points.geometry.attributes.color.needsUpdate = true;
        this.points.geometry.attributes.size.needsUpdate = true;

        // Remove dead particles from the array (though we reuse them above, this helps state)
        this.particles = this.particles.filter(p => p.life > 0);
    }

    dispose() {
        this.scene.remove(this.points);
        this.points.geometry.dispose();
        this.points.material.dispose();
    }
}
