const target = typeof window !== 'undefined'
  ? window
  : typeof global !== 'undefined'
    ? global
    : {}
const devtoolHook = target.__VUE_DEVTOOLS_GLOBAL_HOOK__ //装了devtools就有这个属性了

export default function devtoolPlugin(store) {
  if (!devtoolHook) return

  store._devtoolHook = devtoolHook

  devtoolHook.emit('vuex:init', store)//vuex初始化发射事件
  //触发时光旅行执行 store.replaceState
  devtoolHook.on('vuex:travel-to-state', targetState => {
    store.replaceState(targetState)
  })
  //订阅mutation,当有mutation执行后，会执行下面定义的函数
  store.subscribe && store.subscribe((mutation, state) => {
    devtoolHook.emit('vuex:mutation', mutation, state)
  }, { prepend: true })//第一参数为函数， prepend: true，向数组的头部装入函数
  //订阅action,当有action执行后，会执行下面定义的函数
  store.subscribeAction && store.subscribeAction((action, state) => {
    devtoolHook.emit('vuex:action', action, state)
  }, { prepend: true })
}
