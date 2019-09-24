#!/usr/bin/env node
'use strict'

/* eslint-disable no-console */

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
const {argv} = require('./lib/get-cli-options');

// get global rate. this is used if the action doesn't specify
// a rate.
const rate = argv.rate

//const remoteMode = argv['remote-mode']

const action = argv.action
let maxActions = argv['max-actions']

// allow multiple actions to be specified
const cliActions = Array.isArray(action) ? action : [action];


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

const badHeaders = {
  v1: '1BA76EA380708FB00385D49BBCE13F8F0815B7A4E05F51D0CA1D9A2B7C',
  v3: '3BA76EA380708FB00385D49BBCE13F8F0815B7A4E05F51D0CA1D9A2B7C01'
}

let badHeader = argv['bad-header']
if (badHeader && !(badHeader in badHeaders)) {
  console.log('--bad-header must be one of ' + Object.keys(badHeaders).join(', '))
  badHeader = false
}

//const configX = 0
const totalX = 4
const actionX = 5; // line for the action. must vary by executableAction index.

let outputStats
//let statsLines

if (process.stdout.isTTY) {
  outputStats = function (getLine, actionX) {
    const et = Math.floor((mstime() - startTime) / 1000) || 1
    readline.cursorTo(process.stdout, 0, actionX)

    const line = getLine(et)
    process.stdout.write(line)
    readline.clearLine(process.stdout, 1)
  };
} else {
  outputStats = function (getLine) {
    const et = (mstime() - startTime) / 1000
    const prefix = 'et: ' + formatTime(et) + ' '
    process.stdout.write(prefix + getLine(et) + '\n')
  }
}


//===================================================================
// validate and accumulate all actions specified on the command line.
//===================================================================
// only expose the actions we want exposed.
const validActions = {
  // todo api actions
  'add-delete': 'AddDelete',
  ad: 'AddDelete',
  get: 'Get',
  add: 'Add',
  'delete-all': 'DeleteAll',
  // general actions implemented by todo test server
  delay: 'Delay',
  chain: 'Chain',
  post: 'Post',
}

const validActionModifiers = {
  rate: {parser: rateParser, name: 'rate', default: rate},
  r: {parser: rateParser, name: 'rate', default: rate},
  instances: {parser: numberParser, name: 'instances', default: 1},
  i: {parser: numberParser, name: 'instances', default: 1},
}

function rateParser (string) {
  if (string === 'sequential' || string === 'seq') {
    return 'sequential';
  }
  return numberParser(string);
}

function numberParser (string) {
  // best way i've seen to implicitly convert a number.
  const n = string - 0;
  return (Number.isNaN(n) || n <= 0) ? undefined : n;
}

let errors = 0;
const executableActions = [];

//==================================================
// collect the actions specified on the command line
//==================================================
for (let i = 0; i < cliActions.length; i++) {
  // the argument might have colons in it so make sure that works.
  const [action, params, ...others] = cliActions[i].split(':');
  const aArg = others.join(':');
  const modifiers = getActionModifiers(params);

  if (action in validActions) {
    try {
      const actionName = validActions[action];
      for (let i = 0; i < modifiers.instances; i++) {
        const lineXOffset = actionX + executableActions.length;
        // TODO BAM if instances > 1 invoke actions with "group-id" that
        // causes the collection of stats for the group. group-head is
        // the only one that actually outputs. needs more thought. maybe
        // add static method in action.js that creates N?
        const outputFn = getLine => outputStats(getLine, lineXOffset);
        const a = new actions[actionName](url, outputFn, {rate: modifiers.rate, arg: aArg});
        executableActions.push(a);
      }
    } catch (e) {
      console.warn(`failed to create action ${action}`, e);
      errors += 1;
    }
  } else {
    errors += 1;
    console.warn(`invalid action ${action}`);
  }
}

function getActionModifiers (string = '') {
  const kvs = {rate, instances: 1};
  // if there's not KV pairs then it's the action-specific rate (for
  // historical reasons).
  if (!string) {
    return kvs;
  }
  if (string.indexOf('=') < 0) {
    let rateValue = rateParser(string);
    if (rateValue === undefined || rateValue <= 0) {
      console.warn(`invalid action option: ${string}`);
      rateValue = rate;
    }
    kvs.rate = rateValue;
    return kvs;
  }

  // if it's KV pairs then it's the extensible argument mechanism.
  const pairs = string.split(',');
  pairs.forEach(p => {
    let [key, value] = p.split('=').map(s => (s || '').trim());
    // don't know what was intended so this error is fatal
    if (!key || !value || !(key in validActionModifiers)) {
      errors += 1;
      console.warn('invalid key=value pair', p);
      return;
    }
    let parsedValue = validActionModifiers[key].parser(value);

    // it's a valid key but not a value so default the value.
    if (parsedValue === undefined) {
      console.warn(`invalid value ${value} for key ${key}`);
      parsedValue = validActionModifiers[key].default;
    }

    kvs[validActionModifiers[key].name] = parsedValue;
  })

  return kvs
}

//
// make sure the semantics are ok.
//
if (Array.isArray(argv['max-actions'])) {
  errors += 1;
  console.warn('more than one max-action value')
}

// if nothing to do let the user know.
if (!executableActions.length) {
  errors += 1;
  console.warn('no valid actions specified');
}

// something isn't right.
if (errors) {
  process.exit(1);
}

if (argv.h || argv.help) {
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
  console.log('      each action may have optional components as follows');
  console.log('        action[:[rate][:[actions-arg]] where rate is the action-specific');
  console.log('        rate and actions-arg is an action-specific argument interpreted by');
  console.log('        the action\'s constructor');
  console.log('')
  console.log('    -rn, --rate=n - number of actions per second (default 1)')
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

function outputError (e, n = executableActions.length) {
  readline.cursorTo(process.stdout, 0, actionX + n);
  const line = `? error: ${e}`;
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
  const a = new actions.Delete(url, outputStats.bind(null, actionX), actionOptions)
  p = a.execute().then(r => {

  }).catch(e => {
    console.log(e)
  })
} else {
  p = Promise.resolve()
}

//
// get the configuration data for display on the first output line.
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
  // now execute the actions the user selected
  //
  // TODO BAM allow multiple actions, iterate through starting each.
  for (let i = 0; i < executableActions.length; i++) {
    // actionX is the row offset to use for this action
    executeAction(executableActions[i])
  }
}).catch(e => {
  outputError(e);
})


//
// this repeatedly executes the action specified.
//
let startTime
function executeAction (a) {
  startTime = mstime()

  outputTotals()

  // count the number executed
  let nActions = 1
  // execute the first one immediately for visual feedback. (important
  // if the rate is low.)
  a.execute().then(r => {
    outputTotals()
  }).catch(e => {
    outputError(e);
  })

  const loop = () => {
    if (nActions >= maxActions) {
      // wait in 1/20ths of a second for inflight actions to complete then
      // return without initiating any addition actions.
      // TODO BAM stop after n intervals no matter what?
      const iid = setInterval(function () {
        if (a.inFlight === 0) {
          clearInterval(iid)
        }
      }, 50)
      return
    }

    // this is the code that is executed no matter what execution
    // strategy is used.
    const coreExecution = () => {
      return a.execute()
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
    }

    // the execution strategy can be sequential, i.e., start the
    // next action when the first completes, or it can be a target-rate
    // using a timer.
    let executeStrategy;
    if (a.rate === 'sequential') {
      executeStrategy = () => {
        return coreExecution()
      }
    } else {
      executeStrategy = () => {
        const wait = delay(a)
        return new Promise(resolve => {
          setTimeout(function () {
            coreExecution();
            resolve();
          }, wait)
        })
      }
    }

    // count it before it's hatched, so to speak, so that
    // the delay can't cause overrunning the target rate.
    nActions += 1
    executeStrategy().then(loop)

  }

  loop()

}

// get the time to wait.
// TODO BAM - tweak to adjust the delay slightly based on relationship
// to specified rate (the target rate). if multiple actions are specified
// the actual rate can be a bit off of the target rate.
function delay (action) {
  // rate is actions/second => 1/rate is seconds/action
  // seconds/action * 1000 => ms/action
  // ms/action * 2 => yields average action/second ≈≈ rate
  return Math.random() * 1 / action.rate * 2000
}
