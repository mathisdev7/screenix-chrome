declare class MediaStreamTrackProcessor<T extends AudioData | VideoFrame> {
  constructor(init: { track: MediaStreamTrack });
  readonly readable: ReadableStream<T>;
}
