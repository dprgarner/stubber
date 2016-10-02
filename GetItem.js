const path = require('path');
const fs = require('fs');

const _ = require('lodash');
const Promise = require('bluebird');
const request = require('request-promise');

const queryDictsMatch = require('./utils').queryDictsMatch;

const writeFile = Promise.promisify(fs.writeFile);
const readFile = Promise.promisify(fs.readFile);


function GetItem(app, opts) {
  this.liveSite = opts.liveSite;
  app.get('/:path', this.matchStub.bind(this), this.createStub.bind(this));
}

Object.assign(GetItem.prototype, {
  requestsFile: path.resolve('items', 'requests.json'),

  log: function(message) {
    console.log(message);
  },

  getRequestStubs: function() {
    return readFile(this.requestsFile)
      .catch(function (err) {
        if (err.code === 'ENOENT') return '[]';
        throw err;
      })
      .then(function (bodyString) {
        return JSON.parse(bodyString);
      });
  },

  saveStub: function(stub) {
    return this.getRequestStubs()
      .then(function (stubs) {
        stubs.push(stub);
        return writeFile(
          path.resolve(this.requestsFile), JSON.stringify(stubs, null, 2)
        );
      }.bind(this));
  },

  getStubName: function(query) {
    var nameComponents = ['comments'];
    nameComponents = nameComponents.concat(_.map(query, function (val, key) {
      var valString = (_.isArray(val)) ? val.join('-') : val;
      return key +  '-' + valString;
    }));
    return nameComponents.join('_');
  },

  lookupStub: function(req) {
    var itemPath = req.params.path;
    var query = req.query;
    this.log(itemPath + ', ' + JSON.stringify(query));

    return this.getRequestStubs()
      .then(function (stubs) {
        for (var i = 0; i < stubs.length; i++) {
          if (
            itemPath === stubs[i].path
            && queryDictsMatch(query, stubs[i].query)
          ) {
            var file = path.resolve('items', stubs[i].file + '.json');
            return {name: stubs[i].name, file: file};
          }
        }
      })
      .then(function (stub) {
        if (stub) {
          this.log(`  Matched stub "${stub.name}"`);
          return readFile(stub.file);
        } else {
          // TODO this isn't exceptional, shouldnt be an error
          throw new Error('Request did not match any item stub.');
        }
      }.bind(this));
  },

  // Middleware which attempts to match a stub.
  matchStub: function(req, res, next) {
    this.lookupStub(req)
      .then(function (body) {
        return res.end(body);
      })
      .catch(function (err) {
        if (this.liveSite) {
          return next();
        }
        this.log(`  Error: ${err.message}`);
        return res.status(500).end(err.message);
      }.bind(this));
  },

  // Middleware which creates the request stub, saves the response stub, and
  // returns the response.
  createStub: function(req, res) {
    var that = this;
    this.log(`  Did not match any stub - requesting ${req.url}`);
    var name = this.getStubName(req.query);

    request(this.liveSite + req.url).then(function (body) {
      return Promise.all([
        writeFile(path.resolve('items', name + '.json'), body),
        that.saveStub({
          name: name,
          path: 'comments',
          query: req.query,
          file: name,
        })
      ]).then(function () {
        that.log(`  Saved stub '${name}'`);
        res.type('json').end(body);
      });
    }).catch(function (err) {
      that.log(`  Error: ${err.message}`);
      res.status(500).end('Error: ' + err.message);
    });
  },
});

module.exports = GetItem;