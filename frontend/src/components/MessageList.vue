<template>
  <div class="message-list" ref="messageList">
    <div v-if="messages.length === 0" class="empty-state">No messages yet. Be the first to say hello!</div>

    <template v-for="(message, index) in messages">
      <!-- System messages (unchanged) -->
      <div v-if="message.username === 'System'" :key="`system-${index}`" class="system-message">
        <div class="system-notification">
          <span>{{ message.content }}</span>
          <span class="timestamp">{{ formatTime(message.timestamp) }}</span>
        </div>
      </div>

      <!-- Regular user messages with grouping -->
      <div v-else :key="`user-${index}`" class="message">
        <!-- Show username only if it's a new user or first message -->
        <div v-if="shouldShowUsername(index)" class="username">
          {{ message.username }}
        </div>

        <!-- Message content with timestamp on the same row -->
        <div class="message-content-row">
          <div class="message-content">{{ message.content }}</div>
          <span class="timestamp">{{ formatTime(message.timestamp) }}</span>
        </div>
      </div>
    </template>
  </div>
</template>

<script>
import { formatTime } from "../utils/formatters";

export default {
  name: "MessageList",
  props: {
    messages: {
      type: Array,
      default: () => [],
    },
  },
  methods: {
    formatTime,
    scrollToBottom() {
      this.$nextTick(() => {
        if (this.$refs.messageList) {
          const messageList = this.$refs.messageList;
          // Using smooth scrolling with a slight delay to ensure content is rendered
          setTimeout(() => {
            messageList.scrollTop = messageList.scrollHeight;
          }, 50);
        }
      });
    },
    shouldShowUsername(index) {
      if (index === 0) return true;

      const currentMessage = this.messages[index];
      const previousMessage = this.messages[index - 1];

      // Show username if previous message was from a different user or was a system message
      return previousMessage.username !== currentMessage.username || previousMessage.username === "System";
    },
  },
  watch: {
    "messages.length": function () {
      this.scrollToBottom();
    },
  },
  updated() {
    this.scrollToBottom();
  },
  mounted() {
    this.scrollToBottom();
  },
};
</script>

<style scoped>
.message-list {
  flex: 1;
  overflow-y: auto;
  padding: 15px;
  scroll-behavior: smooth;
}

.empty-state {
  color: #888;
  text-align: center;
  margin-top: 40px;
}

.message {
  margin-bottom: 2px;
  padding-bottom: 2px;
}

/* Add more space before a new user's messages */
.message .username {
  font-weight: bold;
  color: #2c3e50;
  font-size: 0.9rem;
  margin-top: 8px;
  margin-bottom: 4px;
}

.message-content-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-left: 8px;
  padding-bottom: 4px;
}

.message-content {
  word-break: break-word;
  flex: 1;
}

.timestamp {
  color: #999;
  font-size: 0.75rem;
  margin-left: 8px;
  white-space: nowrap;
}

.system-message {
  margin: 8px 0;
  padding-bottom: 4px;
  border-bottom: 1px dashed #f0f0f0;
}

.system-notification {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-style: italic;
  color: #777;
  font-size: 0.85rem;
}

.system-notification .timestamp {
  font-style: normal;
}
</style>
