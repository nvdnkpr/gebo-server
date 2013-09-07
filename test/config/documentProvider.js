var documentProvider = require('../../config/documentProvider'),
    config = require('../../config/config'),
    utils = require('../../lib/utils'),
    DatabaseCleaner = require('database-cleaner'),
    databaseCleaner = new DatabaseCleaner('mongodb'),
    mongo = require('mongodb'),
    q = require('q');


var cname = 'unitTest';
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
 * Open the given databse
 */
exports.openDb = {
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
 
    'Open non-existent database': function (test) {
        test.expect(4);

        documentProvider.openDb('non_existent_db').
                then(
                    function(client) {
                        client.collectionNames(function(err, names) {

                            test.ifError(err);
                
                            // It's a new DB, there are no collections yet
                            test.deepEqual(names, []);

                            // Create a new collection and make sure it takes data
                            client.createCollection('new_collection',
                                function(err, collection) {
                                    collection.insert({ foo: 'bar' }, function(data) {

                                        client.collectionNames(function(err2, names2) {

                                        test.ifError(err2);

                                        // The new collection exists
                                        test.deepEqual(names2,
                                            [ 
                                              { name: 'non_existent_db.new_collection',
                                                options: { create: 'new_collection' } },
                                              { name: 'non_existent_db.system.indexes' } ]);

                                        // Lose the database for next time
                                        client.dropDatabase(function(err) { 
                                            test.done();
                                        });
                                   });
                                });
                            });
                        });
       });
    },

    'Open existing database': function (test) {
        test.expect(5);

        documentProvider.openDb('existing_database').then(function(client) {

            client.collectionNames(function(err, names) {
                    
                test.ifError(err);
                
                // It's a new DB, there are no collections yet
                test.deepEqual(names, 
                        [ 
                          { name: 'existing_database.unitTest' },
                          { name: 'existing_database.system.indexes' } ]
                        );

                var collection = client.collection('unitTest');
                var cursor = collection.find({ name: 'dan'});
                cursor.toArray(function(err, docs) {

                    test.ifError(err);
    
                    test.equal(docs[0].name, 'dan');
                    test.equal(docs[0].occupation, 'Batman');
    
                    test.done();
                });
            });
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
 
   'Do not save to a non-existent database': function (test) {
        test.expect(1);
        
        var user = { name: 'yanfen', email: 'yanfen@email.com' };
        documentProvider.save(user, 'some_collection', { data: 'junk' }).
                then(
                    function(docs) {
                        console.log(docs);       
                        test.ok(false, 'This database shouldn\'t exist. Delete manually');
                        test.equal(docs[0].data, 'junk');
                        test.done();
                    }).
                catch(
                    function(err) {
                        test.ok(err);
                        test.done();
                    }).done();
   }, 

   'Save to existing database': function (test) {
        test.expect(2);

        var user = { name: 'dan', email: 'dan@email.com' };
        documentProvider.save(user, 'some_collection', { data: 'junk' }).
                then(
                    function(docs) {
                        test.ok(docs);
                        test.equal(docs.data, 'junk');
                        test.done();
                    }).
                catch(
                    function(err) {
                        console.log('Error???? ' + err);       
                        test.ifError(err);
                        test.done();
                    });
   }, 

   'Update existing document': function(test) {
        test.expect(9);

        var user = { name: 'dan', email: 'dan@email.com' };

        // Retrieve the existing document
        documentProvider.retrieve(user, cname, '0123456789AB').
            then(
                function(docs) {
                    test.ok(docs, 'Docs successfully retrieved');
                    test.equal(docs.length, 1);
                    test.equal(docs[0].name, 'dan');
                    test.equal(docs[0].occupation, 'Batman');
                    docs[0].occupation = 'AI Practitioner';

                    return documentProvider.save(user, cname, docs[0]);
                }).
            then(
                function(ack) {
                    test.ok(ack, 'Doc successfully saved');
                  // test.done();
                    return documentProvider.retrieve(user, cname, '0123456789AB');
                }).
            then(
                function(docs) {
                    test.ok(docs, 'Retrieved the saved doc again');
                    test.equal(docs.length, 1);
                    test.equal(docs[0].name, 'dan');
                    test.equal(docs[0].occupation, 'AI Practitioner');
                    test.done();
                }).
            catch(
                function(err) {
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

        documentProvider.dbExists('non_existent_database').
                        then(
                            function() {
                                // Shouldn't get here
                                console.log('Shouldn\'t get here!!!');
                                test.ok(false, 'Shouldn\'t get here!!!');
                                test.done();
                            }).
                        catch(
                            function(err) {
                                test.ok(err, 'An error should be thrown');
                                test.done();
                            });
   }, 

   'Return a promise if the database does exist': function (test) {
        test.expect(1);

        documentProvider.dbExists('existing_database').
                then(
                    function() {
                        test.ok(true, 'Verified the database exists');
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
 * Retrieve document from the database
 */
exports.retrieve = {

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
 
   'Do not retrieve from non-existent database': function (test) {
        test.expect(1);
        var user = { name: 'no_one', email: 'no_one@not-here.com' };
        documentProvider.retrieve(user, cname, '0123456789AB').
            then(
                function() {
                    // Shouldn't get here
                    test.ok(false, 'Shouldn\'t get here!!!');
                    test.done();
                }).
            catch(
                function(err) {
                    test.ok(err, 'An error should be thrown');
                    test.done();
                });
   }, 

   'Retrieve from existing database': function (test) {
        test.expect(3);
        var user = { name: '4real', email: 'existing_database' };
        documentProvider.retrieve(user, cname, '0123456789AB').
             then(
                function(docs) {
                    test.ok(docs, 'Document retrieved');
                    test.equal(docs[0].name, 'dan');
                    test.equal(docs[0].occupation, 'Batman');
                    test.done();
                }).
            catch(
                function(err) {
                   // Shouldn't get here
                    console.log('Shouldn\'t get here!!!');
                    test.ok(false, 'Shouldn\'t get here!!!');
                    test.done();
                 });
 
   }, 


};

/**
 * Copy a document to a new profile 
 */
//exports.copy = {
//
//   'Copy to a non-existent database': function (test) {
//        test.expect(1);
//
//        test.done();
//   }, 
//
//   'Copy to existing database': function (test) {
//        test.expect(1);
//
//        test.done();
//   }, 
//
//};

/**
 * Delete a document from the profile 
 */
exports.destroy = {

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

        var user = { name: 'dan', email: 'does_not_exist' };

        // Retrieve the existing document
        documentProvider.destroy(user, cname, '0123456789AB').
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

   'Do not delete from a non-existent collection': function (test) {
        test.expect(1);

        var user = { name: 'dan', email: 'existing_database' };

        // Retrieve the existing document
        documentProvider.destroy(user, 'NoSuchCollection', '0123456789AB').
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

        var user = { name: 'dan', email: 'existing_database' };

        documentProvider.destroy(user, cname, 'NoSuchDocABC').
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

        var user = { name: 'dan', email: 'existing_database' };

        documentProvider.destroy(user, cname, '123456789ABC').
            then(
                function() {
                    test.ok(true, 'The doc has been deleted, I think');
                    collection.count(function(err, count) {
                        test.equal(count, 1);
                        test.done();
                    });
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
 * Delete a collection from the profile 
 */
exports.destroyCollection = {
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

        var user = { name: 'dan', email: 'does_not_exist' };

        // Retrieve the existing document
        documentProvider.destroyCollection(user, cname).
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

   'Do not delete a non-existent collection': function (test) {
        test.expect(1);

        var user = { name: 'dan', email: 'existing_database' };

        // Retrieve the existing document
        documentProvider.destroyCollection(user, 'NoSuchCollection').
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

   'Delete collection from an existing database': function (test) {
        test.expect(3);

        collection.count(function(err, count) {
            test.equal(count, 2);
        });

        var user = { name: 'dan', email: 'existing_database' };

        documentProvider.destroyCollection(user, cname).
            then(
                function() {
                    test.ok(true, 'The doc has been deleted, I think');
                    collection.count(function(err, count) {
                        test.equal(count, 0);
                        test.done();
                    });
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
 * ls
 */
exports.ls = {

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


};

