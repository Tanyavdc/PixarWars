

var WebSocketServer = require('ws').Server;
var wss = new WebSocketServer({port: 10460});
var stage = null;
var players = [];
var count = 0;
var stage  = new Stage(20,20,"stage");
var world1 = new World("monstersInc");
var world2 = new World("incredibles");
var world3= new World("nemo");
var worlds = [];
var killCounts = [];
var initializedStage1;
var initializedStage2;
var initializedStage3;
var initializeGame;
var is_setup = false;
//var clientCopy = getClientCopy();


wss.broadcast = function(message){
	var i;
	for(i=0;i<this.clients.length;i++){	
		this.clients[i].send(message);
	}
}


// WORLD CLASS
function World(name){
	this.name = name;
	this.actors = [];
	this.players = [];
	this.killcounts=[]; 
}


// check if a monster's move is valid
function is_valid(world, rx, ry){
	// out of bounds 
	if ((rx >= 20) || (rx <= 1) || (ry >= 20) || (ry <= 1)) {
		return false;
	}
	// check if the requested position is occupied 	
	for (var i = 0; i < world.actors.length; i++){
		if (world.actors[i][2] == rx && world.actors[i][3] == ry){
	//		if (stage.clientActors[i][0] == "player" ){
	//			return true;
	//		}
	//		else {   //then obstruction is a box or wall 
				return false;
	//			}
	
			}
		}
	return true;
   }


// check if a position on the stage is occupied 
function is_occupied(world,x,y){
	for (var i = 0; i < world.actors.length; i++){
		if(world.actors[i][2] == x && world.actors[i][3] == y){
			return true;
		}
	
	}
	return false;
}



function setup_customworld(name){
	// create the custom world 
	var w = new World (name);
	// initialize the stage for this world
	initialize(w);
	return w; 
}

// put worlds list into a string of the world names, so that client can display them
function stringify_worlds(){
	worlds_string=[];
	for(var i=0; i < worlds.length; i++){
		worlds_string.push(worlds[i].name);
	}
	return worlds_string;
}
function stingify_killcounts(){
	killcounts_list=[];

	for(var i=0; i < worlds.length; i++){
		var w = worlds[i];
		// killcounts in world w
		var killcounts = [];
		for (var j=0; j < w.killcounts.length; j++){
			killcounts.push(w.killcounts[j]);
		}
		killcounts_list.push(killcounts);
		
	}
	console.log("the kill counts" + killcounts_list);
	return killcounts_list;

}
// put the players list into a string so that the client can display them 
function stringify_players(){
	players_list=[];
	for(var i=0; i < worlds.length; i++){
		var w = worlds[i];
		// players in world w
		var players = [];
		for (var j=0; j < w.players.length; j++){
			players.push(w.players[j]);
		}
		
		players_list.push(players);

	}
	return players_list;
	
}

function kill_monster(world, id)  {                              // REMOVES A MONSTER FROM ACTORS
		for (var i = 0; i < world.actors.length; i ++){
			var a = world.actors[i];
			// if this is the monster at position 
			if (a[1] == id){
				// remove monster from worlds actors
				console.log("killing monster");
				world.actors.splice(i, 1);
				return;
			}
		} 
		}  

function get_world_killcounts(world){
	killcounts=[];
	for(var i=0; i<world.killcounts.length; i++){
		killcounts.push(world.killcounts[i]);
	}

	return killcounts;
	}

wss.on('connection', function(ws) {
    // if server just started 
	if (!is_setup){
           initialize(world1);
		   initialize(world2);
		   initialize(world3);
		   is_setup = true;
		   startGame();
	}
	
	// send list of worlds to new client


	ws.send(JSON.stringify({operation: "pre_setup", worlds: stringify_worlds(), players: stringify_players()}));
	// client sent a message 
	ws.onmessage = function(e) {
		var world;  // holds the world that the message came from 
		console.log("got a client message " + e.data);
		var broadcast_msg;
		// handle message 
		var msg = JSON.parse(e.data);
		// a new player wants to join
		if (msg.operation == "new_client"){
	
			// the new client has created a custom world
			if (msg.custom == true){
			    console.log("creating a custom world");
			    world = setup_customworld(msg.world);

			}
			//player chose an existing world 
			else{
				world = get_world(msg.world);
			}
			// create the new player

			var new_player = add_newplayer(world);
			// send the new player their world
	 
			var counts = get_world_killcounts(world);
		

		
			ws.send(JSON.stringify({world: msg.world, operation: "setup", actors: actorsToJSON(world), kill_counts: get_world_killcounts(world)}));
			// tell other players that a new player has joined 
			wss.broadcast(JSON.stringify({world: msg.world, operation: "new_player", id: new_player[1], x: new_player[2], y: new_player[3]}));    // GIVE A SRC IMG 
		}
		// a player wants to move 
		if (msg.operation == "move"){
			// the world that this message came from
			world = get_world(msg.world);
			// update this players co-ordinates on master stage 
			move_actor(world,msg.id, msg.dx, msg.dy);
			// tell all other clients that this player has moved 
			if (msg.box){

				wss.broadcast(JSON.stringify({world: msg.world, operation: "move_player",  id: msg.id, pushed_by: msg.pushed_by, box:true, dx: msg.dx, dy: msg.dy})); 
			}
			else {
				wss.broadcast(JSON.stringify({world: msg.world, operation: "move_player", id: msg.id, pushed_by: msg.pushed_by, box:false, dx: msg.dx, dy: msg.dy})); 
			}	
		}
			
		if(msg.operation == "dead"){
			world = get_world(msg.world);
			//update this players killcount 
			// get the player
			var index = (world.players).indexOf(msg.killed_by);
		    world.killcounts[index] += 1;
			kill_monster(world, msg.id);					//	 KILL THE MONSTER 
		                             
		
			wss.broadcast(JSON.stringify({world: msg.world, operation: "update_killCount", monster_id: msg.id, killed_by: msg.killed_by, x:msg.x, y:msg.y})); 
		}
		if(msg.operation == "playerDied"){

			world = get_world(msg.world);
	
			for (var i=0; i<world.actors.length; i++){
				if(world.actors[i][1] == msg.id){
				
					world.actors.splice(i, 1);
					break;
				}
			}
			for(var i=0; i<world.players.length; i ++){
				if(world.players[i] == msg.id){
					world.killcounts.splice(i,1);
					world.players.splice(i,1);
					}
			}
					
					wss.broadcast(JSON.stringify({world: msg.world, operation: "player_isDead", id: msg.id, x: msg.x, y: msg.y})); 
			}
			
	
		}		
	//	wss.broadcast(broadcast_msg);
	
	});
	wss.on('close', function() {
		console.log('disconnected');
	});



function get_world(str){
	// loop thru worlds list until you find the world with this name
	for(i=0; i<worlds.length; i++){
		if(worlds[i].name == str){
			return worlds[i];
		}
	}
}

function add_newplayer(world){
	var random1;
	var random2; 
	var added = false;
	var player = [];
	var id;
	while (!added){
		random1 = Math.ceil((Math.random() * (18) + 1));
		random2 = Math.ceil((Math.random() * (18) + 1));
		if(!is_occupied(world,random1, random2)){
			id = count;
			//players.push(count); 
			player.push("player");     
			player.push(id);
			player.push(random1);
			player.push(random2);
			world.actors.push(player);
	
			world.killcounts.push(0);
	
			// add this player's id to word's player list
			world.players.push(id);
		
			added = true;
			console.log("added player " + player[1]);
			count++;
		}
	 }
	    return player; 
	}
	
function move_actor(world, id,dx,dy){
	//find actor with this id 
	for(var i=0; i<world.actors.length;i++){
		if(world.actors[i][1] == id){
			//change the actors co-ordinates
		
			world.actors[i][2] += dx;	
			world.actors[i][3] += dy;
			
			return;
		}
	}
   }

function startGame(){
	// set an interval
	lst = [];
	// make monsters move
	setInterval(function(){
		// for world in worlds
		for(var i=0; i<worlds.length; i++){
		
			for(var j=0; j<worlds[i].actors.length; j++){
				if(worlds[i].actors[j][0]== "monster"){
				      var dxdy= requestMove();
				      var rx = worlds[i].actors[j][2] + dxdy[0];
				      var ry = worlds[i].actors[j][3]+ dxdy[1];
				      if (is_valid(worlds[i],rx,ry)){
			
				    	  // move the monster
				    	set_actor(worlds[i], worlds[i].actors[j][1],rx,ry);
					// tell players that a monster has stepped 
					wss.broadcast(JSON.stringify({world: worlds[i].name, operation:"move", id: worlds[i].actors[j][1], dx: dxdy[0], dy: dxdy[1]}));
					}
				}
			}
		}
	}
	, 3000);
			
	// call monster.step for all monsters (DOESN'T STEP EVERY TIME)
	// if the monster stepped, then BROADCAST to all clients 
}

function set_actor(world, id, newx, newy){
	// find the specific actor in the actors array 
	for(var i=0; i<world.actors.length;i++){
		if(world.actors[i][1] == id){
			//change the actors co-ordinates
			world.actors[i][2] = newx;	
			world.actors[i][3] = newy;
			return;
		}
	}
   }
		

function requestMove(){
		var x1 = Math.random();
		var y1 = Math.random();
		var dxdy = [];
		 
		if(x1 < 0.4){
			x1 = -1;
		}
		else if (x1 < 0.7 && x1 > 0.4){
			x1 = 0;
		}
		else if (x1 > 0.7){
			x1 = 1;
		}
		if (y1 < 0.4){
			y1 = -1;
		}
		else if (y1 < 0.7 && y1 > 0.4){
			y1 = 0;
		}
		else if (y1 > 0.7){
			y1 = 1;
		}

		dxdy.push(x1);
		dxdy.push(y1);
		return dxdy;
}
// PLAYER CLASS 
function Player(x,y,src,id){
	this.x = x;
	this.y = y;
	this.src = src;	
	this.rx = x;
	this.ry = y;
	this.killCount= 0;
	this.id = id;
}


Player.prototype.RequestMove=function(Rx, Ry){
	if((this.x + Rx)>0){
		this.rx = Rx + this.x;
	}
	if((this.y + Ry)>0){
		this.ry = Ry + this.y;
	}
}

Player.prototype.Move=function(Dx, Dy){
		this.x+=Dx;
	
		this.y += Dy;	
		this.rx = this.x;
		this.ry = this.y;
}	

//WALL CLASS
 
function Wall(x,y,src){
	this.x = x;
	this.y = y;
	this.src = src;
}



// MONSTER CLASS 
function Monster(x,y,src){
	this.x = x;
	this.y = y;
	this.src = src;
	this.Rx = x;
	this.Ry = y;


}

Monster.prototype.requestMove=function(){
		var x1 = Math.random();
		var y1 = Math.random();

		 
		if(x1 < 0.4){
			x1 = -1;
		}
		else if (x1 < 0.7 && x1 > 0.4){
			x1 = 0;
		}
		else if (x1 > 0.7){
			x1 = 1;
		}
		if (y1 < 0.4){
			y1 = -1;
		}
		else if (y1 < 0.7 && y1 > 0.4){
			y1 = 0;
		}
		else if (y1 > 0.7){
			y1 = 1;
		}
	
		this.Rx += x1;
		this.Ry += y1;

		if(this.Rx <2 || this.Rx >19){
			this.Rx = this.x;
		}

		if(this.Ry <2 || this.Ry >19){
			this.Ry = this.y;
		}	
}

Monster.prototype.move = function(dx,dy){
		this.x = dx;
		this.y = dy;
		this.rx = this.x;
		this.ry = this.y;
}


// SECRET BOX CLASS 

function SecretBox(x,y,src){
	this.x = x;
	this.y = y;
	this.src = src;
}

// BOX CLASS 

function Box(x,y,src){
	this.x = x;
	this.y = y;
	this.src = src;
}	

Box.prototype.move=function(rx, ry){
	this.x =rx;
	this.y =ry;
	
}


function actorsToJSON(world){

	var i;
	var lst = [];
	var random1 = Math.ceil((Math.random() * (18) + 1));
	var random2 = Math.ceil((Math.random() * (18) + 1));
	// for actor in this world

	for(i=0;i<world.actors.length;i++){
			lst.push({type:world.actors[i][0], id:world.actors[i][1], x:world.actors[i][2], y: world.actors[i][3]});
		}
	return lst;
			
}
function Stage(width, height, stageElementID){
	this.SPAWNED_MONSTERS=5;   // constant number of monsters initially put on the stage 
	this.dead_monsters=0;
	this.actors= []; // all actors on this stage (monsters, player, boxes, ...)
	this.player=null; // a special actor, the player
	this.clientActors = [];
	// the logical width and height of the stage
	this.width=width;
	this.height=height;

	// the element containing the visual representation of the stage
	this.stageElementID=stageElementID;

	// take a look at the value of these to understand why we capture them this way
	// an alternative would be to use 'new Image()'

}

	function initialize(world){
	//send the walls to the client
	console.log("initializing world " + world.name);
	var j=0;
	var l=0;
	var k=0;
	//ADDING BOXES
	while (j<=100){
		boxes = [];
		var random1 = Math.ceil((Math.random() * (18) + 1));
		var random2 = Math.ceil((Math.random() * (18) + 1));
		if(!is_occupied(world,random1, random2)){

			
			boxes.push("box");
			boxes.push(j);
			boxes.push(random1);
			boxes.push(random2);
			world.actors.push(boxes);
			j++;
			count++;
		}

	
	}
	// ADDING "SECRETBOXES" 
	while (l<=10){
		secretboxes = [];
		var random1 = Math.ceil((Math.random() * (18) + 1));
		var random2 = Math.ceil((Math.random() * (18) + 1));
		if(!is_occupied(world,random1, random2)){
			
		
			secretboxes.push("secretbox");
			secretboxes.push(j+l);
			secretboxes.push(random1);
			secretboxes.push(random2);
			world.actors.push(secretboxes);
			l++;
			count++;
		}
	
	}

	//ADDING REGULAR MONSTERS
	while (k<=3){
		monsters = [];
		var random1 = Math.ceil((Math.random() * (18) + 1));
		var random2 = Math.ceil((Math.random() * (18) + 1));
		if(!is_occupied(world,random1, random2)){

			
			monsters.push("monster");
			monsters.push(j+l+k);
			monsters.push(random1);
			monsters.push(random2);
			world.actors.push(monsters);
			k++;
			count++;
		}
	
	}  
	// add this world to the list of all worlds
	worlds.push(world);
	
}
// Return the ID of a particular image, useful so we don't have to continually reconstruct IDs
Stage.prototype.getStageId=function(x,y)
{ 
	return (x + "," + y);
	 
}


Stage.prototype.addActor=function(actor){
	this.clientActors.push(actor);

}


Stage.prototype.removeActor=function(actor){
	// Lookup javascript array manipulation (indexOf and splice).
	this.actors.splice(this.actors.indexOf(actor), 1);
}

// Set the src of the image at stage location (x,y) to src
Stage.prototype.setImage=function(x, y, src)
{
	document.getElementById(this.getStageId(x,y)).src = src;

}

