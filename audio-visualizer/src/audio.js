export class AudioEngine {
    constructor() {
        this.ctx = null;
        this.analyser = null;
        this.gainNode = null;
        this.source = null;
        this.audioBuffer = null;
        this.data = null;

        this.low = 0;
        this.mid = 0;
        this.high = 0;
        this.rms = 0;
        this.beat = 0;

        // Playback state
        this.isPlaying = false;
        this.isPaused = false;
        this.songName = '';
        this.duration = 0;
        this._startedAt = 0;   // context time when playback started
        this._offset = 0;      // playback offset in seconds
    }

    async initFromFile(file) {
        // Stop any existing playback
        if (this.source) {
            try { this.source.stop(); } catch (_) { }
        }

        if (!this.ctx) {
            this.ctx = new AudioContext();
        }

        // Resume context if suspended (browser autoplay policy)
        if (this.ctx.state === 'suspended') {
            await this.ctx.resume();
        }

        const arrayBuffer = await file.arrayBuffer();
        this.audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
        this.duration = this.audioBuffer.duration;
        this.songName = file.name.replace(/\.[^/.]+$/, ''); // strip extension

        // Create gain node once
        if (!this.gainNode) {
            this.gainNode = this.ctx.createGain();
        }

        // Create analyser once
        if (!this.analyser) {
            this.analyser = this.ctx.createAnalyser();
            this.analyser.fftSize = 1024;
            this.data = new Uint8Array(this.analyser.frequencyBinCount);
        }

        this._offset = 0;
        this._startSource(0);
    }

    _startSource(offset) {
        // Create a new buffer source (they are single-use)
        this.source = this.ctx.createBufferSource();
        this.source.buffer = this.audioBuffer;
        this.source.loop = true;

        // Chain: source → gainNode → analyser → destination
        this.source.connect(this.gainNode);
        this.gainNode.connect(this.analyser);
        this.analyser.connect(this.ctx.destination);

        this.source.start(0, offset);
        this._startedAt = this.ctx.currentTime;
        this._offset = offset;
        this.isPlaying = true;
        this.isPaused = false;
    }

    togglePlay() {
        if (!this.audioBuffer) return;
        if (this.isPlaying && !this.isPaused) {
            this.pause();
        } else {
            this.resume();
        }
    }

    pause() {
        if (!this.ctx || !this.isPlaying || this.isPaused) return;
        this._offset = this.getCurrentTime();
        this.ctx.suspend();
        this.isPaused = true;
    }

    resume() {
        if (!this.ctx) return;

        if (this.isPaused) {
            this.ctx.resume();
            this.isPaused = false;
        } else if (!this.isPlaying && this.audioBuffer) {
            // Restart after stop
            this._startSource(0);
        }
    }

    stop() {
        if (!this.source) return;
        try { this.source.stop(); } catch (_) { }
        this.source = null;
        this.isPlaying = false;
        this.isPaused = false;
        this._offset = 0;

        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume(); // un-suspend so next play works
        }
    }

    seek(time) {
        if (!this.audioBuffer) return;
        const wasPlaying = this.isPlaying && !this.isPaused;

        if (this.source) {
            try { this.source.stop(); } catch (_) { }
        }

        // Un-suspend if paused
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }

        this._startSource(time % this.duration);

        if (!wasPlaying) {
            this.pause();
        }
    }

    setVolume(v) {
        if (this.gainNode) {
            this.gainNode.gain.value = Math.max(0, Math.min(1, v));
        }
    }

    getCurrentTime() {
        if (!this.isPlaying) return this._offset;
        if (this.isPaused) return this._offset;
        const elapsed = this.ctx.currentTime - this._startedAt + this._offset;
        return elapsed % this.duration;
    }

    getDuration() {
        return this.duration;
    }

    update() {
        if (!this.analyser) return;

        this.analyser.getByteFrequencyData(this.data);

        let low = 0, mid = 0, high = 0;
        const n = this.data.length;

        for (let i = 0; i < n; i++) {
            const v = this.data[i] / 255;
            if (i < n * 0.2) low += v;
            else if (i < n * 0.6) mid += v;
            else high += v;
        }

        low /= (n * 0.2);
        mid /= (n * 0.4);
        high /= (n * 0.4);

        // Smoothed values
        this.low = this.smooth(this.low, low, 0.1);
        this.mid = this.smooth(this.mid, mid, 0.08);
        this.high = this.smooth(this.high, high, 0.06);

        this.rms = (this.low + this.mid + this.high) / 3;

        const energy = this.rms;
        if (energy > this.beat) {
            this.beat = energy;
        } else {
            this.beat *= 0.92;
        }
    }

    smooth(current, target, rate) {
        return current + (target - current) * rate;
    }
}
