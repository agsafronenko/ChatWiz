<template>
  <div class="chat-container">
    <h1>Public Chat Room</h1>
    <UserInfo :username="username" />
    <ChatWindow />
  </div>
</template>

<script>
import ChatWindow from "./components/ChatWindow.vue";
import UserInfo from "./components/UserInfo.vue";
import { socketService } from "./services/socketService";
import { mapActions } from "vuex";

export default {
  name: "App",
  components: {
    ChatWindow,
    UserInfo,
  },
  data() {
    return {
      username: "",
    };
  },
  created() {
    // Initialize socket connection when app is created
    socketService.initSocket();

    // Set up event listeners
    socketService.onUserInfo((data) => {
      this.username = data.username;
    });

    socketService.onChatHistory((messages) => {
      this.setChatHistory(messages);
    });

    socketService.onNewMessage((message) => {
      this.addMessage(message);
    });
  },
  methods: {
    ...mapActions("chat", ["setChatHistory", "addMessage"]),
  },
};
</script>

<style>
body {
  font-family: "Arial", sans-serif;
  line-height: 1.6;
  margin: 0;
  padding: 0;
  background-color: #f5f5f5;
}

.chat-container {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
}

h1 {
  text-align: center;
  color: #333;
}
</style>
