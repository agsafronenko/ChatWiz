class AuthService {
  constructor() {
    this.user = null;
    this.callbacks = {
      onLogin: [],
      onLogout: [],
    };

    this.googleClientId = CONFIG.GOOGLE_CLIENT_ID;
  }

  // Initialize the Google Auth
  init() {
    // Wait for Google Identity Services to load
    window.onload = () => {
      this.renderGoogleButton();
      this.checkExistingSession();
    };
  }

  // Render the Google Sign-In button
  renderGoogleButton() {
    google.accounts.id.initialize({
      client_id: this.googleClientId,
      callback: this.handleGoogleCredentialResponse.bind(this),
      auto_select: false,
      cancel_on_tap_outside: true,
    });

    // Store the rendered button element for later hiding/showing
    this.googleButton = document.getElementById("googleLoginBtn");

    google.accounts.id.renderButton(this.googleButton, {
      theme: "outline",
      size: "medium",
      text: "signin_with",
      shape: "rectangular",
      width: 200,
    });
  }

  // Check for existing session
  checkExistingSession() {
    const user = localStorage.getItem("chatUser");
    if (user) {
      try {
        this.user = JSON.parse(user);
        this.notifyLoginCallbacks(this.user);

        // Hide Google button when already logged in
        if (this.googleButton) {
          this.googleButton.style.display = "none";
        }
      } catch (e) {
        console.error("Failed to parse stored user data");
        localStorage.removeItem("chatUser");
      }
    }
  }

  // Handle Google Sign-In response
  handleGoogleCredentialResponse(response) {
    // Decode JWT token to get user info
    const payload = this.decodeJwtResponse(response.credential);

    this.user = {
      id: payload.sub,
      name: payload.name,
      email: payload.email,
      picture: payload.picture,
      firstName: payload.given_name,
      lastName: payload.family_name,
      isGoogleUser: true,
    };

    // Save to local storage
    localStorage.setItem("chatUser", JSON.stringify(this.user));

    // Hide Google button when logged in
    if (this.googleButton) {
      this.googleButton.style.display = "none";
    }

    // Notify callbacks
    this.notifyLoginCallbacks(this.user);
  }

  // Decode JWT token from Google
  decodeJwtResponse(token) {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(jsonPayload);
  }

  // Logout handler
  logout() {
    this.user = null;
    localStorage.removeItem("chatUser");

    // Show Google button again after logout
    if (this.googleButton) {
      this.googleButton.style.display = "block";
    }

    // Notify callbacks
    this.notifyLogoutCallbacks();
  }

  // Register login callback
  onLogin(callback) {
    if (typeof callback === "function") {
      this.callbacks.onLogin.push(callback);

      // If user is already logged in, call the callback immediately
      if (this.user) {
        callback(this.user);
      }
    }
  }

  // Register logout callback
  onLogout(callback) {
    if (typeof callback === "function") {
      this.callbacks.onLogout.push(callback);
    }
  }

  // Notify all login callbacks
  notifyLoginCallbacks(user) {
    this.callbacks.onLogin.forEach((callback) => callback(user));
  }

  // Notify all logout callbacks
  notifyLogoutCallbacks() {
    this.callbacks.onLogout.forEach((callback) => callback());
  }

  // Get current user
  getCurrentUser() {
    return this.user;
  }

  // Check if user is authenticated
  isAuthenticated() {
    return this.user !== null;
  }
}

// Create singleton instance
const authService = new AuthService();
