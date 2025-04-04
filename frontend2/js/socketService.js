class SocketService {
  constructor() {
    this.socket = null;
    this.eventCallbacks = {
      userInfo: [],
      chatHistory: [],
      newMessage: [],
    };
    this.authData = null;
  }

  initSocket() {
    // Get the server URL from an environment variable or use a default
    const serverUrl = CONFIG.SOCKET_ENDPOINT;

    // Connect to the backend server
    this.socket = io(serverUrl);

    this.socket.on("connect", () => {
      console.log("Connected to server");

      // If we have auth data, try to send it after connection
      if (this.authData) {
        this.sendAuthData(this.authData);
      }
    });

    this.socket.on("connect_error", (error) => {
      console.error("Connection error:", error);
    });

    // Set up handlers for incoming events
    this.socket.on("user_info", (data) => {
      this.eventCallbacks.userInfo.forEach((callback) => callback(data));
    });

    this.socket.on("chat_history", (messages) => {
      this.eventCallbacks.chatHistory.forEach((callback) => callback(messages));
    });

    this.socket.on("new_message", (message) => {
      this.eventCallbacks.newMessage.forEach((callback) => callback(message));
    });
  }

  // Send authentication data to server
  sendAuthData(userData) {
    if (this.socket && this.socket.connected) {
      this.socket.emit("authenticate", userData);
      this.authData = userData;
    } else {
      // Store for later when connection is established
      this.authData = userData;
    }
  }

  // Clear authentication data
  clearAuthData() {
    this.authData = null;
    if (this.socket && this.socket.connected) {
      this.socket.emit("deauthenticate");
    }
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
    if (typeof callback === "function") {
      this.eventCallbacks.userInfo.push(callback);
    }
  }

  onChatHistory(callback) {
    if (typeof callback === "function") {
      this.eventCallbacks.chatHistory.push(callback);
    }
  }

  onNewMessage(callback) {
    if (typeof callback === "function") {
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
