<template>
  <div class="chat-window">
    <MessageList :messages="messages" />
    <MessageInput @send-message="sendMessage" />
  </div>
</template>

<script>
import MessageList from "./MessageList.vue";
import MessageInput from "./MessageInput.vue";
import { socketService } from "../services/socketService";
import { mapState } from "vuex";

export default {
  name: "ChatWindow",
  components: {
    MessageList,
    MessageInput,
  },
  computed: {
    ...mapState("chat", ["messages"]),
  },
  methods: {
    sendMessage(message) {
      socketService.sendMessage(message);
    },
  },
};
</script>

<style scoped>
.chat-window {
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  height: 70vh;
}
</style>
