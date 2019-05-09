const { URL } = require('url')
const { createPool } = require('generic-pool')

function parseDbUrl (dbURL) {
  const { protocol, hostname, port, pathname, username, password } = new URL(dbURL)
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
  if (username) {
    if (password) {
      result.user = username
      result.password = password
    } else {
      result.authKey = username
    }
  }
  if (pathname && pathname !== '/') {
    result.db = pathname.substr(1)
  }
  return result
}

function rpool (r, dbOpts, poolOpts) {
  const dbConfig = Array.isArray(dbOpts) ? dbOpts : [dbOpts]
  const connectionConfig = dbConfig.reduce((acc, opts) => {
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
    return connectionConfig[serverIndex]
  }

  const poolOptions = Object.assign({
    max: 10,
    min: 1,
    idleTimeoutMillis: 30 * 1000,
    onCreateError: (err) => console.log('rpool: Failed to open database connection', err),
    onDestroyError: (err) => console.log('rpool: Failed to close database connection', err)
  }, poolOpts)

  const pool = createPool({
    create: () => r.connect(getConnectionConfig()),
    destroy: (connection) => connection.close(),
    validate: (connection) => connection.isOpen()
  }, poolOptions)

  pool.on('factoryCreateError', poolOptions.onCreateError)
  pool.on('factoryDestroyError', poolOptions.onDestroyError)

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
    return acquire().then(({ connection, release }) =>
      dbQuery.run(connection, opts)
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
    )
  }

  return { acquire, run, drain, pool }
}

module.exports = rpool
