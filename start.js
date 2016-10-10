const fs = require('fs');
const path = require('path');

const _ = require('lodash');
const express = require('express');
const program = require('commander');
const winston = require('winston');

var port;
program
  .version('0.0.1')
  .option('-s, --site <uri>', 'Generate stubs against a live site')
  .option('-v, --verbose')
  .arguments('<port>')
  .action(function (inputPort) {
    port = inputPort;
  });
program.parse(process.argv);

if (!port) program.help();

const opts = {};
if (program.site) opts.liveSite = program.site;
winston.level = (program.verbose) ? 'debug' : 'info';
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

var server = app.listen(port, function (err) {
  if (err) throw err;
  winston.info('Stubber app listening on port ' + port);
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
