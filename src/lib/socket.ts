"use client";

import { io, Socket } from "socket.io-client";
import { useEffect, useState } from "react";

let socket: Socket;

export const useSocket = () => {
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!socket) {
      socket = io();
    }

    socket.on("connect", () => {
      setConnected(true);
    });

    socket.on("disconnect", () => {
      setConnected(false);
    });

    return () => {
      socket.off("connect");
      socket.off("disconnect");
    };
  }, []);

  return { socket, connected };
};
