import net from 'node:net';
import { describe, expect, it } from 'vitest';
import { API_PORT, PG_PORT, WEB_PORT, findBusyPorts } from '../src/ports';

function listen(port: number, host: string): Promise<net.Server> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.once('error', reject);
    srv.listen(port, host, () => resolve(srv));
  });
}

describe('ports', () => {
  it('uses the fixed desktop ports', () => {
    expect([WEB_PORT, API_PORT, PG_PORT]).toEqual([47321, 47322, 47323]);
  });

  it('findBusyPorts reports an occupied port', async () => {
    const srv = net.createServer().listen(47399, '127.0.0.1');
    expect(await findBusyPorts([47399, 47398])).toEqual([47399]);
    srv.close();
  });

  it('reports a port held by a listener on all interfaces', async () => {
    const srv = await listen(47397, '0.0.0.0');
    try {
      expect(await findBusyPorts([47397])).toEqual([47397]);
    } finally {
      srv.close();
    }
  });

  it('reports nothing when every port is free, and frees its probes', async () => {
    expect(await findBusyPorts([47396, 47395])).toEqual([]);
    // The probes must not keep the ports: we can still bind them.
    const srv = await listen(47396, '127.0.0.1');
    srv.close();
  });
});
