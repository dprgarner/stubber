const express = require('express');

const GetComments = require('./GetComments');

const PORT = 3000;
const opts = {
  liveSite: 'https://jsonplaceholder.typicode.com',
};

var app = express();
app.get('/favicon.ico', function (req, res) {});

new GetComments(app, opts);

app.listen(PORT);
console.log(`App listening on port ${PORT}`);