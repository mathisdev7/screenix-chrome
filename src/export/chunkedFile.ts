interface Part {
  position: number;
  data: Uint8Array<ArrayBuffer>;
}

export class ChunkedFile {
  private readonly parts: Part[] = [];
  private size = 0;

  write(data: Uint8Array, position: number) {
    const end = position + data.byteLength;
    for (const part of this.parts) {
      const from = Math.max(position, part.position);
      const to = Math.min(end, part.position + part.data.byteLength);
      if (from < to) part.data.set(data.subarray(from - position, to - position), from - part.position);
    }
    if (end <= this.size) return;
    if (position > this.size) this.append(new Uint8Array(position - this.size));
    this.append(data.slice(Math.max(0, this.size - position)));
  }

  blob(type: string): Blob {
    return new Blob(this.parts.map((part) => part.data), { type });
  }

  private append(data: Uint8Array<ArrayBuffer>) {
    this.parts.push({ position: this.size, data });
    this.size += data.byteLength;
  }
}
