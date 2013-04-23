
/**
 * Module dependencies.
 */

var account_email = "nikhil@knaps.in";
var account_password = "knaps@123";
var couchbase = require("couchbase");
var config = { 
                "debug" : false,
                "user" : "admin",
                "password" : "knaps@123",
                "hosts" : [ "localhost:8091" ],
                "bucket" : "default"    
                };
couchbase.connect(config, function(err, bucket) {

	if(err){
		console.log("not connected");
	}
	else{
			console.log("connected");
			var fb_profile = undefined ;
			var util = require('util') 
			  , express = require('express')
			  , routes = require('./routes')
			  , user = require('./routes/user')
			  , http = require('http')
			  , path = require('path');
			var crypto = require("crypto");
			var passport = require("passport");
			var FacebookStrategy = require('passport-facebook').Strategy;
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
			app.use(passport.initialize());
			app.use(passport.session()); 
			app.use(app.router);

			
			passport.serializeUser(function(user, done) {
			  done(null, user.id);
			});

			passport.deserializeUser(function(id, done) {			 
			    done(err, user);			
			});
			
			var fb_user;
			passport.use(new FacebookStrategy({
			    clientID: "464918006910398",
			    clientSecret: "5e0f51ba35e7b7a5bda6ddbd660cc329",
			    callbackURL: "http://localhost:3000/auth/facebook/callback"
			  },
			  function(accessToken, refreshToken, profile, done) {
			  	console.log(profile);
			  	done(null, profile);
			  	fb_user = profile;
			  	/*			  		
			    User.findOrCreate(..., function(err, user) {
			      if (err) { return done(err); }
			      done(null, user);
			    }); */
			  }
			));

			  var GoogleStrategy = require('passport-google').Strategy;

				passport.use(new GoogleStrategy({
				    returnURL: 'http://localhost:3000/auth/google/return',
				    realm: 'http://localhost:3000/'
				  },
				  function(identifier, profile, done) {
				  	console.log(profile);
				  	fb_user = profile;
				  	/*
				    User.findOrCreate({ openId: identifier }, function(err, user) {
				      done(err, user);
				    }); */
				  }
				));
			//app.use(bucket);
			// Redirect the user to Facebook for authentication.  When complete,
			// Facebook will redirect the user back to the application at
			//     /auth/facebook/callback
			app.get('/auth/facebook', passport.authenticate('facebook'));

			// Facebook will redirect the user to this URL after approval.  Finish the
			// authentication process by attempting to obtain an access token.  If
			// access was granted, the user will be logged in.  Otherwise,
			// authentication has failed.
			app.get('/auth/facebook/callback', 
			  passport.authenticate('facebook', { successRedirect: '/profile',
			                                      failureRedirect: '/login' }));


			// Redirect the user to Google for authentication.  When complete, Google
			// will redirect the user back to the application at
			//     /auth/google/return
			app.get('/auth/google', passport.authenticate('google'));

			// Google will redirect the user to this URL after authentication.  Finish
			// the process by verifying the assertion.  If valid, the user will be
			// logged in.  Otherwise, authentication has failed.
			app.get('/auth/google/return', 
			  passport.authenticate('google', { successRedirect: '/profile',
			                                    failureRedirect: '/login' }));


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

							if(req.body.email == doc.email && crypto.createHash('sha1').update(req.body.password).digest('hex') == doc.password) {
								if(doc.account_status != "active"){
									res.send("Account Inactive Please verify link");
								}
								else{
									console.log(doc)
									req.session.user = doc;
									res.redirect('/profile');
								}
								

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
								        user: account_email,
								        pass: account_password,
								    }
								});


								// setup e-mail data with unicode symbols
								var token = parseInt(Math.random()*100000000000);
								//var resetLink = "http://localhost:3000/reset?email="+req.body.email+"&token="+ token;
								var resetLink = "http://165.225.132.91:3000/reset?email="+req.body.email+"&token="+ token;
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
			    var activation_token = parseInt(Math.random()*100000000000);
			    
				var newdoc = {
							email: req.body.email,
							password:crypto.createHash('sha1').update(req.body.password).digest('hex'),
							username : req.body.username,
							firstname: req.body.firstname,
							lastname: req.body.lastname,
							account_status: activation_token
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
					                    //res.send(newdoc);
										var nodemailer = require("nodemailer");
										var smtpTransport = nodemailer.createTransport("SMTP",{
										    service: "Gmail",
										    auth: {
										        user: account_email,
										        pass: account_password
										    }
										});


										// setup e-mail data with unicode symbols
										
										var activationLink = "http://165.225.132.91:3000/activate?email="+req.body.email+"&token="+ activation_token;
										//var activationLink = "http://127.0.0.1:3000/activate?email="+req.body.email+"&token="+ activation_token;
										var mailOptions = {
										    from: "Nikhil <foo@blurdybloop.com>", // sender address
										    to: req.body.email, // list of receivers
										    subject: "Account Activation", // Subject line
										    text: "Activation Link link :"+activationLink, // plaintext body
										    html: "<b>Activation link  :<a href='"+activationLink+"'>Click Here To Activate<a></b>" // html body
										}

										// send mail with defined transport object
										smtpTransport.sendMail(mailOptions, function(error, response){
										    if(error){
										        console.log(error);
										    }else{
										    	res.send("Activation link sent");
										        console.log("Message sent: " + response.message);										  									        
										        console.log("Activation Link Sent");
										    }

										    // if you don't want to use this transport object anymore, uncomment following line
										    //smtpTransport.close(); // shut down the connection pool, no more messages
										});

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

			app.all('/activate',function(req,res){
					
						var email = req.query.email;
						var token = req.query.token;
						req.session.uemail = email;
						bucket.get("user_"+email, function(err, doc, meta) {
							if(doc){
								if(doc.account_status == token){
									var newDoc = doc;
									newDoc.account_status = "active"
									bucket.set("user_"+email, newDoc, meta, function(err) {
						                if (err) {
						                    console.log("err");
						                } else {
						                	console.log("Account in active");
						                	res.send("Account in active");										                    
						                }
					            	});
								}
								else{
									res.send("Invalid Link");
								}
							}
							else{
								res.send("User Not Found")
							}
						});
						
					
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
									newdoc.password = crypto.createHash('sha1').update(pass).digest('hex');
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

			app.all("/profile",function(req,res){
				if(req.method == "POST"){
						var newdoc = {
							username : req.body.username,
							firstname: req.body.firstname,
							lastname: req.body.lastname
						}

						bucket.get("user_"+req.session.user.email, function(err, doc, meta) {
							if(err){
								res.send(err);
							}
							else if(doc){
								var newdoc = doc;
								newdoc.username = req.body.username;
								newdoc.firstname = req.body.firstname;
								newdoc.lastname = req.body.lastname;
								bucket.set("user_"+doc.email, newdoc, meta, function(err) {
					                if (err) {
					                    console.log("err");
					                } else if(newdoc) {
					                	req.session.user = newdoc ;
					                	res.render('profile',{user:req.session.user});	
					                   
					                }

				            	});
							}
							else{
								console.log("usernotfound");
								 res.send("usernotfound");
							}

						});

				}
				else{
					if(req.session.user){
					res.render('profile',{user:req.session.user});
					}else{
						try{
							res.send("Welcome : "+ fb_user.displayName );
							}
						catch(err){
							res.send("Welcome : "+ fb_user.name );
						}

					}
				}
				 
			});

			http.createServer(app).listen(app.get('port'), function(){
			  console.log('Express server listening on port ' + app.get('port'));
			});
	}
});

