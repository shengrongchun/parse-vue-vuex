import Module from './module'
import { assert, forEachValue } from '../util'

export default class ModuleCollection {
  constructor(rawRootModule) {//options
    // register root module (Vuex.Store options)
    this.register([], rawRootModule, false)
  }
  //
  get(path) {
    return path.reduce((module, key) => {//reduce数组为空，直接返回初始值 this.root
      return module.getChild(key)//每次去寻找模块时都是根据模块的名字key到父模块的__children去寻找
    }, this.root)//根据reduce的特性，module一开始是this.root,下次就是module.getChild(key)的返回值
  }
  //模块中定义了命名空间，在使用commit等都要加上命名控件/
  //如：this.$store.commit('模块A/getName', 'helloWorld')
  getNamespace(path) {
    let module = this.root
    return path.reduce((namespace, key) => {
      module = module.getChild(key)
      return namespace + (module.namespaced ? key + '/' : '')
    }, '')
  }
  //注册收集模块，父模块把所有子模块收集到自己的__children里面
  register(path, rawModule, runtime = true) {
    if (__DEV__) {//dev环境下判断当前模块下actions,mutations,getters里面定义的类型是否正确，不正确发出警告
      assertRawModule(path, rawModule)
    }

    const newModule = new Module(rawModule, runtime)
    if (path.length === 0) {//如果path为空数组，此时的模块为根模块
      this.root = newModule
    } else {
      const parent = this.get(path.slice(0, -1))//根据模块名称获取此时模块的父模块
      parent.addChild(path[path.length - 1], newModule)//再把此时模块装入父模块的_children中
    }

    // register nested modules 注册模块的子模块
    if (rawModule.modules) {//path在过程中启到标识模块层级的作用，如path: [a,ab]说明模块a,以及a里面的模块ab
      forEachValue(rawModule.modules, (rawChildModule, key) => {
        this.register(path.concat(key), rawChildModule, runtime)//path: [a,ab]
      })
    }
  }
}


//从Assert可以得出：mutations和getters里面定义的只能是函数，而actions可以是函数或者含有handler函数的对象
//assertRawModule作用就是判断模块中定义的类型是否正确，在dev环境下会警告
const functionAssert = {
  assert: value => typeof value === 'function',
  expected: 'function'
}
const objectAssert = {
  assert: value => typeof value === 'function' ||
    (typeof value === 'object' && typeof value.handler === 'function'),
  expected: 'function or object with "handler" function'
}
const assertTypes = {
  getters: functionAssert, //期望getters 是函数
  mutations: functionAssert,// 期望 mutations 是函数
  actions: objectAssert // 期望actions是函数或者是对象并且对象的 handler 是函数
}
function assertRawModule(path, rawModule) {
  Object.keys(assertTypes).forEach(key => {
    if (!rawModule[key]) return // 没有定义 getters 或 mutations 或 actions 直接return

    const assertOptions = assertTypes[key] //获取相关类型的 Assert: {assert:,expected}
    // mutations: {
    //   name：(state)=>{
    //     ……
    //   }
    // }
    forEachValue(rawModule[key], (value, type) => {//value是如：(state)=> {}，type如：name
      assert(
        assertOptions.assert(value),
        makeAssertionMessage(path, key, type, value, assertOptions.expected)
      )
    })
  })
}
//path:[]装模块名称的数组 key:getters/mutations/actions type:相关(getter/actions/mutations)里面定义的函数名称
//value: 里面定义的函数体
function makeAssertionMessage(path, key, type, value, expected) {
  let buf = `${key} should be ${expected} but "${key}.${type}"`
  if (path.length > 0) {
    buf += ` in module "${path.join('.')}"`
  }
  buf += ` is ${JSON.stringify(value)}.`
  return buf
}
