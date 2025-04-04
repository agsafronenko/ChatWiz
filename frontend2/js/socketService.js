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
    const serverUrl = CONFIG.SOCKET_ENDPOINT;

    // Add query parameter with saved user_id if available
    const userId = localStorage.getItem("chatUserId");
    const options = {};

    if (userId) {
      options.query = { user_id: userId };
    }

    // Connect to the backend server with query parameters
    this.socket = io(serverUrl, options);

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
      // Store user ID in localStorage
      if (data.user_id) {
        localStorage.setItem("chatUserId", data.user_id);
      }

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
