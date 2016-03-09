var app = angular.module('app', ['ngRoute']);

app.service('Users', function ($http) {
    var users = [
        {name: "user6", token: "0cfb1079-0913-4dfd-a614-ea551556467d", online: false},
        {name: "user5", token: "02513965-3b10-406d-a037-d0c56521d5d3", online: false},
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
    $scope.log="";
    $scope.currentuser = Users.getUser($location.path().replace("/", ""));
    $scope.addlog = function (msg) {

        $scope.log += "\r\n" + msg;
    }
    $scope.setonline = function (user) {
        if (user == null)return;
        $scope.addlog (user.name + "上线");
        user.online = true;
        $scope.$applyAsync(user.online);
    };
    $scope.setoffline = function (user) {
        $scope.addlog (user.name + "下线");
        user.online = false;
        $scope.$applyAsync(user.online);
    };
    var session = $scope.session = new RTCat.Session($scope.currentuser.token);

    session.connect();

    session.on('connected', function (users) {
        console.log('Session connected');
        $scope.initStream({video: true, audio: true, data: true}, $scope.displayme);
        for (var i = 0; i < users.length; i++) {
            $scope.setonline(Users.getUserByToken(users[i]));
        }
        $scope.setonline($scope.currentuser);

    });

    session.on('in', function (token) {
        if (localStream) {
            var s = session.sendTo({to: token, stream: localStream, data: true});
            console.log(s);
        }
        var user = Users.getUserByToken(token);
        $scope.setonline(user);
        console.log('someone in');
    });

    session.on('out', function (token) {
        var user = Users.getUserByToken(token);
        $scope.setoffline(user);
        console.log('someone in');
        console.log('someone out');
    });

    setInterval(function () {
        $scope.$applyAsync($scope.users);
    }, 1000);
    session.on("local", function (sender) {
        var user = Users.getUserByToken(sender.getReceiver());
        user.receive = sender;
    });
    session.on('remote', function (r_channel) {
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
            var user = Users.getUserByToken(r_channel.getSender());
            user.stream = stream;
            user.hasVideo = stream.hasVideo();
            $scope.$applyAsync(user.hasVideo);
        });
        r_channel.on('close', function () {
            var user = Users.getUserByToken(r_channel.getSender());
            user.stream = null;
        });
        if ($scope.currentuser.zhuchi && $scope.playinguser) {
            $scope.session.sendMessage($scope.currentuser.token, JSON.stringify({playing: $scope.playinguser.token}))
        }
    });
    session.on("message", function (token, message) {
        var msg = JSON.parse(message);
        if (msg.playing) {
            var usr = Users.getUserByToken(msg.playing);
            $scope.playUser(usr);
        }
        if(msg.chat){
            var usr = Users.getUserByToken(token);
            $scope.addlog(usr.name+":"+msg.msg);
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
            $scope.playinguser.stream.stop();
        if (user == $scope.currentuser)
            $scope.currentuser.stream.stop();
        else {
            $scope.displayme($scope.currentuser.stream);
        }
        displayStream(user.stream);
        $scope.playinguser = user;
        $scope.$applyAsync($scope.playinguser);
        $scope.addlog ("主屏切换到"+user.name);
    }
    $scope.sendChatMsg=function() {
        $scope.session.sendMessage($scope.currentuser.token, JSON.stringify({chat:true, msg:$scope.chatmsg}));
        $scope.addlog("我:"+$scope.chatmsg);
    }
    $scope.initStream = function (options, callback) {
        localStream = new RTCat.Stream(options);
        localStream.on('access-accepted', function () {
                session.send({stream: localStream, data: true});
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
        stream.play("media");
    }

    // 显示流
    $scope.displayme = function (stream) {
        stream.play("me");
        $scope.currentuser.stream = stream;
        $scope.currentuser.hasVideo = stream.hasVideo();
        $scope.$applyAsync($scope.currentuser.hasVideo);
    }
});