const Action = require('../action')

//
// class-based get todos implementation
//
class ActionGetConfig extends Action {
  constructor (host, output, options) {
    super(...arguments)
    this.host = host
    this.output = output
    this.url = host + '/config'
    this.httpOptions = options.httpOptions
  }

  execute() {
    return this.httpGet(this.url, this.httpOptions).then(r => {
      return this.collectStats(r)
    }).then(config => {
      this.output(et => this.makeStatsLine(et, config))
      return config
    })
  }

  collectStats(r) {
    // collect the server config here
    let config = {}
    // agent must be set before calling wasSampled
    this.agent = r.data.appopticsVersion
    config.agent = this.agent

    config.bindings = r.data.bindingsVersion
    config.sampleMode = r.data.sampleMode
    config.sampleRate = r.data.sampleRate
    config.pid = r.data.pid
    config.key = r.data.serviceKey
    this.count += 1
    return config
  }

  makeStatsLine (et, config) {
    return [
      'agent: ', config.agent,
      ', bindings: ', config.bindings,
      ', mode: ', config.sampleMode,
      ', rate: ', config.sampleRate,
      '\nservice name: ', config.key.split(':')[1],
      ', pid: ', config.pid,
    ].join('')

    return [
      'total gets: ', this.count,
      ', sampled: ', this.sampled,
      ', ', Action.rd(this.count / et), '/sec'
    ].join('');
  }
}

module.exports = ActionGetConfig

