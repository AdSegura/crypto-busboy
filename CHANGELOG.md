# v2.0.2
* refactor PassThrough
* Disable TimeOut detector `options.timeOut: 0` 
* Raised timeOut default to 15sg
# v2.0.1
* stream.finished to ensure `error handling scenarios where a stream is destroyed prematurely (like an aborted HTTP request), and will not emit 'end' or 'finish'.`
# v2.0.0
* lodash cloneDeep nested objects
* http remote destination streams
# v1.0.5
* destroy streams
# v1.0.4
* stable release
