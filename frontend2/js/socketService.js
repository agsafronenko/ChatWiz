// --- START OF FILE js/socketService.js ---

class SocketService {
  constructor() {
    this.socket = null;
    this.eventCallbacks = {
      userInfo: [],
      chatHistory: [],
      newMessage: [],
      updateRoomList: [], // NEW: For room/user list updates
      updateUserList: [], // NEW: For specific room user list update (might consolidate)
      updateOnlineUsers: [], // NEW: List of all online users {id: name}
      joinedRoom: [], // NEW: Confirmation after joining a room
      inviteNotification: [], // NEW: Received an invite
      errorFeedback: [], // NEW: Generic error messages from server
      successFeedback: [], // NEW: Generic success messages
    };
    this.authData = null;
    this.userId = localStorage.getItem("chatUserId"); // Keep track of our own ID
  }

  initSocket() {
    const serverUrl = CONFIG.SOCKET_ENDPOINT;
    const options = {};

    // Always send user_id if we have one
    if (this.userId) {
      console.log("Connecting with user_id:", this.userId);
      options.query = { user_id: this.userId };
    } else {
      console.log("Connecting without user_id (new user).");
    }

    // Connect to the backend server
    this.socket = io(serverUrl, options);

    this.socket.on("connect", () => {
      console.log("Connected to server with SID:", this.socket.id);
      // If we have auth data (e.g., from Google login before connect), send it
      if (this.authData) {
        this.sendAuthData(this.authData);
      }
      // No need to explicitly join 'main', server handles on connect
    });

    this.socket.on("connect_error", (error) => {
      console.error("Connection error:", error);
      // TODO: Implement retry logic or UI feedback
    });

    this.socket.on("disconnect", (reason) => {
      console.log("Disconnected from server:", reason);
      // TODO: Handle disconnect UI, e.g., show disconnected status
    });

    // --- Standard Event Handlers ---
    this.socket.on("user_info", (data) => {
      console.log("Received user_info:", data);
      // Store user ID in localStorage IF received and different
      if (data.user_id && data.user_id !== this.userId) {
        console.log("Storing new/updated user_id:", data.user_id);
        this.userId = data.user_id;
        localStorage.setItem("chatUserId", data.user_id);
        // If ID changes, might need to reconnect or re-auth? Check server logic.
        // For now, just update local state.
      } else if (!data.user_id) {
        console.warn("Received user_info without user_id");
      }
      this._notifyCallbacks("userInfo", data);
    });

    this.socket.on("chat_history", (messages) => {
      console.log("Received chat_history:", messages);
      this._notifyCallbacks("chatHistory", messages);
    });

    this.socket.on("new_message", (message) => {
      // console.log("Received new_message:", message); // Can be very noisy
      this._notifyCallbacks("newMessage", message);
    });

    // --- NEW Room Event Handlers ---
    this.socket.on("update_room_list", (data) => {
      // console.log("Received update_room_list:", data); // Can be noisy
      this._notifyCallbacks("updateRoomList", data);
    });

    this.socket.on("update_user_list", (data) => {
      console.log("Received update_user_list:", data);
      // Note: This might be redundant if update_room_list sends full user data.
      // Keeping it separate allows for targeted updates if needed.
      this._notifyCallbacks("updateUserList", data);
    });

    this.socket.on("update_online_users", (data) => {
      // console.log("Received update_online_users:", data); // Can be noisy
      this._notifyCallbacks("updateOnlineUsers", data);
    });

    this.socket.on("joined_room", (data) => {
      console.log("Received joined_room confirmation:", data);
      this._notifyCallbacks("joinedRoom", data);
    });

    this.socket.on("invite_notification", (data) => {
      console.log("Received invite_notification:", data);
      this._notifyCallbacks("inviteNotification", data);
    });

    this.socket.on("error_feedback", (data) => {
      console.error("Received server error feedback:", data.message);
      this._notifyCallbacks("errorFeedback", data);
      // TODO: Show this error to the user in a non-alert way
    });

    this.socket.on("success_feedback", (data) => {
      console.log("Received server success feedback:", data.message);
      this._notifyCallbacks("successFeedback", data);
      // TODO: Show this message to the user if needed
    });
  }

  // Helper to notify registered callbacks
  _notifyCallbacks(eventName, data) {
    if (this.eventCallbacks[eventName]) {
      this.eventCallbacks[eventName].forEach((callback) => {
        try {
          callback(data);
        } catch (e) {
          console.error(`Error in callback for ${eventName}:`, e);
        }
      });
    }
  }

  // Send authentication data to server
  sendAuthData(userData) {
    this.authData = userData; // Store it in case we need to resend on reconnect
    if (this.socket && this.socket.connected) {
      console.log("Sending authenticate event:", userData);
      this.socket.emit("authenticate", userData);
    } else {
      console.warn("Socket not connected, storing auth data for later.");
    }
  }

  // Clear authentication data (on logout)
  clearAuthData() {
    this.authData = null;
    // Also clear stored user ID on explicit logout? Maybe not, user might log back in.
    // localStorage.removeItem("chatUserId");
    // this.userId = null;
    if (this.socket && this.socket.connected) {
      console.log("Sending deauthenticate event");
      this.socket.emit("deauthenticate");
    }
  }

  // Send a message to the server (no change needed, server knows room)
  sendMessage(messageText) {
    if (this.socket && this.socket.connected) {
      console.log("Sending message:", messageText);
      this.socket.emit("send_message", { message: messageText });
      return true;
    }
    console.warn("Cannot send message, socket not connected.");
    return false;
  }

  // --- NEW Room Actions ---
  joinRoom(roomName) {
    if (this.socket && this.socket.connected) {
      console.log(`Emitting join_room: ${roomName}`);
      this.socket.emit("join_room", { room_name: roomName });
    } else {
      console.warn("Cannot join room, socket not connected.");
    }
  }

  createRoom(roomName, type) {
    if (this.socket && this.socket.connected) {
      console.log(`Emitting create_room: ${roomName}, type: ${type}`);
      this.socket.emit("create_room", { room_name: roomName, type: type });
    } else {
      console.warn("Cannot create room, socket not connected.");
    }
  }

  inviteUser(targetUserId, roomName) {
    if (this.socket && this.socket.connected) {
      console.log(`Emitting invite_user: target=${targetUserId}, room=${roomName}`);
      this.socket.emit("invite_user", { target_user_id: targetUserId, room_name: roomName });
    } else {
      console.warn("Cannot invite user, socket not connected.");
    }
  }

  acceptInvite(roomName) {
    if (this.socket && this.socket.connected) {
      console.log(`Emitting accept_invite: room=${roomName}`);
      this.socket.emit("accept_invite", { room_name: roomName });
    } else {
      console.warn("Cannot accept invite, socket not connected.");
    }
  }

  // --- Event listener registration ---
  _registerCallback(eventName, callback) {
    if (typeof callback === "function") {
      this.eventCallbacks[eventName].push(callback);
    } else {
      console.warn(`Attempted to register non-function callback for ${eventName}`);
    }
  }

  onUserInfo(callback) {
    this._registerCallback("userInfo", callback);
  }
  onChatHistory(callback) {
    this._registerCallback("chatHistory", callback);
  }
  onNewMessage(callback) {
    this._registerCallback("newMessage", callback);
  }
  onUpdateRoomList(callback) {
    this._registerCallback("updateRoomList", callback);
  }
  onUpdateUserList(callback) {
    this._registerCallback("updateUserList", callback);
  }
  onUpdateOnlineUsers(callback) {
    this._registerCallback("updateOnlineUsers", callback);
  }
  onJoinedRoom(callback) {
    this._registerCallback("joinedRoom", callback);
  }
  onInviteNotification(callback) {
    this._registerCallback("inviteNotification", callback);
  }
  onErrorFeedback(callback) {
    this._registerCallback("errorFeedback", callback);
  }
  onSuccessFeedback(callback) {
    this._registerCallback("successFeedback", callback);
  }

  // Cleanup
  disconnect() {
    if (this.socket) {
      console.log("Disconnecting socket.");
      this.socket.disconnect();
    }
  }
}

// Create singleton instance
const socketService = new SocketService();

// --- END OF FILE js/socketService.js ---
