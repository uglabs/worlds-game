/**
 * UGLabs WebSocket client — protocol sourced from ug-js-sdk source.
 *
 * Key protocol rules (from SDK):
 *  - Every message needs `type: 'request'` except interact which uses `type: 'stream'`
 *  - set_configuration wraps config inside a `config:` object (not top-level `prompt`)
 *  - Streaming responses end with `kind: 'close'`, not `done: true` on text chunks
 *
 * Events emitted:
 *   'connected'            — auth + set_configuration complete
 *   'disconnected'         — WebSocket closed
 *   'text'                 — { text } streaming chunk
 *   'interaction_complete' — stream ended (kind: 'close' received)
 *   'api_error'            — { error } from server
 */
export class UGLabsClient extends EventTarget {
  #ws = null;
  #counter = 0;
  #authResolve = null;
  #authReject = null;

  constructor({ apiKey, playerId, authUrl, wsUrl }) {
    super();
    this.apiKey = apiKey;
    this.playerId = playerId;
    this.authUrl = authUrl;
    this.wsUrl = wsUrl;
    this.accessToken = null;
    this.ready = false;
    this.#currentPrompt = '';
    this.#pendingInteractUid = null;
  }

  #currentPrompt = '';
  #pendingInteractUid = null;

  // ── Public ───────────────────────────────────────────────────

  async fetchToken() {
    const res = await fetch(this.authUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: this.apiKey, federated_id: this.playerId }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Auth failed (${res.status}): ${body}`);
    }
    const data = await res.json();
    this.accessToken = data.access_token;
    return this.accessToken;
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.#authResolve = resolve;
      this.#authReject = reject;

      this.#ws = new WebSocket(this.wsUrl);

      this.#ws.onopen = async () => {
        try {
          await this.#doAuthenticate();
          await this.#doSetConfiguration(this.#currentPrompt);
          this.ready = true;
          this.dispatchEvent(new CustomEvent('connected'));
          this.#authResolve?.();
          this.#authResolve = null;
          this.#authReject = null;
        } catch (err) {
          this.#authReject?.(err);
          this.#authResolve = null;
          this.#authReject = null;
        }
      };

      this.#ws.onmessage = (ev) => this.#handleMessage(JSON.parse(ev.data));

      this.#ws.onerror = (err) => {
        console.warn('[UGLabs] WebSocket error', err);
        this.#authReject?.(new Error('WebSocket error'));
        this.#authResolve = null;
        this.#authReject = null;
      };

      this.#ws.onclose = (ev) => {
        this.ready = false;
        console.warn(`[UGLabs] WebSocket closed — code: ${ev.code}, reason: "${ev.reason}"`);
        this.dispatchEvent(new CustomEvent('disconnected', { detail: ev }));
        if (this.#authReject) {
          this.#authReject(new Error(`WebSocket closed before auth (code ${ev.code}${ev.reason ? ': ' + ev.reason : ''})`));
          this.#authResolve = null;
          this.#authReject = null;
        }
      };
    });
  }

  /** Re-sync the dog persona whenever game state changes. */
  setConfiguration(prompt) {
    this.#currentPrompt = prompt;
    if (this.ready) {
      this.#doSetConfiguration(prompt).catch((err) =>
        console.warn('[UGLabs] setConfiguration error:', err)
      );
    }
  }

  /** Send clear_audio then a streaming interact request with voice output. */
  requestHelp(text = 'Help me with this puzzle!') {
    this.#sendRequest({ kind: 'clear_audio' });
    const uid = this.#uid();
    this.#pendingInteractUid = uid;
    this.#sendStream({ kind: 'interact', uid, text, audio_output: true });
    return uid;
  }

  /** Send a clear_audio request (call before streaming PTT audio). */
  clearAudioBuffer() {
    this.#sendRequest({ kind: 'clear_audio' });
  }

  /** Stream a base64-encoded audio chunk to the server (for PTT). */
  addAudio(base64) {
    this.#sendRequest({
      kind: 'add_audio',
      audio: base64,
      config: { mime_type: 'audio/webm;codecs=opus', sample_rate: 48000, channels: 1, encoding: 'opus' },
    });
  }

  /** Trigger an interact after PTT recording — no text, voice output enabled. */
  requestVoiceInteract() {
    const uid = this.#uid();
    this.#pendingInteractUid = uid;
    this.#sendStream({ kind: 'interact', uid, audio_output: true });
    return uid;
  }

  disconnect() {
    this.#ws?.close(1000, 'Client disconnect');
    this.#ws = null;
  }

  // ── Private ──────────────────────────────────────────────────

  #uid() {
    return `uid-${++this.#counter}-${Date.now()}`;
  }

  /** Send a type:'request' message (single response). Returns a Promise. */
  #sendRequest(payload) {
    const uid = payload.uid || this.#uid();
    const msg = { type: 'request', uid, client_start_time: new Date().toISOString(), ...payload };
    console.log('[UGLabs] →', JSON.stringify(msg));
    this.#ws.send(JSON.stringify(msg));
    return uid;
  }

  /** Send a type:'stream' message (streaming response). */
  #sendStream(payload) {
    const uid = payload.uid || this.#uid();
    const msg = { type: 'stream', uid, client_start_time: new Date().toISOString(), ...payload };
    console.log('[UGLabs] →', JSON.stringify(msg));
    this.#ws.send(JSON.stringify(msg));
    return uid;
  }

  /** Authenticate — awaits the 'authenticated' response. */
  #doAuthenticate() {
    return new Promise((resolve, reject) => {
      this.#pendingAuth = { resolve, reject };
      this.#sendRequest({ kind: 'authenticate', access_token: this.accessToken });
      setTimeout(() => reject(new Error('authenticate timed out')), 10000);
    });
  }

  #pendingAuth = null;

  /** set_configuration — wraps config in `config:` object per SDK protocol. */
  #doSetConfiguration(prompt) {
    return new Promise((resolve, reject) => {
      this.#pendingConfig = { resolve, reject };
      this.#sendRequest({
        kind: 'set_configuration',
        config: { prompt: prompt || ' ', utilities: {} },
      });
      setTimeout(() => reject(new Error('set_configuration timed out')), 10000);
    });
  }

  #pendingConfig = null;

  #handleMessage(msg) {
    console.log('[UGLabs] ←', JSON.stringify(msg));
    switch (msg.kind) {
      case 'authenticate': // server echoes the request kind back (not 'authenticated')
      case 'authenticated': // keep as fallback per docs
        if (this.#pendingAuth) {
          if (msg.error) {
            this.#pendingAuth.reject(new Error(msg.error));
          } else {
            this.#pendingAuth.resolve(msg);
          }
          this.#pendingAuth = null;
        }
        break;

      case 'set_configuration': // server echoes the request kind back (not 'configured')
      case 'configured': // keep as fallback per docs
        if (this.#pendingConfig) {
          this.#pendingConfig.resolve(msg);
          this.#pendingConfig = null;
        }
        break;

      case 'interact':
        // Streaming response — server uses kind:'interact' with an event field
        if (msg.event === 'text') {
          this.dispatchEvent(new CustomEvent('text', { detail: { text: msg.text } }));
        } else if (msg.event === 'audio') {
          this.dispatchEvent(new CustomEvent('audio', { detail: { audio: msg.audio } }));
        } else if (msg.event === 'interaction_complete') {
          this.dispatchEvent(new CustomEvent('interaction_complete', { detail: msg }));
        }
        // text_complete is informational — no action needed
        break;

      case 'close':
        // Final stream close — interaction_complete already fired above
        this.#pendingInteractUid = null;
        break;

      case 'audio':
        // Top-level audio message (some server versions use this)
        this.dispatchEvent(new CustomEvent('audio', { detail: { audio: msg.audio } }));
        break;

      case 'error':
        console.warn('[UGLabs] Server error:', msg);
        if (this.#pendingAuth) { this.#pendingAuth.reject(new Error(msg.error)); this.#pendingAuth = null; }
        if (this.#pendingConfig) { this.#pendingConfig.reject(new Error(msg.error)); this.#pendingConfig = null; }
        this.dispatchEvent(new CustomEvent('api_error', { detail: msg }));
        break;

      default:
        break;
    }
  }
}
