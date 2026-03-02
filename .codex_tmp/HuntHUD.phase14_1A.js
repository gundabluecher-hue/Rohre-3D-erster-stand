import { GAME_MODE_TYPES } from './HuntMode.js';

function clamp01(value) {
    return Math.max(0, Math.min(1, Number(value) || 0));
}

function toPercent(value) {
    return `${(clamp01(value) * 100).toFixed(1)}%`;
}

export class HuntHUD {
    constructor(game) {
        this.game = game;
        this.root = document.getElementById('hunt-hud');
        this.p1HpFill = document.getElementById('hunt-p1-hp-fill');
        this.p1HpText = document.getElementById('hunt-p1-hp-text');
        this.p1OverheatFill = document.getElementById('hunt-p1-overheat-fill');
        this.p1OverheatText = document.getElementById('hunt-p1-overheat-text');
        this.p2Panel = document.getElementById('hunt-p2-panel');
        this.p2HpFill = document.getElementById('hunt-p2-hp-fill');
        this.p2HpText = document.getElementById('hunt-p2-hp-text');
        this.p2OverheatFill = document.getElementById('hunt-p2-overheat-fill');
        this.p2OverheatText = document.getElementById('hunt-p2-overheat-text');
        this.killFeedList = document.getElementById('hunt-kill-feed-list');
        this._killFeedSlots = [];
        this._killFeedCachedTexts = new Array(5).fill('');
        this.damageIndicator = document.getElementById('hunt-damage-indicator');
    }

    update(dt) {
        if (!this.root) return;

        const game = this.game;
        const huntActive = game.activeGameMode === GAME_MODE_TYPES.HUNT && game.state !== 'MENU';
        this.root.classList.toggle('hidden', !huntActive);
        if (!huntActive) return;

        const humans = game.entityManager ? game.entityManager.getHumanPlayers() : [];
        this._updatePlayerPanel(humans[0], {
            hpFill: this.p1HpFill,
            hpText: this.p1HpText,
            overheatFill: this.p1OverheatFill,
            overheatText: this.p1OverheatText,
        });
        if (this.p2Panel) {
            const p2Visible = humans.length > 1;
            this.p2Panel.classList.toggle('hidden', !p2Visible);
            if (p2Visible) {
                this._updatePlayerPanel(humans[1], {
                    hpFill: this.p2HpFill,
                    hpText: this.p2HpText,
                    overheatFill: this.p2OverheatFill,
                    overheatText: this.p2OverheatText,
                });
            }
        }

        this._updateKillFeed();
        this._updateDamageIndicator(dt);
    }

    _updatePlayerPanel(player, refs) {
        const hp = Math.max(0, Number(player?.hp) || 0);
        const maxHp = Math.max(1, Number(player?.maxHp) || 1);
        const hpRatio = hp / maxHp;
        if (refs.hpFill) refs.hpFill.style.width = toPercent(hpRatio);
        if (refs.hpText) refs.hpText.textContent = `${Math.round(hp)} / ${Math.round(maxHp)}`;

        const overheatValue = Number(this.game?.huntState?.overheatByPlayer?.[player?.index] || 0);
        const overheatRatio = clamp01(overheatValue / 100);
        if (refs.overheatFill) refs.overheatFill.style.width = toPercent(overheatRatio);
        if (refs.overheatText) refs.overheatText.textContent = `${Math.round(overheatValue)}%`;
    }

    _ensureKillFeedSlots() {
        if (!this.killFeedList || this._killFeedSlots.length > 0) return;
        this.killFeedList.textContent = '';
        for (let i = 0; i < 5; i++) {
            const slot = document.createElement('li');
            slot.hidden = true;
            this.killFeedList.appendChild(slot);
            this._killFeedSlots.push(slot);
        }
    }

    _updateKillFeed() {
        if (!this.killFeedList) return;
        this._ensureKillFeedSlots();

        const entries = Array.isArray(this.game?.huntState?.killFeed)
            ? this.game.huntState.killFeed
            : [];
        for (let i = 0; i < 5; i++) {
            const slot = this._killFeedSlots[i];
            const nextText = i < entries.length ? String(entries[i]) : '';
            if (this._killFeedCachedTexts[i] !== nextText) {
                slot.textContent = nextText;
                this._killFeedCachedTexts[i] = nextText;
            }

            const shouldHide = nextText === '';
            if (slot.hidden !== shouldHide) {
                slot.hidden = shouldHide;
            }
        }
    }

    _updateDamageIndicator(dt) {
        if (!this.damageIndicator) return;
        const indicator = this.game?.huntState?.damageIndicator;
        if (!indicator || indicator.ttl <= 0) {
            this.damageIndicator.classList.add('hidden');
            return;
        }

        indicator.ttl = Math.max(0, indicator.ttl - dt);
        if (indicator.ttl <= 0) {
            this.damageIndicator.classList.add('hidden');
            return;
        }

        const angle = Number(indicator.angleDeg) || 0;
        const intensity = clamp01(indicator.intensity || 0.6);
        this.damageIndicator.classList.remove('hidden');
        this.damageIndicator.style.opacity = String(Math.max(0.2, intensity));
        this.damageIndicator.style.transform = `translate(-50%, -50%) rotate(${angle.toFixed(1)}deg)`;
    }
}
