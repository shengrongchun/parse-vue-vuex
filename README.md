# hello-world

## Project setup
```
npm install
```

### Compiles and hot-reloads for development
```
npm run serve
```

### Compiles and minifies for production
```
npm run build
```

### Lints and fixes files
```
npm run lint
```

### Customize configuration
See [Configuration Reference](https://cli.vuejs.org/config/).


vuex 说明：
### 模块
vuex提出了模块的概念，因此我们不仅可以在根模块定义 state,mutations,actions,getters等，也可以在其他模块定义这些。当然其他模块都是定义在根模块里面，举例：
new vuex.store({
  state: {},
  mutations: {
    age(state,playload) {
      ……
    }
  },
  actions: {},
  getters: {},
  modules: {
    moduleA: {……},
    moduleB: {……}
  }
})
我们在调用执行mutations里面的name是这样的：this.$store.commit('age',参数)。那如果moduleA中的mutations也定义了age,此时是执行哪个age呢？
### 命名空间
其实vuex是非常聪明的，假如在不同模块定义了相同的mutations。在mutations收集阶段应该是这样的：
store._mutations: {
  'age': [age对应的handler],
  'moduleA/age': [moduleA里面age对应的handler]
}
这样看，就非常明显了，如果想调用moduleA中的age: this.$store.commit('moduleA/age', 参数)
按说一个对象中不可能定义两个相同key的mutation,为什么需要数组去装入handler。
因为模块A中的age有可能装入根模块中，官网介绍：https://vuex.vuejs.org/zh/api/#commit

### mutation 与 action 同步异步问题
vuex指定了mutation是需要同步的，如果你非要写成异步的，也不会报错，只是 devtools 无法追踪到状态的改变（只在mutation中追踪）
action中可以异步是因为最终异步结束后才会去执行mutation,mutation永远都是同步的，可以追踪状态改变


