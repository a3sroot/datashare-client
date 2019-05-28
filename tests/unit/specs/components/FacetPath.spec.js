import Vuex from 'vuex'
import VueI18n from 'vue-i18n'
import BootstrapVue from 'bootstrap-vue'
import Murmur from '@icij/murmur'
import { mount, createLocalVue } from '@vue/test-utils'
import esConnectionHelper from 'tests/unit/specs/utils/esConnectionHelper'
import { IndexedDocument, letData } from 'tests/unit/es_utils'
import FacetPath from '@/components/FacetPath'
import messages from '@/lang/en'
import store from '@/store'
import find from 'lodash/find'

const localVue = createLocalVue()
localVue.use(VueI18n)
localVue.use(Murmur)
localVue.use(Vuex)
localVue.use(BootstrapVue)
const i18n = new VueI18n({ locale: 'en', messages: { 'en': messages } })

describe('FacetPath.vue', () => {
  esConnectionHelper()
  const es = esConnectionHelper.es
  let wrapper

  beforeAll(async () => {
    Murmur.config.set('dataDir', '/data')
    wrapper = mount(FacetPath, {
      localVue,
      i18n,
      store,
      propsData: {
        facet: find(store.state.search.facets, { name: 'path' })
      }
    })
    store.commit('search/reset')
  })

  it('should display an empty tree', async () => {
    await wrapper.vm.root.aggregate()

    expect(wrapper.findAll('.tree-node').length).toEqual(0)
  })

  it('should display a not empty tree', async () => {
    await letData(es).have(new IndexedDocument('/data/folder_01/doc_01')).commit()
    await letData(es).have(new IndexedDocument('/data/folder_02/doc_02')).commit()
    await letData(es).have(new IndexedDocument('/data/folder_03/doc_03')).commit()

    await wrapper.vm.root.aggregate()

    expect(wrapper.findAll('.tree-node').length).toEqual(3)
  })

  it('should display the first level of the tree', async () => {
    await letData(es).have(new IndexedDocument('/data/folder_01/doc_01')).commit()
    await letData(es).have(new IndexedDocument('/data/folder_02/doc_02')).commit()
    await letData(es).have(new IndexedDocument('/data/folder_02/folder_03/doc_03')).commit()

    await wrapper.vm.root.aggregate()

    expect(wrapper.findAll('.tree-node').length).toEqual(2)
  })
})
