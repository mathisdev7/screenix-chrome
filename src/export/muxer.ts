import { Muxer as Mp4Muxer, StreamTarget as Mp4Target } from "mp4-muxer";
import { Muxer as WebmMuxer, StreamTarget as WebmTarget } from "webm-muxer";
import type { Size } from "@/render/geometry";
import { ChunkedFile } from "./chunkedFile";

export type Container = "mp4" | "webm";

export interface MuxerVideoTrack {
  codec: "avc" | "V_VP9";
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
  const file = new ChunkedFile();
  const muxer = new WebmMuxer({
    target: new WebmTarget({ onData: (data, position) => file.write(data, position), chunked: true }),
    video: { codec: video.codec, width: video.size.width, height: video.size.height, frameRate: video.fps },
    ...(audio ? { audio: { codec: audio.codec, sampleRate: audio.sampleRate, numberOfChannels: audio.channels } } : {}),
    firstTimestampBehavior: "offset",
  });
  return {
    addVideoChunk: (chunk, metadata) => muxer.addVideoChunk(chunk, metadata),
    addAudioChunk: (chunk, metadata) => muxer.addAudioChunk(chunk, metadata),
    finish: () => {
      muxer.finalize();
      return file.blob("video/webm");
    },
  };
}

function createMp4Muxer(video: MuxerVideoTrack, audio: MuxerAudioTrack | null): Muxer {
  const videoCodec = video.codec === "V_VP9" ? "vp9" : video.codec;
  const audioCodec = audio?.codec === "A_OPUS" ? "opus" : audio?.codec;
  const file = new ChunkedFile();
  const muxer = new Mp4Muxer({
    target: new Mp4Target({ onData: (data, position) => file.write(data, position), chunked: true }),
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
      return file.blob("video/mp4");
    },
  };
}

export function createMuxer(container: Container, video: MuxerVideoTrack, audio: MuxerAudioTrack | null): Muxer {
  return container === "webm" ? createWebmMuxer(video, audio) : createMp4Muxer(video, audio);
}
