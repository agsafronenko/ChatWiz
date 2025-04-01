<template>
  <div class="message-list" ref="messageList">
    <div v-if="messages.length === 0" class="empty-state">
      No messages yet. Be the first to say hello!
    </div>
    <div v-for="(message, index) in messages" :key="index" class="message">
      <div class="message-header">
        <span class="username" :class="{ system: message.username === 'System' }">
          {{ message.username }}
        </span>
        <span class="timestamp">{{ formatTime(message.timestamp) }}</span>
      </div>
      <div class="message-content">{{ message.content }}</div>
    </div>
  </div>
</template>

<script>
import { formatTime } from '../utils/formatters';

export default {
  name: 'MessageList',
  props: {
    messages: {
      type: Array,
      default: () => []
    }
  },
  methods: {
    formatTime,
    scrollToBottom() {
      this.$nextTick(() => {
        if (this.$refs.messageList) {
          this.$refs.messageList.scrollTop = this.$refs.messageList.scrollHeight;
        }
      });
    }
  },
  watch: {
    messages() {
      this.scrollToBottom();
    }
  },
  mounted() {
    this.scrollToBottom();
  }
};
</script>

<style scoped>
.message-list {
  flex: 1;
  overflow-y: auto;
  padding: 15px;
}

.empty-state {
  color: #888;
  text-align: center;
  margin-top: 40px;
}

.message {
  margin-bottom: 15px;
  padding-bottom: 10px;
  border-bottom: 1px solid #f0f0f0;
}

.message-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 5px;
}

.username {
  font-weight: bold;
  color: #2c3e50;
}

.username.system {
  color: #9c27b0;
}

.timestamp {
  color: #999;
  font-size: 0.8rem;
}

.message-content {
  word-break: break-word;
}
</style>
