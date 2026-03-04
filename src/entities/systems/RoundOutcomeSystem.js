export class RoundOutcomeSystem {
    constructor({
        getHumanPlayers = () => [],
        getBots = () => [],
        getPendingHumanRespawns = () => 0,
    } = {}) {
        this.getHumanPlayers = getHumanPlayers;
        this.getBots = getBots;
        this.getPendingHumanRespawns = getPendingHumanRespawns;
    }

    resolve() {
        const humanPlayers = this.getHumanPlayers();
        let humansAlive = 0;
        let lastHumanAlive = null;
        for (const player of humanPlayers) {
            if (!player?.alive) continue;
            humansAlive++;
            lastHumanAlive = player;
        }

        const pendingHumanRespawns = this.getPendingHumanRespawns(humanPlayers);
        let shouldEnd = false;
        let winner = null;

        if (humanPlayers.length === 1) {
            if (humansAlive === 0 && pendingHumanRespawns === 0) {
                shouldEnd = true;
                const bots = this.getBots();
                for (let i = 0; i < bots.length; i++) {
                    const botPlayer = bots[i]?.player;
                    if (botPlayer?.alive) {
                        winner = botPlayer;
                        break;
                    }
                }
            }
        } else if (humanPlayers.length >= 2) {
            if (humansAlive <= 1 && pendingHumanRespawns === 0) {
                shouldEnd = true;
                winner = lastHumanAlive;
            }
        }

        return { shouldEnd, winner };
    }
}
