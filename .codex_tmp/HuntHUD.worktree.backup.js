import { GAME_MODE_TYPES } from './HuntMode.js';
import { CONFIG } from '../core/Config.js';

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
        this.p1ShieldFill = document.getElementById('hunt-p1-shield-fill');
        this.p1ShieldText = document.getElementById('hunt-p1-shield-text');
        this.p1BoostFill = document.getElementById('hunt-p1-boost-fill');
        this.p1BoostText = document.getElementById('hunt-p1-boost-text');
        this.p1OverheatFill = document.getElementById('hunt-p1-overheat-fill');
        this.p1OverheatText = document.getElementById('hunt-p1-overheat-text');
        this.p2Panel = document.getElementById('hunt-p2-panel');
        this.p2HpFill = document.getElementById('hunt-p2-hp-fill');
        this.p2HpText = document.getElementById('hunt-p2-hp-text');
        this.p2ShieldFill = document.getElementById('hunt-p2-shield-fill');
        this.p2ShieldText = document.getElementById('hunt-p2-shield-text');
        this.p2BoostFill = document.getElementById('hunt-p2-boost-fill');
        this.p2BoostText = document.getElementById('hunt-p2-boost-text');
        this.p2OverheatFill = document.getElementById('hunt-p2-overheat-fill');
        this.p2OverheatText = document.getElementById('hunt-p2-overheat-text');
        this.killFeedList = document.getElementById('hunt-kill-feed-list');
        this._killFeedSlots = [];
        this._killFeedCachedTexts = new Array(5).fill('');
        this.damageIndicator = document.getElementById('hunt-damage-indicator');
        this._playerPanelTickTimer = 0;
        this._killFeedTickTimer = 0;
        this._indicatorTickTimer = 0;
        this._wasHuntActive = false;
    }

    _resolveUiHotpathInterval(key, fallback) {
        const configured = Number(this.game?.runtimeConfig?.uiHotpath?.[key]);
        if (Number.isFinite(configured) && configured > 0) {
            return configured;
        }
        return fallback;
    }

    _consumeTick(timerKey, dt, interval) {
        const elapsed = this[timerKey] + dt;
        if (elapsed < interval) {
            this[timerKey] = elapsed;
            return 0;
        }
        this[timerKey] = elapsed % interval;
        return elapsed;
    }

    _resetTickState() {
        this._playerPanelTickTimer = 0;
        this._killFeedTickTimer = 0;
        this._indicatorTickTimer = 0;
    }

    update(dt) {
        if (!this.root) return;

        const game = this.game;
        const huntActive = game.activeGameMode === GAME_MODE_TYPES.HUNT && game.state !== 'MENU';
        this.root.classList.toggle('hidden', !huntActive);
        if (!huntActive) {
            if (this._wasHuntActive) {
                this._resetTickState();
            }
            this._wasHuntActive = false;
            return;
        }

        const playerPanelInterval = this._resolveUiHotpathInterval('huntPlayerPanelInterval', 0.12);
        const killFeedInterval = this._resolveUiHotpathInterval('huntKillFeedInterval', 0.12);
        const indicatorInterval = this._resolveUiHotpathInterval('huntIndicatorInterval', 0.04);
        if (!this._wasHuntActive) {
            this._playerPanelTickTimer = playerPanelInterval;
            this._killFeedTickTimer = killFeedInterval;
            this._indicatorTickTimer = indicatorInterval;
            this._wasHuntActive = true;
        }

        if (this._consumeTick('_playerPanelTickTimer', dt, playerPanelInterval) > 0) {
            const humans = game.entityManager ? game.entityManager.getHumanPlayers() : [];
            this._updatePlayerPanel(humans[0], {
                hpFill: this.p1HpFill,
                hpText: this.p1HpText,
                shieldFill: this.p1ShieldFill,
                shieldText: this.p1ShieldText,
                boostFill: this.p1BoostFill,
                boostText: this.p1BoostText,
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
                        shieldFill: this.p2ShieldFill,
                        shieldText: this.p2ShieldText,
                        boostFill: this.p2BoostFill,
                        boostText: this.p2BoostText,
                        overheatFill: this.p2OverheatFill,
                        overheatText: this.p2OverheatText,
                    });
                }
            }
        }

        if (this._consumeTick('_killFeedTickTimer', dt, killFeedInterval) > 0) {
            this._updateKillFeed();
        }

        const indicatorElapsed = this._consumeTick('_indicatorTickTimer', dt, indicatorInterval);
        if (indicatorElapsed > 0) {
            this._updateDamageIndicator(indicatorElapsed);
        }
    }

    _updatePlayerPanel(player, refs) {
        const hp = Math.max(0, Number(player?.hp) || 0);
        const maxHp = Math.max(1, Number(player?.maxHp) || 1);
        const hpRatio = hp / maxHp;
        if (refs.hpFill) refs.hpFill.style.width = toPercent(hpRatio);
        if (refs.hpText) refs.hpText.textContent = `${Math.round(hp)} / ${Math.round(maxHp)}`;

        const shield = Math.max(0, Number(player?.shieldHP) || 0);
        const maxShield = Math.max(1, Number(player?.maxShieldHp) || 1);
        const shieldRatio = shield / maxShield;
        if (refs.shieldFill) refs.shieldFill.style.width = toPercent(shieldRatio);
        if (refs.shieldText) refs.shieldText.textContent = `${Math.round(shield)} / ${Math.round(maxShield)}`;

        const boostDuration = Math.max(0.001, Number(CONFIG?.PLAYER?.BOOST_DURATION) || 1);
        const boostCooldown = Math.max(0.001, Number(CONFIG?.PLAYER?.BOOST_COOLDOWN) || 1);
        let boostRatio = 1;
        let isBoostCooldown = false;
        if (player?.isBoosting) {
            boostRatio = clamp01((Number(player.boostTimer) || 0) / boostDuration);
        } else if ((Number(player?.boostCooldown) || 0) > 0) {
            boostRatio = clamp01(1 - ((Number(player.boostCooldown) || 0) / boostCooldown));
            isBoostCooldown = true;
        }
        if (refs.boostFill) {
            refs.boostFill.style.width = toPercent(boostRatio);
            refs.boostFill.classList.toggle('cooldown', isBoostCooldown);
        }
        if (refs.boostText) refs.boostText.textContent = `${Math.round(boostRatio * 100)}%`;

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
