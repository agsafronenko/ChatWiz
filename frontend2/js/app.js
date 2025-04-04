// Main application initialization
document.addEventListener("DOMContentLoaded", function () {
  // Get DOM elements
  const usernameElement = document.getElementById("username");
  const messageForm = document.getElementById("messageForm");
  const messageTextInput = document.getElementById("messageText");
  const sendButton = document.getElementById("sendButton");
  const logoutButton = document.getElementById("logoutBtn");
  const authSection = document.getElementById("authSection");
  const userInfo = document.getElementById("userInfo");
  const googleLoginBtn = document.getElementById("googleLoginBtn");

  // Initialize authentication and message manager
  authService.init();
  const messageManager = new MessageManager();

  // Handle user login
  authService.onLogin((user) => {
    console.log("User logged in:", user);

    // Update UI to show logged in state
    usernameElement.textContent = user.name;
    logoutButton.style.display = "block";
    googleLoginBtn.style.display = "none"; // Hide Google login button

    // Add profile picture if available
    if (user.picture) {
      // Remove existing profile if any
      const existingProfile = userInfo.querySelector(".user-profile");
      if (existingProfile) {
        existingProfile.remove();
      }

      // Create and add profile with picture
      const profileDiv = document.createElement("div");
      profileDiv.className = "user-profile";
      profileDiv.innerHTML = `
        <img src="${user.picture}" alt="Profile" class="user-avatar">
      `;
      userInfo.appendChild(profileDiv);
    }

    // Send authentication data to server
    const authData = {
      id: user.id,
      name: user.name,
      isGoogleUser: user.isGoogleUser,
    };
    socketService.sendAuthData(authData);
  });

  // Handle user logout
  authService.onLogout(() => {
    console.log("User logged out");

    // Update UI to show logged out state
    logoutButton.style.display = "none";
    googleLoginBtn.style.display = "block"; // Show Google login button

    // Remove profile picture if exists
    const profileDiv = userInfo.querySelector(".user-profile");
    if (profileDiv) {
      profileDiv.remove();
    }

    // Clear auth data on server
    socketService.clearAuthData();
  });

  // Set up socket event listeners
  socketService.onUserInfo((data) => {
    // Only update username if not logged in with Google
    if (!authService.isAuthenticated()) {
      usernameElement.textContent = data.username;

      // Store username in localStorage
      localStorage.setItem("anonymousUsername", data.username);
    }
  });

  socketService.onChatHistory((messages) => {
    messageManager.setMessages(messages);
  });

  socketService.onNewMessage((message) => {
    messageManager.addMessage(message);
  });

  // Connect to the server
  socketService.initSocket();

  // Handle message form submission
  messageForm.addEventListener("submit", function (event) {
    event.preventDefault();

    const messageText = messageTextInput.value.trim();
    if (messageText) {
      // Send the message
      socketService.sendMessage(messageText);

      // Clear the input field
      messageTextInput.value = "";
      sendButton.disabled = true;
    }
  });

  // Enable/disable send button based on input
  messageTextInput.addEventListener("input", function () {
    sendButton.disabled = !messageTextInput.value.trim();
  });

  // Handle logout button click
  logoutButton.addEventListener("click", function () {
    authService.logout();
  });

  // Hide Google button if already authenticated
  if (authService.isAuthenticated()) {
    googleLoginBtn.style.display = "none";
    logoutButton.style.display = "block";
  } else {
    googleLoginBtn.style.display = "block";
    logoutButton.style.display = "none";
  }

  // Handle page unload
  window.addEventListener("beforeunload", function () {
    socketService.disconnect();
  });
});
