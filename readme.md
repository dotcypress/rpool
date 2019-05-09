[![Build Status](https://img.shields.io/travis/dotcypress/rpool.svg?branch=master&style=flat-square)](https://travis-ci.org/dotcypress/rpool)
[![NPM Version](https://img.shields.io/npm/v/rpool.svg?style=flat-square)](https://www.npmjs.com/package/rpool)
[![js-standard-style](https://img.shields.io/badge/code%20style-standard-brightgreen.svg?style=flat-square)](http://standardjs.com/)

# rpool

[RethinkDB](https://rethinkdb.com) connection pool.

## Installation

```js
$ npm install --save rpool
```

## API

### Create pool

`rpool(r, dbOptions, poolOptions) -> Pool`

* `r` - RethinkDB reference
* `dbOptions | dbOptions[]` - RethinkDB options
  * `url`: Connection string/array of strings. If present will silentry rewrite connections options(host, port, etc.)
  * `host`: the host to connect to (default localhost).
  * `port`: the port to connect on (default 28015).
  * `db`: the default database (default test).
  * See [RethinkDB docs](https://www.rethinkdb.com/api/javascript/connect/) for additional options.
* `poolOptions` - Pool options
  * `min`: minimum number of connections to keep in pool at any given time. If this is set >= max, the pool will silently set the min to equal `max`. (default 1)
  * `max`: maximum number of connections. (default 10)
  * `testOnBorrow`: should the pool validate resources before giving them to clients. (default true)
  * `acquireTimeoutMillis`: max milliseconds an acquire call will wait for a resource before timing out. (default 10 seconds), if supplied should non-zero positive integer.
  * See [generic-pool docs](https://www.npmjs.com/package/generic-pool).

**Example:**

```js
const r = require('rethinkdb')
const rpool = require('rpool')

const pool = rpool(r, 'rethinkdb://localhost:32779/foo')
const pool = rpool(r, ['rethinkdb://portal-1:32779/foo', 'rethinkdb://portal-2:32779/foo'])
const pool = rpool(r, 'rethinkdb://localhost:32779/foo', { max: 100, acquireTimeoutMillis: 5000 })
const pool = rpool(r, { url: 'rethinkdb://localhost:32779', db: 'bar' }, { max: 100 })
const pool = rpool(r, { host: 'localhost', port: '32779', db: 'foo' }, { max: 10 })
const pool = rpool(r, [
  { url: 'rethinkdb://portal-1:32779/bar',' }
  { url: 'rethinkdb://portal-2:32779', db: 'bar' }
], { max: 100 })
```

### Acquire / release connections

`pool.acquire(priority) -> Promise<#{connection, release}>`

* `priority`: optional priority.

**Example:**
```js
const r = require('rethinkdb')
const rpool = require('rpool')

const pool = rpool(r, 'rethinkdb://localhost:32779/foo')

pool.acquire().then(({ connection, release }) => {
  r.table('users')
    .run(connection)
    .then((cursor) => {
      console.log('Cursor:', cursor)
    })
    .catch((err) => {
      console.log(err)
    })
    .then(release)
})
```

#### Run queries

`pool.run(query, options) -> Promise<QueryResult>`

* `query`: RethinkDB query or query builder function.
* `options`: [Run option](https://www.rethinkdb.com/api/javascript/run/).

> ⚠️ Note: All cursors are automatically converted into arrays.

**Example:**

```js
const r = require('rethinkdb')
const rpool = require('rpool')

const pool = rpool(r, 'rethinkdb://localhost:32779/foo')

pool.run(r.table('users')).then((users) => {
  console.log('Users:', users)
})

pool.run((r) => r.table('users')).then((users) => {
  console.log('Users:', users)
})

const deleteQuery = r.table('users').get('user_id').delete()
pool.run(deleteQuery)
```
