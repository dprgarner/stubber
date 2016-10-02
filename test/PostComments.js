const fs = require('fs');
const path = require('path');

const equal = require('deep-equal')
const _ = require('lodash');
const jsonParser = require('body-parser').json()

const BaseStubber = require('../BaseStubber');
const queryDictsMatch = require('../utils').queryDictsMatch;

function PostComments(app, opts) {
  if (!fs.existsSync(this.directory)) fs.mkdirSync(this.directory);
  this.liveSite = opts.liveSite;
  app.post(
    '/:path',
    jsonParser,
    this.matchStub.bind(this),
    this.saveAndReturnStub.bind(this)
  );
}

Object.assign(PostComments.prototype, BaseStubber.prototype, {
  directory: path.resolve(__dirname, 'comments'),
  requestsFile: path.resolve(__dirname, 'comments', 'postRequests.json'),

  getStubName: function(req) {
    var nameComponents = [req.params.path];
    nameComponents = nameComponents.concat(_.map(req.query, function (val, key) {
      var valString = (_.isArray(val)) ? val.join('-') : val;
      return key +  '-' + valString;
    }));
    nameComponents = nameComponents.concat(_.map(req.body, function (val, key) {
      var valString = (_.isArray(val)) ? val.join('-') : val;
      return key +  '-' + valString;
    }));
    return nameComponents.join('_');
  },

  matches: function(req, savedStub) {
    var itemPath = req.params.path;
    var query = req.query;
    var body = req.body;
    return (
      itemPath === savedStub.path
      && queryDictsMatch(query, savedStub.query)
      && equal(body, savedStub.body)
    );
  },

  createStub: function (req, name) {
    return {
      name: name,
      path: req.params.path,
      query: req.query,
      body: req.body,
    };
  },
});

module.exports = PostComments;