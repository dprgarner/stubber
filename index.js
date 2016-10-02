const express = require('express');

const GetComments = require('./test/GetComments');
const PostComments = require('./test/PostComments');

const PORT = 3000;
const opts = {
  liveSite: 'https://jsonplaceholder.typicode.com',
};

var app = express();
app.get('/favicon.ico', function (req, res) {});

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