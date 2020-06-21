'use strict';


const minimist = require('minimist')

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
  name: 'delete',
  description: 'use this to delete all messages to start with',
}, {
  name: 'no-config',
  description: 'do not attempt to read the server configuration when starting',
  default: undefined,
}, {
  name: 'service-key',
  alias: 'k',
  description: 'supply this for multiload to create an annotation',
  default: '',
}, {
  name: 'annotation-server',
  alias: 'S',
  description: 'annotation server to send if not default',
  default: '',
}, {
  name: 'annotation-opts',
  alias: '-A',
  description: '[title=actions+rate][:stream=multiload[:description]]',
  default: '::',
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

module.exports = {argv};

//
// simple tester
//
if (!module.parent) {
  /* eslint-disable no-console */
  console.log(process.argv.slice(2));
  console.log(argv)
}
