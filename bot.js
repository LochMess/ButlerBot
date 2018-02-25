var Discord = require('discord.io');
var fs = require('fs');
var help = require('./help.json');

var auth = require('./auth.json');
var server = require('./server.json');

//check servers directory exists
if (!fs.existsSync('./servers')){
    fs.mkdirSync('./servers');
}

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

function isPrivilegedRole(r) {
    for (var role in server.privilegeRoles) {
        if (r===server.privilegeRoles[role]){
            return true;
        }
    }
    return false;
}

function getAllServerRolesIds(){
    return Object.keys(bot.servers[server.id].roles);
}

function getAllServerRoles(){
    return Object.values(bot.servers[server.id].roles);
}

function getAllServerChannelIds(){
    return Object.keys(bot.servers[server.id].channels);
}

function getAllServerMemberIds(){
    return Object.keys(bot.servers[server.id].members);
}

function getAllServerMembers(){
    return Object.values(bot.servers[server.id].members);
}

function getMember(mId){
    return bot.servers[server.id].members[mId];
}

function getUsers(userIds){
    return Object.values(bot.users);
}

function getAllRoleMembers(rId){
    var members = getAllServerMembers();
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

function getAllRoleMemberIds(rId){
    var members = getAllServerMembers();
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

function getRoleNames(roleIdList){
    var names = [];
    roleIdList.forEach(function(item,index){
        if (bot.servers[server.id].roles[item].name.substring(0,1) != '@'){
            names.push(bot.servers[server.id].roles[item].name);
        }
        else{
            names.push(bot.servers[server.id].roles[item].name.substring(1));
        }
    });
    return names;
}

bot.on('disconnect', function(msg, code){
    if (code === 0) return console.error(msg);
    bot.connect();
});

bot.on('message', function (user, userID, channelID, message, event) {
    if (message.substring(0, 1) === '!' && userID != server.privilegeRoles.botRole) {
        console.log(message);

        var args = message.substring(1).split(' ');
        var cmd = args[0];

        switch(cmd) {
//DEBUG commands
            case 'run':
//TODO Dangerous remove later.
                if ( userID === server.ownerID && message.substring(message.indexOf(' ')).substring(0, 1) != '!'){
                    console.log(eval(message.substring(message.indexOf(' ')+1)));
                }
                break;
            case 'sfull':
                console.log(bot.servers[server.id]);
                break;
            case 'rfull':
                console.log(getAllServerRoles());
                break;
            //General commands
            case 'ping':
                bot.sendMessage({
                    to: channelID,
                    message: 'Pong!'
                });
                break;
            case 'lookbusy':
                bot.simulateTyping(
                    channelID
                );
                break;
            case 'google':
                if (args[1] != undefined) {
                    bot.sendMessage({
                        to: channelID,
                        message: 'https://www.google.com.au/search?q='+args.slice(1).join('+')
                    });
                }
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
                break;
//Role query commands
            case 'roles':
                bot.sendMessage({
                    to: channelID,
                    message: 'The current roles on the server are: '+getRoleNames(getAllServerRolesIds()).join(', ')
                });
                break;
            case 'myRoles':
                var member = getMember(userID);
                bot.sendMessage({
                    to: channelID,
                    message: 'You\'re roles are: '+getRoleNames(member.roles).join(', ')
                });
                break;
            case 'roleMembers':
                if (args[1] != undefined) {
                    var members = getAllRoleMembers(getRoleString(args[1]));
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
                break;
//Role change commands
            case 'join':
                if (args[1] != undefined) {
                    var roleId = getRoleString(args[1]);
                    var privilegedRole = isPrivilegedRole(roleId);
                    if (privilegedRole === false){
                        bot.addToRole({
                            serverID: server.id,
                            userID: userID,
                            roleID: roleId
                        }, function(error,response){
                            console.log('!join error');
                            console.log(error);
                            if(error===null){
                                bot.sendMessage({
                                    to: channelID,
                                    message: 'Congratulations <@'+userID+'> you\'ve been added to @'+bot.servers[server.id].roles[roleId].name
                                });
                            }
                            console.log('!join response');
                            console.log(response);
                        });
                    }
                }
                break;
            case 'leave':
                if (args[1] != undefined) {
                    var roleId = getRoleString(args[1]);
                    var privilegedRole = isPrivilegedRole(roleId);
                    if (privilegedRole === false){
                        bot.removeFromRole({
                            serverID: server.id,
                            userID: userID,
                            roleID: roleId
                        }, function(error,response){
                            console.log('!leave error');
                            console.log(error);
                            if(error===null){
                                bot.sendMessage({
                                    to: channelID,
            //TODO look to see if can colour message text the same as the colour of the role.
                                    message: 'Congratulations <@'+userID+'> you\'ve left @'+bot.servers[server.id].roles[roleId].name
                                });
                            }
                            console.log('!leave response');
                            console.log(response);
                        });
                    }
                }
                break;
//Role creation commands
            case 'createRole':
                var color = message.substring(message.search('-c ')+3);
                var colorDec = parseInt(color.substring(1), 16);
                var name = message.substring(message.indexOf(' ')+1,message.search('-c ')).trim();
                if (!(getAllServerRoles().map(role => role.name).includes(name)) && !(getAllServerRoles().map(role => role.color).includes(colorDec))){
                    bot.createRole(server.id, function(error, response){
                        if(error){
                            console.log(error);
                        }else{
                            console.log(response);
                            bot.editRole({
                                serverID: server.id,
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
                break;
//Role deletion commands
            case 'deleteRole':
                var roleID = getRoleString(args[1]);
                if(getMember(userID).roles.includes(server.privilegeRoles.modRole) && args[1] != undefined && !isPrivilegedRole(roleID)){
                    bot.deleteRole({
                        serverID: server.id,
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
                break;
            default:
                bot.sendMessage({
                    to: channelID,
                    message: 'Sorry that is not a command, more help coming soon! Try !help'
                });
         }
     }
});
