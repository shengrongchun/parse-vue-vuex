import { Store, install } from './store'
import { mapState, mapMutations, mapGetters, mapActions, createNamespacedHelpers } from './helpers'

// 这种模式 vuex.Store
export default {
  Store,
  install,
  version: '__VERSION__',
  mapState,
  mapMutations,
  mapGetters,
  mapActions,
  createNamespacedHelpers,
}
// 这种模式 import {Store} from vuex
export {
  Store,
  install,
  mapState,
  mapMutations,
  mapGetters,
  mapActions,
  createNamespacedHelpers,
}