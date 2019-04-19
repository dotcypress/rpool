const { URL } = require('url')
const { createPool } = require('generic-pool')

function parseDbUrl (dbURL) {
  const { protocol, hostname, port, pathname, auth } = new URL(dbURL)
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
  const dbOptions = Array.isArray(dbOpts) ? dbOpts : [dbOpts]
  const connectionConfig = dbOptions.reduce((acc, opts) => {
    if (typeof opts === 'string') {
      acc.push(parseDbUrl(opts))
    } else if (Array.isArray(opts.url)) {
      acc.push(...opts.url.map((url) => Object.assign({}, opts, { url }, parseDbUrl(url))))
    } else {
      acc.push(Object.assign({}, opts, opts.url && parseDbUrl(opts.url)))
    }
    return acc
  }, [])
  let serverIndex = 0
  const getConnectionConfig = () => {
    serverIndex = (serverIndex + 1) % connectionConfig.length
    console.log('serverIndex', serverIndex)
    return connectionConfig[serverIndex]
  }

  const pool = createPool({
    create: (done) => r.connect(getConnectionConfig(), done),
    destroy: (connection) => connection.close(),
    validate: (connection) => connection.isOpen()
  }, Object.assign({ max: 10, min: 1, idleTimeoutMillis: 30 * 1000 }, poolOpts))

  function drain () {
    return pool.drain().then(() => pool.clear())
  }

  function acquire (priority) {
    return pool.acquire(priority).then((connection) => ({
      connection,
      release: () => pool.release(connection)
    }))
  }

  function run (query, opts) {
    if (Array.isArray(query)) {
      return Promise.all(query.map((q) => run(q, opts)))
    }
    const dbQuery = typeof query.run === 'function' ? query : query(r)
    return acquire().then(({ connection, release }) => {
      return dbQuery.run(connection, opts)
        .then((cursor) =>
          (cursor && typeof cursor.toArray === 'function')
            ? cursor.toArray()
            : cursor)
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
