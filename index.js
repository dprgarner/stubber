const express = require('express');
const GetItem = require('./GetItem');

const PORT = 3000;
const opts = {
  liveSite: 'https://jsonplaceholder.typicode.com',
};

var app = express();
app.get('/favicon.ico', function (req, res) {});

new GetItem(app, opts);

app.listen(PORT);
console.log(`App listening on port ${PORT}`);