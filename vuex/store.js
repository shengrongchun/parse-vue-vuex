import applyMixin from './mixin'
import devtoolPlugin from './plugins/devtool'
import ModuleCollection from './module/module-collection'
import { forEachValue, isObject, isPromise, assert, partial } from './util'

let Vue // bind on install
export class Store { // this--> vue实例中的 this.$store
  constructor(options = {}) {
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

    const {
      plugins = [],//用户定义插件
      strict = false// 用户定义是否严格模式，在严格模式下，任何 mutation 处理函数以外修改 Vuex state 都会抛出错误
    } = options

    // store internal state
    this._committing = false //state改变是否触发警告标识(严格模式下在mutations以外处修改state会触发警告)
    this._actions = Object.create(null) //存储定义的所有actions
    this._actionSubscribers = [] //订阅action的回调函数，当有action执行后，会执行此数组中的函数
    this._mutations = Object.create(null)//存储定义的所有mutations
    this._wrappedGetters = Object.create(null)//存储所有模块的getters
    this._modules = new ModuleCollection(options) //收集配置文件中定义的模块，并且返回树状模块数据结构
    this._modulesNamespaceMap = Object.create(null) //命名空间与模块映射
    this._subscribers = [] //订阅mutation的回调函数，当有mutation执行后，会执行此数组中的函数
    this._watcherVM = new Vue()//vue实例
    this._makeLocalGettersCache = Object.create(null)

    // bind commit and dispatch to self
    const store = this //this.$store 实例
    const { dispatch, commit } = this
    //中转下是保证方法里的this是store
    this.dispatch = function boundDispatch(type, payload) {
      return dispatch.call(store, type, payload) // this.$store.dispatch
    }
    this.commit = function boundCommit(type, payload, options) {
      return commit.call(store, type, payload, options) // this.$store.commit
    }

    // strict mode 在严格模式下，任何 mutation 处理函数以外修改 Vuex state 都会抛出错误
    this.strict = strict

    const state = this._modules.root.state //根实例的state 此时还未是响应式的
    // init root module.
    // this also recursively registers all sub-modules 递归
    // and collects all module getters inside this._wrappedGetters
    installModule(this, state, [], this._modules.root)

    // initialize the store vm, which is responsible for the reactivity
    // (also registers _wrappedGetters as computed properties)
    resetStoreVM(this, state)

    // apply plugins
    plugins.forEach(plugin => plugin(this))

    const useDevtools = options.devtools !== undefined ? options.devtools : Vue.config.devtools
    if (useDevtools) {
      devtoolPlugin(this)
    }
  }
  //实例方法
  get state() {// store.state --> 根实例的state
    return this._vm._data.$$state
  }

  set state(v) {
    if (__DEV__) {
      assert(false, `use store.replaceState() to explicit replace store state.`)
    }
  }

  commit(_type, _payload, _options) {
    // check object-style commit
    const {
      type,
      payload,
      options
    } = unifyObjectStyle(_type, _payload, _options)

    const mutation = { type, payload }
    const entry = this._mutations[type]
    if (!entry) {
      if (__DEV__) {
        console.error(`[vuex] unknown mutation type: ${type}`)
      }
      return
    }
    //_withCommit很重要，作用是fn里面改变state,不会触发警告
    this._withCommit(() => {
      entry.forEach(function commitIterator(handler) {
        handler(payload)
      })
    })
    //mutation执行完后，执行订阅的回调函数
    this._subscribers
      .slice() // shallow copy to prevent iterator invalidation if subscriber synchronously calls unsubscribe
      .forEach(sub => sub(mutation, this.state))

    if (
      __DEV__ &&
      options && options.silent
    ) {
      console.warn(
        `[vuex] mutation type: ${type}. Silent option has been removed. ` +
        'Use the filter functionality in the vue-devtools'
      )
    }
  }

  dispatch(_type, _payload) {
    // check object-style dispatch
    const {
      type,
      payload
    } = unifyObjectStyle(_type, _payload)

    const action = { type, payload }
    const entry = this._actions[type]
    if (!entry) {
      if (__DEV__) {
        console.error(`[vuex] unknown action type: ${type}`)
      }
      return
    }

    try {//如果有before说明是希望在action分发之前调用
      this._actionSubscribers
        .slice() // shallow copy to prevent iterator invalidation if subscriber synchronously calls unsubscribe
        .filter(sub => sub.before)
        .forEach(sub => sub.before(action, this.state))
    } catch (e) {
      if (__DEV__) {
        console.warn(`[vuex] error in before action subscribers: `)
        console.error(e)
      }
    }

    const result = entry.length > 1
      ? Promise.all(entry.map(handler => handler(payload)))
      : entry[0](payload)

    return new Promise((resolve, reject) => {
      result.then(res => {
        try {
          this._actionSubscribers//分发之后调用
            .filter(sub => sub.after)
            .forEach(sub => sub.after(action, this.state))
        } catch (e) {
          if (__DEV__) {
            console.warn(`[vuex] error in after action subscribers: `)
            console.error(e)
          }
        }
        resolve(res)
      }, error => {
        try {
          this._actionSubscribers
            .filter(sub => sub.error)
            .forEach(sub => sub.error(action, this.state, error))
        } catch (e) {
          if (__DEV__) {
            console.warn(`[vuex] error in error action subscribers: `)
            console.error(e)
          }
        }
        reject(error)
      })
    })
  }

  subscribe(fn, options) {//订阅mutation,就是在this._subscribers装入此fn
    return genericSubscribe(fn, this._subscribers, options)
  }

  subscribeAction(fn, options) {//订阅action
    const subs = typeof fn === 'function' ? { before: fn } : fn
    return genericSubscribe(subs, this._actionSubscribers, options)
  }

  watch(getter, cb, options) {
    if (__DEV__) {
      assert(typeof getter === 'function', `store.watch only accepts a function.`)
    }
    return this._watcherVM.$watch(() => getter(this.state, this.getters), cb, options)
  }

  replaceState(state) {//时光旅行，他可能会返回之前某个时间点的state,然后赋值此state,达到当前展示之前某个时间的快照
    this._withCommit(() => {
      this._vm._data.$$state = state
    })
  }
  //即使state在mutation以外改变也不发生警告
  _withCommit(fn) {
    const committing = this._committing
    this._committing = true //state改变不要警告标识 447行
    fn()
    this._committing = committing
  }
}
//执行订阅装入操作
function genericSubscribe(fn, subs, options) {
  if (subs.indexOf(fn) < 0) {
    options && options.prepend
      ? subs.unshift(fn)
      : subs.push(fn)
  }
  return () => {//返回函数，直接后是停止订阅
    const i = subs.indexOf(fn)
    if (i > -1) {
      subs.splice(i, 1)
    }
  }
}
//ok
function resetStoreVM(store, state, hot) {
  const oldVm = store._vm

  // bind store public getters
  store.getters = {}
  // reset local getters cache
  store._makeLocalGettersCache = Object.create(null)
  const wrappedGetters = store._wrappedGetters
  const computed = {}
  forEachValue(wrappedGetters, (fn, key) => {
    // use computed to leverage its lazy-caching mechanism
    // direct inline function use will lead to closure preserving oldVm.
    // using partial to return function with only arguments preserved in closure environment.
    computed[key] = partial(fn, store)
    Object.defineProperty(store.getters, key, {
      get: () => store._vm[key],
      enumerable: true // for local getters
    })
  })

  // use a Vue instance to store the state tree
  // suppress warnings just in case the user has added
  // some funky global mixins
  const silent = Vue.config.silent
  Vue.config.silent = true
  store._vm = new Vue({
    data: {
      $$state: state //state响应式
    },
    computed
  })
  Vue.config.silent = silent

  // enable strict mode for new vm
  if (store.strict) {
    enableStrictMode(store)
  }

  if (oldVm) {//销毁
    if (hot) {
      // dispatch changes in all subscribed watchers
      // to force getter re-evaluation for hot reloading.
      store._withCommit(() => {
        oldVm._data.$$state = null
      })
    }
    Vue.nextTick(() => oldVm.$destroy())
  }
}
//ok
function installModule(store, rootState, path, module, hot) {
  const isRoot = !path.length //是否为根模块
  const namespace = store._modules.getNamespace(path)//获取模块对应的命名空间

  // register in namespace map
  if (module.namespaced) {//模块如果定义了命名空间，就在_modulesNamespaceMap中留下记录
    if (store._modulesNamespaceMap[namespace] && __DEV__) {
      console.error(`[vuex] duplicate namespace ${namespace} for the namespaced module ${path.join('/')}`)
    }
    store._modulesNamespaceMap[namespace] = module
  }

  // set state
  if (!isRoot && !hot) {//hot为true说明并非初始化阶段，而是热替换新的 action 和 mutation
    const parentState = getNestedState(rootState, path.slice(0, -1))

    const moduleName = path[path.length - 1]
    store._withCommit(() => {
      if (__DEV__) {
        if (moduleName in parentState) {//警告：定义的state被相同模块名称重写了
          console.warn(
            `[vuex] state field "${moduleName}" was overridden by a module with the same name at "${path.join('.')}"`
          )
        }
      }
      //往根state中设置子模块的state,因为此时parentState并非响应式，所以 Vue.set只是单纯的添加新属性，这里用Vue.set不太清楚
      //这里parentState变化了，在mutation之外改变state,在严格模式下都会发出警告，为了不警告，通过_withCommit包裹
      Vue.set(parentState, moduleName, module.state)
    })
  }
  const local = module.context = makeLocalContext(store, namespace, path)

  //遍历此模块的mutations,把里面定义的mutation全部收集到store._mutations
  module.forEachMutation((mutation, key) => {
    const namespacedType = namespace + key
    registerMutation(store, namespacedType, mutation, local)
  })

  module.forEachAction((action, key) => {
    //由于在定义action的时候是可以写成对象形式{handler：function},因此action里面可以定义root
    const type = action.root ? key : namespace + key
    const handler = action.handler || action
    registerAction(store, type, handler, local)
  })

  module.forEachGetter((getter, key) => {
    const namespacedType = namespace + key
    registerGetter(store, namespacedType, getter, local)
  })

  module.forEachChild((child, key) => {
    installModule(store, rootState, path.concat(key), child, hot)
  })
}
//
/**
 * make localized dispatch, commit, getters and state
 * if there is no namespace, just use root ones
 * 本地化 dispatch, commit, getters and state。如果没有命名空间，就使用根模块定义的
 */
function makeLocalContext(store, namespace, path) {
  const noNamespace = namespace === '' //如果是空字符就是没有命名空间
  //local 是用在 mutations actions getters等里面的
  const local = {//module.context
    dispatch: noNamespace ? store.dispatch : (_type, _payload, _options) => {
      const args = unifyObjectStyle(_type, _payload, _options)
      const { payload, options } = args
      let { type } = args
      //如果你在options 里面定义了root: true 它允许在命名空间模块里分发根的 action
      if (!options || !options.root) {
        type = namespace + type
        if (__DEV__ && !store._actions[type]) {
          console.error(`[vuex] unknown local action type: ${args.type}, global type: ${type}`)
          return
        }
      }

      return store.dispatch(type, payload)
    },

    commit: noNamespace ? store.commit : (_type, _payload, _options) => {
      const args = unifyObjectStyle(_type, _payload, _options)
      const { payload, options } = args
      let { type } = args
      //如果你在options 里面定义了root: true 它允许在命名空间模块里提交根的 mutation
      if (!options || !options.root) {//type需要加上命名空间
        type = namespace + type
        if (__DEV__ && !store._mutations[type]) {//mutation没有定义此type
          console.error(`[vuex] unknown local mutation type: ${args.type}, global type: ${type}`)
          return
        }
      }

      store.commit(type, payload, options)
    }
  }

  // getters and state object must be gotten lazily 惰性的
  // because they will be changed by vm update
  Object.defineProperties(local, {
    getters: {
      get: noNamespace
        ? () => store.getters //
        : () => makeLocalGetters(store, namespace)//获取自己模块的 getters
    },
    state: {
      get: () => getNestedState(store.state, path)
    }
  })

  return local
}
//在store.getters中获取命名空间为namespace模块的getters
function makeLocalGetters(store, namespace) {//在
  if (!store._makeLocalGettersCache[namespace]) {
    const gettersProxy = {}
    const splitPos = namespace.length
    Object.keys(store.getters).forEach(type => {
      // skip if the target getter is not match this namespace
      if (type.slice(0, splitPos) !== namespace) return //type与namespace不匹配

      // extract local getter type
      const localType = type.slice(splitPos)

      // Add a port to the getters proxy.
      // Define as getter property because
      // we do not want to evaluate the getters in this time.
      Object.defineProperty(gettersProxy, localType, {
        get: () => store.getters[type],
        enumerable: true
      })
    })
    store._makeLocalGettersCache[namespace] = gettersProxy
  }

  return store._makeLocalGettersCache[namespace]
}
/**
 * vuex会把所有模块和根模块所定义的mutation都收集起来放入store._mutations中
 * 举例：如果模块A的mutations定义了age,根模块也定义了age,此时收集会有两中情况
 * 情况一：模块A没有定义命名空间：store._mutations['age'] = [模块A的age,根模块的age]
 * 情况二：模块A有定义命名空间：store._mutations['age'] = [根模块的age] store._mutations['模块A/age'] = [模块A的age]
 */
function registerMutation(store, type, handler, local) {
  const entry = store._mutations[type] || (store._mutations[type] = [])
  entry.push(function wrappedMutationHandler(payload) {
    handler.call(store, local.state, payload)
  })
}
function registerAction(store, type, handler, local) {
  const entry = store._actions[type] || (store._actions[type] = [])
  entry.push(function wrappedActionHandler(payload) {
    let res = handler.call(store, {
      dispatch: local.dispatch,//这里是模块自有的dispatch
      commit: local.commit,
      getters: local.getters,
      state: local.state,
      rootGetters: store.getters,
      rootState: store.state
    }, payload)
    if (!isPromise(res)) {
      res = Promise.resolve(res)
    }
    if (store._devtoolHook) {
      return res.catch(err => {
        store._devtoolHook.emit('vuex:error', err)
        throw err
      })
    } else {
      return res
    }
  })
}
function registerGetter(store, type, rawGetter, local) {
  if (store._wrappedGetters[type]) {
    if (__DEV__) {
      console.error(`[vuex] duplicate getter key: ${type}`)
    }
    return
  }
  store._wrappedGetters[type] = function wrappedGetter(store) {
    return rawGetter(
      local.state, // local state 自己模块的state
      local.getters, // local getters 自己模块的getters
      store.state, // root state 根模块的state
      store.getters // root getters 根模块的getters
    )
  }
}
function enableStrictMode(store) {//监听 state 的变化
  store._vm.$watch(function () { return this._data.$$state }, () => {
    if (__DEV__) {
      //当store._committing为false,并且 state变化了，才会警告
      //所以当通过commit改变state的时候，_committing是为true的
      assert(store._committing, `do not mutate vuex store state outside mutation handlers.`)
    }
  }, { deep: true, sync: true })
}
function getNestedState(state, path) {//通过path来获取对应模块的state
  return path.reduce((state, key) => state[key], state)
}
function unifyObjectStyle(type, payload, options) {
  if (isObject(type) && type.type) {
    options = payload
    payload = type
    type = type.type
  }

  if (__DEV__) {
    assert(typeof type === 'string', `expects string as the type, but found ${typeof type}.`)
  }

  return { type, payload, options }
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