// Main application initialization
document.addEventListener('DOMContentLoaded', function() {
  // Get DOM elements
  const usernameElement = document.getElementById('username');
  const messageForm = document.getElementById('messageForm');
  const messageTextInput = document.getElementById('messageText');
  const sendButton = document.getElementById('sendButton');

  // Initialize the message manager
  const messageManager = new MessageManager();

  // Set up event listeners
  socketService.onUserInfo((data) => {
    usernameElement.textContent = data.username;
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
  messageForm.addEventListener('submit', function(event) {
    event.preventDefault();
    
    const messageText = messageTextInput.value.trim();
    if (messageText) {
      // Send the message
      socketService.sendMessage(messageText);
      
      // Clear the input field
      messageTextInput.value = '';
      sendButton.disabled = true;
    }
  });

  // Enable/disable send button based on input
  messageTextInput.addEventListener('input', function() {
    sendButton.disabled = !messageTextInput.value.trim();
  });

  // Handle page unload
  window.addEventListener('beforeunload', function() {
    socketService.disconnect();
  });

  // You can set the socket endpoint here, or it will default to localhost:5000
  window.SOCKET_ENDPOINT = 'http://localhost:5000';
});
