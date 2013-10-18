var config = require('../../config/config'),
    utils = require('../../lib/utils'),
    DatabaseCleaner = require('database-cleaner'),
    databaseCleaner = new DatabaseCleaner('mongodb'),
    mongo = require('mongodb'),
    nconf = require('nconf'),
    q = require('q');

var cname = 'unitTest';

var verifiedAdmin = {
	dbName: utils.getMongoDbName('dan@hg.com'),
        collectionName: cname,
	admin: true,
    };

var verifiedUser = {
	dbName: utils.getMongoDbName('yanfen@hg.com'),
        collectionName: cname,
	admin: false,
    };

// Start up the test database
nconf.argv().env().file({ file: 'local.json' });
var TEST_DB = utils.getMongoDbName(nconf.get('testDb'));

var gebo = require('../../schemata/gebo')(TEST_DB),
    action = require('../../config/action')(TEST_DB);

/**
 * testConnection
 */
exports.testConnection = {

    setUp: function (callback) {
    	try{
            var server = new mongo.Server(config.mongo.host,
                                          config.mongo.port,
                                          config.mongo.serverOptions);
            this.db = new mongo.Db(config.mongo.db, server, config.mongo.clientOptions);
            this.db.open(function (err, client) {
                if (err) {
                  throw err;
                }
        	this.collection = new mongo.Collection(client, cname);
    	    	this.collection.remove({}, function(err) {
    		    callback();
    		});
             });
    	} catch(e) {
            console.dir(e);
    	}
    },
    
    tearDown: function (callback) {
        this.db.close();
        callback();
    },
    

    'Connect to Mongo': function (test) {
        test.expect(2);
        collection.insert({ foo: 'bar' }, function(err,docs) {
            if (err) {
              test.ok(false, err);
            }
            test.ok(true, 'Inserted doc with no err.');
            collection.count(function(err, count) {
                test.equal(1, count, 'There is only one doc in the collection');
                test.done();
            });
        });
    },
};

/**
 * Get the app's collection
 */
exports.getCollection = {

   setUp: function (callback) {
    	try{
            var server = new mongo.Server(config.mongo.host,
                                          config.mongo.port,
                                          config.mongo.serverOptions);
            this.db = new mongo.Db('dan_at_email_dot_com',
                            server, config.mongo.clientOptions);
            this.db.open(function (err, client) {
                if (err) {
                  throw err;
                }
        	this.collection = new mongo.Collection(client, cname);
                this.collection.insert({
                        _id: new mongo.ObjectID('0123456789AB'), 
                        name: 'dan',
                        occupation: 'Batman'
                    }, function() {
                        callback();
                    });
            });
    	} catch(e) {
            console.dir(e);
    	}
    },
    
    tearDown: function (callback) {
        // Lose the database for next time
        this.db.dropDatabase(function(err) { 
            callback();
        });
    },

    'Return a mongo collection object': function (test) {
        test.expect(2);
        action.getCollection(
                        utils.getMongoDbName('dan@email.com'),
                        utils.getMongoCollectionName(cname)).
                then(function(collection) {
                    test.ok(true);    
                    collection.save({ greeting: 'Hello' },
                            { upsert: true, safe: true },
                            function(err, ack) {
                                if (err) {
                                  test.ok(false, err);
                                  test.done();
                                }
                                test.ok(true, ack);
                                test.done();
                            });
                }).
                catch(function(err) {
                    test.ok(false, err);
                    test.done();
                });
    }, 
};

/**
 * Save to the database
 */
exports.save = {

    setUp: function (callback) {
    	try{
            var server = new mongo.Server(config.mongo.host,
                                          config.mongo.port,
                                          config.mongo.serverOptions);
            this.db = new mongo.Db('yanfen_at_hg_dot_com',
                            server, config.mongo.clientOptions);
            this.db.open(function (err, client) {
                if (err) {
                  throw err;
                }
        	this.collection = new mongo.Collection(client, cname);
                this.collection.insert({
                        _id: new mongo.ObjectID('0123456789AB'), 
                        name: 'dan',
                        occupation: 'Batman'
                    }, function() {
                        callback();
                    });
            });
    	} catch(e) {
            console.dir(e);
    	}
    },
    
    tearDown: function (callback) {
        // Lose the database for next time
        this.db.dropDatabase(function(err) { 
            callback();
        });
    },
 
   'Do not save to a non-existent database': function (test) {
        test.expect(1);
        
        action.save({ dbName: 'no_one_at_not_here_dot_com',
  		      collectionName: cname,
		      admin: true },
                    { data: 'junk' }).
                then(function(docs) {
                        console.log(docs);       
                        test.ok(false, 'This database shouldn\'t exist. Delete manually');
                        test.done();
                    }).
                catch(function(err) {
                        test.ok(err);
                        test.done();
                    }).done();
   }, 

   'Save to existing database': function (test) {
        test.expect(3);

        action.save(verifiedUser, { data: { junk: 'I like to move it move it' } }).
                then(function(docs) {
                        test.ok(docs);
			// If it's already saved, it doesn't return
			// the mongo ID
                        test.equal(docs.junk, 'I like to move it move it');
                        test.ok(docs._id);
                        test.done();
                    }).
                catch(function(err) {
                        console.log('Error???? ' + err);       
                        test.ifError(err);
                        test.done();
                    });
   }, 

   'Update existing document': function(test) {
        test.expect(8);

        // Retrieve the existing document
        action.cp(verifiedUser, { id: '0123456789AB' }).
            then(function(docs) {
                    test.ok(docs, 'Docs successfully copied');
                    test.equal(docs.name, 'dan');
                    test.equal(docs.occupation, 'Batman');
                    docs.occupation = 'AI Practitioner';
                    return action.save(verifiedUser, { data: docs });
                }).
            then(function(ack) {
                    test.ok(ack, 'Doc successfully saved');
		    test.equal(ack, '1');
                    return action.cp(verifiedUser, { id: '0123456789AB' });
                }).
            then(function(docs) {
                    test.ok(docs, 'Retrieved the saved doc again');
                    test.equal(docs.name, 'dan');
                    test.equal(docs.occupation, 'AI Practitioner');
                    test.done();
                }).
            catch(function(err) {
                    console.log(err);
                    test.ifError(err);        
                    test.done();
                });
    }
};

/**
 * Retrieve document from the database
 */
exports.dbExists = {

    setUp: function (callback) {
    	try{
            var server = new mongo.Server(config.mongo.host,
                                          config.mongo.port,
                                          config.mongo.serverOptions);
            this.db = new mongo.Db('existing_database', server, config.mongo.clientOptions);
            this.db.open(function (err, client) {
                if (err) {
                  throw err;
                }
        	this.collection = new mongo.Collection(client, cname);
                this.collection.insert({ name: 'dan', occupation: 'Batman' }, function() {
                    callback();
                });
            });
    	} catch(e) {
            console.dir(e);
    	}
    },
    
    tearDown: function (callback) {
        // Lose the database for next time
        this.db.dropDatabase(function(err) { 
            callback();
        });
    },
 
   'Return an error if the database does not exist': function (test) {
        test.expect(1);

        action.dbExists('non_existent_database').
                        then(function() {
                                // Shouldn't get here
                                console.log('Shouldn\'t get here!!!');
                                test.ok(false, 'Shouldn\'t get here!!!');
                                test.done();
                            }).
                        catch(function(err) {
                                test.ok(err, 'An error should be thrown');
                                test.done();
                            });
   }, 

   'Return a promise if the database does exist': function (test) {
        test.expect(1);

        action.dbExists('existing_database').
                then(function() {
                        test.ok(true, 'Verified the database exists');
                        test.done();
                    }).
                catch(function(err) {
                        // Shouldn't get here
                        test.ok(false, 'Shouldn\'t get here!!!');
                        test.done();
                     });
   }, 
};

/**
 * Copy document from the database
 */
exports.cp = {

    setUp: function (callback) {
    	try{
            var server = new mongo.Server(config.mongo.host,
                                          config.mongo.port,
                                          config.mongo.serverOptions);
            this.db = new mongo.Db('yanfen_at_hg_dot_com', server,
			    config.mongo.clientOptions);
            this.db.open(function (err, client) {
                if (err) {
                  throw err;
                }
        	this.collection = new mongo.Collection(client, cname);
                this.collection.insert({
                        _id: new mongo.ObjectID('0123456789AB'),
                        name: 'dan',
                        occupation: 'Batman'
                    },
                    function() {
                        callback();
                    });
            });
    	} catch(e) {
            console.dir(e);
    	}
    },
    
    tearDown: function (callback) {
        // Lose the database for next time
        this.db.dropDatabase(function(err) { 
            callback();
        });
    },
 
   'Do not copy from non-existent database': function (test) {
        test.expect(1);
        action.cp({ dbName: 'no_one_at_not_here_dot_com',
		    collectionName: cname,
		    admin: true },
		  { id: '0123456789AB' }).
             then(function() {
                    // Shouldn't get here
                    test.ok(false, 'Shouldn\'t get here!!!');
                    test.done();
                }).
            catch(function(err) {
                    test.ok(err, 'An error should be thrown');
                    test.done();
                });
   }, 

   'Copy from existing database': function (test) {
        test.expect(3);
        action.cp(verifiedUser, { id: '0123456789AB' }).
             then(function(docs) {
                    test.ok(docs, 'Document copied');
                    test.equal(docs.name, 'dan');
                    test.equal(docs.occupation, 'Batman');
                    test.done();
                }).
            catch(function(err) {
		    // Shouldn't get here
                    console.log('Shouldn\'t get here!!!');
                    test.ok(false, 'Shouldn\'t get here!!!');
                    test.done();
                 });
 
   }, 

};

/**
 * Delete a document from the profile 
 */
exports.rm = {

    setUp: function (callback) {
    	try{
            var server = new mongo.Server(config.mongo.host,
                                          config.mongo.port,
                                          config.mongo.serverOptions);
            this.db = new mongo.Db('yanfen_at_hg_dot_com',
			    server, config.mongo.clientOptions);
            this.db.open(function (err, client) {
                if (err) {
                  throw err;
                }
        	this.collection = new mongo.Collection(client, cname);
                this.collection.insert([
                        {
                            _id: new mongo.ObjectID('0123456789AB'),
                            name: 'dan',
                            occupation: 'Batman'
                        },
                        {
                            _id: new mongo.ObjectID('123456789ABC'),
                            name: 'yanfen',
                            occupation: 'Being cool'
                        }
                    ],
                    function() {
                        callback();
                    });
            });
    	} catch(e) {
            console.dir(e);
    	}
    },
    
    tearDown: function (callback) {
        // Lose the database for next time
        this.db.dropDatabase(function(err) { 
            callback();
        });
    },

   'Do not delete from a non-existent database': function (test) {
        test.expect(1);

        // Retrieve the existing document
        action.rm({ dbName: 'no_one_at_not_here_dot_com',
		    collectionName: cname,
		    admin: true },
                  { id: '0123456789AB' }).
             then(function() {
                    // Shouldn't get here
                    test.ok(false, 'Shouldn\'t get here!!!');
                    test.done();
                }).
            catch(
                function(err) {
                    test.ok(err, 'This should throw an error');        
                    test.done();
                });
   }, 

   'Do not delete from a non-existent collection': function (test) {
        test.expect(1);

        // Retrieve the existing document
        action.rm({ dbName: 'existing_database',
		    collectionName: 'NoSuchCollection',
		    admin: true },
                  { id: '0123456789AB' }).
            then(
                function() {
                    // Shouldn't get here
                    test.ok(false, 'Shouldn\'t get here!!!');
                    test.done();
                }).
            catch(
                function(err) {
                    test.ok(err, 'This should throw an error');        
                    test.done();
                });
   }, 


   'Do not delete non-existent document': function (test) {
        test.expect(1);

        action.rm({ dbName: 'existing_database',
		    collectionName: cname,
		    admin: true },
                  { id: 'NoSuchDocABC' }).
            then(
                function() {
                    // Shouldn't get here
                    test.ok(false, 'Shouldn\'t get here!!!');
                    test.done();
                }).
            catch(
                function(err) {
                    test.ok(err, 'This should throw an error');        
                    test.done();
                });
   }, 

   'Delete from an existing database': function (test) {
        test.expect(3);

        collection.count(function(err, count) {
            test.equal(count, 2);
        });

        action.rm(verifiedUser, { id: '123456789ABC' }).
            then(function() {
                    test.ok(true, 'The doc has been deleted, I think');
                    collection.count(function(err, count) {
                        test.equal(count, 1);
                        test.done();
                    });
                }).
            catch(function(err) {
                    // Shouldn't get here
                    test.ok(false, 'Shouldn\'t get here!!!');
                    test.done();
                 });
 
   }, 

};

/**
 * Delete a collection from the profile 
 */
exports.rmdir = {
     setUp: function (callback) {
    	try{
            var server = new mongo.Server(config.mongo.host,
                                          config.mongo.port,
                                          config.mongo.serverOptions);
            this.db = new mongo.Db('yanfen_at_hg_dot_com',
			    server, config.mongo.clientOptions);
            this.db.open(function (err, client) {
                if (err) {
                  throw err;
                }
        	    this.collection = new mongo.Collection(client, cname);
                this.collection.insert([
                        {
                            _id: new mongo.ObjectID('0123456789AB'),
                            name: 'dan',
                            occupation: 'Batman'
                        },
                        {
                            _id: new mongo.ObjectID('123456789ABC'),
                            name: 'yanfen',
                            occupation: 'Being cool'
                        }
                    ],
                    function() {
                        callback();
                    });
            });
    	} catch(e) {
            console.dir(e);
    	}
    },
    
    tearDown: function (callback) {
        // Lose the database for next time
        this.db.dropDatabase(function(err) { 
            callback();
        });
    },

   'Do not delete from a non-existent database': function (test) {
        test.expect(1);

        action.rmdir({ dbName: 'no_one_at_not_here_dot_com',
  		       collectionName: cname,
		       admin: true }).
            then(function() {
                    // Shouldn't get here
                    test.ok(false, 'Shouldn\'t get here!!!');
                    test.done();
                }).
            catch(function(err) {
                    test.ok(err, 'This should throw an error');        
                    test.done();
                });
   }, 

   'Do not delete a non-existent collection': function (test) {
        test.expect(1);

        action.rmdir({ dbName: 'yanfen_at_hg_dot_com',
  		       collectionName: 'NoSuchCollection',
		       admin: true }).
            then(function() {
                    // Shouldn't get here
                    test.ok(false, 'Shouldn\'t get here!!!');
                    test.done();
                }).
            catch(function(err) {
                    test.ok(err, 'This should throw an error');        
                    test.done();
                });
   }, 

   'Delete collection from an existing database': function (test) {
        test.expect(3);

        collection.count(function(err, count) {
            test.equal(count, 2);
        });

        action.rmdir(verifiedUser).
            then(function() {
                    test.ok(true, 'The doc has been deleted, I think');
                    collection.count(function(err, count) {
                        test.equal(count, 0);
                        test.done();
                    });
                }).
            catch(function(err) {
                    // Shouldn't get here
                    test.ok(false, 'Shouldn\'t get here!!!');
                    test.done();
                 });
 
   }, 
   
};

/**
 * ls
 */
exports.ls = {

     setUp: function (callback) {
    	try{
            var server = new mongo.Server(config.mongo.host,
                                          config.mongo.port,
                                          config.mongo.serverOptions);
            this.db = new mongo.Db('existing_database',
			    server, config.mongo.clientOptions);
            this.db.open(function (err, client) {
                if (err) {
                  throw err;
                }
                this.collection = new mongo.Collection(client, cname);
                this.collection.insert([
                        {
                            _id: new mongo.ObjectID('0123456789AB'),
                            name: 'dan',
                            occupation: 'Batman'
                        },
                        {
                            _id: new mongo.ObjectID('123456789ABC'),
                            name: 'yanfen',
                            occupation: 'Being cool'
                        }
                    ],
                    function() {
                        callback();
                    });
            });
    	} catch(e) {
            console.dir(e);
    	}
    },
    
    tearDown: function (callback) {
        // Lose the database for next time
        this.db.dropDatabase(function(err) { 
            callback();
        });
    },

    'Return a list of documents contained in the collection': function(test) {
        test.expect(3);
        action.ls({ dbName: 'existing_database', collectionName: cname }).
            then(function(list) {
                test.equal(list.length, 2);
                test.equal(list[0].name, 'dan');
                test.equal(list[1].name, 'yanfen');
                test.done();
            }).
            catch(
                function(err) {
                    // Shouldn't get here
                    test.ok(false, 'Shouldn\'t get here!!!');
                    test.done();
                 });
    },

    'Return an empty list from an empty collection': function(test) {
        test.expect(1);
        action.ls({ dbName: 'existing_database', collectionName: 'no_such_collection' }).
            then(function(list) {
                test.equal(list.length, 0);
                test.done();
            }).
            catch(
                function(err) {
                    // Shouldn't get here
                    test.ok(false, 'Shouldn\'t get here!!!');
                    test.done();
                 });
    },
};

/**
 * createDatabase
 */
var agent;
exports.createDatabase = {

    setUp: function(callback) {
    	try{
            agent = new gebo.registrantModel({
                    name: 'Joey Joe Joe Jr. Shabadoo',
                    email: 'jjjj@shabadoo.com',
                    password: 'abc123',
                    admin: 'true'
                  });

            var server = new mongo.Server(config.mongo.host,
                                          config.mongo.port,
                                          config.mongo.serverOptions);
            this.db = new mongo.Db(TEST_DB,
			    server, config.mongo.clientOptions);
            this.db.open(function (err, client) {
                if (err) {
                  throw err;
                }
                agent.save();
                this.collection = new mongo.Collection(client, cname);
                this.collection.insert([
                        {
                            _id: new mongo.ObjectID('0123456789AB'),
                            name: 'dan',
                            occupation: 'Batman'
                        },
                        {
                            _id: new mongo.ObjectID('123456789ABC'),
                            name: 'yanfen',
                            occupation: 'Being cool'
                        }
                    ],
                    function() {
                        callback();
                    });
            });
    	} catch(e) {
            console.log(e);
            callback();
    	}
    },

    tearDown: function (callback) {
        // Drop the existing database defined in setup
        this.db.dropDatabase(function(err) {

            // Lose the database for next time
            var server = new mongo.Server(config.mongo.host,
                                          config.mongo.port,
                                          config.mongo.serverOptions);
            var testDb = new mongo.Db(utils.getMongoDbName(agent.email),
                            server, config.mongo.clientOptions);

            testDb.open(function(err, client) {
                    if (err) {
                      console.log('Could not open database: ' + err);
                    } 

                    testDb.dropDatabase(function(err) { 
                        if (err) {
                          console.log('Could not drop database: ' + err);
                        }
                        gebo.connection.db.dropDatabase(function(err) {
                            if (err) {
                              console.log(err)
                            }
                            callback();
                          });
                    });
               });
          });
    },

    'Should add a new database with a profile collection': function(test) {
        test.expect(5);

        // Make sure the DB doesn't exist already
        var dbName = utils.getMongoDbName(agent.email);
        action.dbExists(dbName).
                then(function(client) {
                    test.ok(false, 'This database shouldn\'t exist. Delete manually???');
                    test.done();
                  }).
                catch(function(err) {
                    test.ok(true, 'This database does not exist, which is good');
                  });

        action.createDatabase(dbName, agent).
                then(function() {
                    test.ok(true, 'Looks like ' + dbName + ' was created'); //
                    action.getCollection(dbName, 'profile').
                            then(function(collection) {
                                collection.findOne({ email: 'jjjj@shabadoo.com' },
                                        function(err, doc) {
                                            if (err) {
                                              test.ok(false, err);
                                              test.done();
                                            }
                                            else {
                                              test.equal(doc.name,
                                                      'Joey Joe Joe Jr. Shabadoo');
                                              test.equal(doc.email, 'jjjj@shabadoo.com');
                                              test.ok(doc.admin);
                                              test.done();
                                            }
                                          }); 
                              }).
                            catch(function(err) {
                                test.ok(false, err);
                                test.done();
                              });
 


                  }).
                catch(function(err) {
                    test.ok(false, err);
                    test.done();
                  });

    },

    'Should not overwrite an existing database': function(test) {
        test.expect(8);

        // Make sure the DB exists
        var dbName = utils.getMongoDbName(TEST_DB);
        action.dbExists(dbName).
                then(function(client) {
                    test.ok(true);
                  }).
                catch(function(err) {
                    test.ok(false, err);
                    test.done();
                  });

        action.createDatabase(dbName).
                then(function() {
                    test.ok(false, dbName + ' should not have been created');
                    test.done();
                  }).
                catch(function(err) {
                    test.ok(true);
                    action.getCollection(dbName, cname).
                        then(function(collection) {
                            test.ok(true, 'Collection retrieved');
                            collection.find().toArray(function(err, docs) {
                                if (err) {
                                  test.ok(false, err);
                                  test.done();
                                }
                                else {
                                    test.equal(docs.length, 2);
                                    test.equal(docs[0].name, 'dan');
                                    test.equal(docs[0].occupation, 'Batman');
                                    test.equal(docs[1].name, 'yanfen');
                                    test.equal(docs[1].occupation, 'Being cool');
                                    test.done();
                                }
                              });
                          }).
                        catch(function(err) {
                            test.ok(false, err);
                            test.done();      
                          });
                  });
    },
};


/**
 * dropDatabase
 */
exports.dropDatabase = {

    setUp: function(callback) {
    	try {
            var server = new mongo.Server(config.mongo.host,
                                          config.mongo.port,
                                          config.mongo.serverOptions);
            this.db = new mongo.Db('existing_db', server, config.mongo.clientOptions);
            this.db.open(function (err, client) {
                if (err) {
                  throw err;
                }
                this.collection = new mongo.Collection(client, cname);
                this.collection.insert([
                        {
                            _id: new mongo.ObjectID('0123456789AB'),
                            name: 'dan',
                            occupation: 'Batman'
                        },
                        {
                            _id: new mongo.ObjectID('123456789ABC'),
                            name: 'yanfen',
                            occupation: 'Being cool'
                        }
                    ],
                    function() {
                        callback();
                    });
            });
    	} catch(e) {
            console.dir(e);
    	}
    },

    tearDown: function (callback) {
        // Lose the database for next time
        this.db.dropDatabase(function(err) {
            callback();
        });
    },


    'Should delete the database specified': function(test) {
        test.expect(3);

        // Make sure the DB exists
        var dbName = utils.getMongoDbName('existing_db');
        action.dbExists(dbName).
                then(function(client) {
                    test.ok(true);
                  }).
                catch(function(err) {
                    test.ok(false, err);
                    test.done();
                  });

        action.dropDatabase(dbName).
                then(function() {
                    test.ok(true);

                    action.dbExists(dbName).
                        then(function(client) {
                            test.ok(false, dbName + ' should not exist');
                            test.done();
                          }).
                        catch(function(err) {
                            test.ok(true, err);
                            test.done();
                          });
                  }).
                catch(function(err) {
                    test.ok(false, err);
                    test.done();
                  });
    },

    'Should not barf if the database does not exist': function(test) {
        test.expect(2);

        // Make sure the database doesn't exist
        var dbName = utils.getMongoDbName('no_such_database');
        action.dbExists(dbName).
                then(function(client) {
                    test.ok(false, dbName + ' should not exist. Why is it in the db?');
                    test.done();
                  }).
                catch(function(err) {
                    test.ok(true);
                 });

        action.dropDatabase(dbName).
                then(function() {
                    test.ok(false, dbName + ' should not exist');
                    test.done();
                  }).
                catch(function(err) {
                    test.ok(true);
                    test.done();
                 });
    },
};

/**
 * getUsers 
 */
//exports.getUsers = {
//
//    setUp: function(callback) {
//    	try {
//            var server = new mongo.Server(config.mongo.host,
//                                          config.mongo.port,
//                                          config.mongo.serverOptions);
//            this.db = new mongo.Db('existing_db', server, config.mongo.clientOptions);
//            this.db.open(function (err, client) {
//                if (err) {
//                  throw err;
//                }
//                this.collection = new mongo.Collection(client, cname);
//                this.collection.insert([
//                        {
//                            _id: new mongo.ObjectID('0123456789AB'),
//                            name: 'dan',
//                            occupation: 'Batman'
//                        },
//                        {
//                            _id: new mongo.ObjectID('123456789ABC'),
//                            name: 'yanfen',
//                            occupation: 'Being cool'
//                        }
//                    ],
//                    function() {
//                        callback();
//                    });
//            });
//    	} catch(e) {
//            console.dir(e);
//    	}
//    },
//
//    tearDown: function (callback) {
//        // Lose the database for next time
//        this.db.dropDatabase(function(err) {
//            callback();
//        });
//    },
//
//    'Should return a list of registered agents': function(test) {
//        test.expect(1);
//	test.done();
//    },
//
//};

/**
 * getUserDocuments 
 */
exports.getUserDocuments = {

    setUp: function(callback) {
        agent = new gebo.registrantModel({
                name: 'Joey Joe Joe Jr. Shabadoo',
                email: 'jjjj@shabadoo.com',
                password: 'abc123',
                admin: 'true'
              });

        var dbName = utils.getMongoDbName(agent.email);

    	try {
            var server = new mongo.Server(config.mongo.host,
                                          config.mongo.port,
                                          config.mongo.serverOptions);
            this.db = new mongo.Db(dbName, server, config.mongo.clientOptions);
            this.db.open(function (err, client) {
                if (err) {
                  throw err;
                }
                this.collection = new mongo.Collection(client, cname);
                this.collection.insert([
                        {
                            _id: new mongo.ObjectID('0123456789AB'),
                            name: 'doc 1',
                        },
                        {
                            _id: new mongo.ObjectID('123456789ABC'),
                            name: 'doc 2',
                        }
                    ],
                    function() {
                        callback();
                    });
            });
    	} catch(e) {
            console.dir(e);
    	}
    },

    tearDown: function (callback) {
        // Lose the database for next time
        this.db.dropDatabase(function(err) {
            if(err) {
              console.log(err);
            }
            callback();
        });
    },

    'Should return a list of a agent\'s documents': function(test) {
        test.expect(1);
	action.getUserDocuments(
			{ dbName: 'don\'t matter', collectionName: cname, admin: true },
			{ email: agent.email }).
		then(function(data) {
		    test.ok(data);
		    test.done();
		  }).
		catch(function(err) {
		    test.ok(false, err);
		    test.done();
		  });
    },

    'Should throw an error when accessed by non-admin': function(test) {
	test.expect(1);
	action.getUserDocuments({ email: agent.email, admin: false }).
		then(function(data) {
		    test.ok(false, 'This should not be accessible');
		    test.done();
		  }).
		catch(function(err) {
		    test.ok(err);
		    test.done();
		  });
    },
};

/**
 * registerAgent
 */
exports.registerAgent = {

    setUp: function(callback) {
    	try{
            var agent = new gebo.registrantModel(
                            { name: 'dan', email: 'dan@hg.com',
                              password: 'password123', admin: true,  
                              _id: new mongo.ObjectID('0123456789AB') });
            agent.save(function(err) {
                    if (err) {
                      console.log(err);
                    }
                    callback();
                  });
     	}
        catch(e) {
            console.dir(e);
            callback();
    	}
    }, 

    tearDown: function(callback) {
        gebo.connection.db.dropDatabase(function(err) {
            if (err) {
              console.log(err)
            }
            callback();
          });
    }, 

    'Add a new agent to the database': function(test) {
        test.expect(4);
        gebo.registrantModel.find({}, function(err, agents) {
                if (err) {
                  test.ok(false, err);
                  test.done();
                }
                test.equal(agents.length, 1); 

                var newAgent = {
                        name: 'yanfen',
                        email: 'yanfen@hg.com',
                        password: 'password456',
                        admin: false,
                        _id: new mongo.ObjectID('123456789ABC')
                    };
                action.registerAgent(newAgent).
                    then(function(agent) {  
                        test.equal(agent.name, 'yanfen');
                        test.equal(agent.email, 'yanfen@hg.com');
                        test.equal(agent.admin, false);
                        test.done();
                      });
          });
    },

    'Do not overwrite an existing agent': function(test) {
        test.expect(1);
        var existingAgent = {
                name: 'dan',
                email: 'dan@hg.com',
                password: 'password123',
                admin: true
            };
        action.registerAgent(existingAgent).
           then(function(agent) {
                test.ok(false, 'Must not overwrite an existing agent');
                test.done();
             }).
           catch(function(err) {
               test.ok(true, err);
               test.done();
             });
    },
};

/**
 * deregisterAgent
 */
exports.deregisterAgent = {

    setUp: function(callback) {
    	try{
            var agent = new gebo.registrantModel(
                            { name: 'dan', email: 'dan@hg.com',
                              password: 'password123', admin: true,  
                              _id: new mongo.ObjectID('0123456789AB') });
            agent.save(function(err) {
                    if (err) {
                      console.log(err);
                    }
                    callback();
                  });
     	}
        catch(e) {
            console.dir(e);
            callback();
    	}
    }, 

    tearDown: function(callback) {
        gebo.connection.db.dropDatabase(function(err) {
            if (err) {
              console.log(err)
            }
            callback();
          });
    }, 

    'Remove an agent from the database': function(test) {
        test.expect(1);

        action.deregisterAgent('dan@hg.com').
            then(function(err, ack) {
                    gebo.registrantModel.find({}, function(err, agents) {
                        if (err) {
                          test.ok(false, err);
                          test.done();
                        }
                        test.equal(agents.length, 0); 
                        test.done();
                      });
                  });
    },

    'Should not barf if agent does not exist': function(test) {
        test.expect(1);
        action.deregisterAgent('nosuchagent@hg.com').
            then(function(err, ack) {
                    gebo.registrantModel.find({}, function(err, agents) {
                        if (err) {
                          test.ok(false, err);
                          test.done();
                        }
                        test.equal(agents.length, 1); 
                        test.done();
                      });
                  });
    },
};
