import { throwWhenStatusNotOk, EmittedError } from '@/errors'
import { ObservableFunction, syncObjects, splitToObject } from '@/utils'
import Query from '@/Query'
import GenericModel from '@/GenericModel'
import { getSchema } from '@/SchemaManager'

export default {
  name: 'Postgrest',
  props: {
    route: {
      type: String,
      default: undefined
    },
    apiRoot: {
      type: String,
      default: '/'
    },
    query: {
      type: Object,
      default: undefined
    },
    create: {
      type: Object,
      default: undefined
    },
    accept: {
      type: String,
      default: undefined
    },
    limit: {
      type: Number,
      default: undefined
    },
    offset: {
      type: Number,
      default: undefined
    },
    count: {
      type: String,
      default: undefined
    },
    token: {
      type: String,
      default: undefined
    }
  },
  data () {
    return {
      items: [],
      item: {},
      data: null,
      newItem: null,
      range: undefined,
      get: new ObservableFunction(this._get),
      primaryKeys: [],
      rpc: new ObservableFunction(this._rpc)
    }
  },
  computed: {
    scope () {
      return {
        get: this.query !== undefined ? this.get : undefined,
        items: (this.query !== undefined && !this.accept) ? this.items : undefined,
        item: (this.query !== undefined && this.accept === 'single') ? this.item : undefined,
        data: (this.query !== undefined && this.accept && this.accept !== 'single') ? this.data : undefined,
        newItem: this.create !== undefined ? this.newItem : undefined,
        range: this.range,
        rpc: this.rpc,
        resetNewItem: this.create !== undefined ? this.resetNewItem : undefined
      }
    }
  },
  methods: {
    async request (method, query = {}, options = {}, body) {
      const headers = new Headers()

      switch (options.accept) {
        case 'single':
          headers.set('Accept', 'application/vnd.pgrst.object+json')
          break
        case 'binary':
          headers.set('Accept', 'application/octet-stream')
          break
        case undefined:
        case '':
          headers.set('Accept', 'application/json')
          break
        default:
          headers.set('Accept', options.accept)
      }

      if (options.limit || options.offset) {
        const range = [options.offset || 0, options.limit > 0 ? options.limit - 1 : null]
        if (range[1] !== null && options.offset) range[1] += options.offset
        headers.set('Range-Unit', 'items')
        headers.set('Range', range.join('-'))
      }

      const prefer = []
      if (options.return) {
        prefer.push('return=' + options.return)
      }
      if (options.count) {
        prefer.push('count=' + options.count)
      }
      if (prefer.length > 0) {
        headers.set('Prefer', prefer.join(','))
      }

      if (this.token) {
        headers.set('Authorization', `Bearer ${this.token}`)
      }

      // overwrite headers with custom headers if set
      if (options.headers) {
        for (const [k, v] of Object.entries(options.headers)) {
          headers.set(k, v)
        }
      }

      const url = new Query(this.apiRoot, options.route || this.route, query)

      try {
        return await fetch(url.toString(), {
          method,
          headers,
          body
        }).then(throwWhenStatusNotOk)
      } catch (err) {
        if (err.resp && err.resp.headers.get('WWW-Authenticate')) {
          const authError = splitToObject(err.resp.headers.get('WWW-Authenticate').replace(/^Bearer /, ''))
          this.$emit('token-error', authError)
          throw new EmittedError(authError)
        } else {
          throw err
        }
      }
    },
    async _get () {
      try {
        if (!this.query) {
          return
        }
        const resp = await this.request('GET', this.query, {
          accept: this.accept,
          limit: this.limit,
          offset: this.offset,
          count: this.count
        })
        let body
        if (this.accept === 'single') {
          this.items = null
          body = await resp.json()
          this.item = new GenericModel(body, this.request, this.primaryKeys, this.query.select)
        } else if (!this.accept) {
          this.item = null
          body = await resp.json()
          this.items = body.map(data => new GenericModel(data, this.request, this.primaryKeys, this.query.select))
        } else {
          this.item = null
          this.items = null
          this.data = body = await resp.text()
        }

        if (resp.headers.get('Content-Range')) {
          const [range, total] = resp.headers.get('Content-Range').split('/')
          const [first, last] = range.split('-')
          this.range = {
            totalCount: total === '*' ? undefined : parseInt(total),
            first: parseInt(first),
            last: parseInt(last)
          }
        } else {
          this.range = undefined
        }
        return body
      } catch (e) {
        this.$emit('get-error', e)
        throw new EmittedError(e)
      }
    },
    async _rpc (fn, opts = {}, params) {
      if (!opts.method) {
        opts.method = 'POST'
      }
      if (!['POST', 'GET'].includes(opts.method)) {
        throw new Error('RPC endpoint only supports "POST" and "GET" methods.')
      }
      const requestOptions = { route: 'rpc/' + fn, accept: opts.accept, headers: opts.headers }
      if (opts.method === 'GET') {
        return this.request('GET', params, requestOptions)
      } else {
        return this.request(opts.method, {}, requestOptions, params)
      }
    },
    async getPrimaryKeys () {
      const schema = await getSchema(this.apiRoot, this.token)
      syncObjects(this.primaryKeys, (schema[this.route] && schema[this.route].pks) || [])
    },
    resetNewItem () {
      this.newItem = new GenericModel(this.create, this.request, this.primaryKeys, (this.query || {}).select)
    }
  },
  created () {
    this.getPrimaryKeys()
    this.$watch('apiRoot', () => {
      this.getPrimaryKeys()
      this.get()
    })
    this.$watch('route', () => {
      this.getPrimaryKeys()
      this.get()
    })
    this.$watch('query', this.get, { deep: true })
    this.$watch('offset', this.get)
    this.$watch('limit', this.get)
    this.$watch('create', (newData) => {
      this.newItem = new GenericModel(newData, this.request, this.primaryKeys, (this.query || {}).select)
    }, { immediate: true })
    this.get()
  },
  render (h) {
    return this.$scopedSlots.default(this.scope)
  }
}
