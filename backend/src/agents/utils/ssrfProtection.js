const dns = require('dns');
const { URL } = require('url');

const PRIVATE_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '::1',
  '0.0.0.0',
  '169.254.169.254',
  'metadata.google.internal',
  'metadata.internal',
  'metadata',
]);

function isPrivateIPv4(parts) {
  if (parts.length !== 4) return false;
  const [a, b, c, d] = parts;
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 0) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 192 && b === 0 && c === 0) return true;
  if (a === 192 && b === 0 && c === 2) return true;
  if (a === 198 && b === 18 && c >= 0 && c <= 255) return true;
  if (a === 198 && b === 51 && c === 100) return true;
  if (a === 203 && b === 0 && c === 113) return true;
  if (a === 224 && b === 0 && c === 0 && d === 1) return true;
  if (a === 240 && b === 0 && c === 0 && d <= 4) return true;
  if (a === 255 && b === 255 && c === 255 && d === 255) return true;
  return false;
}

function isPrivateIP(ip) {
  ip = ip.toLowerCase().trim();

  if (ip === '::1') return true;

  if (ip.startsWith('fc') || ip.startsWith('fd')) return true;
  if (ip.startsWith('fe80')) return true;

  if (ip.startsWith('::ffff:')) {
    const mapped = ip.substring(7);
    if (mapped.includes(':')) return true;
    const parts = mapped.split('.').map(Number);
    if (parts.length === 4 && isPrivateIPv4(parts)) return true;
  }

  const parts = ip.split('.').map(Number);
  if (parts.length === 4 && !parts.some(isNaN) && isPrivateIPv4(parts)) return true;

  return false;
}

function resolveHostname(hostname) {
  return new Promise((resolve, reject) => {
    dns.lookup(hostname, { all: true }, (err, addresses) => {
      if (err) return reject(err);
      resolve(addresses.map((a) => a.address));
    });
  });
}

async function validateUrl(urlString, options = {}) {
  if (!urlString || typeof urlString !== 'string') {
    throw new Error('Invalid URL');
  }

  let url;
  try {
    url = new URL(urlString);
  } catch {
    throw new Error('Invalid URL format');
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error(`Blocked protocol: ${url.protocol}`);
  }

  const hostname = url.hostname.replace(/^\[|\]$/g, '');

  if (PRIVATE_HOSTS.has(hostname.toLowerCase())) {
    throw new Error(`Blocked private host: ${hostname}`);
  }

  if (options.allowPrivate) {
    return url.toString();
  }

  try {
    const addresses = await resolveHostname(hostname);
    for (const address of addresses) {
      if (isPrivateIP(address)) {
        throw new Error(`Blocked private IP: ${address}`);
      }
    }
  } catch (err) {
    if (
      err.message &&
      (err.message.includes('Blocked private') || err.message.includes('Blocked private host'))
    ) {
      throw err;
    }
  }

  return url.toString();
}

async function validateRedirectUrl(urlString) {
  return validateUrl(urlString);
}

module.exports = {
  validateUrl,
  validateRedirectUrl,
  isPrivateIP,
  resolveHostname,
};
