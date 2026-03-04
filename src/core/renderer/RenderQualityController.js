import * as THREE from 'three';
import { CONFIG } from '../Config.js';

export class RenderQualityController {
    constructor(renderer, scene) {
        this.renderer = renderer;
        this.scene = scene;
    }

    setQuality(quality) {
        if (quality === 'LOW') {
            this.renderer.shadowMap.enabled = false;
            this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 0.8));
            this.renderer.toneMapping = THREE.NoToneMapping;
            this.scene.fog.near = 30;
            this.scene.fog.far = 120;
        } else {
            this.renderer.shadowMap.enabled = true;
            this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, CONFIG.RENDER.MAX_PIXEL_RATIO));
            this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
            this.scene.fog.near = 50;
            this.scene.fog.far = 200;
        }

        this.scene.traverse((child) => {
            if (child.isMesh && child.material) {
                child.material.needsUpdate = true;
            }
        });
    }
}
