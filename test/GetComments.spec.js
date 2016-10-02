const fs = require('fs');
const path = require('path');

const expect = require('chai').expect;
const express = require('express');
const Promise = require('bluebird');
const request = require('request-promise');
const rmdirSync = require('rimraf').sync;

const GetComments = require('./GetComments');

const readFile = Promise.promisify(fs.readFile);
const writeFile = Promise.promisify(fs.writeFile);

const dir = path.resolve(__dirname, 'comments');
const APP_PORT = 3005;
const LIVE_PORT = 3006;
const appUri = 'http://localhost:' + APP_PORT;
const liveUri = 'http://localhost:' + LIVE_PORT;

var getRequests = [{
  name: 'comments_postId-1',
  path: 'comments',
  query: {
    postId: '1'
  },
}, {
  name: 'comments_postId-2',
  path: 'comments',
  query: {
    postId: '2'
  },
}];

var responseJson = [{
  postId: 1,
  id: 1,
  name: 'id labore ex et quam laborum',
  email: 'Eliseo@gardner.biz',
  body: 'Bello!',
}];

function listen(app, port) {
  return new Promise(function (resolve, reject) {
    var server = app.listen(port, function (err) {
      if (err) return reject(err);
      return resolve(server);
    });
  });
}

// Sets up a dummy live server that accepts gets and posts.
function setUpLiveServer() {
  var app = express();
  app.get('/comments', function (req, res) {
    res.json(responseJson);
  });
  return listen(app, LIVE_PORT);
}

function tearDownApp() {
  if (fs.existsSync(dir)) rmdirSync(dir);

  var closeApp = Promise.promisify(
    this.appServer.close.bind(this.appServer)
  );
  var closeLive = Promise.promisify(
    this.liveServer.close.bind(this.liveServer)
  );
  return Promise.all([closeApp(), closeLive()]);
}

function setUpApp(opts) {
  var app = express();
  this.getComments = new GetComments(app, opts);
  this.getComments.log = function () {};

  return listen(app, APP_PORT)
    .then(function (server) {
      this.appServer = server;
      return setUpLiveServer()
    }.bind(this))
    .then(function(server) {
      this.liveServer = server;
    }.bind(this));
}

describe('GetComments in existing-stubs mode', function () {
  beforeEach(function () {
    return setUpApp.call(this, {})
      .then(function () {
        return Promise.all([writeFile(
          path.resolve(dir, 'comments_postId-1.json'), JSON.stringify(responseJson)
        ), writeFile(
          path.resolve(dir, 'requests.json'), JSON.stringify(getRequests)
        )])
      });
  });

  afterEach(function () {
    return tearDownApp.call(this);
  });

  it('returns previously-saved stubs', function () {
    return request({
      uri: appUri + '/comments?postId=1',
      json: true,
    }).then(function (actualJson) {
      expect(responseJson).to.deep.equal(actualJson);
    });
  });

  it('errors when stub does not exist', function () {
    return request({
      uri: appUri + '/comments?postId=3',
      json: true,
    }).then(function () {
      throw new Error('Expected an error response');
    }).catch(function (err) {
      if (!err.statusCode) throw err;
      expect(err.statusCode).to.equal(500);
    });
  });

  it('records all requests made', function () {
    return request({
      uri: appUri + '/comments?postId=1',
      json: true,
    }).then(function () {
      return this.getComments.getRequestsMade();
    }.bind(this)).then(function (requestsMade) {
      expect(requestsMade).to.deep.equal({
        'comments_postId-1': true,
        'comments_postId-2': false,
      });
    });
  });
});

describe('GetComments in create-stubs mode', function () {
  beforeEach(function () {
    return setUpApp.call(this, {liveSite: liveUri});
  });

  afterEach(function () {
    return tearDownApp.call(this);
  });

  it('saves and returns unrecognised responses', function () {
    return request({
      uri: appUri + '/comments?postId=1',
      json: true,
    }).then(function (responseJson) {
      return readFile(path.resolve(dir, 'comments_postId-1.json'))
        .then(function(fileString) {
          var fileBody = JSON.parse(fileString);
          expect(fileBody).to.deep.equal(responseJson);
        });
    });
  });

  it('returns previously-saved stubs', function () {
    var alternateResponse = {different: 'response'};
    return Promise.all([writeFile(
      path.resolve(dir, 'comments_postId-1.json'), JSON.stringify(alternateResponse)
    ), writeFile(
      path.resolve(dir, 'requests.json'), JSON.stringify(getRequests)
    )]).then(function () {
      return request({
        uri: appUri + '/comments?postId=1',
        json: true,
      });
    }).then(function (actualJson) {
      expect(actualJson).to.deep.equal(alternateResponse);
    });
  });
});