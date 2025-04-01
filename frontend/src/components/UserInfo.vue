<template>
  <div class="user-info">
    <p>You are chatting as: <strong>{{ username }}</strong></p>
  </div>
</template>

<script>
export default {
  name: 'UserInfo',
  props: {
    username: {
      type: String,
      required: true
    }
  }
};
</script>

<style scoped>
.user-info {
  background-color: #e9f7ef;
  border-radius: 4px;
  padding: 10px 15px;
  margin-bottom: 20px;
  text-align: center;
}
</style>
