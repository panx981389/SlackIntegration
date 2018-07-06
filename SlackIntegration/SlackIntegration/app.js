'use strict';
// Import express and request modules
var express = require('express');
var request = require('request');
var bodyParser = require('body-parser');
var path = require('path');

const { WebClient } = require('@slack/client');
var redis = require("redis"),
    redis_client = redis.createClient();

redis_client.on("error", function (err) {
    console.log("Redis Error:" + err);
});

// Store our app's ID and Secret. These we got from Step 1. 
// For this tutorial, we'll keep your API credentials right here. But for an actual app, you'll want to  store them securely in environment variables. 
var clientId = '216246239079.343210212259';
var clientSecret = '23fbc99788a1868d52f216db09e16243';

var token = 'xoxp-216246239079-214612888065-393239089968-4996faa3a1fa45b65f9185512f69b110';
const web = new WebClient(token);
// Instantiates Express and assigns our app variable to it
var app = express();

const WEB_HOST = 'http://4bb56f6d.ngrok.io';


app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: true
}));
app.use(express.static(path.join(__dirname, 'public')));

// Again, we define a port we want to listen to
const PORT = 4390;

// Lets start our server
var server = app.listen(PORT, function () {
    //Callback triggered when server is successfully listening. Hurray!
    console.log("Example app listening on port " + PORT);
});


// This route handles GET requests to our root ngrok address and responds with the same "Ngrok is working message" we used before
app.get('/', function (req, res) {
    res.send('Ngrok is working! Path Hit: ' + req.url);
});

// This route handles get request to a /oauth endpoint. We'll use this endpoint for handling the logic of the Slack oAuth process behind our app.
app.get('/oauth', function (req, res) {
    // When a user authorizes an app, a code query parameter is passed on the oAuth endpoint. If that code is not there, we respond with an error message
    if (!req.query.code) {
        res.status(500);
        res.send({ "Error": "Looks like we're not getting code." });
        console.log("Looks like we're not getting code.");
    } else {
        // If it's there...

        // We'll do a GET call to Slack's `oauth.access` endpoint, passing our app's client ID, client secret, and the code we just got as query parameters.
        request({
            url: 'https://slack.com/api/oauth.access', //URL to hit
            qs: { code: req.query.code, client_id: clientId, client_secret: clientSecret }, //Query string data
            method: 'GET', //Specify the method

        }, function (error, response, body) {
            if (error) {
                console.log(error);
            } else {
                res.json(body);

            }
        })
    }
});

app.get('/call', function (req, res) {
    res.redirect('ciscotel:' + req.query.jid);
});

// Route the endpoint that our slash command will point to and send back a simple response to indicate that ngrok is working
app.post('/slack/receive', function (req, res) {
    let number = req.body.text;
    if (req.body.channel_name == 'directmessage') {
        web.conversations.info({ channel: req.body.channel_id }).then((im_data) => {
            console.log('Profile: ', im_data.channel);
            if (im_data.channel.user) {
                let user_id = im_data.channel.user;
                web.users.profile.get({ user: user_id }).then((user_data) => {
                    if (user_data.profile.email && user_data.profile.email.length != 0) {
                        number = user_data.profile.email;
                    }
                    let data = {
                        "text": "Call:" + user_data.profile.real_name,
                        "attachments": [
                            {
                                "fallback": "Call" + user_data.profile.real_name,
                                "actions": [
                                    {
                                        "type": "button",
                                        "text": "Call",
                                        "url": WEB_HOST + "/call?jid=" + number
                                    }
                                ]
                            }
                        ]
                    };
                    res.json(data);
                });
            }
        })
            .catch(console.error);
    }
    else {
        let data = {
            "text": "Call:" + number,
            "attachments": [
                {
                    "fallback": "Call" + number,
                    "actions": [
                        {
                            "type": "button",
                            "text": "Call",
                            "url": WEB_HOST + "/call?jid=" + number
                        }
                    ]
                }
            ]
        };
        res.json(data);
    }
});

app.post('/slack/callmeeting', function (req, res) {
    let data = {
        "response_type": "in_channel",
        "text": "Meeting:" + req.body.text,
        "attachments": [
            {
                "fallback": "Join Meeting" + req.body.text,
                "actions": [
                    {
                        "type": "button",
                        "text": "Joing Meeting",
                        "url": WEB_HOST + "/call?jid=" + req.body.text
                    }
                ]
            }
        ]
    };
    res.json(data);
});

app.post('/slack/set_team_meeting_number', function (req, res) {
    redis_client.set(req.body.team_id, req.body.text, redis.print);

    let data = {
        "text": "Meeting number set to:" + req.body.text,
    };
    res.json(data);
});

app.post('/slack/call_team_meeting_number', function (req, res) {
    redis_client.get(req.body.team_id, function (err, reply) {
        // reply is null when the key is missing
        console.log(reply);

        var number = reply;

        if (!number || number.length == 0) {
            let data = {
                "text": "Meeting number not found",
            };
            res.json(data);
            return;
        }
        let data = {
            "response_type": "in_channel",
            "text": "Meeting:" + number,
            "attachments": [
                {
                    "fallback": "Join Meeting" + number,
                    "actions": [
                        {
                            "type": "button",
                            "text": "Joing Meeting",
                            "url": WEB_HOST + "/call?jid=" + number
                        }
                    ]
                }
            ]
        };
        res.json(data);
    });
});

app.post('/slack/set_channel_meeting_number', function (req, res) {
    redis_client.set(req.body.channel_id, req.body.text, redis.print);

    let data = {
        "text": "Meeting number set to:" + req.body.text,
    };
    res.json(data);
});

app.post('/slack/call_channel_meeting_number', function (req, res) {
    redis_client.get(req.body.channel_id, function (err, reply) {
        // reply is null when the key is missing
        console.log(reply);

        var number = reply;

        if (!number || number.length == 0) {
            let data = {
                "text": "Meeting number not found",
            };
            res.json(data);
            return;
        }
        let data = {
            "response_type": "in_channel",
            "text": "Meeting:" + number,
            "attachments": [
                {
                    "fallback": "Join Meeting" + number,
                    "actions": [
                        {
                            "type": "button",
                            "text": "Joing Meeting",
                            "url": WEB_HOST + "/call?jid=" + number
                        }
                    ]
                }
            ]
        };
        res.json(data);
    });
});