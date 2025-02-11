import { castArray, find, isArray, isObject, uniqueId } from 'lodash'

import EsDocList from '@/api/resources/EsDocList'

const pathUtil = require('path')

function letData(index) {
  return new IndexBuilder(index)
}

class IndexedNamedEntity {
  constructor(mention, offset = 1, category = 'PERSON', isHidden = false, path = '') {
    this.mention = mention
    this.offsets = castArray(offset)
    this.category = category
    this.isHidden = isHidden
    this.path = path
    return this
  }
  get id() {
    return this.path + this.mention + this.offsets
  }
}

class IndexedDocuments {
  constructor() {
    this.baseName = 'document'
    this.numberOfDocuments = 0
    this.content = 'default content'
    this.content_translated = null
    this.document = []
    this.index = 'default-index'
    this.extractionLevel = 0
  }
  setBaseName(pattern) {
    this.baseName = pattern
    return this
  }
  withContent(content) {
    this.content = content
    return this
  }
  withIndex(index) {
    this.index = index
    return this
  }
  withIndexingDate(indexingDate) {
    this.extractionDate = indexingDate
    return this
  }
  count(numberOfDocuments) {
    this.numberOfDocuments = numberOfDocuments
    for (let i = 0; i < this.numberOfDocuments; i++) {
      const doc = new IndexedDocument(this.baseName + '_' + (i + 1), this.index).withContent(this.content)
      if (this.extractionDate) {
        doc.withIndexingDate(this.extractionDate[i])
      }
      this.document.push(doc)
    }
    return this.document
  }
  commit(es) {
    return letData(es).have(this).commit()
  }
  static build() {
    return new IndexedDocuments()
  }
}

class IndexedDocument {
  constructor(path = uniqueId('/path/to/document/'), index = 'default-index') {
    this.path = path
    this.dirname = pathUtil.win32.dirname(path)
    this.join = { name: 'Document' }
    this.type = 'Document'
    this.language = 'ENGLISH'
    this.title = path
    this.titleNorm = path.normalize('NFD').toLowerCase()
    this.metadata = {
      tika_metadata_resourcename: path,
      tika_metadata_another_metadata: null,
      tika_metadata_content_type: null,
      tika_metadata_dcterms_created: null,
      tika_metadata_dc_creator: null
    }
    this.nerList = []
    this.nerTags = []
    this.index = index
    this.extractionLevel = 0
  }
  get id() {
    return this.path
  }
  setContentTextLength(length) {
    this.contentTextLength = length
    return this
  }
  withContent(content) {
    this.content = content
    this.contentTextLength = content.length
    return this
  }
  withContentLength(contentLength) {
    this.contentLength = contentLength
    return this
  }
  withContentType(contentType) {
    this.metadata.tika_metadata_content_type = contentType
    this.contentType = contentType.split(';')[0].trim()
    if (contentType.indexOf('charset') > 0) {
      this.contentEncoding = contentType.split('=')[1].trim()
    }
    return this
  }
  withIndexingDate(indexingDate) {
    this.extractionDate = indexingDate
    return this
  }
  withResourceName(resourceName) {
    this.metadata.tika_metadata_resourcename = resourceName
    return this
  }
  withAuthor(author) {
    this.metadata.tika_metadata_dc_creator = author
    return this
  }
  withCreationDate(creationDate) {
    this.metadata.tika_metadata_dcterms_created = creationDate
    return this
  }
  withOtherMetadata(otherMetadata) {
    this.metadata.tika_metadata_another_metadata = otherMetadata
    return this
  }
  withMetadata(metadata) {
    const md = isObject(metadata) ? metadata : {}
    this.metadata = { ...md, ...this.metadata }
    return this
  }
  withLanguage(language) {
    this.language = language
    return this
  }
  withNoContentTranslated() {
    this.content_translated = []
    return this
  }
  withContentTranslated(content, sourceLanguage, targetLanguage) {
    const translation = { content, source_language: sourceLanguage, target_language: targetLanguage }
    this.content_translated = [] || this.content_translated
    this.content_translated.push(translation)
    return this
  }
  withNer(mention, offset = 1, category = 'PERSON', isHidden = false) {
    this.nerList.push(new IndexedNamedEntity(mention, offset, category, isHidden, this.path))
    return this
  }
  withParent(parentId) {
    this.parentDocument = parentId
    this.extractionLevel = 1
    this.parent = new IndexedDocument(parentId)
    return this
  }
  withRoot(rootId) {
    this.rootDocument = rootId
    this.root = new IndexedDocument(rootId)
    return this
  }
  withPipeline(pipeline) {
    this.nerTags.push(pipeline)
    return this
  }
  withTags(tags) {
    this.tags = tags
    return this
  }
  getContentTranslated({ sourceLanguage = this.language, targetLanguage = this.language } = {}) {
    const needle = { source_language: sourceLanguage, target_language: targetLanguage }
    const { content = null } = find(this.content_translated, needle) || {}
    return content
  }
  hasParent() {
    return this.parentDocument !== undefined
  }
  hideNer(mention) {
    const ner = find(this.nerList, { mention })
    ner.isHidden = true
    return ner
  }
  commit(es) {
    return letData(es).have(this).commit()
  }
  static build(path, index) {
    return new IndexedDocument(path, index)
  }
}

class IndexBuilder {
  constructor(index) {
    this.index = index
    this.committedDocumentIds = []
  }
  have(document) {
    this.document = document
    return this
  }
  async hideNer(mention) {
    await this.update(await this.document.hideNer(mention))
    return this
  }
  async update(ner) {
    await this.index.update({
      index: process.env.VUE_APP_ES_INDEX,
      refresh: true,
      id: ner.id,
      body: {
        doc: {
          isHidden: ner.isHidden
        }
      }
    })
  }
  async commit() {
    if (isArray(this.document)) {
      // Copy this array into 'documents' because 'document'
      // will be overwritten by the next call to have
      this.documents = this.document
      for (const doc of this.documents) {
        await this.have(doc).commit()
      }
    } else {
      const { id, index } = this.document
      const body = this._omit(this.document, ['nerList'])
      const createRequest = { index, id, body, refresh: true }

      if (this.document.hasParent()) {
        createRequest.routing = this.document.parentDocument
      }
      const { _id } = await this.index.create(createRequest)
      this.committedDocumentIds.push(_id)
      for (let i = 0; i < this.document.nerList.length; i++) {
        const ner = this.document.nerList[i]
        await this.index.create({
          index,
          refresh: true,
          id: ner.id,
          routing: id,
          body: {
            mention: ner.mention,
            mentionNorm: ner.mention,
            offsets: ner.offsets,
            category: ner.category,
            isHidden: ner.isHidden,
            type: 'NamedEntity',
            join: { name: 'NamedEntity', parent: id }
          }
        })
      }
    }
    return this
  }
  async commitAndGetLastDocument() {
    await this.commit()
    return this.lastCommittedDocument
  }
  _omit(obj, fields) {
    return Object.keys(obj).reduce((newObj, key) => {
      if (!fields.includes(key)) {
        newObj[key] = obj[key]
      }
      return newObj
    }, {})
  }
  get committedDocuments() {
    const promises = this.committedDocumentIds.map(async (id) => {
      const raw = await this.index.get({ index: this.document.index, id })
      return EsDocList.instantiate(raw)
    })
    return Promise.all(promises)
  }
  get lastCommittedDocument() {
    return Promise.resolve().then(async () => {
      const id = this.committedDocumentIds.slice(-1).pop()
      const raw = await this.index.get({ index: this.document.index, id })
      return EsDocList.instantiate(raw)
    })
  }
}

export { letData, IndexBuilder, IndexedDocuments, IndexedDocument, IndexedNamedEntity }
