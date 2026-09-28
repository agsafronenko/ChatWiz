// --- START OF FILE js/messageManager.js ---

class MessageManager {
  constructor() {
    this.messages = [];
    this.messageListElement = document.getElementById("messageList");
    this.emptyStateElement = document.getElementById("emptyState");
    this.userMessageTemplate = document.getElementById("userMessageTemplate");
    this.systemMessageTemplate = document.getElementById("systemMessageTemplate");
  }

  // Set initial messages from chat history for the current room
  setMessages(messages) {
    this.messages = messages || [];
    this.renderMessages();
  }

  // Add a new message and render it
  addMessage(message) {
    this.messages.push(message);
    // Optimization: could append just the new message instead of full re-render
    this.renderMessages();
  }

  // Clear all messages (used when switching rooms)
  clearMessages() {
    this.messages = [];
    this.renderMessages(); // Render the empty state
  }

  // Check if we should show the username for this message
  shouldShowUsername(index) {
    if (index === 0) return true;

    const currentMessage = this.messages[index];
    const previousMessage = this.messages[index - 1];

    // Check if previous message exists and has a username property
    if (!previousMessage || typeof previousMessage.username === "undefined") {
      return true; // Should show if previous message is invalid or first
    }

    // Show username if previous message was from a different user or was a system message
    return previousMessage.username !== currentMessage.username || previousMessage.username === "System";
  }

  // Render all messages
  renderMessages() {
    // Clear existing messages before rendering
    this.messageListElement.innerHTML = ""; // Clear everything first

    // Show empty state if needed
    if (this.messages.length === 0) {
      this.messageListElement.appendChild(this.emptyStateElement);
      this.emptyStateElement.style.display = "block";
    } else {
      this.emptyStateElement.style.display = "none"; // Hide if we have messages

      // Render each message
      this.messages.forEach((message, index) => {
        let messageElement;

        if (!message || typeof message.username === "undefined") {
          console.warn("Skipping invalid message:", message);
          return; // Skip rendering malformed messages
        }

        if (message.username === "System") {
          // System message
          messageElement = this.createSystemMessage(message);
        } else {
          // User message
          messageElement = this.createUserMessage(message, index);
        }

        if (messageElement) {
          // Ensure element was created
          this.messageListElement.appendChild(messageElement);
        }
      });
    }

    // Scroll to bottom
    this.scrollToBottom();
  }

  // Create a system message element
  createSystemMessage(message) {
    try {
      const clone = this.systemMessageTemplate.content.cloneNode(true);
      clone.querySelector(".content").textContent = message.content || "";
      clone.querySelector(".timestamp").textContent = formatTime(message.timestamp);
      return clone;
    } catch (e) {
      console.error("Error creating system message:", e, message);
      return null; // Return null if creation fails
    }
  }

  // Create a user message element
  createUserMessage(message, index) {
    try {
      const clone = this.userMessageTemplate.content.cloneNode(true);
      const usernameElement = clone.querySelector(".username");

      // Show username only if needed
      if (this.shouldShowUsername(index)) {
        usernameElement.textContent = message.username;
      } else {
        usernameElement.style.display = "none";
      }

      clone.querySelector(".message-content").textContent = message.content || "";
      clone.querySelector(".timestamp").textContent = formatTime(message.timestamp);

      return clone;
    } catch (e) {
      console.error("Error creating user message:", e, message);
      return null; // Return null if creation fails
    }
  }

  // Scroll the message list to the bottom
  scrollToBottom() {
    // Use setTimeout to allow the DOM to update before scrolling
    setTimeout(() => {
      this.messageListElement.scrollTop = this.messageListElement.scrollHeight;
    }, 50); // A small delay like 50ms is usually sufficient
  }
}
// --- END OF FILE js/messageManager.js ---
