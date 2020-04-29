import { createLocalVue, shallowMount } from '@vue/test-utils'

import WidgetDiskUsageDetails from '@/components/WidgetDiskUsageDetails'
import { Core } from '@/core'

describe('WidgetDiskUsageDetails.vue', () => {
  const { i18n, localVue, wait, store, config } = Core.init(createLocalVue()).useAll()
  const propsData = { path: '/home/foo' }

  beforeAll(() => {
    config.set('dataDir', '/home/foo')
  })

  it('should be a Vue instance', () => {
    const methods = {
      loadData: () => ({
        hits: 10,
        total: 2048,
        directories: [
          { key: 'bar', contentLength: { value: 1024 } },
          { key: 'baz', contentLength: { value: 1024 } }
        ]
      })
    }
    const wrapper = shallowMount(WidgetDiskUsageDetails, { i18n, localVue, wait, store, propsData, methods })
    expect(wrapper.isVueInstance()).toBeTruthy()
  })

  it('should display 2 directories', async () => {
    const methods = {
      loadData: () => ({
        hits: 10,
        total: 2048,
        directories: [
          { key: 'bar', contentLength: { value: 1024 } },
          { key: 'baz', contentLength: { value: 1024 } }
        ]
      })
    }
    const wrapper = shallowMount(WidgetDiskUsageDetails, { i18n, localVue, wait, store, propsData, methods })
    await wrapper.vm.$nextTick()
    expect(wrapper.findAll('.widget-disk-usage-details__directories__item')).toHaveLength(3)
    // One for the document count
    expect(wrapper.find('.widget-disk-usage-details__directories__item--hits').exists()).toBeTruthy()
    expect(wrapper.find('.widget-disk-usage-details__directories__item--hits').text()).toBe('10 documents')
  })
})
