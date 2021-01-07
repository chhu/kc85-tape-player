/*
 * Robotron KC85 player using the web audio API (https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
 * Origin: https://github.com/chhu/kc85-tape-player
 */


const KC85Config = {
	default : {
		zero     : 2400,  // Frequencies
		one      : 1200,
		stop     : 600,
		first    : 8000,  // N complete "one" waves for first block
		silence  : 4400,  // silence between blocks in samples (0.1s if sampling rate is 48k)
		block    : 160,   // N complete "one" waves for each block
	},

	turbo: {	// just need to specify overrides
		silence : 0,
		block: 0
	}
}

class KC85Player {
	constructor(raw_data, config_key) {    // RAW data should be ByteArray or normal array, config key optional
		this.raw_data = raw_data
		this.config = Object.assign({}, KC85Config.default);
		this.config = Object.assign(this.config, KC85Config[config_key]);
		this.ac = new (window.AudioContext || window.webkitAudioContext)()
		this.sample_rate = this.ac.sampleRate
		this.audio = this.ac.createBuffer(1, this.sample_rate * ((raw_data.length / 128) * 1.2 + 10), this.sample_rate)
		this.duration = this.audio.duration
		this.one = KC85Player.WaveGen(this.sample_rate, this.config.one)
		this.zero = KC85Player.WaveGen(this.sample_rate, this.config.zero)
		this.stop = KC85Player.WaveGen(this.sample_rate, this.config.stop)

		// Generate audio samples
		this.audio_pos = 0  // within audio
		this.data_pos = 0  // within raw_data
		this.block = 1

		// Prepare first block
		for (let i = 0; i < this.config.first; i++) 
			this.add_one()

		while (this.data_pos < raw_data.length) {
			// Prepare complete block
			for (let i = 0; i < this.config.block; i++) 
				this.add_one()
			this.add_stop()
			let sum = 0
			this.add_byte((raw_data.length - this.data_pos) <= 128 ? 0xFF : this.block)
			for (let i = 0; i < 128; i++) {
				let data = Number(raw_data[this.data_pos]) // we may read beyond end, should yield zero
				if (isNaN(data))
					data = 0
				sum += data
				this.add_byte(data)
				this.data_pos++
			}
			this.add_byte(sum)
			this.audio_pos += this.config.silence
			this.block++
			if (this.block >= 0xFF)
				this.block = 1
		}

	}

	static WaveGen(sample_rate, frequency) {  // Generates a single wave for given frequency and sr
		let result = new Float32Array(Math.round(sample_rate / frequency))
		for (let i = 0; i < result.length; i++)
			result[i] = Math.sin((i / result.length) * 2 * Math.PI)
		return result
	}

	add_one() {
		this.audio.copyToChannel(this.one, 0, this.audio_pos); 
		this.audio_pos += this.one.length;
	}

	add_zero() {
		this.audio.copyToChannel(this.zero, 0, this.audio_pos); 
		this.audio_pos += this.zero.length;
	}

	add_stop() {
		this.audio.copyToChannel(this.stop, 0, this.audio_pos); 
		this.audio_pos += this.stop.length;
	}

	add_byte(b) {
		for (let bit = 0; bit < 8; bit++)
			if (b & (1 << bit))
				this.add_one()
			else
				this.add_zero()
		this.add_stop()
	}

	stop_play() {
		if (window.asource) {
			window.asource.stop()
			window.asource.disconnect()
		}
	}

	play() {
		this.stop_play()
		// Get an AudioBufferSourceNode.
		// This is the AudioNode to use when we want to play an AudioBuffer
		window.asource = this.ac.createBufferSource();
		// set the buffer in the AudioBufferSourceNode
		window.asource.buffer = this.audio;
		// connect the AudioBufferSourceNode to the
		// destination so we can hear the sound
		window.asource.connect(this.ac.destination);
		// start the source playing
		window.asource.start();
	}
}
