import { forEachValue } from '../util'

// module: {
//   _children: {
//     模块A: {……},
//     模块B: {……},
//   }
// }
// Base data struct for store's module, package with some attribute and method
export default class Module {
  constructor(rawModule, runtime) {
    //运行时标记是否为动态模块，注意：通过外部方法registerModule注册的是动态模块
    //unregisterModule卸载模块方法，也只能卸载动态模块（只卸载runtime为true的）
    this.runtime = runtime
    // Store some children item
    this._children = Object.create(null)//装子模块的对象
    // Store the origin module object which passed by programmer
    this._rawModule = rawModule //未处理的当前模块
    const rawState = rawModule.state // 未处理的 state

    // Store the origin module's state所以这里可以看出state既可以写成对象也可以是函数
    this.state = (typeof rawState === 'function' ? rawState() : rawState) || {}
  }

  get namespaced() {//获取模块的命名空间定义标识
    return !!this._rawModule.namespaced
  }

  addChild(key, module) {//给此模块加子模块
    this._children[key] = module
  }

  removeChild(key) {//删除模块
    delete this._children[key]
  }

  getChild(key) {//根据key获取子模块的实体
    return this._children[key]
  }

  hasChild(key) {//是否有此模块
    return key in this._children
  }

  update(rawModule) {//更新模块
    this._rawModule.namespaced = rawModule.namespaced
    if (rawModule.actions) {
      this._rawModule.actions = rawModule.actions
    }
    if (rawModule.mutations) {
      this._rawModule.mutations = rawModule.mutations
    }
    if (rawModule.getters) {
      this._rawModule.getters = rawModule.getters
    }
  }

  forEachChild(fn) {
    forEachValue(this._children, fn)
  }

  forEachGetter(fn) {
    if (this._rawModule.getters) {
      forEachValue(this._rawModule.getters, fn)
    }
  }

  forEachAction(fn) {
    if (this._rawModule.actions) {
      forEachValue(this._rawModule.actions, fn)
    }
  }

  forEachMutation(fn) {
    if (this._rawModule.mutations) {
      forEachValue(this._rawModule.mutations, fn)
    }
  }
}
