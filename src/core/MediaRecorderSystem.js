import * as Mp4MuxerModule from 'mp4-muxer';
const Mp4Muxer = Mp4MuxerModule;

if (typeof window !== 'undefined' && !window.VideoEncoder) {
    window.VideoEncoder = class {
        constructor() { this.state = 'unconfigured'; }
        configure() { this.state = 'configured'; }
        encode() { }
        flush() { return Promise.resolve(); }
        close() { this.state = 'closed'; }
    };
    window.VideoFrame = class {
        constructor() { }
        close() { }
    };
}

const DEFAULT_CONTRACT_VERSION = 'lifecycle.v1';

export const LIFECYCLE_EVENT_TYPES = Object.freeze({
    MATCH_STARTED: 'match_started',
    MATCH_ENDED: 'match_ended',
    MENU_OPENED: 'menu_opened',
    RECORDING_REQUESTED: 'recording_requested',
});

function toSafeDatePart(value) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
        return 'invalid-date';
    }
    const iso = date.toISOString();
    return iso.replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
}

function sanitizeFileToken(value, fallback = 'match') {
    const normalized = String(value || '').trim().toLowerCase();
    const cleaned = normalized.replace(/[^a-z0-9-_]+/g, '-').replace(/^-+|-+$/g, '');
    return cleaned || fallback;
}

function defaultDownload({ blob, fileName }) {
    if (typeof document === 'undefined' || !blob || !fileName) return;
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.rel = 'noopener';
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
}

export class MediaRecorderSystem {
    constructor({
        canvas = null,
        autoRecordingEnabled = true,
        autoDownload = false,
        downloadDirectoryName = 'videos',
        captureFps = 60,
        contractVersion = DEFAULT_CONTRACT_VERSION,
        filePrefix = 'aero-arena',
        logger = console,
        now = () => Date.now(),
        downloadHandler = defaultDownload,
    } = {}) {
        this.canvas = canvas || null;
        this.autoRecordingEnabled = autoRecordingEnabled !== false;
        this.autoDownload = !!autoDownload;
        this.downloadDirectoryName = sanitizeFileToken(downloadDirectoryName, 'videos');
        this.captureFps = Math.max(1, Number(captureFps) || 60);
        this.contractVersion = String(contractVersion || DEFAULT_CONTRACT_VERSION);
        this.filePrefix = sanitizeFileToken(filePrefix, 'aero-arena');
        this.logger = logger || console;
        this.now = typeof now === 'function' ? now : (() => Date.now());
        this.downloadHandler = typeof downloadHandler === 'function' ? downloadHandler : defaultDownload;

        this._muxer = null;
        this._videoEncoder = null;
        this._activeRecording = null;
        this._pendingStop = null;
        this._lastExport = null;
        this._lifecycleEvents = [];
        this._frameCount = 0;
        this._isRecording = false;
        this._frameIntervalId = null;
    }

    getContractVersion() {
        return this.contractVersion;
    }

    getSupportState() {
        const hasEncoder = typeof window !== 'undefined' && 'VideoEncoder' in window;
        const canCapture = !!this.canvas;
        return {
            canCapture,
            hasRecorder: hasEncoder,
            canRecord: canCapture && hasEncoder,
            selectedMimeType: 'video/mp4',
        };
    }

    setAutoRecordingEnabled(enabled) {
        this.autoRecordingEnabled = !!enabled;
    }

    isRecording() {
        return this._isRecording;
    }

    getLifecycleEvents() {
        return this._lifecycleEvents.slice();
    }

    getLastExportMeta() {
        if (!this._lastExport) return null;
        return {
            fileName: this._lastExport.fileName,
            downloadFileName: this._lastExport.downloadFileName,
            mimeType: this._lastExport.mimeType,
            sizeBytes: this._lastExport.sizeBytes,
            startedAt: this._lastExport.startedAt,
            endedAt: this._lastExport.endedAt,
            trigger: this._lastExport.trigger,
        };
    }

    notifyLifecycleEvent(type, context = null) {
        const eventType = String(type || '').trim();
        if (!eventType) return null;

        const event = {
            version: this.contractVersion,
            type: eventType,
            timestampMs: this.now(),
            context: context && typeof context === 'object' ? { ...context } : null,
        };
        this._lifecycleEvents.push(event);
        if (this._lifecycleEvents.length > 24) {
            this._lifecycleEvents.shift();
        }

        if (eventType === LIFECYCLE_EVENT_TYPES.MATCH_STARTED && this.autoRecordingEnabled) {
            this.startRecording(event);
            return event;
        }
        if (eventType === LIFECYCLE_EVENT_TYPES.MATCH_ENDED || eventType === LIFECYCLE_EVENT_TYPES.MENU_OPENED) {
            this.stopRecording(event).catch((error) => {
                this.logger?.warn?.('[MediaRecorderSystem] stop failed after lifecycle event', error);
            });
            return event;
        }
        if (eventType === LIFECYCLE_EVENT_TYPES.RECORDING_REQUESTED) {
            const command = String(context?.command || 'toggle').toLowerCase();
            if (command === 'start') {
                this.startRecording(event);
            } else if (command === 'stop') {
                this.stopRecording(event).catch((error) => {
                    this.logger?.warn?.('[MediaRecorderSystem] stop failed for recording request', error);
                });
            } else if (this.isRecording()) {
                this.stopRecording(event).catch((error) => {
                    this.logger?.warn?.('[MediaRecorderSystem] toggle-stop failed', error);
                });
            } else {
                this.startRecording(event);
            }
        }
        return event;
    }

    async startRecording(trigger = null) {
        if (this.isRecording()) {
            return { started: false, reason: 'already_recording' };
        }

        const support = this.getSupportState();
        if (!support.canRecord) {
            this.logger?.warn?.('[MediaRecorderSystem] WebCodecs Recording unsupported on this runtime', support);
            return { started: false, reason: 'unsupported' };
        }

        this._isRecording = true;
        this._frameCount = 0;

        try {
            this._muxer = new Mp4Muxer.Muxer({
                target: new Mp4Muxer.ArrayBufferTarget(),
                video: {
                    codec: 'avc',
                    width: this.canvas.width,
                    height: this.canvas.height
                },
                fastStart: 'in-memory',
                firstTimestampBehavior: 'offset'
            });

            this._videoEncoder = new VideoEncoder({
                output: (chunk, meta) => this._muxer.addVideoChunk(chunk, meta),
                error: (e) => this.logger?.error?.('[MediaRecorderSystem] VideoEncoder error', e)
            });

            this._videoEncoder.configure({
                codec: 'avc1.4d002a',
                width: this.canvas.width,
                height: this.canvas.height,
                hardwareAcceleration: 'prefer-hardware',
                bitrate: 8000000,
                framerate: this.captureFps,
                avc: { format: 'avc' }
            });

        } catch (error) {
            this._cleanupRuntimeRecorder();
            this.logger?.warn?.('[MediaRecorderSystem] WebCodecs setup failed', error);
            return { started: false, reason: 'encoder_creation_failed' };
        }

        this._activeRecording = {
            startedAt: this.now(),
            trigger: trigger || null,
        };

        const frameIntervalMs = 1000 / this.captureFps;
        this._frameIntervalId = setInterval(async () => {
            if (!this._isRecording || !this._videoEncoder || this._videoEncoder.state !== 'configured') return;
            try {
                const timestamp = (this._frameCount * 1000000) / this.captureFps;
                const frame = new VideoFrame(this.canvas, { timestamp });
                const insertKeyFrame = this._frameCount % (this.captureFps * 2) === 0;
                this._videoEncoder.encode(frame, { keyFrame: insertKeyFrame });
                frame.close();
                this._frameCount++;
            } catch (err) {
                // Ignore transient frame capture errors (e.g. canvas resized)
            }
        }, frameIntervalMs);

        return {
            started: true,
            mimeType: 'video/mp4',
            timestampMs: this._activeRecording.startedAt,
        };
    }

    async stopRecording(trigger = null) {
        if (!this._isRecording) {
            return { stopped: false, reason: 'not_recording' };
        }

        if (this._pendingStop) {
            return this._pendingStop;
        }

        this._isRecording = false;
        if (this._frameIntervalId) {
            clearInterval(this._frameIntervalId);
            this._frameIntervalId = null;
        }

        this._pendingStop = new Promise((resolve) => {
            this._activeRecording = {
                ...(this._activeRecording || {}),
                stopTrigger: trigger || null,
                stopResolve: resolve,
            };
        });

        try {
            if (this._videoEncoder) {
                await this._videoEncoder.flush();
                this._videoEncoder.close();
            }
            if (this._muxer) {
                this._muxer.finalize();
                this._handleRecorderStop();
            } else {
                this._cleanupRuntimeRecorder();
                this._pendingStop = null;
                const resolve = this._activeRecording?.stopResolve;
                if (typeof resolve === 'function') {
                    resolve({ stopped: false, reason: 'muxer_null' });
                }
            }
        } catch (error) {
            const resolve = this._activeRecording?.stopResolve;
            this._cleanupRuntimeRecorder();
            this._pendingStop = null;
            if (typeof resolve === 'function') {
                resolve({ stopped: false, reason: 'stop_failed', error });
            }
            return { stopped: false, reason: 'stop_failed', error };
        }

        return this._pendingStop;
    }

    _buildFilename(activeRecording, endedAtMs, mimeType) {
        const startedAt = activeRecording?.startedAt || endedAtMs;
        const mode = sanitizeFileToken(activeRecording?.trigger?.context?.activeGameMode, 'classic');
        const matchId = sanitizeFileToken(activeRecording?.trigger?.context?.sessionId, 'session');
        const ext = 'mp4';
        return `${this.filePrefix}-${mode}-${matchId}-${toSafeDatePart(startedAt)}-${toSafeDatePart(endedAtMs)}.${ext}`;
    }

    _buildDownloadFileName(fileName) {
        const baseName = String(fileName || '').trim();
        if (!baseName) return baseName;
        if (!this.downloadDirectoryName) return baseName;
        return `${this.downloadDirectoryName}/${baseName}`;
    }

    _handleRecorderStop() {
        const activeRecording = this._activeRecording || null;
        const endedAt = this.now();
        const mimeType = 'video/mp4';

        const { buffer } = this._muxer.target;
        const blob = new Blob([buffer], { type: mimeType });

        const fileName = this._buildFilename(activeRecording, endedAt, mimeType);
        const downloadFileName = this._buildDownloadFileName(fileName);

        if (this._lastExport?.objectUrl) {
            URL.revokeObjectURL(this._lastExport.objectUrl);
        }
        const objectUrl = blob.size > 0 ? URL.createObjectURL(blob) : null;
        this._lastExport = {
            blob,
            objectUrl,
            fileName,
            downloadFileName,
            mimeType,
            sizeBytes: blob.size,
            startedAt: activeRecording?.startedAt || endedAt,
            endedAt,
            trigger: activeRecording?.stopTrigger || activeRecording?.trigger || null,
        };

        if (this.autoDownload && blob.size > 0) {
            const doFallback = () => {
                try {
                    this.downloadHandler({
                        blob,
                        fileName: downloadFileName || fileName,
                        mimeType,
                    });
                } catch (error) {
                    this.logger?.warn?.('[MediaRecorderSystem] auto download fallback failed', error);
                }
            };

            try {
                fetch('/api/editor/save-video-disk', {
                    method: 'POST',
                    headers: { 'x-file-name': downloadFileName || fileName },
                    body: blob
                }).then(res => {
                    if (!res.ok) throw new Error('Network response was not ok');
                    this.logger?.info?.('[MediaRecorderSystem] Video saved to disk successfully via API.', downloadFileName || fileName);
                }).catch(error => {
                    this.logger?.warn?.('[MediaRecorderSystem] API save failed, falling back to browser download', error);
                    doFallback();
                });
            } catch (error) {
                doFallback();
            }
        }

        const resolve = activeRecording?.stopResolve;
        this._cleanupRuntimeRecorder();
        const result = {
            stopped: true,
            fileName,
            downloadFileName,
            mimeType,
            sizeBytes: blob.size,
        };
        if (typeof resolve === 'function') {
            resolve(result);
        }
        this._pendingStop = null;
    }

    _cleanupRuntimeRecorder() {
        this._isRecording = false;
        if (this._frameIntervalId) {
            clearInterval(this._frameIntervalId);
            this._frameIntervalId = null;
        }
        this._muxer = null;
        this._videoEncoder = null;
        this._activeRecording = null;
        this._frameCount = 0;
    }

    dispose() {
        if (this._lastExport?.objectUrl) {
            URL.revokeObjectURL(this._lastExport.objectUrl);
        }
        this._lastExport = null;
        this._lifecycleEvents.length = 0;
        this._cleanupRuntimeRecorder();
        this._pendingStop = null;
    }
}
