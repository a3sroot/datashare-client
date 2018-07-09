import Vue from 'vue'
import Vuex from 'vuex'
import { getField, updateField } from 'vuex-map-fields'
import {DatashareClient} from '@/api/datashare'

Vue.use(Vuex)
const datashare = new DatashareClient()

export const state = {
  form: {
    action: 'index',
    pipeline: 'CORENLP',
    ocr: false
  },
  pollHandle: null,
  tasks: []
}

export const getters = {
  getField
}

export const mutations = {
  clear (state) {
    state.form.action = 'index'
    state.form.pipeline = 'CORENLP'
    state.form.ocr = false
    state.pollHandle = null
    // state.tasks = []
  },
  updateField,
  cleanTasks (state) {
    state.tasks = []
  },
  updateTasks (state, raw) {
    state.tasks = raw
  },
  startPolling (state) {
    state.pollHandle = setInterval(() => {
      datashare.getTasks().then(resp => resp.json().then(raw => this.commit('indexing/updateTasks', raw)))
    }, 2000)
  },
  stopPolling (state) {
    clearInterval(state.pollHandle)
    state.pollHandle = null
  }
}

export const actions = {
  query ({ state, commit }) {
    switch (state.form.action) {
      case 'index' :
        datashare.index({ocr: state.form.ocr})
        break
      case 'findNames' :
        datashare.findNames(state.form.pipeline, {resume: false})
        break
      default :
        break
    }
  },
  cleanTasks ({ state, commit }) {
    datashare.cleanTasks().then(commit('cleanTasks'))
  },
  startPollTasks ({ state, commit }) {
    commit('startPolling')
  },
  stopPollTasks ({ state, commit }) {
    commit('stopPolling')
  }
}

export default {
  namespaced: true,
  state,
  getters,
  actions,
  mutations
}
