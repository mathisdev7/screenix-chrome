import { describe, expect, test } from "bun:test";
import { ArrayBufferTarget as Mp4BufferTarget, Muxer as Mp4Muxer, StreamTarget as Mp4StreamTarget } from "mp4-muxer";
import { ArrayBufferTarget as WebmBufferTarget, Muxer as WebmMuxer, StreamTarget as WebmStreamTarget } from "webm-muxer";
import { ChunkedFile } from "./chunkedFile";

const SMALLEST_CHUNK = 1024;
const FRAME_COUNT = 90;

const bytes = async (file: ChunkedFile) => new Uint8Array(await file.blob("application/octet-stream").arrayBuffer());

function frame(index: number): Uint8Array {
  return Uint8Array.from({ length: 300 + ((index * 37) % 500) }, (_, at) => (index * 31 + at) % 256);
}

const frameType = (index: number) => (index % 30 === 0 ? "key" : "delta");
const frameTime = (index: number) => Math.round((index * 1_000_000) / 30);
const DECODER_CONFIG = { codec: "avc1.42001f", codedWidth: 64, codedHeight: 64, description: Uint8Array.of(1, 66, 0, 31, 255, 225, 0, 0, 1, 0, 0) };

function muxMp4(muxer: Mp4Muxer<Mp4BufferTarget | Mp4StreamTarget>) {
  for (let index = 0; index < FRAME_COUNT; index++) {
    muxer.addVideoChunkRaw(frame(index), frameType(index), frameTime(index), frameTime(1), index === 0 ? { decoderConfig: DECODER_CONFIG } : undefined);
  }
  muxer.finalize();
}

function muxWebm(muxer: WebmMuxer<WebmBufferTarget | WebmStreamTarget>) {
  for (let index = 0; index < FRAME_COUNT; index++) muxer.addVideoChunkRaw(frame(index), frameType(index), frameTime(index));
  muxer.finalize();
}

describe("ChunkedFile", () => {
  test("appends writes in order", async () => {
    const file = new ChunkedFile();
    file.write(Uint8Array.of(1, 2), 0);
    file.write(Uint8Array.of(3), 2);
    expect([...(await bytes(file))]).toEqual([1, 2, 3]);
  });

  test("overwrites earlier bytes across parts and extends past the end", async () => {
    const file = new ChunkedFile();
    file.write(Uint8Array.of(1, 2, 3), 0);
    file.write(Uint8Array.of(4, 5, 6), 3);
    file.write(Uint8Array.of(9, 9, 9, 9, 7, 8), 2);
    expect([...(await bytes(file))]).toEqual([1, 2, 9, 9, 9, 9, 7, 8]);
  });

  test("fills a gap with zeros", async () => {
    const file = new ChunkedFile();
    file.write(Uint8Array.of(1), 0);
    file.write(Uint8Array.of(2), 3);
    expect([...(await bytes(file))]).toEqual([1, 0, 0, 2]);
  });

  test("matches the single-buffer MP4", async () => {
    const reference = new Mp4Muxer({ target: new Mp4BufferTarget(), video: { codec: "avc", width: 64, height: 64 }, fastStart: "in-memory" });
    muxMp4(reference);
    const file = new ChunkedFile();
    const chunked = new Mp4Muxer({
      target: new Mp4StreamTarget({ onData: (data, position) => file.write(data, position), chunked: true, chunkSize: SMALLEST_CHUNK }),
      video: { codec: "avc", width: 64, height: 64 },
      fastStart: "in-memory",
    });
    muxMp4(chunked);
    expect(await bytes(file)).toEqual(new Uint8Array(reference.target.buffer));
  });

  test("matches the single-buffer WebM, whose header is rewritten at the end", async () => {
    const reference = new WebmMuxer({ target: new WebmBufferTarget(), video: { codec: "V_VP9", width: 64, height: 64 } });
    muxWebm(reference);
    const file = new ChunkedFile();
    const chunked = new WebmMuxer({
      target: new WebmStreamTarget({ onData: (data, position) => file.write(data, position), chunked: true, chunkSize: SMALLEST_CHUNK }),
      video: { codec: "V_VP9", width: 64, height: 64 },
    });
    muxWebm(chunked);
    expect(await bytes(file)).toEqual(new Uint8Array(reference.target.buffer));
  });
});
