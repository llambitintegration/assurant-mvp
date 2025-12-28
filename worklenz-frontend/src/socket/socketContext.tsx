import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import io, { Socket } from 'socket.io-client';
import { useTranslation } from 'react-i18next';

import { SOCKET_CONFIG } from './config';
import logger from '@/utils/errorLogger';
import { Modal, message } from '@/shared/antd-imports';
import { SocketEvents } from '@/shared/socket-events';
import { getUserSession } from '@/utils/session-helper';

let globalSocketInstance: Socket | null = null;

interface SocketContextType {
  socket: Socket | null;
  connected: boolean;
  modalContextHolder: React.ReactElement<any>;
}

const SocketContext = createContext<SocketContextType | null>(null);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { t } = useTranslation('common');
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [modal, contextHolder] = Modal.useModal();
  const profile = getUserSession();
  const [messageApi, messageContextHolder] = message.useMessage();
  const hasShownConnectedMessage = useRef(false);
  const isInitialized = useRef(false);
  const messageApiRef = useRef(messageApi);
  const tRef = useRef(t);
  const errorCount = useRef(0);
  const hasShownErrorMessage = useRef(false);

  useEffect(() => {
    messageApiRef.current = messageApi;
  }, [messageApi]);

  useEffect(() => {
    tRef.current = t;
  }, [t]);

  useEffect(() => {
    if (isInitialized.current) {
      return;
    }

    const socketUrl = SOCKET_CONFIG.url;
    if (!socketUrl || socketUrl === '' || socketUrl === '""') {
      logger.info('Socket URL not configured, skipping socket connection');
      isInitialized.current = true;
      return;
    }

    if (!socketRef.current && !globalSocketInstance) {
      isInitialized.current = true;
      globalSocketInstance = io(SOCKET_CONFIG.url, {
        ...SOCKET_CONFIG.options,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 2000,
        reconnectionDelayMax: 10000,
        timeout: 20000,
        autoConnect: false,
      });
      socketRef.current = globalSocketInstance;
    } else if (globalSocketInstance && !socketRef.current) {
      socketRef.current = globalSocketInstance;
      isInitialized.current = true;
    }

    const socket = socketRef.current;

    if (!socket) return;

    socket.on('connect', () => {
      logger.info('Socket connected');
      setConnected(true);
      errorCount.current = 0;
      hasShownErrorMessage.current = false;

      if (!hasShownConnectedMessage.current) {
        messageApiRef.current.success(tRef.current('connection-restored'));
        hasShownConnectedMessage.current = true;
      }
    });

    if (profile && profile.id) {
      socket.emit(SocketEvents.LOGIN.toString(), profile.id);
      socket.once(SocketEvents.LOGIN.toString(), () => {
        logger.info('Socket login success');
      });
    }

    socket.on('connect_error', error => {
      logger.error('Connection error', { error });
      setConnected(false);
      errorCount.current += 1;
      
      if (!hasShownErrorMessage.current && errorCount.current <= 1) {
        hasShownErrorMessage.current = true;
      }
      hasShownConnectedMessage.current = false;
    });

    socket.on('disconnect', () => {
      logger.info('Socket disconnected');
      setConnected(false);
      hasShownConnectedMessage.current = false;

      if (profile && profile.id) {
        socket.emit(SocketEvents.LOGOUT.toString(), profile.id);
      }
    });

    socket.on(SocketEvents.INVITATIONS_UPDATE.toString(), (message: string) => {
      logger.info(message);
    });

    socket.on(
      SocketEvents.TEAM_MEMBER_REMOVED.toString(),
      (data: { teamId: string; message: string }) => {
        if (!data) return;

        if (profile && profile.team_id === data.teamId) {
          modal.confirm({
            title: 'You no longer have permissions to stay on this team!',
            content: data.message,
            closable: false,
            cancelButtonProps: { disabled: true },
            onOk: () => window.location.reload(),
          });
        }
      }
    );

    socket.connect();

    return () => {
      if (socket) {
        socket.off('connect');
        socket.off('connect_error');
        socket.off('disconnect');
        socket.off(SocketEvents.INVITATIONS_UPDATE.toString());
        socket.off(SocketEvents.TEAM_MEMBER_REMOVED.toString());
        socket.removeAllListeners();

        socket.close();
        socketRef.current = null;
        globalSocketInstance = null;
        hasShownConnectedMessage.current = false;
        isInitialized.current = false;
        errorCount.current = 0;
        hasShownErrorMessage.current = false;
      }
    };
  }, []);

  const value = {
    socket: socketRef.current,
    connected,
    modalContextHolder: contextHolder,
  };

  return (
    <SocketContext.Provider value={value}>
      {messageContextHolder}
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};
