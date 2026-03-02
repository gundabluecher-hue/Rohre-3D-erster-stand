// ============================================
// PlayerInputSystem.js - resolves human and bot player input
// ============================================

// Reused input object to reduce GC
const SHARED_EMPTY_INPUT = {
    pitchUp: false,
    pitchDown: false,
    yawLeft: false,
    yawRight: false,
    rollLeft: false,
    rollRight: false,
    boost: false,
    cameraSwitch: false,
    dropItem: false,
    shootItem: false,
    shootMG: false,
    shootItemIndex: -1,
    nextItem: false,
    useItem: -1,
};

function getEmptyInput() {
    SHARED_EMPTY_INPUT.pitchUp = false;
    SHARED_EMPTY_INPUT.pitchDown = false;
    SHARED_EMPTY_INPUT.yawLeft = false;
    SHARED_EMPTY_INPUT.yawRight = false;
    SHARED_EMPTY_INPUT.rollLeft = false;
    SHARED_EMPTY_INPUT.rollRight = false;
    SHARED_EMPTY_INPUT.boost = false;
    SHARED_EMPTY_INPUT.cameraSwitch = false;
    SHARED_EMPTY_INPUT.dropItem = false;
    SHARED_EMPTY_INPUT.shootItem = false;
    SHARED_EMPTY_INPUT.shootMG = false;
    SHARED_EMPTY_INPUT.shootItemIndex = -1;
    SHARED_EMPTY_INPUT.nextItem = false;
    SHARED_EMPTY_INPUT.useItem = -1;
    return SHARED_EMPTY_INPUT;
}

export class PlayerInputSystem {
    constructor(entityManager) {
        this.entityManager = entityManager;
    }

    resolvePlayerInput(player, dt, inputManager) {
        const entityManager = this.entityManager;
        let input = getEmptyInput();

        if (player.isBot) {
            const botAI = entityManager.botByPlayer.get(player);
            if (botAI) {
                input = botAI.update(dt, player, entityManager.arena, entityManager.players, entityManager.projectiles);
            }
            return input;
        }

        const includeSecondaryBindings = entityManager.humanPlayers.length === 1 && player.index === 0;
        const inputState = inputManager.getPlayerInput(player.index, { includeSecondaryBindings });
        if (inputState) {
            input.pitchUp = inputState.pitchUp;
            input.pitchDown = inputState.pitchDown;
            input.yawLeft = inputState.yawLeft;
            input.yawRight = inputState.yawRight;
            input.rollLeft = inputState.rollLeft;
            input.rollRight = inputState.rollRight;
            input.boost = inputState.boost;
            input.cameraSwitch = inputState.cameraSwitch;
            input.dropItem = inputState.dropItem;
            input.shootItem = inputState.shootItem;
            input.shootMG = inputState.shootMG;
            input.nextItem = inputState.nextItem;

            if (input.shootItem && Array.isArray(player.inventory) && player.inventory.length > 0) {
                const selectedIndex = Number.isInteger(player.selectedItemIndex) ? player.selectedItemIndex : 0;
                input.shootItemIndex = Math.max(0, Math.min(selectedIndex, player.inventory.length - 1));
            }
        }

        if (input.cameraSwitch) {
            entityManager.renderer.cycleCamera(player.index);
            player.cameraMode = entityManager.renderer.cameraModes[player.index] || 0;
        }
        return input;
    }
}
