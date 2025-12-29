import config from '@/config/env';

const getSocketUrl = (): string | undefined => {
  const socketUrl = config.socketUrl;
  if (socketUrl && socketUrl.length > 0) {
    return socketUrl;
  }
  return undefined;
};

export const SOCKET_CONFIG = {
  url: getSocketUrl(),
  options: {
    transports: ['polling', 'websocket'],
    path: '/socket',
    upgrade: true,
    withCredentials: true,
  },
};
