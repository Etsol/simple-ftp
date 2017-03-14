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
	logLevel: 4, // ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3, TRACE: 4
	host: argv.host || config.host || '127.0.0.1',
	port: argv.port || config.port || 21,
	tls: null
};

var getRoot = () => {
	var folder = argv.root || config.root || '.';
	return /^\s*[a-zA-Z]\:.*$/.test(folder) ? folder : path.join(process.cwd(), folder);
};

program
.version(require('./package.json').version)
.usage('\r  Uso: ftpserver [OPTIONS]')
.description('Servidor FTP simple con permisos de lectura y escritura.\n' +
'  Configuración y usuarios en config.json')
.option('--host', 'Host del FTP (Default: "' + options.host + '")')
.option('--port', 'Puerto del FTP (Default: "' + options.port + '")')
.option('--root', 'Carpeta base (Default: "' + getRoot() + '")')
.option('--log-level', 'Nivel de log (Default: ' + options.logLevel + ') [ERROR (0) | WARN (1) | INFO (2) | DEBUG (3) | TRACE (4)]')
.option('--config-dir', 'Ruta del archivo de configuración')
.option('--config-edit', 'Editar el archivo de configuración');

program.parse(process.argv);

if (argv['log-level'] || argv['log-level'] === 0) {
	switch (String(argv['log-level']).toUpperCase()) {
		case 'ERROR':
		case '0':
			options.logLevel = 0;
			break;
		case 'WARN':
		case 'WARNING':
		case '1':
			options.logLevel = 1;
			break;
		case 'INFO':
		case '2':
			options.logLevel = 2;
			break;
		case 'DEBUG':
		case '3':
			options.logLevel = 3;
			break;
		case 'TRACE':
		case '4':
			options.logLevel = 4;
			break;
	}
}

if (argv['config-dir']) {
	console.log('Archivo de configuración: (--edit-config para modificarlo)');
	return console.log(chalk.yellow(path.join(__dirname, 'config.json')));
}

if (argv['config-edit']) {
	var editor = require('editor');
	return editor(path.join(__dirname, 'config.json'), (code, sig) => {
		if (code == 0)
			console.log(chalk.blue('Exit code: ' + code));
		else {
			console.error(chalk.red('Error al editar el archivo de configuración'));
			console.error(chalk.red('Exit code: ' + code));
			console.error(chalk.red('Signal:'), sig);
		}
	});
}

server = new ftpd.FtpServer(options.host, {
	getInitialCwd: () => './',
	getRoot: getRoot,
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

server.debugging = options.logLevel;
server.listen(options.port);
console.log(chalk.green('FTP corriendo en -> ftp://' + options.host + (options.port == 21 ? '' : options.port)));
console.log(chalk.yellow('ROOT:'), server.getRoot());
