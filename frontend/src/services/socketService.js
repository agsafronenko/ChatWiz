import { io } from "socket.io-client";

class SocketService {
  constructor() {
    this.socket = null;
  }

  initSocket() {
    // Connect to the backend server
    this.socket = io(process.env.VUE_APP_SOCKET_ENDPOINT);

    this.socket.on("connect", () => {
      console.log("Connected to server");
    });

    this.socket.on("connect_error", (error) => {
      console.error("Connection error:", error);
    });
  }

  // Send a message to the server
  sendMessage(message) {
    if (this.socket) {
      this.socket.emit("send_message", { message });
    }
  }

  // Event listeners
  onUserInfo(callback) {
    if (this.socket) {
      this.socket.on("user_info", callback);
    }
  }

  onChatHistory(callback) {
    if (this.socket) {
      this.socket.on("chat_history", callback);
    }
  }

  onNewMessage(callback) {
    if (this.socket) {
      this.socket.on("new_message", callback);
    }
  }

  // Cleanup
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
    }
  }
}

// Create singleton instance
export const socketService = new SocketService();
