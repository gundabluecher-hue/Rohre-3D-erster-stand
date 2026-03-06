import { evaluateMenuAccessPolicy, resolveDeveloperAccessPolicy } from './MenuAccessPolicy.js';
import { MENU_STATE_IDS } from './MenuStateMachine.js';

function normalizeId(value) {
    return typeof value === 'string' ? value.trim() : '';
}

function getFocusableElements(container) {
    if (!container) return [];
    return Array.from(container.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    ));
}

export class MenuNavigationRuntime {
    constructor(options = {}) {
        this.ui = options.ui || {};
        this.panelRegistry = options.panelRegistry || null;
        this.stateMachine = options.stateMachine || null;
        this.onMenuStateChanged = typeof options.onMenuStateChanged === 'function'
            ? options.onMenuStateChanged
            : null;
        this.onPanelChanged = typeof options.onPanelChanged === 'function'
            ? options.onPanelChanged
            : null;
        this.accessContext = options.accessContext && typeof options.accessContext === 'object'
            ? options.accessContext
            : { isOwner: true };

        this._initialized = false;
        this._disposers = [];
        this._buttonByPanelId = new Map();
        this._panelById = new Map();
        this._navButtons = [];
        this._submenuPanels = [];
    }

    init() {
        if (this._initialized) return;
        this._initialized = true;

        this._navButtons = Array.isArray(this.ui.menuNavButtons) && this.ui.menuNavButtons.length > 0
            ? this.ui.menuNavButtons
            : Array.from(document.querySelectorAll('.nav-btn'));
        this._submenuPanels = Array.isArray(this.ui.menuPanels) && this.ui.menuPanels.length > 0
            ? this.ui.menuPanels
            : Array.from(document.querySelectorAll('.submenu-panel'));

        this._buttonByPanelId.clear();
        this._panelById.clear();
        this._submenuPanels.forEach((panel) => {
            const id = normalizeId(panel?.id);
            if (!id) return;
            this._panelById.set(id, panel);
        });

        this._navButtons.forEach((button) => {
            const rawTarget = normalizeId(button.dataset.submenu || button.dataset.menuTarget);
            const targetId = this.panelRegistry?.resolvePanelId(rawTarget) || rawTarget;
            if (!targetId) return;
            this._buttonByPanelId.set(targetId, button);

            const onClick = () => {
                this.showPanel(targetId, { trigger: 'nav_button' });
            };
            button.addEventListener('click', onClick);
            this._disposers.push(() => button.removeEventListener('click', onClick));
        });

        const backButtons = Array.from(document.querySelectorAll('[data-back]'));
        backButtons.forEach((button) => {
            const onClick = () => this.showMainNav({ trigger: 'back_button' });
            button.addEventListener('click', onClick);
            this._disposers.push(() => button.removeEventListener('click', onClick));
        });

        const stepperButtons = Array.isArray(this.ui.customStepperButtons) && this.ui.customStepperButtons.length > 0
            ? this.ui.customStepperButtons
            : Array.from(document.querySelectorAll('[data-menu-step], [data-menu-step-target]'));
        stepperButtons.forEach((button) => {
            const onClick = () => {
                const rawTarget = normalizeId(
                    button.dataset.menuStepTarget
                    || button.dataset.menuStep
                    || button.dataset.submenu
                );
                const targetId = this.panelRegistry?.resolvePanelId(rawTarget) || rawTarget;
                if (!targetId) return;
                this.showPanel(targetId, { trigger: 'custom_stepper' });
            };
            button.addEventListener('click', onClick);
            this._disposers.push(() => button.removeEventListener('click', onClick));
        });

        const menuRoot = this.ui.mainMenu || document.getElementById('main-menu');
        if (menuRoot) {
            const onKeyDown = (event) => this._handleMenuKeyDown(event);
            menuRoot.addEventListener('keydown', onKeyDown);
            this._disposers.push(() => menuRoot.removeEventListener('keydown', onKeyDown));
        }

        this.applyAccessPolicy();
        this.showMainNav({ trigger: 'init' });
    }

    dispose() {
        while (this._disposers.length > 0) {
            const dispose = this._disposers.pop();
            try {
                dispose?.();
            } catch {
                // Ignore dispose errors to keep menu runtime robust.
            }
        }
        this._initialized = false;
    }

    setAccessContext(accessContext) {
        if (!accessContext || typeof accessContext !== 'object') return;
        this.accessContext = { ...accessContext };
        this.applyAccessPolicy();
    }

    applyAccessPolicy() {
        for (const [panelId, button] of this._buttonByPanelId.entries()) {
            const panelConfig = this.panelRegistry?.getPanelById(panelId);
            const panelPolicy = this._resolvePanelPolicy(panelConfig);
            const accessResult = evaluateMenuAccessPolicy(panelPolicy, this.accessContext);
            const isVisible = panelConfig?.visibility !== 'hidden' && accessResult.allowed;
            button.classList.toggle('hidden', !isVisible);
            button.setAttribute('aria-hidden', String(!isVisible));
            if (!isVisible) {
                button.setAttribute('tabindex', '-1');
                button.setAttribute('aria-disabled', 'true');
            } else {
                button.removeAttribute('tabindex');
                button.removeAttribute('aria-disabled');
            }
        }
    }

    showPanel(requestedPanelId, metadata = null) {
        const panelId = this.panelRegistry?.resolvePanelId(requestedPanelId) || normalizeId(requestedPanelId);
        if (!panelId) return false;

        const targetPanel = this._panelById.get(panelId) || document.getElementById(panelId);
        if (!targetPanel) return false;

        const panelConfig = this.panelRegistry?.getPanelById(panelId);
        const panelPolicy = this._resolvePanelPolicy(panelConfig);
        const accessResult = evaluateMenuAccessPolicy(panelPolicy, this.accessContext);
        if (panelConfig?.visibility === 'hidden' || !accessResult.allowed) {
            return false;
        }

        this._submenuPanels.forEach((panel) => {
            const isTarget = panel === targetPanel;
            panel.classList.toggle('hidden', !isTarget);
            panel.setAttribute('aria-hidden', String(!isTarget));
            panel.setAttribute('data-menu-visible', isTarget ? 'true' : 'false');
        });

        this._navButtons.forEach((button) => {
            const rawTarget = normalizeId(button.dataset.submenu || button.dataset.menuTarget);
            const resolvedTarget = this.panelRegistry?.resolvePanelId(rawTarget) || rawTarget;
            const isActive = resolvedTarget === panelId;
            button.classList.toggle('active', isActive);
            button.setAttribute('aria-expanded', String(isActive));
        });

        const semanticState = normalizeId(panelConfig?.semanticId, panelId);
        const transition = this.stateMachine?.transition
            ? this.stateMachine.transition(semanticState, metadata)
            : { state: semanticState };

        this.onPanelChanged?.(panelId, panelConfig || null, transition);
        this.onMenuStateChanged?.(transition);

        const focusables = getFocusableElements(targetPanel);
        if (focusables.length > 0) {
            focusables[0].focus();
        }
        return true;
    }

    showMainNav(metadata = null) {
        this._submenuPanels.forEach((panel) => {
            panel.classList.add('hidden');
            panel.setAttribute('aria-hidden', 'true');
            panel.setAttribute('data-menu-visible', 'false');
        });
        this._navButtons.forEach((button) => {
            button.classList.remove('active');
            button.setAttribute('aria-expanded', 'false');
        });

        const transition = this.stateMachine?.transition
            ? this.stateMachine.transition(MENU_STATE_IDS.MAIN, metadata)
            : { state: MENU_STATE_IDS.MAIN };
        this.onPanelChanged?.(null, null, transition);
        this.onMenuStateChanged?.(transition);

        const firstVisibleButton = this._navButtons.find((button) => !button.classList.contains('hidden'));
        firstVisibleButton?.focus();
    }

    _handleMenuKeyDown(event) {
        if (!event) return;
        if (event.key === 'Escape' && this.stateMachine?.getState?.() !== MENU_STATE_IDS.MAIN) {
            event.preventDefault();
            this.showMainNav({ trigger: 'escape' });
            return;
        }

        if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
        const activeElement = document.activeElement;
        if (!activeElement || !activeElement.classList.contains('nav-btn')) return;

        const visibleButtons = this._navButtons.filter((button) => !button.classList.contains('hidden'));
        if (visibleButtons.length < 2) return;
        const activeIndex = visibleButtons.indexOf(activeElement);
        if (activeIndex < 0) return;

        event.preventDefault();
        const delta = event.key === 'ArrowRight' ? 1 : -1;
        const nextIndex = (activeIndex + delta + visibleButtons.length) % visibleButtons.length;
        visibleButtons[nextIndex].focus();
    }

    _resolvePanelPolicy(panelConfig) {
        if (!panelConfig || typeof panelConfig !== 'object') return 'open';
        if (panelConfig.semanticId === 'developer') {
            return resolveDeveloperAccessPolicy(this.accessContext);
        }
        return panelConfig.accessPolicy || 'open';
    }
}
