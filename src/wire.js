// Низкий уровень protobuf: varint, теги полей, fixed32, base64.
// Работает и в браузере, и в Node — отсюда проверки на atob/btoa.

export function readVarint(buf, pos) {
  let result = 0, shift = 1, byte;
  do {
    byte = buf[pos++];
    result += (byte & 0x7f) * shift;
    shift *= 128;
  } while (byte & 0x80);
  return [result, pos];
}

export function writeVarint(n) {
  const out = [];
  while (n > 0x7f) {
    out.push((n & 0x7f) | 0x80);
    n = Math.floor(n / 128);
  }
  out.push(n);
  return out;
}

export function writeTag(field, wire) {
  return writeVarint(field * 8 + wire);
}

export function writeFixed32(value) {
  return [value & 255, (value >>> 8) & 255, (value >>> 16) & 255, (value >>> 24) & 255];
}

export function readFixed32(buf, pos) {
  const v = (buf[pos] | (buf[pos + 1] << 8) | (buf[pos + 2] << 16) | (buf[pos + 3] << 24)) >>> 0;
  return [v, pos + 4];
}

export function b64ToBytes(s) {
  if (typeof atob === 'function') {
    const bin = atob(s);
    const a = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
    return a;
  }
  return new Uint8Array(Buffer.from(s, 'base64'));
}

export function bytesToB64(bytes) {
  if (typeof btoa === 'function') {
    let bin = '';
    for (const b of bytes) bin += String.fromCharCode(b);
    return btoa(bin);
  }
  return Buffer.from(bytes).toString('base64');
}
