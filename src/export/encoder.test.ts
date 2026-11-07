import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { firstWorkingEncoder, H264_ENCODERS } from "./encoder";

type Behavior = "works" | "fails" | "unsupported";

const SIZE = { width: 64, height: 64 };
const globals = globalThis as unknown as Record<string, unknown>;
const originals = { VideoEncoder: globals.VideoEncoder, VideoFrame: globals.VideoFrame };

function stubEncoders(behaviors: Record<HardwareAcceleration, Behavior>) {
  const behaviorOf = (config: VideoEncoderConfig) => behaviors[config.hardwareAcceleration ?? "no-preference"];
  globals.VideoFrame = class {
    close() {}
  };
  globals.VideoEncoder = class {
    static isConfigSupported(config: VideoEncoderConfig) {
      return Promise.resolve({ supported: behaviorOf(config) !== "unsupported" });
    }

    state = "unconfigured";
    private behavior: Behavior = "unsupported";

    constructor(private readonly init: VideoEncoderInit) {}

    configure(config: VideoEncoderConfig) {
      this.behavior = behaviorOf(config);
      this.state = "configured";
    }

    encode() {
      if (this.behavior === "works") this.init.output({} as EncodedVideoChunk);
      else this.init.error(new DOMException("Encoding error", "EncodingError"));
    }

    flush() {
      return this.behavior === "works" ? Promise.resolve() : Promise.reject(new Error("closed"));
    }

    close() {
      this.state = "closed";
    }
  };
}

describe("firstWorkingEncoder", () => {
  beforeEach(() => {
    originals.VideoEncoder = globals.VideoEncoder;
    originals.VideoFrame = globals.VideoFrame;
  });

  afterEach(() => {
    globals.VideoEncoder = originals.VideoEncoder;
    globals.VideoFrame = originals.VideoFrame;
  });

  test("prefers the hardware encoder when it encodes", async () => {
    stubEncoders({ "prefer-hardware": "works", "prefer-software": "works", "no-preference": "works" });
    expect(await firstWorkingEncoder(H264_ENCODERS, SIZE, 60)).toEqual(H264_ENCODERS[0]);
  });

  test("skips an encoder that reports support but fails to encode", async () => {
    stubEncoders({ "prefer-hardware": "fails", "prefer-software": "works", "no-preference": "works" });
    expect(await firstWorkingEncoder(H264_ENCODERS, SIZE, 60)).toEqual(H264_ENCODERS[1]);
  });

  test("returns nothing when no encoder works", async () => {
    stubEncoders({ "prefer-hardware": "unsupported", "prefer-software": "fails", "no-preference": "fails" });
    expect(await firstWorkingEncoder(H264_ENCODERS, SIZE, 60)).toBeNull();
  });
});
