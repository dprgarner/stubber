const fs = require('fs');
const path = require('path');

const _ = require('lodash');

const BaseStubber = require('../BaseStubber');
const queryDictsMatch = require('../utils').queryDictsMatch;

function GetComments(app, opts) {
  BaseStubber.call(this, app, opts);
  app.get('/:path', this.matchStub.bind(this), this.saveAndReturnStub.bind(this));
}

Object.assign(GetComments.prototype, BaseStubber.prototype, {
  directory: path.resolve(__dirname, 'comments'),
  requestsFile: path.resolve(__dirname, 'comments', 'requests.json'),

  getStubName: function(req) {
    var nameComponents = [req.params.path];
    nameComponents = nameComponents.concat(_.map(req.query, function (val, key) {
      var valString = (_.isArray(val)) ? val.join('-') : val;
      return key +  '-' + valString;
    }));
    return nameComponents.join('_');
  },

  matches: function(req, savedStub) {
    var itemPath = req.params.path;
    var query = req.query;
    return itemPath === savedStub.path && queryDictsMatch(query, savedStub.query);
  },

  createStub: function (req, name) {
    return {
      name: name,
      path: req.params.path,
      query: req.query,
    };
  },
});

module.exports = GetComments;