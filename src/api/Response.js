import find from 'lodash/find'
import get from 'lodash/get'
import map from 'lodash/map'
import set from 'lodash/set'

import Document from './Document'
import NamedEntity from './NamedEntity'

const _raw = Symbol('raw')

export default class Response {
  constructor (raw) {
    this[_raw] = raw
  }
  get (path, defaultValue) {
    return get(this[_raw], path, defaultValue)
  }
  set (path, value) {
    return set(this[_raw], path, value)
  }
  push (path, value) {
    const arr = this.get(path, [])
    arr.push(value)
    return this.set(path, arr)
  }
  get hits () {
    return map(this[_raw].hits.hits, hit => {
      return Response.instantiate(hit)
    })
  }
  get aggregations () {
    return this[_raw].aggregations || {}
  }
  static instantiate (hit) {
    const Type = find(Response.types, Type => Type.match(hit))
    return new Type(hit)
  }
  static none () {
    return new Response({hits: {hits: []}})
  }
  static get types () {
    return [Document, NamedEntity]
  }
}
