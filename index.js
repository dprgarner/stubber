const path = require('path');

const _ = require('lodash');
const express = require('express');
const program = require('commander');
const winston = require('winston');

program
  .version('0.0.1')
  .option('-p, --port <n>', 'Port number. Defaults to a random int between 58000-59999')
  .option('-s, --site <uri>', 'Generate stubs against a live site')
  .option('-v, --verbose')
  .parse(process.argv);

const opts = {};
const PORT = (program.port)
  ? program.port
  : 58000 + Math.floor(2000 * Math.random());
if (program.site) opts.liveSite = program.site;
winston.level = (program.verbose) ? 'info' : 'error';
winston.add(winston.transports.File, {filename: 'log', json: false, timestamp: true});

var app = express();
app.get('/favicon.ico', function (req, res) {});

const BaseStubber = require('./BaseStubber.js');

var GeneralStubber = BaseStubber.extend({
  name: 'GeneralStubber',
  responsesDir: path.resolve(__dirname, 'responses'),
  matchersFile: path.resolve(__dirname, 'matchers.json'),
});

var stubbers = [
  new GeneralStubber(app, opts),
]

var server = app.listen(PORT, function (err) {
  if (err) throw err;
  winston.info('\nStubber app listening on port ' + PORT);
  this.setTimeout(1000);
});

process.on('SIGTERM', function () {
  winston.info('Closing down Stubber server');
  _.each(stubbers, function (stubber) {
    var matchedRequestInfo = {
      stubber: stubber.name,
      matchedRequests: stubber.getMatchedRequests(),
      unmatchedRequests: stubber.getUnmatchedRequests(),
    };
    winston.info(JSON.stringify(matchedRequestInfo, null, 2));
  });
  server.close(function () {
    process.exit(0);
  });
});
