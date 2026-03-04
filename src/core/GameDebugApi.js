import { BotValidationService } from '../state/validation/BotValidationService.js';

export class GameDebugApi {
    constructor(game) {
        this.game = game || null;
        this.validationService = new BotValidationService({
            getRecorder: () => this.game?.recorder || null,
        });
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
        const baseline = this.validationService.captureBaseline(label);
        const normalized = String(baseline?.label || label || 'BASELINE').toUpperCase();
        game._showStatusToast(`Bot-Baseline gespeichert: ${normalized}`);
        console.log(`[Validation] Baseline gespeichert (${normalized}):`, baseline);
        return baseline;
    }

    printBotValidationReport(label = 'BASELINE') {
        const report = this.validationService.buildValidationReport(label);
        console.log('[Validation] report:', report);
        return report;
    }

    getBotValidationMatrix() {
        return this.validationService.getValidationMatrix();
    }

    printBotTestProtocol() {
        const protocol = this.validationService.buildTestProtocol();
        console.log('[Validation] Bot-Testprotokoll:', protocol);
        return protocol;
    }

    applyBotValidationScenario(idOrIndex = 0) {
        const game = this.game;
        const scenario = this.validationService.applyScenario(game, idOrIndex);
        if (!scenario) return null;

        game._showStatusToast(`Szenario ${scenario.id} geladen`);
        console.log('[Validation] scenario loaded:', scenario);
        return scenario;
    }
}
