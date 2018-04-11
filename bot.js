var Discord = require('discord.io');
var fs = require('fs');
var help = require('./help.json');

var auth = require('./auth.json');
var serversConfig;

//TODO add new permissions to existing config files.
if (fs.existsSync('./servers.json')) {
    serversConfig = require('./servers.json');
}
else {
    fs.appendFile('./servers.json', '{}', function(error){
        if (error) throw error;
        serversConfig = require('./servers.json');
    });
}

var bot = new Discord.Client({
   token: auth.token,
   autorun: true
});
bot.on('ready', function (evt) {
    console.log('Connected');
    console.log('Logged in as: ');
    console.log(bot.username + ' - (' + bot.id + ')');
});

function getRoleString(s) {
    return s.substring(s.indexOf('&')+1,s.indexOf('>'));
}

function getUserString(s) {
    if (s.indexOf('!') === 2) {
        return s.substring(s.indexOf('!')+1,s.indexOf('>'));
    }
    else {
        return s.substring(s.indexOf('@')+1,s.indexOf('>'));
    }
}

function isPrivilegedRole(rID, sID) {
    for (var group of Object.keys(serversConfig[sID].privilegeRoles)) {
        if (serversConfig[sID].privilegeRoles[group].roles.includes(rID)) {
            return true;
        }
    }
    return false;
}

function isRoleID(rID) {
    if (rID.length === 22 && rID.indexOf('<') === 0 && rID.indexOf('@') === 1 && rID.indexOf('&') === 2 && rID.indexOf('>') === 21 && !isNaN(Number(rID.substring(3,21)))) {
        return true
    }
    else {
        return false
    }
}

function isUserID(uID) {
    // Users with a nickname will have IDs of the form <@!numbers> users without nicknames do not have the !
    var offSet = 0;
    if (uID.indexOf('!') === 2) {
        offSet = 1;
    }
    if (uID.length === 21+offSet && uID.indexOf('<') === 0 && uID.indexOf('@') === 1 && uID.indexOf('>') === 20+offSet && !isNaN(Number(uID.substring(3,20+offSet)))) {
        return true
    }
    else {
        return false
    }
}

function getAllServerRolesIds(sID){
    return Object.keys(bot.servers[sID].roles);
}

function getAllServerRoles(sID){
    return Object.values(bot.servers[sID].roles);
}

function getAllServerChannelIds(sID){
    return Object.keys(bot.servers[sID].channels);
}

function getAllServerMemberIds(sID){
    return Object.keys(bot.servers[sID].members);
}

function getAllServerMembers(sID){
    return Object.values(bot.servers[sID].members);
}

function getMember(mId, sID){
    return bot.servers[sID].members[mId];
}

function getUsers(userIds){
    var users = [];
    userIds.forEach(function(id,index){
        users.push(bot.users[id]);
    });
    return users;
}

function getAllRoleMembers(rId, sID){
    var members = getAllServerMembers(sID);
    var membersInRole = [];
    members.forEach(function(member, index){
        member.roles.forEach(function(role, index){
            if (role === rId) {
                membersInRole.push(member);
            }
        });
    });
    return membersInRole;
}

function getAllRoleMemberIds(rId, sID){
    var members = getAllServerMembers(sID);
    var membersInRole = [];
    members.forEach(function(member, index){
        member.roles.forEach(function(role, index){
            if (role === rId) {
                membersInRole.push(member.id);
            }
        });
    });
    return membersInRole;
}

function getRoleNames(roleIdList, sID){
    var names = [];
    roleIdList.forEach(function(item,index){
        if (item != 'undefined') {
            if (bot.servers[sID].roles[item].name.substring(0,1) != '@') {
                names.push(bot.servers[sID].roles[item].name);
            }
            else {
                names.push(bot.servers[sID].roles[item].name.substring(1));
            }
        }
    });
    return names;
}

function listsIntersect(list1, list2){
    for (value of list1) {
        if (list2.includes(value)) {
            return true;
        }
    }
    return false;
}

function getUserAccessLevel(userId, sID){
    if (userId === serversConfig[sID].ownerID) {
            return 0;
    }
    else if (listsIntersect(bot.servers[sID].members[userId].roles,serversConfig[sID].privilegeRoles.admins.roles)) {
        console.log('User has admin privileges on this server');
        return serversConfig[sID].privilegeRoles.admins.accessLevel;
    }
    else if (listsIntersect(bot.servers[sID].members[userId].roles,serversConfig[sID].privilegeRoles.mods.roles)) {
        console.log('User has mod privileges on this server');
        return serversConfig[sID].privilegeRoles.mods.accessLevel;
    }
    else if (listsIntersect(bot.servers[sID].members[userId].roles,serversConfig[sID].privilegeRoles.bots.roles)) {
        console.log('User has bot privileges on this server');
        return serversConfig[sID].privilegeRoles.bots.accessLevel;
    }
    else if (listsIntersect(bot.servers[sID].members[userId].roles,serversConfig[sID].privilegeRoles.regulars.roles)) {
        console.log('User has regular privileges on this server');
        return serversConfig[sID].privilegeRoles.regulars.accessLevel;
    }
    else {
        return 9;
    }
}

function getHelpCommandDescription(hCmd, uAL, sID){
    for (var group of Object.keys(help)) {
        if (uAL <= serversConfig[sID].commandAccessLevels[group]) {
            for (var command of Object.keys(help[group])) {
                if (hCmd === command) {
                    return help[group][command];
                }
            }
        }
    }
    return 'That is not a command.';
}

function getLastMessagesFrom(userID, channelID, numberOfMessages, messageIDs, lastMessageID, callback){
    var numberOfMessagesToRetrieve = 50; // Default 50, limit 100, needs to be more than 1 for function to work.
    if (messageIDs === null) {
        var messageIDs = [];
    }

    bot.getMessages({
        channelID: channelID,
        before: lastMessageID,
        limit: numberOfMessagesToRetrieve
    }, function(error, messageArray) {
        if (error) {
            console.log(error);
        }
        else {
            // console.log(messageArray);
        }
        messageArray.forEach(function(item, index) {
            // Add check for if the message is less than 14 days old.
            var current = new Date();
            var messageDate = new Date(item.timestamp);
            // console.log(current, messageDate);
            // console.log(Math.abs(current.getTime() - messageDate.getTime()) / (1000*60*60*24) < 14);
            // console.log(item.timestamp);
            // console.log(Object.prototype.toString.call(new Date(item.timestamp+'Z')) === '[object Date]');
            if (item.author.id === userID && messageIDs.length < numberOfMessages && Math.abs(current.getTime() - messageDate.getTime()) / (1000*60*60*24) < 14) {
                messageIDs.push(item.id);
            }
            lastMessageID = item.id;
        });
        if (messageIDs.length < numberOfMessages && numberOfMessagesToRetrieve === messageArray.length) {
            // console.log('we have to go deeperLeonardoDiCaprico.jpeg');
            // console.log(messageIDs.length, numberOfMessages, numberOfMessagesToRetrieve, messageArray.length);
            getLastMessagesFrom(userID, channelID, numberOfMessages, messageIDs, lastMessageID, callback);
        }
        else {
            console.log('Calling back');
            callback(messageIDs, channelID);
        }
    });
}

function deleteMessages(messagesToDelete, channelID){
    if (messagesToDelete.length > 1) {
        // takes 2 - 100 messages so call recursively if there is more than 100 passing the undeleted through
        var endSlice;
        if (messagesToDelete.length > 100) {
            endSlice = 100;
        }
        else {
            endSlice = messagesToDelete.length;
        }
        bot.deleteMessages({
            channelID: channelID,
            messageIDs: messagesToDelete.slice(0, endSlice)
        }, function(error,response){
            if (error) {
                console.log(error);
                bot.sendMessage({
                    to: channelID,
                    message: 'Error encountered when attempting to delete messages. Bulk delete API'
                }, function(error,response){
                    if (error) {
                        console.log(error);
                    }
                    else {
                        console.log(response);
                    }
                });
            }
            else {
                console.log(response);
                if (endSlice != messagesToDelete.length) {
                    setTimeout( function() {
                        deleteMessages(messagesToDelete.slice(endSlice, messagesToDelete.length), channelID);
                    }, 1000); // Delay recusrion call by 1 second to avoid Discord API rate limiting.
                }
                bot.sendMessage({
                    to: channelID,
                    message: 'Messages deleted.'
                }, function(error,response){
                    if (error) {
                        console.log(error);
                    }
                    else {
                        console.log(response);
                    }
                });
            }
        });
    }
    else {
        bot.deleteMessage({
            channelID: channelID,
            messageID: messagesToDelete[0]
        }, function(error) {
            if (error) {
                console.log(error);
                bot.sendMessage({
                    to: channelID,
                    message: 'Error encountered when attempting to delete messages. Singular delete API.'
                }, function(error,response){
                    if (error) {
                        console.log(error);
                    }
                    else {
                        console.log(response);
                    }
                });
            }
            else {
                bot.sendMessage({
                    to: channelID,
                    message: 'Messages deleted.'
                }, function(error,response){
                    if (error) {
                        console.log(error);
                    }
                    else {
                        console.log(response);
                    }
                });
            }
        });
    }
    /*
    Bulk delete messages using single delete calls parsing an array of message IDs, delayed
    to mitigate discord API rate limiting.
    */
    // console.log(messagesToDelete, channelID);
    // if (messagesToDelete.length > 0) {
    //     console.log('Deleting message');
    //     // console.log(messagesToDelete);
    //     bot.deleteMessage({
    //         channelID: channelID,
    //         messageID: messagesToDelete[0]
    //     }, function(error) {
    //         if (error) {
    //             console.log(error);
    //         }
    //     });
    //     setTimeout( function() {
    //         deleteMessages(messagesToDelete.slice(1), channelID);
    //     }, 1000); //Delete 1 message a second to not get blocked by discord
    // }
}

function addNewServer(sID){
    var newServer = {
                        [sID]: {
                            "id": sID,
                            "ownerID": bot.servers[sID].owner_id,
                            "commandCharacter": "!",
                            "privilegeRoles": {
                                "admins": {"accessLevel": 1, "roles": []},
                                "mods": {"accessLevel": 2, "roles": []},
                                "bots": {"accessLevel": 3, "roles": []},
                                "regulars": {"accessLevel": 4, "roles": []}
                            },
                            "commandAccessLevels": {
                                "debug": 0,
                                "configBot": 0,
                                "general": 0,
                                "roleQuery": 0,
                                "roleChange": 0,
                                "roleCreation": 0,
                                "roleDeletion": 0
                            }
                        }
                    };
    if (Object.keys(serversConfig).length === 0 && serversConfig.constructor === Object) {
        fs.writeFileSync('./servers.json', JSON.stringify(newServer, null, 4));
        return JSON.parse(fs.readFileSync('./servers.json', 'utf8'));

    }
    else {
        fs.writeFileSync('./servers.json', JSON.stringify(serversConfig, null, 4).substring(0,JSON.stringify(serversConfig, null, 4).lastIndexOf('}'))+','+JSON.stringify(newServer, null, 4).substring(1));
        return JSON.parse(fs.readFileSync('./servers.json', 'utf8'));
    }
}

bot.on('disconnect', function(msg, code){
    if (code === 0) return console.error(msg);
    bot.connect();
});

bot.on('message', function (user, userID, channelID, message, event) {
    console.log(event);
    console.log(userID);
    var serverID;
    serverID = bot.channels[channelID].guild_id;
    if (!Object.keys(serversConfig).includes(serverID)) {
        console.log('Server is NOT in the config file');
//TODO Fix issue where when a new server is added to the bot it requires the bot to be restarted before the owner can set permissions.
        serversConfig = addNewServer(serverID);
        console.log(serversConfig);
    }

    if (message.substring(0, 1) === serversConfig[serverID].commandCharacter) {
        console.log(message);
        var args = message.substring(1).split(' ');
        var cmd = args[0];

        var userAccessLevel = 9; //set to default value of 9
        userAccessLevel = getUserAccessLevel(userID, serverID);

        var commandExecuted = false;
        console.log('User access level is: '+userAccessLevel);

        if (userID === serversConfig[serverID].ownerID || userAccessLevel <= serversConfig[serverID].commandAccessLevels.configBot) {
            switch(cmd) {
                case 'config':

                    if (args[1] === 'commandCharacter' && args[2] != undefined) {
                        serversConfig[serverID].commandCharacter = args[2];
                    }

                    var remove = false;
                    if (args[1] === 'remove') {
                        remove = true;
                    }
                    args.forEach(function(item, index){
                        if (Object.keys(serversConfig[serverID].privilegeRoles).includes(item) && args[index+1] != undefined) {
                            for (var i = index+1; i < args.length; i++) {
                                if (isRoleID(args[i])) {
                                    if (serversConfig[serverID].privilegeRoles[item].roles.includes(getRoleString(args[i])) && remove === true) {
                                        if (remove) {
                                            var indexToRemove = serversConfig[serverID].privilegeRoles[item].roles.indexOf(getRoleString(args[i]));
                                            if (indexToRemove > -1) {
                                                serversConfig[serverID].privilegeRoles[item].roles.splice(indexToRemove, 1);
                                            }
                                        }
                                    }
                                    if (!serversConfig[serverID].privilegeRoles[item].roles.includes(getRoleString(args[i])) && remove === false) {
                                        serversConfig[serverID].privilegeRoles[item].roles.push(getRoleString(args[i]));
                                    }
                                }
                                else {
                                    i = args.length;
                                }
                            }
                        }
                    });

                    args.forEach(function(item, index){
                        if (Object.keys(serversConfig[serverID].commandAccessLevels).includes(item) && args[index+1] != undefined && 0<= args[index+1] <=9) {
                            serversConfig[serverID].commandAccessLevels[item] = Number(args[index+1]);
                        }
                    });

                    fs.writeFile('./servers.json', JSON.stringify(serversConfig, null, 4), function(error){
                        if (error) throw error;
                        console.log('RELOADING config');
                        serversConfig = JSON.parse(fs.readFileSync('./servers.json', 'utf8'));
                        console.log(serversConfig);
                    });
                    commandExecuted = true;
                    break;
                case 'configShow':
                    bot.sendMessage({
                        to: channelID,
                        message: JSON.stringify(serversConfig[serverID], null, 4)
                    });
                    commandExecuted = true;
                    break;
            }
        }
        if (userAccessLevel <= serversConfig[serverID].commandAccessLevels.moderation && commandExecuted === false) {
            switch(cmd) {
                case 'deleteUserMessages':
                    if (isUserID(args[1])) {
                        if (userAccessLevel < getUserAccessLevel(getUserString(args[1]), serverID) && Number.isInteger(Number(args[2])) && 1 <= Number(args[2]) <= 500) {
                            console.log('Number of messages to delete validated');
                            getLastMessagesFrom(getUserString(args[1]), channelID, args[2], null, null, deleteMessages);
                        }
                    }
                    commandExecuted = true;
                    break;
                case 'addUserTo':
                    console.log('addUserTo');
                    console.log(args[1], isUserID(args[1]), args[2], isRoleID(args[2]));
                    if (isUserID(args[1]) && isRoleID(args[2])) {
                        console.log('passed user id and role id');
                        if (isPrivilegedRole(getRoleString(args[2]), serverID) === false && userAccessLevel < getUserAccessLevel(getUserString(args[1]), serverID)) {
                            console.log('sending add request');
                            bot.addToRole({
                                serverID: serverID,
                                userID: getUserString(args[1]),
                                roleID: getRoleString(args[2])
                            }, function(error,response){
                                console.log('!join error');
                                console.log(error);
                                if (error === null) {
                                    bot.sendMessage({
                                        to: channelID,
                                        message: 'Congratulations <@'+getUserString(args[1])+'> you\'ve been added to @'+bot.servers[serverID].roles[getRoleString(args[2])].name
                                    });
                                }
                                console.log('!join response');
                                console.log(response);
                            });
                        }
                    }

                    commandExecuted = true;
                    break;
                case 'removeUserFrom':
                    console.log('addUserTo');
                    console.log(args[1], isUserID(args[1]), args[2], isRoleID(args[2]));
                    if (isUserID(args[1]) && isRoleID(args[2])) {
                        console.log('passed user id and role id');
                        if (isPrivilegedRole(getRoleString(args[2]), serverID) === false && userAccessLevel < getUserAccessLevel(getUserString(args[1]), serverID)) {
                            console.log('sending add request');
                            bot.removeFromRole({
                                serverID: serverID,
                                userID: getUserString(args[1]),
                                roleID: getRoleString(args[2])
                            }, function(error,response){
                                console.log('!join error');
                                console.log(error);
                                if (error === null) {
                                    bot.sendMessage({
                                        to: channelID,
                                        message: 'Congratulations <@'+getUserString(args[1])+'> you\'ve been removed from @'+bot.servers[serverID].roles[getRoleString(args[2])].name
                                    });
                                }
                                console.log('!leave response');
                                console.log(response);
                            });
                        }
                    }
                    commandExecuted = true;
                    break;
            }
        }
        if (userAccessLevel <= serversConfig[serverID].commandAccessLevels.debug && commandExecuted === false) {
            switch(cmd) {
                case 'test':
                    console.log(0 <= Number('123456') <= 999999999999999999, Number('123456'));
                    console.log(!isNaN(Number('123456')), Number('123456'));
                    commandExecuted = true;
                    break;
                case 'sfull':
                    console.log(bot.servers[serverID]);
                    commandExecuted = true;
                    break;
                case 'rfull':
                    console.log(getAllServerRoles(serverID));
                    commandExecuted = true;
                    break;
            }
        }
        if (userAccessLevel <= serversConfig[serverID].commandAccessLevels.general && commandExecuted === false) {
            switch(cmd) {
                case 'ping':
                    bot.sendMessage({
                        to: channelID,
                        message: 'Pong!'
                    });
                    bot.getMessages({
                        channelID: channelID,
                        limit: 1
                    }, function(error, messageArray) {
                        if (error) {
                            console.log(error);
                        }
                        else {
                            // console.log(messageArray);
                            // console.log(messageArray[0].id);
                            bot.addReaction({
                                channelID: channelID,
                                messageID: messageArray[0].id,
                                // reaction: "🍰"
                                // https://emojipedia.org/ok-hand-sign/
                                reaction: "👌"
                            }, function(error, response) {
                                if (error) {
                                    console.log(error);
                                }
                                else {
                                    console.log(response);
                                }
                            });
                        }
                    });
                    commandExecuted = true;
                    break;
                case 'lookbusy':
                    bot.simulateTyping(
                        channelID
                    );
                    commandExecuted = true;
                    break;
                case 'google':
                    if (args[1] != undefined) {
                        bot.sendMessage({
                            to: channelID,
                            message: 'https://www.google.com.au/search?q='+args.slice(1).join('+')
                        });
                    }
                    commandExecuted = true;
                    break;
                case 'source':
                    bot.sendMessage({
                        to: channelID,
                        message: 'https://github.com/LochMess/ButlerBot'
                    });
                    commandExecuted = true;
                    break;
                case 'help':
                    var helpMessage = '';
                    if (args[1] === undefined) {
                        helpMessage += 'You have access to the following commands, to learn more about a command use !help <command>\n'
                        Object.keys(help).forEach(function(item, index){
                            if (userAccessLevel <= serversConfig[serverID].commandAccessLevels[item]) {
                                helpMessage += serversConfig[serverID].commandCharacter+Object.keys(help[item]).join('\n'+serversConfig[serverID].commandCharacter)+'\n';
                            }
                        });
                    }
                    else {
                        helpMessage += getHelpCommandDescription(args[1], userAccessLevel, serverID);
                    }

                    bot.sendMessage({
                        to: channelID,
                        message: helpMessage
                    });
                    commandExecuted = true;
                    break;
                case 'deleteMessages':
                    console.log('running deleteMessages');

                    if (Number.isInteger(Number(args[1])) && 1 <= Number(args[1]) <= 500) {
                        console.log('Number of messages to delete validated');
                        getLastMessagesFrom(userID, channelID, args[1], null, null, deleteMessages);
                    }

                    // getLastMessagesFrom(userID, channelID, 10, null, null, function(messagesToDelete){
                    //     console.log('getLastMessagesFrom callback executing to remove the following messages');
                    //     console.log(messagesToDelete);
                    //     //TODO must pass at least 2 messages and at max 100...
                    //     //TODO can only bulk delete messages that are less than 14 days old...
                    //     // bot.deleteMessages({
                    //     //     channelID: channelID,
                    //     //     messageIDs: messagesToDelete
                    //     // }, function(error,response){
                    //     //     if (error) {
                    //     //         console.log(error);
                    //     //         bot.sendMessage({
                    //     //             to: channelID,
                    //     //             message: 'Error encountered when attempting to delete messages.'
                    //     //         }, function(error,response){
                    //     //             if (error) {
                    //     //                 console.log(error);
                    //     //             }
                    //     //             else {
                    //     //                 console.log(response);
                    //     //             }
                    //     //         });
                    //     //     }
                    //     //     else {
                    //     //         console.log(response);
                    //     //         bot.sendMessage({
                    //     //             to: channelID,
                    //     //             message: 'Messages deleted.'
                    //     //         }, function(error,response){
                    //     //             if (error) {
                    //     //                 console.log(error);
                    //     //             }
                    //     //             else {
                    //     //                 console.log(response);
                    //     //             }
                    //     //         });
                    //     //     }
                    //     // });
                    //
                    // });
                    console.log('execution after function call resumed.');
                    commandExecuted = true;
                    break;
            }
        }
        if (userAccessLevel <= serversConfig[serverID].commandAccessLevels.roleQuery && commandExecuted === false) {
            switch(cmd) {
                case 'roles':
                    bot.sendMessage({
                        to: channelID,
                        message: 'The current roles on the server are: '+getRoleNames(getAllServerRolesIds(serverID), serverID).join(', ')
                    });
                    commandExecuted = true;
                    break;
                case 'myRoles':
                    var member = getMember(userID, serverID);
                    bot.sendMessage({
                        to: channelID,
                        message: 'You\'re roles are: '+getRoleNames(member.roles, serverID).join(', ')
                    });
                    commandExecuted = true;
                    break;
                case 'roleMembers':
                    if (args[1] != undefined) {
                        var members = getAllRoleMembers(getRoleString(args[1]), serverID);
                        var usersInRole = getUsers(members.map(member => member.id));
                        var botReply = '';
                        for (var id in members.map(member => member.id)) {
                            if (members[id].nick === undefined || members[id].nick === null) {
                                botReply += 'U: '+usersInRole[id].username+'#'+usersInRole[id].discriminator+'\n';
                            }
                            else {
                                botReply += 'U: '+usersInRole[id].username+'#'+usersInRole[id].discriminator+' N: '+members[id].nick+'\n';
                            }
                        }
                    }
                    bot.sendMessage({
                        to: channelID,
                        message: botReply
                    });
                    commandExecuted = true;
                    break;
            }
        }
        if (userAccessLevel <= serversConfig[serverID].commandAccessLevels.roleChange && commandExecuted === false) {
            switch(cmd) {
                case 'join':
                    if (args[1] != undefined) {
                        var roleId = getRoleString(args[1]);
                        var privilegedRole = isPrivilegedRole(roleId, serverID);
                        if (privilegedRole === false) {
                            bot.addToRole({
                                serverID: serverID,
                                userID: userID,
                                roleID: roleId
                            }, function(error,response){
                                console.log('!join error');
                                console.log(error);
                                if (error === null) {
                                    bot.sendMessage({
                                        to: channelID,
                                        message: 'Congratulations <@'+userID+'> you\'ve been added to @'+bot.servers[serverID].roles[roleId].name
                                    });
                                }
                                console.log('!join response');
                                console.log(response);
                            });
                        }
                    }
                    commandExecuted = true;
                    break;
                case 'leave':
                    if (args[1] != undefined) {
                        var roleId = getRoleString(args[1]);
                        var privilegedRole = isPrivilegedRole(roleId, serverID);
                        if (privilegedRole === false) {
                            bot.removeFromRole({
                                serverID: serverID,
                                userID: userID,
                                roleID: roleId
                            }, function(error,response){
                                console.log('!leave error');
                                console.log(error);
                                if (error === null) {
                                    bot.sendMessage({
                                        to: channelID,
//TODO look to see if can colour message text the same as the colour of the role.
                                        message: 'Congratulations <@'+userID+'> you\'ve left @'+bot.servers[serverID].roles[roleId].name
                                    });
                                }
                                console.log('!leave response');
                                console.log(response);
                            });
                        }
                    }
                    commandExecuted = true;
                    break;
            }
        }
        if (userAccessLevel <= serversConfig[serverID].commandAccessLevels.roleCreation && commandExecuted === false) {
            switch (cmd) {
                case 'createRole':
                    var color = message.substring(message.search('-c ')+3);
                    var colorDec = parseInt(color.substring(1), 16);
                    var name = message.substring(message.indexOf(' ')+1,message.search('-c ')).trim();
                    if (!(getAllServerRoles(serverID).map(role => role.name).includes(name)) && !(getAllServerRoles(serverID).map(role => role.color).includes(colorDec))) {
                        bot.createRole(serverID, function(error, response){
                            if (error) {
                                console.log(error);
                            }
                            else {
                                console.log(response);
                                bot.editRole({
                                    serverID: serverID,
                                    roleID: response.id,
                                    name: name,
                                    mentionable: true,
                                    color: color
                                }, function(error, response){
                                    if (error) {
                                        console.log(error);
                                    }
                                    else {
                                        console.log(response);
                                        bot.sendMessage({
                                            to: channelID,
                                            message: 'New role <@&'+response.id+'> created.'
                                        });
                                    }
                                });
                            }
                        });
                    }
                    else {
                        bot.sendMessage({
                            to: channelID,
                            message: 'Name or color already taken.'
                        });
                    }
                    commandExecuted = true;
                    break;
            }
        }
        if (userAccessLevel <= serversConfig[serverID].commandAccessLevels.roleDeletion && commandExecuted === false) {
            switch(cmd) {
                case 'deleteRole':
                    var roleID = getRoleString(args[1]);
                    if (args[1] != undefined) {
                        bot.deleteRole({
                            serverID: serverID,
                            roleID: getRoleString(args[1])
                        }, function(error, response){
                            if (error) {
                                console.log(error);
                            }
                            else {
                                console.log(response);
                                bot.sendMessage({
                                    to: channelID,
                                    message: 'Role deleted. Like totally forever RIP.'
                                });
                            }
                        });
                    }
                    commandExecuted = true;
                    break;
            }
        }
        if (commandExecuted === false) {
            bot.sendMessage({
                to: channelID,
                message: 'Sorry that is not a command or you do not have access to it. More help coming soon! Try !help'
            });
        }
    }
});//on close
