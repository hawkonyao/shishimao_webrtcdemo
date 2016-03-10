var app = angular.module('app', ['ngRoute']);

app.service('Users', function ($http) {
    var users = [
        {
            name: "user6",
            token: "0cfb1079-0913-4dfd-a614-ea551556467d",
            online: false
        },
        {
            name: "user5",
            token: "02513965-3b10-406d-a037-d0c56521d5d3",
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
    $scope.freecontainerid="main";
    var session = $scope.session = new RTCat.Session($scope.currentuser.token);
    $scope.online = function () {
        console.log('online');
        session.connect();
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
    $scope.addlog = function (msg) {
        $scope.log += "\r\n" + msg;
    }
    $scope.brodcastuser = function (user) {
        console.log('brodcastuser' + user.name);
        if ($scope.playinguser == user)return;
        $scope.playinguser = user;
        $scope.session.sendMessage($scope.currentuser.token, JSON.stringify({playing: user.token}));
        $scope.$applyAsync($scope.playinguser);
        $scope.addlog("主屏切换到" + user.name);
    }
    $scope.shareCam = function () {
        $scope.stopCam();
        $scope.initStream({video: true, audio: true, data: true, attr: {type: 'video',containerId:$scope.freecontainerid}}, $scope.play);
    }
    $scope.stopCam = function () {
        $scope.closeVideo();
    }
    $scope.shareScreen = function () {
        $scope.stopScreen();
        RTCat.extensionId = "kopddpjmdlllnpkpcphndjiaohbakkjb";
        $scope.initStream({screen: true, data: true, attr: {type: 'screen',containerId:$scope.freecontainerid}}, $scope.play);
    }
    $scope.stopScreen = function () {
        $scope.closeScreen();
    }
    $scope.changePlay = function () {
        $scope.currentuser.videoStream.stop();
        $scope.currentuser.screenStream.stop();
        $scope.play($scope.currentuser.videoStream,  $scope.currentuser.videoStream.containerid == "main" ? "second" : "main");
        $scope.play($scope.currentuser.screenStream,  $scope.currentuser.screenStream.containerid == "main" ? "second" : "main");
    }
    $scope.change = function () {
        $scope.session.sendMessage($scope.currentuser.token, JSON.stringify({change: true}));
        $scope.changePlay();
    }
    $scope.play = function (stream, containerid) {
        if (stream) {
            stream.play(containerid);
            stream.containerid = containerid;
            console.log('stream.play("' + containerid + '")');
        }
    }
    $scope.stop = function (stream) {
        if (stream) {
            stream.stop();
            console.log('stream.stop()');
            $scope.freecontainerid=stream.containerid;
        }
    }
    $scope.stopAll=function(){
        $scope.closeScreen();
        $scope.closeVideo();
        $scope.playinguser=null;
        $scope.freecontainerid="main";
    }
    $scope.closeScreen=function(){
        if (!$scope.currentuser.screensender)
            return;
        for (var i = 0; i < $scope.currentuser.screensender.length; i++) {
            $scope.currentuser.screensender[i].close();
        }
        $scope.currentuser.screensender = [];
        $scope.stop($scope.currentuser.screenStream);
        $scope.currentuser.screenStream=null;
    }
    $scope.closeVideo=function(){
        if (!$scope.currentuser.videosender)
            return;
        for (var i = 0; i < $scope.currentuser.videosender.length; i++) {
            $scope.currentuser.videosender[i].close();
        }
        $scope.currentuser.videosender = [];
        $scope.stop($scope.currentuser.videoStream);
        $scope.currentuser.videoStream=null;
    }
    $scope.stopShare = function () {
        $scope.stopAll();
        $scope.session.sendMessage($scope.currentuser.token, JSON.stringify({stopShare: true}));
    }
    $scope.toggleVideo = function () {
        $scope.currentuser.videoStream.toggleVideo();
        $scope.currentuser.screenStream.toggleVideo();
    }
    $scope.initStream = function (options, callback) {
        $scope.freecontainerid=options.attr.containerId=="main"?"second":"main";
        var localStream = new RTCat.Stream(options);
        localStream.on('access-accepted', function () {
                session.send({stream: localStream, data: true, attr: options.attr});
                callback(localStream, options.attr.containerId);
            }
        );
        localStream.on('access-failed', function (err) {
            console.log(err);
        });

        localStream.on('play-error', function (err) {
            console.log(err);
        });
        localStream.init();
        if (options.attr.type == "video")
            $scope.currentuser.videoStream = localStream;
        if (options.attr.type == "screen")
            $scope.currentuser.screenStream = localStream;
    }


    session.on('connected', function (users) {
        console.log('Session connected');
        //获取所有在线用户的token
        for (var i = 0; i < users.length; i++) {
            $scope.setonline(Users.getUserByToken(users[i]));
        }
        $scope.setonline($scope.currentuser);
    });
    session.on('in', function (token) {
        console.log('someone in');
        var user = Users.getUserByToken(token);
        $scope.setonline(user);
    });

    session.on('out', function (token) {
        console.log('someone out');
        var user = Users.getUserByToken(token);
        $scope.setoffline(user);
    });
    session.on("local", function (sender) {
        console.log('local');
        //var user = Users.getUserByToken(sender.getReceiver());
        if(sender.attr.type=="video") {
            if (!$scope.currentuser.videosender)
                $scope.currentuser.videosender = [];
            $scope.currentuser.videosender.push(sender);
        }
        if(sender.attr.type=="screen") {
            if (!$scope.currentuser.screensender)
                $scope.currentuser.screensender = [];
            $scope.currentuser.screensender.push(sender);
        }
    });

    session.on('remote', function (r_channel) {
        console.log('remote');
        var id = r_channel.getId();
        var user = Users.getUserByToken(r_channel.getSender());
        user.receive = r_channel;
        r_channel.on('detect_net', function (netState) {
            if (netState.received > 0)
                user.netState = {
                    recieved: netState.received,
                    sent: netState.sent,
                    rtt: netState.rtt,
                    name: user.name,
                    token: user.token
                };
        });
        r_channel.on('stream', function (stream) {
            console.log('r_channel.stream');
            var user = Users.getUserByToken(r_channel.getSender());
            $scope.play(stream, r_channel.attr.containerId);
            if (r_channel.attr.type == "video")
                $scope.currentuser.videoStream = stream;
            if (r_channel.attr.type == "screen")
                $scope.currentuser.screenStream = stream;
        });
        r_channel.on('close', function () {
            console.log('r_channel.close');
            var user = Users.getUserByToken(r_channel.getSender());
        });
    });

    session.on("message", function (token, message) {
        console.log('message:' + message);
        var msg = JSON.parse(message);
        if (msg.playing) {
            var user = Users.getUserByToken(msg.playing);
            $scope.addlog("主屏切换到" + user.name);
            if (user == $scope.currentuser)
                $scope.shareCam();
            else if($scope.playinguser==$scope.currentuser) {
                $scope.stopAll();
            }
            $scope.playinguser = user;
            $scope.$applyAsync($scope.playinguser);
        }
        if (msg.chat) {
            var usr = Users.getUserByToken(token);
            $scope.addlog(usr.name + ":" + msg.msg);
        }
        if (msg.change) {
            $scope.changePlay();
        }
        if (msg.stopShare) {
            $scope.playinguser=null;
        }
    });
    $scope.online();

    setInterval(function () {
        $scope.$applyAsync($scope.users);
    }, 1000);
});