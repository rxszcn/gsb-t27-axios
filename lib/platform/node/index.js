import crypto from 'crypto';
import { Readable, PassThrough } from 'stream';
import URLSearchParams from './classes/URLSearchParams.js';
import FormData from './classes/FormData.js';

const ALPHA = 'abcdefghijklmnopqrstuvwxyz';

const DIGIT = '0123456789';

const ALPHABET = {
  DIGIT,
  ALPHA,
  ALPHA_DIGIT: ALPHA + ALPHA.toUpperCase() + DIGIT,
};

const generateString = (size = 16, alphabet = ALPHABET.ALPHA_DIGIT) => {
  let str = '';
  const { length } = alphabet;
  const randomValues = new Uint32Array(size);
  crypto.randomFillSync(randomValues);
  for (let i = 0; i < size; i++) {
    str += alphabet[randomValues[i] % length];
  }

  return str;
};

/**
 * Convert a Node.js stream (such as the CombinedStream produced by the
 * `form-data` package) into a web ReadableStream that fetch/undici can
 * consume. Piping through a PassThrough first normalizes string chunks to
 * Buffers, which Readable.toWeb() would otherwise reject.
 *
 * @param {stream.Readable} nodeStream The Node.js stream to convert
 *
 * @returns {ReadableStream} A web ReadableStream of Uint8Array chunks
 */
const toWebStream = (nodeStream) => Readable.toWeb(nodeStream.pipe(new PassThrough()));

export default {
  isNode: true,
  classes: {
    URLSearchParams,
    FormData,
    Blob: (typeof Blob !== 'undefined' && Blob) || null,
  },
  ALPHABET,
  generateString,
  protocols: ['http', 'https', 'file', 'data'],
  toWebStream,
};
