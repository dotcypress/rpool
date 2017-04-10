[![Build Status](https://img.shields.io/travis/dotcypress/rpool.svg?branch=master&style=flat-square)](https://travis-ci.org/dotcypress/rpool)
[![NPM Version](https://img.shields.io/npm/v/rpool.svg?style=flat-square)](https://www.npmjs.com/package/rpool)
[![js-standard-style](https://img.shields.io/badge/code%20style-standard-brightgreen.svg?style=flat-square)](http://standardjs.com/)

# rpool

Promise based [RethinkDB](https://rethinkdb.com) connection pool.

## Installation

```js
$ npm install --save rpool
```

## API

### Create pool

`rpool(r, dbOptions, poolOptions) -> Pool`

* `r` - RethinkDB reference
* `dbOptions` - RethinkDB options
  * `url`: 🔥 connection string. If present will silentry rewrite connections options(host, port, etc.)
  * `host`: the host to connect to (default localhost).
  * `port`: the port to connect on (default 28015).
  * `db`: the default database (default test).
  * See [RethinkDB docs](https://www.rethinkdb.com/api/javascript/connect/) for additional options.
* `poolOptions` - Pool options
  * `max`: maximum number of connections. (default 10)
  * `min`: minimum number of connections to keep in pool at any given time. If this is set >= max, the pool will silently set the min to equal `max`. (default 1)
  * `idleTimeoutMillis`: the minimum amount of time that an object may sit idle in the pool before it is eligible for eviction. (default 30 seconds)
  * See [generic-pool docs](https://www.npmjs.com/package/generic-pool).

**Example:**

```js
const r = require('rethinkdb')
const rpool = require('rpool')

const pool = rpool(r, 'rethinkdb://localhost:32779/foo')
const pool = rpool(r, 'rethinkdb://localhost:32779/foo', { max: 100, idleTimeoutMillis: 10000 })
const pool = rpool(r, { url: 'rethinkdb://localhost:32779/foo', timeout: 10 }, { max: 100 })
const pool = rpool(r, { host: 'localhost', port: '32779', db: 'foo' }, { max: 10 })
```

### Acquire / release connections

`pool.acquire(priority) -> Promise<{connection, release}>`

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
      console.log('Users cursor:', cursor)
    })
    .catch((err) => {
      console.log(err)
    })
    .then(release)
})
```

#### Run queries

`pool.run(query, options) -> Promise<QueryResult>`

* `query`: RethinkDB query.
* `options`: [Run option](https://www.rethinkdb.com/api/javascript/run/).

> ⚠️ Note: Cursors will be automatically coerced to arrays.

**Example:**

```js
const r = require('rethinkdb')
const rpool = require('rpool')

const pool = rpool(r, 'rethinkdb://localhost:32779/foo')

pool.run(r.table('users')).then((users) => {
  console.log('Users:', users)
})

const deleteQuery = r.table('users').get('user_id').delete()
pool.run(deleteQuery)
```
