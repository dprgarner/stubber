const path = require('path');
const fs = require('fs');

const express = require('express');
const rp = require('request-promise');

const queryDictsMatch = require('./utils').queryDictsMatch;

var app = express();
const PORT = 3000;
const createStubs = true;
const liveSite = 'https://jsonplaceholder.typicode.com';

var itemDict = [
  {
    name: 'comments-id1',
    path: 'comments',
    query: {
      postId: '1',
    },
    file: 'comments-id1',
  },
];

function getItemStub(itemPath, query) {
  for (var i = 0; i < itemDict.length; i++) {
    if (itemPath === itemDict[i].path && queryDictsMatch(query, itemDict[i].query)) {
      var file = path.resolve('items', itemDict[i].file + '.json');
      return {name: itemDict[i].name, file: file};
    }
  }
}

app.get('/:path', function (req, res, next) {
  // Attempt to match a stub.
  console.log(req.params.path, req.query);

  var stub = getItemStub(req.params.path, req.query);
  if (stub) {
    console.log(`  Matched stub "${stub.name}"`);
    return res.sendFile(stub.file);
  }
  if (!createStubs) return res.status(500).end(
    'Request did not match any item stub.'
  );
  next();
}, function (req, res) {
  // Create a stub and return the stub.
  console.log(`  Did not match any stub - requesting ${req.url}`);
  rp(liveSite + req.url)
    .then(function (body) {
      var name = 'comments-id2';
      fs.writeFile(path.resolve('items', name + '.json'), body, function (err) {
        console.log('  Created stub ${name}');
        if (err) throw err;
        itemDict.push({
          name: name,
          path: 'comments',
          query: req.query,
          file: name,
        });
        res.end(body);
      });
    });
});

app.listen(PORT);
console.log(`App listening on port ${PORT}`);