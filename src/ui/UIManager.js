// ============================================
// UIManager.js - Handles DOM interactions, settings syncing and UI state
// ============================================

import { CONFIG } from '../core/Config.js';
import { VEHICLE_DEFINITIONS } from '../entities/vehicle-registry.js';
import { GAME_MODE_TYPES, resolveActiveGameMode } from '../hunt/HuntMode.js';
import { isSettingsChangeKey, normalizeSettingsChangeKeys } from './SettingsChangeKeys.js';
import { resolveSyncMethodNamesForChangeKeys } from './UISettingsSyncMap.js';
import { createMenuSchema } from './menu/MenuSchema.js';
import { MenuPanelRegistry } from './menu/MenuPanelRegistry.js';
import {
    evaluateMenuAccessPolicy,
    resolveDeveloperAccessPolicy,
    resolveMenuAccessContext,
} from './menu/MenuAccessPolicy.js';
import { ensureMenuContractState, LEVEL4_SECTION_IDS, MENU_SESSION_TYPES } from './menu/MenuStateContracts.js';
import { MenuNavigationRuntime } from './menu/MenuNavigationRuntime.js';
import { MenuStateMachine, MENU_STATE_IDS } from './menu/MenuStateMachine.js';
import { applyDeveloperThemeToDocument } from './menu/MenuDeveloperModeOps.js';
import {
    listMapPreviewEntries,
    listVehiclePreviewEntries,
    resolveMapPreview,
    resolveVehiclePreview,
} from './menu/MenuPreviewCatalog.js';
import { listMenuTextCatalogEntries } from './menu/MenuTextCatalog.js';
import { MenuTextRuntime } from './menu/MenuTextRuntime.js';

export class UIManager {
    constructor(game) {
        this.game = game;
        this.ui = game.ui;
        this.settings = game.settings;
        ensureMenuContractState(this.settings);

        this._navButtons = game._navButtons || [];
        this._menuButtonByPanel = game._menuButtonByPanel || new Map();
        this._lastMenuTrigger = game._lastMenuTrigger || null;
        this._submenuPanels = [];
        this._accessContext = resolveMenuAccessContext(this.settings);
        this.menuSchema = game.menuSchema && typeof game.menuSchema === 'object'
            ? game.menuSchema
            : createMenuSchema({ featureFlags: this.settings?.menuFeatureFlags });
        this.menuPanelRegistry = game.menuPanelRegistry instanceof MenuPanelRegistry
            ? game.menuPanelRegistry
            : new MenuPanelRegistry(this.menuSchema);
        this.menuStateMachine = game.menuStateMachine instanceof MenuStateMachine
            ? game.menuStateMachine
            : new MenuStateMachine({ initialState: MENU_STATE_IDS.MAIN });
        this.menuNavigationRuntime = null;
        this._mapPreviewEntries = listMapPreviewEntries();
        this._vehiclePreviewEntries = listVehiclePreviewEntries();
        this._startSetupDisposers = [];
        this._startValidationIssue = null;
        this._developerNavButtons = Array.from(document.querySelectorAll(
            '[data-submenu="submenu-developer"], [data-menu-target="submenu-developer"], [data-menu-step-target="submenu-developer"]'
        ));
        this._debugNavButtons = Array.from(document.querySelectorAll(
            '[data-submenu="submenu-debug"], [data-menu-target="submenu-debug"], [data-menu-step-target="submenu-debug"]'
        ));
        this._developerPanel = document.getElementById('submenu-developer');
        this._debugHintNodes = Array.isArray(this.ui.debugHints) ? this.ui.debugHints : [];
        this.menuTextRuntime = game.menuTextRuntime instanceof MenuTextRuntime
            ? game.menuTextRuntime
            : new MenuTextRuntime({ overrideStore: game.settingsManager?.menuTextOverrideStore });
        game.menuSchema = this.menuSchema;
        game.menuPanelRegistry = this.menuPanelRegistry;
        game.menuStateMachine = this.menuStateMachine;
        game.menuTextRuntime = this.menuTextRuntime;
    }

    init() {
        this._setupVehicleSelects();
        this._setupMapSelect();
        this._setupStartSetupControls();
        this._setupLevel4SectionControls();
        this._setupDeveloperTextCatalog();
        this._setupMenuNavigation();
        this.syncAll();
        this.updateContext();
    }

    _setupVehicleSelects() {
        const populate = (select) => {
            if (!select) return;
            select.innerHTML = '';
            VEHICLE_DEFINITIONS.forEach(v => {
                const opt = document.createElement('option');
                opt.value = v.id;
                opt.textContent = v.label;
                select.appendChild(opt);
            });
        };
        populate(this.ui.vehicleSelectP1);
        populate(this.ui.vehicleSelectP2);
    }

    _setupMapSelect() {
        const select = this.ui.mapSelect;
        if (!select) return;

        const currentValue = String(select.value || this.settings?.mapKey || 'standard');
        select.innerHTML = '';

        Object.entries(CONFIG.MAPS || {}).forEach(([key, mapDef]) => {
            const opt = document.createElement('option');
            opt.value = key;
            opt.textContent = String(mapDef?.name || key);
            select.appendChild(opt);
        });

        if (CONFIG.MAPS?.[currentValue]) {
            select.value = currentValue;
        } else if (CONFIG.MAPS?.standard) {
            select.value = 'standard';
        }
    }

    _ensureStartSetupLocalState(settings = this.game.settings) {
        if (!settings.localSettings || typeof settings.localSettings !== 'object') {
            settings.localSettings = {};
        }
        if (!settings.localSettings.startSetup || typeof settings.localSettings.startSetup !== 'object') {
            settings.localSettings.startSetup = {};
        }
        const startSetup = settings.localSettings.startSetup;
        if (!Array.isArray(startSetup.favoriteMaps)) startSetup.favoriteMaps = [];
        if (!Array.isArray(startSetup.recentMaps)) startSetup.recentMaps = [];
        if (!Array.isArray(startSetup.favoriteVehicles)) startSetup.favoriteVehicles = [];
        if (!Array.isArray(startSetup.recentVehicles)) startSetup.recentVehicles = [];
        if (typeof startSetup.mapSearch !== 'string') startSetup.mapSearch = '';
        if (typeof startSetup.mapFilter !== 'string') startSetup.mapFilter = 'all';
        if (typeof startSetup.vehicleSearch !== 'string') startSetup.vehicleSearch = '';
        if (typeof startSetup.vehicleFilter !== 'string') startSetup.vehicleFilter = 'all';
        return startSetup;
    }

    _toggleFavoriteEntry(list, value) {
        const normalizedValue = String(value || '').trim();
        if (!normalizedValue) return;
        const index = list.indexOf(normalizedValue);
        if (index >= 0) {
            list.splice(index, 1);
            return;
        }
        list.unshift(normalizedValue);
        if (list.length > 8) list.length = 8;
    }

    _pushRecentEntry(list, value) {
        const normalizedValue = String(value || '').trim();
        if (!normalizedValue) return;
        const filtered = list.filter((entry) => entry !== normalizedValue);
        filtered.unshift(normalizedValue);
        if (filtered.length > 6) filtered.length = 6;
        list.length = 0;
        list.push(...filtered);
    }

    _renderQuickList(container, items, dataKey) {
        if (!container) return;
        container.innerHTML = '';
        if (!Array.isArray(items) || items.length === 0) {
            const empty = document.createElement('span');
            empty.className = 'menu-hint';
            empty.textContent = 'keine';
            container.appendChild(empty);
            return;
        }
        items.forEach((value) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'secondary-btn quick-pill';
            button.textContent = String(value);
            button.dataset[dataKey] = String(value);
            container.appendChild(button);
        });
    }

    _humanizePreviewCategory(value) {
        const normalized = String(value || '').trim().toLowerCase();
        if (normalized === 'small') return 'Kompakt';
        if (normalized === 'medium') return 'Mittel';
        if (normalized === 'large') return 'Gross';
        if (normalized === 'light') return 'Leicht';
        if (normalized === 'heavy') return 'Schwer';
        return normalized ? normalized.charAt(0).toUpperCase() + normalized.slice(1) : 'Standard';
    }

    _renderSummaryBlocks(container, blocks) {
        if (!container) return;
        const normalizedBlocks = Array.isArray(blocks) ? blocks.filter(Boolean) : [];
        if (normalizedBlocks.length === 0) {
            container.textContent = 'Keine Auswahl vorhanden.';
            return;
        }
        container.innerHTML = normalizedBlocks.map((block) => {
            const label = String(block.label || '').trim();
            const value = String(block.value || '').trim();
            const toneClass = block.muted ? ' is-muted' : '';
            return `
                <div class="start-summary-block">
                    <span class="start-summary-label">${label}</span>
                    <span class="start-summary-value${toneClass}">${value}</span>
                </div>
            `;
        }).join('');
    }

    _renderPreviewCard(container, payload = {}) {
        if (!container) return;
        const title = String(payload.title || '').trim() || 'Vorschau';
        const badges = Array.isArray(payload.badges) ? payload.badges.filter(Boolean) : [];
        const facts = Array.isArray(payload.facts) ? payload.facts.filter(Boolean) : [];
        const badgesMarkup = badges.map((badge) => `<span class="preview-badge">${String(badge)}</span>`).join('');
        const factsMarkup = facts.map((fact) => `
            <div class="preview-kv">
                <span class="preview-kv-label">${String(fact.label || '')}</span>
                <span class="preview-kv-value">${String(fact.value || '')}</span>
            </div>
        `).join('');
        container.innerHTML = `
            <div class="preview-card-title">${title}</div>
            <div class="preview-card-meta">${badgesMarkup}</div>
            <div class="preview-kv-grid">${factsMarkup}</div>
        `;
    }

    _setStartSectionOpen(sectionId, shouldOpen = true) {
        const normalizedSectionId = String(sectionId || '').trim();
        if (!normalizedSectionId) return;
        const section = document.querySelector(`[data-start-section="${normalizedSectionId}"]`);
        if (!(section instanceof HTMLDetailsElement)) return;
        section.open = !!shouldOpen;
    }

    _resolveLevel4Section(sectionId, fallback = LEVEL4_SECTION_IDS.CONTROLS) {
        const normalizedSectionId = String(sectionId || '').trim();
        const validIds = Object.values(LEVEL4_SECTION_IDS);
        return validIds.includes(normalizedSectionId) ? normalizedSectionId : fallback;
    }

    _setupLevel4SectionControls() {
        if (!Array.isArray(this.ui.level4SectionTabs)) return;
        this.ui.level4SectionTabs.forEach((button) => {
            button.addEventListener('click', () => {
                const sectionId = this._resolveLevel4Section(button?.dataset?.level4SectionTarget);
                this.setLevel4Section(sectionId, { persist: true, focus: true });
            });
            button.addEventListener('keydown', (event) => {
                if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
                event.preventDefault();
                const tabs = this.ui.level4SectionTabs.filter(Boolean);
                const currentIndex = tabs.indexOf(button);
                if (currentIndex < 0 || tabs.length === 0) return;
                const delta = event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1;
                const nextIndex = (currentIndex + delta + tabs.length) % tabs.length;
                tabs[nextIndex]?.focus?.();
            });
        });
    }

    setLevel4Section(sectionId, options = {}) {
        const resolvedSectionId = this._resolveLevel4Section(sectionId);
        if (!this.settings?.localSettings?.toolsState || typeof this.settings.localSettings.toolsState !== 'object') {
            this.settings.localSettings.toolsState = {};
        }
        if (options.persist !== false) {
            this.settings.localSettings.toolsState.activeSection = resolvedSectionId;
        }
        this._syncLevel4SectionState(resolvedSectionId, options);
        if (this.settings.localSettings.toolsState.level4Open) {
            this.updateContext();
        }
    }

    _syncLevel4SectionState(sectionId, options = {}) {
        const resolvedSectionId = this._resolveLevel4Section(sectionId);
        const tabs = Array.isArray(this.ui.level4SectionTabs) ? this.ui.level4SectionTabs : [];
        const panels = Array.isArray(this.ui.level4SectionPanels) ? this.ui.level4SectionPanels : [];
        tabs.forEach((button) => {
            const isActive = this._resolveLevel4Section(button?.dataset?.level4SectionTarget, '') === resolvedSectionId;
            button.setAttribute('aria-selected', String(isActive));
            button.classList.toggle('active', isActive);
            button.tabIndex = isActive ? 0 : -1;
        });
        panels.forEach((panel) => {
            const panelSectionId = this._resolveLevel4Section(panel?.dataset?.level4Section, '');
            const isActive = panelSectionId === resolvedSectionId;
            panel.classList.toggle('is-active', isActive);
            panel.setAttribute('aria-hidden', String(!isActive));
        });
        if (options.focus) {
            const activePanel = panels.find((panel) => this._resolveLevel4Section(panel?.dataset?.level4Section, '') === resolvedSectionId);
            const focusTarget = activePanel?.querySelector('button, input, select, textarea, [tabindex]:not([tabindex="-1"])')
                || tabs.find((button) => this._resolveLevel4Section(button?.dataset?.level4SectionTarget, '') === resolvedSectionId);
            focusTarget?.focus?.();
        }
    }

    _syncMenuChromeState(panelId = this.game._activeSubmenu) {
        const root = this.ui.mainMenu;
        if (!root) return;
        const normalizedPanelId = String(panelId || '').trim();
        const level4Open = !!this.settings?.localSettings?.toolsState?.level4Open;
        let depth = 1;
        if (normalizedPanelId === 'submenu-custom') depth = 2;
        if (normalizedPanelId === 'submenu-game') depth = level4Open ? 4 : 3;
        if (normalizedPanelId === 'submenu-developer' || normalizedPanelId === 'submenu-debug') depth = 5;
        root.setAttribute('data-menu-depth', String(depth));
        root.setAttribute('data-menu-panel', normalizedPanelId || 'main');
        root.setAttribute('data-level4-open', String(level4Open));
    }

    _setupStartSetupControls() {
        const settings = this.game.settings;
        const startSetup = this._ensureStartSetupLocalState(settings);

        const mapSearchInput = this.ui.mapSearchInput;
        const mapFilterSelect = this.ui.mapFilterSelect;
        const vehicleSearchInput = this.ui.vehicleSearchInput;
        const vehicleFilterSelect = this.ui.vehicleFilterSelect;
        const mapFavoriteToggleButton = this.ui.mapFavoriteToggleButton;
        const vehicleFavoriteToggleButton = this.ui.vehicleFavoriteToggleButton;

        if (mapSearchInput) {
            mapSearchInput.value = startSetup.mapSearch;
            mapSearchInput.addEventListener('input', () => {
                startSetup.mapSearch = String(mapSearchInput.value || '');
                this.syncStartSetupState(settings);
            });
        }
        if (mapFilterSelect) {
            mapFilterSelect.value = startSetup.mapFilter;
            mapFilterSelect.addEventListener('change', () => {
                startSetup.mapFilter = String(mapFilterSelect.value || 'all');
                this.syncStartSetupState(settings);
            });
        }
        if (vehicleSearchInput) {
            vehicleSearchInput.value = startSetup.vehicleSearch;
            vehicleSearchInput.addEventListener('input', () => {
                startSetup.vehicleSearch = String(vehicleSearchInput.value || '');
                this.syncStartSetupState(settings);
            });
        }
        if (vehicleFilterSelect) {
            vehicleFilterSelect.value = startSetup.vehicleFilter;
            vehicleFilterSelect.addEventListener('change', () => {
                startSetup.vehicleFilter = String(vehicleFilterSelect.value || 'all');
                this.syncStartSetupState(settings);
            });
        }

        if (this.ui.mapSelect) {
            this.ui.mapSelect.addEventListener('change', () => {
                this._pushRecentEntry(startSetup.recentMaps, this.ui.mapSelect.value);
                this.syncStartSetupState(settings);
            });
        }
        if (this.ui.vehicleSelectP1) {
            this.ui.vehicleSelectP1.addEventListener('change', () => {
                this._pushRecentEntry(startSetup.recentVehicles, this.ui.vehicleSelectP1.value);
                this.syncStartSetupState(settings);
            });
        }
        if (this.ui.vehicleSelectP2) {
            this.ui.vehicleSelectP2.addEventListener('change', () => {
                this._pushRecentEntry(startSetup.recentVehicles, this.ui.vehicleSelectP2.value);
                this.syncStartSetupState(settings);
            });
        }

        if (mapFavoriteToggleButton) {
            mapFavoriteToggleButton.addEventListener('click', () => {
                this._toggleFavoriteEntry(startSetup.favoriteMaps, this.ui.mapSelect?.value);
                this.syncStartSetupState(settings);
            });
        }
        if (vehicleFavoriteToggleButton) {
            vehicleFavoriteToggleButton.addEventListener('click', () => {
                this._toggleFavoriteEntry(startSetup.favoriteVehicles, this.ui.vehicleSelectP1?.value);
                this.syncStartSetupState(settings);
            });
        }

        if (this.ui.mapFavoritesList) {
            this.ui.mapFavoritesList.addEventListener('click', (event) => {
                const button = event.target.closest('button[data-map-key]');
                if (!button || !this.ui.mapSelect) return;
                this.ui.mapSelect.value = button.dataset.mapKey;
                this.ui.mapSelect.dispatchEvent(new Event('change', { bubbles: true }));
            });
        }
        if (this.ui.mapRecentList) {
            this.ui.mapRecentList.addEventListener('click', (event) => {
                const button = event.target.closest('button[data-map-key]');
                if (!button || !this.ui.mapSelect) return;
                this.ui.mapSelect.value = button.dataset.mapKey;
                this.ui.mapSelect.dispatchEvent(new Event('change', { bubbles: true }));
            });
        }
        if (this.ui.vehicleFavoritesList) {
            this.ui.vehicleFavoritesList.addEventListener('click', (event) => {
                const button = event.target.closest('button[data-vehicle-id]');
                if (!button || !this.ui.vehicleSelectP1) return;
                this.ui.vehicleSelectP1.value = button.dataset.vehicleId;
                this.ui.vehicleSelectP1.dispatchEvent(new Event('change', { bubbles: true }));
            });
        }
        if (this.ui.vehicleRecentList) {
            this.ui.vehicleRecentList.addEventListener('click', (event) => {
                const button = event.target.closest('button[data-vehicle-id]');
                if (!button || !this.ui.vehicleSelectP1) return;
                this.ui.vehicleSelectP1.value = button.dataset.vehicleId;
                this.ui.vehicleSelectP1.dispatchEvent(new Event('change', { bubbles: true }));
            });
        }
    }

    _getStartFieldBinding(fieldKey) {
        const dimensionModeButton = Array.isArray(this.ui.dimensionModeButtons) ? this.ui.dimensionModeButtons[0] : null;
        const gameModeButton = Array.isArray(this.ui.gameModeButtons) ? this.ui.gameModeButtons[0] : null;
        const bindings = {
            map: { control: this.ui.mapSelect, hint: this.ui.mapFieldHint, sectionId: 'map' },
            vehicleP1: { control: this.ui.vehicleSelectP1, hint: this.ui.vehicleP1FieldHint, sectionId: 'vehicle' },
            vehicleP2: { control: this.ui.vehicleSelectP2, hint: this.ui.vehicleP2FieldHint, sectionId: 'vehicle' },
            theme: { control: this.ui.themeModeSelect, hint: this.ui.themeFieldHint, sectionId: 'match' },
            match: { control: dimensionModeButton || gameModeButton || this.ui.huntRespawnToggle, hint: this.ui.matchFieldHint, sectionId: 'match' },
            multiplayer: { control: this.ui.multiplayerLobbyCodeInput, hint: this.ui.matchFieldHint, sectionId: 'multiplayer' },
        };
        return bindings[fieldKey] || { control: null, hint: null, sectionId: '' };
    }

    _setFieldHint(hintElement, message, tone = 'info') {
        if (!hintElement) return;
        const normalizedMessage = String(message || '').trim();
        const normalizedTone = tone === 'error' ? 'error' : (tone === 'lock' ? 'lock' : 'info');
        hintElement.textContent = normalizedMessage;
        hintElement.classList.remove('hidden', 'is-error', 'is-lock');
        hintElement.classList.toggle('hidden', !normalizedMessage);
        hintElement.classList.toggle('is-error', !!normalizedMessage && normalizedTone === 'error');
        hintElement.classList.toggle('is-lock', !!normalizedMessage && normalizedTone === 'lock');
    }

    _clearFieldHints() {
        ['map', 'vehicleP1', 'vehicleP2', 'theme', 'match', 'multiplayer'].forEach((fieldKey) => {
            const binding = this._getStartFieldBinding(fieldKey);
            if (binding.control) binding.control.classList.remove('menu-field-error');
            if (binding.hint) this._setFieldHint(binding.hint, '', 'info');
        });
        if (this.ui.startValidationStatus) {
            this._setFieldHint(this.ui.startValidationStatus, '', 'info');
        }
    }

    _resolveLockedFieldHints(settings = this.game.settings) {
        const lockHints = new Map();
        const activePresetId = String(settings?.matchSettings?.activePresetId || '').trim();
        const activePresetKind = String(settings?.matchSettings?.activePresetKind || '').trim();
        if (!activePresetId || activePresetKind !== 'fixed') return lockHints;

        const presets = this.game.settingsManager?.listMenuPresets?.() || [];
        const activePreset = presets.find((preset) => String(preset?.id || '').trim() === activePresetId);
        const lockedFields = Array.isArray(activePreset?.metadata?.lockedFields) ? activePreset.metadata.lockedFields : [];
        if (lockedFields.length === 0) return lockHints;

        const lockMessagesByField = {
            map: [],
            vehicleP1: [],
            vehicleP2: [],
            match: [],
        };
        lockedFields.forEach((fieldPath) => {
            const normalizedPath = String(fieldPath || '').trim();
            if (!normalizedPath) return;
            if (normalizedPath === 'mapKey') {
                lockMessagesByField.map.push('Map');
                return;
            }
            if (normalizedPath === 'vehicles.PLAYER_1') {
                lockMessagesByField.vehicleP1.push('Flugzeug P1');
                return;
            }
            if (normalizedPath === 'vehicles.PLAYER_2') {
                lockMessagesByField.vehicleP2.push('Flugzeug P2');
                return;
            }
            lockMessagesByField.match.push(normalizedPath);
        });

        Object.entries(lockMessagesByField).forEach(([fieldKey, labels]) => {
            if (!Array.isArray(labels) || labels.length === 0) return;
            const uniqueLabels = Array.from(new Set(labels));
            lockHints.set(fieldKey, `Verbindliches Preset aktiv: ${uniqueLabels.join(', ')}`);
        });
        return lockHints;
    }

    _renderStartFieldHints(settings = this.game.settings, options = {}) {
        this._clearFieldHints();
        const lockHints = this._resolveLockedFieldHints(settings);
        lockHints.forEach((message, fieldKey) => {
            const binding = this._getStartFieldBinding(fieldKey);
            if (binding.hint) {
                this._setFieldHint(binding.hint, message, 'lock');
            }
        });

        const issue = this._startValidationIssue;
        if (!issue) return;

        const summaryMessage = String(issue.message || '').trim();
        if (this.ui.startValidationStatus) {
            this._setFieldHint(this.ui.startValidationStatus, summaryMessage, 'error');
        }

        const fieldKey = String(issue.fieldKey || '').trim();
        if (!fieldKey) return;
        const binding = this._getStartFieldBinding(fieldKey);
        if (binding.hint) {
            this._setFieldHint(binding.hint, String(issue.fieldMessage || issue.message || ''), 'error');
        }
        if (binding.control) {
            if (binding.sectionId) {
                this._setStartSectionOpen(binding.sectionId, true);
            }
            binding.control.classList.add('menu-field-error');
            if (options.focusField) {
                binding.control.focus();
            }
        }
    }

    showStartValidationError(issue, options = {}) {
        const normalizedIssue = issue && typeof issue === 'object' ? issue : {};
        this._startValidationIssue = {
            message: String(normalizedIssue.message || 'Start nicht moeglich.').trim(),
            fieldKey: String(normalizedIssue.fieldKey || '').trim(),
            fieldMessage: String(normalizedIssue.fieldMessage || '').trim(),
        };
        this._renderStartFieldHints(this.game.settings, {
            focusField: options.focusField !== false,
        });
    }

    clearStartValidationError() {
        if (!this._startValidationIssue) return;
        this._startValidationIssue = null;
        this._renderStartFieldHints(this.game.settings);
    }

    _setupDeveloperTextCatalog() {
        const select = this.ui.developerTextIdSelect;
        if (!select) return;

        const entries = listMenuTextCatalogEntries().sort((left, right) => left.id.localeCompare(right.id, 'de'));
        const previousValue = String(select.value || '');
        select.innerHTML = '';

        const placeholderOption = document.createElement('option');
        placeholderOption.value = '';
        placeholderOption.textContent = 'Bitte Text-ID waehlen';
        select.appendChild(placeholderOption);

        entries.forEach((entry) => {
            const option = document.createElement('option');
            option.value = entry.id;
            option.textContent = `${entry.id} -> ${entry.text}`;
            select.appendChild(option);
        });

        const hasPreviousValue = entries.some((entry) => entry.id === previousValue);
        if (hasPreviousValue) {
            select.value = previousValue;
        }
        select.addEventListener('change', () => {
            const selectedTextId = String(select.value || '').trim();
            if (!this.ui.developerTextOverrideInput) return;
            const overrideValue = this.game.settingsManager?.menuTextOverrideStore?.getOverride?.(selectedTextId) || '';
            this.ui.developerTextOverrideInput.value = overrideValue;
        });
    }

    _setupMenuNavigation() {
        this._navButtons = Array.isArray(this.ui.menuNavButtons) && this.ui.menuNavButtons.length > 0
            ? this.ui.menuNavButtons
            : Array.from(document.querySelectorAll('.nav-btn'));
        this._submenuPanels = Array.isArray(this.ui.menuPanels) && this.ui.menuPanels.length > 0
            ? this.ui.menuPanels
            : Array.from(document.querySelectorAll('.submenu-panel'));

        this._menuButtonByPanel.clear();
        this._navButtons.forEach(btn => {
            const rawTargetId = btn.dataset.submenu || btn.dataset.menuTarget;
            const targetId = this.menuPanelRegistry.resolvePanelId(rawTargetId) || rawTargetId;
            if (targetId) this._menuButtonByPanel.set(targetId, btn);
        });

        if (this.menuNavigationRuntime?.dispose) {
            this.menuNavigationRuntime.dispose();
        }

        this.menuNavigationRuntime = new MenuNavigationRuntime({
            ui: this.ui,
            panelRegistry: this.menuPanelRegistry,
            stateMachine: this.menuStateMachine,
            accessContext: this._accessContext,
            onLevel4CloseRequested: () => this.setLevel4Open(false),
            onPanelChanged: (panelId, _panelConfig, _transition, transitionMetadata) => {
                const previousPanelId = this.game._activeSubmenu || null;
                this.game._activeSubmenu = panelId || null;
                if (panelId !== 'submenu-game' && this.settings?.localSettings?.toolsState?.level4Open) {
                    this.settings.localSettings.toolsState.level4Open = false;
                    this.setLevel4Open(false);
                }
                this.game.runtimeFacade?.handleMenuPanelChanged?.(previousPanelId, panelId || null, transitionMetadata || null);
                this._syncMenuChromeState(panelId || null);
                this.updateContext();
            },
            onMenuStateChanged: (transition) => {
                this.game._menuState = this.menuStateMachine.getState();
                this.game._menuTransition = transition || null;
            },
        });
        this.menuNavigationRuntime.init();
        this._syncMenuChromeState(this.game._activeSubmenu || null);
    }

    showMainNav() {
        if (this.menuNavigationRuntime) {
            this.menuNavigationRuntime.showMainNav({ trigger: 'ui_manager' });
            this.setLevel4Open(false);
            return;
        }
        const submenus = this._submenuPanels.length > 0
            ? this._submenuPanels
            : Array.from(document.querySelectorAll('.submenu-panel'));
        submenus.forEach(p => p.classList.add('hidden'));
        this._navButtons.forEach(b => b.classList.remove('active'));
        this.game._activeSubmenu = null;
        this.setLevel4Open(false);
        this.updateContext();
    }

    setLevel4Open(isOpen) {
        const drawer = this.ui.level4Drawer;
        if (!drawer) return;
        const open = !!isOpen;
        if (!this.settings?.localSettings?.toolsState || typeof this.settings.localSettings.toolsState !== 'object') {
            this.settings.localSettings.toolsState = {};
        }
        this.settings.localSettings.toolsState.level4Open = open;
        drawer.classList.toggle('hidden', !open);
        drawer.setAttribute('aria-hidden', String(!open));
        const activeSection = this._resolveLevel4Section(
            this.settings?.localSettings?.toolsState?.activeSection,
            LEVEL4_SECTION_IDS.CONTROLS
        );
        this._syncLevel4SectionState(activeSection, { focus: false });
        this._syncMenuChromeState(this.game._activeSubmenu || null);
        if (open) {
            const activePanel = Array.isArray(this.ui.level4SectionPanels)
                ? this.ui.level4SectionPanels.find((panel) => this._resolveLevel4Section(panel?.dataset?.level4Section, '') === activeSection)
                : null;
            const firstFocusable = activePanel?.querySelector('button, input, select, textarea, [tabindex]:not([tabindex="-1"])')
                || drawer.querySelector('button, input, select, textarea, [tabindex]:not([tabindex="-1"])');
            firstFocusable?.focus();
        } else if (this.game._activeSubmenu === 'submenu-game') {
            this.ui.openLevel4Button?.focus?.();
        }
        this.updateContext();
    }

    _resolveDeveloperReleaseState(settings = this.game.settings) {
        const localSettings = settings?.localSettings && typeof settings.localSettings === 'object'
            ? settings.localSettings
            : {};
        const featureEnabled = settings?.menuFeatureFlags?.developerModeEnabled !== false;
        const releasePreviewEnabled = !!localSettings.releasePreviewEnabled;
        return {
            featureEnabled,
            releasePreviewEnabled,
            developerUiHidden: !featureEnabled,
            releaseCutEnabled: !featureEnabled || releasePreviewEnabled,
        };
    }

    _setElementsHidden(elements, hidden) {
        if (!Array.isArray(elements)) return;
        elements.forEach((element) => {
            if (!element) return;
            element.classList.toggle('hidden', !!hidden);
            element.setAttribute('aria-hidden', String(!!hidden));
            if (hidden) {
                element.setAttribute('tabindex', '-1');
            } else {
                element.removeAttribute('tabindex');
            }
        });
    }

    _syncDeveloperReleaseCutVisibility(settings = this.game.settings, releaseState = this._resolveDeveloperReleaseState(settings)) {
        const shouldHideDeveloperUi = releaseState.developerUiHidden;
        const shouldHideDebugHints = releaseState.releaseCutEnabled;
        const accessContext = resolveMenuAccessContext(settings);
        const developerPanelConfig = this.menuPanelRegistry.getPanelById('submenu-developer');
        const debugPanelConfig = this.menuPanelRegistry.getPanelById('submenu-debug');
        const developerPolicy = developerPanelConfig?.semanticId === 'developer'
            ? resolveDeveloperAccessPolicy(accessContext)
            : (developerPanelConfig?.accessPolicy || 'open');
        const developerAllowed = !shouldHideDeveloperUi
            && developerPanelConfig?.visibility !== 'hidden'
            && evaluateMenuAccessPolicy(developerPolicy, accessContext).allowed;
        const debugAllowed = !shouldHideDeveloperUi
            && debugPanelConfig?.visibility !== 'hidden'
            && evaluateMenuAccessPolicy(debugPanelConfig?.accessPolicy || 'open', accessContext).allowed;

        this._setElementsHidden(this._developerNavButtons, !developerAllowed);
        this._setElementsHidden(this._debugNavButtons, !debugAllowed);
        this._setElementsHidden(this._debugHintNodes, shouldHideDebugHints);

        if (this._developerPanel) {
            this._developerPanel.setAttribute('data-release-cut', shouldHideDeveloperUi ? 'true' : 'false');
        }
        if (!developerAllowed && this.game._activeSubmenu === 'submenu-developer') {
            this.showMainNav();
            return;
        }
        if (!debugAllowed && this.game._activeSubmenu === 'submenu-debug') {
            this.showMainNav();
        }
    }

    syncAll() {
        const settings = this.game.settings;
        this.syncSessionState(settings);
        this.syncModes(settings);
        this.syncMap(settings);
        this.syncBots(settings);
        this.syncRules(settings);
        this.syncGameplay(settings);
        this.syncVehicles(settings);
        this.syncStartSetupState(settings);
        this.syncPresetState(settings);
        this.syncMultiplayerState(settings);
        this.syncDeveloperState(settings);
    }

    syncSessionState(settings = this.game.settings) {
        const ui = this.ui;
        const sessionType = String(settings?.localSettings?.sessionType || MENU_SESSION_TYPES.SINGLE).toLowerCase();
        const modePath = String(settings?.localSettings?.modePath || 'normal').toLowerCase();
        if (Array.isArray(ui.sessionButtons)) {
            ui.sessionButtons.forEach((button) => {
                const buttonSessionType = String(button?.dataset?.sessionType || '').trim().toLowerCase();
                const isActive = buttonSessionType === sessionType;
                button.classList.toggle('active', isActive);
                button.setAttribute('aria-pressed', String(isActive));
            });
        }
        if (Array.isArray(ui.modePathButtons)) {
            ui.modePathButtons.forEach((button) => {
                const buttonModePath = String(button?.dataset?.modePath || '').trim().toLowerCase();
                const isActive = buttonModePath === modePath;
                button.classList.toggle('active', isActive);
                button.setAttribute('aria-pressed', String(isActive));
            });
        }

        const themeMode = String(settings?.localSettings?.themeMode || 'dunkel').toLowerCase() === 'hell'
            ? 'hell'
            : 'dunkel';
        if (this.ui.mainMenu) {
            this.ui.mainMenu.setAttribute('data-menu-local-theme', themeMode);
        }
        this.syncStartSetupState(settings);
    }

    syncByChangeKeys(changedKeys) {
        if (!Array.isArray(changedKeys) || changedKeys.length === 0) {
            this.syncAll();
            return;
        }

        for (const rawKey of changedKeys) {
            const key = typeof rawKey === 'string' ? rawKey.trim() : '';
            if (!key || !isSettingsChangeKey(key)) {
                this.syncAll();
                return;
            }
        }

        const normalizedKeys = normalizeSettingsChangeKeys(changedKeys);
        if (normalizedKeys.length === 0) {
            this.syncAll();
            return;
        }

        const syncMethodNames = resolveSyncMethodNamesForChangeKeys(normalizedKeys);
        if (syncMethodNames.length === 0) {
            this.syncAll();
            return;
        }

        for (const methodName of syncMethodNames) {
            const syncMethod = this[methodName];
            if (typeof syncMethod !== 'function') {
                this.syncAll();
                return;
            }
            syncMethod.call(this);
        }
    }

    syncModes(settings = this.game.settings) {
        const ui = this.ui;
        const sessionType = String(settings?.localSettings?.sessionType || MENU_SESSION_TYPES.SINGLE).toLowerCase();
        settings.mode = sessionType === MENU_SESSION_TYPES.SPLITSCREEN ? '2p' : '1p';

        if (Array.isArray(ui.modeButtons)) {
            ui.modeButtons.forEach((btn) => {
                btn.classList.toggle('active', btn.dataset.mode === settings.mode);
            });
        }
        if (ui.vehicleP2Container) {
            ui.vehicleP2Container.classList.toggle('hidden', settings.mode !== '2p');
        }

        const huntFeatureEnabled = CONFIG.HUNT?.ENABLED !== false;
        const resolvedGameMode = resolveActiveGameMode(settings.gameMode, huntFeatureEnabled);
        settings.gameMode = resolvedGameMode;
        if (!settings.hunt) settings.hunt = { respawnEnabled: false };
        if (resolvedGameMode !== GAME_MODE_TYPES.HUNT) {
            settings.hunt.respawnEnabled = false;
        }

        if (Array.isArray(ui.gameModeButtons)) {
            ui.gameModeButtons.forEach((btn) => {
                const buttonMode = resolveActiveGameMode(btn.dataset.gameMode, huntFeatureEnabled);
                const isHuntButton = buttonMode === GAME_MODE_TYPES.HUNT;
                btn.classList.toggle('active', buttonMode === resolvedGameMode);
                btn.disabled = isHuntButton && !huntFeatureEnabled;
                btn.title = btn.disabled ? 'Hunt-Modus ist per Feature-Flag deaktiviert' : '';
            });
        }
        if (ui.huntRespawnRow) {
            ui.huntRespawnRow.classList.toggle('hidden', resolvedGameMode !== GAME_MODE_TYPES.HUNT);
        }
        if (ui.huntRespawnToggle) {
            ui.huntRespawnToggle.checked = !!settings?.hunt?.respawnEnabled;
            ui.huntRespawnToggle.disabled = resolvedGameMode !== GAME_MODE_TYPES.HUNT;
        }
    }

    syncMap(settings = this.game.settings) {
        if (this.ui.mapSelect) {
            this.ui.mapSelect.value = settings.mapKey;
        }
        this.syncStartSetupState(settings);
    }

    syncBots(settings = this.game.settings) {
        const ui = this.ui;
        ui.botSlider.value = settings.numBots;
        ui.botLabel.textContent = settings.numBots;
        if (ui.botDifficultySelect) ui.botDifficultySelect.value = settings.botDifficulty;
    }

    syncRules(settings = this.game.settings) {
        const ui = this.ui;
        ui.winSlider.value = settings.winsNeeded;
        ui.winLabel.textContent = settings.winsNeeded;
        ui.autoRollToggle.checked = !!settings.autoRoll;
        ui.invertP1.checked = !!settings.invertPitch.PLAYER_1;
        ui.invertP2.checked = !!settings.invertPitch.PLAYER_2;
        ui.cockpitCamP1.checked = !!settings.cockpitCamera.PLAYER_1;
        ui.cockpitCamP2.checked = !!settings.cockpitCamera.PLAYER_2;
        ui.portalsToggle.checked = !!settings.portalsEnabled;
    }

    syncGameplay(settings = this.game.settings) {
        const ui = this.ui;
        const gp = settings.gameplay;
        ui.speedSlider.value = gp.speed;
        ui.speedLabel.textContent = `${gp.speed} m/s`;
        ui.turnSlider.value = gp.turnSensitivity;
        ui.turnLabel.textContent = gp.turnSensitivity.toFixed(1);
        ui.planeSizeSlider.value = gp.planeScale;
        ui.planeSizeLabel.textContent = gp.planeScale.toFixed(1);
        ui.trailWidthSlider.value = gp.trailWidth;
        ui.trailWidthLabel.textContent = gp.trailWidth.toFixed(1);
        ui.gapSizeSlider.value = gp.gapSize;
        ui.gapSizeLabel.textContent = gp.gapSize.toFixed(2);
        ui.gapFrequencySlider.value = gp.gapFrequency;
        ui.gapFrequencyLabel.textContent = (gp.gapFrequency * 100).toFixed(0) + '%';
        ui.itemAmountSlider.value = gp.itemAmount;
        ui.itemAmountLabel.textContent = gp.itemAmount;
        ui.fireRateSlider.value = gp.fireRate;
        ui.fireRateLabel.textContent = gp.fireRate.toFixed(2) + 's';
        ui.lockOnSlider.value = gp.lockOnAngle;
        const mgTrailAimRadius = Number.isFinite(Number(gp.mgTrailAimRadius))
            ? Number(gp.mgTrailAimRadius)
            : Math.max(0.2, Number(CONFIG?.HUNT?.MG?.TRAIL_HIT_RADIUS) || 0.78);
        if (ui.mgTrailAimSlider) ui.mgTrailAimSlider.value = mgTrailAimRadius;
        if (ui.mgTrailAimLabel) ui.mgTrailAimLabel.textContent = mgTrailAimRadius.toFixed(2);
        ui.lockOnLabel.textContent = gp.lockOnAngle + '\u00B0';

        const planarToggle = document.getElementById('planar-mode-toggle');
        if (planarToggle) planarToggle.checked = !!gp.planarMode;
        if (Array.isArray(ui.dimensionModeButtons)) {
            ui.dimensionModeButtons.forEach((button) => {
                const planarRaw = String(button?.dataset?.planarMode || '').trim().toLowerCase();
                const buttonPlanarMode = planarRaw === 'true' || planarRaw === '1' || planarRaw === 'yes';
                const isActive = buttonPlanarMode === !!gp.planarMode;
                button.classList.toggle('active', isActive);
                button.setAttribute('aria-pressed', String(isActive));
            });
        }
    }

    syncVehicles(settings = this.game.settings) {
        const ui = this.ui;
        if (ui.vehicleSelectP1) ui.vehicleSelectP1.value = settings.vehicles.PLAYER_1;
        if (ui.vehicleSelectP2) ui.vehicleSelectP2.value = settings.vehicles.PLAYER_2;
        this.syncStartSetupState(settings);
    }

    syncStartSetupState(settings = this.game.settings) {
        const startSetup = this._ensureStartSetupLocalState(settings);
        const mapSearch = String(startSetup.mapSearch || '').trim().toLowerCase();
        const mapFilter = String(startSetup.mapFilter || 'all').toLowerCase();
        const vehicleSearch = String(startSetup.vehicleSearch || '').trim().toLowerCase();
        const vehicleFilter = String(startSetup.vehicleFilter || 'all').toLowerCase();

        if (this.ui.mapSearchInput && this.ui.mapSearchInput.value !== startSetup.mapSearch) {
            this.ui.mapSearchInput.value = startSetup.mapSearch;
        }
        if (this.ui.mapFilterSelect && this.ui.mapFilterSelect.value !== startSetup.mapFilter) {
            this.ui.mapFilterSelect.value = startSetup.mapFilter;
        }
        if (this.ui.vehicleSearchInput && this.ui.vehicleSearchInput.value !== startSetup.vehicleSearch) {
            this.ui.vehicleSearchInput.value = startSetup.vehicleSearch;
        }
        if (this.ui.vehicleFilterSelect && this.ui.vehicleFilterSelect.value !== startSetup.vehicleFilter) {
            this.ui.vehicleFilterSelect.value = startSetup.vehicleFilter;
        }

        if (this.ui.mapSelect) {
            const previousValue = String(settings.mapKey || this.ui.mapSelect.value || 'standard');
            this.ui.mapSelect.innerHTML = '';
            this._mapPreviewEntries
                .filter((entry) => {
                    const matchesSearch = !mapSearch || entry.name.toLowerCase().includes(mapSearch) || entry.key.toLowerCase().includes(mapSearch);
                    const matchesFilter = mapFilter === 'all' || entry.category === mapFilter;
                    return matchesSearch && matchesFilter;
                })
                .forEach((entry) => {
                    const option = document.createElement('option');
                    option.value = entry.key;
                    option.textContent = entry.name;
                    this.ui.mapSelect.appendChild(option);
                });
            if (this.ui.mapSelect.options.length === 0) {
                const option = document.createElement('option');
                option.value = previousValue;
                option.textContent = previousValue;
                this.ui.mapSelect.appendChild(option);
            }
            this.ui.mapSelect.value = Array.from(this.ui.mapSelect.options).some((option) => option.value === previousValue)
                ? previousValue
                : this.ui.mapSelect.options[0].value;
        }

        const vehicleCandidates = this._vehiclePreviewEntries.filter((entry) => {
            const matchesSearch = !vehicleSearch || entry.label.toLowerCase().includes(vehicleSearch) || entry.id.toLowerCase().includes(vehicleSearch);
            const matchesFilter = vehicleFilter === 'all' || entry.category === vehicleFilter;
            return matchesSearch && matchesFilter;
        });
        if (this.ui.vehicleSelectP1) {
            const currentValue = String(settings?.vehicles?.PLAYER_1 || this.ui.vehicleSelectP1.value || '');
            this.ui.vehicleSelectP1.innerHTML = '';
            vehicleCandidates.forEach((entry) => {
                const option = document.createElement('option');
                option.value = entry.id;
                option.textContent = entry.label;
                this.ui.vehicleSelectP1.appendChild(option);
            });
            if (this.ui.vehicleSelectP1.options.length === 0) {
                const fallbackOption = document.createElement('option');
                fallbackOption.value = currentValue || 'ship5';
                fallbackOption.textContent = currentValue || 'ship5';
                this.ui.vehicleSelectP1.appendChild(fallbackOption);
            }
            this.ui.vehicleSelectP1.value = Array.from(this.ui.vehicleSelectP1.options).some((option) => option.value === currentValue)
                ? currentValue
                : this.ui.vehicleSelectP1.options[0].value;
        }
        if (this.ui.vehicleSelectP2) {
            const currentValue = String(settings?.vehicles?.PLAYER_2 || this.ui.vehicleSelectP2.value || '');
            this.ui.vehicleSelectP2.innerHTML = '';
            vehicleCandidates.forEach((entry) => {
                const option = document.createElement('option');
                option.value = entry.id;
                option.textContent = entry.label;
                this.ui.vehicleSelectP2.appendChild(option);
            });
            if (this.ui.vehicleSelectP2.options.length === 0) {
                const fallbackOption = document.createElement('option');
                fallbackOption.value = currentValue || 'ship5';
                fallbackOption.textContent = currentValue || 'ship5';
                this.ui.vehicleSelectP2.appendChild(fallbackOption);
            }
            this.ui.vehicleSelectP2.value = Array.from(this.ui.vehicleSelectP2.options).some((option) => option.value === currentValue)
                ? currentValue
                : this.ui.vehicleSelectP2.options[0].value;
        }

        this._renderQuickList(this.ui.mapFavoritesList, startSetup.favoriteMaps, 'mapKey');
        this._renderQuickList(this.ui.mapRecentList, startSetup.recentMaps, 'mapKey');
        this._renderQuickList(this.ui.vehicleFavoritesList, startSetup.favoriteVehicles, 'vehicleId');
        this._renderQuickList(this.ui.vehicleRecentList, startSetup.recentVehicles, 'vehicleId');

        const sessionType = String(settings?.localSettings?.sessionType || MENU_SESSION_TYPES.SINGLE).toLowerCase();
        const modePath = String(settings?.localSettings?.modePath || 'normal').toLowerCase();
        const sessionLabel = sessionType === MENU_SESSION_TYPES.SPLITSCREEN
            ? 'Splitscreen'
            : (sessionType === MENU_SESSION_TYPES.MULTIPLAYER ? 'Multiplayer' : 'Single Player');
        const modeLabel = modePath === 'fight'
            ? 'Fight'
            : (modePath === 'arcade' ? 'Arcade' : (modePath === 'quick_action' ? 'Schnellstart' : 'Normal'));
        const themeLabel = String(settings?.localSettings?.themeMode || 'dunkel').toLowerCase() === 'hell' ? 'Hell' : 'Dunkel';
        const mapPreview = resolveMapPreview(settings.mapKey);
        const vehiclePreviewP1 = resolveVehiclePreview(settings?.vehicles?.PLAYER_1);
        const vehiclePreviewP2 = resolveVehiclePreview(settings?.vehicles?.PLAYER_2);

        if (this.ui.menuSummary) {
            const summaryBlocks = [
                { label: 'Session', value: sessionLabel },
                { label: 'Spielstil', value: modeLabel },
                { label: 'Map', value: mapPreview.name },
                { label: 'P1', value: vehiclePreviewP1.label },
                { label: 'Ansicht', value: themeLabel },
            ];
            if (sessionType === MENU_SESSION_TYPES.SPLITSCREEN) {
                summaryBlocks.push({ label: 'P2', value: vehiclePreviewP2.label });
            }
            if (sessionType === MENU_SESSION_TYPES.MULTIPLAYER) {
                const hasCode = String(this.ui.multiplayerLobbyCodeInput?.value || '').trim();
                summaryBlocks.push({
                    label: 'Lobby',
                    value: hasCode || 'Code offen',
                    muted: !hasCode,
                });
            }
            this._renderSummaryBlocks(this.ui.menuSummary, summaryBlocks);
        }

        if (this.ui.mapPreview) {
            this._renderPreviewCard(this.ui.mapPreview, {
                title: mapPreview.name,
                badges: [this._humanizePreviewCategory(mapPreview.category), mapPreview.sizeText],
                facts: [
                    { label: 'Groesse', value: mapPreview.sizeText },
                    { label: 'Hindernisse', value: String(mapPreview.obstacleCount) },
                    { label: 'Portale', value: String(mapPreview.portalCount) },
                ],
            });
        }
        if (this.ui.vehiclePreviewP1) {
            this._renderPreviewCard(this.ui.vehiclePreviewP1, {
                title: vehiclePreviewP1.label,
                badges: ['Pilot 1', this._humanizePreviewCategory(vehiclePreviewP1.category)],
                facts: [
                    { label: 'Klasse', value: this._humanizePreviewCategory(vehiclePreviewP1.category) },
                    { label: 'Hitbox', value: vehiclePreviewP1.hitboxRadius.toFixed(2) },
                ],
            });
        }
        if (this.ui.vehiclePreviewP2) {
            this._renderPreviewCard(this.ui.vehiclePreviewP2, {
                title: vehiclePreviewP2.label,
                badges: ['Pilot 2', this._humanizePreviewCategory(vehiclePreviewP2.category)],
                facts: [
                    { label: 'Klasse', value: this._humanizePreviewCategory(vehiclePreviewP2.category) },
                    { label: 'Hitbox', value: vehiclePreviewP2.hitboxRadius.toFixed(2) },
                ],
            });
        }

        if (this.ui.multiplayerInlineState) {
            this.ui.multiplayerInlineState.classList.toggle('hidden', sessionType !== MENU_SESSION_TYPES.MULTIPLAYER);
            if (this.ui.multiplayerInlineState instanceof HTMLDetailsElement) {
                this.ui.multiplayerInlineState.open = sessionType === MENU_SESSION_TYPES.MULTIPLAYER;
            }
        }
        if (this.ui.multiplayerLobbyState) {
            const hasCode = String(this.ui.multiplayerLobbyCodeInput?.value || '').trim().length > 0;
            const ready = !!this.ui.multiplayerReadyToggle?.checked;
            const state = hasCode || ready ? 'verbunden' : 'nicht verbunden';
            this.ui.multiplayerLobbyState.textContent = `Lobbystatus: ${state}`;
        }

        if (this.ui.themeModeSelect) {
            const themeMode = String(settings?.localSettings?.themeMode || 'dunkel').toLowerCase() === 'hell' ? 'hell' : 'dunkel';
            this.ui.themeModeSelect.value = themeMode;
        }

        const level4Open = !!settings?.localSettings?.toolsState?.level4Open;
        this.setLevel4Open(level4Open);
        this._renderStartFieldHints(settings);
    }

    syncPresetState(settings = this.game.settings) {
        const ui = this.ui;
        const activePresetId = String(settings?.matchSettings?.activePresetId || '');
        const activePresetKind = String(settings?.matchSettings?.activePresetKind || '');

        if (ui.presetSelect) {
            const presets = this.game.settingsManager?.listMenuPresets?.() || [];
            const previousValue = String(ui.presetSelect.value || '');
            ui.presetSelect.innerHTML = '';

            const placeholderOption = document.createElement('option');
            placeholderOption.value = '';
            placeholderOption.textContent = 'Preset waehlen';
            ui.presetSelect.appendChild(placeholderOption);

            presets.forEach((preset) => {
                const option = document.createElement('option');
                const presetId = String(preset?.id || '').trim();
                const presetKind = String(preset?.metadata?.kind || '').trim();
                option.value = presetId;
                option.textContent = presetKind === 'fixed'
                    ? `${preset.name} (verbindlich)`
                    : `${preset.name} (frei)`;
                ui.presetSelect.appendChild(option);
            });

            const preferredValue = activePresetId || previousValue;
            if (preferredValue) {
                const hasOption = Array.from(ui.presetSelect.options).some((option) => option.value === preferredValue);
                ui.presetSelect.value = hasOption ? preferredValue : '';
            }
        }

        if (Array.isArray(ui.quickstartPresetButtons)) {
            ui.quickstartPresetButtons.forEach((button) => {
                const buttonPresetId = String(button?.dataset?.presetId || '').trim();
                const isActive = !!buttonPresetId && buttonPresetId === activePresetId;
                button.classList.toggle('active', isActive);
                button.setAttribute('aria-pressed', String(isActive));
            });
        }

        if (ui.presetStatus) {
            if (!activePresetId) {
                ui.presetStatus.textContent = 'Preset: individuell';
            } else {
                const presetKindLabel = activePresetKind === 'fixed' ? 'verbindlich' : 'frei';
                ui.presetStatus.textContent = `Preset: ${activePresetId} (${presetKindLabel})`;
            }
        }
    }

    syncMultiplayerState(settings = this.game.settings) {
        if (!this.ui.multiplayerStatus) return;
        const role = this._accessContext?.isOwner ? 'Host' : 'Client';
        const activePresetId = String(settings?.matchSettings?.activePresetId || '');
        const presetText = activePresetId ? ` | Preset: ${activePresetId}` : '';
        this.ui.multiplayerStatus.textContent = `Lobby Stub v1 | Rolle: ${role}${presetText}`;
    }

    syncDeveloperState(settings = this.game.settings) {
        const ui = this.ui;
        const localSettings = settings?.localSettings || {};
        const releaseState = this._resolveDeveloperReleaseState(settings);
        const resolvedDeveloperEnabled = !!localSettings.developerModeEnabled
            && releaseState.featureEnabled
            && !releaseState.releasePreviewEnabled;
        const resolvedThemeId = releaseState.releaseCutEnabled
            ? 'classic-console'
            : String(localSettings.developerThemeId || 'classic-console');

        applyDeveloperThemeToDocument(resolvedThemeId);
        this._syncDeveloperReleaseCutVisibility(settings, releaseState);

        this.menuTextRuntime.applyToDocument(document, {
            allowOverrides: true,
            developerFeatureEnabled: releaseState.featureEnabled,
            developerModeEnabled: resolvedDeveloperEnabled,
            releasePreviewEnabled: releaseState.releaseCutEnabled,
        });

        if (ui.developerModeToggle) {
            ui.developerModeToggle.checked = !!localSettings.developerModeEnabled;
            ui.developerModeToggle.disabled = !releaseState.featureEnabled;
        }
        if (ui.developerThemeSelect) {
            ui.developerThemeSelect.value = String(localSettings.developerThemeId || 'classic-console');
        }
        if (ui.developerVisibilitySelect && localSettings.developerModeVisibility) {
            ui.developerVisibilitySelect.value = String(localSettings.developerModeVisibility);
        }
        if (ui.developerFixedPresetLockToggle) {
            ui.developerFixedPresetLockToggle.checked = !!localSettings.fixedPresetLockEnabled;
        }
        if (ui.developerActorSelect && localSettings.actorId) {
            ui.developerActorSelect.value = String(localSettings.actorId);
        }
        if (ui.developerReleasePreviewToggle) {
            ui.developerReleasePreviewToggle.checked = !!localSettings.releasePreviewEnabled;
            ui.developerReleasePreviewToggle.disabled = !releaseState.featureEnabled;
        }

        const controlsLocked = !releaseState.featureEnabled
            || !localSettings.developerModeEnabled
            || releaseState.releasePreviewEnabled;
        const developerControls = [
            ui.developerThemeSelect,
            ui.developerVisibilitySelect,
            ui.developerFixedPresetLockToggle,
            ui.developerActorSelect,
            ui.developerTextIdSelect,
            ui.developerTextOverrideInput,
            ui.developerTextApplyButton,
            ui.developerTextClearButton,
        ];
        developerControls.forEach((control) => {
            if (!control) return;
            control.disabled = controlsLocked;
        });

        const selectedTextId = String(ui.developerTextIdSelect?.value || '').trim();
        if (ui.developerTextOverrideInput) {
            const overrideValue = this.game.settingsManager?.menuTextOverrideStore?.getOverride?.(selectedTextId) || '';
            if (ui.developerTextOverrideInput.value !== overrideValue) {
                ui.developerTextOverrideInput.value = overrideValue;
            }
        }

        const telemetrySnapshot = this.game.settingsManager?.getMenuTelemetrySnapshot?.(settings)
            || localSettings.telemetryState
            || null;
        if (ui.developerTelemetryOutput) {
            ui.developerTelemetryOutput.textContent = telemetrySnapshot
                ? JSON.stringify(telemetrySnapshot, null, 2)
                : 'Keine Telemetrie vorhanden.';
        }

        if (ui.developerHint) {
            const mode = String(localSettings.developerModeVisibility || 'owner_only');
            const ownerState = this._accessContext?.isOwner ? 'owner' : 'player';
            const releaseStateText = releaseState.releasePreviewEnabled
                ? 'release_preview_active'
                : (releaseState.featureEnabled ? 'dev_enabled' : 'dev_feature_off');
            ui.developerHint.textContent = `Developer Scope: ${mode} | Session: ${ownerState} | Release: ${releaseStateText}`;
        }
    }

    updateContext() {
        if (!this.ui.menuContext) return;
        this._accessContext = resolveMenuAccessContext(this.settings);
        this.menuNavigationRuntime?.setAccessContext?.(this._accessContext);
        this._syncMenuChromeState(this.game._activeSubmenu || null);
        const section = this._getMenuSectionLabel(this.game._activeSubmenu);
        const activeProfile = this._resolveActiveProfileName();
        const dirtyState = this.game.settingsDirty ? 'ungespeicherte Aenderungen' : 'alles gespeichert';
        const sessionType = String(this.settings?.localSettings?.sessionType || MENU_SESSION_TYPES.SINGLE).toLowerCase();
        const sessionLabel = sessionType === MENU_SESSION_TYPES.SPLITSCREEN
            ? 'Splitscreen'
            : (sessionType === MENU_SESSION_TYPES.MULTIPLAYER ? 'Multiplayer' : 'Single Player');
        const modePath = String(this.settings?.localSettings?.modePath || 'normal').toLowerCase();
        const modeLabel = modePath === 'fight'
            ? 'Fight'
            : (modePath === 'arcade' ? 'Arcade' : (modePath === 'quick_action' ? 'Schnellstart' : 'Normal'));
        const mapLabel = resolveMapPreview(this.settings?.mapKey).name;
        const activeSection = this._resolveLevel4Section(this.settings?.localSettings?.toolsState?.activeSection);
        const activeSectionLabel = {
            [LEVEL4_SECTION_IDS.CONTROLS]: 'Steuerung',
            [LEVEL4_SECTION_IDS.GAMEPLAY]: 'Gameplay',
            [LEVEL4_SECTION_IDS.ADVANCED_MAP]: 'Map-Details',
            [LEVEL4_SECTION_IDS.TOOLS]: 'Tools',
        }[activeSection] || 'Tools';

        let contextText = `${section} | Profil: ${activeProfile} | ${dirtyState}`;
        if (this.settings?.localSettings?.toolsState?.level4Open) {
            contextText = `Ebene 4 | ${activeSectionLabel} | ${sessionLabel} | ${dirtyState}`;
        } else if (this.game._activeSubmenu === 'submenu-game') {
            contextText = `${section} | ${sessionLabel} | ${modeLabel} | ${mapLabel}`;
        } else if (this.game._activeSubmenu === 'submenu-custom') {
            contextText = `${section} | ${sessionLabel} | Sofortstart oder Setup | ${dirtyState}`;
        }
        this.ui.menuContext.textContent = contextText;
    }

    _resolveActiveProfileName() {
        const game = this.game;
        const typedProfile = game.ui?.profileNameInput?.value || '';
        const normalizedTypedProfile = game.profileManager?.normalizeProfileName
            ? game.profileManager.normalizeProfileName(typedProfile)
            : typedProfile.trim();
        return game.activeProfileName || normalizedTypedProfile || 'kein Profil';
    }

    _getMenuSectionLabel(panelId) {
        if (!panelId) return 'Hauptmenue';
        const registeredPanel = this.menuPanelRegistry.getPanelById(panelId);
        if (registeredPanel?.label) {
            return String(registeredPanel.label).replace(/\s+/g, ' ').trim();
        }
        const linkedButton = this._menuButtonByPanel.get(panelId);
        if (linkedButton) {
            return (linkedButton.textContent || '').replace(/\s+/g, ' ').trim();
        }
        const panelTitle = document.querySelector(`#${panelId} .submenu-title`);
        return (panelTitle?.textContent || 'Untermenue').replace(/\s+/g, ' ').trim();
    }

    showToast(message, durationMsOrTone = 1200, tone = 'info') {
        const toast = this.ui.statusToast;
        if (!toast) return;
        const durationMs = typeof durationMsOrTone === 'number' ? durationMsOrTone : 1200;
        const requestedTone = typeof durationMsOrTone === 'string' ? durationMsOrTone : tone;
        const normalizedTone = requestedTone === 'success' || requestedTone === 'error' ? requestedTone : 'info';
        toast.textContent = message;
        toast.classList.remove('hidden', 'show', 'toast-info', 'toast-success', 'toast-error');
        toast.classList.add(`toast-${normalizedTone}`);
        void toast.offsetWidth;
        toast.classList.add('show');
        if (this._toastTimer) clearTimeout(this._toastTimer);
        this._toastTimer = setTimeout(() => {
            toast.classList.remove('show');
            toast.classList.add('hidden');
        }, durationMs);
    }
}
