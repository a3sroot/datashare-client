import { cloneDeep, find, omit } from 'lodash'
import { IndexedDocument, IndexedDocuments, letData } from 'tests/unit/es_utils'
import esConnectionHelper from 'tests/unit/specs/utils/esConnectionHelper'

import Document from '@/api/resources/Document'
import EsDocList from '@/api/resources/EsDocList'
import NamedEntity from '@/api/resources/NamedEntity'
import { storeBuilder } from '@/store/storeBuilder'

describe('SearchStore', () => {
  const { index: project, es } = esConnectionHelper.build()
  const { index: anotherProject } = esConnectionHelper.build()

  let store
  beforeAll(() => {
    store = storeBuilder({ elasticsearch: es })
    store.commit('search/index', project)
  })

  afterEach(() => {
    store.commit('search/index', project)
    store.commit('search/reset')
  })

  it('should define a store module', () => {
    expect(store.state.search).toBeDefined()
  })

  it('should instantiate the default 12 filters, with order', () => {
    const filters = store.getters['search/instantiatedFilters']

    expect(filters).toHaveLength(12)
    expect(find(filters, { name: 'contentType' }).order).toBe(40)
  })

  it('should reset to initial state', async () => {
    const initialState = cloneDeep(store.state.search)
    store.commit('search/indices', [anotherProject])
    store.commit('search/query', 'datashare')
    store.commit('search/size', 12)
    store.commit('search/sort', 'randomOrder')
    store.commit('search/addFilterValue', { name: 'contentType', value: 'TXT' })
    store.commit('search/toggleFilters')

    store.commit('search/reset')

    const omittedFields = ['index', 'indices', 'isReady', 'filters', 'showFilters', 'response', 'size', 'sort']
    expect(omit(store.state.search, omittedFields)).toEqual(omit(initialState, omittedFields))
    expect(store.state.search.indices).toEqual([anotherProject])
    expect(store.state.search.isReady).toBeTruthy()
    expect(find(store.getters['search/instantiatedFilters'], { name: 'contentType' }).values).toHaveLength(0)

    store.commit('search/size', 25)
  })

  it('should change the state after "query" mutation', async () => {
    await store.dispatch('search/query', 'bar')

    expect(store.state.search.query).toBe('bar')
  })

  it('should build a EsDocList object from raw value', () => {
    store.commit('search/buildResponse', {
      hits: {
        hits: [
          { _source: { type: 'Document' }, _id: 'foo' },
          { _source: { type: 'NamedEntity' }, _id: 'bar' }
        ]
      }
    })
    expect(store.state.search.response).toBeInstanceOf(EsDocList)
  })

  it('should build a correct EsDocList object from raw value', () => {
    store.commit('search/buildResponse', {
      hits: {
        hits: [
          { _source: { type: 'Document' }, _id: 'foo' },
          { _source: { type: 'NamedEntity' }, _id: 'bar' }
        ]
      }
    })
    expect(store.state.search.response.hits[0]).toBeInstanceOf(Document)
    expect(store.state.search.response.hits[1]).toBeInstanceOf(NamedEntity)
    expect(store.state.search.response.hits[2]).toBeUndefined()
  })

  it('should return document from local project', async () => {
    await letData(es).have(new IndexedDocument('document', project).withContent('bar')).commit()
    await store.dispatch('search/query', 'bar')

    expect(store.state.search.response.hits).toHaveLength(1)
    expect(store.state.search.response.hits[0].basename).toBe('document')
  })

  it('should return document from another project', async () => {
    await letData(es).have(new IndexedDocument('document', anotherProject).withContent('bar')).commit()
    await store.dispatch('search/query', { indices: [anotherProject], query: 'bar', from: 0, size: 25 })

    expect(store.state.search.response.hits).toHaveLength(1)
    expect(store.state.search.response.hits[0].basename).toBe('document')
  })

  it('should find 2 documents filtered by one contentType', async () => {
    await letData(es).have(new IndexedDocument('bar.txt', project).withContentType('txt').withContent('bar')).commit()
    await letData(es).have(new IndexedDocument('foo.txt', project).withContentType('txt').withContent('foo')).commit()
    await letData(es).have(new IndexedDocument('bar.pdf', project).withContentType('pdf').withContent('bar')).commit()
    await letData(es).have(new IndexedDocument('foo.pdf', project).withContentType('pdf').withContent('foo')).commit()

    await store.dispatch('search/query', '*')
    expect(store.state.search.response.hits).toHaveLength(4)
    await store.dispatch('search/addFilterValue', { name: 'contentType', value: 'pdf' })
    expect(store.state.search.response.hits).toHaveLength(2)
  })

  it('should find 3 documents filtered by two contentType', async () => {
    await letData(es).have(new IndexedDocument('bar.txt', project).withContentType('txt').withContent('bar')).commit()
    await letData(es).have(new IndexedDocument('bar.pdf', project).withContentType('pdf').withContent('bar')).commit()
    await letData(es).have(new IndexedDocument('bar.csv', project).withContentType('csv').withContent('bar')).commit()

    await store.dispatch('search/query', '*')
    expect(store.state.search.response.hits).toHaveLength(3)
    await store.dispatch('search/addFilterValue', { name: 'contentType', value: 'pdf' })
    expect(store.state.search.response.hits).toHaveLength(1)
    await store.dispatch('search/addFilterValue', { name: 'contentType', value: 'csv' })
    expect(store.state.search.response.hits).toHaveLength(2)
  })

  it('should not find documents after filtering by contentType', async () => {
    await letData(es).have(new IndexedDocument('bar.txt', project).withContentType('txt').withContent('bar')).commit()
    await letData(es).have(new IndexedDocument('bar.pdf', project).withContentType('pdf').withContent('bar')).commit()
    await letData(es).have(new IndexedDocument('bar.csv', project).withContentType('csv').withContent('bar')).commit()

    await store.dispatch('search/query', '*')
    expect(store.state.search.response.hits).toHaveLength(3)
    await store.dispatch('search/addFilterValue', { name: 'contentType', value: 'ico' })
    expect(store.state.search.response.hits).toHaveLength(0)
  })

  it('should find documents after removing filter by contentType', async () => {
    await letData(es).have(new IndexedDocument('bar.txt', project).withContentType('txt').withContent('bar')).commit()
    await letData(es).have(new IndexedDocument('bar.pdf', project).withContentType('pdf').withContent('bar')).commit()
    await letData(es).have(new IndexedDocument('bar.csv', project).withContentType('csv').withContent('bar')).commit()

    await store.dispatch('search/query', '*')
    expect(store.state.search.response.hits).toHaveLength(3)
    await store.dispatch('search/addFilterValue', { name: 'contentType', value: 'ico' })
    expect(store.state.search.response.hits).toHaveLength(0)
    await store.dispatch('search/removeFilterValue', { name: 'contentType', value: 'ico' })
    expect(store.state.search.response.hits).toHaveLength(3)
  })

  it('should exclude documents with a specific contentType', async () => {
    await letData(es).have(new IndexedDocument('bar.txt', project).withContentType('txt').withContent('bar')).commit()
    await letData(es).have(new IndexedDocument('bar.pdf', project).withContentType('pdf').withContent('bar')).commit()
    await letData(es).have(new IndexedDocument('bar.csv', project).withContentType('csv').withContent('bar')).commit()

    await store.dispatch('search/query', '*')
    expect(store.state.search.response.hits).toHaveLength(3)
    await store.dispatch('search/addFilterValue', { name: 'contentType', value: 'txt' })
    expect(store.state.search.response.hits).toHaveLength(1)
    await store.dispatch('search/toggleFilter', 'contentType')
    expect(store.state.search.response.hits).toHaveLength(2)
  })

  it('should exclude documents with a specific contentType and include them again', async () => {
    await letData(es).have(new IndexedDocument('bar.txt', project).withContent('bar').withNer('name_01')).commit()
    await letData(es).have(new IndexedDocument('foo.txt', project).withContent('foo').withNer('name_01')).commit()
    await letData(es).have(new IndexedDocument('bar.pdf', project).withContent('bar').withNer('name_01')).commit()
    await letData(es).have(new IndexedDocument('bar.csv', project).withContent('bar').withNer('name_02')).commit()
    await letData(es).have(new IndexedDocument('bar.ico', project).withContent('bar').withNer('name_02')).commit()

    await store.dispatch('search/addFilterValue', { name: 'namedEntityPerson', value: 'name_02' })
    expect(store.state.search.response.hits).toHaveLength(2)
  })

  it('should filter documents if a named entity is selected', async () => {
    await letData(es).have(new IndexedDocument('bar.txt', project).withContentType('txt').withContent('bar')).commit()
    await letData(es).have(new IndexedDocument('foo.txt', project).withContentType('txt').withContent('foo')).commit()
    await letData(es).have(new IndexedDocument('bar.pdf', project).withContentType('pdf').withContent('bar')).commit()
    await letData(es).have(new IndexedDocument('bar.csv', project).withContentType('csv').withContent('bar')).commit()
    await letData(es).have(new IndexedDocument('bar.ico', project).withContentType('ico').withContent('bar')).commit()

    await store.dispatch('search/query', '*')
    await store.dispatch('search/setFilterValue', { name: 'contentType', value: 'txt' })
    await store.dispatch('search/toggleFilter', 'contentType')
    expect(store.state.search.response.hits).toHaveLength(3)
    await store.dispatch('search/toggleFilter', 'contentType')
    expect(store.state.search.response.hits).toHaveLength(2)
  })

  describe('hasFilterValue', () => {
    it('this filter should have no values', () => {
      expect(store.getters['search/hasFilterValue']({ name: 'contentType' })).toBeFalsy()
    })

    it('this filter should have value', async () => {
      await store.dispatch('search/addFilterValue', { name: 'contentType', value: 'txt' })
      expect(store.getters['search/hasFilterValue']({ name: 'contentType', value: 'txt' })).toBeTruthy()
    })
  })

  describe('hasFilterValues', () => {
    it('should take into account the given filter', async () => {
      expect(store.getters['search/hasFilterValues']('contentType')).toBeFalsy()

      await store.dispatch('search/addFilterValue', { name: 'contentType', value: 'txt' })
      expect(store.getters['search/hasFilterValues']('contentType')).toBeTruthy()
    })

    it('should take into account the given filter but not an arbitrary one', async () => {
      await store.dispatch('search/addFilterValue', { name: 'contentType', value: 'txt' })

      expect(store.getters['search/hasFilterValues']('contentType')).toBeTruthy()
      expect(store.getters['search/hasFilterValues']('bar')).toBeFalsy()
    })

    it('should take into account the given filter and its invert', async () => {
      await store.dispatch('search/addFilterValue', { name: 'contentType', value: 'txt' })
      expect(store.getters['search/hasFilterValues']('contentType')).toBeTruthy()
      expect(store.getters['search/isFilterReversed']('contentType')).toBeFalsy()
      await store.dispatch('search/toggleFilter', 'contentType')
      expect(store.getters['search/isFilterReversed']('contentType')).toBeTruthy()
    })
  })

  it('should take into reverse a filter and not the others', async () => {
    await store.dispatch('search/addFilterValue', { name: 'contentType', value: 'txt' })
    await store.dispatch('search/addFilterValue', { name: 'language', value: 'fr' })
    await store.dispatch('search/toggleFilter', 'contentType')
    expect(store.getters['search/isFilterReversed']('contentType')).toBeTruthy()
    expect(store.getters['search/isFilterReversed']('language')).toBeFalsy()
  })

  it('should add filter with several values', async () => {
    await store.dispatch('search/addFilterValue', { name: 'contentType', value: ['txt', 'pdf'] })
    expect(store.getters['search/getFilter']({ name: 'contentType' }).values).toHaveLength(2)
  })

  it('should merge filter values with several other values', async () => {
    await store.dispatch('search/addFilterValue', { name: 'contentType', value: 'txt' })
    expect(store.getters['search/getFilter']({ name: 'contentType' }).values).toHaveLength(1)
    await store.dispatch('search/addFilterValue', { name: 'contentType', value: ['csv', 'pdf'] })
    expect(store.getters['search/getFilter']({ name: 'contentType' }).values).toHaveLength(3)
  })

  it('should add a filter value only once', async () => {
    await store.dispatch('search/addFilterValue', { name: 'contentType', value: ['txt', 'csv', 'pdf'] })
    expect(store.getters['search/getFilter']({ name: 'contentType' }).values).toHaveLength(3)
    await store.dispatch('search/addFilterValue', { name: 'contentType', value: ['txt', 'pdf'] })
    expect(store.getters['search/getFilter']({ name: 'contentType' }).values).toHaveLength(3)
  })

  it('should add a filter value only once even if numbers', async () => {
    await store.dispatch('search/addFilterValue', { name: 'contentType', value: [1, 2, 3] })
    expect(store.getters['search/getFilter']({ name: 'contentType' }).values).toHaveLength(3)
    await store.dispatch('search/addFilterValue', { name: 'contentType', value: ['1', '2'] })
    expect(store.getters['search/getFilter']({ name: 'contentType' }).values).toHaveLength(3)
  })

  it('should return 2 documents', async () => {
    await letData(es)
      .have(new IndexedDocuments().setBaseName('doc').withContent('this is a document').withIndex(project).count(4))
      .commit()

    await store.dispatch('search/query', { query: 'document', from: 0, size: 2 })
    expect(store.state.search.response.hits).toHaveLength(2)
    store.commit('search/size', 25)
  })

  it('should return 3 documents', async () => {
    await letData(es)
      .have(new IndexedDocuments().setBaseName('doc').withContent('this is a document').withIndex(project).count(4))
      .commit()

    await store.dispatch('search/query', { query: 'document', from: 0, size: 3 })
    expect(store.state.search.response.hits).toHaveLength(3)
    store.commit('search/size', 25)
  })

  it('should return 1 document (1/3)', async () => {
    await letData(es)
      .have(new IndexedDocuments().setBaseName('doc').withContent('this is a document').withIndex(project).count(4))
      .commit()

    await store.dispatch('search/query', { query: 'document', from: 3, size: 3 })
    expect(store.state.search.response.hits).toHaveLength(1)
    store.commit('search/size', 25)
  })

  it('should return 0 documents in total', async () => {
    await store.dispatch('search/query', '*')
    expect(store.state.search.response.total).toBe(0)
  })

  it('should return 5 documents in total', async () => {
    await letData(es)
      .have(new IndexedDocuments().setBaseName('doc').withContent('this is a document').withIndex(project).count(5))
      .commit()

    await store.dispatch('search/query', { query: 'document', from: 0, size: 2 })
    expect(store.state.search.response.total).toBe(5)
    store.commit('search/size', 25)
  })

  it('should return the default query parameters', () => {
    expect(store.getters['search/toRouteQuery']()).toMatchObject({
      field: 'all',
      indices: project,
      q: '',
      size: 25,
      from: 0
    })
  })

  it('should return an advanced and filtered query parameters', () => {
    store.commit('search/indices', [project])
    store.commit('search/query', 'datashare')
    store.commit('search/size', 12)
    store.commit('search/sort', 'randomOrder')
    store.commit('search/addFilterValue', { name: 'contentType', value: 'TXT' })

    expect(store.getters['search/toRouteQuery']()).toMatchObject({
      indices: project,
      q: 'datashare',
      from: 0,
      size: 12,
      sort: 'randomOrder',
      'f[contentType]': ['TXT']
    })

    store.commit('search/size', 25)
  })

  it('should reset the values of a filter', async () => {
    await store.dispatch('search/addFilterValue', { name: 'contentType', value: ['txt', 'csv'] })
    expect(store.getters['search/getFilter']({ name: 'contentType' }).values).toHaveLength(2)

    store.commit('search/resetFilterValues', 'contentType')
    expect(store.getters['search/getFilter']({ name: 'contentType' }).values).toHaveLength(0)
  })

  it('should change the state after `toggleFilters` mutation', () => {
    const showFilters = store.state.search.showFilters
    store.commit('search/toggleFilters')
    expect(store.state.search.showFilters).toBe(!showFilters)
  })

  describe('updateFromRouteQuery should not be cumulated with existing filter', () => {
    it('should set the query to empty after the store is updated with a route query', async () => {
      store.dispatch('search/updateFromRouteQuery', { q: 'foo' })
      expect(store.state.search.query).toBe('foo')
      store.dispatch('search/updateFromRouteQuery', { from: 0 })
      expect(store.state.search.query).toBe('')
    })

    it('should set the from to 0 after the store is updated with a route query', async () => {
      store.dispatch('search/updateFromRouteQuery', { q: 'foo', from: 10 })
      expect(store.state.search.query).toBe('foo')
      expect(store.state.search.from).toBe(10)
      store.dispatch('search/updateFromRouteQuery', { q: 'bar' })
      expect(store.state.search.query).toBe('bar')
      expect(store.state.search.from).toBe(0)
    })

    it('should reset the contentType filter after the store is updated with a route query', async () => {
      store.dispatch('search/updateFromRouteQuery', { 'f[contentType]': ['application/pdf'] })
      expect(store.getters['search/getFilter']({ name: 'contentType' }).values).toHaveLength(1)
      store.dispatch('search/updateFromRouteQuery', { q: 'bar' })
      expect(store.getters['search/getFilter']({ name: 'contentType' }).values).toHaveLength(0)
    })

    it('should not reset the "field" after the store is updated', async () => {
      store.dispatch('search/updateFromRouteQuery', { 'f[contentType]': ['application/pdf'], field: 'author' })
      expect(store.getters['search/getFilter']({ name: 'contentType' }).values).toHaveLength(1)
      store.dispatch('search/updateFromRouteQuery', { q: 'bar' })
      expect(store.state.search.field).toBe('author')
    })

    it('should not empty "index" and "indices" after the store is updated', async () => {
      store.dispatch('search/updateFromRouteQuery', { index: 'local', indices: ['local', 'project'] })
      expect(store.state.search.index).toBe('local')
      expect(store.state.search.indices).toEqual(['local', 'project'])
      store.dispatch('search/updateFromRouteQuery', { from: 0 })
      expect(store.state.search.index).toBe('local')
      expect(store.state.search.indices).toEqual(['local', 'project'])
    })

    it('should not empty "layout" after the store is updated', async () => {
      store.commit('search/layout', 'grid')
      expect(store.state.search.layout).toBe('grid')
      store.dispatch('search/updateFromRouteQuery', { from: 0 })
      expect(store.state.search.layout).toBe('grid')
    })
  })

  describe('updateFromRouteQuery should restore search state from url', () => {
    it('should set the project of the store according to the url', async () => {
      store.commit('search/index', project)
      store.dispatch('search/updateFromRouteQuery', { indices: process.env.VUE_APP_ES_ANOTHER_INDEX })

      expect(store.state.search.index).toBe(process.env.VUE_APP_ES_ANOTHER_INDEX)
    })

    it('should set the query of the store according to the url', async () => {
      store.commit('search/query', 'anything')
      store.dispatch('search/updateFromRouteQuery', { q: 'new_query' })

      expect(store.state.search.query).toBe('new_query')
    })

    it('should set the from of the store according to the url', async () => {
      store.commit('search/from', 12)
      store.dispatch('search/updateFromRouteQuery', { from: 42 })

      expect(store.state.search.from).toBe(42)
    })

    it('should RESET the from of the store according to the url', async () => {
      store.commit('search/from', 12)
      store.dispatch('search/updateFromRouteQuery', { from: 0 })

      expect(store.state.search.from).toBe(0)
    })

    it('should set the size of the store according to the url', async () => {
      store.commit('search/size', 12)
      store.dispatch('search/updateFromRouteQuery', { size: 24 })

      expect(store.state.search.size).toBe(24)
      store.commit('search/size', 25)
    })

    it('should set the sort of the store according to the url', async () => {
      store.commit('search/sort', 'anything')
      store.dispatch('search/updateFromRouteQuery', { sort: 'new_sort' })

      expect(store.state.search.sort).toBe('new_sort')
    })

    it('should set the filter of the store according to the url', async () => {
      store.dispatch('search/updateFromRouteQuery', { 'f[contentType]': ['new_type'] })
      expect(store.getters['search/getFilter']({ name: 'contentType' }).values[0]).toBe('new_type')
    })

    it('should not change the field on updateFromRouteQuery', async () => {
      store.commit('search/field', 'author')
      store.dispatch('search/updateFromRouteQuery', {})

      expect(store.state.search.field).toBe('author')
    })
  })

  it("should not delete the term from the query if it doesn't exist", async () => {
    store.commit('search/query', '*')
    await store.dispatch('search/deleteQueryTerm', 'term')

    expect(store.state.search.query).toBe('*')
  })

  it('should delete the term from the query', async () => {
    store.commit('search/query', 'this is a query')
    await store.dispatch('search/deleteQueryTerm', 'is')

    expect(store.state.search.query).toBe('this a query')
  })

  it('should delete all occurrences of the term from the query', async () => {
    store.commit('search/query', 'this is is is a query')
    await store.dispatch('search/deleteQueryTerm', 'is')

    expect(store.state.search.query).toBe('this a query')
  })

  it('should delete "AND" boolean operator on first applied filter deletion, if any', async () => {
    store.commit('search/query', 'term_01 AND term_02')
    await store.dispatch('search/deleteQueryTerm', 'term_01')

    expect(store.state.search.query).toBe('term_02')
  })

  it('should delete "OR" boolean operator on first applied filter deletion, if any', async () => {
    store.commit('search/query', 'term_01 OR term_02')
    await store.dispatch('search/deleteQueryTerm', 'term_01')

    expect(store.state.search.query).toBe('term_02')
  })

  it('should delete "AND" boolean operator on last applied filter deletion, if any', async () => {
    store.commit('search/query', 'term_01 AND term_02')
    await store.dispatch('search/deleteQueryTerm', 'term_02')

    expect(store.state.search.query).toBe('term_01')
  })

  it('should delete "OR" boolean operator on last applied filter deletion, if any', async () => {
    store.commit('search/query', 'term_01 OR term_02')
    await store.dispatch('search/deleteQueryTerm', 'term_02')

    expect(store.state.search.query).toBe('term_01')
  })

  describe('retrieveQueryTerm', () => {
    it('should retrieve no applied filters (1/2)', () => {
      store.commit('search/query', '*')

      expect(store.getters['search/retrieveQueryTerms']).toEqual([])
    })

    it('should retrieve no applied filters (2/2)', () => {
      store.commit('search/query', '   ')

      expect(store.getters['search/retrieveQueryTerms']).toEqual([])
    })

    it('should retrieve 1 applied filter', () => {
      store.commit('search/query', 'term_01')

      expect(store.getters['search/retrieveQueryTerms']).toEqual([
        { field: '', label: 'term_01', negation: false, regex: false }
      ])
    })

    it('should retrieve 2 applied filters', () => {
      store.commit('search/query', 'term_01 term_02')

      expect(store.getters['search/retrieveQueryTerms']).toEqual([
        { field: '', label: 'term_01', negation: false, regex: false },
        { field: '', label: 'term_02', negation: false, regex: false }
      ])
    })

    it('should retrieve 3 applied filters', () => {
      store.commit('search/query', 'term_01 term_02 term_03')

      expect(store.getters['search/retrieveQueryTerms']).toEqual([
        { field: '', label: 'term_01', negation: false, regex: false },
        { field: '', label: 'term_02', negation: false, regex: false },
        { field: '', label: 'term_03', negation: false, regex: false }
      ])
    })

    it('should merge 2 identical terms', () => {
      store.commit('search/query', 'term_01 term_01')

      expect(store.getters['search/retrieveQueryTerms']).toEqual([
        { field: '', label: 'term_01', negation: false, regex: false }
      ])
    })

    it('should filter on boolean operators "AND" and "OR"', () => {
      store.commit('search/query', 'term_01 AND term_02 OR term_03')

      expect(store.getters['search/retrieveQueryTerms']).toEqual([
        { field: '', label: 'term_01', negation: false, regex: false },
        { field: '', label: 'term_02', negation: false, regex: false },
        { field: '', label: 'term_03', negation: false, regex: false }
      ])
    })

    it('should filter on fuzziness number', () => {
      store.commit('search/query', 'term_01~2 term_02')

      expect(store.getters['search/retrieveQueryTerms']).toEqual([
        { field: '', label: 'term_01', negation: false, regex: false },
        { field: '', label: 'term_02', negation: false, regex: false }
      ])
    })

    it('should not split an exact search sentence', () => {
      store.commit('search/query', 'term_01 "and an exact term" term_02')

      expect(store.getters['search/retrieveQueryTerms']).toEqual([
        { field: '', label: 'term_01', negation: false, regex: false },
        { field: '', label: 'and an exact term', negation: false, regex: false },
        { field: '', label: 'term_02', negation: false, regex: false }
      ])
    })

    it('should display field name', () => {
      store.commit('search/query', 'field_name:term_01')

      expect(store.getters['search/retrieveQueryTerms']).toEqual([
        { field: 'field_name', label: 'term_01', negation: false, regex: false }
      ])
    })

    it('should return a negation parameter according to the prefix', () => {
      store.commit('search/query', '-term_01 +term_02 !term_03')

      expect(store.getters['search/retrieveQueryTerms']).toEqual([
        { field: '', label: 'term_01', negation: true, regex: false },
        { field: '', label: 'term_02', negation: false, regex: false },
        { field: '', label: 'term_03', negation: true, regex: false }
      ])
    })

    it('should return a negation parameter if query starts by "NOT"', () => {
      store.commit('search/query', 'NOT term_01')

      expect(store.getters['search/retrieveQueryTerms']).toEqual([
        { field: '', label: 'term_01', negation: true, regex: false }
      ])
    })

    it('should return a negation parameter if query contains "AND NOT" or "OR NOT"', () => {
      store.commit('search/query', 'term_01 AND NOT term_02 NOT term_03')

      expect(store.getters['search/retrieveQueryTerms']).toEqual([
        { field: '', label: 'term_01', negation: false, regex: false },
        { field: '', label: 'term_02', negation: true, regex: false },
        { field: '', label: 'term_03', negation: true, regex: false }
      ])
    })

    it('should remove escaped slash', () => {
      store.commit('search/query', 'term\\:other')

      expect(store.getters['search/retrieveQueryTerms']).toEqual([
        { field: '', label: 'term:other', negation: false, regex: false }
      ])
    })

    it('should grab terms between brackets', () => {
      store.commit('search/query', 'term_01 (term_02 AND -term_03) term_04')

      expect(store.getters['search/retrieveQueryTerms']).toEqual([
        { field: '', label: 'term_01', negation: false, regex: false },
        { field: '', label: 'term_02', negation: false, regex: false },
        { field: '', label: 'term_03', negation: true, regex: false },
        { field: '', label: 'term_04', negation: false, regex: false }
      ])
    })

    it('should apply the negation only to the second group', () => {
      store.commit('search/query', '(term_01 term_02) NOT term_03')

      expect(store.getters['search/retrieveQueryTerms']).toEqual([
        { field: '', label: 'term_01', negation: false, regex: false },
        { field: '', label: 'term_02', negation: false, regex: false },
        { field: '', label: 'term_03', negation: true, regex: false }
      ])
    })

    it('should detect regex and return it as true', () => {
      store.commit('search/query', '/test and.*/')

      expect(store.getters['search/retrieveQueryTerms']).toEqual([
        { field: '', label: 'test and.*', negation: false, regex: true }
      ])
    })

    it('should replace escaped arobase in regex', () => {
      store.commit('search/query', '/.*\\@.*/')

      expect(store.getters['search/retrieveQueryTerms']).toEqual([
        { field: '', label: '.*@.*', negation: false, regex: true }
      ])
    })
  })

  describe('deleteQueryTerm', () => {
    it('should delete 1 simple query term', async () => {
      store.commit('search/query', 'term_01')
      await store.dispatch('search/deleteQueryTerm', 'term_01')

      expect(store.state.search.query).toBe('')
    })

    it('should delete 1 simple prefixed query term', async () => {
      store.commit('search/query', '-term_01')
      await store.dispatch('search/deleteQueryTerm', 'term_01')

      expect(store.state.search.query).toBe('')
    })

    it('should delete 1 simple negative query term', async () => {
      store.commit('search/query', 'NOT term_01')
      await store.dispatch('search/deleteQueryTerm', 'term_01')

      expect(store.state.search.query).toBe('')
    })

    it('should delete a term from a complex query', async () => {
      store.commit('search/query', 'term_01 AND term_02')
      await store.dispatch('search/deleteQueryTerm', 'term_02')

      expect(store.state.search.query).toBe('term_01')
    })

    it('should delete a negative term from a complex query', async () => {
      store.commit('search/query', 'term_01 AND NOT term_02')
      await store.dispatch('search/deleteQueryTerm', 'term_02')

      expect(store.state.search.query).toBe('term_01')
    })

    it('should delete a term from a recursive query', async () => {
      store.commit('search/query', 'term_01 term_02 term_03')
      await store.dispatch('search/deleteQueryTerm', 'term_03')

      expect(store.state.search.query).toBe('term_01 term_02')
    })

    it('should delete a negative term from a recursive query', async () => {
      store.commit('search/query', 'term_01 AND NOT term_02 term_03')
      await store.dispatch('search/deleteQueryTerm', 'term_02')

      expect(store.state.search.query).toBe('term_01 term_03')
    })

    it('should delete duplicated term from a query', async () => {
      store.commit('search/query', 'term_01 term_02 term_01')
      await store.dispatch('search/deleteQueryTerm', 'term_01')

      expect(store.state.search.query).toBe('term_02')
    })

    it('should delete term from a query with parenthesis', async () => {
      store.commit('search/query', 'term_01 (term_02 AND term_03) term_04')
      await store.dispatch('search/deleteQueryTerm', 'term_02')

      expect(store.state.search.query).toBe('term_01 term_03 term_04')
    })
  })

  it('should find document on querying the NamedEntity', async () => {
    const document = new IndexedDocument('doc_01', project)
    document.withNer('test')
    document.withContent('this is the doc_01 and a mention of "test"')
    await letData(es).have(document).commit()

    await store.dispatch('search/query', 'test')

    expect(store.state.search.response.hits).toHaveLength(1)
    expect(store.state.search.response.hits[0].basename).toBe('doc_01')
  })

  it('should not find document on querying the NamedEntity if it isnt in its content', async () => {
    const document = new IndexedDocument('doc_01', project)
    document.withNer('test')
    document.withContent('this is the doc_01 and no mention of the Named-Entity-Who-Must-Not-Be-Named')
    await letData(es).have(document).commit()

    await store.dispatch('search/query', 'test')

    expect(store.state.search.response.hits).toHaveLength(0)
  })

  it('should find document on querying the NamedEntity with a complex query', async () => {
    await letData(es)
      .have(new IndexedDocument('doc_01', project).withContent('test of ner_01').withNer('ner_01'))
      .commit()
    await letData(es)
      .have(new IndexedDocument('doc_02', project).withContent('test of ner_02').withNer('ner_02'))
      .commit()
    await letData(es).have(new IndexedDocument('doc_03', project).withContent('no content').withNer('test')).commit()

    await store.dispatch('search/query', '(test AND ner_*) OR test')

    expect(store.state.search.response.hits).toHaveLength(2)
    expect(store.state.search.response.hits[0].basename).toBe('doc_01')
    expect(store.state.search.response.hits[1].basename).toBe('doc_02')
  })

  it('should set this value to the filter', () => {
    const name = 'creationDate'
    store.commit('search/setFilterValue', { name, value: '12' })
    store.commit('search/setFilterValue', { name, value: '42' })

    expect(find(store.getters['search/instantiatedFilters'], { name }).values).toEqual([42])
  })

  it('should order documents by path', async () => {
    await letData(es).have(new IndexedDocument('c', project)).commit()
    await letData(es).have(new IndexedDocument('b', project)).commit()
    await letData(es).have(new IndexedDocument('a', project)).commit()

    await store.dispatch('search/query', '*')

    expect(store.state.search.response.hits).toHaveLength(3)
    expect(store.state.search.response.hits[0].shortId).toBe('a')
    expect(store.state.search.response.hits[1].shortId).toBe('b')
    expect(store.state.search.response.hits[2].shortId).toBe('c')
  })

  describe('sortedFilters with language filter', () => {
    beforeEach(() => {
      store.commit('search/reset')
    })

    it('this filter should have no sortedFilters', () => {
      expect(Object.keys(store.state.search.sortedFilters).length).toBe(0)
    })

    it('this filter should have one sorted filter', () => {
      store.commit('search/sortFilter', { name: 'language', sortBy: '_key', sortByOrder: 'asc' })
      expect(Object.keys(store.state.search.sortedFilters).length).toBe(1)
    })

    it('this filter should sort language by _count', () => {
      store.commit('search/sortFilter', { name: 'language', sortBy: '_count', sortByOrder: 'asc' })
      expect(store.getters['search/filterSortedBy']('language')).toBe('_count')
      expect(store.getters['search/filterSortedByOrder']('language')).toBe('asc')
    })

    it('this filter should sort language by _count once', () => {
      store.commit('search/sortFilter', { name: 'language', sortBy: '_key', sortByOrder: 'desc' })
      store.commit('search/sortFilter', { name: 'language', sortBy: '_count', sortByOrder: 'asc' })
      expect(store.getters['search/filterSortedBy']('language')).toBe('_count')
      expect(store.getters['search/filterSortedByOrder']('language')).toBe('asc')
      expect(Object.keys(store.state.search.sortedFilters).length).toBe(1)
    })

    it('this filter should not sort language anymore', () => {
      store.commit('search/sortFilter', { name: 'language', sortBy: '_key', sortByOrder: 'desc' })
      expect(Object.keys(store.state.search.sortedFilters).length).toBe(1)
      store.commit('search/unsortFilter', 'language')
      expect(Object.keys(store.state.search.sortedFilters).length).toBe(0)
    })

    it('this filter should have a default sort for language', () => {
      expect(Object.keys(store.state.search.sortedFilters).length).toBe(0)
      expect(store.getters['search/filterSortedBy']('language')).not.toBeUndefined()
      expect(store.getters['search/filterSortedByOrder']('language')).not.toBeUndefined()
    })
  })
})
