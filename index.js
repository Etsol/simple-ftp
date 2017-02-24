#!/usr/bin/env node

var ftpd = require('ftpd');
var fs = require('fs');
var path = require('path');
var config = require('./config.json');
var program = require('commander');
var argv = require('yargs').argv;
var chalk = require('chalk');

var server;
var options = {
	host: argv.host || config.host || '127.0.0.1',
	port: argv.port || config.port || 21,
	tld: null
};

program
.version(require('./package.json').version)
.usage('\r  Uso: ftpserver [OPTIONS]')
.description('Servidor FTP simple con permisos de lectura y escritura.\n' +
'  Configuración y usuarios en config.json')
.option('--host', 'Host del FTP (Default: "' + options.host + '")')
.option('--port', 'Puerto del FTP (Default: "' + options.port + '")')
.option('--root', 'Carpeta base (Default: "' + (config.root || process.cwd()) + '")');

program.parse(process.argv);


server = new ftpd.FtpServer(options.host, {
	getInitialCwd: () => './',
	getRoot: () => {
		var folder = argv.root || config.root || '.';
		return /^\s*[a-zA-Z]\:.*$/.test(folder) ? folder : path.join(process.cwd(), folder);
	},
	pasvPortRangeStart: 1025,
	pasvPortRangeEnd: 1050,
	tlsOptions: options.tls,
	allowUnauthorizedTls: true,
	useWriteFile: false,
	useReadFile: false,
	uploadMaxSlurpSize: 7000 // N/A unless 'useWriteFile' is true.
});

server.on('error', function (error) {
  console.log(chalk.red('FTP Server error:'), error);
});

server.on('client:connected', function (connection) {
	var username = null;

	connection.on('command:user', function (user, success, failure) {
		for (var i = 0; i < config.users.length; i++) {
			var u = config.users[i];
			if (u && u.user == user) {
				username = user;
				return success();
			}
		}

		failure();
	});

	connection.on('command:pass', function (pass, success, failure) {
		for (var i = 0; i < config.users.length; i++) {
			var u = config.users[i];
			if (u && u.user == username && u.password == pass) {
				console.log(chalk.yellow('Cliente conectado:'), username);
				return success(username);
			}
		}

		failure();
	});
});

server.debugging = 4;
server.listen(options.port);
console.log(chalk.green('FTP corriendo en -> ftp://' + options.host + (options.port == 21 ? '' : options.port)));
console.log(chalk.yellow('ROOT:'), server.getRoot());