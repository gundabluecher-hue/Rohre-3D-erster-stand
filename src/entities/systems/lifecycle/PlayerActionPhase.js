export class PlayerActionPhase {
    constructor(entityManager) {
        this.entityManager = entityManager;
    }

    run(player, input, huntModeActive) {
        const entityManager = this.entityManager;

        if (input.nextItem) player.cycleItem();
        if (input.dropItem) player.dropItem();

        if (input.useItem >= 0) {
            const result = entityManager._useInventoryItem(player, input.useItem);
            if (result.ok) {
                if (entityManager.recorder) {
                    entityManager.recorder.logEvent('ITEM_USE', player.index, `mode=use type=${result.type}`);
                }
            } else if (!player.isBot) {
                entityManager._notifyPlayerFeedback(player, result.reason);
            }
        }

        if (input.shootItem) {
            let result = null;
            if (huntModeActive && Number.isInteger(input.shootItemIndex) && input.shootItemIndex >= 0) {
                result = entityManager._shootItemProjectile(player, input.shootItemIndex);
            } else if (!huntModeActive) {
                result = entityManager._shootItemProjectile(player, input.shootItemIndex);
            }
            if (result && !result.ok && !player.isBot) {
                entityManager._notifyPlayerFeedback(player, result.reason);
            } else if (result && result.ok && entityManager.recorder) {
                entityManager.recorder.logEvent('ITEM_USE', player.index, `mode=shoot type=${result.type}`);
            }
        }

        if (input.shootMG && huntModeActive) {
            const result = entityManager._shootHuntGun(player);
            if (!result.ok && !player.isBot) {
                entityManager._notifyPlayerFeedback(player, result.reason);
            } else if (result.ok && entityManager.recorder) {
                entityManager.recorder.logEvent('ITEM_USE', player.index, `mode=mg type=${result.type}`);
            }
        }
    }
}
