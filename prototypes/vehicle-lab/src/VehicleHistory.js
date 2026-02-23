export class VehicleHistory {
    constructor(initialConfig) {
        this.history = [];
        this.historyIndex = -1;
        this.save(initialConfig);
    }

    save(config) {
        const snapshot = JSON.stringify(config);
        if (this.history[this.historyIndex] === snapshot) return;

        this.history = this.history.slice(0, this.historyIndex + 1);
        this.history.push(snapshot);
        if (this.history.length > 50) this.history.shift();
        this.historyIndex = this.history.length - 1;
    }

    undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            return JSON.parse(this.history[this.historyIndex]);
        }
        return null;
    }

    redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            return JSON.parse(this.history[this.historyIndex]);
        }
        return null;
    }
}
