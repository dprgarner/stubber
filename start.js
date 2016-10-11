const fs = require('fs');
const path = require('path');

const _ = require('lodash');
const express = require('express');
const program = require('commander');
const winston = require('winston');

const displayReadme = require('./utils').displayReadme;

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
winston.add(winston.transports.File, {
  filename: 'log',
  json: false,
  timestamp: true,
  level: 'debug',
});

function closeDown() {
  var matchedNumber = 0;
  var unmatchedNumber = 0;
  winston.info('Closing down Stubber server');
  _.each(stubbers, function (stubber) {
    var matchedRequestInfo = {
      stubber: stubber.name,
      matchedRequests: stubber.getMatchedRequests(),
      unmatchedRequests: stubber.getUnmatchedRequests(),
    };
    winston.debug(JSON.stringify(matchedRequestInfo, null, 2));
    matchedNumber += matchedRequestInfo.matchedRequests.length;
    unmatchedNumber += matchedRequestInfo.unmatchedRequests.length;
  });
  winston.info(matchedNumber + ' matched requests');
  winston.info(unmatchedNumber + ' unmatched requests');

  server.close(function () {
    setTimeout(function () {
      process.exit(0);
    }, 10)
  });
}

process.on('SIGINT', closeDown);
process.on('SIGTERM', closeDown);

var app = express();
app.get('/favicon.ico', function (req, res) {});
app.get('/theme.css', function (req, res) {
    res.sendFile(path.resolve(
        'node_modules', 'github-markdown-css', 'github-markdown.css'
    ));
});
app.get('/', function (req, res) {
    winston.debug('Displaying readme');
    displayReadme(res);
});

var stubberDirectory = fs.readdirSync(path.resolve(__dirname, 'stubbers'));
var stubberClasses = _.filter(_.map(stubberDirectory, function (file) {
  if (file[0] !== '.' && file[0] !== '_') return require('./stubbers/' + file);
}));
var stubbers = _.map(stubberClasses, function (Stubber) {
  return new Stubber(app, opts);
});
const BaseStubber = require('./stubbers/_Base');
const MiscStubber = BaseStubber.extend({name: 'Misc'});
stubbers.push(new MiscStubber(app, opts));

var server = app.listen(port, function (err) {
  if (err) throw err;
  winston.info('Stubber app listening on port ' + port);
  if (program.site) {
    winston.info('Forwarding unmatched requests to ' + program.site);
  }
  this.setTimeout(1000);
});
