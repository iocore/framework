import path from 'path';
import favicon from 'serve-favicon';
import logger from 'morgan';
import * as http from 'http';
import * as https from 'https';
import { EventEmitter } from 'events';
import { first, last, initial, isNull, isArray } from 'underscore';
import * as colors from 'colors';
let moment = require('moment');
import * as constants from './constants';

import { JsonConfigResolverService } from './config';
import { BundlesResolverService } from './bundles';
import { EnvironmentService } from './env';
import { DependencyManagerService } from './di';

/**
 * Main framework class
 */
export class ioCore extends EventEmitter
{
    /**
     * Framework core constructor
     *
     * @param env Application environment
     * @param cwd Application root folder
     * @param args
     */
    constructor(env, cwd, ...args)
    {
        super(...args);
        this.cwd = cwd || process.cwd();
        this.bundlesCache = {};
        this.commandsClassesInstancesCache = {};
        this.preDispatchHooks = {};
        this.postDispatchHooks = {};
        this.httpServer = null;
        this.httpsServer = null;

        this.log('------------------------');
        this.log('│   ┬┌─┐╔═╗┌─┐┬─┐┌─┐   │');
        this.log('│   ││ │║  │ │├┬┘├┤    │');
        this.log('│   ┴└─┘╚═╝└─┘┴└─└─┘   │');
        this.log('│   http://iocore.org  │');
        this.log('------------------------');

        // Creating environment
        this.environmentService = new EnvironmentService(env);

        // Initialising config resolver
        this.jsonConfigResolverService = new JsonConfigResolverService(this.environmentService);

        // Initialising bundles iterator
        this.bundlesResolverService = new BundlesResolverService(this.jsonConfigResolverService);

        // Initialising Dependency Manager
        this.dependencyManagerService = new DependencyManagerService(this.bundlesResolverService);
        this.bundlesResolverService.setDependencyManager(this.dependencyManagerService);

        console.log(this.dependencyManagerService.get('foo'));
        console.log(this.bundlesResolverService.getTree());
    }

    /**
     * Initializing kernel logic
     *
     * @returns {ioCore}
     */
    bootstrap()
    {
        this.log('Bootstrapping:');

        // Initiating bundles bootstrapping
        this.bundlesResolverService.buildBundlesTree()
            .compileConfigurations()
            .bootstrapBundles();

        return this;
        this.runKernelEvent(constants.KERNEL_EVENT_BUNDLES_REGISTERED);

        this.setupDispatchHooks();
        this.runKernelEvent(constants.KERNEL_EVENT_DISPATCH_HOOKS_READY);

        this.runKernelEvent(constants.KERNEL_EVENT_BOOTSTRAP_READY);
        return this;
    }

    /**
     * Starting servers and making forks
     *
     * @returns {ioCore}
     */
    listen(httpCallback=null, httpsCallback=null)
    {
        return this;
        let httpSettings = {
            port: 3000,
            host: '127.0.0.1',
            callback: httpCallback ? httpCallback : function(){}
        };
        this.runKernelEvent(constants.KERNEL_EVENT_HTTP_SERVER_SETTINGS_READY, httpSettings);

        let httpsSettings = {
            port: 443,
            host: '127.0.0.1',
            callback: httpsCallback ? httpsCallback : function(){}
        };
        this.runKernelEvent(constants.KERNEL_EVENT_HTTPS_SERVER_SETTINGS_READY, httpsSettings);

        this.httpServer = http.createServer(this.bundlesspatcher.bind(this))
            .listen(
            httpSettings.port,
            httpSettings.host,
            () => {
                httpSettings.callback(httpSettings)
            }
        );

        this.runKernelEvent(constants.KERNEL_EVENT_HTTP_SERVER_READY, this.httpServer);

        // Initialising HTTPS server
        // TODO: if certificate has been specified, listen to 443 too
        /*let httpsSettings = {
         port: 443,
         serverOptions: {}
         };
         this.httpsServer =
         https.createServer(httpsSettings.serverOptions, this.bundlesspatcher.bind(this))
         .listen(httpsSettings.port);

         this.runKernelEvent(constants.KERNEL_EVENT_HTTPS_SERVER_READY, httpsSettings);*/
        // TODO: deal with workers

        return this;
    }

    /**
     * Running http pre-dispatch hook
     * Here all the installed middlewares will be dispatched in following sequence:
     * 1) by priority from highest to lowest
     * 2) by subscribing order in specified priority
     *
     * This will allow to use all existing today middlewares, as well as Express middlewares
     *
     * @param req
     * @param res
     */
    runPreDispatchHooks(req, res)
    {
        return this;
    }

    /**
     * Main core dispatcher
     *
     * Receives request and response objects
     *
     * Runs installed middlewares globally or depending of the request information (URI, method, etc)
     * After this runs Bundle-Controller-Action depending of the request information
     * Collects returned response from controller-action and depending of it's contents understands what to do:
     *  1) if it is regular Response class returned then it should be html/...
     *  2) if it is XMLResponse, JSONResponse, NotFoundResponse etc - then perform needed content type
     *  3) if helper function of the controller class was used: this.render(), this.echo(), then ...
     *  4) Controller class will have for sure following methods:
     *      - getRequest() (getHeaders(), getCookie(s), get..)
     *      - getResponse() (setHeader(s), setCookie(), set..)
     *  5) Controller can throw exception, then depending of exception we'll set response code and render template
     *
     * @param req
     * @param res
     */
    dispatcher(req, res)
    {
        this.runPreDispatchHooks(req, res);

        // TODO: run middlewares arranged by priorities
        // TODO: instantiate request and response singletones
        // TODO: check what URL and other request information
        // TODO: find Bundle-Controller-Action situated for request
        // TODO: if not found Bundle-Controller-Action then show 404 page
        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/plain');
        res.end('Hello World\n');

        // TODO: post-dispatch hook
    }


    /**
     * Setting up pre and post dispatch hooks (ie middlewares)
     * @returns {ioCore}
     */
    setupDispatchHooks()
    {
        this.log('\t- Setup dispatch hooks');
        this.dependenciesTree.forEach((dependency) => {
            this.bundles.iterateOverBundles(dependency.bundle, (bundleName) => {
                // TODO
            });
        });
        return this;
    }


    /**
     * Removing all existing kernel listeners
     *
     * @returns {ioCore}
     */
    clearKernelListeners()
    {
        this.kernelListeners = {};
        return this;
    }

    runKernelEvent(eventName, ...args)
    {
        if (!this.kernelListeners[eventName]) {
            return;
        }

        for (let priority = constants.PRIORITY_HIGHEST; priority <= constants.PRIORITY_LOWEST; priority++) {
            let eventSubscribers = this.kernelListeners[eventName][priority] || [];
            eventSubscribers.forEach((subscriber) => {
                if (subscriber.callback && typeof subscriber.callback === 'function') {
                    subscriber.callback(...args);
                }
            });
        }
    }


    /**
     * Registering CLI commands from every bundle
     *
     * @returns Object
     */
    registerBundleCommands(bundleName)
    {

    }

    /**
     * Running command and returning result
     *
     * Example of command:
     *      >iocore iocore:server:run       // internal framework command
     *      >iocore iocore-assetic:dump     // other installed bundle command
     *
     * Commands can receive arguments:
     *      >iocore iocore:sever:run 127.0.0.1 3000
     *
     * In this case method should be declared like this:
     *      run(server='127.0.0.1', port=80) {...}
     *
     * @param command
     * @param args
     * @returns {*}
     */
    runCommand(command, ...args)
    {
        command = this.getCommandInstance(command);
        let commandMethod = command.classInstance[command.method];
        return commandMethod.bind(command.classInstance)(...args);
    }

    /**
     * Getting instance of command
     *
     * @param command
     * @returns {*}
     */
    getCommandInstance(command)
    {
        try {
            let commandInfo = ioCore.getCommandInfo(command);

            // If we have class instance cached then it's enough for us to return
            if (this.commandsClassesInstancesCache.hasOwnProperty(command)) {
                return {
                    method: commandInfo.method,
                    classInstance: this.commandsClassesInstancesCache[command]
                }
            }

            let commandBundle = require(commandInfo.path);

            // Caching command class instance
            this.commandsClassesInstancesCache[command] = new commandBundle[commandInfo._class]().setContainer(this);

            return {
                method: commandInfo.method,
                classInstance: this.commandsClassesInstancesCache[command]
            }
        } catch (e) {
            throw new Error('Command not found: ' + command + ': ' + e.message);
        }
    }

    /**
     * Getting command information to write it when user requesting help over commands
     *
     * @param command
     * @return {method,_class,path}
     */
    static getCommandInfo(command)
    {
        let commandSections = command.split(':');

        // Adding commands/ folder to sections to composite it right way
        commandSections.splice(1, 0, 'commands');

        // Extracting method name
        let commandMethodName = last(commandSections);

        // Removing method name from sections
        commandSections = initial(commandSections);

        // Extracting filename
        let commandFileName = last(commandSections);

        // Compiling class name. For example if command is "server" then command class would be "ServerCommand"
        let commandClass = commandFileName.charAt(0).toUpperCase() + commandFileName.substring(1).toLowerCase() + 'Command';

        // Path to the command class file
        // For example if command is "server" in bundle "iocore" then path would be "iocore/commands/server"
        let commandPath = commandSections.join(path.sep);

        return {
            method: commandMethodName,
            _class: commandClass,
            path: commandPath
        }
    }

    /**
     * Writes to stdout log message
     * If isReturned parameter is provided then message should be returned instead of wrote to stdout
     *
     * @param message
     * @param isReturned
     * @returns {*}
     */
    log(message, isReturned=false)
    {
        let currentTimestamp = moment().format();
        let log = `[${this.env}][${currentTimestamp}] `.bold.green + `${message}`.green + '\n';
        if (isReturned)
        {
            return log;
        }
        process.stdout.write(log);
    }

    /**
     * Writes to stderr log message
     * If isReturned parameter is provided then message should be returned instead of wrote to stderr
     *
     * @param message
     * @param isReturned
     * @returns {*}
     */
    error(message, isReturned=false)
    {
        let currentTimestamp = moment().format();
        let log = `[${this.env}][${currentTimestamp}] `.bold.red + `${message}`.red + '\n';
        if (isReturned)
        {
            return log;
        }
        process.stderr.write(log);
    }
}
