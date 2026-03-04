import { CONFIG } from '../../core/Config.js';

function axisInput(positive, negative) {
    return (positive ? 1 : 0) - (negative ? 1 : 0);
}

export class PlayerController {
    constructor() {
        this._controlState = {
            pitchInput: 0,
            yawInput: 0,
            rollInput: 0,
            boost: false,
        };
    }

    resolveControlState(player, input, steeringLocked = false) {
        const out = this._controlState;
        out.pitchInput = 0;
        out.yawInput = 0;
        out.rollInput = 0;
        out.boost = false;

        if (!input || steeringLocked) {
            return out;
        }

        let pitchInput = axisInput(input.pitchUp, input.pitchDown);
        let yawInput = axisInput(input.yawLeft, input.yawRight);
        let rollInput = axisInput(input.rollLeft, input.rollRight);

        if (player.invertPitchBase) {
            pitchInput *= -1;
        }
        if (player.invertControls) {
            pitchInput *= -1;
            yawInput *= -1;
        }

        if (CONFIG.GAMEPLAY.PLANAR_MODE) {
            pitchInput = 0;
        }

        out.pitchInput = pitchInput;
        out.yawInput = yawInput;
        out.rollInput = rollInput;
        out.boost = !!input.boost;
        return out;
    }
}
