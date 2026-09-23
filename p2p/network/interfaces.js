import os from 'os';

/**
 * Get preferred local IPv4 interface.
 */
export function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();
  const addresses = [];

  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        addresses.push({
          name,
          address: iface.address,
        });
      }
    }
  }

  const preferred = addresses.find(
    (a) =>
      a.address.startsWith('192.168.') ||
      a.address.startsWith('10.') ||
      a.address.startsWith('172.16.')
  );

  return preferred ? preferred.address : (addresses[0]?.address || '127.0.0.1');
}
