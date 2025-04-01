<template>
  <div class="message-input">
    <form @submit.prevent="submitMessage">
      <input
        type="text"
        v-model="messageText"
        placeholder="Type a message..."
        autocomplete="off"
      />
      <button type="submit" :disabled="!messageText.trim()">Send</button>
    </form>
  </div>
</template>

<script>
export default {
  name: 'MessageInput',
  data() {
    return {
      messageText: ''
    };
  },
  methods: {
    submitMessage() {
      const message = this.messageText.trim();
      if (message) {
        this.$emit('send-message', message);
        this.messageText = '';
      }
    }
  }
};
</script>

<style scoped>
.message-input {
  padding: 10px;
  background-color: #f9f9f9;
  border-top: 1px solid #eee;
}

form {
  display: flex;
}

input {
  flex: 1;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1rem;
}

button {
  margin-left: 10px;
  padding: 10px 15px;
  background-color: #4caf50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
}

button:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
}

button:hover:not(:disabled) {
  background-color: #45a049;
}
</style>
