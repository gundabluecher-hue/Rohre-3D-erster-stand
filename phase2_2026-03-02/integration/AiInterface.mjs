/**
 * AiInterface.mjs - Basis-Klasse fuer alle KI-Modelle.
 * Definiert den Standard, wie ein Modell geladen und befragt wird.
 */
export class AiInterface {
    constructor() {
        this.ready = false;
        this.session = null;
    }

    async load(modelUrl) {
        console.warn("[AiInterface] load() nicht implementiert.");
    }

    async decide(player, allPlayers, arena, projectiles, powerups, gameTime, config) {
        console.warn("[AiInterface] decide() nicht implementiert.");
        return null; // Kein Aktion-Array
    }
}
