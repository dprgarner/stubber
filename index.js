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

const GetComments = require('./test/GetComments');
const PostComments = require('./test/PostComments');

var stubbers = [
  new GetComments(app, opts),
  new PostComments(app, opts),
];

var server = app.listen(PORT, function (err) {
  if (err) throw err;
  console.log(`App listening on port ${PORT}`);
});

// Not yet tested...
process.on('SIGINT', function () {
  console.log('Exit signal caught');
  Promise.all(_.map(stubbers, function (stubber) {
    return stubber.getRequestsMade()
      .then(function(requestsMade) {
        console.log('----');
        console.log(`Requests made of ${stubber.name}:`);
        console.log(JSON.stringify(requestsMade, null, 2));
        console.log('----');
      });
  })).then(function () {
    server.close(function () {
      process.exit(0);
    });
  });
});
