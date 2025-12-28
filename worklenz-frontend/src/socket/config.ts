import config from '@/config/env';

export const SOCKET_CONFIG = {
  url: config.socketUrl,
  options: {
    transports: ['polling', 'websocket'],
    path: '/socket',
    upgrade: true,
    withCredentials: true,
  },
};
