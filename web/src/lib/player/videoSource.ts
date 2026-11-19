/**
 * Video provider adapter (decision D13).
 *
 * The player only ever calls `attachSource(video, url, callbacks)`. How the stream is
 * actually loaded is decided here, so switching to Mux, AWS or anything else later
 * means changing this file only:
 *
 *   - Browsers that play HLS natively (Safari, iOS, newer Chromium) → set video.src
 *   - Other browsers play HLS through hls.js                        → lazy-loaded
 *   - Plain MP4/WebM                                                 → set video.src
 *
 * Invariant: one source per <video> element. A new attach first tears down the previous
 * one, and a stale detach (e.g. from React re-running an effect) is a no-op — otherwise
 * an old cleanup could wipe out the source a newer attach just set.
 */

export interface SourceCallbacks {
  /** A recoverable network problem: the adapter is retrying. */
  onNetworkTrouble?: (retrying: boolean) => void;
  /** Unrecoverable — the video can't be played. */
  onFatalError?: (message: string) => void;
}

export type Detach = () => void;

const isHls = (url: string) => /\.m3u8(\?|$)/i.test(url);

/** The live detach function for each element, and an attach counter to spot stale async work. */
const current = new WeakMap<HTMLVideoElement, Detach>();
const generation = new WeakMap<HTMLVideoElement, number>();

function register(video: HTMLVideoElement, cleanup: () => void): Detach {
  const detach: Detach = () => {
    if (current.get(video) !== detach) return; // stale: a newer source owns the element
    current.delete(video);
    cleanup();
  };
  current.set(video, detach);
  return detach;
}

export async function attachSource(
  video: HTMLVideoElement,
  url: string,
  callbacks: SourceCallbacks = {},
): Promise<Detach> {
  current.get(video)?.(); // tear down whatever was attached before
  const gen = (generation.get(video) ?? 0) + 1;
  generation.set(video, gen);

  const nativeHls = video.canPlayType("application/vnd.apple.mpegurl") !== "";

  if (!isHls(url) || nativeHls) {
    const onError = () => callbacks.onFatalError?.("This video couldn't be loaded.");
    video.addEventListener("error", onError);
    video.src = url;
    return register(video, () => {
      video.removeEventListener("error", onError);
      video.removeAttribute("src");
      video.load();
    });
  }

  const { default: Hls } = await import("hls.js");
  // Another attach started while hls.js was loading — let that one win.
  if (generation.get(video) !== gen) return () => {};
  if (!Hls.isSupported()) {
    callbacks.onFatalError?.("This browser can't play the training video.");
    return () => {};
  }

  const hls = new Hls({ capLevelToPlayerSize: true });
  let networkRetries = 0;

  hls.on(Hls.Events.ERROR, (_event, data) => {
    if (!data.fatal) return;
    if (data.type === Hls.ErrorTypes.NETWORK_ERROR && networkRetries < 5) {
      // Connection dropped: tell the UI and keep retrying with back-off.
      networkRetries += 1;
      callbacks.onNetworkTrouble?.(true);
      setTimeout(() => hls.startLoad(), 1000 * networkRetries);
    } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
      hls.recoverMediaError();
    } else {
      callbacks.onFatalError?.("The video stream stopped. Please reload the page.");
    }
  });
  hls.on(Hls.Events.FRAG_LOADED, () => {
    if (networkRetries > 0) {
      networkRetries = 0;
      callbacks.onNetworkTrouble?.(false);
    }
  });

  hls.loadSource(url);
  hls.attachMedia(video);
  return register(video, () => hls.destroy());
}
