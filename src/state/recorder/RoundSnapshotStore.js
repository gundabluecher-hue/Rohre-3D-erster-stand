export class RoundSnapshotStore {
    constructor({ maxSnapshots = 900, timeProvider = null } = {}) {
        this.maxSnapshots = Math.max(1, Number(maxSnapshots) || 900);
        this.timeProvider = typeof timeProvider === 'function' ? timeProvider : (() => 0);
        this.snapshots = new Array(this.maxSnapshots);
        for (let i = 0; i < this.maxSnapshots; i++) {
            this.snapshots[i] = { time: 0, players: [] };
        }
        this.snapshotIndex = 0;
        this.snapshotCount = 0;
    }

    reset() {
        this.snapshotIndex = 0;
        this.snapshotCount = 0;
    }

    capture(players) {
        const snap = this.snapshots[this.snapshotIndex];
        snap.time = this.timeProvider();

        while (snap.players.length < players.length) {
            snap.players.push({ idx: 0, alive: false, x: 0, y: 0, z: 0, bot: false });
        }

        for (let i = 0; i < players.length; i++) {
            const p = players[i];
            const s = snap.players[i];
            s.idx = p.index;
            s.alive = p.alive;
            s.x = +p.position.x.toFixed(1);
            s.y = +p.position.y.toFixed(1);
            s.z = +p.position.z.toFixed(1);
            s.bot = p.isBot;
        }

        this.snapshotIndex = (this.snapshotIndex + 1) % this.maxSnapshots;
        if (this.snapshotCount < this.maxSnapshots) this.snapshotCount++;
    }

    getRecentSnapshotTable(limit = 20) {
        const snapList = [];
        const safeLimit = Math.max(1, Number(limit) || 20);
        const snapStart = this.snapshotCount >= this.maxSnapshots ? this.snapshotIndex : 0;
        const showCount = Math.min(this.snapshotCount, safeLimit);
        const offset = Math.max(0, this.snapshotCount - showCount);
        for (let i = 0; i < showCount; i++) {
            const idx = (snapStart + offset + i) % this.maxSnapshots;
            const s = this.snapshots[idx];
            const playerStr = s.players
                .filter((p) => p.idx !== undefined)
                .map((p) => `${p.bot ? 'Bot' : 'P'}${p.idx}:${p.alive ? 'alive' : 'dead'}(${p.x},${p.y},${p.z})`)
                .join(' | ');
            snapList.push({ time: `${s.time.toFixed(2)}s`, players: playerStr });
        }
        return snapList;
    }
}
