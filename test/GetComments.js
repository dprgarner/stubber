const path = require('path');

const BaseStubber = require('../BaseStubber');

function GetComments(app, opts) {
  BaseStubber.call(this, app, opts);
  app.get('/:path', this.matchStub.bind(this), this.saveAndReturnStub.bind(this));
}

Object.assign(GetComments.prototype, BaseStubber.prototype, {
  directory: path.resolve(__dirname, 'comments'),
  requestsFile: path.resolve(__dirname, 'comments', 'requests.json'),
});

module.exports = GetComments;