<template>
  <div class="message-list" ref="messageList">
    <div v-if="messages.length === 0" class="empty-state">No messages yet. Be the first to say hello!</div>
    <div v-for="(message, index) in messages" :key="index" :class="{ message: true, 'system-message': message.username === 'System' }">
      <template v-if="message.username !== 'System'">
        <div class="message-header">
          <span class="username">{{ message.username }}</span>
          <span class="timestamp">{{ formatTime(message.timestamp) }}</span>
        </div>
        <div class="message-content">{{ message.content }}</div>
      </template>

      <div v-else class="system-notification">
        <span>{{ message.content }}</span>
        <span class="timestamp">{{ formatTime(message.timestamp) }}</span>
      </div>
    </div>
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
  },
  watch: {
    // Watch the messages array length to detect new messages
    "messages.length": function () {
      this.scrollToBottom();
    },
  },
  updated() {
    // Also try to scroll on component update
    this.scrollToBottom();
  },
  mounted() {
    // Initial scroll when component is mounted
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
  margin-bottom: 8px; /* Reduced from 15px */
  padding-bottom: 6px; /* Reduced from 10px */
  border-bottom: 1px solid #f0f0f0;
}

.system-message {
  margin-bottom: 4px; /* Reduced from 8px */
  padding-bottom: 4px; /* Reduced from 8px */
  border-bottom: 1px dashed #f0f0f0;
}

.message-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 3px; /* Reduced from 5px */
}

.username {
  font-weight: bold;
  color: #2c3e50;
  font-size: 0.9rem; /* Reduced from default size */
}

.timestamp {
  color: #999;
  font-size: 0.8rem;
}

.message-content {
  word-break: break-word;
}

.system-notification {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-style: italic;
  color: #777;
  font-size: 0.85rem; /* Slightly smaller than before */
  margin: 2px 0;
}

.system-notification .timestamp {
  font-style: normal;
}
</style>
