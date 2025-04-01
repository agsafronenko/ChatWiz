import { createStore } from "vuex";
import chat from "./modules/chat";

export default createStore({
  modules: {
    chat,
  },
});
