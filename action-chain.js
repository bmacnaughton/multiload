const axios = require('axios')
const Action = require('./action')

//
// class-based chain implementation
//
class ActionChain extends Action {
  constructor (host, output, options) {
    super(...arguments)
    this.host = host
    this.httpOptions = options.httpOptions
    this.output = output
    this.url = host + '/chain'
    if (options.chain) this.url += options.chain
    this.inFlight = 0
    this.count = 0
    this.sampled = 0
  }

  execute () {
    return axios.get(this.url, this.httpOptions).then(r => {
      this.collectStats(r)
      this.output(et => this.makeStatsLine(et));
    });
  }

  collectStats (r) {
    this.count += 1;
    if (this.wasSampled(r.headers)) {
      this.sampled += 1;
    }
  }

  makeStatsLine (et) {
    return [
      'n: ', this.count, '(', Action.rd(this.count / et), '/s), ',
      'sampled: ', this.sampled, '(', Action.rd(this.sampled / et), '/s) ',
      Action.rd(this.sampled / this.count * 100, 0), '%'
    ].join('');
  }
}

module.exports = ActionChain
