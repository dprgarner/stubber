const expect = require('chai').expect;
const getItem = require('../getItem');

describe('getItem', function () {
  describe('getName', function () {
    var getName = getItem.getName;

    it('appends each arg', function () {
      expect(getName({
        postId: '1',
      })).to.equal('comments_postId-1');
    });

    it('concatenates arrays', function () {
      expect(getName({
        postId: '1',
        fq: ['a', 'b'],
      })).to.equal('comments_postId-1_fq-a-b');
    });
  });
})
