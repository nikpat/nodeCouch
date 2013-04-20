
/**
 * Module dependencies.
 */
var couchbase = require("couchbase");
var config = { 
                "debug" : false,
                "user" : "admin",
                "password" : "xxx",// dont forgot to put password
                "hosts" : [ "localhost:8091" ],
                "bucket" : "default"    
                };
couchbase.connect(config, function(err, bucket) {

	if(err){
		console.log("not connected");
	}
	else{
			console.log("connected");

			var util = require('util') 
			  , express = require('express')
			  , routes = require('./routes')
			  , user = require('./routes/user')
			  , http = require('http')
			  , path = require('path');

			var expressValidator = require('express-validator');
			var app = express();

			// all environments
			app.set('port', process.env.PORT || 3000);
			app.set('views', __dirname + '/views');
			app.set('view engine', 'ejs');
			app.use(express.favicon());
			app.use(express.logger('dev'));
			app.use(express.bodyParser());
			app.use(expressValidator);
			app.use(express.methodOverride());
			app.use(express.cookieParser('your secret here'));
			app.use(express.session());
			app.use(app.router);
			//app.use(bucket);
			
			app.use(express.static(path.join(__dirname, 'public')));

			// development only
			if ('development' == app.get('env')) {
			  app.use(express.errorHandler());
			}

			app.get('/', function(req,res){
		        bucket.get("hitcount", function(err, doc, meta) {
		            // @todo check the error reason!
		            if (!doc) {
		                doc = {count:0};
		            }
		            doc.count++;		        
		            console.log("hits", doc.count);
		            bucket.set("hitcount", doc, meta, function(err) {
		                if (err) {
		                    console.log("err");
		                } else {
		                    res.render('index', { title: 'Your are visitor no: ' + doc.count });
		                }
		            	});
		        	});	
			});

			app.post('/login',function(req,res){

				req.assert('email', 'required').notEmpty();
				req.assert('email', 'valid email required').isEmail();
				req.assert('password', '2 to 20 characters required').len(2, 20);

				var errors = req.validationErrors();
				var mappedErrors = req.validationErrors(true);

				if(errors){
					res.render('index', { errors:errors });

				}
				else{
					bucket.get("user_"+req.body.email, function(err, doc, meta) {

						if(doc){

							if(req.body.email == doc.email && req.body.password == doc.password) {

								res.send("Welcome");

							}
							else {

								res.send("Failure");

							}

						}
						else{

							res.send("User Not Found !!!");
						}					

					}); 
				}

			});

			app.all('/forgotpass',function(req,res){	
					bucket.get("user_"+req.body.email, function(err, doc, meta) {

						if(doc){
								var nodemailer = require("nodemailer");
								var smtpTransport = nodemailer.createTransport("SMTP",{
								    service: "Gmail",
								    auth: {
								        user: "nikhil@knaps.in",
								        pass: "xxx
								    }
								});


								// setup e-mail data with unicode symbols
								var token = parseInt(Math.random()*100000000000);
								var resetLink = "http://localhost:3000/reset?email="+req.body.email+"&token="+ token;
								
								var mailOptions = {
								    from: "Nikhil <foo@blurdybloop.com>", // sender address
								    to: req.body.email, // list of receivers
								    subject: "Password Reset", // Subject line
								    text: "password reset link :"+resetLink, // plaintext body
								    html: "<b>password reset link  :<a href='"+resetLink+"'>reset password<a></b>" // html body
								}

								// send mail with defined transport object
								smtpTransport.sendMail(mailOptions, function(error, response){
								    if(error){
								        console.log(error);
								    }else{
								    	res.send("New Password sent");
								        console.log("Message sent: " + response.message);
								        doc.token = token;
								        bucket.set("user_"+req.body.email, doc, meta, function(err) {
								                if (err) {
								                    console.log("err");
								                } else {
								                	console.log("token added")
								                    res.send(newdoc);
								                }
							            	});
								    }

								    // if you don't want to use this transport object anymore, uncomment following line
								    //smtpTransport.close(); // shut down the connection pool, no more messages
								});

						}
						else{

							res.send("User Not Found !!!");
						}					

					}); 
			});

			app.all('/signup',function(req,res){

				if(req.method == 'POST'){
			
				var newdoc = {
							email: req.body.email,
							password: req.body.email,
							username : req.body.username,
							firstname: req.body.firstname,
							lastname: req.body.lastname,
						}
				console.log(newdoc);
				req.assert('email', 'required').notEmpty();
				req.assert('email', 'valid email required').isEmail();
				req.assert('password', '2 to 20 characters required').len(2, 20);

				var errors = req.validationErrors();
				var mappedErrors = req.validationErrors(true);

				if(errors){
					console.log(errors);
					res.render('signup', { errors:errors });
				}
				else{
					bucket.get("user_"+req.body.email, function(err, doc, meta) {
							if(doc){

								res.send("User Exist");
							}
							else{						
								bucket.set("user_"+req.body.email, newdoc, meta, function(err) {
					                if (err) {
					                    console.log("err");
					                } else {
					                    res.send(newdoc);
					                }
				            	});
							}					

						}); 
					}
				}
				else{
					res.render('signup', { errors:errors });
				}
			});

			app.all('/reset',function(req,res){
					if(req.method=="POST"){
						var pass = req.body.password;
						var cpass = req.body.cpassword;
						if(pass == cpass){
							bucket.get("user_"+req.session.uemail, function(err, doc, meta) {
								if(err){
									res.send(err);
								}
								else if(doc){
									var newdoc = doc;
									newdoc.password = pass;
									bucket.set("user_"+doc.email, newdoc, meta, function(err) {
						                if (err) {
						                    console.log("err");
						                } else if(newdoc) {
						                    res.send(newdoc);
						                }

					            	});
								}
								else{
									console.log("usernotfound");
									 res.send("usernotfound");
								}

							});
						}
					}
					else{
						var email = req.query.email;
						var token = req.query.token;
						req.session.uemail = email;
						bucket.get("user_"+email, function(err, doc, meta) {
							if(doc){
								if(doc.token == token)
									res.render('resetpass', { email: doc.email });
								else
									res.send("Invalid Link");
							}
							else{
								res.send("User Not Found")
							}
						});
						
					}
			});

			http.createServer(app).listen(app.get('port'), function(){
			  console.log('Express server listening on port ' + app.get('port'));
			});
	}
});

