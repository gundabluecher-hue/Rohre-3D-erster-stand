const FPS_TRACKER_WINDOW = 60;

function createFpsTracker(windowSize = FPS_TRACKER_WINDOW) {
    return {
        samples: new Float32Array(windowSize),
        writeIndex: 0,
        count: 0,
        sum: 0,
        avg: 60,
        update(dt) {
            if (!(dt > 0)) return;

            const fps = 1 / dt;
            if (this.count < windowSize) {
                this.samples[this.writeIndex] = fps;
                this.sum += fps;
                this.count++;
            } else {
                const previous = this.samples[this.writeIndex];
                this.samples[this.writeIndex] = fps;
                this.sum += fps - previous;
            }

            this.writeIndex = (this.writeIndex + 1) % windowSize;
            this.avg = this.count > 0 ? this.sum / this.count : 60;
        },
    };
}

export class RuntimeDiagnosticsSystem {
    constructor(game) {
        this.game = game;
        this._onKeyDown = (event) => this._handleKeyDown(event);

        game._adaptiveTimer = 0;
        game._statsTimer = 0;
        game.isLowQuality = false;
        game.stats = null;
        game._fpsTracker = createFpsTracker();

        window.addEventListener('keydown', this._onKeyDown);
    }

    _handleKeyDown(event) {
        const game = this.game;
        if (game.keyCapture) return;

        if (event.code === 'KeyP') {
            game.isLowQuality = !game.isLowQuality;
            const quality = game.isLowQuality ? 'LOW' : 'HIGH';
            game.renderer.setQuality(quality);
            game._showStatusToast(`Grafik: ${quality === 'LOW' ? 'Niedrig (Schnell)' : 'Hoch (Schoen)'}`);
            return;
        }

        if (event.code !== 'KeyO') return;

        if (!game.stats) {
            game.stats = document.createElement('div');
            game.stats.style.cssText = 'position:fixed;top:10px;left:10px;color:#0f0;font:13px/1.5 monospace;z-index:1000;pointer-events:none;background:rgba(0,0,0,0.6);padding:8px 12px;border-radius:6px;min-width:200px;white-space:pre-wrap;';
            document.body.appendChild(game.stats);
            game._statsTimer = 0;
        } else {
            game.stats.remove();
            game.stats = null;
        }
    }

    update(dt) {
        const game = this.game;
        game._fpsTracker.update(dt);

        if (game.stats) {
            game._statsTimer = (game._statsTimer || 0) + dt;
            if (game._statsTimer >= 0.25) {
                game._statsTimer = 0;
                const info = game.renderer.renderer.info;
                const fps = Math.round(game._fpsTracker.avg);
                const draws = info.render.calls || 0;
                const tris = info.render.triangles || 0;
                const geos = info.memory.geometries || 0;
                const texs = info.memory.textures || 0;
                const players = game.entityManager ? game.entityManager.players.filter((player) => player.alive).length : 0;
                const quality = game.isLowQuality ? 'LOW' : 'HIGH';
                game.stats.innerHTML =
                    `<b style="color:${fps < 30 ? '#f44' : fps < 50 ? '#fa0' : '#0f0'}">FPS: ${fps}</b>\n` +
                    `Draw Calls: ${draws}\n` +
                    `Dreiecke: ${(tris / 1000).toFixed(1)}k\n` +
                    `Geometrien: ${geos}\n` +
                    `Texturen: ${texs}\n` +
                    `Spieler: ${players}\n` +
                    `Qualitaet: ${quality}`;
            }
        }

        game._adaptiveTimer = (game._adaptiveTimer || 0) + dt;
        if (game._adaptiveTimer >= 3.0) {
            game._adaptiveTimer = 0;
            if (game._fpsTracker.avg < 30 && !game.isLowQuality && game.state === 'PLAYING') {
                game.isLowQuality = true;
                game.renderer.setQuality('LOW');
                game._showStatusToast('Grafik automatisch reduziert');
            }
        }
    }

    dispose() {
        window.removeEventListener('keydown', this._onKeyDown);
        if (this.game?.stats) {
            this.game.stats.remove();
            this.game.stats = null;
        }
    }
}
