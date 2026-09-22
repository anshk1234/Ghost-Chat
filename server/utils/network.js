import os from 'os';

/**
 * Get the preferred local IPv4 network address of this machine.
 * Useful for LAN connections (e.g., 192.168.x.x or 10.x.x.x).
 */
export function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();
  const addresses = [];

  for (const interfaceName of Object.keys(interfaces)) {
    for (const iface of interfaces[interfaceName]) {
      // Skip internal (127.0.0.1) and non-IPv4 addresses
      if (iface.family === 'IPv4' && !iface.internal) {
        addresses.push({
          name: interfaceName,
          address: iface.address,
        });
      }
    }
  }

  // Prefer Wi-Fi / Ethernet standard local ranges
  const preferred = addresses.find(
    (a) =>
      a.address.startsWith('192.168.') ||
      a.address.startsWith('10.') ||
      a.address.startsWith('172.16.')
  );

  return preferred ? preferred.address : (addresses[0]?.address || '127.0.0.1');
}
