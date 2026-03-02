/**
 * ai_bridge.mjs - JavaScript integration for the Bot KI (Phase 2).
 * 
 * This bridge loads the exported ONNX model and provides a simple
 * interface for the game to query actions for a given state.
 */

import * as ort from 'https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/ort.min.js';
import { serializeState } from './state_serializer.mjs';

import { AiInterface } from './AiInterface.mjs';

export class AiBot extends AiInterface {
    constructor() {
        this.session = null;
        this.ready = false;
    }

    /**
     * Loads the ONNX model.
     * @param {string} modelUrl - Path to the rohre_ppo.onnx file.
     */
    async load(modelUrl) {
        try {
            this.session = await ort.InferenceSession.create(modelUrl);
            this.ready = true;
            console.log("[AiBot] Model loaded successfully.");
        } catch (e) {
            console.error("[AiBot] Failed to load model:", e);
        }
    }

    /**
     * Decides the next action based on the current game state.
     * @param {Object} player - The BOT player instance.
     * @param {Array} allPlayers - List of all players in the game.
     * @param {Object} arena - The arena/map instance.
     * @param {Array} projectiles - Active projectiles.
     * @param {Array} [powerups=[]] - Active powerup items on the map.
     * @param {number} gameTime - Current game time in seconds.
     * @param {Object} config - Global game config.
     * @returns {Array|null} - The action array [yaw, pitch, boost, item_use, item_shoot, shoot_idx].
     */
    async decide(player, allPlayers, arena, projectiles, powerups = [], gameTime, config) {
        if (!this.ready) return null;

        // 1. Get state observation (180 dims)
        const obs = serializeState(player, allPlayers, arena, projectiles, powerups, gameTime, config);
        
        // 2. Wrap as Tensor
        const inputTensor = new ort.Tensor('float32', new Float32Array(obs), [1, 180]);

        // 3. Run Inference
        const feeds = { input: inputTensor };
        const results = await this.session.run(feeds);
        const output = results.output.data; // Flat 21 logits

        // 4. Parse Multi-Discrete (Argmax per head)
        // HEADS: yaw(3), pitch(3), boost(2), item_use(6), item_shoot(2), shoot_idx(5)
        const dims = [3, 3, 2, 6, 2, 5];
        const actions = [];
        let offset = 0;

        for (const dim of dims) {
            const logits = output.slice(offset, offset + dim);
            const argmax = logits.indexOf(Math.max(...logits));
            actions.push(argmax);
            offset += dim;
        }

        return actions;
    }
}
