import { normalizeProject } from './project.js';

function bytesToCode(bytes) {
  let binary = '';
  for (let index = 0; index < bytes.length; index += 1) binary += String.fromCharCode(bytes[index]);
  const safe = btoa(binary).replace(/=/g, '').replace(/\+/g, '~').replace(/\//g, '_');
  return safe.match(/.{1,5}/g).join('-');
}

function codeToBytes(code) {
  let safe = String(code || '').replace(/\s/g, '').replace(/-/g, '').replace(/~/g, '+').replace(/_/g, '/');
  while (safe.length % 4) safe += '=';
  const binary = atob(safe);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function lzCompress(input) {
  const output = [];
  let position = 0;
  while (position < input.length) {
    const flagIndex = output.length;
    output.push(0);
    let flags = 0;
    for (let bit = 0; bit < 8 && position < input.length; bit += 1) {
      let bestLength = 0;
      let bestOffset = 0;
      const windowStart = Math.max(0, position - 2048);
      for (let candidate = position - 1; candidate >= windowStart; candidate -= 1) {
        let length = 0;
        while (length < 18 && position + length < input.length && input[candidate + length] === input[position + length]) length += 1;
        if (length > bestLength && length >= 3) {
          bestLength = length;
          bestOffset = position - candidate;
          if (length === 18) break;
        }
      }
      if (bestLength >= 3) {
        const pair = ((bestOffset - 1) << 4) | (bestLength - 3);
        output.push((pair >> 8) & 255, pair & 255);
        position += bestLength;
      } else {
        flags |= (1 << bit);
        output.push(input[position]);
        position += 1;
      }
    }
    output[flagIndex] = flags;
  }
  return new Uint8Array(output);
}

function lzDecompress(input) {
  const output = [];
  let position = 0;
  while (position < input.length) {
    const flags = input[position++];
    for (let bit = 0; bit < 8 && position < input.length; bit += 1) {
      if (flags & (1 << bit)) {
        output.push(input[position++]);
      } else {
        if (position + 1 >= input.length) throw new Error('E_LOAD');
        const pair = (input[position++] << 8) | input[position++];
        const offset = (pair >> 4) + 1;
        const length = (pair & 15) + 3;
        if (offset > output.length) throw new Error('E_LOAD');
        for (let count = 0; count < length; count += 1) output.push(output[output.length - offset]);
      }
    }
  }
  return new Uint8Array(output);
}

async function streamCodec(bytes, kind) {
  const Constructor = kind === 'compress' ? window.CompressionStream : window.DecompressionStream;
  const stream = new Constructor('deflate-raw');
  const writer = stream.writable.getWriter();
  writer.write(bytes);
  writer.close();
  return new Uint8Array(await new Response(stream.readable).arrayBuffer());
}

export async function encodeProject(project, forceFallback) {
  const bytes = new TextEncoder().encode(JSON.stringify(project));
  if (!forceFallback && 'CompressionStream' in window && 'DecompressionStream' in window) {
    try { return 'A' + bytesToCode(await streamCodec(bytes, 'compress')); } catch (error) { /* fallback */ }
  }
  return 'B' + bytesToCode(lzCompress(bytes));
}

export async function decodeProject(code) {
  const clean = String(code || '').trim();
  const method = clean.charAt(0);
  let bytes = codeToBytes(clean.slice(1));
  if (method === 'A') {
    if (!('DecompressionStream' in window)) throw new Error('E_LOAD');
    bytes = await streamCodec(bytes, 'decompress');
  } else if (method === 'B') {
    bytes = lzDecompress(bytes);
  } else {
    throw new Error('E_LOAD');
  }
  return normalizeProject(JSON.parse(new TextDecoder().decode(bytes)));
}

function safePart(value) {
  return String(value || '').replace(/[\\/:*?"<>|\s]+/g, '').slice(0, 30) || 'なまえなし';
}

export function projectFilename(project) {
  const date = new Date();
  const stamp = date.getFullYear().toString() + String(date.getMonth() + 1).padStart(2, '0') + String(date.getDate()).padStart(2, '0');
  return stamp + '_' + safePart(project.author) + '_' + safePart(project.name) + '.bstane';
}

export function downloadProject(project) {
  const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = projectFilename(project);
  link.click();
  setTimeout(function () { URL.revokeObjectURL(link.href); }, 1000);
}

export async function readProjectFile(file) {
  if (!file || file.size > 2 * 1024 * 1024) throw new Error('E_LOAD');
  return normalizeProject(JSON.parse(await file.text()));
}
