// currently unused module.

//
// the follow are to interact with the java collector - ask it to set
// configs, et al. various issues, so return before it.
//
let collector = {}
let getSettings
// BAM TODO don't get settings if not java-collector
if ('it is java-collector' && false) {
  collector = new jcu.JavaCollector('todo_java-collector_1', 8181)
} else {
  collector.getSettings = () => Promise.resolve({flags: '<unknown>'})
  collector.setMode = () => Promise.resolve(true)
}

//let jc = new jcu.JavaCollector('todo_java-collector_1', 8181);


collector.getSettings().then(settings => {
  console.log('\ncollector flags:', settings.flags)
}).then(() => {
  //
  // display the server configuration so it's documented
  // at the client end. the server side scrolls on each
  // transaction.
  //
  return axios.get(url + '/config', options).then(r => {
    console.log(r.data)
  })
}).then(() => {
  return collector.setMode('never')
}).then(() => {
  executeAction(actionOptions)
})

/*
jc.setMode('never').then(mode => {
  js.getSettings().then(settings => {
    console.log('\n', settings.flags)
  })
})
// */

/*
//
// always and never are not primitive settings.
// always = SAMPLE_START,SAMPLE_THROUGH_ALWAYS
// never = SAMPLE_BUCKET_ENABLED (START and THROUGH_ALWAYS are cleared)
//
let jcModes = {
  always: 'SAMPLE_START,SAMPLE_THROUGH_ALWAYS,SAMPLE_BUCKET_ENABLED',
  never: 'SAMPLE_BUCKET_ENABLED'
}

//
// get the java-collector's configuration to document what this
// test run was testing.
//
let p = dutils.getExposedPort('todo_java-collector_1', 8181).then(port => {
  let url = 'http://localhost:' + port + '/collectors'
  return axios.get(url, options).then(r => {
    let collectorIds = Object.keys(r.data)
    if (Object.keys(r.data).length !== 1) {
      throw new Error('There is not exactly one collector')
    }
    return collectorIds[0]
  }).then(id => {
    let url = 'http://localhost:' + port + '/collectors/' + id + '/settings'
    return axios.get(url, options).then(r => {
      let settings = r.data[0]
      return settings
    })
  })
}).then(settings => {

  console.log('\n', settings.flags)
}).then(() => {
  //
  // display the server configuration then execute the action.
  // execute the first time with no delay so there is immediate
  // visual feedback.
  //
  return axios.get(url + '/config', options).then(r => {
    console.log(r.data)
  })
}).then(() => {
  executeAction()
})
// */
