import Vuex from 'vuex'
import VueI18n from 'vue-i18n'
import BootstrapVue from 'bootstrap-vue'
import { createLocalVue, mount } from '@vue/test-utils'

import trim from 'lodash/trim'
import find from 'lodash/find'

import esConnectionHelper from 'tests/unit/specs/utils/esConnectionHelper'
import { EventBus } from '@/utils/event-bus.js'
import FacetNamedEntity from '@/components/FacetNamedEntity'
import FontAwesomeIcon from '@/components/FontAwesomeIcon'
import { IndexedDocument, letData } from 'tests/unit/es_utils'
import messages from '@/messages'
import router from '@/router'
import store from '@/store'

jest.mock('@/api/DatashareClient', () => {
  return jest.fn().mockImplementation(() => {
    return {deleteNamedEntitiesByMentionNorm: jest.fn().mockImplementation(() => {
      return Promise.resolve()
    })}
  })
})

const localVue = createLocalVue()
localVue.use(Vuex)
localVue.use(BootstrapVue)
localVue.use(VueI18n)
localVue.component('font-awesome-icon', FontAwesomeIcon)

const i18n = new VueI18n({locale: 'en', messages})

describe('FacetNamedEntity.vue', () => {
  esConnectionHelper()
  var es = esConnectionHelper.es
  var wrapped = null
  beforeEach(async () => {
    wrapped = mount(FacetNamedEntity, { localVue, i18n, router, store, propsData: { facet: find(store.state.aggregation.facets, {name: 'named-entity'}) } })
    await wrapped.vm.root.aggregate()
  })

  afterEach(async () => {
    store.commit('search/reset')
    store.commit('aggregation/reset')
  })

  it('should display empty list', async () => {
    await wrapped.vm.root.aggregate()
    await wrapped.vm.root.$nextTick()

    expect(wrapped.vm.$el.querySelectorAll('.facet__items__item').length).toEqual(0)
  })

  it('should display one named entity', async () => {
    await letData(es).have(new IndexedDocument('docs/naz.txt').withContent('this is a naz document').withNer('naz')).commit()
    await wrapped.vm.root.aggregate()
    await wrapped.vm.root.$nextTick()

    expect(wrapped.vm.$el.querySelectorAll('.facet__items__item').length).toEqual(1)
    expect(trim(wrapped.vm.$el.querySelector('.facet__items__item__description').textContent)).toEqual('one occurrence in one doc')
  })

  it('should display two named entities in one document', async () => {
    await letData(es).have(new IndexedDocument('docs/qux.txt').withContent('this is a document').withNer('qux').withNer('foo')).commit()
    await wrapped.vm.root.aggregate()
    await wrapped.vm.root.$nextTick()

    expect(wrapped.vm.$el.querySelectorAll('.facet__items__item').length).toEqual(2)
  })

  it('should display one named entity in two documents', async () => {
    await letData(es).have(new IndexedDocument('docs/doc1.txt').withContent('a NER document contain 2 NER').withNer('NER', 2).withNer('NER', 25)).commit()
    await letData(es).have(new IndexedDocument('docs/doc2.txt').withContent('another document with NER').withNer('NER', 22)).commit()

    await wrapped.vm.root.aggregate()
    await wrapped.vm.root.$nextTick()

    expect(wrapped.vm.$el.querySelectorAll('.facet__items__item').length).toEqual(1)
    expect(trim(wrapped.vm.$el.querySelector('.facet__items__item__description').textContent)).toEqual('3 occurrences in 2 docs')
  })

  it('should display three named entities in two documents with right order', async () => {
    await letData(es).have(new IndexedDocument('docs/doc1.txt').withContent('a NER1 document').withNer('NER1', 2)).commit()
    await letData(es).have(new IndexedDocument('docs/doc2.txt').withContent('a NER2 doc with NER2 NER2 NER1 and NER3')
      .withNer('NER2', 2).withNer('NER2', 16).withNer('NER2', 21).withNer('NER1', 26).withNer('NER3', 35)).commit()

    await wrapped.vm.root.aggregate()
    await wrapped.vm.root.$nextTick()

    expect(wrapped.vm.$el.querySelectorAll('.facet__items__item').length).toEqual(3)
    expect(wrapped.vm.$el.querySelectorAll('.facet__items__item__body__key')[0].textContent.trim()).toEqual('NER1')
    expect(wrapped.vm.$el.querySelectorAll('.facet__items__item__body__key')[1].textContent.trim()).toEqual('NER2')
    expect(wrapped.vm.$el.querySelectorAll('.facet__items__item__body__key')[2].textContent.trim()).toEqual('NER3')
  })

  it('should not display the more button', async () => {
    await letData(es).have(new IndexedDocument('docs/doc1.txt').withContent('a NER1 document').withNer('NER1', 2)).commit()
    await letData(es).have(new IndexedDocument('docs/doc2.txt').withContent('a NER2 doc with NER2 NER2 NER1 and NER3')
      .withNer('NER2', 2).withNer('NER2', 16).withNer('NER2', 21).withNer('NER1', 26).withNer('NER3', 35)).commit()

    await wrapped.vm.root.aggregate()
    await wrapped.vm.root.$nextTick()

    expect(wrapped.vm.$el.querySelectorAll('.facet__items__display span').length).toEqual(0)
  })

  it('should display the more button and its font awesome icon', async () => {
    await letData(es).have(new IndexedDocument('docs/doc1.txt').withContent('a NER1 document').withNer('NER1', 2)).commit()
    await letData(es).have(new IndexedDocument('docs/doc2.txt').withContent('a NER2 doc with NER2 NER2 NER1 NER3 NER4 NER5 and NER6')
      .withNer('NER2', 2).withNer('NER2', 16).withNer('NER2', 21).withNer('NER1', 26).withNer('NER3', 35).withNer('NER4', 42).withNer('NER5', 42).withNer('NER6', 42)).commit()

    await wrapped.vm.root.aggregate()
    await wrapped.vm.root.$nextTick()

    expect(wrapped.vm.$el.querySelectorAll('.facet__items__display > span').length).toEqual(1)
    expect(trim(wrapped.vm.$el.querySelector('.facet__items__display > span').textContent)).toEqual('More')
    expect(trim(wrapped.vm.$el.querySelectorAll('.facet__items__display svg[data-icon="angle-down"]').length)).toEqual('1')
  })

  it('should display the more button and its font awesome icon', async () => {
    await letData(es).have(new IndexedDocument('docs/doc1.txt').withContent('a NER1 document').withNer('NER1', 2)).commit()
    await letData(es).have(new IndexedDocument('docs/doc2.txt').withContent('a NER2 doc with NER2 NER2 NER1 NER3 NER4 NER5 and NER6')
      .withNer('NER2', 2).withNer('NER2', 16).withNer('NER2', 21).withNer('NER1', 26).withNer('NER3', 35).withNer('NER4', 42).withNer('NER5', 42).withNer('NER6', 42)).commit()

    await wrapped.vm.root.aggregate()
    await wrapped.vm.root.$nextTick()

    expect(wrapped.vm.$el.querySelectorAll('.facet__items__display > span').length).toEqual(1)
    expect(trim(wrapped.vm.$el.querySelector('.facet__items__display > span').textContent)).toEqual('More')
    expect(trim(wrapped.vm.$el.querySelectorAll('.facet__items__display svg[data-icon="angle-down"]').length)).toEqual('1')
  })

  it('should filter on named entity facet and return no documents', async () => {
    await letData(es).have(new IndexedDocument('docs/doc1.txt').withContent('a NER1 document').withNer('NER1', 1)).commit()
    await letData(es).have(new IndexedDocument('docs/doc2.txt').withContent('a NER1 document').withNer('NER2', 2)).commit()
    await letData(es).have(new IndexedDocument('docs/doc3.txt').withContent('a NER1 document').withNer('NER3', 3)).commit()
    await letData(es).have(new IndexedDocument('docs/doc4.txt').withContent('a NER1 document').withNer('NER4', 4)).commit()

    wrapped.vm.root.facetQuery = 'Windows'

    await wrapped.vm.root.aggregate()
    await wrapped.vm.root.$nextTick()

    expect(wrapped.vm.$el.querySelectorAll('.facet__items__item').length).toEqual(0)
  })

  it('should filter on named entity facet and return all documents', async () => {
    await letData(es).have(new IndexedDocument('docs/doc1.txt').withContent('a NER1 document').withNer('NER1', 1)).commit()
    await letData(es).have(new IndexedDocument('docs/doc2.txt').withContent('a NER1 document').withNer('NER2', 2)).commit()
    await letData(es).have(new IndexedDocument('docs/doc3.txt').withContent('a NER1 document').withNer('NER3', 3)).commit()
    await letData(es).have(new IndexedDocument('docs/doc4.txt').withContent('a NER1 document').withNer('NER4', 4)).commit()

    wrapped.vm.root.facetQuery = 'ner'

    await wrapped.vm.root.aggregate()
    await wrapped.vm.root.$nextTick()

    expect(wrapped.vm.$el.querySelectorAll('.facet__items__item').length).toEqual(4)
  })

  it('should filter on named entity facet and return only 1 document', async () => {
    await letData(es).have(new IndexedDocument('docs/doc1.txt').withContent('a NER1 document').withNer('NER1', 1)).commit()
    await letData(es).have(new IndexedDocument('docs/doc2.txt').withContent('a NER1 document').withNer('NER2', 2)).commit()
    await letData(es).have(new IndexedDocument('docs/doc3.txt').withContent('a NER1 document').withNer('NER3', 3)).commit()
    await letData(es).have(new IndexedDocument('docs/doc4.txt').withContent('a NER1 document').withNer('NER4', 4)).commit()

    wrapped.vm.root.facetQuery = 'ner1'

    await wrapped.vm.root.aggregate()
    await wrapped.vm.root.$nextTick()

    expect(wrapped.vm.$el.querySelectorAll('.facet__items__item').length).toEqual(1)
  })

  it('should display the dropdown menu', async () => {
    await letData(es).have(new IndexedDocument('docs/naz.txt').withContent('this is a naz document').withNer('naz')).commit()
    await wrapped.vm.root.aggregate()
    await wrapped.vm.root.$nextTick()

    expect(wrapped.vm.$el.querySelectorAll('.facet__items__item .facet__items__item__menu').length).toEqual(1)
    expect(wrapped.vm.$el.querySelectorAll('.facet__items__item .facet__items__item__menu .dropdown-item').length).toEqual(1)
  })

  it('should emit a facet::hide::named-entities event on click to delete named entity', async () => {
    await letData(es).have(new IndexedDocument('doc_01.txt').withContent('this is a naz document').withNer('naz')).commit()
    await wrapped.vm.root.aggregate()
    await wrapped.vm.root.$nextTick()

    const mockCallback = jest.fn()
    EventBus.$on('facet::hide::named-entities', mockCallback)

    await wrapped.find('.facet__items__item .facet__items__item__menu .dropdown-item:first-child').trigger('click')

    expect(mockCallback.mock.calls.length).toEqual(1)
  })

  it('should call the aggregate function after a named entity deletion', async () => {
    await letData(es).have(new IndexedDocument('doc_01.txt').withContent('this is a naz document').withNer('naz')).commit()
    await wrapped.vm.root.aggregate()
    await wrapped.vm.root.$nextTick()

    const spyAggregate = jest.spyOn(wrapped.vm.root, 'aggregate')
    expect(spyAggregate).not.toBeCalled()

    await wrapped.find('.facet__items__item .facet__items__item__menu .dropdown-item:first-child').trigger('click')

    expect(spyAggregate).toBeCalled()
    expect(spyAggregate).toBeCalledTimes(1)
  })
})
