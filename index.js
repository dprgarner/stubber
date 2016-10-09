const path = require('path');

const _ = require('lodash');
const express = require('express');
const program = require('commander');

program
  .version('0.0.1')
  .option('-s, --site <uri>', 'Generate stubs against a live site')
  .option('-p, --port <n>', 'Port number. Defaults to a random int between 58000-59999')
  .parse(process.argv);

const opts = {};
const PORT = (program.port)
  ? program.port
  : 58000 + Math.floor(2000 * Math.random());
if (program.site) opts.liveSite = program.site;

var app = express();
app.get('/favicon.ico', function (req, res) {});

const BaseStubber = require('./BaseStubber.js');

var GeneralStubber = BaseStubber.extend({
  responsesDir: path.resolve(__dirname, 'responses'),
  matchersFile: path.resolve(__dirname, 'matchers.json'),
});

var stubbers = [
  new GeneralStubber(app, opts),
]

var server = app.listen(PORT, function (err) {
  if (err) throw err;
  console.log('App listening on port ' + PORT);
});

/*
// Not yet tested...
process.on('SIGINT', function () {
  _.each(stubbers, function (stubber) {
    console.log('----');
    console.log('Requests made:');
    console.log(JSON.stringify(stubber.requestsMade, null, 2));
    console.log('----');
  });
  server.close(function () {
    process.exit(0);
  });
});
*/
