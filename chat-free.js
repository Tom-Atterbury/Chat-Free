
/**
 * Module dependencies.
 */

var express = require('express')
var app = express();
var port = 3196;
var clients = [];
var users = [];

require('./routes/index')(app);

app.set('port',port);
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.engine('html', require('ejs').renderFile);

var socketIO 	= require('socket.io');
var routes = require('./routes');
var http = require('http');
var path = require('path');

var server = http.createServer(app).listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'));
});

var io = socketIO.listen(server);
app.set('io',io);

var addClient = function(socket, username){
  // If the list is empty and the socket is not already in the list
  if(clients === undefined || getClientIndex(socket) === -1)
    clients.push({socket:socket, username:username});
  if(username.toLowerCase() !== "guest") addUser(username);
};

var removeClient = function(socket) {
  var index = getClientIndex(socket);
  if(index === -1){
    console.log("Socket is not in the list.");
    return;
  }
  var client = clients[index];
  removeUser(client.username);
  clients.splice(index, 1);
};

var getClientIndex = function(socket){
  // Search for socket in client array
  var index;
  for(index = 0; index < clients.length; index++){
    var client = clients[index];
    if(client.socket === socket)
      return index; // Found, return index number
  }
  return -1; // Not found return -1
};

var setClientName = function(socket, username){
  var index = getClientIndex(socket);
  if(index === -1){
    console.log("Socket not found.");
    return false; // Failure
  }

  if(addUser(username) || username == "guest"){
    clients[index].username = username;
    return true; // Success
  }

  return false; // Username not unique
};

var addUser = function(username) {
  if(users !== undefined && users.indexOf(username) !== -1 || username === "guest"){
    console.log("User already in list or restricted.");
    return false; // User already exists
  }

  users.push(username);
  return true; // Success
};

var removeUser = function(username) {
  var index = users.indexOf(username);
  console.log("Removing " + username + ": " + index);
  if(index !== -1) users.splice(index,1);
}

io.sockets.on('connection',function(socket){
  // Add the connection to the list of clients
  if(clients.indexOf(socket) === -1){
    console.log("Client connected.");
    addClient(socket,"guest");
  }

  // Handle user post message
  socket.on('post', function(data){
    console.log("Message from client");
    var index = getClientIndex(socket);
    if(index === -1) {
      console.log("Socket not found");
    } else {
      io.sockets.emit('message', clients[index].username + ": " + data);
    }
  });

  // Handle user login
  socket.on('login', function(username){
    // Add user to list, if unique, and not a restricted name
    if(username !== undefined && 
       users.indexOf(username) === -1 && 
       username.toLowerCase().trim() !== "guest" && 
       setClientName(socket,username)){
      
      console.log(username + " has made a name for themself!");
      socket.emit('login_response', true, username);
      io.sockets.emit('user_list_update',users);
    } else {
      socket.emit('login_response', false, "guest");
    }
  });

  // Handle user disconnect
  socket.on('disconnect', function(){
    // If the user refreshes or leaves the page, remove them from the user list
    var index = getClientIndex(socket);
    if(index === -1)
      console.log("Disconnected early, cannot retreive username");
    else{
      removeClient(socket);
      io.sockets.emit('user_list_update',users);
    }
  });

  // Handle user logout
  socket.on('logout', function(username) {
    console.log(username + " has logged out.");

    // remove the username from the user list
    removeUser(username);
    setClientName(socket,"guest");

    // Inform others user has disconnected
    io.sockets.emit('user_list_update',users);
  });

  // Handle request for connected user list
  socket.on('get_users',function(){
    io.sockets.emit('user_list_update',users);
  });

});

app.use(function(err, request, response, next){
  console.error(err.stack);
  response.status(500).send('Something broke!');
})
