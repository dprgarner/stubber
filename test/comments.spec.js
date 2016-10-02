const fs = require('fs');
const path = require('path');

const expect = require('chai').expect;
const express = require('express');
const Promise = require('bluebird');
const request = require('request-promise');
const rmdirSync = require('rimraf').sync;

const GetComments = require('./GetComments');
const PostComments = require('./PostComments');

const readFile = Promise.promisify(fs.readFile);
const writeFile = Promise.promisify(fs.writeFile);

const dir = path.resolve(__dirname, 'comments');
const APP_PORT = 3005;
const LIVE_PORT = 3006;
const appUri = 'http://localhost:' + APP_PORT;
const liveUri = 'http://localhost:' + LIVE_PORT;

var getRequests = [{
  "name": "comments_postId-1",
  "path": "comments",
  "query": {
    "postId": "1"
  },
  "file": "comments_postId-1"
}];

var postRequests = [{
  "name": "comments_hello-world",
  "path": "comments",
  "query": {},
  "body": {
    "hello": "world",
  },
  "file": "comments_hello-world"
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

// Imitates the dummy live server.
function setUpLiveServer() {
  var app = express();
  app.get('/comments', function (req, res) {
    res.json(responseJson);
  });
  app.post('/comments', function (req, res) {
    res.json(responseJson);
  });
  return listen(app, LIVE_PORT);
}

function setUpApp(opts) {
  var app = express();
  this.getComments = new GetComments(app, opts);
  this.getComments.log = function () {};

  this.postComments = new PostComments(app, opts);
  this.postComments.log = function () {};

  return listen(app, APP_PORT)
    .then(function (server) {
      this.appServer = server;
      return setUpLiveServer()
    }.bind(this))
    .then(function(server) {
      this.liveServer = server;
    }.bind(this));
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

describe('GetComments in stub-only mode', function () {
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
      uri: appUri + '/comments?postId=2',
      json: true,
    }).then(function () {
      throw new Error("Expected an error response");
    }).catch(function (err) {
      if (!err.statusCode) throw err;
      expect(err.statusCode).to.equal(500);
    });
  });
});

describe('PostComments in stub-only mode', function () {
  beforeEach(function () {
    return setUpApp.call(this, {})
      .then(function () {
        return Promise.all([writeFile(
          path.resolve(dir, 'comments_hello-world.json'), JSON.stringify(responseJson)
        ), writeFile(
          path.resolve(dir, 'postRequests.json'), JSON.stringify(postRequests)
        )])
      });
  });

  afterEach(function () {
    return tearDownApp.call(this);
  });

  it('returns previously-saved stubs', function () {
    return request({
      uri: appUri + '/comments',
      json: true,
      method: 'POST',
      body: {
        hello: 'world',
      },
    }).then(function (actualJson) {
      expect(responseJson).to.deep.equal(actualJson);
    });
  });

  it('errors when stub does not exist', function () {
    return request({
      uri: appUri + '/comments',
      json: true,
      method: 'POST',
      body: {
        hello: 'not the world',
      },
    }).then(function () {
      throw new Error("Expected an error response");
    }).catch(function (err) {
      if (!err.statusCode) throw err;
      expect(err.statusCode).to.equal(500);
    });
  });
});

describe('GetComments in Live mode', function () {
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

describe('PostComments in Live mode', function () {
  beforeEach(function () {
    return setUpApp.call(this, {liveSite: liveUri});
  });

  afterEach(function () {
    return tearDownApp.call(this);
  });

  it('saves and returns unrecognised responses', function () {
    return request({
      uri: appUri + '/comments',
      json: true,
      method: 'POST',
      body: {
        hello: 'world',
      },
    }).then(function (responseJson) {
      return readFile(path.resolve(dir, 'comments_hello-world.json'))
        .then(function(fileString) {
          var fileBody = JSON.parse(fileString);
          expect(fileBody).to.deep.equal(responseJson);
        });
    });
  });

  it('returns previously-saved stubs', function () {
    var alternateResponse = {different: 'response'};
    return Promise.all([writeFile(
      path.resolve(dir, 'comments_hello-world.json'), JSON.stringify(alternateResponse)
    ), writeFile(
      path.resolve(dir, 'postRequests.json'), JSON.stringify(postRequests)
    )]).then(function () {
      return request({
        uri: appUri + '/comments',
        json: true,
        method: 'POST',
        body: {
          hello: 'world',
        },
      });
    }).then(function (actualJson) {
      expect(actualJson).to.deep.equal(alternateResponse);
    });
  });
});