var express = require('express');
var router = express();
var fs= require('fs');
app= express();
var winston= require('winston');
var loggly = require('winston-loggly');
App = require("app.json"); // Used for configuration and by Heroku
var passport=require('passport');
var Account = require('../models/account');


// Includes termination condition
router.is_solution = require("./is_solution.js");
// Other configuration variables
router.config = App.new(__dirname + "/app.json");
/* GET home page. */
// configure for openshift or heroku
var server_ip_address = process.env.OPENSHIFT_NODEJS_IP || '0.0.0.0';
router.set('port', (process.env.PORT || process.env.OPENSHIFT_NODEJS_PORT || 5555));
router.set('trust proxy', true );
var log_dir = process.env.OPENSHIFT_DATA_DIR || "log";
if (!fs.existsSync(log_dir)){
  fs.mkdirSync(log_dir);
}
// set up static dir
//app.use(express.static(__dirname + '/public'));
/* GET home page. */

router.get('/', function(req, res, next) {
  res.render('index', { user: req.user});

  //console.log("numeroooo: "+score);
   /*if(req.user){
    res.render('index',{user: req.user,lvl:nivel(USERS[req.user.username])});
  }*/
});
router.get('/register', function(req, res) {
  res.render('register', { });
});
router.post('/register', function(req, res) {
  console.log("se va ha agregar la cuenta");
  var cuenta=new Account({ username : req.body.username, edad:req.body.edad, pais:req.body.pais, email: req.body.email});
  Account.register(cuenta, req.body.password, function(err, account) {
    if (err) {
      return res.render( "register",{info: err.message});
    }

    console.log("registrado sin error");
    passport.authenticate('local')(req, res, function () {
      res.redirect('/');
    });
  });
});
router.get('/login', function(req, res) {
  res.render('login', { user : req.user });

});
router.post('/login', passport.authenticate('local'), function(req, res) {
  res.redirect('/');

});
router.get('/logout', function(req, res) {
  req.logout();
  res.redirect('/');
});

// set up experiment sequence
var sequence = 0;
var temp = new Date();
var date_str = temp.getFullYear() + "-" + (1 + temp.getMonth()) + "-"+ temp.getDate();

// create logger to console and file
var logger = new (winston.Logger)({
  transports: [
    new (winston.transports.Console)( { level: 'info'} ),
    new (winston.transports.File)({ filename: log_dir+'/nodio-'+date_str+ "-" + sequence+'.log', level: 'info' })
  ]
});

// set up Loggly logger if it is configured by env variables
if ( process.env.LOGGLY_TOKEN && process.env.LOGGLY_PASS && process.env.LOGGLY_USER) {
  logger.add( winston.transports.Loggly,
      { inputToken: process.env.LOGGLY_TOKEN ,
        level: 'info',
        subdomain: process.env.LOGGLY_USER,
        json: true,
        "auth": {
          "username": process.env.LOGGLY_USER,
          "password": process.env.LOGGLY_PASS
        }
      } );
}
// internal variables
var chromosomes = {};
var IPs = {};
var USERS={};
var user = "anonimo";
//var score=0;
// Retrieves a random chromosome
router.get('/random', function(req, res){
  if (Object.keys(chromosomes ).length > 0) {
    var keys = Object.keys(chromosomes );
    var one = keys[ Math.floor(keys.length*Math.random())];
    res.send( { 'chromosome': one } );
    logger.info('get');
  } else {
    res.status(404).send('No chromosomes yet');
  }

});
// Retrieves the whole chromosome pool
router.get('/chromosomes', function(req, res){
  res.send( chromosomes );
});
// Retrieves the IPs used
router.get('/IPs', function(req, res){
  res.send( IPs );
});
router.get('/me', function(req, res){
  if(req.user){
    res.send({score:USERS[req.user.username]});
   // console.log(USERS[req.user.username]);
  }
});

router.get('/users', function(req, res){
  res.send( USERS );
});

// Retrieves the sequence number
router.get('/seq_number', function(req, res){
  res.send( { "number": sequence} );
});
// Adds one chromosome to the pool, with fitness
router.put('/one/:chromosome/:fitness/:uuid', function(req, res){
  if ( req.params.chromosome ) {
    chromosomes[ req.params.chromosome ] = req.params.fitness; // to avoid repeated chromosomes
    var client_ip;
    if ( ! process.env.OPENSHIFT_NODEJS_IP ) { // this is not openshift
      client_ip = req.connection.remoteAddress;
    } else {
      client_ip = req.headers['x-forwarded-for'];
    }

    if ( !IPs[ client_ip ] ) {
      IPs[ client_ip ]=1;
    } else {
      IPs[ client_ip ]++;
    }

    //condicional para saber si es un usuario anonimo o no

    if (!req.user){
      user="anonimo";
       //guardar el score++
     }else {
      user=req.user.username;
      if(!USERS[user]){
        USERS[user]=1;
      } else {
        USERS[user]++;
      }
      //score=USERS[req.user.username];
    }
    logger.info("put", { chromosome: req.params.chromosome,
      fitness: parseInt(req.params.fitness),
      IP: client_ip, user:user,
      worker_uuid:req.params.uuid} );

    res.send( { length : Object.keys(chromosomes).length } );
    if ( router.is_solution( req.params.chromosome, req.params.fitness, router.config.vars.traps, router.config.vars.b ) ) {
      console.log( "Solution!");
      logger.info( "finish", { solution: req.params.chromosome } );
      chromosomes = {};
      sequence++;

      logger.info( { "start": sequence });
    }
  } else {
    res.send( { length : 0 });
  }

});
// Logs worker info
router.put('/worker/:uuid/:popsize', function(req, res){

  var client_ip;
  if ( ! process.env.OPENSHIFT_NODEJS_IP ) { // this is not openshift
    client_ip = req.connection.remoteAddress;
  } else {
    client_ip = req.headers['x-forwarded-for'];
  }

  logger.info("worker", {
    IP: client_ip,
    worker_uuid:req.params.uuid,
    pop_size:req.params.popsize} );
  res.send( { length : 0 });

});
// Error check
router.use(function(err, req, res, next){
  //check error information and respond accordingly
  console.error( "Exception in server ", err.stack);
});
// Start listening
router.listen(router.get('port'), server_ip_address, function() {
  console.log("Node app is running at http://localhost:" + router.get('port'));
  logger.info( { "start": sequence });
})
// Exports for tests

var nivel = function ( dato ) {
  var a=10; var b=736;
  if(dato<=a){
    return lvl=0;
  }
  else if((a<dato) && (dato<=(a+b)/2)){
    return lvl=Math.round((2*(Math.pow((dato-a)/(b-a),2)))*100);
  }
  else if ((a+b)/2 <dato && dato<=b){
    return lvl=Math.round((1-2*(Math.pow(((b-dato)/(b-a)),2)))*100);
  }
  else if(b<=dato){
    return lvl=1;
  }
}
module.exports = router;
