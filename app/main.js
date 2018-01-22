import Vue from 'vue'
import App from './App.vue'

import { Message, Notification } from 'element-ui';

Vue.prototype.$message = Message;
Vue.prototype.$notify = Notification;

new Vue({
  el: '#app',
  render: h => h(App)
})
