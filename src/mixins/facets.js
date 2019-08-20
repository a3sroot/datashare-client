import utils from '@/mixins/utils'
import { escapeRegExp } from '@/utils/strings'
import camelCase from 'lodash/camelCase'
import find from 'lodash/find'
import flatten from 'lodash/flatten'
import get from 'lodash/get'
import last from 'lodash/last'
import map from 'lodash/map'
import pick from 'lodash/pick'
import reduce from 'lodash/reduce'

export const mixin = {
  mixins: [utils],
  props: {
    facet: {
      type: Object
    },
    hideHeader: {
      type: Boolean,
      default: false
    },
    hideSearch: {
      type: Boolean,
      default: false
    },
    hideShowMore: {
      type: Boolean,
      default: false
    },
    hideExclude: {
      type: Boolean,
      default: false
    },
    asyncItems: {
      type: Array,
      default: null
    },
    asyncTotalCount: 0
  },
  data () {
    return {
      isReady: false,
      offset: 0,
      pageSize: 8,
      totalCount: 0,
      selected: [],
      isAllSelected: true
    }
  },
  mounted () {
    this.selectedValuesFromStore()
    if (this.root.$on) {
      this.root.$on('add-facet-values', value => this.$emit('add-facet-values', value))
    }
    this.$root.$on('facet::search::update', facetName => {
      if (this.facet.name === facetName) {
        this.selectedValuesFromStore()
      }
    })
  },
  computed: {
    root () {
      return get(this, '$refs.facet', {})
    },
    isGlobal () {
      return this.$store.state.search.globalSearch
    },
    facetFilter () {
      return this.$store.getters['search/findFacet'](this.facet.name)
    },
    placeholderRows () {
      return [
        {
          height: '1em',
          boxes: [[0, '70%'], ['20%', '10%']]
        }
      ]
    },
    size () {
      return this.offset + this.pageSize
    },
    resultPath () {
      return ['aggregations', this.facet.key, 'buckets']
    },
    queryTokens () {
      return [ escapeRegExp(this.facetQuery.toLowerCase()) ]
    },
    options () {
      return map(this.items, item => {
        return {
          value: item.key,
          html: this.getItemLabel(item)
        }
      })
    }
  },
  methods: {
    refreshRouteAndSearch () {
      this.refreshRoute()
      this.refreshSearch()
    },
    refreshRoute () {
      const name = 'search'
      const query = this.$store.getters['search/toRouteQuery']
      this.$router.push({ name, query })
    },
    refreshSearch () {
      this.$store.dispatch('search/query')
    },
    // Returns all props without the givens keys
    propsWithout (...keys) {
      keys = flatten(keys).map(camelCase)
      return reduce(this.$props, (props, value, key) => {
        if (keys.indexOf(key) === -1) {
          props[key] = value
        }
        return props
      }, {})
    },
    hasValue (item) {
      return this.$store.getters['search/hasFacetValue'](this.facet.itemParam(item))
    },
    removeValue (item) {
      this.$store.commit('search/removeFacetValue', this.facet.itemParam(item))
      this.refreshRouteAndSearch()
    },
    addValue (item) {
      this.$store.commit('search/addFacetValue', this.facet.itemParam(item))
      this.refreshRouteAndSearch()
    },
    toggleValue (item) {
      this.hasValue(item) ? this.removeValue(item) : this.addValue(item)
      this.isAllSelected = !this.$store.getters['search/hasFacetValues'](this.facet.name)
      this.$emit('add-facet-values', this.facet, this.selected.selected)
    },
    invert () {
      this.$store.commit('search/toggleFacet', this.facet.name)
      this.refreshRouteAndSearch()
    },
    hasValues () {
      return this.$store.getters['search/hasFacetValues'](this.facet.name)
    },
    isReversed () {
      return this.$store.getters['search/isFacetReversed'](this.facet.name)
    },
    watchedForUpdate (state) {
      if (!state.search.globalSearch) {
        // This will allow to watch change on the search only when
        // the aggregation is not global (ie. relative to the search).
        return pick(state.search, ['index', 'query', 'facets'])
      } else {
        return pick(state.search, ['index'])
      }
    },
    getItemLabel (item) {
      const label = this.facet.itemLabel ? this.facet.itemLabel(item) : item.key
      return `
        <span class="facet__items__item__label px-1 text-truncate w-100 d-inline-block">
          ${this.labelToHuman(label)}
        </span>
        <span class="facet__items__item__count badge badge-pill badge-light float-right my-1">
          ${this.$n(item.doc_count)}
        </span>
      `
    },
    labelToHuman (label) {
      if (this.$te(label)) {
        return this.$t(label)
      } else if (this.$te(`facet.${label}`)) {
        return this.$t(`facet.${label}`)
      } else {
        return this.translationKeyToHuman(label)
      }
    },
    translationKeyToHuman (label) {
      return last(label.split('.'))
    },
    selectedValuesFromStore () {
      if (this.facet) {
        this.selected = find(this.$store.state.search.facets, { name: this.facet.name }).values
        this.isAllSelected = this.selected.length === 0
      }
    },
    resetFacetValues () {
      this.isAllSelected = true
      this.selected = []
      this.$emit('reset-facet-values', this.facet)
    },
    changeSelectedValues () {
      this.isAllSelected = this.selected.length === 0
      this.$root.$emit('facet::add-facet-values', this.facet, this.selected)
      this.$store.commit('search/from', 0)
      this.$emit('add-facet-values', this.facet, this.selected)
      this.refreshRouteAndSearch()
    }
  }
}

export default mixin
