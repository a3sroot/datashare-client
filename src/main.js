import Vue from 'vue'
import VueI18n from 'vue-i18n'
import VueProgressBar from 'vue-progressbar'
import BootstrapVue from 'bootstrap-vue'

import router from './router'
import messages from './messages'
import store from './store'
import FontAwesomeIcon from './components/FontAwesomeIcon'

import '@/main.scss'

Vue.config.productionTip = false
Vue.use(VueI18n)
Vue.use(VueProgressBar, { color: '#852308' })
Vue.use(BootstrapVue)
// Font Awesome component must be available everywhere
Vue.component('font-awesome-icon', FontAwesomeIcon)

const i18n = new VueI18n({locale: 'en', fallbackLocale: 'en', messages})
/* eslint-disable no-new */
const vm = new Vue({
  i18n,
  router,
  store,
  render: h => h('router-view')
}).$mount('#app')

export default vm
