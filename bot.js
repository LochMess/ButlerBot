var Discord = require('discord.io');
var fs = require('fs');
var help = require('./help.json');

var auth = require('./auth.json');
//var server = require('./server.json');
var serversConfig;

//check servers directory exists
if (!fs.existsSync('./servers')){
    fs.mkdirSync('./servers');
}

//check if servers.json exists and load config
if (fs.existsSync('./servers.json')){
    serversConfig = require('./servers.json');
} else{
    fs.appendFile('./servers.json', '', function(error){
        if (error) throw error;
    });
}
// console.log(serversConfig["139345322722852865"].privilegeRoles);
// console.log(serversConfig.privilegeRoles.admins.roles);
// console.log(serversConfig.commandAccessLevels);

// Initialize Discord Bot
var bot = new Discord.Client({
   token: auth.token,
   autorun: true
});
bot.on('ready', function (evt) {
    console.log('Connected');
    console.log('Logged in as: ');
    console.log(bot.username + ' - (' + bot.id + ')');
    //check for servers config files for bots servers
    Object.keys(bot.servers).forEach(function(serverID, index){
        if (!fs.existsSync('./servers/'+serverID+'.json')){
            fs.appendFile('./servers/'+serverID+'.json', '', function(error){
                if (error) throw error;
            });
        }
    });
});

function getRoleString(s) {
    return s.substring(s.indexOf('&')+1,s.indexOf('>'));
}

//TODO refactor for servers, should be depreciated
function isPrivilegedRole(r) {
    for (var role in server.privilegeRoles) {
        if (r===server.privilegeRoles[role]){
            return true;
        }
    }
    return false;
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

//TODO look at this shouldn't need to pass it anything.
function getUsers(userIds){
    return Object.values(bot.users);
}

function getAllRoleMembers(rId, sID){
    var members = getAllServerMembers(sID);
    var membersInRole = [];
    members.forEach(function(member, index){
        member.roles.forEach(function(role, index){
            if(role === rId){
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
            if(role === rId){
                membersInRole.push(member.id);
            }
        });
    });
    return membersInRole;
}

function getRoleNames(roleIdList, sID){
    var names = [];
    roleIdList.forEach(function(item,index){
        if (bot.servers[sID].roles[item].name.substring(0,1) != '@'){
            names.push(bot.servers[sID].roles[item].name);
        }
        else{
            names.push(bot.servers[sID].roles[item].name.substring(1));
        }
    });
    return names;
}

function listsIntersect(list1, list2){
    for (value of list1){
        if(list2.includes(value)){
            return true;
        }
    }
    return false;
}

function getUserAccessLevel(userId, sID){
    if(userId === serversConfig[sID].ownerID){
            return 0;
    }
    else if(listsIntersect(bot.servers[sID].members[userId].roles,serversConfig[sID].privilegeRoles.admins.roles)){
        console.log('User has admin privileges on this server');
        return serversConfig[sID].privilegeRoles.admins.accessLevel;
    }
    else if(listsIntersect(bot.servers[sID].members[userId].roles,serversConfig[sID].privilegeRoles.mods.roles)){
        console.log('User has mod privileges on this server');
        return serversConfig[sID].privilegeRoles.mods.accessLevel;
    }
    else if(listsIntersect(bot.servers[sID].members[userId].roles,serversConfig[sID].privilegeRoles.bots.roles)){
        console.log('User has bot privileges on this server');
        return serversConfig[sID].privilegeRoles.bots.accessLevel;
    }
    else if(listsIntersect(bot.servers[sID].members[userId].roles,serversConfig[sID].privilegeRoles.regulars.roles)){
        console.log('User has regular privileges on this server');
        return serversConfig[sID].privilegeRoles.regulars.accessLevel;
    }
    else {
        return 9;
    }
}

bot.on('disconnect', function(msg, code){
    if (code === 0) return console.error(msg);
    bot.connect();
});

bot.on('message', function (user, userID, channelID, message, event) {
    // if (message.substring(0, 1) === '!' && userID != serversConfig[serverID].privilegeRoles.botRole) {
    if (message.substring(0, 1) === '!') {
        console.log(message);
        console.log(bot.channels[channelID].guild_id);

        var args = message.substring(1).split(' ');
        var cmd = args[0];

//Do on a new branch.
//create object containing all the commands in a grouped structure,
//if command from group, and users roles match a role with sufficient privilege stored in the servers.json
//call a function that has a switch statement containing all those grouped commands
//Add a command that only server owners can call, !config debug:0-9, 0=owner only, 9= everyone
//get serverId when get message so can access the correct authentication

//user command level, with switch statements in the ifs for the commands for that command level.
        var serverID;
        serverID = bot.channels[channelID].guild_id;
        var userAccessLevel = 9; //set to default value of 9
        userAccessLevel = getUserAccessLevel(userID, serverID);
        var commandExecuted = false;
        console.log('User access level is: '+userAccessLevel);

        if(userAccessLevel <= serversConfig[serverID].commandAccessLevels.debug){
            console.log('if debug');
            switch(cmd) {
//DEBUG commands
                case 'run':
//TODO Dangerous remove later.
                    if ( userID === servers[serverID].ownerID && message.substring(message.indexOf(' ')).substring(0, 1) != '!'){
                        console.log(eval(message.substring(message.indexOf(' ')+1)));
                    }
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
            console.log('if general');
//General commands
            switch(cmd) {
                case 'ping':
                    bot.sendMessage({
                        to: channelID,
                        message: 'Pong!'
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
                case 'help':
                    var helpMessage = 'Current commands below, source code https://github.com/LochMess/ButlerBot\n';
                    for (var command in help) {
                        helpMessage += '!'+command+': '+help[command]+'\n';
                    }
                    bot.sendMessage({
                        to: channelID,
                        message: helpMessage
                    });
                    commandExecuted = true;
                    break;
            }
        }
        if(userAccessLevel <= serversConfig[serverID].commandAccessLevels.roleQuery && commandExecuted === false){
            console.log('if role query');
        //Role query commands
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
                        for(var id in members.map(member => member.id)){
                            if (members[id].nick === undefined || members[id].nick === null) {
                                botReply += 'U: '+usersInRole[id].username+'#'+usersInRole[id].discriminator+'\n';
                            }
                            else{
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
        if(userAccessLevel <= serversConfig[serverID].commandAccessLevels.roleChange && commandExecuted === false){
            console.log('if role change');
        //Role change commands
            switch(cmd) {
                case 'join':
                    if (args[1] != undefined) {
                        var roleId = getRoleString(args[1]);
                        var privilegedRole = isPrivilegedRole(roleId);
                        if (privilegedRole === false){
                            bot.addToRole({
                                serverID: serverID,
                                userID: userID,
                                roleID: roleId
                            }, function(error,response){
                                console.log('!join error');
                                console.log(error);
                                if(error===null){
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
                        var privilegedRole = isPrivilegedRole(roleId);
                        if (privilegedRole === false){
                            bot.removeFromRole({
                                serverID: serverID,
                                userID: userID,
                                roleID: roleId
                            }, function(error,response){
                                console.log('!leave error');
                                console.log(error);
                                if(error===null){
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
        if(userAccessLevel <= serversConfig[serverID].commandAccessLevels.roleCreation && commandExecuted === false){
            console.log('if role creation');
        //Role creation commands
            switch (cmd) {
                case 'createRole':
                    var color = message.substring(message.search('-c ')+3);
                    var colorDec = parseInt(color.substring(1), 16);
                    var name = message.substring(message.indexOf(' ')+1,message.search('-c ')).trim();
                    if (!(getAllServerRoles(serverID).map(role => role.name).includes(name)) && !(getAllServerRoles(serverID).map(role => role.color).includes(colorDec))){
                        bot.createRole(serverID, function(error, response){
                            if(error){
                                console.log(error);
                            }else{
                                console.log(response);
                                bot.editRole({
                                    serverID: serverID,
                                    roleID: response.id,
                                    name: name,
                                    mentionable: true,
                                    color: color
                                }, function(error, response){
                                    if(error){
                                        console.log(error);
                                    }else{
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
        if(userAccessLevel <= serversConfig[serverID].commandAccessLevels.roleDeletion && commandExecuted === false){
            console.log('if role deletion');
        //Role deletion commands
            switch(cmd) {
                case 'deleteRole':
                    var roleID = getRoleString(args[1]);

                    //if(getMember(userID, serverID).roles.includes(serversConfig[serverID].privilegeRoles.modRole) && args[1] != undefined && !isPrivilegedRole(roleID)){
                    if (args[1] != undefined) {
                        bot.deleteRole({
                            serverID: serverID,
                            roleID: getRoleString(args[1])
                        }, function(error, response){
                            if(error){
                                console.log(error);
                            }
                            else{
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
        else {
            //no command as executed permission issue or command issue.
        }
        console.log('if ! close');
    }//if ! close
});//on close
