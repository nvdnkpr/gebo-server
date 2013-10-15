var config = require('../../config/config'),
    nconf = require('nconf'),
    mongo = require('mongodb'),
    dbSchema = require('../../config/dbschema');

var COL_NAME = 'appCollection',
    ADMIN_TOKEN = '1234',
    USER_TOKEN = '5678';

var TEST_DB = nconf.argv().env().file({ file: 'local.json' }).get('testDb');
var user = require('../../routes/user')(TEST_DB);

/**
 * register
 */
//exports.register = {
//
//    setUp: function(callback) {
//    	try{
//            this.db = new dbSchema(TEST_DB);
//            
//            // Theoretically, the DB won't exist until
//            // we write something to it
//            var agent = new this.db.agentModel(
//                            { name: 'dan', email: 'dan@hg.com',
//                              password: 'password123', admin: true,  
//                              _id: new mongo.ObjectID('0123456789AB') });
//            agent.save(function(err) {
//                    if (err) {
//                      console.log(err);
//                    }
//                    callback();
//                  });
//     	}
//        catch(e) {
//            console.dir(e);
//            callback();
//    	}
//    }, 
//
//    tearDown: function(callback) {
//        console.log('tearDown');
//        this.db.mongoose.db.dropDatabase(function(err) {
//            if (err) {
//              console.log(err)
//            }
//            callback();
//          });
//    }, 
//
//    'Add a new agent to the database': function(test) {
//        test.expect(1);
//        this.db.agentModel.find({}, function(err, agents) {
//                if (err) {
//                  test.ok(false, err);
//                  test.done();
//                }
//                console.log(agents);
//                test.equal(agents.length, 1); 
//
//                var newAgent = {
//                        name: 'yanfen',
//                        email: 'yanfen@hg.com',
//                        password: 'password456',
//                        admin: false,
//                        _id: new mongo.ObjectID('123456789ABC')
//                    };
//                user.register(newAgent).
//                    then(function(ack) {  
//                        console.log('callback');
//                        test.done();
//                      });
//          });
//    },
//};
