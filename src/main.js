import Vue from 'vue'
import App from './App.vue'
import vuex from '../vuex'

Vue.config.productionTip = false
//
Vue.use(vuex)
//
const store = new vuex.Store({
  state: {},
  mutations: {},
  actions: {},
  getters: {},
})

new Vue({
  store,
  render: h => h(App),
}).$mount('#app')
