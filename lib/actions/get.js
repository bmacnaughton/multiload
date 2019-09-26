const Action = require('../action')

//
// class-based get todos implementation
//
class ActionGet extends Action {
  constructor (host, output, options) {
    super(...arguments)
    this.host = host
    this.output = output
    this.url = host + '/api/todos'
    this.httpOptions = options.httpOptions
    this.count = 0
    this.sampled = 0
  }

  execute() {
    return this.httpGet(this.url, this.httpOptions).then(r => {
      this.collectStats(r)
      this.output((et, stats) => this.makeStatsLine(et, stats))
      return r
    })
  }

  collectStats(r) {
    this.count += 1;
    if (this.wasSampled(r.headers)) {
      this.sampled += 1;
    }
  }

  getStatsNames () {
    return ['count', 'sampled'];
  }

  makeStatsLine (et, stats) {
    return [
      'gets: ', stats.count,
      ', sampled: ', stats.sampled,
      ', ', Action.rd(stats.count / et), '/sec'
    ].join('');
  }
}

module.exports = ActionGet
