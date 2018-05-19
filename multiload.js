'use strict'

const axios = require('axios')
const minimist = require('minimist')
const jcu = require('./java-collector-utils')

// actions
const ActionDelay = require('./action-delay')
const ActionChain = require('./action-chain')
const ActionGet = require('./action-get')
const ActionAddDelete = require('./action-add-delete')

const env = process.env

const validActions = {
  'add-delete': ActionAddDelete,
  'ad': ActionAddDelete,
  delay: ActionDelay,
  chain: ActionChain,
  get: ActionGet
}

const cliOptions = [{
  name: 'ws-ip',
  alias: 'w',
  description: 'webserver[:port] to connect to',
  default: 'http://localhost:8088'
}, {
  name: 'action',
  alias: 'a',
  description: 'action to perform (default: add-delete)',
  default: 'add-delete'
}, {
  name: 'max-actions',
  alias: 'm',
  description: 'maximum number of each action to perform',
  default: Infinity
}, {
  name: 'rate',
  alias: 'r',
  description: 'number of actions to execute per second',
  default: 1,
}, {
  name: 'bad-header',
  alias: 'b',
  description: 'bad header to use, either v1 or v3',
}, {
  name: 'remote-mode',
  description: 'java-collector only setting for remote mode',
  default: 'always'
}, {
  name: 'help',
  alias: 'h',
  description: 'this message or --help action for help on that action',
}]

// create a map from an array of objects using key as the prop name
// and val
function makeMap(array, key, val) {
  const r = {}
  array.forEach(item => {
    r[item[key]] = item[val]
  })
  return r
}

const argv = minimist(process.argv.slice(2), {
  default: makeMap(cliOptions, 'name', 'default'),
  alias: makeMap(cliOptions, 'alias', 'name'),
  boolean: cliOptions.filter(i => i.boolean)
})

// params
let rate = argv.rate
let maxActions = argv['max-actions']

let remoteMode = argv['remote-mode']

let action = argv.action
// TODO allow multiple action to be specified
//if (!Array.isArray(action)) action = [action]

let index = action.indexOf('=')
let actionArg
if (~index) {
  actionArg = action.slice(index + 1)
  action = action.slice(0, index)
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
  console.log('    --rate, -r - number of actions per second (default 1)')
  console.log('    -n <add/delete pairs per interval')
  console.log('    --ws_ip=host[:port] todo server to connect to')
  console.log('    --delete delete existing todos before starting')
  console.log()
  process.exit(0)
}




//
// timer-based distribution of transactions
//
let timerInterval =  1 / rate * 1000

let url = argv['ws-ip']
if (url.indexOf('http://') !== 0) url = 'http://' + url

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
// replace previous options as actions move to separate files.
let actionOptions = {
  httpOptions: {
    headers: {
      'X-Requested-With': 'XMLHttpRequest',
      'Content-Type': 'application/json'
    }
  },
  rate: rate,
}

if (badHeader) {
  options.headers['x-trace'] = badHeaders[badHeader]
  actionOptions.httpOptions.headers['x-trace'] = badHeaders[badHeader]
  actionOptions.badHeader = badHeaders[badHeader]
}

// check action-specific values

// TODO BAM should just pass string after '=' to action.
if (action === ActionChain) {
  actionOptions.chain = actionArg
} else if (action === ActionDelay) {
  actionArg = +actionArg || 1500
  actionOptions.delay = actionArg >= 1 ? actionArg : 1500
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

// make it none until the response has been received
var agentConfigured = 'dummy'

axios.get(url + '/config', options).then(r => {
  if (r.statusCode) {
    agentConfigured = r.data.configuration
    actionOptions.agentConfigured = agentConfigured

    let sampled = wasSampled(r.headers)
    let line = 'agent: ' + r.data.configuration
    line += ', aob: ' + (r.data.bindings ? 'loaded' : 'not loaded')
    line += ', mode: ' + r.data.sampleMode + ', rate: ' + r.data.sampleRate
    line += ', samp: ' + sampled + ', pid: ' + r.data.pid
    line += '\nkey: ' + r.data.serviceKey

    console.log(line)
  }
}).catch (e => {
  console.log('error getting config', e.response.status)
})

// now execute the action
executeAction(actionOptions)

//
// this executes the action selected
//
var startTime
function executeAction(options) {
  var a = new action(url, outputStats, options)
  startTime = mstime()

  // count the number executed
  let nActions = 1
  // execute the first one immediately so errors are detected
  // more rapidly if the rate is low.
  a.execute()

  let iid = setInterval(() => {
    if (nActions >= maxActions) {
      clearInterval(iid)
      // TODO BAM this needs to wait until in-flight requests
      // have completed.
      process.stdout.write('\n')
      return
    }

    a.execute()
    nActions += 1
  }, timerInterval)
}

return

//
// the follow are to interact with the java collector - ask it to set
// configs, et al. various issues, so return before it.
//
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
  executeAction(actionOptions)
})

/*
jc.setMode('never').then(mode => {
  js.getSettings().then(settings => {
    console.log('\n', settings.flags)
  })
})
// */

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
