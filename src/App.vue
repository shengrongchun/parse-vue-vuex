<template>
  <div>vuex {{test}}</div>
</template>
<script>
export default {
  data() {
    return {
      test: this.$store.test
    }
  },
  created() {
    console.log('$store', this.$store)
  }
}
</script>