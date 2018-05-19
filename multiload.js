'use strict'

const axios = require('axios')
const minimist = require('minimist')
const jcu = require('./java-collector-utils')

// actions
const ActionDelay = require('./action-delay')
const ActionChain = require('./action-chain')
const ActionGet = require('./action-get')
const ActionAddDelete = require('./action-add-delete')

// internal actions
const ActionDelete = require('./action-delete')
const ActionGetConfig = require('./action-get-config')

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

let remoteMode = argv['remote-mode']

let action = argv.action
let maxActions = argv['max-actions']
// TODO allow multiple action to be specified
//if (!Array.isArray(action)) action = [action]


let url = argv['ws-ip']
if (url.indexOf('http://') !== 0) url = 'http://' + url

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

let badHeader = argv['bad-header']
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
  console.log('usage: node multitest.js options')
  console.log('  options:')
  console.log('    -a action, --action=action (default: add-delete)')
  console.log('      where action is:')
  console.log('        add-delete|ad - add a todo then delete it')
  console.log('        delay[=ms] server delays response for ms (1500 default)')
  console.log('        get - get the todos')
  console.log('        chain[=?query-chain] - chain requests as specified')
  console.log('')
  console.log('    -r n, --rate=n - number of actions per second (default 1)')
  console.log('    -m n, --max-actions=n - stop after this many actions')
  console.log('    --ws-ip=host[:port] - todo server to connect to')
  console.log('    --delete - delete existing todos before starting')
  console.log('    -b, --bad-header - v1 or v3, sends bad header instead of good')
  console.log()
  process.exit(0)
}




//
// timer-based distribution of transactions
//
let timerInterval =  1 / rate * 1000

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
// Special code to delete existing todos as an option
//
if (argv.delete) {
  let a = new ActionDelete(url, outputStats, actionOptions)
  a.execute()
  console.log('\n\n')
}

//
// get the configuration data
//
let a = new ActionGetConfig(url, outputStats, actionOptions)
a.execute().then(
  console.log('\n\n')
).catch (e => {
  console.log(e)
})

//
// now execute the action the user selected
//
// TODO BAM allow multiple actions, iterate through starting each.
executeAction(actionOptions)

//
// this executes the action selected
//
// TODO BAM consider putting in Action base class.
var startTime
function executeAction(actionOptions) {
  var a = new action(url, outputStats, actionOptions)
  startTime = mstime()

  // count the number executed
  let nActions = 1
  // execute the first one immediately so errors are detected
  // more rapidly if the rate is low.
  a.execute()

  // TODO BAM this should be randomized
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
