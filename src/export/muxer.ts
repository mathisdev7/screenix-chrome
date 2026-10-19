import { ArrayBufferTarget as Mp4Target, Muxer as Mp4Muxer } from "mp4-muxer";
import { ArrayBufferTarget as WebmTarget, Muxer as WebmMuxer } from "webm-muxer";
import type { Size } from "@/render/geometry";

export type Container = "mp4" | "webm";

export interface MuxerVideoTrack {
  codec: "av1" | "avc" | "V_VP9";
  size: Size;
  fps: number;
}

export interface MuxerAudioTrack {
  codec: "aac" | "opus" | "A_OPUS";
  sampleRate: number;
  channels: number;
}

export interface Muxer {
  addVideoChunk(chunk: EncodedVideoChunk, metadata?: EncodedVideoChunkMetadata): void;
  addAudioChunk(chunk: EncodedAudioChunk, metadata?: EncodedAudioChunkMetadata): void;
  finish(): Blob;
}

function createWebmMuxer(video: MuxerVideoTrack, audio: MuxerAudioTrack | null): Muxer {
  const muxer = new WebmMuxer({
    target: new WebmTarget(),
    video: { codec: video.codec, width: video.size.width, height: video.size.height, frameRate: video.fps },
    ...(audio ? { audio: { codec: audio.codec, sampleRate: audio.sampleRate, numberOfChannels: audio.channels } } : {}),
    firstTimestampBehavior: "offset",
  });
  return {
    addVideoChunk: (chunk, metadata) => muxer.addVideoChunk(chunk, metadata),
    addAudioChunk: (chunk, metadata) => muxer.addAudioChunk(chunk, metadata),
    finish: () => {
      muxer.finalize();
      return new Blob([muxer.target.buffer], { type: "video/webm" });
    },
  };
}

function createMp4Muxer(video: MuxerVideoTrack, audio: MuxerAudioTrack | null): Muxer {
  const videoCodec = video.codec === "V_VP9" ? "vp9" : video.codec;
  const audioCodec = audio?.codec === "A_OPUS" ? "opus" : audio?.codec;
  const muxer = new Mp4Muxer({
    target: new Mp4Target(),
    video: { codec: videoCodec, width: video.size.width, height: video.size.height, frameRate: video.fps },
    ...(audio && audioCodec ? { audio: { codec: audioCodec, sampleRate: audio.sampleRate, numberOfChannels: audio.channels } } : {}),
    fastStart: "in-memory",
    firstTimestampBehavior: "offset",
  });
  return {
    addVideoChunk: (chunk, metadata) => muxer.addVideoChunk(chunk, metadata),
    addAudioChunk: (chunk, metadata) => muxer.addAudioChunk(chunk, metadata),
    finish: () => {
      muxer.finalize();
      return new Blob([muxer.target.buffer], { type: "video/mp4" });
    },
  };
}

export function createMuxer(container: Container, video: MuxerVideoTrack, audio: MuxerAudioTrack | null): Muxer {
  return container === "webm" ? createWebmMuxer(video, audio) : createMp4Muxer(video, audio);
}
