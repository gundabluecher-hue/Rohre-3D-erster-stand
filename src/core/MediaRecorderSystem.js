const DEFAULT_MIME_CANDIDATES = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
];

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

function selectMimeType(mediaRecorderCtor, mimeCandidates) {
    if (!mediaRecorderCtor || typeof mediaRecorderCtor.isTypeSupported !== 'function') {
        return '';
    }
    for (let i = 0; i < mimeCandidates.length; i++) {
        const candidate = String(mimeCandidates[i] || '').trim();
        if (!candidate) continue;
        if (mediaRecorderCtor.isTypeSupported(candidate)) {
            return candidate;
        }
    }
    return '';
}

function resolveMediaRecorderCtor() {
    if (typeof window === 'undefined') return null;
    return typeof window.MediaRecorder === 'function' ? window.MediaRecorder : null;
}

function resolveCaptureSupport(canvas) {
    return !!(canvas && typeof canvas.captureStream === 'function');
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
        mimeCandidates = DEFAULT_MIME_CANDIDATES,
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
        this.mimeCandidates = Array.isArray(mimeCandidates) ? [...mimeCandidates] : [...DEFAULT_MIME_CANDIDATES];
        this.contractVersion = String(contractVersion || DEFAULT_CONTRACT_VERSION);
        this.filePrefix = sanitizeFileToken(filePrefix, 'aero-arena');
        this.logger = logger || console;
        this.now = typeof now === 'function' ? now : (() => Date.now());
        this.downloadHandler = typeof downloadHandler === 'function' ? downloadHandler : defaultDownload;

        this._mediaRecorderCtor = resolveMediaRecorderCtor();
        this._selectedMimeType = selectMimeType(this._mediaRecorderCtor, this.mimeCandidates);

        this._stream = null;
        this._recorder = null;
        this._chunks = [];
        this._activeRecording = null;
        this._pendingStop = null;
        this._lastExport = null;
        this._lifecycleEvents = [];
    }

    getContractVersion() {
        return this.contractVersion;
    }

    getSupportState() {
        const canCapture = resolveCaptureSupport(this.canvas);
        const hasRecorder = !!this._mediaRecorderCtor;
        return {
            canCapture,
            hasRecorder,
            canRecord: canCapture && hasRecorder,
            selectedMimeType: this._selectedMimeType || '',
        };
    }

    setAutoRecordingEnabled(enabled) {
        this.autoRecordingEnabled = !!enabled;
    }

    isRecording() {
        return !!(this._recorder && this._recorder.state === 'recording');
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

    startRecording(trigger = null) {
        if (this.isRecording()) {
            return { started: false, reason: 'already_recording' };
        }

        const support = this.getSupportState();
        if (!support.canRecord) {
            this.logger?.warn?.('[MediaRecorderSystem] Recording unsupported on this runtime', support);
            return { started: false, reason: 'unsupported' };
        }

        let stream = null;
        try {
            stream = this.canvas.captureStream(this.captureFps);
        } catch (error) {
            this.logger?.warn?.('[MediaRecorderSystem] canvas.captureStream failed', error);
            return { started: false, reason: 'capture_stream_failed' };
        }
        if (!stream) {
            return { started: false, reason: 'stream_unavailable' };
        }

        let recorder = null;
        try {
            if (support.selectedMimeType) {
                recorder = new this._mediaRecorderCtor(stream, { mimeType: support.selectedMimeType });
            } else {
                recorder = new this._mediaRecorderCtor(stream);
            }
        } catch (error) {
            this._stopStreamTracks(stream);
            this.logger?.warn?.('[MediaRecorderSystem] MediaRecorder creation failed', error);
            return { started: false, reason: 'recorder_creation_failed' };
        }

        this._stream = stream;
        this._recorder = recorder;
        this._chunks.length = 0;
        this._activeRecording = {
            startedAt: this.now(),
            trigger: trigger || null,
        };

        recorder.ondataavailable = (event) => {
            if (!event?.data || event.data.size <= 0) return;
            this._chunks.push(event.data);
        };
        recorder.onerror = (event) => {
            this.logger?.warn?.('[MediaRecorderSystem] recorder error', event?.error || event);
        };
        recorder.onstop = () => {
            this._handleRecorderStop();
        };

        try {
            recorder.start();
        } catch (error) {
            this._cleanupRuntimeRecorder();
            this.logger?.warn?.('[MediaRecorderSystem] recorder.start failed', error);
            return { started: false, reason: 'start_failed' };
        }

        return {
            started: true,
            mimeType: support.selectedMimeType || '',
            timestampMs: this._activeRecording.startedAt,
        };
    }

    async stopRecording(trigger = null) {
        if (!this._recorder) {
            return { stopped: false, reason: 'not_recording' };
        }

        if (this._recorder.state === 'inactive') {
            this._cleanupRuntimeRecorder();
            return { stopped: false, reason: 'already_inactive' };
        }

        if (this._pendingStop) {
            return this._pendingStop;
        }

        this._pendingStop = new Promise((resolve) => {
            this._activeRecording = {
                ...(this._activeRecording || {}),
                stopTrigger: trigger || null,
                stopResolve: resolve,
            };
        });

        try {
            this._recorder.stop();
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
        const ext = mimeType.includes('webm') ? 'webm' : 'video';
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
        const mimeType = this._recorder?.mimeType || this._selectedMimeType || 'video/webm';
        const blob = new Blob(this._chunks, { type: mimeType });
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
            try {
                this.downloadHandler({
                    blob,
                    fileName: downloadFileName || fileName,
                    mimeType,
                });
            } catch (error) {
                this.logger?.warn?.('[MediaRecorderSystem] auto download failed', error);
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

    _stopStreamTracks(stream) {
        if (!stream || typeof stream.getTracks !== 'function') return;
        const tracks = stream.getTracks();
        for (let i = 0; i < tracks.length; i++) {
            tracks[i]?.stop?.();
        }
    }

    _cleanupRuntimeRecorder() {
        if (this._recorder) {
            this._recorder.ondataavailable = null;
            this._recorder.onstop = null;
            this._recorder.onerror = null;
        }
        this._stopStreamTracks(this._stream);
        this._stream = null;
        this._recorder = null;
        this._chunks.length = 0;
        this._activeRecording = null;
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
