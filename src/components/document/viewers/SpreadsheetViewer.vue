<template>
  <v-wait for="load spreadsheet" class="w-100">
    <div slot="waiting" class="p-3 text-muted">
      {{ $t('document.fetching') }}
    </div>
    <div v-if="!isPreviewable" class="p-3">
      {{ $t('document.notAvailable') }}
    </div>
    <div v-else class="spreadsheet-viewer__content d-flex flex-column h-100">
      <div class="spreadsheet-viewer__content__toolbox d-flex align-items-center p-2">
        <b-form-checkbox v-model="fieldsInFirstItem" switch class="ml-3">
          {{ $t('document.spreadsheet.fieldsInFirstItem') }}
        </b-form-checkbox>
        <div
          class="spreadsheet-viewer__content__toolbox__filter pl-3 text-right flex-grow-1"
          :class="{ 'spreadsheet-viewer__content__toolbox__filter--filtered': filter }"
        >
          <div class="input-group justify-content-end">
            <input
              v-shortkey.focus="getShortcut"
              type="search"
              class="form-control"
              :placeholder="$t('document.spreadsheet.findInSpreadsheet')"
              @input="debounceFilterInput"
            />
            <div v-if="filter" class="input-group-append">
              <div class="input-group-text">
                {{ $tc('document.spreadsheet.filtered.rows', filteredItems.length) }}
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="spreadsheet-viewer__content__table mx-3 small flex-grow-1" :style="tableVars">
        <dynamic-scroller
          :items="scrollerItems"
          :min-item-size="54"
          class="spreadsheet-viewer__content__table__scroller border-left border mb-3"
        >
          <template v-if="fieldsInFirstItem" #before>
            <div class="spreadsheet-viewer__content__table__item row no-gutters border-bottom">
              <div
                v-for="field in fields"
                :key="field"
                class="spreadsheet-viewer__content__table__item__col col border-right overflow-hidden"
              >
                <div class="p-2">
                  {{ field }}
                </div>
              </div>
            </div>
          </template>
          <template #default="{ item, index, active }">
            <dynamic-scroller-item :item="item" :active="active" :data-index="index" :size-dependencies="item.cols">
              <div class="spreadsheet-viewer__content__table__item row no-gutters border-bottom">
                <div
                  v-for="(col, i) in item.cols"
                  :key="i"
                  class="spreadsheet-viewer__content__table__item__col col border-right overflow-hidden"
                >
                  <div class="p-2">
                    {{ col }}
                  </div>
                </div>
              </div>
            </dynamic-scroller-item>
          </template>
        </dynamic-scroller>
      </div>
      <b-tabs v-if="nonEmptySheets.length > 1" v-model="activeSheetIndex" pills class="mx-3 mb-3">
        <b-tab v-for="(sheet, i) in nonEmptySheets" :key="i" :title="sheet"></b-tab>
      </b-tabs>
    </div>
  </v-wait>
</template>

<script>
import { debounce, filter, first, get, kebabCase, range, sortBy, startCase } from 'lodash'
import Fuse from 'fuse.js'
import { getCookie } from 'tiny-cookie'
import { DynamicScroller, DynamicScrollerItem } from 'vue-virtual-scroller'

import shortkeys from '@/mixins/shortkeys'
import { getShortkeyOS } from '@/utils/utils'

/**
 * Display a spreadsheet preview of a document
 */
export default {
  name: 'SpreadsheetViewer',
  components: {
    DynamicScroller,
    DynamicScrollerItem
  },
  mixins: [shortkeys],
  props: {
    /**
     * The selected document
     */
    document: {
      type: Object
    }
  },
  data() {
    return {
      activeSheetIndex: 0,
      fieldsInFirstItem: false,
      filter: '',
      meta: null
    }
  },
  computed: {
    tableVars() {
      return {
        '--table-wrapper-width': Math.max(100, (5 + this.firstItem.length) * 10) + '%'
      }
    },
    contentUrl() {
      return `${this.$config.get('previewHost')}/api/v1/thumbnail/${this.document.index}/${
        this.document.id
      }.json?include-content=1&routing=${this.document.routing}`
    },
    contentOptions() {
      return {
        method: 'GET',
        cache: 'default',
        headers: {
          [this.sessionIdHeaderName]: this.sessionIdHeaderValue
        }
      }
    },
    sessionIdHeaderValue() {
      return getCookie(process.env.VUE_APP_DS_COOKIE_NAME)
    },
    sessionIdHeaderName() {
      let dsCookieName = kebabCase(process.env.VUE_APP_DS_COOKIE_NAME)
      dsCookieName = dsCookieName.split('-').map(startCase).join('-')
      return `x-${dsCookieName}`
    },
    isPreviewable() {
      return this.meta && this.meta.previewable && this.meta.content
    },
    activeSheet() {
      return this.nonEmptySheets[this.activeSheetIndex]
    },
    sheets() {
      return sortBy(Object.keys(get(this, 'meta.content', {})))
    },
    nonEmptySheets() {
      return filter(this.sheets, (sheet) => {
        const rows = get(this, `meta.content.${sheet}`, [])
        return filter(rows, (row) => row.length).length
      })
    },
    filteredItems() {
      if (this.filter === '') return this.items
      return this.fuse.search(this.filter)
    },
    items() {
      const items = get(this, `meta.content.${this.activeSheet}`, [])
      // Skip first item
      return this.fieldsInFirstItem ? items.slice(1) : items
    },
    firstItem() {
      return first(get(this, `meta.content.${this.activeSheet}`, [])) || []
    },
    scrollerItems() {
      return this.filteredItems.map((cols, id) => ({ id, cols }))
    },
    fields() {
      if (this.fieldsInFirstItem) {
        return this.firstItem
      }
      return null
    },
    fuse() {
      const keys = range(this.firstItem.length).map(String)
      const options = { distance: 100, keys, shouldSort: true, threshold: 0.1 }
      return new Fuse(this.items, options)
    },
    getShortcut() {
      if (getShortkeyOS() === 'mac') {
        return ['meta', 'f']
      } else {
        return ['ctrl', 'f']
      }
    }
  },
  async mounted() {
    this.$wait.start('load spreadsheet')
    this.$Progress.start()
    const response = await fetch(this.contentUrl, this.contentOptions)
    const meta = await response.json()
    this.$set(this, 'meta', meta)
    this.$set(this, 'activeSheetIndex', 0)
    this.$Progress.finish()
    this.$wait.end('load spreadsheet')
  },
  methods: {
    debounceFilterInput: debounce(function ({ target: { value } }) {
      this.$set(this, 'filter', value)
    }, 500)
  }
}
</script>

<style lang="scss" scoped>
@import '~node_modules/vue-virtual-scroller/dist/vue-virtual-scroller.css';

.spreadsheet-viewer {
  &__content {
    &__toolbox {
      background: $light;
      box-shadow: 0 -1 * $spacer 0 0 white;
      margin: $spacer $grid-gutter-width * 0.5;

      &__filter {
        margin-left: auto;
        max-width: 300px;

        &--filtered input.form-control {
          border-right: 0;

          &:focus + .input-group-append .input-group-text {
            border-color: $input-focus-border-color;
          }
        }

        input.form-control {
          border-radius: 1.5em;
          width: 100%;
        }

        .input-group-text {
          background: $input-bg;
          border-radius: 0 1.5em 1.5em 0;
          color: $text-muted;
          font-size: 0.8rem;
          margin-left: -1px;
          transition: $input-transition;
        }
      }
    }

    &__table {
      position: relative;

      &__item {
        &__col.border-right:last-child {
          border-right: 0 !important;
        }
      }

      &__scroller {
        bottom: 0;
        left: 0;
        position: absolute;
        right: 0;
        top: 0;

        .vue-recycle-scroller__slot,
        .vue-recycle-scroller__item-wrapper {
          width: var(--table-wrapper-width) !important;
        }

        .vue-recycle-scroller__slot:first-child {
          background: $light;
          border-bottom: 1px solid $border-color;
          font-weight: bold;
          position: sticky;
          top: 0;
          z-index: 10;
        }
      }
    }
  }
}
</style>
