'use strict'

const fs = require('fs')

//
// this module exists primarily to fill in ao for each of the request types
// in requests/
//
// it has some side benefits - lazy loading, returns undefined instead of
// throwing (if the file wasn't deleted after initialization), only requires
// one require in the callers code, but mostly let me play with proxying an
// arbitrary class while maintaining a proper inheritance chain.
//
module.exports = function () {
  const o = {}
  const classToFileMap = {}

  fs.readdirSync(`${__dirname}/actions`).forEach(r => {
    const filename = r.slice(0, -'.js'.length);
    const classname = pascalCase(filename);
    classToFileMap[classname] = filename;
    o[classname] = undefined;
  });

  return new Proxy(o, {
    get (target, prop) {
      // is it a valid request
      if (!(prop in classToFileMap)) {
        return undefined;
      }
      // has it already been loaded?
      if (target[prop]) {
        return target[prop];
      }

      // not loaded, load it
      const action = require(`./actions/${classToFileMap[prop]}`);

      // assign this using a dynamic property name so the class
      // picks up the name of the prop.
      const obj = {
        [prop]: class extends action {
          constructor (...args) {
            super(...args);
          }
        }
      }

      return target[prop] = obj[prop];
    }
  })
}

function pascalCase (s) {
  return (' ' + s).toLowerCase().replace(/[^a-zA-Z0-9]+(.)/g, function (match, chr) {
    return chr.toUpperCase();
  });
}

