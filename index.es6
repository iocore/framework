'use strict';

import path from 'path';
import favicon from 'serve-favicon';
import logger from 'morgan';
import * as fs from 'fs';
import * as http from 'http';
import * as https from 'https';
import { EventEmitter } from 'events';
import { first, last, initial } from 'underscore';
import * as colors from 'colors';
let moment = require('moment');
import * as constants from './core/constants';

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
        this.env = env || constants.ENV_PRODUCTION;
        this.cwd = cwd || process.cwd();
        this.modulesCache = {};
        this.modulesDependenciesCache = {};
        this.commandsClassesInstancesCache = {};
        this.kernelListeners = {};
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
    }

    /**
     * Initializing kernel logic
     *
     * @returns {ioCore}
     */
    bootstrap()
    {
        this.log('Bootstrapping:');

        // Initiating modules bootstrapping
        this.bootstrapModules();
        this.runKernelEvent(constants.KERNEL_EVENT_MODULES_REGISTERED);

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

        this.httpServer = http.createServer(this.dispatcher)
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
         https.createServer(httpsSettings.serverOptions, this.dispatcher)
         .listen(httpsSettings.port);

         this.runKernelEvent(constants.KERNEL_EVENT_HTTPS_SERVER_READY, httpsSettings);*/
        // TODO: deal with workers

        return this;
    }

    /**
     * Main core dispatcher
     *
     * Receives request and response objects
     *
     * Runs installed middlewares globally or depending of the request information (URI, method, etc)
     * After this runs Module-Controller-Action depending of the request information
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
        // TODO: find Module-Controller-Action situated for request
        // TODO: if not found Module-Controller-Action then show 404 page
        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/plain');
        res.end('Hello World\n');

        // TODO: post-dispatch hook
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

    isModuleBootstrapped(moduleName)
    {
        this.checkModuleInCache(moduleName);
        return this.modulesCache[moduleName].hasOwnProperty('bootstrapInstance');
    }

    /**
     * Recursively registering modules
     *
     * @param rootModuleName
     * @returns {ioCore}
     */
    bootstrapModules(rootModuleName=this.cwd)
    {
        this.log('\t- Registering modules');
        this.iterateOverModules(rootModuleName, (moduleName) => {
            if (this.isModuleBootstrapped(moduleName)) {
                return this;
            }

            let moduleInstance = require(moduleName);

            if (!moduleInstance.Bootstrap) {
                throw Error(this.error(`Module "${moduleName}" does not seems like a valid module, Bootstrap object expected`, true));
            }

            this.modulesCache[moduleName]['bootstrapInstance'] = new moduleInstance.Bootstrap(this);
            this.subscribeModuleToKernelEvents(moduleName);
        });
        return this;
    }

    /**
     * Setting up pre and post dispatch hooks (ie middlewares)
     *
     * @param rootModuleName
     * @returns {ioCore}
     */
    setupDispatchHooks(rootModuleName=this.cwd)
    {
        this.log('\t- Setup dispatch hooks');
        this.iterateOverModules(rootModuleName, (moduleName) => {
            // TODO
        });
        return this;
    }

    /**
     * Recursively iterate over all the dependency tree of modules
     * and call callback for each of them
     *
     * TODO: add infinity recursion protection
     *
     * @param moduleName
     * @param moduleInstanceCallback
     */
    iterateOverModules(moduleName, moduleInstanceCallback)
    {
        let dependencies = this.getModuleDependencies(moduleName);

        dependencies.forEach(dependency => {
            this.iterateOverModules(dependency, moduleInstanceCallback);
        });

        moduleInstanceCallback(moduleName);
    }

    /**
     * Subscribing specified module by it's name to desired events with needed priority
     *
     * @param moduleName
     * @returns {ioCore}
     */
    subscribeModuleToKernelEvents(moduleName)
    {
        if (!this.modulesCache[moduleName]['bootstrapInstance'].onKernelEventsSubscribe
            || typeof this.modulesCache[moduleName]['bootstrapInstance'].onKernelEventsSubscribe !== 'function'
        ) {
            let errorMessage = this.error(`Bootstrap class in module ${moduleName} should be inherited from iocore/core/bootstrap class`, true);
            throw new Error(errorMessage);
        }

        let kernelSubscriptions = this.modulesCache[moduleName]['bootstrapInstance'].onKernelEventsSubscribe();

        Reflect.ownKeys(kernelSubscriptions).forEach((eventName) => {
            let eventData = kernelSubscriptions[eventName];
            let priority = eventData.priority || constants.PRIORITY_NORMAL;

            if (!this.kernelListeners.hasOwnProperty(eventName)) {
                this.kernelListeners[eventName] = {};
            }

            if (!this.kernelListeners[eventName].hasOwnProperty(priority)) {
                this.kernelListeners[eventName][priority] = [];
            }
            this.kernelListeners[eventName][priority].push(eventData);
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
     * Creates empty cache object for moduleName if not exists
     *
     * @param moduleName
     */
    checkModuleInCache(moduleName)
    {
        if (!this.modulesCache[moduleName]) {
            this.modulesCache[moduleName] = {};
        }
    }

    /**
     * Returning base folder of module which suppose to be included or used
     *
     * @param moduleName
     * @returns String
     */
    getModuleFolder(moduleName)
    {
        this.checkModuleInCache(moduleName);
        if (!this.modulesCache[moduleName]['baseFolder']) {
            this.modulesCache[moduleName]['baseFolder'] = path.dirname(require.resolve(moduleName));
        }
        return this.modulesCache[moduleName]['baseFolder'];
    }

    /**
     * Returns config filename regarding the environment
     * Default configuration file is `config` with extension `.json`
     *
     * Configuration files contains strongly json raw data
     * To not bring logic into configuration
     *
     * @param configFileName
     * @param extension
     * @param useEnv
     * @returns {*}
     */
    getConfigFilename(
        configFileName='config',
        extension=constants.DEFAULT_CONFIG_EXT,
        useEnv=true
    ) {
        if (useEnv && this.env !== constants.ENV_PRODUCTION) {
            configFileName += '_' + this.env;
        }
        configFileName += extension;
        return path.join(constants.CONFIGS_FOLDER, configFileName);
    }

    /**
     * Getting module config contents as JSON
     *
     * @param moduleName
     * @param configFileName
     * @param extension
     * @param useEnv
     * @returns {{}|*}
     */
    getModuleConfig(
        moduleName,
        configFileName='config',
        extension=constants.DEFAULT_CONFIG_EXT,
        useEnv=true
    ) {
        let baseFolder = this.getModuleFolder(moduleName);
        let configFilePath = path.join(
            baseFolder,
            this.getConfigFilename(configFileName, extension, useEnv)
        );
        return ioCore.readModuleConfigJson(configFilePath);
    }

    /**
     * Reading json data from config file
     *
     * @param configFileName
     * @returns {*}
     */
    static readModuleConfigJson(configFileName)
    {
        try {
            return JSON.parse(fs.readFileSync(configFileName));
        } catch (e) {
            return {};
        }
    }

    /**
     * Returns contents of module dependencies[_{env}].json
     * Like all the other json configs production dependencies
     * are located in dependencies.json
     * When all the other environment-specified dependencies
     * are located in dependencies_{env}.json
     *
     * @returns Array
     */
    getModuleDependencies(moduleName)
    {
        if (this.modulesDependenciesCache.hasOwnProperty(moduleName)) {
            return this.modulesDependenciesCache[moduleName];
        }

        // First try to load dependencies list from environment-specified json
        let dependencies = this.getModuleConfig(
            moduleName,
            'dependencies',
            constants.DEFAULT_CONFIG_EXT
        ).dependencies || [];

        if (!dependencies.length && this.env !== constants.ENV_PRODUCTION) {
            // Dependencies from dependencies_{env}.json is empty
            // Trying to read dependencies.json (production one)

            this.log(`Environment deps for ${moduleName} module not found. Trying prod..`);

            dependencies = this.getModuleConfig(
                moduleName,
                'dependencies',
                constants.DEFAULT_CONFIG_EXT,
                false
            ).dependencies || []
        }

        this.modulesDependenciesCache[moduleName] = dependencies;

        return this.modulesDependenciesCache[moduleName];
    }

    /**
     * Registering CLI commands from every module
     *
     * @returns Object
     */
    registerModuleCommands(moduleName)
    {

    }

    /**
     * Running command and returning result
     *
     * Example of command:
     *      >iocore iocore:server:run       // internal framework command
     *      >iocore iocore-assetic:dump     // other installed module command
     *
     * Commands can receive arguments:
     *      >iocore iocore:sever:run 127.0.0.1 3000
     *
     * In this case method should be declared like this:
     *      run(server='127.0.0.1', port=80) {...}
     *
     * @param command
     * @returns {}
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

            let commandModule = require(commandInfo.path);

            // Caching command class instance
            this.commandsClassesInstancesCache[command] = new commandModule[commandInfo._class]().setContainer(this);

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
        let commandClass = commandFileName.charAt(0).toUpperCase()
            + commandFileName.substring(1).toLowerCase() + 'Command';

        // Path to the command class file
        // For example if command is "server" in module "iocore" then path would be "iocore/commands/server"
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
