export class GameDebugApi {
    constructor(game) {
        this.game = game || null;
    }

    resolveRecorderFrameCaptureEnabledDefault() {
        try {
            const params = new URLSearchParams(window.location.search || '');
            const raw = params.get('recordframes') || params.get('recorderFrames');
            if (!raw) return false;
            const normalized = String(raw).trim().toLowerCase();
            return normalized === '1' || normalized === 'true' || normalized === 'on';
        } catch {
            return false;
        }
    }

    setRecorderFrameCaptureEnabled(enabled) {
        const game = this.game;
        game._recorderFrameCaptureEnabled = !!enabled;
        if (game.recorder?.setFrameCaptureEnabled) {
            game.recorder.setFrameCaptureEnabled(game._recorderFrameCaptureEnabled);
        }
    }

    captureBotBaseline(label = 'BASELINE') {
        const game = this.game;
        const normalized = String(label || 'BASELINE').toUpperCase();
        const baseline = game.recorder.captureBaseline(normalized);
        game._showStatusToast(`Bot-Baseline gespeichert: ${normalized}`);
        console.log(`[Recorder] Baseline gespeichert (${normalized}):`, baseline);
        return baseline;
    }

    printBotValidationReport(label = 'BASELINE') {
        const game = this.game;
        const normalized = String(label || 'BASELINE').toUpperCase();
        const aggregate = game.recorder.getAggregateMetrics();
        const comparison = game.recorder.compareWithBaseline(normalized);
        const matrix = game.recorder.getValidationMatrix();
        const report = {
            label: normalized,
            aggregate,
            comparison,
            matrix,
        };
        console.log('[Recorder] Validation report:', report);
        return report;
    }

    getBotValidationMatrix() {
        return this.game?.recorder?.getValidationMatrix?.() || [];
    }

    printBotTestProtocol() {
        const matrix = this.getBotValidationMatrix();
        const protocol = {
            steps: [
                '1) applyBotValidationScenario(0) und 10 Runden spielen.',
                '2) captureBotBaseline("BASELINE") ausfuehren.',
                '3) Weitere Szenarien aus der Matrix durchspielen.',
                '4) printBotValidationReport("BASELINE") fuer KPI-Vergleich ausfuehren.',
            ],
            matrix,
        };
        console.log('[Recorder] Bot-Testprotokoll:', protocol);
        return protocol;
    }

    applyBotValidationScenario(idOrIndex = 0) {
        const game = this.game;
        const matrix = this.getBotValidationMatrix();
        if (!matrix || matrix.length === 0) return null;

        let scenario = null;
        if (typeof idOrIndex === 'number') {
            scenario = matrix[Math.max(0, Math.min(matrix.length - 1, idOrIndex))];
        } else {
            scenario = matrix.find((s) => s.id === idOrIndex) || matrix[0];
        }
        if (!scenario) return null;

        game.settings.mode = scenario.mode === '2p' ? '2p' : '1p';
        game.settings.numBots = scenario.bots;
        game.settings.mapKey = scenario.mapKey;
        game.settings.gameplay.planarMode = !!scenario.planarMode;
        game.settings.gameplay.portalCount = scenario.portalCount;
        game.settings.portalsEnabled = scenario.portalCount > 0 || game.settings.portalsEnabled;
        game.settings.winsNeeded = Math.max(1, game.settings.winsNeeded);
        game._onSettingsChanged();

        game._showStatusToast(`Szenario ${scenario.id} geladen`);
        console.log('[Recorder] Validation scenario loaded:', scenario);
        return scenario;
    }
}
