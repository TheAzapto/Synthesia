export class AudioEngine {
    constructor() {
        this.ctx = null;
        this.analyser = null;
        this.data = null;

        this.low = 0;
        this.mid = 0;
        this.high = 0;
        this.rms = 0;
        this.beat = 0;
    }

    async initFromFile(file) {
        this.ctx = new AudioContext();

        const arrayBuffer = await file.arrayBuffer();
        const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);

        const source = this.ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.loop = true;

        this.analyser = this.ctx.createAnalyser();
        this.analyser.fftSize = 1024;

        source.connect(this.analyser);
        this.analyser.connect(this.ctx.destination);

        this.data = new Uint8Array(this.analyser.frequencyBinCount);

        source.start();
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

        // 🔥 SMOOTHED VALUES
        this.low = this.smooth(this.low, low, 0.1);
        this.mid = this.smooth(this.mid, mid, 0.08);
        this.high = this.smooth(this.high, high, 0.06);

        this.rms = (this.low + this.mid + this.high) / 3;

        const energy = this.rms;
        if (energy > this.beat) {
            this.beat = energy;           // fast attack
        } else {
            this.beat *= 0.92;            // slow decay
        }
    }


    smooth(current, target, rate) {
        return current + (target - current) * rate;
    }
}
