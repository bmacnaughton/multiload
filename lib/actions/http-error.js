'use strict';

const Action = require('../action')

//
// hit the error endpoint
//
class HttpError extends Action {
  constructor (host, output, options) {
    super(...arguments);
    this.host = host;
    this.output = output;
    this.httpOptions = options.httpOptions;
    this.error = 500;
    this.errorCalls = 0

    // this option can only be a number, e.g., the command line included
    // and actions-arg, e.g., --action=error::500
    if ('arg' in options) {
      const error = +options.arg;
      this.error = error || this.error;
    }
    this.url = host + '/error/' + this.error;
  }

  execute () {
    // validateStatus returns true if an error should NOT throw.
    const validateStatus = status => status = 399 || status === this.error;
    return this.httpGet(this.url, {validateStatus})
      .catch(e => {
        this.collectStats();
        this.output((et, stats) => this.makeStatsLine(et, stats))
        return e;
      })
      .then(r => {
        this.collectStats();
        this.output((et, stats) => this.makeStatsLine(et, stats))
        return r
      })
  }

  collectStats () {
    this.errorCalls += 1
  }

  getStatsNames () {
    return ['errorCalls'];
  }

  makeStatsLine (et, stats = this.getStats()) {
    return `errors: ${stats.errorCalls}`;
  }
}

module.exports = HttpError;
