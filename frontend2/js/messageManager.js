class MessageManager {
  constructor() {
    this.messages = [];
    this.messageListElement = document.getElementById('messageList');
    this.emptyStateElement = document.getElementById('emptyState');
    this.userMessageTemplate = document.getElementById('userMessageTemplate');
    this.systemMessageTemplate = document.getElementById('systemMessageTemplate');
  }

  // Set initial messages from chat history
  setMessages(messages) {
    this.messages = messages || [];
    this.renderMessages();
  }

  // Add a new message and render it
  addMessage(message) {
    this.messages.push(message);
    this.renderMessages();
  }

  // Check if we should show the username for this message
  shouldShowUsername(index) {
    if (index === 0) return true;

    const currentMessage = this.messages[index];
    const previousMessage = this.messages[index - 1];

    // Show username if previous message was from a different user or was a system message
    return previousMessage.username !== currentMessage.username || 
           previousMessage.username === "System";
  }

  // Render all messages
  renderMessages() {
    // Hide empty state if we have messages
    if (this.messages.length > 0) {
      this.emptyStateElement.style.display = 'none';
    } else {
      this.emptyStateElement.style.display = 'block';
    }

    // Clear existing messages (except the empty state)
    const children = Array.from(this.messageListElement.children);
    children.forEach(child => {
      if (child !== this.emptyStateElement) {
        this.messageListElement.removeChild(child);
      }
    });

    // Render each message
    this.messages.forEach((message, index) => {
      let messageElement;
      
      if (message.username === 'System') {
        // System message
        messageElement = this.createSystemMessage(message);
      } else {
        // User message
        messageElement = this.createUserMessage(message, index);
      }
      
      this.messageListElement.appendChild(messageElement);
    });

    // Scroll to bottom
    this.scrollToBottom();
  }

  // Create a system message element
  createSystemMessage(message) {
    const clone = this.systemMessageTemplate.content.cloneNode(true);
    
    clone.querySelector('.content').textContent = message.content;
    clone.querySelector('.timestamp').textContent = formatTime(message.timestamp);
    
    return clone;
  }

  // Create a user message element
  createUserMessage(message, index) {
    const clone = this.userMessageTemplate.content.cloneNode(true);
    const usernameElement = clone.querySelector('.username');
    
    // Show username only if needed
    if (this.shouldShowUsername(index)) {
      usernameElement.textContent = message.username;
    } else {
      usernameElement.style.display = 'none';
    }
    
    clone.querySelector('.message-content').textContent = message.content;
    clone.querySelector('.timestamp').textContent = formatTime(message.timestamp);
    
    return clone;
  }

  // Scroll the message list to the bottom
  scrollToBottom() {
    setTimeout(() => {
      this.messageListElement.scrollTop = this.messageListElement.scrollHeight;
    }, 50);
  }
}
