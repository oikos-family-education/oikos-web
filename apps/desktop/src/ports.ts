import net from 'node:net';

/** Fixed, uncommon ports. The web build bakes the API port into its `/api` rewrite. */
export const WEB_PORT = 47321;
export const API_PORT = 47322;
export const PG_PORT = 47323;

const HOST = '127.0.0.1';

/** True when something accepts connections on the port, on any interface. */
function acceptsConnections(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host: HOST });
    const done = (busy: boolean) => {
      socket.destroy();
      resolve(busy);
    };
    socket.setTimeout(1_000, () => done(false));
    socket.once('connect', () => done(true));
    socket.once('error', () => done(false));
  });
}

/** True when we cannot bind the port ourselves (in use, or reserved by the OS). */
function cannotBind(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.once('error', () => resolve(true));
    srv.listen({ port, host: HOST, exclusive: true }, () => srv.close(() => resolve(false)));
  });
}

/** Returns the ports that are already taken, in the order given. */
export async function findBusyPorts(ports: number[]): Promise<number[]> {
  const busy = await Promise.all(
    ports.map(async (port) => (await acceptsConnections(port)) || (await cannotBind(port))),
  );
  return ports.filter((_, i) => busy[i]);
}
