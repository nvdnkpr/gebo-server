var nock = require('nock'),
    config = require('../../config/config'),
    nconf = require('nconf'),
    mongo = require('mongodb'),
    http = require('http'),
    utils = require('../../lib/utils'),
    base64url = require('base64url'),
    crypto = require('crypto'),
    fs = require('fs'),
    geboSchema = require('../../schemata/gebo'),
    agentSchema = require('../../schemata/agent');

// Foreign agent configurations
var CLIENT_ID = 'abc123',
    REDIRECT_URI = 'http://myhost.com',
    BASE_ADDRESS = 'theirhost.com',
    AUTHORIZATION_ENDPOINT = '/authorize',
    VERIFICATION_ENDPOINT = '/verify',
    REQUEST_ENDPOINT = '/request',
    PROPOSE_ENDPOINT = '/propose',
    INFORM_ENDPOINT = '/inform',
    ACCESS_TOKEN = '1234';

// Agent configs
var TEST_AGENT_EMAIL = 'test@testes.com';

var JWT_RESPONSE = {
        access_token: ACCESS_TOKEN, 
        token_type: 'Bearer',
        expires_in: 3600
    };

// Start up the test database
nconf.argv().env().file({ file: 'local.json' });
var Token = require('../../config/token');//(nconf.get('testDb'));

var geboDb = new geboSchema(nconf.get('testDb'));

/**
 * Load a friend's token verification parameters
 * from the database
 */
exports.getFriend = {
    setUp: function (callback) {
        try {
            /**
             * Setup a registrant
             */
            var registrant = new geboDb.registrantModel({
                    name: 'Dan',
                    email: 'dan@example.com',
                    password: 'password123',
                    admin: false,
                    _id: new mongo.ObjectID('0123456789AB')
                });
            
            /**
             * Make a friend for the registrant
             */
            var agentDb = new agentSchema('dan@example.com');
            var friend = new agentDb.friendModel({
                    name: 'John',
                    email: 'john@painter.com',
                    gebo: BASE_ADDRESS,
                });

            /**
             * Create access permissions for imaginary collection
             */
            friend.hisPermissions.push({ email: 'someapp@example.com' });

            registrant.save(function(err) {
                if (err) {
                  console.log(err);
                }
                friend.save(function(err) {
                    agentDb.connection.db.close();
                    if (err) {
                      console.log(err);
                    }
                    callback();
                  });
              });
        }
        catch(err) {
            console.log(err);
            callback();
        }
    },

    tearDown: function (callback) {
        geboDb.connection.db.dropDatabase(function(err) {
            if (err) {
              console.log(err)
            }
            var agentDb = new agentSchema('dan@example.com');
            agentDb.connection.on('open', function(err) {
                agentDb.connection.db.dropDatabase(function(err) {
                    agentDb.connection.db.close();
                    if (err) {
                      console.log(err)
                    }
                    callback();
                  });
              });
          });
    }, 

    'Don\'t barf if the requested friend doesn\'t exist': function(test) {
        test.expect(1);

        var token = new Token('dan@example.com');
        token.getFriend('nosuchguy@friend.com').
            then(function(friend) {
                test.ok(false, 'Shouldn\'t get here');
                test.done();
              }).
            catch(function(err) {
                test.equal(err, 'You are not friends with nosuchguy@friend.com');
                test.done();
              });
    },

    'Return an existing friend object': function(test) {
        test.expect(6);

        var token = new Token('dan@example.com');
        token.getFriend('john@painter.com').
            then(function(friend) {
                test.equal(friend.name, 'John');
                test.equal(friend.email, 'john@painter.com');
                test.equal(friend.gebo, BASE_ADDRESS);
                test.equal(friend.request, REQUEST_ENDPOINT);
                test.equal(friend.propose, PROPOSE_ENDPOINT);
                test.equal(friend.inform, INFORM_ENDPOINT);
                test.done();
              }).
            catch(function(err) {
                test.ok(false, err);      
                test.done();
              });
    },
}

/**
 * getKey
 */
exports.getKey = {
    setUp: function (callback) {
        try {
            /**
             * Setup a registrant
             */
            var registrant = new geboDb.registrantModel({
                    name: 'Dan',
                    email: 'dan@example.com',
                    password: 'password123',
                    admin: false,
                    _id: new mongo.ObjectID('0123456789AB')
                });
            
            /**
             * Make a key 
             */
            var agentDb = new agentSchema('dan@example.com');
            var key = new agentDb.keyModel({
                    public: 'some public certificate',
                    private: 'some private key',
                    email: 'john@painter.com',
                });

            registrant.save(function(err) {
                if (err) {
                  console.log(err);
                }
                key.save(function(err) {
                    agentDb.connection.db.close();
                    if (err) {
                      console.log(err);
                    }
                    callback();
                  });
              });
        }
        catch(err) {
            console.log(err);
            callback();
        }
    },

    tearDown: function (callback) {
        geboDb.connection.db.dropDatabase(function(err) {
            if (err) {
              console.log(err)
            }
            var agentDb = new agentSchema('dan@example.com');
            agentDb.connection.on('open', function(err) {
                agentDb.connection.db.dropDatabase(function(err) {
                    agentDb.connection.db.close();
                    if (err) {
                      console.log(err)
                    }
                    callback();
                  });
              });
          });
    }, 

    'Don\'t barf if the requested key doesn\'t exist': function(test) {
        test.expect(1);

        var token = new Token('dan@example.com');
        token.getKey('nosuchguy@friend.com').
            then(function(friend) {
                test.ok(false, 'Shouldn\'t get here');
                test.done();
              }).
            catch(function(err) {
                test.equal(err, 'You have not created a key for nosuchguy@friend.com');
                test.done();
              });
    },

    'Return an existing private key': function(test) {
        test.expect(1);

        var token = new Token('dan@example.com');
        token.getKey('john@painter.com').
            then(function(privateKey) {
                test.equal(privateKey, 'some private key');
                test.done();
              }).
            catch(function(err) {
                test.ok(false, err);      
                test.done();
              });
    },
}
/**
 * get
 */
//exports.get = {
//    setUp: function (callback) {
//        try {
//            /**
//             * Set up the gebo registrant
//             */
//            var geboRegistrant = new geboDb.registrantModel({
//                    name: 'gebo-server',
//                    email: nconf.get('testDb'),
//                    password: 'password123',
//                    admin: true,
//                    _id: new mongo.ObjectID('0123456789AB')
//                });
//
//            /**
//             * Make a friend for the gebo registrant
//             */
//            var friend = new geboDb.friendModel({
//                    name: 'John',
//                    email: 'john@painter.com',
//                    gebo: BASE_ADDRESS,
//                });
//            
//            var otherFriend = new geboDb.friendModel({
//                    name: 'Richard',
//                    email: 'richard@construction.com',
//                    gebo: BASE_ADDRESS + ':3443',
//                });
//
//
//            /**
//             * Setup a regular (non-administrative) registrant
//             */
//            var registrant = new geboDb.registrantModel({
//                    name: 'dan',
//                    email: 'dan@hg.com',
//                    password: 'password123',
//                    admin: false,
//                    _id: new mongo.ObjectID('123456789ABC')
//                });
//            
//            geboRegistrant.save(function(err) {
//                if (err) {
//                  console.log(err);
//                }
//                registrant.save(function(err) {
//                    if (err) {
//                      console.log(err);
//                    }
//                    otherFriend.save(function(err) {
//                        if (err) {
//                          console.log(err);
//                        }
//                        friend.save(function(err) {
//                            if (err) {
//                              console.log(err);
//                            }
//                            callback();
//                          });
//                      });
//                  });
//              });
//        }
//        catch(err) {
//            console.log(err);
//            callback();
//        }
//    },
//
//    tearDown: function (callback) {
//        geboDb.connection.db.dropDatabase(function(err) {
//            if (err) {
//              console.log(err)
//            }
//            callback();
//          });
//    },
//
//    'Get a token from the server agent': function(test) {
//        test.expect(3);
//        var scope = nock('https://' + BASE_ADDRESS).
//                post(AUTHORIZATION_ENDPOINT).
//                reply(200, JWT_RESPONSE);  
//
//        token.get('john@painter.com', 'read write some@resource.com', 'dan@hg.com').
//                then(function(t) {
//                    scope.done();
//                    test.equal(t.access_token, JWT_RESPONSE.access_token);
//                    test.equal(t.token_type, JWT_RESPONSE.token_type);
//                    test.equal(t.expires_in, JWT_RESPONSE.expires_in);
//                    test.done();
//                  }).
//                catch(function(err) {
//                    console.log('err');
//                    console.log(err);
//                    test.ok(false, err);
//                    test.done();
//                  });
//    },
//
//    'Get a token from the server agent with port specified': function(test) {
//        test.expect(3);
//        var scope = nock('https://' + BASE_ADDRESS + ':3443').
//                post(AUTHORIZATION_ENDPOINT).
//                reply(200, JWT_RESPONSE);  
//
//        token.get('richard@construction.com', 'read write some@resource.com', 'dan@hg.com').
//                then(function(t) {
//                    scope.done();
//                    test.equal(t.access_token, JWT_RESPONSE.access_token);
//                    test.equal(t.token_type, JWT_RESPONSE.token_type);
//                    test.equal(t.expires_in, JWT_RESPONSE.expires_in);
//                    test.done();
//                  }).
//                catch(function(err) {
//                    console.log('err');
//                    console.log(err);
//                    test.ok(false, err);      
//                    test.done();
//                  });
//    },
//};
//
//
///**
// * makeJwt
// */
//exports.makeJwt = {
//
//    'Return an encoded claim set': function(test) {
//        test.expect(1);
//        var header = { alg: 'RS256', typ: 'JWT' };
//        var claim = { iss: '761326798069-r5mljlln1rd4lrbhg75efgigp36m78j5@developer.gserviceaccount.com',
//                      scope: 'https://www.googleapis.com/auth/devstorage.readonly',
//                      aud: 'https://accounts.google.com/o/oauth2/token',
//                      exp: 1328554385,
//                      iat: 1328550785 };
//
//        var headerEncoded = base64url(JSON.stringify(header)),
//            claimEncoded = base64url(JSON.stringify(claim));
//
//        // Sign the request
//        var pem = fs.readFileSync(__dirname + '/../../cert/key.pem');
//        var key = pem.toString('ascii');
//
//        var sign = crypto.createSign('sha256WithRSAEncryption');
//        sign.update(headerEncoded + '.' + claimEncoded);
//        var signature = sign.sign(key);
//        var signatureEncoded = base64url(signature);
//
//        var jwt = token.makeJwt(header, claim);
//
//        test.equal(jwt, headerEncoded + '.' + claimEncoded + '.' + signatureEncoded);
//
//        test.done();
//    },
//
//};
