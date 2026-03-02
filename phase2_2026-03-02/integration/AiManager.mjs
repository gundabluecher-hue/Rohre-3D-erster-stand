/**
 * AiManager.mjs - Die zentrale Instanz (Singleton).
 * Verwaltet geladene Modelle, Inferenz-Locks und Zuweisungen.
 */
export class AiManager {
    constructor() {
        this.models = new Map();             // Name -> AiInterface(AiBot)
        this.activeInferences = new Set();   // player(Entity) -> bool (Semaphore)
    }

    /**
     * Laedt ein Modell in den Speicher.
     * @param {string} name - Registrierter Name (z.B. 'ppo_v2')
     * @param {string} path - URL zur .onnx Datei
     * @param {class} BotClass - z.B. AiBot
     */
    async loadModel(name, path, BotClass) {
        const bot = new BotClass();
        await bot.load(path);
        if (bot.ready) {
            this.models.set(name, bot);
            console.log(`[AiManager] Modell '${name}' geladen.`);
        }
    }

    /**
     * Fragt die Aktion fuer einen bestimmten Spieler ab. Verhindert Inferenz-Stau (Frame-Drops).
     * @param {Object} player - Die Bot-Player Instanz
     * @param {string} modelName - Welches Modell genutzt werden soll
     * ...restliche Parameter laut AiInterface
     */
    async decideForPlayer(player, modelName, allPlayers, arena, projectiles, powerups, gameTime, config) {
        if (!this.models.has(modelName)) return null;
        
        // Verhindern, dass fuer denselben Bot mehrere Inferences gleichzeitig laufen
        if (this.activeInferences.has(player)) return null; 

        const bot = this.models.get(modelName);
        if (!bot.ready) return null;

        this.activeInferences.add(player);
        try {
            // Asynchroner Aufruf
            const actions = await bot.decide(player, allPlayers, arena, projectiles, powerups, gameTime, config);
            return actions;
        } catch(e) {
            console.error(`[AiManager] Fehler bei Inference fuer Modell ${modelName}:`, e);
            return null;
        } finally {
            this.activeInferences.delete(player);
        }
    }
}

// Singleton-Export (Drop-In-Ready)
export const aiManager = new AiManager();
