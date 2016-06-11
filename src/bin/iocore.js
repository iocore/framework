#!/usr/bin/env node
var ioCore = require('iocore').ioCore;
var constants = require('iocore/core/constants');
var application = new ioCore(process.env['IOCORE_ENV'] || constants.ENV_PRODUCTION, process.env['IOCORE_CWD'] || process.cwd());

// Running command
application.runCommand(process.argv[2], process.argv.slice(3));