import applyMixin from './mixin'
import { assert } from './util'

let Vue // bind on install
export class Store { // this--> vue实例中的 this.$store
  constructor() {
    // Auto install if it is not done yet and `window` has `Vue`.
    // To allow users to avoid auto-installation in some cases,
    // this code should be placed here. See #731
    if (!Vue && typeof window !== 'undefined' && window.Vue) {
      install(window.Vue) //window上有Vue会自动安装的
    }

    if (__DEV__) {//开发环境会有一些警告。比如创建store实例前需要执行Vue.use(Vuex)等
      assert(Vue, `must call Vue.use(Vuex) before creating a store instance.`)
      assert(typeof Promise !== 'undefined', `vuex requires a Promise polyfill in this browser.`)
      assert(this instanceof Store, `store must be called with the new operator.`)
    }
    //
    this.test = '这个this就是在组件里使用的 this.$store'
  }
}
//
export function install(_Vue) {//插件安装
  if (Vue && _Vue === Vue) {//安装过了
    if (__DEV__) {
      console.error(
        '[vuex] already installed. Vue.use(Vuex) should be called only once.'
      )
    }
    return
  }
  Vue = _Vue
  applyMixin(Vue)
}