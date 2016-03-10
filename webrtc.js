var app = angular.module('app', ['ngRoute']);

app.service('Users', function ($http) {
    var users = [
        {
            name: "user6",
            token: "0cfb1079-0913-4dfd-a614-ea551556467d",
            screen_token: "5f17e823-48c6-4e0f-9b52-a11b74e39be0",
            online: false
        },
        {
            name: "user5",
            token: "02513965-3b10-406d-a037-d0c56521d5d3",
            screen_token: "2753f3c1-569a-42e1-8f09-91592ed6da3b",
            online: false
        },
        {name: "user4", token: "c95b5788-fdbd-4193-861a-87c914cfe716", online: false},
        {name: "user3", token: "3d2456c6-28c3-4fd5-9508-ae7246c4f9a5", online: false},
        {name: "user2", token: "2ea7ea6a-5918-46ff-80f6-ac60504204c5", online: false},
        {name: "user1", token: "dbede716-492f-4fd2-8701-2bcb12b18abc", zhuchi: true, playing: false}
    ];
    var getList = function () {
        return users;
    }
    var getUserByName = function (name) {
        var users = getList();
        for (var i = 0; i < users.length; i++) {
            if (users[i].name == name)
                return users[i];
        }
        return null;
    };
    var getUserByToken = function (token) {
        var users = getList();
        for (var i = 0; i < users.length; i++) {
            if (users[i].token == token)
                return users[i];
        }
        return null;
    };
    return {
        getList: getList,
        getUser: getUserByName,
        getUserByToken: getUserByToken
    };
});
app.controller("rtcCtl", function ($scope, $http, $location, Users) {
    $scope.users = Users.getList();
    $scope.log = "";
    $scope.currentuser = Users.getUser($location.path().replace("/", ""));
    $scope.addlog = function (msg) {

        $scope.log += "\r\n" + msg;
    }
    $scope.setonline = function (user) {
        if (user == null)return;
        $scope.addlog(user.name + "上线");
        user.online = true;
        $scope.$applyAsync(user.online);
    };
    $scope.setoffline = function (user) {
        $scope.addlog(user.name + "下线");
        user.online = false;
        $scope.$applyAsync(user.online);
    };
    var session = $scope.session = new RTCat.Session($scope.currentuser.token);

    session.connect();
    $scope.shareScreen = function () {
        RTCat.extensionId = "kopddpjmdlllnpkpcphndjiaohbakkjb";
        $scope.initStream({screen: true, ratio: 1.33,type:"screen"}, $scope.displayScreen);
    };
    $scope.shareCam = function () {
        $scope.initStream({video: true, audio: true, data: true,type:"video"}, $scope.display);
    };
    session.on('connected', function (users) {
        console.log('Session connected');
        for (var i = 0; i < users.length; i++) {
            $scope.setonline(Users.getUserByToken(users[i]));
        }
        $scope.setonline($scope.currentuser);

    });

    session.on('in', function (token) {
        var user = Users.getUserByToken(token);
        $scope.setonline(user);
        console.log('someone in');
        if ($scope.playinguser) {
            $scope.session.sendMessage($scope.currentuser.token, JSON.stringify({playing: $scope.playinguser.token}))
        }
    });

    session.on('out', function (token) {
        var user = Users.getUserByToken(token);
        $scope.setoffline(user);
        console.log('someone out');
    });

    setInterval(function () {
        $scope.$applyAsync($scope.users);
    }, 1000);
    session.on("local", function (sender) {
        console.log('local');
        var user = Users.getUserByToken(sender.getReceiver());
        user.receive = sender;
    });
    session.on('remote', function (r_channel) {
        console.log('remote');
        var id = r_channel.getId();

        var user = Users.getUserByToken(r_channel.getSender());
        user.receive = r_channel;
        user.receive.on('detect_net', function (netState) {
            if (netState.received > 0)
                user.netState = {
                    recieved: netState.received,
                    sent: netState.sent,
                    rtt: netState.rtt,
                    name: user.name,
                    token: user.token
                };
            //console.log(user.netState);

        })
        r_channel.on('stream', function (stream) {
            console.log('stream');
            var user = Users.getUserByToken(r_channel.getSender());

            user.stream = stream;
            user.hasVideo = stream.hasVideo();
            if (user == $scope.playinguser)
                displayStream(user.stream);
            $scope.$applyAsync(user.hasVideo);
        });
        r_channel.on('close', function () {
            console.log('close');
            var user = Users.getUserByToken(r_channel.getSender());
            user.stream = null;
        });
    });
    session.on("message", function (token, message) {
        var msg = JSON.parse(message);
        $scope.addlog(message);
        if (msg.playing) {
            var usr = Users.getUserByToken(msg.playing);
            if (usr == $scope.currentuser)
                $scope.initStream({video: true, audio: true, data: true}, $scope.display);
            $scope.playUser(usr);
        }
        if (msg.chat) {
            var usr = Users.getUserByToken(token);
            $scope.addlog(usr.name + ":" + msg.msg);
        }
    });
    $scope.brodcastuser = function (user) {
        if ($scope.playinguser == user)return;
        $scope.session.sendMessage($scope.currentuser.token, JSON.stringify({playing: user.token}));
        $scope.playUser(user);
    }
    $scope.playUser = function (user) {
        if ($scope.playinguser == user)return;
        if ($scope.playinguser && $scope.playinguser.stream)
            stopStream($scope.playinguser.stream);
        if (user == $scope.currentuser)
            stopStream($scope.currentuser.stream);
        else {
            $scope.display($scope.currentuser.stream);
        }
        displayStream(user.stream);
        $scope.playinguser = user;
        $scope.$applyAsync($scope.playinguser);
        $scope.addlog("主屏切换到" + user.name);
    }
    $scope.sendChatMsg = function () {
        $scope.session.sendMessage($scope.currentuser.token, JSON.stringify({chat: true, msg: $scope.chatmsg}));
        $scope.addlog("我:" + $scope.chatmsg);
    }
    $scope.initStream = function (options, callback) {

        console.log('initStream');
        localStream = new RTCat.Stream(options);
        localStream.on('access-accepted', function () {
                session.send({stream: localStream, data: true,attr:options.type});
                callback(localStream);
            }
        );
        localStream.on('access-failed', function (err) {
            console.log(err);
        });

        localStream.on('play-error', function (err) {
            console.log(err);
        });
        localStream.init();

    }
    // 显示流
    function displayStream(stream) {
        if (stream)
            stream.play("media");
    }

    function stopStream(stream) {
        if (stream)
            stream.stop();
    }

    // 显示流
    $scope.display = function (stream) {
        if (!stream)
            return;
        stream.play("media");
        $scope.currentuser.stream = stream;
        $scope.currentuser.hasVideo = stream.hasVideo();
        $scope.$applyAsync($scope.currentuser.hasVideo);
    }
    $scope.displayScreen=function(stream){

        if (!stream)
            return;
        stream.play("screen");
        $scope.currentuser.screenstream = stream;
        $scope.currentuser.hasVideo = stream.hasVideo();
        $scope.$applyAsync($scope.currentuser.hasVideo);
    }
});