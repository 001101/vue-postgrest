# vue-postgrest
Vue.js Component providing PostgREST integration

## Installation

### With module loader

`npm install vue-postgrest`

or

`yarn add vue-postgrest`

in main.js:
```
import VuePostgrest from 'vue-postgrest'

Vue.use(VuePostgrest, pluginOptions)
```

available pluginOptions are:

|option |default |type  |description |
|-------|--------|------|------------|
|apiRoot|''      |String|api base URI|

### With script tag
Include `<script src="https://unpkg.com/vue-postgrest"></script>`

## Usage

Component "postgrest" is registered globally on your Vue instance.

### Quick example
```
<postgrest
  api-root="api/"
  route="users"
  :query="{}"
  :create="{}">
    <template v-slot:default="{ get, items, newItem }">
    </template>
</postgrest>
```

### In depth

Available component props are:

|prop   |required|default  |type  |description                        |
|-------|--------|---------|------|-----------------------------------|
|route  |yes     |-        |String|the table/view that is queried     |
|query  |no      |undefined|Object|the postgrest query                |
|single |no      |false    |Bool  |request a single entity            |
|create |no      |undefined|Object|template for a entity to be created|

The api-response and following methods are available via slot-props:

|slot-prop|type    |provided if     |description                            |
|---------|--------|----------------|---------------------------------------|
|items    |Array   |query && !single|An array of existing data entities     |
|item     |Object  |query && single |A single existing data entity          |
|newItem  |Object  |create          |The data entity to create              |
|get      |Function|query           |Utility function for get requests      | 