'use strict'

const axios = require('axios')
const randomstring = require('randomstring')
const argv = require('minimist')(process.argv)
const dutils = require('./docker-utilities')

const validActions = {
  'add-delete': actionAddDelete,
  'ad': actionAddDelete,
  delay: actionDelay
}

// params
let int = argv.i || 5         // interval in seconds
let nPerInt = argv.n || 5     // number of actions executed per interval
let maxActions = argv['max-actions'] || argv.m || Infinity

// TODO BAM extend to allow multiple --action and/or -a arguments.
// get action to perform n times per i
let action = argv.action || 'add-delete'
if (argv.a) action = argv.a

let parts = action.split('=')
action = parts[0]
let delay = parts[1] === undefined ? 1500 : parts[1]

if (!(action in validActions)) {
  console.warn('invalid action: "%s"', action)
}

// if not good this will cause help to be displayed then process exit.
action = validActions[action]

if (!action || argv.h || argv.help) {
  console.log('usage: node multitest.js')
  console.log('  options:')
  console.log('    --action=action-option')
  console.log('      where action-option is:')
  console.log('        add-delete|ad - add a todo then delete it')
  console.log('        delay[=ms] server delays response for ms (1500 default)')
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
    let et = Math.floor((mstime() - startTime) / 1000)
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
  if (!headers['x-trace'] || headers['x-trace'].slice(0, 2) !== '2B') {
    console.error('x-trace not valid: ' + headers['x-trace'])
    throw new Exception('x-trace not valid: ' + headers['x-trace'])
  }
  return headers['x-trace'].slice(-2) === '01'
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
    if (wasSampled(r.headers)) this.addsSampled += 1
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
}).then(settings => console.log(settings))
// get port for java-collector
// 'docker inspect --format=\'{{(index (index .NetworkSettings.Ports "8181/tcp") 0).HostPort}}\' todo_java-collector_1'
// exec(cmd, function(err, stdout, stderr) {console.log('and it is', stdout)})

// get java-collector settings
// localhost:32778/collectors/1/settings



//
// display the server configuration then execute the action.
// execute the first time with no delay so there is immediate
// visual feedback.
//
axios.get(url + '/config', options).then(r => {
  console.log(r.data)
})



var a = new action(url, outputStats)
var startTime = mstime()

// count the number executed
let nActions = 1
a.executeAfter(0)
let iid = setInterval(() => {
  if (nActions >= maxActions) {
    clearInterval(iid)
    process.stdout.write('\n')
    return
  }
  a.executeAfter()
  nAction += 1
}, interval/transactionsPerInterval)

