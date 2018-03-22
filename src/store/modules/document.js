import client from '@/api/client'
import Response from '@/api/Response'

const state = {
  id: null,
  doc: null
}

const mutations = {
  id (state, id) {
    state.id = id
    state.doc = null
  },
  doc (state, raw) {
    if (raw !== null) {
      state.doc = Response.instantiate(raw)
    } else {
      state.doc = null
    }
  }
}

const actions = {
  get ({commit}, id) {
    commit('id', id)
    return client.getEsDoc(id, id).then(
      raw => commit('doc', raw),
      _ => commit('doc', null)
    )
  }
}

export default {
  namespaced: true,
  state,
  actions,
  mutations
}
