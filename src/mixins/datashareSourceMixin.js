export const mixin = {
  methods: {
    async getSource (document, config = {}) {
      try {
        return await this.$core.api.getSource(document, config)
      } catch (error) {
        if (error.response && error.response.status === 404) {
          throw new Error(this.$t('document.errorNotFound'))
        }
        throw error
      }
    }
  }
}

export default mixin
