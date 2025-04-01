class SocketService {
  constructor() {
    this.socket = null;
    this.eventCallbacks = {
      userInfo: [],
      chatHistory: [],
      newMessage: []
    };
  }

  initSocket() {
    // Get the server URL from an environment variable or use a default
    const serverUrl = window.SOCKET_ENDPOINT || 'http://localhost:5000';
    
    // Connect to the backend server
    this.socket = io(serverUrl);

    this.socket.on("connect", () => {
      console.log("Connected to server");
    });

    this.socket.on("connect_error", (error) => {
      console.error("Connection error:", error);
    });

    // Set up handlers for incoming events
    this.socket.on("user_info", (data) => {
      this.eventCallbacks.userInfo.forEach(callback => callback(data));
    });

    this.socket.on("chat_history", (messages) => {
      this.eventCallbacks.chatHistory.forEach(callback => callback(messages));
    });

    this.socket.on("new_message", (message) => {
      this.eventCallbacks.newMessage.forEach(callback => callback(message));
    });
  }

  // Send a message to the server
  sendMessage(message) {
    if (this.socket && this.socket.connected) {
      this.socket.emit("send_message", { message });
      return true;
    }
    return false;
  }

  // Event listener registration
  onUserInfo(callback) {
    if (typeof callback === 'function') {
      this.eventCallbacks.userInfo.push(callback);
    }
  }

  onChatHistory(callback) {
    if (typeof callback === 'function') {
      this.eventCallbacks.chatHistory.push(callback);
    }
  }

  onNewMessage(callback) {
    if (typeof callback === 'function') {
      this.eventCallbacks.newMessage.push(callback);
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
const socketService = new SocketService();
