const express = require('express');

const PORT = 3000;
const opts = {
  createStubs: true,
  liveSite: 'https://jsonplaceholder.typicode.com',
};

var app = express();
app.get('/favicon.ico', function (req, res) {});

require('./getItem').add(app, opts);

app.listen(PORT);
console.log(`App listening on port ${PORT}`);