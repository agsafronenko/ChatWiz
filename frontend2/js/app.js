// --- START OF FILE js/app.js ---

document.addEventListener("DOMContentLoaded", function () {
  // --- Get DOM Elements ---
  const usernameElement = document.getElementById("username");
  const messageForm = document.getElementById("messageForm");
  const messageTextInput = document.getElementById("messageText");
  const sendButton = document.getElementById("sendButton");
  const logoutButton = document.getElementById("logoutBtn");
  const authSection = document.getElementById("authSection"); // Keep for potential future use
  const userInfo = document.getElementById("userInfo");
  const googleLoginBtn = document.getElementById("googleLoginBtn");
  const notificationArea = document.getElementById("notificationArea");
  const inviteNotificationTemplate = document.getElementById("inviteNotificationTemplate");

  // --- Initialize Services ---
  authService.init(); // Initialize Google Auth
  const messageManager = new MessageManager();
  const roomManager = new RoomManager(socketService, messageManager); // Pass dependencies

  // --- App State ---
  let currentUser = {
    user_id: null,
    username: "Connecting...",
    is_logged_in: false,
    current_room: "main",
    picture: null,
  };

  // --- Authentication Event Handlers (authService -> UI & Server) ---
  authService.onLogin((googleUser) => {
    console.log("AuthService onLogin triggered:", googleUser);

    // Update local state partly (server will confirm username/ID)
    currentUser.is_logged_in = true;
    currentUser.picture = googleUser.picture; // Store picture URL

    // Update UI immediately for responsiveness
    usernameElement.textContent = googleUser.name; // Use Google name initially
    logoutButton.style.display = "block";
    googleLoginBtn.style.display = "none";
    updateProfilePicture(googleUser.picture); // Add/update profile pic

    // Send auth data to server for verification/user merging
    const authData = {
      id: googleUser.id, // Google ID
      name: googleUser.name,
      isGoogleUser: true, // Flag for the server
      // Include picture if needed by backend, otherwise frontend handles it
      // picture: googleUser.picture
    };
    socketService.sendAuthData(authData);
  });

  authService.onLogout(() => {
    console.log("AuthService onLogout triggered");

    // Update local state
    currentUser.is_logged_in = false;
    currentUser.picture = null;
    // Username will be updated by server via user_info event

    // Update UI
    logoutButton.style.display = "none";
    googleLoginBtn.style.display = "block";
    updateProfilePicture(null); // Remove profile pic

    // Tell server to deauthenticate this session
    socketService.clearAuthData();
  });

  // --- Socket Event Handlers (Server -> UI & State) ---

  // Handle updates about the current user's identity and status
  socketService.onUserInfo((data) => {
    console.log("Socket onUserInfo received:", data);

    // Update current user state completely from server data
    currentUser.user_id = data.user_id;
    currentUser.username = data.username;
    currentUser.is_logged_in = data.is_logged_in;
    currentUser.current_room = data.current_room || currentUser.current_room; // Update room if provided

    // Update RoomManager with current user info
    roomManager.setCurrentUser({ user_id: currentUser.user_id, username: currentUser.username });

    // Update main UI elements
    usernameElement.textContent = currentUser.username;
    roomManager.setCurrentRoom(currentUser.current_room); // Ensure room manager knows the current room

    // Update auth buttons based on login status
    if (currentUser.is_logged_in) {
      logoutButton.style.display = "block";
      googleLoginBtn.style.display = "none";
      // Add profile picture if logged in and picture exists (might be set by onLogin earlier)
      updateProfilePicture(currentUser.picture);
    } else {
      logoutButton.style.display = "none";
      googleLoginBtn.style.display = "block";
      updateProfilePicture(null); // Ensure picture removed if logged out
    }
  });

  // Handle full room/user list updates
  socketService.onUpdateRoomList((data) => {
    // console.log("Socket onUpdateRoomList received:", data); // Noisy
    if (data.rooms && data.users) {
      roomManager.updateRoomData(data.rooms, data.users);
    } else {
      console.warn("Incomplete data received for update_room_list:", data);
    }
  });

  // Handle list of all online users (for invite panel)
  socketService.onUpdateOnlineUsers((userMap) => {
    // console.log("Socket onUpdateOnlineUsers received:", userMap); // Noisy
    roomManager.setOnlineUsers(userMap);
  });

  // Handle joining a room confirmation
  socketService.onJoinedRoom((data) => {
    console.log("Socket onJoinedRoom received:", data);
    if (data.room_name) {
      roomManager.setCurrentRoom(data.room_name); // Update state and UI
      messageManager.setMessages(data.history || []); // Load history for the new room
    }
  });

  // Handle receiving chat history (usually on connect or manual request)
  socketService.onChatHistory((messages) => {
    // Only load if it's for the current room (avoids replacing messages on reconnect if room changed)
    if (roomManager.currentRoom) {
      // Check if currentRoom is set
      console.log(`Received chat history for current room: ${roomManager.currentRoom}`);
      messageManager.setMessages(messages);
    } else {
      console.warn("Received chat history, but current room is not set yet.");
    }
  });

  // Handle a new incoming message
  socketService.onNewMessage((message) => {
    // console.log("Socket onNewMessage received:", message); // Noisy
    // Only add the message if it belongs to the currently active room
    if (message && message.room_name === roomManager.currentRoom) {
      // console.log(`Adding message to current room ${roomManager.currentRoom}:`, message)
      messageManager.addMessage(message);
    } else {
      // console.log(`Ignoring message for room ${message?.room_name}, current room is ${roomManager.currentRoom}`);
    }
  });

  // Handle Invite Notification
  socketService.onInviteNotification((data) => {
    console.log("Displaying invite notification:", data);
    displayInviteNotification(data.inviter_name, data.room_name);
  });

  // Handle Generic Error Feedback
  socketService.onErrorFeedback((data) => {
    console.error("Server Error:", data.message);
    // TODO: Display this error nicely to the user (e.g., temporary banner)
    displayTemporaryFeedback(data.message, "error");
  });

  // Handle Generic Success Feedback
  socketService.onSuccessFeedback((data) => {
    console.log("Server Success:", data.message);
    // TODO: Display this message nicely if needed
    displayTemporaryFeedback(data.message, "success");
  });

  // --- UI Event Handlers ---

  // Handle message form submission
  messageForm.addEventListener("submit", function (event) {
    event.preventDefault();
    const messageText = messageTextInput.value.trim();

    // **FIX:** Remove the `&& currentUser.is_logged_in` check. Allow sending if text exists.
    if (messageText) {
      console.log(`Sending message: "${messageText}" by user ${currentUser.user_id || "anonymous"}`);
      const success = socketService.sendMessage(messageText); // Server knows the room based on user's session

      if (success) {
        messageTextInput.value = ""; // Clear input on successful send attempt
        sendButton.disabled = true; // Disable button after sending
      } else {
        displayTemporaryFeedback("Failed to send message. Check connection.", "error");
      }
    }
    // No need for the 'else if' checking for login status here
  });

  // Enable/disable send button based on input
  messageTextInput.addEventListener("input", function () {
    // **FIX:** Only disable based on text input, not login status.
    sendButton.disabled = !messageTextInput.value.trim();
  });

  // Handle logout button click
  logoutButton.addEventListener("click", function () {
    authService.logout();
  });

  // --- Helper Functions ---
  function updateProfilePicture(pictureUrl) {
    // Remove existing profile picture if any
    const existingProfile = userInfo.querySelector(".user-profile");
    if (existingProfile) {
      existingProfile.remove();
    }

    // Add new profile picture if URL is provided
    if (pictureUrl) {
      const profileDiv = document.createElement("div");
      profileDiv.className = "user-profile";
      profileDiv.innerHTML = `<img src="${pictureUrl}" alt="Profile" class="user-avatar">`;
      // Append it next to the logout button within the auth section for better layout control
      authSection.appendChild(profileDiv);
    }
  }

  function displayInviteNotification(inviterName, roomName) {
    const template = inviteNotificationTemplate.content.cloneNode(true);
    const notificationDiv = template.querySelector(".notification.invite-notification");
    notificationDiv.dataset.roomName = roomName; // Store room name
    template.querySelector(".inviter-name").textContent = inviterName;
    template.querySelector("strong:last-of-type").textContent = roomName; // The second strong tag

    const acceptBtn = template.querySelector(".accept-invite-btn");
    const dismissBtn = template.querySelector(".dismiss-notification-btn");

    acceptBtn.onclick = () => {
      console.log(`Accepting invite for room: ${roomName}`);
      socketService.acceptInvite(roomName);
      notificationDiv.remove(); // Remove notification after clicking
    };

    dismissBtn.onclick = () => {
      notificationDiv.remove();
    };

    notificationArea.appendChild(template);

    // Auto-dismiss after some time?
    setTimeout(() => {
      if (notificationDiv.parentNode) {
        notificationDiv.remove();
      }
    }, 30000); // 30 seconds
  }

  function displayTemporaryFeedback(message, type = "info") {
    const feedbackDiv = document.createElement("div");
    feedbackDiv.className = `notification feedback-notification ${type}`; // Add 'error', 'success', 'info' class
    feedbackDiv.textContent = message;
    notificationArea.appendChild(feedbackDiv);

    setTimeout(() => {
      if (feedbackDiv.parentNode) {
        feedbackDiv.remove();
      }
    }, 5000); // Remove after 5 seconds
  }

  // --- Initial Socket Connection ---
  socketService.initSocket();

  // --- Page Unload Cleanup ---
  window.addEventListener("beforeunload", function () {
    // Note: Disconnecting here might interfere with server-side refresh detection.
    // Consider if this is necessary or if server-side timeout is sufficient.
    // socketService.disconnect();
    console.log("beforeunload: Page is closing.");
  });
});
// --- END OF FILE js/app.js ---
