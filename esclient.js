var http = require('http');
var nodemailer = require('nodemailer');

http.createServer(function (req, res) {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Hello World\n');
}).listen(1337, "127.0.0.1");
//console.log('Server running at http://127.0.0.1:1337/');
var admin = require('firebase-admin');
var firebase = require("firebase");
var serviceAccount = require('./united-property-kingdom-firebase-adminsdk-uxcg9-7c3abc4f1a.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: 'https://united-property-kingdom.firebaseio.com'
});

// initialize our ElasticSearch API
var elasticsearch = require('elasticsearch');
var client = new elasticsearch.Client({
    host: 'localhost:9200',
    log: 'trace'
});
// listen for changes to Firebase data

var config = {
    apiKey: "AIzaSyATKphkaqCJ9T3XZba4VOPQ8EnAgjPYBS4",
    authDomain: "united-property-kingdom.firebaseapp.com",
    databaseURL: "https://united-property-kingdom.firebaseio.com"

};
firebase.initializeApp(config);

client.ping({
    // ping usually has a 3000ms timeout
    requestTimeout: 1000
}, function (error) {
    if (error) {
        //console.trace('elasticsearch cluster is down!');
    } else {
        //console.log('All is well');
    }
});
var fb = firebase.database().ref("properties");
var fbh = firebase.database().ref("propertyhandler"); //push deleted properties keys to properties handler to delete from search database {key:true}
var update = true;
var fb1 = firebase.database().ref("testProjects");
fb.on('child_added', createOrUpdateIndex);
fb.on('child_changed', createOrUpdateIndex);
fbh.on('child_added', removeIndexP);
fb1.on('child_removed', removeIndex);

fb1.on('child_added', createOrUpdateIndex1);
fb1.on('child_changed', createOrUpdateIndex1);

var fbs = firebase.database().ref("search");

fbs.on('child_added', search);
fbs.on('child_changed', search);

function createOrUpdateIndex(snapobj) {
    ////console.log("update called");
    snapobj.forEach(function (snap1) {
        //snap1.forEach(function (snap2)


        snap1.forEach(function (snap) {
            //  //console.log(snap.val());
            client.index({
                index: "my_index",
                type: "my_type",
                id: snap.key,
                body: {
                    "title": snap.val().title,
                    "location": snap.val().location,
                    "subType": snap.val().subType,
                    "type": snap.val().type,
                    "resultType": "property",
                    "latitude": snap.val().latitude,
                    "longitude": snap.val().longitude,
                    "purpose": snap.val().purpose,
                    "price": parseInt(snap.val().price),
                    "priceUnit": snap.val().priceUnit,
                    "ep": snap.val().purpose,
                    "landArea": snap.val().landArea,
                    "unit": snap.val().unit,
                    "timestamp": snap.val().timestamp,
                    "city": snap.val().city,
                    "rooms": snap.val().rooms,
                    "basePrice": snap.val().basePrice,
                    "baseSize": snap.val().baseSize,
                    "kitchen": snap.val().kitchen,
                    "bath": snap.val().bath,
                    "images": { "image0": snap.val().images.image0 },
                    "key": snap.key,
                    "description": snap.val().description, "pricestamp": parseInt(snap.val().price)

                }
            }, function (error, response) {

            });
            if (update) {
                client.indices.putMapping({
                    type: "my_type",
                    body: {
                        "mappings": {
                            "_doc": {
                                "properties": {

                                    "basePrice": {
                                        "type": "keyword"
                                    }
                                }
                            }
                        }
                    }
                });
                update = false;
            }
        });


    });

}

function createOrUpdateIndex1(snap) {
    ////console.log("update called");

    client.index({
        index: "my_index",
        type: "my_type",
        id: snap.key,
        body: {
            "title": snap.val().title,
            "tagLine": snap.val().tagLine,
            "section": snap.val().sections,
            "resultType": "project",
            "latitude": snap.val().latitude,
            "location": snap.val().address,
            "longitude": snap.val().longitude,
            "price": parseInt(snap.val().price),
            "priceUnit": snap.val().priceUnit,
            "type": "a project",
            "ep": "sale",
            "pricestamp": parseInt(snap.val().price),
            "subType": "2",

            "basePrice": 0,
            "baseSize": 0,
            "timestamp": "2018-02-21T09:01:26.976Z",
            "city": snap.val().city,
            "images": { "image0": snap.val().images.banner },
            "key": snap.key,
            "description": snap.val().description
        }
    }, function (error, response) {

    });


    //client.index(this.index, this.type, snap.val(), snap.key)
    //  .on('data', function(data) { //console.log('indexed ', snap.key )})
    //  .on('error', function(err) { /* handle errors */ });
}
function search(snap) {
    var allTitles = [];
    var search_key = snap.key;
    var keyword = snap.val().keyword;
    var filter_terms = snap.val().filters;
    var min_match = 1;
    var offset = snap.val().offset;
    var sorting = snap.val().sort;
    if (snap.hasChild("range")) {
        var range_filters = snap.val().range;

        for (i = 0; i < range_filters.length; i++) {
            filter_terms.push(range_filters[i]);
        }

    }
    if (sorting == null || sorting.length == 0) {
        sorting = [{ "timestamp": { "order": "desc" } }];
    }
    if (offset > 0) {
        if (filter_terms.length >= 2) { min_match = filter_terms.length - offset + 1; }
    } else {

        if (filter_terms.length >= 2) { min_match = filter_terms.length; }
    }
    if (keyword.length !== 0) {
        //console.log("no key");
        client.search({
            index: '',
            //type: type_key,
            // scroll: '30s', // keep the search results "scrollable" for 30 seconds
            source: [], // filter the source to only include the title field
            body: {
                sort: sorting,
                size: snap.val().size,
                from: snap.val().start,

                "query": {
                    "bool": {
                        "must": [{
                            "multi_match": {
                                "query": keyword,
                                "fuzziness": "AUTO",
                                "fields": ["location", "title", "description"],
                                "operator": "or"

                            }
                        }],
                        "should": filter_terms,
                        "minimum_should_match": min_match

                    }
                }

            }

        }, function (error, response) {

            // collect the title from each response
            firebase.database().ref("searchResult/" + search_key).set(null);
            response.hits.hits.forEach(function (hit) {
                firebase.database().ref("searchResult/" + search_key).push().set(hit._source);
                allTitles.push(hit._source.title);
            });

            firebase.database().ref("search/" + search_key).set(null);

        });

        client.count({
            index: '',
            // type: type_key,
            // scroll: '30s', // keep the search results "scrollable" for 30 seconds
            source: [], // filter the source to only include the title field
            body: {
                //query: {
                //    fuzzy: { keys: keyword },
                //}
                "query": {
                    "bool": {
                        "must": [{
                            "multi_match": {
                                "query": keyword,
                                "fuzziness": "AUTO",
                                "fields": ["location", "title", "description"],
                                "operator": "or"

                            }
                        }],
                        "should": filter_terms,
                        "minimum_should_match": min_match
                    }
                }
            }

        }, function (error, response) {
            // collect the title from each response
            firebase.database().ref("searchResultCount/" + search_key + "/").push().set(null);
            ////console.log(response.count);
            if (response.count == 0) {
                firebase.database().ref("searchResultCount/" + search_key + "/").push().set(response.count);

            }
            else {
                firebase.database().ref("searchResultCount/" + search_key + "/").push().set(response.count);

            }


        });
    }
    else {

        client.search({
            index: '',
            //type: type_key,
            // scroll: '30s', // keep the search results "scrollable" for 30 seconds
            source: [], // filter the source to only include the title field
            body: {
                sort: sorting,
                size: snap.val().size,
                from: snap.val().start,

                "query": {
                    "bool": {

                        "should": filter_terms,
                        "minimum_should_match": min_match
                    }
                }

            }

        }, function getMoreUntilDone(error, response) {

            // collect the title from each response
            firebase.database().ref("searchResult/" + search_key).set(null);
            response.hits.hits.forEach(function (hit) {
                firebase.database().ref("searchResult/" + search_key).push().set(hit._source);
                allTitles.push(hit._source.title);
            });

            firebase.database().ref("search/" + search_key).set(null);

        });

        client.count({
            index: '',
            // type: type_key,
            // scroll: '30s', // keep the search results "scrollable" for 30 seconds
            source: [], // filter the source to only include the title field
            body: {
                //query: {
                //    fuzzy: { keys: keyword },
                //}
                "query": {
                    "bool": {

                        "should": filter_terms,

                        "minimum_should_match": min_match
                    }
                }
            }

        }, function searchCount(error, response) {
            // collect the title from each response
            firebase.database().ref("searchResultCount/" + search_key + "/").push().set(null);
            ////console.log(response.count);
            if (response.count == 0) {
                firebase.database().ref("searchResultCount/" + search_key + "/").push().set(response.count);

            }
            else {
                firebase.database().ref("searchResultCount/" + search_key + "/").push().set(response.count);

            }


        });
    }


}


function removeIndex(snap) {

    client.delete({
        index: 'my_index',
        type: 'my_type',
        id: snap.key
    }, function (error, response) {
        // ...

    });

}

function removeIndexP(snap) {

    client.delete({
        index: 'my_index',
        type: 'my_type',
        id: snap.key
    }, function (error, response) {
        // ...

    });
    firebase.database().ref("propertyhandler/" + snap.key).set(null);
}

//function removeIndexProp(snap) {
//    console.log(snap.key);
//    client.delete({
//        index: 'my_index',
//        id: snap.key

//    },
//        function (error, response) { console.log(response); });
//}



var mailRef = firebase.database().ref("subscriber/events/testEvent");
mailRef.on("child_added", eventAdded);



function eventAdded(snap) {
    //fetch all user
    var emails = null;
    // //console.log(eventId);
    // firebase.database().ref("subscriber/events/" + eventId).once('value', function (eventSub) {
    //     eventSub.forEach(function (userEve) {
    if (snap.hasChild("email") !== null && !snap.hasChild("sent")) {
        //console.log(snap.val().email);

        var name = snap.val().name;

        var to = snap.val().email;

        var subject = "Dubai Property Festival";
        var obj = {
            from: "United Property Kingdom<noreply@unitedpropertykingdom.com>",
            to: to,
            subject: subject,
            title: "Dubai Property Festival",
            html: "<h3>Hi " + name + "<h3/><p>This an auto generated message from United Property Kingdom. <br/>Your invitation requested for Dubai Property Festival has been recieved.<br/> We will get back to you shortly<p><br/>For any query contact at team@unitedpropertykingdom.com</p><br/>Regards,<br/>United Property Kingdom",
        };
        //console.log(obj);
        sendMail(obj);
        firebase.database().ref("subscriber/events/testEvent/" + snap.key + "/sent").set(true);
    }
    //     });

    // }).then(function () {
    // });

    //var emails = ['usama.sama@gmail.com', 'beenishkhan603@gmail.com'];
    //for (i = 0; i < emails.length; i++) {
    //    sendMail(emails[i]);
    //}
}

function sendMail(obj) {
    //console.log("sending mail");
    const transporter = nodemailer.createTransport({
        host: 'mtl-node1.websitehostserver.net',
        port: 465,
        auth: {
            user: 'noreply@unitedpropertykingdom.com',
            pass: '25,.YvT=@L+}'

            // user: 'noreply@unitedpropertykingdom.com',
            // pass: '25,.YvT=@L+}'
        }
    });

    var mailOptions = obj;

    transporter.sendMail(mailOptions, function (error, info) {
        if (error) {
            //console.log(error);
        } else {
            //console.log('Email sent: ' + info.response);
        }
    });
}
