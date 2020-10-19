import Vue from 'vue'
import App from './App.vue'
import vuex from '../vuex'

Vue.config.productionTip = false
//
Vue.use(vuex)
//
const moduleA = {
  state: () => {
    return {
      name: '模块A'
    }
  },
  mutations: {
  },
  actions: {},
  getters: {}
}
//
const moduleB = {
  namespaced: true,
  state: () => {
    return {
      name: '模块B'
    }
  },
  mutations: {
  },
  actions: {},
  getters: {}
}
const store = new vuex.Store({
  state: {
    name: '根模块'
  },
  mutations: {
    age(state, payload) {
      console.log('age1', payload)
    }
  },
  actions: {},
  getters: {},
  //
  modules: {
    a: moduleA,
    b: moduleB
  }
})

new Vue({
  store,
  render: h => h(App),
}).$mount('#app')
