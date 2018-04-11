'use strict'

const axios = require('axios')
const randomstring = require('randomstring')
const argv = require('minimist')(process.argv)
const jcu = require('./java-collector-utils')

const env = process.env

const validActions = {
  'add-delete': actionAddDelete,
  'ad': actionAddDelete,
  delay: actionDelay,
  chain: actionChain,
  get: actionGet
}

// params
let int = argv.i || 5         // interval in seconds
let nPerInt = argv.n || 5     // number of actions executed per interval
let maxActions = argv['max-actions'] || argv.m || Infinity

// settings for the collector (only valid if java-collector)
let remoteMode = argv['remote-mode'] || 'always'

// TODO BAM extend to allow multiple --action and/or -a arguments.
// get action to perform n times per i
let action = argv.action || 'add-delete'
if (argv.a) action = argv.a

let parts = action.split('=')
action = parts[0]

// TODO BAM should just pass string after '=' to action.
let delay
let chain
if (action === 'delay') {
  delay = parts[1] === undefined ? 1500 : +parts[1]
} else if (action === 'chain') {
  // put the chain back together
  chain = parts.slice(1).join('=')
}

let badHeaders = {
  v1: '1BA76EA380708FB00385D49BBCE13F8F0815B7A4E05F51D0CA1D9A2B7C',
  v3: '3BA76EA380708FB00385D49BBCE13F8F0815B7A4E05F51D0CA1D9A2B7C01'
}

let badHeader = argv['bad-header'] || argv.b
if (badHeader && !(badHeader in badHeaders)) {
  console.log('--bad-header must be one of ' + Object.keys(badHeaders).join(', '))
  badHeader = false
}



if (!(action in validActions)) {
  console.warn('invalid action: "%s"', action)
}

// if not good display help then exit.
action = validActions[action]

if (!action || argv.h || argv.help) {
  console.log('usage: node multitest.js')
  console.log('  options:')
  console.log('    --action=action-option')
  console.log('      where action-option is:')
  console.log('        add-delete|ad - add a todo then delete it')
  console.log('        delay[=ms] server delays response for ms (1500 default)')
  console.log('        get - get the todos')
  console.log('    -a synonym for --action')
  console.log('    -i <interval in seconds>')
  console.log('    -n <add/delete pairs per interval')
  console.log('    --ws_ip=host[:port] todo server to connect to')
  console.log('    --delete delete existing todos before starting')
  console.log()
  process.exit(0)
}




//
// new timer-based distribution of transactions
//
let interval = (argv.i || 10) * 1000
let transactionsPerInterval = argv.n || 1
let timerInterval =  interval / transactionsPerInterval * 1000

let url = 'http://localhost:8088'
if (argv.ws_ip) {
  url = 'http://' + argv.ws_ip
}

function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [
    h,
    m > 9 ? m : (h ? '0' + m : m || '0'),
    s > 9 ? s : '0' + s,
  ].filter(a => a).join(':');
}

let outputStats
if (process.stdout.isTTY) {
  outputStats = function (getLine) {
    let et = Math.floor((mstime() - startTime) / 1000) || 1
    let prefix = 'et: ' + formatTime(et) + ' '
    process.stdout.clearLine()
    process.stdout.cursorTo(0)
    process.stdout.write(prefix + getLine(et))
  }
} else {
  outputStats = function (getLine) {
    let et = (mstime() - startTime) / 1000
    let prefix = 'et: ' + formatTime(et) + ' '
    process.stdout.write(prefix + getLine(et) + '\n')
  }
}

let options = {
  headers: {
    'X-Requested-With': 'XMLHttpRequest',
    'Content-Type': 'application/json'
  }
}
if (badHeader) {
  options.headers['x-trace'] = badHeaders[badHeader]
}

function makePlainText(min = 10, max = 30) {
  let length = min + Math.random() * (max - min)
  return randomstring.generate(length)
}

//
// utility functions
//
// mstime, wait, random need to become base class of
// action classes
//
const mstime = () => new Date().getTime()
//
// promisify setTimeout
// if the time is zero don't get rescheduled in the event loop
//
const wait = ms => ms === 0 ?
  Promise.resolve() :
  new Promise(resolve => setTimeout(resolve, ms))

//
// get a time in the interval. it will average 1/2 of the interval time.
//
function random (interval) {
  return Math.round(Math.random() * interval, 0)
}

const rd = (n, p) => n.toFixed(p !== undefined ? p : 2)

const wasSampled = headers => {
  // validate header present and version correct
  if (agentConfigured === 'appoptics' && (!headers['x-trace'] || headers['x-trace'].slice(0, 2) !== '2B')) {
    console.error('x-trace not valid: ' + headers['x-trace'])
    throw new Error('x-trace not valid: ' + headers['x-trace'])
  }
  if (badHeader) {
    if (options.headers['x-trace'].substr(2, 40) === headers['x-trace'].substr(2, 40)) {
      throw new Error('x-trace task ID same as bad header')
    }
  }
  return headers['x-trace'] && headers['x-trace'].slice(-2) === '01'
}


//
// Special code to delete existing todos as an option
//
if (argv.delete) {
  let executeGet = function (interval) {
    return wait(interval).then(() => {
      return axios.get(url + '/api/todos', options).then(r => r)
    })
  }

  let ad = new actionAddDelete(url, 0)

  let outstanding = []
  executeGet(0).then(r => {
    let todosToDelete = r.data
    while(todosToDelete.length) {
      console.log('todos to delete: ', todosToDelete.length)
      let todo = todosToDelete.shift()
      // small delay so not all requests are queued before yielding
      // to the event loop.
      let p = wait(100).then(() => ad.deleteTodo(todo)).then(() => {
        return 1
      }).catch(e => {
        console.log(e)
        return 0
      })
      outstanding.push(p)
    }
    return 'queued'
  }).then(() => {
    Promise.all(outstanding).then(values => {
      if (values.length) {
        console.log('deleted todos:', values.reduce((acc, val) => acc + val))
      }
    })
  })
}

//
// class-based add-delete implementation
//
function actionAddDelete (host, output) {
  this.host = host
  this.output = output
  this.interval = interval
  this.url = host + '/api/todos'

  this.start = mstime()
  this.inFlight = 0
  this.addCount = 0
  this.addsSampled = 0
  this.delCount = 0
  this.delsSampled = 0
}

actionAddDelete.prototype.execute = function () {
  var f = (et) => this.makeStatsLine(et)

  return this.addTodo(0).then(r => {
    this.addCount += 1
    if (wasSampled(r.headers)) {
      this.addsSampled += 1
    }
    this.output(f)

    // if there isn't a todo returned there isn't anything to delete
    if (!(r.data && r.data.todo)) {
      return Promise.reject('transaction failed')
    }

    return wait(random(this.interval)).then(() => {
      this.deleteTodo(r.data.todo).then(r => {
        this.delCount += 1
        if (wasSampled(r.headers)) this.delsSampled += 1
        this.output(f)
        return r
      })
    })
  })
}

actionAddDelete.prototype.executeAfter = function (interval) {
  if (arguments.length === 0) {
    interval = random(this.interval)
  }
  return wait(interval).then(() => {
    return this.execute().then(r => r)
  }).catch (e => {
    console.log('error executing add-delete', e)
  })
}

// add a random todo
actionAddDelete.prototype.addTodo = function () {
  let start = mstime()
  let ipso = makePlainText()
  let req = { title: ipso, completed: false }
  this.inFlight += 1
  return axios.post(this.url, req, options).then(r => {
    this.inFlight -= 1
    // accumulate time
    this.addTime += mstime() - start
    return r
  }).catch(e => {
    console.log(e)
    this.inFlight -= 1
    return {}
  })
}

// delete a specific ID
actionAddDelete.prototype.deleteTodo = function (todo) {
  let start = mstime()
  this.inFlight += 1
  return axios.delete(this.url + '/' + todo._id, options).then(r => {
    this.inFlight -= 1
    this.delTime += mstime() - start
    return r
  }).catch(e => {
    console.log(e)
    this.inFlight -= 1
    return {}
  })
}

actionAddDelete.prototype.makeStatsLine = function (et) {
  var totActions = this.addCount + this.delCount
  var totSampled = this.addsSampled + this.delsSampled
  return [
    'a:', this.addCount, '(', rd(this.addCount / et), '/s), ',
    'd:', this.delCount, '(', rd(this.delCount / et), '/s), ',
    'sampled a:', this.addsSampled, ', d:', this.delsSampled,
    ', t:', totSampled, ' (', rd(totSampled/totActions*100, 0), '%)'
  ].join('')
}


//
// class-based delay implementation
//
function actionDelay (host, output) {
  this.host = host
  this.output = output
  this.interval = interval
  this.delay = delay
  this.url = host + '/delay/' + delay

  this.start = mstime()
  this.delayCalls = 0
  this.totalServerDelay = 0
  this.totalDelay = 0
}

actionDelay.prototype.execute = function () {
  var start = mstime()
  return axios.get(this.url, options).then(r => {
    return {serverDelay: r.data.actualDelay, totalDelay: mstime() - start}
  })
}

actionDelay.prototype.executeAfter = function (interval) {
  if (arguments.length === 0) {
    interval = this.interval
  }
  return wait(random(interval)).then(() => {
    return this.execute().then(r => {
      this.delayCalls += 1
      this.totalServerDelay += r.serverDelay
      this.totalDelay += r.totalDelay
      var f = (et) => this.makeStatsLine(r)
      this.output(f)
    })
  })
}

actionDelay.prototype.makeStatsLine = function (r) {
  return [
    'n: ', this.delayCalls,
    ', delay (tot, server) avg (',
    rd(this.totalDelay / this.delayCalls), ', ',
    rd(this.totalServerDelay / this.delayCalls),
    ') last (', r.totalDelay, ', ', r.serverDelay, ')'
  ].join('')
}

//
// class-based chain implementation
//
function actionChain(host, output) {
  this.host = host
  this.output = output
  this.interval = interval
  this.url = host + '/chain' + chain

  this.start = mstime()
  this.inFlight = 0
  this.count = 0
  this.sampled = 0
}

actionChain.prototype.execute = function () {
  var f = (et) => this.makeStatsLine(et)

  return axios.get(this.url, options).then(r => {
    this.count += 1
    if (wasSampled(r.headers)) {
      this.sampled += 1
    }
    this.output(f)
  })
}

actionChain.prototype.executeAfter = function (interval) {
  if (arguments.length === 0) {
    interval = random(this.interval)
  }
  return wait(interval).then(() => {
    return this.execute().then(r => r)
  }).catch(e => {
    console.log('error executing add-delete', e)
  })
}

actionChain.prototype.makeStatsLine = function (et) {
  return [
    'n: ', this.count, '(', rd(this.count / et), '/s), ',
    'sampled: ', this.sampled, '(', rd(this.sampled / et), '/s) ',
    rd(this.sampled / this.count * 100, 0), '%'
  ].join('')
}

//
// class-based get todos implementation
//
function actionGet(host, output) {
  this.host = host
  this.output = output
  this.interval = interval
  this.url = host + '/api/todos'

  this.start = mstime()
  this.getCount = 0
}

actionGet.prototype.execute = function () {
  var start = mstime()
  return axios.get(this.url, options).then(r => {
    return r.data
  })
}

actionGet.prototype.executeAfter = function (interval) {
  if (arguments.length === 0) {
    interval = this.interval
  }
  return wait(random(interval)).then(() => {
    return this.execute().then(r => {
      this.getCount += 1
      var f = (et) => this.makeStatsLine(et)
      this.output(f)
    })
  })
}

actionGet.prototype.makeStatsLine = function (et) {
  return [
    'total gets: ', this.getCount,
    ', ', rd(this.getCount / et), '/sec'
  ].join('')
}


/*
//
// always and never are not primitive settings.
// always = SAMPLE_START,SAMPLE_THROUGH_ALWAYS
// never = SAMPLE_BUCKET_ENABLED (START and THROUGH_ALWAYS are cleared)
//
let jcModes = {
  always: 'SAMPLE_START,SAMPLE_THROUGH_ALWAYS,SAMPLE_BUCKET_ENABLED',
  never: 'SAMPLE_BUCKET_ENABLED'
}

//
// get the java-collector's configuration to document what this
// test run was testing.
//
let p = dutils.getExposedPort('todo_java-collector_1', 8181).then(port => {
  let url = 'http://localhost:' + port + '/collectors'
  return axios.get(url, options).then(r => {
    let collectorIds = Object.keys(r.data)
    if (Object.keys(r.data).length !== 1) {
      throw new Error('There is not exactly one collector')
    }
    return collectorIds[0]
  }).then(id => {
    let url = 'http://localhost:' + port + '/collectors/' + id + '/settings'
    return axios.get(url, options).then(r => {
      let settings = r.data[0]
      return settings
    })
  })
}).then(settings => {

  console.log('\n', settings.flags)
}).then(() => {
  //
  // display the server configuration then execute the action.
  // execute the first time with no delay so there is immediate
  // visual feedback.
  //
  return axios.get(url + '/config', options).then(r => {
    console.log(r.data)
  })
}).then(() => {
  executeAction()
})
// */

// make it none until the response has been received
var agentConfigured = 'dummy'

axios.get(url + '/config', options).then(r => {
  agentConfigured = r.data.configuration
  let sampled = wasSampled(r.headers)
  let line = 'agent: ' + r.data.configuration
  line += ', aob: ' + (r.data.bindings ? 'loaded' : 'not loaded')
  line += ', mode: ' + r.data.sampleMode + ', rate: ' + r.data.sampleRate
  line += ', samp: ' + sampled + ', pid: ' + r.data.pid
  line += '\nkey: ' + r.data.serviceKey
  console.log(line)
}).then (() => {
  executeAction()
}).catch (e => {
  console.log(e)
})

return

let collector = {}
let getSettings
// BAM TODO don't get settings if not java-collector
if ('it is java-collector' && false) {
  collector = new jcu.JavaCollector('todo_java-collector_1', 8181)
} else {
  collector.getSettings = () => Promise.resolve({flags: '<unknown>'})
  collector.setMode = () => Promise.resolve(true)
}

//let jc = new jcu.JavaCollector('todo_java-collector_1', 8181);


collector.getSettings().then(settings => {
  console.log('\ncollector flags:', settings.flags)
}).then(() => {
  //
  // display the server configuration so it's documented
  // at the client end. the server side scrolls on each
  // transaction.
  //
  return axios.get(url + '/config', options).then(r => {
    console.log(r.data)
  })
}).then(() => {
  return collector.setMode('never')
}).then(() => {
  executeAction()
})

/*
jc.setMode('never').then(mode => {
  js.getSettings().then(settings => {
    console.log('\n', settings.flags)
  })
})
// */

var startTime
function executeAction () {
  var a = new action(url, outputStats)
  startTime = mstime()

  // count the number executed
  let nActions = 1
  a.executeAfter(0)
  let iid = setInterval(() => {
    if (nActions >= maxActions) {
      clearInterval(iid)
      // TODO BAM this needs to wait until in-flight requests
      // have completed.
      process.stdout.write('\n')
      return
    }
    a.executeAfter()
    nActions += 1
  }, interval / transactionsPerInterval)
}
