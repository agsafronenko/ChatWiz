export default {
  namespaced: true,
  state: {
    messages: [],
  },
  mutations: {
    SET_CHAT_HISTORY(state, messages) {
      state.messages = messages;
    },
    ADD_MESSAGE(state, message) {
      state.messages.push(message);

      // Keep only the last 100 messages to match the backend
      if (state.messages.length > 100) {
        state.messages = state.messages.slice(-100);
      }
    },
  },
  actions: {
    setChatHistory({ commit }, messages) {
      commit("SET_CHAT_HISTORY", messages);
    },
    addMessage({ commit }, message) {
      commit("ADD_MESSAGE", message);
    },
  },
};
