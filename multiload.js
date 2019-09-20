#!/usr/bin/env node
'use strict'

/* eslint-disable no-console */

const minimist = require('minimist')
const readline = require('readline')
const Action = require('./lib/action')


//const jcu = require('./lib/java-collector-utils')

if (!Promise.prototype.finally) {
  console.log('[error] multiload requires Promise.prototype.finally')
  console.log('        run node v8 with "--harmony-promise-finally"')
  console.log('        or node v10')
  process.exit(1)
}

const actions = require('./lib/actions')()

// only expose the actions we want exposed.
const validActions = {
  'add-delete': 'AddDelete',
  ad: 'AddDelete',
  delay: 'Delay',
  chain: 'Chain',
  get: 'Get',
  add: 'Add',
  post: 'Post',
}

const cliOptions = [{
  name: 'ws-ip',
  alias: 'w',
  description: '[http|https://]webserver[:port] to connect to',
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
function makeMap (array, key, val) {
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
const rate = argv.rate

//const remoteMode = argv['remote-mode']

let action = argv.action
let maxActions = argv['max-actions']

// TODO allow multiple action to be specified
//if (!Array.isArray(action)) action = [action]


let url = argv['ws-ip']
let protocol = 'http://'
let host, port

if (url.indexOf('https://') === 0) {
  protocol = 'https://'
  host = url.slice(protocol.length)
} else if (url.indexOf('http://') === 0) {
  host = url.slice(protocol.length)
} else {
  host = url
}
[host, port] = host.split(':')
if (!host) {
  host = 'localhost'
} else {
  if (host.endsWith('/')) {
    host = host.slice(0, -1)
  }
}
if (!port) {
  port = protocol === 'http://' ? 80 : 443
}

url = protocol + host + ':' + port

const index = action.indexOf('=')
let actionArg
if (~index) {
  actionArg = action.slice(index + 1)
  action = action.slice(0, index)
}

const badHeaders = {
  v1: '1BA76EA380708FB00385D49BBCE13F8F0815B7A4E05F51D0CA1D9A2B7C',
  v3: '3BA76EA380708FB00385D49BBCE13F8F0815B7A4E05F51D0CA1D9A2B7C01'
}

let badHeader = argv['bad-header']
if (badHeader && !(badHeader in badHeaders)) {
  console.log('--bad-header must be one of ' + Object.keys(badHeaders).join(', '))
  badHeader = false
}

let error = false

if (!(action in validActions)) {
  error = true
  console.warn('invalid action: "%s"', action)
}

if (Array.isArray(argv['max-actions'])) {
  error = true
  console.warn('more than one max-action value')
}

// if not good display help then exit.
action = validActions[action]

if (error || argv.h || argv.help) {
  console.log('usage: node multitest.js options')
  console.log('  options:')
  console.log('    -a action, --action=action (default: add-delete)')
  console.log('      where action is:')
  console.log('        add-delete|ad - add a todo then delete it')
  console.log('        add - add a todo (default max = 10)')
  console.log('        delay[=ms] server delays response for ms (1500 default)')
  console.log('        get - get the todos')
  console.log('        chain[=?query-chain] - chain requests as specified')
  console.log('        delete-all - delete all todos in the database')
  console.log('')
  console.log('    -r n, --rate=n - number of actions per second (default 1)')
  console.log('    -m n, --max-actions=n - stop after this many actions')
  console.log('    --ws-ip=host[:port] - todo server to connect to')
  console.log('    --delete - delete existing todos before starting')
  console.log('    -b, --bad-header - v1 or v3, sends bad header instead of good')
  console.log()
  process.exit(0)
}


function formatTime (seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [
    h,
    m > 9 ? m : (h ? '0' + m : m || '0'),
    s > 9 ? s : '0' + s,
  ].filter(a => a).join(':');
}

/*
function newlineCount (string) {
  let count = 0
  let lastIndex = -1

  while (~(lastIndex = string.indexOf('\n', lastIndex + 1))) {
    count += 1
  }
  return count
}
// */

//const configX = 0
const totalX = 4
const actionX = 5

let outputStats
//let statsLines
if (process.stdout.isTTY) {
  outputStats = function (getLine) {
    const et = Math.floor((mstime() - startTime) / 1000) || 1
    readline.cursorTo(process.stdout, 0, actionX)

    const line = getLine(et)
    process.stdout.write(line)
    readline.clearLine(process.stdout, 1)
  }
} else {
  outputStats = function (getLine) {
    const et = (mstime() - startTime) / 1000
    const prefix = 'et: ' + formatTime(et) + ' '
    process.stdout.write(prefix + getLine(et) + '\n')
  }
}
const outputConfig = function (getLine) {
  const et = (mstime() - startTime) / 1000
  process.stdout.write(  '===================\n')
  const line = getLine(et)
  process.stdout.write(line)
  process.stdout.write('\n===================\n')
}

//let actionLine
const outputTotals = function () {
  readline.cursorTo(process.stdout, 0, totalX)
  const et = Math.floor((mstime() - startTime) / 1000) || 1
  const {checked, sampled} = Action.getAllSampled()
  const line = [
    'et: ', formatTime(et),
    ', total: ', checked, ', sampled: ', sampled,
    '\n'
  ].join('')
  process.stdout.write(line)
}

function outputError (e, n = 1) {
  readline.cursorTo(process.stdout, 0, actionX + n);
  const line = `? error: ${e.code} ${e.errno}\n`;
  process.stdout.write(line);
}

//
// build options to be passed to action
//
const actionOptions = {
  httpOptions: {
    headers: {
      'X-Requested-With': 'XMLHttpRequest',
      'Content-Type': 'application/json'
    }
  },
  rate: rate,
}

if (badHeader) {
  actionOptions.httpOptions.headers['x-trace'] = badHeaders[badHeader]
  actionOptions.badHeader = badHeaders[badHeader]
}

//
// check action-specific values
//
if (action === 'Chain') {
  actionOptions.chain = actionArg
} else if (action === 'Delay') {
  actionArg = +actionArg || 1500
  actionOptions.delay = actionArg >= 1 ? actionArg : 1500
} else if (action === 'Add') {
  // add=max because just adding endlessly creates a problem
  // in that the application returns all todos when one is added.
  if (maxActions === Infinity) {
    maxActions = +actionArg || 10
  }
} else if (action === 'Post') {
  actionOptions.url = '/aws/kinesis'
}

//
// utility functions
//
// mstime, wait, random need to become base class of
// action classes
//
const mstime = () => new Date().getTime()

let p
//
// Special code to delete existing todos as an option
//
if (argv.delete) {
  const a = new actions.Delete(url, outputStats, actionOptions)
  p = a.execute().then(r => {

  }).catch(e => {
    console.log(e)
  })
} else {
  p = Promise.resolve()
}

//
// get the configuration data
//
p.then(() => {
  readline.cursorTo(process.stdout, 0, 0)
  readline.clearScreenDown(process.stdout)
  const a = new actions.GetConfig(url, outputConfig, actionOptions)
  return a.execute().then(r => {

  }).catch(e => {
    outputError(e);
  })
}).then(() => {
  //
  // now execute the action the user selected
  //
  // TODO BAM allow multiple actions, iterate through starting each.
  executeAction(actionOptions)
}).catch(e => {
  outputError(e);
})


//
// this repeatedly executes the action selected
//
let startTime
function executeAction (actionOptions) {
  const a = new actions[action](url, outputStats, actionOptions)
  startTime = mstime()

  outputTotals()

  // count the number executed
  let nActions = 1
  // execute the first one immediately for visual feedback
  // (important if the rate is low.)
  a.execute().then(r => {
    outputTotals()
  })

  const loop = () => {
    if (nActions >= maxActions) {
      // wait in 1/20ths of a second for inflight actions to complete.
      // TODO BAM stop after n intervals no matter what?
      const iid = setInterval(function () {
        if (a.inFlight === 0) {
          clearInterval(iid)
        }
      }, 50)
      return
    }

    // count it before it's hatched, so to speak, so that
    // the delay can't cause overrunning the target.
    nActions += 1
    const wait = delay()
    setTimeout(function () {
      a.execute()
        .then(r => {
          if (r instanceof Error) {
            outputError(r);
            maxActions = 0;
            return r;
          }
          outputTotals()
        })
        .catch(e => {
          outputError(e);
          maxActions = 0;
          return e;
        })
      // set new timer
      loop()
    }, wait)
  }

  loop()

}

function delay () {
  // rate is actions/second => 1/rate is seconds/action
  // seconds/action * 1000 => ms/action
  // ms/action * 2 => yields average action/second ≈≈ rate
  return Math.random() * 1 / rate * 2000
}
