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

// for use with get-cli-options-2
//const getOptions = require('./lib/get-cli-options');
//
//const {cliOptions, showHelp, error} = getOptions({configFile: {key: 'c', alias: 'config-file'}});
//
//if (cliOptions.help || cliOptions._.length !== 1) {
//  showHelp();
//  return;
//}

// get global rate. this is used if the action doesn't specify
// a rate.
const rate = argv.rate

//const remoteMode = argv['remote-mode']

// only one default max-actions can be specified.
if (Array.isArray(argv['max-actions'])) {
  errors += 1;
  console.error('more than one max-action value');
}
// set a global default. this will be an array if multiple
// were specified but an error has already been set so this
// will process.exit(1) later.
const maxActions = argv['max-actions'];

// allow multiple actions to be specified
const action = argv.action
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
  outputStats = function (getLine, xOffset, stats) {
    const et = Math.floor((mstime() - startTime) / 1000) || 1
    readline.cursorTo(process.stdout, 0, xOffset)

    const line = getLine(et, stats)
    process.stdout.write(line)
    readline.clearLine(process.stdout, 1)
  };
} else {
  outputStats = function (getLine, xOffset, stats) {
    const et = (mstime() - startTime) / 1000
    const prefix = 'et: ' + formatTime(et) + ' '
    process.stdout.write(prefix + getLine(et, stats) + '\n')
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
  // general action independent of server
  'get-endpoint': 'GetEndpoint',
}

const validActionModifiers = {
  rate: {parser: rateParser, name: 'rate', default: rate},
  r: {parser: rateParser, name: 'rate', default: rate},
  instances: {parser: numberParser, name: 'instances', default: 1},
  i: {parser: numberParser, name: 'instances', default: 1},
  explode: {parser: torfParser, name: 'explode', default: false, singleton: true},
  e: {parser: torfParser, name: 'explode', default: false, singleton: true},
  max: {parser: numberParser, name: 'maximum', default: maxActions},
  m: {parser: numberParser, name: 'maximum', default: maxActions},
}

function rateParser (string) {
  if (string === 'sequential' || string === 'seq') {
    return 'sequential';
  }
  return numberParser(string);
}

// maybe should be called positiveNumberParser...
function numberParser (string) {
  // best way i've seen to implicitly convert a number.
  const n = string - 0;
  return (Number.isNaN(n) || n <= 0) ? undefined : n;
}

function torfParser (string) {
  if (string === 'true' || string === 't' || string === '1') {
    return true;
  }
  return false;
}

let errors = 0;
const executableActions = [];
let statsLineCount = 0;

//==================================================
// collect the actions specified on the command line
// and is defined as:
//
// <action-option> ::= <action-specifier><separator><action-definition>
// <action-specifier> ::= "-a" | "--action"
// <separator> ::= "=" | " "
// <action-definition> ::= <action-name><action-parameters>
// <action-name> ::= "ad" | "add-delete" | "add" | "delay" | "get" | "chain" | "delete-all"
// <action-parameters> ::= "" | ":" <settings>
// <settings> ::= <action-specific-settings> | <action-specific-settings ":" <action-args>
//
// <action-specific-settings> ::= <rate> | <key-value-settings>
// <rate> ::= <number>
// <key-value-settings> ::= <common-key-value> ["," <key-value-settings>]
// <common-key-value> ::= <rate-key-value> | <instance-key-value>
// <rate-key-value> ::= ("rate" | "r") "=" (<number> | "seq" | "sequential")
// <instance-key-value> ::= ("instance" | "i") "=" <number>
//
// <action-args> ::= <action-specific-string>
//
//==================================================
for (let i = 0; i < cliActions.length; i++) {
  // the argument might have colons in it so make sure that works.
  const [action, params, ...others] = cliActions[i].split(':');
  const aArg = others.join(':');
  const modifiers = getActionModifiers(params);

  if (!(action in validActions)) {
    errors += 1;
    console.warn(`invalid action ${action}`);
    continue;
  }
  const actionName = validActions[action];
  const actionMods = {
    rate: modifiers.rate,
    maximum: modifiers.maximum || maxActions,
    arg: aArg
  };

  if (modifiers.instances === 1 || modifiers.explode) {
    // then each instance gets it's own line of output.
    try {
      for (let i = 0; i < modifiers.instances; i++) {
        const lineXOffset = actionX + statsLineCount++;
        // TODO BAM if instances > 1 invoke actions with "group-id" that
        // causes the collection of stats for the group. group-head is
        // the only one that actually outputs. needs more thought. maybe
        // add static method in action.js that creates N?
        // outputFn is either
        //    1) existing function but calls formatStatsLine with stats
        //    2) new aggregateStats function that collects stats across instances
        // this method works for all as long as 1) instances are called to add their
        // stats to the aggregated stats for each iteration of output and 2) the final
        // instance actually generates the output.
        const outputFn = getLine => outputStats(getLine, lineXOffset);
        const a = new actions[actionName](url, outputFn, actionMods);
        executableActions.push(a);
      }
    } catch (e) {
      console.warn(`failed to create action ${action}`, e);
      errors += 1;
    }
  } else {
    try {
      const lineXOffset = actionX + statsLineCount++;
      const group = [];
      const outputFn = getLine => {
        // aggregate the stats at this time from each instance in the group
        const stats = group[0].getStats();
        for (let i = 1; i < group.length; i++) {
          const s = group[i].getStats();
          Object.keys(stats).forEach(stat => {
            stats[stat] += s[stat];
          })
        }
        outputStats(getLine, lineXOffset, stats);
      }

      // the first instance collects and outputs while all the others noop
      for (let i = 0; i < modifiers.instances; i++) {
        const fn = i ? function () {} : outputFn;
        const a = new actions[actionName](url, fn, actionMods);
        group.push(a);
        executableActions.push(a);
      }
    } catch (e) {
      console.warn(`failed to create action ${actions}`, e);
      errors += 1;
    }
  }

}

//
// decode the action-modifiers in an action definition:
// "action-name:action-modifiers:actions-arg"
//
function getActionModifiers (string = '') {
  const kvs = {rate, instances: 1};
  // if there're not KV pairs then it's the action-specific rate (for
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
    const [key, value] = p.split('=').map(s => (s || '').trim());

    // check the keys
    if (!key || !(key in validActionModifiers)) {
      errors += 1;
      console.error(`invalid key ${key}`);
      return;
    }
    let parsedValue;
    // singletons don't require a value
    if (!value) {
      if ('singleton' in validActionModifiers[key]) {
        parsedValue = validActionModifiers[key].singleton;
      } else {
        errors += 1;
        console.log(`${key} requires a value`);
        return;
      }
    } else {
      parsedValue = validActionModifiers[key].parser(value);
    }

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


// if nothing to do let the user know.
if (!executableActions.length) {
  errors += 1;
  console.warn('no valid actions specified');
}

// something isn't right.
if (errors) {
  process.exit(1);
}

if (argv.h || argv.help || argv.H) {
  console.log('usage: node multiload.js options')
  console.log('  options:')
  console.log('    -a action, --action=action (default: add-delete)')
  console.log('      where each action can be:')
  console.log('        add-delete|ad - add a todo then delete it')
  console.log('        add - add a todo (default max = 10)')
  console.log('        delay::1500 server delays response for ms (1500 default)');
  console.log('        get - get the todos')
  console.log('        chain::query-chain] - chain the specified requests');
  console.log('        delete-all - delete all todos in the database')
  console.log();
  console.log('      each action may have optional modifiers (use -H help for examples):');
  console.log('        action[:[rate][:[actions-arg]]');
  console.log('          - rate is an action-specific rate or one or more KV pairs of "rate",');
  console.log('          "instances", "max", and "explode"');
  console.log('          - action-args are action-specific and are interpreted by the');
  console.log('          action\'s constructor');
  console.log();
  console.log('    -rn, --rate=n - number of actions per second (default 1) or "seq"')
  console.log('    -m n, --max-actions=n - stop after this many actions')
  console.log('    --ws-ip=host[:port] - todo server to connect to')
  console.log('    --delete - delete existing todos before starting')
  console.log('    -b, --bad-header - v1 or v3, sends bad header instead of good')
  console.log('    -H - help with examples');
  console.log();
  if (!argv.H) {
    process.exit(0);
  }
  console.log('examples:');
  console.log();
  console.log('./multiload --ws-ip=localhost:8088');
  console.log('  executes the add-delete action at the default rate');
  console.log();
  console.log('./multiload --ws-ip=localhost:8088 -a delay::1000');
  console.log('  executes the delay action with a 1 second delay')
  console.log();
  console.log('./multiload --ws-ip=localhost:8088 -a delay:20:1500');
  console.log('  executes 20 delays/second with each delay 1.5 seconds');
  console.log();
  console.log('./multiload --ws-ip=localhost:8088 -a delay:20:1500 -a ad:5');
  console.log('  executes 20 delays/second and 5 add-delete-pairs/second');
  console.log();
  console.log('./multiload --ws-ip=localhost:8088 -a delay:r=10,i=3:1250');
  console.log('  executes 3 instance of delays each executing 10 1.25-second delays per second');
  console.log();
  console.log('./multiload --ws-ip=localhost:8088 -a delay:r=10,i=3,e:1250');
  console.log('  the same as the previous example except each instance is on a separate line');
  console.log('  while before the 3 instances were combined into one line.');
  console.log();
  console.log('./multiload --ws-ip=localhost:8088 -a ad:seq');
  console.log('  execute the add-delete-pairs sequentially, i.e., wait for each to complete');
  console.log('  before starting the next one. this rate is determined by the round-trip time');
  console.log();
  console.log('./multiload --ws-ip=localhost:8088 -a ad:rate=seq,instances=2,explode');
  console.log('  the same as the previous example but with two instances, one per output line');
  console.log();
  console.log('./multiload --ws-ip=localhost:8088 -a chain::?target=https://google.com');
  console.log('  execute an outbound request to google.com with the default rate');
  console.log('  the chain argument can be chained, e.g.,');
  console.log('  ?http://localhost:8088/chain?target=https://google.com');
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
  const line = `? error: ${e}\n${e.stack}`;
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
const mstime = () => Date.now();

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
    // do nothing
  }).catch(e => {
    if (argv['no-config']) {
      process.stdout.write('==========================\n');
      process.stdout.write('no configuration available\n');
      process.stdout.write('==========================\n');
      return;
    }
    outputError(e);
  })
}).then(() => {
  // here for debugging output of actions
  return;
  /* eslint-disable */
  for (let i = 0; i < executableActions.length; i++) {
    console.log(executableActions[i]);
  }
  process.exit(0);
  /* eslint-enable */
}).then(() => {
  //
  // now execute the actions the user selected
  //
  for (let i = 0; i < executableActions.length; i++) {
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
    if (nActions >= a.maxActions) {
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
            a.maxActions = 0;
            return r;
          }
          outputTotals()
        })
        .catch(e => {
          outputError(e);
          a.maxActions = 0;
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
    nActions += 1;

    // this counts on tail recursion being optimized away
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
