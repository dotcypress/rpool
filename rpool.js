const url = require('url')
const { Pool } = require('generic-pool')

function parseDbUrl (dbURL) {
  const { protocol, hostname, port, pathname, auth } = url.parse(dbURL)
  if (protocol !== 'rethinkdb:' && protocol !== 'rethinkdb2:') {
    throw new Error('Unsupported protocol: ' + protocol)
  }
  const result = {}
  if (hostname) {
    result.host = hostname
  }
  if (port) {
    result.port = parseInt(port, 10)
  }
  if (auth) {
    const parts = auth.split(':')
    if (parts.length === 1) {
      result.authKey = parts[0]
    } else {
      result.user = parts[0]
      result.password = parts[1]
    }
  }
  if (pathname && pathname !== '/') {
    result.db = pathname.substr(1)
  }
  return result
}

function rpool (r, dbOpts, poolOpts) {
  const dbOptions = typeof dbOpts === 'string'
    ? parseDbUrl(dbOpts)
    : Object.assign({}, dbOpts, dbOpts.url && parseDbUrl(dbOpts.url))
  const pool = new Pool(Object.assign({
    name: 'rpool',
    max: 10,
    min: 1,
    idleTimeoutMillis: 30 * 1000,
    create: (done) => r.connect(dbOptions, done),
    destroy: (connection) => connection.close(),
    validate: (connection) => connection.isOpen()
  }, poolOpts))

  function drain () {
    pool.drain(pool.destroyAllNow)
  }

  function acquire (priority) {
    return new Promise((resolve, reject) => {
      pool.acquire((err, connection) => err
        ? reject(err)
        : resolve({ connection, release: () => pool.release(connection) })
      )
    }, priority)
  }

  function run (query, opt) {
    return acquire().then(({ connection, release }) => {
      return query.run(connection, opt)
        .then((cursor) => {
          return cursor && typeof cursor.toArray === 'function'
            ? cursor.toArray()
            : cursor
        })
        .then((result) => {
          release()
          return result
        })
        .catch((err) => {
          release()
          throw err
        })
    })
  }
  return { acquire, run, drain }
}

module.exports = rpool
