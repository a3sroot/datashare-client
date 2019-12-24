import find from 'lodash/find'
import toLower from 'lodash/toLower'
import { createLocalVue, mount } from '@vue/test-utils'
import Murmur from '@icij/murmur'

import { App } from '@/main'
import { datashare } from '@/store/modules/search'
import esConnectionHelper from 'tests/unit/specs/utils/esConnectionHelper'
import FacetPath from '@/components/FacetPath'
import { IndexedDocument, letData } from 'tests/unit/es_utils'
import { jsonResp } from 'tests/unit/tests_utils'

const { localVue, store } = App.init(createLocalVue()).useAll()

describe('FacetPath.vue', () => {
  const index = toLower('FacetPath')
  esConnectionHelper(index)
  const es = esConnectionHelper.es
  let wrapper

  beforeAll(() => {
    Murmur.config.set('dataDir', '/data')
    wrapper = mount(FacetPath, {
      localVue,
      store,
      propsData: { facet: find(store.state.search.facets, { name: 'path' }) },
      mocks: { $t: msg => msg, $te: msg => msg, $n: msg => msg }
    })
    store.commit('search/reset')
  })

  beforeEach(() => {
    jest.spyOn(datashare, 'fetch')
    datashare.fetch.mockReturnValue(jsonResp())
    store.commit('search/setGlobalSearch', false)
  })

  afterAll(() => datashare.fetch.mockRestore())

  it('should display an empty tree', async () => {
    await wrapper.vm.root.aggregate()

    expect(wrapper.findAll('.tree-node').length).toEqual(0)
  })

  it('should display a not empty tree', async () => {
    await letData(es).have(new IndexedDocument('/data/folder_01/doc_01', index)).commit()
    await letData(es).have(new IndexedDocument('/data/folder_02/doc_02', index)).commit()
    await letData(es).have(new IndexedDocument('/data/folder_03/doc_03', index)).commit()

    await wrapper.vm.root.aggregate()

    expect(wrapper.findAll('.tree-node').length).toEqual(3)
  })

  it('should display the first level of the tree', async () => {
    await letData(es).have(new IndexedDocument('/data/folder_01/doc_01', index)).commit()
    await letData(es).have(new IndexedDocument('/data/folder_02/doc_02', index)).commit()
    await letData(es).have(new IndexedDocument('/data/folder_02/folder_03/doc_03', index)).commit()

    await wrapper.vm.root.aggregate()

    expect(wrapper.findAll('.tree-node').length).toEqual(2)
  })

  describe('filter the facet', () => {
    it('should filter items according to the path facet search', async () => {
      await letData(es).have(new IndexedDocument('/data/folder_01/document_01', index)).commit()
      await letData(es).have(new IndexedDocument('/data/folder_02/document_02', index)).commit()

      const pathFacet = find(store.state.search.facets, { name: 'path' })
      pathFacet.value = ['/data/folder_01/']
      store.commit('search/addFacetValue', pathFacet)
      await wrapper.vm.root.aggregate()

      expect(wrapper.findAll('.tree-node')).toHaveLength(1)
    })

    it('should filter on a specific folder even if another folder starts with the same name', async () => {
      await letData(es).have(new IndexedDocument('/data/folder_1/document_01', index)).commit()
      await letData(es).have(new IndexedDocument('/data/folder_11/document_02', index)).commit()
      await letData(es).have(new IndexedDocument('/data/folder_22/document_03', index)).commit()

      const pathFacet = find(store.state.search.facets, { name: 'path' })
      pathFacet.value = ['/data/folder_1/']
      store.commit('search/addFacetValue', pathFacet)
      await wrapper.vm.root.aggregate()

      expect(wrapper.findAll('.tree-node')).toHaveLength(1)
    })
  })
})
