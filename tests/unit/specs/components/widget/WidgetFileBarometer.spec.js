import { createLocalVue, shallowMount } from '@vue/test-utils'
import { IndexedDocuments, letData } from 'tests/unit/es_utils'
import esConnectionHelper from 'tests/unit/specs/utils/esConnectionHelper'

import WidgetFileBarometer from '@/components/widget/WidgetFileBarometer'
import { Core } from '@/core'

describe('WidgetFileBarometer.vue', () => {
  const { index: project, es } = esConnectionHelper.build()
  const api = { elasticsearch: es }
  const { i18n, localVue, store, wait } = Core.init(createLocalVue(), api).useAll()
  const propsData = { widget: { title: 'Hello world' } }
  let wrapper = null

  beforeEach(() => {
    store.commit('insights/reset')
    store.commit('insights/project', project)
    wrapper = shallowMount(WidgetFileBarometer, { i18n, localVue, store, wait, propsData })
  })

  it('should be a Vue instance', () => {
    expect(wrapper).toBeTruthy()
  })

  it('should display the total number of document', async () => {
    await letData(es).have(new IndexedDocuments().withIndex(project).count(10)).commit()
    await wrapper.vm.loadData()

    expect(wrapper.find('.widget__main-figure').text()).toBe('10 documents')
  })
})
